# DetailForge

도매상품의 사실정보와 실제 제품 사진을 보존하면서 판매용 상세페이지를 재구성하는 **v0.1.0 Local / Internal MVP**다.

**공개 인터넷 SaaS 배포는 차단한다.** 현재는 인증 없는 server-only service-role 기반 단일 사용자 구조다. 공개 전에 Auth, owner_id, 사용자별 RLS와 Storage ownership policy가 필요하다. 로컬 실행도 신뢰하는 사용자만 접근하도록 한다.

## 지원 범위와 작업 흐름

Project 관리 → URL 가져오기 또는 수동 Product/Facts 입력 → 상품정보·스펙·이미지 후보 검토 및 저장 → 도매꾹 공식 API의 도매매 옵션 후보 확인·입력란 반영·별도 저장 → 긴 상세 이미지의 제품컷 후보 추출·사람이 선택해 Derived Asset 저장 → 이미지/상품 AI 분석 → Fact Validation → Page Planner → Section 생성 → Detail Editor에서 문구·스타일·순서 편집 또는 개별 Section 재생성 후보 검토 → Final Renderer → PNG/JPG Export.

Generic URL Import와 도매꾹 공식 옵션 API를 지원하며 모든 도매사이트의 호환성을 보장하지 않는다. Fact placeholder 정규화, Product-Relevance Guard, Commerce Copy Quality Guards, Commerce Visual System, Hero 해상도·제목 관련성 검사를 포함한다. 상품정보/옵션/이미지는 각각 명시적으로 저장하며 미적용 후보·미저장 편집은 Export에 포함되지 않는다.

Facts와 AI 해석, 원본과 Derived를 분리한다. 확정 옵션은 deterministic snapshot으로 전달하고 조건부 저장/CAS·lease·복구 경계로 충돌을 처리한다. AI 검증이 정확성을 보장하지는 않으므로 카피·시각 관찰·추출 후보의 사람 검토가 필요하다. Fact Validation의 supported는 입력된 근거 범위에서 일관됨을 뜻한다. 긴 이미지 추출도 후보 추천이며 최종 승인 후 저장한다. 낮은 원본 해상도는 후보 순위·확대 상한·경고로 대응하며 없는 픽셀을 복원하지 않는다.

미지원: Public SaaS·다중 사용자·Auth·owner_id·사용자별 RLS/Storage 정책, marketplace publishing, SKU 조합 엔진·가격/재고 동기화, AI 이미지 생성·AI upscale·배경 제거, PDF·분할 Export, theme marketplace, 광범위한 도매 Adapter.

## 기술 환경

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase PostgreSQL/private Storage, OpenAI Structured Outputs + Zod, Sharp, Playwright Chromium을 사용한다. 버전은 package-lock.json을 기준으로 설치한다.

Windows PowerShell에서 **Node.js 24.x와 npm**을 사용한다. 현재 테스트 loader는 Node 24의 내장 TypeScript/registerHooks를 사용한다. Next 자체의 최소 Node 요구(20.9+)와 프로젝트 전체 검증 환경은 다르다. 정확한 patch 버전을 강제하는 engines는 추가하지 않았다.

## 로컬 설치와 환경변수

저장소 루트에서 실행한다. 기존 `.env.local`이 있으면 덮어쓰지 않는다.

```powershell
npm.cmd ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npx.cmd playwright install chromium
```

`.env.local`에 아래 서버 설정을 넣는다. 키를 커밋하거나 `NEXT_PUBLIC_` 변수에 넣지 않는다.

- DB/Storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- AI 기능 실행: `OPENAI_API_KEY`. 미설정 시 AI 기능의 설정 오류로 처리한다.
- 공식 옵션 가져오기: `DOMEGGOOK_API_KEY`. 없으면 해당 요청만 설정 오류를 반환하며 앱 전체가 시작 시 종료되지는 않는다. 버튼이 자동으로 비활성화되는 것은 아니다.
- Export: `DETAILFORGE_APP_ORIGIN`. dev 기본값은 `http://127.0.0.1:3000`; `npm.cmd start`에서는 로컬이어도 필수다. 실행 중인 origin/port와 일치시킨다. 예: `http://localhost:3000`. 요청 Host로 추론하지 않는다.
- 선택 사항: `OPENAI_ASSET_MODEL`, `OPENAI_DETAIL_EXTRACTION_MODEL`의 코드 기본값은 `gpt-5.6-luna`; `OPENAI_PRODUCT_MODEL`, `OPENAI_VALIDATION_MODEL`, `OPENAI_PLANNER_MODEL`, `OPENAI_SECTION_MODEL`, `OPENAI_SECTION_REGEN_MODEL`은 `gpt-5.6-terra`다. 모두 optional override이며 모델 이용 권한은 사용하는 계정에서 확인한다.
- 선택 사항: `PLAYWRIGHT_BROWSERS_PATH`. 설치와 앱 실행에 같은 경로를 사용한다. Playwright CLI는 `.env.local`을 자동으로 읽지 않으므로 사용자 지정 경로를 쓴다면 설치 명령 전 PowerShell 환경변수에도 같은 값을 설정한다. 비워 두면 기본 browser cache를 사용한다.

## Supabase 준비

새 Supabase Project를 준비하고 아래 명령에서 실제 project ref를 입력한다. 로그인은 로컬 CLI에서 진행하며 비밀키를 명령 인수나 채팅에 넣지 않는다.

```powershell
npx.cmd supabase login
$projectRef = Read-Host 'Supabase project ref'
npx.cmd supabase link --project-ref $projectRef
npx.cmd supabase migration list --linked
npx.cmd supabase db push --linked --dry-run
```

새 빈 Project라면 0001~0005가 순서대로 예정되어야 한다. 기존 Project라면 이미 적용된 migration은 제외되어야 한다. 대상 Project와 dry-run의 pending 목록이 예상과 일치하는지 확인한 뒤에만 적용한다.

```powershell
npx.cmd supabase db push --linked
npx.cmd supabase migration list --linked
npx.cmd supabase gen types typescript --linked --schema public > src/lib/supabase/database.types.ts
npx.cmd next typegen
npx.cmd tsc --noEmit
```

순서는 `0001_initial_schema` → `0002_add_product_ai_analysis` → `0003_add_fact_validation` → `0004_add_detail_page_plan` → `0005_add_product_options`다. 적용한 파일을 수정하거나 강제 재적용하지 않는다. 생성 타입 diff도 검토한다. PowerShell의 출력 인코딩 차이를 피하려면 타입 파일이 UTF-8인지 확인한다.

0001이 만드는 **private `product-assets` bucket**이 필요하다. 공개 bucket으로 바꾸지 않는다. 서버에서 소속/경로를 검증한 뒤 5분 signed URL을 발급하며 URL을 DB에 저장하지 않는다. 현재 RLS는 일반 클라이언트 접근을 막고 service-role 서버로 작업하는 경계이며 사용자별 격리가 아니다. 상세 schema는 [Database](docs/03_DATABASE.md)를 따른다.

## 실행과 검사

```powershell
npm.cmd run dev -- --hostname 127.0.0.1
```

`http://127.0.0.1:3000`에서 실행한다. 별도 포트라면 `--port`와 Export origin도 함께 맞춘다.

```powershell
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
npx.cmd next typegen
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
git diff --check
```

자동 테스트는 mock provider를 사용한다. 전체 테스트 명령의 파일 범위를 임의로 줄이지 않는다. 실제 외부 API QA는 별도 검증 Project에서 최소 호출로 수행한다.

production 모드의 **로컬 확인**은 `.env.local`에 `DETAILFORGE_APP_ORIGIN`을 설정한 뒤 `npm.cmd run build` → `npm.cmd start -- --hostname 127.0.0.1`이다. Chromium 설치와 실제 이미지/한글 글꼴 표시까지 확인한다. 기본 최종 폭은 860px이며 Export는 높이 16,000px·16MP·75초 제한을 유지한다. 초과 페이지의 자동 분할은 제공하지 않는다.

[Changelog](CHANGELOG.md) · [Release Checklist](docs/RELEASE_CHECKLIST.md) · [현재 작업](docs/tasks/README.md) · [실제 E2E QA](docs/tasks/TASK-032.md) · [공개 전제와 후속 과제](docs/RELEASE_BACKLOG.md)
