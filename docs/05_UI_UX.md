# UI / UX

## 목적

판매자가 상품을 입력하고 상세페이지 초안을 편집하는 화면 구조를 정의한다.
PHASE 0 / TASK-004의 App Shell 위에 PHASE 1 / TASK-005의 프로젝트 생성·조회를 연결한다.

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
- `/projects/new`: 프로젝트명 입력 및 생성
- `/templates`: 템플릿
- `/settings`: 설정

Sidebar에는 DetailForge 홈 링크와 Dashboard, Projects, Templates, Settings를 둔다.
Shell의 `NavItem`은 Client Component이며 `usePathname`으로 현재 메뉴를 계산한다.
홈은 정확히 `/`일 때만 선택되고 다른 메뉴는 해당 경로와 하위 경로에서 선택된다.
선택 상태는 흰 배경, 테두리, 굵은 글씨 및 `aria-current="page"`로 표시한다.
페이지와 나머지 공통 컴포넌트는 Server Components로 유지한다. 프로젝트 생성 폼은
`useActionState`를 사용하는 Client Component이며 Server Action으로 제출한다.

## 화면 구성

### Dashboard

- 제목: Dashboard
- 설명: 상품 상세페이지 제작 현황을 확인하세요.
- Primary CTA: 새 상세페이지 만들기 — `/projects/new`로 이동한다.
- 전체 프로젝트 / 작업 중 / 완료의 세 요약 카드
- 수치는 실제 DB의 exact count이다. 작업 중에는 draft/analyzing/generated/editing,
  완료에는 completed만 포함한다. 프로젝트가 없을 때는 0을 표시한다.
- 최근 프로젝트는 수정일 내림차순 최대 5개이며 목록과 동일한 행 UI를 사용한다.
- 프로젝트가 없으면 기존 '아직 생성된 프로젝트가 없습니다.' 안내를 표시한다.
- 조회 실패는 오류 안내와 다시 불러오기 링크를 표시하며, 0건으로 대체하지 않는다.
- 전체 프로젝트 보기 링크는 `/projects`로 이동한다.

### Projects

- 제목: 프로젝트
- CTA: 새 프로젝트 — `/projects/new`로 이동한다.
- 실제 목록은 수정일 내림차순, 동일 수정일에서는 id 내림차순으로 20개씩 표시한다.
- 이름, 한국어 상태, 한국 시간 기준 최근 수정일을 표시한다. DB의 상태값은 보존한다.
- 프로젝트 열기는 '준비 중' 표시만 두며 미구현 상세 route로 이동하지 않는다.
- 이전/다음 링크로 pagination하며 잘못된 page 입력은 안전한 페이지로 정규화한다.
- Empty State: 아직 프로젝트가 없습니다.
- 조회 실패 시 일반 오류 메시지와 다시 불러오기 링크를 표시한다.
- 공통 Shell과 EmptyState에 Supabase 또는 도메인 로직을 넣지 않는다.

### 프로젝트 생성

- 전용 `/projects/new` route에서 프로젝트명 하나만 입력한다. 별도 wizard는 없다.
- 서버에서 Zod로 trim 후 1~100자를 검증한다. 필드 오류는 입력란에 연결한다.
- 입력값은 오류 시 유지한다. 제출 중에는 입력을 읽기 전용으로, 생성 버튼을 disabled로
  표시하며 '생성 중…' 상태를 알린다. 동기 제출 잠금으로 빠른 중복 제출도 막는다.
- 성공 시 Projects로 이동하고 생성 완료 안내와 갱신된 목록을 표시한다.
- 실패 시 내부 정보 없는 오류 메시지와 목록 확인 링크를 제공한다. 응답 유실 시
  저장 여부가 불명확할 수 있어 목록 확인 후 재시도하도록 안내한다.
- 취소는 저장 없이 Projects로 이동한다. Product 입력이나 Editor는 열지 않는다.

### Templates / Settings

- 템플릿: 상세페이지 템플릿 기능은 이후 단계에서 제공됩니다.
- 설정: 준비 중 안내만 표시한다.
- 실제 템플릿 선택과 설정 입력 기능은 제공하지 않는다.

## 공통 UI와 스타일

- `src/components/app-shell/`: AppShell, AppSidebar, AppHeader, NavItem
- `src/components/ui/`: PageHeader, EmptyState, AppIcon
- `src/features/projects/components/`: CreateProjectForm, ProjectList, ProjectLoadError
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
