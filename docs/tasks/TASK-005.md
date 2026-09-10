# PHASE 1 / TASK-005 — 프로젝트 생성·조회

## 상태

구현 및 필수 검사 완료. 실제 Supabase 생성/조회 검증 완료.
사람의 최종 UI 확인 대기. 브랜치: `feat/project-crud`. Git commit 미실행.

## 목표와 구현

기존 App Shell을 유지하며 placeholder 화면을 Supabase projects 테이블과 연결한다.

- Dashboard/Projects CTA → `/projects/new` 단일 입력 폼
- `useActionState` + Server Action으로 서버 검증과 INSERT 수행
- 프로젝트명 trim, 최소 1자, 최대 100자. 브라우저 입력 제약과 별개로 서버에서 Zod 검증
- 추가 form 필드로 status/id를 주입할 수 없으며 서버에서 status를 draft로 고정
- projects의 name/status만 INSERT하고 id/날짜는 DB 기본값 사용
- products, product_facts, detail_pages 등 자식 record를 자동 생성하지 않음
- 생성 중 disabled 버튼, readOnly 입력, 진행 안내와 동기 제출 잠금
- 성공 시 Dashboard/Projects revalidation 후 `/projects?created=1`로 이동
- 입력 오류 시 이름 유지, 필드 오류 연결 및 일반 저장 오류 안내
- 조회 실패를 빈 목록/0건과 구분하고 다시 불러오기 제공

## 파일과 계층

### 생성

- `src/app/projects/new/page.tsx`
- `src/features/projects/actions.ts`
- `src/features/projects/queries.ts`
- `src/features/projects/schemas.ts`
- `src/features/projects/types.ts`
- `src/features/projects/components/create-project-form.tsx`
- `src/features/projects/components/project-list.tsx`
- `src/features/projects/components/project-load-error.tsx`
- `tests/register.mjs`
- `tests/projects.test.mjs`
- `tests/projects-queries.test.mjs`
- 이 문서

### 수정

- `src/app/page.tsx`
- `src/app/projects/page.tsx`
- `src/app/globals.css`: 실제 disabled 버튼 스타일
- `docs/02_ARCHITECTURE.md`
- `docs/05_UI_UX.md`
- `docs/tasks/README.md`

추가 dependency는 없다.

## 데이터 접근

`queries.ts`는 server-only이며 기존 `createSupabaseServerClient`를 사용한다.
UI에는 Supabase query를 두지 않고 검증된 camelCase Domain 모델만 전달한다.
DB row의 id, 날짜, 상태를 Zod로 검증한다.

- Projects: exact count와 20개 단위 range 조회, `updated_at DESC, id DESC` 정렬
- 페이지 번호는 정규화하고 전체 페이지를 초과하면 마지막 페이지 조회
- Dashboard: 전체 exact count, 작업 중 4개 상태 exact count, completed exact count
- 최근 프로젝트: 같은 내림차순 정렬로 최대 5개
- 목록 길이로 전체 집계를 계산하지 않으므로 Supabase 기본 반환 건수 제한과 무관
- `connection()` 이후 요청 시 조회하고 생성 성공 시 두 화면 경로를 재검증
- DB 요청은 10초 제한, 실패 시 내부 오류를 반환하거나 로그로 출력하지 않음

목록은 이름, 한국어 상태, 한국 시간의 최근 수정일, 열기 준비 중을 표시한다.
실제 열기 route와 수정/삭제 기능은 이번 TASK 범위에 포함하지 않는다.

## 보안과 운영 전제

현재 MVP는 **single-user/local-development assumption**이다.
**외부 공개 배포 전에 Auth + owner_id + 사용자별 RLS**와 Server Action의 인증/소유권
검증이 필요하다. Server Action의 서버 실행 자체는 사용자 인증을 대신하지 않는다.

브라우저는 service role client를 생성하지 않는다. 서버 오류, 환경변수 값,
service role key를 UI/응답/로그로 전달하지 않는다.
기존 Supabase client, 타입, schema와 migration은 변경하지 않는다.

중복 제출 잠금은 진행 중인 폼의 연속 제출을 막는다. 요청 응답이 유실된 뒤 재시도하거나
여러 탭에서 별도로 제출하는 경우까지 DB 차원의 idempotency를 보장하지는 않는다.
저장 결과가 불명확한 실패 안내에서는 목록을 먼저 확인하도록 안내한다.

## 검증

필수 검사:

- `npx next typegen`: 통과
- `npx tsc --noEmit`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과
- `git diff --check`: 통과

Node 24 내장 테스트 (추가 패키지 없음):

```bash
node --conditions=react-server --import ./tests/register.mjs --test tests/projects.test.mjs tests/projects-queries.test.mjs
```

6개 테스트 통과. 검증 범위:

- 공백/빈 값/100자/101자/비문자열 이름, trim 및 추가 필드 제거
- 5개 상태의 DB→Domain 변환, 잘못된 상태/날짜/id 거부
- pagination 입력 정규화와 숫자 overflow
- 로컬 모의 PostgREST를 통한 1,005개 집계, 작업 중/완료 분리, 최근 5개 정렬
- 20개 pagination, 마지막 페이지 보정, 빈 데이터와 조회 실패 구분
- DB 오류 내부 정보 비공개 및 환경변수 누락 처리

Node의 TS 모듈 형식 자동 판별 경고(MODULE_TYPELESS_PACKAGE_JSON)가 표시되지만
테스트는 통과한다. 경고 제거만을 위해 프로젝트의 module 설정을 바꾸지 않았다.

## 실제 Supabase 및 브라우저 검증

- 실제 빈 DB에서 Dashboard 0/0/0 및 empty state 확인
- Dashboard CTA와 Projects CTA에서 생성 폼 진입 확인
- 공백 이름 제출 시 서버 검증 오류 표시
- 앞뒤 공백이 있는 이름 제출 후 trim된 이름과 draft 상태로 1개 생성
- 생성 성공 안내 및 Projects 목록 즉시 반영
- Dashboard 이동 시 전체 1 / 작업 중 1 / 완료 0 및 최근 프로젝트 반영
- 생성된 project에 연결된 products 0개, detail_pages 0개 확인
  (Product가 없으므로 그에 종속된 ProductFacts도 생성되지 않음)
- 빌드된 클라이언트 JS에 현재 service role key가 포함되지 않은 것을 검사
- Desktop 목록과 375px 생성 폼을 시각적으로 확인, 폼의 가로 넘침 없음

실제 DB에 남긴 테스트 데이터:

- 이름: `TASK-005 검증용 프로젝트`
- id: `7645f432-b847-4e28-9ee7-f41beccccf46`
- status: `draft`
- 1개이며 삭제하지 않았음

별도 환경변수를 사용하는 오류 재현 서버 실행은 실행 정책에 의해 차단되어,
브라우저에서 강제 DB 실패와 지연 제출은 확인하지 못했다.
조회 오류 처리와 비공개 응답은 로컬 모의 PostgREST 테스트로 검증했다.

## 사람이 직접 확인할 UI

- 새 프로젝트 폼의 Tab 순서, Enter 제출, 취소
- 느린 연결에서 생성 중 버튼/입력 잠금 및 연속 제출 방지
- DB 연결 실패 시 생성 오류 문구와 목록 확인 링크
- 새로고침/뒤로 가기 후 최신 목록·집계
- 5개 상태의 한국어 표시와 수정일, 긴 프로젝트명 및 작은 화면 줄바꿈
- 20개 이상일 때 이전/다음 pagination
- 프로젝트 열기가 준비 중이며 미구현 화면으로 이동하지 않는지

## 제외 범위

Product 정보 입력, Product Facts 작성 UI, Image Upload, AI API, Asset Analysis,
Page Planner, Section Engine, Detail Editor, Renderer, Auth, Marketplace,
Wholesale crawler, 신규 DB migration과 기존 schema 변경.