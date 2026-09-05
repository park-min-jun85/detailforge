<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DetailForge

도매상품의 원본 사실정보와 실제 제품 정체성을 유지하면서, 판매자가 상세페이지를 빠르게 재구성하도록 돕는 Next.js 앱이다.

작업 시작 전에 이 파일과 관련 `docs/`를 먼저 확인한다. 현재 TASK 범위를 벗어난 대규모 리팩터링은 하지 않는다.

## Next.js 지침

위 `nextjs-agent-rules` 블록을 제거하거나 수정하지 않는다. `next dev`가 관리하는 블록이다.

코드 작성 전에 `node_modules/next/dist/docs/`에서 해당 가이드를 읽고, 학습 데이터보다 설치된 Next.js 버전을 따른다.

- App Router (`src/app/`)를 사용한다.
- 기본은 Server Components이다. 상호작용이나 브라우저 API가 필요할 때만 Client Components를 사용한다.
- TypeScript, Tailwind CSS, npm을 사용한다.
- 아직 새로운 프레임워크나 상태관리 라이브러리를 추가하지 않는다.

## 핵심 원칙

1. 제품 사실정보를 AI가 임의로 만들어서는 안 된다.
2. 인증, 재질, 크기, 성능, 효과 등의 정보는 Source Data에 근거해야 한다.
3. 실제 제품 이미지를 임의로 다른 제품처럼 변경해서는 안 된다.
4. Product Facts를 사실정보의 Source of Truth로 사용한다.
5. AI 마케팅 문구와 Product Facts를 분리한다.
6. 상세페이지는 하나의 긴 이미지가 아니라 Section들의 조합으로 관리한다.
7. 도매사이트별 차이는 Adapter 계층에서 처리한다.
8. 특정 오픈마켓 로직이 Core Domain에 침투하지 않게 한다.
9. AI 출력은 신뢰하지 말고 Schema Validation 후 사용한다.
10. 관련 없는 파일을 임의로 리팩터링하지 않는다.

## 기술 원칙

- UI와 Business Logic을 분리한다.
- TypeScript에서 가능하면 `any`를 사용하지 않는다.
- DB Schema 변경은 추후 migration 방식으로 관리한다.
- 변경 후 TypeScript / lint / build를 확인한다.

## 문서

| 파일 | 내용 |
| --- | --- |
| `docs/00_PROJECT.md` | Mission, Core Flow, MVP 범위 |
| `docs/01_PRD.md` | PRD (상세는 이후 갱신) |
| `docs/02_ARCHITECTURE.md` | 아키텍처 |
| `docs/03_DATABASE.md` | 데이터베이스 |
| `docs/04_AI_PIPELINE.md` | AI 파이프라인 |
| `docs/05_UI_UX.md` | UI/UX |
| `docs/06_CODING_RULES.md` | 코딩 규칙 |
| `docs/07_DECISIONS.md` | Architecture Decision Records |
| `docs/tasks/` | 현재 TASK와 작업 범위 |

프로젝트 규칙은 `.cursor/rules/`에도 있다. UI 작업은 `10-ui.mdc`를 따른다.
