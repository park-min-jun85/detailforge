# Tasks

## 현재 단계

PHASE 5 / TASK-016 — Final Detail Renderer Foundation.
브랜치: `feat/detail-renderer`. 구현·자동 테스트·실제 DB/브라우저 검증 완료. Git commit 없음.
추가 dependency/migration 없음. 상세 정책·파일·검증·한계는 [TASK-016](./TASK-016.md)에 기록한다.

- /projects/[projectId]/render와 독립 article capture boundary.
- 저장된 canonical content/style/sort_order/width만 사용. draft/orderDraft/candidate 제외.
- 10종 Section과 bounded CSS를 Editor/Final이 공유. 기본 실제 폭 860px, final zoom 없음.
- 현재 Product 참조 이미지만 임시 서명, Hero 선택 유지, contain/cover/누락 fallback.
- stale/readiness는 검토 UI에만 표시. 생성/복구 중에는 final busy 안내. AI/DB mutation 없음.

기존 286 + 신규 26 = 312개 자동 테스트 통과. next typegen/tsc/lint/build/diff 검사 통과.
실제 DB에 편집·reorder한 10종 Section/이미지 2개로 860px, Desktop/375px,
긴 문구/spec/style/이미지/순서와 미저장 편집 제외를 검증했다. OpenAI 호출 0회.
비밀키 검사와 fixture DB/Storage 정리 최종 기록은 TASK-016을 따른다.

이전 단계: [TASK-015](./TASK-015.md), [TASK-014](./TASK-014.md), [TASK-013](./TASK-013.md), [TASK-012](./TASK-012.md), [TASK-011](./TASK-011.md), [TASK-010](./TASK-010.md),
[TASK-009](./TASK-009.md), [TASK-008](./TASK-008.md), [TASK-007](./TASK-007.md),
[TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-017 Export의 구체 범위는 별도 요청에 따른다. 캡처는 ready surface와 이미지/font 준비를 확인한 후 진행한다.
후속 기능은 전체 ID/revision, 기존 lease와 두 recovery journal을 존중한다.
기존 content/style PATCH에서는 type/order를 변경할 수 없다. 순서 변경은 전용 endpoint만 사용한다.
Renderer는 Plan 순서 대신 현재 sort_order와 복구 조회 경계를 사용한다. 미적용 후보는 export 대상이 아니다.
현재는 single-user/local-development MVP다. 공개 배포 전 인증/owner_id/사용자별 RLS·Storage와 비용 제어가 필요하다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 AGENTS.md와 관련 docs를 확인한다.
