# Tasks

## 현재 단계

**TASK-049:** M4 Real Colored-frame Miss Reproduction & Safe Classification Contract 완료. `feat/colored-frame-real-miss-contracts` / 기준 `c62fe89`. A01 ambiguous, B01 panel_background, B02 content_touching_edge; 실제 자동 trim 승인 패턴0. 작은 real patch3개(100,676bytes)/합성10개/current·desired 분리 검증, 새38 포함 **1291 tests 및 필수검사 PASS**. **M1 RESOLVED 유지 / M4 NEEDS_WORK — root cause/classification established, MEDIUM1/LOW0.** production/threshold/기존fixture/UI/AI/원격/package0, commit/merge/tag0. [57항목·수치·gap matrix](./TASK-049.md). 다음은 **TASK-050 Review/Manual Crop UX 설계**, detector 확장·release 검증으로 바로 진행하지 않는다.

## 이전 TASK-048 기록

**TASK-048:** 실제 Image Boundary Before/After QA 완료. `feat/image-boundary-real-qa` / `cea04fd`, source2/상품2/crop26. **M1 RESOLVED(추가 trim 안전성 gate), M4 NEEDS_WORK, MEDIUM1/LOW0**. AFTER 모두 preserve, clear/possible loss0, same17/cleaner0/minor worse9, obvious residue3→3. 합성30종·전체1253 tests·필수 검사·AFTER3개 저장/Planner/Renderer·PNG/JPG860px PASS. 적극 trim의 실제 안전성/기존 후보의 의미 인식 전체 해결 주장은 하지 않는다. production/fixture/AI/원격/version 변경0, 기존 Derived 보존, commit/merge/tag0. [66항목 및26개 전수 기록](./TASK-048.md), [최신 계약 상태](../V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md). 다음은 **TASK-049 M4 실제 frame/panel miss 구분·최소 재현 계약**, release 검증은 보류한다.

## 이전 TASK-047 기록

**TASK-047:** Conservative Colored-frame Detection & Content-loss Guard 완료. `feat/conservative-frame-trim` / 기준 `f693151`. 사용자 승인에 따라 같은 pixels/config의A/H는 모두 보존. 기존22종 content-loss0, separator가 있는A2 8종 safe trim, 위험 변 veto·최대3%·pixel identity·legacy/new provenance 검증. **1253 tests 및 필수 검사 PASS**, M1/M4는 **implementation complete / real QA pending, MEDIUM2/LOW0**. version0.2.0, AI/원격/UI/Renderer/SQL/dependency/commit/merge/tag0. [67항목 보고](./TASK-047.md), [승인된 계약과현재 matrix](../V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md). 다음 TASK-048은 실제 여러 상품 원본 전후 QA다.

## 이전 TASK-046 기록

**TASK-046:** M1/M4 Image Boundary Quality Reproduction Corpus & Contract Freeze 완료. 기준 tag `v0.2.0` / `df312b6`, branch `feat/image-boundary-quality-contracts`. M1 12종/M4 10종 synthetic corpus·내용 보존 oracle·안전 계약·gap matrix 고정. 현재 M1-H 손실/M4-A~E 잔존은 미수정이며 **MEDIUM2(M1/M4 미해결)/LOW0 유지**. 신규61 포함 **1217 tests 및 typegen/typecheck/lint/build/diff/secret PASS**. production/AI/원격 mutation/SQL/dependency/version 변경0, package0.2.0, commit/merge/tag 없음. [48개 항목 보고](./TASK-046.md), [계약](../V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md). 다음은 TASK-047 conservative colored-frame detector + content-loss risk guard.

## 이전 TASK-045 기록

**TASK-045:** v0.2.0 Final Release Candidate Validation & Release Preparation 완료. **RC PASS — Local/Internal MVP**, 전체1156 tests·필수 검사·단계별 fixture full smoke·Editor 실패/복구/명시 후보 적용·A/B Export·반복 출력·데이터 보호·secret scan·cleanup PASS. **M2/M3/L1 RESOLVED, BLOCKER0/HIGH0, MEDIUM2(M1/M4)/LOW0**. package/lock0.2.0, 외부 API0, 신규 기능/SQL/dependency0. commit/merge/tag/Release 게시 미실행. [62개 항목·Release notes·다음 Git 명령](./TASK-045.md).

## 이전 TASK-044 기록

**TASK-044:** Sparse Section Vertical Rhythm Polish 완료. deterministic 공유 Renderer policy, canonical mutation0. A sparse fixture2115→2035px/B visual-rich3057px 유지, 이미지 크기·Editor100% parity·PNG/JPG860px PASS. **1156 tests 및 typegen/typecheck/lint/build/diff/secret PASS**, **L1 RESOLVED, BLOCKER0/HIGH0, MEDIUM2(M1/M4)/LOW0**. M2/M3 해결 상태 유지. AI/migration/dependency/commit/merge/tag0. [57개 항목 보고](./TASK-044.md). 다음은 TASK-045 release 검증.

## 이전 TASK-043 기록

**TASK-043:** Observation-Narration Guard Patch & Actual AI Revalidation 완료. 기존 detector의 bounded capture 구문·한국어 warning만 보완. **H1 resolved by TASK-043, M3 RESOLVED**, 기존22개·신규51 포함 **1142 tests와 typegen/typecheck/lint/build/diff/secret PASS**. 실제 Section1회, Planner/regen0, 첫 accepted output의 보고체/문제 반복/unsupported V-only0. Browser manual 원문·warning 보존, Final/PNG/JPG860×3057 경고0. **BLOCKER0/HIGH0, MEDIUM2(M1/M4)/LOW1(L1)**. M2/원본 데이터 보존, migration/dependency/commit/merge/tag0. [56개 항목 보고](./TASK-043.md). 다음은 선택 TASK-044 또는 TASK-045다.

## 이전 TASK-042 실제 QA

**TASK-042:** 실제 AI/Browser/Final/Export QA 실행 완료, **M3 NEEDS_WORK**. 상품67695797 첫 Planner1/Section1/regen1, 반복6범주0, manual warning/명시 후보 적용 PASS, Final article/PNG/JPG 검토문구0·860×3057·스펙/옵션 exact. gallery ‘외관을 담았습니다’는 자동 meta0/human1(HIGH1)로 남긴다. **1091 tests·typegen/typecheck/lint/build/diff·secret PASS**. 기존 데이터 불변·QA cleanup, commit/merge/tag 없음. TASK-040 원본 build 대기는 해소돼 M2 RESOLVED, MEDIUM3/LOW1 유지. [59개 항목 보고](./TASK-042.md). 다음은 H1 최소 재현/정상 negative와 bounded guard 보완이다.

## 이전 TASK-041 구현

**TASK-041:** Copy Role Separation & Review 구현. C1~C22 allow9/warning7/reject6, 제목/본문·반복 F의 역할별 경고, C13 보고체 거부를 검증했다. Editor/Final review shell·재생성 후보에서 검토 이유를 표시한다. **1091 tests·typegen/typecheck/lint/build/diff PASS**. Copy policy v3, legacy 읽기/수동 저장/사실·옵션·이전 성공 보존. TASK-041 외부 호출0, 실제 판정은 위 TASK-042 참조. [구현·검증·한계](./TASK-041.md).

## 이전 TASK-040 기록

**TASK-040:** failed-Tile retry UI와 최소 read-only DTO, stable-ID true/false 선택 보존을 구현했다. 실제 도매상품67695797의 연속800×3600 source2-Tile에서 partial→complete, retry OpenAI1회(준비 포함2), 후보5→10, Derived3개 저장/중복 방어를 확인했다. 전체1054 tests PASS. 문서 적용 및 원본 최종 build 재확인은 workspace 쓰기 권한 제한으로 대기 중이다. M2는 기능 gate 충족/최종 확정 대기, M3·MEDIUM4/LOW1은 아직 유지한다. [67개 항목과 한계](./TASK-040.md).

## 완료된 TASK-039 기반

TASK-039 — Explicit Failed-Only Tile Retry Server Logic 완료. `feat/failed-tile-retry`, 기준 `76a14e0`. 환경 오류 전의 미완료5파일을 보존하여 route·실패 전용 실행·회귀·문서를 완성했다. **전체1,034 tests와 typegen/typecheck/lint/build/diff·secret 검사 PASS**. 서버는 expectedRevision/현재 입력을 검증하고 선택 failed만 index 순서로 호출한다. retry UI/실제 E2E는 TASK-040이며 M2/M3는 미해결 유지. [66개 항목·최종 검사](./TASK-039.md). 실제 API/원격 mutation/SQL/dependency0, package0.1.1, commit/merge/tag 없음.

## 완료된 TASK-038 기반

TASK-038 — Tile Checkpoint/Cache Domain Model & Persistence 완료. `feat/tile-checkpoint-cache`, 기준 `cfa7352`. 정상 전체 분석 중 타일별 성공/실패를 metadata에 저장하고, identity/stale/bounds/CAS/legacy·malformed 분리를 구현했다. **전체979 tests와 typegen/typecheck/lint/build/diff·secret 검사 PASS**. failed-only 실행/UI는 TASK-039 이후이며 M2/M3는 미해결이다. SQL/dependency/실제 외부 호출/원격 데이터 변경0, package0.1.1. [56개 항목 보고 및 최종 검사](./TASK-038.md).

## 완료된 TASK-037 기반

TASK-037 — M2/M3 Reproduction Corpus & Contract Freeze 완료. `feat/v0.2-repro-contracts` / `4f33eab`. M2 T1~T8과 M3 C1~C22(allow9/warning7/reject6), test-only validator·기존 helper/service characterization, identity/cache/state/legacy 계약과 case별 gap matrix를 작성했다. 실제 추출 경로는 `detail-extraction`이며 현재 tileId/cache/retry 구현은 없다. M3 미검출 C6/C10/C13/C19를 그대로 기록하고 M2/M3는 미해결 유지한다. **전체933 tests 및 typegen/typecheck/lint/build/diff·secret/bundle 검사 PASS**. 앱·prompt·UI·SQL·dependency·실제 API·원격 데이터 변경0, package0.1.1. [46개 항목·검사 결과](./TASK-037.md), [동결 계약](../V0_2_M2_M3_CONTRACTS.md). 다음 권장은 TASK-038 cache domain/persistence다.

## 완료된 TASK-036 기반

TASK-036 — v0.2.0 Scope Definition & Architecture Planning 완료. `plan/v0.2.0` / `bd856d5`, 로컬 main·origin/main·v0.1.1 tag 기준점 일치. 권장 방향은 **A: Internal Quality — 검토와 재시도의 예측 가능성**이며 M2 실패 타일 복구와 M3 제목/본문 역할 개선을 Must, L1을 Should로 제안한다. 코드 근거 inventory, A/B/C 비교, Auth/소유권/RLS/Storage 공개 차단, SQL0 목표의 bounded cache 계약, TASK-037~045와 회귀/실제 QA 계획을 작성했다. M4/L1 미해결 수·package0.1.1 유지. 앱·SQL·의존성·실제 API·원격 데이터·commit/merge/tag 변경 없음. [38개 항목 보고](./TASK-036.md), [v0.2.0 Roadmap](../V0_2_ROADMAP.md). 후속 기능 구현은 아직 시작하지 않았다.

## 완료된 TASK-035 기반

TASK-035 — v0.1.1 Final AI Validation & Release Preparation 완료. 브랜치 `release/v0.1.1`, 기준 `19735a6`. 실제 67695797 자료에서 Planner1/Section1 첫 결과 accepted, 촬영 설명형/meta/unsupported V-only/title mismatch 0, 원문 스펙6행·옵션6개 보존. M2/L2 실제 UI, crop6종, 새 canonical PNG/JPG860×2744, 전체865 tests와 필수 검사·secret scan 통과. **v0.1.1 Local/Internal MVP RC PASS**. package/lock0.1.1, B0/H0/M4/L1. M3의 제목·본문 정보 반복은 부분 보완으로 유지한다. 원격 데이터 변경·추가 의존성·migration·commit/merge/tag 없음. [48개 항목과 첫 결과](./TASK-035.md), [Release Checklist](../RELEASE_CHECKLIST.md).

## 완료된 TASK-034 기반

TASK-034 — v0.1.1 Internal Polish & Release Backlog Burn-down 완료. 브랜치 `fix/v0.1.1-polish`, 기준 `06d80bb`/v0.1.0. L2 Editor 읽기/쓰기 진행 문구 구분 완료, M2 전체 재분석 비용/보존 안내와 M3 제한된 카피 패턴 검증 보완. M1~M4/L1은 근거와 함께 유지한다. 기존849+신규16=865 tests 및 typegen/typecheck/lint/build/diff 통과, A/B local canonical PNG/JPG860×1933/2744 검증, 실제 AI0·secret0·원격 데이터 변경0. **v0.1.1 Local/Internal MVP RC 추천**, B0/H0/M4/L1. package는0.1.0 유지, commit/merge/tag 없음. [37개 항목과 검증 한계](./TASK-034.md), [Backlog](../RELEASE_BACKLOG.md).

## 완료된 TASK-033 기반

TASK-033 — v0.1.0 Release Freeze & Final Checklist 완료. 브랜치 `release/v0.1.0`, 기준 `ee47cb7`은 main과 동일하다. 앱/의존성/migration 동결, README·CHANGELOG·Release Checklist와 env/ignore 안내 정리. 전체849 tests 및 typegen/typecheck/lint/build/diff 통과. 기존 canonical의 local smoke PNG/JPG860×2744, 이미지3개·옵션6개, 실제 키 노출0. **PASS — DetailForge v0.1.0 Local/Internal MVP Release**. 원격 migration 재조회(CLI 로그인 부재)와 fresh install/DB 검증은 미확인으로 표시했다. M4/L2 유지, 공개 SaaS는 Auth/owner_id/사용자별 RLS·Storage 전까지 차단. commit/merge/tag 미실행. [52개 항목 보고](./TASK-033.md), [Release Checklist](../RELEASE_CHECKLIST.md).

## 완료된 TASK-032 기반

TASK-032 — Release Candidate Polish & Multi-Product QA 완료. 브랜치 `feat/release-candidate-polish`. 상품 저장 후 옵션 source 갱신, 같은 crop의 역할 변경 중복 방지, 이미지 후속 안내를 보완했다. 실제 A67399861 새 Project의 Import부터 PNG/JPG860×1933까지 성공. B는 실제6옵션 저장+기존 canonical 출력860×2744 재현, C는 실제 restricted12후보 자동 적용 차단이며 후속 AI/Export 미실행. 전체849 tests/typegen/typecheck/lint/build/diff 통과, client26파일·3종키 일치0, QA3Project·5Storage 정리 및 기존14행 hash 일치. 관찰 B0/H0/M4/L2, **v0.1.0 local/internal MVP Release Candidate**. 공개 SaaS는 Auth/owner_id/사용자별 RLS·Storage 전까지 차단한다. Commit/merge/tag 없음. [60개 항목 보고와 검증 한계](./TASK-032.md), [후속 과제](../RELEASE_BACKLOG.md).

## 완료된 TASK-031 기반

TASK-031 — Product-Relevance Guard 구현·동일 원본 실제 QA 완료. 브랜치 `feat/extraction-relevance-guard`. context/visualKind/relevance를 기존 타일 요청에 함께 전달하고 서버 추천 정책을 강화했다. 전체846 tests 및 필수 검사 통과. 같은800×23982 원본의 새14타일(14성공), 후보24/기본18, 전자기기 최종 후보·저장 혼입0. 기본18+명시적 수동1 저장 검증 후 QA DB/Storage 정리, 기존14행 해시 일치. TASK-030 H1 재현0, 이번 관찰 기준 B0/H0, M4/L1 이월. 단 cap 이전 전자기기의 실제 kind/score는 보존하지 않아 미확인이다. 해당 필드 판정까지 실검증됐다고 주장하지 않는다. migration/dependency/commit 없음. [46개 항목 보고와 검증 한계](./TASK-031.md).

## 완료된 TASK-030 기반

TASK-030 — Final Commerce Polish 구현·실제 새 상품 E2E QA 완료. 브랜치 `feat/final-commerce-polish`. 해상도 기반 Hero·제목 의미 검사·수동 편집 경고, 전체820 tests와 필수 검사 통과. 실제67695797의 새 Import부터 PNG/JPG860×2744까지 완료. **Release Candidate: NEEDS_WORK (HIGH1: 무관한 추출 후보 기본 선택)**. QA DB/Storage 정리, 기존14행 해시 일치. dependency/migration/commit 없음. [TASK-030](./TASK-030.md).

## 완료된 TASK-029 기반

TASK-029 — Commerce Visual Design System & Final Page Visual Refinement 완료. 브랜치 `feat/commerce-visual-system`. 기존 bounded token·공유 Renderer에 섹션별 hierarchy, intrinsic Hero, adaptive Benefits/Gallery/Spec/Option, 새 style guard와 title relevance warning을 연결했다. 전체790 tests, 필수 검사 및 동일 canonical 자료의 실제 production PNG/JPG860×1941 검증. 실제 외부 API/DB 요청0회, migration/dependency/commit 없음. [TASK-029](./TASK-029.md).

## 완료된 TASK-028 기반

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
