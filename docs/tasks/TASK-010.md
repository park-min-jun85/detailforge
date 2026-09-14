# PHASE 2 / TASK-010 — Fact Validation

- Branch: `feat/fact-validation`
- 구현/자동·provider·원격·UI 검증 완료. Migration dry-run 실행 내역은 사용자 확인 대기.
- Git commit 미실행. 추가 dependency 없음.

## 목적과 보호 경계

Product Facts는 Source of Truth다. 기존 Fact와 제공된 근거의 일관성, 충돌, 근거 부족을
평가하며 새로운 Fact를 만들거나 기존 값을 고치지 않는다. 결과는 `product_facts.validation`에만 쓴다.
`facts`, `source_snapshot`, `version`, 기존 `validated_at`, Product의 모든 필드(특히 `raw_data`,
`ai_analysis`), Project, Asset/Storage를 변경하지 않는다. 기존 product_facts `updated_at` trigger만 작동한다.

원본 값은 공백/Unicode까지 그대로 검증 대상으로 전달하고 출력의 factId/label/value가 정확히
같은지 재검증한다. 모든 Fact가 정확히 한 번 있어야 하며 추가/누락/중복/변경은 거부한다.
원본 수동 저장은 validation을 덮어쓰지 않는다. 입력이 바뀌면 이전 결과를 보존하고 stale로 표시한다.

## Route와 구성

- 화면: `/projects/[projectId]/validation`
- GET/POST: `/api/projects/[projectId]/fact-validation`
- 상품정보 → 이미지 → 상품 분석 → Fact 검증 → 상세페이지 순서다.
- 상품 분석의 다음 링크로 진입하며 Product Analysis 실행 자체는 필수 조건이 아니다.
- Page는 서버 조회/오류 조합, service는 DB/실행 조정, evidence는 근거 구성,
  provider/config/prompts는 OpenAI 경계, manager/client는 요청 상태, result는 결과 표현을 담당한다.
- POST는 동일 Origin 확인, 서버 UUID 소속 확인을 수행한다. 응답은 `private, no-store`다.
  클라이언트가 provider 설정이나 근거/Fact/판정 값을 POST로 지정할 수 없다.

## Evidence 정책

- **F 대상**: 상품명 F1, 선택적 브랜드 F2/카테고리 F3, 원본 스펙 순서대로 F4 이후다.
  F는 검증 대상이며 자기 자신을 비교 근거로 참조할 수 없다. 현재 manual Facts schema만 지원한다.
- **S1**: `source_snapshot` 전체를 key 정렬 JSON 문자열로 보존한 미검증 입력 자료다.
  빈 object이면 S1이 없다. 같은 수동 입력에서 Facts로 복사됐을 수 있어 독립 증명으로 보지 않는다.
- **V**: 소속/경로를 확인한 완료된 TASK-008 관찰만 사용한다. 실패/진행 중의 previousResult는 제외한다.
  잘못된 관찰 형식은 coverage.invalid로 집계하며 미완료 관찰을 사실로 사용하지 않는다.
- **H**: 유효한 Product Analysis의 마지막 성공 evidence snapshot에서 V/S만 복사한다.
  과거 F 복사본과 요약·가치 제안·가설·전략 문장은 제외한다. 과거 관찰/설명으로 명시하며,
  현재와 다를 수 있고 중복된 관찰을 독립 근거로 계산하지 않는다는 정책을 제공한다.
- 시각 관찰과 과거 근거만으로 supported/conflict를 확정하지 않는다. 두 판정은 S1 비교를
  반드시 참조해야 하며, 모호한 시각적 차이는 needs_review다. ID 존재 검사만으로 의미의 정확성이 보장되지는 않는다.
- 이미지·signed URL을 재전송하거나 원본 URL을 fetch하지 않는다. 텍스트 전용 입력이다.
- Facts 최대 53개, Assets 최대 30개, 근거 최대 62개, 근거 문자열 최대 60,000자,
  전체 provider 입력 JSON 최대 240,000자다. 초과 데이터는 조용히 자르지 않고 거부한다.

## Validation schema

DB 초기값 `{}`는 미검증이다. 실행 후에는 다음 envelope를 저장한다.

```text
schemaVersion: 1
attempt:
  status: analyzing | completed | failed
  runId, startedAt, finishedAt, errorCode
latestResult: null | {
  schemaVersion: 1,
  status: supported | insufficient | conflict | needs_review,
  inputFingerprint, validatedAt, provider, model,
  counts: { supported, insufficient, conflict, needs_review },
  warnings, evidenceSnapshot,
  facts: [{ factId, label, value, status, confidence, evidenceIds, reason }]
}
```

AI는 strict Structured Output으로 schemaVersion/facts/warnings만 반환한다. Zod와 ID/원본 값
재검증 후 서버가 counts, 전체 status, fingerprint, snapshot, 시각, provider/model을 붙인다.
confidence는 0~1의 **평가 신뢰도**로, 외부 진위 확률이 아니다. reason은 최대 400자,
Fact당 근거는 최대 12개, AI warning은 최대 8개/300자다. 서버 필수 안내와 합친 저장 warning은
최대 16개이며 AI warning을 임의로 잘라내지 않는다. 저장 결과도 counts/전체 상태/참조를 재검증한다.

## 상태 의미

- **supported / 검증 완료**: 입력 원본의 직접 비교 가능한 내용과 일관됨. 외부 진위·인증 증명이 아니다.
- **insufficient / 근거 부족**: 해당 Fact와 직접 비교할 관련 근거가 부족하다. 이미지에 없다는 이유만으로 충돌이 아니다.
- **conflict / 충돌**: 입력 원본과 직접 비교 가능한 명시적 모순이 있다. 사람이 확인해야 한다.
- **needs_review / 검토 필요**: 용어/단위/동일 상품 여부가 모호하거나 시각적 불일치 가능성 등 사람 판단이 필요하다.

전체 판정 우선순위는 conflict → needs_review → insufficient → supported다.
실행 완료는 모든 Fact가 supported라는 뜻이 아니므로 실행 상태와 판정 상태를 구분한다.

## Fingerprint / stale

실제로 사용한 targets/evidence/coverage/서버 warnings의 canonical JSON에 SHA-256을 적용한다.
Object key는 정렬하고 문자열은 원형을 유지한다. Asset은 ID 순으로 정렬한다. 스펙 배열 순서는
원본 Fact ID에 대응하므로 보존하며 순서 변경도 stale이다. 원본 Fact/근거 문자열의 공백 변경도 감지한다.
DB updated_at, 검증 실행 상태/시각, 사용하지 않는 metadata, Product Analysis 전략 문장만의 변경은
입력에 포함되지 않는다. 과거 snapshot의 사용된 V/S 내용이 달라지면 stale이다.

GET은 현재 fingerprint와 이전 성공 결과를 반환하며 UI가 차이를 표시한다. 검증 중 입력이
바뀌어도 당시 결과/snapshot은 보존하고 완료 후 재조회로 stale을 즉시 표시한다. 자동 AI 재실행은 없다.

## 실패 / 동시 실행 / 비밀정보

기존 SDK를 재사용한다. 기본 `gpt-5.6-terra`, 서버 전용 override `OPENAI_VALIDATION_MODEL`,
기존 `OPENAI_API_KEY`다. provider 60초, DB 10초, POST 125초/GET 45초, route 120초,
출력 최대 16,000토큰, `store:false`, SDK 자동 재시도 0회다. 긴 출력은 incomplete로 안전하게 실패할 수 있다.

설정 누락은 DB claim/AI 요청 전에 반환한다. 프로세스당 최대 2개, 같은 Project 중복 요청을 차단한다.
DB UPDATE는 Facts id/product_id/updated_at과 서버 runId/attempt 상태를 비교한다.
전체 JSON을 query URL에 넣지 않는다. 늦은 실행 결과/삭제된 row를 덮어쓰거나 복원하지 않는다.
응답 유실은 재조회로 저장 여부를 확인하고 AI를 재호출하지 않는다.
성공/실패 모두 validation만 쓰며 재검증 실패 시 이전 latestResult가 보존된다.
최종 DB 저장 자체가 실패하면 analyzing이 남을 수 있고 3분 이후 사람이 재시도한다.
다중 인스턴스 전체 비용 제한, 정확히 한 번 과금, 영속 worker/transaction은 보장하지 않는다.

고정 developer 정책과 비신뢰 user JSON을 분리한다. 입력의 명령/URL/비밀 공개 요청은 실행하지 않는다.
provider의 원문 오류/stack/키는 응답과 DB에 저장하지 않는다. SDK 로그도 끈다.

## UI

현재 Product Facts를 읽기 전용으로 표시하고 검증 당시 값/판정/이유/평가 신뢰도/근거 펼치기를
별도 결과 영역에 표시한다. 충돌은 빨강, 검토 필요는 amber, 근거 부족은 neutral, supported는
절제된 초록 배지로 표시하며 텍스트 상태도 병기한다. Fact 자동 수정/교체 버튼은 없다.

명시적인 검증/재검증/새로고침 버튼, 미검증·진행·실패·이전 성공·stale 안내를 제공한다.
화면은 30초/탭 복귀 시 GET, 진행 중 5초 GET으로 갱신한다. 키보드 접근 가능한 button/details,
status/alert, responsive 패널을 사용한다. 현재 값과 과거 결과를 같은 Fact처럼 합치지 않는다.

## Migration 검증 기록

- `0003_add_fact_validation.sql`은 product_facts.validation JSONB NOT NULL DEFAULT object 컬럼과
  JSON object CHECK만 추가한다. 기존 0001/0002, RLS, 데이터/테이블을 변경하지 않는다.
- 에이전트 CLI의 migration list/dry-run은 로그인 토큰을 읽지 못해 실패했다.
- 사용자가 0003 하나만 실제 push했고 Local/Remote 0001·0002·0003 일치 및 linked 타입 재생성을 확인했다.
- 에이전트는 생성 타입의 Row/Insert/Update에 validation만 추가된 것을 확인하고 실제 DB 읽기/쓰기를 검증했다.
- push 전 dry-run의 0003 단독 대상 확인 여부는 추가 답변 대기 중이다. 성공 실행으로 추정해 기록하지 않는다.

## 검증 결과 (2026-09-14)

- 자동 테스트: 기존 93 + 신규 30 = **123개 통과**, 실제 유료 호출 없음.
- strict schema, 4상태, 원본 불변, 근거 registry/ID, 값 변경/누락/중복 거부, fingerprint/stale,
  Product Analysis 전략 제외, prompt 분리, 오류 비공개, timeout, migration mapping,
  수동 저장 보존, CAS/동시 실행/응답 유실/삭제된 Facts/입력 변경 중 결과 저장을 검증했다.
- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.
- `git diff --check` 통과. 최종 클라이언트 JS/map 18개에서 실제 OpenAI 키와 Supabase service role 키
  검출 0건. validation config/provider/service/evidence의 server-only 경계를 확인했다.
- 실제 OpenAI: 가상 상품으로 **gpt-5.6-terra 1회 성공**, Fact 5개 supported.
  이 결과는 같은 입력 원본과의 내부 일관성일 뿐이며 의미 정확도 전체를 보장하는 평가가 아니다.
- 실제 Supabase: 저장/재조회, Facts·source_snapshot·Product Analysis·Project 보존,
  mock 재검증 실패 후 실제 성공 결과 보존, 기존 수동 입력 경로로 값을 변경한 뒤 stale을 확인했다.
- UI: 실제 저장 결과 재조회, 키보드 근거 펼치기, 실패/이전 성공/stale, mock 네 상태 표시,
  상품 분석→검증 링크, desktop/375px 기본 레이아웃을 확인했다.
- 검증 전용 Project/Product/Facts를 삭제하고 잔여 0건을 확인했다. Asset/Storage 파일은 생성하지 않았다.

## 생성 파일 (19)

- `supabase/migrations/0003_add_fact_validation.sql`
- `src/features/fact-validation/`: schemas.ts, types.ts, evidence.ts, errors.ts, config.ts,
  prompts.ts, provider.ts, service.ts, client.ts, components/validation-manager.tsx, components/validation-result.tsx
- `src/app/api/projects/[projectId]/fact-validation/route.ts`
- `src/app/projects/[projectId]/validation/page.tsx`
- `tests/fact-validation.test.mjs`, `tests/fact-validation-service.test.mjs`, `tests/fact-validation-provider.test.mjs`
- `tests/helpers/fact-validation.mjs`
- `docs/tasks/TASK-010.md`

## 수정 파일

- `.env.example`, `README.md`
- `src/features/products/schemas.ts`, `src/types/domain.ts`, `src/lib/supabase/database.types.ts`
- `src/app/projects/[projectId]/page.tsx`, `images/page.tsx`, `analysis/page.tsx`
- `docs/02_ARCHITECTURE.md`, `docs/03_DATABASE.md`, `docs/04_AI_PIPELINE.md`, `docs/05_UI_UX.md`
- `docs/tasks/README.md`

## 사람이 확인할 항목 / TASK-011 인계

- 실제 공급처의 모호한 스펙, 단위/표기 차이, 상충 자료에 대한 판정 품질을 확인한다.
- 다음 파이프라인은 최신 fingerprint 일치와 개별 상태를 확인하고 conflict/needs_review/insufficient를
  정상 사실처럼 사용하지 않아야 한다. supported도 외부 진위 보증이나 인증 문구 생성 권한이 아니다.
- H 근거/visual observation, 전략·가설을 Fact로 승격하지 않는다. Fact ID는 해당 snapshot 범위의 ID다.
- Fact 자동 수정, Fact 승인/override/history UI, 외부 진위 조회, OCR, Page Planner, Section Engine,
  Detail Editor, Auth/RLS 확장은 구현하지 않았다. TASK-011의 구체 정책은 후속 요구사항으로 정한다.
- 운영은 기존 single-user/local-development 전제다. 외부 배포 전 인증/사용자별 권한/비용 제어가 필요하다.
