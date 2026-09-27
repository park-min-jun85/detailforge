export function AppHeader() {
  return (
    <header className="flex min-h-18 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-5 sm:px-8 lg:px-10">
      <p className="text-sm font-medium text-zinc-600">상세페이지 작업 공간</p>
      <LogoutButton />
    </header>
  );
}
import { LogoutButton } from "@/features/auth/components/logout-button";
