# Database

## 목적

Product Facts, Assets, Sections, Page Draft의 저장 구조를 정의한다.

## 공급자와 접근 방식

PostgreSQL과 private Storage를 제공하는 Supabase를 사용한다. 초기 MVP의 DB 접근은
Next.js 서버의 service role client로 제한한다. Browser client, Auth, 사용자별 RLS
policy는 이번 단계에 포함하지 않는다.

## Entity 관계

```text
projects (1) ── (1) products ── (1) product_facts
    │                  └─────── (*) assets
    └────── (1) detail_pages ── (*) sections
```

`assets.project_id`와 `assets.product_id`는 각각 FK이지만, MVP에서는 두 값의 조합을
검사하는 복합 FK를 두지 않는다. 애플리케이션에서 같은 Project의 Product인지
검증한다.

## 테이블

### projects

상세페이지 제작 작업의 루트 Aggregate다. MVP 상태는 `draft`, `analyzing`,
`generated`, `editing`, `completed`다.

### products

Project당 하나만 존재한다. 정규화된 기본 상품정보와 입력 출처를 저장한다.
`raw_data`는 수동 입력 또는 향후 Adapter가 전달한 원본 Source Data를 손실 없이
보존하는 JSONB다.

TASK-006 수동 입력은 `source_type = manual`로 저장한다. project_id UNIQUE 기준으로
없으면 INSERT, 있으면 UPDATE하며 Product id를 유지한다. 선택 필드의 빈 값은 일반
컬럼에서는 null로 저장한다. manual raw_data는 Zod 검증 후 trim과 완전히 빈 스펙 행 제거를
적용한 입력 snapshot이다. 사용자가 제공하지 않은 내용을 추가하지 않으며 원본 문자의
앞뒤 공백까지 보존하는 형식은 아니다.

```json
{
  "inputMethod": "manual",
  "productName": "상품명",
  "brand": "",
  "category": "",
  "description": "사용자 제공 설명",
  "sourceUrl": "",
  "specifications": [{ "name": "재질", "value": "ABS" }]
}
```

선택 필드는 raw_data 안에서는 일관된 빈 문자열로 유지한다. 초기 schema 기본값인 `{}`는
스펙 없는 기존 상품으로 읽을 수 있으나, 그 외 알 수 없는 원본 JSON은 조용히 무시하지 않고
조회 오류로 처리한다. 상세 검증 규칙은 `src/features/products/schemas.ts`에 있다.

### product_facts

Product당 하나만 존재하며 검증된 사실정보의 Source of Truth다. `facts`와 이를
검증할 때 사용한 `source_snapshot`을 분리해 저장한다. `version`은 후속 확장을 위해
유지하지만 이번 MVP에서는 별도 history나 immutable version 구조를 만들지 않는다.

TASK-006에서는 product_id UNIQUE 기준으로 생성/갱신하고 기존 id와 version을 유지한다.
신규 version은 1이다. facts에는 productName, 값이 있는 brand/category, 완전한
specifications(name/value)만 저장한다. 빈 선택값, 설명, URL은 Facts로 복사하지 않는다.
description은 사용자 제공 문구이며 검증된 사실이라고 가정하지 않는다.
source_snapshot에는 해당 저장의 manual raw_data를 그대로 복사한다.

수동 저장은 AI Fact validation이 아니므로 validated_at은 null로 둔다. 기존 검증 시각이
있어도 입력 갱신 시 null로 해제한다. products/Facts는 별도 요청이며 Facts 실패 시
신규 Product 정리 또는 기존 Product 복원으로 보상한다. 복구 실패/중단 시 부분 상태가
남을 수 있다는 한계는 Architecture와 TASK-006 문서에 기록한다. schema/migration은 변경하지 않는다.

### assets

private Storage 파일의 `storage_path`, 원본 파일명, 크기와 분류 등 메타데이터를
저장한다. TASK-007은 기존 `product-assets` private bucket과 assets 구조만 사용한다.

- 경로: `projects/{projectId}/products/{productId}/{serverUuid}.{jpg|png|webp}`.
  원본 filename은 경로 식별자로 사용하지 않는다. 확장자는 검증된 MIME으로 결정한다.
- `original_filename`: 경로 부분과 제어문자를 제거하고 NFC 정규화한 표시용 이름.
- `project_id`, `product_id`: 서버에서 Project/Product의 관계를 확인하여 저장한다.
- `mime_type`, `size_bytes`: 서버가 검사한 MIME과 실제 읽은 바이트 수.
- `asset_type = unclassified`, `metadata = {}`, `width/height = null`. AI 추측이나 이미지 변환은 하지 않는다.
- `sort_order`: 기존 최대값 + 1, 최초 0. 삭제 시 재번호를 매기지 않는다.
  조회는 `sort_order ASC, created_at ASC, id ASC`로 안정적인 순서를 유지한다.
- DB에는 경로만 저장하며 signed URL은 저장하지 않는다. 미리보기 URL은 300초 후 만료된다.
- 기존 개별 FK는 Project/Product 조합이나 경로 소속을 보장하지 않으므로 서버가 이를 검증한다.
  상품당 30개 제한과 순서 생성은 애플리케이션 규칙이며 다중 프로세스 DB 제약은 아니다.
- Storage/DB의 부분 실패 처리와 파일 먼저 삭제하는 전략의 한계는 TASK-007을 참고한다.

#### TASK-008 AI metadata

기존 `metadata.aiAnalysis`에 schemaVersion 1의 analyzing/completed/failed 상태를 저장한다.
completed에는 시각적 결과와 provider/model/attemptId/analyzedAt을 둔다. analyzing/failed는
startedAt과 이전 성공 한 개(previousResult)를 보관하고 실패 시 failedAt/errorCode를 추가한다.
다른 metadata key는 보존하며 조건부 UPDATE로 경쟁하는 분석 결과를 덮어쓰지 않는다.

성공 결과의 confidence가 0.65 이상이면 role을 asset_type에 저장하고 미만이면 unclassified로
저장한다. AI role에는 hero가 없으며 기존 DB enum은 변경하지 않는다. 실패 시 기존 분류를 유지한다.
signed URL과 API key는 저장하지 않는다. Product Facts나 기존 schema/migration은 변경하지 않는다.
전체 결과 schema와 상태 전이는 `04_AI_PIPELINE.md`를 참고한다.

### detail_pages

Project당 하나의 상세페이지 구성과 기본 너비, 테마 및 설정을 저장한다.

### sections

DetailPage를 구성하는 핵심 rendering abstraction이다. `type`과 `sort_order`로 종류와
순서를 표현하고 `content`, `style` JSONB로 Section별 가변 데이터를 저장한다. 필요한
Asset ID도 `content` 안에서 관리하며 별도 연결 테이블은 두지 않는다.

## JSONB 원칙

원본 데이터와 Section별 가변 구조는 요구사항 변화가 잦아 JSONB로 시작한다. 모든
JSONB 값은 object 형태만 허용하며, 외부 입력과 DB에서 읽은 값은 애플리케이션
경계에서 런타임 검증한다. 검색과 관계 무결성이 필요한 값은 일반 컬럼과 FK로 둔다.

## 이름 규칙

DB table과 column은 `snake_case`, Application Domain 필드는 `camelCase`를 사용한다.
현재 `database.types.ts`는 initial migration에 맞춘 수동 최소 타입이다. Remote DB에
migration을 적용한 뒤 다음 명령으로 생성 타입을 교체한다.

```bash
npx supabase gen types typescript --linked --schema public > src/lib/supabase/database.types.ts
```

## RLS와 Storage

6개 public table 모두 RLS를 활성화하며 `anon`, `authenticated` policy를 만들지 않고
해당 role의 table 권한도 제거한다. service role은 RLS를 우회하므로 key를 가진 서버
코드가 접근 통제의 경계다. `product-assets` bucket은 private으로 생성하며 anonymous
Storage policy는 추가하지 않는다.

Auth 도입 시 `owner_id`, `auth.users` 관계와 사용자별 RLS policy를 별도 migration으로
설계한다.

## Migration 운영

초기 스키마는 `supabase/migrations/0001_initial_schema.sql`에 둔다. Remote DB에 적용된
migration은 수정하지 않고 새 migration을 추가한다. 적용 전에는 SQL diff와 대상
Project를 확인하고, Supabase Project를 link한 뒤 `npx supabase db push`로 적용한다.
