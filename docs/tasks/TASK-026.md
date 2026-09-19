# TASK-026 — Sales Detail Page Quality Refinement

2026-09-19, `feat/sales-page-quality`, 시작 HEAD `119e260`, 시작 작업 트리 clean.
**구현·자동 검사·실제 crop/Renderer/Export 검증 완료. 새 AI 카피의 실제 생성 검증은 미완료.**
OpenAI 요청이 HTTP429 `insufficient_quota / credit_balance_exhausted`로 거절됐다. 최초 실패 뒤 안전한 상태 코드 확인을 위한 수동 진단1회만 수행하고 추가 호출을 중단했다. 새 Planner/Section 성공 결과를 얻었다고 보고하지 않는다.
Git commit/main merge, migration/dependency 추가 없음.

## 요청한 43개 보고 항목

1. Root causes: 기존 4:3 공통 이미지 frame은 intrinsic 크기와 무관하게 사진을 확대했다. 개별 Section grounding만으로 페이지 전체 Fact/메시지 재사용을 평가할 수 없었고, 8–12개 중심 prompt가 부족한 근거에서도 반복 구성을 유도했다. crop margin에 포함된 얇은 경계는 그대로 저장됐다.
2. 생성: `src/features/page-quality/{images.ts,policy.ts,summary.tsx}`, `src/features/detail-extraction/edge-trim.ts`, `tests/page-quality.test.mjs`, 본 문서.
3. 수정: detail-extraction images/policy/schemas/service, visual-assets policy, page-planner evidence/prompts/schemas/service/plan-result, section-engine grounding/prompts/schemas/service/types, detail-editor service/types/editor, detail-renderer model/service/render-image/section-renderer/section-copy/review/CSS, 기존 section-engine style 기대 테스트 및 관련 docs.
4. Migration/dependency 없음. 기존 Sharp/Next/React/OpenAI/Supabase 경계 재사용. DB generated types/RLS/기존 migration/package 파일 변경 없음.
5. Hero upscale: `MAX_RASTER_UPSCALE=1.5`. intrinsic W/H 모두 확대 상한에 사용한다. 목표 폭은 Hero560/Gallery350/Detail640/ImageText·Feature480/UseCase440/default600px, 최대 높이720px. DB content에 raw px를 저장하지 않는다.
6. Resolution suitability: `min(1, width/target, height/target)`로 분리 계산하며 unknown은0. Hero hint는 기존 분석 품질70%+basePriority20%+resolution10%로 조합한다. Fact 또는 AI confidence를 변경하지 않으며 대표성이 부족한 사진을 해상도만으로 강제 선택하지 않는다.
7. Hero layout: 작은 이미지 중앙 배치, 밝은 중립 surface, 큰 상품명과 여백을 유지한다. 330×330 실제 Hero는495×495px. 밀도 compact/normal/spacious의 선택을 유지하고 Hero에 맞는 padding으로 매핑한다. 저해상도라는 이유로 후보에서 제외하지 않는다.
8. Edge trim: 새 crop 저장 전에 전체 변을 가로지르는 uniform white/near-white 또는 transparent band만 검사한다. 최소2px, 각 변 해당 축3% 이내, 색차/분산 제한 및 명확한 내부 전이가 필요하다. 경계가 불규칙하거나 넓거나 어두우면 보존하며 최소 crop 크기도 재확인한다. AI/OCR/배경 제거 없음.
9. Crop QA: 실제7개 중3개에서 하단8/8/16px 제거. 434×443→434×435, 435×443→435×435, 860×894→860×878. 나머지4개 불변. contact sheet에서 손/패드/제품 손실은 관찰되지 않았다. 물방울 crop의 왼쪽 흰 띠와 마지막 사진의 상단 구분선은 모호해 남겼다.
10. Fact presentation roles: label에서 identity, key_spec, technical_spec, administrative를 runtime 계산한다. 모델·상품번호는 administrative, 상품명·브랜드는 identity. Fact 원문이나 DB Fact 구조는 수정하지 않는다.
11. Fact reuse: identity/key_spec는 marketing Section1곳을 기본 예산으로, technical/administrative는 canonical 표 중심으로 안내한다. specification/option/실제 notice는 marketing 사용 횟수에서 제외한다. coverage에 primarySection/사용 Section/횟수를 기록하며 초과는 경고한다. 숫자나 Fact를 삭제·축약하지 않는다.
12. Title quality: purpose/근거별 구체적 한국어 제목을 생성하도록 지시한다. 정확한 Hero 상품명은 기존80자 계약 유지, 새 AI의 그 외 제목40자 상한을 서버 검사한다. generic title 문자열을 삭제하거나 임의 제목으로 바꾸지 않는다.
13. Similarity: NFKC/대소문자/공백·구두점 정규화 후 문자 bigram Dice≥.72를 경고한다. 완전 일치/`상품 정보`와 `상품 정보 확인`을 검출한다. 의미를 이해하는 NLP 판정은 아니다. duplicate title은 경고이며 자동 재호출/변경하지 않는다.
14. Copy density: 새 AI body300자 상한을 저장 전 검사한다. Hero 강조≤2, benefits2–3, feature/detail 항목≤3을 prompt로 지시하고 위반은 밀도 경고로 남긴다. legacy/수동 schema의 더 넓은 기존 길이 계약은 유지한다. 부족한 내용을 채우기 위한 Fact 생성 없음.
15. Semantic roles: Hero 정체성, Benefits 서로 다른 선택 이유, Feature 새 특징, ImageText 한 시각 포인트, Gallery 다양한 구도, UseCase 근거 있는 예시, Detail 세부 외관, Specification 정확한 표, Option 선택값, Notice 실제 안내로 구분한다.
16. Low-value: 근거/사진 없는 detail·gallery·imageText, category-only feature, 실제 notice 근거 없는 notice, 빈 benefits/useCase를 경고한다. Planner prompt는 처음부터 계획하지 않도록 지시한다. 기존 Section을 읽기만으로 삭제하지 않는다.
17. Visual density: visualRatio, maxConsecutiveTextOnly, 상위4개 중 text-only 수를 계산한다. 가용 사진≥3인데 ratio<.4 또는 상위4개 중 text-only≥3이면 경고한다. 뒤쪽 스펙/옵션의 text-only는 정상일 수 있어 자동 삭제하지 않는다.
18. Image reuse: 새 Planner/Section 생성에서 동일 Asset 최대2배치. 정상 Hero+보조1회 허용, useCase nested 실제 표시 횟수도 계산한다. TASK-025 raw long max1, parent+Derived/near-duplicate 제한은 유지한다. Editor 수동 반복은 차단하지 않고 경고한다.
19. Gallery: 기존 parent/hash/overlap 중복 배제 유지. 3장 이상이 같은 effective role이면 다양성 경고. 사진이 없으면 생성하거나 다른 상품 사진을 대체하지 않는다. 서로 다른 좌표의 동일 사진까지 의미적으로 검출하지는 않는다.
20. Renderer rhythm: 고정된 모든 이미지4:3 확대 대신 type별 cap/자연 비율 contain. spec 행 간격·미세한 교대 표면, 옵션 chip/list. 새 Section 생성은 이미지가 있는 imageText/feature/detail에서 split/imageFirst, spacious, 제한적 soft/plain을 결정적으로 선택한다.
21. Bounded style: 기존 density/layout/background/emphasis/imageFit enum만 사용한다. 원래 저장된 style은 변경하지 않고 shared CSS의 매핑을 개선한다. AI raw CSS/hex/px 입력은 계속 금지한다. cover 선택은 별도4:3 composition을 유지하며 확대 cap 안에서 잘라 표시한다.
22. V-only protection: 기존 F 필수 highlight/benefit/bullet 규칙 유지. V-only body에서도 따뜻/편안/흡수/튼튼/실용/착용감/보온 표현을 supported F 없이 거부하도록 보완했다. neutral 외관 설명은 허용한다. 유한한 용어/숫자/근거 검증이 자연어 의미의 완전한 진실성 증명은 아니다.
23. Option/spec: confirmed UUID/name/value/order/version snapshot과 exact F label/value/evidence 유지. 6개 결합 옵션의 chip 출력 순서·문자열 불변 회귀 검사 포함. `아이보리 90` 분리 없음.
24. Validation: Planner service가 coverage/density/gallery/reuse 경고를 계산하고 과도한 reuse는 invalid_response로 거부한다. 새 Plan은 presentationVersion1을 기록하고 fingerprint에 포함한다. Section의 full/개별 AI 생성은 새 version에서 길이 규칙을 검사한다. 전체 생성의 copy 경고는 content.meta.qualityWarnings에 저장한다. 기존 grounded evidence/옵션/spec 검사 뒤 성공 결과만 저장하며 실패 시 이전 결과 보존.
25. Editor: 품질 요약 disclosure와 경고는 비차단이다. 해상도/반복/빈약한 구성 안내를 보면서 기존 제목·본문·이미지·style 편집을 유지한다. 실제 브라우저에서 density 변경→저장 버튼 활성화→원상 복원 확인. 원본 provenance와 dimensions가 미리보기 재조회 시 사라지지 않게 보완했다.
26. Renderer review: 사용/반복 이미지 수, visual ratio, 최대 text-only 길이, 품질 경고를 article 밖에 표시한다. 이미지 교체는 기존 Editor 링크로 이동한다. Export surface에는 review 경고·버튼 없음.
27. 신규38 tests: cap/score/role/coverage/similarity/density/reuse/nested reuse/gallery/low-value/길이/V-only5종/spec/trim false positives/provenance/공유 렌더링/옵션6개/Planner 실패 이전 결과 보존. 기존 tests는 style 매핑 변경 기대값만 갱신했다.
28. 전체720 tests(기존682+신규38) 통과, 실패/skip0. 자동 테스트의 외부 AI 호출0.
29. next typegen, tsc --noEmit, lint, build, git diff --check 통과. production client secret 검사 별도 수행.
30. 실제 QA 상품67399861, 새로운 QA Project 사용. TASK-025 실제 원본 snapshot/Facts/분석/Validation/Options를 재사용하고 분석·Validation inputFingerprint가 완전히 같음을 검증했다. 실제9 Assets(private Source1+normal1+Derived7)를 준비했다. 기존 사용자 프로젝트에는 Page/Section을 쓰지 않았다.
31. BEFORE/AFTER Hero: 동일330×330 원본. 이전4:3 frame748×561px에서 contain으로 실제 사진561×561(약1.70배), 이후495×495(1.5배). 비교는 TASK-025 canonical copy/style7개를 그대로 새 QA 페이지에 재현한 Renderer 비교다. 새 AI 카피 생성 결과가 아니다.
32. First visual offset:465.53125→441.53125px. Editor zoom 전 CSS 폭 약495px로 Final과 일치. 모든 실제 이미지 로드 성공/overflow0.
33. 실제 비교 제목은 유지: 상품명 / 상품명 표기 기준 구성 / 강아지 배변용품 · 배변패드 / 펼친 패드 외관 / 추가 이미지 / 상품 정보 / 옵션 안내. 새 prompt로 개선된 제목 목록은 quota 복구 후 검증해야 한다.
34. Exact duplicate title/copy0이지만 의미상60×60cm·40매 반복은 그대로 남는다. F1은 Hero/Benefits의 marketing2곳에서 사용돼 예산1 초과를 경고한다. exact-string 검사만으로 의미 반복이 해결됐다고 주장하지 않는다.
35. 사용 이미지3개(정상 Hero1+Derived2), 원본 long0, Gallery0/Detail1/ImageText1. 새 AI 선택에 따른 변화는 미검증.
36. 중복 Asset0, 최대재사용1. canonical asset IDs/순서 불변.
37. BEFORE PNG/JPG860×3875. AFTER 둘 다860×3919, PNG647,088bytes/JPG282,000bytes. 높이+44px는 detail 원비율 표시와 간격 변화 결과다. 첫~마지막 Section, 이미지3개, 옵션, 스펙 유지. 글자 잘림/경고/Editor UI/PNG-JPG 레이아웃 차이 없음.
38. 품질 판정: Hero PASS(확대 제한/중앙 구성), 제품 사진 활용 PASS(원본 long0/Derived2), 제목 다양성 NEEDS_WORK(새 AI 미검증), 카피 중복 NEEDS_WORK(기존 의미 반복), 정보 밀도 NEEDS_WORK(category-only feature), visual rhythm NEEDS_WORK(새 생성 style 실제 미검증), specification PASS, options PASS, 이미지 선명도 NEEDS_WORK(확대 제한은 개선했지만330px 자체 한계), 전체 길이 NEEDS_WORK(중복 내용 정리 전), 사실 안정성 PASS(원본 불변/grounding 유지).
39. 보호: 신규 QA Product/Facts/source_snapshot/Validation/Product Analysis/Options row hash가 전후 일치하며 QA 원본 bytes SHA-256도 일치한다. 기존 사용자7개 테이블 baseline 모든 row hash 일치. 새 Page/Section/trim bytes는 QA 프로젝트만 대상이다.
40. Secret: 실제 환경 키3종을 production client JS/map, src/docs/tests, artifact 텍스트에서 검사해 일치0. provider URL/키/원본 오류 객체 미출력. 진단은 HTTP 상태·오류 type/code/param만 기록했다. SSRF/DNS/redirect/10MiB/timeout/최대 Asset/소속·private path·CAS 정책 유지.
41. Cleanup: QA Project/Product/Facts/Options/Assets/Derived/Sections와 private Storage 정리 완료. 기존7개 테이블 baseline 완전 일치와 QA Storage prefix 잔여0을 확인했다. 로컬 출력/정제 증거만 저장소 밖에 남겼다.
42. 남은 문제: 실제 생성 prompt 효과 미확인, 의미 반복과 category-only Section, 원본330px 선명도, 모호한 흰 띠/구분선. 픽셀만으로 균일한 흰 제품 면과 흰 여백을 완벽하게 구분할 수 없으며 trim은 최대3%/명확한 전이로 위험을 줄이는 보수적 휴리스틱이다. 게시 전 사람 검토는 계속 필요하다.
43. 다음 작업: API 크레딧 복구 후 동일 상품으로 Planner1회→Section1회만 명시적으로 실행해 새 제목/coverage/5–12개 실제 구성/문구 품질을 검증한다. 그 결과를 보고 다음 판매용 layout/copy refinement 범위를 정한다. 검증 전 TASK-026 전체 완료 또는 판매 품질 전항목 PASS로 표시하지 않는다.

## 동작 경계와 재현

- 기존 Derived를 조회만으로 trim/덮어쓰기하지 않는다. `sourceRect`는 원본 crop provenance 그대로, 선택적 `trim={policyVersion:1,insets,postTrimDimensions}`만 추가한다. Asset width/height는 실제 출력 크기다. 새 크기와 insets가 맞지 않으면 inventory에서 제외한다.
- 동일 candidate의 재저장은 기존 row를 반환하는 TASK-024 idempotency를 유지한다. 기존 사진에 새 trim을 적용하려면 사람이 기존 Derived 삭제 여부를 판단한 뒤 다시 저장해야 한다. 이 TASK에서 일괄 재가공하지 않는다.
- 실제 QA seed는 동일 source bytes에 새 `cropImage` helper를 적용해 새 QA private 경로에 저장했다. 새 전체 추출/승인 UI와 provider를 다시 실행한 것은 아니다. 기존 저장 flow의 trim/metadata 연결은 mock service 및 실제 helper/file/Storage QA로 구분 검증했다.
- presentationVersion이 없는 legacy Plan/Section 읽기는 계속 허용한다. 새 정책 fingerprint로 stale가 될 수 있으나 자동 재계획/Section 삭제/문구 교체는 없다. intrinsic cap과 shared CSS는 기존 페이지의 표시에도 적용된다.
- 이번 replay에서는 이전 option snapshot의 원래 product/row ID도 그대로 보존했기 때문에 새 QA Options row와 freshness 경고가 발생한다. 출력되는 값/UUID/순서는 과거 실제 snapshot과 같다. 이를 옵션 기능 회귀 또는 새 옵션 저장 성공으로 보고하지 않는다.
- 명확한 위험/계약 위반은 거부하고, 휴리스틱 품질 문제는 bounded warning으로 보관/계산한다. 경고가 있어도 사용자 수동 편집과 canonical Export는 허용한다. 자동 AI retry 없음.

로컬 artifacts: `C:\Users\alswn\Documents\Codex\2026-09-09\c-projects-detailforge\artifacts\TASK-026`
`after.png`, `after.jpg`, `trim-contact-sheet.png`, `trim-results.json`, `evidence.json`, `render-metrics.json`, `export-metrics.json`, `provider-status.json`, `tests-final.txt`, `build-final.txt`, `secret-check.json`, `cleanup.json`.

이번 범위에는 이미지 생성/upscale AI, 배경 제거/OCR, Fact 생성, 옵션 이미지 매핑, 가격·재고·SKU, 새 테마 UI, Auth/Marketplace/자동 게시가 없다.
