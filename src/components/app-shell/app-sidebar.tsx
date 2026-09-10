import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import { NavItem } from "./nav-item";

const navigation = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/templates", label: "Templates", icon: "template" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

export function AppSidebar() {
  return (
    <aside className="border-b border-zinc-200 bg-zinc-100/70 md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:border-r md:border-b-0">
      <div className="flex h-18 items-center px-6">
        <Link href="/" className="inline-flex items-center gap-3 rounded-sm" aria-label="DetailForge 홈">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">D</span>
          <span className="text-lg font-bold tracking-tight">DetailForge</span>
        </Link>
      </div>
      <nav aria-label="주 메뉴" className="px-3 pb-4 md:pt-6">
        <p className="mb-3 hidden px-3 text-[11px] font-semibold tracking-widest text-zinc-500 md:block">WORKSPACE</p>
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:grid-cols-1">
          {navigation.map(({ href, label, icon }) => (
            <li key={href}>
              <NavItem href={href}>
                <AppIcon name={icon} className="size-[18px]" />
                {label}
              </NavItem>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto hidden border-t border-zinc-200 p-6 md:block">
        <p className="text-xs font-medium text-zinc-600">상세페이지 제작 워크스페이스</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">상품의 사실을 담고,<br />판매의 흐름을 만듭니다.</p>
      </div>
    </aside>
  );
}