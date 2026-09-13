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

## ADR-008

**Asset AI 분석은 시각적 관찰로 분리하고 기존 metadata에 저장**

- Status: Accepted
- Date: 2026-09-13

OpenAI Responses API의 strict Structured Outputs를 사용하고 서버에서 Zod로 재검증한다.
private Asset은 소속을 확인한 뒤 임시 signed URL로 전달한다. 모델과 키는 서버 config에서만 관리한다.

AI output은 untrusted visual observation이며 Product Facts를 수정하지 않는다. heroSuitability는
보조 점수이고 hero는 이 단계에서 확정하지 않는다. confidence 0.65 이상일 때만 role을
asset_type에 적용하고 나머지는 unclassified로 저장한다.

결과와 상태는 기존 metadata.aiAnalysis에 저장한다. 다른 key를 보존하고 재분석 실패 시
이전 성공 결과를 유지한다. migration과 queue 없이 동기 MVP로 시작하며 중단된 작업의 지속 실행,
다중 인스턴스 전체 동시 호출 제한, 정확히 한 번 과금은 보장하지 않는다.

## ADR-009

**상품 AI 전략을 Facts와 분리하고 근거 snapshot/fingerprint로 추적**

- Status: Accepted
- Date: 2026-09-13

Product Facts는 Source of Truth이며 Product Analysis는 전략적 해석이다. F/V/S registry로
사실/시각 관찰/미검증 설명을 구분하고, AI의 모든 evidenceId를 서버가 재검증한다.
분석 당시의 evidenceSnapshot과 canonical SHA-256 fingerprint를 서버에서 생성해 보관한다.
입력이 달라지면 stale을 표시하며 자동 유료 재분석은 하지 않는다.

완료된 Asset 관찰을 재사용하여 원본 이미지 재전송과 Vision 비용 중복을 피한다.
기존 products에 JSON object 제약을 가진 ai_analysis 컬럼 하나만 추가한다.
attempt와 latestResult를 분리해 재분석 실패 시 마지막 성공을 보존한다.
Facts/raw_data/Project status를 쓰지 않으며 Fact Validation은 TASK-010에서 별도 설계한다.
