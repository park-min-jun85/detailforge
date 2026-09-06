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
