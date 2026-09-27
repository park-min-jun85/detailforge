"use client";

import { useState } from "react";
import { AUTH_ERRORS } from "@/lib/auth/errors";

export function LogoutButton() {
  const [pending, setPending] = useState(false), [error, setError] = useState(false);
  async function logout() {
    setPending(true); setError(false);
    try {
      const response = await fetch("/auth/signout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
      if (!response.ok) { setError(true); setPending(false); return; }
      window.dispatchEvent(new Event("detailforge-signout"));
      const channel = new BroadcastChannel("detailforge-auth"); channel.postMessage("signed-out"); channel.close();
      window.location.replace("/login");
    } catch { setError(true); setPending(false); }
  }
  return <div className="text-right">
    <button className="text-link" type="button" disabled={pending} onClick={logout}>{pending ? "로그아웃 중…" : "로그아웃"}</button>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{AUTH_ERRORS.temporary_failure.message}</p>}
  </div>;
}
