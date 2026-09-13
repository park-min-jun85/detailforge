# Tasks

현재 작업 범위와 TASK 문서를 둔다.

## 현재 단계

PHASE 2 / TASK-008 — Asset AI Analysis.

상태: 구현 및 검사 완료. Mock provider와 실제 Supabase를 조합한 저장/브라우저 검증 및 테스트 데이터 정리 완료.
OPENAI_API_KEY 미설정으로 실제 provider 호출 미검증. 사람의 최종 UI 확인 대기.
브랜치: `feat/asset-ai-analysis`. Git commit 미실행.

- private Asset → 임시 signed URL → 서버 OpenAI Responses API → strict schema 검증
- 이미지별 순차 분석, 상태/분류/신뢰도/대표 이미지 적합도 표시
- metadata.aiAnalysis 저장, 낮은 confidence는 미분류, hero 자동 지정 금지
- 재분석 실패 시 이전 성공 보존, 오래된 분석 재시도, 조건부 DB 저장
- 기존 이미지 업로드, Product Facts, Supabase schema 유지

상세 범위·한계·검증은 [TASK-008](./TASK-008.md)를 참고한다.
이전 단계: [TASK-007](./TASK-007.md), [TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-009 Product Analysis는 Product Facts와 untrusted visual observation을 구분해서 사용한다.
최종 hero 선택, Page Planner, Section 생성은 이번 단계에 없다. 동기 분석의 중단/비용 제어 한계는 TASK-008에 기록한다.
현재 MVP는 single-user/local-development assumption이다. 공개 배포 전에
Auth + owner_id + 사용자별 Storage/RLS와 서버 진입점의 인증/소유권 검증이 필요하다.
보상 처리는 transaction을 대신하지 않으며 Product/Facts 위험은 TASK-006, Storage/Asset 위험은 TASK-007에 기록한다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 `AGENTS.md`와 관련 `docs/`를 확인한다.
