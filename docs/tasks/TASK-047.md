# TASK-047 — Conservative Colored-frame Detection & Content-loss Guard

2026-09-22 완료. Branch `feat/conservative-frame-trim`, 기준 HEAD `f693151`, 시작 clean. 승인된 안전 우선 계약 기준 구현·synthetic 검증 완료. **M1/M4 implementation complete / real QA pending, MEDIUM2/LOW0 유지**. package0.2.0, commit/main merge/tag 없음.

## 승인된 완료 조건

TASK-046의 M1-A/H, M4-A/H는 같은 pixels/config로 반대 결정을 요구할 수 없다. 사용자가 안전 우선 계약 조정을 승인했다. **same pixels + same config => same decision**, 해당 쌍은 모두 ambiguous/preserve. 원래 의미 정답·knownContentBounds와 과거 관측은 유지하고 production에서는 사용하지 않는다.

- 기존22종에서 추가 content-loss0, 특히 M1-H의9,728px 손실→0.
- 신호 없는 단색 opaque 띠는 보존. 기존 white/gray 사례의 제거 기대도 이 정책에 맞게 조정하고 원본 입력은 유지.
- 실제 separator/interior 구분 신호를 추가한 A2 계열 white/gray/colored/noisy/asymmetric 입력에서 안전 trim 검증. 투명 trim 유지.
- edge별 risk→confidence→bounded trim, 최대3%·최소160×160/64000px, retained pixels/MIME/dimensions/provenance와 legacy 보존.
- 기존 Derived 자동 변경0, 새 crop에만 적용. AI/원격 DB·Storage/UI/Renderer/migration/dependency0.
- 전체 회귀/typegen/typecheck/lint/build/diff/secret scan. 실제 여러 상품 QA 전까지 M1/M4 RESOLVED 처리 금지.

## 구현과 판정 범위

`frame-analysis.ts`의 순수 RGBA helper가 edge별 위험/신뢰도/reason을 반환하고 `edge-trim.ts`가 inset만 실제 crop으로 전달한다. 밝은 opaque band의 낮은 variance만으로는 부족하며, 연속1~3px separator와 그 양쪽 대비·내부 texture를 요구한다. separator를 포함한 retained rectangle은 유지한다. 한 픽셀 outlier/alpha detail도 제거 띠 전체 검사에서 제외하지 않는다. 반대편 색이나 fixture 이름에 따른 예외는 없다. [정확한 신호·threshold·matrix](../V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md).

기존22종은 M1-C만16px trim, 나머지는 preserve. M1-A/H·M4-A/H 모두 ambiguous이며 content-loss0. 이는 원래 단색 opaque 프레임의 자동 제거 감소를 의도적으로 수용한 결과다. 새 A2 8종은 실제 separator를 추가했고 원본 A/H를 덮어쓰지 않는다. M1-A2/B2/D2와 M4-C2는16px, M4-A2/B2는12px씩4변, M4-D2는좌우12px, E2는상단12px를 제거한다. 다른 단일 변은 회전 fixture로 검증했다.

모든 실제 이미지를 무손실로 분류한다는 보장은 아니다. separator가 제품 구조와 우연히 같은 모습을 만들 수도 있다. 이번 `safe`는 bounded signal 조건 통과이며 semantic truth나 확률이 아니다. 실제 사진·JPEG quality 다양성·그림자/미세 텍스트 일반화는 다음 QA에서 확인한다. 인물/제품의 원래 잘림을 인식하는 모델을 구현하지 않았다.

## 완료 보고 — 67항목

1. **TASK 목적:** 보존 우선 edge risk/confidence와 보수적 white/colored trim을 새 Derived 저장 경로에 적용.
2. **branch:** `feat/conservative-frame-trim`, HEAD `f693151` 유지.
3. **M1 시작 gap:** H의 흰 제품 edge9,728px 손실. A와 bytes 동일.
4. **M4 시작 gap:** A~E 유색 frame 잔존. A/H 동일 bytes 때문에 자동 제거 목표를 수정.
5. **detector architecture:** 순수 `analyzeCropEdge/analyzeCropEdges` → `detectTrim` → 기존 `trimCrop/cropImage`. Sharp decode1회, raw 공유, diagnostics 비저장.
6. **content-loss guard:** 전체 후보 띠의 local range/variance/adjacent delta/alpha 검사. 단색에서 바로 texture로 바뀌는 입력은 ambiguous. 의미 label/mask/ID 입력0.
7. **frame confidence:** 연속 separator와 양쪽 대비·내부 texture·명도 extrema를 모두 만족하면1. 부분 근거 .25/.5에서는0px. confidence는 확률이 아님.
8. **color distance:** 단순 RGB Euclidean, 명도 .2126R+.7152G+.0722B. 새 색공간 dependency0.
9. **noise tolerance:** band 채널 range≤12/variance≤6/adjacent≤12/첫 줄 RGB 거리≤6. M1-D2 ±1 noise, M4-C2 실제JPEG95/4:4:4 PASS.
10. **interior comparison:** 보존되는1~3px separator와 안쪽4줄의 contrast/texture 비교. 제거할 띠는 모든 픽셀, retained 통계만 모서리 교차 제외.
11. **asymmetric edge support:** D2좌우/E2상단 및90/180/270°회전 각각 독립 trim. 4변 일치 조건 없음.
12. **background ambiguity:** 단색 벽의 명확한 separator 부재로 keep. uniformity 단독 승인 없음.
13. **white-product safety:** A/H 동일 decision=ambiguous/preserve. H content-loss0. 실제 구분 신호가 있는 A2에서만 흰색 제거 검증.
14. **dark-product safety:** 밝기180 미만 opaque edge keep. separator가 있어도 dark edge 보존 회귀.
15. **human/text safety:** J/I와 M4-I 보존. 단일 dark/skin-colored pixel, 좁은 text stroke, alpha1/254 pocket도 해당 변 trim 차단. OCR/인체 인식0.
16. **gradient policy:** 일정 폭/색/분리 신호 불충분하면 보존. 각 줄이 균일해도 줄 사이 gradient는 keep.
17. **trim cap:** 각 변 floor(해당 축×.03),2px 미만 keep. 640px에서19px 허용/20px 보존. cap까지 억지 부분 제거 없음.
18. **per-edge decision:** trimPixels/frameConfidence/contentRisk/reason. 위험 변0이어도 독립적인 다른 변은 양성 조건에서 제거 가능.
19. **deterministic behavior:** 같은 RGBA·크기·고정 정책이면 같은 전체 decision. 원래 A/H 쌍과 buffer 복제·반복 실행 회귀 PASS.
20. **provenance:** parent/hash/candidate/sourceRect/role/insets/postTrimDimensions 유지. 새 적용 결과 trim.policyVersion2, 진단 필드 저장 없음.
21. **legacy behavior:** trim 없음/v1/v2 모두 inventory 읽기·원문 불변 PASS. 기존 Derived 자동 재-crop0, 같은 sourceRect 재저장 중복 정책 유지.
22. **M1-A:** ambiguous/preserve, 손실0. A2는16px safe trim.
23. **M1-B:** 구분 신호 없어 preserve, 손실0. B2는16px trim.
24. **M1-C:** 투명16px씩4변 trim, 손실0.
25. **M1-D:** 구분 신호 없어 preserve, 손실0. D2는noise 유지하며16px trim.
26. **M1-E:** preserve, 왼쪽 제품 손실0.
27. **M1-F:** preserve, 위쪽 제품 손실0.
28. **M1-G:** dark edge preserve, 손실0.
29. **M1-H:** ambiguous/preserve, **9,728→0px 손실**, A와 decision 동일.
30. **M1-I:** 라벨 보존, 손실0.
31. **M1-J:** 손/얼굴/몸 합성 의미 영역 보존, 손실0.
32. **M1-K:** 내부 세로 separator 유지, 손실0.
33. **M1-L:** 내부 가로 panel 경계 유지, 손실0.
34. **M4-A:** ambiguous/preserve, 손실0. A2는12px4변 제거.
35. **M4-B:** preserve, 손실0. B2는12px4변 제거.
36. **M4-C:** preserve, 손실0. C2는실제JPEG noise에서16px4변 제거. C의 원래12px fixture 불변.
37. **M4-D:** preserve, 손실0. D2는좌우12px 제거.
38. **M4-E:** preserve, 손실0. E2는상단12px 제거.
39. **M4-F:** 유사색 ambiguous/preserve, 손실0.
40. **M4-G:** 배경벽 preserve, 손실0.
41. **M4-H:** ambiguous/preserve, A와 동일 decision, 손실0.
42. **M4-I:** frame 속 text/icon preserve, 손실0.
43. **M4-J:** gradient/shadow preserve, 손실0.
44. **unsafe content-loss count:** 원래22종+A2 8종=30종에서 **0**. 합성 oracle 범위이며 실제 상품 오류율 아님.
45. **false-positive trim count:** 원래 ambiguous/content-like 및 M4 F~J에서 **0**, high-confidence A2의 contrast/alpha pocket 변도 차단.
46. **existing crop fixture:** TASK-034의6개 원본 입력 그대로 PASS. 승인된 계약에 따라 opaque4개 제거 기대를 보존으로 변경, 내부panel/clean 기대 그대로. 예전 trim 성능 불변이라는 뜻은 아님.
47. **pixel identity:** PNG surviving pixel exact, source bytes/hash/rect 불변. JPEG는 기존95/4:4:4 encode 결과와 비교; lossy 재인코딩을 원본 raw exact라고 주장하지 않음. source offset/실제decoded dimensions/trim metadata PASS.
48. **performance observation:** Node24.18.1/Windows, warmup1+3회, decode/fixture 생성 제외. 860×1600(16px)3.02~5.30ms,1600×2400(32px)4.06~4.35ms,2400×4000(48px)8.86~10.38ms. raw5.5/15.36/38.4MB 재사용, 추가 full-image buffer/edge별 decode0. SLA/정밀 benchmark 아님.
49. **생성 파일:** `frame-analysis.ts`, `tests/conservative-frame-trim.test.mjs`, `tests/fixtures/v0.2.1/separated-frames.mjs`, 이 보고서. 총4개.
50. **수정 파일:** extraction의edge-trim/images/policy/schemas4개, 기존test/helper4개, contracts/backlog/tasks README3개. 총11개.
51. **migration:** 0. schema 변경은 TypeScript trim version union이며 DB migration 아님.
52. **dependency:** 0, package/lock 내용 불변.
53. **external AI calls:** OpenAI0/Domeggook0. 모든 테스트 provider는 mock.
54. **remote mutation:** 원격 DB/Storage 읽기·쓰기0. Product/Facts/Options 변경0.
55. **tests:** 신규36개 및 기존 계약61개/기존6종/관련crop·service 회귀 PASS. cap/최소크기/잘못된dimensions/alpha/outlier/rotate/determinism/legacy 포함.
56. **total test count:** **1253 PASS = 기존1217 + 신규36**, fail0/skip0/todo0. 전체 glob 실행.
57. **typegen:** PASS.
58. **typecheck:** PASS.
59. **lint:** PASS.
60. **build:** PASS, Next16.3.4 production build.
61. **diff check:** PASS, 신규 untracked 파일 whitespace도 별도 검사.
62. **secret scan:** 450파일에서 실제 설정3종 key exact match 및 credential/signed-token 패턴 검사, source/docs/tests/new files/client bundle/TASK-047 text/log에서 findings0. 키 값 출력0. 전체 Git 역사 검사 아님.
63. **package version:** package/lock root **0.2.0** 유지.
64. **M1 현재 상태:** implementation complete / real QA pending, MEDIUM 미해결. 기존 잘림의 인체/제품 의미 구분 전체 해결 아님.
65. **M4 현재 상태:** implementation complete / real QA pending, MEDIUM 미해결. 신호 없는 frame residue는 의도적 보존. **MEDIUM2/LOW0**.
66. **다음 권장 TASK:** TASK-048 여러 실제 long-detail source의 전후 비교(흰/어두운 제품, 컬러 frame, 모델 착용, close-up). 그 결과로 M1/M4 resolved 여부 결정, 필요시TASK-049 release 검증.
67. **git diff summary:** **신규4+수정11=15파일, +465/-44행**(untracked 신규 포함), production5/test6/docs4. UI/Renderer/Product/Facts/Options/SQL/package0. stage/commit/main merge/tag0.

Ignored 증거: `artifacts/TASK-047/tests.log`, `performance.json`, `audit.json`. 로컬 검증 helper는 `node_modules/.cache/task047/`. 새 서버/브라우저/원격 QA 데이터를 만들지 않았다. Node의 기존 MODULE_TYPELESS_PACKAGE_JSON 경고는 그대로이며 경고를 숨기기 위한 package 변경은 하지 않았다.
