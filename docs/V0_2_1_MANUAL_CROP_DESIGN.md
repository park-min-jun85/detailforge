# v0.2.1 Manual Crop Review UX & Data Contract — TASK-050

2026-09-23. TASK-050 설계 기준 `078ebf6`, branch `plan/manual-crop-review-ux`, package `0.2.0`. **TASK-051 서버, TASK-052 UI, TASK-053 실제 원본 Browser/save/export QA 완료. M1/M4 RESOLVED, BLOCKER0/HIGH0/MEDIUM0/LOW0.** 아래 §1은 설계 당시 기록이며 현재 상태는 바로 아래 TASK-053을 따른다.

## TASK-053 실제 원본 QA 결과

`feat/manual-crop-real-qa` / 기준 `30e5a6f`. Production 변경 전에 현재 UI→V2 route→실제 save service/Sharp→격리 loopback persistence→재조회→Renderer/export를 실행했다. 원본2개와 A01/B01/B02 좌표·hash는048/049 그대로다. 원격 사용자 DB/Storage 호출0, 기존 사용자 데이터 불변. isolated source row의 candidate metadata는 기존 ID/rect로 재구성했고 AI 재분석0이다.

- **A01:** L16/T17/R15/B18, F `(35,522,790,790)`, saved790×790. 바깥 회색 띠를 제거하고 제품·강아지와 인접한 녹색 separator는 남겼다. cleaner, 관찰한 추가 content loss0. 모든 녹색 선 제거를 목표로 하지 않는다.
- **B01:** L8/T0/R0/B26, F `(368,2000,372,546)`, saved372×546. 왼쪽·하단 갈색 L자 패널 제거, bottom26>자동 cap17 유지. cleaner, 인물·의류 추가 손실0.
- **B02:** bottom38 preview에서 양옆 실제 texture가 함께 제외되는 것을 확인하고 Escape/Cancel. preserve는 정상 결과다. 후속 override 제거/auto 저장도 full691×547/trim없음으로 확인, same.

Desktop1440×1000와375×812에서 실제 source의 Apply/선택/저장, explicit false, keyboard/focus, 같은 session의 reorder/URL 갱신을 확인했다. 신규 Derived6개(manual4/automatic2)는 preview F와 dimensions 일치, source F를 동일 JPEG95/4:4:4로 encode한 기준 bytes/decoded pixels와 exact다. 원래 JPEG decode 픽셀과의 무손실 압축을 뜻하지 않는다. 별도 실제 source helper instrumentation에서 manual/zero의 auto-trim 호출0, auto 경로1을 확인했다.

동일 manual F 재사용, auto/manual 동일 F 재사용 및 provenance 불변, zero의 별도 variant, 실제 service 부분 저장(upload fault1)과 stale/최소/CAS 오류 후 초안 보존을 확인했다. asset_limit 메시지는 mock, 슬롯 enforcement는 기존 domain/service 전체 회귀로 확인했다. manual은 inventory에 정상 포함되며 여러 유사 변형 중 일부가 기존 near-duplicate 순위에서 억제되는 것은 mode와 무관한 기존 정책이다. 단독 대표 변형은 각각 available이다.

A/B canonical renderer 정상, B PNG/JPG **860×2468**, 누락·overflow·control0. 실제 source는 EXIF1이며1~8 domain 회귀와 구분한다. 시각 판정은 Codex의 검토이며 사용자 human sign-off를 대신하지 않는다. [72항목·증거·한계](tasks/TASK-053.md). **M4 RESOLVED**는 안전 자동 trim+ambiguous preserve+명시 manual review/save의 결합 기준이다. 모든 residue 자동 제거 보장은 아니다. 다음 TASK-054 Final Release Validation, version0.2.0/commit·merge·tag0 유지.

## TASK-052 당시 실행 상태와 계약 변경

`feat/manual-crop-editor-ui` / 기준 `f2d0518`. Candidate Review의 saveAllowed 카드에만 `[자르기 조정]`을 표시한다. native dialog/SVG 후보 clip/제외 dim/4 edge pointer capture/4 numeric 입력, integer source pixels와 shared `manualCropRect`를 사용한다. Arrow 1px/Shift 10px, 44 CSS px 핸들, focus trap/복귀, 375px contain, image load/dimensions/error gate를 구현했다. 편집·적용은 local-only이며 새 이미지나 임시 Storage를 만들지 않는다.

TASK-052 요청이 초기 설계의 두 동작을 변경한다. **Editor `[후보 전체로]`는0/0/0/0 manual override를 유지한다. Card `[수동 조정 해제]`만 override를 제거하여 automatic으로 돌아간다.** Cancel/Escape는 열기 전 applied draft/선택을 보존한다. **저장 성공·재사용은 해당 selection과 pending draft를 제거**, 실패 항목은 유지한다. 저장된 F의 preview는 별도 read-only receipt로 보존하며 다음 편집은 canonical base에서 시작한다. 이전 TASK-050/051 보고서는 당시 상태 기록이다.

Source별 workspace가 review/selected/drafts/receipts를 소유한다. 같은 ID+base+basis+dimensions면 revision/order/URL 변경에도 draft 유지, 삭제된 ID 제거, 새 ID 무상속, 바뀐 basis는 stale 격리와 안내 후 재승인한다. V2 builder는 selected+eligible+미저장 항목만 전달하며 zero manual을 생략하지 않는다. stale draft를 automatic으로 대체하지 않는다. 오류 후 fresh GET은 하되 자동 Save/AI 재시도는 없다. panel 닫기/Source 전환/beforeunload 확인을 제공하며 임의 SPA 라우터 전체 이탈 차단이나 crash 복구를 보장하지 않는다.

Desktop1440×1000/375×812 실제 Chromium에 production React 컴포넌트와 합성800×4000 이미지를 띄워 pointer/keyboard/numeric/Apply/Cancel/reset/remove/selection/V2/partial/retry/URL/stale/conflict/슬롯/Storage/이미지 실패를 검증했다. 375px CDP touch input과 resize/focus trap도 통과했다. client webpack graph에 Sharp/server-only/Supabase/server service 없음. 별도 실제 상품 브라우저 저장·의미 보존 QA는 하지 않았다. [75항목 보고](tasks/TASK-052.md). **M1 RESOLVED / M4 NEEDS_WORK**, MEDIUM1은 실제 상품 gate다. 자동 detector/3%/same-pixels invariant, package0.2.0 유지.

## TASK-051 실행 상태

`feat/manual-crop-save-domain` / 기준 `cc51492`. 기존 save route에 strict V2(schemaVersion2/expectedRevision/items)를 추가하고 IDs-only V1을 유지했다. manualInsets는 정수0~60000·4필드 필수, 원본/candidate bounds와 최소160×160·면적64000을 검사한다. 명시0px도 manual이며 auto trim 호출0이다. `planCrop`으로 최종 영역을 한 번 계산하고 `encodeCrop`으로 정확한 normalized source 부분을 저장한다. 자동 detector/3%/policyVersion2는 변경하지 않았다.

새 manual provenance schemaVersion2는 sourceRect=base와 adjustment.mode/insets를 기록하고 trim을 금지한다. v1/trim1·2/없음 reader 유지, final geometry로 duplicate/슬롯을 계산한다. 기존 automatic 기본 재요청은 승인된 legacy 결과를 재사용한다. manual variant를 base만으로 saved 처리하지 않는다. visual inventory의 manual geometry/3% 초과·projection 읽기도 지원한다.

V2 expectedRevision→기존 source lease CAS→claim revision cursor 검사를 연결했다. 각 항목 및 encoding 후 upload 직전에 최신 path/revision/run/lease/result를 확인한다. 외부 conflict는 남은 저장을 중단한다. 기존 upload/INSERT/ack-lost 보상 경로는 유지하며, 같은 batch에서 저장 확인이 불확실한 final key를 재업로드하지 않는다. 이미 시작한 upload/INSERT를 외부 writer와 하나의 DB transaction으로 묶는 보장은 없고 기존 Local/Internal MVP 소속·lease 참여 전제를 유지한다.

GET review에 basisKey/sourceOrientation/coordinateSpace/savedCrops를 추가했다. **Save HTTP 응답 asset은 id/width/height/mimeType/assetType 요약**만 반환한다. saved/failed/available 및 candidateId/existing은 유지하며 private storage path/raw provenance/checkpoint를 반환하지 않는다. service 내부 Asset은 보존하고 client save 반환 타입만 요약에 맞췄다. UI 컴포넌트/draft/selection/drag 구현 변경0.

98개 신규 domain/Sharp/loopback service/route tests로 strict 입력,0px/helper 호출0,PNG pixels,EXIF1~8,JPEG/WebP,일반화 A01/B01/B02,중복/30슬롯/partial/stale/CAS/보상을 검증했다. 실제 상품 Browser/수동 review QA는 TASK-053이며 이 결과로 M4를 닫지 않는다. [78항목 및 전체 검사](tasks/TASK-051.md). migration/dependency/AI/원격 mutation0, package0.2.0 유지.

**M1 RESOLVED 유지 / M4 NEEDS_WORK, BLOCKER0/HIGH0/MEDIUM1/LOW0.** 자동 보존과 사용자 명시 승인을 결합한다. 자동 content preservation > frame removal, `same pixels + same config => same decision`을 유지한다. semantic label/knownContentBounds는 production 입력이 아니다. 수동 입력은 별도 승인 경로이며 자동 detector의 예외 규칙이 아니다.

## 1. 근거와 현재 구현

AGENTS/CLAUDE, [boundary contracts](V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md), [backlog](RELEASE_BACKLOG.md), TASK-[024](tasks/TASK-024.md)/[031](tasks/TASK-031.md)/[032](tasks/TASK-032.md)/[040](tasks/TASK-040.md)/[047](tasks/TASK-047.md)/[048](tasks/TASK-048.md)/[049](tasks/TASK-049.md), `.cursor/rules/10-ui.mdc`와 설치된 Next testing guide를 확인했다.

- `detail-extraction/schemas.ts`: 현재 save는 strict `{candidateIds: hash[]}`, unique 1~24개. **save에 expectedRevision은 아직 없다.** extraction state에는 UUID revision/saveLease가 있고 retry만 expectedRevision을 요청한다.
- `geometry.ts:candidateId`: SHA-256 입력은 `[sourceFingerprint,x,y,width,height,regionType]`. score/order는 ID에 영향 없고 role/base rect/source bytes는 영향을 준다.
- `review-model.ts`, `review.ts`, `public-response.ts`: read-only review DTO에는 revision/candidates/sourceDimensions/savedCandidateIds가 있지만 raw sourceFingerprint/sourceOrientation은 없다. asset DTO는 checkpoint를 숨기고 extractionDisplay만 제공한다.
- `components/extraction-panel.tsx`: SVG viewBox로 **trim 전 Candidate**를 source signed URL에서 보여 준다. 실제 auto-trim 결과를 미리 계산하지 않는다. selection은 ID별 true/false, refresh 후 명시 false도 보존한다. 이미 저장된 후보는 현재 체크 disabled다.
- `service.ts`: canonical 후보·saveAllowed·ID·실제 source hash/dimensions·scope 검증, Product process lock, source lease/CAS, 슬롯 preflight 후 선택 후보별 저장. 성공/실패를 분리하며 성공만 선택 해제한다.
- **현재 duplicate key는 parent + sourceFingerprint + derivation.sourceRect, 즉 trim 전 base rect다. final rect 기반이 아니다.** review.savedCandidateIds와 UI 슬롯 계산도 이 기준이다. TASK-051에서 수동 변형을 허용하려면 세 경계를 함께 고쳐야 한다.
- `images.ts`: EXIF 정규화된 PNG working buffer에서 candidate를 추출한 다음 항상 auto trim한다. PNG lossless/JPEG95 4:4:4/WebP95, resize 없음. 수동 경로는 이 추가 trim 호출을 생략해야 한다.
- 현재 provenance는 strict schemaVersion1, sourceRect=base, optional trim(policyVersion1/2, insets, postTrimDimensions), parent/hash/candidate/role/confidence/extractedAt/provider/model이다.
- `assets/metadata.ts`, `detail-extraction/persistence.ts`, `retry.ts`: source path와 이전 revision CAS, namespace 병합·lease/run 보호·lost-ack 확인을 재사용한다. 새 DB version 체계는 만들지 않는다.
- `visual-assets/policy.ts`: provenance를 `.pick()`하여 projection하고 auto 3%/실제 dimensions를 검증한다. nearDuplicate는 현재 **base rect IoU≥.85**로 Planner 후보를 억제한다. 새 manual reader와 geometry를 함께 지원해야 한다.
- `assets/schemas.ts`/`asset-manager.tsx`: Product Assets 최대30, signed URL TTL300초, 만료 전/주기적 read-only 갱신. UI 공통 panel/button 스타일은 있으나 전용 crop/dialog primitive는 없다.

TASK-048 실제26개는 추가 content loss0이지만 colored-frame 개선0, obvious residue3→3이었다. TASK-049의 A01 ambiguous, B01 panel_background/unsafe_to_trim, B02 content_touching_edge/unsafe_to_trim에는 새로운 safe automatic extension의 근거가 없다. threshold·3% cap 완화로 해결하지 않는다.

## 2. 진입 위치와 범위

Assets의 **Derived 저장 전 Candidate Review 카드**에 `[자르기 조정]`을 둔다. canonical 원본 후보와 출처가 있고, 사용자가 저장 전에 검토하며, 원본·기존 Derived·Page 연결을 변경하지 않는 위치다. saveAllowed 후보에는 기본 선택 여부/기존 저장 여부와 무관하게 제공한다. saveAllowed=false는 이유를 표시하고 crop control을 표시하지 않는다. busy/stale/preview 미가용 상태도 이유와 함께 잠근다.

이미 저장된 카드에서 진입해도 **원본 Candidate의 새 변형**을 만드는 것이다. 기존 Derived를 입력으로 crop하거나 같은 Asset ID/Storage를 덮어쓰지 않는다. 기존 Derived 편집·확장/복구·identity/version/Page 참조 교체는 future backlog다. 원본 Candidate가 사라졌거나 Source가 없으면 이 경로도 사용할 수 없다.

허용은 Candidate 안쪽 left/top/right/bottom inset뿐이다. 밖으로 확장하면 인접 panel/다른 제품/문자 혼입 및 후보 정체성 변경이 생기므로 제외한다. 회전, perspective, free transform, rescale, background fill/removal, AI 재생성도 제외한다. 자동 cap은 각 축3% 그대로, 명시 manual에는 적용하지 않는다. manual은 의미적 무손실 보장이 아니라 사용자가 제거 영역을 승인한 별도 행위다.

## 3. 좌표와 검증 불변식

absolute arbitrary source rect 대신 **canonical Candidate 기준 4개 inset**을 사용한다. absolute rect는 표현은 간단하지만 범위·출처를 client가 바꾸기 쉽다. inset도 그 자체로 안전한 것은 아니므로 서버가 canonical base에 대입하여 검증한다.

좌표계는 `orientation_normalized_pixels`. source 원본 bytes의 fingerprint와 EXIF 정규화 후 좌표는 구분한다. TASK-024처럼 서버에서 한 번 정규화한 working image가 기준이다. CSS pixel/DPR/스크린 좌표/URL을 metadata에 저장하지 않는다.

```text
base B = {x, y, width: w, height: h}
insets I = {left: l, top: t, right: r, bottom: b}
final F = {x: x+l, y: y+t, width: w-l-r, height: h-t-b}
```

- 4개 필드 모두 필수, finite safe integer, 0~60000. 문자열/null/소수/negative/NaN/Infinity/초과값/unknown key를 거부한다. 누락 필드를0으로 추정하지 않는다.
- B와 F는 실제 normalized source 내부. l+r<w, t+b<h. 최종 **width≥160, height≥160, area≥64000**, 기존 최소 정책을 재사용한다. 현재 cropImage의 단순 bounds 검사만으로 대체할 수 없다.
- 서버가 잘못된 입력을 clamp/round해서 저장하지 않는다. UI의 유효하지 않은 숫자 입력은 편집 상태에 남기되 Apply를 막는다.
- manual override **없음**은 automatic. override **있음 + 4변0**은 전체 Candidate를 명시 승인한 manual이다. 0을 falsy 처리해 자동으로 바꾸지 않는다.
- **manual preview F = 서버 검증 F = Derived가 담은 source 영역 F**. 추가 trim/resize0. PNG decoded pixels로 identity를 검사하고 JPEG/WebP는 동일 영역·dimensions·기존 encoding을 검증한다. 손실 압축 bytes가 원본과 같다는 뜻은 아니다.

## 4. 화면 좌표 변환

기존 SVG source 좌표/viewBox 방식을 확장한다. preview viewBox는 B, source image는 normalized 전체 dimensions, 제외 영역은 overlay로 표시한다. pointer는 SVG `getScreenCTM().inverse()`로 client 좌표에서 source 좌표로 변환한다. nested CSS scale/브라우저 zoom/letterbox를 포함한 행렬을 사용하고 DPR을 다시 곱하지 않는다. 행렬을 얻을 수 없으면 drag를 잠그고 numeric input을 제공한다.

`preserveAspectRatio="xMidYMid meet"`의 검증용 등가식은 `s=min(Wcss/w,Hcss/h)`, `ox=(Wcss-w*s)/2`, `oy=(Hcss-h*s)/2`, `sourceX=x+(clientX-surfaceLeft-ox)/s`, Y도 동일하다. border/padding을 제외한 실제 SVG viewport가 Wcss/Hcss다. letterbox에서 새 crop 동작을 시작하지 않는다.

left/top은 pointer와 B 시작점 차이, right/bottom은 B 끝점과 pointer 차이를 취한다. 연속 nonnegative inset을 `floor(v+0.5)`로 한 번 정수화한 뒤 유효 범위로 제한한다. 한 변 drag 중 다른 세 변은 고정한다. 예를 들어 높이가 H이면 폭 하한은 `max(160,ceil(64000/H))`이다. 경계까지 드래그하면 이 하한에서 멈춘다. numeric 값은 임의 보정하지 않는다.

정수 draft를 유일한 상태로 보관하고 display geometry는 매 render에서 파생한다. resize/zoom은 저장 좌표를 변경하지 않는다. drag 중 layout/zoom이 바뀌거나 pointercancel이면 해당 gesture 시작값으로 돌아가고 새 행렬에서 다시 시작한다. 재flow·재open으로 누적 rounding하지 않는다. 50/100/200% zoom, desktop/375px, DPR1/2, fractional CSS size, letterbox, EXIF1~8(반사 포함)을 future QA에 넣는다.

기존 signed original을 브라우저가 표시하는 orientation과 서버 정규화가 같아야 한다. review에 sourceOrientation과 coordinateSpace를 추가하고 실제 preview decoded dimensions/방향 fixture를 확인한다. 두 번 회전하지 않는다. 정규화 표시를 보장하지 못하면 조정을 막고 오류를 표시한다. 필요할 때만 기존 라이브러리로 client-memory 정규화 fallback을 구현하며 새 파일/Storage는 만들지 않는다. 이 보장은 TASK-052/053 구현 gate다.

## 5. interaction 및 editor

**4개 edge drag handles를 primary, 4개 숫자 입력을 동등한 keyboard 대안으로 선택한다.** corner handles는 두 축 동시 변화·min area clamp가 더 복잡하고 frame 제거에 필수적이지 않아 제외한다. 숫자만 제공하면 접근성과 정밀성은 좋지만 시각적 탐색이 느리므로 보조 입력으로 함께 둔다. 새 crop library는 필요하지 않다.

```text
후보 N 자르기 조정
저장할 영역을 조정하세요. 원본 후보 영역 밖으로 확장할 수 없습니다.
[ 원본 Candidate + 경계선 + 4 edge handles + 제외 영역 dim overlay ]
왼쪽 [0] px   위쪽 [0] px   오른쪽 [0] px   아래쪽 [0] px
저장 예정 영역: W × H px
제품이나 글자가 제외 영역에 포함되는지 확인하세요.
[후보 전체로]                                 [취소] [적용]
```

한 개 interactive preview로 포함·제외 영역과 최종 크기를 보여 준다. 별도 side-by-side/zoom 도구는 v0.2.1 필수가 아니다. Apply 후 카드 preview는 F로 바꾸고 `수동 자르기 적용 · 저장 전`으로 표시한다. editor를 다시 열면 B 전체와 적용한 I를 함께 보여 준다.

- **Apply:** 유효한 working copy를 `manualDrafts[id]`에 반영하고 닫는다. 서버/Storage/AI 호출0. selection은 바꾸지 않는다. 해제된 후보라면 “저장하려면 후보를 선택하세요.” 안내. 실제 mutation은 기존 `[선택한 제품컷 저장]`에서만 발생한다.
- **Cancel/Escape:** 이번 editor에서 바꾼 working copy만 버린다. 이전 applied draft/selection 유지, focus를 진입 버튼으로 복귀한다. 모호한 backdrop click으로 discard하지 않는다.
- **후보 전체로:** working insets를0/0/0/0으로 변경한다. Apply하면 명시 manual override가 유지되어 auto trim을 건너뛴다. Cancel이면 기존 applied draft가 유지된다.
- **수동 조정 해제:** Card에서 pending override와 receipt를 제거하고 automatic 저장 경로로 복귀한다. 선택 상태는 바꾸지 않는다. editor 내부에는 automatic 모드 전환이 없다.
- 처음 열고 이동 없이 Apply한0px도 같은 manual 승인이다. 기존 Derived의 undo는 아니며 기존 이미지는 계속 존재한다.

## 6. client state / retry / selection

상태는 Source panel 소유의 메모리에 둔다. 배열 index/URL/카드 번호를 key로 삼지 않는다. 서버 저장/localStorage/사용자 행동 로그를 추가하지 않는다.

```text
selected: Record<candidateId, boolean>                     // 기존 true/false 보존
manualDrafts: Record<candidateId, {
  basisKey, baseRect, sourceDimensions,
  insets: {left,top,right,bottom}, status: applied | stale
}>
editor: null | {candidateId, basisKey,
                workingInsets, initialWorkingCopy, fieldErrors}
review.revision: UUID                                     // 현재 read snapshot
```

새 review candidate 필드 `basisKey`는 서버가 scope(project/product/source ID), sourceFingerprint, candidateId/base rect, normalized dimensions/orientation/coordinate-space version에서 만든 opaque SHA-256이다. raw hash/checkpoint/path를 UI에 노출할 필요가 없다. **revision/score/order는 basisKey에 넣지 않는다.** request에는 basisKey를 권한 토큰으로 보내지 않으며 expectedRevision+canonical 조회가 최종 권위다.

- fresh GET/retry 뒤 같은 ID+base+basis+dimensions이면 applied draft와 explicit true/false를 유지한다. revision만 갱신한다. 카드 순서 변화와 무관하다.
- 후보가 사라지면 해당 draft/selection을 제거하고 변경 안내. 새 후보는 override 없이 기존 defaultSelected 정책만 따른다. overlap/비슷한 위치를 이유로 이전 override를 이동하지 않는다.
- 같은 ID라도 base/source basis가 다르면 draft를 stale로 격리하고 저장 제외한다. 정상 ID 생성에서는 base/hash 변경이 ID도 바꾸지만, 손상·오래된 응답을 방어한다. 다시 열어 **현재 B로 새로 조정**하거나 Reset하도록 하고 기존 inset을 자동 재적용하지 않는다.
- ID가 같아도 saveAllowed=false가 되면 draft는 검토용으로 유지하되 저장 금지. 현재 eligibility가 복구되어 fresh basis가 확인되기 전에는 저장하지 않는다.
- editor 열린 동안 같은 화면의 분석/retry/save를 잠근다. 외부 revision 변경이 확인되면 Apply/save를 잠그고 fresh GET 후 위 규칙으로 재조정한다. 닫힌 applied draft는 사용자가 실행한 retry를 거쳐 보존 가능하다.
- GET 실패 시 이전 review/selection/draft를 유지하고 mutation만 잠근다. 기존 sequence guard로 늦은 응답을 무시한다. 최신 상태를 읽는 것만으로 Save/AI를 자동 재실행하지 않는다.
- panel 닫기/다른 Source 이동 및 browser beforeunload에서 미저장 working/applied 변경을 확인한다. 취소하면 상태 유지, 이동하면 폐기한다. URL만 갱신되면 remount/폐기하지 않는다. session memory이며 crash 복구나 모든 SPA 링크 이탈 차단은 범위 밖이다.

TASK-040의 명시 false 보존을 우선하므로 **Apply가 자동 선택을 켜지 않는다.** 기존 savedCandidateIds에 있다는 이유만으로 새 manual 변형을 disabled 처리하지 않는다. 현재 요청 모드/최종 영역에 동일 저장물이 있으면 `저장됨` 표시·저장 제외, 다른 F면 선택 가능해진다. 이미 저장됨을 나타내는 시각적 check와 실제 selected boolean을 혼동하지 않는다.

## 7. read DTO와 save request 제안

현재 GET에 최소 필드를 추가한다: result의 sourceOrientation/coordinateSpace, 각 candidate의 basisKey, source-scoped `savedCrops`(최대30, `{assetId,finalRect,adjustmentMode:"automatic"|"manual"}`). 모두 서버에서 유효한 provenance/소속/현재 source hash로 검증한 projection이다. raw checkpoint, storage key, source fingerprint는 보내지 않는다. `savedCandidateIds`는 **기존 자동 기본 요청의 재사용 대상** 용도로 유지하고 manual v2 rows를 base만으로 이 목록에 합치지 않는다. 새 UI의 manual 저장 여부는 savedCrops와 F로 판단한다.

기존 POST save 경로에 strict discriminated V2를 추가한다. 이름은 구현 시 아래 계약으로 고정한다.

```json
{
  "schemaVersion": 2,
  "expectedRevision": "00000000-0000-4000-8000-000000000001",
  "items": [
    {
      "candidateId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "manualInsets": {"left": 0, "top": 0, "right": 0, "bottom": 26}
    }
  ]
}
```

schemaVersion2, UUID expectedRevision, items1~24, unique lowercase64hex candidateId, optional strict manualInsets(4개 필수)를 받는다. items에는 ID와 inset 외의 입력을 허용하지 않는다. sourcePath/sourceFingerprint/storageKey/URL/base rect/final absolute rect를 거부한다. 예시 ID/revision은 placeholder이며 실제 요청 가능한 fixture가 아니다.

기존 strict `{candidateIds}`는 **automatic 전용 호환 요청**으로 유지한다. legacy와 V2의 키를 섞으면 reject한다. 새 UI는 manual이 없는 항목도 V2를 사용한다. legacy에 manual만 붙여 revision 검증을 우회할 수 없다. unknown key를 strip해서 조용히 automatic으로 저장하지 않는다. 유효 최대24개 bounded 항목은8KiB 안에 들어가며 실제 직렬화 길이를 TASK-051에서 검사한다.

response는 기존 `{saved:[{candidateId,asset,existing}],failed:[{candidateId,code,message}],available}`를 유지한다. 한 요청에 한 candidate의 여러 변형을 동시에 보내지 않는다. source-scoped 저장 결과/현재 제출 snapshot으로 성공한 F를 식별하고, in-flight editor/selection 변경을 잠가 응답이 새 draft를 지우지 않게 한다.

## 8. 서버 preflight / CAS / 저장 순서

1. 기존 same-origin/JSON/streaming8192bytes/no-store, Project→Product→Asset scope/ownership, source private path, recursive Derived 금지, MIME/signature/10MiB·40MP·6000×60000·long-source 조건을 유지한다. Auth/RLS 공개 SaaS 문제를 이번 기능이 해결하는 것은 아니다.
2. 기존 Product process lock에서 fresh source/state를 읽는다. active analysis/save는 busy. V2 expectedRevision을 현재 revision과 정확히 비교하고 다르면 conflict. valid latest result가 없으면 stale.
3. 모든 ID를 canonical latest candidates에서 찾고 saveAllowed/role/ID 재계산을 검사한다. 서버가 원본 bytes를 읽어 SHA-256, 정규화 dimensions/orientation을 다시 검증한다. inset을 canonical B에 대입하여 §3을 검사한다. 모든 입력을 검증한 뒤에만 mutation한다.
4. §10 방식으로 existing reuse/최종 rect 계획을 확정하고 새 고유 crop 수와30개 limit을 **batch 전체 preflight**한다. auto 새 영역은 기존 detector로 한 번 계획하고 결과를 재사용한다. manual은 detector를 부르지 않는다. image decode는 Source당 한 번, encoded output은 순차 생성한다.
5. 기존 metadata compare-and-save로 saveLease를 잡는다. revision은 이 write에서도 바뀌므로 **요청 expectedRevision은 시작 시 검사**, 이후에는 claim 후의 내부 operation cursor를 사용한다. source storagePath/runId/lease/latest basis/eligibility를 매 저장 경계에서 재확인한다. retry의 strict cursor 규칙을 재사용하여 외부 revision을 조용히 채택하지 않는다.
6. 새 manual은 normalized working image의 F를 정확히 extract→기존 MIME/quality encode→실제 dimensions 검증한다. auto는 확정된 auto rect/trim provenance로 저장하고 다시 detector를 돌려 이중 trim하지 않는다. 각 고유 F당 UUID private object/새 unclassified row, upsert=false. 기존 원본/Derived 변경0.
7. 후보별 성공/실패를 수집한다. global invalid/stale/limit은 업로드 전 전체 거부. 중간 cursor 손실이면 남은 새 저장을 중단하고 conflict 결과로 남긴다. 이미 성공한 row/object는 보존한다. lease 해제도 해당 run/lease 소유권으로 CAS하며 다른 writer namespace를 덮어쓰지 않는다.

현재 namespace CAS/lease를 사용하며 별도 DB version/migration은 없다. Product lock은 process-local이다. 여러 서버 인스턴스/서로 다른 Source의 동시 쓰기에 대한 전역 asset-limit transaction을 이번 설계가 새로 보장하지 않는다. 기존 Local/Internal MVP 한계와 공개 운영 전제를 유지한다. 요청 내 source bytes를 pin하고 hash를 검사하며 외부에서 Storage object를 무단 교체하는 상황에 대한 분산 transaction도 주장하지 않는다.

revision 충돌 안내는 “이미지 분석 결과가 변경되어 자르기 조정을 다시 확인해 주세요.”이다. read-only refresh 성공 시 같은 basis draft를 보존할 수 있지만 사용자가 다시 Save해야 한다. hash/path/orientation 변경은 source_changed이며 예전 좌표로 자동 재시도하지 않는다.

## 9. provenance / reader 호환

기존 v1 자동 provenance와 필드 의미를 그대로 읽는다. 새 automatic도 v1을 유지한다. 새 manual만 **strict schemaVersion2**로 구분하고 공통 필드(kind/parent/hash/candidate/sourceRect/sourceDimensions/coordinateSpace/suggestedRole/confidence/extractedAt/provider/model)를 유지한다.

```text
schemaVersion: 2
sourceRect: canonical base Candidate rect                 // 기존 필드 의미 유지
adjustment: {mode: "manual", insets: {left,top,right,bottom}}
// trim 필드는 허용하지 않음
```

baseCandidateRect/sourceRect를 중복 저장하지 않고 finalRect는 sourceRect+insets로 계산한다. Asset width/height와 F 일치를 검증한다. manual에 trim.policyVersion2를 붙여 자동 판정으로 오인시키지 않는다. v1에 adjustment를 붙이거나 v2에 trim을 섞으면 reject한다. 기존 extractedAt은 서버 저장 시각 UTC, identity에 넣지 않는다. provider/model/confidence는 원래 AI 후보 출처이며 manual 작업에서 AI 호출했다는 뜻이 아니다. 무한 행동 이력/별도 crop timestamp가 필요하지 않다.

TASK-051 reader는 v1/trim 없음/v1 trim policy1·2/manual v2를 모두 지원해야 한다. strict union으로 바꾸면 현재 derivationSchema.pick 호출을 사용할 수 없으므로 최소 공통 projection을 별도로 정의한다. visual inventory/label/review/duplicate/dimensions 검증/Planner provenance projection을 함께 검사한다. 자동 trim의3% 검사는 v1에만 적용하고 manual에는 내부 bounds/최소크기를 적용한다. isDerived 재귀 차단은 schema 해석 실패 여부와 무관하게 kind marker로 유지한다. legacy row rewrite/migration0.

Planner의 near-duplicate 억제는 저장 중복과 별개다. **v1-v1 쌍은 기존 base IoU 정책 유지**, manual이 포함된 쌍은 실제 effective rect로 같은 .85 기준을 적용한다. manual variant라고 유사 이미지 반복 제한을 우회하지 않으며 새 변형을 저장했다고 Planner가 반드시 선택하는 것은 아니다. 기존 Page/Plan 참조를 자동 교체하지 않는다. 새 필드를 provider prompt/Final 경고로 노출하지 않는다.

## 10. 중복 / legacy 자동 결과 / 슬롯

`effectiveRect`는 서버 공통 reader로 계산한다. v1 trim 없음=sourceRect, v1 trim 있음=base에 trim.insets 적용, v2 manual=base에 adjustment.insets 적용. v1 postTrimDimensions와 실제 Asset dimensions, source bounds/trim cap을 검증한다. v2는 manual bounds/최소크기/실제 dimensions를 검증한다. 손상된 provenance는 재사용 후보에서 제외하고 fail-closed/read warning을 유지하며30개 총량에는 포함한다.

새 crop의 identity는 **같은 parent Asset + 같은 source bytes hash + 같은 effective final source rect**다. candidateId/role/base rect/조정 모드/시각은 identity에 넣지 않는다. 같은 F면 automatic/manual 사이에도 기존 Derived를 재사용하고 provenance/분류/파일을 바꾸지 않는다. 이 경우 “동일 영역의 기존 이미지 재사용”으로 표시한다. 기존 automatic row를 재사용했다고 manual marker를 소급 기록하지 않는다. 동일 영역이므로 새 manual 파일이 만들어졌다는 주장도 하지 않는다.

**legacy 자동 호환은 요청을 계획하는 단계에서 보존한다.** override 없는 기본 요청에 같은 base의 유효한 기존 automatic Derived가 있으면, 그 row의 이미 승인된 effective F로 기본 요청을 해석한다. detector 정책이 바뀌었다고 재crop하거나 새 파일을 만들지 않는다. 이 기본 재사용 규칙은 manual 요청에는 적용하지 않는다. 같은 base의 manual row만 있다고 automatic 기본 요청을 저장됨 처리하지 않는다. default automatic row가 없으면 현재 auto policy로 F를 확정한 뒤 공통 final identity를 조회한다.

- 같은 후보에서 manual A/B의 F가 다르면 별도 Derived 가능. 0px manual도 기존 auto가 잘랐던 F와 다르면 새 full-candidate 변형이다.
- 다른 candidateID/role/base라도 동일 F면 한 Asset. 한 batch 내 동일 F는 한 번 저장하고 각 candidateId 결과가 같은 asset을 가리키게 한다.
- 처리 순서는 canonical 후보 source y/x/id로 고정한다. 이미 중복 legacy rows가 여러 개면 created_at→id 순으로 기존 하나를 고르고 나머지를 삭제하지 않는다. 첫 승인 provenance를 유지한다.
- Product 전체30개 limit/available은 그대로다. 서버는 **존재하지 않는 final key의 고유 수**만 새 슬롯으로 센다. old/new/manual/automatic 모두 총량에 포함, 재사용은0슬롯. 업로드 전에 batch limit 초과를 거부하고 일부만 임의 저장하지 않는다.
- UI manual 슬롯 계산은 F+savedCrops로 정확히 계산한다. automatic의 실제 trim F는 저장 전 알 수 없으므로 legacy 기본 재사용 외에는 **상한 추정치**라고 표시한다. 추정치만으로 저장을 영구 차단하지 않고 서버 preflight가 결정한다. 서버보다 느슨한 authoritative capacity를 약속하지 않는다.

## 11. 오류 / 부분 실패 / 복구

기존 error envelope/message convention을 따른다. raw DB/Storage/path/내부 stack을 노출하지 않는다.

- invalid_input(400): strict schema/unknown key/숫자 타입·정수·범위·중복 ID. invalid_rect(400): candidate/source 밖 또는 역전/비양수 rect.
- **crop_too_small(400), 새 제안:** 양수 rect지만 폭160/높이160/면적64000 미달. 각 입력 옆에 수정 이유를 표시한다.
- stale(409): candidate missing/current eligibility/result 불일치. source_changed(409): source bytes/dimensions/orientation/path 변경. conflict(409): revision/CAS 충돌. busy(409): 활성 lease/analysis.
- asset_limit(409): 현재 available 안내와 선택 축소. 기존 forbidden/ownership/not_found를 그대로 사용한다.
- crop/upload/database/recovery: 기존 안전한 encoding/Storage/DB/미확정 저장 메시지 및503 convention. retry의 **persistence_failure는 AI 비용 안내를 포함하므로 manual DB 실패에 재사용하지 않는다.** storage_failure 등의 중복 enum을 만들지 않는다.

정상 partial 응답은 기존 후보별 saved/failed와 available을 유지한다. **성공·재사용한 제출 항목만 선택 해제하고 pending draft 제거**, 실패 항목의 selection/manual draft 유지. 성공 F는 read-only receipt로 preview에 보관하고 fresh savedCrops로 확인한다. 다음 편집은 canonical base에서 시작한다. 같은 F 재저장은 저장됨 처리한다. success/failed 건수를 분리하고 후보 번호를 포함한 오류를 표시한다. auto 항목의 성공/실패 정책과 같다.

요청/응답 유실 또는 lease 정리 실패는 이미 저장된 결과를 삭제하지 않는다. 기존 insert lost-ack 재조회/새 object만 제한 cleanup 규칙을 유지한다. 브라우저는 제출 snapshot과 draft를 보존하고 먼저 read-only review/assets를 갱신하여 같은 source scope+F 저장 여부를 확인한다. 조회 실패/미확정 recovery 중에는 mutation을 잠근다. 확인 뒤 미저장 항목만 명시 재시도한다. refresh 자체나 재연결이 Save를 자동 반복하지 않는다.

## 12. 안내 / 접근성 / responsive / 성능

Review 상단에 “프레임이나 불필요한 여백이 보이면 ‘자르기 조정’으로 저장 영역을 수정할 수 있습니다.”를 추가한다. A01/B01/B02를 확실한 frame으로 자동 분류할 근거가 없으므로 per-candidate `프레임 있음/안전하게 제거 가능` 경고는 만들지 않는다. 사용자 visual review가 기준이다.

현재 카드가 auto-trim 전 preview이므로 저장 전에 `자동 경계 정리 적용됨` badge를 추측해서 붙이지 않는다. 안내는 “수동 조정이 없으면 저장 시 자동 경계 정리가 적용될 수 있습니다.”로 충분하다. 실제 저장된 trim metadata가 있을 때만 관리 화면의 optional badge를 허용하며 출시 필수 범위에서 제외한다. manual은 `수동 자르기`로 구분하고 안전성을 보증하는 문구는 쓰지 않는다.

editor는 의미 있는 제목/설명의 modal dialog, focus trap/복원, Escape=Cancel, 실제 button, visible focus를 제공한다. 각 numeric input은 `왼쪽/위쪽/오른쪽/아래쪽 제외 폭(원본 px)` label, min/step1, 오류 aria-describedby를 갖는다. Tab→숫자/Arrow 입력→Apply만으로 전 작업이 가능해야 한다. drag handles는 같은 동작의 pointer 표현이며 중복 tab stop을 강제하지 않는다. 경계선은 밝고 어두운 사진 모두에서 보이는 이중 대비로 표현하고 dim 색만으로 포함/제외를 알리지 않는다. 결과 크기/모드/오류를 text로 표시하며 값 확정 시 polite 안내, 매 pointer move 낭독은 하지 않는다. 조작 hit target은44px, hit 영역이 겹치는 작은 preview에서는 숫자 입력을 우선한다.

375px에서는 dialog width를 viewport에 맞추고 한 열 또는2×2 numeric layout, 세로 scroll, footer 버튼 접근을 제공한다. 가로 scroll로 crop surface를 밀지 않는다. desktop은 넓은 preview를 사용하지만 source F는 동일하다. Final860px Renderer/PNG/JPG에는 조작부·badge·내부 warning이 노출되지 않는다. 실제 저장된 이미지 파일만 기존 흐름으로 사용한다.

draft 변경/drag마다 서버 호출0. pointer 변경은 requestAnimationFrame으로 화면 갱신을 제한하고 원본 decode를 반복하지 않는다. 40MP 원본 전체 canvas 복제를 pointer마다 만들지 않는다. 원본 signed preview를 재사용하며 임시 crop Storage/upload0. source당 하나의 preview resource를 공유하고 local object URL을 썼다면 close 시 해제한다.

signed URL은 기존 TTL300초/만료 전 갱신 흐름을 사용한다. draft는 candidate basis에 연결되며 URL 문자열에 연결되지 않는다. 갱신은 read-only asset/preview 조회, AI/Storage mutation0. image load error/만료 감지 시 새 preview를 기다리며 Apply/save를 잠그고 draft는 유지한다. 같은 basis의 preview 로드가 끝나면 재개한다. source identity도 달라지면 stale 규칙을 따른다. 늦은 URL 응답이 새 Source를 덮지 않도록 sequence를 검사한다.

## 13. 실제 시나리오와 M4 종료 기준

- **A01:** Candidate 카드→자르기 조정→회색/녹색 edge와 인접 제품을 직접 확인→필요한 네 변만 inward 조정→dim 제외 영역 확인→Apply→선택 확인→명시 Save→F와 동일한 Derived. TASK-049의 layer 측정치를 자동 추천 inset으로 넣지 않는다. preserve가 합리적이면 Cancel/Reset 가능하다.
- **B01:** automatic은 panel_background preserve 유지. 사용자가 하단26px 제거를 원하면 직접 bottom26 입력 가능(기존 auto cap17 초과). 나머지 변/최소크기를 확인한 뒤 Apply/선택/Save. 부분 패널 제거와 제품 포함 영역에 대한 판단은 사용자에게 남긴다.26을 기본값으로 적용하지 않는다.
- **B02:** 자동 preserve. 내부 card를 제거하려고 전체 하단을 줄이면 옆 제품 texture도 잘릴 수 있음을 제외 overlay에서 검토한다. 허용 rect여도 `안전`이라고 표시하지 않는다. 원하는 보존/제거를 사각형으로 함께 만족할 수 없으면 Cancel/Reset이 정상 결과다. 저장하기로 명시 선택한 경우에만 그 F를 정확히 저장한다.

M1은 기존 자동 추가 trim 안전성 gate의 RESOLVED를 유지한다. manual explicit input이 자동 guard 약화/semantic exception 근거가 되지 않는다. original A/H 동일 pixels/config 보존, A2 white/colored safe trim, alpha/detail/최소/cap 회귀를 유지한다.

**TASK-053에서 M4 RESOLVED.** 아래는 설계 시 정한 gate이며, 실제 source의 Browser/service/Derived/Renderer/export와 기존 regression 증거를 위 결과에 기록했다. 범위는 확실한 frame의 보수적 자동 trim + ambiguous preserve + 사용할 수 있는 Candidate manual review/save다. 모든 자동 frame 제거 또는 임의 사용자 입력의 의미적 무손실을 보장하지 않는다.

1. A01/B01/B02 generalized 실제 scenario를 Browser에서 검토하고 Apply/Cancel/Reset/선택/저장 흐름을 확인한다. B02 preserve 선택도 기록하며 모든 residue 제거를 강요하지 않는다.
2. 실제 manual save에서 preview/source F/Asset dimensions/decoded 결과/새 v2 provenance 일치, additional auto trim0, 3% 초과 manual 양성, 동일 F 재사용/다른 F 새 변형/30슬롯 경계를 확인한다.
3. desktop/375px/keyboard/zoom/EXIF/만료 URL/retry/순서변경/explicit false/외부 revision/부분 저장 실패에서 draft와 좌표가 유지된다. 실패 복구 후 명시 재시도만 발생한다.
4. 기존 source bytes/기존 Derived 파일·metadata/Page 참조 불변, legacy auto 기본 재저장 무변경, 저장 전 remote mutation0, 자동 safety corpus 유지. 실제 이미지 QA와 synthetic tests의 범위를 구분한다.
5. manual saved asset이 visual inventory/Planner/Renderer/860px PNG·JPG에서 정상 사용되고 제어부/내부 경고가 export에 섞이지 않는다. 전체 baseline·보안 검사 PASS 뒤 M4를 재평가한다.

## 14. 구현 TASK 분해와 검증 책임

- **TASK-051 domain/API/save/provenance:** strict V2+legacy union, bounded inset→F, canonical/revision/CAS, manual no-auto 경로, default legacy reuse/final identity/capacity, v1/v2 reader·review projection·visual inventory 호환. schema/tampering/0px/3%초과/최소/EXIF/duplicate/partial/CAS/lost-ack/legacy tests. UI 없음. 24개 최대 request8KiB 검증. M4 NEEDS_WORK 유지.
- **TASK-052 Candidate Review UI 완료:** 4 edge+numeric editor, local Apply/Cancel, full-zero/remove 분리, F preview/receipt, ID/basis reconciliation, selection false 보존, 저장됨 variant/슬롯 추정, a11y/responsive/URL lifetime. dependency0, local/mock browser pointer·touch·keyboard·retry·failure 검증. 실제 상품 종료 QA는 TASK-053.
- **TASK-053 Actual Browser + Derived save QA 완료:** 실제 A01/B01 cleaner·추가 손실0, B02 Cancel/preserve, exact F/인코딩 기준/새 metadata, duplicate/부분 실패/모바일/Renderer·export 확인. M4 RESOLVED. 실제 EXIF1 source와 EXIF1~8 domain regression을 구분하며 물리 기기 전체 QA를 주장하지 않는다.
- **TASK-054 v0.2.1 Release Validation:** 051~053 gate 충족/M4 해결 시 진행. package bump/release/Git publish는 별도 TASK 요청 범위에서만 수행한다. 현재 v0.2.0을 변경하지 않는다.

future backlog: 이미 저장된 Derived의 편집/version/Page 참조 교체, outward 복구, 복잡한 transform/segmentation은 별도 계약이 필요하다. TASK-050은 문서만 바꾸며 이 목록의 구현을 시작하지 않는다. 실행 검사·69항목 완료 보고는 [TASK-050](tasks/TASK-050.md)에 기록한다.
