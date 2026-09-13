# TASK-008 — Asset AI Analysis

- Phase: 2
- Branch: `feat/asset-ai-analysis`
- Status: 구현 및 자동 검사 완료. 실제 provider 호출 미검증(API key 미설정).
- 최종 확인: 2026-09-13
- Git commit: 미실행

## 구현 범위

기존 이미지 화면에서 private Storage의 Asset을 개별/순차 분석한다. 서버 OpenAI Responses API에
한 장의 임시 signed URL을 전달하고 strict Structured Outputs와 Zod를 통과한 시각적 결과만 저장한다.
Product Facts, 원본 이미지, Supabase schema와 migration은 변경하지 않는다.

## 생성 파일

- `src/features/asset-analysis/schemas.ts`: 결과/상태 schema, 역할/경고 enum, confidence 및 stale 기준.
- `src/features/asset-analysis/types.ts`: provider 입력/출력 경계와 브라우저 응답 타입.
- `src/features/asset-analysis/config.ts`: 서버 키/모델/timeout 설정.
- `src/features/asset-analysis/prompts.ts`: 고정 정책과 비신뢰 입력 분리.
- `src/features/asset-analysis/provider.ts`: 공식 OpenAI SDK 호출과 안전한 오류 변환.
- `src/features/asset-analysis/service.ts`: 소속 확인, 상태 claim, 서명, 검증, 조건부 저장.
- `src/features/asset-analysis/errors.ts`: 제한된 오류 코드와 한국어 메시지.
- `src/features/asset-analysis/client.ts`: 브라우저의 Asset 단위 요청.
- `src/features/asset-analysis/components/analysis-result.tsx`: 카드 분석 상태/결과/재분석 UI.
- `src/app/api/projects/[projectId]/assets/[assetId]/analyze/route.ts`: POST 진입점.
- `tests/asset-analysis.test.mjs`, `tests/asset-analysis-provider.test.mjs`, `tests/asset-analysis-service.test.mjs`.
- `tests/helpers/analysis.mjs`와 이 문서.

## 수정 파일

- `.env.example`, `package.json`, `package-lock.json`: 빈 환경변수 이름과 `openai ^7.15.0` 추가.
- `src/features/assets/components/asset-manager.tsx`: 기존 업로드에 분석 진행/개별 결과/재분석 연결.
- `tests/helpers/asset-db.mjs`: 분석 상태의 조건부 DB 쓰기, signed URL과 응답 유실 mock 지원.
- `docs/02_ARCHITECTURE.md`, `03_DATABASE.md`, `04_AI_PIPELINE.md`, `05_UI_UX.md`,
  `06_CODING_RULES.md`, `07_DECISIONS.md`, `tasks/README.md`.

## Provider, schema, prompt

기본 모델은 서버 config 한 곳의 `gpt-5.6-luna`이며 `OPENAI_ASSET_MODEL`로 변경한다.
`OPENAI_API_KEY`도 서버에서만 읽는다. SDK는 `responses.parse`와 `zodTextFormat`을 사용하며
`store: false`, `maxRetries: 0`, 60초 timeout, 출력 최대 4,000토큰을 적용한다.

schemaVersion 1, 7개 role(product/detail/usage/specification/option/notice/other), 0~1의
confidence/heroSuitability, 1~280자의 visualSummary, composition, 6개 boolean signals,
최대 6개 enum warnings를 검증한다. 모든 객체의 알 수 없는 필드를 거부한다.
상세 필드/enum은 `../04_AI_PIPELINE.md`와 schemas.ts가 기준이다.

고정 developer 메시지와 상품명 user JSON/이미지를 분리한다. 이미지 속 문자와 상품명은
명령이 아닌 분석 대상이다. 재질/크기/성능/인증/효과 등 판매 claim, 제품명/브랜드 추론,
OCR 복사와 마케팅 생성은 금지한다. 구조 검증만으로 의미의 정확성을 보장하지는 않는다.
AI output은 untrusted visual observation이며 Product Facts 쓰기 경로가 없다.

## API와 저장 정책

`POST /api/projects/[projectId]/assets/[assetId]/analyze`는 Project/Product 존재와 관계,
Asset 소속, DB storage_path의 상품 prefix와 UUID 파일명을 확인한다. 임의 URL/model을
요청 본문에서 받지 않는다. same-origin 검사와 `private, no-store` 응답을 적용한다.

검증된 DB 경로에서 서버가 300초 signed URL을 생성한다. AI 분석용 URL은 DB에 저장하지 않는다.
이 API는 현재 인증 없는 로컬 단일 사용자 전제이며 Origin 검사는 인증이 아니다.
공개 운영 전 Auth + owner_id + 사용자별 Storage/RLS 및 서버 인증/소유권 검증이 필요하다.

metadata.aiAnalysis만 교체하고 다른 metadata key를 유지한다. 완료 결과에는 provider/model,
attemptId/analyzedAt과 시각적 결과를 저장한다. confidence >= 0.65이면 role을 asset_type에
적용하고 낮으면 unclassified로 저장한다. hero는 role schema에 없으며 자동 할당하지 않는다.
heroSuitability는 후속 Planner/사람이 전체 이미지를 비교할 때 참고할 값이다.

## 상태, 재분석, 오류

- 미분석 → analyzing(startedAt/attemptId) → completed 또는 failed(failedAt/errorCode).
- 재분석 중/실패에는 이전 성공 한 개를 previousResult로 보존하고 기존 asset_type을 유지한다.
  새 성공이 저장되면 새 결과로 교체한다. 설정 누락은 분석 시작 전 반환하여 DB를 바꾸지 않는다.
- 3분 이상 된 analyzing과 미래 시각의 비정상 잠금은 재시도 가능하다.
- metadata/asset_type 비교 조건으로 상태를 claim한다. 완료 저장은 최신 metadata를 읽어 merge하며
  최대 2회 DB 저장을 시도한다. 다른 attempt의 늦은 결과, 삭제/경로 변경은 덮어쓰지 않는다.
- DB 응답 유실은 재조회하여 저장 여부를 확인한다. 완료 저장 여부가 불명확하면 성공으로 표시하지
  않으며 analyzing이 남을 수 있다. 새로고침/3분 후 수동 재시도를 안내한다.
- 설정, provider, timeout, 잘못된 결과, 없는 Asset, 소속, 서명, DB 오류를 제한된 코드로 구분한다.
  원본 provider 오류와 secret을 반환하거나 로그에 쓰지 않는다.
- provider 60초, 서명 발급 대기 10초, 각 DB 요청 10초, 브라우저 요청 125초 제한이다.
  route maxDuration은 120초이며 실제 호스팅 제한은 배포 환경에 맞춰 검토해야 한다.

## UI

`/projects/[projectId]/images`의 업로드/미리보기/삭제를 유지한다. 미분석/실패/중단 이미지를
순차 분석하고 처리/전체 수, 성공/실패 수와 카드별 상태를 표시한다. 한 장의 실패가 다른 결과를
취소하지 않는다. 완료 이미지는 개별 재분석할 수 있다.

카드에는 저장 분류와 AI 역할, 신뢰도, 대표 이미지 적합도, 요약, 경고, 이전 성공 결과 표시를 둔다.
진행 중에는 변경 버튼을 잠그고 live region으로 상태를 알린다. 새로고침 시 DB 결과가 복원되며
진행 중 상태를 주기적으로 다시 읽는다. 작은 화면에서는 기존 카드가 1열로 배치된다.

## 검증 기록

- 전체 Node 테스트 63개 통과: 기존 TASK-005/006/007 40개 + 신규 23개.
- 신규 테스트: strict schema/role/범위, metadata 보존, confidence 기준, hero 금지,
  prompt 분리, 설정, SDK 요청 형태, 자동 재시도 없음, invalid/refusal/incomplete 출력,
  오류 비공개, 소속/경로, 상태, 재분석/중단, 경쟁 쓰기, DB 응답 유실, 동시 실행 제한.
- 자동 테스트는 mock provider/transport만 사용하며 실제 유료 OpenAI 요청은 하지 않았다.
- 최종 필수 검사: `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`,
  `git diff --check` 및 전체 테스트 모두 통과했다. lint 경고는 0개다.
  Node의 기존 MODULE_TYPELESS_PACKAGE_JSON 및 Git LF→CRLF 안내는 남아 있으며 관련 설정은 변경하지 않았다.
- 빌드 프로세스에 실제 키가 아닌 감사용 문자열만 주입하고 client JS/map 15개를 검사했다.
  OpenAI 감사 문자열 및 실제 Supabase service role key의 검출 수는 모두 0개다.
  config/provider/service의 server-only 경계도 확인했다. 실제 OpenAI 키는 미설정이므로
  해당 실키 값 검사는 수행할 수 없었다. `.env.local`에는 감사 문자열을 기록하지 않았다.
- 실제 Supabase의 별도 검증 프로젝트에 PNG 2장을 업로드하고 mock provider를 주입한 실제
  분석 서비스로 성공/낮은 신뢰도/재분석 실패/중단 재시도/metadata 보존을 확인했다.
  SDK 자체는 transport mock으로 별도 확인했다. 이를 실제 OpenAI 이미지 분석 성공으로 간주하지 않는다.
- 브라우저에서 Product → Images → 다중 업로드 → 키 누락 분석 실패 → mock 성공 결과 복원 →
  이전 성공 유지/중단 재시도를 확인했다. 1200px 및 375px에서 가로 넘침이 없었다.
- 검증 전후 product_facts 전체 row가 동일함을 확인했다. 검증 Storage 파일, Project, Product,
  Asset, ProductFacts는 모두 정리했고 각 잔여 수 0건을 확인했다.
- 2026-09-13 로컬 OPENAI_API_KEY/OPENAI_ASSET_MODEL 미설정 확인. **실제 provider 호출 미검증**.
  실키를 추가하거나 mock 결과를 실제 응답으로 대체하지 않았다.

## 동기 MVP 한계와 TASK-009 인계

브라우저 순차 요청 및 서버 프로세스당 동시 분석 최대 2개다. 탭 종료 시 아직 요청하지 않은
이미지는 진행되지 않는다. 프로세스/네트워크/DB 장애 후의 지속 실행, 다중 인스턴스 전체의 동시
호출 제한, 정확히 한 번 과금은 보장하지 않는다. 중단 시 3분 후 사람이 재시도한다.

TASK-009는 Product Facts와 시각적 metadata를 구분하여 Product Analysis 입력을 구성해야 한다.
완료 상태/이전 성공의 의미와 schemaVersion, confidence, warnings를 확인하고 관찰을 상품 사실로
승격시키지 않는다. hero 최종 선택은 전체 Asset 비교 단계에서 설계한다.

사람은 Cursor에서 실제 상품 이미지의 카드 가독성/키보드 포커스, 부분 실패 진행,
새로고침 복원/재분석과 작은 화면을 확인한다. 로컬 키 설정 후 작은 이미지 1~2장으로 실제 모델
접근 권한, signed URL 읽기, 응답 형식/내용 품질과 DB 저장을 확인하는 검증이 남아 있다.

OCR, Product Facts AI 생성/수정, Fact Validation, 상품 분석/판매 포인트/마케팅 생성,
hero 최종 선택, Page Planner, Section Engine, Editor, Renderer, 이미지 생성/보정/배경제거,
marketplace/crawler, Auth, DB migration, queue/background worker는 구현하지 않았다.
