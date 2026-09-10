import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { getProjectDashboard, getProjects } from "../src/features/projects/queries.ts";

test("서버 조회: 정확한 전체 집계, 상태별 집계, 최근 5개, 페이지 경계와 오류 비공개", async () => {
  const statuses = ["draft", "analyzing", "generated", "editing", "completed"];
  const rows = Array.from({ length: 1005 }, (_, index) => ({
    id: `d3926b64-9340-4279-99b6-${String(index).padStart(12, "0")}`,
    name: `프로젝트 ${index}`,
    status: statuses[index % statuses.length],
    created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    updated_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
  const requests = [];
  let failure = false;
  let invalidRow = false;
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    requests.push({ method: request.method, url });
    if (failure) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ code: "INTERNAL", message: "task-five-test-only internal database detail" }));
      return;
    }
    let filtered = [...rows];
    const filter = url.searchParams.get("status");
    if (filter === "eq.completed") filtered = filtered.filter((row) => row.status === "completed");
    else if (filter?.startsWith("in.(")) {
      const included = filter.slice(4, -1).split(",");
      filtered = filtered.filter((row) => included.includes(row.status));
    }
    const count = filtered.length;
    filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    const result = filtered.slice(offset, offset + limit);
    if (invalidRow && result.length) result[0] = { ...result[0], status: "unknown" };
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Range": request.method === "HEAD" ? `*/${count}` : `${offset}-${offset + result.length - 1}/${count}`,
    });
    response.end(request.method === "HEAD" ? undefined : JSON.stringify(result));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "task-five-test-only";

  try {
    const dashboard = await getProjectDashboard();
    assert.equal(dashboard.success, true);
    assert.equal(dashboard.data.total, 1005);
    assert.equal(dashboard.data.working, 804);
    assert.equal(dashboard.data.completed, 201);
    assert.deepEqual(dashboard.data.recentProjects.map((p) => p.name),
      [1004, 1003, 1002, 1001, 1000].map((index) => `프로젝트 ${index}`));

    const second = await getProjects(2);
    assert.equal(second.success, true);
    assert.equal(second.data.projects.length, 20);
    assert.equal(second.data.projects[0].name, "프로젝트 984");
    assert.equal(second.data.totalPages, 51);
    const last = await getProjects(999);
    assert.equal(last.success, true);
    assert.equal(last.data.page, 51);
    assert.equal(last.data.projects.length, 5);
    assert.ok(requests.every((entry) => entry.url.pathname === "/rest/v1/projects"));
    assert.ok(requests.filter((entry) => entry.method === "GET").every((entry) =>
      entry.url.searchParams.get("order") === "updated_at.desc,id.desc"));

    invalidRow = true;
    assert.equal((await getProjects()).success, false);
    invalidRow = false;
    rows.length = 0;
    const empty = await getProjectDashboard();
    assert.equal(empty.success, true);
    assert.deepEqual(empty.data, { total: 0, working: 0, completed: 0, recentProjects: [] });

    failure = true;
    for (const result of [await getProjects(), await getProjectDashboard()]) {
      assert.equal(result.success, false);
      assert.ok(!JSON.stringify(result).includes("task-five-test-only"));
      assert.ok(!JSON.stringify(result).includes("internal database"));
    }
    delete process.env.SUPABASE_URL;
    assert.equal((await getProjects()).success, false);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    await new Promise((resolve) => server.close(resolve));
  }
});