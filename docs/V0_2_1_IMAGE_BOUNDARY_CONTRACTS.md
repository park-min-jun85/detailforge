# v0.2.1 Image Boundary Contracts — TASK-046

## TASK-047 우선 계약 — 사용자 승인으로 조정

아래 TASK-046 기록은 당시 baseline이다. TASK-047에서는 **same pixels + same config => same decision**을 최우선 불변식으로 적용한다. M1-A/H와 M4-A/H는 동일 bytes이므로 모두 production `ambiguous/preserve` 대상이다. 원래 fixture의 의미 label/knownContentBounds/과거 관측은 보존하며 이를 production 입력이나 분기에 사용하지 않는다.

제거율보다 content-loss0을 우선한다. 단색 띠와 내부의 단일 색 전환만으로는 불투명 frame 제거를 승인하지 않는다. 실제 pixel-level 구별 신호가 있는 별도 A2 계열(일정 폭 band, 연속하는 얇은 separator, 그 너머의 다른 textured interior)을 추가한다. separator 자체는 남기며 그 바깥의 band만 제거한다. 이 신호도 물체 인식이나 모든 실제 사진에 대한 무손실 증명은 아니므로 실제 QA는 별도다.

기존 A~D와 crop6종은 원본 fixture를 그대로 유지하되, 근거 없는 opaque trim 기대를 preserve로 조정한다. 투명 띠와 A2 white/gray/colored/noisy/asymmetric fixture로 제거 능력을 따로 검증한다. TASK-047 완료 기준은 기존22종 content-loss0, 동일-input 동일-decision, A2 안전 제거, cap/최소크기/원본 픽셀·provenance·legacy 보존이다. 원래 M4-A~E의 무조건 제거는 완료 조건에서 제외한다. UI/원격 호출/새 dependency는 추가하지 않는다.

### TASK-047 구현 정책 v2

`frame-analysis.ts:analyzeCropEdge/analyzeCropEdges`는 RGBA/width/height만 받는다. `edge-trim.ts:detectTrim`은 decision에서 inset만 취한다. `trimCrop`에서 한 번 Sharp decode하고4변이 같은 raw buffer를 재사용한다. 진단은 metadata/DTO/UI에 저장하지 않는다.

- **Stage A:** 전체 제거 후보 띠(모서리 포함)의 모든 픽셀 검사. alpha0만 완전 투명으로 인정한다. alpha1~254, contrast pocket, 글자/미세 stroke는 보존 쪽으로 판정한다. 불투명 띠는 채널 range≤12, 최대 채널 variance≤6, 최대 인접 delta≤12, 첫 줄과 RGB 거리≤6을 요구한다. 밝기 proxy180 미만의 dark edge는 유지한다.
- 바깥에서 안쪽으로2px~floor(axis×.03)만 찾으며, cap을 넘는 띠를 cap까지 부분 제거하지 않는다. 단순 band→texture 전환은 `ambiguous/no_separator`. 연속1~3px separator가 있고 band와 RGB Euclidean 거리≥60이어야 다음 단계로 간다. **separator는 crop 안에 남는다.**
- **Stage B:** separator 안쪽4줄이 불투명하고 separator 대비 RGB 거리≥40/band 대비≥30, 한 줄 이상 variance≥max(8,band variance×3), separator 명도가 양쪽보다25 이상 낮거나 높은 extrema여야 `confirmed_frame`이다. 모든 조건을 충족한 frameConfidence1만 trim한다. .25/.5는 부분 근거를 뜻하며 통계적 확률이 아니다.
- separator/interior 통계만 양 끝 `ceil(perpendicularLength×.03)+3`을 제외해 다른 변과 만나는 모서리를 피한다. **제거할 띠 검사에서는 모서리나 작은 detail을 샘플링으로 건너뛰지 않는다.** 넓은 수직 프레임 때문에 이 범위 밖의 separator가 불명확하면 다른 변도 보수적으로 남을 수 있다.
- 반대편 일치는 의미 안전성 증명이 아니므로 필수조건/가산점으로 사용하지 않는다. 좌우만/위쪽만 및 회전된 한 변도 독립 판정한다. gradient·shadow·단색 벽·유사 제품색은 이 신호를 충족하지 않아 보존된다.
- 투명 경계는 alpha0인 연속 띠만 제거한다. 이전 v1의 alpha≤2/opaque≥253보다 보수적이다. 기존 최대3%/최소 폭·높이160/면적64000은 유지한다. 결과가 최소크기를 위반하면 모든 inset0으로 돌아간다.
- `trim.policyVersion`은 새 적용 결과에 **2**, reader는 기존1/2/trim 없음 지원. sourceRect/parent/hash/candidate/role/insets/postTrimDimensions 구조 유지. 기존 Derived를 조회하거나 같은 crop을 재요청해도 자동 재가공하지 않는다.

픽셀 신호가 주어져도 의미 안전성을 일반적으로 증명할 수는 없다. A2는 신호가 실제로 구별되는 한정 corpus의 양성 검증이며, 모든 테두리·실제 상품의 무손실 보장은 아니다. product-like 동일 입력을 semantic label로 예외 처리하지 않는다.

### TASK-047 현재 결과 matrix

원래22개 fixture의 bytes·semantic label·knownContentBounds·v1 관측을 그대로 유지했다. test-only `currentBoundaryInsets`가 승인된 v2 **적용 기대**를 분리한다. 기존6개 crop test도 같은 bytes에서 보존 기대를 검사하며, 예전 제거 성능이 그대로라는 주장은 하지 않는다.

| Case | v2 decision / inset(T/R/B/L) | 내용 손실 | 원래 의미 계약과 차이 |
| --- | --- | --- | --- |
| M1-A/H | 둘 다 ambiguous/preserve,0 | 0; H9,728→0 | 동일 입력을 구분하지 않음 |
| M1-B/D | ambiguous/preserve,0 | 0 | 구분 신호 없는 회색/noise 띠도 보존 |
| M1-C | transparent_band,16/16/16/16 | 0 | 투명 trim 유지 |
| M1-E/F/G/I/J | 위험/모호함으로 보존,0 | 0 | 보호 변뿐 아니라 근거 없는 다른 변도 유지 |
| M1-K/L | preserve,0 | 0 | 내부 separator 유지 |
| M4-A/H | 둘 다 ambiguous/preserve,0 | 0 | 동색 장식/제품 구분 불가 |
| M4-B/C/D/E | ambiguous/preserve,0 | 0 | 원래 단일 전환으로는 제거 승인하지 않음 |
| M4-F/G/I/J | preserve,0 | 0 | 유사색/벽/글자/gradient 보존 |
| M1-A2 | confirmed_frame,16/16/16/16 | 0 | 흰 띠+구분선 양성 |
| M1-B2 | confirmed_frame,16/16/16/16 | 0 | 회색 띠+구분선 양성 |
| M1-D2 | confirmed_frame,16/16/16/16 | 0 | near-uniform noise+구분선 |
| M4-A2 | confirmed_frame,12/12/12/12 | 0 | 베이지+구분선 |
| M4-B2 | confirmed_frame,12/12/12/12 | 0 | 핑크+구분선 |
| M4-C2 | confirmed_frame,16/16/16/16 | 0 | 실제 JPEG95 noise+구분선; 원래 C12px는 보존 |
| M4-D2 | confirmed_frame,0/12/0/12 | 0 | 좌우만 유색 프레임 |
| M4-E2 | confirmed_frame,12/0/0/0 | 0 | 위쪽만; 회전3방향도 검증 |

**원래22 + A2 8 =30종 content-loss0**. M4 원래 F~J의 content-loss false positive0. A2 8종은 band 전부 제거하되2px separator는 유지한다. 기존 opaque 단색 사례의 frame residue는 의도적으로 남는다. A2는 원래 fixture를 덮어쓰지 않는 [별도 생성기](../tests/fixtures/v0.2.1/separated-frames.mjs)이며 [production 회귀](../tests/conservative-frame-trim.test.mjs)에서 pixel identity와 versioned crop까지 검사한다.

M1/M4 상태는 **implementation complete / real QA pending**, MEDIUM2/LOW0 유지. 다음 TASK-048에서 흰/어두운 제품·컬러 frame·착용·close-up의 실제 여러 원본 전후를 비교한다. 아래 §1~8과 matrix는 **TASK-046 당시 v1 기록**이며, v2 판정은 이 절과 [TASK-047](tasks/TASK-047.md)이 우선한다.

---

2026-09-22. 기준 `df312b6` / tag `v0.2.0`, branch `feat/image-boundary-quality-contracts`. **TASK-046 당시: 재현 corpus·계약 동결만 완료**. production detector/threshold/AI/persistence/Renderer/UI 변경 없음. package **0.2.0**, **MEDIUM2(M1/M4 미해결), LOW0** 유지.

## 1. 범위와 근거

M1은 가장자리 제거가 불필요한 프레임 제거인지 실제 상품·인물·텍스트 손실인지 구분하는 문제다. 원본 단계에서 이미 잘린 인물/제품의 의미 판단과, 새 trim이 추가로 만드는 손실은 다르다. 이번 oracle은 **candidate 안에 존재하는 의미 있는 픽셀의 추가 손실**만 판정한다. 사진 밖의 얼굴·제품을 복원하거나 실제 AI의 cropped/Hero 판정을 해결하지 않는다.

M4는 Derived 외곽에 남은 유색 프레임이 새 상세페이지에서 원래 카드/패널의 흔적으로 보이는 문제다. 같은 색의 상품 표면이나 촬영 배경을 프레임으로 잘라서는 안 된다.

- [TASK-024](tasks/TASK-024.md)의 긴 원본·후보 경계·부분 확대컷을 M1-E/F/J와 K/L로 일반화했다. source에 닿는 제품/인체와 내부 패널 경계를 합성했다.
- [TASK-026](tasks/TASK-026.md)의 얇은 경계와 최대3% trim을 M1-A~D, 제품과 테두리가 가까운 조건을 E~J, 유색 잔존을 M4-A~E로 재현했다.
- [TASK-031](tasks/TASK-031.md)의 하단 조각·주변 원본 잔존은 candidate rectangle/margin 문제도 포함한다. K/L은 내부 경계 오판을 제한적으로 시험하며 실제 사진의 올바른 candidate 선택을 보장하지 않는다.
- [TASK-037](tasks/TASK-037.md)의 기대 계약/현재 characterization 분리 방식, [TASK-044](tasks/TASK-044.md)와 [TASK-045](tasks/TASK-045.md)의 기존 crop·Renderer 회귀를 이어간다. 기존 TASK 문서의 당시 backlog ID 설명은 역사 기록이며 현재 M4는 유색 프레임을 뜻한다.

모두 **새 synthetic fixture**다. 과거 실제 사진을 복제한 corpus나 실제 상품 QA가 아니다. 상품번호·공급처·파일 경로에 따른 분기, 원격 이미지, 새 AI 분석이 없다.

## 2. 실제 실행 경계

| 단계 | 현재 구현과 제약 |
| --- | --- |
| Decode | `detail-extraction/images.ts:decodeSource`: MIME/signature/decoder, 40MP·폭6000·높이60000·다중 페이지 거부. EXIF 회전 후 lossless PNG working buffer, fingerprint는 원본 bytes SHA-256. |
| Tile boundary snapping | `imageTiles/planTiles`: 폭64 grayscale의 mean≥245/variance≤8인 넓은 흰 gutter, 기본 Tile 끝의 ±128px에서 앞뒤8행 확인. Tile2048/overlap256/최대16. **Tile 경계 선택이며 제품 윤곽/후보 edge detector가 아니다.** |
| Candidate rect | `geometry.ts:mapBox/withMargin/normalizeCandidates`: 0~1000 좌표를 source pixel로 floor/ceil·clamp, 2% margin(최대24px), 타일 끝 접촉 표시와 중복 제거. 부분 seam을 임의 union하지 않는다. margin은 내용 보존의 의미적 증거가 아니다. |
| Edge trim | `edge-trim.ts:detectTrim`: 각 변 전체 줄 검사. 완전 투명(alpha≤2) 또는 완전 불투명(alpha≥253), 채널 차≤8, min≥238, 범위≤8, 분산≤6의 밝은 중성색 띠만 허용. 다음 줄에서 max(RGB)<230인 픽셀이90% 이상이어야 전환 인정. 각 변2px 이상~floor(해당 축×.03). |
| Crop minimum | `trimCrop`: 결과 폭/높이160 이상·면적64000 이상이 아니면 모든 inset0으로 복귀. RGBA mask나 의미 판별은 없다. |
| Encode | `cropImage`: sourceRect crop→trim→실제 rectangle extract. resize/upscale 없음. PNG lossless, JPEG/WebP quality95(특히 JPEG4:4:4)로 재인코딩, MIME/signature/실제 dimensions 검사. JPEG/WebP의 재인코딩 손실과 의미 있는 영역 제거를 혼동하지 않는다. |
| Derived provenance | `service.ts:persistCrop`과 `schemas.ts:derivationSchema`: parentAssetId, 원본 fingerprint, candidateId, **trim 전 sourceRect**, sourceDimensions, 정규화 좌표계와 역할, trim.policyVersion1/insets/postTrimDimensions 저장. 선택 승인 후 별도 Asset/Storage 생성, 원본 대체 아님. |
| Visual inventory | `visual-assets/policy.ts`: 출처·실제 dimensions·bounded trim 일관성/가용성 확인. inspection은 decoder/조회이며 crop 개선기가 아니다. 경고/추천 점수는 semantic mask가 아니다. |
| Renderer | `page-quality/images.ts` intrinsic1.5배 cap과 `detail-renderer` 공유 배치. padding/background/cover로 M1/M4를 숨기지 않는다. 파일 수정 없음. |

현재 detector가 반환하는 것은 inset뿐이다. 아래 `expectedClass`는 **test-only 의미 계약**이며 production의 분류 반환값이 아니다. 현재3% 이하라는 사실만으로 안전성을 증명할 수 없다.

## 3. 공통·M1 용어

| 용어 | 고정 정의 |
| --- | --- |
| source image | 원본 Asset. 실제 crop 좌표는 EXIF 정규화된 working image의 pixel 좌표이며 원본 파일/지문은 보존한다. |
| candidate rect | 정규화 source 안의 `{x,y,width,height}` 사각형. trim 전 선택 후보이며 저장 출처의 sourceRect이다. |
| derived crop | 승인 후보의 실제 사각형 픽셀을 별도 파일로 저장한 결과. 의미 재생성이나 segmentation 결과가 아니다. |
| edge band | candidate의 top/right/bottom/left에서 안쪽으로 이어지는 연속 픽셀 띠. |
| uniform border | 거의 동일한 색/alpha의 외곽 띠라는 픽셀 관찰. 장식이라는 의미적 결론을 포함하지 않는다. |
| decorative frame | 제품·사람·텍스트와 분리된 페이지 장식 외곽. test에서는 작성자가 정답을 부여한다. |
| product-touching-edge | 실제 제품 픽셀이 source 또는 candidate 끝까지 닿는 상태. 이미 잘린 사진인지 여부와 별개로 추가 제거를 보호한다. |
| meaningful content | 제품, 인물의 손/얼굴/신체, 라벨/글자/아이콘 등 보존해야 할 시각 정보. 이미지에 없는 상품 Facts를 뜻하지 않는다. |
| safe trim | 허용 변 안에서 bound를 지키고 모든 알려진 meaningful content를 포함하는 제거. |
| ambiguous trim | 프레임과 배경/제품을 픽셀만으로 구분할 근거가 부족한 제거 후보. 기본 유지. |
| unsafe trim | 의미 있는 픽셀을 제거하거나 금지 변을 침범하는 제거. |
| content loss | trimmedRect가 knownContentBounds를 전부 포함하지 못함. 이 corpus에서는 정답 bounds로 결정하며 production에서 직접 측정 가능한 값이 아니다. |
| frame residue | 장식으로 알려진 외곽이 Derived에 남는 것. 손실 회피를 위한 잔존은 허용되는 품질 한계다. |

M1 클래스: `safe_trim`은 알려진 장식 제거 가능, `ambiguous`는 의미 불확실성으로 보존, `unsafe_content_loss`는 해당 의미 있는 변을 자르면 손실, `no_trim_needed`는 외곽 제거가 필요 없는 입력이다. **unsafe_content_loss 입력이라는 뜻은 현재 함수가 실제 손실을 일으켰다는 뜻이 아니다.** 실제 손실은 별도 `currentContentLoss`다.

## 4. M4 용어와 미래 signal 계약

| 용어 | 고정 정의 |
| --- | --- |
| colored frame | 장식으로 알려진 외곽 유색 프레임. 회색 장식도 M4 품질 범위에 포함한다. |
| uniform chromatic band | 색 성분이 일정한 연속 띠라는 관찰. frame/background/content 어느 것일 수도 있다. |
| background continuation | 실제 촬영 배경(예: 벽)이 edge까지 연속되는 것. 장식 프레임으로 단정 금지. |
| product-colored edge | 상품 표면/부품이 edge에서 비슷한 색 띠처럼 나타나는 것. |
| decorative border | 의미 있는 대상과 독립적인 장식 경계. 단색이라는 이유만으로 부여하지 않는 label. |
| safe colored trim | 내용 보존 위험 검사와 장식 근거, bound를 모두 만족하는 제한된 제거. |
| ambiguous colored trim | 배경/상품/장식이 구별되지 않거나 근거가 충돌하는 유색 제거 후보. 보존. |

M4 클래스는 `uniform_frame`, `near_uniform_frame`, `background_like`, `content_like`, `ambiguous`. 첫 둘은 **합성 작성자가 아는 장식 정답**이며, production이 색만 보고 같은 label을 확정해도 된다는 허가가 아니다.

향후 signal은 기존 Sharp RGBA raw만 사용한다. 이번에는 detector나 threshold를 구현하지 않는다.

| signal | 미래 측정 정의 / 한계 |
| --- | --- |
| edge band color variance | 각 변 연속 strip의 alpha-valid RGB 평균·분산·최대 편차. 평균 하나로 작은 글자/아이콘을 지우지 않는다. |
| opposite edge similarity | top↔bottom, left↔right 색 평균과 strip 폭의 차이. 양성 보조 근거이며 비대칭 D/E에서는 부재가 불확실성을 높인다. |
| interior contrast | band 끝 전후 RGB/명도 차와 전환이 변 전체에 걸친 비율. 벽과 제품 사이도 전환하므로 단독 증거 금지. |
| alpha | 투명/반투명/불투명 비율과 이어짐. 투명 RGB는 색 통계에서 제외, 반투명 그림자·윤곽은 모호하게 취급. |
| luminance | 동일한 고정 가중 RGB 명도 proxy(예: .2126R+.7152G+.0722B). 지각적 정확도나 새 color-science 패키지를 전제하지 않는다. |
| chroma distance | RGB에서 명도 성분을 뺀 벡터 또는 max-min과 band/interior의 차이. 피부/제품색도 같은 신호를 만들 수 있다. |
| edge continuity | 띠 폭과 색의 연속성, 끊김/미세 전경 픽셀. text/icon이나 제품 돌출이 하나라도 있으면 손실 위험을 먼저 검토. |

**단색 edge ≠ frame.** edge uniformity + interior transition + opposite-side consistency + content-touch risk를 함께 평가한다. 네 신호 조합도 의미 판별의 완전한 증명은 아니다. M1-A/H, M4-A/H는 각각 **bytes가 같은데 정답이 다른** adversarial 쌍이다. 따라서 미래의 순수 픽셀 detector가 두 입력을 모두 완벽하게 분류할 수 있다는 acceptance criterion은 불가능하다. 알려진 정보가 부족하면 abstain/보존하고, 실제 후보 문맥·사람의 검토를 후속 통합에서 다룬다.

우선순위는 **content-loss risk → frame confidence → conservative trim**. 프레임을 조금 남기는 편이 제품·사람·텍스트를 자르는 것보다 낫다. M4 탐지 범위를 넓히면서 M1 위험을 증가시키지 않는다. 여기의 referenceInsets는 정답이 주어졌을 때 안전한 사각형 예이며 미래 자동 trim을 강제하는 값은 아니다.

## 5. Fixture·oracle 계약

- [corpus](../tests/fixtures/v0.2.1/image-boundaries.mjs): M1 12종/M4 10종, 640×640 RGBA. `{caseId,description,expectedClass,knownContentBounds,expectedAllowedEdges,expectedForbiddenEdges}`와 scene/color/border/format recipe, desired `referenceInsets`, 관측 `currentInsets/currentContentLoss`를 분리한다.
- [test-only helper](../tests/helpers/image-boundary-contracts.mjs): raw Buffer→Sharp PNG. M1-D는 seed/random 없는 1~2px 패턴의 압축 유사 ±1 noise이며 실제 codec 실험은 아니다. M4-C는 동일 패턴을 실제 JPEG95/4:4:4로 encode/decode한 뒤 검사한다. 두 유형을 구분한다.
- 별도 binary fixture0, 새 dependency0. tests 실행은 메모리에서 생성하며 PNG를 repository에 쓰지 않는다. JPEG bytes의 장기 플랫폼 독립 hash를 요구하지 않고 pinned decoder의 픽셀/현재 inset을 검사한다.
- 좌표는 candidate-local 정수, 사각형 범위는 `[x,x+width) × [y,y+height)`. source 좌표의 결과는 `{x: candidate.x+left, y: candidate.y+top, width: candidate.width-left-right, height: candidate.height-top-bottom}`이다. 별도 offset 회귀가 sourceRect 불변과 합성을 검사한다.
- `knownContentBounds`는 작성자가 아는 의미 영역들의 보수적인 bounding box. 빈 배경을 포함할 수 있어 false unsafe 판정은 가능하나, 알려진 내용 손실을 안전하다고 통과시키지 않는다. G/H 등 같은 색 표면도 의미 영역으로 포함한다. 사진 밖 내용이나 실제 제품 윤곽의 정확한 mask는 없다.
- 안전 불변식: **trimmedRect fully contains knownContentBounds**, 금지 변 inset0, 기존 최대3% 및 crop minimum 유지. 모든 변에서 known bounds를1px 침범하는 mutant를 oracle이 거부한다.
- validator는 ID 중복/누락 expectation/범위와 정수/size overflow/scene/RGBA/edge partition/inset cap/unsafe reference/잘못 기록된 current loss를 거부한다. fixture 메모리 한도는 축2048/총4MP로 production보다 작다.
- 이 mask/bounds는 **production에 전달하지 않는다**. AI segmentation, 새 모델/서비스 호출, DB schema, 원본 Asset 및 기존 Derived 자동 mutation 없음.

## 6. Characterization matrix

표의 inset 순서는 **T/R/B/L**, 단위px. `0`은 모든 변0. `PASS`는 이 fixture의 rectangle 보존/제거 기대와 현재 동작의 일치이며 의미 분류 기능 구현 완료를 뜻하지 않는다. 현재22개 characterization assertion은 모두 PASS하고, 목표 동작과의 gap은 그대로 남긴다.

### M1 — 12 cases

| Case | Expected | Current behavior | Gap | Future TASK |
| --- | --- | --- | --- | --- |
| M1-A 흰16px | safe_trim | 16/16/16/16, 내용 보존 | PASS; 의미를 알 때만 안전 | 047 ambiguity, 048 회귀 |
| M1-B 밝은 회색 | safe_trim | 16/16/16/16, 내용 보존 | PASS | 048 회귀 |
| M1-C 투명 | safe_trim | 16/16/16/16, 내용 보존 | PASS | 048 회귀 |
| M1-D 미세 noise | safe_trim | 16/16/16/16, 내용 보존 | PASS, 제한된 noise | 048 codec 회귀 |
| M1-E 왼쪽 제품 | unsafe_content_loss; L 금지 | 16/16/16/0 | PASS, L 보호 | 047/048 보호 유지 |
| M1-F 위쪽 제품 | unsafe_content_loss; T 금지 | 0/16/16/16 | PASS, T 보호 | 047/048 보호 유지 |
| M1-G 검은 제품 띠 | unsafe_content_loss; 모두 금지 | 0 | PASS, 검은색 조건상 보존 | 047 dark edge 오탐 방지 |
| M1-H 흰 제품/edge | ambiguous; 보존 | 16/16/16/16, **content loss=true** | **GAP: known bounds 왼쪽16×608=9,728px 제거**. A와 bytes 동일 | 047 abstain/risk, 048 검토 |
| M1-I 작은 라벨 | unsafe_content_loss; L 금지 | 16/16/16/0 | PASS, 글자 보존 | 047/048 미세 전경 회귀 |
| M1-J 손/얼굴/몸 | unsafe_content_loss; T/L 금지 | 0/16/16/0 | PASS, 합성 인체 보존 | 047/049 실제 착용컷 검토 |
| M1-K 내부 세로 separator | no_trim_needed | 0 | PASS, 내부 유지 | 048/049 panel 회귀 |
| M1-L 내부 가로 panel 경계 | no_trim_needed | 0 | PASS, 내부 유지 | 048/049 panel 회귀 |

일치11/12, gap1/12. H의 위험을 `currentContentLoss=true`로 assertion하여 초록 suite에서도 감추지 않는다. 해결 후에는 이 current baseline과 gap 문서를 함께 갱신해야 한다. H는 실제 사진에서 발생률을 측정한 결과가 아니며 기존 M1의 synthetic 반례다.

### M4 — 10 cases

| Case | Expected | Current behavior | Gap | Future TASK |
| --- | --- | --- | --- | --- |
| M4-A 베이지12px | uniform_frame; 정답상 모든 변12px 가능 | 0, 프레임 잔존 | GAP: chromatic 불허 | 047 detector, 048 적용 |
| M4-B 옅은 핑크 | uniform_frame; 모든 변12px 가능 | 0, 프레임 잔존 | GAP: chromatic 불허 | 047/048 |
| M4-C JPEG noise | near_uniform_frame; 모든 변12px 가능 | 0, 프레임 잔존 | GAP: chromatic/noise | 047/048 codec 평가 |
| M4-D 좌우만 프레임 | uniform_frame; L/R12px 가능 | 0, 양옆 잔존 | GAP: 비대칭 유색 처리 없음 | 047 비대칭 confidence, 048 |
| M4-E 위쪽만 띠 | uniform_frame; T12px 가능 | 0, 위쪽 잔존 | GAP: 단일 변 확신 한계 | 047 abstain 허용, 048 검토 |
| M4-F 제품/프레임 유사색 | ambiguous; 보존 | 0 | PASS, 의미 구분은 미구현 | 047 risk/abstain |
| M4-G 배경 벽 연속 | background_like; 보존 | 0 | PASS, 배경 분류 기능은 없음 | 047/049 배경 오탐 |
| M4-H 제품 자체 edge | content_like; 금지 | 0 | PASS, A와 bytes 같아 확대 위험 | 047/048 보호 |
| M4-I 프레임 속 글자/icon | content_like; 금지 | 0 | PASS, 장식 전체 제거 금지 | 047/048 미세 전경 보호 |
| M4-J gradient/shadow | ambiguous; 보존 | 0 | PASS, 모호함 유지 | 047/049 gradient 평가 |

보존 일치5/10, 잔존 gap5/10. 현재 유색 탐지 성공0을 분류 정확도50% 같은 지표로 포장하지 않는다. A~E도 미래 자동 제거를 무조건 요구하지 않으며 confidence가 부족하면 안전상 보존이 허용된다.

## 7. 오탐·미탐과 기존 회귀

False-positive 위험: 흰 천/검은 제품/피부/벽이 uniform band와 동일, 작은 글자·아이콘이 평균에서 사라짐, panel 내부가 외곽으로 오인됨, 투명/그림자 윤곽을 장식으로 오인함. 특히 M4 chroma 허용만 확장하면 M4-H를 잘라 M1 문제가 커진다.

False-negative 위험: 진한 회색·베이지·핑크, JPEG noise, 비대칭 프레임, gradient/shadow, cap보다 넓은 띠, 낮은 interior contrast, 90% 전환에 못 미치는 작은 프레임. 일부는 의도적 보존이 적절하다. fixture22종은 모든 noise/색/크기/실제 제품을 대표하지 않는다.

기존 [internal-polish](../tests/internal-polish.test.mjs)의 TASK-034 **6개 crop test**(흰 띠, 회색/모호한 진회색, 제품 접촉, 글자, 패널, clean)는 복사/수정 없이 전체 suite에서 재실행한다. 이번22종은 별도의 metadata/oracle/ambiguity 계약이며 기존400px fixture 구현을 복제하지 않는다. [page-quality](../tests/page-quality.test.mjs), [detail-extraction](../tests/detail-extraction.test.mjs)의 bounds/alpha/중첩 후보/EXIF/format/provenance/save 원본 보존과 [sparse-rhythm](../tests/sparse-rhythm.test.mjs)의 TASK-044 Renderer 회귀도 그대로 재사용한다.

새 [tests](../tests/image-boundary-contracts.test.mjs)는 desired reference의 보존 oracle과 **실제 detectTrim→trimCrop→cropImage** 현재 결과를 별도 test로 실행한다. PNG는 retained source 픽셀 exact, JPEG는 같은 기존 encoder 재인코딩 결과와 비교한다. MIME/decoded dimensions/trim metadata/원본 bytes SHA-256/입력 rect 불변을 확인한다. 저장 서비스·브라우저·원격 동작을 새 corpus로 실행했다고 주장하지 않는다.

## 8. 다음 작업

1. **TASK-047:** conservative colored-frame detector + content-loss risk guard. 먼저 H adversarial 쌍을 기준으로 자동 판단 한계/abstain 정책을 정한다. 새 threshold는 bound와 positive/negative 회귀로 정당화하며 mask나 AI segmentation을 도입하지 않는다. 실제 장식 탐지와 trim 승인은 구분한다.
2. **TASK-048:** 새 crop에만 명시적 적용/검토 통합, sourceRect+insets+dimensions provenance, PNG/JPEG/WebP/EXIF·최소크기·3% cap·재저장/실패 보존 회귀. legacy Derived를 읽는 것만으로 재가공하지 않는다. 허용할 review UX는 여기서 별도로 결정한다.
3. **TASK-049:** 여러 실제 상품·착용/근접/패널/배경의 승인된 QA, 동일 원본 전후 retained content와 frame residue를 각각 평가하고 v0.2.1 release 판단. 이번 합성 suite 통과를 실제 QA나 M1/M4 해결로 대체하지 않는다.

필수 검사/파일 변경/호출0 및48항목 완료 보고는 [TASK-046](tasks/TASK-046.md)에 기록한다. 원본·기존 Derived 자동 mutation, Renderer masking, frame-detected UI, AI/prompt 변경은 이번에 없다.
