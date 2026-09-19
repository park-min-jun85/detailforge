# TASK-029 — Commerce Visual Design System & Final Page Visual Refinement

2026-09-19 KST · `feat/commerce-visual-system` · 기준 `dedbae7` · commit/main merge 없음.

공유 Renderer 디자인 개선 및 동일 TASK-028 canonical 자료의 A/B 검증 완료. 실제 OpenAI/도매 API/Supabase 요청은 0회다. 로컬 읽기 전용 fixture API를 연결한 **실제 production Next 앱의 Editor/Final route와 기존 Chromium Export service**로 검사했다. 별도 export HTML이나 대체 Renderer를 만들지 않았다.

## 요청한 47개 완료 보고 항목

1. **Root visual problems**: 모든 Section 사이 공통 border, Benefits의 동일 테두리 카드, imageFirst=세로 순서만 변경/textFirst=구분선 추가, 고정 2열 Gallery, 단일 옵션에도 제목/그룹/칩/큰 여백을 쌓는 구조였다. TASK-028 실제 단일 옵션 영역304.23px, 첫 제품 visual325.84px. 본문 정확성과 별개인 presentation 문제다.
2. **생성 파일**: `src/features/detail-renderer/visual-system.ts`, `src/features/section-engine/style-policy.ts`, `src/features/page-quality/title-relevance.ts`, `tests/commerce-visual.test.mjs`, 이 문서.
3. **수정 파일**: detail-renderer의 renderer.module.css/section-renderer/section-copy/render-image; detail-editor의 schemas/components/inspector; page-quality의 images/policy; section-engine의 schemas/service/grounding. 문서는 tasks/README,00_PROJECT,01_PRD,02_ARCHITECTURE,05_UI_UX,06_CODING_RULES,07_DECISIONS를 갱신했다. 파일별 역할은 아래에 설명한다.
4. **Migration/dependency**: 없음. package/lock/DB types/migration/RLS 변경 없음. 기존 React/CSS Modules/Zod/Next/Playwright/Sharp만 사용한다. 새 font나 UI library도 없다.
5. **Global design system**: canonical Section + 기존 bounded style token + application-owned CSS. `visual-system.ts`는 intrinsic 크기·항목 수에 따른 표시 모드만 계산한다. mode는 DB/AI 입력에 저장하지 않는다. white/neutral/limited dark, 제품 이미지 중심, 공통 카드 border/shadow/gradient 없음.
6. **Typography hierarchy**: Hero42/strong46px, 일반 Section34/strong40px, spec/option28px, Notice/inline option22px, item23px(3열21px), body19px, benefits body18px, spec17px, option group18/value18~19px, notice16px. 기존 system font stack 유지. 모든 값은 CSS이며 AI가 정하지 않는다. strong 정보 제목32px/Notice·inline26px도 지원한다.
7. **Vertical rhythm**: 좌우52px. 일반32/52/72px, Hero32/44/52px, visual32/64/80px, spec32/44/56px, option28/36/48px, 단일 옵션24/28/36px, notice24/32/40px의 compact/normal/spacious 매핑. Hero는 사진이 늦게 등장하지 않도록 상단 padding을 제한하고 전체 이미지 구성을 넉넉하게 둔다. 공통 Section border를 없애고 whitespace·사진·soft surface·정보표 구분선으로 역할을 나눈다.
8. **Hero small-image layout**: width<480 또는 aspect ratio<0.65/>1.8이면 compact-image. 중앙 stage 최대520px, 사진은 기존 intrinsic cap 적용. 330×330 fixture는495×495(1.5배), 실제434×445는520×533.17(약1.20배). blur/sharpen/원본 가공 없음.
9. **Hero large-image layout**: width≥760,height≥600이고 위 극단 비율에 해당하지 않으면 large-image. target680px, 추가 stage 배경을 줄인다. 860×860→680×680,820×825→680×684. 그 외 balanced, metadata가 없으면 balanced로 시작한다. RenderImage는 decode된 natural dimensions로 cap을 다시 계산한다. 제품 인식이나 새로운 AI visibility 판정은 하지 않으며 canonical 이미지 선택이 우선이다.
10. **keyBenefits**:1개 넓은 highlight,2개2열,3개3열,4개2×2. 전체를 감싸는 카드 대신 얇은 상단 구분과 작은 번호·제목·설명. 번호는 aria-hidden. 빈 items에는 빈 카드를 만들지 않는다.
11. **Feature**: 이미지가 있으면 split/선택된 imageFirst·textFirst 구성, 없으면 본문과 bullet만 표시한다. Benefits 카드 구조를 재사용하지 않는다. 새 기본 밀도 normal, 이미지를 위한 가짜 placeholder 없음.
12. **ImageText**: imageFirst는 왼쪽 사진, textFirst는 왼쪽 텍스트로 실질적인 2열을 만든다. split은 기존 텍스트 왼쪽 구성을 유지한다. 약1.12:1 비율과36px gap, 작은 이미지는 contain/cap. stack/centered 등 수동 선택은 그대로다. 실제 TASK-028 saved split은 바꾸지 않았다.
13. **Gallery**: grid 토큰에서1개 단일 큰 사진,2개2열,3개 첫 사진 전폭+하단2개,4개2×2,5~8개 bounded2열. 단일/3개 첫 사진 target640, 나머지350. canonical 최대8개 유지, 순서·선택을 Renderer가 삭제/재선정하지 않는다. 기존 parent/hash/crop nearDuplicate inventory 및 role diversity 경고를 유지하며 회귀 검사했다. 같은 상품 컷을 다른 metadata로 저장한 모든 시각적 중복을 새로 검출하는 기능은 아니다.
14. **UseCase**: 항목에 사진이 있으면 사진 왼쪽·설명 오른쪽, 텍스트만 있으면 작은 scenario list. 가설 문구/근거/신뢰도를 재작성하지 않는다. synthetic 세로 사진 fixture로 contain을 확인했다.
15. **Detail**: 짧은 copy와 큰 중심 stage 또는 명시된 좌우 조합. 낮은 해상도는 기존 cap, 새로운 빈 이미지 없음. low-value Planner/Section 정책은 유지한다. 실제 A/B에는 Detail이 없으므로 디자인 확인은 synthetic fixture이며 실제 AI 성공 사례로 주장하지 않는다.
16. **Specification**: semantic table/th scope=row, label26%/value74%, 상단2px·행별1px 구분과 교대 옅은 surface.1~3행은 행 padding12px,4행 이상16px.2행의 긴 한글/모델명과 실제6행 검사. 표 값·원산지 내부 slash는 원문 그대로다. label/value의 긴 내용은 줄바꿈하며 행 높이를 강제로 제한하지 않는다.
17. **Option adaptive layout**: snapshot1그룹1값은 제목·그룹·값 inline,1그룹 여러 값은 wrapping 정보 칩,여러 그룹은 구분된 block. legacy items 표도 계속 표시한다. snapshot의 UUID/version/fingerprint는 본문에 출력하지 않는다. 실제1값 높이89.25px,6값 fixture216.30px,2그룹326.80px.
18. **Notice**: 낮은 제목 hierarchy,compact padding,subtle divider. 실제 항목/이미지가 모두 없으면 빈 제목만 출력하지 않는다. 자동 경고 카드/구매 안내 발명 없음.
19. **Background tokens**: plain=#fff,soft=#f3f4f0,contrast=#252e29. contrast에서 본문/보조/선 색을 함께 매핑한다. 새 deterministic defaults는 contrast를 자동 반복 배정하지 않는다. 사용자가 저장한 contrast나 수동 style은 유지한다.
20. **Image sizing/upscale**: MAX_RASTER_UPSCALE=1.5 그대로. 기존 target을 유지하고 application-only heroLarge680/gallerySingle640 상한만 추가. 최대 높이720px 유지. 기본 contain, 명시된 cover만4:3 crop. 세로 이미지의 img box와 실제 contain 사진 폭은 다를 수 있다. 픽셀·Storage·signed URL 생성 로직 변경 없음.
21. **Title relevance**: option의 제품 상세/상세정보 등 명백한 generic title과, 명시적인 구성 Fact 연결이 없는 묶음/세트/패키지 구성 제목을 보수적으로 warning 처리한다. 옵션 개수·사진 속 쌓인 제품·상품명의 수량을 pack evidence로 승격하지 않는다. 관련 canonical spec의 구성/포장단위 행에 묶음/세트/팩이 있고 그 F를 인용한 경우에만 경고를 생략한다. 이는 판매 구성의 자동 진위 증명이 아니다. 실제 “패드 묶음 구성”은 경고하지만 원문은 그대로다. 기존 server fallback “옵션 안내” 유지. 프리미엄은 기존 guardedTerms에 추가해 cited supported F 없는 AI 제목을 거부한다. 수동 문구 저장은 그대로 가능하다.
22. **Style defaults**: 새 presentationVersion1 생성에서 hero spacious/strong,feature normal,imageText/detail spacious,visual index 홀짝 textFirst/imageFirst,선별 soft,spec compact,option 실제 confirmed value count에 따라 compact/normal,notice compact. 기존 저장 row는 조회만으로 수정하지 않는다. Section service가 confirmed option count를 전달하므로 AI의 빈 option.items를 단일 옵션으로 오인하지 않는다.
23. **Invalid style guards**: style JSON schemaVersion1/enums 변경 없음. 새 Editor 선택은 spec/option/notice의 imageFirst/textFirst/split/grid,이미지 없는 cover를 금지한다. Inspector에서 비활성화하고 서버 prepareEdit에서도 Zod validation error로 거부한다. 같은 invalid legacy token을 그대로 두고 텍스트만 편집하는 것은 허용한다. AI output은 원래 style 필드 자체를 작성하지 못하며 arbitrary CSS/hex/px/HTML/JS는 계속 거부한다. 복잡한 조합 matrix는 만들지 않았다.
24. **Editor parity**: 동일 SectionRenderer/SectionCopy/RenderImage/CSS 유지. 실제 Editor route에서860px 내부 폭,같은 이미지·옵션 모드,style 선택 제한 확인. Editor의49% wrapper zoom에서는 표 border pixel rounding으로 offsetHeight가 약6px 달랐으나 내용·CSS·레이아웃은 공유한다. 원본100% Final은 zoom1/width860이다. Editor chrome을 export하지 않는다.
25. **Renderer purity**: 실제 capture article에 controls0,warning0. quality/옵션 stale/준비 상태/다운로드 UI는 article 밖. visible UUID/revision/source URL 없음. 자동 업스트림 분석이나 DB mutation 없음.
26. **Legacy compatibility**: intentional renderer-system update: 같은 bounded token의 CSS 해석이 개선되어 기존 페이지도 시각적으로 달라진다. DB token/content/순서/Plan migration은 하지 않는다. legacy option items,저장된 layout/background/align/fit/density/emphasis 읽기 유지. 빈 Notice 생략은 표시 정책이며 저장 row 삭제가 아니다.
27. **Tests**: 신규35개. Hero6크기+unknown,1/2/3/4 Benefits,1/2/3/4/8 Gallery,imageFirst/textFirst,Detail cap,2/6 spec 원문,1/6/다중 option 불변,compact natural height,background,style defaults/실제 prepareEdit guard/legacy,Editor 동일 JSX,860px purity,title warning/pack F,nearDuplicate,empty Notice,Zod error,프리미엄 grounding. 실제 외부 provider 호출 없음.
28. **전체 test 수**: **790/790 pass**,fail0/skipped0,55.14초. 기존755 + 신규35. SSRF/DNS/redirect/10MiB/timeout/Asset count/Options CAS/Section recovery/regeneration/Export 기존 검사는 모두 통과했다.
29. **Typecheck/lint/build**: next typegen,tsc --noEmit,lint(warning0),production build 통과. git diff --check/새 파일 whitespace 및 client secret 검사 결과는 말미에 기록한다. 기존 Node MODULE_TYPELESS_PACKAGE_JSON 안내는 관련 없는 설정 변경으로 없애지 않았다.
30. **Actual QA product/fixture**: 도매매67399861, TASK-028의 실제 저장 canonical4 Sections/content/style/순서와9개 캐시 이미지 bytes 재사용. localhost:4319 읽기 전용 mock Supabase 형태 API +localhost:3001 실제 production Next 앱. 서비스키는 가짜 local fixture 값, OpenAI/도매 키는 비워 두고 외부 fetch 차단. 운영 DB/Storage 복제·조회·쓰기 없음.4개 synthetic fixture 페이지도 별도로 생성했다. fixture의 분석 준비 상태 불명/legacy stale 안내는 원격 AI 파이프라인 재검증을 하지 않는 로컬 재현 범위다.
31. **BEFORE PNG/JPG**: TASK-028 after.png/after.jpg,둘 다860×2334,PNG359,986bytes/JPG159,570bytes.
32. **AFTER PNG/JPG**: 둘 다**860×1941**,PNG331,461bytes/JPG141,464bytes. 현재 production build에서 재생성해 같은 크기 확인. RGB 평균절대차0.69682/255,압축 차이이며 레이아웃 차이 없음. 첫/마지막4개 Section,6행 spec,단일 옵션,사진2개 존재. 별도 fixture PNG는860×4337/4367/1162/5400.
33. **Hero comparison**: headline56→46px,3줄→2줄,stage padding 축소. 같은434×445 사진이560×574.19→520×533.17. 작은 원본을 더 크게 늘려 디자인을 개선했다고 주장하지 않는다. 제품·제목이 더 일찍 한 구성으로 보인다. Hero 전체988.03→838.91px.
34. **Spacing comparison**: Section 사이 상시 border 제거. ImageText495→518px로 visual 여백은 조금 늘었지만 spec/option의 정보 밀도는 개선됐다. 모든 영역을 일괄 축소한 것이 아니다. 실제4개 Section 구조와 순서는 동일하다.
35. **Option compact comparison**:304.23→89.25px,약71% 감소. 제목/그룹/선택값을 삭제하지 않고 가로로 표시했다. “옵션 안내 / 옵션” 반복은 보존된 문구이므로 자동으로 지우지 않았다.6개 결합값을 색상/크기로 분리하지 않았다.
36. **Specification comparison**:546.38→494.08px.6행 label/value/evidence 원문 유지,행 가독성과 label/value 구분,내부 slash 및 한국어 줄바꿈 확인.2행 fixture는 긴 value 때문에374px이며 필요 내용을 자르지 않았다.
37. **Used images**: 실제 고유2/배치2,Derived1+normal1,반복0,raw long Source0. nine cached files SHA-256 일치. 추가 이미지나 duplicate loading을 만드는 컴포넌트는 없다. service의 선택 Asset만 임시 서명하는 흐름 그대로다.
38. **First visual offset**:325.84375→**253.734375px**,72.109375px 앞당김. 같은860px 실제 DOM에서 측정,viewport scale로 숨기지 않았다.
39. **Page total height**:2333.640625→**1940.234375px** DOM,export 반올림 높이2334→1941,약16.8% 감소. MAX_EXPORT_HEIGHT16000 및 physical860/deviceScaleFactor1 정책 유지.
40. **Image sharpness**: 확대율 감소로 실제 Hero의 과확대가 줄었지만434px 원본의 흐림·흰 경계는 남는다. 대표330px 이미지도 원본 정보 이상의 선명도는 없다. 고해상도 fixture는 도형 이미지이며 다른 실상품의 선명도를 검증했다고 주장하지 않는다.
41. **Accessibility**: semantic headings/table row headers/list/group headings/이미지 alt 유지. option chip은 li이며 button/선택 hover/재고 추측 없음. 보조 글자 contrast 계산 plain7.01:1,soft6.35:1,dark10.09:1. WCAG 인증은 아니다.375px document scrollWidth360,본문860,스크롤 영역318,zoom1로 shell overflow 없음. system font/OS 차이 별도 확인 필요.
42. **Product/Facts/Options 불변**: 실제 DB를 전혀 연결하지 않았다. 로컬 fixture도 writes405,read/sign만 허용,전후 전체 fixture hash 동일. TASK-028 content/style deepEqual,9개 원본 bytes hash 동일. Fact/validation/analysis/optionSnapshot/Plan 재생성·업데이트 없음.
43. **Secret validation**: production client JS/map와 src/docs/tests/QA 텍스트를 실제3개 환경 비밀값과 비교하되 값은 출력하지 않는다. 결과는 최종 검증 기록 참고. QA Next 프로세스는 fake key/loopback URL,실제 키를 fixture/log에 복사하지 않았다.
44. **Cleanup**: 원격 테스트 데이터는 만들지 않았다. 로컬 QA 프로세스2개·임시 브라우저 탭 종료,viewport override 해제 완료.3001/4319 listen 잔여0개 확인. 이미지/검사 로그는 저장소 밖 artifact로 보존한다. 기존 사용자의 localhost3000 서버는 종료하지 않았다.
45. **사람이 직접 확인할 항목**: 아래 BEFORE/AFTER PNG·JPG의 제목 크기/사진 stage/표 가독성,한 값/긴 값 옵션,실제 의류·세로 사진의 contain 여백,수동 cover crop,OS별 한국어 font와 Editor 확대율. publication 전 “패드 묶음 구성”을 판매 구성으로 오인할 여지가 없는지 원본 근거와 함께 검토한다.
46. **남은 visual quality 문제**: 원본434px의 선명도와 흰 crop 띠,모호한 기존 제목/구도 설명은 자동 보정하지 않았다. 단일 옵션에 남는 제목·그룹 label 반복,극단 aspect Gallery의 contain 여백,Editor fractional zoom 표 border rounding은 남는다. 새로운 theme/배경 제거/AI 카피 재생성/폰트 공급 시스템은 이번 범위 밖이다.
47. **다음 TASK 제안**: TASK-030 — 다른 실제 의류 상품의 동일 canonical visual QA,6개 결합 옵션·착용컷·긴 한글 제목의 판매 전 검토. 별도로 source 근거에 따른 수동 제목 편집 및 사진 선택 가이드를 보완한다. 필요성 확인 없이 새로운 AI pass나 배경 제거 기능을 추가하지 않는다.

## 코드 경계와 호환성

- `visual-system.ts`: bounded 런타임 hero/count/spec/option 모드. 새 DB schema/style enum 없음.
- `renderer.module.css`: token→시각 hierarchy/spacing/색/레이아웃. Final surface 폭은 계속 detail_pages.width.
- `section-renderer.tsx` / `section-copy.tsx` / `render-image.tsx`: 공통 markup과 count mode,이미지 상한만 표현. source/image 재선정 없음.
- `style-policy.ts` / Editor schemas / Inspector: 새 스타일 선택에 대한 작은 guard,변경하지 않은 legacy 값 유지.
- section-engine schemas/service: 새 generation의 deterministic defaults,confirmed option 개수 사용. 저장된 Section 조회 시 default 재적용 없음.
- title-relevance/policy: 수동 내용과 원문을 보존하는 review warning. grounding의 프리미엄 보호는 전체/개별 AI 생성이 공유한다.

렌더러가 saved style을 자동 변환하지 않는다. 기존 canonical stack/grid/centered 선택보다 sequence context를 우선하지 않는다. 새 생성 시에만 index를 사용하고 contrast는 기본 배정하지 않는다. no arbitrary AI CSS/HTML/JS 원칙과 escaping을 그대로 유지한다.

## 로컬 검증 산출물

저장소 밖 `C:/Users/alswn/Documents/Codex/2026-09-09/c-projects-detailforge/artifacts/TASK-029/`:

- `after.png`, `after.jpg`, `fixture-1.png`~`fixture-4.png`
- `export-metrics.json`, `quality-analysis.json`, `local-projects.json`
- `tests-final.txt`, `tests-targeted.txt`, `build-final.txt`, `secret-check.json`, `cleanup.json`

BEFORE는 TASK-028의 after.png/after.jpg. 실제 새 AI 출력 비교가 아니라 **동일 canonical data의 Renderer-system A/B**다. synthetic options/도형 fixture는 상품번호67695797을 다시 조회한 결과가 아니다. mock-only 환경의 준비 상태 경고가 final article 밖에 유지되는 것도 확인했다.

## 최종 검증 기록

전체790 tests, next typegen, tsc --noEmit, lint(warning0), build 통과. 실제 production Renderer/Export PNG·JPG860×1941,모든 fixture PNG 확인. git diff --check 통과(Windows LF→CRLF 안내만 있음),신규 파일도 whitespace 확인. Client JS/map26개,src/docs/tests 및 artifact 텍스트에서 실제 비밀키3종 검출0,client provider marker0. read-only fixture hash 및9개 이미지 bytes 일치. 임시 QA 서버2개/탭/viewport 정리 완료. 원격 데이터·Storage·유료 AI 요청0,새 dependency/migration0. 생성5/수정18파일,요청 브랜치 유지,commit/main merge 없음.
