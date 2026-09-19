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

#### TASK-009 products.ai_analysis

`0002_add_product_ai_analysis.sql`은 products에 `ai_analysis jsonb NOT NULL DEFAULT '{}'::jsonb`와
JSON object CHECK만 추가한다. 새 테이블, 데이터 삭제, 타입 변경, RLS 변경은 없다.

초기 `{}`는 미분석이다. 분석 후에는 schemaVersion 1, attempt(status/runId/startedAt/finishedAt/errorCode),
latestResult(provider/model/analyzedAt/inputFingerprint/evidenceSnapshot/analysis)를 저장한다.
attempt와 마지막 성공을 분리하여 재분석 중/실패 시 latestResult를 유지한다.
evidenceSnapshot과 inputFingerprint는 서버가 생성하며 AI가 생성하지 않는다.

상품 분석은 ai_analysis만 쓰고 기존 updated_at trigger는 그대로 둔다. raw_data와 product_facts의
facts/source_snapshot/validated_at, Project status는 변경하지 않는다. inputFingerprint에는 updated_at을
넣지 않으므로 분석 상태 저장 자체로 stale이 되지 않는다. 기존 상품정보의 UPDATE/보상은 ai_analysis를 보존한다.
원격 적용/생성 타입 검증 상태는 `tasks/TASK-009.md`에 기록한다.

### product_facts

Product당 하나만 존재하며 입력된 사실정보의 Source of Truth다. 외부 진위가 검증됐음을 뜻하지 않는다. `facts`와 이를
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

#### TASK-010 product_facts.validation

`0003_add_fact_validation.sql`은 `validation jsonb NOT NULL DEFAULT '{}'::jsonb`와
`jsonb_typeof(validation) = 'object'` CHECK 하나만 추가한다. 기존 RLS와 다른 컬럼/데이터는 유지한다.

초기 `{}`는 미검증이다. 실행 후 schemaVersion/attempt/latestResult를 저장한다.
latestResult에는 schemaVersion, 전체 status, inputFingerprint, validatedAt, counts, warnings,
provider/model, evidenceSnapshot, Fact별 factId/label/value/status/confidence/evidenceIds/reason을 둔다.
상태는 supported/insufficient/conflict/needs_review이며 실패한 실행은 이전 latestResult를 보존한다.

검증은 validation만 갱신한다. 기존 `validated_at`은 외부 진위 검증으로 오해되지 않도록 건드리지 않으며
이번 실행 시각은 JSON 내부 `validatedAt`에만 저장한다. 기존 trigger에 의한 `updated_at` 변경은 유지한다.
수동 Fact 저장도 validation을 초기화하지 않아 이전 결과를 보존하며 현재 입력과 fingerprint가 다르면 stale이다.
원본 facts/source_snapshot/version, products.ai_analysis를 AI가 변경하지 않는다.

사용자가 0003 적용, Local/Remote 0001·0002·0003 일치, linked 타입 재생성을 확인했다.
생성 타입과 원격 읽기/저장 검증 및 migration 절차 기록은 `tasks/TASK-010.md`를 참고한다.

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
`database.types.ts`는 linked DB 생성 타입을 기준으로 관리한다. Remote DB에
migration을 적용한 뒤 다음 명령으로 생성 타입을 교체하며 성공한 출력만 파일에 반영한다.

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

## TASK-011 DetailPage Plan

0004_add_detail_page_plan.sql은 public.detail_pages에 plan JSONB NOT NULL DEFAULT '{}'와
jsonb_typeof(plan) = 'object' CHECK만 추가한다. 테이블/기존 데이터/RLS 변경이나 destructive SQL은 없다.
기존 project_id UNIQUE로 Project당 하나의 기본 DetailPage를 유지한다. 신규 페이지 폭은 860이다.

plan은 schemaVersion=1, attempt(planning/completed/failed, runId, startedAt, finishedAt, errorCode),
latestResult(provider, model, plannedAt, inputFingerprint, evidenceSnapshot, factPolicySnapshot,
assetSnapshot, strategySnapshot, plan) 구조다. 최초에는 {}이며 실패한 재계획도 이전 latestResult를 보존한다.
JSON object CHECK는 전체 스키마 검증이 아니므로 애플리케이션 Zod 재검증이 필요하다.
Sections row는 생성/수정하지 않는다. 실제 콘텐츠 저장은 TASK-012에서 수행한다.

2026-09-14 사용자가 0004만 push, Local/Remote 0001·0002·0003·0004 일치, linked 타입 재생성을 확인했다.
에이전트는 생성 타입의 plan Row/Insert/Update 매핑과 실제 원격 plan 저장/재조회를 검증했다.
파일만 작성한 후 dry-run을 요청했으나 제공된 답변은 실제 push 완료 보고이므로 dry-run 성공 출력은 확인하지 못했다.
원격 push를 에이전트가 재실행하지 않았다.

## TASK-012 Section materialization

새 migration은 없다. 기존 sections의 id/detail_page_id/type/sort_order/content/style/created_at/updated_at을 사용한다.
기존 type CHECK, JSON object CHECK, DetailPage FK와 RLS를 유지한다. 별도 UNIQUE sort_order 제약은 없다.

content는 type별 실제 문구와 evidenceIds/assetIds, meta를 가진다. meta에는 schemaVersion=1, plannerKey,
sourcePlanFingerprint, sourceInputFingerprint, generationId, generatedAt, provider/model, origin=generated, warnings를 저장한다.
style은 layout/textAlign/density/background/emphasis/imageFit의 enum object이며 자유 CSS는 없다. signed URL은 저장하지 않는다.

Plan의 section 순서를 sort_order=0..N-1로 저장한다. 재생성은 새 UUID 세트를 사용하고 이전 행을 제거한다.
향후 Editor는 성공 재생성 때 Section id가 바뀔 수 있다는 점과 plannerKey/generationId를 구분해야 한다.

기존 detail_pages.settings.sectionGeneration에 schemaVersion/runId/status/startedAt/finishedAt/errorCode/backup/staged를 저장한다.
status는 generating/completed/failed/recovery_required다. backup은 기존 원본 row snapshot, staged는 검증된 새 row 세트다.
settings의 다른 key와 plan/width/status/theme은 유지한다. 완료나 복구 성공 후 backup/staged를 비워 history로 남기지 않는다.
실패 복구에 필요한 snapshot은 DB에 지속 보관한다. 임의 수동 변경은 덮어쓰지 않는다.

최대 기존 50행/새 12행과 journal 전체 크기 600,000자 제한을 둔다. 동기 호출/복구 중 프로세스 종료와
다중 서버 경쟁은 transaction으로 보장되지 않는다. 직접 테이블 조회자는 stage 상태를 볼 수 있다.
정확한 보상 순서/한계는 TASK-012와 ADR-010을 참고한다.

2026-09-14 실제 linked DB에서 columns 읽기, 잘못된 type/content/style의 CHECK(23514),
없는 DetailPage FK(23503)를 확인했다. 실제 5행 저장/순서/재조회와 commit 실패 후 snapshot 복원도 검증했다.

## TASK-013 수동 Section 편집

Migration/RPC/database.types.ts 변경 없음. 기존 sections.content/style JSONB와 updated_at trigger를 사용한다.
PATCH는 content/style만 UPDATE하고 Section id/type/sort_order와 생성 provenance를 유지한다.
content.meta에 선택적으로 manualEdit={edited:true,editedAt,textEdited,assetsEdited}, groundingStatus=needs_review를 둔다.
텍스트 변경만 needs_review를 부여하며 스타일 변경은 기존 상태를 유지한다. Asset 변경 이력도 별도로 기록한다.
공통 sectionMetaSchema는 기존 생성 행과 수동 편집 행 모두 읽을 수 있다. signed URL을 저장하지 않는다.

기존 detail_pages.settings.sectionEdit에 {id,startedAt} 임시 쓰기 lease를 저장한다.
page.updated_at CAS로 재생성 journal claim과 경쟁을 조정하고 저장 후 최신 settings와 merge하여 제거한다.
실패/프로세스 중단으로 남은 lease는 3분 후 만료된다. 기존 sectionGeneration journal을 덮어쓰거나 복구 snapshot을 지우지 않는다.
이 저장은 새 migration이나 DB transaction이 아니며 강한 원자성/다중 작성자 설계는 후속 단계다.
Project/DetailPage status, Facts/source_snapshot/Validation/Analysis/Plan/Asset 데이터는 수동 편집이 변경하지 않는다.

## TASK-014 수동 Section 순서

새 migration/RPC/타입 재생성 없음. 기존 sections.sort_order와 updated_at trigger를 재사용한다.
2026-09-15 linked DB의 검증용 Section 두 행에 동일 sort_order를 저장한 후 원복하여 UNIQUE 부재를 확인했다.
0001의 sections_detail_page_id_sort_order_idx는 일반 index다. offset 없이 순차 저장하고 최종 0..N-1을 검증한다.

Page Plan 순서는 초기 설계이고 sections.sort_order가 현재 표시 순서다. 전체 ID/revision을 검증한 후
기존 page edit lease와 row CAS로 sort_order만 바꾼다. content/style/type/meta/grounding은 불변이다.
settings.sectionReorder는 원래 순서/revision/불변 row SHA-256, 현재 revision, pending write intent를 보관한다.
부분 실패 시 sort_order만 복구한다. rollback도 updated_at을 갱신하므로 클라이언트에 최신 revision을 제공한다.
복구 실패 시 journal 유지/편집 차단/명시적 복구를 사용한다. 직접 DB 읽기에 중간 순서가 노출될 수 있는 보상 처리다.

settings.editor.manualOrder={edited:true,editedAt,runId,sourcePlanFingerprint,orderedSectionIds}를 merge한다.
fingerprint는 기존 Section의 공통 원본 Plan fingerprint이며 혼합이면 null이다. 최신 Plan으로 덮어쓰지 않는다.
settings의 다른 key/sectionGeneration/editor 속성을 최신 page CAS merge로 보존한다.
전체 재생성으로 Section UUID 집합이 바뀌면 이전 manualOrder는 현재 순서로 판단하지 않는다.
Facts/source_snapshot/Validation/Analysis/Plan/Asset 및 Project·DetailPage status는 변경하지 않는다.

## TASK-015 — 개별 AI 후보 적용

migration/column/table/RPC/RLS 변경 없음. 후보는 DB에 저장하지 않고 서명된 10분 응답과 Client state로 유지한다.
적용은 기존 sections.updated_at CAS와 settings.sectionEdit lease를 재사용하며 content만 UPDATE한다.
content.meta.regeneration에 regenerated/regeneratedAt/provider/model/generationId/previousRevision을 추가한다.
기존 manualEdit와 초기 Planner/생성 provenance는 유지한다. 성공한 새 grounding 검증은 기존 needs_review marker를 해제한다.
id/type/plannerKey/sourcePlanFingerprint/sort_order/style/assetIds와 settings.editor.manualOrder를 보존한다.
Facts/source_snapshot/Validation/Analysis/Plan/Project status/다른 Sections는 변경하지 않는다.
lease 관리에 따른 detail_pages.updated_at 변화는 가능하지만 Plan/settings의 기존 내용은 유지한다.
상세 동시성/응답 유실 정책은 [TASK-015](tasks/TASK-015.md)를 따른다.

## TASK-018 — Wholesale URL 원본

Migration/RLS/컬럼/DB 타입 변경 없음. Preview는 DB/Storage 저장 없이 만료되는 process ticket으로만 보관한다.
명시적 확인 저장 시 products.source_type=wholesale_url, source_url=상품 URL을 기록한다.
raw_data/source_snapshot은 confirmed Product fields와 provenance(sourceUrl/sourceHost/fetchedAt/importedAt/extractionMethod/importedImageUrls/extracted)를 보존한다. HTML은 저장하지 않는다.
provenance.extracted는 원래 추출 후보, Facts는 사용자가 확인한 상품명·브랜드·카테고리·스펙이다. 설명은 Facts에 들어가지 않는다.
importedImageUrls는 선택한 URL 목록이며 성공 이력 테이블이 아니다. 실제 성공한 Asset의 metadata.source에 type/url/pageUrl/importedAt을 기록한다.
Asset은 기존 private product-assets UUID 경로와 asset_type=unclassified를 사용한다. 기존 metadata/AI 결과는 보존한다.
동일 source URL 재Import는 기존 row를 재사용한다. Content hash/DB unique 제약을 통한 다중 서버 중복 방지는 없다.
TASK-006 Product/Facts 보상과 TASK-007 파일별 Storage cleanup을 그대로 따른다. [TASK-018](tasks/TASK-018.md).

## TASK-019 — 원본과 Facts 정규화

Migration/컬럼/RLS/type 변경 없음. 수동·Import 확인 저장 모두 `toManualFacts`에서 placeholder spec pair와 optional brand/category를 제외한다.
raw_data/source_snapshot의 confirmed input과 provenance.extracted의 원래 후보에는 placeholder를 보존한다. value:null pair를 만들지 않는다.
사용자가 실제 값으로 수정하면 최종 값은 Facts에 들어가고 원래 추출값은 provenance에 남는다. 상품 설명은 계속 source에만 저장한다.
실제 값끼리의 충돌은 삭제·병합하지 않는다. 기존 Facts는 읽기만으로 변경되지 않으며 다음 명시적 저장에 적용한다.
analysis/validation JSON과 기존 CAS/보상 정책은 유지한다. 상세 규칙/실제 DB 검증은 [TASK-019](tasks/TASK-019.md).

## TASK-020 — product_options

0005는 product_id UNIQUE/FK cascade를 가진 Options 테이블을 추가한다. UUID PK/default와 timestamps는 기존 convention, updated_at은 기존 helper trigger를 재사용한다.
groups는 `{schemaVersion:1,groups:[{id,name,values:[{id,label}]}]}` JSON object, source_snapshot은 원문 출처 object다. DB는 두 object CHECK와 version>0만 검사하고 상세 bounds는 앱 Zod에서 검증한다.
RLS 활성화, anon/authenticated revoke, service_role grant. 신규 허용 policy 없음. 원격 적용 여부는 TASK-020 migration 기록을 따른다.
Options는 Product당 최대1행이며 version0은 미생성 read model, INSERT1/UPDATE+1 CAS를 사용한다. 그룹/값 삭제는 JSON 배열 수정이고 모두 삭제해도 빈 groups row와 revision을 유지한다.
수동 snapshot은 현재 제출의 inputMethod/manual·schemaVersion·원문 groups이며 placeholder가 남을 수 있다. confirmed groups만 실제 선택값이다.
옵션 저장은 products/raw_data/product_facts/Validation/Analysis/Assets에 쓰지 않는다. 가격/재고/SKU 조합/이력 테이블은 없다. [TASK-020](tasks/TASK-020.md).

TASK-021B는 migration 없이 기존 source_snapshot에 `domeme_api` source를 지원한다. supplier/productNo/sourceUrl/API 버전/조회시각/fingerprint/최소 원본 groups/UUID bindings를 서버가 구성한다.
이후 수동 수정도 해당 source를 보존하며 confirmed groups와 원본이 분리된다. legacy manual/빈 객체/wholesale_url도 읽는다. 최신 원본100값, 삭제 보호 매핑200값 상한이며 전체 응답/HTML/무제한 history는 저장하지 않는다.
조회/후보 반영은 쓰기0회. 명시적 저장에서 groups/source_snapshot/version을 같은 row의 product_id/version 조건 UPDATE 또는 UNIQUE INSERT로 처리한다. 소속 검사는 사용자 인증을 대신하지 않는다. [TASK-021B](tasks/TASK-021B.md).

## TASK-022 JSON snapshot (migration 없음)

product_options 및 0005는 변경하지 않았다. detail_pages.plan.latestResult.optionsSnapshot에 확정 source를 저장한다. sections.content의 option은 기존 items 또는 신규 optionSnapshot 중 하나다. 신규 snapshot은 source=confirmed_options, appliedAt, confirmed(schemaVersion/policyVersion/productId/rowId/version/state/groups/fingerprint)를 보존한다. 기존 meta/manualEdit/grounding은 유지한다.
내용 hash는 row ID와 canonical groups를 포함하고 version/시각/source metadata를 제외한다. missing row와 saved empty groups는 별개다. 반영 POST는 selected section content만 revision 조건으로 UPDATE하며 원본 Options/Facts/Plan을 변경하지 않는다. GET legacy rewrite 및 일괄 변환 없음. 동시성 한계/후속 stale는 [TASK-022](./tasks/TASK-022.md).

## TASK-024 Source / Derived Asset (migration 없음)

기존 assets.metadata JSONB와 product-assets private bucket을 사용한다. Source row의 width/height가 null이어도 decoder로 작업 크기를 구하며 원본 컬럼은 갱신하지 않는다. 경로/bytes/asset_type/기존 metadata는 보존한다.

- Source `metadata.detailExtraction`: schemaVersion, revision UUID, attempt(status/runId/startedAt/finishedAt/errorCode), saveLease, latestResult. 결과는 bytes SHA-256, EXIF 정규화 좌표계/크기, model, 시각, bounded 타일 실패 목록, 최대24 후보를 포함한다. 실패한 재분석은 latestResult를 유지한다.
- Derived `metadata.derivation`: kind=detail_image_crop, parentAssetId, sourceFingerprint, candidateId, sourceRect, sourceDimensions, coordinateSpace, suggestedRole, confidence, extractedAt, provider/model. 처음에는 asset_type=unclassified. 실제 decoder 크기를 width/height에 저장하고 현재 최대 sort_order 뒤에 원본 후보 순서로 append한다.
- 경로는 `projects/{projectId}/products/{productId}/{serverUUID}.{actualMimeExtension}`. signed URL과 임시 타일은 DB/Storage에 보존하지 않는다. accepted IDs는 중복 저장하지 않고 현재 Product Assets의 parent/hash/candidateId로 조회한다.
- Source/Derived 삭제는 독립적이며 cascade를 추가하지 않는다. 후보당 INSERT 응답 유실은 재조회한다. DB 미저장이 확인되면 이번 UUID 파일만 보상 삭제하며 저장 여부가 불명확하면 파일을 지우지 않고 recovery 오류를 반환한다.

Product/Facts/Validation/Analysis/Options/Plan/Sections/Project status는 추출의 쓰기 대상이 아니다. [TASK-024](./tasks/TASK-024.md).
