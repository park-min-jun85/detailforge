# PHASE 0 / TASK-004 — App Shell

## 상태

구현 및 필수 검사 완료. 사람의 최종 UI 확인 대기. Git commit은 하지 않는다.
작업 브랜치: `feat/app-shell`.

## 목표

DetailForge의 공통 App Shell과 Navigation을 구현하고 TASK-005에서 프로젝트
기능을 연결할 화면 경계를 준비한다.

## 구현 범위

- Desktop Sidebar + Top Header + Main Content
- Dashboard(`/`), Projects(`/projects`), Templates(`/templates`), Settings(`/settings`)
- 경로 기반 active navigation과 접근성 속성
- Dashboard 요약 placeholder 세 개와 최근 프로젝트 empty state
- Projects 생성 준비 중 CTA와 empty state
- Templates와 Settings 안내 화면
- 작은 화면의 상단 메뉴 및 유연한 카드/본문 배치
- 한국어 메타데이터, 시스템 폰트, Neutral 기반 공통 스타일

## 컴포넌트 구조

- `src/components/app-shell/app-shell.tsx`: 공통 Shell 조합과 본문 건너뛰기
- `src/components/app-shell/app-sidebar.tsx`: 서비스명과 네 메뉴
- `src/components/app-shell/app-header.tsx`: 공통 Top Header
- `src/components/app-shell/nav-item.tsx`: 경로 판별과 active Link (Client Component)
- `src/components/ui/page-header.tsx`: 제목, 설명, CTA 슬롯
- `src/components/ui/empty-state.tsx`: 아이콘과 빈 상태 안내, 제목 단계 선택
- `src/components/ui/app-icon.tsx`: 외부 dependency 없는 장식용 SVG

Business logic은 공통 UI에 넣지 않는다. NavItem을 제외한 작성 컴포넌트와
페이지는 Server Components이다.

## CTA와 placeholder 결정

- Dashboard의 새 상세페이지 만들기는 Projects로 이동한다.
- Projects의 새 프로젝트 버튼은 키보드 포커스를 허용하는 aria-disabled 상태이다.
  실제 이벤트 처리와 생성 기능은 없으며 준비 중 설명을 연결한다.
- 요약값은 모두 `—`이고 집계 준비 중 안내를 표시한다.
- 새 dependency는 설치하지 않는다.

## 변경 문서

- `docs/05_UI_UX.md`: 현재 화면 구조, 스타일, 접근성, CTA 정책
- `docs/tasks/README.md`: 현재 TASK와 완료 상태
- 이 문서: TASK-004 범위와 검증 결과

## 검증 결과

- `npx next typegen`: 통과, route 타입 생성
- `npx tsc --noEmit`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과, 요청한 네 route가 정적 페이지로 생성됨
- 프로덕션 서버 브라우저 확인: 네 화면의 내용과 메뉴 이동, active aria-current 확인
- Dashboard CTA의 Projects 이동 확인
- Projects 생성 버튼이 접근성 트리에서 disabled로 표시되는 것을 확인
- Desktop Dashboard 시각 확인
- 375px viewport의 Dashboard/Projects 확인: 가로 넘침 없음
- 키보드 Enter 메뉴 이동과 본문 건너뛰기의 MAIN 포커스 이동 확인
- 브라우저 콘솔 warning/error 없음

## 사람이 직접 확인할 UI

- Desktop 1280px/1440px에서 Sidebar, Header, 본문 간격 및 정보 가독성
- 320px/375px/768px에서 메뉴, 카드, CTA의 줄바꿈과 페이지 스크롤
- Tab/Shift+Tab의 전체 순서, 활성 메뉴와 focus outline 구분
- 새 프로젝트 버튼 포커스 시 준비 중 안내 및 무동작 상태
- 네 route 직접 진입/새로고침/뒤로 가기 시 메뉴 상태
- Templates/Settings 안내 문구 및 한국어 글꼴

## 제외 범위와 후속 연결

Supabase CRUD, 프로젝트 생성, Product 입력, 이미지 업로드, AI API,
Page Planner, Section Engine, Detail Editor, Authentication, Marketplace,
Wholesale crawler는 구현하지 않는다. 기존 Supabase 구조와 migration은 변경하지 않는다.

TASK-005에서는 `src/app/projects/page.tsx`를 조합 지점으로 사용하고,
데이터 접근과 생성 동작은 서버 경계 및 features/services 계층에서 연결한다.