# Tasks

## 현재 단계

PHASE 4 / TASK-015 — Individual Section AI Regeneration.
브랜치: `feat/section-ai-regeneration`. 구현·자동 테스트·실제 DB/브라우저 검증 완료. Git commit 없음.
추가 dependency/migration 없음. 상세 정책·파일·검증·한계는 [TASK-015](./TASK-015.md)에 기록한다.

- 단일 Section AI 후보 생성, 현재/새 문구 비교, 명시적 적용/기존 내용 유지.
- 10분 서명된 후보, 생성 시 DB write 없음, 적용 시 기존 page lease와 revision CAS.
- supported-only grounding, 최신 Plan/Validation, stale 전략 제외, 원본 이미지/Vision 전송 없음.
- style/현재 이미지/Hero 수동 선택/spec 행/type/Plan/order/상위 근거/다른 Section 불변.
- manualEdit history 유지, dirty/중복/이탈 guard, 409 후보 보존, private 오류/timeout.

기존 249 + 신규 37 = 286개 자동 테스트 통과. next typegen/tsc/lint/build/diff 검사 통과.
실제 OpenAI 1회 후보 생성 성공 후 버리기. 별도 mock transport로 브라우저 적용/reload/버리기,
두 탭 충돌/실패/수동 경고/dirty 차단/375px/키보드를 검증했다.
비밀키 검사와 fixture DB/Storage 정리 최종 기록은 TASK-015를 따른다.

이전 단계: [TASK-014](./TASK-014.md), [TASK-013](./TASK-013.md), [TASK-012](./TASK-012.md), [TASK-011](./TASK-011.md), [TASK-010](./TASK-010.md),
[TASK-009](./TASK-009.md), [TASK-008](./TASK-008.md), [TASK-007](./TASK-007.md),
[TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

후속 Renderer의 구체 범위는 별도 요청에 따른다. 후속 기능은 전체 ID/revision, 기존 lease와 두 recovery journal을 존중한다.
기존 content/style PATCH에서는 type/order를 변경할 수 없다. 순서 변경은 전용 endpoint만 사용한다.
Renderer는 Plan 순서 대신 현재 sort_order와 복구 조회 경계를 사용한다. 미적용 후보는 export 대상이 아니다.
현재는 single-user/local-development MVP다. 공개 배포 전 인증/owner_id/사용자별 RLS·Storage와 비용 제어가 필요하다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 AGENTS.md와 관련 docs를 확인한다.
