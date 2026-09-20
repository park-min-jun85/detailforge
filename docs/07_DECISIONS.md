# Architecture Decisions

## ADR-015 — 내부 RC와 추출 파일의 동일성

- Status: Accepted for local/internal MVP
- Date: 2026-09-20

TASK-032에서 실제 새 A 상품 E2E와 B canonical replay/C 제한 옵션 검증을 구분한다. 성공한 내부 RC를 Auth/owner_id/user RLS/Storage policy 없는 공개 배포 승인으로 확대하지 않는다.

추출 candidate의 의미 역할은 AI 재분석으로 바뀔 수 있다. 실제 파일 재사용은 parent/source bytes hash/sourceRect로 결정하며 기존 candidateId/provenance/분석은 그대로 둔다. 기존 source lease와 검증 경계를 재사용하고 migration이나 기존 row 일괄 정리는 하지 않는다. 동일 rect의 여러 후보는 UI·서버에서 한 신규 슬롯으로 계산한다.

Product 저장 후에는 서버 props만 refresh해 옵션 source 상태를 최신화한다. 동일 Product의 옵션 draft를 hard reload로 버리지 않는다. 관련 회귀와 제한은 [TASK-032](tasks/TASK-032.md).

## ADR-014 — Application-owned commerce visual system

- Status: Accepted
- Date: 2026-09-19

기존 bounded style schemaVersion1을 유지하고 이미지 intrinsic 크기·항목 수에 따른 deterministic presentation mode는 application runtime에서만 계산한다. AI가 CSS/색/px를 작성하거나 DB에 raw style을 저장하지 않는다. Shared SectionRenderer/CSS가 Editor/Final/Export의 유일한 표현 계층이다.

새 generation defaults에는 sequence/confirmed option count를 사용하지만 saved style이 항상 우선이다. CSS token mapping 개선은 intentional renderer-system update이므로 기존 페이지 외관은 달라질 수 있으며 DB migration/자동 재저장은 하지 않는다. 새 무의미한 스타일 선택만 validation하고 unchanged legacy 조합은 호환한다. 실제 Fact/옵션 원문 및 사진 bytes와1.5배 cap을 보존한다. [TASK-029](tasks/TASK-029.md).

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

## ADR-010

**Section Engine은 기존 JSONB와 지속 복구 journal로 생성 세트를 교체**

- Status: Accepted for single-user local MVP
- Date: 2026-09-14

Planner는 구조를 정하고 Section Engine은 해당 key/type/order에 대응하는 실제 콘텐츠를 만든다.
Sections content/style은 Editor/Renderer의 원본이며 style은 서버의 제한된 enum 기본값이다. raw CSS/HTML은 저장하지 않는다.

추가 migration/RPC 대신 detail_pages.settings.sectionGeneration에 기존 row snapshot과 새 staged rows를 보관한다.
전체 응답을 검증한 뒤 새 세트를 batch INSERT하고 기존 행의 ID/revision을 조건으로 삭제한 뒤 완료를 기록한다.
GET은 생성/복구 중 backup을 표시한다. 실패하면 누락된 기존 행을 복원하고 이번 실행의 새 행을 지운다.
복구 성공 후 journal snapshot을 비우며 복구 실패/프로세스 중단 시에는 보관하고 명시적 복구를 제공한다.

이는 ACID all-or-nothing transaction이 아니다. 직접 sections를 읽으면 staging 세트가 함께 보일 수 있다.
조건부 쓰기/CAS는 전역 분산 lock이나 미래 Editor 동시 수정의 완전한 보호를 대신하지 않는다.
알 수 없는 변경은 덮어쓰지 않고 복구 필요로 남긴다. 엄격한 원자성/다중 작성자가 필요한 단계에서
DB RPC/transaction 또는 generation-set 테이블/active pointer를 별도 migration으로 설계해야 한다.
이번 TASK에서 이를 위한 migration을 만들거나 push하지 않는다.

## ADR-011

**수동 순서는 Plan과 분리하고 기존 lease·지속 intent journal로 보상 저장한다**

- Status: Accepted for single-user local MVP
- Date: 2026-09-15

Page Plan은 원본 AI 설계이며 수동 표시 순서는 sections.sort_order다. 전체 ID와 모든 updated_at을
검증한 후 서버에서 canonical 0..N-1을 계산한다. 순서 변경은 content/style/grounding/상위 근거를 바꾸지 않는다.
실제 DB에 sort_order UNIQUE가 없음을 전용 fixture로 확인했다. 기존 page edit lease를 Planner까지 조정하고
settings.sectionReorder에 원래 순서·revision·불변 row hash/current/pending intent를 저장한다.
응답 유실은 재조회로 확인하고 부분 실패는 sort_order만 복구한다. 복구 불가이면 journal/편집 차단을 유지한다.
수동 순서 provenance는 settings.editor.manualOrder에 merge하며 다른 journal을 덮어쓰지 않는다.
완료된 재생성의 새 ID 집합에는 이전 marker를 적용하지 않고 재생성 확인에서 초기화 가능성을 안내한다.

local orderDraft/명시적 저장/실패 시 draft 보존을 사용한다. 기존 content dirty guard를 OR order dirty로 확장한다.
stale Plan에서도 수동 순서 저장을 허용한다. AI 호출과 migration/RPC는 추가하지 않는다.
이는 여러 row의 ACID 저장이 아니며 직접 DB 변경/장기 worker 정지까지 강한 원자성을 보장하지 않는다.
엄격한 다중 작성자 요구가 생기면 별도 승인된 transaction/RPC 설계를 진행한다. 상세 복구 계약은 TASK-014를 따른다.

## ADR-012

**개별 Section AI 재생성은 서명된 임시 후보와 명시적 content-only CAS 적용으로 분리한다**

- Status: Accepted for single-user local MVP
- Date: 2026-09-15

AI 호출 중 DB write/긴 lease를 하지 않는다. 10분 후보를 서버 HMAC으로 서명하고 Client state로만 유지한다.
기존 서버 전용 service-role key에서 별도 용도의 서명 키를 파생하므로 새 비밀 변수/테이블/migration은 필요 없다.
명시적 적용 시 서명·소속·입력 fingerprint·기준 전체 row hash·revision을 재검사하고 기존 page lease 뒤 CAS 갱신한다.
현재 style/이미지/Plan/type/order를 보존하고 content만 교체한다. manualEdit history와 Planner provenance를 지우지 않는다.
stale Plan/Validation을 차단하고 stale 전략은 제외한다. 기존 schema/grounding을 재사용하며 Vision은 호출하지 않는다.
후보 서명은 변조 방지 수단이며 사용자 인증이나 자연어 의미 보증은 아니다. 분산 lock/transaction 한계는 기존 ADR을 따른다.
상세 계약은 [TASK-015](tasks/TASK-015.md)에 기록한다.

## ADR-013

**최종 Renderer는 canonical read model과 Editor 공유 표현을 사용하고 Export와 분리한다**

- Status: Accepted for single-user local MVP
- Date: 2026-09-15

DB 저장 content/style/sort_order/width가 final source다. Planner 순서나 Editor draft/candidate는 사용하지 않는다.
Editor와 Final의 Section JSX/CSS를 공유하며 선택/클릭/zoom은 wrapper에만 둔다.
review route 하나와 명시적인 article capture boundary를 제공해 root App Shell 변경이나 중복 route를 피한다.
generation/reorder journal/활성 edit lease 중에는 중간 row/backup을 final로 오인하지 않도록 busy로 처리한다.
Renderer GET은 복구나 DB write를 하지 않으며 stale 경고는 capture boundary 밖에 둔다.
이미지는 참조한 현재 Product Asset만 임시 서명한다. 고정 frame/contain/cover/fallback으로 안정적으로 표시한다.
서명 URL이 만료되면 새 조회가 필요하며 OS별 system font의 픽셀 차이는 향후 Export 환경 고정으로 다룬다.
이번 단계는 브라우저 표현까지이고 PNG/JPG 캡처·파일 생성·도구 선정은 TASK-017 책임이다.
