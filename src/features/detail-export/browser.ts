import "server-only";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { checkDimensions, SURFACE_SELECTOR } from "./config";
import { ExportError } from "./errors";
import type { CaptureProvider } from "./types";

export function assertBrowserInstalled(path = chromium.executablePath()) {
  if (!existsSync(path)) throw new ExportError("browser_missing");
}
export function allowedCaptureRequest(url: string, target: string, _images: string[] = []) {
  void _images;
  try {
    const requested = new URL(url), page = new URL(target);
    if(!["http:","https:"].includes(requested.protocol) || requested.username || requested.password || requested.hash || requested.search) return false;
    return requested.origin===page.origin && (url===target || requested.pathname==="/export-capture/data" || requested.pathname.startsWith("/_next/static/"));
  } catch { return false; }
}
// Evaluated inside Chromium. Explicit readiness, not network-idle heuristics.
export async function imagesReady(element: Element) {
  if (element.querySelector('[data-image-state="missing"]')) throw new Error("missing image");
  await Promise.all(Array.from(element.querySelectorAll("img")).map(async img => {
    if (!img.complete) await new Promise<void>((resolve, reject) => { img.addEventListener("load", () => resolve(), { once: true }); img.addEventListener("error", () => reject(new Error("image")), { once: true }); });
    if (!img.naturalWidth) throw new Error("image");
    await img.decode();
  }));
}
export async function fontsReady() { await document.fonts.ready; }
function bounded<T>(operation: Promise<T>, ms: number, code: "asset_load" | "font_load") {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ExportError(code)), ms); })]).finally(() => clearTimeout(timer));
}
export const captureWithChromium: CaptureProvider = async (input, signal) => {
  const channel=process.env.DETAILFORGE_EXPORT_BROWSER_CHANNEL;
  if(channel && channel!=="chrome")throw new ExportError("configuration");
  if(!channel)assertBrowserInstalled();
  if (signal.aborted) throw new ExportError("timeout");
  let browser;
  try { browser = await chromium.launch({ headless: true, timeout: 15000, chromiumSandbox:true, ...(channel ? {channel} : {}) }); }
  catch { throw new ExportError(signal.aborted ? "timeout" : "screenshot"); }
  const abort = () => { void browser.close().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw new ExportError("timeout");
    const context = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: Math.max(1440, input.width + 400), height: 900 },
      locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block", acceptDownloads:false });
    await context.routeWebSocket("**/*", socket=>socket.close());
    const dataUrl=new URL("/export-capture/data",input.url).href;
    let documentSent=false, dataSent=false;
    const forward = async (route: import("playwright").Route, headers?: Record<string,string>) => {
      // Playwright routing alone does not intercept every redirect hop. Never
      // let Chromium receive a redirect: fetch exactly one allowlisted hop.
      try {
        const response=await route.fetch({maxRedirects:0,timeout:20000,...(headers?{headers}:{})});
        if(response.status()>=300 && response.status()<400)return route.abort();
        await route.fulfill({response});
      } catch { await route.abort().catch(()=>{}); }
    };
    await context.route("**/*", async route => {
      const request=route.request(),url=request.url(),method=request.method();
      if(request.redirectedFrom() || !allowedCaptureRequest(url,input.url))return route.abort();
      const isDocument=url===input.url && method==="GET" && request.isNavigationRequest() && !documentSent;
      const isData=url===dataUrl && method==="POST" && !dataSent;
      if(isDocument || isData) {
        if(isDocument)documentSent=true;else dataSent=true;
        return forward(route,{...request.headers(),"x-export-id":input.authorization.id,
          "x-export-token":input.authorization.token,"x-export-worker":input.authorization.worker});
      }
      if(method==="GET" && !request.isNavigationRequest() && new URL(url).pathname.startsWith("/_next/static/"))return forward(route);
      return route.abort();
    });
    const page = await context.newPage();
    context.on("page",popup=>{if(popup!==page)void popup.close();});
    try { const response = await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 20000 }); if (!response?.ok() || page.url() !== input.url) throw new Error(); }
    catch { throw new ExportError("page_load"); }
    const surface = page.locator(SURFACE_SELECTOR);
    try { await surface.waitFor({ state: "visible", timeout: 10000 }); if (await surface.count() !== 1) throw new Error(); }
    catch { throw new ExportError("surface_missing"); }
    if (await surface.getAttribute("data-render-fingerprint") !== input.fingerprint) throw new ExportError("changed");
    try { await bounded(page.evaluate(fontsReady), 10000, "font_load"); } catch { throw new ExportError("font_load"); }
    try { await bounded(surface.evaluate(imagesReady), 15000, "asset_load"); } catch { throw new ExportError("asset_load"); }
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}*:focus{outline:none!important}html{scroll-behavior:auto!important}" });
    const size = await surface.evaluate(el => ({ width: Math.ceil(el.getBoundingClientRect().width), height: Math.ceil(el.getBoundingClientRect().height), overflow: el.scrollWidth > el.clientWidth }));
    checkDimensions(size.width, size.height, input.width);
    if (size.overflow) throw new ExportError("screenshot");
    const bytes = await surface.screenshot({ type: input.options.format === "jpg" ? "jpeg" : "png", ...(input.options.format === "jpg" ? { quality: input.options.quality } : {}),
      scale: "css", animations: "disabled", caret: "hide", omitBackground: false, timeout: 20000 });
    return { bytes, width: size.width, height: size.height };
  } catch (error) {
    if (signal.aborted) throw new ExportError("timeout");
    throw error instanceof ExportError ? error : new ExportError("screenshot");
  } finally { signal.removeEventListener("abort", abort); await browser.close().catch(() => {}); }
};
