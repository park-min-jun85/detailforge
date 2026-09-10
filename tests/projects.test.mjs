import assert from "node:assert/strict";
import test from "node:test";
import { createProjectSchema, projectRowSchema, parseProjectPage } from "../src/features/projects/schemas.ts";

test("프로젝트명은 trim 후 1~100자로 검증한다", () => {
  assert.deepEqual(createProjectSchema.parse({ name: "  새 프로젝트  " }), { name: "새 프로젝트" });
  assert.equal(createProjectSchema.safeParse({ name: "가".repeat(100) }).success, true);
  assert.equal(createProjectSchema.safeParse({ name: "  " + "가".repeat(100) + "  " }).success, true);
  for (const name of ["", "   ", "\n\t", "가".repeat(101), null, undefined, 42, new Blob(["bad"])]) {
    assert.equal(createProjectSchema.safeParse({ name }).success, false);
  }
});

test("브라우저가 보낸 상태/id 같은 추가 입력은 생성 데이터에 포함하지 않는다", () => {
  assert.deepEqual(createProjectSchema.parse({ name: "상품", status: "completed", id: "injected" }), { name: "상품" });
});

const row = {
  id: "d3926b64-9340-4279-99b6-8e13ac3d8c17",
  name: "프로젝트",
  status: "draft",
  created_at: "2026-09-10T00:00:00+00:00",
  updated_at: "2026-09-10T01:00:00+00:00",
};

test("다섯 DB 상태를 보존하고 snake_case를 Domain camelCase로 변환한다", () => {
  for (const status of ["draft", "analyzing", "generated", "editing", "completed"]) {
    assert.deepEqual(projectRowSchema.parse({ ...row, status }), {
      id: row.id, name: row.name, status, createdAt: row.created_at, updatedAt: row.updated_at,
    });
  }
});

test("알 수 없는 DB 상태와 잘못된 날짜/id는 UI 경계에서 거부한다", () => {
  for (const invalid of [{ status: "unknown" }, { updated_at: "not-a-date" }, { id: "bad-id" }, { name: null }]) {
    assert.equal(projectRowSchema.safeParse({ ...row, ...invalid }).success, false);
  }
});

test("잘못된 페이지 입력과 숫자 overflow를 안전한 첫 페이지로 정규화한다", () => {
  for (const input of [undefined, ["2"], "0", "-1", "1.5", "abc", "Infinity", "1e3", "99999999999999999999"]) {
    assert.equal(parseProjectPage(input), 1);
  }
  assert.equal(parseProjectPage("2"), 2);
  assert.equal(parseProjectPage("500"), 500);
});