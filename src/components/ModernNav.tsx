/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Cat, Clover, Film, Globe, Home, MoreHorizontal, PlaySquare, Radio, Search, Star, Tv, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BackButton } from './BackButton';
import LiquidGlassContainer from './LiquidGlassContainer';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface NavItem {
  icon: any;
  label: string;
  href: string;
  color: string;
  gradient: string;
}

export default function ModernNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(pathname);
  const { siteName } = useSite();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [menuItems, setMenuItems] = useState<NavItem[]>([
    {
      icon: Home,
      label: '首页',
      href: '/',
      color: 'text-green-500',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: Search,
      label: '搜索',
      href: '/search',
      color: 'text-blue-500',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Globe,
      label: '源浏览器',
      href: '/source-browser',
      color: 'text-emerald-500',
      gradient: 'from-emerald-500 to-green-500',
    },
    {
      icon: Film,
      label: '电影',
      href: '/douban?type=movie',
      color: 'text-red-500',
      gradient: 'from-red-500 to-pink-500',
    },
    {
      icon: Tv,
      label: '剧集',
      href: '/douban?type=tv',
      color: 'text-blue-600',
      gradient: 'from-blue-600 to-indigo-600',
    },
    {
      icon: PlaySquare,
      label: '短剧',
      href: '/shortdrama',
      color: 'text-purple-500',
      gradient: 'from-purple-500 to-violet-500',
    },
    {
      icon: Cat,
      label: '动漫',
      href: '/douban?type=anime',
      color: 'text-pink-500',
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      icon: Clover,
      label: '综艺',
      href: '/douban?type=show',
      color: 'text-orange-500',
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      icon: Radio,
      label: '直播',
      href: '/live',
      color: 'text-teal-500',
      gradient: 'from-teal-500 to-cyan-500',
    },
  ]);

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setMenuItems((prevItems) => [
        ...prevItems,
        {
          icon: Star,
          label: '自定义',
          href: '/douban?type=custom',
          color: 'text-yellow-500',
          gradient: 'from-yellow-500 to-amber-500',
        },
      ]);
    }
  }, []);

  useEffect(() => {
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;
    setActive(fullPath);
  }, [pathname, searchParams]);

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];
    const decodedActive = decodeURIComponent(active);
    const decodedHref = decodeURIComponent(href);

    return (
      decodedActive === decodedHref ||
      (decodedActive.startsWith('/douban') &&
        typeMatch &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  return (
    <>
      {/* Desktop Top Navigation removed per request */}

      {/* Desktop Bottom Centered Floating Bar with 9 anchors */}
      <nav className='hidden md:block fixed bottom-4 left-1/2 -translate-x-1/2 z-[1200]'>
        <LiquidGlassContainer
          className='px-3 py-2 overflow-hidden'
          roundedClass='rounded-[28px]'
          intensity='high'
          shadow='2xl'
          border='subtle'
        >
          <div className='flex items-center justify-center gap-2'>
            {menuItems.slice(0, 9).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setActive(item.href)}
                  className='group relative flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 whitespace-nowrap'
                >
                  {/* Icon */}
                  <div className='relative'>
                    <Icon
                      className={`w-5 h-5 transition-all duration-300 ${
                        active ? item.color : 'text-gray-600 dark:text-gray-400'
                      } ${active ? 'scale-110' : 'group-hover:scale-110'}`}
                    />
                  </div>
                  {/* Label */}
                  <span
                    className={`text-sm font-medium transition-colors ${
                      active
                        ? `${item.color} font-semibold`
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </LiquidGlassContainer>
  </nav>

  {/* Desktop Top-Center Brand Pill (KorevTV) */}
  <nav className='hidden md:block fixed top-3 left-1/2 -translate-x-1/2 z-50'>
    <LiquidGlassContainer
      className='px-5 py-2'
      roundedClass='rounded-full'
      intensity='high'
      shadow='xl'
      border='subtle'
    >
      <span className='text-base sm:text-lg font-semibold tracking-wide bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 dark:from-green-400 dark:via-emerald-300 dark:to-teal-300 bg-clip-text text-transparent'>
        {siteName}
      </span>
    </LiquidGlassContainer>
  </nav>
  {/* Desktop Top-Left Back Button */}
  <nav className='hidden md:block fixed top-3 left-4 z-50'>
    <LiquidGlassContainer
      className='px-1 py-1'
      roundedClass='rounded-full'
      intensity='medium'
      shadow='lg'
      border='subtle'
    >
      <BackButton />
    </LiquidGlassContainer>
  </nav>
      {/* Desktop Top-Right Controls (Theme + User) - restored */}
      <nav className='hidden md:block fixed top-3 right-4 z-50'>
        <LiquidGlassContainer
          className='px-2 py-1'
          roundedClass='rounded-full'
          intensity='medium'
          shadow='lg'
          border='subtle'
        >
          <div className='flex items-center gap-2'>
            <ThemeToggle />
            <UserMenu />
          </div>
        </LiquidGlassContainer>
      </nav>

      {/* More Menu Modal - Render outside nav to avoid z-index issues */}
      {showMoreMenu && (
        <div
          className='md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm'
          style={{ zIndex: 2147483647 }}
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className='absolute bottom-20 left-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800/30 overflow-hidden'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>全部分类</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className='p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors'
              >
                <X className='w-5 h-5 text-gray-600 dark:text-gray-400' />
              </button>
            </div>

            {/* All menu items in grid */}
            <div className='grid grid-cols-4 gap-4 p-4'>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => {
                      setActive(item.href);
                      setShowMoreMenu(false);
                    }}
                    className='flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 active:scale-95 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                  >
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-2xl ${
                        active
                          ? `bg-gradient-to-br ${item.gradient}`
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          active
                            ? 'text-white'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        active
                          ? item.color
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation - 2025 Liquid Glass Design */}
      <nav
        className='md:hidden fixed bottom-0 left-0 right-0 z-40'
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Liquid Glass Container - iOS WWDC25 Style */}
        <LiquidGlassContainer className='mx-2 mb-2 overflow-hidden' roundedClass='rounded-[28px]' intensity='high' shadow='2xl' border='subtle'>
          {/* Floating gradient accent line on top */}
          <div className='h-[2px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent'></div>

          <div className='flex items-center justify-around px-2 py-2 h-16'>
            {/* Show first 4 items + More button */}
            {menuItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setActive(item.href)}
                  className='relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] transition-all duration-300 active:scale-95'
                >
                  {/* Icon with active state */}
                  <div className='relative'>
                    {/* Active background pill */}
                    {active && (
                      <div className={`absolute -inset-2 bg-gradient-to-br ${item.gradient} opacity-15 rounded-2xl blur-sm`}></div>
                    )}

                    {/* Icon container */}
                    <div
                      className={`relative flex items-center justify-center w-11 h-7 rounded-2xl transition-all duration-300 ${
                        active
                          ? 'bg-gradient-to-br from-gray-100/80 to-gray-200/60 dark:from-gray-800/80 dark:to-gray-700/60 shadow-lg'
                          : 'bg-transparent'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 transition-all duration-300 ${
                          active
                            ? item.color
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                        strokeWidth={active ? 2.5 : 2}
                      />
                    </div>
                  </div>

                  {/* Label - only show on active */}
                  {active && (
                    <span
                      className={`text-[10px] font-semibold ${item.color} transition-all duration-300 animate-in fade-in slide-in-from-bottom-1`}
                    >
                      {item.label}
                    </span>
                  )}

                  {/* Active indicator dot */}
                  {active && (
                    <div
                      className={`absolute -bottom-0.5 w-1 h-1 bg-gradient-to-r ${item.gradient} rounded-full shadow-lg`}
                    />
                  )}
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setShowMoreMenu(true)}
              className='relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] transition-all duration-300 active:scale-95'
            >
              <div className='relative flex items-center justify-center w-11 h-7 rounded-2xl transition-all duration-300 bg-transparent'>
                <MoreHorizontal className='w-5 h-5 text-gray-600 dark:text-gray-400' strokeWidth={2} />
              </div>
            </button>
          </div>
        </LiquidGlassContainer>
      </nav>

      {/* Spacer for fixed navigation */}
      <div className='hidden md:block h-16' />
      <div className='md:hidden h-20' />
    </>
  );
}
