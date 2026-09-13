# Tasks

현재 작업 범위와 TASK 문서를 둔다.

## 현재 단계

PHASE 2 / TASK-009 — Product AI Analysis.

상태: 구현 및 검증 완료(전체 테스트 93개와 필수 검사 통과).
사용자 터미널에서 0002 적용/Local·Remote 일치/linked 타입 생성을 확인했다.
실제 OpenAI 1회와 원격 저장·불변식·브라우저 복원·실패 보호·stale 검증 및 테스트 데이터 정리 완료.
브랜치: `feat/product-ai-analysis`. Git commit 미실행.

- Product Facts / 완료된 이미지 관찰 / 미검증 설명을 F/V/S evidence로 분리
- 텍스트 전용 상품 전략 분석, strict schema와 실제 근거 ID 재검증
- 서버 evidenceSnapshot과 canonical SHA-256 fingerprint로 입력 변경 감지
- products.ai_analysis 저장용 additive migration 1개, attempt와 latestResult 분리
- 상품 분석 화면, 재분석/실패 보호, coverage/stale 안내, 기존 Facts/raw_data 보호

상세 범위·한계·검증과 수동 UI 확인 항목은 [TASK-009](./TASK-009.md)를 참고한다.
이전 단계: [TASK-008](./TASK-008.md), [TASK-007](./TASK-007.md), [TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-010 Fact Validation은 상품 전략을 사실 근거로 승격하지 않고 Facts/source_snapshot을 별도로 검증한다.
최종 hero 선택, Page Planner, Section 생성은 이번 단계에 없다. 동기 분석의 중단/비용 제어 한계는 TASK-008/009에 기록한다.
현재 MVP는 single-user/local-development assumption이다. 공개 배포 전에
Auth + owner_id + 사용자별 Storage/RLS와 서버 진입점의 인증/소유권 검증이 필요하다.
보상 처리는 transaction을 대신하지 않으며 Product/Facts 위험은 TASK-006, Storage/Asset 위험은 TASK-007에 기록한다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 `AGENTS.md`와 관련 `docs/`를 확인한다.
