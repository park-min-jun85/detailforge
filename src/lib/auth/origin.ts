import "server-only";
import { AuthFailure } from "./errors";
export function authAppOrigin(): string {
  try {
    const value = process.env.DETAILFORGE_APP_ORIGIN;
    if (!value) throw new Error();
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
      || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) throw new Error();
    return url.origin;
  } catch { throw new AuthFailure("configuration"); }
}
