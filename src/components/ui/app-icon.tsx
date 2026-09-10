import type { ReactNode } from "react";

const paths = {
  dashboard: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  folder: <path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />,
  template: <path d="M4 3h16v18H4zM4 9h16M10 9v12" />,
  settings: <path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="m15 4 5 5M4 20l5-1L21 7a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0L5 15l-1 5Z" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
} satisfies Record<string, ReactNode>;

export type AppIconName = keyof typeof paths;

export function AppIcon({ name, className = "size-4" }: {
  name: AppIconName;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}
      aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}