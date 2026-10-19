/**
 * 線條圖示（24×24、1.8px 線寬、圓角端點），全部自繪，不依賴外部字型或網路。
 */
import type { ReactNode } from 'react';
import type { CategoryId } from '../core/types';

const paths: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  edit: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" />,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  sliders: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.8c1.8.6 3 2.2 3.4 4.7" />
    </>
  ),
  userPlus: (
    <>
      <circle cx="10" cy="8.5" r="3.3" />
      <path d="M4 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5M18.5 8v6M15.5 11h6" />
    </>
  ),
  suitcase: (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
      <path d="M9 7V5.2c0-.7.5-1.2 1.2-1.2h3.6c.7 0 1.2.5 1.2 1.2V7M3.5 12.5h17" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5C4 6 5 5 6.5 5H18v3" />
      <rect x="4" y="8" width="16.5" height="11" rx="2.2" />
      <circle cx="16" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="7" rx="5" ry="2.5" />
      <path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" />
      <path d="M10 15.6c.9 1.1 2.8 1.9 5 1.9 2.8 0 5-1.1 5-2.5v-4c0-1.3-1.9-2.3-4.4-2.5M20 15v4c0 1.4-2.2 2.5-5 2.5-2.4 0-4.4-.8-4.9-2" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 17.5l4.5-4.5 3.5 3.5 2.5-2.5 5.5 5" />
    </>
  ),
  share: <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 12.5V18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-5.5" />,
  receipt: <path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5zM9 8h6M9 11.5h6M9 15h3.5" />,
  sparkle: <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />,
  // 分類
  food: <path d="M4 11h16a8 8 0 0 1-16 0zM9 3.5c-.8 1 .8 2 0 3.2M13 3.5c-.8 1 .8 2 0 3.2M8 20h8" />,
  transport: (
    <>
      <rect x="5.5" y="3.5" width="13" height="13.5" rx="3" />
      <path d="M5.5 10.5h13M9 13.8h.01M15 13.8h.01M8.5 17l-2 3.5M15.5 17l2 3.5" />
    </>
  ),
  lodging: <path d="M3.5 18.5v-12M3.5 14h17v4.5M20.5 14v-2.5c0-1.7-1.3-3-3-3H11V14M7.3 11.2h.01" />,
  ticket: <path d="M3.5 8.5V6.5c0-.6.4-1 1-1h15c.6 0 1 .4 1 1v2a3.5 3.5 0 0 0 0 7v2c0 .6-.4 1-1 1h-15c-.6 0-1-.4-1-1v-2a3.5 3.5 0 0 0 0-7zM14.5 5.5v2M14.5 11v2M14.5 16.5v2" />,
  shopping: <path d="M5 8h14l-1 12H6zM9 10.5V7a3 3 0 0 1 6 0v3.5" />,
  other: <path d="M4 8l8-4.5L20 8v8l-8 4.5L4 16zM4 8l8 4.5L20 8M12 12.5v8" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, className }: { name: IconName | CategoryId; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
