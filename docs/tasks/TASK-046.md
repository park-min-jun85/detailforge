# TASK-046 — M1/M4 Image Boundary Quality Reproduction Corpus & Contract Freeze

2026-09-22. `C:\Projects\detailforge`, 시작 HEAD `df312b6` = tag `v0.2.0`, 시작 clean. 계약/합성 재현 완료, 기능 개선 미실행. **M1/M4 미해결, MEDIUM2/LOW0**. [용어·실제 코드 경계·22개 gap matrix·후속 계약](../V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md).

## 완료 보고 — 48항목

1. **TASK 목적:** v0.2.1 Image Extraction Quality Patch의 M1/M4 안전성과 현재 실패를 재현 가능한 corpus로 고정. 이번에 해결하지 않음.
2. **branch:** `feat/image-boundary-quality-contracts`. 브랜치 변경/commit/main merge/tag0.
3. **M1 정의:** crop edge 제거가 장식 제거인지 실제 상품·인물·텍스트 손실인지 구분. 이미 source 밖에 없는 내용을 복원하는 문제가 아님.
4. **M4 정의:** Derived에 남는 유색 frame의 카드/패널 흔적. 상품색/촬영 배경을 frame으로 오인하지 않아야 함.
5. **M1 terminology:** source image, candidate rect, derived crop, edge band, uniform border, decorative frame, product-touching-edge, meaningful content, safe trim, ambiguous trim, unsafe trim, content loss, frame residue를 계약 §3에 정의.
6. **M4 terminology:** colored frame, uniform chromatic band, background continuation, product-colored edge, decorative border, safe colored trim, ambiguous colored trim을 §4에 정의.
7. **M1 case 수:** 12개, A~L. 클래스4개 모두 포함.
8. **M1 case 목록:** A흰16px/B밝은회색/C투명/D1~2px noise/E왼쪽제품/F위쪽제품/G검은제품/H흰제품/I라벨/J손·얼굴·몸/K세로separator/L가로panel경계. 모두 synthetic, 상품번호 분기0.
9. **M4 case 수:** 10개, A~J. 클래스5개 모두 포함.
10. **M4 case 목록:** A베이지12px/B핑크/C실제JPEG noise/D좌우/E위쪽/F유사제품색/G배경벽/H동색제품edge/I글자·icon/Jgradient·shadow.
11. **content-loss oracle:** test-only rectangle containment. 의미 영역을1px라도 침범하는 모든 방향의 mutant를 거부. 실제 detector와 별도.
12. **known content bounds:** candidate-local 반개구간 정수 bbox. synthetic 작성자가 지정하며 production에는 이 지식/mask가 없음. 보수적 bbox는 빈 영역을 포함할 수 있고 실제 사진의 분할/인식 결과가 아님.
13. **safe trim invariant:** trimmedRect가 knownContentBounds를 완전히 포함하고 금지 변 inset0. 기존3%/최소크기/면적 유지. source offset 합성도 검증.
14. **colored-frame signals:** edge RGB variance/opposite similarity/interior contrast/alpha/luminance/chroma distance/continuity를 기존 Sharp/raw로 정의. 새 알고리즘·threshold 구현0.
15. **frame/background distinction:** 단색은 장식의 증거가 아님. uniformity+transition+opposite consistency+content risk를 함께 보되 A/H 동일 bytes의 다른 정답 때문에 완전 의미 분류는 불가능.
16. **conservative policy:** 제품·사람·텍스트 보호가 frame 제거보다 우선. 불확실하면 보존/abstain.
17. **M1/M4 interaction:** 유색 trim 확대는 손실 위험을 높이므로 content-loss risk→frame confidence→conservative trim 순서.
18. **fixture format:** `tests/fixtures/v0.2.1/image-boundaries.mjs`의 metadata+raw RGBA recipe. 640×640, Node24 기존 loader/Sharp 사용. M1-D는 압축 유사 패턴, M4-C는 실제JPEG encode/decode.
19. **binary fixture 여부:** Git binary fixture0. 테스트 중 메모리에서 생성. ignored artifact는 stage하지 않음.
20. **corpus validator:** ID/expectation/bounds/size/recipe/RGBA/edge partition/inset cap/안전 reference/current loss 일관성. malformed13종 거부.
21. **기존 crop tests 재사용:** TASK-034 `internal-polish.test.mjs`의6개 crop test를 복사·수정 없이 전체 suite에서 재실행. page-quality/detail-extraction의 decode/EXIF/format/provenance/보존, TASK-044 sparse-rhythm 회귀 연결.
22. **M1 현재 PASS cases:** A~G/I~L, 기대 사각형과11/12 일치. 의미 분류 정확도나 전체 M1 해결을 뜻하지 않음.
23. **M1 현재 gap cases:** H. 현재 모든 변16px trim이 known meaningful 왼쪽16×608=9,728px를 제거. `currentContentLoss=true`로 고정했으며 A와 동일 pixels임도 검증. 아직 수정하지 않음.
24. **M4 현재 PASS cases:** F~J 보존5/10 일치. 현재 함수가 background/content를 분류한다는 뜻은 아님.
25. **M4 현재 gap cases:** A~E5개 모두 inset0으로 유색 frame 잔존. 향후에도 confidence 부족 시 보존 허용.
26. **false-positive risks:** 흰/검은 제품·벽·피부, 작은 문자/icon, 내부 separator, 반투명 윤곽을 frame으로 오인. 특히 A/H 동일 픽셀 반례.
27. **false-negative risks:** 유색/진회색/JPEG noise/비대칭/gradient/넓은띠/약한전환. 일부 미제거는 의도한 안전 정책.
28. **gap matrix:** 계약 §6의 M1 12행/M4 10행 각각 Case/Expected/Current behavior/Gap/Future TASK. desired/current assertion 분리, 미구현 목표를 PASS라고 바꾸지 않음.
29. **생성 파일:** `tests/fixtures/v0.2.1/image-boundaries.mjs`, `tests/helpers/image-boundary-contracts.mjs`, `tests/image-boundary-contracts.test.mjs`, `docs/V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md`, 이 보고서. 총5개.
30. **수정 파일:** `docs/RELEASE_BACKLOG.md`, `docs/tasks/README.md`. 총2개. 과거 TASK 기록은 보존.
31. **production code 변경 여부:** 0. crop/threshold/AI prompt/Renderer/UI/Asset mutation 동작 그대로. `src/` diff0.
32. **migration:** 0, `supabase/` diff0.
33. **dependency:** 0, package/lock HEAD 대비 exact unchanged.
34. **external AI calls:** OpenAI0, Domeggook0. 전체 회귀의 mock 호출과 구분.
35. **remote mutation:** 원격 DB0/Storage0, 원격 읽기0. 로컬 합성 bytes만 사용.
36. **tests:** 신규61개 PASS = corpus1 + desired22 + current22 + 동일-pixel 반례2 + source offset1 + validator13. 실 detectTrim/trimCrop/cropImage 실행, PNG retained pixels exact/JPEG 기존 encode 비교/MIME·dimensions·trim metadata·source hash·rect 불변 확인.
37. **total tests:** 기존1156 + 신규61 = **1217 PASS**, fail0/skip0/todo0. 전체 명령 실행, 파일 범위 축소 없음.
38. **typegen:** `npx.cmd next typegen` PASS.
39. **typecheck:** `npx.cmd tsc --noEmit` PASS.
40. **lint:** `npm.cmd run lint` PASS.
41. **build:** `npm.cmd run build` PASS, Next16.3.4 production build.
42. **diff check:** `git diff --check` PASS, 신규 파일도 별도 whitespace 검사.
43. **secret scan:** source/docs/tests/신규 파일·client static bundle·TASK-046 text/log의 실제 설정3종 key exact match 및 credential/signed-token 패턴 검사 PASS, findings0. 키 값 출력0. 전체 Git 역사/외부 penetration test를 의미하지 않음.
44. **package version:** package/lock root 모두 **0.2.0**, v0.2.1로 올리지 않음.
45. **M1 상태:** 미해결 MEDIUM. H synthetic 반례를 기존 M1에 연결, 별도 resolved 처리 없음.
46. **M4 상태:** 미해결 MEDIUM. 총 **MEDIUM2/LOW0** 유지.
47. **다음 권장 TASK:** TASK-047 conservative colored-frame detector + content-loss risk guard/abstain. TASK-048 적용·검토·회귀, TASK-049 실제 혼합 상품 QA·v0.2.1 release validation.
48. **git diff summary:** 신규5+수정2=7파일, test-only3/docs4, **+507/-0행**(untracked 신규 파일 포함). production/SQL/package/binary 변경0. commit/stage/main merge/tag 없음.

## 재현 명령과 검증 한계

```powershell
node --conditions=react-server --import ./tests/register.mjs --test tests/image-boundary-contracts.test.mjs
npx.cmd next typegen
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
git diff --check
```

Node의 기존 MODULE_TYPELESS_PACKAGE_JSON 경고는 이번에도 발생하며 package type 변경으로 숨기지 않았다. 새 corpus는 사진 재현 정확도나 실제 상품의 얼굴/의류 구분, browser/Export QA를 증명하지 않는다. 테스트가 초록이어도 현재 M1-H/M4-A~E gap은 명시적으로 남는다. 특히 같은 pixels를 서로 다른 의미로 지정한 반례는 순수 pixel detector의 근본 한계를 보여 주므로, 미래 TASK의 자동 trim 성공률 목표보다 보존/검토 정책을 먼저 결정해야 한다.

Ignored 검증 자료: `artifacts/TASK-046/tests.log`, `artifacts/TASK-046/audit.json`. 원격 QA 데이터·서버·브라우저 세션을 만들지 않았다. README/CHANGELOG의 과거 RC 문구는 이번 범위에서 바꾸지 않고, 이 TASK의 실제 기준 tag `v0.2.0`과 구분한다.
