# Tasks

## 현재 단계

TASK-028 — Commerce Copy & Visual Section Refinement 구현·실제 AI QA 완료. 브랜치 `feat/commerce-copy-quality`. 관찰 보고체 공통 검증, copy intent/message signature, distinct visual hint,4~12 Section,nullable visual body와 개별 재생성 peer context를 연결했다. 전체755 tests와 필수 검사, 실제 Planner1+Section1 호출로4 Sections/보고체0/중복사진0/860×2334 PNG·JPG 확인. [TASK-028](./TASK-028.md).

## 완료된 TASK-027 기반

TASK-027은 실제 새 Planner1회/Section1회로 TASK-026 정책을 검증했다. 사실·옵션은 유지됐지만 관찰 보고체와 반복 Detail을 발견했다. [TASK-027](./TASK-027.md).

## 완료된 TASK-026 기반

TASK-026 — Sales Detail Page Quality Refinement 구현 및 mock/crop/Renderer/PNG·JPG 검증 완료, **새 AI 생성 품질은 OpenAI credit_balance_exhausted로 미검증**. 브랜치 `feat/sales-page-quality`.
intrinsic1.5배 cap, 새 crop3% trim, coverage/제목·밀도·이미지 반복 검사, 공유 렌더링/검토 경고를 추가했다. 전체720 tests/typegen/tsc/lint/build/diff 검사 통과. 동일 상품의 기존 canonical7개를 재현한 출력860×3919이며 새 AI 결과는 아니다. [TASK-026 보고서](./TASK-026.md). commit/migration/dependency 없음.

## 완료된 TASK-025 기반

TASK-025 — Derived Asset First Reconstruction 구현 및 실제 QA 완료. 브랜치 `feat/derived-asset-reconstruction`.
저장 Derived inventory·Source 억제·Hero 후보·stale·F/V 분리·Editor provenance를 연결했다. 실제7 Derived 저장,7 Sections,정상 Hero+Derived2개/raw0회,PNG/JPG860×3875. 전체682 tests/typegen/tsc/lint/build/diff/secret 검사 통과. QA DB/Storage 정리 및 기존 데이터 불변 확인.
정책·검증 기록: [TASK-025](./TASK-025.md). migration/dependency/commit/main merge 없음.

## 완료된 TASK-024 기반

TASK-024 — Product Shot Extraction from Long Detail Images 구현·실제 QA 완료. 브랜치 `feat/detail-image-extraction`.
긴 private Source → overlap Vision tiles → 후보 검토/선택 → Sharp crop → 별도 unclassified Derived Asset을 연결했다.
실제860×12900 원본에 gpt-5.6-luna8회 tile 호출,73.5초, 후보24/기본선택11/검토저장7개 성공. 도식2개 오분류는 직접 제외했고 품질 한계를 기록했다.
전체639 tests(기존586+신규53)/typegen/tsc/lint/build/diff/secret 검사 통과. Source·비Asset·기존 사용자 데이터 보존, QA DB/Storage 정리 완료.
sharp0.35.4 직접 의존성 추가. migration/commit/main merge 없음. [54항목 완료 보고와 실제 QA](./TASK-024.md). 다음 TASK-025는 승인 Derived 우선 이미지 선택과 긴 Source fallback 정책이다.

## 완료된 TASK-023 기반

TASK-023 — 실제 도매상품 End-to-End MVP QA 완료. 브랜치 `feat/e2e-mvp-qa`.
67695797 실제 Import/API 옵션/AI/Planner/Section/Editor/Renderer/PNG·JPG 검증. 기능 흐름은 완료했으나 긴 상세 이미지와 Hero 품질은 판매용 기준 미달이다.
Planner provider의 confirmedOptions 인자 누락 blocker만 최소 수정했다. 전체586 tests/typegen/tsc/lint/build/diff 통과. QA DB/Storage 정리, 기존 데이터 해시 일치. 상세 문제·우선순위는 [TASK-023](./TASK-023.md).
dependency/migration/commit/main merge 없음.

## 완료된 TASK-022 기반

TASK-022 — Confirmed Options → Section → Editor → Export 통합 완료. 브랜치 `feat/options-section-integration`.
새 Plan의 별도 옵션 계약과 결정적 Section 매핑, 기존 option 명시적 비교/반영/CAS, snapshot 출력과 stale를 연결했다.
전체585 tests(기존547+신규38)/typegen/tsc/lint/build/diff 통과. 실제 Chromium PNG/JPG 860×2865px 및 옵션 UI 수정/취소/반영/F5/불변성 검증 완료. AI·도매 API 0회, 테스트 DB/Storage 정리 완료.
dependency/migration/commit/main merge 없음. 상세 [TASK-022](./TASK-022.md).

## 완료된 TASK-021B 기반

TASK-021B — 도매매 옵션 후보 표시·확인·저장 연결 완료. 브랜치 `feat/domeme-option-import`.
공식 API 명시적 조회 → 비교/선택 → 미저장 입력 반영 → 별도 Options CAS 저장. 출처·UUID·사용자 수정/삭제 보존, ticket/URL/version 검증.
기존514 + 신규33 = 전체547 tests와 typegen/tsc/lint/build 통과. 실제 API3회로 양성 저장/재가져오기와 제한 후보 차단 확인. 상세 [TASK-021B](./TASK-021B.md).
dependency/migration/AI/Section 출력 연결/commit/main merge 없음.

## 완료된 TASK-021A 기반

TASK-021A — 공식 API 연결 및 실제 옵션 응답 확인 완료. 브랜치 `feat/domeme-option-import`, 기준 `4a7b8ad`.
서버 전용 읽기 전용 진단과 mock 테스트를 추가했다. 지정된 상품3개를 각1회 조회하여 복수 옵션 양성 사례(67695797)와 판매 종료 조합(62191078)을 확인했다.
UI/옵션 저장/DB mutation/dependency/migration/AI 호출 없음. 상세 결과와 후속 경계는 [TASK-021A](./TASK-021A.md).
신규 mock 29개 포함 전체 514 tests, typegen/tsc/lint/build/diff/secret 검사 통과. Git commit/main merge 없음.

## 완료된 TASK-020 기반

TASK-020 — Product Options Foundation 구현·검증 완료.
브랜치: `feat/product-options`. 독립 Options row/명시적 저장, stable UUID/version CAS, confirmed read model과 Section source mapping, Adapter 후보 boundary.
사용자가 0005 단독 dry-run→remote push→Local/Remote 0001~0005 일치→linked 타입 재생성을 확인했다. 적용된 migration은 수정·재적용하지 않았다.
새 dependency와 AI 호출 없음. 상태와 후속 범위는 [TASK-020](./TASK-020.md).
전체485 tests/typegen/tsc/lint/build/diff/secret 검사 통과. 실제 Supabase/브라우저 저장·재조회·수정·삭제·두 탭 conflict, UUID/version/제약·trigger·cascade와 Facts 분리 검증 완료. 임시 데이터 잔여0건, Git commit 없음.

## 완료된 TASK-019 기반

TASK-019 — Wholesale Fact Normalization & Placeholder Filtering 완료.
브랜치: `feat/fact-normalization`. 공통 저장 mapper에서 placeholder를 Facts에서만 제외하고 raw/source/provenance를 보존한다.
수동 입력·Import Preview의 사용자 최종 값에 적용하며 실제 값 override를 허용한다. 충돌 가능한 실제 값은 그대로 유지한다.
두 도매매 URL 실제 Import/DB/Facts Summary·override 확인, AI 호출 0회, migration/dependency 없음.
신규55 포함 전체439 tests와 typegen/tsc/lint/build/diff·secret 검사 통과. 상세 정책/검증/후속 범위는 [TASK-019](./TASK-019.md).

## 완료된 TASK-018 기반

TASK-018 — Wholesale Product URL Import.
브랜치: `feat/wholesale-url-import`. Preview-first/사용자 확인 저장/선택 이미지 Import 구현. Git commit 없음.
parse5 8.0.1 추가, 기존 Playwright 재사용, migration 없음. 상세 파일·정책·검증은 [TASK-018](./TASK-018.md).

- Generic Adapter: JSON-LD → metadata → product DOM → 필요한 경우 Chromium.
- DNS/사설 IP 차단·연결 IP 고정·redirect 재검증·크기/시간 제한.
- Product/Facts CAS·보상 저장과 Asset 업로드 재사용. 원본 provenance 보존, imported Asset=unclassified.
- 실제 공개 테스트 상품 UI/DB/Storage/새로고침, 내부 주소 및 로그인 차단 검증. AI 호출 없음.
- 기존332 + 신규30 = 전체362 tests, typegen/tsc/lint/build/diff 검사 통과. 실제 Chromium fallback과 secret 검사 완료, fixture 정리.
- TASK-018 실사용 보완: 공개 상품 본문과 가격 제한을 구분하고, octet-stream 이미지의 실제 signature를 검증·정규화한다. 원산지 끝 구분자를 보수적으로 정리한다. 실제 도매매 대표/상세 이미지2개 Preview·private Storage Import·미분류·새로고침 유지 확인. 추가 회귀12개 포함 전체384 tests 통과. 세부 결과는 TASK-018의 최종 실사용 보완 기록을 따른다.

## 완료된 TASK-017 기반

- 기존 Final Render Surface만 PNG/JPG로 캡처, 저장된 canonical 입력만 사용.
- 실제 긴 스펙 포함 PNG/JPG 860×7155px 검증. private no-store attachment.
- trusted origin, image/font readiness, 75초 timeout, 크기 제한, server-only provider.
- 전체332 tests/typegen/typecheck/lint/build 통과, DB 변경·AI 호출 없음, fixture 정리.

## 완료된 TASK-016 기반

- /projects/[projectId]/render와 독립 article capture boundary.
- 저장된 canonical content/style/sort_order/width만 사용. draft/orderDraft/candidate 제외.
- 10종 Section과 bounded CSS를 Editor/Final이 공유. 기본 실제 폭 860px, final zoom 없음.
- 현재 Product 참조 이미지만 임시 서명, Hero 선택 유지, contain/cover/누락 fallback.
- stale/readiness는 검토 UI에만 표시. 생성/복구 중에는 final busy 안내. AI/DB mutation 없음.

기존 286 + 신규 26 = 312개 자동 테스트 통과. next typegen/tsc/lint/build/diff 검사 통과.
실제 DB에 편집·reorder한 10종 Section/이미지 2개로 860px, Desktop/375px,
긴 문구/spec/style/이미지/순서와 미저장 편집 제외를 검증했다. OpenAI 호출 0회.
비밀키 검사와 fixture DB/Storage 정리 최종 기록은 TASK-016을 따른다.

이전 단계: [TASK-015](./TASK-015.md), [TASK-014](./TASK-014.md), [TASK-013](./TASK-013.md), [TASK-012](./TASK-012.md), [TASK-011](./TASK-011.md), [TASK-010](./TASK-010.md),
[TASK-009](./TASK-009.md), [TASK-008](./TASK-008.md), [TASK-007](./TASK-007.md),
[TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-018로 URL 후보 확인·상품 저장·이미지 가져오기를 연결했다. 후속 특정 도매사이트 Adapter·cloud browser 배포·대형 페이지 분할·공개 운영은 별도 요청에 따른다.
후속 기능은 전체 ID/revision, 기존 lease와 두 recovery journal을 존중한다.
기존 content/style PATCH에서는 type/order를 변경할 수 없다. 순서 변경은 전용 endpoint만 사용한다.
Renderer는 Plan 순서 대신 현재 sort_order와 복구 조회 경계를 사용한다. 미적용 후보는 export 대상이 아니다.
현재는 single-user/local-development MVP다. 공개 배포 전 인증/owner_id/사용자별 RLS·Storage와 비용 제어가 필요하다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 AGENTS.md와 관련 docs를 확인한다.
