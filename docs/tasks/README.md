# Tasks

## 현재 단계

PHASE 4 / TASK-014 — Section Reorder.
브랜치: `feat/section-reorder`. 구현·자동 테스트·실제 DB/브라우저 검증 완료. Git commit 없음.
추가 dependency/migration 없음. 상세 정책·파일·검증·한계는 [TASK-014](./TASK-014.md)에 기록한다.

- Navigator native drag/위·아래 버튼, orderDraft와 Preview 즉시 동기화, 명시적 순서 저장·되돌리기.
- content OR order dirty 이탈 guard, 문구 dirty 이동 확인, 409와 최신 재조회, 실패 시 draft 보존.
- 전체 ID/revision 검증, sort_order-only CAS, 기존 page lease와 Planner/재생성 조정.
- 지속 write intent/순서 snapshot, 부분 실패 보상 복구, 복구 실패 시 journal 유지와 편집 차단.
- Plan은 원본 설계, sort_order는 현재 순서. settings.editor.manualOrder merge와 재생성 경고.
- grounding/content/style/type/상위 근거/Project status 보존, stale Plan에서 수동 reorder 허용, 실제 AI 호출 0회.

기존 224 + 신규 25 = 249개 자동 테스트 통과. next typegen/tsc/lint/build/diff 검사 통과.
production client JS/map 21개와 src에서 실제 비밀키 검출 0건. 검증용 DB 잔여 0건, Storage 생성 없음.
브라우저에서 저장·reload·되돌리기·문구 guard·두 탭 충돌·375px·키보드·stale·재생성 경고를 검증했다.
native 포인터 drag와 브라우저별 native 이탈 경고 표시는 사람이 추가 확인한다.

이전 단계: [TASK-013](./TASK-013.md), [TASK-012](./TASK-012.md), [TASK-011](./TASK-011.md), [TASK-010](./TASK-010.md),
[TASK-009](./TASK-009.md), [TASK-008](./TASK-008.md), [TASK-007](./TASK-007.md),
[TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-015의 구체 범위는 별도 요청에 따른다. 후속 기능은 전체 ID/revision, 기존 lease와 두 recovery journal을 존중한다.
기존 content/style PATCH에서는 type/order를 변경할 수 없다. 순서 변경은 전용 endpoint만 사용한다.
Renderer는 Plan 순서 대신 현재 sort_order와 복구 조회 경계를 사용한다. export/개별 AI 재생성은 별도 단계다.
현재는 single-user/local-development MVP다. 공개 배포 전 인증/owner_id/사용자별 RLS·Storage와 비용 제어가 필요하다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 AGENTS.md와 관련 docs를 확인한다.
