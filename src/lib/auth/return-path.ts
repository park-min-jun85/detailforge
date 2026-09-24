const FALLBACK = "/projects";

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return FALLBACK;
  try {
    let decoded = value;
    for (let i = 0; i < 4; i++) {
      if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return FALLBACK;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
      if (i === 3) return FALLBACK;
    }
    const url = new URL(decoded, "https://return.invalid");
    if (url.origin !== "https://return.invalid" || !(url.pathname === "/" || /^\/(projects|settings|templates)(\/|$)/.test(url.pathname))) return FALLBACK;
    // Keep the original encoding after validating all decoded redirect forms.
    const original = new URL(value, "https://return.invalid");
    return original.pathname + original.search + original.hash;
  } catch { return FALLBACK; }
}

export function loginLocation(returnPath: unknown): string {
  return `/login?${new URLSearchParams({ next: safeReturnPath(returnPath) })}`;
}
