# TASK-040 — Extraction Failed-Tile Retry UI & Selection Preservation

2026-09-21. Implementation and controlled E2E complete; repository documentation application and final in-repository build confirmation pending due workspace permissions. No commit/main merge/tag.

## 요청한 67개 항목 보고

1. **목적**: TASK-039 실패 구간 전용 실행을 기존 후보 검토 UI에 연결하고 선택 보존·오류 복구·실제 최소 호출 E2E를 검증.
2. **Branch**: feat/extraction-retry-ui, 기준8b65c5c. 시작 working tree clean.
3. **M2 시작**: persistence/server 완료, UI/E2E pending, MEDIUM4/LOW1.
4. **위치**: Images → 제품컷 추출 후보 보기 → 기존 패널 안의 작은 RetryStatus.
5. **Complete**: retry 카드와 warning 숨김. 기존 전체 재분석은 명시적으로 가능.
6. **Partial**: 전체/성공/실패/retryable 수, 성공 후보 저장 가능 안내.
7. **Failed**: 성공 구간 없음 표시. retryable failure만 명시적으로 재시도.
8. **Stale**: source/context/model/policy/layout 서버 재검사. source bytes 변경은 decode 전에 판정. 전체 재분석 CTA 제공.
9. **Missing/invalid**: legacy 부재/손상/미완료 cache 설명 + 실제 full reanalysis 버튼. read 중 AI/DB write 없음.
10. **Conflict**: 최신 목록/read model 갱신. 성공 시에만 갱신 완료 안내. 실패 시 후보/선택 보존, 작업 잠금, 상태 새로고침. retry 자동 재전송0.
11. **버튼**: ‘실패한 N개 영역 다시 분석’.
12. **Loading**: ‘실패 구간 분석 중…’, 관련 작업 disabled, aria-busy/live status. 가짜 퍼센트 없음.
13. **Success**: 서버의 attempted/succeeded/failed/remainingFailed 개수를 그대로 안내.
14. **Mixed**: 성공과 재실패 분리. 남은 실패는 partial 카드에 표시. 전부 재실패해도 기존 성공 보호.
15. **중복 클릭**: ref guard + 기존 AssetManager lock + disabled + 서버CAS. browser mock double-click POST1회 확인.
16. **API**: 기존 POST .../extract-product-shots/retry에 expectedRevision만 전송. 기본 대상은 서버의 모든 retryable failure. 동일 base의 GET은 read-only review DTO. duplicate retry endpoint 없음.
17. **노출**: 새 DTO에 raw checkpoint/regions/Tile geometry/Tile ID/index/failure 객체/fingerprint/model 없음. 정규화 후 candidate rect와 dimensions는 기존 SVG 미리보기에 필요하여 유지. Asset HTTP/Images SSR의 detailExtraction은 display flags로 대체. 기존 Derived provenance 계약은 변경하지 않음.
18. **Selection 구조**: 패널 소유 Record<candidateId,boolean>. full selected-map 정책. touched-only가 아니므로 기존 ID의 새 default보다 현재 true/false를 우선.
19. **Stable ID**: 서버의 기존 candidate ID 그대로. ID/NMS/normalization 변경0.
20. **Unchecked**: false를 새 default true로 덮어쓰지 않음.
21. **Checked**: true를 새 default false로 덮어쓰지 않음.
22. **New**: 새 ID에만 defaultSelected 적용.
23. **Removed**: map에서 제거; save 시 최신 후보 membership도 필터링. 기존 Derived 삭제0.
24. **Ordering**: index에 의존하지 않음. analyzedAt key remount 제거.
25. **Save**: latest/saveAllowed/selected/미저장 ID만 기존 save API에 전달. 동일 rect 슬롯 합산. 성공 저장 ID만 해제.
26. **Dedup**: 기존 서버 source/candidate/rect 방어 유지. 서버 계산 savedCandidateIds로 UI 저장됨 표시.
27. **Selection tests**: true/false 보존, 새 true/false, 제거, 재정렬, 반복 갱신, blocked/saved/current-ID 필터.
28. **UI tests**: 실제 TSX SSR complete/partial1/partial2/failed/stale/missing/invalid/incomplete/pending. browser mock으로 A/B/C, 순서 변경, defaults, mixed, conflict refresh 성공/실패, no-op, double-click, full CTA 확인.
29. **실제 전략**: 실제 이미지의 연속 구간으로 2-Tile QA source 준비. 초기 index0만 실제 호출, index1은 기존 provider DI에서 호출 전 생략. 브라우저 → 기존 retry route → 실제 OpenAI로 index1 한 번 복구. production QA backdoor 없음.
30. **상품**: 67695797 여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼. 기존 TASK-030 로컬 source/Facts/identity 사용. 도매 신규 호출0.
31. **Dimensions**: 전체 기존 source800×23982, QA segment x0/y3500/w800/h3600. 전체 원본 재분석이 아님. 생성 픽셀/제품 변경 없음.
32. **Tiles**: 실제 layout 2개.
33. **Before success**: 1(index0), 실제 첫 응답의 검증된 pre-NMS regions.
34. **Before failed**: 1(index1), retryable1. 실제 provider 장애가 아니라 QA의 호출 생략. cache unknown은 보수적 과금 표시이며 초기 index1 외부 호출0.
35. **Actual retry calls**: 1. 준비1+retry1=총2. 자동 재시도0. 첫 결과 그대로 평가.
36. **Retried**: index1, ID143fcbbda5e5b1db423ac90578bc063f7403d2600c3874c6fd85cb23f6d520c2. 전송 JPEG hash로 해당 Tile 확인. 성공 index0 재호출0.
37. **After success**: 2. 기존 index0 checkpoint deep equality PASS.
38. **After failed**: 0.
39. **Status**: partial → complete, 카드/버튼 제거 확인.
40. **Candidates**: 5→10, 기존5 유지, 전체 completed regions 재집계.
41. **실제 선택**: A true, B explicit false 유지. 첫 응답 default-false3개는 모두 saveAllowed=false여서 수동 C 양성 사례 미확보. C default-false→explicit true는 별도 합성 browser fixture/helper에서 순서 변경 후 보존 확인. 실제 결과 조작/추가 AI 실행 없음.
42. **새 기본값**: 실제 신규 디테일2개 true, 텍스트/잘린 옵션3개 false 확인.
43. **Derived**: UI로3개 저장, 모두 unclassified. 465×1073 /393×368 /393×365. 동일 ID3개를 실제 save route로 재요청: HTTP200/existing3/failed0/개수3→3. 보조 dedup 명령의 초기 잘못된 body는 mutation 전 거부됐고 정상 route/body로 재검증.
44. **Usage**: 준비 input2814/output1644/total4458. retry input2604/output1501/total4105. 총8563 tokens. 금액/최종 청구 확정은 추정하지 않음.
45. **보호**: 전용 메모리 DB/Storage. Project/Product/Facts snapshot, source, 성공 checkpoint 보존. 원격 DB/Storage mutation0.
46. **정리**: 세션 환경 재설정으로 QA 프로세스와 메모리 DB/objects가 종료됨. 3040/3041/3042/4340/4341 listener0, QA browser tabs0 확인, viewport reset. 저장소 밖 metrics/UI/dedup evidence는 유지. 기존 사용자 dev server를 중단하는 명령 실행0.
47. **생성**: review-model.ts, review.ts, public-response.ts, components/retry-status.tsx, tests/detail-extraction-review.test.mjs. TASK-040.md는 이 문서 패치에 포함.
48. **수정**: 아래 inventory. retry/provider/prompt/정규화/CAS/SQL 변경0.
49. **Migration**:0.
50. **Dependency**:0.
51. **Tests**: 기존1034 유지+신규20. 옛 reset/full-only UI characterization2개는 새 계약으로 검증 갱신. M3/security/service 회귀 유지.
52. **전체**:1054 PASS, failed0/skipped0. 최종 DTO 변경 후 원본 저장소에서 재실행 확인.
53. **Typegen**: 원본과 마지막 동일 source 격리 복사본에서 PASS.
54. **Typecheck**: 원본과 마지막 동일 source 격리 복사본에서 PASS.
55. **Lint**: PASS, warning0. 최종 동일 source 복사본에서 재확인.
56. **Build**: 원본 Turbopack build PASS 후 DTO 최소화 최종 변경. 마지막 복사본의 기본 build는 node_modules junction이 Turbopack root 밖이라 환경 오류. webpack 대체 빌드 결과와 원본 최종 재실행 대기는 아래 최종 검사 기록 참조.
57. **Diff**: git diff --check와 문서 patch apply --check 결과는 최종 검사 기록 참조.
58. **Secret**: 실제 .env.local 키 exact-match 및 패턴/클라이언트 bundle 검사. 키값/원본 네트워크 오류/원본 API 응답은 출력하지 않음. 최종 검사 기록 참조.
59. **Package**:0.1.1/lock 유지.
60. **BLOCKER**: 앱 신규0. 완료 처리에는 저장소 쓰기 권한 복구 필요.
61. **HIGH**:신규0.
62. **MEDIUM**: 기능 증거상 M2 종료 gate 충족. 문서 적용/원본 최종 build 확인 전 backlog count 변경 보류(현재4).
63. **LOW**:기존L1,1 유지.
64. **M2**: implementation/controlled E2E PASS, finalization pending. 원본 최종 검사 후 RESOLVED 및 MEDIUM4→3 가능.
65. **M3**: unchanged/open. corpus/production 카피 정책 불변.
66. **다음**: TASK-040 문서 패치 적용 및 원본 최종 build → TASK-041 M3 Copy Role Separation & Review(C1~C22/4개 gap 기준).
67. **Diff scope**: 현재앱/테스트15파일(신규5/수정10), 문서패치5파일 추가 시 총20(신규6/수정14). commit/main merge/tag0.

## 수정 inventory

- src/features/detail-extraction/client.ts, http.ts, components/extraction-panel.tsx
- src/features/assets/http.ts, components/asset-manager.tsx
- src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/route.ts
- src/app/api/projects/[projectId]/assets/[assetId]/analyze/route.ts
- src/app/projects/[projectId]/images/page.tsx
- tests/detail-extraction-retry.test.mjs, tests/internal-polish.test.mjs
- 문서패치: docs/tasks/TASK-040.md, docs/tasks/README.md, docs/V0_2_M2_M3_CONTRACTS.md, docs/V0_2_ROADMAP.md, docs/RELEASE_BACKLOG.md

## 검증 한계와 재현

자동 검사: node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs. 실제 API 호출 없음. 신규 read-model test는 loopback fetch만 허용한다. browser mock/실제 호출 relay는 저장소 밖 QA harness로만 구성했다. 이미 실행 중인 사용자 dev server를 피하기 위해 별도 scratch 앱 복사본을 사용했다.

실제 QA는 source 연속 구간2-Tile 결과다. 전체14/16-Tile 재분석이나 실제 provider 장애/과금 확정의 재현을 주장하지 않는다. 16-Tile/다중 실패/중단/CAS는 기존 mock 회귀로 검증한다. 375px screenshot/DOM innerWidth375, scrollWidth360(세로 scrollbar 제외), horizontal overflow0. UI는 Images 관리 화면 전용이며 Renderer/Editor/Export에 포함하지 않는다.

현재 도구의 쓰기 범위는 임시 workspace뿐이다. C:/Projects/detailforge 문서 작성이 자동 승인 검사에서 거부되어 이5파일 patch를 허용된 workspace에 보관했다. 기존 구현을 초기화하거나 다른 수단으로 제한을 우회하지 않았다. patch 적용과 원본 build를 확인한 뒤 위 pending 상태를 최종 완료로 갱신해야 한다.

## 최종 검사 기록

- 원본 저장소 최종 source: 전체1054/1054 tests PASS, skipped0.
- 최종 source와 byte-for-byte 동일한 격리 복사본: next typegen / tsc --noEmit / lint PASS.
- 격리 기본 Turbopack build: 외부 node_modules junction이 bundler root 밖이라 환경 오류. 앱 컴파일 오류로 판정하지 않는다.
- 같은 격리 복사본 npm run build -- --webpack: PASS, 모든 route 생성.
- 원본 git diff --check PASS. 마지막 DTO 최소화 이후 원본 npm run build 재확인은 권한 복구 후 필요.
- Secret scan: 저장소397파일/문서5/QA JSON3/bundle920, 실제 OpenAI·Supabase·Domeggook 키 검출0, 새 변경의 키 패턴0, client provider marker0.
- source 복사 동일성 true, 보호 scope true, package0.1.1.
- QA listener0/tabs0, 메모리 DB/Storage 프로세스 종료. viewport reset 완료.
- 문서5파일의 unified patch는 원본에서 git apply --check로 적용 가능 여부를 검사한다. 아직 실제 적용하지 않았다.
