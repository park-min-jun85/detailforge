# Tasks

## 현재 단계

PHASE 3 / TASK-012 — Section Engine.
브랜치: `feat/section-engine`. 구현·자동 테스트·실제 OpenAI/DB 저장·UI 검증 완료. Git commit 미실행.
추가 dependency와 migration 없음. 상세 목록/정책/한계/검증은 [TASK-012](./TASK-012.md)에 기록했다.

- 최신 Page Plan과 1:1 key/type/order/count에 대응하는 실제 Section 콘텐츠 저장.
- supported-only Fact grounding, 원문 specification equality, Section별 evidence/Asset subset, Hero 준수.
- 10종 discriminated content schema, 서버 기본 bounded style, raw CSS/HTML 금지.
- provenance와 실제 Plan 결과 fingerprint, stale/생성 차단, 명시적 재생성 확인.
- 기존 row snapshot의 DB journal과 실패 보상, AI 없는 중단 복구. cross-row transaction은 아니다.
- Facts/Validation/Product Analysis/Plan/Asset 및 Project status 보존.

기존 156 + 신규 33 = 189개 자동 테스트 통과. typegen/typecheck/lint/build/diff 검사 통과.
실제 Section OpenAI 1회 성공, 5개 행의 순서/재조회/원본 불변, provider 실패 및 DB commit 실패 보상 확인.
검증 전용 데이터 정리 완료. DB는 0001~0004 그대로이며 migration list/type 재생성 작업은 필요하지 않았다.

이전 단계: [TASK-011](./TASK-011.md), [TASK-010](./TASK-010.md), [TASK-009](./TASK-009.md),
[TASK-008](./TASK-008.md), [TASK-007](./TASK-007.md), [TASK-006](./TASK-006.md),
[TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

Editor/Renderer는 Sections content/style/provenance와 generation journal 조회 경계를 사용한다.
Plan stale과 restricted Fact 정책을 유지하고 개별 편집/재생성/동시 수정/원자적 교체를 별도 설계한다.
현재는 single-user/local-development MVP다. 공개 배포 전 인증/owner_id/사용자별 RLS·Storage와 비용 제어가 필요하다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 AGENTS.md와 관련 docs를 확인한다.
