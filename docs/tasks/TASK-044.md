# TASK-044 — Sparse Section Vertical Rhythm Polish

완료: 2026-09-22. v0.2.0 Internal Quality의 L1만 처리. **L1 RESOLVED**, BLOCKER0/HIGH0, MEDIUM2(M1/M4), LOW0. package0.1.1 유지. commit/merge/tag 없음.

## 구현 계약

`visual-system.ts`의 순수 `sectionRhythm`은 persisted style을 반환하거나 수정하지 않고 `compact | normal` presentation hint만 만든다. SectionRenderer의 `data-rhythm`을 통해 Editor/Final에 같은 CSS가 적용된다.

- Hero와 Gallery는 항상 normal. 다른 타입도 assetIds가 있으면 normal이며 useCase 내부 item.assetIds도 포함한다. 이미지가 아직 로드되지 않았거나 URL이 누락돼도 판정이 변하지 않는다.
- 텍스트의 short 조건은 title≤40, 각 부분≤120, title 포함 합계≤200 UTF-16 code units, 명시적인 CR/LF 없음이다. 폭/줄 수를 런타임에서 추측하지 않는다.
- keyBenefits items≤1, Feature bullets≤1, UseCase items≤1, Detail points≤1, Notice items≤1일 때 short 조건을 추가 확인한다. ImageText는 title/body를 확인한다. 여러 항목 또는 긴 문구는 기존 rhythm이다.
- Specification≤3행은 compact(legacy 0행 title-only도 포함), 4행 이상 normal. 긴 셀의 글자·줄바꿈·row padding은 기존 정책을 그대로 사용한다.
- Option의 confirmed 1group/1value는 compact hint지만 CSS override에서 제외해 TASK-029 inline layout을 정확히 보존한다. 복수 값/그룹 및 legacy row 방식은 기존 정책이다.
- CSS override는 sparse이고 density≠spacious이며 Option이 아닌 경우에만 적용한다. 기본 compact padding32→24, normal52→36. Spec normal44→32, Notice normal32→28. 해당 타입에 이미 있던 더 작은 compact 값은24 그대로다. 짧은 text-only ImageText/Detail normal64→36도 같은 범위다.
- 제목 뒤 간격16, 직접 자식 table margin-top16, list margin-top12, Notice divider 안쪽 padding20→16. 수평 padding52, font-size/line-height, image/grid/contain/cover와 배경 token은 변경하지 않는다. 인접 섹션을 합치는 selector도 없다.

saved density에는 사용자가 명시한 값과 생성 기본값을 구분하는 provenance가 없다. 따라서 canonical style을 추정·덮어쓰지 않고 **기존 compact/normal의 CSS mapping을 제한적으로 갱신**한다. spacious는 내부 간격까지 전부 기존대로 유지한다. compact≤normal≤spacious의 사용자 선택 관계가 남는다. legacy 페이지의 짧은 텍스트가 더 촘촘해지는 것은 의도한 visual-system update이며 DB auto migration이 아니다.

## Browser / Export 근거와 한계

production build 전/후를 동일한 loopback read-only PostgREST/Storage fixture로 비교했다. OpenAI·Domeggook·원격 DB/Storage 요청은 하지 않았다. 앱 프로세스의 fetch는 loopback만 허용하며 fixture 쓰기는 거부한다. 원본 자료는 읽기만 했다. `artifacts/TASK-044/fixtures.json`을 비교 시작 전에 고정했고 종료 audit의 fixture hash 동일·write0을 확인했다.

A는 TASK-032의 상품67399861 자료를 복제한 **deterministic sparse fixture**다. 4개 기존 섹션 중 specification을 앞2행으로 구성하고 short Feature/Notice2개를 더한 총6개 fixture다. 이는 실제 저장 페이지를 수정하거나 새 AI가 생성한 결과가 아니다. 기존 Fact/Option 원문과 실제 사진을 재사용한다. B는 TASK-043의 상품67695797 첫 accepted canonical4개를 그대로 재사용했다. 같은 전/후 fixture끼리 비교하며 TASK-032의 과거 A1933px와 직접 비교하지 않는다.

- A 전체2115→2035px. Hero953→953, ImageText468→468, Spec234→210, Option81→81, Feature207→167, Notice171→155. 줄어든80px은 여백이며 텍스트·제목 크기·이미지는 동일하다.
- B 전체3057→3057px. Hero919, Gallery1428, Spec494, Option216 모두 유지. 6행 스펙/6값 옵션과 사진3개 Gallery의 가독성 유지.
- A/B 첫 visual offset217→217px. A images680×683 / 340×340, B images560×649 / 640×720 / 344×400 / 344×324 모두 전후 동일(브라우저 정수 CSS px).
- Final/PNG/JPG 모두 width860, Final zoom/scale 없음. A PNG/JPG860×2035, B PNG/JPG860×3057. 실제 export POST4회, 이미지 누락·새 clipping·가로 overflow·내부 review warning0을 DOM 및 네 출력의 시각 확인으로 검증했다. 기존 M1/M4 원본 이미지 문제는 수정하거나 해결로 세지 않는다.
- Editor와 Final의 content/style/DOM은 공유 renderer 회귀에서 일치한다. 실제 Editor의 자동 축소에서는 border pixel rounding에 따른 소수/정수 높이 차이가 있었다. viewport2400에서 **Editor100%**로 비교하면 A/B 모든 섹션 높이·padding·font·image dimension·텍스트가 정확히 일치한다. A Feature 선택 전/후도 동일. 기존 Editor 축소 동작 자체는 수정하지 않았다.
- 저장하지 않은 임시 Editor draft에서 Feature spacious padding72/height247 유지 확인 후 기본값으로 복구했다. ImageText body를 비운 draft에서도 height468/image340×340 유지, 빈 paragraph 없음 확인 후 원문 복구. 저장/순서 변경/재생성0.
- A의 과거 카피/수동 provenance와 stale 준비 상태 경고는 shell에서 그대로 표시된다. 이번 TASK는 legacy 문구를 고치지 않는다. 상품 article 내부 warning0이며 export에 포함되지 않는다.

재현 근거(모두 gitignored): `artifacts/TASK-044/{A,B}-{before,after}.json`, `{A,B}-editor-100.json`, `A-editor-100.png`, `spacious-draft.json`, `null-body-draft.json`, `{A,B}-final.{png,jpg}`, `fixtures.json`, `audit.json`, 검사 로그. 로컬 harness는 `node_modules/.cache/task044/{qa.mjs,next.cjs,audit.mjs}`. 외부 AI 실행 없이 기존 TASK-028/032/043 artifact와 TASK-042의 B 원본 crop loader를 읽어 구성한다. Browser 조작은 Codex browser 도구, export는 기존 앱 endpoint/Chromium을 사용했다.

## 요청된 완료 보고 57항목

1. **TASK 목적:** sparse Section의 불필요한 수직 여백을 deterministic renderer 규칙으로 줄인다.
2. **branch:** `feat/sparse-section-rhythm`, 시작 HEAD `bf2c2b9`, 작업 시작 clean. branch 변경/commit/merge/tag 없음.
3. **L1 root cause:** min-height가 아니라 정보량과 무관한 section padding·heading/table/list 간격이었다. 이미지가 주 콘텐츠인 큰 섹션은 같은 문제로 분류하지 않았다.
4. **sparse 판정 방식:** type + 실제 asset reference + 항목/행/옵션 수 + bounded short text. 문자 수 단일 기준 아님.
5. **spacing helper:** `sectionRhythm`, SHORT_TITLE40/SHORT_PART120/SHORT_TOTAL200. 순수하고 비영속적.
6. **Hero 정책:** 자동 compact 제외. 기존 계층/1.5x upscale cap 유지.
7. **Benefits 정책:** text-only≤1 item이며 short일 때 compact, 2+ 기존 grid.
8. **Feature 정책:** no image + short + bullets≤1이면 compact. visual/long/multi-item 유지.
9. **ImageText 정책:** visual은 그대로. null body 빈 p 없음, 실측 이미지 크기 유지.
10. **Gallery 정책:** 기존 count별 grid·image size 유지. 자동 compact 제외.
11. **UseCase 정책:** short text-only≤1 item compact. nested image 포함 visual 보호.
12. **Detail 정책:** short text-only≤1 point compact. visual emphasis/sizing 유지.
13. **Specification 정책:** 1~3행 compact, 4+ 기존. cell exact values/행 padding 유지.
14. **Option 정책:** 1group/1value TASK-029 inline 그대로, 6value wrap 그대로.
15. **Notice 정책:** short≤1 item compact, 기존 divider·background 유지.
16. **empty wrapper 처리:** 기존 conditional p/list/table/card/image wrapper 확인. null body·empty list·empty notice/gallery 회귀 추가. SectionCopy 변경 불필요. schema상 일부 legacy title-only는 가능하며 기존 generation low-value guard는 수정하지 않는다.
17. **saved style precedence:** provenance 부재 확인. 저장 token/레이아웃/배경/정렬 불변, spacious 전부 보존, compact/normal CSS mapping만 갱신.
18. **legacy behavior:** 조회 mutation0, 의도한 CSS visual-system update로 문서화.
19. **Editor parity:** 공유 renderer SSR R1~R10×3 density 일치, 실제 A/B100% 일치, A 선택 전후 높이 일치.
20. **R1~R10 결과:** 전부 PASS. spec2/6, option1/6, short Notice/Feature, visual/null ImageText, visual Detail, Gallery1, small Hero. 별도 text threshold/줄바꿈/긴 본문/여러 항목/누락·nested visual/empty wrapper 회귀 포함.
21. **CASE A fixture:** 67399861 계열 deterministic6개, spec2/option1. 실제 기존 페이지를 변경하지 않은 로컬 구성.
22. **CASE B fixture:** 67695797 TASK-043 canonical4개, spec6/option6/visual-rich.
23. **A page height before/after:** 2115→2035px (−80).
24. **B page height before/after:** 3057→3057px.
25. **sparse Section height before/after:** A Feature207→167, Notice171→155, Spec234→210px.
26. **option height:** A81→81, B216→216px.
27. **specification height:** A234→210, B494→494px.
28. **first visual offset:** A/B217→217px.
29. **image dimension regression:** 0. A2개/B4개 모두 위 실측 크기 그대로, font-size도 동일.
30. **PNG dimensions:** A860×2035, B860×3057.
31. **JPG dimensions:** A860×2035, B860×3057.
32. **Final warning count:** article0, PNG/JPG 각0. shell review는 유지.
33. **Specification exactness:** A2/B6 fixture행의 label/value/순서 before=after, R1/R2 긴 값 exact.
34. **Options exactness:** A1/B6 label/순서 및 canonical UUID/version/snapshot 불변.
35. **M2 regression:** 기존 failed-only retry/CAS/cache/성공 보존 회귀 PASS, 관련 production 수정0, 실제 새 AI retry0.
36. **M3 regression:** 기존 commerce guards/frozen corpus/수동 검토/legacy·이전 성공 보존 회귀 PASS, 관련 production 수정0, 새 AI0.
37. **생성 파일:** 이 문서와 `tests/sparse-rhythm.test.mjs`. gitignored QA artifacts 별도.
38. **수정 파일:** renderer CSS·SectionRenderer·visual-system, Roadmap·Release Backlog·tasks README.
39. **migration:** 0.
40. **dependency:** 0, package0.1.1 유지.
41. **external AI calls:** OpenAI0, Domeggook0.
42. **remote mutation:** DB/Storage0, 로컬 fixture writes0·canonical hash unchanged.
43. **tests:** 신규14개 PASS, R1~R10/3 densities·boundary/visual/empty/legacy/cap 포함.
44. **total tests:** 1156 PASS, fail/cancel/skip0.
45. **typegen:** `npx.cmd next typegen` PASS.
46. **typecheck:** `npx.cmd tsc --noEmit` PASS.
47. **lint:** `npm.cmd run lint` PASS.
48. **build:** `npm.cmd run build` PASS, before/after production build 검증.
49. **diff check:** `git diff --check` PASS.
50. **secret scan:** tracked/untracked source+docs, `.next/static`, TASK-044 text artifacts의 실제 configured secret3종 및 credential/signed-token pattern 검사, findings0. 비밀 값 출력0.
51. **BLOCKER:** 0.
52. **HIGH:** 0.
53. **MEDIUM:** 2 — M1/M4 유지.
54. **LOW:** 1→0.
55. **L1 최종 상태:** RESOLVED. 위 deterministic fixture/회귀 범위의 visual polish 완료.
56. **다음 권장 TASK:** TASK-045 v0.2.0 release 검증. M1/M4 확대는 범위 밖으로 유지.
57. **git diff summary:** production3 + regression1 + docs4 =8 files. content/generation/style persistence/DB/package 변경0. git commit/main merge/tag 없음.
