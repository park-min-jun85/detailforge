# TASK-019 — Wholesale Fact Normalization & Placeholder Filtering

완료. 브랜치 `feat/fact-normalization`, Git commit 없음. Migration/dependency/DB 타입 변경 없음.

## 저장 경계

ImportCandidate → Preview/Form 최종 입력 → 기존 Product persistence → `toManualFacts` → 공통 `fact-normalization.ts`.
수동 입력과 URL Import가 같은 저장 경계를 사용한다. UI는 같은 순수 helper로 안내만 표시하며 저장 정책은 서버 mapper에서 적용한다.
원문 추출 단계, Source schema, DB 조회와 AI provider에는 필터를 추가하지 않는다.

- `isNonFactualPlaceholder`: 비교 문자열의 trim/공백/slash 주변 공백/영문 대소문자 정규화 후 전체 값 일치.
- `normalizeFactValue`: placeholder는 null, 실제 값은 trim만 적용한다. null은 저장할 Fact pair가 아니라 제외 판정이다.
- `filterFactualSpecifications`: 제외 대상 pair를 배열에서 제거한다. 순서/정상 label/실제 값은 유지한다.
- `isFactualSpecification`: 저장과 UI가 공유하는 값+label 판정이다.

목록은 별도표기, 상세페이지/상세설명/상세정보 참조, 해당없음, 정보없음, 미상, 없음, X, X/X와 구두점·구분자만 있는 값이다. 띄어쓰기·대소문자 변형을 같은 값으로 비교한다. 부분 문자열은 매칭하지 않는다.
`ABS / PC`, `화이트 / 블랙`, `가로 / 세로`, `1 / 2`, `0`, `0W`, `-5`, `X100`, `별도표기된 제품`은 유지한다.
label은 빈 값, 구두점/구분자만 있는 값, 정확한 `항목`만 제외한다. `상품포장 부피/무게` 등 실제 label은 유지하며 유사 label을 병합하지 않는다.
선택적인 brand/category에도 같은 값 판정을 적용한다. 필수 productName은 기존 식별값/schema를 유지한다. description은 기존대로 Facts에 포함하지 않는다.

## 원본·사용자 수정·충돌

`products.raw_data`, `product_facts.source_snapshot`, `provenance.extracted`, ImportCandidate 원본에서 placeholder를 지우지 않는다.
raw_data/source_snapshot의 최상위 필드는 사용자가 최종 확인한 입력이고, `provenance.extracted`는 원래 추출값이다.
따라서 `색상=상세페이지 참조`를 `아이보리`로 수정하면 confirmed source와 Facts에는 아이보리가 들어가고 원래 placeholder는 provenance에 남는다.
변경하지 않은 placeholder는 raw/source에 그대로 남지만 Facts pair는 없다. null 값 pair를 만들지 않는다.
`원산지=수입산`과 `제조국=대한민국`은 둘 다 보존한다. 이 계층은 진위·충돌을 판단하지 않으며 이후 Fact Validation과 사람의 검토가 담당한다. supported 역시 입력 근거 범위의 일관성이지 외부 세계의 진위 증명이 아니다.
기존 DB row는 조회만으로 바꾸지 않는다. 다음 명시적 저장 시 현재 입력으로 Facts를 정규화한다. 기존 analysis/validation 결과 JSON은 보존한다.

## Downstream과 fingerprint

- Product Analysis F registry는 저장된 Facts에서 구성되므로 제외된 pair가 없다. 원본 설명의 S1은 unverified source로서 placeholder를 포함할 수 있으며 F로 승격하지 않는다.
- Fact Validation targets는 저장된 Facts만 사용한다. S1 source_snapshot에는 원문이 남을 수 있다. target 밖의 Fact를 추가한 출력은 거부된다.
- Fact Validation fingerprint는 targets뿐 아니라 전체 source evidence도 포함한다. Facts가 같아도 source-only 수정은 stale이 될 수 있다. 이를 막으려고 source evidence를 fingerprint에서 제거하지 않는다.
- Product Analysis fingerprint는 실제 사용 evidence 기준이다. 사용하지 않는 source_snapshot만 바뀌면 유지될 수 있고, Fact 값이 바뀌면 달라진다.
- Page Planner는 최신 Validation의 supported F를, Section specification은 그 Plan의 허용 F label/value를 사용한다. placeholder spec을 다시 넣은 Section 출력은 기존 grounding 검사에서 거부된다.
- 테스트의 supported Validation/Plan/Section 결과는 deterministic fixture다. 실제 AI 결과의 의미적 품질을 검증한 것은 아니다. 이번 TASK OpenAI 호출 **0회**.

## UI

Preview와 수동 Product Form에서 제외 대상 옆에 낮은 강도의 `원문은 보존되며 사실정보에는 포함되지 않음` 안내를 표시한다.
원문 input을 숨기지 않고 저장도 막지 않는다. 실제 값으로 수정하면 안내가 사라진다. 입력의 aria-describedby로 안내를 연결한다.
저장 후 `/analysis`의 Product Facts 요약은 기존 F registry를 통해 정규화된 결과를 표시한다.

## 실제 URL 검증 (2026-09-17)

Production build를 로컬 3001 포트에서 실행하고 실제 linked Supabase의 임시 프로젝트 두 개에서 브라우저 Import → 확인 저장 → `/analysis` Facts 요약을 확인했다. 각 상품의 이미지 후보는 3개였으며 이번 검증은 선택 해제하여 이미지/Storage를 생성하지 않았다.

### https://domeme.domeggook.com/s/67695797

- 상품명: 여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼.
- 카테고리: 의류/언더웨어 > 여성의류 > 조끼.
- source 스펙 7개 보존, Facts 스펙 5개 저장.
- 유지: 원산지 `수입산 / 아시아 / 중국`, 제조사 `디에이치트레이딩`, 품명 및 모델명 `컬리 집업 베스트`, 제조국 또는 원산지 `중국`, 상품번호 `67695797`.
- 제외: 모델명 `별도표기`, 상품포장 부피/무게 `X / X`.

### https://domeme.domeggook.com/s/62191078

- 상품명: 페인팅 수면조끼 수면 조끼 아기 유아 여아 아동.
- 카테고리: 유아동 > 유아동의류 > 조끼.
- source 스펙 9개 보존, Facts 스펙 4개 저장.
- 유지: 원산지 `수입산`, 품명 및 모델명 `페인팅 수면조끼`, 제조국 `대한민국`, 상품번호 `62191078`.
- 제외: 모델명/제조사 `별도표기`, 상품포장 부피/무게 `X / X`, 색상/재질 `상세페이지 참조`.
- 저장된 Form을 다시 열어 색상을 `아이보리`로 수정: 안내가 사라지고 재저장 후 Facts Summary에 색상 표시, 스펙 5개. provenance에는 원래 `상세페이지 참조` 유지.

실제 DB read 검증으로 raw/source_snapshot 동일성, 원래 extracted spec 보존, 최종 Facts subset, AI Analysis/Validation 미실행을 확인했다. 기존 사용자 프로젝트는 수정하지 않았다.

## 테스트와 검사

신규 `tests/fact-normalization.test.mjs` 55개: placeholder 변형, 구분자, 의미 있는 문장/0 보존, 보수적 label, deterministic/idempotent, 원문 불변, 두 URL fixture 저장, override, 수동 저장, legacy 명시적 저장, 이전 분석/검증 보존, F registry/Validation target, source evidence, fingerprint/stale, Planner/Section grounding.
실제 공개 데이터 fixture는 `tests/fixtures/wholesale-placeholder-products.json`; 자동 테스트는 network mock/local DB fixture만 사용한다.

- 전체 **439/439** (기존384 + 신규55), 실패/skip 없음.
- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.
- `git diff --check` 통과.
- 기존 secret audit: client bundle 22개와 source에서 실제 OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY 값 발견 **0건**. 키 값은 출력하지 않았다.
- TASK-018 SSRF/DNS/redirect/IP pinning/remote image/browser 제한 코드는 이번 TASK에서 수정하지 않았다. 기존 security tests 통과.
- 임시 프로젝트 두 개 및 종속 Product/Facts를 정리하고 잔여 row 0건 확인. Asset/Storage 생성 0개. 검증용 서버/브라우저 탭 종료.

## 파일

생성: `src/features/products/fact-normalization.ts`, `tests/fact-normalization.test.mjs`, `tests/fixtures/wholesale-placeholder-products.json`, 이 문서.
수정: `src/features/products/mappers.ts`, `src/features/products/components/product-form.tsx`, `docs/tasks/README.md`, `docs/02_ARCHITECTURE.md`, `docs/03_DATABASE.md`, `docs/04_AI_PIPELINE.md`, `docs/05_UI_UX.md`, `docs/06_CODING_RULES.md`.
기존 미커밋 TASK-018 수정은 유지하며 이번 TASK의 변경 목록과 구분한다.

## 직접 확인과 후속 범위

Cursor에서 Preview 원문/회색 안내, 실제 값 수정 후 안내 해제, 저장·재진입 원문 보존, Facts Summary에서 placeholder 제외를 확인할 수 있다. 실제 공급처 데이터는 나중에 달라질 수 있다.
Product Options 후속 단계는 구조화된 옵션/variant를 별도로 설계해야 한다. `화이트 / 블랙`, `ABS / PC`를 이 단계에서 임의 분할하지 않았으며 X/X를 옵션으로 추론하지 않는다. source provenance와 사용자가 확정한 값의 분리를 유지한다.
미구현: OCR/AI enrichment, 진위 자동 판정·충돌 자동 해결, 유사 label 병합, 기존 데이터 일괄 정리, 전용 DomemeAdapter, 옵션 추출/조합.
