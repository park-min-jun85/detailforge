# TASK-033 — v0.1.0 Release Freeze & Final Checklist

2026-09-20 완료. **PASS — DetailForge v0.1.0 Local/Internal MVP Release.** 공개 SaaS 준비 완료를 뜻하지 않는다. 기준은 TASK-032 `ee47cb7`이며 이번 변경은 릴리스 문서와 설정 예제/ignore에 한정된다.

## 완료 보고

1. **TASK 목적**: 기존 MVP 코드를 동결하고 버전·설치 안내·migration 정합성·검사·보안·deterministic Export를 확인하여 내부용 태그 추천 여부를 판정했다.
2. **현재 branch**: `release/v0.1.0`. 시작 시 clean. main과 HEAD 모두 `ee47cb7ba77f1436b2c8bbc03e68d7e4dfdba30b`, reflog `Created from HEAD`. TASK-032 포함 확인.
3. **생성 파일**: `CHANGELOG.md`, `docs/RELEASE_CHECKLIST.md`, `docs/tasks/TASK-033.md`.
4. **수정 파일**: `README.md`, `.env.example`, `.gitignore`, `docs/tasks/README.md`.
5. **Application logic**: 변경 없음. src/tests/scripts/AGENTS/CLAUDE 불변. AI prompt·UI·Adapter·schemaVersion 변경 없음.
6. **Migration**: 생성·편집·원격 push 없음. 현재 0001~0005 유지.
7. **Dependency**: 추가/업데이트 없음. package.json/package-lock.json 불변. lockfile 재작성 없음.
8. **Package version before/after**: 0.1.0 → 0.1.0. private true 유지. 별도 product release version 충돌 없음; 데이터 schemaVersion은 건드리지 않았다.
9. **Package-lock version**: top-level과 packages[""] 모두 0.1.0. 설치된 npm dependency graph도 정상.
10. **CHANGELOG**: `0.1.0 - 2026-09-20`; Added/Improved/Safety / Data Integrity/Known Limitations. 실제 사용자 기능 중심이며 미구현 Auth/upscale/자동 publishing을 포함하지 않는다.
11. **README**: 지원 범위·workflow·stack·Node 24.x·PowerShell 설치·환경·Supabase·실행/검사·공개 차단을 정리했다. 공용 링크는 상대 경로로 유지한다.
12. **.env.example**: 변수 값 전부 빈 문자열. Asset/Product 기본 모델, 공식 옵션 기능의 키 누락 동작, origin/cache 조건을 주석으로 보완했다.
13. **실제 required env**: DB/Storage에는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. AI 실행에는 `OPENAI_API_KEY`, 공식 옵션 요청에는 `DOMEGGOOK_API_KEY`. production-mode Export에는 `DETAILFORGE_APP_ORIGIN` 필수; dev는 `http://127.0.0.1:3000` 기본. 선택 override는 `OPENAI_ASSET_MODEL`, `OPENAI_PRODUCT_MODEL`, `OPENAI_VALIDATION_MODEL`, `OPENAI_PLANNER_MODEL`, `OPENAI_SECTION_MODEL`, `OPENAI_SECTION_REGEN_MODEL`, `OPENAI_DETAIL_EXTRACTION_MODEL`, `PLAYWRIGHT_BROWSERS_PATH`. NODE_ENV는 프레임워크 설정이며 별도 사용자 필수 키가 아니다.
14. **.gitignore**: root artifacts/screenshots/test-results/Playwright reports/browser-profiles/tmp/temp 추가, 중복 Supabase temp 규칙 제거. env/Next/node_modules 기존 규칙 유지. `git check-ignore`로 확인했고 `.env.example`은 제외되지 않는다. 이미지 확장자 전체나 src를 막는 규칙은 없다.
15. **Migration sanity**: 0001 core+private bucket, 0002 products.ai_analysis, 0003 product_facts.validation, 0004 detail_pages.plan, 0005 product_options. 번호 중복·순서 오류·untracked SQL 없음, 정적 SQL 구조 검토. TASK-020의 Local/Remote 0001~0005 일치 기록 유지. 이번 CLI는 로그인 토큰 미제공으로 원격 재조회 불가; 새 DB 실제 적용도 미실행. SQL 실행까지 새로 검증한 것으로 표시하지 않는다.
16. **Database types sanity**: 현재 generated Row/Insert/Update의 7개 테이블, JSON 컬럼, 옵션 version/unique product FK와 migration 대조 및 typecheck 통과. 원격 타입 재생성은 하지 않았다.
17. **Storage requirement**: `product-assets` private bucket. 0001에서 생성, 소속/경로 검사 후 단기 signed URL로 표시(일반 preview 5분). 공개 전환·signed URL DB 영구 저장 없음. 이번 원격 Storage 변경 없음.
18. **Local setup verification**: Node 24.18.1/npm 11.16.0. `npm.cmd ci --dry-run --ignore-scripts --no-audit --no-fund`, `npm.cmd ls --depth=0`, `npx.cmd playwright install --dry-run chromium` 통과. 설치된 cache의 Chromium으로 production 앱/실제 Export 성공. 빈 머신의 npm ci/postinstall/다운로드와 fresh Supabase 설치는 이번에 실행하지 않았다. README 명령은 현재 scripts/기존 migration workflow 및 설치된 CLI help의 linked/dry-run/project-ref/schema 인수에 대조했다.
19. **Test command**: `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`. 존재하지 않는 npm test script를 안내하지 않는다.
20. **전체 test 결과**: pass 849, fail 0, skipped 0, cancelled 0, todo 0. mock provider 자동 검사이며 유료 API 미호출.
21. **Total tests**: 849. TASK-032와 동일, 파일 삭제/제외 없음. 문서 변경을 위한 구현 복제 테스트는 추가하지 않았다.
22. **Typegen**: `npx.cmd next typegen` exit 0.
23. **Typecheck**: `npx.cmd tsc --noEmit` exit 0.
24. **Lint**: `npm.cmd run lint` exit 0.
25. **Build**: `npm.cmd run build` exit 0. production Next 서버 부팅/Renderer 확인까지 수행했다.
26. **Diff check**: `git diff --check` 통과. 새 문서의 whitespace/링크/UTF-8도 확인했다.
27. **Secret scan**: tracked 366파일 + 신규3문서, client JS/map 26파일, TASK-033 텍스트 산출물에서 현재 실제 OpenAI/Supabase service-role/Domeggook 키 일치 0. 추가 OpenAI/JWT/service-role/Bearer/signed-token 패턴 검토에서 실제 노출 0. `tests/helpers/asset-db.mjs`의 2곳은 명시적인 `temporary-test-token` 모의 서명이다. client provider marker 0. 실제 키·전체 signed URL은 보고서에 저장하지 않았다. 알려진 값/패턴 검사지 모든 Git 역사와 알려지지 않은 비밀의 부재를 증명하는 검사는 아니다.
28. **Machine-specific path check**: README/CHANGELOG/RELEASE_CHECKLIST의 개인 사용자·Documents 절대경로 0. 역사적 QA 문서는 대규모 수정하지 않았다.
29. **Deterministic smoke**: TASK-030 상품 B의 저장 canonical을 읽기 전용 loopback fixture로 재현. 실제 원본 bytes에서 동일 crop을 복원하여 Page read → production Renderer → 실제 Export service/Chromium → PNG/JPG 확인. 실제 OpenAI/도매 API 0, 원격 DB/Storage 쓰기 0. fake key로 격리하고 non-loopback fetch를 차단했다. fixture hash 유지, mutation 0. 서명 POST는 read capability 발급으로 분류하며 DB 변경과 구분한다. 이전 helper에서 단일 signed URL 요청을 쓰기로 집계하던 계측을 외부 QA helper에서 보완한 뒤 재검사했다. 앱 수정은 아니다.
30. **PNG smoke dimensions**: 860×2744px, 1,009,246 bytes. 반복 PNG도 byte-for-byte 동일.
31. **JPG smoke dimensions**: 860×2744px, 278,564 bytes. PNG와 같은 canonical/Renderer/레이아웃.
32. **Final surface purity**: 5 Sections(hero/imageText/detail/specification/option), 이미지 3개 load 성공, 옵션 1그룹 6개. DOM 실제 폭860/높이2744, controls 0, review/debug 문구 0. 파일을 직접 열어 한글/스펙/첫·마지막 Section/이미지 배치 확인. 기존 canonical에 대한 stale-plan 안내는 article 밖 검토 UI에만 있으며 Export에는 없다.
33. **Git tracked artifact check**: .next/node_modules/artifacts/screenshots/browser profile/temp/실제 env 추적 0. smoke 산출물은 저장소 밖 작업공간 `artifacts/TASK-033/`에 보관하며 Git에 추가하지 않았다.
34. **Release Checklist**: `docs/RELEASE_CHECKLIST.md` 생성. 요청된 Scope~Git Release Steps 14개 영역을 포함한다.
35. **Checked/unchecked summary**: checked 42, unchecked 12. 미확인은 이번 원격 migration 재조회, fresh DB 적용/Storage 설치, 빈 머신 설치 4개; 공개 SaaS 전제 5개; 사용자 commit/merge/tag 3개다. 내부 릴리스 통과로 공개 전제를 체크하지 않는다.
36. **Release Backlog**: 기존 Before public deployment/Post-MVP enhancement/Nice-to-have 분류와 항목을 그대로 유지했다. 이번 freeze에서 제품 품질 문제를 억지로 수정하지 않았다.
37. **MEDIUM**: 4. 인물/제품 잘림 구분, 부분 타일 복구, 보고체 카피, 원본 장식 경계 보존.
38. **LOW**: 2. sparse Section 여백, 읽기 갱신 중 busy 문구.
39. **BLOCKER**: 0. TASK-032 QA + 이번 동결 범위 재검사 기준.
40. **HIGH**: 0. 이번에 새 상품 AI 품질 평가를 반복했다는 뜻은 아니다.
41. **Public SaaS blockers**: Auth/owner_id/사용자별 RLS/Storage ownership policy와 격리·비용·공개 운영 검증. 현재 server-only service-role 단일 사용자 환경을 인터넷에 공개하지 않는다.
42. **Data integrity guarantees**: Facts와 AI 해석 분리, 확정 옵션 snapshot, source/Derived 분리, 사람의 추출 승인, regeneration candidate-first, CAS/lease/복구 경계, private Storage. 절대적 정확성 보장이 아니다. 기존 회귀 tests를 유지했고 이번 작업은 실사용 데이터를 쓰지 않았다.
43. **AI limitations**: schema/evidence/copy guard는 의미의 진위를 보증하지 않는다. Copy·visual interpretation·unsupported claim은 판매자가 최종 검토한다.
44. **Extraction limitations**: 제품 관련성 검사와 crop 추천은 완전 자동 정답 시스템이 아니다. 사용자가 후보를 확인/승인해야 한다.
45. **Image quality limitations**: 없는 픽셀 복원 없음. intrinsic upscale cap·better candidate ranking·warning으로 대응. AI upscale/배경 제거 미지원.
46. **Supported wholesale scope**: Generic URL 후보 추출 + 현재 도매꾹 공식 옵션 API. 전체 도매사이트 지원, 복잡한 조합의 SKU 변환, 가격·재고 동기화로 확대 해석하지 않는다.
47. **Git status**: 수정4개(.env.example/.gitignore/README/docs/tasks/README), 신규3개(CHANGELOG/RELEASE_CHECKLIST/TASK-033). 다른 변경 없음. 미커밋 상태가 의도된 결과다.
48. **Diff summary**: 문서3개 생성, 안내2개 갱신, env 주석/ignore 보완. 전체 diff 직접 검토. app logic/dependency/generated types/SQL/binary/QA artifacts 변경 없음.
49. **v0.1.0 release verdict**: **PASS — DetailForge v0.1.0 Local/Internal MVP Release.** 기존 실제 E2E와 이번 849 tests·필수 검사·secret scan·정적 migration sanity·deterministic smoke·release-only diff 근거. 미검증 설치 환경까지 포함한 보편적 배포 보장은 아니다.
50. **Tag recommendation**: `v0.1.0` 권장. 아직 생성하지 않았다. 사용자 검토/승인 후 commit과 main 반영을 먼저 진행한다.
51. **Recommended commit message**: `chore: prepare v0.1.0 release`.
52. **Exact next Git commands**: 아래는 사용자가 검토 후 실행할 제안일 뿐 이번 작업에서는 실행하지 않았다. 다른 변경이 추가되거나 main이 이동하면 다시 diff/검사를 확인한다. ff-only 실패 시 강제 merge/reset을 하지 않는다.

```powershell
git switch release/v0.1.0
git status --short
git diff --check
git diff -- .env.example .gitignore README.md docs/tasks/README.md
Get-Content CHANGELOG.md
Get-Content docs/RELEASE_CHECKLIST.md
Get-Content docs/tasks/TASK-033.md
git add -- .env.example .gitignore README.md CHANGELOG.md docs/RELEASE_CHECKLIST.md docs/tasks/README.md docs/tasks/TASK-033.md
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "chore: prepare v0.1.0 release"
git switch main
git merge --ff-only release/v0.1.0
git tag -a v0.1.0 -m "DetailForge v0.1.0"
git status --short
git show --no-patch v0.1.0
```

## 검증 자료와 종료 상태

저장소 밖 작업공간의 `artifacts/TASK-033/`에 tests/typegen/typecheck/lint/build 로그, npm dry-run, `B.png`, `B.jpg`, 반복 PNG, export/quality/secret/fixture 상태 JSON을 남겼다. 이 파일들은 배포/commit 대상이 아니다. 최종 smoke의 테스트 서버와 브라우저 탭은 종료한다. 원격 테스트 데이터를 만들지 않아 추가 DB/Storage 정리 대상이 없다. 과거 TASK-032의 QA 정리·기존 14행 hash 검증 기록은 그대로 보존한다.

추가 실제 OpenAI 호출·schema push·Git commit·main merge·tag·push는 수행하지 않았다.
