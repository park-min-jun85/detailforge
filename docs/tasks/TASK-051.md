# TASK-051 — Manual Crop Domain, Save API & Provenance

2026-09-23. **서버/domain/save 구현 완료 / UI·실제 Browser QA 대기**. branch `feat/manual-crop-save-domain`, 기준 HEAD `cc51492`, 시작 working tree clean. [최신 실행 계약](../V0_2_1_MANUAL_CROP_DESIGN.md). M1 RESOLVED 유지/M4 NEEDS_WORK, BLOCKER0/HIGH0/MEDIUM1/LOW0. stage/commit/main merge/tag0.

## 요청한 78개 완료 보고 항목

1. **TASK 목적:** canonical Candidate에 대한 bounded manual override를 기존 명시 save 서버 경로에 구현. UI 구현 없음.
2. **branch:** `feat/manual-crop-save-domain`, HEAD `cc51492`. 시작/최종 branch 확인.
3. **existing save architecture:** IDs-only strict request→scope/latest Candidate/hash 검증→base duplicate/슬롯→Product lock/source CAS lease→crop/upload/INSERT/부분 결과 구조를 확인했다. route/서비스를 확장하고 저장 보상 경계를 유지했다.
4. **route decision:** 기존 `extract-product-shots/save` POST를 확장. 새 endpoint0, Node runtime/maxDuration 유지.
5. **V1 compatibility:** `{candidateIds}` 계속 허용, automatic 기본 모드/legacy 승인 결과 재사용. 기존 테스트 변경 없이 통과. HTTP의 민감한 full Asset payload는 요약으로 제한했다.
6. **V2 request:** strict `{schemaVersion:2,expectedRevision:UUID,items:[{candidateId,manualInsets?}]}`. unique ID1~24, legacy/V2 혼합·unknown key reject.
7. **manualInsets schema:** left/top/right/bottom 모두 필수, safe integer0~60000. NaN/Infinity/소수/음수/null/문자 coercion 없음.
8. **zero-inset semantics:** all-zero 객체도 manual 승인. 없음과 구별하며 auto trim을 호출하지 않는다.
9. **final rect calculation:** base `{100,200,400,300}` + L20/T10/R30/B40 = `{120,210,350,250}`. Sharp half-open 영역 의미 유지.
10. **inward-only validation:** nonnegative inset과 positive final width/height, canonical base/source bounds 검증. expansion/역전/0폭·높이 거부, 서버 clamp0.
11. **minimum size:** width≥160,height≥160,area≥64000. 양수지만 미달이면 crop_too_small. 경계값160×400 허용 테스트.
12. **source bounds:** canonical base부터 검증하여 invalid base를 inset으로 감출 수 없음. source dimensions는 서버 decoded 값.
13. **orientation coordinate:** 원본 SHA는 raw bytes, crop은 EXIF 정규화 PNG working buffer. sourceOrientation/dimensions도 latest result와 일치 검사.
14. **auto trim bypass:** planCrop의 manual 분기는 trimCrop 전에 반환. 일반 inset 및0px 호출0을 isolated module instrumentation으로 검증.
15. **WYSIWYG invariant:** 계산된 F를 encodeCrop에서 그대로 extract. 추가 trim/resize0. 서버 영역·dimensions·PNG pixels 일치, Browser preview는052/053 검증 대상.
16. **candidate lookup:** 최신 source metadata의 result에서 ID 조회·ID 재계산·saveAllowed 및 허용 role 검사. client source path/base rect 신뢰0.
17. **stale validation:** unknown/사라진/identity 변경 후보는 stale, 실제 source hash/dimensions/orientation 변경은 source_changed. crop/upload/DB write 전 거부.
18. **revision/CAS:** V2 expectedRevision 정확 비교→기존 metadata CAS로 lease claim→claim revision cursor 사용. 각 항목/encode 후 upload 직전에 path/revision/run/lease/result 재확인. 외부 conflict 시 남은 저장 중단.
19. **lease:** 기존 analysis/save lease6분과 Product process lock 유지. active 차단/expired recovery 테스트. 새 version/lock 시스템 없음.
20. **candidate eligibility:** defaultSelected=false이지만 saveAllowed이면 명시 저장 가능. prohibited role은 saveAllowed가 잘못 true여도 차단.
21. **recursive source protection:** 기존 kind marker 기반 Derived source 금지 유지. malformed derivation marker도 차단.
22. **actual crop execution:** normalized source→확정 F→Sharp extract→PNG lossless/JPEG95 4:4:4/WebP95. 새 image processing 옵션0.
23. **pixel identity:** generalized A01/B01/B02 실제 서비스 upload bytes와 synthetic PNG exact source subset 비교 PASS. resample0.
24. **manual provenance:** schemaVersion2, 기존 sourceRect=base 유지, adjustment:{mode:manual,insets}; parent/hash/candidate/sourceDimensions/role/confidence/extractedAt/provider/model 보존.
25. **auto provenance:** schemaVersion1 및 optional trim.policyVersion2 유지. 과거 trim1·2/없음 모두 읽기, auto metadata를 manual로 덮지 않음.
26. **schema/version decision:** manual derivation만2, 앱0.2.0 유지. finalRect는 base+insets로 파생, 중복 base/final/timestamp/history 없음.
27. **legacy read:** strict union/common projection, visual inventory/review/duplicate geometry reader 지원. v1-v1 Planner nearDuplicate 기준 유지, manual 포함 시 effective geometry 사용. 기존 row migration0.
28. **duplicate key:** 검증된 같은 parent+source hash+effective final rect. ID/role/mode가 달라도 같으면 재사용. 자동 기본 재요청은 기존 승인된 base의 자동 결과를 계획 단계에서 선택한다.
29. **auto/manual duplicate:** 양방향 재사용 테스트 PASS. 기존 Asset/파일/provenance 불변, 새 upload0.
30. **manual variants:** 같은 후보의 서로 다른 F는 다른 Derived. 같은 F 재요청은 기존 ID, 한 batch의 중복 ID는 금지.
31. **asset limit:** 원본·auto·manual 전체30. duplicate0슬롯, 다른 parent/hash/invalid dimensions는 재사용 제외.
32. **slot preflight:** 계획된 새 고유 F 수로 batch 전체 검사. 남은1/신규2는 write0 reject, 같은 F 후보2개는1슬롯.
33. **partial save:** 기존 saved/failed/available 유지. Storage 일시 실패 사이 첫째/셋째 성공 보존. geometry/limit 오류는 batch 시작 전 거부.
34. **storage failure:** bounded upload/recovery, 새 path만 cleanup. 기존 원본/Derived 삭제0.
35. **DB failure:** upload 후 INSERT 실패 시 기존 readback/compensation 유지. 확실히 미저장일 때만 새 object cleanup.
36. **lost acknowledgement:** committed row 재조회 성공 시 saved, 재요청도 같은 F reuse. 미확정이면 파일 유지/recovery; 같은 batch에서 해당 F 재업로드 금지.
37. **body limit:** streaming8192bytes/JSON/same-origin/no-store 그대로. 최대24개 bounded V2 body가 제한 안에 들어감을 검사.
38. **error contract:** crop_too_small400만 추가. 기존 invalid_input/invalid_rect/stale/source_changed/conflict/busy/asset_limit/upload/database/recovery 사용. scope의409는 ownership으로 구분. raw Sharp/DB/path 노출0.
39. **public response:** saved의 candidateId/existing과 asset{id,width,height,mimeType,assetType}, failed code/message, available. save HTTP에 path/raw metadata/provenance/checkpoint/token 없음. GET은 opaque basisKey/orientation/coordinateSpace/savedCrops 최소 projection 추가.
40. **V2 schema tests:** absent/zero/positive, 숫자 위반9종, 필수4변, authority field7종의3수준, mixed version/중복 ID/최대 body 검사 PASS.
41. **rect tests:** 요청 예제 정확값, source bounds/invalid base/합계 역전/최소 폭·높이·면적/inclusive boundary PASS.
42. **zero-inset test:** auto 양성 frame의 all-zero manual이 base dimensions를 유지하고 별도 full-candidate 변형으로 저장됨.
43. **auto-bypass test:** 실제 planCrop import에 대한 isolated trimCrop instrumentation에서 manual2회 호출 시 trim0, automatic1회 시 trim1.
44. **auto regression:** 기존 A2/원래30종/crop/서비스 legacy 테스트 유지. automatic detector 파일 및 threshold 변경0.
45. **WYSIWYG test:** PNG raw pixels exact, JPEG EXIF1~8의 독립 정규화·extract·기존 encode bytes 일치, WebP 기존quality bytes 일치.
46. **A01 test:** TASK-049 RF-A-R layered analogue의 자동 preserve 확인 후 manual16px4변 exact 저장. 실제 상품 Browser QA 아님.
47. **B01 test:** RF-B-R을380×572로 일반화, bottom26>자동 cap17 허용 및 exact output PASS.
48. **B02 test:** RF-C-R을691×547로 일반화, bottom38 exact output. semantic safe/contentRisk/knownContentBounds를 provenance에 저장하지 않음.
49. **duplicate test:** 동일manual/replay, auto→manual/manual→auto, 다른 base/role 동일F, different variants, parent/hash/dimensions 경계 PASS.
50. **stale source test:** bytes/dimensions/orientation 변경 reject, upload/DB write0.
51. **stale candidate test:** 제거/변경/foreign ID/forged bounds/prohibited role reject.
52. **revision conflict test:** stale request409/write0, claim CAS race/upload0, 중간 외부 revision 변경 후 남은 항목 conflict·기존 성공 보존.
53. **lease test:** active analysis/save 차단, expired 회복 PASS. retry도 동일 analysis/source metadata lease 경계를 사용한다.
54. **ownership test:** cross-project/cross-product/foreign product 연결/foreign candidate reject, Storage write0.
55. **asset-limit test:** 남은1/고유2 거부, 동일 final2개/1슬롯, 총30에서 기존 재사용 PASS.
56. **provenance tests:** base/insets/F/hash/parent/ID/version/실제 dimensions 및 strict hybrid/history reject, legacy read/불변/visual reader PASS.
57. **metadata bound:** fixed fields,4개 bounded integer, no free text/history. 대표 manual provenance<1KiB; 입력은 기존 model/rationale metadata를 확장하지 않음.
58. **UI changes:** 0. TSX/CSS/Renderer/pointer/numeric UI/Browser draft·selection 구현 불변. client.ts는 save asset 반환 타입만 수정.
59. **생성 파일:** crop-geometry.ts, manual-crop-domain.test.mjs, manual-crop-save.test.mjs, 이 TASK-051.md. 아래 inventory 참조.
60. **수정 파일:** 기존 save route, detail-extraction의 schema/image/service/error/HTTP/public response/review/client 타입, visual-assets reader, 문서4개. 아래 inventory 참조.
61. **migration:** 0. JSONB legacy data rewrite 없음.
62. **dependency:** 0. package/lock 불변.
63. **OpenAI calls:** 실제0. 새 service fixtures는 저장된 canonical result를 사용하고 provider를 호출하지 않음.
64. **external API calls:** 실제0. HTTP/Storage/DB 테스트는 loopback mock 서버만 사용.
65. **remote mutation:** 0. 기존 실제 원본/Derived 보호 파일 hash도 audit에서 확인.
66. **tests:** 신규98개, 기존1291개 테스트/fixtures 수정0. isolated hook/Sharp/loopback service 및 실제 route handler를 검증.
67. **total test count:** **1389/1389 PASS**, fail/skipped/cancelled0.
68. **typegen:** `npx.cmd next typegen` PASS.
69. **typecheck:** `npx.cmd tsc --noEmit` PASS.
70. **lint:** `npm.cmd run lint` PASS, warnings0/errors0.
71. **build:** `npm.cmd run build` PASS, Next16.3.4 production build.
72. **diff check:** PASS. tracked diff와 신규파일 whitespace/conflict marker/마지막 newline·문서 링크/78항목 검사 통과.
73. **secret scan:** PASS. tracked/untracked·로컬 로그/helper·build client bundle에서 설정된 비밀값3개 및 토큰/서명 URL 패턴 검사, findings0. 실제 값 출력0.
74. **package version:** package/lock0.2.0 유지.
75. **M1 상태:** RESOLVED 유지, 자동 추가 trim 안전성 gate.
76. **M4 상태:** NEEDS_WORK, MEDIUM1/LOW0. UI/actual manual review QA 전이므로 해결 처리 안 함.
77. **다음 권장 TASK:** TASK-052 Crop Editor UI + selection/retry integration. 이후053 실제 Browser/save QA → gate 통과 시054 release validation.
78. **git diff summary:** 총19개(신규4/수정15), +769/-56. production12개·신규 tests2개·문서5개. stage/commit/merge/tag0.

## 파일 inventory

신규4개:

- `src/features/detail-extraction/crop-geometry.ts`
- `tests/manual-crop-domain.test.mjs`
- `tests/manual-crop-save.test.mjs`
- `docs/tasks/TASK-051.md`

수정15개:

- `src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/save/route.ts`
- `src/features/detail-extraction/client.ts`
- `src/features/detail-extraction/errors.ts`
- `src/features/detail-extraction/http.ts`
- `src/features/detail-extraction/images.ts`
- `src/features/detail-extraction/public-response.ts`
- `src/features/detail-extraction/review-model.ts`
- `src/features/detail-extraction/review.ts`
- `src/features/detail-extraction/schemas.ts`
- `src/features/detail-extraction/service.ts`
- `src/features/visual-assets/policy.ts`
- `docs/V0_2_1_MANUAL_CROP_DESIGN.md`
- `docs/V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md`
- `docs/RELEASE_BACKLOG.md`
- `docs/tasks/README.md`

## 검증 범위와 남은 작업

로그는 ignored `artifacts/TASK-051/`의 tests/manual/typegen/typecheck/lint/build 및 audit에 보관한다. 최종 audit PASS: branch/HEAD/stage·변경19개 범위·기존1291 tests/fixtures/자동 detector/UI/package/migration 불변·보호 파일4개/real patch3개 hash·secret 검사 확인. 실제 UI/drag/375px/사용자 preview/sign-off는 이번에 실행하지 않았다. B02를 포함한 manual geometric validity는 semantic content safety의 보장이 아니다. PNG exact subset과 JPEG/WebP 재인코딩을 구분한다. 원본 파일과 기존 Derived를 재작성하지 않는다.

source bytes는 요청 시작에 hash 검증 후 immutable working buffer로 pin한다. metadata CAS/lease에 참여하는 앱 writer를 보호하며 외부 Storage 직접 교체나 여러 서버의 product-wide transaction을 새로 보장하지 않는다. lease/run 자체를 잃어 최종 정리에 실패하면 기존 정책대로 전체 오류가 될 수 있으므로 이미 성공한 파일을 삭제하지 않고 read-only 재조회로 복구한다. 기존 자동 UI는 V1/base 선택·슬롯 추정을 사용하며 새 manual 변형 선택/최종 영역 표시·draft 유지·signed URL 갱신 UX는 TASK-052에서 연결한다. API GET은 그 구현에 필요한 bounded basis/crop 정보를 제공한다.
