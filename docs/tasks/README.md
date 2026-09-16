# Tasks

## 현재 단계

TASK-018 — Wholesale Product URL Import.
브랜치: `feat/wholesale-url-import`. Preview-first/사용자 확인 저장/선택 이미지 Import 구현. Git commit 없음.
parse5 8.0.1 추가, 기존 Playwright 재사용, migration 없음. 상세 파일·정책·검증은 [TASK-018](./TASK-018.md).

- Generic Adapter: JSON-LD → metadata → product DOM → 필요한 경우 Chromium.
- DNS/사설 IP 차단·연결 IP 고정·redirect 재검증·크기/시간 제한.
- Product/Facts CAS·보상 저장과 Asset 업로드 재사용. 원본 provenance 보존, imported Asset=unclassified.
- 실제 공개 테스트 상품 UI/DB/Storage/새로고침, 내부 주소 및 로그인 차단 검증. AI 호출 없음.
- 기존332 + 신규30 = 전체362 tests, typegen/tsc/lint/build/diff 검사 통과. 실제 Chromium fallback과 secret 검사 완료, fixture 정리.

## 완료된 TASK-017 기반

- 기존 Final Render Surface만 PNG/JPG로 캡처, 저장된 canonical 입력만 사용.
- 실제 긴 스펙 포함 PNG/JPG 860×7155px 검증. private no-store attachment.
- trusted origin, image/font readiness, 75초 timeout, 크기 제한, server-only provider.
- 전체332 tests/typegen/typecheck/lint/build 통과, DB 변경·AI 호출 없음, fixture 정리.

## 완료된 TASK-016 기반

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

TASK-018로 URL 후보 확인·상품 저장·이미지 가져오기를 연결했다. 후속 특정 도매사이트 Adapter·cloud browser 배포·대형 페이지 분할·공개 운영은 별도 요청에 따른다.
후속 기능은 전체 ID/revision, 기존 lease와 두 recovery journal을 존중한다.
기존 content/style PATCH에서는 type/order를 변경할 수 없다. 순서 변경은 전용 endpoint만 사용한다.
Renderer는 Plan 순서 대신 현재 sort_order와 복구 조회 경계를 사용한다. 미적용 후보는 export 대상이 아니다.
현재는 single-user/local-development MVP다. 공개 배포 전 인증/owner_id/사용자별 RLS·Storage와 비용 제어가 필요하다.

## 규칙

- 현재 TASK 범위를 벗어난 대규모 리팩터링을 하지 않는다.
- 작업 시작 전에 AGENTS.md와 관련 docs를 확인한다.
