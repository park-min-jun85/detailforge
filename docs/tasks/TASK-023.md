# TASK-023 — 실제 도매상품 End-to-End MVP QA

## 판정과 실행 환경

2026-09-18, `feat/e2e-mvp-qa`, 시작 HEAD `6aa201a`, 시작 작업트리 clean.
상품: https://domeme.domeggook.com/s/67695797

**최소 blocker 수정 후 기능 E2E는 완료. 판매용 시각 품질은 미달.** 큰 디자인·추출·AI 정책 수정은 하지 않았다. Git commit/main merge, dependency, migration 변경 없음.
Windows / Node 24 / Next 16.3.4, 실행 중인 localhost:3000 개발 서버와 실제 브라우저에서 진행했다. Export는 기존 서버 Chromium을 사용했다.

QA Project: `f31aa345-f691-4735-8739-aadccf78bd27` (TASK-023 QA · 도매매 67695797 · 2026-09-18).
Product: `31a97a1f-f8ed-4959-a95f-78ec391ff478`, DetailPage: `eea20b28-8a45-4afa-94c4-90f01aac9354`. 검증 후 정리했다.

## 단계별 결과

1. 새 QA Project 생성 성공. 기존 프로젝트와 분리했다.
2. URL 입력 → 상품정보 Preview 성공. 가격 제한 안내가 있으며 상품 본문 Import는 허용됐다.
3. 상품명/분류/스펙 확인 후 명시적 저장 성공. 원본 7개 스펙 중 placeholder 2개는 Facts에서 제외됐다.
4. 이미지 후보 3개 중 대표·상세 2개 선택 저장 성공. 배송 홍보 배너는 선택하지 않았다.
5. 공식 API 옵션 조회는 상품 저장 직후 버튼이 비활성인 문제를 발견했다. 최신 옵션 불러오기로도 URL이 갱신되지 않아 페이지 새로고침 후 진행했다.
6. 공식 옵션 후보 1그룹·6개 조회 성공. 입력란 반영 후 별도 옵션 저장 성공.
7. 이미지 AI 분석 2/2 성공.
8. 상품 AI 분석 성공.
9. Fact Validation 성공: supported 7, insufficient/conflict/needs_review 각 0.
10. Planner 최초 실행 invalid_response 실패. 아래 B-01을 최소 수정하고 1회 재실행해 성공.
11. Section 생성 1회 성공, 7개 저장.
12. Editor 문구·이미지·옵션 확인 성공. 옵션 속성에서 “저장된 옵션과 현재 상품 옵션이 일치합니다.” 확인. 최신 옵션 재반영은 불필요하여 실행하지 않았다.
13. Final Renderer 7개 Section, 누락 이미지 0, 폭 860px 확인. F5 후 값 유지.
14. PNG/JPG 각각 실제 브라우저 버튼 실행, 다운로드 시작 메시지 확인. 브라우저 도구가 다운로드 이벤트/파일 경로를 제공하지 않아 OS 다운로드 저장 위치까지 검증하지는 못했다.
15. 동일 서버 Export API를 형식별 1회 추가 호출해 검증 파일을 확보하고 실제 파일을 열어 검사했다. 대체 렌더러나 별도 HTML을 만들지 않았다.

외부 유료/공식 호출: 도매 옵션 API 1회, OpenAI 총 7회(이미지 2, 상품 1, Validation 1, Planner 실패 1+수정 후 성공 1, Section 1). 자동 재시도·대량 조회 없음. 자동 테스트는 mock만 사용했다.

## 실제 상품과 옵션

- 상품명: 여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼
- 카테고리: 의류/언더웨어 > 여성의류 > 조끼
- 상품번호: 67695797
- 원산지: 수입산 / 아시아 / 중국
- 제조국 또는 원산지: 중국
- 제조사: 디에이치트레이딩
- 품명 및 모델명: 컬리 집업 베스트
- 제외된 placeholder: 모델명 `별도표기`, 상품포장 부피/무게 `X / X`
- 실제 소재·혼용률·치수는 텍스트 Facts로 확보되지 않았다. 이미지/OCR/상품명으로 보충하지 않았다. 원문 설명과 source_snapshot의 placeholder 보존은 기존 정책이다.

공식 API → confirmed Options → Section → Editor → Renderer 순서로 `옵션` 1그룹의 다음 6개가 동일하게 유지됐다.

1. 아이보리 90
2. 아이보리 95
3. 코코아 90
4. 코코아 95
5. 브라운 90
6. 브라운 95

색상/사이즈로 분리하지 않았다. UUID·배열 순서가 서버 확정 snapshot에 보존됐고 실시간 재고·미래 판매 가능성을 보장하지 않는다.

## 이미지와 AI 검토

대표 JPEG 330×330px / 30,610 bytes, 상세 `s.jpg` JPEG 800×23,982px / 2,414,166 bytes. 둘 다 기존 10MiB 이내이며 private Storage 저장·재조회·표시 성공. 처음에는 unclassified, AI 이후 대표 usage / 상세 specification.

대표 분석: confidence 0.98, heroSuitability 0.84, visibility 0.91, clarity 0.96, cropped 경고. 착용 사진이라는 분류는 화면과 부합한다. 단 인물 일부 잘림과 상품 자체 잘림을 구분하지 않는 경고가 Hero 제외로 이어졌다.
상세 분석: confidence 0.99, heroSuitability 0.22, heavy_text 경고. 여러 착용컷·단독컷·클로즈업·색상 배열·치수표가 있는 긴 상세 구성이라는 관찰은 합리적이다. 개별 소재/치수를 Fact로 전사하지 않았다.

상품 분석은 착용 실루엣·디테일 확인 흐름을 제안했다. 고객군/실내 착용/레이어드는 가설로 구분했고, 상품명의 ‘양털’을 실제 소재로 단정하지 않았다. 보온성·착용감·성능을 확정하지 않도록 명시했다.
Validation은 7개 모두 S1 source_snapshot의 동일 값을 비교하여 supported/0.99로 판정했다. 이는 원본 내부 일관성이며 독립 증명이나 소재 인증이 아니다. placeholder는 검증 대상에 포함되지 않았다. 이번 사례에서는 근거 없는 별도 Fact를 supported로 만드는 현상을 발견하지 못했다. 잘못된 원본 자체를 탐지하는 능력까지 입증한 테스트는 아니다.

## Plan / 실제 Section과 시각 평가

Plan은 근거 부족 경고와 Hero 없음 경고를 포함한 7개 구성이다. 기능·장점/useCase를 억지로 추가하지 않았다.

1. hero — **컬리 집업 베스트** / 원본 상품명 부제. 텍스트만 존재. 높이 약317px.
2. detail — **카테고리** / 분류 한 줄. 높이 약232px. 뒤 스펙 표에도 같은 정보가 반복된다.
3. gallery — **착용 이미지** / “착용 연출 이미지에서 제품의 외관을 참고해 보세요.” 대표 이미지 1개. 첫 상품 이미지가 출력 상단에서 약757px 이후에 나온다. 단일 이미지인데 2열 grid로 오른쪽이 비어 있다.
4. detail — **상세 이미지 참고** / “상세 구성 이미지를 통해 제품 및 안내 구성을 참고해 보세요.” 긴 이미지가 764×573px frame의 contain으로 표시된다. 실제 사진 내용 폭은 약19px에 불과해 사실상 판독 불가.
5. specification — **기본 상품 정보** / 카테고리·원산지·제조사·품명/모델명·제조국·상품번호 6행. 원본 Fact와 정확히 일치, 표 가독성 양호.
6. option — **옵션 안내** / 그룹명 옵션 / 정확한 6개 bullet. 총 약646px, 값 누락·임의 조합 없음. 제목/그룹명의 ‘옵션’ 반복과 여백은 다듬을 여지가 있다.
7. notice — **구매 전 확인** / “상세 이미지의 안내 구성은 참고용이므로, 구매 전 최신 제공 정보를 확인해 주세요.” 동일 긴 이미지가 780×585px frame으로 재등장한다.

Section 제목은 서로 동일하지 않으나 3/4/7의 ‘이미지 참고/확인’ 역할이 반복된다. 카테고리 단독 Section과 두 개의 큰 회색 이미지 frame 때문에 판매 페이지보다 정보 관리 문서처럼 보인다. 모든 Section에 내용은 있지만 2번과 7번은 추가 정보량이 적다.
근거 없는 성능·효과·최고·보장 표현은 발견하지 못했다. 생성된 useCase Section은 없다. 이미지 소재로부터 새 사실을 발명하지 않은 점은 통과다.

## Export 결과

- PNG: **860×4011px, 247,847 bytes**.
- JPG 품질90: **860×4011px, 174,972 bytes**.
- 두 파일을 실제 열어 확인: 첫 Hero부터 마지막 안내까지 모두 존재, 옵션 6개 존재, 대표 1회+상세 2회 표시, 이미지 네트워크 누락 없음.
- Editor 버튼/선택 테두리/Review warning 없음. 출력 article 내 interactive controls 0. 텍스트 요소 가로 overflow 0, 글자 잘림 미발견. 이 상품의 한글/원본명/스펙 범위에서 확인한 결과다.
- PNG/JPG 배치 동일. RGB 채널 평균 절대 차이 약0.559/255로 압축 차이가 있으나 레이아웃 차이는 관찰되지 않았다.
- contain으로 원본 전체 픽셀은 포함되지만 긴 이미지의 글자와 사진은 읽을 수 없다. 따라서 ‘이미지 로드 성공’과 ‘판매용 가독성 통과’를 구분한다. cover 전환은 대부분을 잘라내므로 해결책으로 적용하지 않았다.
- 원본 비율로 긴 이미지를 그대로 늘리면 현재 Export 높이16000 제한과 충돌할 수 있다. 후속 설계에서 분할/크롭 검토가 필요하며 이번에 제한을 늘리지 않았다.

산출물은 로컬 `C:/Users/alswn/Documents/Codex/2026-09-09/c-projects-detailforge/artifacts/TASK-023/`에 보존했다: `detail-67695797.png`, `detail-67695797.jpg`, 정제된 `evidence.json`, `export-metrics.json`, 테스트/build 결과, 불변성 및 cleanup 결과. API 응답 전체·키·signed URL·판매자 연락처는 보존하지 않았다.

## 문제 목록과 수정 대상

### B-01 BLOCKER — 확정 옵션이 있는 실제 Planner 응답 거부 (수정 완료)

- 재현: 확정 옵션 1그룹을 저장하고 Planner 실행 → invalid_response, Plan 저장 없음.
- 원인: provider가 validatePagePlan에 confirmedOptions를 전달하지 않아, evidenceIds가 비어 있어야 하는 option Section을 기존 Fact 필수 계약으로 검사했다. 최초 원본 AI 응답은 보존되지 않으므로 그 응답의 상세 실패 경로는 별도 확인할 수 없다. 동일 계약 위반은 mock transport에서 결정적으로 재현했다.
- 대상: `src/features/page-planner/provider.ts` 인자 1개 추가. 실패 후 기존 결과 보존 정책 유지.
- 데이터 손상: 잘못된 Plan 저장은 차단됨. 실행 실패/불필요 비용/진행 중단 위험.
- 테스트: 수정 전 신규 test 실패, 수정 후 성공. 올바른 option 허용, option 누락/Fact 혼합 거부 확인. 기존 TASK-022 서비스 mock은 실제 provider 경계를 통과하지 않아 이 누락을 놓쳤다.

### H-01 HIGH — 긴 상세 이미지가 약19px 폭으로 축소되고 반복 출력됨

- 재현: Renderer/Export 4번과7번 Section, 각각 상단 약1302px/3390px부터 회색 frame 안에 가느다란 이미지.
- 원인: 공통 4:3 frame + contain; Planner는 상세 시각 근거를 notice에도 연결해 같은 asset을 재사용한다. 두 frame 높이 합1158px, 전체 출력의 약29%.
- 대상: `detail-renderer/render-image.tsx`, `renderer.module.css`, Planner 이미지 재사용 정책, Import/Assets 긴 이미지 Preview. 크롭/분할은 원본 정체성 및 Export 상한을 함께 검토해야 한다.
- 데이터 손상: 원본 bytes/Fact 변경 없음. 최종 구매자가 정보 내용을 읽지 못하는 출력 손실.
- 테스트 영향: 긴 이미지 실제 비율/최소 가독 폭/중복 배치/Export 상한 회귀 필요. 현재 이미지 로드·signature·DOM 폭 테스트만으로는 잡히지 않는다.

### H-02 HIGH — Hero 이미지 부재와 약757px 뒤에 나오는 작은 대표 이미지

- 재현: Hero 후보0, 텍스트 Hero+분류를 지난 3번 gallery에 330px 원본이 표시됨. 단일 이미지지만 2열 grid의 반쪽만 사용.
- 원인: cropped 경고 일괄 Hero 제외, 인물/제품 잘림 구분 없음. gallery 기본 2열 적용.
- 대상: `asset-analysis` 경고 의미, `page-planner/schemas.ts` isHeroCandidate와 선택/검토 UX, `detail-renderer/renderer.module.css` 단일 이미지 배치.
- 데이터 손상: 없음. 첫 화면 상품 전달력 저하. 경고를 무조건 무시하는 자동 완화는 제안하지 않는다.
- 테스트 영향: 실제 상품 가시성 높은 인물 일부 잘림/제품 잘림 구분 fixture와 수동 확인 흐름, 단일/복수 gallery 시각 검사 필요.

### M-01 MEDIUM — Import 저장 후 옵션 API의 원본 URL이 갱신되지 않음

- 재현: 상품 저장 성공 → 옵션 영역 URL ‘없음’, API disabled → 최신 옵션 불러오기 후에도 disabled → 전체 F5로 복구.
- 원인: ProductForm의 Import 저장은 로컬 상태만 갱신. OptionsManager sourceUrl은 상위 서버 prop에 남는다.
- 대상: `products/components/product-form.tsx`, project page, `product-options/components/options-manager.tsx` 저장 완료 상태 전달/refresh.
- 데이터 손상: 없음. 불필요한 새로고침과 중복 입력/저장 시도 유발 가능.
- 테스트 영향: 빈 새 Project에서 Import 저장 직후 API 버튼 활성화까지 browser 회귀 필요. 기존 저장된 Product fixture만으로는 놓칠 수 있다.

### M-02 MEDIUM — 배송 홍보 배너가 상품 이미지 후보에 포함

- 재현: Import 이미지 후보3개 중 두 번째는 ‘3월1일’ 배송 안내 배너. 사용자가 제외해야 한다.
- 원인 추정: Generic image 후보의 상품영역/이미지 문맥 필터가 배송 홍보 이미지까지 포함한다.
- 대상: `wholesale-import` Generic Adapter/image candidate extraction와 Preview.
- 데이터 손상: 이번에는 미선택이므로 없음. 선택하면 관계없는 Asset/출력 가능.
- 테스트 영향: 공개 페이지 배너/대표/긴 상세 이미지 fixture로 필터 false positive/false negative 동시 검증. SSRF/DNS/크기 정책 유지.

### M-03 MEDIUM — 낮은 정보 밀도와 중복 안내 문구

- 재현: 2번 카테고리 한 줄232px, 5번 표에 동일 카테고리 재등장. 3/4/7번이 ‘이미지 참고/확인’ 위주로 반복된다.
- 원인 추정: 제한된 Fact에도 최소 Section 수 및 독립 타입별 기본 여백을 적용한다. 안전한 문구가 판매자용 검토 지침처럼 남는다.
- 대상: `page-planner/prompts.ts`, `section-engine/prompts.ts`, renderer 타입별 정보 밀도.
- 데이터 손상: 없음. 불필요 길이와 관리 문서 같은 인상.
- 테스트 영향: 근거가 적은 상품에서 반복 없이 적정 Section 수/정보를 배치하는 평가 필요. Fact 부족을 새 효능 문구로 메우지 않아야 한다.

### L-01 LOW — 불투명한 이미지 파일명이 선택/대체텍스트로 노출

- 재현: Editor 이미지 선택과 AX label에 긴 CDN 파일명, `s.jpg` 표시.
- 원인: originalFilename을 표시명/alt에 직접 재사용.
- 대상: Asset/Image selector와 `detail-renderer/render-image.tsx`의 사용자용 설명 구분.
- 데이터 손상: 없음. 이미지 선택과 스크린리더 이해가 어려움.
- 테스트 영향: 원본 파일명 보존과 접근 가능한 의미 있는 표시명의 분리 검증 필요.

### L-02 LOW — 이미지 화면의 다음 기능 안내가 오래됨

- 재현: Images 화면에 ‘상세페이지 구성은 이후 단계에서 제공됩니다.’ 표시, 실제 기능은 이미 제공됨.
- 원인: 과거 단계 placeholder 문구 잔존.
- 대상: Images page 안내 문구.
- 데이터 손상: 없음. 다음 단계 존재를 오해할 수 있음.
- 테스트 영향: 문구/링크의 수동 확인이면 충분. 구현을 복제하는 테스트는 불필요.

## 검증과 보호

변경 전585/585, 변경 후586/586 mock tests 통과. Planner suite34/34 통과.
`npx.cmd next typegen`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `git diff --check` 통과.
SSRF/DNS/redirect/timeout/10MiB/max asset count/strict schema/근거 ID 검증/CAS를 완화하지 않았다. schema 또는 DB 타입 변경 없음.
기존 프로젝트 및 관련 Products/Facts/Options/Assets/Pages/Sections를 시작 해시와 대조해 일치 확인. QA Facts/source_snapshot도 Validation 직후와 Export 후 해시 일치. Validation 이전은 화면 값과 최종 Facts를 대조했으며 해당 구간의 원본 snapshot byte hash는 별도 확보하지 않았다.
QA Project와 하위 7개 테이블 scope 잔여0건, Storage prefix 잔여0건 확인. 정제 evidence/PNG/JPG만 로컬에 보존했다. 기존 사용자의 프로젝트는 변경하지 않았다.
정리 후에도 기존 데이터 해시가 일치했다. 변경 파일과 QA 텍스트 산출물을 실제 환경변수의 비밀값과 대조했으며 일치0건이었다(값 자체는 출력하지 않음).

## 다음 수정 TASK 제안

1. TASK-024 후보: 긴 상세 이미지와 첫 화면 상품 이미지 배치 개선. H-01/H-02를 우선하고, 최대 출력 높이를 임의 확대하지 않는 처리 정책을 먼저 결정한다.
2. TASK-025 후보: Import 저장 직후 옵션 연속 흐름 및 이미지 후보 정제. M-01/M-02와 긴 이미지 확인 UX 회귀를 묶는다.
3. TASK-026 후보: 제한된 근거에서 반복을 줄이는 Planner/Section 품질 평가. M-03을 실제 상품 사례로 평가하고 L-01/L-02를 함께 정리한다.

위 후속 범위는 제안이며 이번 QA에서는 구현하지 않았다.
