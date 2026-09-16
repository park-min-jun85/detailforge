# TASK-016 — Final Detail Renderer Foundation

- PHASE 5 / branch: `feat/detail-renderer`
- 구현·자동 테스트·실제 DB/브라우저 검증 완료. Git commit 없음.
- migration/RLS/DB types/dependency 변경 없음. OpenAI/Vision 호출 0회.

## Route와 capture boundary

/projects/[projectId]/render는 App Shell 안의 최종 검토 화면이다.
별도 content route를 늘리지 않고 `article[data-detail-render-surface="1"]`를 순수 상품 본문 경계로 제공한다.
review header, 준비 상태, publication warnings, 편집기로 돌아가기는 이 article 바깥이다.
TASK-017은 전체 문서가 아니라 이 article을 캡처해야 한다. 폭은 detail_pages.width를 그대로 사용한다.
기본 860px의 실제 bounding width를 860px로 확인했다. Renderer 자체의 zoom/transform은 없고
작은 화면에서는 review의 overflow-x 영역만 스크롤한다.

## Canonical read model

서버 전용 getRenderView는 Project→Product→DetailPage→Sections 소속과 JSONB를 검증한다.
DB row를 camelCase RenderSection(id/type/sortOrder/content/style)과 RenderAsset으로 변환하고,
meta는 준비 상태 계산에만 사용하며 final content DTO에서는 제외한다. DB의 meta는 수정하지 않는다.
stored content/style schema를 재사용하고 알 수 없는 type, 불일치 type, 중복 ID/순서는 안전한 실패를 표시한다.
sections.sort_order ASC가 원본이다. Planner 배열의 순서를 적용하거나 Hero를 재선정하지 않는다.
Editor local draft/orderDraft/dirty form/미적용 AI candidate를 입력받지 않는다.

기존 generation/reorder journal과 page edit lease를 읽는다.
활성 저장·생성·미해결 복구 journal이 있으면 중간 rows 또는 backup을 최종 결과로 표시하지 않고
busy 안내를 제공한다. GET이 복구나 lease 갱신을 수행하지 않는다.
조회/이미지 서명 뒤 page와 rows를 다시 비교해 관찰된 혼합 snapshot을 거부한다.
이는 여러 테이블의 ACID snapshot은 아니며 최종 읽기 직후의 변경까지 차단하지는 않는다.
각 요청에서 저장된 상태를 확인하는 검토 화면으로, 실시간 구독/자동 갱신은 없다.

## Shared renderer와 표현

Editor SectionPreview는 features/detail-renderer/SectionRenderer의 얇은 adapter다.
기존 별도 Section JSX/CSS를 제거했다. Editor 선택 버튼/outline/클릭/draft/zoom은 기존 wrapper에만 남는다.
Final RenderSurface는 동일 SectionRenderer에 서버 canonical content/style/assets만 전달한다.
이미지 실패 표시용 RenderImage의 최소 Client state 외에 query, AI, business mutation을 presentation에 넣지 않는다.

10종: hero, keyBenefits, feature, imageText, gallery, useCase, detail, specification, option, notice.
Hero 큰 제목, Benefits 번호/카드, Feature와 imageText 조합, Gallery 2열, useCase 항목별 구분,
Specification label/value 표, Notice 작은 본문/구분선을 코드로 정의한다.
bounded layout/textAlign/density/background/emphasis/imageFit를 data attribute→고정 CSS로 해석한다.
style token 외 임의 CSS/HTML/Tailwind class를 DB에서 읽어 실행하지 않는다. 텍스트는 React escaping으로 출력한다.
system Korean font stack을 사용한다. 외부 font, 장식 animation, fixed/sticky/필수 viewport-height는 없다.
표 fixed layout, keep-all + overflow-wrap:anywhere, pre-wrap으로 긴 한국어/모델명/줄바꿈을 처리한다.
null subtitle/gallery title/intro, 빈 배열의 list/cards/table는 요소 자체를 생략한다.
완전히 빈 gallery도 생략하며 readiness Section 수는 저장 row 수를 뜻한다.

## 이미지

TASK-007 listAssets에 선택 ID 필터만 추가했다. 기존 호출 방식은 유지한다.
서버에서 현재 Product와 Storage prefix를 검증한 Asset 중 실제 참조 ID만 5분 signed URL을 발급한다.
read model/HTML의 임시 URL을 DB에 저장하거나 로그에 출력하지 않는다.
Hero는 canonical assetIds, useCase는 항목별 이미지를 표시하며 같은 이미지를 Section 아래에 중복 표시하지 않는다.
assets.asset_type/원본 파일/Section의 이미지 선택을 바꾸지 않는다.

4:3 frame으로 로딩 전후 공간을 확보한다. contain은 원본 비율로 전체 이미지를 보여주고 cover만 frame을 채우며 자른다.
원본 크기 metadata가 있으면 img width/height에 전달한다. 이미지 processing/Sharp는 없다.
삭제·없는·외부 소속 ID나 서명 실패는 위치별 안전한 fallback을 표시한다.
실제 이미지 GET 실패도 onError fallback으로 표시하며 전체 Renderer를 중단하지 않는다.
readiness 누락 이미지 수는 서버 조회/서명 시점의 고유 참조 ID 수다. 이후 네트워크 실패 수를 실시간 집계하지 않는다.
자동 URL 회전은 하지 않으며 만료/실패 시 페이지를 새로 열어 재서명한다.

## Stale / readiness / navigation

준비 상태는 Section 수, needs_review 문구 수, 누락 이미지 수, 저장 폭, stale Plan/Validation을 표시한다.
getPlannerView의 read-only 조회로 입력 변경에 따른 stale을 확인하고 Section의 sourcePlanFingerprint도 비교한다.
stale 또는 manual grounding needs_review여도 canonical 콘텐츠는 보여준다.
준비 상태 조회만 실패하면 확인 불가 안내와 저장된 콘텐츠를 제공한다.
이 경고들은 export surface 안에 포함하지 않는다. Renderer는 Fact나 문구를 다시 검증/교정하지 않는다.

Editor [최종 미리보기]는 기존 dirty/candidate 이탈 guard를 재사용하고 prefetch를 끈다.
Review [편집기로 돌아가기]를 제공한다. 새 Project는 not-found, Product 없음은 입력 CTA,
Page/Sections 없음은 '먼저 상세페이지를 생성해 주세요.'와 sections CTA를 표시한다.
잘못된 Section은 조용히 생략하지 않고 안전한 load failure를 표시한다.

## 검증

2026-09-15 기존 286 + 신규 26 = **312개 테스트 통과**.
next typegen, tsc --noEmit, npm run lint, npm run build, git diff --check 통과.
기존 Node MODULE_TYPELESS_PACKAGE_JSON/npm 업데이트 안내 외 무관한 설정은 변경하지 않았다.

- 실제 React server rendering으로 10종 매핑/Editor 동일 renderer/empty 요소/escaping/이미지·useCase 배치/spec 원문/
  deterministic capture boundary를 확인한다. 테스트 loader만 TSX/CSS module/Next interop을 처리하며 dependency는 추가하지 않는다.
- mock DB로 sort_order/width 860·960/소속/누락·외부 Asset/선택 ID 서명/URL 비저장/
  stale·needs_review/DB mapping/empty/unknown schema/생성·reorder 복구·lease 차단/
  read race/오류 비공개/AI 호출 및 DB write 없음/draft·candidate 제외를 확인했다.
- 실제 linked DB에 전용 Project, 10종 generated Sections, 테스트 PNG 2개를 만들고
  기존 manual save/reorder service로 문구/스타일/Hero 이미지/순서를 편집했다. 모든 AI는 mock이었다.
- 별도 production localhost:3001 검증 서버에서 OpenAI와 DB mutation transport를 차단했다.
  Editor→최종 미리보기→Editor, 미저장 문구/순서 guard 후 canonical 결과, 수동 reorder 반영을 확인했다.
- Desktop 실측: surface 860px, scrollWidth 860, zoom 1, transform none, 내부 편집 controls 0개.
  10종 모두 내부 overflow 없음, 이미지 6개 표시 모두 로드, contain/cover·Hero 주황 이미지·Gallery 2열·긴 문구·스펙 표 확인.
  검증 fixture 전체 본문 높이는 약 6,516px로 콘텐츠에 따라 늘어나며 아래쪽 표/Notice가 잘리지 않았다.
- 375px: document scrollWidth 360(스크롤바 제외), surface 860px, 본문 전용 스크롤 영역 318px.
  review shell overflow 없이 유지했다. 원본 이미지 대신 자동 검증용 도형 PNG를 사용했으므로 실제 상품 사진의 시각 품질은 별도 확인한다.
- 실제 DB 조회 전후 Project/Product/Facts/Validation/Analysis/Plan/settings/전체 Sections/Assets 모두 동일했다.
- 최종 production client JS/map 22개와 src에서 실제 OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY 검출 0건.
  Renderer read service/Asset service/Supabase client의 server-only 경계를 확인했다.
- 검증용 Project/Product/Facts/Assets/DetailPage/Sections 잔여 0건, 테스트 이미지 2개 삭제와 Storage prefix 잔여 0건 확인.
  전용 browser tab/localhost:3001 서버를 종료했다. 기존 사용자 데이터는 변경하지 않았다.

## 파일

생성:
- src/features/detail-renderer/model.ts, errors.ts, service.ts
- src/features/detail-renderer/section-renderer.tsx, section-copy.tsx, render-image.tsx
- src/features/detail-renderer/surface.tsx, review.tsx, renderer.module.css
- src/app/projects/[projectId]/render/page.tsx
- tests/detail-renderer.test.mjs, tests/register-renderer.mjs
- docs/tasks/TASK-016.md

수정:
- src/features/assets/service.ts
- src/features/detail-editor/components/editor.tsx, preview/section-preview.tsx
- docs/tasks/README.md, docs/02_ARCHITECTURE.md, docs/05_UI_UX.md, docs/07_DECISIONS.md

공유 구현으로 대체하여 삭제:
- src/features/detail-editor/preview/section-renderers.tsx
- src/features/detail-editor/preview/preview.module.css

## TASK-017 Export 인계 / 직접 확인 / 미구현

TASK-017은 data-detail-render-surface="1"을 캡처하고 저장 폭/전체 콘텐츠 높이를 사용한다.
ready 상태에서만 캡처하며 모든 img.complete/naturalWidth/decode, font 준비, fallback 유무를 확인해야 한다.
signed URL은 5분 내 사용하거나 새 read model로 발급한다. 시간/무작위 ID/Editor chrome은 본문에 없다.
레이아웃은 같은 콘텐츠/style/width/같은 브라우저·폰트 환경에서 결정적이다.
OS별 system font와 브라우저 차이까지 동일한 픽셀을 보장하지 않으므로 Export 실행 환경은 TASK-017에서 고정해야 한다.

Cursor에서는 실제 상품 이미지의 contain 여백/cover 자르기, 긴 제목·실제 spec, 브라우저별 system font,
이미지 만료/네트워크 실패, 키보드 가로 스크롤·스크린리더를 추가 확인한다.
PNG/JPG 파일 생성, screenshot library, 다운로드, 해상도/DPR, 분할 export, 자동 이미지 갱신,
독립 public publishing route, 새 Auth/협업/마이그레이션/AI 디자인 생성은 구현하지 않았다.
현재 single-user local MVP의 소속 검사는 사용자 인증을 대신하지 않는다.
