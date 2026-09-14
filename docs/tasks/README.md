# Tasks

## 현재 단계

PHASE 3 / TASK-011 — Page Planner.
브랜치: `feat/page-planner`. 구현·자동 테스트·실제 provider/원격 저장·UI 검증 완료. Git commit 미실행.
추가 dependency 없음. 상세 정책/파일/한계/검증 기록은 [TASK-011](./TASK-011.md)을 참고한다.

- supported Facts만 주장 근거로 사용하며 제한된 Fact와 상품 전략은 별도로 취급한다.
- 최신 Fact Validation을 확인하고 stale Product Analysis를 제외한다.
- 완료 이미지 관찰과 Plan 단위 Hero 선택. Asset type은 변경하지 않는다.
- `detail_pages.plan`에 설계도와 provenance/attempt/latestResult 저장. Sections는 생성하지 않는다.
- 입력 fingerprint/stale, 실패 후 이전 성공 보존, 근거/Asset 소속 검증.
- 검증 → 페이지 설계 이동, 읽기 전용 Section 순서·목적·지침·근거·이미지 화면.

0004 단독 적용, Local/Remote 0001~0004 일치와 linked 타입 재생성은 사용자가 확인했다.
원격 plan 저장/재조회는 에이전트가 확인했다. dry-run 성공 출력은 전달받지 않아 성공으로 기록하지 않았다.
기존 123 + 신규 33 = 156개 테스트, 필수 검사 통과. 실제 Planner OpenAI 1회 성공(6개 Section, Hero null).
실제 upstream 불변/실패 보존/stale·실행 차단을 확인하고 검증 전용 데이터를 정리했다.

이전 단계: [TASK-010](./TASK-010.md), [TASK-009](./TASK-009.md), [TASK-008](./TASK-008.md),
[TASK-007](./TASK-007.md), [TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md),
[TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-012 Section Engine은 최신 Plan과 근거/Asset 소속을 다시 확인한 뒤 실제 Section 콘텐츠를 만든다.
supported는 외부 진위 증명이 아니며 restricted Fact나 시각 관찰/전략을 사실로 승격하지 않는다.
현재는 single-user/local-development MVP다. 공개 배포 전 Auth + owner_id + 사용자별 Storage/RLS,
서버 인증/소유권 확인과 비용 제어가 필요하다. 동기 실행/보상 처리 한계는 각 TASK 문서에 기록한다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 `AGENTS.md`와 관련 `docs/`를 확인한다.
