# TASK-007 — Product Image Upload

## 상태와 범위

PHASE 1 구현 및 자동 검사, 실제 Supabase/브라우저 검증 완료. 최종 사람 UI 확인 대기.
작업 브랜치 `feat/asset-upload`. Git commit 미실행. 추가 dependency 및 migration 없음.
기존 `product-assets` private bucket, assets table, server-only client, Domain Asset을 재사용한다.

## 파일과 책임

생성:

- `src/app/projects/[projectId]/images/page.tsx`: 초기 소속/조회와 화면 조합
- `src/app/api/projects/[projectId]/assets/route.ts`: GET 목록/POST 바이너리
- `src/app/api/projects/[projectId]/assets/[assetId]/route.ts`: DELETE
- `src/features/assets/schemas.ts`: 파일·경로·수량·DB row 검증과 Domain 변환
- `src/features/assets/types.ts`: 소속 및 임시 미리보기 응답 타입
- `src/features/assets/service.ts`: 서버 조회·서명·업로드·삭제·보상
- `src/features/assets/http.ts`: Origin/Host 검증, 제한된 스트림 읽기, 오류 응답
- `src/features/assets/client.ts`: 브라우저→Route Handler 요청
- `src/features/assets/components/asset-manager.tsx`: 선택/진행/결과/썸네일/삭제 UI
- `tests/assets.test.mjs`, `tests/assets-service.test.mjs`, `tests/helpers/asset-db.mjs`
- `docs/tasks/TASK-007.md`

수정:

- `src/features/products/components/product-form.tsx`: 저장 후 다음 단계 링크
- `docs/02_ARCHITECTURE.md`, `docs/03_DATABASE.md`, `docs/05_UI_UX.md`, `docs/06_CODING_RULES.md`
- `docs/tasks/README.md`

## 사용자 흐름과 API

상품정보 저장 후 '다음: 이미지 등록' → `/projects/[projectId]/images`에서 여러 파일을
선택하고 명시적으로 업로드한다. Project가 없으면 not-found, Product가 없으면 상품정보
입력 링크를 제공한다. 기존 Project/Product의 관계를 서버가 다시 검사한다.

`POST /api/projects/[projectId]/assets`에 한 파일의 원본 바이트를 전달한다.
Content-Type은 MIME, X-File-Name은 encodeURIComponent(filename)이다. multipart/Server Action
대용량 요청을 사용하지 않는다. 브라우저는 순차 처리하며 성공한 파일을 일괄 롤백하지 않는다.
파일 선택은 현재 선택 목록을 교체하며 input은 비워 같은 파일을 다시 선택할 수 있다.

`GET`은 현재 상품의 Asset와 단기 previewUrl을 반환한다. `DELETE .../assets/[assetId]`는
검증된 DB row의 경로만 삭제한다. 세 API의 응답은 private/no-store이고 서비스 key와 내부
Supabase 오류를 반환하지 않는다. POST/DELETE의 Origin을 실제 요청 Host/프로토콜과 비교한다.
NextURL의 127.0.0.1→localhost 정규화에 대한 회귀 테스트를 포함한다.

## 검증과 데이터

- JPEG/PNG/WebP MIME, 파일당 0 초과~10MiB, 상품당 최대 30개.
- Content-Length 사전 검사와 실제 스트림 바이트 수 제한을 모두 적용한다.
- JPEG/PNG/WebP 기본 시그니처와 MIME의 일치를 확인한다. 전체 디코딩이나 손상 이미지의
  완전한 검증은 하지 않으며 디코딩 불가 이미지는 썸네일 오류로 안내할 수 있다.
- 파일명은 basename 추출, 제어/방향문자 제거, NFC/trim 후 1~255자로 제한한다.
  파일명은 DB 표시용이며 Storage 경로의 식별자로 신뢰하지 않는다.
- 경로는 `projects/{projectId}/products/{productId}/{serverUuid}.{jpg|png|webp}`이다.
- assets에는 project_id/product_id/storage_path/original_filename/mime_type/size_bytes,
  asset_type=unclassified, metadata={}, width/height=null을 기록한다. 파일 원본은 바꾸지 않는다.
- sort_order는 최초 0, 이후 max+1이며 중간 삭제 후 번호를 압축하지 않는다.
  목록은 sort_order, created_at, id 오름차순이다.
- 삭제는 assetId/projectId/productId를 모두 조건으로 조회하고, Domain 변환 후 경로가
  같은 Project/Product prefix와 UUID 파일명인지도 검사한다. 임의 경로 인수는 받지 않는다.

## Private preview

서버가 300초 signed URL을 발급한다. DB에는 URL 없이 storage_path만 저장한다.
브라우저는 해당 URL로 원본을 읽고 `next/image unoptimized`로 표시한다.
4분 주기와 탭 복귀 시 갱신하며 수동 목록 새로고침과 이미지 로딩 실패 안내를 제공한다.
서명 API 자체가 실패하면 조회 실패를 반환하고, 개별 파일이 없으면 해당 미리보기만 비운다.
이미 내려받은 브라우저 캐시까지 삭제 즉시 무효화하는 기능은 없다.

## 부분 실패 전략과 한계

업로드는 Storage → DB INSERT 순서다. INSERT 결과가 불명확하면 이 요청의 UUID로
재조회한다. 예상 소속/경로의 row가 있으면 성공으로 복구하고, 없으면 방금 올린 경로만
best-effort로 삭제한다. 재조회 실패 시 저장된 row의 파일을 파괴하지 않도록 그대로 두고
목록 재확인/관리자 확인 안내를 반환한다. Storage 업로드 오류도 해당 새 경로만 정리한다.
정리 실패는 성공으로 숨기지 않는다.

삭제는 Storage → DB 순서다. Storage 실패 시 row를 보존한다. Storage 성공 후 DB 실패는
목록에 파일이 없는 row가 남을 수 있으며, 새로고침 후 다시 삭제하도록 안내한다.
DB 삭제 응답만 유실된 경우 새로고침하면 이미 삭제된 목록이 표시된다.

DB와 Storage는 단일 transaction이 아니다. 프로세스 강제 종료/장기 네트워크 장애 시
고아 파일 또는 파일 없는 row가 남을 수 있다. 관리자 정리는 실패 시간대의 Asset와
`projects/{projectId}/products/{productId}/` 아래 UUID 파일을 대조한 후 확인된 고아만 지운다.
확인되지 않은 전체 prefix 삭제나 자동 배치 정리는 구현하지 않는다.

Product별 잠금은 한 프로세스 안에서만 적용된다. 여러 서버 인스턴스의 동시 요청은
30개 제한과 max+1의 유일성을 엄격히 보장하지 못한다. 기본 FK는 조합 소속을 보장하지
않으며 검증 후 외부 DB 변경과 경쟁할 여지도 있다. 여러 사용자/서버 운영 전 DB transaction/
잠금·제약을 별도 설계해야 한다. 이번 TASK는 schema를 변경하지 않는다.

현재는 single-user/local-development assumption이다. service role과 Origin 검사는 인증이
아니다. 외부 공개 전에 Auth + owner_id + 사용자별 Storage/RLS 및 모든 서버 진입점의
인증/사용자 소유권 검증이 필요하다.

## 검증 결과

- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check` 통과.
- `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`: 40/40 통과.
  기존 24개 + 신규 16개. Node의 기존 MODULE_TYPELESS_PACKAGE_JSON 경고는 유지한다.
- 신규 검증: MIME/시그니처/크기/실제 body 제한, 파일명/UUID 경로, 30개/max sort_order,
  Project/Product 관계, Asset mapping, 삭제 경로 방어, 단일 프로세스 동시 요청,
  DB INSERT 실패 파일 정리, 응답 유실 복구, 정리/재조회 실패, 삭제 단계별 실패·재시도,
  signed URL 수명/미저장, 개별 미리보기 실패, 내부 오류 비공개, Origin/Host 검사.
- 장애 주입은 로컬 모의 HTTP DB/Storage에서 수행했다. 실제 원격 장애를 유발하지 않았다.

실제 브라우저/Supabase 검증:

- 전용 임시 Project에서 Product 저장 전 업로드 차단 → 기존 상품정보 폼 저장 → 다음 링크 확인.
- PNG 5장과 SVG 1개 선택: PNG 5개 성공, SVG 1개 클라이언트 검증 실패를 개별 표시.
- 업로드 중 파일 선택/업로드/새로고침 비활성화, 완료 후 썸네일 5개 로딩 확인.
- Private bucket 상태, assets 5개/Storage 5개, order 0~4, unclassified 확인.
  width/height가 null이며 size_bytes는 각 원본 1326바이트이다.
- Storage 다운로드와 로컬 원본의 SHA-256이 모두 일치하여 바이트 보존 확인.
- 새로고침 후 목록/썸네일 유지, 이미지 1개 삭제 후 DB/Storage 모두 4개 확인.
- 삭제한 파일을 다시 선택·업로드하여 order 5에 추가되고 총 5개가 되는 것을 확인.
- 1200px/375px에서 가로 넘침 없음. Desktop 화면과 파일명/버튼 배치 확인.
- 테스트 Project `d9267e9b-8ba5-42c0-a53d-5ff4b02dcef1`과 전용 Product/Facts,
  테스트 Asset/Storage 파일을 검증 후 정리했다. 잔여 테스트 Asset/Storage 파일 0개.
  사용자가 원래 가지고 있던 Project/Product는 수정하거나 삭제하지 않았다.

## 사람이 확인할 UI

- 실제 JPEG/WebP와 큰 사진 5~15장 선택, 업로드 체감 속도와 썸네일 가독성.
- 10MiB 경계와 30개 제한 안내, 긴 한글 파일명/다양한 원본 비율.
- Tab/Shift+Tab, 파일 선택, 업로드, 삭제 확인/취소의 키보드 흐름과 스크린리더 안내.
- 느린 연결/중단 후 개별 파일 오류와 목록 재확인 안내가 충분한지.
- 오래 열린 탭에서 signed URL 자동 갱신과 실패 후 수동 새로고침.

## TASK-008 전달 / 제외

다음 단계는 저장된 Asset의 id, projectId/productId, storagePath, MIME 및 순서에서 시작한다.
Asset는 모두 unclassified이며 원본 이미지와 Product Facts를 분석 입력의 근거로 사용해야 한다.
AI 분류 결과 스키마·검증·재실행 정책, 분석 상태/실패 표시와 사람 확인 흐름을 별도 설계한다.
signed URL을 영구 분석 입력이나 DB의 Source of Truth로 사용하지 않는다.

이번 범위에는 AI classification/OCR/Image understanding/Product AI/Fact validation,
Page Planner, Section Engine, Editor, Renderer, image processing/crop/background removal,
Marketplace/crawler, Auth, 신규 migration, drag reorder, 내용 기반 중복 이미지 제거가 없다.
