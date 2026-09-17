# TASK-021B — 도매매 옵션 후보 표시·확인·저장

브랜치 `feat/domeme-option-import`, 기준 `4a7b8ad`. 승인된 TASK-021A 미커밋 변경을 이어 사용했다. commit/main merge 없음.

## 연결 경계

- `POST /api/projects/[projectId]/options/import`: 저장된 Project→Product 소속, source_url, Options version을 확인하고 공식 getItemView 4.6을 한 번 조회한다. 조회 전후 URL/version을 재확인한다.
- `POST .../options/import/apply`: 유효한 후보 ticket과 사용자가 선택한 신규 항목 UUID를 검증하고 draft와 저장용 ticket을 반환한다. DB/API 재조회 mutation 없음; DB는 소속/현재 상태를 읽기만 한다. 도매매 API를 재호출하지 않는다.
- 기존 `PUT .../options`: 명시적 옵션 저장. 서명·만료·Project/Product·상품번호·저장 URL·기준 version을 재검증하고 groups/source_snapshot/version을 한 product_options INSERT/UPDATE로 저장한다.
- UPDATE의 row id/product_id/version 조건, INSERT UNIQUE, 응답 유실 시 정확한 payload 확인을 재사용한다. CAS miss/409에 최신 version을 덮어 넣거나 mutation을 재시도하지 않는다.
- Product/raw_data/Facts/Validation/Analysis/Assets/Storage/Plan/Sections/Project status는 옵션 흐름에서 쓰지 않는다.
- DB migration, dependency, HTML 수집, OCR/OpenAI, SKU·가격·재고 관리, Section/Editor/Renderer 연결 없음.

## 저장된 URL과 공급처 API

허용 형식은 **`https://domeme.domeggook.com/s/<양의 1~15자리 상품번호>`**이며 끝 `/`는 허용한다. exact hostname, HTTPS, 기본 port만 허용한다. credentials/query/hash/추가 path/유사 호스트/내부 URL은 거부한다. URL을 실제로 fetch하지 않고 상품번호만 파싱한다. 브라우저 요청에는 URL/endpoint를 받지 않는다.

상품정보의 미저장 URL을 사용하지 않는다는 안내와 서버 페이지가 읽은 URL/상품번호를 표시한다. 실제 후보에는 서버가 다시 읽은 저장 URL을 연결한다. URL 미설정/미지원은 상품정보 확인·저장 안내다.

공식 API client의 fixed HTTPS endpoint, DNS public validation/IP pinning, redirect 0회, retry 0회, 상품번호 일치, HTTP200 오류 검사, 15초/512KiB 제한을 유지한다. 페이지 진입·새로고침·후보 반영·저장은 API 조회를 발생시키지 않는다. 사용자 조회 버튼만 실행한다. API 실패 시 HTML fallback 없음.

## 상태와 구조

`simple_groups`(반영 가능), `combination_restricted`(제한), `unverified`(확인 불가), `unsupported`/`invalid_json`(미지원)를 표시한다. 인증·권한/조회 실패와 호출 제한은 안전한 별도 오류 코드다. 필드 누락/null/빈 문자열을 옵션 없음이나 빈 대체값으로 바꾸지 않는다. `confirmed_none` 규칙은 아직 확인되지 않아 생성하지 않는다.

`combination`이라는 이름만으로 차단하지 않는다. 모든 조합 키·도매매 노출·판매 상태·재고 유무와 모델 상한을 검사한다. 일부 제한 조합이 있으면 전체 후보에 반영 ticket을 발급하지 않는다. 제한된 값만 삭제해 저장하거나 제한을 source에만 남겨 정상 선택값처럼 저장하지 않는다.

`changeKey`는 identity 배열만 허용하며, 비어 있지 않은 orgSet이 set의 그룹명/값과 다르면 미지원이다. 추가 최상위 구조도 추측하지 않는다. optSort 정렬 의미를 적용하지 않고 set의 표시 순서를 유지한다. remapping이 필요한 구조는 미지원이다. 순번 키/hash를 영구 UUID로 사용하지 않는다. 단일상품 한 값과 `아이보리 90`, `A / B`는 원문 한 값이다.

## UI와 명시적 저장

기존 OptionsManager 위에 후보 panel만 추가했다. 편집기는 복제하지 않는다.

1. 저장된 상품에서 **도매매 옵션 불러오기**.
2. 조회 시각·상태·이전 원본/현재 confirmed/새 후보 비교.
3. 신규 값의 추가 여부 선택. 최초 빈 입력에서는 신규 값 전체가 기본 선택되며 기존 옵션이 있으면 기본 미선택.
4. **옵션 입력란에 반영**. 미저장 수정이 있으면 취소/버리기 확인; 기존 입력을 먼저 저장할 수도 있다. 반영은 아직 DB 저장이 아니다.
5. 별도 **옵션 저장**. 성공 시에만 version/draft 갱신. 실패·만료·충돌에는 draft 유지.

후보 닫기는 기존 편집 입력을 변경하지 않는다. 만료/URL 변경/충돌에서 다시 조회하거나 **후보 출처 해제 · 수동 저장으로 전환**을 명시적으로 선택할 수 있다. 이 전환은 입력을 유지하며 새 후보 출처만 해제한다. 이미 DB에 저장된 이전 출처는 유지한다. 충돌은 최신 옵션 확인이 필요하며 자동 재시도하지 않는다.

## UUID·재가져오기

공급처 영구 ID가 확인되지 않았으므로 원본 그룹명/선택값과 로컬 UUID의 서버 매핑을 사용한다. 기존 매핑으로만 동일 항목을 찾는다. 사용자 표시명 변경은 현재 UUID/값을 유지한다. 사용자 추가·삭제, 공급처에서 사라진 값, 현재 순서를 보존한다. 삭제 UUID 매핑은 tombstone 역할로 남아 자동 복구를 막는다.

새 값만 사용자가 선택해 append한다. 이전 원본 값이 사라지며 새 이름이 나타나면 이름 변경인지 불명확하므로 자동 추가/매칭하지 않는다. 수동 그룹/값에 출처 매핑이 없고 이름이 겹치면 중복·수동 확인 대상으로 표시하며 자동 재분류하지 않는다. 전체 교체는 수동 편집으로 안내한다.

동일한 후보를 반복 반영하면 같은 UUID다. 같은 Project/Product/URL/version/fingerprint/current/previous 상태의 후보를 다시 조회하면 유효한 cache의 provisional UUID도 유지한다. 저장 후 재가져오기는 persisted mapping으로 UUID를 유지한다. TTL/서버 재시작 이후 아직 저장하지 않은 provisional UUID는 보장하지 않는다.

## Source snapshot과 ticket

`inputMethod: domeme_api`, schemaVersion/supplier/productNo/sourceUrl/apiVersion/fetchedAt/fingerprint, 최소 원본 groups, 원본명·값↔UUID bindings를 서버가 구성한다. confirmed groups는 별도 컬럼이며 사용자 표시값과 원본을 구분한다. 이후 수동 저장도 해당 source를 보존한다. 기존 manual/wholesale_url/빈 source schema는 계속 읽는다.

최신 원본은 기존 10그룹/30값/100값 상한, 삭제·이름 변경 비교용 bindings는 최대20그룹/전체200값이다. 무제한 이력을 누적하지 않는다. 병합 결과나 매핑 상한을 넘으면 일부를 잘라내지 않고 반영 실패로 남긴다. 전체 API/HTML/판매자 정보/가격/정확한 재고 수량은 저장하지 않는다.

Wholesale Import와 동일한 bounded process-local ticket 방식에 HMAC-SHA256 서명된 opaque handle을 사용한다. 서버 전용 임의 서명키, 최대50개, 20분 TTL, 재시작/퇴거 시 무효다. candidate/prepared 목적도 구분한다. 키나 원문을 token에 담지 않으며 token을 로그에 남기지 않는다. prepared ticket 만료는 원래 candidate 만료를 넘지 않는다.

후보 fingerprint는 상품번호·원본 groups·조합 상태 요약의 SHA-256이다. 실시간 재고 동기화/영구 구매 보증이 아니다. 서버가 조회한 상태와 마지막 URL 확인 이후의 cross-table 동시 변경까지 DB transaction으로 잠그는 기능은 없다. 현재 local/single-user 전제를 유지하고 외부 공개 가능 서비스로 간주하지 않는다. 소속 검증은 인증을 대신하지 않는다.

## 자동 검증

기존514 + 신규33 = **547개 모두 통과**, skip/실패0. 자동 도매 API/OpenAI 호출0회.

URL/임의 요청 차단, 실제 구조의 합성 fixture, 1/6값·slash 원문 유지, full/partial 조합, identity remapping, null/오류/제한의 비파괴 처리, 조회/반영 DB 불변, ticket 위조/만료/다른 소속/목적 거부, URL/version 변경, 최초 저장·UUID·재반영, 사용자 수정/추가/삭제, 원본 보존/legacy, 모호한 변경·수동 중복, bounds, CAS/UNIQUE race/응답 유실, 민감 오류 비공개와 UI 호출 경계를 테스트했다.

`next typegen`, `tsc --noEmit`, `lint`, `build`, `git diff --check` 통과. 최종 secret audit와 테스트 데이터 정리는 아래 실제 검증 기록에 포함한다.

## 실제 브라우저 / Supabase 검증 (2026-09-17)

Production build localhost:3001과 linked Supabase에서 이번 검증 전용 프로젝트2개를 만들었다. 공식 API는 순차 **3회**: 67695797 최초/재조회2회, 62191078 제한 조회1회. 자동 반복·다른 상품 탐색 없음.

- 67695797 상품정보를 브라우저에서 먼저 저장. 옵션은 TASK-021A와 동일한 1그룹 6값. 조회 후 DB 옵션행0, 반영 후에도0. 명시적 저장 후 version1/1행/source domeme_api. 새로고침 후 그룹·값 UUID 유지.
- 첫 값 `아이보리 90`을 `아이보리 90 · 직접 수정`으로 바꾸고 마지막 `브라운 95`를 삭제해 저장(version2). 이전 source_snapshot 동일. 재가져오기 화면에서 이전 원본/현재5값/새6값을 비교하고 삭제한 값의 자동 복구 차단 안내 확인. 반영·명시적 저장(version3)·새로고침 후 수정값·삭제·나머지 UUID/순서 유지.
- 62191078은 기존 수동 옵션 `수동 확인 / 기존 값 유지`를 version1로 저장한 뒤 조회. 원본 12값은 표시하지만 `조합·판매 상태 제한으로 반영 불가`, 반영 버튼 없음. 기존 product_options row 전체 불변 확인.
- 두 Product 전체/raw_data/analysis와 Facts 전체/facts/source_snapshot/validation 불변 확인. Asset0, DetailPage0이며 Section/Storage 생성 없음. 실제 재고나 판매 가능성을 계속 동기화하지 않는다.
- Desktop 후보 비교와 기존 편집기 레이아웃을 실제 브라우저에서 확인했다. 임의 API fixture를 양성 증거로 대신하지 않았다.
- 검증용 Project2개를 정확한 ID와 이름으로 확인한 뒤 정리했다. 해당 Projects/Products/Facts/Options/Assets/DetailPages 잔여0건, Storage 생성0건. 기존 사용자 프로젝트는 수정·삭제하지 않았다. 검증 서버와 실제 검증 탭을 종료했다.
- 변경 파일27개와 production client bundle26개에서 설정된 서버 비밀키3종의 원문/URL 인코딩 값 검출0건. migration/DB 타입/package 파일 변경0건. 기존 SSRF/remote image/Generic browser 정책 파일 변경0건.

## 이번 단계의 생성·수정 파일

생성:

- `src/app/api/projects/[projectId]/options/import/route.ts`
- `src/app/api/projects/[projectId]/options/import/apply/route.ts`
- `src/features/product-options/import-contract.ts`
- `src/features/product-options/import-merge.ts`
- `src/features/product-options/import-service.ts`
- `src/features/product-options/import-tickets.ts`
- `src/features/product-options/components/option-import-panel.tsx`
- `tests/option-import.test.mjs`
- `docs/tasks/TASK-021B.md`

수정:

- `src/app/projects/[projectId]/page.tsx`
- `src/features/product-options/schemas.ts`, `errors.ts`, `client.ts`, `persistence.ts`, `components/options-manager.tsx`
- `src/features/wholesale-import/domeme-api/inspection.ts` (기존 미커밋 TASK-021A 파일)
- `docs/tasks/TASK-020.md`, `TASK-021A.md`, `README.md`
- `docs/02_ARCHITECTURE.md`, `docs/03_DATABASE.md`, `docs/05_UI_UX.md`

그 외 TASK-021A 미커밋 client/errors/진단CLI/mock/.env.example 변경을 그대로 보존했다.

## 후속 경계 / 사람이 확인할 항목

키보드로 조회·체크박스·반영·저장, 긴 원문과 좁은 화면, 미저장 변경 확인, 만료 후 수동 전환, 두 탭 충돌 안내를 확인할 수 있다. 실제 API 장애/만료/경쟁을 강제로 발생시키는 사례는 mock으로 검증한다.

Section 연결은 TASK-020의 confirmed options read model과 group/value UUID, Options version/fingerprint, option 전용 Section 계약, stale 판정을 재사용해야 한다. Fact F 근거에 섞거나 source 후보를 confirmed처럼 출력하지 않는다. 실제 Section/Editor/Renderer 연결은 후속 TASK다.
