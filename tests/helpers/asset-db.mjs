import { createServer } from "node:http";
import { isDeepStrictEqual } from "node:util";

export const projectId = "7645f432-b847-4e28-9ee7-f41beccccf46";
export const productId = "6645f432-b847-4e28-9ee7-f41beccccf46";
export const otherId = "5645f432-b847-4e28-9ee7-f41beccccf46";
export const assetId = "4645f432-b847-4e28-9ee7-f41beccccf46";
export const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
export const uploadFile = { name: "제품.png", mime: "image/png", bytes: png };
export const assetRow = (overrides = {}) => ({
  id: assetId, project_id: projectId, product_id: productId,
  storage_path: `projects/${projectId}/products/${productId}/${assetId}.png`,
  original_filename: "제품.png", mime_type: "image/png", size_bytes: 9, width: null, height: null,
  asset_type: "unclassified", sort_order: 0, metadata: {}, created_at: "2026-09-11T01:00:00.000Z", ...overrides,
});

export async function startAssetDb() {
  const state = {
    project: { id: projectId, name: "검증 프로젝트" }, product: { id: productId, project_id: projectId, name: "검증 상품" },
    facts: null, assets: [], objects: new Set(), objectBytes: new Map(), requests: [], failure: null, ackLost: false, failRecoveryRead: false,
    failCleanup: false, ignoreProductFilter: false, beforePatch: null, patchAckLost: null,
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const json = request.headers["content-type"]?.includes("application/json");
    const payload = buffer.length && json ? JSON.parse(buffer.toString()) : null;
    state.requests.push({ method: request.method, path: url.pathname, query: url.search, payload });
    const send = (body, status = 200, headers = {}) => {
      response.writeHead(status, { "Content-Type": "application/json", ...headers });
      response.end(JSON.stringify(body));
    };
    const fail = () => send({ message: "private-db-detail secret-test-key", error: "private-storage-error", statusCode: "400", code: "TEST" }, 400);
    if (url.pathname.startsWith("/storage/v1/object/sign/")) {
      if (state.failure === "sign") return fail();
      if (request.method === "GET") {
        if (state.downloadRedirect) { response.writeHead(302, { Location: state.downloadRedirect }); return response.end(); }
        const path = url.pathname.slice("/storage/v1/object/sign/product-assets/".length);
        const bytes = state.objectBytes.get(path);
        if (!bytes) return fail();
        response.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": bytes.length });
        return response.end(bytes);
      }
      if (!payload.paths) {
        const path = url.pathname.slice("/storage/v1/object/sign/product-assets/".length);
        if (!state.objects.has(path)) return fail();
        return send({ signedURL: `/object/sign/product-assets/${path}?token=temporary-test-token` });
      }
      return send(payload.paths.map((path) => ({ path, error: state.objects.has(path) ? null : "missing",
        signedURL: state.objects.has(path) ? `/object/sign/product-assets/${path}?token=temporary-test-token` : null })));
    }
    if (url.pathname.startsWith("/storage/v1/object/product-assets")) {
      if (request.method === "POST") {
        const path = url.pathname.slice("/storage/v1/object/product-assets/".length);
        if (state.failure === "upload") return fail();
        state.objects.add(path);
        state.objectBytes.set(path, buffer);
        return send({ Key: `product-assets/${path}`, Id: assetId });
      }
      if (request.method === "DELETE") {
        if (state.failure === "storage-delete" || state.failCleanup) return fail();
        for (const path of payload.prefixes) { state.objects.delete(path); state.objectBytes.delete(path); }
        return send([]);
      }
    }
    const table = url.pathname.split("/").at(-1);
    const matches = (row) => [...url.searchParams].every(([field, value]) => !value.startsWith("eq.")
      || (field === "metadata" ? isDeepStrictEqual(row[field], JSON.parse(value.slice(3))) : field === "metadata->detailExtraction->>revision" ? row.metadata?.detailExtraction?.revision === value.slice(3) : String(row[field]) === value.slice(3)));
    if (request.method === "GET") {
      if (state.failure === "read" || (table === "assets" && url.searchParams.has("id") && state.failRecoveryRead)) return fail();
      let rows = table === "projects" ? (state.project ? [state.project] : [])
        : table === "products" ? (state.product ? [state.product] : []) : table === "product_facts" ? (state.facts ? [state.facts] : []) : [...state.assets];
      if (!(table === "products" && state.ignoreProductFilter)) rows = rows.filter(matches);
      const total = rows.length;
      if (table === "assets") {
        rows.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
        if (url.searchParams.get("order")?.includes("desc")) rows.reverse();
      }
      if (url.searchParams.has("limit")) rows = rows.slice(0, Number(url.searchParams.get("limit")));
      const object = request.headers.accept?.includes("vnd.pgrst.object");
      return send(object ? (rows[0] ?? null) : rows, 200, { "Content-Range": `0-${Math.max(rows.length - 1, 0)}/${total}` });
    }
    if (table !== "assets") return fail();
    if (request.method === "PATCH") {
      if (state.beforePatch) await state.beforePatch(payload);
      const status = payload.metadata?.detailExtraction?.attempt?.status ?? payload.metadata?.aiAnalysis?.status;
      if (state.failure === `patch-${status}`) return fail();
      const row = state.assets.find(matches);
      if (row) Object.assign(row, payload);
      if (state.patchAckLost === status) { state.patchAckLost = null; return fail(); }
      return send(row ?? null);
    }
    if (request.method === "POST") {
      if (state.failure === "insert") return fail();
      const row = assetRow(payload);
      state.assets.push(row);
      if (state.ackLost) return fail();
      return send(row);
    }
    if (request.method === "DELETE") {
      if (state.failure === "db-delete") return fail();
      state.assets = state.assets.filter((row) => !matches(row));
      return send([]);
    }
    return fail();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previousUrl = process.env.SUPABASE_URL, previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "secret-test-key";
  return { state, async close() {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    await new Promise((resolve) => server.close(resolve));
  } };
}
