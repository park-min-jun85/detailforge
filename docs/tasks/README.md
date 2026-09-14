# Tasks

현재 작업 범위와 TASK 문서를 둔다.

## 현재 단계

PHASE 2 / TASK-010 — Fact Validation.

상태: 구현·자동 테스트·실제 provider/원격 저장·UI 검증 완료. Migration dry-run 내역 추가 확인 대기.
사용자가 0003 적용, Local/Remote 0001·0002·0003 일치, linked 타입 재생성을 확인했다.
전체 123개 테스트와 필수 검사 통과. 실제 OpenAI 1회 성공, 원격 보호 불변식/실패 보존/stale 확인 및 검증 데이터 정리 완료.
브랜치: `feat/fact-validation`. Git commit 미실행. 추가 dependency 없음.

- 기존 Product Facts와 source_snapshot을 보존하는 별도 validation JSONB 저장
- supported / insufficient / conflict / needs_review의 Fact별 일관성 평가
- 전략/가설을 근거에서 제외하고 시각 관찰·과거 snapshot을 참고 자료로 제한
- strict schema, 원본 값 일치/근거 ID 검증, fingerprint/stale, 재검증 실패 후 이전 성공 보존
- 상품 분석 후 검증 화면, 현재 값과 검증 당시 값 구분, Fact 자동 수정 기능 없음

상세 범위·한계·검증과 수동 UI 확인 항목은 [TASK-010](./TASK-010.md)를 참고한다.
이전 단계: [TASK-009](./TASK-009.md), [TASK-008](./TASK-008.md), [TASK-007](./TASK-007.md), [TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-011은 최신 fingerprint와 개별 검증 상태를 소비하는 정책을 정해야 한다.
supported는 외부 진위 증명이 아니며 conflict/needs_review/insufficient를 확인된 사실로 사용하지 않는다.
최종 hero 선택, Page Planner, Section 생성은 이번 단계에 없다. 동기 분석의 중단/비용 제어 한계는 TASK-008~010에 기록한다.
현재 MVP는 single-user/local-development assumption이다. 공개 배포 전에
Auth + owner_id + 사용자별 Storage/RLS와 서버 진입점의 인증/소유권 검증이 필요하다.
보상 처리는 transaction을 대신하지 않으며 Product/Facts 위험은 TASK-006, Storage/Asset 위험은 TASK-007에 기록한다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 `AGENTS.md`와 관련 `docs/`를 확인한다.
