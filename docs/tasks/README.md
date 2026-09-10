# Tasks

현재 작업 범위와 TASK 문서를 둔다.

## 현재 단계

PHASE 1 / TASK-006 — Product Information.

상태: 구현 및 검사 완료. 실제 Supabase 생성/수정과 브라우저 값 유지 확인 완료.
사람의 최종 UI 확인 대기. 브랜치: `feat/product-input`. Git commit 미실행.

- Projects/Dashboard 최근 프로젝트 → 상품정보 상세 route
- 상품 기본 정보와 스펙 행 입력·저장·수정
- Zod 검증, manual raw_data와 Product Facts snapshot
- Product/Facts UNIQUE 기반 create/update와 실패 시 보상 처리
- 기존 App Shell, Project 상태, Supabase schema 유지

상세 범위·한계·검증 데이터는 [TASK-006](./TASK-006.md)를 참고한다.
이전 단계: [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-007에서 이미지 업로드와 Asset 연결을 구현한다. TASK-006에는 업로드 기능이 없다.
현재 MVP는 single-user/local-development assumption이다. 공개 배포 전에
Auth + owner_id + 사용자별 RLS와 서버 진입점의 인증/소유권 검증이 필요하다.
두 테이블 저장의 보상 처리는 DB transaction을 대신하지 않으며 잔여 위험은 TASK-006에 기록한다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 `AGENTS.md`와 관련 `docs/`를 확인한다.