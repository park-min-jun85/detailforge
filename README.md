# DetailForge

현재 PHASE 2 / TASK-010 Fact Validation을 구현했다. 상품 분석 다음 화면에서 기존 Product Facts와
입력 근거의 일관성/충돌/근거 부족을 확인한다. AI는 Facts를 생성하거나 수정하지 않는다.
supported는 입력 근거 안에서 일관된다는 뜻이며 외부 진위가 입증됐다는 뜻이 아니다.

- 화면: `/projects/[projectId]/validation`
- 환경 변수는 `.env.example`을 참고한다. 검증 모델 override는 서버 전용 `OPENAI_VALIDATION_MODEL`이다.
- DB는 `0003_add_fact_validation.sql`까지 필요하다. 원격 migration은 dry-run으로 대상을 확인한 뒤 적용한다.
- 상세 구현/검증/한계: [TASK-010](docs/tasks/TASK-010.md), [현재 작업](docs/tasks/README.md)
- 자동 테스트: `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`
- 필수 검사: `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`

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
