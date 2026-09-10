# Architecture

## 목적

DetailForge의 시스템 경계, 계층, 핵심 모델을 정의한다.

## MVP 시스템 경계

```text
Browser
  -> Next.js Server (Server Components / Server Actions / Route Handlers)
    -> Supabase Database and private Storage
```

브라우저는 Supabase에 직접 연결하지 않는다. 데이터 접근은 Next.js 서버에서만
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

## 현재 운영 전제

현재 MVP는 **single-user/local-development assumption**이다. Server Action도 외부에서
호출할 수 있는 서버 진입점이며, 서버 전용 service role client만으로 사용자 접근 통제가
완성되는 것은 아니다. **외부 공개 배포 전에 Auth + owner_id + 사용자별 RLS**와
Server Action의 인증/소유권 검증이 필요하다. TASK-005에서는 Auth와 migration을 추가하지 않는다.
