# TASK-050 — Manual Crop Review UX & Data Contract

2026-09-23. **설계 완료 / production 구현 전**. branch `plan/manual-crop-review-ux`, 기준 HEAD `078ebf6`. 시작 working tree clean. [상세 계약](../V0_2_1_MANUAL_CROP_DESIGN.md). 사용자 요청에 따라 문서만 변경하고 commit/stage/main merge/tag를 하지 않는다.

## 요청한 69개 완료 보고 항목

1. **TASK 목적:** 자동 preserve를 유지하면서 사용자가 저장 전 명시적으로 crop을 승인하는 UX·API·데이터 계약 확정. 구현0.
2. **branch:** `plan/manual-crop-review-ux`, HEAD `078ebf6`. 요청 branch 일치.
3. **M4 root conclusion:** A01 ambiguous, B01 panel_background, B02 content_touching_edge. 실제 safe auto extension 근거0이므로 threshold 완화 대신 사용자 검토.
4. **Manual Crop 진입 위치:** Assets Candidate Review 카드 `[자르기 조정]`, Derived 저장 전. saveAllowed인 기존 저장 후보도 새 변형 진입 가능.
5. **existing Derived editing 결정:** 범위 밖. 기존 Asset/Storage/Page 연결 수정0. 원본 Candidate에서 다른 F를 새로 저장하는 것과 구분.
6. **crop scope:** Candidate 내부 L/T/R/B inward inset만. 회전/resize/perspective/fill/AI/background removal 없음.
7. **outward expansion 결정:** 제외. 인접 panel·제품·문자 혼입과 identity 변경을 피하고 복구/확장은 future backlog.
8. **automatic 3% cap과 manual 관계:** auto cap 그대로. manual은3% 초과 가능, 내부 bounds·width/height≥160·area≥64000 필수.
9. **adjustment representation:** canonical Candidate 상대 4개 정수 inset 선택. 임의 absolute source rect 입력 금지.
10. **coordinate source of truth:** EXIF 정규화 source pixel 공간. raw source bytes hash 별도, display/CSS 좌표 저장0.
11. **display/source mapping:** SVG inverse screen CTM, source inset 한 번 정수화, resize/zoom/DPR로 draft 재계산 안 함. EXIF1~8/letterbox future QA.
12. **interaction 방식:** 4 edge drag primary + numeric4 keyboard 대안. corner 동시2축 복잡도 제외, 새 library 없음.
13. **crop editor UI:** 단일 Candidate preview/경계선/제외 dim/4입력/결과 크기/초기화·취소·적용. side-by-side 필수 아님.
14. **Apply semantics:** local applied override만 갱신. server write0, 실제 저장은 기존 선택한 제품컷 저장. 명시0px도 manual.
15. **Cancel semantics:** 현재 working copy만 폐기, 이전 applied draft/selection 유지, focus 복귀.
16. **Reset semantics:** working mode를 automatic/B로 복귀. Apply해야 기존 override 제거, Reset 후 Cancel이면 이전 draft 보존. 서버 write0.
17. **client state:** selected map과 별도 candidateId→manualDraft map, working editor copy. scope/source/base/orientation의 opaque basisKey, session memory만.
18. **retry integration:** 같은 ID/base/basis draft 유지, 사라지면 삭제, 새 후보 override 없음, 불일치 stale. GET 실패 시 유지·mutation 잠금.
19. **selection integration:** TASK-040 true/explicit false 유지. 새 후보만 defaultSelected. 성공한 제출 항목만 선택 해제, 실패 유지.
20. **candidate ordering:** index/카드 번호/URL key 금지. ID 기반으로 순서 변경과 무관하게 보존.
21. **save request proposal:** strict `{schemaVersion:2,expectedRevision,items:[{candidateId,manualInsets?}]}`, unique1~24. 기존 IDs-only는 automatic 전용으로 유지.
22. **server source of truth:** 최신 canonical Candidate·서버 source bytes/path/hash/normalized dimensions. client는 ID+bounded adjustment만 전달.
23. **server validation:** scope/소속/long-source/재귀금지/ID/최신후보/saveAllowed/정수·finite·bounds·최소크기/source hash 및 orientation 검증.
24. **stale handling:** stale/source_changed/conflict 거부, draft 보존 후 fresh GET. 같은 basis만 유지, 자동 재저장 없이 재확인 안내.
25. **CAS/revision:** 현재 save에는 expectedRevision 없음 확인. V2에 추가하고 기존 namespace CAS/saveLease/operation cursor 재사용. 새 DB version0.
26. **auto-trim/manual override:** 없음=현재 auto, 있음=추가 auto trim0. explicit0px와 override 없음 구분.
27. **WYSIWYG invariant:** manual preview F=저장 source F=Asset dimensions. PNG pixel identity/JPEG·WebP geometry·기존 encode를 구분.
28. **provenance proposal:** 새 manual schemaVersion2, sourceRect=base 유지, adjustment.mode/manual insets 추가, trim 금지. F 파생, 기존 timestamp, v1 reader 호환.
29. **duplicate Derived semantics:** 현재 base key임을 확인. 새 parent/hash/final F key로 동일 pixels 재사용·role 무관, 다른 F 새 변형. legacy automatic 기본 재요청은 승인된 기존 결과 유지.
30. **asset limit:** Product 전체30 유지. 서버는 새 고유 F만 슬롯 계산·batch preflight. UI auto는 상한 추정임을 표시, manual은 F로 계산.
31. **selection behavior after crop:** Apply가 자동 선택하지 않음. 해제 시 선택 안내. saved base라도 다른 manual F면 선택 가능.
32. **discoverability:** 상단 일반 도움말+saveAllowed 카드의 항상 제공되는 조정 버튼. 기본 제외/이미 저장 후보에도 제공.
33. **automatic frame warning decision:** per-candidate frame 확정 경고 없음. 근거 부족한 분류를 UI 사실처럼 표시하지 않음.
34. **auto-trim badge decision:** pre-save 필수 아님, 현 preview는 trim 전. 실제 저장 trim metadata가 있을 때만 optional badge.
35. **accessibility:** numeric keyboard 경로, labels/오류 설명, focus trap/복귀/Escape, 실제 buttons/44px targets/이중 경계 대비. drag-only 금지.
36. **responsive admin UI:** 375px preview scale/세로 scroll/입력·버튼 접근, 가로 overflow 없이 source F 유지. 실제 Browser 검증은052/053.
37. **Final surface isolation:** Candidate/Assets 관리에만 controls. Final860px/PNG/JPG에 내부 경고·조작부 없음.
38. **security:** strict unknown-key reject/same-origin/JSON8192bytes/no-store. arbitrary URL/path/hash/rect/negative/fraction/nonfinite 금지.
39. **error contract:** 기존 invalid_input/invalid_rect/stale/source_changed/conflict/asset_limit/upload/database/recovery 사용, crop_too_small400 제안. retry AI 비용 persistence_failure 재사용 금지.
40. **save failure behavior:** selection/applied draft 유지, 기존 성공 Derived 삭제0. 불명확한 ack는 read-only 재조회 후 명시 재시도.
41. **partial multi-save:** 기존 후보별 saved/failed/available 유지, 성공만 선택 해제. global invalid/limit은 업로드 전 거부, 중간 conflict는 남은 저장 중단.
42. **M1 relationship:** 자동 guard·3%·동일 input invariant·A/H preserve·A2 safe trim 그대로. manual 승인으로 auto safety를 약화하지 않음.
43. **revised M4 RESOLVED definition:** 보수 auto+ambiguous preserve+실제 manual review/save+WYSIWYG+provenance+기존 데이터 불변을 실제 QA로 확인해야 종료.
44. **A01 flow:** 회색/녹색 edge를 사용자 직접 검토·inset·preview·Apply·선택·Save. 실제 측정치를 자동 추천값으로 넣지 않음.
45. **B01 flow:** auto preserve, 사용자가 필요 시 bottom26(자동 cap17 초과) 명시 승인. 최소크기와 포함 제품 확인 후 저장.
46. **B02 flow:** auto preserve, card와 제품 texture의 동반 제거를 preview에서 판단. 안전하다고 주장하지 않고 Cancel/Reset도 정상 결과.
47. **dependency decision:** 신규 crop library 없음. 후속 React pointer/SVG overlay/numeric 입력, 기존 decode/encode 사용.
48. **performance:** drag/draft마다 request0, source decode 재사용, client geometry. 실제 crop/upload는 명시 save의 고유 F당 한 번.
49. **temp Storage:** preview용 임시 crop 파일/Storage0. 기존 signed source preview 사용.
50. **signed URL handling:** 기존 TTL300초/갱신 흐름, pixel draft는 basis에 귀속. 만료 중 보존·Apply/save 잠금, 동일 source 새 preview 로드 후 재개.
51. **implementation TASK decomposition:** 051 domain/API/save/readers → 052 UI/selection/retry → 053 실제 Browser/save QA → gate 충족 시054 release validation.
52. **생성 파일:** `docs/V0_2_1_MANUAL_CROP_DESIGN.md`, `docs/tasks/TASK-050.md`.
53. **수정 파일:** `docs/V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md`, `docs/RELEASE_BACKLOG.md`, `docs/tasks/README.md`.
54. **production code 변경:** 0. src/기존 tests/fixtures/AI/prompt/Renderer/Storage 변경0. Browser 실제 manual 기능은 아직 없음.
55. **migration:** 0. 후속 provenance도 기존 JSONB 내 versioned 읽기/쓰기 제안, legacy rewrite 없음.
56. **dependency:** 0. package/lock 불변.
57. **tests:** 추가0. 요청된 전체 baseline 실행. 이번 PASS는 신규 manual 기능 구현 검증을 뜻하지 않음.
58. **total tests:** 1291/1291 PASS, fail/skipped/cancelled0.
59. **typegen:** `npx.cmd next typegen` PASS.
60. **typecheck:** `npx.cmd tsc --noEmit` PASS.
61. **lint:** `npm.cmd run lint` PASS.
62. **build:** `npm.cmd run build` PASS.
63. **diff check:** PASS. tracked diff와 신규 문서의 trailing whitespace/conflict marker/마지막 newline 및 신규 문서 링크 검사 통과.
64. **secret scan:** PASS. tracked/untracked 파일·TASK-050 로그/helper·build client bundle에서 설정된 비밀값3개와 토큰/서명 URL 패턴 검사, findings0. 비밀값 출력0.
65. **package version:** package/lock `0.2.0` 유지.
66. **M1 상태:** RESOLVED 유지(자동 추가 trim 안전성 범위).
67. **M4 상태:** NEEDS_WORK — 설계 확정, 구현/실제 QA 전. BLOCKER0/HIGH0/MEDIUM1/LOW0.
68. **다음 권장 TASK:** TASK-051 Manual Crop domain/API/save provenance 및 관련 reader 호환 구현.
69. **git diff summary:** 문서5개(신규2/수정3), 합계339 insertions/1 deletion. tracked3개 +25/-1, 신규 설계233행·보고81행. stage/commit/merge/tag0.

## 검증 증거와 한계

로컬 ignored `artifacts/TASK-050/`의 tests/typegen/typecheck/lint/build 로그에 기록했다. source production·tests·package·migration 파일은 수정하지 않았다. 새 manual API/드래그/Browser/실제 저장은 이번 설계 TASK에서 실행하지 않았다. AI/Domeggook/원격 DB·Storage 호출0. 사용자 기존 작업 초기화나 git reset/restore/clean 미사용.

최종 audit PASS: tracked/untracked 문서5개 범위, branch/HEAD/stage, version, diff/신규파일 공백·링크/69항목, 비밀값/토큰 패턴 및 build client bundle 검사 통과. TASK-048 보호 파일4개의 hash와 TASK-049 patch3개 hash 불변 확인. 결과는 ignored `artifacts/TASK-050/audit.json`에 기록했다.
