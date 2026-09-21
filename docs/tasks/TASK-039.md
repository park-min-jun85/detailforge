# TASK-039 — Explicit Failed-Only Tile Retry Server Logic

상태: **완료 — 전체1,034 tests 및 필수 검사 PASS**. 브랜치 `feat/failed-tile-retry`, HEAD `76a14e0`. 이전 `helper_unknown_error: setup refresh had errors`는 실행 환경 오류였으며 코드 실패로 기록하지 않는다.

환경 복구 후 먼저 branch/status/diff --check/diff 및 untracked execution.ts/retry.ts 전체를 읽었다. 기존 errors.ts/http.ts/service.ts 변경과 신규2파일을 보존하고 이어서 작업했다. **reset/restore/clean을 실행하지 않았다.** 실제 API/원격 DB 변경 없는 mock 검증이다.

1. **목적:** 명시 요청으로 현재 compatible checkpoint의 retryable failed Tile만 호출하고 성공 결과를 보존한다. UI 없음.
2. **Branch:** `feat/failed-tile-retry`, 기준 `76a14e0`; commit/main merge/tag 없음.
3. **기존 M2:** TASK-038 checkpoint 저장/identity/stale 구현 완료, retry 서버/UI 미구현. 이번에 서버만 완성.
4. **Entry point:** POST `/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry`, [route](../../src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry/route.ts), Node runtime/maxDuration360초. [service](../../src/features/detail-extraction/retry.ts)의 retryProductShots 호출. GET/조회로 실행하지 않음.
5. **Request:** strict expectedRevision UUID 필수, requestedTileIds 선택(1~16 SHA-256, unique). 생략하면 eligible 전체. client는 geometry/model/state/Storage path를 정할 수 없음. HTTP same-origin/JSON8KiB 제한 유지.
6. **Source of Truth:** 서버 Asset/checkpoint, 다시 받은 원본 bytes hash, 현재 Product identity context, 실제 모델·prompt/policy/layout. 요청에 있던 trusted state를 사용하지 않음.
7. **Target validation:** requested ⊆ retryable failed. 성공/없는 hash/비retryable/중복/빈 배열/과다 입력 거부. 저장 geometry와 ID는 그대로.
8. **Compatibility:** 처음 source/context/model/policy/actual-layout 전체 비교. 매 provider 직전 source/context/model 재확인, publish 전에 다시 확인. source/layout cache를 삭제하거나 자동 full analysis하지 않음.
9. **Retryable policy:** bounded retryable failure만, valid cache·동일 input·run 소유권 필요. local deterministic invalid_rect 등은 임의 재실행하지 않음. stale/손상/legacy 거부.
10. **Tile bytes:** long source decode와 작은 grayscale layout 계산은 호환성 확인에 사용. 선택된 failed geometry만 기존 tileDataUrl로 JPEG/base64 생성. 이미지 처리 알고리즘/의존성 변경 없음.
11. **Call policy:** 정상 종료 K대상→K provider calls, 성공 Tile0, 대상당≤1. local exception/timeout/충돌/저장 실패로 중단되면 미전송 대상은0; 무조건 K회를 채우지 않음. attempted count는 실제 dispatch 기준.
12. **Automatic retry:** 없음. 기존 SDK maxRetries0/logLevel off 유지. 429/500 transport mock에서 각1호출 확인. queue/job/backoff 없음.
13. **Ordering:** tile index 오름차순. 요청 배열 순서를 뒤집어도1→3 순서 유지.
14. **Success transition:** 같은 ID/index/geometry의 failed를 strict tileOutput v2 completed로 변경. 기존 completed entry deep-equal 유지.
15. **Failure transition:** 최신 bounded failure summary로 교체, 상태 failed 유지. raw error/history 배열 저장 없음. 모든 선택 대상이 재실패하면 이전 latestResult/analyzedAt 그대로.
16. **Mixed:** 하나 성공/하나 재실패→partial, 실패 수1, 나머지 성공 보존.
17. **Complete:** 마지막 retryable failure 성공→complete, 전체 success에서 후보 재계산.
18. **All-failed:** 0성공은 failed, 일부 성공 partial, 모두 성공 complete. retryable=false가 남으면 complete로 꾸미지 않음.
19. **Persistence timing:** claim 후 각 terminal 결과 즉시 CAS, 마지막 validated aggregate+attempt publish. 기본 K+2 writes. 이전 not_dispatched인 failure는 dispatch 전에 unknown으로 보존하는 최대K writes 추가. 새 history/schema version 없음.
20. **Interruption:** 준비/집계/DB 예외 시 이전 latestResult와 이미 저장된 success를 보존하고 나머지 failure는 남김. live lease 거부, 만료 후 새 명시 요청만 가능. 오래된 writer는 run/revision 거부. sparse full-run cache는 미기록 타일을 추측하지 않고 checkpoint_incomplete→전체 재분석 안내. 브라우저 disconnect로 저장된 checkpoint rollback 없음.
21. **Reaggregation:** checkpoint의 모든 completed regions를 순서대로 기존 normalizeCandidates→좌표/ID/NMS/dedup/cap24/relevance/default policy에 투입. 이전 후보 append 없음.
22. **Fresh equivalence:** 동일 outputs에서 partial+retry 결과와 실제 analyzeProductShots full4calls 결과를 analyzedAt 제외 deep-equal 비교. domain aggregate 비교도 유지.
23. **Candidate ID:** 기존 source/crop/type hash 그대로. retry 때문에 hash contract 변경 없음. NMS 승자가 바뀌면 후보 ID가 바뀔 수 있으나 이는 기존 알고리즘 동작.
24. **User selection:** DB에 명시 선택 상태 없음. CandidateReview 로컬 useState Set, analyzedAt key remount 구조 확인. 서버가 선택을 발명/저장하지 않음. TASK-040에서 stable ID별 checked/unchecked 보존 후 연결해야 함. 이번 범위에서 UI 선택 보존을 완료했다고 주장하지 않음.
25. **Derived:** retry 경로에서 INSERT/DELETE/Storage upload/remove 없음. NMS로 기존 후보가 사라져도 승인한 Derived row/object/provenance unchanged 확인.
26. **LatestResult:** 중간 checkpoint가 앞서는 동안 attempt.analyzing/failed와 이전 result 공존. 마지막 결과+inputFingerprint+attempt는 단일 metadata CAS. 집계 실패 후 complete cache의 명시 retry-all은 AI0으로 결과 복구 가능. 양호한 complete cache는 쓰기0 no-op.
27. **Concurrency:** full/retry 공통 process slot + 기존 product exclusive. 초기 expectedRevision, 매 cursor검사/run/input/scope/storage 경로, 최종 revision CAS. 외부 revision 변경을 자동 채택하지 않고409. 기존 full-analysis 자체의 CAS 재시도 동작은 변경하지 않음. 별도 분산 lock/transaction 없음.
28. **Idempotency:** 성공 후 같은 old revision 요청은 conflict0call; 새 revision에 이미 성공한 target 명시는 invalid_retry_target0call. no-target all 요청은 no-op/필요한 local 재집계만.
29. **Missing:** checkpoint_missing409, 명시 full analysis 안내. legacy 조회와 Derived save는 기존대로.
30. **Stale:** checkpoint_stale409, 호출 전 기존입력 변경0call. 실행 중 입력이 변경되면 다음 dispatch/publish 전에 중단. 기존 source/context hash에 속하는 저장 checkpoint를 새 입력 성공으로 승격하지 않음.
31. **Corrupted:** checkpoint_invalid409. checkpointWriteError/잘못된 cache/run 소유권도 거부. malformed subtree로 정상 latestResult 읽기를 차단하지 않음.
32. **No retryable:** HTTP200 code=no_retryable_tiles, attempted0. complete current cache는 metadata writes0. 비retryable failure만 남아도 유료 요청 없음.
33. **Error:** invalid_input/invalid_retry_target400; busy/conflict/checkpoint_missing/invalid/stale/incomplete409; persistence_failure503; 기존 forbidden403/not_found404 유지. provider 실패는 처리된 결과의 code=provider_failure로 표현, raw 예외 비노출. oversize는 이전 cache entries/result 보존+503, 호출 비용 가능성 문구.
34. **Response:** exported RetryResult: code(retry_completed/provider_failure/no_retryable_tiles), attempted/succeeded/failed/remainingFailedTileCount, runStatus, candidateCount, revision, latestResultUpdated, billingUncertain. cache/model/context/source hash/URL/bytes/key 없음. billingUncertain은 실제 청구 확정값이 아님.
35. **1 failed:** T2/T8 실제 service1call, completed3 unchanged, complete PASS.
36. **2 failed:** index1·3 각각1call, 순서 고정 PASS. 16tile 중1failure도 encode1/call1 PASS.
37. **Partial request:** 두 failure 중1개만 요청→call1, 나머지 failure/retryability 유지 PASS.
38. **Mixed outcome:** call2, success1/failure1, remaining1/partial PASS.
39. **Stale tests:** source/context/model/policy/prompt/normalization/layout policy/실제 geometry 각각0call; 준비 중 source/context/model 변경도0call. provider 처리 중 context 변경은 publish 거부 PASS.
40. **Legacy:** outer v1의 result v1/v2 둘 다 읽기 정상, retry0call/full reanalysis 안내 PASS.
41. **Conflict:** revision/new run/input 변경, read와 PATCH 사이 경합, 동시 retry/full busy, DB ack 유실 reconcile 모두 PASS. 타 namespace 유지.
42. **Interruption:** 3 retryable 대상 첫 success 저장 후 두 번째 local exception → calls1/첫 success 유지/나머지 failure/이전 latestResult 유지. 다음 명시 실행은 남은1·2만. not_dispatched→unknown을 dispatch 전에 기록하여 DB 중단 후 과금 안전성 보존.
43. **Equivalence:** normal full vs partial retry candidates/rect/role/defaultSelected/IDs 포함 전체 결과 동일 PASS. timestamp만 실행별 차이.
44. **Relevance:** 기존 v2 region/후보 필드 유지, 빈 regions 성공도 정상 처리, invalid schema/geometry는 bounded failure. TASK-031 원본 회귀 실행.
45. **Selection regression:** 기존 client-local 상태/키를 characterization test로 확인. UI 변경0, ID 안정성 회귀. UI 재연결 시 선택 유지 구현은 TASK-040 필수.
46. **Derived regression:** 저장 Derived row/object/provenance 불변, NMS 제거 후보 사례 포함 PASS.
47. **생성 파일:** execution.ts/retry.ts(이전 세션 파일 보존·완성), retry/route.ts, tests/detail-extraction-retry.test.mjs, 이 TASK 문서. 총5.
48. **수정 파일:** errors.ts/http.ts/service.ts(기존 변경 보존), docs/V0_2_M2_M3_CONTRACTS.md, V0_2_ROADMAP.md, RELEASE_BACKLOG.md, tasks/README.md. 총7.
49. **Migration:**0. 기존 DB types/RLS/SQL 변경 없음.
50. **Dependency:**0. package/lock 변경 없음.
51. **Actual OpenAI:**0. injected provider와 SDK mock transport만 사용.
52. **External API:** 도매/기타 실제 외부 API0. 새 service fixture는 loopback-only fetch guard 적용.
53. **Remote mutation:** DB/Storage0. synthetic source/Derived와 in-memory mock server는 종료 시 폐기. 사용자 데이터 cleanup 불필요.
54. **Tests:** 기존979 + 신규55. T1~T8 fixture 직접 재사용, 복사본 없음. HTTP 실제 POST 함수 no-op/error 검사, 소속/보안 경계도 포함.
55. **Total count:** `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs` **1,034 PASS / fail0 / skip0 / todo0**, 최종60.5초. 중간1,032개 및 targeted54개 결과와 구분한다.
56. **Typegen:** `npx.cmd next typegen` PASS, 신규 retry route 타입 생성.
57. **Typecheck:** `npx.cmd tsc --noEmit` PASS. 빌드 내부 TypeScript 검사도 PASS.
58. **Lint:** `npm.cmd run lint` PASS.
59. **Build:** `npm.cmd run build` PASS, Next16.3.4 Turbopack 결과에 retry route 포함. 중간 기존 cache의 .sst 삭제 권한 오류는 cache directory를 보존·분리 후 재빌드하여 통과했다. 앱 config 변경/다른 process 종료 없음.
60. **Diff check:** `git diff --check` PASS. 신규 파일 whitespace0, 문서 broken links0, 허용 범위 밖 변경0.
61. **Secret scan:** tracked/new392파일 및 build699파일에서 환경 key3종 in-memory 일치0. 신규 파일 secret 패턴0, fixture build marker0/production fixture import0. 실제 키는 출력/보고/fixture에 쓰지 않음. 모든 형태의 secret 부재에 대한 포괄 보장은 아님.
62. **Package:**0.1.1 유지.
63. **M2:** checkpoint persistence + failed-only server 완료, UI/실제 사용자 E2E pending. 미해결 유지.
64. **M3:** 수정 없음. 기존 corpus/helper/gap 유지. 미해결 MEDIUM4/LOW1 유지.
65. **다음:** TASK-040 명시 retry/review UI, 예상 대상·비용 불확실성, no-op/stale/conflict 안내, stable-ID 선택 유지, 최소 실제 provider E2E. 이번 요청의 실제 API 사용 승인으로 간주하지 않음.
66. **Diff summary:**12파일(신규5/수정7). commit/merge/tag 없음. 원래 partial implementation을 초기화하거나 처음부터 재작성하지 않았음.

## 운영 한계

- 검증 로그/값 없는 audit는 저장소 밖 scratch의 task039-tests.log/task039-build.log/task039-audit.json에 보관한다. 보존한 기존 빌드 cache는 gitignored `.next/cache/turbopack/v16.3.4-299180d3-task039-preserved`이다. source/사용자 데이터 정리나 git reset/restore/clean은 하지 않았다.

- cache 상한16tiles×8regions/UTF-8 JSON256KiB 유지. oversized 결과는 DB 쓰기 전에 거부한다. 이전 성공 checkpoints는 유지하지만 해당 provider 결과를 저장하지 못했을 수 있으므로 무조건 무료로 다시 시도할 수 있다고 안내하지 않는다.
- source freshness를 위해 최대K+2회 private 원본을 다시 받을 수 있다(시작/각 dispatch 직전/publish 전). 각 다운로드는 기존10MiB/20초 경계다. local/internal MVP의 유료 호출 정확성을 우선한 선택이며 원격 latency/billing을 실측하지 않았다.
- process가 dispatch와 terminal persistence 사이에서 종료되면 provider 처리/과금을 확정할 수 없다. 기존 failure는 unknown으로 남고 lease 만료 뒤 명시 retry만 가능하다. 단순 request cancellation으로 원격 처리가 취소됐다고 보장하지 않는다.
- current context/bytes 확인과 서로 다른 DB row의 변화는 단일 transaction이 아니다. 매 dispatch/publish 전 다시 검사하고, 그 사이의 극소 경합을 완전히 잠그는 distributed transaction은 범위 밖이다.
- 서버 구현은 공개 SaaS의 인증/사용자 격리를 제공하지 않는다. 기존 Local/Internal ownership/origin/Storage 제한을 유지한다.
