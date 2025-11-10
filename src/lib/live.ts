/* eslint-disable no-constant-condition */

import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";

const defaultUA = 'AptvPlayer/1.4.10'

export interface LiveChannels {
  channelNumber: number;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
  epgUrl: string;
  epgs: {
    [key: string]: {
      start: string;
      end: string;
      title: string;
    }[];
  };
}

const cachedLiveChannels: { [key: string]: LiveChannels } = {};

export function deleteCachedLiveChannels(key: string) {
  delete cachedLiveChannels[key];
}

export async function getCachedLiveChannels(key: string): Promise<LiveChannels | null> {
  if (!cachedLiveChannels[key]) {
    const config = await getConfig();
    const liveInfo = config.LiveConfig?.find(live => live.key === key);
    if (!liveInfo) {
      return null;
    }
    const channelNum = await refreshLiveChannels(liveInfo);
    if (channelNum === 0) {
      return null;
    }
    liveInfo.channelNumber = channelNum;
    await db.saveAdminConfig(config);
  }
  return cachedLiveChannels[key] || null;
}

export async function refreshLiveChannels(liveInfo: {
  key: string;
  name: string;
  url: string;
  ua?: string;
  epg?: string;
  from: 'config' | 'custom';
  channelNumber?: number;
  disabled?: boolean;
}): Promise<number> {
  if (cachedLiveChannels[liveInfo.key]) {
    delete cachedLiveChannels[liveInfo.key];
  }
  const ua = liveInfo.ua || defaultUA;
  const response = await fetch(liveInfo.url, {
    headers: {
      'User-Agent': ua,
    },
  });
  const data = await response.text();
  const result = parseUniversalPlaylist(liveInfo.key, liveInfo.url, data);
  const epgUrl = liveInfo.epg || result.tvgUrl;
  const epgs = await parseEpg(epgUrl, liveInfo.ua || defaultUA, result.channels.map(channel => channel.tvgId).filter(tvgId => tvgId));
  cachedLiveChannels[liveInfo.key] = {
    channelNumber: result.channels.length,
    channels: result.channels,
    epgUrl: epgUrl,
    epgs: epgs,
  };
  return result.channels.length;
}

async function parseEpg(epgUrl: string, ua: string, tvgIds: string[]): Promise<{
  [key: string]: {
    start: string;
    end: string;
    title: string;
  }[]
}> {
  if (!epgUrl) {
    return {};
  }

  const tvgs = new Set(tvgIds);
  const result: { [key: string]: { start: string; end: string; title: string }[] } = {};

  try {
    const response = await fetch(epgUrl, {
      headers: {
        'User-Agent': ua,
      },
    });
    if (!response.ok) {
      return {};
    }

    // 使用 ReadableStream 逐行处理，避免将整个文件加载到内存
    const reader = response.body?.getReader();
    if (!reader) {
      return {};
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentTvgId = '';
    let currentProgram: { start: string; end: string; title: string } | null = null;
    let shouldSkipCurrentProgram = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // 保留最后一行（可能不完整）
      buffer = lines.pop() || '';

      // 处理完整的行
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 解析 <programme> 标签
        if (trimmedLine.startsWith('<programme')) {
          // 提取 tvg-id
          const tvgIdMatch = trimmedLine.match(/channel="([^"]*)"/);
          currentTvgId = tvgIdMatch ? tvgIdMatch[1] : '';

          // 提取开始时间
          const startMatch = trimmedLine.match(/start="([^"]*)"/);
          const start = startMatch ? startMatch[1] : '';

          // 提取结束时间
          const endMatch = trimmedLine.match(/stop="([^"]*)"/);
          const end = endMatch ? endMatch[1] : '';

          if (currentTvgId && start && end) {
            currentProgram = { start, end, title: '' };
            // 优化：如果当前频道不在我们关注的列表中，标记为跳过
            shouldSkipCurrentProgram = !tvgs.has(currentTvgId);
          }
        }
        // 解析 <title> 标签 - 只有在需要解析当前节目时才处理
        else if (trimmedLine.startsWith('<title') && currentProgram && !shouldSkipCurrentProgram) {
          // 处理带有语言属性的title标签，如 <title lang="zh">远方的家2025-60</title>
          const titleMatch = trimmedLine.match(/<title(?:\s+[^>]*)?>(.*?)<\/title>/);
          if (titleMatch && currentProgram) {
            currentProgram.title = titleMatch[1];

            // 保存节目信息（这里不需要再检查tvgs.has，因为shouldSkipCurrentProgram已经确保了相关性）
            if (!result[currentTvgId]) {
              result[currentTvgId] = [];
            }
            result[currentTvgId].push({ ...currentProgram });

            currentProgram = null;
          }
        }
        // 处理 </programme> 标签
        else if (trimmedLine === '</programme>') {
          currentProgram = null;
          currentTvgId = '';
          shouldSkipCurrentProgram = false; // 重置跳过标志
        }
      }
    }
  } catch (error) {
    // ignore
  }

  return result;
}

/**
 * 解析M3U文件内容，提取频道信息
 * @param m3uContent M3U文件的内容字符串
 * @returns 频道信息数组
 */
function parseM3U(sourceKey: string, m3uContent: string): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
} {
  const channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[] = [];

  const lines = m3uContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let tvgUrl = '';
  let channelIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否是 #EXTM3U 行，提取 tvg-url
    if (line.startsWith('#EXTM3U')) {
      // 支持两种格式：x-tvg-url 和 url-tvg
      const tvgUrlMatch = line.match(/(?:x-tvg-url|url-tvg)="([^"]*)"/);
      tvgUrl = tvgUrlMatch ? tvgUrlMatch[1].split(',')[0].trim() : '';
      continue;
    }

    // 检查是否是 #EXTINF 行
    if (line.startsWith('#EXTINF:')) {
      // 提取 tvg-id
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgId = tvgIdMatch ? tvgIdMatch[1] : '';

      // 提取 tvg-name
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgName = tvgNameMatch ? tvgNameMatch[1] : '';

      // 提取 tvg-logo
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const logo = tvgLogoMatch ? tvgLogoMatch[1] : '';

      // 提取 group-title
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      const group = groupTitleMatch ? groupTitleMatch[1] : '无分组';

      // 提取标题（#EXTINF 行最后的逗号后面的内容）
      const titleMatch = line.match(/,([^,]*)$/);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // 优先使用 tvg-name，如果没有则使用标题
      const name = title || tvgName || '';

      // 检查下一行是否是URL
      if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        const url = lines[i + 1];

        // 只有当有名称和URL时才添加到结果中
        if (name && url) {
          channels.push({
            id: `${sourceKey}-${channelIndex}`,
            tvgId,
            name,
            logo,
            group,
            url
          });
          channelIndex++;
        }

        // 跳过下一行，因为已经处理了
        i++;
      }
    }
  }

  return { tvgUrl, channels };
}

/**
 * 解析纯文本频道列表（通用TXT格式）
 * 支持格式示例：
 *  - 央视一套,http://example.com/live.m3u8
 *  - 央视一套#http://example.com/live.m3u8
 *  - 综艺#快乐大本营#http://example.com/live.m3u8 （带分组）
 */
function parsePlainText(sourceKey: string, text: string): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
} {
  const channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[] = [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  let idx = 0;
  for (const line of lines) {
    // 支持 "group#name#url" 或 "name#url" 或 "name,url"
    const hashParts = line.split('#').map(s => s.trim());
    let group = '无分组';
    let name = '';
    let url = '';

    if (hashParts.length === 3) {
      group = hashParts[0];
      name = hashParts[1];
      url = hashParts[2];
    } else if (hashParts.length === 2) {
      name = hashParts[0];
      url = hashParts[1];
    } else {
      // 尝试逗号分隔
      const commaParts = line.split(',').map(s => s.trim());
      if (commaParts.length >= 2) {
        name = commaParts[0];
        url = commaParts.slice(1).join(','); // 允许URL中包含逗号
      }
    }

    if (!name || !url || !/^https?:\/\//i.test(url)) continue;

    const tvgId = name.replace(/\s+/g, '').toLowerCase();
    channels.push({
      id: `${sourceKey}-${idx++}`,
      tvgId,
      name,
      logo: '',
      group,
      url,
    });
  }

  return { tvgUrl: '', channels };
}

/**
 * 解析 JSON 频道列表
 * 支持格式示例：
 * { "channels": [{ "name": "CCTV1", "url": "http://...", "logo": "...", "group": "央视", "tvgId": "cctv1" }]}
 */
function parseJsonPlaylist(sourceKey: string, text: string): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
} {
  try {
    const obj = JSON.parse(text);
    const channelsInput = Array.isArray(obj) ? obj : obj.channels;
    if (!Array.isArray(channelsInput)) return { tvgUrl: '', channels: [] };
    const channels = channelsInput.map((c: any, idx: number) => ({
      id: `${sourceKey}-${idx}`,
      tvgId: (c.tvgId || c.tvg_id || c.id || c.name || '').toString(),
      name: (c.name || c.title || '').toString(),
      logo: (c.logo || '').toString(),
      group: (c.group || c.category || '无分组').toString(),
      url: (c.url || c.link || '').toString(),
    })).filter((c: any) => c.name && c.url && /^https?:\/\//i.test(c.url));
    const tvgUrl = (obj.tvgUrl || obj.epg || obj["url-tvg"] || obj["x-tvg-url"] || '') as string;
    return { tvgUrl: tvgUrl || '', channels };
  } catch {
    return { tvgUrl: '', channels: [] };
  }
}

/**
 * 通用播放列表解析：自动判定 M3U / JSON / TXT
 */
function parseUniversalPlaylist(sourceKey: string, sourceUrl: string, raw: string): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
} {
  const head = raw.slice(0, 100).trim();
  const lowerUrl = (sourceUrl || '').toLowerCase();
  if (head.startsWith('#EXTM3U') || lowerUrl.endsWith('.m3u') || lowerUrl.endsWith('.m3u8')) {
    return parseM3U(sourceKey, raw);
  }
  // 简单判断 JSON
  if ((head.startsWith('{') && raw.trim().endsWith('}')) || (head.startsWith('[') && raw.trim().endsWith(']')) || lowerUrl.endsWith('.json')) {
    const parsed = parseJsonPlaylist(sourceKey, raw);
    if (parsed.channels.length > 0) return parsed;
  }
  // 作为纯文本行解析
  return parsePlainText(sourceKey, raw);
}

// utils/urlResolver.js
export function resolveUrl(baseUrl: string, relativePath: string) {
  try {
    // 如果已经是完整的 URL，直接返回
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }

    // 如果是协议相对路径 (//example.com/path)
    if (relativePath.startsWith('//')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}${relativePath}`;
    }

    // 使用 URL 构造函数处理相对路径
    const baseUrlObj = new URL(baseUrl);
    const resolvedUrl = new URL(relativePath, baseUrlObj);
    return resolvedUrl.href;
  } catch (error) {
    // 降级处理
    return fallbackUrlResolve(baseUrl, relativePath);
  }
}

function fallbackUrlResolve(baseUrl: string, relativePath: string) {
  // 移除 baseUrl 末尾的文件名，保留目录路径
  let base = baseUrl;
  if (!base.endsWith('/')) {
    base = base.substring(0, base.lastIndexOf('/') + 1);
  }

  // 处理不同类型的相对路径
  if (relativePath.startsWith('/')) {
    // 绝对路径 (/path/to/file)
    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}${relativePath}`;
  } else if (relativePath.startsWith('../')) {
    // 上级目录相对路径 (../path/to/file)
    const segments = base.split('/').filter(s => s);
    const relativeSegments = relativePath.split('/').filter(s => s);

    for (const segment of relativeSegments) {
      if (segment === '..') {
        segments.pop();
      } else if (segment !== '.') {
        segments.push(segment);
      }
    }

    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}/${segments.join('/')}`;
  } else {
    // 当前目录相对路径 (file.ts 或 ./file.ts)
    const cleanRelative = relativePath.startsWith('./') ? relativePath.slice(2) : relativePath;
    return base + cleanRelative;
  }
}

// 获取 M3U8 的基础 URL
export function getBaseUrl(m3u8Url: string) {
  try {
    const url = new URL(m3u8Url);
    // 如果 URL 以 .m3u8 结尾，移除文件名
    if (url.pathname.endsWith('.m3u8')) {
      url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
    } else if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    return url.protocol + "//" + url.host + url.pathname;
  } catch (error) {
    return m3u8Url.endsWith('/') ? m3u8Url : m3u8Url + '/';
  }
}