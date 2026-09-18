# TASK-022 — Confirmed Options → Section → Editor → Export

브랜치 `feat/options-section-integration`, 기준 `4f05424`. 구현 및 통합 검증 완료.
Git commit/main merge, dependency 추가, migration, 기존 DB 일괄 변환 없음. 적용된 0005와 생성된 DB 타입은 수정하지 않았다.

## 저장 계약

- `getConfirmedProductOptions`의 기존 필드를 유지하고 `snapshot`을 추가했다. present / saved empty / missing row를 구분한다. 조회 실패는 `unavailable`, schema 실패는 `invalid_schema`로 실패하며 빈 옵션으로 대체하지 않는다.
- 신규 option content는 기존 공통 필드와 title에 `optionSnapshot: { source: "confirmed_options", appliedAt, confirmed }`를 추가한다. confirmed는 schemaVersion/policyVersion/productId/rowId/version/state/groups/fingerprint다.
- groups의 그룹 UUID/name, 값 UUID/label, 배열 순서를 그대로 보존한다. 최대 10그룹·그룹당30·전체100값을 유지한다. slash/쉼표 분리, Fact 변환, 조합/SKU/재고 추론은 없다.
- legacy `items` 또는 `optionSnapshot` 중 하나만 허용한다. 조회 시 변환/저장하지 않는다. 기존 items 표시를 유지하고 snapshot이 없으면 연결 확인 필요로 표시한다.
- 기존 AI generation meta, plannerKey, sourcePlanFingerprint, sourceInputFingerprint, manualEdit/groundingStatus, title/style/assetIds/order는 옵션 반영으로 바꾸지 않는다. 확정 옵션 출처는 AI meta와 별도 필드다.

## Fingerprint / freshness

서버의 기존 canonical JSON + SHA-256을 사용한다. schema/policy version, row ID, canonical groups/UUID/name/label/순서를 포함한다. 객체 key는 정렬하고 배열 순서는 보존한다. CAS용 version, 적용/조회 시각, source metadata, URL/ticket/secret은 내용 hash에서 제외한다.

내용이 같은 재저장은 Plan/Section을 stale로 만들지 않는다. 이름·값·추가·삭제·순서·row 교체는 변경으로 판단한다. current/stale/unlinked/missing/unavailable/invalid를 구분한다. 원본 Options는 실시간 재고나 판매 가능 보장이 아니다.

## Planner / Engine

새 Plan에는 optionsSnapshot을 별도로 저장한다. 옵션 content fingerprint가 Planner 입력 fingerprint에 포함된다. F/V registry에는 옵션을 넣지 않는다. prompt와 서버 validator 모두 present일 때 option 정확히1개, missing/empty일 때0개를 요구한다. option의 F/V evidence와 asset 연결은 비워 두며 기존 5–12개, key/type/order/count 정책을 유지한다.

provider는 option `items:[]`만 반환한다. 서버가 검증된 Plan의 확정 snapshot으로 option content를 만들고 중립 제목 `옵션 안내`를 사용한다. AI가 작성한 선택값은 거부한다. 호출 전후의 입력 fingerprint와 현재 Options version을 대조한다. 내용이 같아 Plan 생성 이후 version만 증가한 경우 Plan 연결은 유지하며, 실행 중 version 변화는 보수적으로 중단한다. 실패 시 기존 Section과 journal 복구 정책을 유지한다.

legacy Plan은 읽을 수 있지만 옵션 연결이 없으므로 새 생성 전 재계획을 안내한다. Plan이나 기존 Section을 GET에서 변경하지 않는다. option이 없는 기존 페이지에 자동 추가하지 않는다.

## 명시적 반영 API와 동시성

`GET /api/projects/[projectId]/sections/[sectionId]/options`는 저장된 Section과 최신 confirmed 원본, 옵션 freshness, 전체 Plan stale를 읽기만 한다.

동일 경로 `POST`는 revision/productId/rowId/expectedVersion/expectedFingerprint/confirmEmpty만 받는다. 원문 groups/출처를 클라이언트에서 받지 않는다. Project/Product/Page/Section 소속과 option type을 검증하고, 기존 page edit lease와 generation/reorder recovery 경계를 사용한다. 실제 server DB 원본으로 선택한 Section content만 구성한다.

UPDATE에는 Section ID/Page ID/updated_at revision 조건을 포함하며 반환 row와 불변 필드를 확인한다. 응답 유실은 실제 저장 row 대조로 확인하며 반복 쓰기하지 않는다. lease 설정/해제는 기존 metadata merge를 재사용한다.

Options와 Section은 별도 행이므로 원자적 transaction은 아니다. lease 취득 전후 source를 확인하고 저장 후 다시 읽는다. 후속 version 변경·내용 변경·조회 실패는 canonical 저장 row와 `sourceChangedDuringSave: true` 및 freshness를 반환한다. 이미 반영된 저장을 숨기거나 최신 성공으로 표시하지 않는다. 마지막 확인 이후의 변경은 다음 GET에서 stale로 감지한다. 새 RPC/migration은 없다.

Plan stale 상태에서도 명시적 옵션 반영은 가능하다. sourcePlanFingerprint를 바꾸거나 전체 Plan을 최신으로 승격하지 않는다. 전체 generation과 일반 AI regeneration의 freshness 제한은 그대로다.

## Editor / Renderer / AI 보호

- Inspector에서 읽기 전용 확정값, 연결 상태, 기존 상품정보 화면의 옵션 anchor 링크, 최신 옵션 반영을 제공한다.
- 비교 → 반영 확인/취소. 비교와 취소는 DB mutation이 없다. 빈 groups는 “이 섹션의 옵션 표시를 비웁니다.”로 별도 확인한다. 누락/조회 실패는 반영 불가다.
- 기존 content/style/order dirty guard의 저장/버리기/취소를 재사용한다. 비교 이후 새 draft가 생겨도 반영을 차단한다. 성공하면 선택한 row와 revision만 갱신하고 다른 row/draft/order를 강제 초기화하지 않는다.
- 일반 PATCH는 title/style/기존 허용 필드만 편집하고 option 값/UUID/출처 필드 변경을 거부한다. 개별 AI는 제목만 다시 쓸 수 있고 저장된 optionSnapshot은 서버가 보존한다. 오래된 candidate는 revision/content fingerprint로 거부한다.
- Editor/Final의 공유 SectionRenderer는 저장된 content만 출력한다. 최신 원본 조회는 검토 경고용이다. legacy items와 groups 중복 표시 없음. empty option은 제목/빈 카드까지 생략한다. 긴 한글/모델명은 줄바꿈하며 UUID/version/출처는 출력하지 않는다.
- PNG/JPG는 기존 canonical-only/read-only/no-store capture, 860px, 이미지/폰트 readiness, 크기/timeout 제한을 유지한다. freshness 경고는 capture article 밖에 있다.

## 검증

전체 **585개 테스트 통과(기존547 + 신규38, skip0)**. typegen/tsc/lint(경고0)/build/diff 검사를 통과했다. 실제 서버 비밀키3종을 변경 파일과 client static23개에서 값 대조했으며 검출0건이다.

자동 테스트는 실제 OpenAI·도매 API를 호출하지 않는다. 기존 547개를 유지하며 schema/read 구분/fingerprint/Plan count/Engine mapping/기존 보존/명시적 적용/CAS/lease 중 source 경쟁/commit 후 확인 실패/AI·PATCH 보호/100값/legacy·빈값·긴값 Renderer 검사를 추가했다.

실제 Chromium 검증은 `tests/options-section.browser.mjs`로 별도 수행했다. `.env.local`을 명시적으로 로드하며 명시적 opt-in이 필요하다.

```powershell
$env:DETAILFORGE_OPTIONS_BROWSER='1'
node --env-file=.env.local --conditions=react-server --import ./tests/register.mjs tests/options-section.browser.mjs
```

이 스크립트는 자기 UUID의 테스트 프로젝트와 private Storage image만 만들고 finally에서 정리한다. 기본 앱 주소는 `http://localhost:3000`이며 `TASK022_ORIGIN`으로 로컬 주소를 지정할 수 있다. AI와 도매 호스트 요청을 차단한다. mock provider로 실제 Plan/Section 서비스를 실행한다.

2026-09-18 실제 검증:

- 1그룹·6개 값, slash/쉼표/모델명/긴 한국어 fixture로 생성 계약과 Editor 값을 확인했다.
- 상품 옵션 UI 저장 → 기존 Section 불변/stale → 비교 취소 불변 → dirty guard 취소 시 draft 유지 → 명시적 선택 Section 반영 → F5 유지 통과.
- 다른 Section, 수동 순서, style, 이미지, 제목, 기존 meta, Product/Facts/Analysis/Validation/Plan 불변을 대조했다.
- 변경 전 PNG 68,747 bytes/JPG 105,234 bytes, 변경 후 PNG 70,690 bytes/JPG 107,449 bytes. 모두 **860×2865px**. 6값 순서와 긴 문구 줄바꿈, 가로 overflow 없음. 최종 PNG/JPG를 직접 열어 시각 확인했다.
- 검증 프로젝트 `f2d54d6f-9465-42a8-a8eb-0a5889cdfe58`와 private image 정리 완료. 앞선 검증 중 링크 오류로 중단된 프로젝트 `809de332-84a9-4c58-adf6-7b32f51020fb`도 정리했다. 실제 상품 옵션 화면 anchor로 수정 후 전체 시나리오를 통과했다.
- 최종 UI 재확인 프로젝트 `39d35a21-ff2f-453b-b2b1-66ecd67cae6a`도 전 시나리오 통과 후 정리했다. 세 검증 scope의 projects/products/assets/detail_pages 잔여0건, Storage prefix 잔여0건을 재조회했다.
- 실제 OpenAI 0회, 도매 API 0회. API의 네트워크 장애/경쟁은 mock으로 검증한다.

검사 명령: `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`, `npx.cmd next typegen`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `git diff --check`.

## 변경 파일

신규: `product-options/{section-snapshot,confirmed-source}.ts`, `detail-editor/option-application.ts`, `detail-editor/components/option-inspector.tsx`, Section options API route, `tests/options-section.{test,browser}.mjs`, 본 문서.

수정: Product Options queries/errors, Planner types/evidence/schema/prompt/service/manager, Section Engine options/schema/types/grounding/service/prompt/preview, Editor service/editor/inspector, regeneration schema/provider/grounding/prompt, Renderer model/service/copy/component/CSS/review. 관련 기존 테스트/DB mock을 새 계약에 맞게 보완했다. tasks README/Architecture/Database/AI Pipeline/UI UX를 갱신했다.

## 사람이 확인할 항목과 제외 범위

실제 운영 상품에서 여러 그룹·최대 선택값 길이와 원하는 간격, 키보드 비교/취소/dirty guard, 다중 option legacy 페이지의 대상 선택을 확인할 수 있다. 실제 provider 동작은 이 TASK에서 호출하지 않았으며 mock 계약 검증 범위다.

SKU/가격/재고/옵션 이미지/조합 제한 평탄화, 새 도매사이트, 자동 추론/동기화/AI 실행, Section 자유 추가·삭제, 인증·배포, 기존 데이터 일괄 변환은 구현하지 않았다.

## 전체 파일 목록

생성:

- `docs/tasks/TASK-022.md`
- `src/app/api/projects/[projectId]/sections/[sectionId]/options/route.ts`
- `src/features/detail-editor/components/option-inspector.tsx`
- `src/features/detail-editor/option-application.ts`
- `src/features/product-options/confirmed-source.ts`
- `src/features/product-options/section-snapshot.ts`
- `tests/options-section.browser.mjs`
- `tests/options-section.test.mjs`

수정:

- `docs/02_ARCHITECTURE.md`
- `docs/03_DATABASE.md`
- `docs/04_AI_PIPELINE.md`
- `docs/05_UI_UX.md`
- `docs/tasks/README.md`
- `src/features/detail-editor/components/editor.tsx`
- `src/features/detail-editor/components/inspector.tsx`
- `src/features/detail-editor/service.ts`
- `src/features/detail-renderer/model.ts`
- `src/features/detail-renderer/renderer.module.css`
- `src/features/detail-renderer/review.tsx`
- `src/features/detail-renderer/section-copy.tsx`
- `src/features/detail-renderer/section-renderer.tsx`
- `src/features/detail-renderer/service.ts`
- `src/features/page-planner/components/planner-manager.tsx`
- `src/features/page-planner/evidence.ts`
- `src/features/page-planner/prompts.ts`
- `src/features/page-planner/schemas.ts`
- `src/features/page-planner/service.ts`
- `src/features/page-planner/types.ts`
- `src/features/product-options/errors.ts`
- `src/features/product-options/queries.ts`
- `src/features/section-engine/components/section-preview.tsx`
- `src/features/section-engine/grounding.ts`
- `src/features/section-engine/options.ts`
- `src/features/section-engine/prompts.ts`
- `src/features/section-engine/schemas.ts`
- `src/features/section-engine/service.ts`
- `src/features/section-engine/types.ts`
- `src/features/section-regeneration/grounding.ts`
- `src/features/section-regeneration/prompts.ts`
- `src/features/section-regeneration/provider.ts`
- `src/features/section-regeneration/schemas.ts`
- `tests/detail-renderer.test.mjs`
- `tests/helpers/page-planner.mjs`
- `tests/helpers/section-db.mjs`
- `tests/product-options.test.mjs`
- `tests/section-engine.test.mjs`
- `tests/section-regeneration.test.mjs`
