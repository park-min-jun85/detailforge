# TASK-021A — 공식 API 연결 및 실제 옵션 응답 확인

브랜치 `feat/domeme-option-import`, 기준 `4a7b8ad` (TASK-020). UI/저장 연결 전 읽기 전용 진단 단계.
Git commit/main merge 없음. 0005를 포함한 migration, DB 타입, 기존 Product/Facts/Options/Assets 저장 로직 변경 없음.

## 구현 경계

- `src/features/wholesale-import/domeme-api/client.ts`: server-only, 공식 고정 HTTPS endpoint에 GET 1회. `ver=4.6`, `mode=getItemView`, `aid`, `no`, `om=json`만 사용.
- 기존 `resolvePublic`과 DNS-pinned `pinnedTransport` 재사용. 사용자 URL을 받지 않으며 redirect 0회, 자동 retry 0회. 기존 Generic Import 보안/이미지/browser 코드는 변경하지 않는다.
- DNS 5초, 전체 signal 15초, JSON response 512KiB. Content-Length와 실제 byte 수 검사. identity encoding 요청, 다른 encoding은 거부하여 압축 해제 우회도 허용하지 않는다.
- HTTP 인증/권한/429 및 HTTP 200 본문 오류 검사. 응답 `domeggook.basis.no`와 요청 상품번호 일치 확인.
- 원본 응답/요청 URL/aid/판매자 정보/가격/정확한 재고 수량을 반환하지 않는다. 알려진 옵션 구조와 노출·판매·재고 유무 요약만 반환한다. 공급처 오류 메시지와 원본 network error/cause는 출력하지 않는다.
- `inspection.ts`: JSON 문자열을 파싱하고 bounded Zod set/name/opts 검증. 평가만 수행하며 UUID를 확정하거나 Options/ImportCandidate로 저장·반환하지 않는다.
- 현재 Options schema의 상한·중복·placeholder 호환성을 검사한다. 선택값 문자열을 색상/사이즈로 분리하지 않는다. 일부 조합/값의 제한을 삭제하거나 평탄화하지 않는다.
- API route와 UI 연결 없음. Supabase/Storage/OpenAI client를 호출하지 않는다. 신규 dependency 없음.

## 실행 / 환경변수

프로젝트 `.env.local`에 사용자가 직접 `DOMEGGOOK_API_KEY`를 설정한다. 채팅으로 키를 전달하지 않는다.
`.env.example`에는 빈 항목만 추가했다. Client Components에서는 이 모듈을 import할 수 없다.

기존 통합 진단은 Node `--env-file=.env.local`과 `tests/register.mjs`로 실행한다. 이번 CLI는 cwd와 무관하게 script 기준 `../.env.local`을 명시적으로 읽고 Node `parseEnv`로 **해당 키만** 사용한다. 파일 접근 실패는 안전한 key_missing 오류로 처리하며 다른 환경의 키로 우회하지 않는다.

```powershell
cd C:\Projects\detailforge
node --conditions=react-server --import ./tests/register.mjs scripts/diagnose-domeme-options.mjs --approved-three
```

실행하면 67399861 → 67695797 → 62191078을 순차적으로 각각 최대 1회 조회한다. 인증/권한/호출 제한을 포함한 조회 실패 시 즉시 중단한다. 반복 실행 자체는 새 호출이므로 사용자 요청 없이 다시 실행하지 않는다. 자동 테스트에서는 이 flag로 실행하지 않는다.

## 진단 상태

- `unverified`: 필드 누락/null/빈 문자열. 명세에서 null을 옵션 없음으로 확정하는 정의를 확인하지 못했으므로 추측하지 않는다.
- `invalid_json`: selectOpt JSON 파싱 실패.
- `unsupported`: 미지원 type/자료형/구조/상태값, 상한·중복·placeholder 또는 조합 키 문제. 값을 버려 통과시키지 않는다.
- `combination_restricted`: 조합 누락, 도매매 비노출, 판매 종료/숨김 또는 재고 0. 현재 모델로 제한을 표현할 수 없다.
- `simple_groups`: 조회 시점 전체 조합과 현재 그룹·값 모델의 호환성을 확인했다. 가격·재고 모델을 표현하거나 영구 구매 가능성을 보장한다는 의미는 아니다.
- `confirmed_none`: 상태 이름은 구분해 두었으나, 현재 확인된 공식 명세에 authoritative 없음 marker가 없어 이 상태를 생성하는 규칙은 구현하지 않았다. 임의 `type=none`, null, 빈 배열을 없음으로 확정하지 않는다.
- 인증/조회 실패는 별도 안전한 오류이며 위 상태나 빈 groups로 변환하지 않는다.

`optSort`, `orgSet`, `changeKey`의 정렬/재매핑 의미는 이번 단계에서 해석하지 않는다. 제한된 행은 supplier key로 보고하며 표시 label과 임의로 연결하지 않는다. hash를 영구 ID로 사용하지 않는다.

## 실제 조회 (2026-09-17)

사용자 승인 범위의 세 상품을 각각 1회, 순차 조회했다. 모두 연결 성공, 상품번호 일치. 재조회/추가 상품 탐색 없음.
실제 wrapper는 `domeggook`, 상품번호는 `domeggook.basis.no`, 옵션은 `domeggook.selectOpt`였다.
세 응답 모두 selectOpt 존재/string/JSON 파싱 성공, `type=combination`, `set=array`, `data=object`.
최상위 옵션 필드는 `type`, `optSort`, `set`, `orgSet`, `data`였다.

- **67399861**: `옵션` 그룹, `단일상품` 1값, 조합 key `00` 1개. sup=1/hid=0/재고 양수. 현재 모델의 1그룹 1값으로 표현 가능. 복수 선택 옵션의 양성 사례로는 사용하지 않는다.
- **67695797**: `옵션` 그룹, 6값. 아이보리 90/95, 코코아 90/95, 브라운 90/95가 각각 **하나의 원본 선택값**이다. 조합 6개 모두 sup=1/hid=0/재고 양수. 1그룹 6값 모델로 표현 가능. 색상/사이즈 2그룹으로 추론하지 않는다. 복수 선택값 양성 사례 확보.
- **62191078**: `옵션` 그룹, 12값, 조합 12개. 모두 sup=1이며 8개는 hid=0/재고 양수, key `08`, `09`, `10`, `11` 4개는 hid=1/재고 0. 전체를 판매 가능한 값처럼 반영할 수 없어 combination_restricted. 원본 선택값이나 제한 행을 삭제하지 않는다.

공식 첨부 명세의 이전 경로 `domeggook.itemInfo.itemOptJson`과 현재 실제 경로는 다르다. 현재 getItemView의 `selectOpt` 설명 및 combination/set/data 구조와 실제 응답은 일치했다.
실제 결과에서 여러 그룹의 종속 관계, 숨김 hid=2, sup 비노출, 미지원 type은 확인되지 않았다. 해당 사례는 mock으로만 검증한다.

## 자료·fixture 정책

- [getItemView 4.6](https://openapi.domeggook.com/ko/articles/상품상세정보-933abc24)
- [공식 주문옵션 첨부 명세](https://cf.channel.io/document/spaces/16269/articles/545936/revisions/955436/usermedia/695e12dd9eab9910ef98)
- [오류와 이용 제한](https://openapi.domeggook.com/ko/articles/표준오류메세지-7a511249): 공통 분당180회/일15,000회 제한 및 HTTP200 오류 안내. 이번 작업은 요청3회만 수행했다.

실제 전체 응답이나 원본 옵션 payload를 파일로 저장하지 않았다. 별도 응답 재배포/보관 조건이 확인되지 않았으므로 실제 API fixture도 만들지 않았다. 테스트 데이터는 합성 값이며 실제 검증 성공의 근거로 사용하지 않는다. 실제 증거는 위 3회 조회의 최소 구조 요약이다.

## 검증

- 전체 자동 테스트 **514개 통과** (기존 485 + 신규 mock 29). 자동 테스트는 mock transport와 합성 응답만 사용하며 실제 API·DB·OpenAI 호출을 하지 않는다.
- 신규 테스트: 키 미설정, 고정 요청 파라미터, HTTP200 본문 오류/미지원 오류 구조, 상품번호 불일치, selectOpt JSON/미지원/미확인 구분, 조합 누락/판매 상태/재고 제한, 모델 상한, redirect/DNS/timeout/응답 크기, 키·요청 URL 비노출, 순차 호출·오류 시 중단, DB mutation 경계.
- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check` 통과.
- 변경 파일 8개와 production client bundle 25개에서 설정된 서버 비밀키 3종의 원문/URL 인코딩 값 검출 0건. 키 값은 출력하지 않았다.
- migration/DB 타입/Product Options 저장 코드/package 파일 변경 0건. 진단 실행은 공식 API GET 3회뿐이며 DB·Storage를 호출하지 않았다.
- 실제 API 검증과 mock 테스트를 분리했다. UI 반영/저장 성공을 검증한 단계는 아니다.

## 후속 TASK-021B 제안

후속 구현은 [TASK-021B](./TASK-021B.md)에서 완료했다. 위 기록은 당시 진단 단계다. B에서 inspection은 identity changeKey와 일치하는 orgSet만 허용하도록 강화되었으며 앱 조회/입력 반영/명시적 저장은 별도 경계로 연결했다.

67695797의 원본 1그룹 6값을 유지하는 Preview → 사용자가 draft에 반영 → 별도 명시적 옵션 저장을 연결한다.
기존 UUID와 사용자 수정값을 보호하고 version CAS를 재사용한다. 출처는 server ticket 검증을 거쳐 Options source_snapshot에 보존한다.
62191078 같은 제한 사례는 현 모델에서 자동 반영하지 않는다. 추출 실패/미확인으로 기존 옵션을 비우지 않는다.
UI/저장/재가져오기/UUID 매칭, SKU/가격/재고, HTML 옵션 수집, 새 migration은 이번 TASK에 포함하지 않는다.
