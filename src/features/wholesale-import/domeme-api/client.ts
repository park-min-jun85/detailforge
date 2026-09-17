import "server-only";
import { pinnedTransport, type Transport } from "../fetcher";
import { resolvePublic, type Resolver } from "../security";
import { DomemeApiError } from "./errors";
import { inspectProductResponse } from "./inspection";

const ENDPOINT = "https://www.domeggook.com/ssl/api/";
export const API_MAX_BYTES = 512 * 1024;
export const API_TIMEOUT_MS = 15000;
type Dependencies = { key?: string; resolver?: Resolver; transport?: Transport; signal?: AbortSignal };

/** Read-only, one request, fixed endpoint. Never retries, follows redirects or exposes the payload. */
export async function diagnoseDomemeProduct(productNo: string, dependencies: Dependencies = {}) {
  const key = (dependencies.key ?? process.env.DOMEGGOOK_API_KEY)?.trim();
  if (!key) throw new DomemeApiError("key_missing");
  if (!/^[1-9]\d{0,14}$/.test(productNo)) throw new DomemeApiError("invalid_product");
  const signal = AbortSignal.any([AbortSignal.timeout(API_TIMEOUT_MS), ...(dependencies.signal ? [dependencies.signal] : [])]);
  try {
    // Resolve only the fixed public endpoint; attach the key after DNS validation.
    const target = await resolvePublic(ENDPOINT, dependencies.resolver);
    if (signal.aborted) throw new DomemeApiError("timeout");
    target.url.search = new URLSearchParams({ ver: "4.6", mode: "getItemView", aid: key, no: productNo, om: "json" }).toString();
    const response = await (dependencies.transport ?? pinnedTransport)(target, signal);
    const abort = () => response.destroy(new DomemeApiError("timeout"));
    signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted) throw new DomemeApiError("timeout");
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) throw new DomemeApiError("redirect");
      if (status === 401) throw new DomemeApiError("authentication");
      if (status === 403 || status === 407) throw new DomemeApiError("forbidden");
      if (status === 429) throw new DomemeApiError("rate_limited");
      if (status < 200 || status >= 300) throw new DomemeApiError("unavailable");
      if (Number(response.headers["content-length"]) > API_MAX_BYTES) throw new DomemeApiError("too_large");
      // Request identity encoding; fail closed rather than decoding an unbounded compressed body.
      const encoding = response.headers["content-encoding"];
      if (encoding && encoding.toLowerCase() !== "identity") throw new DomemeApiError("invalid_response");
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of response) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > API_MAX_BYTES) throw new DomemeApiError("too_large");
        chunks.push(bytes);
      }
      if (signal.aborted) throw new DomemeApiError("timeout");
      let payload: unknown;
      try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { throw new DomemeApiError("invalid_response"); }
      const report = inspectProductResponse(payload, productNo);
      // Even allowlisted option labels must not echo the credential if upstream reflects it.
      const serialized = JSON.stringify(report);
      if ([key, encodeURIComponent(key)].some(secret => serialized.includes(secret))) throw new DomemeApiError("invalid_response");
      return report;
    } finally { signal.removeEventListener("abort", abort); response.destroy(); }
  } catch (error) {
    if (signal.aborted) throw new DomemeApiError("timeout");
    // Construct a fresh safe error, without a cause or transport-owned fields.
    throw new DomemeApiError(error instanceof DomemeApiError ? error.code : "unavailable");
  }
}

export const DIAGNOSTIC_PRODUCTS = ["67399861", "67695797", "62191078"] as const;
export async function diagnoseApprovedProducts(run: typeof diagnoseDomemeProduct = diagnoseDomemeProduct) {
  const reports: Awaited<ReturnType<typeof diagnoseDomemeProduct>>[] = [];
  for (const productNo of DIAGNOSTIC_PRODUCTS) {
    // Stop on any lookup error (including auth/permission/rate limit); no automatic retry.
    reports.push(await run(productNo));
  }
  return reports;
}
