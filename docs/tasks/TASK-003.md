# PHASE 0 / TASK-003 — Supabase Foundation

## 목표

DetailForge MVP가 사용할 최소 Supabase 데이터 계층과 Core Domain Model을 구축한다.
원본 Source Data, Product Facts, 실제 이미지 Asset, Section 기반 상세페이지 구조를
안전하게 저장할 기반을 마련한다.

## 구현 범위

- `projects`, `products`, `product_facts`, `assets`, `detail_pages`, `sections` migration
- public table RLS 활성화와 `anon`, `authenticated` 접근 차단
- private `product-assets` Storage bucket
- service role을 사용하는 Next.js server-only Supabase client
- DB `snake_case` 타입과 Application Domain `camelCase` 타입
- 환경변수 예제와 관련 Architecture, Database, Coding Rules, ADR 문서

## 제외 범위

- Auth, 로그인, 회원가입, 사용자별 소유권과 RLS policy
- 상품 입력 및 이미지 업로드 UI
- AI API, 상세페이지 생성과 Editor
- 크롤링과 Marketplace 연동
- ORM, Vitest, Docker 기반 Local Supabase 환경
- `product_sources`, `page_drafts`, `section_assets` 추가 구조

## 완료 조건

- initial migration만으로 6개 table과 private bucket을 생성할 수 있다.
- service role 환경변수는 client 생성 시점에만 검증하며 값이 노출되지 않는다.
- Supabase client가 수동 최소 `Database` 타입과 연결된다.
- Core Domain 타입이 Supabase SDK에 의존하지 않는다.
- TypeScript, lint, Next.js build 검증을 통과한다.

## 후속 작업

Remote Supabase Project에 migration을 적용한 뒤 CLI로 `Database` 타입을 다시 생성한다.
Auth를 도입할 때 `owner_id`, `auth.users` 관계, 사용자별 RLS policy를 별도 TASK에서
추가한다.
