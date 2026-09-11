# Tasks

현재 작업 범위와 TASK 문서를 둔다.

## 현재 단계

PHASE 1 / TASK-007 — Product Image Upload.

상태: 구현 및 검사 완료. 실제 Supabase 다중 업로드/미리보기/삭제 확인 및 원격 테스트 데이터 정리 완료.
사람의 최종 UI 확인 대기. 브랜치: `feat/asset-upload`. Git commit 미실행.

- 상품정보 저장 → 이미지 route → 여러 이미지 선택/업로드/목록/삭제
- 기존 private Storage와 assets 연결, 임시 signed URL 미리보기
- 파일당 10MiB/상품당 30개, MIME·시그니처·소속·경로 검증
- 순차 업로드, 파일별 부분 성공/실패, Storage/DB 실패 보상
- 기존 App Shell, Product/Facts 저장, Supabase schema 유지

상세 범위·한계·검증은 [TASK-007](./TASK-007.md)를 참고한다.
이전 단계: [TASK-006](./TASK-006.md), [TASK-005](./TASK-005.md), [TASK-004](./TASK-004.md), [TASK-003](./TASK-003.md).

## 다음 단계와 운영 전제

TASK-008에서 저장된 원본 Asset을 바탕으로 AI Asset Analysis를 설계한다. TASK-007에는 AI 실행 기능이 없다.
현재 MVP는 single-user/local-development assumption이다. 공개 배포 전에
Auth + owner_id + 사용자별 Storage/RLS와 서버 진입점의 인증/소유권 검증이 필요하다.
보상 처리는 transaction을 대신하지 않으며 Product/Facts 위험은 TASK-006, Storage/Asset 위험은 TASK-007에 기록한다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 `AGENTS.md`와 관련 `docs/`를 확인한다.
