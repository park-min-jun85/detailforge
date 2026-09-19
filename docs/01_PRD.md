# PRD

PRD v0.1 - 상세페이지 재구성 MVP

## TASK-025 승인 추출컷 중심 재구성

Images에서 직접 저장한 제품컷을 새 Planner/Section의 시각 자료로 사용한다. 미저장 후보는 사용하지 않는다. 일반 대표 이미지와 제품·사용 Derived를 Hero 후보로 비교하고, 유효한 Derived가 있으면 긴 parent Source를 기본 제외한다. 기존 페이지는 자동 수정하지 않고 stale와 명시적 재설계로 전환한다. Editor는 출처를 안내하고 Final/Export는 저장된 Section의 이미지 선택만 출력한다. 자세한 정책과 QA는 [TASK-025](tasks/TASK-025.md).
