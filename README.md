# DetailForge

도매상품의 원본 사실정보와 실제 제품 사진을 보존하면서 판매용 상세페이지를 재구성하는 로컬·내부용 MVP다.

## 실행

1. `npm.cmd ci`로 의존성을 설치한다.
2. `.env.example`을 참고해 `.env.local`에 서버 설정을 넣는다. 실제 키를 커밋하거나 브라우저 설정에 넣지 않는다.
3. Supabase migration 0001~0005와 private `product-assets` bucket이 준비된 환경을 사용한다. 이미 적용된 migration을 수정·재적용하지 않는다.
4. `npx.cmd playwright install chromium`으로 Import fallback/Export용 브라우저를 준비한다.
5. `npm.cmd run dev` 실행 후 localhost:3000을 연다. Export의 `DETAILFORGE_APP_ORIGIN`은 실제 실행 origin과 같아야 한다.

production 확인은 `npm.cmd run build` → `npm.cmd start`다. 별도 포트를 사용하면 Export origin도 같은 포트로 설정한다.

## 작업 흐름

새 프로젝트 → URL 가져오기 또는 수동 입력 → 상품정보·이미지 후보 검토 및 저장 → 공식 옵션 후보 검토·입력란 반영·별도 저장 → 이미지 화면에서 긴 원본 제품컷 추출·선택 저장 → 필요한 이미지 AI 분석 → 상품 분석 → Fact 검증 → 페이지 설계 → Section 생성 → Editor의 문구·스타일·순서 저장 → 최종 미리보기 → PNG/JPG 다운로드.

AI 결과는 검토 대상이다. Facts와 확정 옵션은 AI가 수정하지 않는다. 미적용 후보와 미저장 편집은 Export에 포함되지 않는다. 실패 시 이전 성공 결과를 보존하며 재실행은 명시적인 동작이다.

## 검사

```powershell
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
npx.cmd next typegen
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
git diff --check
```

자동 테스트는 mock provider를 사용한다. 실제 외부 API QA는 별도 승인된 테스트 Project에서 최소 호출로 수행하고 DB·Storage 정리를 확인한다.

## 운영 범위

현재 인증 없는 server-only 단일 사용자 환경이다. **Auth, owner_id, 사용자별 RLS와 Storage 정책이 구현되기 전 공개 배포는 차단한다.** 로컬 MVP Release Candidate와 public SaaS 출시는 다르다.

[현재 작업](docs/tasks/README.md), [TASK-032 QA](docs/tasks/TASK-032.md), [공개 배포 전제와 후속 과제](docs/RELEASE_BACKLOG.md).
