# TASK-013 — Detail Editor Foundation

PHASE 4. 브랜치 `feat/detail-editor`. 구현·검증 완료. 추가 dependency와 migration 없음. Git commit 없음.
기존 Section을 사람이 편집하는 계층이며 Editor/자동 테스트/브라우저 검증 모두 실제 OpenAI 호출 0회다.

## Route와 화면

- `/projects/[projectId]/editor`: Server Component에서 소속/Section/journal/Plan을 검증하고 Client Editor를 조합한다.
- `PATCH /api/projects/[projectId]/sections/[sectionId]`: 명시적 단일 Section 저장. 같은 Origin, 32KB streamed body 제한, private/no-store.
- Sections 화면의 `상세페이지 편집 →` 링크로 진입한다. 비어 있으면 `먼저 상세페이지를 생성해 주세요.`와 생성 화면 CTA를 표시한다.
- 기존 App Shell 안에 Navigator 240px / 남은 중앙 Preview / Inspector 320px을 배치한다.
  Preview는 860px 논리 폭을 유지하며 ResizeObserver와 application-owned zoom으로 영역에 맞춘다.
  내부 스크롤을 사용하며 1200px 미만은 미리보기/섹션/속성 패널 탭으로 전환한다.
- 프로젝트명/상품명, 저장 상태, 논리 폭, stale 경고를 표시한다. 선택은 client state이며 순서대로 번호/한국어 type/짧은 제목을 표시한다.
- Preview 클릭과 키보드 접근 가능한 선택 버튼, Navigator 모두 같은 선택 흐름을 사용한다.

## Content / Inspector / Renderer 경계

기존 TASK-012의 strict 10종 discriminated content와 style schema가 원본이다.
`fields.ts`가 type별 편집 가능한 문구 경로/레이블/길이/nullable/multiline form mapping을 정의한다.
서버는 저장된 type과 기존 배열 위치에 해당하는 정확한 경로만 허용한다. 임의 필드/path/prototype/배열 추가는 허용하지 않는다.

- hero: headline/subheadline/highlights.
- keyBenefits: title와 각 item title/description.
- feature: title/body/bullets. imageText: title/body.
- gallery: nullable title/intro. useCase: title/intro/item title/description.
- detail: title/body/points. notice: title/item text.
- specification/option: title만 수정. Fact에서 가져온 row label/value는 읽기 전용이다.
- 기존 항목 개수와 순서는 유지한다. evidenceIds, confidence와 Planner provenance는 직접 수정하지 않는다.

`preview/section-renderers.tsx`에 10종 renderer를 나누고 `SectionCopy`가 type을 dispatch한다.
`SectionPreview`는 콘텐츠/스타일/일시적 이미지 DTO를 받는 표현 경계다. 선택/outline은 Editor wrapper에만 있다.
제목/본문/목록/benefit cards/스펙 표/옵션/notice/이미지를 실제 세로 상세페이지 흐름으로 표시한다.
전체 Renderer/export는 구현하지 않았고 미래 Renderer가 같은 Section 데이터를 소비할 수 있는 경계만 준비했다.

## Bounded style / 이미지

layout, textAlign, density, background, emphasis, imageFit의 기존 enum만 select로 수정한다.
CSS module의 application-owned mapping으로 배치/간격/배경/제목/이미지 fit을 결정한다.
raw CSS/HTML/JS, 임의 색/px/class, signed URL payload는 허용하지 않는다.

현재 Project/Product에 속한 기존 Asset 중 최대 8개를 선택/해제한다. 수동 편집은 Plan의 이미지 subset 밖도 허용한다.
Hero도 사람이 변경할 수 있지만 Asset type/metadata와 Page Plan을 바꾸지 않는다.
useCase의 이미지 해제는 해당 item의 표시 연결에서도 제거하며 evidence/confidence는 보존한다.
새 이미지는 Section 수준의 선택이며 중첩 item에 근거를 자동 부여하지 않는다.
기존 TASK-007 listAssets/helper로 5분 signed URL을 발급하고 4분 간격/탭 복귀에 갱신한다.
DB에는 Asset ID만 저장하고 URL은 임시 DTO에만 존재한다. next/image unoptimized로 원본을 표시한다.
이미지 표시 실패는 기존 콘텐츠를 지우지 않는다. Editor 안에서 업로드하지 않는다.

## Draft / 명시적 저장 / 이탈 보호

입력은 Client draft에만 반영한다. canonical DB row와 달라지면 `저장되지 않은 변경사항`을 표시한다.
저장 성공 시 서버 canonical row/새 updated_at을 사용하고 dirty를 해제한다. 실패하면 draft를 유지한다.
자동 저장, 자동 AI 요청, 다른 Section 자동 갱신은 없다.
dirty 상태의 Section 선택과 앱 링크 이동에는 저장 후 이동/버리기/취소를 제공한다.
확인 영역으로 포커스를 이동하고 취소하면 이전 컨트롤로 돌린다. 같은 페이지의 건너뛰기 링크는 막지 않는다.
beforeunload로 새로고침/문서 이탈을 보호한다. 브라우저 기본 경고 UI/탭 강제 종료/모바일 프로세스 종료까지 보장하지 않는다.
별도 history 조작이나 완전한 SPA router blocker는 도입하지 않았다.

## Save / concurrency / 복구 조정

요청은 `{ revision, fields, assetIds, style }` allowlist다. revision은 읽은 Section의 원문 updated_at이다.
Project/Product 관계, DetailPage/Section 소속, Asset 경로/소속, content/type 일치, style을 서버에서 다시 검증한다.
sections UPDATE는 content/style만 쓰며 id/detail_page_id/updated_at 조건으로 compare-and-swap한다.
id/detail_page_id/type/sort_order/created_at/plannerKey/sourcePlanFingerprint 등은 변경할 수 없다.
다른 탭이 먼저 저장하면 409와 `다른 변경사항이 먼저 저장되었습니다. 최신 내용을 다시 불러와 주세요.`를 반환한다.
DB/provider 내부 오류와 비밀키는 반환하지 않는다. 응답 유실 시 성공으로 추측하지 않고 draft를 보존하며 최신 상태 확인을 안내한다.

기존 `detail_pages.settings.sectionEdit = { id, startedAt }`에 짧은 쓰기 lease를 CAS 저장한다.
Section Engine도 이 lease를 확인하고 page.updated_at CAS를 사용하므로 생성 claim과 수동 저장 claim이 경쟁하면 하나가 거부된다.
generation backup 또는 generating 상태에서는 Editor가 보관된 snapshot을 읽되 저장은 막고 생성/복구 화면으로 안내한다.
저장 후 lease만 제거하며 최신 settings와 merge하여 Plan을 덮어쓰지 않는다. 중단된 lease는 3분 후 만료된다.
DB 요청은 10초로 제한한다. Section compare-and-swap은 DB statement 단위지만 page lease/Section/Asset 조회 전체는 transaction이 아니다.
프로세스 장기 정지·시계 차이·직접 DB 쓰기·동시 Asset 삭제까지 원자적으로 보장하지 않는다. 엄격한 다중 작성자 지원은 별도 RPC/transaction 설계 대상이다.

## Manual provenance / Facts 보호

문구 또는 이미지 변경 시 기존 content.meta를 보존하면서
`manualEdit: { edited: true, editedAt, textEdited, assetsEdited }`를 기록한다. 마지막 두 boolean은 누적 표시다.
문구 변경에는 `groundingStatus: needs_review`를 기록하고 다음 안내를 표시한다.

> 직접 수정한 문구입니다. 사실 표현을 한 번 확인해 주세요.

style-only 수정은 meta/grounding 상태를 그대로 유지한다. 이미 needs_review인 결과를 다시 generated/supported로 승격하지 않는다.
기존 evidenceIds는 생성 당시 provenance이며 새 문구를 자동 보증하지 않는다. Fact 값 자체를 수정하지 않는다.
Facts/source_snapshot/Validation/Product Analysis/Page Plan/Asset 원본은 편집 작업이 쓰지 않는다.
Project/DetailPage status도 유지한다. 기존 문서에는 editing enum/표시명만 있고 첫 수동 저장 시 전환 의미가 명시되지 않았기 때문이다.

## Stale

기존 sourcePlanFingerprint와 현재 Plan latestResult 전체의 canonical SHA-256을 비교한다.
Plan 없음/형식 오류도 기존 콘텐츠를 stale로 표시한다. Editor는 최신 Fact Validation을 재실행하거나 Plan을 자동 변경하지 않는다.
경고: `페이지 설계가 변경되었습니다. 현재 상세페이지는 이전 설계를 기준으로 생성되었습니다.`
stale은 조회나 수동 저장을 막지 않는다. 편집을 위해 삭제된 Facts/유효한 최신 Validation을 강제하지 않는다.
현재 상위 Facts 변화까지의 상세 freshness는 Planner/생성 화면에서 확인한다. Editor의 표시는 현재 Plan 결과와의 차이다.

## 검증

2026-09-15 최종 검사: 기존 189 + 신규 35 = **224개 테스트 통과**.
`npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check` 통과.
클라이언트 JS/map 20개와 src 전체에서 실제 OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY 검출 0건.
server-only 경계를 확인했다. migration은 기존 0001~0004 그대로이며 push/타입 재생성은 필요하지 않았다.
자동 테스트에서 provider는 mock/transport stub만 사용한다.
실제 DB에는 TASK-013 전용 가상 Project, mock provider로 기존 service를 통해 만든 10개 Section,
유효한 테스트 PNG 2개를 사용했다. 실제 OpenAI 호출은 0회다. 기존 사용자 데이터는 수정하지 않았다.

- 10종 schema/form mapping, immutable fields/nested evidence/spec row, bounded styles/raw CSS/HTML/URL,
  Asset ownership/manual selection/nested deselection, text provenance/needs_review/style-only preservation.
- canonical save/revision/409/CAS race, page claim race/expired lease/generation lock,
  failure/draft privacy, stale/empty, hierarchy scope, upstream 불변과 migration mapping.
- 실제 DB type/content/style CHECK(23514), Section의 DetailPage FK(23503), updated_at 변경 확인.
- 브라우저: 문구 live/dirty/save/reload, style live/save/reload, 이미지 교체/save/reload,
  전환 취소/버리기/저장 후 이동, 이탈 링크 guard, 키보드 확인 focus, 두 탭 409 및 draft 보존,
  375px 탭/스펙 읽기 전용/가로 overflow 없음, stale 상태 저장, Sections→Editor 링크 확인.
- beforeunload reload 시 draft는 유지됐으나 브라우저별 native 경고 표시 자체는 수동 확인 대상으로 남긴다.
- empty Editor CTA를 실제 브라우저에서 확인했다. 검증용 Project/Product/Facts/DetailPage/Sections/Assets를 정리하고 각 테이블 잔여 0건,
  private Storage 이미지 2개 삭제와 해당 경로의 남은 파일 0건을 확인했다.

## 생성 파일

- src/features/detail-editor/: fields.ts, schemas.ts, errors.ts, types.ts, service.ts, http.ts, client.ts
- components/: editor.tsx, editor.module.css, inspector.tsx
- preview/: section-renderers.tsx, section-preview.tsx, preview.module.css
- src/features/section-engine/edit-lease.ts
- src/app/projects/[projectId]/editor/page.tsx
- src/app/api/projects/[projectId]/sections/[sectionId]/route.ts
- tests/detail-editor.test.mjs
- docs/tasks/TASK-013.md

## 수정 파일

- src/features/section-engine/schemas.ts, service.ts, components/section-manager.tsx
- tests/helpers/section-db.mjs
- docs/tasks/README.md, docs/02_ARCHITECTURE.md, docs/03_DATABASE.md, docs/05_UI_UX.md

## TASK-014 인계 / 수동 확인 / 미구현

TASK-014 Reorder는 현재 PATCH의 sort_order 금지를 유지하고 별도 명시적 순서 변경 계약을 설계한다.
Section ID/기존 데이터와 provenance를 보존하며 전체 순서 revision, generation journal 및 manual lease와 조정해야 한다.
현재 DB는 sort_order UNIQUE가 없으므로 다중 행 reorder의 원자성/실패 보상을 별도로 결정한다.

Cursor에서 실제 긴 한국어 문구/여러 상품 사진/좁은 중앙 영역/375px/브라우저 기본 이탈 경고를 확인한다.
style token별 시각 차이, 이미지 contain/cover의 잘림, 수동 문구의 사실 표현은 사람이 검토한다.
drag/drop, 추가/삭제/복제, 배열 항목 추가/순서 변경, 개별 AI 재생성/카피 rewrite, 업로드/이미지 생성/보정,
자유 CSS/HTML, full Renderer/export, Auth/협업/version history/background queue는 구현하지 않았다.
