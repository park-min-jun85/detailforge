# Architecture Decisions

프로젝트의 확정된 기술/도메인 결정을 기록한다. 새 결정은 `ADR-XXX`로 추가한다.

## ADR-001

**Next.js App Router + TypeScript 사용**

- Status: Accepted
- Date: 2026-09-05

App Router와 TypeScript를 기본 스택으로 사용한다. Pages Router를 도입하지 않는다.

## ADR-002

**MVP에서는 npm 사용**

- Status: Accepted
- Date: 2026-09-05

패키지 매니저는 npm으로 고정한다. 이 단계에서 pnpm, yarn, bun으로 전환하지 않는다.

## ADR-003

**상세페이지의 핵심 모델은 Section 기반**

- Status: Accepted
- Date: 2026-09-05

상세페이지는 하나의 긴 이미지가 아니라 Section들의 조합으로 관리한다. 편집, 생성, 렌더링의 단위는 Section이다.

## ADR-004

**Product Facts가 사실정보 Source of Truth**

- Status: Accepted
- Date: 2026-09-05

인증, 재질, 크기, 성능, 효과 등 사실정보는 Product Facts에만 근거한다. AI가 사실정보를 임의로 만들지 않으며, 마케팅 문구와 분리한다.

## ADR-005

**도매사이트 연동은 Adapter Architecture 사용**

- Status: Accepted
- Date: 2026-09-05

도매사이트별 차이는 Adapter 계층에서 처리한다. 특정 오픈마켓 로직이 Core Domain에 침투하지 않게 한다. MVP에서는 자동 크롤링을 구현하지 않는다.

## ADR-006

**MVP Supabase 접근은 서버 전용으로 제한**

- Status: Accepted
- Date: 2026-09-05

초기 MVP에서는 Next.js 서버의 service role client만 Supabase에 접근한다. Browser
client와 Auth policy는 사용자 소유권 모델이 확정된 후 도입한다. 모든 public table은
RLS를 활성화하고 `anon`, `authenticated` 허용 policy를 만들지 않는다.

## ADR-007

**초기 MVP에서 ORM을 사용하지 않음**

- Status: Accepted
- Date: 2026-09-05

초기 데이터 모델은 Supabase SQL migration과 `@supabase/supabase-js`로 관리한다.
Prisma나 Drizzle은 추가하지 않으며, 실제 요구가 생기면 별도 결정으로 검토한다.
