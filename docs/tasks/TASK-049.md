# TASK-049 — M4 Real Colored-frame Miss Reproduction & Safe Classification Contract

2026-09-23. Branch `feat/colored-frame-real-miss-contracts`, 시작 HEAD `c62fe89`, clean. **M1 RESOLVED 유지 / M4 NEEDS_WORK — root cause/classification established.** BLOCKER0/HIGH0/MEDIUM1/LOW0. Production behavior 변경0, package0.2.0, commit/main merge/tag0.

## 결론과 판정 대상

실제 A01/B01/B02에서 현재 안전 계약으로 승인할 새 자동 trim 패턴을 찾지 못했다. 다음 TASK-050은 **Review/Manual Crop UX 설계**로 제안한다. 이번에 UX를 구현하거나 frame threshold를 낮추지 않는다. A01의 외곽은 시각적으로 장식 후보지만 pixel-only 자동 승인 근거가 충분하지 않다. B01은 불연속 패널이며 완전 제거가 cap 밖이다. B02의 내부 카드 조각을 전체 폭의 아래 strip으로 없애면 옆의 실제 제품 표면도 잘린다.

`safe_to_trim / unsafe_to_trim / ambiguous`의 대상 연산은 **현재 3% cap을 지키는 사각 crop으로 관측된 문제 residue 전체를 제거**하는 것이다. B01의 `unsafe_to_trim`은 cap/완전 제거 계약 위반을 뜻하며, 모든 작은 inset이 실제 인물을 자른다는 주장이 아니다. B02는 cap 위반뿐 아니라 실제 보존할 제품 texture 침범도 있다. A01의 제한된 회색 여백이 기하학적으로 잘릴 수 있다는 관찰과, 자동 의미 안전성 승인은 구분한다. M1의 기존 판정 범위인 추가 trim 안전성을 넓혀 주장하지 않는다.

## 실제 입력 고정과 수치

TASK-048의 source bytes SHA256와 crop raw SHA256를 재확인하고 같은 source-decoded working pixels에 현재 `analyzeCropEdges`를 실행했다. 저장 AFTER JPEG를 다시 decode하여 compression을 추가한 값이 아니다. source/기존 Derived/048 metadata 모두 불변. 전체 이미지·상품번호·로컬 절대 경로는 새 test fixture에 넣지 않았다. sample 이름 A01/B01/B02는 문서 연결에만 사용하고, 테스트 파일은 pixel mechanism 이름이다.

- **A01:** source860×12900, candidate `(19,505,821,825)`, BEFORE/AFTER rect 동일, output821×825, role product. 바깥 회색은 대략 T17/R15/B18/L16px, 그 안에 약2px 녹색 선. JPEG 전이 픽셀 때문에 uniform run 길이는 이 외관상 두께와 다르다. 회색 바깥에 제품/사람/텍스트는 관찰되지 않지만 오른쪽 안쪽 사진 경계에 강아지가 닿으며 구분선을 제거하는 것은 허용하지 않는다.
- **B01:** source800×23982, candidate `(360,2000,380,572)`, BEFORE/AFTER 동일, output380×572, role product. 갈색 L자 영역은 candidate-local 왼쪽 `x0..7/y222..571`, 아래 `x0..197/y546..571`. 두께 L8/B26px, 아래 폭 점유198/380=52.11%, 왼쪽 길이 점유350/572=61.19%. 사진·의류는 그 안쪽에 이어지고 텍스트는 없다. 아래26px 전체 제거는 cap17px 초과다.
- **B02:** source800×23982, candidate `(54,2711,691,547)`, BEFORE/AFTER 동일, output691×547, role detail. 카드 조각은 대략 `x74..616/y509..546`, 높이38px, 위쪽 흰 outline 약4px. 전체 폭의78.58%에만 걸쳐 있고 나머지 양옆 제품 표면이 아래 edge까지 이어진다. bottom cap16px. source에 이미 섞인 내부 패널이며 바깥 균일 frame이 아니다. 텍스트/인물 없음.

좌표는 candidate-local integer pixels, rect는 `(x,y,width,height)`다. `real-frame-misses.json`에 source/candidate/output/patch 좌표, 원본 hash, 모든 edge의 production decision과 진단 trace를 고정했다. 아래 대표 ROI는 전체 이미지를 점수 하나로 요약하지 않기 위해 실제 선택 범위를 명시한다.

- **A01 top:** outer ROI `(28,0,765,15)` RGB **224/224/224**, 채널 분산 **0/0/0**. interior ROI `(28,20,765,4)` RGB **140.20/135.48/131.04**, 분산 **22.76/16.13/22.53**. RGB 거리153.30, luminance 거리87.84. 녹색2px ROI `(28,17,765,2)` RGB127.46/180.96/120.96, 분산0.31/6.25/0.62. outer first-line continuity100%, detail ratio0%, 안쪽60줄 mean 전환2회.
- **B01 bottom:** 갈색 ROI `(0,546,198,26)` RGB **87.94/75.91/64.03**, 분산 **3.81/2.08/5.44**. photo ROI `(8,540,190,6)` RGB **192.64/185.23/180.24**, 분산 **1555.59/2442.25/3493.35**. RGB 거리190.83, luminance 거리108.84. 그러나 bottom 전체 first-line RGB167.97/161.71/155.46, 분산6960.74/7998.30/9102.68, continuity0%, detail ratio0.264%, 전환8회. 부분 band의 낮은 분산만으로 전체 edge 안전성을 승인할 수 없다.
- **B02 bottom:** 흰 outline ROI `(74,509,543,4)` RGB **251.83/251.83/249.44**, 분산 **9.80/11.76/32.98**. card interior ROI `(78,515,535,8)` RGB **205.87/196.91/192.72**, 분산 **401.18/447.68/458.84**. RGB 거리91.36, luminance 거리53.15. 실제 bottom 전체 first-line RGB209.32/199.95/193.66, 분산389.07/545.30/766.90, continuity7.09%, detail ratio49.86%, 전환3회. 이 흰 outline은 image 외곽에서 시작하지 않으므로 band ROI 대비만 보고 crop하면 안 된다.

분산은 RGB 채널별 population variance(단위 pixel value²), RGB 거리는 Euclidean, luminance는0.2126R+0.7152G+0.0722B다. continuity는 **한 줄의 평균 RGB에서 거리6 이하인 픽셀 비율**이며 연결 성분/OCR/semantic 검출이 아니다. transition count는 outer→inner60개 줄에서 인접 평균 RGB 거리>12인 위치 수다. edge detail ratio는 줄 방향 인접 RGB max-channel delta>12 비율, ROI detail ratio는 영역 내 수평/수직 이웃 쌍 비율이다. 서로 다른 분모를 섞지 않는다. 이 숫자는 test-only 설명 지표이며 production threshold/신뢰 확률/trim 승인 기준이 아니다.

## 실제 production preserve 이유

- **A01 T/R/L:** `no_separator`, confidence0.25, risk ambiguous. Stage A가 T15/R8/L13에서 먼저 멈춘다. T/L full-line range 최대20 때문에 허용12를 초과하고, R은 첫 줄과 RGB 거리6.67로 허용6을 초과한다. 그 위치의 guarded separator 대비는 각각 **4.38/7.07/1.17**로 최소60에 못 미친다. 실제 녹색 선은 그보다 안쪽에 있다. JPEG transition/corner 영향은 관찰값이며 이를 이유로 outlier 검사나 tolerance를 완화하지 않는다.
- **A01 B:** `interior_ambiguous`, confidence0.5. stop18, separator2px 검출. 실제 Stage B trace는 **contrast=false, textured=true, separatorExtremum=false**. 녹색 선이 밝은 mat와 더 어두운 photo 사이에서 필요한 명도 극값을 만들지 않으며 모든 inner row의 대비 조건도 만족하지 않는다. 단순히 “separator 없음”으로 뭉뚱그리지 않았다.
- **B01 B/L:** 첫 줄에서 `band_detail`, risk detail, confidence0. bottom max range196/variance9102.68/adjacent183이며, 서로 다른 갈색/흰 영역이 섞인다. left도 첫 줄 max range191/variance8656.13/adjacent182. T/R은 `no_separator`지만 문제인 L자 residue의 직접 이유는 B/L이다.
- **B02 B/T:** `band_detail`, risk detail, confidence0. bottom max range149/variance766.90/adjacent94, 실제 제품·card texture가 존재한다. L/R은 `no_separator`. 보이는 내부 흰 선을 crop 바깥쪽 선으로 취급할 수 없다.

모든 변의 trimPixels0이다. reason은 production helper의 반환값, 상세 trace는 해당 고정 production 구현의 단계별 통계를 test-only로 설명한 자료다. 임의 confidence threshold나 “제품 인식 성공”을 새로 만들지 않았다.

## Gap matrix

| Sample | Visual issue | Pixel classification | Current detector reason | Safe to auto-trim? | Future action |
| --- | --- | --- | --- | --- | --- |
| A01 | 회색 외곽+녹색 선 잔존 | ambiguous, decorative 후보 | T/R/L no_separator; B interior_ambiguous | ambiguous | manual_review |
| B01 | 불연속 갈색 L자 패널 | panel_background | B/L band_detail | unsafe_to_trim: 완전 제거26px>cap17 | manual_crop_candidate |
| B02 | photo 내부 아래 카드 조각 | content_touching_edge, 내부 panel | B/T band_detail | unsafe_to_trim: 제품 texture 침범,38px>cap16 | manual_review |

이 classification은 source와 측정치를 검토한 **test-only 계약 annotation**이며 현재 production이 5개 의미 class를 추론한다는 뜻이 아니다. 자동 trim eligibility를 검증하기 위해 별도 semantic label을 production 입력으로 전달하지 않는다. real safe pattern0, detector_extension 후보0, 검토 대상3(그중 명시 수동 crop 후보 B01)이다.

## 최소 재현과 반례

Git 대상 실제 패치는 **3개 총100,676bytes**다. 원본 source에서 손실 없이 추출한128×128/256×128/128×128 PNG이며 resize/recolor/식별 텍스트 추가 없음. 얼굴·상품명·식별 텍스트가 들어가지 않도록 확인했다. neutral fixture 이름 `layered-muted-border`, `partial-dark-panel`, `inset-card-boundary`로 연결한다. 전체 actual source와 annotated full-image sheet는 ignored artifact로만 유지한다.

patch를 독립 crop으로 넣으면 axis/3% cap/모서리/새 artificial edge가 달라진다. 예를 들어 A01 full top은 `no_separator`,128px patch top은 cap3px 때문에 `wide_band`다. 이 차이를 test로 고정해 작은 patch가 원래 전체 detector 원인을 재현했다고 잘못 주장하지 않는다. full 후보 분석은 원본 local artifact에서 별도 실행했고, CI는 작은 patch와 deterministic generalized analogue만 읽는다.

- **RF-A-R/H:** 회색8px 부근의 작은 RGB 전이+녹색 선 구조. semantic 설명만 decorative surround/product rim으로 바꾼 같은 bytes이며 둘 다 ambiguous/preserve. **RF-A-P/N:** 분리된 top frame과 separator 없는 background를 짝지음.
- **RF-B-R:** 갈색 부분 L자/흰 여백. **RF-B-P/N:** 연속 밝은 side frame과 중간부터만 나타나는 같은 색 panel을 짝지음. P는 실제 어두운 panel을 그대로 안전하다 부른 것이 아니며, 색·연속성·separator 조건을 바꾼 양성 대조다.
- **RF-C-R:** 제품 texture 안에 삽입된 하단 카드. **RF-C-P/N:** 완전히 분리된 bottom band와 의미 있는 stroke가 band까지 이어지는 입력을 짝지음.

합성 **10개 = positive3 + paired negative3 + real analogue3 + same-pixels semantic alias1**. 실제 패치3개와 별도다. positive는320×320,8px single edge,2px 보존 separator, varied interior를 사용하며 **이미 현 v2가 처리**한다. 실제 miss3개가 safe라고 판정된 근거가 아니며 새 detector 확장이 필요하다는 증거도 아니다. negative는 photo_background/panel_background/content_touching_edge를 포괄한다.

`validateMissCorpus`는 class/safety/inset cap/최소크기/known content containment/paired negative와 같은 pixels/config의 같은 desired classification·safety·insets를 검사한다. known bounds는 test oracle만 사용한다. production에는 raw RGBA와 dimensions만 들어간다. current characterization은 실제 helper/insets/trimCrop를 별도로 검사하므로 desired annotation을 production output으로 바꿔치기하지 않는다. 현재 gap은 안전한 합성 trim 기능이 아니라 실제 residue의 자동 제거 승인 근거 부재다.

## 완료 보고 — 57항목

1. **목적:** 실제 M4 miss3건의 원인·pixel 분류·보존 계약과 후속 방향 확정.
2. **branch:** `feat/colored-frame-real-miss-contracts`, HEAD `c62fe89`.
3. **A01 위치:** T17/R15/B18/L16px 회색+약2px 녹색 선, output821×825.
4. **A01 stats:** outer RGB224/224/224·분산0, inner140.20/135.48/131.04·분산22.76/16.13/22.53, RGB distance153.30. 상세 ROI/continuity/trace 위 기록.
5. **A01 reason:** T/R/L no_separator; B interior_ambiguous(contrast/extremum fail).
6. **A01 class:** ambiguous, 시각상 decorative 후보.
7. **A01 safe-to-trim:** ambiguous. manual_review.
8. **B01 위치:** left8px 부분 띠+bottom26px의 L자, output380×572.
9. **B01 stats:** 갈색RGB87.94/75.91/64.03, 분산3.81/2.08/5.44; full bottom variance max9102.68, coverage52.11%.
10. **B01 reason:** B/L band_detail; 전체 edge 단색/연속 band 아님.
11. **B01 class:** panel_background.
12. **B01 safe-to-trim:** unsafe_to_trim — 완전 제거26px>cap17. manual_crop_candidate.
13. **B02 위치:** 내부 `(74,509,543,38)` 카드, outline약4px, output691×547.
14. **B02 stats:** outlineRGB251.83/251.83/249.44·분산9.80/11.76/32.98; bottom detail49.86%, continuity7.09%.
15. **B02 reason:** B/T band_detail; 내부 card와 제품 texture 혼합.
16. **B02 class:** content_touching_edge(내부 panel).
17. **B02 safe-to-trim:** unsafe_to_trim — 양옆 제품 손실 및38px>cap16. manual_review.
18. **decorative frame:** bounded low-variance band, 반복 가능한 inner transition/edge continuity, 보호할 content와 분리. 색 하나로 승인 금지.
19. **panel background:** 상세 layout의 부분 색 영역/사진 배치 배경. 자동 removable 의미 없음.
20. **photo background:** 벽·바닥·천·촬영 배경의 연속, 보존 우선.
21. **content-touch:** 제품·인물·텍스트·icon·shadow·의미 separator가 제거 영역과 연결. 해당 trim 금지.
22. **ambiguous:** pixel-only 의미 분리 근거 부족. 자동 preserve, 필요시 명시 검토.
23. **diagnostic metrics:** RGB mean/channel variance, inner stats, RGB/luminance distance, transitions, continuity, detail ratio, ROI 위치/coverage. test-only.
24. **positive synthetic:** 3, 기존 v2가 모두8px 처리하는 분리 신호 대조군.
25. **counterexample:** paired negative3 + same-pixels alias1, 모두 preserve. real analogue3 별도.
26. **same-pixels invariant:** 같은 raw/dimensions/fixed config는 같은 desired/production decision. label-only 다른 기대는 validator reject.
27. **current characterization:** actual full 후보3개/patch3개/합성10개에서 결과 고정. patch scale 차이 명시.
28. **desired contract:** 별도 validator, 의미 class와 안전 operation·protected bounds·pair 검증. 미구현 자동 의미 classifier라고 주장하지 않음.
29. **gap matrix:** 위 A01/B01/B02 3행, 사유와 후속 action 분리.
30. **detector extension 후보:** 실제 근거상0. 양성 대조군은 이미 현 v2 지원.
31. **manual review 후보:** A01/B02, B01은 manual_crop_candidate. 전체3건 explicit review 대상.
32. **M1 regression:** 기존 M1/A2 및 원래30종 corpus content-loss0 유지, full suite PASS. 새 내용 손실 발견0.
33. **M4 상태:** NEEDS_WORK — root cause/classification established.
34. **생성 파일:** test-only7개(analogue/helper/test/manifest 각1+PNG3), 이 TASK 문서1, 총8. ignored 분석 helper/이미지/log 별도.
35. **수정 파일:** contracts, RELEASE_BACKLOG, tasks README 문서3개.
36. **production code:** 변경0, diagnostic seam 추출도 불필요. 기존 pure helper 그대로 사용.
37. **migration:** 0.
38. **dependency:** 0.
39. **external calls:** OpenAI0/Domeggook0/source fetch0/기타0. local 파일만 사용.
40. **remote mutation:** DB/Storage read/write0. source/기존 Derived/사용자 data 변경0.
41. **tests:** 신규38 PASS(실제patch4, corpus1, desired10, current10, equality1, validator reject8, diagnostics4). 초기 validator duplicate-ID 검사 순서 보완 후 통과.
42. **total tests:** 기존1253+신규38=**1291 PASS**, fail/skip/todo0.
43. **typegen:** PASS.
44. **typecheck:** PASS.
45. **lint:** PASS.
46. **build:** PASS, installed Next16.3.4.
47. **diff check:** PASS, 신규 text 파일 whitespace/conflict marker 검사 포함.
48. **secret scan:** 467파일에서 실제 설정3종 exact match 및 credential/signed-token 패턴 findings0. tracked/untracked code/docs/tests/client bundle/TASK049 text 로그·분석 helper 범위, 값 출력0. 상세는 ignored audit.json.
49. **package version:** package/lock root0.2.0 불변.
50. **BLOCKER:** 0.
51. **HIGH:** 0.
52. **MEDIUM:** 1(M4), real miss3건을 별도 issue로 중복 집계하지 않음.
53. **LOW:** 0.
54. **M1 상태:** RESOLVED 유지, TASK048의 추가-trim 안전성 gate 범위.
55. **M4 상태:** NEEDS_WORK. 명확한 decorative만 자동 제거, 모호한 residue는 검토라는 목표를 명시했지만 해결 처리하지 않음.
56. **다음 TASK:** TASK-050 Review/Manual Crop UX 설계. 사용자 명시 선택·원본/기존 Derived 보존·새 candidate 미리보기·실제 content loss 검토·cap과 수동 crop 구분을 설계. 자동 threshold 확장/AI/Renderer masking 구현은 이번에 하지 않음.
57. **git diff summary:** 신규8+수정3=11파일, test-only7/docs4. **text +1527/-0행, bounded PNG3개100,676bytes**(untracked 신규 포함). production/기존tests/기존fixture/SQL/package0. commit/stage/main merge/tag0.

## 재현과 증거

정규 suite는 `node --conditions=react-server --import ./tests/register.mjs --test tests/real-frame-miss-contracts.test.mjs` 및 기존 전체 `tests/*.test.mjs`다. 추가 dependency/local original artifacts가 필요 없는 CI 재현이다. 작은 patch의 hash/원본 geometry와 실제 pixel 통계를 [manifest](../../tests/fixtures/v0.2.1/real-frame-misses.json)에서 읽는다.

원본 전체 재현은 ignored `node_modules/.cache/task049/analyze.mjs`가 TASK048 comparison.json의 local source 위치를 읽어 source/crop hash와 모든 edge 결과를 재검증한다. `finalize.mjs`는 ROI stats/trace/manifest와 diagnostic sheet를 만든다. recipe/profile helper와 원본 분석은 별개이며 fixture를 정책에 맞추려고 실제 pixels를 바꾸지 않는다. `artifacts/TASK-049/analysis.json`, `metrics.log`, `misses.png`, source-decoded crops3개, focused/full tests와 필수검사 log, `audit.json`은 ignored다. 새 서버/브라우저/원격 QA 데이터를 만들지 않았다. fontconfig cache 경고에도 sheet 생성 및 시각 확인은 완료했으며, Node의 기존 module type 경고를 숨기려고 package를 바꾸지 않았다.
