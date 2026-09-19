# TASK-024 — Product Shot Extraction from Long Detail Images

상태: 구현·실제 QA 완료 (2026-09-19 KST). 브랜치 `feat/detail-image-extraction`, 시작 HEAD `18ba711`.
Git commit/main merge 없음. TASK-023에서 발견한 긴 상세이미지 재료 문제 중 **사용자가 검토한 직사각형 제품컷을 별도 Asset으로 저장**하는 범위다.

## 요청한 54개 완료 항목

1. **생성 파일**
   - `src/features/detail-extraction/{policy,errors,schemas,geometry,images,source,provider,service,http,client}.ts`
   - `src/features/detail-extraction/components/extraction-panel.tsx`
   - `src/features/assets/metadata.ts`
   - `src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/route.ts`
   - 위 경로의 `save/route.ts`
   - `tests/detail-extraction.test.mjs`, `tests/detail-extraction-service.test.mjs`, 이 문서.
2. **수정 파일**: `.env.example`, `package.json`, `package-lock.json`, `src/features/assets/service.ts`, `src/features/assets/components/asset-manager.tsx`, `src/features/asset-analysis/service.ts`, `src/lib/supabase/server.ts`, `tests/helpers/asset-db.mjs`, `docs/tasks/README.md`, `docs/02_ARCHITECTURE.md`~`06_CODING_RULES.md`.
3. **Migration**: 없음. 기존 assets.metadata JSONB, width/height/sort_order와 private product-assets 사용. DB 타입/기존 migration/RLS 변경 없음. assets에 updated_at 컬럼을 가정하지 않는다.
4. **Dependency**: `sharp@0.35.4` 직접 고정 추가. Next의 동일 간접 버전은 dedupe. 다른 dependency 없음. npm registry 설치 성공.
5. **Long eligibility**: 높이≥2400px, H/W≥3.5이면 long, 비율≥12면 extreme_long. 860×12900 extreme, 330 정사각형/860 정사각형/860×1200 normal. asset_type 무관; Derived marker는 제외.
6. **Source loading/security**: 서버가 Project→Product→Asset 및 private prefix/UUID 파일명을 검사한다. 해당 DB 경로만 60초 signed URL로 서버 내부 다운로드하고 configured Supabase origin/정확한 bucket path를 재확인한다. redirect:error, 실제 stream/Content-Length 10MiB, 20초 다운로드 제한. arbitrary URL/file/rect 입력 없음. decoder40MP/폭6000/높이60000 제한. 기존 Import SSRF/DNS/redirect 정책 변경 없음.
7. **Fingerprint**: URL이 아닌 원본 다운로드 bytes SHA-256. 저장 전 다시 다운로드하여 hash를 비교한다. 변경 시 source_changed/stale로 차단한다.
8. **Tiling**: EXIF 정규화 image를 목표 높이2048, overlap256, 최대16개로 수직 분할. 마지막 구간 포함 전체 범위 연결. 타일 폭은1024 이하이며 업스케일 없음. 타일 JPEG quality85 data URL은 메모리에만 존재한다.
9. **Boundary snapping**: 폭64 grayscale proxy의 평균≥245/분산≤8인 16행 연속 gutter를 목표±128px 안에서만 찾는다. 제품 판정용 CV가 아니며 텍스트 경계 추론은 하지 않는다.
10. **Provider/model**: 서버 전용 OpenAI Responses, 기본 gpt-5.6-luna. `OPENAI_DETAIL_EXTRACTION_MODEL`로 override, 기존 OPENAI_API_KEY. [공식 모델 문서](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [Vision guide](https://developers.openai.com/api/docs/guides/images-vision)에서 지원 확인.
11. **Structured Output**: strict schemaVersion1/regions≤8 per tile; 9종 role; confidence/productVisibility/standaloneUsability 0..1; textDensity 4종; tile-relative0..1000 정수 box; rationale≤180자. Zod 재검증과 별도 geometry 검증.
12. **Prompt Injection**: 고정 system prompt에서 이미지 내용은 untrusted DATA이며 지시가 아니라고 명시한다. 이미지 내부 명령/URL/OCR/Fact/성능/인증/소재/옵션 추론을 따르지 않는다. 이미지 data URL은 user input_image로 분리한다. 출력 문자열은 React text로만 렌더링한다.
13. **좌표**: tile box 좌상단 floor/우하단 ceil → tile.y offset → orientation_normalized_pixels. reversed/zero/NaN/fractional/out-of-range normalized box 거부. 저장 시 candidate ID hash와 실제 원본 범위를 다시 검사한다.
14. **Filtering**: raw box 최소160×160 및64,000px². 제품4종/mixed, confidence≥0.4, visibility/usability≥0.35만 저장 가능. 텍스트/배송·공지/배너/기타 및 작은 조각은 제외 후보로 표시한다. 단순 종횡비로 정상적인 전신사진을 제거하지 않는다.
15. **Margin**: 축당2%, 최대24px, 원본 경계 clamp. 실제 QA에서 일부 상·하단 얇은 구분선이 함께 들어온다. 자동 텍스트 제거/보정은 하지 않는다.
16. **Dedup/edge**: 같은 role의 IoU≥0.65 또는 작은 사각형 containment≥0.92 NMS; 품질 높은 후보 유지, tileIndices만 합친다. 서로 다른 사진일 수 있으므로 edge 후보를 자동 union하지 않는다. 보수적인 미병합 정책이며 실제 경계 후보19/20은 별도로 검토하도록 유지했다.
17. **Default selection**: product/usage/detail/variant + confidence≥0.7 + visibility/usability≥0.65 + text none/low + 충분한 크기 + tile-edge 아님. mixed/notice/promo/text/other는 false. 서버 정책이며 최종 저장은 사용자 선택만 사용한다.
18. **Extraction metadata**: Source.detailExtraction의 schemaVersion/revision/attempt/saveLease/latestResult. latestResult는 source hash/크기/좌표계/orientation/model/시각/타일 수/실패 목록/partial/truncated/후보 최대24개. raw 응답·prompt·signed URL은 저장하지 않는다.
19. **API**: POST `/api/projects/[projectId]/assets/[assetId]/extract-product-shots` `{force}`; POST 같은 경로 `/save` `{candidateIds}`. same-origin, JSON8KiB, strict body, Node runtime, private no-store, 안전한 한국어 오류. URL/rect/파일 내용은 받지 않는다.
20. **Review UI**: Images Source 카드의 추출 버튼 → 분석 → 후보 grid/선택 → 저장. 역할/신뢰도/텍스트 밀도/크기/rationale/경계 경고/제외 후보 보기 제공. 실패/진행/이전 성공/부분 분석/슬롯 부족/부분 저장 상태 구분. Derived에는 출처·크기만 표시하며 재귀 버튼 없음.
21. **Preview**: 기존 signed Source를 SVG viewBox + 명시적 clipPath로 표시한다. 후보만으로 파일을 업로드하지 않는다. EXIF normalized source 좌표와 브라우저 이미지 orientation을 사용한다. desktop/375px 실제 preview 확인.
22. **Save flow**: scoped Source + 최신 후보 ID + bytes hash → 기존 Derived 조회 → 전체 신규 선택 capacity 검사 → save lease → 원본 순서 실제 crop → upload/insert → saved/existing/failed 개별 결과. 성공한 선택은 UI에서 저장됨/disabled 처리한다.
23. **Actual crop**: Sharp가 Source를 한 번 orientation-normalized lossless PNG working buffer로 만들고 `.extract()`로 실제 사각형 픽셀 파일을 생성한다. no background removal/inpainting/masking/retouch/resizing/upscaling. 원본 Storage 파일은 변경하지 않는다.
24. **Output**: 원본 JPEG→JPEG quality95/4:4:4, PNG→lossless PNG, WebP→WebP quality95. metadata stripping. 결과 magic signature/MIME/실제 dimensions/10MiB 검증. 저장 filename extension은 실제 MIME 기준이다.
25. **Storage path**: `projects/{projectId}/products/{productId}/{newServerUUID}.{jpg|png|webp}`. private bucket, upsert:false, public URL 미저장.
26. **Derivation**: schemaVersion1/kind=detail_image_crop/parentAssetId/sourceFingerprint/candidateId/sourceRect/sourceDimensions/coordinateSpace/suggestedRole/confidence/extractedAt/provider/model. 후보 ID는 SHA256(source hash, rect, role) 결정값이다. approved 저장 흔적은 이 provenance를 가진 실제 row의 존재다.
27. **asset_type**: 저장 직후 반드시 unclassified. suggestedRole은 metadata만 사용하며 hero 자동 승격 없음. 기존 Asset AI를 명시적으로 실행하면 이후 일반 분류 흐름을 사용한다.
28. **Dimensions/order**: 실제 crop width/height 저장. 현재 Product 최대 sort_order 뒤에 선택 후보의 y/x 원본 순서로 append. Source null 크기를 갱신하지 않는다.
29. **Asset limit**: 원본+파생 포함30개. 이미 저장된 동일 후보는 신규 슬롯에서 제외한다. 선택 신규 수가 남은 슬롯 초과면 시작 전에 전체 차단, available 반환. 임의 일부 채우기 없음.
30. **Duplicate protection**: 현재 Product Assets에서 parentAssetId/sourceFingerprint/candidateId를 비교해 existing 반환. metadata에 accepted IDs를 중복 유지하지 않으며 이 query로 계산한다.
31. **Partial failure**: 후보별 성공/실패 반환. upload 성공·DB 미저장 확인 시 해당 새 UUID 파일만 정리한다. INSERT/UPDATE 응답 유실은 reread하여 성공 회복한다. 재조회도 실패하면 저장 가능성이 있는 파일을 삭제하지 않고 recovery를 알린다. lease 정리 실패 시에도 재저장 전 목록 확인을 요구한다.
32. **Source 보호**: 기존 bytes/path/filename/MIME/size/width/height/asset_type/sort_order/created_at 및 source/aiAnalysis namespace 유지. 추가·갱신 범위는 detailExtraction뿐이다. 실제 다운로드 SHA-256/컬럼 비교 통과.
33. **Reanalysis**: 같은 hash/policy 성공 결과는 기본 재사용. force 버튼은 새 비용 발생을 표시한다. 실패하면 attempt만 failed로 바꾸고 이전 latestResult를 유지한다. lease 만료 후 명시적 재시도 가능. 페이지 진입/새로고침 자동 호출 없음.
34. **Concurrency**: 프로세스당 추출1개, Source DB attempt/save lease6분, Product 업로드/삭제/저장의 기존 process lock. metadata revision CAS를 기존 Asset AI에도 연결해 서로 결과를 덮지 않는다. 외부에서 직접 JSON을 쓰는 도구는 이 CAS 계약에 참여해야 한다. 서로 다른 Source를 여러 서버에서 동시에 저장하는 product-wide 원자성은 기존 MVP 한계이며 보장하지 않는다.
35. **Cost/timeout**: tile45초/run300초, max16 tiles/24 candidates, SDK retry0/log off/store false. 일부 tile 실패는 bounded failedTiles/partialAnalysis, 전부 실패는 failed. Source download20초/Sharp 단계30초/DB10초/추출 Supabase transport30초; save는240초 이후 남은 신규 후보를 timeout 처리하여6분 lease 안에 종료 여유를 둔다. 자동 유료 retry 없음.
36. **테스트 결과**: 신규53개 mock/Sharp/HTTP/DB 테스트 통과. 사용자 요구 A–AS를 포함한다. source bytes/MIME/pixel bomb/EXIF/tiling/geometry/dedup/defaults/strict schema/prompt 분리/metadata CAS/실패 보존/stale/소속/재귀/실제 crop/한도/중복/보상/독립삭제/no signed URL/no 자동 AI를 검증한다. 추가로 Storage redirect, save lease 만료, derived의 명시적 기존 Asset AI 분석을 검증한다.
37. **전체 수**: 기존586 + 신규53 = 639 tests. 실제 provider는 자동 tests에서 호출하지 않는다.
38. **필수 검사**: next typegen, tsc --noEmit, lint, build, git diff --check, npm ls sharp 및 client secret 검사. 최종 실행 결과는 이 문서 말미 검증 기록을 따른다.
39. **실제 OpenAI**: 실행함. gpt-5.6-luna 1회 추출 run,8개 tile request, 재분석/자동 retry/후속 Asset AI0회. 서버 attempt 기록73,523ms. 실제 응답 전부 성공, partial=false.
40. **실제 원본**: 도매매67399861의 공개 상세이미지 `https://www.dometopia.com/data/goods/goods_img/GDI/1364769/1364769.jpg`, JPEG860×12900,1,976,196bytes. 기존 secure Import downloader로 가져와 새 TASK-024 전용 QA Project의 private Asset으로 등록했다.
41. **실제 tile 수**:8/8 성공. 원본 전체 한 장을 Vision에 보내지 않았다.
42. **Candidate 총 수**: 정규화·NMS·품질 상한 후24개, truncatedCandidates=true. 저장하는 정규화 결과 이외 raw 응답을 남기지 않아 cap 이전 수는 기록하지 않았다.
43. **기본 선택 수**:11개. 경계 후보15/19/20은 기본 선택 아님. 작은 불완전 사진14는 저장 제외.
44. **실제 Derived 수**: 사용자 검토 동작으로7개 저장, 실패0. 후보2/9/10/16/17/22/23. QA Source1 + Derived7 = 등록8개. 모두 private/unclassified/미분석, 새로고침 후 유지.
45. **Derived dimensions**: 원본 순서대로821×825(158,689B),434×443(111,209B),435×443(87,582B),434×445(46,619B),436×445(54,704B),699×673(239,636B),860×894(150,868B). 모두 JPEG, 저장 파일을 다시 다운로드·decode하여 DB 수치와 비교했다.
46. **제품/사용/디테일/옵션 품질**: 제품+반려견 구도2, 손으로 누르고 드는 장면9/10, 패드 전체16, 표면 디테일17, 패드/포장22/23이 실사용 가능한 crop이었다. 착용/색상 옵션 양성 사례는 이 상품에 없으므로 실검증했다고 주장하지 않는다(4종 role 정책은 mock 검증). 단순 사진 외 도식5/6이 높은 점수로 기본 선택되는 한계가 있었고 직접 해제했다. 제품 정체성이 모호한 연출12와 하단 잔여 문구가 있는8도 저장하지 않았다.
47. **배송/공지/텍스트 오탐**: 실제 텍스트 블록1/3/4/7/11/13/18/21/24는 기본 선택되지 않았다. 제공고시24도 제외. 배송/반품 전용 영역은 이 원본에서 양성 사례 미확보이며 해당 role 제외는 mock으로 확인했다. 일부 사진 가장자리에 원본의 얇은 구분선/치수 표시는 남는다. crop만 수행하므로 이를 지우지 않았다.
48. **Contact sheet**: 로컬 artifact root `C:/Users/alswn/Documents/Codex/2026-09-09/c-projects-detailforge/artifacts/TASK-024/`의 `candidate-contact-sheet.png`(전체24), `saved-contact-sheet.png`(실제7), `derived-1.jpg`~`derived-7.jpg`. repo에 큰 바이너리 fixture를 추가하지 않았다.
49. **Product/Facts/Options/Plan/Sections 불변**: 분석/저장 전후 모든 비Asset 테이블 hash와 Source 컬럼/원본 bytes를 비교했다. 추출 때문에 Product Analysis/Fact Validation/Project status도 변경되지 않았다. 기존 사용자의 전체 rows는 baseline(id/hash)로 별도 보호했다.
50. **Secret/client bundle**: OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY/DOMEGGOOK_API_KEY 실제 값, provider SDK/endpoint/Sharp/server 설정의 client 포함 여부를 검사한다. 실제 키/원본 SDK 오류/signed URL을 문서·fixture·로그에 출력하지 않았다.
51. **테스트 데이터 정리**: QA 전용 Project/Source/Derived DB/Storage 정리 완료, QA private prefix 파일0개, 기존 전체 baseline hash 일치. contact sheet와 로컬 검증 결과만 남겼다. product-assets bucket public=false도 확인했다.
52. **Cursor 직접 확인**: Images에서 긴 Source 버튼/일반 이미지 버튼 부재/Derived 재귀 버튼 부재, 사진 잘림·경계선·도식 오분류, 수동 제외/재선택, 재분석 비용 표시, partial/stale/slot 오류, 저장 결과와375px/keyboard 동작. 브라우저375px 실제 scrollWidth360≤viewport375, checkbox Tab focus 확인.
53. **TASK-025 인계**: 실제 Derived row + provenance를 승인 저장 결과로 읽어 제품/사용 이미지 우선, Source long image를 reference/fallback, Hero와 섹션 반복 배치 개선을 별도 구현한다. source deleted여도 Derived는 독립 사용 가능해야 한다. 도식 vs 사진과 얇은 경계선 문제를 실제 다상품 평가 fixture로 확대해야 한다. 이번 구현은 Planner/Renderer 우선순위를 바꾸지 않았다.
54. **미구현**: 생성형 이미지/배경 제거/마스킹/인페인팅/보정/OCR Fact 생성/수동 crop handles/확실하지 않은 edge union/자동 저장/자동 후속 AI/Planner 우선 선택/분산 product transaction/새 Auth/RLS. 기존 단일 사용자 로컬 MVP 운영 전제를 유지한다.

## 실제 품질 및 성능 기록

저장한7개는 큰 텍스트 블록이 없고 제품의 주된 영역을 확인할 수 있다. closeup9/10/17은 원래 부분을 보여 주는 사진이며 전신사진처럼 전체 물체를 보장하지 않는다. 사진2의 원본 배치,22의 치수 표시,23의 상단 얇은 구분선은 수정하지 않았다. 이 결과를 자동 확정 사실이나 성능 입증으로 사용해서는 안 된다.

Windows의 별도 로컬 Node 프로세스에서 동일860×12900 bytes decode +8 tiles +11 candidate crop은784ms, 단계별 관측 RSS 최대116MiB였다. 정확한 서버 peak benchmark는 아니며 당시 dev server 전체 peak는 측정하지 않았다. 실제7개 Storage 저장은 UI에서20초 이내 완료를 확인했다(관찰 간격을 포함하며 정확한 요청 latency는 아님).

Artifact `evidence.json`은 정규화 결과만, `performance.json`은 수치만 보존한다. 키/판매자 연락처/raw provider response 없음. Sharp contact sheet 생성 시 제한된 사용자 font cache 쓰기 경고가 있었지만 이미지 생성/검수는 성공했으며 시스템 설정을 변경하지 않았다.

## 최종 검증 기록

- 전체639 tests: pass639/fail0/skipped0, 약61초. 자동 테스트 실제 OpenAI0회.
- `npx.cmd next typegen`: 통과.
- `npx.cmd tsc --noEmit`: 통과.
- `npm.cmd run lint`: 통과, warning0.
- `npm.cmd run build`: 통과. 두 extraction POST route Node 빌드 확인.
- `git diff --check`: 통과. Windows의 LF→CRLF 안내만 있었으며 whitespace 오류 없음.
- `npm.cmd ls sharp`: direct0.35.4, Next 간접0.35.4 deduped.
- client JS/map23개: 실제 키3종 일치0, provider/Sharp/server 설정 marker0. src/docs/tests 실제 키 일치0. 모든 추출 server module의 server-only 경계 확인.
- 실제 QA:8/8 tile 성공,7/7 crop private Storage/DB 저장,375px/keyboard/새로고침 유지 확인. actual output decoder/bytes 및 Source 원본 보호 통과.
- QA cleanup: Source1/Derived7 및 임시 Project/Product/Facts 정리, private prefix 잔여0, 기존 전체7종 테이블 row hashes 일치. 로컬 artifacts만 보존.
- 결과 파일: `tests-final.txt`, `build-final.txt`, `secret-check.json`, `cleanup.json`, `performance.json`, `evidence.json`(위 artifact root).
- Git branch는 `feat/detail-image-extraction`, commit/main merge 없음. 기존 migration/생성 DB types 파일 변경 없음.
