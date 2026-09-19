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

## 상품 AI 경계 (TASK-009)

- Product Facts와 전략 해석을 분리한다. 완료된 Asset 관찰만 사용하고 이미지/Storage 서명을 다시 요청하지 않는다.
- F/V/S evidence registry, snapshot, canonical SHA-256 fingerprint는 서버가 만든다.
- strict 결과 검증 후 모든 evidenceId가 실제 registry에 있는지 검사한다. 근거 존재 검사가 의미의 사실성을 보장하지 않는다.
- 제품 분석은 products.ai_analysis만 쓴다. raw_data/Facts/source_snapshot/validated_at/Project status를 변경하지 않는다.
- 재분석 실패는 attempt만 실패로 저장하고 latestResult를 보존한다. 입력 변경은 stale로 표시하고 사용자 실행을 기다린다.

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

## Export 규칙 (TASK-017)

- Final Renderer의 단일 article surface를 캡처한다. 별도 HTML/CSS나 DOM canvas 대체를 만들지 않는다.
- browser/provider/service는 server-only. trusted origin을 서버 설정으로 제한하고 사용자 URL/Host로 구성하지 않는다.
- deviceScaleFactor=1/scale=css, persisted width와 실제 PNG/JPEG header dimensions를 검증한다.
- document.fonts.ready와 이미지 complete/naturalWidth/decode를 bounded timeout으로 확인한다.
- 전체 timeout, 실제 DOM 크기 상한, 요청당 browser finally close, 동시 실행 제한을 유지한다.
- canonical 입력 fingerprint를 전후 비교한다. Export는 Facts/Sections/Plan 등 DB·Storage에 쓰지 않으며 AI를 호출하지 않는다.
- signed URL은 임시 사용만 한다. UI/로그에 provider 오류·서비스키를 노출하지 않는다.
- 단위 테스트는 capture provider mock 사용; 실제 브라우저 파일 signature/폭/높이/한글·이미지 확인은 통합 검증에서 수행한다.
- 브라우저 버전/OS 글꼴/배포 메모리·실행시간 차이를 문서화한다. PNG/JPG 이외 범위는 별도 TASK로 처리한다.

## Wholesale Import 규칙 (TASK-018)

- Preview-first. Candidate는 Fact가 아니며 사용자의 명시적 확인 저장만 기존 Product/Facts persistence로 전달한다.
- 사이트별 코드는 Adapter에 둔다. Generic deterministic extraction부터 사용하고 AI 추측을 추가하지 않는다.
- URL 입력은 public IP/DNS/redirect/연결 IP 고정 경계를 통과해야 한다. 이미지와 모든 browser subresource도 동일하다.
- HTTP-first, 필요 시에만 server-only browser fallback. Export provider에 DOM 추출을 섞지 않는다.
- MIME/timeout/압축 전후 크기/요청 수를 제한한다. 로그인/CAPTCHA/anti-bot/rate-limit 우회를 구현하지 않는다.
- raw HTML/DOM을 Client/DB에 반환·저장하지 않는다. normalized source provenance와 confirmed Facts를 분리한다.
- 상품 저장 성공 후에만 선택 이미지를 기존 Asset service로 가져온다. 미분류, UUID 경로, metadata 보존, 중복 검사, INSERT 실패 cleanup을 유지한다.
- 자동 테스트는 HTML fixture/mock network를 사용하고, 실제 공개 URL·Supabase 검증 자료는 작업 후 정리한다.

## Fact normalization 규칙 (TASK-019)

- 원문 추출과 Fact 저장은 별개다. Candidate/raw_data/source_snapshot/provenance에서 placeholder를 삭제하지 않는다.
- 최종 사용자 입력 → `toManualFacts` 경계에서 공통 `products/fact-normalization.ts` helper를 사용한다. 수동/Import/UI에 dictionary를 복제하지 않는다.
- bounded 목록은 정규화 후 전체 값으로 비교한다. substring 제거, OCR/AI 보충, 유사 label 병합, 충돌 실제 값 삭제를 하지 않는다.
- 빈 값·구두점만 있는 값·명시 placeholder는 spec pair 전체를 제외한다. 0/0W와 의미 있는 내부 slash·문장은 유지한다.
- 원래 placeholder라도 최종 override가 실제 값이면 Fact로 저장한다. 원래 추출값은 provenance에 유지한다.
- legacy row는 읽기만으로 수정하지 않는다. source-only 수정이 Validation fingerprint를 바꾸는 기존 stale 정책을 보존한다.
- 목록 확장은 실제 source 사례와 회귀 테스트로 제한한다. UI는 공통 helper의 판정만 표시한다.

## Product Options 규칙 (TASK-020)

- Options는 Specifications/Facts와 분리한다. source_snapshot과 confirmed groups를 구분하며 AI로 선택값을 발명하지 않는다.
- Product가 존재하고 Project/Product 관계가 일치해야 저장한다. UI의 ID만 신뢰하지 않는다.
- Product당 row1개 UNIQUE와 version CAS를 사용한다. 전체 삭제는 빈 groups UPDATE이며 오래된 revision을 재사용하지 않는다.
- group/value는 stable UUID, 배열 순서는 표시 순서다. index를 영구 식별자로 쓰지 않는다.
- schema bounds/중복/placeholder 규칙은 공통 계층에서 검사한다. Fact helper의 없음/X를 옵션에서 무조건 삭제하지 않는다. slash를 자동 분할하지 않는다.
- Product 저장과 별도 explicit Options save를 사용하며 실패 시 draft를 보존한다. 내부 DB 오류와 service-role 키는 비공개다.
- Adapter options는 optional 후보 boundary일 뿐 자동 저장하지 않는다. 후속 명시적 확인·출처·CAS 계약을 통해 연결한다.

## Product Shot Extraction 규칙 (TASK-024)

- Sharp/OpenAI/Storage는 server-only. Source는 검증된 Project→Product→Asset ID와 private 경로로만 읽는다. 요청 body의 URL/파일 경로/rect를 수용하지 않는다.
- 입력10MiB, decoder40MP, 최대 폭6000/높이60000, 타일16/후보24를 유지한다. EXIF 정규화된 하나의 lossless working buffer에서 분석과 실제 crop을 수행하고 원본 bytes를 수정하지 않는다.
- 원본 bytes SHA-256을 분석/저장에서 검증한다. candidateId는 source hash/rect/role로 결정하며 signed URL은 지문이나 DB 데이터가 아니다.
- 새 metadata writer는 `assets/metadata.ts` CAS에 참여해야 한다. namespace를 최신 row에 merge하고 다른 분석/출처 정보를 덮어쓰지 않는다. large JSON을 URL 필터에 넣지 않는다.
- 저장은 사용자 candidate ID 선택만 허용한다. capacity는 전체 신규 선택을 시작 전에 검사하고 source 순서로 append한다. 같은 parent/hash/candidate의 재요청은 기존 row를 반환한다.
- 파생 사진은 실제 rectangle crop, 원본 MIME 유지(JPEG/WebP95, PNG lossless), resize/upscale/생성/배경 제거 없음. asset_type=unclassified와 derivation 출처를 저장한다.
- 원본/파생 삭제는 독립적이다. 불확실한 DB commit의 파일은 삭제하지 않는다. SDK/Sharp stack·secret·raw provider response·prompt를 사용자/DB에 남기지 않는다.
- 자동 테스트 provider는 mock만 사용한다. 실제 QA는 별도 Project와 최소 호출을 사용하고 기존 데이터 hash 보존 및 테스트 DB/Storage 정리를 확인한다.
- Fact/OCR enrichment, AI 자동 후속 분석, Planner Derived 우선 변경은 이번 범위가 아니다. 후속 TASK-025에 넘긴다.

## Sales presentation 규칙 (TASK-026)

- Fact truth와 presentation coverage/재사용 예산을 분리한다. 품질 경고로 Fact/옵션 원문을 삭제·수정하지 않는다.
- Shared Renderer의 intrinsic cap과 bounded token만 사용한다. Editor/Final/Export별 별도 CSS renderer를 만들지 않는다. review 경고는 capture article 밖에 둔다.
- 새 crop에만 pixel 기반 최대3%/변 trim을 적용하며 sourceRect와 insets/출력 크기를 보존한다. 모호한 경계는 유지하고 기존 파일을 조회만으로 재가공하지 않는다.
- 자동 retry로 품질 문제를 해결하지 않는다. 실제 API 실패와 mock/기존 canonical replay의 검증 범위를 보고서에서 구분한다.
