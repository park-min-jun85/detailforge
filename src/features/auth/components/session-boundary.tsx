"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Privacy on history restore and account changes. Authorization remains on the
// server: this component never supplies an identity or grants data access.
export function SessionBoundary({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stopped = false, identity: string | undefined;
    const hide = () => { if (root.current) root.current.hidden = true; };
    const verify = async () => {
      hide();
      try {
        const response = await fetch("/auth/session", { cache: "no-store", credentials: "same-origin" });
        const result = await response.json();
        if (stopped) return;
        if (!response.ok || !result.principal?.userId) { window.location.replace("/login"); return; }
        if (identity && identity !== result.principal.userId) { window.location.reload(); return; }
        identity = result.principal.userId;
        if (root.current) root.current.hidden = false;
      } catch { if (!stopped) window.location.replace("/login"); }
    };
    const visibility = () => { if (document.hidden) hide(); else void verify(); };
    const show = (event: PageTransitionEvent) => { if (event.persisted) void verify(); };
    const signedOut = () => { stopped = true; hide(); };
    const channel = new BroadcastChannel("detailforge-auth");
    channel.onmessage = () => { if (!stopped) { signedOut(); window.location.replace("/login"); } };
    window.addEventListener("detailforge-signout", signedOut);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    document.addEventListener("visibilitychange", visibility);
    void verify();
    return () => { stopped = true; channel.close(); window.removeEventListener("detailforge-signout", signedOut); window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return <div ref={root}>{children}</div>;
}
