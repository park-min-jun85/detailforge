# TASK-018 — Wholesale Product URL Import

브랜치 `feat/wholesale-url-import`. 구현·검증 완료, Git commit 없음. Migration/RLS/DB 타입 변경 없음.

## Preview-first / 확인 저장

`/projects/[projectId]` 상단의 URL 입력 → Import Preview → 기존 Product form에서 수정 → **확인한 정보로 저장** → Product/Facts 성공 후 선택 이미지별 Import.
Preview는 DB/Storage를 쓰지 않는다. 기존 Product가 있어도 draft만 채운다. 불러오기 실패는 현재 입력을 보존하고, 가져오기 취소는 이전 draft를 복원한다.
수동 상품 입력/스펙 추가·삭제/기존 Server Action은 유지한다. Import 저장도 기존 Product persistence의 revision CAS·Facts 보상 복구를 사용한다.
브라우저 조정 함수 `saveConfirmedImport`는 상품 저장 실패 시 이미지 요청을 시작하지 않는다. 파일별 실패를 모아 표시하고 성공한 상품/이미지는 롤백하지 않는다.

## 파일

생성:
- `src/features/wholesale-import/{schemas,errors,security,fetcher,extractor,browser,tickets,service,http,client}.ts`
- `src/features/wholesale-import/adapters/{types,generic}.ts`
- `src/features/wholesale-import/components/import-panel.tsx`
- `src/app/api/projects/[projectId]/wholesale-import/{preview,save,images}/route.ts`
- `tests/wholesale-import.test.mjs`, `tests/wholesale-import.browser.mjs`, `tests/fixtures/wholesale-{jsonld,metadata,dom}.html`, 이 문서.

수정:
- Product `schemas.ts`, `mappers.ts`, `persistence.ts`, `components/product-form.tsx`
- Asset `service.ts`
- `package.json`, `package-lock.json`
- tasks README, `02_ARCHITECTURE`, `03_DATABASE`, `05_UI_UX`, `06_CODING_RULES`.

## Adapter와 추출

Resolver → ImportAdapter → 공통 bounded Zod ImportCandidate. 현재 Generic Adapter만 등록했다. 사이트별 adapter는 Generic 앞에 추가한다.
우선순위: JSON-LD Product(배열/@graph 포함) → OpenGraph/meta → product 범위 DOM(h1/itemprop/table/dl) → 필요한 경우 rendered DOM.
존재하는 문자열만 정규화한다. brand/category 등이 없으면 null이며 AI 추측/보완은 없다. extractionMethod는 우선 사용한 출처(json_ld/metadata/dom), fallback이면 browser다.
상품명200/브랜드·카테고리100/설명5000, 스펙50개(항목100/값500), 이미지30개, URL2048, 경고10개로 제한한다. 스펙 이름 중복은 상위 출처 값을 유지한다.
JSON-LD/og:image 우선, 상품 범위 img의 src/data-src를 보조로 쓴다. URL 정규화·중복 제거, 알려진 icon/logo/tracking 및 명시적 100px 미만 이미지, SVG/GIF/ICO를 제외한다. 모든 img를 수집하지 않는다.
JSON-LD/OG 후보는 기본 선택, DOM 후보는 기본 미선택. 최종 결정은 사용자 checkbox다. 작은 이미지/상품 관련성 필터는 휴리스틱이므로 검토가 필요하다.

HTML parser **parse5 8.0.1**만 추가했다. 기존 dependency에 HTML parser가 없었고, 정규식만으로 깨진 HTML·entity·JSON-LD와 표를 처리하거나 HTTP-first 단계마다 Chromium을 실행하는 것을 피하기 위한 최소 parser다. 기존 Playwright 1.63.0을 재사용한다.
[parse5 공식 문서](https://parse5.js.org/modules/parse5.html).

## HTTP와 SSRF

- http/https, 포트80/443만 허용. userinfo, 다른 scheme 거부. fragment 제거.
- localhost/내부 hostname suffix, loopback, RFC1918, link-local, cloud metadata, CGNAT, reserved/test/multicast IPv4 차단.
- IPv6는 보수적으로 public global unicast만 허용하고 local/mapped/NAT64/6to4/documentation 등 제외. 특수 public IPv6 일부도 거부할 수 있다.
- DNS 전체 결과에 사설·금지 IP가 하나라도 있으면 차단한다. hostname 사전 검사에 그치지 않는다.
- Node HTTP(S) request의 lookup을 검증한 IP로 고정하고 family를 지정한다. 원래 Host/TLS SNI·인증서 검증을 유지한다. 검증 뒤 다른 DNS 답으로 연결하는 rebinding 경로를 만들지 않는다.
- 자동 redirect 금지: 최대5회 수동 처리하며 매 목적지마다 URL/DNS 재검증. Cookie/Authorization/사용자 헤더를 전달하지 않는다.
- HTTP 요청15초, DNS5초, HTML2MiB, image10MiB, script1MiB, CSS/JSON512KiB. 압축 전/해제 후 스트림 모두 제한한다. 허용 MIME 이외 binary/PDF/video/HTML 위장 이미지 거부.
- header/meta charset을 확인해 TextDecoder로 UTF-8/EUC-KR 등을 처리한다. 지원하지 않는 charset은 안전 오류.
- 기본 User-Agent는 식별 가능한 `DetailForge-ProductImport/1.0`. 로그인 자동화/CAPTCHA/stealth/proxy rotation/인증·rate-limit 우회 없음. 401/403/407/429와 감지한 접근 제한/로그인 HTML은 실패 처리하고 browser 재시도하지 않는다.

## Playwright fallback

HTTP에서 이름과 설명/스펙/이미지 중 하나가 있으면 Chromium을 실행하지 않는다. 정보 부족 + script 존재일 때만 fallback한다.
server-only 별도 Import browser provider이며 TASK-017 screenshot과 섞지 않았다. 요청별 launch/close, 총 Preview45초, launch10초/navigation20초.
모든 browser HTTP 요청은 route.fulfill을 통해 동일 DNS-pinned HTTP fetcher가 처리한다. route.continue/route.fetch를 사용하지 않는다. GET document/script/style/JSON만, 최대60 requests/합계20MiB.
Service Worker/WebSocket 차단, 브라우저 DNS 직접 조회·QUIC 비활성, WebRTC/WebTransport 생성자 제거, 다운로드 불허, 새 빈 context. 이미지/폰트 resource 자체의 다운로드는 추출 시 불필요하여 제한한다. iframe 내부 DOM을 합쳐 추출하지 않는다.
HTML을 UTF-8로 정규화해 전달하며 DOM 결과를 다시 동일 extractor/Zod로 검증한다. 동적 DOM2MiB 초과는 거부한다.
외부 site scripts를 실행하므로 운영 배포에서는 Chromium OS 격리/egress 방화벽과 resource 정책을 함께 검토해야 한다. cookie 기반 API·iframe·POST 렌더링 등 일부 상품은 자동 가져오기가 불가능하다.
브라우저 설치/배포 요구사항은 TASK-017과 동일하다. [Playwright context interception](https://playwright.dev/docs/api/class-browsercontext).

## API와 임시 상태

- POST `.../wholesale-import/preview` `{url}` → `{candidate,token}`.
- GET 같은 preview route `?token=...&image=0` → 해당 후보의 검증된 image binary. URL 인수를 받지 않는다.
- POST `.../wholesale-import/save` `{token,revision,values,selectedImageUrls}` → 기존 ProductSaveState.
- POST `.../wholesale-import/images` `{token,url}` → 파일1개 imported/skipped. 확인 저장한 ticket의 선택 URL만 허용한다.

128KB body·same-origin·schema 검증, Project/Product scope 재확인, no-store/nosniff, 안전 오류만 반환.
Preview ticket은 server random UUID, Project scope, 20분 TTL, process cache50개. HTML/secret/cookies는 cache에 넣지 않는다. 선택 URL은 server 후보 subset이어야 한다.
Thumbnail도 서버에서 매 URL/DNS/redirect/MIME/크기/signature 검사. Client는 외부 상품 페이지/이미지를 직접 fetch하지 않는다. 임의 raw HTML이나 arbitrary URL 다운로드 API가 아니다.
클라이언트 중복 클릭 차단, Project/작업별 중복 거부, 프로세스 작업4개. thumbnail은 별도4개 실행/대기30개·20초 제한이다.
단일 프로세스 로컬 MVP다. 재시작/eviction으로 ticket이 사라지면 다시 Preview한다. 분산 cache/queue/인증을 구현하지 않았다.

## 원본과 Facts

products.source_type=`wholesale_url`, source_url=최종 public 상품 URL.
raw_data/source_snapshot은 `{inputMethod:"wholesale_url",productName,brand,category,description,sourceUrl,specifications,provenance}`.
provenance에는 원본 URL/host/fetchedAt/importedAt/extractionMethod/선택 image URLs/원래 extracted product가 들어간다. 전체 HTML/DOM은 저장하지 않는다.
`provenance.importedImageUrls`는 확인 시 선택한 source URL 목록이며 성공 이력이 아니다. 실제 성공은 Asset의 source metadata로 확인한다.
Facts에는 사용자가 확인한 상품명·브랜드·카테고리·스펙만 넣는다. 설명/URL/이미지/원래 추출 후보를 Fact로 자동 승격하지 않는다.
기존 Validation/AI Analysis는 자동 실행·수정하지 않는다. 후속 수동 수정도 import provenance를 보존한다. TASK-006의 transaction이 아닌 보상 저장 한계는 그대로다.

## 선택 이미지 Import

Product/Facts 저장 성공 후 파일별 download → JPEG/PNG/WebP MIME/10MiB/signature → 기존 uploadAsset → private product-assets → assets INSERT.
서버 UUID path `projects/{projectId}/products/{productId}/{uuid}.{ext}`, asset_type=unclassified. original_filename은 안전한 URL basename 또는 fallback.
metadata.source=`{type:"wholesale_url",url,pageUrl,importedAt}`. 신규 row에 merge하며 기존 row/AI metadata를 덮어쓰지 않는다.
같은 batch URL 중복 제거 + 기존 source.url 검사 + uploadAsset의 Product 잠금 안에서 다시 검사하여 같은 프로세스 재Import 중복을 막는다. 내용 hash 중복/다중 프로세스 unique 제약은 없다.
현재 Asset 포함30개 제한. Asset INSERT 실패의 응답 유실 확인/Storage best-effort cleanup은 TASK-007을 재사용한다. 부분 성공·불명확한 저장은 안전 메시지와 목록 확인으로 안내한다.
이동/새로고침으로 남은 batch가 중단될 수 있으며 background job은 아니다. 실패 이미지는 다시 URL Preview 후 선택 저장할 수 있고 이미 등록된 URL은 건너뛴다.

## 검증

- 기존332 + 신규30 = 전체362 tests. 자동 테스트는 HTML fixture/mock DNS/HTTP/browser/storage만 사용하며 외부 도매사이트나 유료 AI에 의존하지 않는다.
- schema/schemes/private IP/DNS mixed records/encoded IP/rebinding/redirect/압축 크기/MIME/timeout/JSON-LD·OG·DOM/우선순위/중복·수량·tiny filter/preview 불변/확인 Facts/provenance/CAS/이미지 보상·부분 성공/metadata 보존/오류 비공개/client 저장 순서를 검증한다.
- next typegen, tsc --noEmit, lint, build, git diff --check 모두 통과. client JS/map22개 및 src에서 실제 OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY 검출0건.
- 실제 공개 **테스트 상품** `https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html`: HTTP DOM 추출, 스펙7개/이미지1개. 특정 실제 도매사이트 호환성 보장은 아니다.
- 실제 UI URL 입력 → Preview(Products0행) → 이미지 선택/해제/재선택 → 상품명·스펙 수정 → 확인 저장 → Images → 새로고침 확인.
- 실제 Supabase: confirmed name/spec, 원래 extracted name, source_snapshot, description의 Facts 제외, asset_type=unclassified/source metadata/31,047-byte JPEG private Storage 읽기 확인.
- 실제 실패 UI: 127.0.0.1 차단, `https://quotes.toscrape.com/login` 로그인 제한 안내. 기존 상품 유지.
- 실제 Chromium fixture: JS로 생성한 한글 상품/스펙 추출, HTTP fulfilled2건, private fetch1건 차단, 외부 network0건. Export browser와 독립 동작 확인.
- 검증용 Project/Product/Facts/Assets/Storage 잔여0건 확인. 검증 서버와 탭을 종료했고 기존 사용자 데이터는 변경하지 않았다. OpenAI 호출 없음.

재현 명령:
```powershell
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
# Chromium이 설치된 환경의 별도 통합 검사. 외부 사이트 요청 없이 JS fixture를 렌더링한다.
node --env-file=.env.local --conditions=react-server --import ./tests/register.mjs tests/wholesale-import.browser.mjs
```

## 후속 / 직접 확인

### 공개 상품의 부분 가격 제한 오탐 수정 (2026-09-16)

- 공통 로그인 폼의 password input이 있으면서 JSON-LD/Product scope 제목이 없으면 OG 상품명·공개 본문을 무시하고 restricted로 처리하던 문제를 수정했다.
- Generic 추출 후 상품 제목 + 본문 스펙/설명/이미지, Product JSON-LD/OG 신호를 종합한다. 공통 로그인/회원 구매 문구는 공개 상품을 차단하지 않는다. 상품 본문 없는 로그인·인증 URL, CAPTCHA/challenge 주 콘텐츠와 명확한 제한 페이지는 계속 거부한다.
- OG 제목과 일치하는 본문 제목은 서비스명 접두어 없이 사용한다. 무관한 일반 heading은 기존 metadata 우선순위를 덮어쓰지 않는다. 사이트별 ID/상품번호/URL을 production 코드에 하드코딩하지 않았다.
- Generic breadcrumb의 현재 경로만 추출하고 dropdown 선택지는 제외한다. 알려진 상품 속성의 table/label-div 쌍과 명시적 상품번호 텍스트를 읽는다. 설명이 없고 가격이 제한되면 공개 스펙을 상품정보 후보 텍스트로 조합하며 가격 metadata 광고는 사용하지 않는다.
- 상품 상세 영역의 inert textarea HTML을 parse5로만 읽어 외부 이미지 후보를 추출한다. script 실행/iframe 추가 요청 없이 최대20개·256KiB·10,000 nodes 제한을 둔다. 기존 URL/30개 제한과 UI 아이콘·작은 이미지 필터를 유지·보강했다.
- bounded warnings에 `상품정보는 가져왔지만 가격은 로그인한 사업자회원에게만 공개됩니다.`를 추가한다. 가격 필드/추측/인증 우회는 없다.

실제 `https://domeme.domeggook.com/s/67399861`를 HTTP와 브라우저에서 검증했다. 최적화 빌드의 UI에서 URL 입력 → Import Preview 성공, 저장 전 후보만 표시한다.

- 상품명: 냄새잡는 대나무숯 애견 배변패드 40매(60x60cm)
- 원본 URL: 위 HTTPS URL, 추출 방식 metadata + Generic DOM 보완 (schema 표시값 `metadata`)
- 카테고리: 취미/도서 > 반려동물 > 강아지배변용품 > 배변패드
- 스펙7개: 원산지 `수입산 / /`(원문 구분자 보존), 모델명 `별도표기`, 제조사 `별도표기`, 상품포장 부피/무게 `X / X`, 품명 및 모델명 `ON241125403`, 제조국 또는 원산지 `중국`, 상품번호 `67399861`. 브랜드는 null. 설명은 이 공개 상품정보의 조합이며 새 사실을 생성하지 않는다.
- 이미지 후보2개: OG 대표 이미지 + `https://www.dometopia.com/data/goods/goods_img/GDI/1364769/1364769.jpg`. 상세 JPEG는 1,976,196 bytes로 MIME/signature 검사 및 UI 미리보기 성공. 대표 이미지 CDN은 HTTP200이지만 `application/octet-stream`으로 응답하여 기존 MIME 정책에 따라 미리보기 실패를 표시한다. 후보 추출 성공과 바이너리 Import 가능 여부를 구분한다.
- 신규 회귀10개: 공통 로그인/부분 가격 제한, JSON-LD/OG 신호, metadata 없는 공개 본문, 로그인 wall, CAPTCHA, 잔존 metadata가 있는 wall, auth redirect, inert 상세 이미지/UI·사설주소 제외, fragment 상한, Preview 불변·가격 추측 없음.
- 기존362 + 신규10 = 전체372 tests, next typegen / tsc --noEmit / lint / build / git diff --check 모두 통과. SSRF/DNS pinning/redirect/HTTP status/MIME/용량/browser sandbox 정책은 변경하지 않았다. 실제 Chromium fixture도 private request 차단을 유지한다.
- 최종 빌드 UI에서 상세 이미지 complete=true, naturalWidth=860, naturalHeight=12900 확인. 실제 검증은 Preview까지만 실행했으며 Product/Asset 0행을 확인했다. Product/Facts/Assets/Storage 저장 및 유료 AI 호출 없음. 검증용 빈 Project 삭제 후 관련 레코드 잔여0건 확인. 실제 서비스키의 client bundle/source 노출0건.

Cursor에서 실제 공급처 URL의 원문과 추출값, 썸네일, 스펙 중복/필드 의미, 기존 입력 복원, 30개 상한/부분 실패를 확인한다.
향후 사이트별 Adapter는 실제 공급처의 합법적인 공개 접근 범위와 fixture를 확보한 뒤 추가한다. Generic selector/JSON-LD 구조/JS dependency가 다른 사이트는 현재 실패할 수 있다.
Auth/분산 rate limiter/대량 crawler/로그인·CAPTCHA·anti-bot 우회/AI extraction/상품 사실 추측/이미지 자동 분류/새 migration은 구현하지 않았다.

### 최종 실사용 보완: octet-stream 이미지와 원산지 (2026-09-16)

앞선 검증에서 대표 이미지가 거부된 원인은 공급처 CDN이 JPEG bytes를 `application/octet-stream`으로 응답한 것이다. 다음 보완으로 해결했다.

- `remote-image.ts`의 공통 `validateRemoteImage`를 HTTP image 응답과 `loadRemoteImage`가 사용한다. Preview proxy와 실제 Import 모두 `loadRemoteImage`를 거치며 동일 정책이다.
- 명시적 `image/jpeg`, `image/png`, `image/webp`는 기존대로 선언 MIME과 signature 일치를 검사한다. `application/octet-stream`일 때만 JPEG `FF D8 FF`, PNG 8-byte signature, WebP `RIFF` + offset8의 `WEBP`를 확인하여 실제 MIME으로 정규화한다. 미지원·부족한 signature/실행파일/HTML/SVG/빈 파일, 잘못 선언된 MIME은 거부한다. URL/파일 확장자로 허용하지 않는다. magic 검사이며 전체 이미지 디코더 검사는 아니다.
- octet-stream은 image 요청에서만 다운로드 후보로 허용하고, bytes 검증 성공 전에는 반환하지 않는다. DNS pinning/private IP/redirect/status/timeout/압축 전후 10MiB/상품30개 제한은 변경하지 않았다.
- 표시용 original_filename과 기존 UUID Storage 경로를 분리한다. Storage 확장자·contentType·Asset mime_type은 검증된 실제 MIME을 사용한다. original_filename이 `.jpg`인 실제 PNG도 Storage는 `.png`로 저장함을 회귀 검증했다. proxy/signed URL은 DB에 저장하지 않는다.
- Generic 스펙 값에서 공백으로 분리된 앞/뒤 `/`, `|`만 제거한다. `수입산 / /` → `수입산`; `ABS / PC`, `가로 / 세로`, `1/2`, `cm/s`, `MODEL-A/`, 음수는 유지한다. 상품 전용 값은 production 코드에 없다.

실제 브라우저에서 `https://domeme.domeggook.com/s/67399861`로 Preview → 두 이미지 선택 → 확인 저장 → Images → 페이지 새로고침까지 실행했다.

- 상품명·카테고리 경로 정상, 상품번호67399861/품명 및 모델명ON241125403/제조국중국 확인. 원산지 최종 값은 `수입산`이며 저장된 Facts/source_snapshot에서도 확인했다.
- 대표 이미지: JPEG, 18,216 bytes, 330×330. Preview/Storage Import/Images 표시 성공.
- 상세 `1364769.jpg`: JPEG, 1,976,196 bytes, 860×12,900. 기존10MiB 이하이며 제한 변경 없이 Preview/Storage Import/Images 표시 성공.
- private `product-assets` bucket 확인, Asset2개 모두 `unclassified`, JPEG MIME/UUID `.jpg` 경로/원본 source URL metadata 확인. private signed URL로 두 파일을 다시 읽고 JPEG signature/byte 수 일치를 검증했다. DB에 signed/proxy URL 없음.
- 신규12개 포함 전체384 tests 통과. 정상 JPEG, octet JPEG/PNG/WebP, 미지원/실행/부족한 bytes, `.jpg` 위장/MIME 불일치, explicit octet 예외 범위, declared/stream/gzip 10MiB, redirect/abort, Storage 실제 확장자, 구분자 정리/내부 보존을 검사한다.
- next typegen, tsc --noEmit, lint, build, git diff --check 통과. 실제 Chromium fixture의 private 요청 차단도 통과. dependency/migration 추가 없음, Git commit 없음, 유료 AI 호출 없음.
- 검증용 Project/Product/Facts/Assets와 두 Storage 파일은 검증 후 정리했고 잔여0건을 확인했다. 실제 서비스키의 client bundle/source 노출0건. 기존 사용자 데이터는 변경하지 않았다.
