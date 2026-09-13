# Coding Rules

## 목적

DetailForge 코드 작성 시 지켜야 할 기술 규칙을 모은다.

## 데이터 경계

- Supabase service role client는 `src/lib/supabase/server.ts`에서만 생성한다.
- service role을 사용하는 모듈에는 `server-only` 경계를 유지한다.
- service role key를 Client Component, 응답 payload, 오류 메시지, 로그에 포함하지 않는다.
- Browser의 Supabase DB/Storage 변경 SDK는 Auth와 RLS 설계 전까지 만들지 않는다.
  서버가 발급한 단기 signed URL로 비공개 이미지 원본을 표시하는 읽기만 허용한다.

## 이미지 업로드 경계 (TASK-007)

- 바이너리는 Route Handler에 한 파일씩 전달하며 실제 스트림 크기를 제한한다.
- MIME, 크기, 기본 파일 시그니처를 서버에서 재검증한다. 시그니처 검사는 전체 이미지 디코딩 검증이 아니다.
- 표시 파일명과 서버 UUID Storage 경로를 분리하고, 파일 경로를 사용자가 지정하게 하지 않는다.
- Asset 조회/서명/삭제 전에 Project/Product 소속과 DB 경로의 상품별 prefix를 검사한다.
- signed URL은 5분 만료로 발급하고 DB에 저장하거나 로그에 남기지 않는다. API 응답은 no-store이다.
- INSERT 실패 보상과 삭제 부분 실패를 처리하고 실제 원격 검증 파일/레코드는 검증 후 정리한다.
- 브라우저 origin은 요청 Host와 대조한다. NextURL의 loopback 정규화만 신뢰하지 않는다.
- 인증 없는 로컬 단일 사용자 전제다. 외부 공개 전에 Auth + owner_id + 사용자별 Storage/RLS가 필요하다.

## 이미지 AI 경계 (TASK-008)

- OpenAI SDK/config/service는 server-only로 유지하고 키를 클라이언트, metadata, 오류, 로그에 전달하지 않는다.
- 고정 developer 정책과 비신뢰 상품 데이터/이미지를 분리한다. 이미지 속 지시를 실행 정책으로 취급하지 않는다.
- Structured Outputs의 strict schema와 서버 Zod 재검증을 함께 사용한다. 자유 텍스트를 JSON으로 추측 복구하지 않는다.
- 시각적 관찰로 Product Facts를 생성/수정하거나 hero를 자동 지정하지 않는다.
- metadata의 다른 key와 재분석 이전 성공을 보존한다. 늦은 결과는 attemptId와 조건부 저장으로 거부한다.
- provider는 60초 제한과 자동 재시도 0회를 적용한다. DB 저장 재시도가 AI 재호출로 이어지지 않게 한다.
- 자동 테스트는 mock provider/transport를 사용한다. 실제 API 검증 여부와 테스트 데이터 정리를 별도로 기록한다.

## 타입과 검증

- DB row의 `snake_case`와 Domain의 `camelCase`를 구분한다.
- 외부 입력, `raw_data`, Facts, Section의 `content`와 `style`을 신뢰하지 않고 데이터
  접근 경계에서 런타임 검증한다.
- 가능한 경우 `any` 대신 `unknown`에서 검증을 시작한다.
- 수동 `Database` 타입은 migration과 함께 갱신하며, Remote DB 적용 후 Supabase CLI
  생성 타입으로 교체한다.

## Migration

- DB Schema는 Dashboard에서 직접 수정하지 않고 migration으로 변경한다.
- 이미 적용된 migration을 고치지 않고 후속 migration을 추가한다.
- FK, CHECK, index는 현재 조회와 무결성 요구에 필요한 최소 범위로 유지한다.

## 검증

변경 후 `npx tsc --noEmit`, `npm run lint`, `npm run build`를 실행한다. DB 실행 환경이
준비되지 않은 TASK에서는 SQL을 정적으로 검토하고 실제 적용 여부를 완료 보고에
명시한다.
