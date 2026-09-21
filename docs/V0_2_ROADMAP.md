# v0.2.0 Roadmap — 검토와 재시도의 예측 가능성

TASK-036 설계 결정이다. **권장 방향은 A: Internal Quality Release**이며, 구현 승인이 내려진 상태를 뜻하지 않는다. 실패 타일만 명시적으로 재시도하는 복구(M2)와 근거를 유지한 제목·본문 역할 개선(M3)을 릴리스의 핵심으로 삼는다. 공개 SaaS 전환이나 Commerce 기능 확장을 함께 묶지 않는다.

## TASK-037 계약 확정

**TASK-038 진행 결과:** [Tile checkpoint domain/persistence](tasks/TASK-038.md)를 구현했다. 새 전체 extraction은 타일 terminal 결과를 매번 bounded metadata에 저장하며, deterministic identity·입력 stale·legacy/malformed 분리·CAS·용량 초과 보존을 검증한다. failed-only 서버 실행/자동 호출/UI는 없다. M2는 미해결이며 다음 권장은 TASK-039 명시 retry다. 아래 TASK-036/037의 구현 부재/상한 제안은 당시 기준 기록이고, 현재 상한은 16×8 / UTF-8 256KiB로 적용한다. M3/미해결 MEDIUM4·LOW1/package0.1.1은 그대로다.

[M2/M3 Contracts](V0_2_M2_M3_CONTRACTS.md)에 T1~T8/C1~C22, 실제 source naming, 현재 검출 gap과 기대 classification을 고정했다. M2/M3는 아직 미해결이며 retry/prompt/validator production 변경은 없다. cache256KiB는 독립 UTF-8 byte cap으로 유지한다. 16×8 최대 설명 길이 fixture는 한글155,616B, escaped control270,816B로 후자가 상한을 넘으므로 schema 통과만으로 크기를 보장하지 않는다. 조용한 truncation은 금지하며 실제 JSONB 저장 수용성과 전체 metadata 비용은 TASK-038에서 검증한다. Tile identity와 model/policy/layout cache 호환성을 구분하고 pending/in_flight는 failed-only 대상에서 제외한다.

## 1. 기준점과 조사 범위

- 조사 기준: `plan/v0.2.0`, HEAD `bd856d5` (`chore: prepare v0.1.1 release`). 조사 시작 시 clean. 로컬 `main`, `origin/main`, `v0.1.1^{commit}`도 같은 commit이며 `v0.1.0`은 `06d80bb`이다. 원격 fetch로 실시간 동기화를 다시 확인한 것은 아니다.
- 공식 기준은 **v0.1.1 Local/Internal MVP**, package/lock `0.1.1`. TASK-035의 865 tests PASS, 실제 Planner 1회/Section 1회 첫 출력 PASS, PNG/JPG 860×2744는 이전 검증 기록이다. 이번 조사에서 실제 AI QA를 다시 실행하지 않았다.
- [TASK-035](tasks/TASK-035.md), README와 Release Checklist의 commit/tag 대기 문구는 당시 기록이다. 현재 Git 기준점을 우선하며, 이번 범위 밖인 역사적 릴리스 문서를 일괄 재작성하지 않는다.
- AGENTS/CLAUDE, README/CHANGELOG, 프로젝트 문서 00~07, Release Backlog/Checklist, TASK-032~035, package, 실제 feature/service/schema/provider/renderer 및 migration을 대조했다. 아래 **현재**는 코드 관찰, **제안**은 아직 구현되지 않은 계획이다.

## 2. 현재 기능 inventory

상태는 아래에 명시한 기능 범위에 대한 판정이다. `Implemented`는 공개 SaaS 준비나 무제한 범용 기능을 의미하지 않는다.

| 영역 | 상태 | 현재 코드에서 확인한 범위 / 한계 | 주요 근거 |
| --- | --- | --- | --- |
| Project | Partial | 생성·목록·상세·Dashboard 집계 구현. 사용자별 소속, rename/delete 및 전체 상태 전이 관리 미구현 | [actions](../src/features/projects/actions.ts), [queries](../src/features/projects/queries.ts) |
| Product | Implemented | Project당 상품 입력/수정, 원본 출처 보존, 충돌 검사 및 Facts 저장 연결. SKU 상품 관리까지 의미하지 않음 | [persistence](../src/features/products/persistence.ts), [schemas](../src/features/products/schemas.ts) |
| Facts | Implemented | 수동 확인 Facts, version, source_snapshot, placeholder 정규화. AI 결과와 별도 저장 | [mappers](../src/features/products/mappers.ts), [normalization](../src/features/products/fact-normalization.ts) |
| Assets | Implemented | private 업로드/목록/서명/삭제, MIME/signature, 10MiB/상품당30개, 소속 검사와 metadata CAS | [service](../src/features/assets/service.ts), [metadata](../src/features/assets/metadata.ts) |
| Wholesale Import | Implemented | Generic HTTP-first + 제한된 browser fallback, preview→명시적 상품 저장→이미지 저장, SSRF 경계 및 provenance | [service](../src/features/wholesale-import/service.ts), [extractor](../src/features/wholesale-import/extractor.ts), [security](../src/features/wholesale-import/security.ts) |
| Domeme/Domeggook Adapter/API | Partial | 공식 getItemView4.6 옵션 조회·판정 구현. HTML 상품정보는 Generic이며 전용 Domeme HTML Adapter는 없음. 알 수 없는/제한 조합을 빈 옵션으로 확정하지 않음 | [client](../src/features/wholesale-import/domeme-api/client.ts), [inspection](../src/features/wholesale-import/domeme-api/inspection.ts), [resolver](../src/features/wholesale-import/adapters/generic.ts) |
| Options | Implemented | UUID group/value, 별도 명시 저장/version CAS, 출처·재가져오기 검토, confirmed snapshot→Section→Editor→Export. 종속 조합/SKU 미지원 | [persistence](../src/features/product-options/persistence.ts), [import-merge](../src/features/product-options/import-merge.ts), [snapshot](../src/features/product-options/section-snapshot.ts) |
| Detail Extraction | Partial | 긴 원본의 최대16타일 분석, relevance/geometry 검증, 최대24후보와 부분 성공 보존. 실패 타일만 재시도할 durable cache 없음 | [service](../src/features/detail-extraction/service.ts), [schemas](../src/features/detail-extraction/schemas.ts), [policy](../src/features/detail-extraction/policy.ts) |
| Derived Assets | Implemented | 실제 원본 rectangle crop, source hash/rect/parent/trim 출처, 동일 영역 재사용, 별도 unclassified Asset. 업스케일/배경 제거 아님 | [images](../src/features/detail-extraction/images.ts), [crop identity](../src/features/detail-extraction/crop-identity.ts), [inspection](../src/features/visual-assets/inspection.ts) |
| Asset Analysis | Implemented | strict 출력/Zod, metadata만 저장, 이전 성공 보존, 시각 관찰과 Facts 분리. 인물/제품 잘림 구분에는 M1 한계 | [service](../src/features/asset-analysis/service.ts), [schemas](../src/features/asset-analysis/schemas.ts) |
| Product Analysis | Implemented | F/V/S registry·snapshot·fingerprint, 전략 해석 별도 저장, stale/실패 시 이전 성공 보존 | [evidence](../src/features/product-analysis/evidence.ts), [service](../src/features/product-analysis/service.ts) |
| Fact Validation | Implemented | supported/insufficient/conflict/needs_review, evidence ID 검증, 입력 지문과 stale. supported는 입력 근거 범위의 일관성 | [evidence](../src/features/fact-validation/evidence.ts), [service](../src/features/fact-validation/service.ts) |
| Planner | Implemented | 검증 근거·confirmed Options·실제 visual inventory로 4~12 Section 계획, commerce policy/fingerprint/stale | [schemas](../src/features/page-planner/schemas.ts), [evidence](../src/features/page-planner/evidence.ts), [service](../src/features/page-planner/service.ts) |
| Sections | Implemented | Plan key/type/order 검증, grounding, deterministic 옵션 주입, 이전 성공 backup/복구. 다중 row 쓰기는 DB 단일 transaction으로 구현된 것이 아님 | [service](../src/features/section-engine/service.ts), [persistence](../src/features/section-engine/persistence.ts), [options](../src/features/section-engine/options.ts) |
| Editor | Implemented | content/style 편집, dirty 보존, 명시 저장/옵션 최신 반영, updated_at CAS·lease, 순서 변경 복구 | [service](../src/features/detail-editor/service.ts), [option application](../src/features/detail-editor/option-application.ts), [reorder](../src/features/section-reorder/persistence.ts) |
| Regeneration | Implemented | 개별 Section 후보 생성→비교→명시 적용. 서명 후보 만료·입력/CAS 검사, style/image/order 보호 | [service](../src/features/section-regeneration/service.ts), [candidate](../src/features/section-regeneration/candidate.ts) |
| Renderer | Implemented | canonical Section과 bounded token으로 deterministic Commerce Visual System, 저장 순서/이미지/스펙/옵션 공유 렌더링 | [section renderer](../src/features/detail-renderer/section-renderer.tsx), [visual system](../src/features/detail-renderer/visual-system.ts) |
| Export | Implemented | 동일 article의 PNG/JPG, 기본860px, font/image readiness, 입력 지문 전후 비교, 크기·timeout 한도. 분할/PDF 미지원 | [service](../src/features/detail-export/service.ts), [browser](../src/features/detail-export/browser.ts), [config](../src/features/detail-export/config.ts) |
| Auth / 사용자 격리 | Not implemented | service-role 기반 단일 사용자 서버. 로그인/session/owner_id/사용자별 allow policy 없음 | [server](../src/lib/supabase/server.ts), [0001](../supabase/migrations/0001_initial_schema.sql), [0005](../supabase/migrations/0005_add_product_options.sql) |
| SKU·가격·재고·옵션 이미지 | Not implemented | group/value 표시와 confirmed snapshot만 존재; combination 재고/가격 계약 없음 | [options schemas](../src/features/product-options/schemas.ts), [0005](../supabase/migrations/0005_add_product_options.sql) |
| Template/Theme 선택·이미지 enhancement·확장 Export | Not implemented | Templates/Settings는 placeholder, theme_id는 저장 필드만 있고 theme registry/선택 없음. AI upscale/background removal/split/PDF 없음 | [Templates](../src/app/templates/page.tsx), [Settings](../src/app/settings/page.tsx), [renderer model](../src/features/detail-renderer/model.ts) |

## 3. 미해결 backlog의 우선순위

현재 **MEDIUM 4(M1~M4), LOW 1(L1)**. L2는 TASK-034/035에서 해결·검증되어 열린 수에 포함하지 않는다. M2/M3의 부분 보완을 전체 해결로 바꾸지 않는다. 계획만으로 닫을 항목은 없다.

| 항목 | 사용자 영향·재현 조건 | 난이도 / architecture 영향 | v0.2.0 판정 |
| --- | --- | --- | --- |
| M1 인물/제품 잘림 구분 | 착용 인물 얼굴만 잘린 사진도 cropped 경고와 Hero 제외에 영향을 줄 수 있음. TASK-030 B 및 A 대표/근접 분석 기록 | 높음: 의미 구분용 평가 corpus·Asset schema/prompt·page-quality/images의 추천 정책 검토 필요. 문구 치환만으로 경고 제거 금지 | 구현 제외. TASK-037의 평가 사례로 보존하고 현재 안전 정책 유지 |
| M2 부분 타일 실패 복구 | 긴 이미지 일부 타일 실패 시 성공 후보 저장은 가능하나 재분석 비용이 전체 타일에 발생. 과거 B13/14 부분 결과로 재현 가능 | 높음: pre-NMS 타일 결과 cache, input key, metadata CAS, 중단/복구/비용 계약과 UI 필요 | **Must**. 실패 구간에만 명시적 호출, 이전 성공 보존이 핵심 |
| M3 보고체·제목/본문 반복 | TASK-035 B imageText의 ‘앞면 여밈과 포켓 구성’과 본문 ‘앞면 여밈선과 양쪽 포켓이 드러난 착용 외관.’이 같은 정보를 반복. 일부 촬영 설명은 이미 거부되지만 자연스러움은 미완료 | 중간~높음: page-quality/commerce·Planner/Section/Regeneration의 역할 계약과 실제 첫 출력 평가. 과장 카피로 채우거나 모든 명사 반복을 hard reject하면 역효과 | **Must**. 안전한 역할 분리·불필요한 visual body=null·검토 UX를 좁은 corpus로 검증 |
| M4 회색/초록 원본 경계 | A Hero crop에 공급처 장식 프레임이 남음. 원본 픽셀 문제이며 contain/cover 설정으로 해결되지 않음 | 높음: 유색 프레임과 제품 edge 구분이 불확실. trim 강화는 실제 제품 손실 위험, Derived 출처/기존 파일 영향 | 구현 제외. 최대3% 보수적 trim과 6종 crop 회귀 유지 |
| L1 sparse Section 여백 | A4개1933px/B5개2744px의 적은 텍스트와 사진 아래 여백. 빈 Section/overflow와는 구분 | 낮음~중간: 공유 Renderer의 bounded layout만 수정하되 장문/다중 이미지·860px export 회귀 필요 | **Should**. Must 통과 후 선택 TASK, release blocker로 확대하지 않음 |

전체 상세 기록은 [Release Backlog](RELEASE_BACKLOG.md). 새 Auth 기반 부재는 내부 MVP의 새 BLOCKER 발생으로 세지 않지만 **공개 배포의 blocker**다.

## 4. 세 방향 비교

TASK 수는 아래 변경 경계를 분해한 설계 추정이며 일정·인력·비용 견적이 아니다. C는 모든 기능을 한 릴리스에 넣는 안이 아니라 그중 한 vertical을 택해야 하는 후보군이다.

| 비교 기준 | A Internal Quality | B Public SaaS Foundation | C Commerce Capability Expansion |
| --- | --- | --- | --- |
| 사용자 가치 | 이미 쓰는 흐름의 불필요한 재호출·검토 부담 감소 | 여러 사용자의 로그인·데이터 격리 가능 | 특정 공급처/상품/출력 요구에 범위 확장 |
| 구현 리스크 | 중간: partial 복구/CAS와 카피 false positive | 높음: 모든 서버 읽기·쓰기·서명·capture 경계 변경 | 중간~높음: 실제 공급처 계약·조합 표현에 따라 다름 |
| DB migration 규모 | SQL 없음 목표, assets.metadata 내부 version 계약 변경 | 높음: owner FK/backfill/7테이블 권한·정책/정합성, 필요 시 quota 저장 | theme만이면 작지만 SKU라면 별도 combination/price/stock 설계 필요 |
| Security risk | 현 private/server-only 경계 유지. 새 cache 크기·유료 재호출 통제 필요 | 데이터 누출·service-role bypass·Storage·비용 남용을 함께 해결해야 함 | 공급처 secret/SSRF·가격 권한·가공 이미지 취급 범위 증가 |
| Regression risk | Extraction/후보 선택, 생성·재생성 공통 copy guard에 집중 | 전체 기능·직접 Data API·계정 간 격리에 걸침 | Options/Renderer/Export까지 선택 분야에 따라 전파 |
| AI/API 비용 | 실패 k타일만 호출, 새 AI 단계 없음. QA 호출은 별도 제한 | 정상 생성 비용은 유지되나 사용자별 quota/예약·중복 실행 제어 필요 | Adapter 호출·AI enhancement 등 선택에 따라 증가 |
| 예상 TASK 수 | 필수8개 + 선택 L1 1개 | 약10~14개: Auth/소속/정책/Storage/파이프라인/비용/Export/QA 분리 | 한 vertical 약4~8개; 전부 포함은 산정·추천하지 않음 |
| 현재 구조와 정합성 | 높음: metadata CAS/이전 성공 보존/shared renderer 재사용 | service-role factory와 process-local lock/ticket부터 구조 변경 | Adapter·tokens 확장 지점은 있으나 SKU는 현 groups와 다른 모델 |
| Monetization 연결성 | 결과 품질·유료 호출 효율 개선, 직접 과금 기반은 없음 | 계정·소유권·사용량 경계가 결제 도입의 선행 기반 | 차별화 가치 가능, 수요·공급처 사용권 검증이 먼저 |
| 공개 배포 기여도 | 공개 준비 완료로 볼 수 없음 | 가장 직접적. 권한뿐 아니라 비용·배포 운영 검증까지 통과해야 함 | Auth/ownership 부재를 해결하지 못함 |
| 주요 장점 | 실측 backlog와 좁은 변경 범위, 현재 내부 사용자에게 즉시 가치 | 공개 서비스에 필요한 경계를 근본적으로 구축 | 지원 상품/판매 채널 확대 가능 |
| 주요 단점 | 공개 SaaS blocker가 남고 M1/M4도 이월 | 광범위한 migration/backfill·보안 QA, 품질 backlog는 별도 | 실사용 양성 사례/권한 없이는 추정 개발, scope 팽창 위험 |

**A를 선택한다.** 현재 요청은 공개 출시가 아니라 다음 범위 정의이며, M2/M3는 실측 근거가 있고 기존 내부 MVP 목적에 직접 연결된다. B를 얇은 로그인 기능으로 축소해 A와 섞지 않는다. 외부 공개가 다음 사업 목표로 결정되면 A 구현 전에 이 우선순위를 재검토하고 B를 독립 릴리스로 승인받아야 한다.

## 5. v0.2.0 scope와 완료 기준

### Must Have

1. **M2 실패 타일 복구**: 동일 입력에 완료된 타일을 다시 호출하지 않는 명시적 재시도. durable bounded cache, 충돌·중단·legacy 처리, 이전 성공 결과/저장 Derived 보존을 포함한다.
2. **M3 근거 있는 역할 분리**: 제목을 되풀이하는 본문·촬영 설명형 문구의 원인 corpus, 보수적인 deterministic 검증/검토와 기존 생성 prompt 개선. 추가 정보가 없는 visual body는 null을 허용한다. 모든 자연어 중복을 자동 해결한다고 약속하지 않는다.
3. **검토 가능한 UI와 회귀/실제 QA**: 재사용 타일/예정 호출 수/입력 변경/실패 상태와 copy 검토 이유를 구분. 후보 적용·옵션 저장 등 기존 명시적 변경 경계 유지. 2종 상품의 실제 첫 출력 및 canonical Export 검증으로 완료 여부를 판단한다.

릴리스 gate: cache hit 완료 타일 provider 호출0, 실패 대상당 명시 실행1회 이하, CAS/지문 불일치 호출 차단, 실패 시 이전 성공 보존; 정해진 copy corpus의 안전성 회귀0; 실제 QA의 근거 없는 새 주장0/촬영 설명 hard violation0/제목 의미 불일치0/동일 정보만 반복하는 제목·본문 쌍0. 미달하면 NEEDS_WORK로 남기고 무제한 재생성으로 PASS를 만들지 않는다. M2/M3 종료는 각각 이 계약과 실제 QA 근거가 확보된 뒤에만 기록한다.

### Should Have

- L1의 제한된 sparse layout 조정. 같은 canonical data에서 전후 비교하고 장문/큰 이미지 회귀가 없을 때만 포함한다.
- 위 두 핵심 흐름의 상태·오류·재시도 문구 개선. 범용 작업 관리 시스템이나 새 telemetry 저장 시스템은 추가하지 않는다.

### Out of Scope

Auth/공개 배포/owner_id/RLS 변경, M1 의미 분류 모델 변경, M4 유색 프레임 제거, 새 Adapter, SKU/가격/재고/옵션 이미지, AI upscale/배경 제거, Theme 선택, 분할/PDF/시장별 출력, 프로젝트 전체 CRUD 확대, 추가 AI pass·자동 유료 retry, 기존 데이터 일괄 재작성. 기존 Facts/Options·원본 이미지·기존 저장 Section을 품질 정리 목적으로 자동 수정하지 않는다.

## 6. M2 architecture 제안 — 완료 타일 cache

### 현재 원인

`detail-extraction/service.ts`는 타일별 validated regions를 메모리 `entries`에 합친 다음 전체 `normalizeCandidates`로 중복 제거·최대24개를 적용해 저장한다. 실패 index와 완료 수는 있으나 **cap 이전 성공 타일 출력은 DB에 없다**. force=false는 같은 기존 partial result도 재사용하고, force=true는 전체 타일을 다시 분석한다. 최종24개와 `tileIndices`로 원래 성공 타일 전체를 복원할 수 없다.

### 저장/입력 계약

- 기존 `assets.metadata.detailExtraction`의 versioned state에 optional tile cache를 설계한다. 현재 state v1 및 result v1/v2를 읽는 compatibility를 유지하고 새 writer는 명시적인 새 state version을 사용한다. result/provider schema와 cache/state version을 독립적으로 관리한다.
- cache key는 source bytes SHA-256, orientation 정규화 dimensions/좌표계, product context fingerprint, 실제 tile rect/layout, tiling·relevance·normalization·prompt policy version, provider model 식별자와 output schema version을 포함한다. 같은 모델 이름의 공급자 내부 변경을 완전히 추적할 수 있다고 주장하지 않는다. 정책 변경 때 명시적 version으로 무효화한다.
- **검증된 pre-NMS 타일 regions**를 저장한다. 최대16타일×8regions=128, 한 입력 세대의 cache만 유지한다. 이미지 bytes/base64/signed URL/raw provider response/전체 prompt는 저장하지 않는다.
- 제안 상한은 cache UTF-8 JSON **256KiB**다. 현재 존재하는 제한이 아니다. TASK-037/038에서 모든 bounded string 최악값을 측정하고 상한 초과를 명시적으로 거부한다. cache를 조용히 잘라 놓고 재사용 가능한 것으로 취급하지 않는다. 전체 metadata payload/DB 쓰기 지연도 측정한다.
- 최신 성공 결과와 진행 중 cache를 구분해, 새 전체 분석이 실패해도 이전 성공을 유지한다. 진행 cache는 한 세대만, 성공 결과는 기존 latestResult만 보존하며 무한 history를 추가하지 않는다. SQL/new table/새 Storage object는 기본안에 없다.

### 실행/충돌/비용 계약

1. 서버가 source/소속/cache key/revision을 재검증하고 재시도 가능한 실패·미완료 타일 집합을 산출한다. 요청은 expected revision/key와 명시적 실행 의사만 전달하며 임의 URL/rect/tile 이미지 입력을 받지 않는다.
2. 현재 global 동시 실행·제품 lock·DB revision/lease를 유지한다. 각 성공 타일을 metadata CAS로 checkpoint하며 다른 namespace를 merge한다. 완료 타일의 regions=[]는 유효한 성공이고 실패와 구분한다.
3. pending/in-flight/completed/failed 및 결과 확인 불가를 구분한다. 중단된 in-flight는 과금 여부 미확인일 수 있으므로 추가 호출 전에 안내한다. 네트워크 timeout 이후 공급자가 과금했는지 모르는 상태에서 exactly-once를 보장하지 않는다. 저장 재시도가 AI 재호출을 유발하지 않게 한다.
4. 실행 전 예정 호출 수 k를 표시하고, 해당 명시 실행에서 대상당 최대1회·자동 retry0. 입력 변경/유효 cache 없음은 ‘실패 구간만’ 실행을 거부하고 새 전체 분석의 비용을 따로 안내한다.
5. 성공 cache와 신규 성공 결과를 결정된 tile 순서로 합쳐 **전체 NMS/cap을 한 번** 수행한다. publish 전 source/context/key/runId를 재검증한다. 전체 재시도 실패는 latestResult 보존, 일부 성공은 새 partial 결과와 남은 실패를 표시한다.
6. 같은 source/rect/role의 candidate ID는 유지한다. NMS/cap 때문에 후보 구성이 달라질 수 있으므로 기존 체크 선택은 ID 기준으로만 이어가고 새 후보를 몰래 선택하지 않는다. 이미 저장한 Derived Assets와 수동 편집 내용은 재시도로 삭제/수정하지 않는다.

### Legacy와 rollback

기존 v1/v2 결과에 cache가 없으면 과거24개로 성공 타일 cache를 추측 생성하지 않는다. 읽기·선택 저장은 기존대로 제공하고, 사용자가 비용을 보고 한 번 전체 분석해야 새 cache가 생긴다. 조회만으로 데이터나 AI 실행을 바꾸지 않는다. 새 reader가 legacy를 읽는 것과 **옛 binary가 새 state를 읽는 것**은 다르다. compatibility reader를 먼저 준비하고 writer 출시·rollback 절차를 검증한다. 새 metadata를 파괴적으로 지워 rollback하는 방안은 채택하지 않는다.

예상 변경 모듈(후속 TASK): `detail-extraction/{schemas,policy,service,client}.ts`, 새 cache/key/merge helper와 관련 API request 계약, `components/extraction-panel.tsx`, `assets/metadata.ts`의 호환성 검사 및 tests. 이번 TASK에서는 변경하지 않는다.

## 7. M3 architecture 제안 — 카피 역할과 근거

- TASK-035 실제 제목/본문 쌍과 A/B 촬영 설명 사례, 정상적인 동일 제품 명사 반복·스펙·옵션 값을 함께 corpus에 고정한다. 출처가 있는 최소 발췌만 저장하고 secret/전체 provider 응답을 fixture로 넣지 않는다.
- 현 `page-quality/commerce.ts`, title relevance, message signature를 공통 판정 경계로 재사용한다. 먼저 원인과 false-positive 사례를 확인하고 명백한 동일 문장·무정보 재진술만 좁게 판정한다. 단순 단어 겹침 비율로 모든 문장을 hard reject하지 않는다.
- Planner는 Section별 목적·서로 다른 visual 근거를 배분하고 Section/Regen은 제목과 다른 추가 근거가 없으면 허용된 visual body=null을 사용한다. 실제 F/V evidence 밖의 효과·성능·사용처 사실을 만들어 분량을 채우지 않는다.
- 전체 생성·candidate-first 재생성에는 동일 공통 검증과 prompt 정책을 적용한다. 기존 수동 편집·저장된 legacy 문구에는 검토 이유를 표시하되 자동 치환/삭제하지 않는다. null로 바꾸는 작업도 기존 편집·저장 흐름의 명시적 사용자 변경이다.
- 정책 version을 Plan fingerprint에 포함해 이전 Plan의 stale를 설명한다. 정책만 바뀌었다고 자동 Planner/Section 실행이나 기존 canonical rewrite를 하지 않는다. 새 AI 평가 pass, semantic judge API, 자동 재생성은 추가하지 않는다.

예상 변경 모듈: `page-quality/{commerce,policy}.ts`, Planner/Section/Regen prompts 및 기존 grounding 경계, Editor/Renderer 검토 UI와 tests. Factual content, option/spec canonical 값은 prose detector에서 계속 제외한다.

## 8. DB / Storage / Auth 영향

### 권장 A의 DB·migration·Storage

- 현 SQL 마지막은 **0005_add_product_options.sql**, 테이블은 초기6개+product_options=7개다. 0002~0004는 JSONB 컬럼 추가다. 이미 적용된 migration은 수정하지 않는다.
- A는 기존 metadata JSON object 내 cache/state 계약으로 구현하므로 **예상 SQL migration0**. package/DB generated types를 schemaVersion 변경과 혼동하지 않는다. 측정 결과 별도 table이 필수라면 기존 승인 범위를 확대하지 말고 설계를 재검토한다.
- 추후 B 등 SQL이 필요한 작업 시 현재 번호를 다시 확인한다. 지금 저장소 기준 다음 사용 가능 번호는 **0006**이며 이번 계획에서 파일을 생성하거나 번호를 예약하지 않는다.
- private `product-assets`의 기존 project/product/서버UUID 경로, 실제 MIME 확장자, 5분 signed URL, Source/Derived 독립 삭제를 유지한다. cache는 JSON metadata이므로 새 이미지나 bucket을 만들지 않는다.
- 동일 crop 재저장은 기존 parent/hash/rect를 재사용하고, DB commit 불확실 시 object를 지우지 않는 cleanup을 유지한다. 조회·재시도로 기존 Asset을 일괄 재가공하지 않는다. A에는 사용자 ownership 추가가 없으므로 공개 배포 차단도 그대로다.

### Public SaaS blockers — 현재 확인과 B의 선행 설계

1. **Authentication**: `createSupabaseServerClient`는 service-role을 사용하며 session persistence/refresh를 끈다. 인증 UI·request session·user client가 없고 프로젝트 목록은 전체 조회다. Same-Origin/UUID/소속 검사만으로 요청자의 사용자 권한을 증명할 수 없다.
2. **owner_id**: 7테이블에 사용자 소유권이 없다. 제안은 `projects.owner_id → auth.users.id`를 소유권 root로 두고 index/FK를 추가하는 것이다. 기존 Project→Product→Facts/Options/Assets 및 Project→DetailPage→Sections를 통해 소속을 판정한다. 계정 삭제 시 DB cascade만으로 Storage 정리가 끝나지 않으므로 계정 삭제 정책·파일 정리부터 확정한다.
3. **사용자별 RLS**: 지금도 RLS는 켜져 있으나 anon/authenticated 권한을 revoke했고 사용자 allow policy가 없다. 서버 service-role은 RLS를 우회한다. B에서는 grants와 각 SELECT/INSERT/UPDATE/DELETE policy를 함께 설계해야 한다. [Supabase RLS 공식 문서](https://supabase.com/docs/guides/database/postgres/row-level-security).
4. **Storage ownership**: bucket이 private인 것만으로 앱의 service-role 서명 endpoint가 사용자 격리를 보장하지 않는다. 요청 user→project→product→asset→path 검증이 모든 읽기/서명/삭제/업로드에 필요하다. 기존 service-role 업로드 object의 owner 정보만 사용자 소유권으로 신뢰하지 않는다. [Storage access control 공식 문서](https://supabase.com/docs/guides/storage/security/access-control).

**B의 migration/backfill 제안(이번 구현 아님):** nullable owner 컬럼부터 준비하고 사전에 승인된 기존 Project→사용자 mapping으로 backfill한다. 최초 로그인 사용자에게 모든 기존 데이터를 자동 귀속하지 않는다. 미매핑 데이터는 사용자 접근을 차단한 상태로 남기고 건수/관계 검증 후 NOT NULL을 적용한다. 기존 UUID/path는 유지하는 안을 우선한다. assets의 project_id/product_id가 각각 FK라는 점만으로 같은 Project 소속이 보장되지는 않으므로 실제 불일치 preflight 후 composite 관계 또는 동등한 DB 제약을 설계한다. 소유권/부모 FK의 임의 재지정도 막는다. 단계별 rollback·기존 데이터 보존·두 사용자 공격 테스트를 통과하기 전 공개하지 않는다.

**B의 client/session 제안:** Supabase Auth cookie 기반 request-scoped user client와 제한된 maintenance용 privileged client를 분리한다. browser client는 우선 Auth에만 사용하고 endpoint/service 전체에 검증된 사용자 context를 전달한다. 현 내부 helper가 client를 새로 생성하는 지점까지 바꿔야 하며 바깥 Route만 바꾸면 service-role bypass가 남는다. 현재 Next16의 Proxy 기반 session 갱신 설계는 설치된 Next 문서와 [Supabase SSR 공식 문서](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)를 구현 시 다시 대조한다. Proxy는 각 endpoint의 인증·소유권 검사 대체물이 아니다.

**B에서 함께 해결할 경계:**

- 사용자 RLS만으로 AI/validation/snapshot 결과의 서버 검증을 강제할 수는 없다. authenticated에 모든 컬럼 쓰기를 허용하면 자기 데이터라도 Data API 직접 호출로 canonical 계약을 우회할 수 있다. 사용자 편집과 서버 전용 결과 쓰기를 분리한 column grants/좁은 RPC 또는 검증된 서버 gateway 계약을 먼저 선택한다. 브라우저 UI에서 SDK를 쓰지 않는 것만으로 직접 REST 접근이 막히지 않는다.
- 현재 Import ticket은 process-local Map, 옵션 ticket은 process-local secret 기반이며 project/version에 묶여 있다. user binding·서버 재시작·다중 instance/공유 cache 전략이 필요하다. 재생성 candidate의 서명 키도 service-role key에서 유도되므로 별도 목적 키/rotation/user scope를 검토한다.
- 현재 Export browser는 새 cookie-less context로 Renderer를 연다. Auth 도입 시 한 user/project/input fingerprint에 한정된 짧은 capture 권한을 설계해야 한다. render route를 익명 공개하거나 다른 host에 광범위한 사용자 cookie를 넘겨 해결하지 않는다.
- signed URL은 만료 전 bearer 접근이 가능하다. 로그·영구 저장 금지와 짧은 TTL을 유지하고 logout이 이미 발급한 URL을 즉시 취소한다고 안내하지 않는다.
- 메모리 Set 동시 실행 제한은 사용자별 quota나 분산 비용 제어가 아니다. 공개 전에 사용량 예약·실패 정산·중복 실행·CPU/Chromium 자원 상한과 secret rotation/운영 대응을 검증한다.

## 9. AI pipeline 영향

| 단계 | A의 변경 여부 / 보호 계약 |
| --- | --- |
| Extraction | cache/checkpoint/실패 타일 명시 재호출을 추가. 기존 한 타일의 Vision 요청 구조를 재사용하고 새 AI 단계 없음 |
| Asset Analysis | 변경 없음. cropped 의미 구분(M1)은 이월; 새 Derived를 저장해도 사용자 요청 없이 후속 분석하지 않음 |
| Product Analysis | 변경 없음. F/V/S evidence와 전략 분리 유지 |
| Fact Validation | 변경 없음. supported를 외부 진실 인증으로 확대하지 않음 |
| Planner | Section 목적·title/body 역할 prompt 및 policy fingerprint 개선. 한 번의 기존 요청을 유지 |
| Section Engine / Regeneration | 공통 copy 계약 보완, strict/Zod/grounding 유지. 실패 시 이전 성공 보존, 후보 명시 적용, 자동 retry 없음 |

AI 비용 감소 목표는 M2의 재사용 가능한 성공 타일에 한정된다. 전체 생성 단가·토큰 수·총비용 절감률은 측정하지 않았으므로 수치를 약속하지 않는다.

## 10. Commerce 확장성 — v0.2.0 제외, 후속 설계 근거

### Options / SKU / 가격·재고 / 옵션 이미지

현재 `groups[{id,name,values[{id,label}]}]`와 confirmed snapshot/version은 표시용 독립 그룹에 적합하다. 도매매 67695797의 ‘아이보리90’ 등 6개 값은 한 그룹 그대로 보존한다. API inspection은 현재 완전 조합/노출·판매 상태를 보수적으로 확인한 경우만 단순 모델 반영을 허용한다. status의 confirmed_none 타입은 존재하지만 현재 판정 구현이 누락/null 값을 이 상태로 반환하지는 않는다.

향후에는 기존 group/value UUID를 참조하는 **명시적 허용 combination ID와 value ID tuple**을 별도 모델로 두어야 한다. 모든 Cartesian 조합이 판매 가능하다고 생성하지 않는다. 공급처 stable option/SKU ID, 가격의 통화·권한·관측 시점, 재고 상태/unknown·조회 시점·유효 기간, 실제 Asset을 참조하는 option image를 별도 계약으로 설계한다. 현재 import bindings는 name/label 기반 UUID 재사용이므로 공급처 label 변경을 stable supplier ID 매핑으로 간주할 수 없다.

사용자 수정·삭제와 원본 snapshot을 분리하고 재가져오기 diff→검토→명시 CAS 저장을 유지한다. Product/Options 저장 성공·실패는 독립적으로 표시한다. 가격/재고는 Fact의 영구 보장이나 AI 추정값으로 저장하지 않는다. Planner/Section snapshot에는 지원 version만 반영하고 구버전이 미지원 조합을 평탄화하지 않게 한다. 이 영역은 실제 양성 API 사례·이용 권한·새 DB 모델을 먼저 확보할 후속 backlog다.

### Image enhancement

- **현재:** 저해상도는 intrinsic1.5배 cap으로 과도 확대를 제한한다. crop은 원본 실픽셀/보수적 최대3% trim이고 유색 경계는 남길 수 있다. 알고리즘이 없는 디테일을 복구했다고 보지 않는다.
- **Deterministic 후보:** 표시 크기·보수적인 resampling/색 처리/비파괴 파생본을 별도 실험 가능. 픽셀 변화가 없어도 placement 개선과 실제 해상도 향상을 구분한다. 현 crop provenance의 의미를 바꾸지 말고 새 derivation kind/schema로 transform parameters/원본 hash/출력 dimensions를 보존한다.
- **AI upscale / background removal:** 별도 승인·사람 검토가 필요한 변형이다. 로고/봉제선/색/형태/투명 부분을 바꿀 위험, provider 이용 조건·비용·private 전달 경계를 먼저 평가한다. 원본 대체나 기존 Fact 근거 승격 금지. 가공 이미지에서 생긴 디테일을 새 V/F 증거로 순환 사용하지 않는 정책이 필요하다.
- A에서는 이들 변형을 구현하지 않는다. M1/M4를 이미지 생성으로 숨기지 않는다.

### Template / Theme

현재 shared Renderer의 bounded style과 `visual-system.ts`를 재사용할 수 있다. `detail_pages.theme_id`가 있다는 이유만으로 Theme 기능이 완성된 것은 아니다. 후속안은 application-owned registry의 versioned theme ID와 허용 typography/spacing/palette/layout tokens다. AI raw CSS/HTML/px/hex/Tailwind 문자열은 계속 금지한다. 저장 theme token과 runtime hero/count mode를 분리하고 legacy default를 유지하며 같은 canonical로 Editor/Final/Export를 검증한다. A에는 theme chooser·새 preset이 없다.

### Export 확장

기존 canonical article/capture/fingerprint를 재사용할 수 있다. Split은 현재 높이·메모리 한도를 무작정 올리지 않고 Section/옵션 그룹 분할 경계와 긴 단일 이미지 전략부터 정해야 한다. 시장별 크기는 허용된 폭·화질 preset으로 설계하고 현재860px 기준은 계속 검증한다. PDF는 동일 Renderer를 사용하더라도 페이지 나눔·font embedding·이미지/한글·출력 크기 QA가 별도로 필요하다. ‘PNG capture를 사용한다’는 이유만으로 모두 구현된 것으로 보지 않는다. A의 Export 기능 변경은 없고 PNG/JPG가 회귀 gate다.

### Wholesale Adapter

실제 `ImportAdapter`는 `id`, `matches(URL)`, `extract(html,url,rendered?) → ImportCandidate`이며 resolver는 Generic 하나다. 도매매 공식 API 옵션 client/inspection은 별도 server-only 경로다. 새 HTML Adapter는 공통 secure fetch가 얻은 자료만 parse하고 Generic보다 앞에 등록한다. 네트워크·보안 검사를 각 parser에 복제하지 않는다.

공식 API 공급처는 고정 허용 endpoint/인증/오류·호출 제한을 가진 별도 provider→typed normalized candidate로 연결하는 편이 적절하다. HTML parser interface를 억지로 API fetch interface로 바꾸지 않는다. 후보에는 source product ID, provenance, supported/unverified/restricted 등 상태와 capability를 명시하고, 확정 Facts/Options의 명시 저장 경계는 공통 domain에 남긴다. 공급처 가격·옵션 규칙이 Core에 침투하지 않게 한다. 실제 자료/이용 조건/양성 상품이 없는 사이트 구현과 AI/OCR 추정은 이번 범위 밖이다.

## 11. 실행 TASK와 의존 관계

아래 번호는 계획이며 개별 TASK 착수·파일 생성·기능 구현을 의미하지 않는다. 코드 작성 때 관련 docs/설치된 Next 지침을 다시 확인한다. **필수8개(037~043,045), 선택1개(044)**로 분해한다.

| TASK | 목표·dependency | migration / 실제 external API | 완료 조건 |
| --- | --- | --- | --- |
| TASK-037 M2/M3 재현 corpus와 계약 확정 | TASK-036 기반. 기존 partial/legacy cache 부재와 실제 제목·본문 반복/정상 문장을 최소 fixture로 정리, bounds·QA 판정 기준 확정 | 없음 / 없음 | 현재 실패를 재현하는 mock과 정상 negative 사례, cache 최악 크기·호출 수 계약·실제 QA 대상/예산을 문서화 |
| TASK-038 Tile checkpoint/cache domain·persistence | 037 동결 계약 후. backward reader, versioned cache key, per-tile validation/merge/NMS와 bounded metadata checkpoint/CAS 경계 구현; provider retry는039로 분리 | 없음 목표 / 없음 | v1/v2 읽기·empty success·deterministic merge·byte/JSONB 상한·policy/model/source 변경 무효화·경합/rollback reader 테스트 통과 |
| TASK-039 실패 타일 재시도 서버 | 038 후. checkpoint/CAS/runId/lease와 명시 retry endpoint를 기존 service에 연결 | 없음 / 자동 tests는 mock만 | 완료 타일 호출0, 대상당1이하, interruption/경합/stale 차단, 전체 실패 시 이전 결과·metadata·Derived 불변 |
| TASK-040 복구 UI 연결 | 039 후. 실패/미완료/재사용/비용 미확인·예정 호출·legacy 전체 분석 안내와 candidate 선택 보존 | 없음 / mock·로컬 browser만 | reload/중단/저장/재시도 실패에서 draft·선택·이전 성공 보존, 숨은 AI 호출0 |
| TASK-041 Copy 역할 정책 | 037 후, 권장 실행은040 다음. 공통 deterministic 판정·prompt·policy fingerprint 개선 | 없음 / mock만 | corpus의 명확한 반복/촬영 설명 판정, 정상 카피·스펙·옵션 false positive 회귀0, 추가AI pass0 |
| TASK-042 Copy 검토 UX | 041 후. 기존 Editor/후보 비교·review 경계에 이유 표시, null body의 명시 편집 확인 | 없음 / mock·로컬 browser만 | legacy 자동 수정0, 사용자 draft/CAS/후보 적용 보존, 검토 경고가 Export article에 들어가지 않음 |
| TASK-043 실제 AI·복구 통합 QA | 040/042 후. 2상품 첫 출력, 제한된 실제 타일 복구, 동일 canonical PNG/JPG 및 기존 데이터 보호 검증 | 없음 / 승인 범위의 최소 OpenAI; 신규 Import가 필요한 경우만 공식 API | 아래 호출 예산·품질 gate와 전체 회귀 통과, mock/replay/실호출 구분 보고; 미달 시 NEEDS_WORK |
| TASK-044 선택 L1 sparse spacing | 043 Must 통과 후 선택. 원인 확인된 sparse variant의 bounded CSS만 | 없음 / 없음 | 같은 canonical 전후와 장문/다중 사진/옵션/860px PNG/JPG 비교 통과; 실패하면 이 TASK만 이월 |
| TASK-045 v0.2.0 Release 검증·문서 | 043 및 채택한044 후. 최종 전체검사·freeze·release notes·환경/롤백 기록 | 없음 / 원칙0, 새 회귀가 있으면 별도 최소 승인 | 남은 backlog 정직한 상태, B/H0과 scope gate, 보안 불변 확인. 실제 release 직전에만 package version 변경; commit/merge/tag는 별도 요청 |

순서: **원인·계약037 → 순수 로직038 → 서버039 → UI040 → copy 정책041 → 검토UI042 → 실제QA043 → 선택044 → release045**. 위험이 큰 DB/보안 변경을 앞부분에 몰아넣지 않는다. 043에서 문제를 찾으면 해당 모듈 TASK로 돌아가고 다른 Commerce 기능을 추가하지 않는다.

## 12. 검증·호출·데이터 보호 계획

### 불변 조건 회귀

| 유지 항목 | 필수 검증 |
| --- | --- |
| Facts / AI separation | cache/prompt/retry 전후 facts/source_snapshot/Product Analysis 비교; V/전략으로 F 생성·수정0 |
| Options immutability | 1그룹6값의 UUID/label/순서/confirmed snapshot 그대로; stale 시 명시 최신 반영만 |
| Private assets | 기존 소속/path 검증·5분 서명·no-store, URL 영구 저장0, remote image SSRF/DNS/redirect/10MiB 회귀 |
| Derived provenance | parent/hash/rect/trim 보존, 같은 영역 재저장 중복0, source bytes 불변·불확실 commit 파일 보존 |
| Relevance guard | 무관 제품/illustration/diagram/mixed/unknown 기본 선택 금지 회귀, 수동 예외는 명시 경계 유지 |
| V-only guard | 시각 근거만으로 재질/성능/효과/보장 claim 생성 차단 |
| Meta-observation guard | 촬영 설명/관찰 보고체의 기존 hard 검증과 정상 문장 negative corpus |
| Title relevance | 이미지·Section 목적과 제목 의미 일치, 동일 제품 명사 재사용의 정당한 경우 보호 |
| Candidate-first regeneration | 새 후보가 canonical을 바꾸지 않음, 만료·입력 변경·CAS 충돌 거부, 명시 적용만 |
| CAS | cache checkpoint와 Asset Analysis 경합/lease 만료/늦은 결과/중단/재시도/all fail, 다른 metadata namespace 보존 |
| Deterministic renderer | 같은 canonical/style의 Editor/Final/Export 동일 배치, saved style/legacy 읽기 보존, 경고는 article 밖 |
| 860px export | PNG/JPG header 폭860·높이/첫끝 Section/옵션/모든 이미지/긴 한글 확인, UI·review 문구0 |

### M2/M3 집중 테스트

- M2: 16×8 bounds/over-cap/잘못된 geometry, 빈 성공 타일, legacy cache 없음, key 전 구성요소 변경, 실패0/1/전부, cache 저장 전후 중단, unknown billing 상태, runId 경쟁, candidate 선택 재조정과 기존 저장 crop 보호. SDK/전송 mock의 실제 호출 수를 assert한다.
- M3: 실제 짧은 반복 쌍·정상 추가 정보·동일 명사지만 다른 의미·긴 한글·null body, F/V/옵션/스펙의 각 경계, 전체 생성/재생성/수동 저장/legacy 경고 차이를 검사한다. corpus 외 모든 카피의 안전성을 증명했다고 쓰지 않는다.
- Crop 6종(흰 테두리·얇은 회색·제품 edge·인접 글자·여러 panel·clean crop), 기존 상품/이미지 Import·공식 옵션·수동 편집·재생성·순서 변경 tests를 유지한다. 전체 test 기준은 이전865개이며 새 tests가 붙은 실제 실행 총수를 릴리스 시 기록한다.

### 실제 QA 호출 계획 — 지금 호출 아님

- A67399861/B67695797의 이미 허용된 실제 자료를 우선 재사용한다. 양성 옵션 B의1그룹6값과 서로 다른 상품 유형을 확인한다. 각 상품 **Planner1회+Section1회**, 총4회 첫 출력을 평가하고 자동 재시도하지 않는다. 재생성 실검증이 필요하면 별도 명시된1회만 추가하고 결과/이유를 기록한다.
- M2는 실제 source 1개, 타일 N≤16을 기준으로 한 대상 타일을 테스트 전송 경계에서 보내지 않아 의도된 partial 상태를 만든 뒤 해당 타일1회만 실제 호출하는 QA를 계획한다. 나머지 N−1 완료 타일의 재호출0을 확인한다. 총 provider 호출≤N이며 임의 provider 장애를 실제 발생했다고 보고하지 않는다. 실제 transient timeout·과금 확정 여부는 mock/중단 회귀와 구분한다.
- 기존 재사용 가능한 새 cache가 확보되어 있다면 QA 호출은 더 줄인다. legacy 결과를 cache가 있는 것으로 위조하지 않는다. actual tile output을 fixture로 영구 보존할 경우 최소 필드·이용 조건·출처만 확인한다.
- upstream이 최신·유효하면 Product/Asset Analysis/Validation·공식 API 재호출은 하지 않는다. 필수 입력이 stale/부족하면 테스트 시작 전에 단계별 추가 호출 수를 다시 산정하고 범위를 명시한다. 도매 API는 신규 수집이 필요한 상품당1회 순차, 인증/권한/제한 오류 시 중단한다.
- unique QA Project/ID 목록으로 작업하고 기존 row hash/Storage 목록을 전후 대조한다. QA 데이터만 명시적으로 정리하며 사용자 데이터는 보존한다. release QA는 fresh install/DB 설치·공개 권한 테스트를 수행하지 않았다면 별도 미검증으로 남긴다.
- 자동 tests는 mock만, 실제 QA는 별도 실행이다. 필수 검사: 프로젝트 기존 테스트 실행 방식, `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check`. 키·signed URL·raw provider 오류는 fixture/log/report에서 제외한다.

## 13. 버전·보안·승인 경계

이번 계획에서 package/lock는 **0.1.1 그대로**다. 후속 실제 릴리스 직전에만0.2.0으로 변경한다. Facts/Options의 optimistic concurrency version, extraction/cache/provider의 schemaVersion, 정책 fingerprint version, 앱 semver는 서로 다른 역할이다. 하나를 올린다고 다른 값을 일괄 올리지 않는다.

A의 주요 위험은 cache 입력 불일치에 따른 잘못된 재사용, checkpoint 경합으로 다른 metadata 유실, 숨은 중복 비용, copy guard false positive다. 이 때문에 계약→순수 로직→서버→UI→실제 QA 순서를 고정한다. 보안 한도·same-origin·서버 키 경계는 약화하지 않고 공개 SaaS는 계속 금지한다.

다음 권장 작업은 **TASK-037 — M2/M3 재현 corpus와 계약 확정**이다. 이 roadmap 자체는 기능 구현, 실제 API 호출, migration 또는 공개 배포에 대한 포괄 승인으로 취급하지 않는다.
