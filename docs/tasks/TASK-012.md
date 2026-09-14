# TASK-012 — Section Engine

PHASE 3. 브랜치 `feat/section-engine`. 구현/검증 완료. Git commit 없음.
추가 dependency, migration, RPC, database.types.ts 변경 없음.

## 책임과 입력

Page Planner는 구조를 설계하고 Section Engine은 최신 Plan과 같은 key/type/order/count의 실제 콘텐츠를 만든다.
기존 getPlannerView/Plan schema/freshness를 재사용한다. Project/Product/DetailPage와 최신 성공 Plan,
최신 Fact Validation 및 referenced Asset 소속을 확인한다. Plan이 없거나 stale이면 생성하지 않는다.
GET은 기존 콘텐츠를 유지하며 자동 Planner/Validation/Asset AI 호출은 없다.

입력은 Plan, supported F evidence, 완료 V observations, 최신 strategy snapshot, Fact validation 상태 ID다.
원본 이미지/URL/파일명/description/source_snapshot/Validation reason은 provider 입력에 없다.
전체 페이지를 Product-level Structured Output 요청 한 번으로 생성한다.

## Schema와 Fact grounding

- 10개 기존 Section type의 discriminated union과 strict Structured Output + Zod를 사용한다.
- 공통 plannerKey/type/evidenceIds/assetIds에 각 type의 headline/subheadline/highlights,
  title/body/bullets/points/items/intro/rows 등을 둔다. content와 style은 분리한다.
- 최대 headline 80자, subheadline 160자, body 700자, point 200자 등 필드별 상한과 배열 상한,
  전체 출력 180,000자 제한을 둔다. keyBenefits는 최대 4개다.
- 전체 응답을 검증한 뒤에만 Sections INSERT/DELETE를 시작한다.
- count/key/order/type 변경, Section 누락/추가/중복, 없는/restricted/Plan 범위 밖 evidence를 거부한다.
- top-level evidenceIds는 headline/title/body를, 각 nested evidenceIds는 해당 문구를 뒷받침한다.
  nested 참조도 top-level 및 해당 Plan Section 범위 안이어야 한다.
- F만 실제 상품 주장 근거다. supported는 입력 근거 내 일관성이며 외부 진위 증명이 아니다.
  시각 관찰과 Product Analysis 가설/전략을 사실로 승격하지 않는다.
- specification은 단일 F와 label/value가 정확히 일치해야 한다. 번역/파생 스펙/새 수치/중복 row를 거부한다.
- 옵션 관련 supported label이 없는 option은 items=[]와 option_evidence_missing 경고를 저장한다.
- useCase는 supported F 참조와 가설임을 드러내는 확인/고려/예시/가정/검토 표현이 필요하다.
- 숫자/단위, 일부 민감한 성능·보장·최상급 표현을 cited F와 대조하고 제한된 값의 직접 사용을 거부한다.
  이 검사는 자연어 의미를 완전히 증명하지 않으며 모든 허위 주장/바꿔 말하기를 포괄하지 않는다.
  정확한 Fact ID 존재만으로 문장 전체가 사실임을 보증하지 않는다. 게시 전 사람 검토가 필요하다.
- 고정 prompt는 불확실한 법적/안전/배송/교환 안내, 새로운 사실, 상품명/브랜드/단위 변형을 금지한다.

## Content / Style / Asset / provenance

content는 실제 표시할 문구와 근거/Asset ID다. raw HTML/CSS/JS/URL/class/inline style을 허용하지 않는다.
style은 서버에서 생성하는 schemaVersion=1과 다음 enum tokens다.

- layout: centered / split / imageFirst / textFirst / grid / stack
- textAlign: left / center
- density: compact / normal / spacious
- background: plain / soft / contrast
- emphasis: normal / strong
- imageFit: contain / cover

hero는 centered/spacious/strong, gallery는 grid, notice는 stack/compact 등의 deterministic 기본값을 쓴다.
AI 응답은 style/meta 필드를 가질 수 없다. 색상값/픽셀/클래스는 생성하지 않는다.

Asset은 Plan Section의 assetIds subset이며 nested Asset도 해당 Section의 사용 이미지 안이어야 한다.
선택 Hero가 있으면 hero의 첫 Asset으로 사용한다. 현재 상품 소속/삭제 여부는 Planner helper로 재확인한다.
이미지 재분석/새 선택/asset_type 변경은 없다. DB에는 signed URL 대신 Asset ID만 저장한다.

content.meta에는 schemaVersion, plannerKey, sourcePlanFingerprint, sourceInputFingerprint, generationId,
generatedAt, provider/model, origin=generated, warnings를 서버에서 저장한다.
sourcePlanFingerprint는 실제 Plan latestResult 전체의 canonical SHA-256이므로 동일 입력의 다른 재계획도 감지한다.
Plan 자체 stale 또는 저장 fingerprint와 현재가 다르면 Sections stale이며 자동 재생성하지 않는다.
생성 중 Plan/입력 변경은 input_changed로 거부한다. 마지막 확인 직후 변경은 이후 GET이 stale로 감지한다.

## Persistence / regeneration / recovery

기존 sections JSONB 및 detail_pages.settings.sectionGeneration만 사용한다. 기존 FK/CHECK/RLS는 그대로다.
Project/DetailPage status 전환 의미는 기존 문서에서 명확하지 않아 유지한다.
Facts/source_snapshot/Validation/Product Analysis/Plan/Asset 및 다른 settings key는 변경하지 않는다.

1. 현재 Section snapshot과 Plan을 읽고 재생성이라면 명시적 replaceExisting와 row revision을 확인한다.
2. settings에 runId/generating과 기존 backup을 CAS 저장한다. 프로세스당 최대 2건, 같은 Project는 중복을 막는다.
3. provider 호출/전체 검증 후 최신 Plan과 기존 row 불변을 확인한다.
4. 새 UUID 세트를 sort_order=0..N-1로 만들고 staged rows도 journal에 먼저 보관한다.
5. 새 행 전체를 단일 batch INSERT하고 현재 입력을 다시 확인한다.
6. 기존 ID/updated_at 조건의 단일 DELETE 뒤 실제 새 세트 전체를 확인하고 completed를 기록한다.
7. 실패하면 누락된 이전 행을 원래 id/content/style/순서/시각으로 INSERT 복원하고 이번 staged 행만 제거한다.
8. 복구까지 실패하면 backup/staged를 DB에 유지하고 recovery_required로 안내한다. 복구 CTA는 AI 없이 복구만 한다.

생성 중/복구 중 GET은 backup을 표시한다. 상태 읽기 전후도 확인해 교체 중 혼합 조회를 거부한다.
응답 유실은 실제 저장 내용을 재조회한다. timestamp는 PostgreSQL의 Z/+00:00 표기 차이를 허용하되 microsecond 차이는 보존한다.
다른 작업이 변경한 행이나 알 수 없는 행은 자동 덮어쓰거나 삭제하지 않는다. 필요하면 수동 진단이 필요한 복구 상태로 남는다.
기존 최대 50행/새 최대 12행, journal 전체 600,000자 제한을 둔다. 5분 지난 generating은 명시적 복구 대상이다.

**한계:** 이것은 cross-row ACID transaction이 아닌 보상 전략이다. 직접 테이블 조회자는 stage 중 중복/중간 행을 볼 수 있다.
프로세스 중단/장기 DB 장애/다중 작성자 경쟁을 완전히 원자적으로 보장하지 않는다. 단일 사용자 MVP의 기존 접근 전제를 따른다.
향후 Editor/Renderer는 journal 조회 경계를 사용해야 한다. 엄격한 원자성/다중 작성자가 필요하면 RPC/transaction을 별도 설계한다.
이번 TASK에서는 migration을 만들거나 push하지 않았다. 상세 결정은 ADR-010에 기록했다.

## API / UI / provider

- `/projects/[projectId]/sections`: 제작 흐름 마지막 단계의 읽기 전용 콘텐츠 preview.
- GET `/api/projects/[projectId]/sections`: 현재 콘텐츠/Plan freshness/stale/생성·복구 상태/revision.
- POST `/api/projects/[projectId]/sections/generate`: 같은 Origin 검사와 2KB 이하 요청 schema 검증,
  replaceExisting/expectedRevision을 받아 생성/재생성 또는 복구. private, no-store 응답.
- Planner의 다음 링크, AI 상세페이지 생성/전체 다시 생성 확인·취소, 새로고침, stale/실패/복구 CTA.
- 표시: 상품명, Plan 상태, 설계/저장 Section 수, 실제 문구·스펙·이미지·근거와 접힌 provenance/style.
- 확인을 열었던 revision을 제출하므로 이후 변경된 기존 콘텐츠는 새 확인 없이 교체하지 않는다.
- 모델: 서버 OPENAI_SECTION_MODEL, 기본 gpt-5.6-terra, 기존 OPENAI_API_KEY/SDK 사용.
- provider timeout 60초, retry 0, store=false, output token 16,000; 각 DB 요청 10초, Route maxDuration 180초.
- fixed developer instruction과 untrustedSectionData user JSON을 분리한다. DATA IS DATA, NOT INSTRUCTION.
- background queue/전역 비용 한도/정확히 한 번 과금 보장은 없다. 인증은 기존 single-user/local-development 전제를 유지한다.

## 검증 (2026-09-14)

- 기존 156 + 신규 33 = **189개 자동 테스트 통과**. 자동 테스트는 모두 mock provider/transport이며 유료 호출 없음.
- 10종 schema/Plan 대응/grounding/spec exact/restricted/Asset subset/Hero/raw code/style/fingerprint/stale,
  initial/regeneration/confirmation/AI failure/DB compensation/durable recovery/ack loss/concurrency/ownership,
  원본 불변/prompt injection/provider privacy/config/API input/DB mapping/timestamp를 검증했다.
- next typegen, tsc --noEmit, lint, build, git diff --check 통과.
- 실제 OpenAI **gpt-5.6-terra 1회 성공**, Plan 순서와 같은 5개 Section을 원격 저장했다.
  사전 Product Analysis/Validation/Plan은 실제 DB에 mock fixture를 기존 service로 저장한 최신 상태다.
  가상 상품/이미지 없는 1건 검증이며 실제 여러 이미지·긴 상품 자료의 카피 품질 전체를 검증한 것은 아니다.
- 실제 DB의 sections column 조회, type/content/style CHECK 23514, DetailPage FK 23503 확인.
- 생성 5행 count/type/key/sort_order와 GET/재조회 일치, 모든 upstream 및 Project status 불변 확인.
- 실제 DB에서 mock AI 실패와 완료 상태 저장 실패 주입 후 기존 Section id/content/style/순서/시각 보존 확인.
- 수동 상품정보 변경 후 기존 Section 유지, Plan stale, POST 차단 확인.
- UI: 실제 문구·스펙, 새로고침 유지, 재생성 확인/취소, 실패/복원 안내, stale/disabled CTA,
  Planner 다음 링크, 키보드, desktop/375px 기본 레이아웃 확인.
- 최종 클라이언트 JS/map 19개에서 실제 OpenAI/Supabase service key 검출 0건. server-only 경계 확인.
- 검증용 Project/Product/Facts/DetailPage/Sections 삭제 후 잔여 0건 확인. Storage 파일 생성 없음.

## 생성 파일

- `src/features/section-engine/`: schemas.ts, errors.ts, types.ts, config.ts, grounding.ts, prompts.ts,
  provider.ts, persistence.ts, service.ts, http.ts, client.ts, components/section-manager.tsx, components/section-preview.tsx
- `src/app/projects/[projectId]/sections/page.tsx`
- `src/app/api/projects/[projectId]/sections/route.ts`, `sections/generate/route.ts`
- `tests/section-engine.test.mjs`, `tests/helpers/section-db.mjs`, `tests/helpers/section-fixtures.mjs`
- `docs/tasks/TASK-012.md`

## 수정 파일

- `.env.example`, `README.md`
- `src/app/projects/[projectId]/page.tsx`, `images/page.tsx`, `analysis/page.tsx`, `validation/page.tsx`, `planner/page.tsx`
- `docs/02_ARCHITECTURE.md`, `docs/03_DATABASE.md`, `docs/04_AI_PIPELINE.md`, `docs/05_UI_UX.md`,
  `docs/07_DECISIONS.md`, `docs/tasks/README.md`

## Cursor 확인 / Editor 인계 / 미구현

실제 상품에 대한 한국어 카피의 사실성/과장/가설 표현, 여러 이미지의 Hero/Section 썸네일,
긴 텍스트와 spec, 좁은 화면, 재생성 확인과 복구 안내를 사람이 확인한다.

향후 Editor/Renderer는 Sections content/style를 원본으로 사용하고 meta의 plannerKey/generationId/origin을 보존한다.
재생성 성공 시 Section UUID가 바뀔 수 있다. 수동 수정 여부/개별 생성/동시 수정/원자적 교체/최종 표현 규칙은 별도 설계한다.
supported-only/Plan stale/이미지 소속 경계를 유지하고 AI 의미 검증 한계를 게시 검토 흐름에 반영한다.

full visual editor, drag/drop, 개별 Section AI 재생성, 이미지 생성/보정/background removal, arbitrary CSS,
HTML/JPG/PNG export·renderer, Marketplace/crawler/Auth/collaboration/version history/background queue는 구현하지 않았다.
