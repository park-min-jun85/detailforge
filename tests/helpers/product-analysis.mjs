import { createServer } from "node:http";
import { isDeepStrictEqual } from "node:util";
import { projectId, productId, assetId, assetRow } from "./asset-db.mjs";
export { projectId, productId, assetId, assetRow };
export const date = "2026-09-13T00:00:00.000Z";
export const factsData = () => ({ productName: "검증용 정리함", brand: "검증 브랜드", category: "수납", specifications: [{ name: "재질", value: "ABS" }, { name: "폭", value: "20cm" }] });
export const strategyResult = (overrides = {}) => ({ schemaVersion: 1,
  summary: { text: "입력된 상품정보를 바탕으로 제품 형태와 스펙의 이해를 돕는 설명을 제안합니다.", evidenceIds: ["F1"] },
  valuePropositions: [{ title: "스펙 정보의 명확한 안내", rationale: "입력된 스펙을 구매자가 확인하기 쉬운 순서로 소개하는 방향입니다.", confidence: 0.7, evidenceIds: ["F4"] }],
  audienceHypotheses: [], useCaseHypotheses: [], messagingAngles: [],
  contentPriorities: { emphasize: ["입력 스펙 안내"], deEmphasize: ["근거 없는 성능 표현"] },
  cautions: [{ message: "고객군은 추가 확인이 필요합니다.", evidenceIds: [] }], ...overrides });

export async function startProductAnalysisDb() {
  const state = {
    project: { id: projectId, name: "상품 분석 검증", status: "draft", created_at: date, updated_at: date },
    product: { id: productId, project_id: projectId, name: "검증용 정리함", brand: "검증 브랜드", category: "수납",
      description: "미검증 원본 설명", source_type: "manual", source_url: null, raw_data: { preserved: true }, ai_analysis: {}, created_at: date, updated_at: date },
    facts: { id: "3645f432-b847-4e28-9ee7-f41beccccf46", product_id: productId, facts: factsData(),
      source_snapshot: { original: "보존해야 할 원본" }, version: 1, validated_at: null, created_at: date, updated_at: date },
    assets: [], requests: [], failure: null, ignoreFilter: null, beforePatch: null, ackLost: null,
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const table = url.pathname.split("/").at(-1);
    let body = ""; for await (const chunk of request) body += chunk;
    const payload = body ? JSON.parse(body) : null;
    state.requests.push({ table, method: request.method, payload, path: url.pathname, query: url.search });
    const send = (rows, status = 200) => { response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(status === 200 && request.headers.accept?.includes("vnd.pgrst.object") ? rows[0] ?? null : rows)); };
    const fail = () => send({ code: "TEST", message: "private-db-error secret-test-key" }, 400);
    const matches = (row) => [...url.searchParams].every(([field, value]) => {
      if (field === "or") return value.slice(1, -1).split(",").some((condition) => { const [key, , id] = condition.split("."); return row[key] === id; });
      if (!value.startsWith("eq.")) return true;
      if (field.startsWith("ai_analysis->attempt->>")) return row.ai_analysis?.attempt?.[field.split("->>")[1]] === value.slice(3);
      return field === "ai_analysis" ? isDeepStrictEqual(row.ai_analysis, JSON.parse(value.slice(3))) : String(row[field]) === value.slice(3);
    });
    if (request.method === "GET") {
      if (state.failure === `read-${table}`) return fail();
      const source = table === "projects" ? [state.project] : table === "products" ? [state.product] : table === "product_facts" ? [state.facts] : table === "assets" ? state.assets : null;
      if (!source) return fail();
      return send(source.filter(Boolean).filter((row) => state.ignoreFilter === table || matches(row)));
    }
    if (table !== "products" || request.method !== "PATCH") return fail();
    if (state.beforePatch) await state.beforePatch(payload);
    const status = payload.ai_analysis?.attempt.status;
    if (state.failure === `patch-${status}`) return fail();
    if (!state.product || !matches(state.product)) return send([]);
    Object.assign(state.product, payload, { updated_at: new Date().toISOString() });
    if (state.ackLost === status) { state.ackLost = null; return fail(); }
    return send([state.product]);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previousUrl = process.env.SUPABASE_URL, previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`; process.env.SUPABASE_SERVICE_ROLE_KEY = "secret-test-key";
  return { state, async close() {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    await new Promise((resolve) => server.close(resolve));
  } };
}
