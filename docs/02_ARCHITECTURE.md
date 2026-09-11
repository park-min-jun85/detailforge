# Architecture

## 목적

DetailForge의 시스템 경계, 계층, 핵심 모델을 정의한다.

## MVP 시스템 경계

```text
Browser
  -> Next.js Server (Server Components / Server Actions / Route Handlers)
    -> Supabase Database and private Storage
```

브라우저의 DB 조회와 Storage 변경은 Next.js 서버에서만 수행한다. 비공개 이미지 표시는
서버가 발급한 임시 signed URL로 Storage에서 원본을 읽는다. 데이터 변경은
`src/lib/supabase/server.ts`의 service role client를 통해 수행한다.

## 계층 책임

- `src/app`: App Router 진입점과 서버 UI 조합
- `src/features`: 사용 사례 단위의 애플리케이션 로직
- `src/services`: 외부 시스템 및 저장소와의 작업 조정
- `src/lib/supabase`: Supabase client와 DB 타입
- `src/types/domain.ts`: Supabase에 의존하지 않는 Core Domain 타입

DB row는 `snake_case`, Application Domain은 `camelCase`를 사용한다. 두 모델의
변환과 JSONB 검증은 데이터 접근 경계에서 수행한다.

## 핵심 모델

하나의 Project는 MVP에서 Product 하나와 DetailPage 하나를 가진다. ProductFacts는
Product에 종속된 사실정보의 Source of Truth이며, DetailPage는 순서가 있는 Section
조합으로 표현한다. 실제 이미지 파일은 private Storage의 `product-assets` bucket에
두고 Asset에는 경로와 메타데이터만 저장한다.

인증과 사용자별 소유권, AI 파이프라인, 공급처 Adapter, 렌더링 및 편집 UI의 상세
설계는 후속 TASK에서 추가한다.

## PHASE 1 / TASK-005 프로젝트 생성·조회

- `src/features/projects/queries.ts`: 서버 전용 목록/집계 조회. UI에 query를 두지 않는다.
- `src/features/projects/actions.ts`: Server Action에서 Zod 검증 후 projects에만 INSERT한다.
- `src/features/projects/schemas.ts`: 입력 검증과 DB row 검증 및 Domain 변환 경계다.
- `src/features/projects/components`: 생성 폼과 프로젝트 목록을 표현한다.
- 생성 시 Product, ProductFacts, DetailPage는 만들지 않는다. 이들은 후속 입력 단계에서 연결한다.
- Dashboard/Projects는 `connection()` 이후 요청 시 조회한다. 생성 성공 시 두 경로를
  `revalidatePath`로 갱신하고 Projects로 이동한다. DB 조회는 빌드 시 실행하지 않는다.
- 목록은 20개 단위 pagination과 `updated_at DESC, id DESC` 정렬을 사용한다.
  집계는 목록 길이가 아닌 DB의 exact count를 사용하고 최근 프로젝트는 5개로 제한한다.
- DB row의 상태/날짜/id를 검증한 뒤 camelCase Domain 모델만 presentation에 전달한다.
- DB 오류, 연결 실패, 환경변수 누락은 일반 사용자 메시지로 변환한다. 내부 오류와
  service role key는 응답이나 로그에 출력하지 않는다. DB 요청 제한 시간은 10초다.

## PHASE 1 / TASK-006 상품정보

- `/projects/[projectId]`는 UUID/Project 존재 여부를 확인하고 상품정보를 서버에서 조회한다.
- `src/features/products/queries.ts`: Project와 Product 조회 및 Domain/Form 데이터 조합.
- `schemas.ts`, `mappers.ts`: 입력과 JSON 검증, manual snapshot/Facts 생성, DB→Domain 변환.
- `actions.ts`: FormData를 받아 저장 흐름을 호출하고 상세 route를 재검증한다.
- `persistence.ts`: 기존 서버 client로 products와 product_facts를 저장한다. UI에는 DB query를 두지 않는다.
- `components/product-form.tsx`: 입력, 스펙 행, 저장 진행/오류/성공 상태를 표현한다.
- Product 저장은 Project의 status와 updated_at을 변경하지 않으므로 기존 목록/집계 의미를 유지한다.

### 두 테이블 저장과 보상

Product와 기존 Facts를 먼저 조회해 스냅샷을 보관한다. Product를 먼저 INSERT/UPDATE하고
Facts를 INSERT/UPDATE한다. 두 UNIQUE 제약을 유지하며 무조건적인 upsert로 다른 쓰기를 덮지 않는다.
기존 record UPDATE와 복원에는 updated_at 비교 조건을 사용한다. 오래된 폼은 저장을 거부한다.
같은 프로세스의 같은 Project 저장은 동시 실행을 거부한다.

Facts 저장 실패 시 재조회하여 응답만 유실되었는지 확인한다. Facts가 이전 상태 그대로이면
신규 Product는 해당 요청의 id/updated_at 조건으로 삭제하고, 기존 Product는 이전 내용으로
복원한다. 복원 시 DB trigger로 변경된 updated_at을 폼에 돌려주어 재시도를 허용한다.
Facts가 다른 내용으로 변경되었거나 조회/복구가 실패하면 오래된 값으로 덮어쓰지 않고
재확인 필요 상태를 반환하며 폼을 잠근다. 사용자에게 다시 열어 저장 내용을 확인하도록 안내한다.

이는 보상 처리이며 DB 트랜잭션이 아니다. 프로세스 중단, 장기 연결 장애, 여러 서버 프로세스의
동시 쓰기에서는 부분 상태가 남을 수 있고 두 쓰기 사이의 중간 상태도 조회될 수 있다.
신규 migration/RPC 없이 ACID atomicity를 보장하지 않는다. 엄격한 원자성이 필요해지는
단계에서 DB transaction/RPC를 별도 설계해야 한다.

## PHASE 1 / TASK-007 제품 이미지

- `/projects/[projectId]/images`: Server Component에서 Project/Product를 검증하고 초기 목록을 조합한다.
- `features/assets/service.ts`: 기존 server-only client로 소속 검증, 목록, signed URL, 업로드/삭제 보상을 담당한다.
- `schemas.ts`: UUID, 파일 MIME/크기/시그니처, 표시 파일명, 경로 소속, 수량/순서, DB→Domain 경계다.
- `http.ts`: 동일 Origin/Host 검증, 크기가 제한된 바이너리 읽기, 비공개 캐시와 일반 오류 응답.
- `client.ts`, `components/asset-manager.tsx`: 서버 API 호출과 파일별 진행/결과, 썸네일 및 삭제 확인 UI.
- `POST /api/projects/[projectId]/assets`는 파일당 한 요청이다. Content-Type에 MIME,
  X-File-Name에 URL 인코딩 파일명을 전달한다. 서버는 Content-Length뿐 아니라 실제 스트림의
  바이트 수를 검사하며 최대 10MiB까지만 읽는다. 여러 파일은 브라우저에서 순차 전송한다.
- `GET`은 안정적으로 정렬한 Asset과 5분 signed URL을 반환한다. `DELETE .../assets/[assetId]`는
  DB에 저장된 경로만 사용한다. 응답은 `Cache-Control: private, no-store`이다.
- Storage에는 UUID 경로로 원본을 업로드하고 assets에 메타데이터를 INSERT한다.
  INSERT 실패 시 id로 재조회하여 응답 유실이면 성공 처리하고, row가 없으면 파일을 정리한다.
  재조회 실패 시 저장된 row의 파일을 지우지 않고 확인 필요 오류를 반환한다.
- 삭제는 Storage → DB 순서다. 파일 삭제 실패 시 row를 유지하고, DB 삭제 실패 시 남은 row를
  다시 삭제할 수 있다. 파일이 이미 없어도 Storage remove를 재시도할 수 있다.
- 동일 프로세스의 Product별 변경 잠금과 exact count/max sort_order로 순서를 정한다.
  다중 서버의 수량/순서 경쟁, 프로세스 중단, 장기 장애의 고아 파일은 엄격하게 방지하지 못한다.
  Storage/DB는 하나의 transaction이 아니며 상세 한계와 수동 정리 기준은 TASK-007에 기록한다.

## 현재 운영 전제

현재 MVP는 **single-user/local-development assumption**이다. Server Action도 외부에서
호출할 수 있는 서버 진입점이며, 서버 전용 service role client만으로 사용자 접근 통제가
완성되는 것은 아니다. **외부 공개 배포 전에 Auth + owner_id + 사용자별 RLS**와
Server Action/Route Handler의 인증·소유권 검증 및 사용자별 Storage 정책이 필요하다.
TASK-007에서는 Auth와 migration을 추가하지 않는다. Origin 검사는 사용자 인증을 대신하지 않는다.
