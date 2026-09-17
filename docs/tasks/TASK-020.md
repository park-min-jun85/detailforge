# TASK-020 — Product Options Foundation

브랜치 `feat/product-options`. 구현·자동 테스트·실제 Supabase/브라우저 검증 완료. Git commit 없음.

## 저장과 책임

구매 선택값인 Options는 Product Facts/Specifications와 독립적이다. `product_options`가 confirmed options의 Source of Truth다.
기본 상품정보/Facts를 먼저 저장한 뒤 별도 **옵션 저장**으로 처리한다. 하나의 Options row만 원자적으로 INSERT/UPDATE하므로 3-way 보상 흐름을 만들지 않는다.
옵션 저장은 Products/raw_data/Facts/source_snapshot/Validation/Analysis/Assets/Plan/Sections를 수정하지 않는다.

`features/product-options`의 schemas, queries, persistence, http, client, components가 입력·서버 접근·표현을 분리한다.
`GET/PUT /api/projects/[projectId]/options`는 private no-store이다. PUT은 Origin 및 실제 스트림 128,000-byte 제한을 재사용한다.
Product가 없으면 안내만 제공하며 저장을 거부한다. Client의 Product ID와 서버 Project→Product 관계가 일치해야 한다.

## DB와 migration

`0005_add_product_options.sql`만 추가한다. 새 dependency 없음.

- id UUID PK, 기존 gen_random_uuid() 기본값.
- product_id UUID NOT NULL UNIQUE → products(id), ON DELETE CASCADE.
- groups JSONB NOT NULL, 기본 `{ "schemaVersion": 1, "groups": [] }`.
- source_snapshot JSONB NOT NULL, 기본 `{}`.
- groups/source_snapshot은 JSON object CHECK. 내부 구조는 Zod 검증.
- version integer NOT NULL DEFAULT 1 CHECK > 0.
- created_at/updated_at timestamptz DEFAULT now(), 기존 public.set_updated_at() trigger 재사용.
- RLS enable, anon/authenticated 권한 revoke, service_role grant. 새 허용 policy 없음.

### 원격 적용 절차 / 현재 상태

사용자가 dry-run에서 0005 하나만 pending임을 확인한 후 실제 원격 적용했고, migration list Local/Remote 0001~0005 일치를 확인했다.
이후 linked DB 기준 database.types.ts 재생성과 next typegen/tsc 통과를 보고했다. 생성 타입의 Row/Insert/Update/FK 관계가 현재 schema와 일치함을 확인했다.
적용된 0005 파일은 수정하거나 재적용하지 않았다. 후속 검증 전후 SHA-256은 `A05D925DDA2101D05B391D9E40A88391BE137AF0502BB8F98C165848DF1EECCB`로 동일하다.
실제 DB에서 Options CRUD, UNIQUE/FK/object CHECK/version 제약, updated_at trigger, Product 삭제 cascade를 확인했다. RLS enable/revoke/grant는 적용된 migration 정책을 유지하며 Auth/owner_id는 추가하지 않는다.

## Canonical schema와 규칙

```json
{
  "schemaVersion": 1,
  "groups": [
    {
      "id": "group UUID",
      "name": "색상",
      "values": [
        { "id": "value UUID", "label": "아이보리" },
        { "id": "value UUID", "label": "블랙" }
      ]
    }
  ]
}
```

최대 그룹10/그룹당 값30/전체 값100. 그룹명 trim 1–100자, 값 trim 1–200자. strict schema로 다른 필드를 거부한다.
그룹명과 같은 그룹의 값은 trim/연속 공백/대소문자 정규화 후 중복을 거부한다. 화이트/오프화이트는 다른 값이다.
완전히 빈 그룹과 빈 값은 제외한다. 이름 있는 그룹에 실제 값이 없으면 validation error다. 마지막 값 삭제 후에는 값 추가 또는 그룹 삭제를 안내한다.
그룹·값 ID는 crypto.randomUUID()로 생성하고 수정/삭제 후 나머지 ID와 배열 순서를 유지한다. 그룹과 값 전체에서 ID 중복을 거부한다.
배열 순서가 표시 순서다. 재정렬 UI/SKU 조합은 만들지 않는다.

TASK-019 helper를 재사용하되 옵션 의미의 예외 `없음`, `해당없음`, `X`(대소문자/공백 변형 포함)는 명시적 선택값으로 허용한다.
참조 안내문/정보 없음/미상/구두점 등은 confirmed values에서 제외하며 현재 입력 source에는 보존한다. 모든 값이 제외된 이름 있는 그룹은 오류다.
`화이트 / 블랙`, `ABS / PC`, `0`, 실제 문장은 그대로 한 값이다. slash 분할이나 의미 추론을 하지 않는다.

## Source snapshot

수동 저장: `{ inputMethod: "manual", schemaVersion: 1, groups: [...] }`에 해당 제출의 bounded 원문 draft를 저장한다. trim 전 문자열과 제외된 placeholder/빈 행도 남을 수 있다.
confirmed groups는 사용자가 제출한 실제 선택값 subset이다. source에서 AI가 추가 옵션을 확정하지 않는다.
다음 명시적 저장은 현재 입력 snapshot으로 교체한다. 버전 history/이전 원문 영구 이력 저장소는 아니다.
향후 `{ inputMethod: "wholesale_url", sourceUrl, groups: [{ name, values: string[] }] }` source schema가 준비되어 있으나 현재 PUT은 수동 입력만 받는다.
Product raw_data는 상품 source, Options source_snapshot은 옵션 출처다. 서로 자동 복사하지 않는다.

## 동시성과 오류

미저장 row의 client version은0. 최초 INSERT는 version1이며 product_id UNIQUE가 insert race를 막는다.
기존 UPDATE는 row id/product_id/version 비교 조건과 version+1을 한 SQL 요청에 적용한다. 오래된 입력 또는 CAS miss/UNIQUE 충돌은409다.
UI는 “다른 변경사항이 먼저 저장되었습니다. 최신 옵션을 다시 불러와 주세요.”를 표시하고 draft를 유지한다.
응답 유실은 row ID·version·정확한 groups/source를 재조회하여 확인하며 mutation을 자동 재시도하지 않는다. 확인 불가 시 재조회 안내 오류이며 내부 DB 오류는 비공개다.
Product/Facts와 묶인 transaction은 아니다. 현재 single-user/local-development 전제와 공개 전 Auth/owner_id/RLS 요구를 유지한다. Project/Product 관계 검사는 사용자 인증을 대신하지 않는다.

## UI

상품정보 화면의 Product form 아래에 별도 상품 옵션 영역을 둔다. 그룹/값 추가·삭제, 선택값 입력, 옵션 저장, 최신 옵션 불러오기, 옵션 변경 취소를 제공한다.
입력은 draft이며 autosave하지 않는다. 성공한 canonical 서버 결과로 draft/version을 갱신하고 dirty를 해제한다. 실패는 draft를 유지한다.
저장 중 입력/버튼을 잠그고 중복 실행을 막는다. 새로고침 이탈은 beforeunload로 안내하며 최신 옵션 불러오기는 dirty를 버리기 전 확인한다.
Product가 없으면 상품 저장 안내를 표시한다. 최초 상품 저장 후 최신 옵션 불러오기로 진입할 수 있다.
그룹/값마다 label과 삭제 버튼 accessible name, status/alert, placeholder 안내 aria-describedby를 제공한다. 기존 neutral panel/button/input 스타일과 반응형 grid를 사용한다.

## Downstream integration boundary

- `getConfirmedProductOptions(projectId, productId)`: 소속 확인 후 productId/version/hasOptions/options를 반환한다. raw source는 반환하지 않는다. 저장 row가 없으면 빈 options, 잘못된 저장 schema는 오류다.
- Planner는 이 helper로 옵션 존재와 confirmed groups를 읽을 수 있다. 이번 단계에서 prompt/Plan schema/AI 호출은 변경하지 않는다.
- `section-engine/options.ts`의 `buildOptionSectionSource`: 위 read model을 검증하고 groupId/valueId/label/value 항목으로 deterministic mapping한다. 원본 순서와 정확한 문자열, sourceVersion을 유지한다. 빈 source는 빈 items다. 최대100개를 모두 유지하며 AI 출력은 인자로 받지 않는다.
- 이 source는 기존 Section v1 `items[{label,value,evidenceIds}]`와 별개다. v1은 F 근거·최대8행이므로 confirmed Options를 가짜 F로 넣지 않는다. 실제 생성/저장/Editor/Renderer 연결은 후속 contract 확장에서 처리한다. 기존 option 생성 동작은 그대로다.
- 후속 연결은 Option sourceVersion/fingerprint stale, Plan/Section snapshot, option 전용 참조, Editor에서 실제 값 변경은 Product Options로 유도하는 정책이 필요하다.
- Fact Validation targets와 Product Analysis F registry에 Options를 자동 추가하지 않는다. Options 확인은 schema+사용자 확인이며 AI 검증 완료 표시가 아니다.

## TASK-021 Adapter boundary

ImportCandidate에 optional `options: [{ name, values: string[] }]`를 추가했다. 기존 후보는 field 없이 통과한다. 최대10/30/100을 검사하지만 placeholder는 후보 원문으로 허용한다.
Generic Adapter는 옵션 DOM을 추측하지 않으며 Fact slash를 분할하지 않는다. 현재 Import save는 Options를 자동 저장하지 않는다.
TASK-021에서 명확한 option DOM 추출 → 원본 후보 확인 UI → stable ID 할당/유지 → 명시적 Options save → provenance 보존을 연결해야 한다.
후보 교체 시 기존 수동 Options를 조용히 덮어쓰지 않도록 version/사용자 확인을 사용한다.

## 테스트와 검사

신규 `tests/product-options.test.mjs`, 로컬 모의 PostgREST `tests/helpers/options-db.mjs`.
46개: schema/trim/bounds/중복/빈 행/stable IDs/placeholder 예외/원문/CRUD/UNIQUE race/CAS/소속/오류 비공개/응답 유실/기존 데이터 불변/삭제·순서/confirmed read model/Section mapping/100값 무손실/ImportCandidate 호환/HTTP Origin·body limit/client 오류/migration mapping.
자동 테스트와 Options CRUD의 실제 OpenAI 호출은0회.
전체 **485/485** (기존439 + 신규46), 실패/skip 없음. next typegen/tsc --noEmit/lint/build/git diff --check 통과.
secret audit: client bundle22개와 source에서 실제 OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY 검출0건. 키 값을 출력하지 않았다.

### 로컬 모의 DB 브라우저 검증

Production build와 로컬 모의 PostgREST로 UI를 확인했다. 실제 Supabase 검증을 대신한 기록이 아니다.
색상 아이보리/블랙, 사이즈 S/M/L 입력 → 저장 → 새로고침 유지, 블랙→차콜 수정, L 삭제, 구성 그룹 추가/저장/삭제/재저장과 새로고침 유지를 확인했다.
두 탭에서 오래된 version 저장은 conflict 안내와 그레이 draft를 유지했으며 최신 차콜을 덮어쓰지 않았다. dirty 해제/변경 취소, Desktop 입력·버튼 레이아웃도 확인했다.
모의 데이터는 프로세스 메모리뿐이며 당시 검증용 서버/브라우저 탭을 종료했다. 이 검증에서는 실제 DB/Storage 테스트 데이터 생성0건이다.

### 실제 Supabase / 브라우저 검증 (0005 적용 후)

linked 타입 기준으로 전체485 tests/typegen/tsc/lint/build를 다시 통과했다. production build 로컬3001과 실제 Supabase를 연결해 이번 검증 전용 Project/Product 하나를 사용했다.

- 브라우저 수동 입력: 색상 아이보리/블랙, 사이즈 S/M/L → 옵션 저장 → 새로고침 후 그대로 유지.
- 블랙→차콜 수정/저장. 오래된 다른 탭에서 그레이 저장 시 conflict 안내와 draft 유지, 최신 차콜 덮어쓰기 없음.
- L 값 삭제, 구성/2개 세트 그룹 추가·저장, 구성 그룹 삭제·저장, 새로고침 유지. conflict 탭에서 변경 취소 후 최신 옵션 불러오기도 정상.
- 실제 DB product_options row1개, version1→4 증가. row/group/value UUID와 남은 값 순서 유지, updated_at trigger 갱신, source_snapshot 일치 확인.
- UNIQUE 중복 INSERT23505, 없는 Product FK23503, groups/source_snapshot 배열과 version0의 CHECK23514를 확인했다. 실패한 요청은 기존 row를 바꾸지 않았다.
- Product 전체/raw_data/ai_analysis와 ProductFacts 전체/facts/source_snapshot/validation을 저장 전후 비교해 불변 확인. Asset 생성0개.
- `/analysis` Product Facts 요약에 기존 상품명·재질 ABS만 표시되며 색상·사이즈 Options가 추가되지 않았음을 확인했다.
- 실제 confirmed read model을 Section source mapper에 전달해 최종4개 선택값/ID의 정확한 매핑을 확인했다. 실제 AI 호출0회.
- 최종 bundle22개/source의 실제 OpenAI·service-role 키 검출0건. 기존 Wholesale SSRF/이미지/browser 정책은 변경 없음.
- 검증용 Project를 정리하고 종속 Product/Facts/Options 및 관련 row 잔여0건을 확인했다. Storage 생성0개. 기존 사용자 프로젝트는 수정하지 않았다.
- 검증 서버와 브라우저 탭을 종료했다. 실제 DB provider 장애/응답 유실을 유발하지 않았으며 해당 사례는 모의 테스트로 검증했다.

## Cursor 직접 확인

상품정보와 옵션의 별도 저장 안내, 옵션 입력의 키보드 이동, 빈 값/중복 안내, placeholder 제외 후 표시, 최신 옵션 불러오기/변경 취소, 긴 그룹명·선택값과 10그룹/100값 화면을 확인할 수 있다.
실제 옵션의 의미는 판매자가 확인해야 한다. 이번 단계는 SKU 조합이나 AI 사실 검증을 제공하지 않는다.

## 생성·수정 파일

생성: migration0005, features/product-options의 schemas/errors/queries/persistence/http/client/components/options-manager, API options/route, section-engine/options, 테스트2개, 이 문서.
수정: Product 상세 page, ImportCandidate schemas, database.types, docs/tasks/README, ARCHITECTURE/DATABASE/AI_PIPELINE/UI_UX/CODING_RULES.

## 미구현

도매매 자동 옵션 추출, SKU combinations, 가격/재고, 옵션 이미지 mapping, marketplace variant mapping, drag/drop, AI 옵션 생성/검증, 실제 Option Section/Editor 저장 형식 전환, version history, Auth/owner_id 확장.
