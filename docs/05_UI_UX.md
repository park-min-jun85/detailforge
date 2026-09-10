# UI / UX

## 목적

판매자가 상품을 입력하고 상세페이지 초안을 편집하는 화면 구조를 정의한다.
PHASE 0 / TASK-004에서는 데이터 연결 전의 App Shell과 Navigation을 구축한다.

## App Shell

- 공통 Root Layout에서 `AppShell`을 사용한다.
- Desktop(768px 이상)은 232px Sidebar + Top Header + Main Content 구조이다.
- Sidebar는 화면 높이를 사용하며 스크롤 시 상단에 유지된다. Main은 가용 너비를
  사용하고, 현재 목록/안내 페이지의 본문만 최대 1280px로 제한한다.
- Header는 공통 작업 공간 안내를 표시하고 페이지별 제목과 CTA는 `PageHeader`에 둔다.
- 향후 Detail Editor는 Main 내부에 별도 레이아웃을 배치할 수 있다.
- 작은 화면에서는 Sidebar를 상단으로 옮기며 메뉴를 2열 또는 4열로 배치한다.
  요약 카드는 화면 너비에 따라 1열 또는 3열로 표시한다. 별도 모바일 메뉴는 없다.

## Route와 Navigation

- `/`: Dashboard
- `/projects`: 프로젝트
- `/templates`: 템플릿
- `/settings`: 설정

Sidebar에는 DetailForge 홈 링크와 Dashboard, Projects, Templates, Settings를 둔다.
`NavItem`만 Client Component이며 `usePathname`으로 현재 메뉴를 계산한다.
홈은 정확히 `/`일 때만 선택되고 다른 메뉴는 해당 경로와 하위 경로에서 선택된다.
선택 상태는 흰 배경, 테두리, 굵은 글씨 및 `aria-current="page"`로 표시한다.
페이지와 나머지 공통 컴포넌트는 Server Components로 유지한다.

## 화면 구성

### Dashboard

- 제목: Dashboard
- 설명: 상품 상세페이지 제작 현황을 확인하세요.
- Primary CTA: 새 상세페이지 만들기 — 현재는 `/projects`로 이동한다.
- 전체 프로젝트 / 작업 중 / 완료의 세 요약 카드
- 수치는 모두 `—` placeholder이다. 보조 문구와 스크린리더용 텍스트로
  집계 준비 중임을 알리며 실제 DB 수치로 표시하지 않는다.
- 최근 프로젝트: 아직 생성된 프로젝트가 없습니다.
- 전체 프로젝트 보기 링크는 `/projects`로 이동한다.

### Projects

- 제목: 프로젝트
- CTA: 새 프로젝트
- 프로젝트 생성 기능은 준비 중이라는 설명을 버튼 아래 표시한다.
- 버튼은 `type="button"`, `aria-disabled="true"`이며 동작/폼/서버 호출이 없다.
  키보드 포커스는 받을 수 있고 `aria-describedby`로 준비 중 설명을 연결한다.
- Empty State: 아직 프로젝트가 없습니다.
- TASK-005에서는 페이지의 서버 경계에서 데이터와 생성 동작을 연결한다.
  공통 Shell과 EmptyState에 Supabase 또는 도메인 로직을 넣지 않는다.

### Templates / Settings

- 템플릿: 상세페이지 템플릿 기능은 이후 단계에서 제공됩니다.
- 설정: 준비 중 안내만 표시한다.
- 실제 템플릿 선택과 설정 입력 기능은 제공하지 않는다.

## 공통 UI와 스타일

- `src/components/app-shell/`: AppShell, AppSidebar, AppHeader, NavItem
- `src/components/ui/`: PageHeader, EmptyState, AppIcon
- Neutral zinc 계열의 밝은 화면, 흰 패널, 명확한 테두리와 절제된 모서리를 사용한다.
- 주 CTA는 짙은 중립색으로 강조하고 넉넉한 작업 공간과 높은 가독성을 우선한다.
- Tailwind CSS와 공통 CSS 클래스를 사용하며 추가 UI/아이콘 의존성은 없다.
- 아이콘은 작은 공통 SVG 컴포넌트로 제공한다.
- 한국어 시스템 폰트 fallback을 사용한다. Google 폰트 다운로드는 사용하지 않는다.
- 자동 dark mode, gradient, glassmorphism, 장식적 animation은 적용하지 않는다.

## 접근성

- `aside`, `nav`, `header`, `main`과 실제 링크/버튼을 사용한다.
- 페이지당 h1 하나, 영역별 h2/h3, 요약값은 dl/dt/dd로 구성한다.
- 본문으로 건너뛰기 링크와 본문 포커스 대상, 공통 focus-visible outline을 제공한다.
- 장식 아이콘은 `aria-hidden`과 `focusable="false"`로 처리한다.
- 아이콘만 있는 interactive element는 없다.
- 문서 언어는 한국어이고 페이지별 브라우저 제목을 제공한다.

## 후속 설계

- 상품 입력 플로우
- Editor 3열 레이아웃 (Section Navigator / Preview / Property Inspector)
- 문구·이미지·순서 편집
- JPG/PNG 출력
- Desktop-first 편집 환경의 세부 인터랙션