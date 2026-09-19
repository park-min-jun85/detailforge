# PRD

PRD v0.1 - 상세페이지 재구성 MVP

## TASK-025 승인 추출컷 중심 재구성

Images에서 직접 저장한 제품컷을 새 Planner/Section의 시각 자료로 사용한다. 미저장 후보는 사용하지 않는다. 일반 대표 이미지와 제품·사용 Derived를 Hero 후보로 비교하고, 유효한 Derived가 있으면 긴 parent Source를 기본 제외한다. 기존 페이지는 자동 수정하지 않고 stale와 명시적 재설계로 전환한다. Editor는 출처를 안내하고 Final/Export는 저장된 Section의 이미지 선택만 출력한다. 자세한 정책과 QA는 [TASK-025](tasks/TASK-025.md).

## TASK-026 품질 검토

작은 Hero를 제외하는 대신 원본1.5배 이내로 표시한다. Fact별 presentation coverage, 구체적 제목, 간결한 본문, 이미지 포함 비율과 반복 사용을 검토한다. 품질 경고는 Editor/Final review에만 나타나며 수동 편집을 차단하거나 이미지 출력에 포함하지 않는다. 새 crop의 명확한 얇은 경계만3% 이내 trim하고 기존 파일은 그대로 둔다. 새 AI 카피의 실사용 효과는 quota 복구 후 확인해야 한다.
