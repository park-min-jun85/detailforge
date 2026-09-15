# TASK-014 — Section Reorder

PHASE 4 · branch `feat/section-reorder` · 2026-09-15.
Git commit 없음. dependency, migration, RPC, database.types.ts 변경 없음. 실제 OpenAI 호출 0회.

## 순서의 기준

Page Plan은 AI가 처음 설계한 원본이며 수정하지 않는다. 현재 상세페이지의 표시 순서는
`sections.sort_order`다. Editor의 수동 순서는 content/style/type/plannerKey/sourcePlanFingerprint,
groundingStatus와 manualEdit.textEdited를 변경하지 않는다. Facts/source_snapshot/Validation/
Product Analysis/Asset Analysis/Project status/DetailPage status 역시 그대로 유지한다.

## API와 전체 집합 검증

- PATCH `/api/projects/[projectId]/sections/reorder`: strict body
  `{ detailPageId, orderedSectionIds: UUID[], expectedSections: [{ id, updatedAt }] }`.
- Section ID는 1~50개이며 현재 페이지의 전체 집합과 정확히 같아야 한다. 중복/누락/추가/없는 ID/
  다른 페이지·프로젝트 ID를 거부한다. 모든 expectedSections의 ID 집합과 updated_at을 확인한다.
- Project → Product → DetailPage → Sections 소속을 서버에서 확인한다. same-origin과 32KB streaming body 제한은 TASK-013을 재사용한다.
- 모든 revision을 lease 전후 두 번 검사하고 하나라도 다르면 row UPDATE 전에 전체 요청을 409로 거부한다.
  이후 각 row에도 id/detail_page_id/updated_at CAS를 적용한다. 숫자 sort_order는 서버가 0..N-1로 정한다.
- 이미 같은 canonical order이면 row를 쓰거나 manual provenance를 새로 만들지 않는다.
- 성공 DTO는 `{ ok: true, data: { sections, recovered } }`. canonical rows와 새 updated_at을 반환한다.
- 실패는 안전한 code/message만 반환한다. 복구 성공 실패 응답에는 갱신된 canonical sections도 포함해 재시도 revision을 제공한다.
- GET `/api/projects/[projectId]/editor`는 명시적 최신 재조회용이며 DB를 변경하지 않는다.

409 문구: `다른 변경사항이 먼저 저장되었습니다. 최신 섹션을 다시 불러온 뒤 순서를 변경해 주세요.`
불확실한 저장/복구 실패 문구: `순서 저장 중 문제가 발생했습니다. 최신 상태를 다시 확인해 주세요.`

## 기존 lease와 저장·복구

새 lock 체계 없이 TASK-013 `settings.sectionEdit`의 3분 lease와 page.updated_at CAS를 사용한다.
reorder 진행 중 journal 저장마다 lease를 갱신한다. Section Engine/수동 content 저장/Planner와 조정하며
활성 Planner도 reorder lease를 얻을 수 없게 한다. Planner는 provider 생성 전에도 lease/journal을 확인한다.
generation backup/진행 중 생성 또는 다른 reorder journal이 있으면 일반 reorder를 막는다.

`settings.sectionReorder`에는 schemaVersion/runId/detailPageId/status/startedAt/orderedSectionIds와
backup/current/pending을 둔다. backup은 기존 id/sortOrder/updatedAt과 **sort_order/updated_at을 제외한
row 전체의 SHA-256**이다. content/style 사본을 덮어써 복구하지 않는다.

1. 전체 집합·revision 확인 후 원래 순서 snapshot을 지속 journal에 저장한다.
2. 각 변경 전 pending write intent(id/fromUpdatedAt/fromOrder/toOrder)를 기록한다.
3. sort_order만 조건부 UPDATE하고 실제 행을 재조회해 응답 유실까지 판별한다.
4. 모든 행의 불변 fingerprint/집합/revision/최종 순서를 확인한다.
5. 최신 settings에 manualOrder를 merge하고 journal을 제거하는 page CAS로 완료한다.

중간 실패 시 같은 intent/CAS 경계를 이용해 원래 sort_order로 best-effort 복구한다.
복구하면 최신 canonical revisions를 반환하되 클라이언트 orderDraft는 보존한다.
복구가 실패하거나 프로세스가 중단되면 journal을 남기고 편집·재생성을 막는다.
Editor와 Section 조회는 journal의 마지막 완료 순서를 표시한다. 조회 전후 page.updated_at도 비교해
빠른 저장·복구로 journal이 이미 제거된 경우에도 중간 혼합 결과를 거부한다. 활성 lease가 끝난 뒤
`이전 순서 복구`는 같은 PATCH의 `{ detailPageId, recover: true }`로 AI 없이 복구한다.
이미 journal이 없어도 lease를 확인하므로 복구 재시도가 생성 중 상태를 우회하지 않는다.
외부에서 content/ID/revision이 예상과 다르게 바뀌었으면 자동 덮어쓰지 않고 복구 필요를 유지한다.

이는 **cross-row ACID transaction이 아닌 보상 처리**다. 직접 DB 조회자는 일시적 중복 sort_order를 볼 수 있다.
앱 경계 밖 직접 DB 쓰기, 장기 정지된 worker, 전역 다중 작성자 원자성까지 보장하지 않는다.
복구 실패로 외부 변경이 감지된 경우 사람이 DB 상태를 확인해야 한다. 엄격한 원자성이 필요한 단계에서는
별도 승인된 RPC/transaction 설계가 필요하다. 이번 TASK에서는 migration을 만들지 않는다.

## DB와 manual provenance

0001 migration에 `(detail_page_id, sort_order)`는 일반 index이며 UNIQUE가 없다.
2026-09-15 실제 linked DB의 전용 fixture에서 두 Section의 같은 sort_order 저장 성공을 확인하고 즉시 원복했다.
따라서 임시 offset 없이 순차 UPDATE하고 마지막에 0..N-1을 검증한다.
updated_at은 기존 DB trigger로 바뀌며 롤백 후에도 새 revision을 사용한다.

`settings.editor.manualOrder = { edited: true, editedAt, runId, sourcePlanFingerprint, orderedSectionIds }`.
sourcePlanFingerprint는 기존 Section meta의 공통값이며 서로 다르면 null이다. stale이어도 최신 Plan으로 바꾸지 않는다.
settings는 매번 최신값을 읽고 CAS로 merge하여 sectionGeneration/다른 key/editor의 다른 속성을 보존한다.
현재 Section ID 집합과 marker ID 집합이 같을 때만 수동 순서가 있다고 판단한다.
전체 재생성으로 새 UUID 세트가 만들어지면 이전 marker는 현재 순서로 취급하지 않는다.

## Editor UX

- SectionNavigator를 분리해 native HTML drag와 각 항목의 위/아래 버튼을 제공한다.
  이동 대상은 opacity, drop 대상은 outline으로 표시한다. 외부 drag payload를 신뢰하지 않는다.
- 버튼은 type/순번/방향 aria-label을 가지며 첫 항목 위로/마지막 항목 아래로는 disabled다.
  키보드 Enter/Space와 375px 패널 탭에서도 조작할 수 있다. 새 dependency 없음.
- orderDraft는 ID 배열이며 선택된 Section ID를 유지한다. 이동은 local-only, Navigator와 Preview에 즉시 같은 순서로 반영한다.
- `저장되지 않은 순서 변경`, `섹션 순서가 변경되었습니다.`, `순서 저장`, `순서 되돌리기`를 제공한다.
  되돌리기는 마지막 서버 canonical order로 돌아간다. 자동 저장하지 않는다.
- 현재 content/style dirty이면 이동 전에 저장 후 계속/버리기/취소로 확인한다.
  dirty일 때 drag는 비활성화하고 버튼으로 확인 흐름을 진행한다. 문구 저장 후 새 revision으로 순서를 저장한다.
- 기존 guard를 content dirty OR order dirty로 확장한다. order만 dirty이면 Section 선택은 허용하며
  앱 링크 이동/최신 재조회에는 확인, reload/문서 종료에는 beforeunload를 사용한다.
  확인 UI에 포커스하고 취소 시 원래 버튼으로 돌아간다.
- 실패 시 draft 유지. 409 뒤 `최신 섹션 다시 불러오기`도 명시적 버리기 확인을 거친다.
  복구 필요 응답은 추가 저장을 막으며 재조회로 복구 가능 상태를 확인한다.
- stale Plan 경고는 유지하며 수동 reorder를 허용한다. grounding을 needs_review로 바꾸지 않는다.
- 전체 재생성 확인에 `직접 변경한 섹션 순서도 초기 설계 순서로 바뀔 수 있습니다.`를 추가했다.

## 검증

2026-09-15 기존 224 + 신규 25 = **249개 테스트 통과**.
`npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check` 통과.
lint 오류/경고 0건. 테스트 실행에는 기존 Node MODULE_TYPELESS_PACKAGE_JSON 안내만 있으며 범위 밖 설정은 변경하지 않았다.
production client JS/map 21개와 src 전체에서 실제 OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY 검출 0건.
reorder service/persistence/http와 기존 Supabase/Editor의 server-only 경계를 확인했다.
실제 fixture의 Project/Product/Facts/DetailPage/Sections/Assets 조회 잔여 0건으로 정리를 완료했다.
이번 fixture는 Storage 파일을 생성하지 않았다. 기존 사용자 데이터는 변경하지 않았다.

- 자동 테스트: whole-set/중복/누락/외부 ID/소속/canonical/same order/전체 revision/lease 전후 race,
  부분 실패 복구/복구 실패와 명시적 복구/row·settings 응답 유실/기존 journal·manualOrder 보존,
  content/style/type/meta/grounding/상위 데이터 불변, stale Plan, local draft/guard,
  Planner 상호 배제, interrupted intent, 외부 content 보호, origin/오류 비공개/AI 경계.
- 실제 linked DB: 전용 Project와 기존 service + mock provider로 5개 Section 생성. OpenAI transport는 차단했다.
  순서 저장 전후 상위 데이터/Section content·style·type·meta/settings generation journal 불변과 canonical 순서를 검증했다.
  문구 guard의 저장 후 계속 검증에서 의도적으로 저장한 fixture 문구 한 행과 stale 확인용 Plan timestamp는
  별도 검증 단계에서만 변경했고, reorder가 이를 추가 변경하지 않는 것도 확인했다.
- 브라우저: 위·아래 이동/live Preview/선택 ID 유지/저장/reload/revert/키보드,
  content dirty 취소·버리기·저장 후 이동/이탈 guard/두 탭 409 및 draft 보존/최신 재조회 확인,
  375px 가로 overflow 없음/재생성 경고/stale 수동 저장.
- native drag의 실제 포인터 동작과 브라우저별 native beforeunload 경고 표시는 Cursor 수동 확인 대상이다.
  자동 브라우저 reload 시 order draft는 유지됐지만 native 경고 자체는 노출되지 않았다.

## 생성 파일

- src/features/section-reorder/: schemas.ts, draft.ts, errors.ts, persistence.ts, service.ts, http.ts, client.ts
- src/features/detail-editor/components/section-navigator.tsx
- src/app/api/projects/[projectId]/sections/reorder/route.ts
- src/app/api/projects/[projectId]/editor/route.ts
- tests/section-reorder.test.mjs
- docs/tasks/TASK-014.md

## 수정 파일

- src/features/detail-editor/: client.ts, service.ts, types.ts, components/editor.tsx, components/editor.module.css
- src/features/section-engine/: edit-lease.ts, service.ts, types.ts, components/section-manager.tsx
- src/features/page-planner/service.ts
- tests/helpers/section-db.mjs
- docs/tasks/README.md, docs/02_ARCHITECTURE.md, docs/03_DATABASE.md, docs/05_UI_UX.md, docs/07_DECISIONS.md

## TASK-015 인계 / 미구현

후속 편집 기능은 전체 ID/revision과 기존 lease·두 recovery journal을 존중해야 한다.
Renderer는 Plan 순서 대신 canonical sort_order와 앱의 복구 조회 경계를 사용한다.
Section ID 집합을 변경하는 기능은 manualOrder 유효성/dirty/reload/실패 복구를 함께 설계해야 한다.
TASK-015의 구체 범위는 별도 요청에 따른다.

Section 추가/삭제/복제, 배열 항목 reorder, undo/redo history, autosave, 개별 AI 생성,
full Renderer/export, 새 이미지 처리, Auth/협업/DB transaction/background queue는 구현하지 않았다.
