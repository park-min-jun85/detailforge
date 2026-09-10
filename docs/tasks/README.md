# Tasks

현재 작업 범위와 TASK 문서를 둔다.

## 현재 단계

PHASE 0 / TASK-004 — App Shell과 Navigation.

상태: 구현 및 필수 검사 완료, 사람의 최종 UI 확인 대기. Git commit 미실행.
작업 브랜치: `feat/app-shell`.

- Dashboard, Projects, Templates, Settings의 네 route
- 공통 Sidebar + Top Header + Main Content
- 경로 기반 active navigation, 기본 responsive 처리와 접근성
- placeholder 요약값과 empty state (DB 연결 없음)

상세 구현과 검사 결과는 [TASK-004](./TASK-004.md)를 참고한다.
기존 데이터 계층 작업은 [TASK-003](./TASK-003.md)에 기록되어 있다.

## 후속 작업

TASK-005에서 프로젝트 조회/생성 기능을 연결한다.
TASK-004에서는 Supabase CRUD, 프로젝트 생성, 상품 입력, 이미지 업로드,
AI API, Page Planner, Section Engine, Detail Editor, Authentication,
Wholesale crawler, Marketplace를 구현하지 않는다.
기존 Supabase 구조를 변경하거나 DB migration을 추가하지 않는다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 `AGENTS.md`와 관련 `docs/`를 확인한다.