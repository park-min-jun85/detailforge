import { AuthFailure } from "./errors";

export type PublicAuthConfig = { url: string; key: string };

// Literal public env references are required for Next's browser build substitution.
// Only the unambiguously public key format is supported; no legacy JWT decoding.
export function readPublicAuthConfig(): PublicAuthConfig | null {
  const urlValue = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!urlValue && !key) return null;
  try {
    if (!urlValue || !key || !/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(key)) throw new Error();
    const url = new URL(urlValue);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error();
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
    return { url: url.origin, key };
  } catch { throw new AuthFailure("configuration"); }
}

export function requirePublicAuthConfig(): PublicAuthConfig {
  const config = readPublicAuthConfig();
  if (!config) throw new AuthFailure("configuration");
  return config;
}

export function authCookieOptions() {
  // Supabase's shared browser/SSR session must be readable by its browser client.
  return { path: "/", sameSite: "lax" as const, httpOnly: false, secure: process.env.NODE_ENV === "production" };
}
