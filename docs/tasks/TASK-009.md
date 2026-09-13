# TASK-009 — Product AI Analysis

- Phase: 2
- Branch: `feat/product-ai-analysis`
- 상태: 구현 및 검증 완료. 실제 OpenAI 1회/원격 DB 저장/브라우저 복원/테스트 데이터 정리 완료.
- 마지막 확인: 2026-09-14
- Git commit: 미실행

## 목표와 경계

Product Facts와 완료된 Asset 시각 관찰을 상품 단위의 전략적 해석으로 조합한다.
Product Facts가 Source of Truth이며 AI 전략은 사실 검증 결과가 아니다.
원본 이미지를 다시 전송하지 않고 signed URL/Storage API도 호출하지 않는다.
기존 openai SDK를 사용하며 새 dependency는 추가하지 않았다.

## 생성 파일

- `supabase/migrations/0002_add_product_ai_analysis.sql`
- `src/features/product-analysis/schemas.ts`
- `src/features/product-analysis/types.ts`
- `src/features/product-analysis/errors.ts`
- `src/features/product-analysis/evidence.ts`
- `src/features/product-analysis/config.ts`
- `src/features/product-analysis/prompts.ts`
- `src/features/product-analysis/provider.ts`
- `src/features/product-analysis/service.ts`
- `src/features/product-analysis/client.ts`
- `src/features/product-analysis/components/analysis-manager.tsx`
- `src/features/product-analysis/components/strategy-result.tsx`
- `src/app/api/projects/[projectId]/product-analysis/route.ts`
- `src/app/projects/[projectId]/analysis/page.tsx`
- `tests/product-analysis.test.mjs`
- `tests/product-analysis-provider.test.mjs`
- `tests/product-analysis-service.test.mjs`
- `tests/helpers/product-analysis.mjs`
- 이 문서

## 수정 파일

- `.env.example`: OPENAI_PRODUCT_MODEL 변수 이름만 추가.
- `src/features/products/schemas.ts`, `mappers.ts`, `src/types/domain.ts`: ai_analysis → aiAnalysis JSON object 매핑.
- `src/lib/supabase/database.types.ts`: products Row/Insert/Update의 ai_analysis 타입 추가.
  사용자가 linked DB에서 재생성한 타입을 확인했으며 새 컬럼 외 기존 타입 변경은 없다.
- `src/app/projects/[projectId]/page.tsx`, `images/page.tsx`: 상품 분석 단계 명칭과 다음 링크.
- `src/features/assets/components/asset-manager.tsx`: 다음 단계 안내 수정.
- `docs/02_ARCHITECTURE.md`, `03_DATABASE.md`, `04_AI_PIPELINE.md`, `05_UI_UX.md`,
  `06_CODING_RULES.md`, `07_DECISIONS.md`, `tasks/README.md`.

## Migration과 원격 상태

0002는 products에 `ai_analysis jsonb NOT NULL DEFAULT '{}'::jsonb`와 JSON object CHECK 하나만 추가한다.
DROP, 타입 변경, 새 테이블, RLS 변경은 없다. 기존 0001 migration을 수정하지 않았다.

에이전트 환경의 CLI는 `LegacyPlatformAuthRequiredError`로 migration list/dry-run을 실행하지 못했다.
따라서 원격 적용은 인증된 사용자 터미널에서 수행했다. 사용자가 0002만 push했고 Local/Remote의
0001·0002가 일치함을 확인했으며, linked DB 기준 database.types.ts도 재생성했다.
linked ref는 `qmqspwfacacbnbizpxme`다. 에이전트는 생성 타입 diff와 실제 원격 컬럼 읽기/쓰기를 확인했다.
에이전트가 migration history를 직접 조회한 것으로 간주하지 않는다.

## Provider와 입력

기본 모델은 서버 config 한 곳의 `gpt-5.6-terra`, override는 OPENAI_PRODUCT_MODEL이다.
OPENAI_API_KEY는 기존 서버 환경변수를 재사용한다. TASK-008의 SDK/strict output/오류 경계 패턴과
공통 오류 메시지를 사용한다. UI나 route에 OpenAI SDK 호출을 넣지 않는다.

F1 상품명, F2 브랜드, F3 카테고리, F4 이후 정렬된 스펙; V는 Asset ID 순서의 완료된 관찰;
S1은 UNVERIFIED SOURCE DESCRIPTION이다. 값이 없는 선택 Fact는 제외한다.
현재 manual Facts 형식만 지원하며 알 수 없는 Facts 구조는 입력 오류로 처리한다.
Asset의 실패/진행 중 previousResult는 사용하지 않는다. malformed 분석은 제외 수를 표시한다.
Asset이 다른 Project/Product에 연결돼 있거나 경로 소속이 잘못됐으면 분석을 거부한다.

Provider에는 evidence와 coverage의 텍스트 JSON만 전달한다. Storage 경로, signed URL,
원본 이미지, raw_data, source_snapshot, API key는 전달하거나 snapshot에 포함하지 않는다.
상품 이름/스펙/설명/AI 요약은 명령으로서는 비신뢰 데이터다. 고정 developer 정책과 user 데이터를 분리한다.
확인되지 않은 사실·인증·재질·성능·치수·효과, 경쟁사 우월성, 절대 표현, 민감속성 추론을 금지한다.

## 결과 schema와 근거 검증

schemaVersion 1의 strict Structured Outputs와 서버 Zod 재검증을 사용한다.

- summary: text 최대 600자, evidenceIds.
- valuePropositions 최대 5개, audienceHypotheses 최대 4개, useCaseHypotheses 최대 5개,
  messagingAngles 최대 5개: 제목/label/angle 최대 100자, rationale 최대 400자, confidence 0~1, evidenceIds.
- contentPriorities: emphasize/deEmphasize 각각 최대 6개, 문자열 160자 이하.
- cautions 최대 8개: message 최대 300자와 evidenceIds.

요약/전략은 1~12개의 실제 근거 ID가 필요하며, 요약에는 F가 하나 이상 필요하다.
전략을 S만으로 뒷받침할 수 없고 F 또는 V가 필요하다. cautions는 근거 ID가 비어 있을 수 있다.
존재하지 않는 ID, 중복 참조, 공백뿐인 출력, 범위 밖 점수, 알 수 없는 필드를 거부한다.
근거가 부족하면 전략 배열을 비울 수 있다. 참조 존재/형식 검증은 문장 내용의 사실성을 보장하지 않는다.

## Snapshot, fingerprint와 stale

evidenceSnapshot은 서버가 생성한 당시 registry다. 이전 결과의 label은 현재 registry가 아닌
해당 snapshot에서 찾는다. AI가 snapshot을 만들어 반환할 수 없다.

객체 key 정렬, Unicode NFC, 줄끝/앞뒤 공백 정규화, 스펙 이름/값 정렬, Asset ID 정렬,
warnings 정렬 후 실제 registry와 coverage의 SHA-256을 Node crypto로 계산한다.
입력으로 사용하지 않은 metadata, Asset 시도 시각, 모델, products.updated_at은 제외한다.
같은 관찰 내용의 재분석만으로 stale이 되지 않고 Facts/설명/관찰 내용/coverage 변화는 감지한다.

현재 fingerprint가 성공 결과와 다르면 업데이트 필요 안내를 표시한다. AI 실행 중 입력이 바뀌면
처음 snapshot을 저장하고 완료 후 현재 입력을 다시 읽어 stale을 표시한다. 자동 유료 재호출은 없다.
테이블 간 읽기는 단일 DB transaction이 아니므로 수동 저장 도중의 중간 상태를 엄격히 방지하지는 않는다.

## 저장과 보호

`products.ai_analysis`는 `{ schemaVersion, attempt, latestResult }`이다. attempt에는 status,
runId, startedAt, finishedAt, errorCode를 저장하고 latestResult에는 provider/model/analyzedAt,
inputFingerprint/evidenceSnapshot/analysis를 저장한다. 초기 `{}`는 미분석이고 첫 실패는 latestResult=null이다.

모든 새 시도에 서버 UUID를 발급한다. runId와 attempt 상태를 조건부 UPDATE 필터에 넣어 중복/늦은
결과를 방어한다. 큰 latestResult를 URL 필터로 보내지 않는다. 응답 유실은 재조회하며 AI를 재호출하지 않는다.
완료 저장 실패/확인 불가는 성공으로 숨기지 않고 analyzing이 남을 수 있다. 3분 후 수동 재시도를 안내한다.

재분석 시작/실패에도 마지막 성공을 유지한다. 성공해야 latestResult를 교체한다.
Product Facts의 facts/source_snapshot/validated_at, products.raw_data, Project status를 쓰는 경로가 없다.
기존 products updated_at trigger는 작동하므로 열려 있던 상품정보 폼은 revision 변경으로 새로고침이
필요할 수 있다. 기존 상품정보 저장/보상 payload는 ai_analysis를 덮어쓰지 않는다.

## Route, UI, coverage

- `/projects/[projectId]/analysis`: 기존 Shell, 상품명, 제작 단계, Facts 요약, 이미지 분석 현황.
- `POST /api/projects/[projectId]/product-analysis`: 서버 소속 확인 후 명시적 분석.
- 같은 API의 GET: 현재 근거/fingerprint/상태/성공 결과 조회. 응답은 private/no-store.
- 이미지 화면에서 '다음: 상품 분석 →'으로 이동한다.
- 분석 결과는 요약/판매 포인트 후보/고객군 가설/사용 상황 가설/메시지 방향/우선순위/주의 패널로 표시한다.
- 사람이 이해할 수 있는 근거 label을 사용하며 전략적 해석이라는 안내를 항상 표시한다.
- 이미지 0개 또는 일부만 완료돼도 Facts가 유효하면 실행한다. 사용할 수 있는 관찰 수와 시각 근거 부재를 표시한다.
- 분석 중 중복을 잠그고 status/alert를 제공한다. 재분석 실패는 이전 성공 시각/결과와 실패를 함께 표시한다.
- 30초/탭 복귀 시 현재 입력을 읽고, 진행 중에는 5초마다 상태를 읽는다. 3분 이상 또는 미래 시각의 잠금은 재시도 가능하다.
- Product/Facts 부재는 상품정보 입력 링크, 조회 실패는 안전한 오류와 재조회 링크를 표시한다.

## 오류, timeout과 운영 한계

설정/입력/근거 참조/provider/timeout/소속/DB/경쟁 상태를 제한된 코드와 한국어 메시지로 처리한다.
OpenAI/Supabase 원본 오류와 secret을 로그/응답에 포함하지 않는다.
provider 60초, 각 DB 요청 10초, POST 브라우저 요청 125초/GET 45초, route maxDuration 120초다.
SDK 자동 재시도 0회, store=false, 출력 최대 7,000토큰이다.

프로세스당 상품 분석 최대 2개이며 같은 Project는 중복 실행을 차단한다. 영구 queue/worker는 없다.
프로세스 중단, 호스팅 제한, 다중 인스턴스 전체 호출량, 정확히 한 번 과금은 보장하지 않는다.
현재 로컬 단일 사용자 전제이며 Origin 검사는 Auth가 아니다. 공개 운영 전 사용자 인증/소유권/RLS가 필요하다.

## 검증 기록

- 신규 자동 테스트 30개: schema/범위/배열 길이, F/V/S registry, 근거 ID, normalization/fingerprint,
  stale/중단, no/partial Asset, prompt 분리, provider strict text-only 요청, 오류 비공개/자동 재시도 없음,
  최초/재분석/실패/이전 결과 보존, Facts/raw_data/Project 불변, 소속, 경쟁 저장/응답 유실, 긴 결과 URL 크기.
- 최종 전체 테스트 93개(기존 63 + 신규 30) 통과. 자동 테스트는 mock DB/provider/SDK transport를 사용하며 유료 호출을 하지 않는다.
- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check` 모두 통과했다. lint 경고는 0개다.
  빌드 시 DB 조회는 실행하지 않는다. Node의 기존 MODULE_TYPELESS_PACKAGE_JSON과 Git의 LF→CRLF 안내는 유지한다.
- 초기 브라우저 검증은 로컬 mock DB/provider 결과를 사용했다.
  상품 분석 결과, 설정 오류 시 이전 결과 유지, failed+stale 표시, 중단 재시도 버튼을 확인했다.
  이미지 → 다음 상품 분석 이동, 다시 열었을 때 결과 복원, 1200px/375px 가로 넘침 없음을 확인했다.
- 브라우저 검증 서버/탭은 종료했고 viewport override는 복원했다.
- client JS/map 17개에서 실제 OpenAI API key와 Supabase service role key가 모두 미검출됐다.
  Product provider/config/service/evidence는 server-only이다. `.env.local`을 변경하거나 키를 출력하지 않았다.
- 실제 OpenAI `gpt-5.6-terra` 호출 1회 성공. 별도 검증 Product의 Facts와 미검증 설명을 텍스트로 전달했고,
  strict 결과/근거 검증을 통과하여 products.ai_analysis에 completed 결과를 저장했다. 이미지는 0개였으며 Vision 호출은 없었다.
- 실제 DB의 최초 성공 및 provider 실패 mock을 사용한 재분석 전후에 product_facts 전체 row,
  products.raw_data를 포함한 기존 상품 필드, Project 전체 row가 동일함을 확인했다.
  ai_analysis와 기존 trigger에 의한 products.updated_at만 분석 때문에 달라졌다.
- 재분석 실패 mock은 실제 DB에 failed attempt를 저장하면서 원래 OpenAI 성공 결과를 그대로 보존했다.
  추가 유료 요청은 없었다. 재분석 성공/부분 이미지 coverage는 자동 mock 테스트에서 검증했다.
- 별도의 검증 입력 변경으로 products.description만 수정해 stale을 확인했다. 이 변경은 AI 쓰기가 아니며
  Facts/raw_data 불변도 별도 확인했다. 브라우저의 결과 새로고침으로 실제 완료/실패/이전 성공/stale 표시를 확인했다.
- 검증 Project `30db7ccf-e1d6-4350-a0e7-0ccd55025be0`와 전용 Product/Facts/분석 결과를 정리했다.
  잔여 Project/Product/Asset/ProductFacts 0건이며 Storage 파일은 만들지 않았다. 기존 사용자 데이터는 변경/삭제하지 않았다.

## 사람 확인과 TASK-010 인계

실제 상품의 결과 길이/근거 label/키보드 포커스, 작은 화면,
이미지 부분 완료, 재분석 실패, 새로고침 및 입력 수정 후 stale 안내를 확인한다.
실제 호출 1회로 모델 접근/응답/저장을 확인했으나 다양한 실제 상품의 전략 품질 평가와 사실 검증을 대신하지 않는다.

TASK-010 Fact Validation은 Product Facts와 source_snapshot을 별도 근거로 검증해야 한다.
전략의 evidenceIds 존재를 사실 검증으로 오해하지 않는다. snapshot과 inputFingerprint를 유지해
어떤 입력에서 만들어진 가설인지 추적하고 stale 결과를 최신 사실로 사용하지 않는다.

이번 범위에는 Facts 자동 수정, Fact Validation, OCR, 최종 광고 카피/headline, 경쟁사 비교,
web research, hero 최종 선택, Planner/Section/Editor/Renderer, 이미지 생성/보정,
Marketplace/crawler, Auth, background queue가 없다.
