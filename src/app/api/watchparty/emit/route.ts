import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Client = {
  room: string;
  enqueue: (msg: string) => void;
  close: () => void;
};

type RoomState = {
  clients: Set<Client>;
  hostId?: string;
  lastPlayback?: { state: 'play' | 'pause' | 'seek'; time: number };
  members: Map<string, string>; // sender -> name
};

declare global {
  // eslint-disable-next-line no-var
  var __WATCHPARTY_CHANNEL__: {
    rooms: Map<string, RoomState>;
  } | undefined;
}

function getChannel() {
  if (!global.__WATCHPARTY_CHANNEL__) {
    global.__WATCHPARTY_CHANNEL__ = {
      rooms: new Map<string, RoomState>()
    };
  }
  return global.__WATCHPARTY_CHANNEL__;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const room: string = body.room || 'default';
    const event = {
      type: body.type,
      payload: body.payload,
      sender: body.sender,
      ts: Date.now()
    };
    const channel = getChannel();
    if (!channel.rooms.has(room)) channel.rooms.set(room, { clients: new Set<Client>(), members: new Map<string, string>() });
    const state = channel.rooms.get(room)!;

    // 主机选择：第一次有人加入即视为主机，或由 presence.isHost 指定
    if (event.type === 'presence' && event.payload?.action === 'join') {
      const isHost = Boolean(event.payload?.isHost);
      if (!state.hostId || isHost) {
        state.hostId = event.sender;
      }
      // 记录成员名称
      const name = typeof event.payload?.name === 'string' ? event.payload?.name : undefined;
      if (name) state.members.set(event.sender, name);
    }

    // 仅记录主机的最后播放状态，供后续新加入者一次性对齐
    if (event.type === 'playback' && state.hostId && event.sender === state.hostId) {
      const p = event.payload || {};
      const time = typeof p.time === 'number' ? p.time : 0;
      const validStates = new Set(['play', 'pause', 'seek']);
      const stateStr = validStates.has(p.state) ? p.state : 'seek';
      state.lastPlayback = { state: stateStr as 'play' | 'pause' | 'seek', time };
    }

    const clients = state.clients;
    if (clients && clients.size > 0) {
      for (const c of clients) {
        try {
          c.enqueue(JSON.stringify(event));
        } catch {}
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// 提供一个 GET，避免构建阶段对该路径的 GET 探测失败
export async function GET() {
  return NextResponse.json({ ok: true, message: 'watchparty emit endpoint (POST to broadcast events)' });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Allow': 'GET,HEAD,OPTIONS,POST',
    },
  });
}
    if (event.type === 'presence' && event.payload?.action === 'leave') {
      state.members.delete(event.sender);
    }