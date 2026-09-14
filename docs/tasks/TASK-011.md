# TASK-011 — Page Planner

PHASE 3. 브랜치 `feat/page-planner`. 구현/검증 완료, commit 없음. 추가 dependency 없음.

## 목표와 경계

최신 검증의 supported Facts, 완료된 Asset 관찰, 최신 Product Analysis 전략으로 상세페이지 구조를 설계한다.
Plan은 TASK-012의 입력이며 실제 Sections row, 최종 headline/copy/body/style, editor/render/export는 만들지 않는다.
Facts/source_snapshot/Validation/Product Analysis/Asset metadata와 type/Project status는 Planner가 쓰지 않는다.

## 입력과 Evidence 정책

- F: 최신 Validation의 supported 원본 Fact만 사용한다. 값/label/ID 일치를 검증한다.
  supported는 DetailForge 입력 근거 내 일관성이며 외부 진위 증명/인증이 아니다.
- insufficient/conflict/needs_review는 restricted snapshot에 보관한다. provider에는 ID/label/status만 전달하며
  제한된 값·reason은 전달하지 않는다. conflict 자체가 전체 실행을 막지는 않는다.
- V: 완료된 Asset Analysis만 사용한다. 원본 이미지 재전송/Vision 재호출은 없다.
  Asset ID/role/confidence/heroSuitability/visualSummary/composition/signals/warnings를 전달한다.
  미완료/실패/형식 오류 관찰은 제외하고 현재 모든 Asset ID는 fingerprint에 남긴다.
- Product Analysis는 별도 strategy snapshot이다. 최신일 때만 사용하고 미검증 S 참조를 제거한다.
  TASK-009의 정렬된 스펙 F와 TASK-010의 원본 순서 F를 ID 숫자로 동일시하지 않고 label/value로 매핑한다.
  restricted Fact 참조 전략을 제외하고 restricted가 있으면 참조 없는 contentPriorities를 비운다.
- 원본 설명/source_snapshot/파일명/signed URL/Validation reason은 provider 입력에 넣지 않는다.
- 고정 developer policy와 user의 untrustedPlannerData JSON을 분리한다. 내장 명령/URL/비밀 공개 요청은 데이터다.

## Plan schema와 Hero

schemaVersion 1, narrative(strategy/rationale), heroAssetId|null, heroRationale,
sections(key/type/purpose/contentBrief/evidenceIds/assetIds/priority), warnings.
기존 10개 type만 허용하며 5~12개, 기본 목표 8~12개다. 5~7개에는 insufficient_content_evidence를 저장한다.
key 중복/동일 purpose/빈 문자열/알 수 없는 필드/근거/이미지 ID를 거부하고 같은 Section의 중복 Asset은 정리한다.
keyBenefits/feature/useCase/specification/option에는 supported F가 필요하다. V만으로 상품 주장을 지지하지 않는다.
이미지에는 해당 V가, V에는 해당 Section의 이미지 참조가 있어야 한다.

Hero는 Product 소속의 분석 완료 후보 중 showsProduct=true, confidence>=.65, heroSuitability>=.5,
productVisibility/subjectClarity>=.5, textDensity!=high, blurry/cropped/low_visibility/heavy_text/ambiguous_subject
경고 없음 조건을 만족해야 한다. null을 허용한다. 선택하면 첫 번째 hero Section에서 해당 이미지/V를 참조한다.
선택은 Plan에만 기록하며 assets.asset_type을 hero로 바꾸지 않는다.

## 저장과 freshness

- 최초 POST에만 기본 DetailPage를 만든다(width=860/status=draft). 기존 project_id UNIQUE로 중복을 방지한다.
- GET은 행을 만들지 않는다. 재계획은 기존 페이지의 폭/설정/status를 유지하며 plan만 UPDATE한다.
- plan: schemaVersion, attempt(status planning/completed/failed, runId, startedAt, finishedAt, errorCode), latestResult.
- latestResult: provider/model/plannedAt/inputFingerprint/evidenceSnapshot/factPolicySnapshot/assetSnapshot/strategySnapshot/plan.
- 재계획 실패는 이전 성공을 보존한다. runId/status/updated_at 조건부 쓰기와 응답 유실 재확인을 적용한다.
- canonical SHA-256에 Facts 원문, 현재 Validation, Validation 입력 fingerprint, supported facts, 모든 Asset ID와
  완료 관찰, 최신 Product Analysis latestResult와 freshness를 넣는다. 객체 key/Asset 순서에 결정적이다.
- Validation missing/stale/invalid는 POST를 막고 검증 링크를 제공한다. GET은 이전 Plan을 계속 반환한다.
  supported Fact와 완료 이미지가 모두 없는 경우에도 근거 부족으로 실행하지 않는다.
- stale 전략은 provider에서 제외한다. 입력 변경 시 저장 Plan의 stale을 표시하며 자동 AI 재실행은 없다.
- provider 완료 후 입력 재조회 결과가 달라지면 input_changed로 실패시키고 이전 성공을 보존한다.
  여러 테이블의 읽기와 최종 저장은 원자적 transaction이 아니므로 마지막 확인 직후 변경은 이후 GET에서 stale로 감지한다.

## Route / UI / Provider

- `/projects/[projectId]/planner`, GET/POST `/api/projects/[projectId]/page-plan`.
- 상품정보 → 이미지 → 상품 분석 → 사실 검증 → 페이지 설계 → 상세페이지의 5단계 화면.
- 상품명, 검증 상태 수, 완료 이미지 수, 전략 freshness, 명시적 설계/새로고침 버튼.
- 현재 Hero 후보와 Plan Hero, narrative, 순서별 type/우선순위/목적/지침/근거 수준/이미지 카드.
- 실패 후 이전 성공, 입력 변경 stale, 최신 검증 필요와 disabled CTA를 구분한다. 키보드/details/status/alert 사용.
- 썸네일은 기존 private Asset 조회/5분 signed URL을 사용하며 4분마다 갱신한다. URL은 AI로 보내지 않는다.
- 서버 `OPENAI_PLANNER_MODEL`, 기본 `gpt-5.6-terra`, 기존 `OPENAI_API_KEY`/OpenAI SDK 사용.
- Strict Structured Outputs + Zod + 서버 reference/provenance 검증. store=false, retry=0, 출력 10000토큰.
- provider 60초/DB 10초, 프로세스당 최대 2건, planning lease 3분. background queue나 전역 비용 한도는 없다.

## Migration 검증 기록

- 먼저 `0004_add_detail_page_plan.sql` 파일만 작성하고 migration list/dry-run을 요청했다.
- SQL은 detail_pages.plan JSONB NOT NULL DEFAULT '{}'와 object CHECK만 추가한다. 기존 RLS/0001~0003은 그대로다.
- 사용자가 0004만 실제 push, Local/Remote 0001·0002·0003·0004 일치, linked 타입 재생성을 확인했다.
- dry-run 성공 출력 자체는 전달받지 않았다. 성공으로 추정하지 않으며 에이전트는 push를 반복하지 않았다.
- 생성 타입의 plan Row/Insert/Update 추가와 원격 plan 컬럼 읽기/쓰기/재조회를 확인했다.

## 검증 결과 (2026-09-14)

- 기존 123 + 신규 33 = **156개 테스트 통과**. 자동 테스트는 provider mock/HTTP stub이며 유료 호출 없음.
- schema/types/개수/unique, supported/restricted/전략 매핑, ID/소속/Hero/null/완료 관찰,
  upstream/Sections 불변, 결정적 fingerprint와 7종 입력 변화, stale/missing 검증 차단과 이전 Plan 조회,
  최초/재계획 성공, 실패 보존, 동시 실행/UNIQUE 경쟁/응답 유실, 입력 변화/변이 방어, 오류 비공개,
  prompt 데이터 분리, strict text-only provider, 모델 config, API no-store/Origin, migration mapping 검증.
- next typegen, tsc --noEmit, lint, production build, git diff --check 통과.
- 실제 Planner OpenAI **gpt-5.6-terra 1회 성공**, 6개 Section, Hero null, width860으로 원격 저장했다.
  사전 Product Analysis/Fact Validation은 검증 전용 mock fixture로 최신 상태를 만들었다. 실제 upstream 유료 호출은 없다.
  이미지 없는 가상 상품 1개 검증이므로 여러 이미지의 실제 Hero 선택 품질까지 평가한 것은 아니다.
- 원격 저장/재조회 일치, Project/Product/Facts/Validation/Analysis/Asset 불변, Sections 0건을 확인했다.
- 실제 DB에서 mock 재계획 실패로 이전 성공 보존, 수동 상품정보 변경 후 stale과 POST 차단을 확인했다.
- 브라우저에서 성공 새로고침 유지, 실패/이전 결과/stale/실행 차단, 검증→Planner 키보드 이동,
  제한 Fact 키보드 펼치기, desktop/375px 기본 레이아웃과 가로 넘침 없음, console error 0건을 확인했다.
- 클라이언트 JS/map 18개에 실제 OpenAI/Supabase service key 검출 0건. 서버 전용 모듈 경계 확인.
- 검증 전용 Project/Product/Facts/DetailPage를 삭제하고 관련 Asset/Sections 포함 잔여 0건을 확인했다.
  Storage 파일은 생성하지 않았다.

## 생성 파일

- `supabase/migrations/0004_add_detail_page_plan.sql`
- `src/features/page-planner/`: schemas.ts, types.ts, errors.ts, evidence.ts, config.ts, prompts.ts,
  provider.ts, service.ts, client.ts, components/planner-manager.tsx, components/plan-result.tsx
- `src/app/api/projects/[projectId]/page-plan/route.ts`, `src/app/projects/[projectId]/planner/page.tsx`
- `tests/page-planner.test.mjs`, `tests/helpers/page-planner.mjs`, `tests/helpers/planner-fixtures.mjs`
- `docs/tasks/TASK-011.md`

## 수정 파일

- `.env.example`, `README.md`, `src/types/domain.ts`, `src/lib/supabase/database.types.ts`
- `src/app/projects/[projectId]/page.tsx`, `images/page.tsx`, `analysis/page.tsx`, `validation/page.tsx`
- `docs/02_ARCHITECTURE.md`, `docs/03_DATABASE.md`, `docs/04_AI_PIPELINE.md`, `docs/05_UI_UX.md`, `docs/tasks/README.md`

## 한계 / 사람이 확인할 항목 / TASK-012 인계

- schema/ID 검증은 자연어의 완전한 의미 검증이 아니다. 실제 상품의 문장 속 제한 Fact 우회,
  과장 표현, 목적의 의미상 중복과 contentBrief가 광고 카피가 아닌지 사람이 확인해야 한다.
- 실제 다중 이미지에서 Hero 후보/선택 이미지/미리보기 실패/삭제 상태, 긴 한국어 텍스트와 작은 화면을 확인한다.
- TASK-012는 최신 validation과 Plan fingerprint, supported-only F, 실제 Asset 소속을 다시 확인한 후
  Plan의 key/type/order/purpose/contentBrief/evidenceIds/assetIds를 실제 Section 콘텐츠로 변환한다.
  전략과 V를 사실로 승격하지 않고 Hero는 Plan 단위로 유지한다. 생성의 멱등성/재생성 보존 정책은 후속 설계한다.
- 실제 콘텐츠/Sections/스타일/최종 카피/drag-drop/editor/renderer/export/이미지 생성·보정/Fact 자동 수정,
  Marketplace/crawler/Auth/background queue는 구현하지 않았다. 기존 single-user/local-development 전제를 유지한다.
