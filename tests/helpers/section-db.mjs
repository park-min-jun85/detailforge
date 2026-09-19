import { createServer } from "node:http";
import { isDeepStrictEqual } from "node:util";
import { projectId, productId, assetId, assetRow as baseAssetRow } from "./asset-db.mjs";
export { projectId, productId, assetId };
export const assetRow = (overrides={}) => baseAssetRow({width:330,height:330,...overrides});
export const date = "2026-09-13T00:00:00.000Z";
export const factsData = () => ({ productName: "검증용 정리함", brand: "검증 브랜드", category: "수납", specifications: [{ name: "재질", value: "ABS" }, { name: "폭", value: "20cm" }] });
export const strategyResult = (overrides = {}) => ({ schemaVersion: 1,
  summary: { text: "입력된 상품정보를 바탕으로 제품 형태와 스펙의 이해를 돕는 설명을 제안합니다.", evidenceIds: ["F1"] },
  valuePropositions: [{ title: "스펙 정보의 명확한 안내", rationale: "입력된 스펙을 구매자가 확인하기 쉬운 순서로 소개하는 방향입니다.", confidence: 0.7, evidenceIds: ["F4"] }],
  audienceHypotheses: [], useCaseHypotheses: [], messagingAngles: [],
  contentPriorities: { emphasize: ["입력 스펙 안내"], deEmphasize: ["근거 없는 성능 표현"] },
  cautions: [{ message: "고객군은 추가 확인이 필요합니다.", evidenceIds: [] }], ...overrides });

export async function startSectionDb() {
  const state = {
    project: { id: projectId, name: "상품 분석 검증", status: "draft", created_at: date, updated_at: date },
    product: { id: productId, project_id: projectId, name: "검증용 정리함", brand: "검증 브랜드", category: "수납",
      description: "미검증 원본 설명", source_type: "manual", source_url: null, raw_data: { preserved: true }, ai_analysis: {}, created_at: date, updated_at: date },
    facts: { id: "3645f432-b847-4e28-9ee7-f41beccccf46", product_id: productId, facts: factsData(),
      source_snapshot: { inputMethod: "manual", ...factsData() }, validation: {}, version: 1, validated_at: null, created_at: date, updated_at: date },
    options: null, assets: [], page: null, sections: [], requests: [], failure: null, ignoreFilter: null, beforePatch: null, ackLost: null,
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const table = url.pathname.split("/").at(-1);
    let body = ""; for await (const chunk of request) body += chunk;
    const payload = body ? JSON.parse(body) : null;
    state.requests.push({ table, method: request.method, payload, path: url.pathname, query: url.search });
    const send = (rows, status = 200) => { response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(status === 200 && request.headers.accept?.includes("vnd.pgrst.object") ? rows[0] ?? null : rows)); };
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      return send(payload.paths.map(path=>({path,error:state.missingPaths?.includes(path)?'missing':null,signedURL:state.missingPaths?.includes(path)?null:`/object/sign/product-assets/${path}?token=fixture`})));
    }
    const fail = () => send({ code: "TEST", message: "private-db-error secret-test-key" }, 400);
    const matches = (row) => [...url.searchParams].every(([field, value]) => {
      if (field === "or" && value.includes('and(')) return [...value.matchAll(/and\(id\.eq\.([^,]+),updated_at\.eq\.([^)]+)\)/g)].some(m=>row.id===m[1]&&row.updated_at===m[2]);
      if (field === "or") return value.slice(1, -1).split(",").some((condition) => { const [key, , id] = condition.split("."); return row[key] === id; });
      if (!value.startsWith("eq.")) return true;
      if (field.startsWith("plan->attempt->>")) return row.plan?.attempt?.[field.split("->>")[1]] === value.slice(3);
      if (field === "plan") return isDeepStrictEqual(row.plan, JSON.parse(value.slice(3)));
      if (field.startsWith("validation->attempt->>")) return row.validation?.attempt?.[field.split("->>")[1]] === value.slice(3);
      if (field === "validation") return isDeepStrictEqual(row.validation, JSON.parse(value.slice(3)));
      if (field.startsWith("ai_analysis->attempt->>")) return row.ai_analysis?.attempt?.[field.split("->>")[1]] === value.slice(3);
      return field === "ai_analysis" ? isDeepStrictEqual(row.ai_analysis, JSON.parse(value.slice(3))) : String(row[field]) === value.slice(3);
    });
    if (request.method === "GET") {
      if (state.beforeRead) await state.beforeRead(table);
      if (state.failure === `read-${table}`) return fail();
      const source = table === "product_options" ? [state.options] : table === "projects" ? [state.project] : table === "products" ? [state.product] : table === "product_facts" ? [state.facts] : table === "assets" ? state.assets : table === "detail_pages" ? [state.page] : table === "sections" ? state.sections : null;
      if (!source) return fail();
      const rows=source.filter(Boolean).filter((row)=>state.ignoreFilter===table||matches(row));
      if(table==='sections')rows.sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id));return send(rows);
    }
    if (table === "sections") {
      if(state.beforeSections)await state.beforeSections(request.method,payload);
      if(request.method==='PATCH'){
        if(state.failure==='sections-patch')return fail();
        const row=state.sections.find(matches);if(!row)return send([]);
        Object.assign(row,structuredClone(payload),{updated_at:new Date(Math.max(Date.now(),Date.parse(row.updated_at)+1)).toISOString()});
        if(state.ackLost==='sections-patch'){state.ackLost=null;return fail();}return send([row]);
      }
      if(request.method==='POST'){
        const restoring=payload.some(row=>row.content.meta?.generationId!==state.page.settings.sectionGeneration.runId);
        if(state.failure===(restoring?'restore':'sections-insert'))return fail();
        if(payload.some(row=>state.sections.some(old=>old.id===row.id)))return fail();
        state.sections.push(...structuredClone(payload));
        if(state.ackLost==='sections-insert'){state.ackLost=null;return fail();}return send(payload);
      }
      if(request.method==='DELETE'){
        if(state.failure==='sections-delete')return fail();
        const removed=state.sections.filter(matches);state.sections=state.sections.filter(row=>!matches(row));
        if(state.ackLost==='sections-delete'){state.ackLost=null;return fail();}return send(removed);
      }return fail();
    }
    if (table !== "detail_pages") return fail();
    if (request.method === "POST") {
      if (state.beforeInsert) await state.beforeInsert(payload);
      if (state.page || state.failure === "insert") return fail();
      state.page = { theme_id: null, settings: {}, created_at: date, updated_at: date, ...payload };
      if (state.ackLost === "insert") { state.ackLost=null; return fail(); }
      return send([state.page]);
    }
    if (request.method !== "PATCH") return fail();
    if (state.beforePatch) await state.beforePatch(payload);
    const gen=payload.settings?.sectionGeneration;
    const status=gen ? gen.status==='generating'?(gen.staged.length?'stage':'claim'):gen.status : payload.plan?.attempt.status;
    if (state.failure === `patch-${status}`) return fail();
    if (!state.page || !matches(state.page)) return send([]);
    Object.assign(state.page, payload, { updated_at: new Date().toISOString() });
    if (state.ackLost === status) { state.ackLost=null; return fail(); }
    return send([state.page]);
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

export const validationOutput = (input, status = "supported") => ({ schemaVersion: 1, facts: input.targets.map(target => ({ ...target, status, confidence: .7, evidenceIds: input.evidence.some(e => e.id === "S1") ? ["S1"] : [], reason: "입력 원본과 비교한 일관성 평가입니다. 외부 진위의 증명이 아닙니다." })), warnings: [] });
