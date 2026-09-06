# Coding Rules

## 목적

DetailForge 코드 작성 시 지켜야 할 기술 규칙을 모은다.

## 데이터 경계

- Supabase service role client는 `src/lib/supabase/server.ts`에서만 생성한다.
- service role을 사용하는 모듈에는 `server-only` 경계를 유지한다.
- service role key를 Client Component, 응답 payload, 오류 메시지, 로그에 포함하지 않는다.
- Browser에서 Supabase에 직접 접근하는 코드는 Auth와 RLS가 설계되기 전까지 만들지 않는다.

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
