import type { ReactNode } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main-content" className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-white px-4 py-3 text-sm font-semibold shadow-md focus:not-sr-only">
        본문으로 건너뛰기
      </a>
      <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
        <AppSidebar />
        <div className="min-w-0">
          <AppHeader />
          <main id="main-content" tabIndex={-1}>{children}</main>
        </div>
      </div>
    </>
  );
}