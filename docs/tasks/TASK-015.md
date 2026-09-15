# TASK-015 — Individual Section AI Regeneration

- PHASE 4 / branch: `feat/section-ai-regeneration`
- 구현 완료. Git commit 없음. dependency/migration/DB types 변경 없음.
- 기존 TASK-012 10종 schema, TASK-013 revision CAS, TASK-014 page edit lease/recovery 계약을 재사용한다.

## API와 입력

- POST /api/projects/[projectId]/sections/[sectionId]/regenerate — body { revision }, Section 후보만 반환한다.
- POST /api/projects/[projectId]/sections/[sectionId]/apply-candidate — 서명된 후보를 검증하고 선택한 content 한 행만 CAS 갱신한다.
- 두 API는 same-origin 검사, strict schema, bounded body, no-store 응답, 고정 공개 오류를 사용한다.
- Project→Product→Page→Section/Assets 소속과 최신 Planner/Validation을 생성 전후 및 적용 때 재조회한다.
- AI 입력은 선택한 Section 한 개의 type/content/style, 해당 Planner key/purpose/contentBrief/evidenceIds/assetIds,
  Plan heroAssetId, 해당 범위의 supported F 및 완료 V observation, 최신 전략 snapshot, Validation 상태 ID다.
  다른 Section 콘텐츠, 원본 이미지, 파일명, signed URL, source_snapshot, Validation reason은 별도로 보내지 않는다.
- OPENAI_SECTION_REGEN_MODEL, 기본 gpt-5.6-terra. 기존 서버 전용 OPENAI_API_KEY/SDK를 사용한다.
  Responses strict Structured Output + 선택 type의 기존 Zod schema로 재검증한다.
  store=false, maxRetries=0, provider 60초, 최대 output 6,000 tokens, 입력 180,000자 제한.
  프로세스 내 동일 Project 중복 차단/동시 최대 2개다. 분산 rate limiter는 아니다.
- [모델 문서](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
  [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Candidate-first / 명시적 적용

후보 생성은 DB write/긴 lease 없이 실행한다. 후보를 Client state에만 보관하고 비교 후
[새 결과 적용] 또는 [기존 내용 유지]를 선택한다. 기존 canonical Preview는 적용 전까지 바뀌지 않는다.

candidate schema: schemaVersion=1, projectId/productId/detailPageId/sectionId, baseUpdatedAt,
baseFingerprint, inputFingerprint, content, style, generatedAt/expiresAt, generationId, provider, model.
content에는 서버가 생성한 provenance를 포함한다. 후보는 10분 유효하며 permanent table/localStorage에 저장하지 않는다.
서버가 기존 SUPABASE_SERVICE_ROLE_KEY에서 용도를 분리해 파생한 HMAC-SHA256 키로 후보를 서명한다.
키/파생 키는 반환하지 않는다. 서명은 콘텐츠 변조·다른 route 재사용을 막으며 키 교체 시 미적용 후보는 무효다.

적용 시 서명/만료/소속/입력 fingerprint/기준 전체 row hash/updated_at을 재검사한다.
기존 settings.sectionEdit lease 획득 후 같은 검사를 반복하고 content만 id/page/revision CAS UPDATE한다.
실패 시 기존 값으로 무조건 rollback하지 않으며, 응답 유실은 generationId+정확한 content/style 재조회로 판별한다.
이미 적용된 동일 후보의 재요청은 write 없이 canonical row를 반환한다.
다른 탭의 수동 편집/순서 변경은 409로 차단하며 후보를 남겨 사용자가 버리기/재조회하도록 한다.
lease는 finally 해제하며 실패 시 기존 만료 정책을 따른다. DB 요청당 10초, route maxDuration 120초다.

## 불변성과 grounding

- id/type/plannerKey/sourcePlanFingerprint/sort_order 불변. Page Plan, Facts/source_snapshot/Validation,
  Product Analysis, Asset Analysis/asset_type, Project status, 다른 Sections, settings.editor.manualOrder 불변.
- 현재 style을 그대로 복사하며 AI는 style/meta를 출력할 수 없다. raw CSS/HTML/JS/Tailwind/URL은 거부한다.
- 현재 실제 assetIds를 순서까지 유지한다. Hero의 수동 선택 이미지가 Plan 이미지와 달라도 현재 이미지를 보존한다.
  기존 useCase 개별 항목에 이미지가 있으면 그 배열/항목 수까지 보존한다. 서버가 Product 소속과 삭제 여부를 확인한다.
  새/외부 Asset ID는 거부하며 현재 이미지 선택은 display-only이고 새로운 사실 근거가 아니다.
- 현재 Planner Section evidence만 허용한다. 중첩 ID도 상위 허용 범위에 있어야 한다.
  supported F만 factual claim 근거이며 unknown/restricted/out-of-scope 참조를 거부한다.
  V는 관찰, 전략/useCase/audience는 가설이다. supported는 입력 근거 안의 일관성만 뜻한다.
- TASK-012 공통 claim guard를 재사용한다. 수치/단위/민감 표현/제한 Fact 원문 사용을 검사한다.
  spec rows와 option items는 현재 행의 label/value/evidenceIds/순서를 그대로 보존하고 supported 원문과 다시 대조한다.
  stale 또는 부적합한 행을 AI가 보정하지 않는다. Notice의 미확인 법적/안전/인증 주장을 거부한다.
- useCase는 가설 표현을 요구한다. '모든 가정에서 반드시'를 가설로 잘못 통과시키던 '가정' 판정을 좁혔다.
- 고정 developer instruction과 untrusted JSON user data를 분리한다. 사람의 수정 문구도 명령으로 실행하지 않는다.
- 자연어의 목적 적합성/모든 의미상 과장을 완전히 증명하는 검사는 아니다.
  type/key/evidence/asset 경계는 서버가 강제하고 purpose/brief 준수는 고정 prompt와 사람의 비교 검토를 함께 사용한다.

## Provenance와 stale

content.meta.regeneration은 regenerated=true, regeneratedAt, provider, model, generationId, previousRevision을 가진다.
기존 Planner/초기 생성 provenance와 manualEdit 이력을 유지하며 새 후보의 grounding 검증 성공 시
기존 groundingStatus=needs_review를 제거한다. 사람이 과거에 편집했다는 기록은 지우지 않는다.

Page Plan stale/Section의 sourcePlanFingerprint 불일치 및 Validation stale/missing은 AI 생성/적용을 막는다.
수동 편집/수동 reorder 정책은 유지한다. Product Analysis stale은 최신 입력에서 전략을 제외한다.
기존 Plan 자체가 그 변화로 stale이면 먼저 Plan 갱신이 필요하며, stale 전략을 제외해 만든 최신 Plan에서는 AI를 허용한다.
생성 도중 입력 변화는 후보를 폐기하고, 후보 이후 변화는 적용 때 fingerprint/revision 검사로 차단한다.

## UI

/projects/[projectId]/editor의 선택 Section 영역에 [AI로 다시 생성], 수동 편집 경고,
Planner/Validation 확인 링크를 제공한다. dirty content/style/order는 먼저 저장/되돌려야 AI를 실행할 수 있다.
호출 중 'AI가 이 섹션을 다시 작성하고 있습니다.'와 중복 클릭 차단을 제공한다.
비교 영역은 현재/새 문구, 미저장 안내, 보존 정책, 모델/유효 시간을 표시한다.
Desktop 2열, 375px 1열이며 버튼은 키보드로 실행할 수 있다.
후보가 있으면 다른 편집/선택/이동 전에 적용 또는 기존 내용 유지를 요구하고 beforeunload를 연결한다.
실패/409에 후보 또는 기존 draft를 보존하며 canonical DB 결과를 받은 뒤 선택 row만 교체한다.

## 검증

2026-09-15 기존 249 + 신규 37 = **286개 자동 테스트 통과**. 자동 테스트는 실제 OpenAI를 호출하지 않았다.
next typegen / tsc --noEmit / lint / build / git diff --check 통과.
기존 Node MODULE_TYPELESS_PACKAGE_JSON 안내 외 범위 밖 설정은 변경하지 않았다.

- 10종 candidate schema, type/key/이미지/style/spec 행 불변, F/V/restricted/없는 ID/외부 상품 경계,
  useCase/Notice/HTML/CSS, manual history, 서명 변조/만료/route binding, 생성 무저장/적용/CAS/응답 유실,
  lease 전후 race, 중복/timeout, malformed/private provider error, stale와 injection 분리,
  reorder/manualOrder/상위 데이터/다른 Sections 불변을 검사했다.
- 실제 linked Supabase의 전용 가상 Project에 10개 Section/2개 테스트 PNG를 만들었다.
  실제 gpt-5.6-terra **1회**로 Hero 후보 생성/서버 검증 성공, 적용 없이 버렸으며 DB 불변을 확인했다.
- 별도 localhost:3001 production server의 테스트용 transport로 브라우저 흐름을 검증했다.
  mock transport는 repository/application에 포함하지 않았고 추가 유료 호출을 차단했다.
  버리기 후 전체 Section 불변, 명시적 적용 후 대상만 변경, reload 유지, 이미지/style/order/다른 9개 불변,
  두 탭 최신 수동 문구 보호, 실패 후 기존 문구 유지와 내부 오류 비공개, dirty 차단/수동 경고,
  375px 가로 overflow 없음/키보드 Enter 적용을 확인했다.
- 실제 DB CHECK/FK도 기존 fixture 범위에서 검증했다. migration/RLS 변경과 push 없음.
- production client JS/map 21개와 src에서 실제 OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY 검출 0건.
  새 서버 기능 7개 파일의 server-only 경계도 확인했다.
- 브라우저 mock 호출은 총 4회이며 유료 실제 호출은 1회뿐이다.
  두 탭 수동 변경을 포함한 최종 DB 재조회에서도 상위 데이터/다른 9개 Section/style/이미지/순서 불변을 확인했다.
- 검증용 Project/Product/Facts/Assets/DetailPage/Sections 잔여 0건, 테스트 이미지 2개 삭제와 Storage prefix 잔여 0건 확인.
  전용 브라우저 탭과 localhost:3001 서버를 종료했다. 기존 사용자 데이터/서버는 변경하지 않았다.

## 생성 파일

- src/features/section-regeneration/: schemas.ts, types.ts, config.ts, prompts.ts, provider.ts, candidate.ts,
  context.ts, grounding.ts, service.ts, errors.ts, http.ts, client.ts, components/candidate-comparison.tsx
- src/app/api/projects/[projectId]/sections/[sectionId]/regenerate/route.ts
- src/app/api/projects/[projectId]/sections/[sectionId]/apply-candidate/route.ts
- tests/section-regeneration.test.mjs
- docs/tasks/TASK-015.md

## 수정 파일

- .env.example
- src/features/section-engine/: schemas.ts, grounding.ts
- src/features/detail-editor/: http.ts, components/editor.tsx, components/inspector.tsx
- docs/tasks/README.md, docs/02_ARCHITECTURE.md, docs/03_DATABASE.md,
  docs/04_AI_PIPELINE.md, docs/05_UI_UX.md, docs/07_DECISIONS.md

## Renderer 인계 / 한계 / 미구현

Renderer는 기존 type별 content와 bounded style, canonical sort_order, Asset ID→일시 URL 경계를 사용한다.
candidate는 저장된 콘텐츠가 아니며 export 대상으로 쓰지 않는다. regeneration/meta와 manualEdit history를 보존하고
기존 generation/reorder journal·page lease·stale 조회 계약을 존중해야 한다.

전체 Renderer/export, Section 추가/삭제/복제, 이미지 생성/재분석/Vision, style AI 재설계, 전체 페이지 재생성 변경,
version history/undo/redo/autosave, 새 Auth/사용자별 RLS/분산 rate limit/queue는 구현하지 않았다.
기존 single-user local MVP다. 소속 검사는 사용자 인증을 대신하지 않는다.
기존 lease는 전역 ACID transaction이 아니며 최종 읽기 직후 직접 DB 변경/장시간 worker 정지는 기존 한계를 갖는다.
자연어의 모든 주장/목적을 기계적으로 보장하지 않으므로 게시 전 사람이 검토한다.
Cursor에서는 실제 상품 10종 문구 품질·purpose 적합성, 긴 문구/모바일 비교 스크롤,
브라우저별 beforeunload, 스크린리더 포커스, 실제 장시간 provider timeout을 추가 확인한다.
