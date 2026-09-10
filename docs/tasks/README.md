# Tasks

현재 작업 범위와 TASK 문서를 둔다.

## 현재 단계

PHASE 1 / TASK-005 — 프로젝트 생성·조회 및 Dashboard 실제 데이터 연결.

상태: 구현 및 필수 검사 완료. 실제 Supabase 생성/조회 확인 완료.
사람의 최종 UI 확인 대기. 작업 브랜치: `feat/project-crud`. Git commit 미실행.

- Server Action 기반 프로젝트명 검증 및 projects INSERT
- Projects 목록: 수정일 내림차순, 한국어 상태와 수정일, 20개 단위 pagination
- Dashboard: 전체/작업 중/완료 집계 및 최근 5개
- 생성 중 중복 제출 방지, 성공 안내, 입력/조회/저장 오류 처리
- 기존 App Shell과 Supabase schema 유지

상세 범위와 검증 결과는 [TASK-005](./TASK-005.md)를 참고한다.
이전 단계는 [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md)에 기록되어 있다.

## 운영 전제와 제외 범위

현재 MVP는 single-user/local-development assumption이다.
외부 공개 배포 전에 Auth + owner_id + 사용자별 RLS와 Server Action 접근 검증이 필요하다.

이번 단계에서는 Product 입력, Product Facts 작성 UI, Image Upload, AI API,
Asset Analysis, Page Planner, Section Engine, Detail Editor, Renderer,
Auth, Marketplace, Wholesale crawler, 새로운 DB migration을 구현하지 않는다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 `AGENTS.md`와 관련 `docs/`를 확인한다.