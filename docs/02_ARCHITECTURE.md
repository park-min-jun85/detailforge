# Architecture

## 목적

DetailForge의 시스템 경계, 계층, 핵심 모델을 정의한다.

## MVP 시스템 경계

```text
Browser
  -> Next.js Server (Server Components / Server Actions / Route Handlers)
    -> Supabase Database and private Storage
```

브라우저의 DB 조회와 Storage 변경은 Next.js 서버에서만 수행한다. 비공개 이미지 표시는
서버가 발급한 임시 signed URL로 Storage에서 원본을 읽는다. 데이터 변경은
`src/lib/supabase/server.ts`의 service role client를 통해 수행한다.

## 계층 책임

- `src/app`: App Router 진입점과 서버 UI 조합
- `src/features`: 사용 사례 단위의 애플리케이션 로직
- `src/services`: 외부 시스템 및 저장소와의 작업 조정
- `src/lib/supabase`: Supabase client와 DB 타입
- `src/types/domain.ts`: Supabase에 의존하지 않는 Core Domain 타입

DB row는 `snake_case`, Application Domain은 `camelCase`를 사용한다. 두 모델의
변환과 JSONB 검증은 데이터 접근 경계에서 수행한다.

## 핵심 모델

하나의 Project는 MVP에서 Product 하나와 DetailPage 하나를 가진다. ProductFacts는
Product에 종속된 사실정보의 Source of Truth이며, DetailPage는 순서가 있는 Section
조합으로 표현한다. 실제 이미지 파일은 private Storage의 `product-assets` bucket에
두고 Asset에는 경로와 메타데이터만 저장한다.

인증과 사용자별 소유권, 후속 AI 파이프라인, 공급처 Adapter, 렌더링 및 편집 UI의 상세
설계는 후속 TASK에서 추가한다.

## PHASE 1 / TASK-005 프로젝트 생성·조회

- `src/features/projects/queries.ts`: 서버 전용 목록/집계 조회. UI에 query를 두지 않는다.
- `src/features/projects/actions.ts`: Server Action에서 Zod 검증 후 projects에만 INSERT한다.
- `src/features/projects/schemas.ts`: 입력 검증과 DB row 검증 및 Domain 변환 경계다.
- `src/features/projects/components`: 생성 폼과 프로젝트 목록을 표현한다.
- 생성 시 Product, ProductFacts, DetailPage는 만들지 않는다. 이들은 후속 입력 단계에서 연결한다.
- Dashboard/Projects는 `connection()` 이후 요청 시 조회한다. 생성 성공 시 두 경로를
  `revalidatePath`로 갱신하고 Projects로 이동한다. DB 조회는 빌드 시 실행하지 않는다.
- 목록은 20개 단위 pagination과 `updated_at DESC, id DESC` 정렬을 사용한다.
  집계는 목록 길이가 아닌 DB의 exact count를 사용하고 최근 프로젝트는 5개로 제한한다.
- DB row의 상태/날짜/id를 검증한 뒤 camelCase Domain 모델만 presentation에 전달한다.
- DB 오류, 연결 실패, 환경변수 누락은 일반 사용자 메시지로 변환한다. 내부 오류와
  service role key는 응답이나 로그에 출력하지 않는다. DB 요청 제한 시간은 10초다.

## PHASE 1 / TASK-006 상품정보

- `/projects/[projectId]`는 UUID/Project 존재 여부를 확인하고 상품정보를 서버에서 조회한다.
- `src/features/products/queries.ts`: Project와 Product 조회 및 Domain/Form 데이터 조합.
- `schemas.ts`, `mappers.ts`: 입력과 JSON 검증, manual snapshot/Facts 생성, DB→Domain 변환.
- `actions.ts`: FormData를 받아 저장 흐름을 호출하고 상세 route를 재검증한다.
- `persistence.ts`: 기존 서버 client로 products와 product_facts를 저장한다. UI에는 DB query를 두지 않는다.
- `components/product-form.tsx`: 입력, 스펙 행, 저장 진행/오류/성공 상태를 표현한다.
- Product 저장은 Project의 status와 updated_at을 변경하지 않으므로 기존 목록/집계 의미를 유지한다.

### 두 테이블 저장과 보상

Product와 기존 Facts를 먼저 조회해 스냅샷을 보관한다. Product를 먼저 INSERT/UPDATE하고
Facts를 INSERT/UPDATE한다. 두 UNIQUE 제약을 유지하며 무조건적인 upsert로 다른 쓰기를 덮지 않는다.
기존 record UPDATE와 복원에는 updated_at 비교 조건을 사용한다. 오래된 폼은 저장을 거부한다.
같은 프로세스의 같은 Project 저장은 동시 실행을 거부한다.

Facts 저장 실패 시 재조회하여 응답만 유실되었는지 확인한다. Facts가 이전 상태 그대로이면
신규 Product는 해당 요청의 id/updated_at 조건으로 삭제하고, 기존 Product는 이전 내용으로
복원한다. 복원 시 DB trigger로 변경된 updated_at을 폼에 돌려주어 재시도를 허용한다.
Facts가 다른 내용으로 변경되었거나 조회/복구가 실패하면 오래된 값으로 덮어쓰지 않고
재확인 필요 상태를 반환하며 폼을 잠근다. 사용자에게 다시 열어 저장 내용을 확인하도록 안내한다.

이는 보상 처리이며 DB 트랜잭션이 아니다. 프로세스 중단, 장기 연결 장애, 여러 서버 프로세스의
동시 쓰기에서는 부분 상태가 남을 수 있고 두 쓰기 사이의 중간 상태도 조회될 수 있다.
신규 migration/RPC 없이 ACID atomicity를 보장하지 않는다. 엄격한 원자성이 필요해지는
단계에서 DB transaction/RPC를 별도 설계해야 한다.

## PHASE 1 / TASK-007 제품 이미지

- `/projects/[projectId]/images`: Server Component에서 Project/Product를 검증하고 초기 목록을 조합한다.
- `features/assets/service.ts`: 기존 server-only client로 소속 검증, 목록, signed URL, 업로드/삭제 보상을 담당한다.
- `schemas.ts`: UUID, 파일 MIME/크기/시그니처, 표시 파일명, 경로 소속, 수량/순서, DB→Domain 경계다.
- `http.ts`: 동일 Origin/Host 검증, 크기가 제한된 바이너리 읽기, 비공개 캐시와 일반 오류 응답.
- `client.ts`, `components/asset-manager.tsx`: 서버 API 호출과 파일별 진행/결과, 썸네일 및 삭제 확인 UI.
- `POST /api/projects/[projectId]/assets`는 파일당 한 요청이다. Content-Type에 MIME,
  X-File-Name에 URL 인코딩 파일명을 전달한다. 서버는 Content-Length뿐 아니라 실제 스트림의
  바이트 수를 검사하며 최대 10MiB까지만 읽는다. 여러 파일은 브라우저에서 순차 전송한다.
- `GET`은 안정적으로 정렬한 Asset과 5분 signed URL을 반환한다. `DELETE .../assets/[assetId]`는
  DB에 저장된 경로만 사용한다. 응답은 `Cache-Control: private, no-store`이다.
- Storage에는 UUID 경로로 원본을 업로드하고 assets에 메타데이터를 INSERT한다.
  INSERT 실패 시 id로 재조회하여 응답 유실이면 성공 처리하고, row가 없으면 파일을 정리한다.
  재조회 실패 시 저장된 row의 파일을 지우지 않고 확인 필요 오류를 반환한다.
- 삭제는 Storage → DB 순서다. 파일 삭제 실패 시 row를 유지하고, DB 삭제 실패 시 남은 row를
  다시 삭제할 수 있다. 파일이 이미 없어도 Storage remove를 재시도할 수 있다.
- 동일 프로세스의 Product별 변경 잠금과 exact count/max sort_order로 순서를 정한다.
  다중 서버의 수량/순서 경쟁, 프로세스 중단, 장기 장애의 고아 파일은 엄격하게 방지하지 못한다.
  Storage/DB는 하나의 transaction이 아니며 상세 한계와 수동 정리 기준은 TASK-007에 기록한다.

## PHASE 2 / TASK-008 이미지 AI 분석

- `features/asset-analysis/service.ts`: 소속 검증, 분석 상태/재분석, 조건부 DB 저장을 조정한다.
- `provider.ts`, `config.ts`: 서버 전용 OpenAI SDK와 모델/키/timeout 설정 경계다.
- `schemas.ts`, `prompts.ts`: strict 결과 검증과 고정 정책/비신뢰 입력 분리를 담당한다.
- `client.ts`, `components/analysis-result.tsx`: 기존 이미지 화면의 요청과 결과 표현을 분리한다.
- `POST /api/projects/[projectId]/assets/[assetId]/analyze`: Asset 하나당 한 요청이다.
  서버가 검증한 private 경로의 5분 signed URL을 provider에 전달한다.
- metadata/asset_type 비교 조건과 attemptId로 다른 시도의 결과를 덮어쓰지 않는다.
  다른 metadata key가 바뀌면 최신 값에 merge하며 AI 자동 재호출은 하지 않는다.
- AI 결과는 시각적 관찰이며 Product Facts를 변경하지 않는다. hero는 최종 지정하지 않는다.
- 동기 요청 기반 MVP로, 브라우저는 순차 요청하고 프로세스당 최대 2개를 분석한다.
  지속 실행이나 다중 인스턴스 전체의 동시 호출 제한은 보장하지 않는다.
- schema, 상태, 오류 복구 및 한계는 `04_AI_PIPELINE.md`와 `tasks/TASK-008.md`를 참고한다.

## PHASE 2 / TASK-009 상품 AI 분석

- `/projects/[projectId]/analysis`: 기존 Shell 안의 상품 분석 화면이다. 이미지 화면의 다음 링크로 이동한다.
- `features/product-analysis/evidence.ts`: Product Facts, 완료된 Asset 관찰, 미검증 설명을 F/V/S 근거로 정규화하고 SHA-256 입력 fingerprint를 만든다.
- `schemas.ts`: 전략 결과, evidence snapshot, attempt/latestResult의 런타임 경계다. 존재하지 않는 근거 ID를 거부한다.
- `provider.ts`, `config.ts`, `prompts.ts`: 기존 OpenAI SDK/Structured Outputs 패턴을 사용한다. 고정 정책과 비신뢰 텍스트 입력을 분리한다.
- `service.ts`: Project/Product/Facts/Asset 소속 확인, 입력 조합, 조건부 상태 저장을 담당한다.
  AI 입력에는 원본 이미지나 signed URL을 넣지 않고 Storage API도 호출하지 않는다.
- `GET/POST /api/projects/[projectId]/product-analysis`: GET은 현재 입력/결과, POST는 명시적 분석 실행이다.
- `products.ai_analysis`만 UPDATE한다. 기존 products updated_at trigger는 작동하므로 상품정보 폼의 revision이 바뀔 수 있다.
  raw_data, Product Facts, Project status를 쓰지 않는다. ProductFacts의 수동 저장 보상도 ai_analysis를 덮어쓰지 않는다.
- 서버 발급 runId와 attempt 상태의 조건부 비교로 중복/늦은 결과를 방어한다. 큰 JSON 결과를 URL 필터로 보내지 않는다.
  입력 변경 중 분석은 원래 snapshot을 저장하고 현재 fingerprint와의 차이를 표시한다.
- 동기 MVP의 프로세스 종료/다중 서버 비용 제어 한계는 TASK-008과 같다. TASK-009는 별도 프로세스당 2개 한도를 둔다.

## PHASE 2 / TASK-010 Fact Validation

- `features/fact-validation/evidence.ts`는 기존 Facts를 검증 대상으로, source_snapshot/완료된 관찰/
  Product Analysis의 과거 evidence snapshot을 비교 자료로 구분한다. 전략 문장은 사용하지 않는다.
- `schemas.ts`는 네 가지 판정, Fact별 원본 값 일치, 완전한 Fact coverage, 실제 evidence ID와
  저장 counts/전체 상태를 검증한다. provider 응답은 schema를 통과해도 외부 진위 증명이 아니다.
- service는 `product_facts.validation`만 UPDATE한다. Facts/source_snapshot/validated_at,
  Product/ai_analysis, Project, Asset/Storage는 쓰지 않는다. 기존 Facts updated_at trigger는 유지한다.
- runId/attempt 상태와 Facts id/product_id/updated_at으로 조건부 저장한다. 수동 입력은 validation을
  보존하고 validation은 수동 원본을 보존한다. 충돌 시 기존 수동 보상 흐름의 재확인 상태를 따른다.
- `/projects/[projectId]/validation`은 상품 분석의 후속 화면이며 GET/POST
  `/api/projects/[projectId]/fact-validation`으로 조회/명시적 실행을 분리한다.
- attempt/latestResult 분리, 실패 시 이전 성공 보존, fingerprint/stale, 동기 실행 한계는 TASK-009
  패턴을 따른다. 근거 및 보수적인 supported/conflict 정책의 상세는 TASK-010 문서에 있다.

## 현재 운영 전제

현재 MVP는 **single-user/local-development assumption**이다. Server Action도 외부에서
호출할 수 있는 서버 진입점이며, 서버 전용 service role client만으로 사용자 접근 통제가
완성되는 것은 아니다. **외부 공개 배포 전에 Auth + owner_id + 사용자별 RLS**와
Server Action/Route Handler의 인증·소유권 검증 및 사용자별 Storage 정책이 필요하다.
TASK-010에서도 Auth는 추가하지 않으며 product_facts JSONB 컬럼의 additive migration만 추가한다. Origin 검사는 사용자 인증을 대신하지 않는다.

## PHASE 3 / TASK-011 Page Planner

- /projects/[projectId]/planner와 GET/POST /api/projects/[projectId]/page-plan을 추가한다.
- features/page-planner의 evidence → provider → service → components 경계를 사용한다.
  schemas는 출력/저장 provenance를 검증하고 config/prompts/provider/service/evidence는 서버에서 실행한다.
- GET은 입력 상태와 저장 Plan을 읽으며 DetailPage를 만들지 않는다. Validation이 없거나 stale이어도 조회한다.
- POST는 최신 Validation을 전제로 지원된 F와 완료된 V만 조합한다. 최신 Product Analysis는 별도 전략이다.
- 최초 POST에서 project_id UNIQUE를 이용해 width=860, status=draft DetailPage 하나를 생성한다.
  이후에는 같은 행의 plan만 변경한다. updated_at/runId/attempt 상태를 비교하는 조건부 저장과 응답 유실 재확인을 사용한다.
- provider 완료 후 입력을 다시 읽고 fingerprint가 달라지면 input_changed로 실패시키며 이전 성공을 보존한다.
  여러 테이블을 읽으므로 이 확인과 최종 저장 사이까지 원자적 transaction을 제공하지는 않는다. 이후 GET이 stale을 표시한다.
- 실행당 provider 60초, DB 요청 10초, 프로세스당 최대 2건이다. planning lease는 3분 후 재시도할 수 있다.
  DB project_id UNIQUE와 runId 조건으로 중복/늦은 저장을 막는다. 전역 비용 제한이나 background queue는 없다.
- Facts/source_snapshot/Validation/Product Analysis/Asset/Project status/Sections는 Planner가 수정하지 않는다.
- 기존 single-user/local-development 보안 전제와 RLS는 유지한다. Origin 검사는 인증을 대신하지 않는다.

## PHASE 3 / TASK-012 Section Engine

- /projects/[projectId]/sections, GET /api/projects/[projectId]/sections,
  POST /api/projects/[projectId]/sections/generate를 제공한다.
- features/section-engine: schemas(10종 content/style/row/journal), grounding(Plan 대응과 근거 검증),
  config/prompts/provider, service, persistence, http/client, components의 책임을 분리한다.
- getPlannerView와 기존 Plan schema/freshness를 재사용한다. 최신 Plan/Validation과 소속 검증을 통과해야 생성한다.
- 전체 Section을 한 번의 text-only provider 호출로 생성하고 모두 검증한 뒤 저장한다. Plan을 재설계하지 않는다.
- 기존 sections.content/style과 detail_pages.settings.sectionGeneration 복구 journal만 사용한다. migration/RPC 없음.
- settings journal에 기존 row snapshot을 보관하고 새 행 전체를 batch INSERT한다. 기존 행을 ID/updated_at 조건으로
  한 DELETE 요청에서 제거하고 완료 상태를 저장한다. 완료 후 실제 행은 Plan과 1:1이다.
- 중간 실패는 기존 snapshot의 누락된 행을 복원하고 이번 실행의 새 행을 제거한다. 응답 유실은 실제 DB 재조회로 확인한다.
  복구 실패에는 journal을 유지하고 GET은 보관된 기존 콘텐츠를 표시하며 복구 CTA는 AI 없이 복구만 수행한다.
- 생성 중 GET은 journal의 기존 snapshot을 표시한다. 상태 읽기 전후를 재확인해 경쟁 중 혼합 조회를 거부한다.
- 기존 row가 다른 작업에서 바뀌면 자동 덮어쓰지 않는다. 알 수 없는 행/수동 변경 충돌은 복구 필요 상태로 남긴다.
- 이는 보상 처리이며 cross-row ACID transaction이 아니다. 직접 DB 조회자는 staging 중 중복/중간 상태를 볼 수 있다.
  향후 Editor/Renderer도 이 조회 경계를 사용해야 한다. 다중 작성자/엄격한 원자성이 필요하면 RPC/transaction을 별도 설계한다.
- Project/DetailPage status는 전환 의미가 명확하지 않아 유지한다. Facts/Validation/Product Analysis/Plan/Asset은 수정하지 않는다.

## PHASE 4 / TASK-013 Detail Editor Foundation

- `/projects/[projectId]/editor`는 기존 Sections를 사람이 편집하는 계층이다. OpenAI 호출은 없다.
- `features/detail-editor`: type별 fields/form mapping, strict editable schemas, server service/http,
  client explicit save, Editor/Inspector, 독립된 10종 preview renderer로 책임을 나눈다.
- PATCH `/api/projects/[projectId]/sections/[sectionId]`는 revision/fields/assetIds/style만 받는다.
  서버가 Project/Product/DetailPage/Section/Asset 소속을 확인하고 content/style만 조건부 UPDATE한다.
  Section id/type/order와 Planner provenance는 불변이다.
- 기존 updated_at을 낙관적 동시성 revision으로 사용하며 오래된 저장에는 409를 반환한다.
  settings.sectionEdit의 짧은 page CAS lease로 전체 Section 재생성/복구와 수동 저장을 조정한다.
  Section Engine은 해당 lease를 확인한다. 중단된 lease는 3분 후 만료되고 DB 요청은 10초로 제한한다.
  여러 row/Asset 조회 전체의 ACID transaction은 아니며 장기 정지/직접 DB 변경의 한계는 TASK-013에 기록한다.
- Editor도 generation journal의 backup을 표시하며 생성·복구 중에는 저장을 막는다.
  Plan 결과 fingerprint가 다르면 경고하되 기존 콘텐츠 조회/수동 저장은 허용한다.
- 문구 수정은 manualEdit와 groundingStatus=needs_review를 기록한다. style-only 수정은 grounding을 유지한다.
  Facts/source_snapshot/Validation/Product Analysis/Plan/Asset 및 Project status는 변경하지 않는다.
- draft/dirty state와 명시적 저장, Section/앱 링크 이동 확인, beforeunload를 제공한다. autosave는 없다.
- preview는 bounded token의 deterministic CSS mapping이며 Editor 선택 outline은 wrapper에만 있다.
  full Renderer/export는 이후 단계다. private image URL은 기존 TASK-007 helper의 임시 DTO이며 DB에는 쓰지 않는다.

## PHASE 4 / TASK-014 Section Reorder

- Page Plan 순서는 원본 설계, sections.sort_order는 현재 수동 편집 결과다. Plan은 수정하지 않는다.
- features/section-reorder는 strict 전체 집합·revision schema, local draft helper, server persistence/service/http,
  client API를 분리한다. Navigator의 native drag/위아래 버튼은 local orderDraft만 바꾼다.
  explicit 순서 저장 성공 시 canonical rows/새 updated_at을 적용한다. Preview는 저장 전 draft 순서에 맞춘다.
- PATCH /api/projects/[projectId]/sections/reorder는 모든 ID/revision을 lease 전후 검증하고 서버에서 0..N-1을 계산한다.
  각 row는 sort_order만 CAS UPDATE한다. content/style/type/meta/grounding/상위 데이터는 그대로 유지한다.
- 기존 settings.sectionEdit lease를 재사용하고 Planner와도 상호 배제한다. Section Engine은 reorder journal이 남아 있으면 생성하지 않는다.
- settings.sectionReorder에 순서 backup/current/pending intent와 불변 row fingerprint를 지속 저장한다.
  부분 실패는 sort_order만 보상 복구하며 복구 실패 시 journal과 draft를 유지하고 추가 저장을 막는다.
  조회는 마지막 완료 순서를 표시한다. 같은 endpoint의 명시적 recover 요청은 AI 없이 원래 순서를 복구한다.
- 성공 시 settings.editor.manualOrder를 최신 settings와 CAS merge한다. 기존 generation journal/editor 속성은 보존한다.
  재생성 후 새 UUID 집합에는 이전 manualOrder를 적용하지 않으며 재생성 확인 UI에서 순서 초기화 가능성을 알린다.
- GET /api/projects/[projectId]/editor는 409 뒤 최신 재조회용이다. 기존 dirty/이탈 guard를 content OR order로 확장한다.
- stale Plan에서도 수동 reorder를 허용한다. AI 호출, dependency/migration/RPC 추가 없음.
  보상 처리는 ACID transaction이 아니며 한계와 복구 계약은 TASK-014/ADR-011을 따른다.

## PHASE 4 / TASK-015 Individual Section AI Regeneration

features/section-regeneration은 input context/grounding/provider/config, 서명된 후보, apply service/http와 Client 비교 UI를 분리한다.
POST sections/[sectionId]/regenerate는 현재 Section 한 개만 읽어 후보를 반환하며 DB에 쓰지 않는다.
POST sections/[sectionId]/apply-candidate는 10분 HMAC 후보/입력 fingerprint/row revision을 확인하고 기존 page edit lease 안에서 content 한 행만 CAS 갱신한다.
응답 유실은 재조회로 판별한다. type/Plan/order/style/images/다른 Section/상위 근거는 보존한다.
기존 10종 schema와 claim guard를 공유하며 원본 이미지/Vision을 보내지 않는다.
stale Plan/Validation은 차단하고 stale 전략은 제외한다. 후보는 Client state이며 명시적 적용 전 canonical 콘텐츠가 아니다.
세부 계약/검증/분산·자연어 한계는 [TASK-015](tasks/TASK-015.md)를 따른다.

## PHASE 5 / TASK-016 Final Detail Renderer

/projects/[projectId]/render는 검토 화면이고 article[data-detail-render-surface="1"]이 별도 캡처 경계다.
서버 전용 features/detail-renderer/service가 Project/Product/Page/Section 소속과 JSONB를 검증하고
저장된 sort_order ASC와 detail_pages.width로 camelCase read model을 만든다. draft/orderDraft/AI candidate는 받지 않는다.
기존 generation/reorder journal·edit lease 중에는 중간 상태를 final로 표시하지 않고 busy 안내를 제공한다.
읽기 전후 page/rows를 비교하며 GET 복구/lease/상태 변경은 하지 않는다. 여러 테이블의 ACID snapshot은 아니다.
SectionRenderer/SectionCopy/CSS를 Editor와 Final이 공유한다. 선택 UI·클릭·draft·zoom은 Editor wrapper에만 있다.
10종/고정 bounded 스타일/860px 실제 폭, 임시 signed URL/누락 이미지 fallback, review 밖 warning을 제공한다.
OpenAI/Vision/DB mutation/migration/dependency 추가 없음. 캡처·파일 생성은 TASK-017 책임이다.
구체 데이터/이미지/동시성 한계와 검증은 [TASK-016](tasks/TASK-016.md)을 따른다.

### TASK-017 Export Layer

`POST /api/projects/[projectId]/export`는 server-only detail-export service/provider를 사용한다.
canonical read model → 기존 `article[data-detail-render-surface="1"]` → Chromium locator screenshot → binary attachment.
별도 상세 HTML/CSS는 없다. preflight/DOM/postflight fingerprint 비교로 출력 중 변경을 거부한다.
renderer는 레이아웃·이미지 표시를, export는 브라우저 생명주기·readiness·크기·파일·응답을 책임진다.
trusted server origin만 방문하며 사용자 URL/Host를 캡처 origin으로 쓰지 않는다. 현재 참조 asset/static 요청만 허용한다.
deviceScaleFactor=1/scale=css로 persisted width를 physical px로 보존하고 header로 재검사한다.
폰트/이미지 준비, 75초 timeout, 16,000px/1,600만 px 제한, 프로세스당 1건을 적용한다.
signed URL은 임시이며 output/URL/history를 DB·Storage에 저장하지 않는다. AI 호출·migration 없음.
로컬 Node/Chromium 설치가 필요하며 serverless provider는 별도 검증 과제다. [TASK-017](tasks/TASK-017.md).
