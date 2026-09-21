# v0.2.0 M2/M3 Reproduction Contracts — TASK-037

## TASK-040 UI 및 실제 검증

**TASK-040:** failed-Tile retry UI와 최소 read-only DTO, stable-ID true/false 선택 보존을 구현했다. 실제 도매상품67695797의 연속800×3600 source2-Tile에서 partial→complete, retry OpenAI1회(준비 포함2), 후보5→10, Derived3개 저장/중복 방어를 확인했다. 전체1054 tests PASS. 문서 적용 및 원본 최종 build 재확인은 workspace 쓰기 권한 제한으로 대기 중이다. M2는 기능 gate 충족/최종 확정 대기, M3·MEDIUM4/LOW1은 아직 유지한다. [67개 항목과 한계](tasks/TASK-040.md).


## TASK-039 서버 실행 계약

[Retry service](../src/features/detail-extraction/retry.ts)와 POST `.../extract-product-shots/retry`를 추가했다. 아래 TASK-037/038의 구현 부재는 당시 기록이다. 현재 M2는 **server logic implemented; UI/E2E pending**, M3는 변경 없다. [최종 검증/66개 항목](tasks/TASK-039.md).

- 요청은 strict `{expectedRevision: UUID, requestedTileIds?: SHA256[1..16]}`. 생략은 현재 retryable failure 전체; 중복/빈 배열/성공·미등록·비재시도 ID/임의 model·geometry·fingerprint·checkpoint를 거부한다. 서버가 source bytes/context/model/policy/실제 layout을 다시 계산한다. stale는 provider 호출 전409이며 자동 전체 재분석은 없다.
- 전체 source는 호환성 확인용으로 decode/작은 grayscale layout 계산을 수행한다. JPEG/base64 생성과 provider 전송은 선택된 failed geometry만 index 오름차순으로 한다. 정상 완료는 K대상→K호출, 성공 타일0호출, 각 대상≤1호출. 중단/로컬 실패/예산 초과에서는 아직 보내지 않은 대상은0호출이다. SDK maxRetries0 및429/500 transport mock1회 확인.
- 기존 full analysis와 process slot/product exclusive를 공유한다. retry claim은 새 runId와 기존 success entries로 revision CAS한다. 매 전송 전·checkpoint 저장·최종 publish에서 cursor revision/run/input/scope를 확인한다. retry는 임의의 새 revision을 자동 채택하지 않고409로 멈춘다. provider 직전과 publish 전 source hash/context/model을 재확인한다. 분산 transaction/lock은 추가하지 않았다.
- 매 terminal 결과를 즉시 저장하고 마지막에 전체 completed regions로 기존 normalizeCandidates/NMS/cap/selection을 재실행한다. latestResult/candidates를 append하지 않는다. 모두 재실패하면 기존 latestResult와 analyzedAt를 그대로 유지한다. 새로운 성공 후 집계/DB 실패도 durable successes와 이전 latestResult를 보존한다.
- retry 중에는 checkpoint가 latestResult보다 앞설 수 있으며 attempt.analyzing/failed가 이를 나타낸다. 완료 publish는 latestResult/inputFingerprint/attempt를 한 metadata CAS로 저장한다. compatible complete cache의 명시 retry-all은 AI0의 no-op이고, 이전 집계 중단으로 결과가 뒤처져 있으면 AI0으로 재집계/publish한다.
- response는 code=`retry_completed|provider_failure|no_retryable_tiles`, attempted/succeeded/failed/remainingFailedTileCount, runStatus, candidateCount, revision, latestResultUpdated, billingUncertain만 제공한다. 내부 cache/model/context/서명 URL/이미지/키는 반환하지 않는다. provider_failure는 처리된 실패 결과의 HTTP200이며 요청 거부/내구성 실패와 구분한다.
- error는 checkpoint_missing/invalid/stale/incomplete→409, invalid_retry_target/invalid_input→400, busy/conflict→409, persistence_failure→503. 기존 ownership/origin/no-store/8KiB JSON body 제한 유지. 원본 provider/DB 오류는 공개하지 않는다.
- live attempt/save lease는 busy. 만료된 retry lease는 새 revision으로 명시 요청할 때 terminal success를 보존하고 남은 failed만 실행한다. 이전 failure가 not_dispatched라면 호출 전에 unknown을 저장하여 중단 후 미과금으로 오인하지 않는다. 실제 과금 여부는 보증하지 않는다. 최초 full extraction의 sparse/incomplete cache는 미전송/응답 유실을 판별할 근거가 없으므로 전체 재분석을 안내하고 missing tile을 failure로 발명하지 않는다.
- retry 기본 write는 claim+K terminals+finish=K+2. 이전 not_dispatched→unknown 기록이 필요한 K개에는 최대K writes 추가(최대34 logical writes); 첫 오류 뒤 추가 provider 호출 없음. source 다운로드는 시작+각 dispatch 직전+publish 전 최대K+2회이며 각 기존10MiB/20초 경계를 유지한다. 원격 성능/과금은 미측정이다.
- 선택은 CandidateReview의 로컬 Set이고 analyzedAt key로 remount된다. 서버에 명시 선택 데이터가 없으므로 이번에는 저장 모델/UI를 바꾸지 않는다. **TASK-040 연결 전 stable candidate ID별 checked/unchecked를 보존하고 새 후보에만 default policy를 적용하는 UI 변경이 필수**다. 제거된 후보의 기존 Derived는 수정/삭제하지 않는다.
- 원본 T1~T8을 실제 retry service fixture로 재사용. 신규 mock은 failed-only 수/순서, stale 각 차원, partial/mixed/all-failed, CAS/중단/응답 유실, byte cap, fresh full-run equality, NMS로 후보가 사라져도 Derived 보존, SDK 재시도0, actual route no-op/validation을 포함한다. 실제 OpenAI/도매 API/원격 DB·Storage 변경0.

## TASK-038 구현 델타 (2026-09-21)

아래 TASK-037 본문은 BEFORE 계약/관찰이다. 현재 구현은 [checkpoint domain](../src/features/detail-extraction/checkpoint.ts), [persistence](../src/features/detail-extraction/persistence.ts), [TASK-038 보고](tasks/TASK-038.md)를 따른다. M2 checkpoint persistence를 구현했으며 failed-only 실행/UI는 아직 없다. M3 production/corpus는 변경하지 않았다.

- `assets.metadata.detailExtraction` outer schema는 신규 실행부터 **v2**, `checkpoint.schemaVersion=1`; 기존 outer v1 및 `latestResult` v1/v2, Derived v1을 유지한다. 읽기만으로 migration/AI 호출/metadata 쓰기를 하지 않는다.
- checkpoint: `runId`, `input`, 전체 canonical `layout`, terminal `tiles`. 각 tile은 `tileId/index/geometry/status`와 `completed.result` 또는 `failed.failure`를 가진다. result는 기존 tileOutput v2 Zod 검증 및 geometry 검사 후의 pre-NMS regions다. confidence/relevance/box를 다시 해석하거나 후보 ID를 변경하지 않는다.
- Tile ID는 동결된 SHA-256 tuple 그대로다. 입력 호환성은 source/context/dimensions/orientation/coordinate space/model/schema·prompt·relevance·normalization version과 prompt/actual-layout/layout-policy fingerprint를 함께 비교한다. layout policy는 height/overlap/snap/maxTiles를 포함한다. geometry hash 검증과 현재 설정 비교를 분리하여 이전 정책 cache를 단순 손상으로 오인하지 않는다.
- 새 persisted pending/in_flight 상태는 만들지 않는다. 전체 layout 중 terminal 기록이 없는 타일을 pending count로 계산하고 `incomplete`로 표시한다. 전부 terminal이면 complete/partial/failed를 derive한다. 중단 직전의 미기록 타일은 요청 미전송인지 응답 유실인지 알 수 없다. **TASK-039가 이 불확실성과 lease를 명시적으로 처리해야 하며, 미기록 타일은 현재 retryable IDs에 포함하지 않는다.**
- 16 tiles × 8 regions / checkpoint JSON UTF-8 **262,144 bytes**. 실제 outer cache envelope/layout를 포함한 합성 최대 설명: 한글 **156,616B**, escaped control **271,816B**. 후자는 저장 전 거부한다. NUL/잘못된 surrogate는 JSONB 비호환으로 거부한다. 원격 PostgreSQL round-trip 검증은 이번 범위에서 하지 않았다.
- 매 terminal 타일 직후 기존 revision CAS로 read-current/merge/write. claim + N checkpoints + finish = 기본 N+2회, 최대18 logical writes. CAS 재시도는 최대3회이며 provider를 재호출하지 않는다. input/run/storage scope가 맞지 않으면 거부한다. metadata 전체/기존 namespace는 보존한다.
- failure는 enum `kind/code`, `retryable`, `billing`만 저장한다. 원본 예외/메시지/stack를 저장하지 않는다. success에도 URL/키 패턴/절대경로 등 위험 문자열을 거부한다. raw 응답/prompt/context/bytes를 checkpoint로 복제하지 않는다.
- oversize/invalid/unsafe/JSONB 불가 cache는 이전 durable checkpoint를 유지하고 `checkpointWriteError`를 기록한다. 해당 run의 cache 쓰기를 중단하지만 정상 후보 생성은 완료할 수 있다. DB 내구성 실패는 다음 provider 호출을 중단하고 이전 성공 결과/cache를 보존한다. 명시 새 전체 분석은 한 cache 세대만 교체한다.
- `latestResultInputFingerprint`를 cache와 따로 보존하여 실패한 새 run의 cache를 이전 성공 결과의 입력으로 오인하지 않는다. malformed checkpoint만으로 latestResult/Derived save를 차단하지 않는다. checkpoint를 자동 복구/삭제하지 않는다.
- read model은 존재/validity/compatibility/runStatus/성공·실패·미기록 수/persistenceError/retryableTileIds를 제공한다. 입력이 주어지고 compatible이며 같은 run 소유, live analyzing이 아니고 persistenceError가 없는 경우에만 retryable terminal failure를 노출한다. 실제 retry executor는 없다.
- T1~T8 기존 fixture를 production domain test에서 직접 재사용한다. T5/T8은 순수 전이 검증만 수행한다. 후보 결과·selection/relevance/Derived/source 보존과 loopback mock CAS/partial/all-failed/중간 DB 실패/oversize를 추가 검증한다.

기준: `feat/v0.2-repro-contracts`, HEAD `4f33eab`, application version **0.1.1**. 이 문서는 문제·기대 동작과 BEFORE 관찰을 고정한다. **M2 retry/M3 role-aware 판정의 구현 또는 해결 보고가 아니다.** 앱·prompt·알고리즘·UI·DB schema 변경과 실제 외부 호출은 없다.

현재 추출 경로는 `src/features/detail-extraction/`이다. 요청문의 `detail-image-extraction/` 디렉터리는 없다. 실제 source naming을 유지한다. [Roadmap](V0_2_ROADMAP.md), [Backlog](RELEASE_BACKLOG.md), TASK-024/026/028/031/034/035/036과 관련 schema/service/grounding/prompts를 대조했다. 기존 QA 기록은 최소 문구만 사용하며 과거 provider 응답을 복원했다고 주장하지 않는다.

## 1. 실행 가능한 산출물과 범위

- [M2 corpus](../tests/fixtures/v0.2/m2-tile-recovery.mjs): synthetic T1~T8. 고정 source/context hash, 실제 `planTiles`와 같은4타일 geometry, terminal 상태와 명시 전이의 기대값.
- [M3 corpus](../tests/fixtures/v0.2/m3-copy-repetition.mjs): C1~C22, 기대 분류와 현재 helper 관찰을 별도 저장. C19만 TASK-035의 최소 실제 제목/본문 인용이며 ID·context는 검증용으로 재매핑했다. 나머지는 synthetic, 공급처 실제 Fact라는 뜻이 아니다.
- [test-only validator](../tests/helpers/v0.2-contracts.mjs): `validateM2Corpus`, `validateM3Corpus`, `validateCacheProjection`, reference `contractTileId`, `observeCurrentCopy`. production에 import하거나 cache를 저장하지 않는다. 미래 retry executor/semantic classifier가 아니다.
- [M2 tests](../tests/v02-m2-contracts.test.mjs), [M3 tests](../tests/v02-m3-contracts.test.mjs): 데이터 무결성·잘못된 corpus 거부·현행 helper/service characterization. 미래 기능을 기대하는 failing/skipped/TODO test는 없다.
- `.mjs`는 기존 Node24 `node:test`/`tests/register.mjs` 및 fixture convention을 따른다. UUID·시각은 고정 test 값만 사용하며 cache fixture에는 시각이 필요 없어 넣지 않았다. signed URL·로컬 절대경로·원본 provider envelope·키·이미지 bytes를 corpus에 저장하지 않는다.

## 2. M2 현재 원인과 용어

[service](../src/features/detail-extraction/service.ts)는 성공 타일의 regions를 메모리에 합쳐 전체 NMS/cap 후 `latestResult.candidates` 최대24개만 저장한다. 실패 index와 성공 수는 있으나 타일별 pre-NMS 결과가 없다. `force=false`는 같은 입력의 partial 전체 결과도 재사용하고 `force=true`는 모든 타일을 다시 호출한다. 후보 cap·중복 제거 이전 정보는 최종24개로 복원할 수 없다.

| 용어 | 동결한 의미 / 현재 코드와 관계 |
| --- | --- |
| extraction run | 한 번의 명시 분석 실행. 현재 outer `attempt.runId`와 analyzing/completed/failed 기록. provider 요청 하나와 다름 |
| source fingerprint | 원본 bytes SHA-256. URL·Storage 서명·파일명은 제외 |
| product context fingerprint | bounded identity context의 canonical SHA-256. 이름/카테고리/브랜드/허용 식별 정보이며 전체 Facts hash는 아님 |
| tile | EXIF 정규화 원본의 수직 rectangle. 실제 `TileRect={index,x,y,width,height}` |
| tile index | 해당 layout 내0부터 시작하는 순서. 단독으로 cache의 전역 식별자가 아님 |
| tile pixel range | `[x,x+width) × [y,y+height)`, orientation_normalized_pixels. overlap은 의도됨 |
| tile identity | source/context/index/geometry 기반 결정적 hash. **현재 production에는 별도 tileId helper 없음** |
| successful tile | provider 출력이 strict schema와 geometry 검증을 통과한 타일. regions=[]도 성공. 후보가0개라는 이유로 실패 아님 |
| failed tile | 호출·응답 검증·local 처리 실패가 terminal로 판정된 타일. 실제 이유/요청 여부가 알려진 범위만 요약 |
| cached tile result | 검증된 pre-NMS tileOutput(v2)과 identity/geometry를 보존하는 **미래** cache entry |
| stale tile result | source/context 또는 호환성 입력이 바뀌어 현재 분석에 결합할 수 없는 결과. 과거 성공 기록은 보존 가능 |
| retryable tile | 현재 입력과 일치하고 status=failed이며 failure.retryable=true인 타일. pending/in_flight/성공/구입력은 제외 |
| completed run | 이 문서의 `complete`: 모든 타일 성공. 현재 attempt.status=completed는 partial도 포함하므로 같은 의미가 아님 |
| partial run | 적어도1타일 성공 및1타일 실패. 현재 attempt.completed + latestResult.partialAnalysis=true |
| failed run | 성공0개/모든 타일 실패. 현재 attempt.failed, 새 latestResult 없음; 이전 성공이 있으면 그것을 유지 |

T1~T8의 expected.runStatus는 **cache가 만들어진 입력에서의 terminal 결과**이고 stale는 별도 축이다. T6/T7의 partial이 현재 입력의 유효 결과라는 뜻은 아니다.

## 3. Tile identity / cache compatibility

test-only reference의 고정 tuple:

```text
SHA256(UTF8(JSON.stringify([
  "detailforge.tile", 1,
  sourceFingerprint, productContextFingerprint,
  index, x, y, width, height
])))
```

이 tuple의 문자열/정수 순서를 고정한다. T1 tile0 golden hash는 test에서 literal로 비교한다. 동일 입력은 status/응답 문구/relevance/confidence/재시도 횟수에 관계없이 같은 identity다. source/context/index/geometry 중 하나가 바뀌면 재사용하지 않는다. 기존 `candidateId(sourceHash,rect,regionType)`는 crop 후보의 ID이며 tile ID로 재활용하지 않는다.

**identity가 같다는 것만으로 cache 재사용을 허용하지 않는다.** cache input에는 source/context hash, normalized sourceDimensions/sourceOrientation/coordinateSpace, provider model 식별자, tileOutputSchemaVersion, tilingVersion/promptVersion/policyVersion/normalizationVersion이 들어간다. ordered tile geometry도 현재 layout과 완전히 일치해야 한다. version 이름은 logical contract이며 아직 존재하지 않는 production 상수를 있다고 가정하지 않는다. policy/model 변경은 geometric tile ID를 바꾸지 않더라도 cache compatibility를 깨뜨린다.

재사용은 서버가 실제 최신 입력에서 재계산한 동등성으로 결정한다. 클라이언트가 준 hash만 신뢰하지 않는다. provider가 같은 model 이름의 내부 동작을 바꾸는 것까지 감지한다는 보장은 없다. 이 tuple이나 호환성 정의를 바꿀 때는 계약 version·golden tests·문서 변경 이유를 함께 남긴다.

## 4. M2 corpus / gap matrix

고정 geometry는 `(index,y,height)` 기준 `(0,0,2048)`, `(1,1792,2048)`, `(2,3584,2048)`, `(3,5376,624)`이며 폭400/높이6000이다.

| Case | BEFORE / 동결 expected | 현재 저장·복구 | 향후 필요 |
| --- | --- | --- | --- |
| T1 | 4성공, complete, 재사용0~3, retry[] | 최종 후보 저장 가능, 전체 결과 재사용 가능 | 타일별 checkpoint/cache |
| T2 | 1번 실패, partial, 성공0/2/3 보존, retry[1] | 성공 후보와 failedTiles=[1] 저장. force는4호출 | 실패1번만 호출 |
| T3 | 0/2 비연속 실패, partial, retry[0,2] | 실패 index 기록·성공 후보 저장 가능, 부분 복구 없음 | 비연속 target을 정확히 결합 |
| T4 | 모두 실패, failed. provider/timeout/invalid output은 명시 재시도 후보0/1/2, deterministic local geometry 오류3은 제외 | attempt.failed, 이전 latestResult 또는 null. 실패별 cache는 없음 | 안전한 원인/eligibility, 이전 성공 보존 |
| T5 | 같은 입력의 retry[1]이 다시 실패; 성공0/2/3과 Derived 유지 | 재분석 실패 시 이전 성공 보존은 이미 있음. 성공 타일 무호출은 없음 | 성공 entry byte-equivalent 보존과 실패 타일만 재호출 |
| T6 | source hash 변경: 과거 partial은 stale, reusable/retry 모두[] | 현재 일반 분석은 새 전체 실행 가능; 옛 crop 저장은 source 검사 | 구입력 cache 결합 금지, 새 전체 분석 비용 명시 |
| T7 | product context hash 변경: relevance stale, reusable/retry[] | v2 context 상태·재사용 무효화 존재, 기존 Derived 유지 | context-specific 결과를 현재처럼 재사용 금지 |
| T8 | 같은 identity의1번 retry 성공→complete;0/2/3·Derived 불변 | 해당 타일 교체/병합 API 없음 | 실패 entry만 검증된 성공으로 교체, 전체 NMS/cap 한 번 |

**현재 서비스의 deterministic BEFORE 재현:** 합성400×6000 원본과 loopback DB/Storage mock, 주입 provider로4호출 중1실패를 발생시킨다. force=false 추가0회, 기존 성공 candidate의 실제 Sharp crop을 mock Storage에 저장한 후 전체 실패 재분석4회에도 이전 결과·Derived 보존, 다음 성공 force4회를 확인한다. provider는 전부 mock이며 실패-only1회를 실행한 검증이 아니다. 초기 전부 실패의 latestResult=null도 별도 확인한다.

## 5. Failure / explicit retry 계약

| 원인 category (test-only) | 현재 공개 code / 한계 | 향후 정책 |
| --- | --- | --- |
| provider_error | provider; SDK의 세부 오류는 노출하지 않음. 알 수 없는 주입 오류는 service에서 unexpected로 축약될 수 있음 | 알려진 일시 실패만 명시 재시도 가능. 인증/설정/권한/호출 제한을 알고 있다면 차단·안내하고 계속 호출하지 않음 |
| timeout | timeout; 실제 호출 후 공급자 과금 여부는 미확인일 수 있음 | 명시 확인 후만 재시도, 자동 호출0, exactly-once 과금 보장 금지 |
| structured_output_invalid | invalid_response; strict/Zod·JSON 오류 등 | malformed result를 성공 cache로 보존하지 않음. 명시 재호출만 가능 |
| local_processing_error | invalid_rect/decode 등 여러 code에 해당할 수 있고 unexpected로 축약되기도 함 | 같은 입력의 결정적 local 실패는 provider 재호출로 해결하지 않음. T4는 invalid_rect 사례이며 전체 production code enum의 대체물이 아님 |

위 category/eligibility는 production enum에 추가하지 않는다. cache failure는 kind/code/retryable/billing만, message/stack/HTTP URL/raw error를 넣지 않는다. billing은 `not_dispatched | unknown`이며 실제 과금 유무를 추측하지 않는다. provider/timeout/invalid response라도 retryable=false인 차단 상태가 가능하다. 이번 양성 retry fixture는 설정된 일시 오류를 명시한 synthetic 사례다.

향후 invariant:

1. 사용자 명시 retry만 허용, 자동 반복/숨은 후속 분석 없음. 실행 전 예상 대상 수와 과금 미확인 상태를 알린다.
2. 동일 source/context/compatibility/layout의 **failed+retryable**만 대상. completed는0회, 대상당 명시 실행1회 이하.
3. `pending`은 아직 실행 안 됨, `in_flight`는 진행/확인 불가다. 둘 다 즉시 failed-only 대상이 아니다. live lease 중에는 거부한다. 중단을 확인한 뒤 미전송 pending은 not_dispatched, 응답 불명 in_flight는 unknown을 가진 terminal failure로 정리하는 절차가 있어야 명시 retry를 할 수 있다. 이 정리와 lease persistence는 TASK-038/039 범위다.
4. runId/revision/CAS로 새 checkpoint·타 namespace·늦은 결과를 보호한다. DB 저장 재시도가 provider 재호출을 유발하면 안 된다.
5. 성공 entry는 그대로 보존하고 동일 tile identity의 실패만 새 strict 출력으로 교체한다. 결과를 tile index 순으로 합쳐 기존 normalizeCandidates의 NMS/cap을 전체에 한 번 적용한다. 문자열 수정/box 추측 복구 없음.
6. retry 실패 시 이전 성공 entries/latestResult·기존 Derived 보호. NMS/cap 이후 후보 목록은 바뀔 수 있으므로 UI 선택은 기존 ID만 연결하고 새 후보를 자동 승인하지 않는다. Source/Derived/Options/Facts 자동 삭제·재작성 금지.

## 6. Cache logical shape / bounds / legacy

아래는 test-only 논리 계약이다. 실제 `assets.metadata.detailExtraction`에 넣는 outer state의 schemaVersion/reader/writer/CAS 구현은 TASK-038에서 한다.

```text
cache {
  schemaVersion: 1,
  input: { sourceFingerprint, productContextFingerprint, sourceDimensions,
           sourceOrientation, coordinateSpace, model, tileOutputSchemaVersion,
           tilingVersion, promptVersion, policyVersion, normalizationVersion },
  tiles: [{ tileId, index, geometry:{x,y,width,height},
            status: pending | in_flight | completed | failed,
            result: completed일 때만 {schemaVersion:2, regions:[검증된 region]},
            failure: failed일 때만 {kind,code,retryable,billing} }]
}
```

- current input generation의 cache1개, 최대16 tiles/타일당8 regions. 최종 후보24개 제한은 별도로 유지한다. 이 논리 cache schemaVersion1을 기존 outer state1과 동일 계약으로 간주하지 않는다.
- 이전 retry attempts 무한 배열, raw tile bytes/base64, 원본 provider 응답, prompt, secret/URL/오류 객체는 금지. 이전 latestResult는 새 결과가 실패해도 보존한다. cache와 latestResult는 별개이며 전체 metadata byte/DB latency 한도는 persistence 구현에서 추가 측정한다.
- cache UTF-8 `JSON.stringify` 결과 **262,144 bytes(256KiB)** 상한. 최대16×8 및180/120자 rationale/relevanceReason, model200자의 측정 결과: 한글 최대 길이 **155,616 bytes**, JSON escape가 필요한 NUL 문자 최대 길이 **270,816 bytes**. 후자는 현재 tile schema에 유효하더라도 cache byte limit에서 거부한다. 이는 JSON 직렬화 크기이며 Postgres 내부 JSONB 크기 측정은 아니다.
- 위 수치는 regions 수와 설명 문자열 길이를 상한으로 둔 측정 fixture이며 모든 숫자·geometry·model 문자열 조합의 수학적 최대 크기는 아니다. 따라서 ‘schema만 통과하면256KiB 이내’라고 가정하지 않는다. byte cap 초과 시 이전 checkpoint/성공을 보존하고 bounded local 실패로 알린다. 조용한 일부 regions 삭제나 문자열 truncation으로 성공 cache를 만들지 않는다. 자동 유료 재호출도 하지 않는다. escape/control text 처리와 Postgres JSONB 수용성은 TASK-038의 저장 경계에서 검증해야 하며 이 fixture의 control 문자열을 DB에 쓰지 않는다.
- 기존 result v1/v2는 cache가 없어도 readable. v1에는 relevance/context를 만들어 넣지 않는다. v2의 context stale는 기존 helper로 표시한다. legacy → cache 없음 안내 → 필요 시 명시 전체 분석이며, 읽기만으로 AI 호출/metadata rewrite 없음.
- 새 reader의 backward compatibility와 옛 binary의 새 envelope 수용 여부는 별개다. compatibility reader부터 도입하고 rollback 시 cache를 파괴적으로 지우지 않는다. 이전 schema에 무조건 새 field를 추가하면 strict reader가 거부할 수 있다.

## 7. M3 역할과 판정 경계

M3는 문장 하나의 문법 오류가 아니라 title/body 또는 페이지 여러 역할에서 새 정보 없이 같은 사실·관찰을 반복하는 문제다. exact/normalized text의 상당 부분은 현행 경고로 잡지만 모든 의미 반복을 판단하지 않는다.

실제 `COPY_INTENTS`는10 section type에9 intent다:

| Section type | 현행 copy intent |
| --- | --- |
| hero | identity |
| keyBenefits | benefit_from_fact |
| feature | feature_from_fact |
| imageText / gallery | visual_description |
| detail | detail_description |
| useCase | usage_hypothesis |
| option | selection_information |
| specification | specification |
| notice | notice |

taxonomy는 재설계하지 않는다. corpus의 `sections[]`는 `copyIntent`, `purpose`, 실제 strict `content`를 가진다. Hero의 ‘title/body’ 개념은 **headline/subheadline**, Specification은 rows, Option은 confirmed optionSnapshot을 사용한다. 존재하지 않는 hero.title/body/items를 억지로 추가하지 않는다. 각 case에는 pageContext/evidence registry/asset IDs/출처/expected 분류와 근거가 있다. null과 필드 부재도 실제 schema를 따른다.

**test-only 기대 classification:** allow=해당 문제 축에서 허용, warning=사람 검토가 필요한 반복 위험, reject=새 AI 출력에서 거부할 명확한 보고체/목적 중복 목표. 현재 production에 새 enum이나 hard policy를 넣지 않는다. warning을 후속 TASK에서 근거 없이 일괄 reject로 올리지 않는다. 수동/legacy 저장은 기존 검토 경고 경계를 유지한다. allow는 사실 진위·전체 grounding·페이지 release 통과를 뜻하지 않는다.

| repetition category | 의미 |
| --- | --- |
| exact_text | 글자 그대로 같은 marketing 문장 |
| normalized_text | NFKC/공백·구두점 처리 후 같음 |
| fact_reuse | 동일 F가 여러 marketing 역할에 재등장. canonical 예외와 구분 |
| title_body_redundancy | 한 Section 안 제목/본문의 정보가 같음 |
| cross_section_purpose | 서로 다른 Section이 동일 목적을 채움 |
| visual_message_reuse | 같은 V/이미지 관찰을 별도 정보처럼 재사용 |
| meta_observation | 촬영·보는 행위의 보고체. 중복과 구분되는 보조 품질 축 |

Spec의 canonical Fact 원문과 Option의 confirmed 값은 marketing prose 중복 대상이 아니다. Hero identity→Spec 공식 품명 재표시는 정상. 단 Spec/Option의 **제목**은 현행 commerceText에서 여전히 prose 검사 대상이다. 값이 같다는 이유만으로 지우거나 Fact/Option을 변경하지 않는다.

후속 TASK-041은 텍스트만 비교하지 않고 F/V IDs, Asset IDs, role/type, purpose, normalized title/body 신호를 함께 사용해야 한다. 같은 이미지도 새로운 supported F면 허용할 수 있다(C5). 다른 Asset ID라고 실질적으로 다른 메시지라고 단정하지 않는다. Embedding/추가 AI/자동 문장 치환은 범위 밖이다.

## 8. M3 gap matrix — 현재 관찰과 미래 기대를 분리

현재 관찰은 실제 `validateCommerceCopy`, `messageDuplication`/`validateMessageDistinctness`, `copyQuality`, `factCoverage` 호출 결과다. body를 보지 않는 message signature에 임의로 body를 넣어 결과를 유리하게 만들지 않는다. `factCoverage`의 예산 초과는 현재 Planner의 경고 신호이며 hard reject가 아니다. 아래는 전체 생성/grounding E2E가 아닌 helper 수준 결과다.

| Case | 내용 | 기대 | 현재 관찰 | Gap / 후속 |
| --- | --- | --- | --- | --- |
| C1 | Hero identity + Spec 상품명 | allow | 중복 신호0 | canonical 예외 유지 |
| C2 | visual 외형 + Spec 크기 | allow | 신호0 | 서로 다른 정보 보호 |
| C3 | Hero identity + confirmed option 값 | allow | 신호0 | 옵션 원문/UUID/순서 보존 |
| C4 | 다른 Asset/V의 ImageText·Detail | allow | 신호0 | 정상 차별화 유지 |
| C5 | 같은 Asset, Hero와 다른 supported F의 Feature | allow | 신호0 | 이미지 일치만으로 거부 금지 |
| C6 | Hero headline/subheadline 재진술 | warning | **놓침**, 신호0 | TASK-041 role-aware title/body |
| C7 | Hero/ImageText 동일 F/V/Asset 메시지 | reject | duplicate_purpose 거부, F1 예산 초과 | 기존 검출 유지 |
| C8 | ImageText/Detail 동일 V/Asset 관찰 | reject | duplicate_purpose 거부 | 기존 검출 유지 |
| C9 | ‘40매 구성’ / ‘총40매로 구성’ | warning | F3 예산 초과 경고만, copy/message 검출0 | 부분 검출. 의미/역할 설명 개선 |
| C10 | ‘앞면 지퍼 여밈’ / 동일 본문 | warning | **놓침**, 신호0 | TASK-041 title/body |
| C11 | Hero/Feature/Detail 크기 F2 반복 | warning | F2 예산 초과 경고만 | 부분 검출. 역할별 검토 설명 |
| C12 | Hero 크기 + Spec 동일 크기 | allow | 신호0 | deterministic 표 예외 |
| C13 | ‘모델이 착용하고 있는 모습입니다.’ | reject 목표 | **놓침**, meta guard 통과 | 촬영/관찰 보고체 negative gap |
| C14 | ‘제품을 촬영한 사진입니다.’ | reject | meta_observation 거부 | 기존 검출 유지 |
| C15 | ‘정면에서 촬영한 이미지입니다.’ | reject | meta_observation 거부 | 기존 검출 유지 |
| C16 | ‘사진에는 제품의 앞모습이 보입니다.’ | reject | meta_observation 거부 | 기존 검출 유지 |
| C17 | ‘앞면 지퍼 여밈 디자인’, V 있음 | allow | 신호0 | grounded 정상 명사구 보호 |
| C18 | ‘제품의 전체 실루엣’, V 있음 | allow | 신호0 | grounded 정상 명사구 보호 |
| C19 | TASK-035 실제 제목/본문 최소 인용 | warning | **놓침**, 신호0 | 실제 남은 M3의 대표 BEFORE |
| C20 | 동일 제목/본문 문자열 | warning | duplicateCopyCount=1 | 현행 경고 양성 control |
| C21 | 공백/구두점만 다른 제목/본문 | warning | duplicateCopyCount=1 | 현행 정규화 양성 control |
| C22 | 실제 visual/V + body=null | allow | 신호0 | 부족한 본문을 발명하지 않음 |

총22: allow9/warning7/reject6. 놓침4(C6/C10/C13/C19), 부분 신호2(C9/C11), 목적 중복 거부2(C7/C8), meta 거부3(C14~16), exact 경고2(C20/21), 정상 허용9. 전체 corpus에서 duplicateTitleCount는0이며, 별도 positive test로 공백/구두점 titleSimilarity=1을 확인한다. 이는 인간 의미 판정의 정확도/recall 통계가 아니다.

## 9. 검증·변경·다음 TASK 계약

- 기존 helper naming: commerceText/validateCommerceCopy/messageSignature/messageDuplication/validateMessageDistinctness, policy의 normalizedTitle/titleSimilarity/factCoverage/copyQuality. Planner service, Section grounding, Regeneration grounding에서 공통 검사 연결을 확인했다. 새 classifier를 구현하지 않았다.
- validators는 case 누락·중복 ID·잘못된 기대 상태/분류·unknown evidence/Asset·V/이미지 불일치·canonical row 변경·성공 tile 변경·Derived 삭제·raw 오류·상한 초과를 거부한다. immutable한 BEFORE 관찰과 future expected를 함께 두어 차이를 숨기지 않는다.
- 후속 구현으로 BEFORE가 개선되면 해당 characterization의 변경 이유/새 actual 값과 gap matrix를 함께 검토한다. 테스트를 삭제/skip해 통과시키거나 desired label을 현행 결함에 맞춰 바꾸지 않는다. corpus 추가는 provenance와 negative control을 함께 제시한다.
- TASK-038: 이 계약의 domain/cache reader·checkpoint persistence·metadata CAS·bounded serialization·legacy rollback 경계. pending/in_flight 정리와 DB JSONB 허용성/전체 metadata 비용을 검증하고 provider 실행은 추가하지 않는다.
- TASK-039: 동일 입력의 failed-only 명시 서버 실행, 호출 수·lease·불확실 과금·성공 보존. TASK-040: retry/review UI와 선택 보존. TASK-041: C6/C10/C13/C19 및 부분 경고 설명을 중심으로 role-aware 정책, 정상9개와 canonical 예외 유지. 각 TASK는 별도 승인 범위로 진행한다.
- M2/M3는 **reproduction contract established, unresolved**. MEDIUM4/LOW1, package0.1.1 유지. 이번 실제 OpenAI0/도매 API0/원격 DB·Storage mutation0. loopback mock에서만 source/crop을 만들며 종료 시 in-memory DB/server를 정리한다.

최종 전체 tests·typegen/typecheck/lint/build·diff/secret·bundle 검증 결과와46개 항목 보고는 [TASK-037](tasks/TASK-037.md)에 기록한다.
