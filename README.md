# DetailForge

현재 PHASE 3 / TASK-012 Section Engine을 구현했다. 최신 Page Plan을 같은 순서/type/key의
실제 Section 콘텐츠와 제한된 style tokens로 변환한다. 지원된 Facts만 주장 근거로 사용하며
기존 Facts/Validation/Product Analysis/Plan/Asset은 변경하지 않는다.

- 화면: `/projects/[projectId]/sections`
- 모델: 서버 `OPENAI_SECTION_MODEL`, 기본 `gpt-5.6-terra`. 환경 변수는 .env.example 참고.
- DB: 기존 migration 0001~0004와 sections.content/style 사용. TASK-012 migration 추가 없음.
- 재생성은 전체 교체 확인을 받으며 실패 시 기존 snapshot으로 보상한다. cross-row transaction은 아니다.
- 상세 구현/검증/한계: [TASK-012](docs/tasks/TASK-012.md), [현재 작업](docs/tasks/README.md)
- 자동 테스트: `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`
- 필수 검사: `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check`

아래는 프로젝트 생성 도구의 기본 안내다.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
