# PHASE 1 / TASK-006 — Product Information

## 상태

구현 및 검사 완료. 실제 Supabase와 브라우저 저장/수정/새로고침 확인 완료.
사람의 최종 UI 확인 대기. 브랜치: `feat/product-input`. Git commit 미실행.

## Route와 UI

- Projects 및 Dashboard의 열기 링크 → `/projects/[projectId]`
- UUID 검증과 Project 존재 확인, 없는 Project는 not-found 및 목록 복귀 안내
- Project 이름/상태, 상품정보→이미지→AI 분석→상세페이지 안내
- 상품명 필수, 브랜드/카테고리/설명/원본 URL 선택
- 스펙 항목명/값 최대 50행, 추가/삭제와 행별 accessible label
- 같은 폼에서 생성/수정, 기존 값 채우기, 진행/성공/오류 상태 제공
- 저장 중 폼과 버튼 비활성화 및 동기 중복 제출 잠금
- 실제 이미지 업로드와 미래 route는 구현하지 않음

## 생성 파일

- `src/app/projects/[projectId]/page.tsx`
- `src/app/projects/[projectId]/not-found.tsx`
- `src/features/products/actions.ts`
- `src/features/products/queries.ts`
- `src/features/products/persistence.ts`
- `src/features/products/schemas.ts`
- `src/features/products/mappers.ts`
- `src/features/products/types.ts`
- `src/features/products/components/product-form.tsx`
- `src/features/projects/components/project-status.tsx`
- `tests/products.test.mjs`
- `tests/products-persistence.test.mjs`
- `tests/helpers/product-db.mjs`
- 이 문서

## 수정 파일

- `src/features/projects/components/project-list.tsx`
- `src/app/globals.css`
- `docs/02_ARCHITECTURE.md`
- `docs/03_DATABASE.md`
- `docs/05_UI_UX.md`
- `docs/tasks/README.md`

Dependency 추가와 기존 Supabase client/Domain/DB type/schema/migration 변경은 없다.

## 입력 검증과 데이터

Zod 서버 검증: 상품명 trim 후 1~200자, 브랜드/카테고리 각 100자,
설명 5,000자, URL 2,048자 및 http/https 절대 주소. 선택값은 생략 가능하다.
스펙은 50개 이하, 항목명 100자, 값 500자. trim 후 양쪽 모두 빈 행은 제거한다.
한쪽만 빈 행은 행/필드별 오류를 반환한다.

products에는 project_id UNIQUE 기준으로 없으면 INSERT, 있으면 기존 id로 UPDATE한다.
source_type은 manual, 일반 컬럼의 빈 선택값은 null이다. raw_data는 다음 필드를 갖는
Zod 검증된 JSON snapshot이다:

- inputMethod: manual
- productName, brand, category, description, sourceUrl
- specifications: name/value 배열

trim과 완전히 빈 스펙 행 제거를 적용하며 추측한 정보는 추가하지 않는다.
description과 URL은 raw_data/source_snapshot에 보존한다.
facts에는 productName, 값이 있는 brand/category, 완전한 specifications만 넣는다.
빈 문자열이나 설명/URL을 검증된 사실로 복사하지 않는다.

product_facts는 product_id UNIQUE 기준으로 생성/갱신한다. 신규 version은 1,
기존 version과 id는 유지한다. source_snapshot은 이번 저장 raw_data와 동일하다.
validated_at은 수동 입력을 AI 검증으로 오해하지 않도록 null로 유지/해제한다.
Project의 status와 updated_at은 변경하지 않는다.

## 서버 경계와 부분 실패

Browser → Server Action → 서버 전용 persistence → Supabase 구조다.
UI에 Supabase query를 흩뿌리지 않고 DB row를 검증한 뒤 camelCase Domain/Form 값으로 바꾼다.

1. Project 존재, 기존 Product/Facts, 폼 revision을 확인한다.
2. Product를 저장한다. 기존 상품은 updated_at 비교 조건으로 변경 충돌을 검사한다.
3. Facts를 저장한다. 기존 Facts에도 updated_at 비교 조건을 사용한다.
4. 쓰기 응답이 실패하면 재조회해서 실제 저장되었는지 먼저 확인한다.
5. Facts가 이전 상태 그대로인 실패라면 신규 Product는 id/updated_at 조건으로 삭제하거나
   기존 Product 내용을 같은 조건으로 복원한다. 복원 결과 revision을 폼에 전달한다.
6. 다른 쓰기 감지, 재조회 실패, 보상 실패는 recovery-required로 반환한다.
   저장 성공을 표시하지 않고 폼을 잠근 뒤 다시 열어 저장 내용을 확인하도록 안내한다.

같은 서버 프로세스의 같은 Project에 대해서는 동시 저장을 거부한다.
그러나 이것은 **best-effort 보상 처리이며 ACID transaction이 아니다**.
프로세스 종료, 장기 네트워크 장애, 여러 서버 프로세스의 동시 요청에서는 부분 상태가
남을 수 있고 두 쓰기 사이에 중간 상태가 읽힐 수 있다. 잘못된 복구로 다른 내용을
덮어쓰거나 삭제하는 것보다 재확인 안내를 우선한다. 엄격한 atomicity는 후속
transaction/RPC 설계가 필요하며 이번 TASK에서는 migration/RPC를 추가하지 않는다.

현재 single-user/local-development 전제를 유지한다.
공개 배포 전에 Auth + owner_id + 사용자별 RLS와 서버 인증/소유권 검증이 필요하다.
내부 DB 오류나 service role key는 UI/응답/로그로 출력하지 않는다.

## 검사 결과

- `npx next typegen`: 통과
- `npx tsc --noEmit`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과, 동적 상품정보 route 포함
- `git diff --check`: 통과
- 최종 클라이언트 JS 번들 검사: 현재 service role key 미검출
- `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`: 24개 통과

기존 TASK-005 테스트 6개와 TASK-006 테스트 18개를 실행한다.
추가 패키지 없이 Node 24 내장 테스트/TypeScript 실행과 로컬 모의 PostgREST를 사용한다.
기존 MODULE_TYPELESS_PACKAGE_JSON 경고는 테스트 실행에 영향이 없다.

검증 범위:

- 필수/선택 필드 trim, 길이 경계, URL protocol, 스펙 완전성/개수
- raw_data/Facts 정규화, DB→Domain→Form 값 채우기
- create/update 판단, 중복 Product 방지, version/id 유지, validated_at 해제
- 신규 Facts 실패의 Product 정리, 기존 Facts 실패의 Product 복원과 재시도
- 보상 실패/다른 쓰기/오래된 폼 처리
- 쓰기 후 응답 유실 재조회, 동일 프로세스 중복 저장 차단
- 잘못된/존재하지 않는 Project, DB 오류 비공개
- 기존 Dashboard 집계/목록 테스트 회귀 없음

## 실제 Supabase 및 브라우저 확인

기존 `테스트` Project의 빈 상품정보에서 검증했으며 새 Project는 만들지 않았다.

- Project id: `a76fbab2-a542-44f4-8330-c9f54a35a48c`
- Product id: `baecc21d-a7da-48b4-b227-fabfe82eed7f`
- ProductFacts id: `d94a7c7f-16e8-4c23-86a1-183ebea281bb`
- 남긴 상품명: `TASK-006 검증용 센서등 (수정)`
- 설명에 기능 검증용이며 실제 판매용 정보가 아님을 명시
- Product/Facts 각각 1개, 생성 후 수정해도 id 동일, version 1, validated_at null
- raw_data와 source_snapshot 일치, 삭제한 스펙이 재조회에서도 제거됨
- Project status는 draft 유지, Asset/DetailPage 생성 없음

브라우저에서 목록→열기→불완전 스펙 오류→저장→새로고침→수정→재저장→새로고침의
값 유지를 확인했다. 스펙 행 추가/삭제, 저장 중 입력/버튼 비활성화, 성공 안내,
Desktop/375px 화면과 가로 넘침 없음, 잘못된 ID/없는 UUID 안내를 확인했다.
실제 DB에서 장애를 유발하지 않았으며 부분 실패는 로컬 모의 DB에서 검증했다.

## 사람이 확인할 UI

- Tab/Shift+Tab, 키보드 스펙 행 추가/삭제 및 입력란 오류 안내
- 50개 스펙과 긴 설명/URL에서 스크롤과 줄바꿈
- 여러 탭에서 오래된 폼 저장 시 다시 열기 안내
- 저장 결과 불명확/복구 실패 시 폼 잠금과 안내가 이해되는지
- 프로젝트 상세에서 목록/대시보드로 복귀하는 흐름

## TASK-007로 넘길 사항

저장된 Project/Product 관계와 상품정보를 바탕으로 이미지 업로드,
private Storage와 Asset record 연결, 업로드 상태 및 오류 UX를 설계한다.
현재 단계 표시의 이미지 항목은 안내용이며 실제 route가 아니다.

## 제외 범위

DB migration, Image/Storage Upload, Asset 생성, AI API/AI Fact validation,
Asset Analysis, Page Planner, Section Engine, Editor, Renderer, Auth,
Marketplace, Wholesale crawler, Product options system.
