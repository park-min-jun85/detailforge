# TASK-038 — Tile Checkpoint/Cache Domain Model & Persistence

2026-09-21. 상태: **완료**. 전체979 tests 및 필수 검사 PASS. 실제 원격 API/DB 검증과 구분한다.

1. **목적:** 정상 전체 extraction의 tile terminal 결과를 bounded metadata에 남겨 후속 명시 retry의 기반을 만든다. failed-only 실행/UI는 이번 범위에 없다.
2. **Branch:** `feat/tile-checkpoint-cache`, 시작 HEAD `cfa7352`. 시작 시 clean. commit/main merge/tag 하지 않음.
3. **Root M2 limitation:** 기존 latestResult는 NMS/cap 이후 최대24 후보뿐이라 성공 tile의 pre-NMS 결과를 복원할 수 없었다. 이번에 저장 기반을 추가했지만 `force=true`는 여전히 전체 분석이다.
4. **Domain:** [checkpoint.ts](../../src/features/detail-extraction/checkpoint.ts)는 DB 호출 없는 server-only schema/identity/serialization/transition/read model. [persistence.ts](../../src/features/detail-extraction/persistence.ts)는 scoped read/CAS/owned-run write를 담당한다.
5. **Schema version:** outer detailExtraction v2, checkpoint v1, tileOutput v2. outer v1/결과 v1·v2/Derived v1 읽기는 유지한다. 공유 schema의 checkpoint는 opaque unknown으로 읽고 별도 server validator로 검사한다.
6. **Tile identity:** SHA-256 JSON tuple `["detailforge.tile",1,sourceFingerprint,productContextFingerprint,index,x,y,width,height]`. TASK-037 golden hash 유지. AI 결과/점수/실패 이유 제외.
7. **Geometry canonicalization:** 순서 고정 숫자 tuple, 정수 픽셀 index/x/y/width/height. source 범위·full-width·layout 순서/coverage·중복·tile ID와 geometry 일치를 검사한다. object key order 무관.
8. **Success payload:** `completed` + Zod tileOutput v2의 bounded regions, 0–1000 box, relevance/visualKind/confidence 포함. geometry 유효성 검사 후 저장, global NMS/cap 이전. 원본 provider envelope, 이미지/prompt/context text 저장 없음.
9. **Failure payload:** `failed` + enum kind/code, retryable boolean, billing=`not_dispatched|unknown`. known local deterministic 오류는 retryable=false.
10. **Failure sanitization:** raw message/stack/url을 자르지 않고 아예 제외한다. 익명 provider 예외는 provider_error로 요약한다. 성공 region의 URL/credential/절대경로 패턴도 cache 저장을 거부한다. 입력 schema는 strict하며 알려지지 않은 필드는 거부한다.
11. **Max tiles:** 기존 MAX_TILE_COUNT=16을 공통 사용한다.
12. **Max regions/tile:** 기존8을 MAX_REGIONS_PER_TILE 상수로 공유한다. 두 limit system을 만들지 않았다.
13. **Max bytes:** checkpoint JSON 전체 256KiB=262,144B. 다른 metadata namespace까지 포함한 DB row 전체 상한은 아니다.
14. **UTF-8:** `Buffer.byteLength(JSON.stringify(value), "utf8")`를 write/read 경계에서 확인한다. 16×8 한글 최대 fixture156,616B, escaped control271,816B. 후자는 reject. NUL/고립 surrogate는 JSONB 불가로 reject. 합성 최대 schema serialize/parse smoke는 5초 미만 gate 통과; 정밀/원격 DB benchmark 아님.
15. **Run status:** 전체 layout 중 terminal 미기록이 있으면 incomplete. 전부 기록되면 전부 성공 complete / 혼합 partial / 전부 실패 failed. 별도 중복 status 저장 없음. persisted pending/in_flight 없음.
16. **Source compatibility:** 다운로드 원본 bytes SHA-256 + dimensions/orientation/coordinate space 비교. 같은 Storage path만으로 재사용하지 않는다.
17. **Context compatibility:** 기존 TASK-031 bounded Product identity context fingerprint 사용. 전체 Facts/context text를 복제하지 않는다.
18. **Model compatibility:** 기존 env override/default resolution을 getExtractionModel로 공유하고 input에 실제 model string을 기록한다. `force=false` 전체 결과 재사용도 model이 바뀌면 거부한다. API key는 identity에 없다.
19. **Policy compatibility:** tile schemaVersion/promptVersion/policyVersion/normalizationVersion 및 실제 두 prompt의 hash. 앱 package version과 독립. 해석 정책 변경 시 해당 version을 올려야 한다.
20. **Layout compatibility:** 실제 geometry sequence fingerprint + height2048/overlap256/snap128/max16 policy hash + tilingVersion. 저장 layout 자체 검증은 현재 runtime 상수 hash와 분리하여 정책 변경을 stale로 판단할 수 있다.
21. **Stale:** input fingerprint 하나라도 다르면 incompatible/stale; 읽기만으로 cache 삭제/변경/AI 호출 없음. current input이 없으면 unknown, 재시도 ID 없음.
22. **Legacy:** checkpoint 없는 outer v1/결과v1·v2는 계속 표시/검토/Derived 저장 가능. legacy 조회는 migration 없음. 입력 정책 fingerprint가 없던 legacy 결과의 기존 재사용 규칙은 유지하며 model 비교만 추가한다.
23. **Malformed:** checkpoint만 잘못되면 availability=invalid, latestResult는 계속 사용. 조회/Derived save가 subtree를 지우거나 복구하지 않는다. malformed subtree는 unchanged write에서 그대로 보존한다.
24. **Persistence location:** `assets.metadata.detailExtraction.checkpoint`. 상태와 동일 root의 checkpointWriteError/latestResultInputFingerprint로 오류와 결과 입력을 분리한다. 새 root/table/column 없음.
25. **Merge:** asset scope를 확인하고 최신 row read → owned subtree merge → 기존 metadataUpdate revision CAS. aiAnalysis/source/derivation/기타 namespace 유지. saveLease/revision 동작 유지.
26. **Timing:** terminal 결과가 확정될 때마다 다음 tile 호출 전에 persist. claim 시 empty layout checkpoint, 마지막에 latestResult/attempt finish. 중간 프로세스 종료에도 이미 commit된 tile은 남는다.
27. **Write amplification:** 기본 N+2 logical updates, 최대18. 각 업데이트는 전체 metadata를 전송하므로 cache 부분만 단순 최대18×256KiB=4.5MiB의 보수적 상한이며 읽기/기존 metadata/CAS 재시도는 별도다. CAS 최대3회, provider 재호출 없음. Local/internal ≤16 타일에서 비용보다 durable 성공 보존을 우선했다. 원격 latency/JSONB 실측은 하지 않았다.
28. **Race:** 기존 process single-run/product exclusive 유지. 쓰기 시 project/product/asset/path·attempt.runId·checkpoint.runId·inputFingerprint 및 analyzing 상태를 확인한다. revision conflict는 reread/merge, 늦은 이전 run은 reject. 분산 lock 없음. 원본/context를 매 tile마다 재다운로드/재해시하지 않으므로 실행 중 외부 수정은 다음 fresh input 비교에서 stale이 된다. TASK-039는 실행 직전 최신 input을 재확인해야 한다.
29. **Read model:** hasCheckpoint, availability, compatibility, runStatus, successfulTileCount, failedTileCount, pendingTileCount, persistenceError, retryableTileIds. UI 연결/버튼/route/action 없음.
30. **Retry IDs:** 같은 run이 소유한 valid+compatible cache의 retryable terminal failure만, live analyzing 또는 cache write error 시 없음. 미기록 타일은 미전송/응답 유실을 구분할 수 없어 대상에 넣지 않는다. TASK-039에서 중단 정리와 불확실 과금 안내 필요.
31. **T1–T8:** TASK-037 fixture 직접 import. complete/partial/정확한 비연속 실패/all-failed/성공 보존/source stale/context stale/failed→completed 순수 전이 PASS. 별도 fixture 복제나 실제 AI retry 없음.
32. **Partial persistence:** loopback mock4타일 success/success/provider-error/success에서 completed3/failed1, 후보 실패 index2, claim+4+finish=6 writes. 다음 provider 호출 전에 이전 tile 저장 확인.
33. **Failure-after-success:** 두 번째 tile 저장 DB 실패 시 첫 성공 checkpoint와 이전 latestResult 유지, 추가 provider 호출 중단. 모두 실패해도4 failure checkpoint 보존, 이전 성공 결과를 빈 성공 결과로 바꾸지 않음. oversize/unsafe는 이전 durable checkpoint 유지+bounded error 기록 후 정상 candidates 완료 가능.
34. **Candidate regression:** 기존 normalizeCandidates의 count/ID/defaultSelected 포함 전체 결과와 checkpoint 재구성 결과 deep-equal. 성공 full extraction service에서도 같은 함수 결과 비교. geometry/NMS/cap/crop ID 알고리즘 변경 없음.
35. **Relevance regression:** visualKind/targetProductRelevance/containsTargetProduct/relevanceReason 보존. 기존 TASK-031 분석/선택 정책 tests 유지. prompt 변경 없음.
36. **Derived regression:** 기존 provenance v1/중복 crop/save 실패 보상 회귀 유지. malformed cache가 있어도 기존 candidates로 Derived save 성공하고 cache는 그대로 남는 mock 검증 추가.
37. **생성 파일:** checkpoint.ts, persistence.ts, [domain tests](../../tests/detail-extraction-checkpoint.test.mjs), [persistence tests](../../tests/detail-extraction-checkpoint-persistence.test.mjs), 이 TASK 문서. 총5개.
38. **수정 파일:** detail-extraction의 policy.ts/provider.ts/schemas.ts/service.ts 및 V0_2_M2_M3_CONTRACTS/V0_2_ROADMAP/RELEASE_BACKLOG/tasks README. 총8개.
39. **Migration:** 0. 기존 SQL/database.types.ts 변경 없음.
40. **Dependency:** 0. package/lock 변경 없음.
41. **OpenAI calls:** 실제0. mock provider만, provider SDK maxRetries0 유지.
42. **External API calls:** 실제 도매/기타 외부 API0. 자동 테스트의 HTTP는 loopback mock.
43. **Remote DB/Storage mutation:** 0. mock source/crop/metadata는 in-memory이며 server close 후 소멸. 기존 사용자 데이터 접근/변경 없음.
44. **Tests:** 기존 전체933 + 신규46 domain/persistence. fixture T1–T8와 M3 C1–C22 그대로. 새 service tests는 fetch loopback guard로 원격 호출을 거부한다.
45. **Total tests:** `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs` **979 PASS / fail0 / skip0 / todo0**, 66.1초. 기존933+신규46. 별도 신규 targeted46도 PASS.
46. **Typegen:** `npx.cmd next typegen` PASS.
47. **Typecheck:** `npx.cmd tsc --noEmit` PASS.
48. **Lint:** `npm.cmd run lint` PASS, 최종 docs/test 추가 후 재확인 완료.
49. **Build:** `npm.cmd run build` PASS. App/API route 추가 없음.
50. **Diff check:** `git diff --check` PASS. 신규 파일 whitespace 검사도0. 문서 relative links 오류0, scope 밖 변경0.
51. **Secret scan:** tracked/new387파일 + build682파일에서 환경 key3종을 in-memory 비교, 실제 값 일치0. production fixture import0/build fixture marker0. 패턴 탐지2파일은 새 테스트의 합성 URL/credential 공격 문자열임을 수동 확인했다. 값은 실제 키가 아니며 실제 환경 키를 출력/저장하지 않았다. 광범위 DLP 보장을 뜻하지 않는다.
52. **Package version:** package.json/package-lock/root package 모두0.1.1 유지.
53. **M2:** checkpoint persistence implemented; failed-only retry UI/server pending. 미해결 유지, 해결 판정 아님.
54. **M3:** 변경 없음. C6/C10/C13/C19 미검출과 MEDIUM4/LOW1 backlog 유지.
55. **다음 TASK:** TASK-039 명시 failed-only 서버 실행: 입력 재검증, live/interrupted run 처리, 성공 tile 호출0, 실패 target 호출≤1, 비용 불확실성, CAS/실패 시 성공 보존. 그다음 TASK-040 UI/선택 보존. 자동 retry 없음.
56. **Git diff summary:** 총13파일(신규5/수정8). checkpoint domain/persistence와 정상 extraction 연결,46 tests,5개 문서만 변경. commit/merge/tag 하지 않음.

실행 로그는 저장소 외 로컬 scratch의 task038-tests.log, task038-targeted.log, task038-build.log에 있다. 유료 호출/실제 PostgreSQL 저장 성능/브라우저 UI/실제 실패 타일 복구를 검증했다고 주장하지 않는다.
