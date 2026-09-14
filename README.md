# DetailForge

현재 PHASE 3 / TASK-011 Page Planner를 구현했다. 최신 Fact Validation의 supported Facts와
완료된 이미지 관찰, 최신 상품 전략을 조합해 구조적 Page Plan을 생성한다.
Facts와 Sections를 변경하지 않으며 supported는 외부 진위 증명이 아니다.

- 화면: `/projects/[projectId]/planner`
- 모델: 서버 `OPENAI_PLANNER_MODEL`, 기본 `gpt-5.6-terra`. 환경 변수는 .env.example 참고.
- DB: `0004_add_detail_page_plan.sql`까지 필요하다. 원격 migration은 dry-run으로 대상을 확인한 뒤 적용한다.
- 상세 구현/검증/한계: [TASK-011](docs/tasks/TASK-011.md), [현재 작업](docs/tasks/README.md)
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
