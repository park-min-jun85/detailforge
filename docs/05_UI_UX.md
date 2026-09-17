# UI / UX

## 목적

판매자가 상품을 입력하고 상세페이지 초안을 편집하는 화면 구조를 정의한다.
PHASE 0의 App Shell 위에 프로젝트·상품정보·이미지 등록과 이미지/상품 AI 분석, Fact Validation을 연결한다.

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
- `/projects/[projectId]`: 상품정보 생성/수정
- `/projects/[projectId]/images`: 저장된 상품의 이미지 등록·조회·삭제·AI 분석
- `/projects/[projectId]/analysis`: Product Facts와 완료된 이미지 관찰 기반의 상품 전략 분석
- `/projects/[projectId]/validation`: 기존 Facts와 입력 근거의 일관성·충돌·근거 부족 평가
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
- 프로젝트 열기는 `/projects/[projectId]`의 실제 상품정보 화면으로 이동한다.
  Dashboard 최근 프로젝트도 같은 링크를 사용한다.
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

### 프로젝트 상세 / 상품정보

- 프로젝트명과 현재 한국어 상태를 상단에 표시하며 App Shell을 유지한다.
- 상품정보 → 이미지 → AI 분석 → 상세페이지 단계 표시는 안내용이며 미래 단계 링크는 없다.
- 상품명(필수), 브랜드, 카테고리, 상품 설명, 원본 상품 URL을 입력한다.
- 스펙은 항목명/값 행을 최대 50개 추가·삭제할 수 있다. 삭제 버튼에는 행별 accessible label이 있다.
- 서버 검증: 상품명 1~200자, 브랜드/카테고리 최대 100자, 설명 최대 5,000자,
  URL 최대 2,048자 및 http/https, 스펙 항목명 100자/값 500자.
- 필드와 스펙은 trim한다. 완전히 빈 스펙 행은 제외하고 한쪽만 입력된 행은 오류로 표시한다.
- 기존 값으로 폼을 채우고 create/edit 모두 같은 화면에서 수행한다.
- 저장 중 입력/스펙 조작/저장 버튼을 비활성화하고 진행 상태를 알린다.
- 성공 시 저장 완료 안내와 정규화된 값을 표시한다. 이후 입력을 바꾸면 이전 완료 안내를 숨긴다.
- 검증 실패 시 입력값을 유지하고 오류를 해당 필드에 연결한다.
- 오래된 폼 또는 부분 저장 복구를 확인할 수 없는 경우 폼을 잠그고 다시 열기 링크를 제공한다.
- 잘못된 UUID/없는 Project는 목록 복귀 링크가 있는 not-found 화면으로 처리한다.
- Product 저장 후 '다음: 이미지 등록' 링크로 이동한다. 신규 저장 전과 저장 중/복구 필요 상태에는 링크를 제공하지 않는다.
  기존 Product의 미저장 변경사항은 먼저 저장하도록 안내한다.

### 제품 이미지

- 기존 Shell, 프로젝트명, 상품명, 제작 단계 표시를 유지하고 '2. 이미지'를 현재 단계로 표시한다.
- Product가 없으면 파일 선택 대신 상품정보를 먼저 저장하라는 안내와 복귀 링크를 표시한다.
- JPEG/PNG/WebP 파일을 여러 장 선택하고 이름·크기·파일별 대기/업로드 중/완료/실패를 확인한다.
  파일당 10MB(10MiB), 상품당 30개 제한을 안내한다. 선택 순서대로 한 장씩 전송한다.
- 선택/업로드/삭제 중복 실행은 동기 잠금으로 차단하고 작업 중 버튼을 비활성화한다.
  파일 input은 선택 직후 비워 동일 파일을 다시 선택할 수 있다. 재선택은 현재 선택 목록을 교체한다.
- 성공 파일은 유지하고 부분 실패는 개별 원인 및 성공/실패 수로 표시한다. 응답이 불명확하면
  다시 업로드하기 전에 목록을 새로고침하여 중복 등록을 피하도록 안내한다.
- 등록 목록은 이름, 크기, 미분류 상태, 원본 비율을 유지한 썸네일과 삭제 버튼으로 구성한다.
  작은 화면 1열, 440px 이상 2열, 넓은 화면 3~4열이다. 파일명은 줄바꿈한다.
- 삭제는 카드 안의 삭제 확인/취소로 한 번 확인한다. 다른 작업 중에는 삭제를 잠근다.
- 5분 signed URL은 4분마다/탭 복귀 시 갱신하며 수동 '목록 새로고침'도 제공한다.
  이미지 로딩 실패 시 재조회 안내를 보여준다. `next/image`의 `unoptimized`로 원본을 표시하며
  공개 URL이나 Image Optimization 캐시에 비공개 이미지를 복사하지 않는다.
- API/초기 조회 실패를 빈 목록으로 숨기지 않는다. 파일 작업 오류는 일반 메시지만 표시한다.
- 'AI 이미지 분석'은 미분석/실패/중단 이미지를 한 장씩 요청한다. 완료 이미지는 개별 재분석한다.
- 카드에 미분석/분석 중/완료/실패와 저장 분류, AI 역할, 신뢰도, 대표 이미지 적합도, 짧은 요약과 경고를 표시한다.
  낮은 신뢰도로 저장 분류가 미분류여도 AI 관찰 결과는 확인할 수 있다.
- 처리 수/전체 수와 성공/실패 수를 별도로 표시하며 한 장의 실패가 다른 성공을 취소하지 않는다.
  작업 중 업로드/삭제/분석 버튼을 잠그고 상태 메시지를 live region으로 전달한다.
- 새로고침 시 DB 결과를 복원한다. 진행 중 상태는 주기적으로 다시 읽으며 3분 이상 지난 분석은 재시도할 수 있다.
- 재분석 중/실패에는 '이전 성공 결과'를 구분해서 유지한다. 설정 누락은 DB 상태를 바꾸지 않고 카드 오류로 알린다.
- AI 결과는 시각적 관찰이며 상품 사실이나 대표 이미지 최종 선택이 아니라는 안내를 표시한다.
  '다음: 상품 분석 →'으로 상품 분석 화면을 연다. 상세페이지 구성은 아직 실행할 수 없다.

### 상품 분석 (TASK-009)

- 상품명, 상품정보 → 이미지 → 상품 분석 → 사실 검증 → 페이지 설계 → 상세페이지 단계를 표시하며 상품 분석이 현재 단계다.
- Product Facts 요약과 완료/전체 이미지 수를 먼저 보여준다. 이미지 0개 또는 부분 완료라도 실행 가능하며
  시각 근거 없음/일부 결과만 사용/형식 오류 제외 수를 명시한다.
- AI 상품 분석/상품 재분석 버튼, 미분석/분석 중/완료/실패와 별도의 업데이트 필요 안내를 제공한다.
- AI 결과는 전략적 해석이며 사실 검증이나 최종 광고 문구가 아니라는 설명을 항상 표시한다.
- 요약, 핵심 판매 포인트 후보, 고객군 가설, 사용 상황 가설, 메시지 방향, 콘텐츠 우선순위,
  주의/불확실 정보를 기존 neutral 패널로 구분한다. 근거는 F1/V2 대신 사람이 읽는 label을 보여준다.
- 재분석 중/실패에도 이전 성공을 유지하며 마지막 성공 시각과 이전 결과임을 표시한다.
- 결과 새로고침, 30초/탭 복귀 시 읽기, 진행 중 5초 읽기로 입력 변화와 상태를 확인한다.
  3분 이상 중단된 분석은 다시 실행할 수 있다. 자동 AI 재호출은 없다.
- 버튼은 키보드로 접근 가능하며 요청 중 중복을 잠근다. 상태/오류에는 status/alert를 사용한다.
- 상품 또는 Facts가 없으면 상품정보 입력 링크를 제공한다. 조회 오류를 빈 결과로 숨기지 않는다.

### Fact Validation (TASK-010)

- 상품정보 → 이미지 → 상품 분석 → 사실 검증 → 페이지 설계 → 상세페이지의 4단계이며 상품 분석의 다음 링크로 연다.
- 현재 Product Facts를 읽기 전용으로 표시하고, 별도 영역에 검증 당시 값과 결과를 표시한다.
  stale 결과의 Fact ID를 현재 값에 자동 연결하거나 이전 값으로 덮어쓰는 UI는 제공하지 않는다.
- Fact별 검증 완료(supported), 근거 부족, 충돌, 검토 필요의 텍스트/배지, 판정 이유,
  평가 신뢰도, snapshot 근거 펼치기를 표시한다. 신뢰도는 외부 진위 확률이 아님을 병기한다.
- 검증 완료는 입력 근거 범위 내 일관성이며 외부 세계의 진위를 입증하지 않는다는 안내를 항상 표시한다.
  원본 snapshot은 같은 수동 입력의 복사본일 수 있고 AI 관찰/과거 분석은 사실 자체가 아님을 알린다.
- 검증/재검증/새로고침은 명시적인 버튼이며 Fact 자동 생성/수정/교체 버튼은 없다.
  충돌 발견 시 사람이 원본 자료를 확인하도록 안내한다.
- 실행 상태와 판정 상태를 구분한다. 실패/진행 중에도 이전 성공을 유지하고 stale을 별도로 표시한다.
  30초/탭 복귀 시 GET, 진행 중 5초 GET으로 갱신하며 자동 유료 호출은 없다.
- semantic details/summary와 button, status/alert, 기본 키보드 focus를 사용한다.
  결과 카드는 넓은 화면 2열/작은 화면 1열이며 긴 근거는 줄바꿈과 높이 제한 스크롤을 적용한다.

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

## PHASE 3 / TASK-011 페이지 설계

/projects/[projectId]/planner를 기존 App Shell에 추가했다. 제작 단계는 상품정보 → 이미지 → 상품 분석 →
사실 검증 → 페이지 설계 → 상세페이지이며 현재 5단계다. Validation의 '다음: 페이지 설계 →'로 이동한다.

상단에 상품명, 현재 설계 상태, 새로고침/AI 페이지 설계(재설계), 검증 상태별 수, 완료 이미지 수, 상품 전략 상태를 표시한다.
최신 Validation이 없으면 '최신 사실 검증을 먼저 완료해 주세요.'와 검증 링크를 표시하며 실행을 비활성화한다.
현재 검증이 유효하지 않은 Fact는 사용 금지/검토 필요로 표시하며 과거 supported를 현재의 판정처럼 제시하지 않는다.

현재 Hero 후보와 저장 Plan의 Hero를 구분한다. 기존 private Asset 미리보기 경로를 재사용하고 4분 간격으로 URL을 갱신한다.
미리보기 실패/이미지 삭제가 저장 Plan을 지우지 않는다. Hero가 null이면 선택한 이미지 없음으로 안내한다.
Narrative, 경고, 순서별 Section type/우선순위/목적/제작 지침/Fact 값과 근거 수준/사용 이미지를 읽기 전용 카드로 표시한다.
restricted Fact는 접어서 현재 값을 확인할 수 있다. 실제 콘텐츠 편집, 자동 Fact 수정, drag/drop 기능은 없다.

입력이 바뀌면 '입력 정보가 변경되어 페이지 설계를 다시 생성하는 것을 권장합니다.'를 표시하며 이전 입력의 Plan임을 명시한다.
실패한 재계획에서도 이전 성공 Plan과 성공 시각을 계속 보여준다. 새로고침/조회 polling은 AI를 실행하지 않는다.
Neutral 패널과 semantic links/buttons/headings/status/alert를 재사용하며 작은 화면에서는 카드와 버튼을 줄바꿈한다.

## PHASE 3 / TASK-012 상세페이지 생성

/projects/[projectId]/sections는 제작 흐름의 마지막 '상세페이지' 단계다. Planner의
'다음: 상세페이지 생성 →'에서 이동하며 기존 App Shell/Neutral 패널을 재사용한다.
상품명, Plan 최신 여부, 설계/저장 Section 수, 콘텐츠 상태와 AI 생성/새로고침을 표시한다.

기존 콘텐츠가 있으면 '전체 다시 생성' 뒤 전체 교체 확인/취소를 제공한다. 확인을 시작한 시점의 row revision을
서버에 전달하여 그동안 다른 작업이 바꾼 결과를 새 확인 없이 교체하지 않는다.
생성/실패에도 이전 콘텐츠를 유지한다. 복구가 필요하면 보관 snapshot을 표시하고 '기존 콘텐츠 복구'는 유료 AI 없이 복구만 한다.

Plan이 없거나 오래되면 '최신 페이지 설계를 먼저 생성해 주세요.'와 Planner 링크/disabled 생성 버튼을 제공한다.
기존 콘텐츠가 stale이면 '페이지 설계가 변경되었습니다. 상세페이지 콘텐츠를 다시 생성하는 것을 권장합니다.'를 표시한다.
새로고침/polling은 GET만 사용하며 자동 생성하지 않는다.

type별 headline/subheadline/body/items/specification rows를 읽기 전용 카드로 표시한다. 이미지가 있으면 기존 private
미리보기 경로를 사용한다. 카드에 근거 ID/F와 V의 의미를 표시하고 provenance/style token은 details로 접는다.
860px 시각 캔버스/드래그/스타일 편집/개별 재생성은 없다. 길이 제한/줄바꿈/작은 화면 카드 배치와 키보드 접근을 유지한다.

## PHASE 4 / TASK-013 상세페이지 편집

Sections 화면의 `상세페이지 편집 →`으로 `/projects/[projectId]/editor`를 연다.
App Shell 안의 Desktop 3열: Navigator 240px / Preview 남은 공간 / Inspector 320px.
Preview는 논리 860px을 영역 너비에 맞춰 축소하며 내부 스크롤을 사용한다.
1200px 미만은 미리보기/섹션/속성 패널 탭이며 375px에서도 페이지 전체 가로 overflow가 없다.

Navigator는 sort_order 순서/한국어 type/짧은 제목과 active를 표시하고 Preview 클릭/키보드 버튼으로도 선택한다.
10종 type의 제목/본문/목록/장점 카드/스펙 표/이미지를 실제 세로 흐름으로 렌더링한다.
Renderer와 공유 가능한 표현 경계를 두고 선택 outline은 Editor wrapper에만 둔다. export는 이번 범위가 아니다.
Inspector는 type별 문구 form, bounded style select, 현재 상품의 기존 Asset checkbox를 제공한다.
스펙/옵션 사실값과 evidenceIds/plannerKey/fingerprint/provider/model/generationId는 읽기 전용이다.
기존 항목 개수/순서는 유지한다. 이미지 업로드는 기존 이미지 화면에서 한다.

입력은 draft에만 반영하며 `저장되지 않은 변경사항`을 표시한다. [저장] 성공 후 canonical row/새 revision으로 교체한다.
Section/앱 링크 이동 시 저장 후 이동/버리기/취소를 제공하고 확인 영역에 포커스한다.
취소는 이전 컨트롤로 포커스를 돌리며 beforeunload로 문서 이탈을 보호한다. autosave/AI 호출은 없다.
409 시 `다른 변경사항이 먼저 저장되었습니다. 최신 내용을 다시 불러와 주세요.`와 함께 draft를 유지한다.

문구를 바꾸면 manual provenance와 needs_review를 기록하고
`직접 수정한 문구입니다. 사실 표현을 한 번 확인해 주세요.`를 표시한다.
스타일 변경만으로는 grounding 상태를 바꾸지 않는다. 기존 evidence가 새 문구를 보증하는 것처럼 표시하지 않는다.
Plan fingerprint가 다르면 `페이지 설계가 변경되었습니다. 현재 상세페이지는 이전 설계를 기준으로 생성되었습니다.`를 표시하고 수동 편집은 허용한다.
생성/복구 중에는 기존 snapshot을 읽기 전용으로 보여준다. Section이 없으면 `먼저 상세페이지를 생성해 주세요.`와 CTA를 제공한다.
Header는 프로젝트/상품명, 저장 상태, stale 여부, 논리 폭을 표시한다.
private 이미지 URL은 4분 간격과 탭 복귀에 갱신하고 DB에는 Asset ID만 유지한다.

## PHASE 4 / TASK-014 Section 순서 변경

Navigator 항목에 native drag와 위로/아래로 버튼을 제공한다. 첫 위로/마지막 아래로는 disabled이며
순번·한국어 type·방향 aria-label과 keyboard alternative를 제공한다. 375px은 기존 섹션 탭에서 버튼으로 조작한다.
drag 중 대상 opacity/drop outline만 사용하며 과도한 애니메이션이나 dependency를 추가하지 않는다.

이동은 local orderDraft에만 반영한다. 선택된 Section ID는 유지되고 Navigator/Preview가 즉시 같은 순서를 표시한다.
`저장되지 않은 순서 변경`, `섹션 순서가 변경되었습니다.`, [순서 저장], [순서 되돌리기]를 제공한다.
순서 되돌리기는 마지막 서버 canonical order로 돌아간다. autosave는 없다.

문구/style dirty 상태에서 버튼 이동은 저장 후 계속/버리기/취소 확인을 거친다. 이때 drag는 잠시 비활성화한다.
order만 dirty이면 Section 선택은 가능하되 다른 페이지 이동/최신 재조회는 기존 확인 UI,
문서 reload/종료는 beforeunload로 보호한다. 실패 시 orderDraft를 유지한다.
409에는 `다른 변경사항이 먼저 저장되었습니다. 최신 섹션을 다시 불러온 뒤 순서를 변경해 주세요.`와
[최신 섹션 다시 불러오기]를 제공한다. 복구 필요 시 편집을 막고 재조회 후 [이전 순서 복구]를 제공한다.

stale 경고를 유지하면서 수동 reorder를 허용한다. 순서만 바꾸면 groundingStatus/manualEdit.textEdited는 그대로다.
Page Plan은 원본 설계로 남으며 저장된 sort_order가 현재 페이지 표시 순서다.
manualOrder가 있는 전체 재생성 확인에는 `직접 변경한 섹션 순서도 초기 설계 순서로 바뀔 수 있습니다.`를 추가한다.
이 기능은 AI를 호출하지 않는다.

## PHASE 4 / TASK-015 — 선택 Section AI 재생성

Editor에 [AI로 다시 생성]과 현재 Section에 대한 수동 편집 경고를 제공한다.
'직접 수정한 내용이 있습니다. AI 결과를 적용하면 현재 문구가 교체됩니다.'
content/style/order dirty는 먼저 저장 또는 되돌린 뒤 실행한다. 호출 중 중복 실행/다른 편집을 막는다.
'AI가 이 섹션을 다시 작성하고 있습니다.'를 상태 영역에 표시한다.

현재/새 AI 결과를 Desktop 2열, 작은 화면 1열로 비교한다. 미저장 후보, style/이미지/순서 보존,
모델/10분 유효 시간을 설명하고 [새 결과 적용]/[기존 내용 유지]를 제공한다.
기존 중앙 Preview는 명시적 적용 전까지 canonical content를 유지한다. 후보를 자동 저장하지 않는다.
후보가 있으면 적용/버리기 전 다른 Section 선택·편집·이동을 제한하고 문서 이탈 경고를 연결한다.
409와 provider 오류는 안전한 안내를 제공하며 기존 내용/후보를 보존한다.
stale Plan/Validation은 AI를 차단하며 페이지 설계/사실 검증 확인 링크를 제공한다.
Inspector에는 이전 manual edit 이력을 남긴 마지막 AI 재생성 provenance를 표시한다.
검증과 수동 확인 항목은 [TASK-015](tasks/TASK-015.md)를 따른다.

## PHASE 5 / TASK-016 최종 상세페이지 검토

Editor [최종 미리보기] → /projects/[projectId]/render → [편집기로 돌아가기]를 제공한다.
미저장 content/order와 AI candidate는 기존 이탈 guard로 보호하고 최종 화면에는 저장된 값만 표시한다.
검토 화면 상단에 Section 수, 수동 문구 needs_review 수, 누락 이미지 수, 저장 폭, stale 경고를 둔다.
본문 캡처 경계인 data-detail-render-surface 안에는 관리 UI/경고/선택 표시가 없다.

저장 폭(기본 860px)을 scale 없이 표시한다. 좁은 화면은 검토 shell을 유지하고 본문만 가로 스크롤한다.
10종 공유 Renderer는 Hero 제목, Benefits 카드, split 이미지/텍스트, Gallery grid, useCase,
고정 표 레이아웃과 Notice 구분을 코드에 정의한다. Editor도 같은 renderer를 사용한다.
빈 optional 요소는 생략하고 긴 한국어/모델명은 keep-all/overflow-wrap으로 감싼다.
4:3 이미지 frame에서 contain/cover를 적용하고 실패 시 위치별 fallback을 표시한다.
생성·복구·저장 중 final은 busy 안내만 표시한다. stale 콘텐츠는 경고와 함께 검토할 수 있다.
Renderer는 읽기 전용이고 PNG/JPG 다운로드는 TASK-017에서 제공한다. 상세는 [TASK-016](tasks/TASK-016.md).

## TASK-017 이미지 다운로드

Final review의 준비 상태와 render article 사이에 Export panel을 제공한다.
PNG/JPG radio, JPG 품질60–100(기본90), 다운로드 버튼과 live status를 제공한다.
출력 중 중복 클릭/형식 변경은 잠그고 완료 시 브라우저 파일 다운로드를 시작한다.
Facts/Plan/manual grounding 경고는 검토 안내이며 출력 금지 조건은 아니다. 이미지 누락은 오류로 안내한다.
review 경고/내비게이션/버튼은 이미지에 포함하지 않는다. 저장된 내용만 원본 폭으로 출력한다.
너무 큰 페이지/이미지·폰트 실패/미설치 Chromium/timeout은 한국어 오류로 표시한다.
파일을 서버에 보관하지 않으며 긴 페이지 자동 분할은 지원하지 않는다. [TASK-017](tasks/TASK-017.md).

## TASK-018 상품정보 가져오기

상품정보 화면 상단 URL 입력과 불러오기 버튼을 추가한다. 수동 입력 폼은 그대로 유지한다.
성공 시 Import Preview 출처/자동 추출 안내/이미지 선택을 보여주고 기존 상품 폼의 draft를 채운다. 아직 DB 저장되지 않았음을 명시한다.
상품명·설명·스펙 수정 및 스펙 추가/삭제 후 ‘확인한 정보로 저장’을 누를 때만 Facts 저장으로 진행한다. Preview 취소는 이전 입력을 복원한다.
이미지는 사용자 checkbox로 결정하고, HTTP Preview/외부 이미지 가져오기는 서버가 수행한다. 진행 중 중복 요청과 폼 변경을 막는다.
상품 저장 성공 후 파일별 결과와 부분 성공 수를 안내하고 기존 ‘다음: 이미지 등록’으로 연결한다. Images에서 미분류 상태로 확인한다.
내부 주소/접근 제한/로그인/CAPTCHA/대용량/timeout은 안전한 한국어 오류로 표시하며 기존 입력을 보존한다. [TASK-018](tasks/TASK-018.md).

## TASK-019 Facts 제외 예정 안내

Preview/Form의 placeholder input은 그대로 보여준다. 해당 spec 또는 선택적인 브랜드/카테고리 아래에 회색 보조 문구 `원문은 보존되며 사실정보에는 포함되지 않음`을 표시한다.
저장을 차단하는 오류/경고가 아니며 aria-describedby로 연결한다. 실제 값으로 수정하면 안내가 사라진다. 규칙은 저장 mapper와 동일한 helper를 사용한다.
저장 후 Product Facts 요약에는 정규화된 사실 후보만 표시한다. 입력 화면 재진입 시에는 보존된 원문을 표시한다. 충돌 가능한 실제 값은 자동 정정하지 않는다. [TASK-019](tasks/TASK-019.md).

## TASK-020 상품 옵션

상품정보 form 아래에 별도 옵션 form을 둔다. 상품 저장 전에는 안내하며 옵션 저장을 막는다. 기존 상품정보/스펙 저장과 옵션 저장은 독립적임을 설명한다.
그룹명/값 입력, 그룹·값 추가/삭제, 명시적 옵션 저장, 최신 옵션 불러오기, 옵션 변경 취소를 제공한다. 최대10그룹/그룹당30값/전체100값이다.
성공 시 서버 canonical 값과 version으로 draft/dirty를 갱신한다. 실패·409 충돌은 draft를 유지하고 최신 옵션 불러오기를 안내한다.
마지막 값 삭제 시 값 추가 또는 그룹 삭제 안내. 참조 안내문은 source에는 남지만 confirmed 선택값에서 제외됨을 회색 보조 문구로 표시한다. 없음/X 같은 명시적 선택지는 허용한다.
새로고침 이탈과 dirty 상태에서 최신 값 불러오기에는 미저장 변경 안내를 제공한다. keyboard label/button, status/alert와 기본 responsive grid를 사용한다. [TASK-020](tasks/TASK-020.md).
