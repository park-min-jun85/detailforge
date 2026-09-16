# TASK-017 — PNG/JPG Detail Page Export

PHASE 5 · `feat/image-export` · 구현 및 검증 완료 · Git commit 없음.

## 구현과 파일

- 생성: `src/app/api/projects/[projectId]/export/route.ts`
- 생성: `src/features/detail-export/{schemas,types,errors,config,filename,image-header,browser,service,http}.ts`
- 생성: `src/features/detail-export/components/export-panel.tsx`
- 생성: `src/features/detail-renderer/fingerprint.ts`, `tests/detail-export.test.mjs`, 이 문서.
- 수정: Renderer `review.tsx`, `surface.tsx`, `.env.example`, `package.json`, `package-lock.json`, tasks README, ARCHITECTURE, UI_UX, CODING_RULES.
- dependency: 공식 `playwright` 1.63.0 (exact); Sharp/DOM canvas/UI library 없음.
- migration/DB 타입/Storage bucket/RLS 변경 없음.

## 계약과 책임

POST `/api/projects/[projectId]/export`: strict `{format:"png"}` 또는 `{format:"jpg",quality?:60..100}`. JPG 기본 90, 정수만 허용. PNG quality 및 임의 URL 필드는 거부한다.
UUID, same-origin, 2KB body, Project/Product/DetailPage/Section/Asset scope를 확인한다. 현재 Renderer read model의 검증과 복구 중 busy 경계를 재사용한다.

canonical DB → 기존 shared SectionRenderer → 기존 Final Render Surface → server-only Chromium locator screenshot → binary response.
유일한 캡처 대상은 `article[data-detail-render-surface="1"]`이다. 별도 상세 HTML/CSS, Editor 캡처, export-only renderer를 만들지 않았다.
readiness/다운로드 패널/App Shell은 article 밖에 있다. content/style/sort_order/current assets/width만 반영하며 draft/orderDraft/미적용 후보는 포함하지 않는다.
렌더 fingerprint는 width/page/Section/Asset 경로·크기를 포함하며 signed token은 제외한다. API preflight, 캡처 DOM attribute, 캡처 후 canonical read가 같아야 반환한다. 변경 중이면 409. DB lock/write 없이 혼합 출력 방지.

## 브라우저와 이미지

- 요청당 Chromium launch/close, finally cleanup, 취소 시 close, 자동 재시도 없음. 프로세스당 1건, 동시 요청 409. provider boundary는 mock/향후 런타임 교체 가능.
- deviceScaleFactor=1 + screenshot scale=css. 실제 파일 signature/IHDR 또는 JPEG SOF를 읽어 persisted width 및 측정 height와 일치하는지 재검사한다.
- article 전체 높이, viewport 900px에 잘리지 않는다. 현재 기본 폭 860px, 다른 canonical 폭도 동일 원칙.
- fonts.ready 최대 10초. 모든 surface img의 complete/naturalWidth/decode 확인 최대 15초. networkidle에 의존하지 않는다.
- Renderer는 누락 이미지 fallback을 보여주지만 Export는 `asset_load`로 차단한다. 깨진 이미지가 든 파일을 성공으로 반환하지 않는다.
- private signed URL TTL 기존 5분 유지, 전체 export 75초보다 길다. SSR에서 다시 서명한 현재 asset 경로만 네트워크 허용. URL/output DB·Storage 저장 없음.
- light/ko-KR/Asia-Seoul 고정, reduced motion, animation/transition/caret/focus outline 제거, 포인터 hover 의존 없음. 시스템 폰트 정책 유지. OS별 설치 폰트 차이는 남는다.
- PNG lossless; JPG quality 60–100. 모두 canonical 흰색 base background, 투명 출력 없음.

## Origin과 보안

`DETAILFORGE_APP_ORIGIN`만 캡처 origin으로 사용한다. Host/Origin 헤더를 캡처 주소 생성에 쓰지 않는다.
개발 기본 `http://127.0.0.1:3000`; production은 명시적 설정 필수. HTTP는 localhost/127.0.0.1/IPv6 loopback만, HTTPS는 운영자 설정 origin만 허용한다. credentials/path/query/hash는 거부한다.
브라우저 GET allowlist: 정확한 Renderer URL, 동일 origin Next static assets, preflight에서 scope 검증한 signed image origin/path. 기타 주소·API·외부 호스트·비GET 차단, service worker 차단. 서비스키/사용자 cookies를 browser에 전달하지 않는다.
Browser/service/config/http/fingerprint는 server-only. 클라이언트는 제한된 options만 전달한다. 기존 single-user local MVP 범위이며 공개 배포 인증/RLS는 별도 과제다.

## 크기와 오류

MAX_EXPORT_HEIGHT=16,000px, MAX_EXPORT_PIXELS=16,000,000, 최대 폭 2,000px, binary 32MB 상한. 캡처 전 DOM 실제 폭/높이/가로 넘침을 검사한다. 초과하면 422, 자동 분할 없음.
Windows Chromium 153(v1243)에서 860×16000 및 2000×8000 실제 캡처 성공(각 약 0.5초). Chromium 전체 프로세스 WorkingSet 합계는 캡처 전 약 191MiB, 캡처 후 약 233–234MiB; Node RSS 약 134–135MiB였다. 이는 단순 합성 boundary fixture의 전후 샘플이며 peak/모든 상품의 메모리 보장은 아니다. 실제 이미지 decode 메모리를 포함한 cloud 부하는 별도 검증한다.

전체 75초, launch 15초, navigation 20초, selector 10초, font 10초, image 15초, screenshot 20초로 제한한다. 전체 취소가 단계 제한보다 우선한다. UI는 95초 후 취소한다.
missing data/empty/busy/changed/browser missing/page load/asset/font/timeout/surface/too large/screenshot/configuration을 한국어 안전 오류로 구분한다. raw provider/DB stack·URL·secret은 반환하지 않는다.

## 다운로드 UI와 응답

PNG/JPG radio, JPG quality number 기본90, 키보드 접근 가능. 진행 문구와 disabled/ref guard로 중복 요청 방지. Blob 다운로드 후 object URL 회수.
Facts/Plan/manual grounding 경고는 안내만 하고 차단하지 않는다. 경고 UI는 이미지 밖이다.
파일명은 NFC/길이 제한/경로·제어문자·Windows 예약명 정리 후 `상품명_detail_YYYYMMDD.png|jpg`; 안전 fallback `detail-page`. 날짜는 UTC 파일명에만 사용한다.
`Content-Type: image/png|image/jpeg`, UTF-8 attachment filename*, ASCII fallback, `Cache-Control: private, no-store`, nosniff, Content-Length.

## 로컬 설정과 배포

일반 설치: `npm ci`, `npx playwright install chromium`. 기본 OS cache에 쓰기 권한이 필요하다.
이번 환경은 기본 cache 쓰기가 거부되어 프로젝트 `node_modules/.cache/ms-playwright`에 설치했다. PowerShell 설치 예:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='C:\Projects\detailforge\node_modules\.cache\ms-playwright'
npx.cmd playwright install chromium
```

실행 `.env.local`에도 같은 `PLAYWRIGHT_BROWSERS_PATH`를 설정한다. 기본 cache를 쓴다면 해당 변수는 생략한다.
`DETAILFORGE_APP_ORIGIN=http://127.0.0.1:3000` (실제 서버 포트에 맞춤). 이번 검증만 3001을 사용했다. npm start에서도 origin 설정 필요.
브라우저 미설치 시 browser_missing 안내를 확인했다. 다른 캡처 구현으로 fallback하지 않는다.
Playwright 설치 버전에 맞는 browser binaries/OS libraries/한글 font/메모리/75초 실행시간/앱 origin 접근이 필요하다. Linux는 `npx playwright install --with-deps chromium`과 한국어 시스템 글꼴 설치를 검토한다.
현재 long-running Node local MVP다. Vercel/serverless 지원을 주장하지 않는다. serverless용 실행파일/메모리/시간 제약은 provider를 교체하고 별도 검증해야 한다.
참고: [공식 browser 설치](https://playwright.dev/docs/browsers), [locator screenshot](https://playwright.dev/docs/api/class-locator#locator-screenshot).

## 검증 기록

- 기존312 + 신규20 = 전체332 tests 통과. request/options/filename/origin/network/size/header/readiness/provider오류/timeout/concurrency/DB 불변 등.
- next typegen, tsc --noEmit, lint, production build, git diff --check 통과.
- 실제 private DB fixture: 10종 Section, 2 assets(화면6개), 수동편집/reorder/contain-cover/한글/긴 모델 문자열/긴 스펙. 유료 AI provider 없음.
- 실제 POST PNG/JPG signature·header 확인. 최종 긴 스펙 포함 PNG 860×7155, 393107 bytes; JPG quality90 860×7155, 595184 bytes. viewport900보다 긴 마지막 notice까지 포함.
- 출력 파일 육안 확인: 한글/첫 Hero~마지막 notice/현재 선택 이미지/순서/긴 문구와 스펙 줄바꿈; Editor/Review/Navigation/다운로드 UI 미포함.
- 브라우저 UI PNG/JPG 다운로드 시작 성공, JPG 기본90, 진행 중 controls disabled 확인. 수동 grounding 경고10개가 있어도 출력 성공.
- Project/Product/Facts/Validation/Analysis/Plan/Assets/DetailPage/Sections 전체 snapshot 비교 및 OpenAI 차단으로 read-only 확인. 임시 fixture DB/Storage 정리.
- 실 secret 값의 client JS/source 검색 결과0, browser 제어가 client bundle에 없음. 키 값을 로그에 출력하지 않았다.

## 후속 확인과 범위 밖

Cursor에서 실제 사용자 상품의 다운로드 파일, 다른 canonical 폭, JPG 품질60/100, 시스템 글꼴, 이미지 누락/재로딩, 큰 페이지 오류를 확인한다.
MVP 흐름은 저장→Final Renderer→PNG/JPG 다운로드까지 연결됐다. 공개 운영 전 Auth/owner RLS, 다중 worker admission/rate limiting, 대형 원본 이미지 decode 메모리, cloud browser provider와 글꼴 배포 검증이 필요하다.
PDF/분할/marketplace 규격/ZIP/thumbnail/cloud 저장/history/schedule/archive/public URL/watermark/Auth는 구현하지 않았다.
