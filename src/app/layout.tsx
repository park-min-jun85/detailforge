import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DetailForge", template: "%s | DetailForge" },
  description: "상품의 사실정보를 바탕으로 상세페이지를 구성하는 작업 공간",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}