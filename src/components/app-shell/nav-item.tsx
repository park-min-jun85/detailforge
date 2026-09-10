"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavItem({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link href={href} aria-current={isActive ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
        isActive
          ? "border-zinc-200 bg-white font-semibold text-zinc-950 shadow-sm"
          : "border-transparent font-medium text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-950"
      }`}>
      {children}
    </Link>
  );
}