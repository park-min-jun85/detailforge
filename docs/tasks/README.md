# Tasks

## 현재 단계

PHASE 4 / TASK-013 — Detail Editor Foundation.
브랜치: `feat/detail-editor`. 구현·자동 테스트·실제 DB/브라우저 검증 완료. Git commit 없음.
추가 dependency/migration 없음. 상세 정책·파일·검증·한계는 [TASK-013](./TASK-013.md)에 기록한다.

- Navigator / 860px live Preview / Property Inspector, 10종 Section, 375px 패널 탭.
- 문구/기존 상품 이미지/bounded style 편집과 명시적 저장, draft/dirty/이탈 guard.
- type/order/Planner provenance 불변, 사실값 read-only, 문구 수정 manualEdit/needs_review.
- updated_at CAS와 409, generation journal와 page edit lease 조정, 실패 시 draft 보존.
- stale Plan에서도 수동 편집 허용, 빈 상태 CTA, Facts/Analysis/Plan/Asset/Project status 보존.
- Editor와 모든 검증에서 실제 AI 호출 없음. 기존 private Storage helper 사용.

기존 189 + 신규 35 = 224개 자동 테스트 통과. next typegen/tsc/lint/build/diff 검사 통과.
클라이언트 JS/map 20개와 소스에서 실제 비밀키 검출 0건. 검증용 DB 행/Storage 파일 정리 후 잔여 0건.

이전 단계: [TASK-012](./TASK-012.md), [TASK-011](./TASK-011.md), [TASK-010](./TASK-010.md),
[TASK-009](./TASK-009.md), [TASK-008](./TASK-008.md), [TASK-007](./TASK-007.md),
[TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-014 Reorder: 별도 순서 변경 계약과 전체 revision, generation journal/manual lease 조정을 설계한다.
현재 Editor PATCH에서는 type/order를 변경할 수 없다. 새로운 Renderer/export, AI 개별 재생성은 별도 단계다.
현재는 single-user/local-development MVP다. 공개 배포 전 인증/owner_id/사용자별 RLS·Storage와 비용 제어가 필요하다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 AGENTS.md와 관련 docs를 확인한다.
