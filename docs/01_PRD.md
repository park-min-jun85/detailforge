# PRD

PRD v0.1 - 상세페이지 재구성 MVP

## TASK-025 승인 추출컷 중심 재구성

Images에서 직접 저장한 제품컷을 새 Planner/Section의 시각 자료로 사용한다. 미저장 후보는 사용하지 않는다. 일반 대표 이미지와 제품·사용 Derived를 Hero 후보로 비교하고, 유효한 Derived가 있으면 긴 parent Source를 기본 제외한다. 기존 페이지는 자동 수정하지 않고 stale와 명시적 재설계로 전환한다. Editor는 출처를 안내하고 Final/Export는 저장된 Section의 이미지 선택만 출력한다. 자세한 정책과 QA는 [TASK-025](tasks/TASK-025.md).

## TASK-026 품질 검토

작은 Hero를 제외하는 대신 원본1.5배 이내로 표시한다. Fact별 presentation coverage, 구체적 제목, 간결한 본문, 이미지 포함 비율과 반복 사용을 검토한다. 품질 경고는 Editor/Final review에만 나타나며 수동 편집을 차단하거나 이미지 출력에 포함하지 않는다. 새 crop의 명확한 얇은 경계만3% 이내 trim하고 기존 파일은 그대로 둔다. 실제 AI 효과는 TASK-027에서 검증하고 후속 TASK-028에서 보완한다.

## TASK-028 문구·시각 역할 분리

전체 AI 생성과 개별 재생성은 같은 commerce-copy 검사를 통과해야 한다. 실패 시 기존 콘텐츠 보존, 자동 retry/후처리 rewrite 없음. 사람이 입력한 보고체는 저장 가능하며 품질 경고만 표시한다. sparse 상품은4개 구성도 허용하고, detail/imageText는 필요 없으면 본문을 null로 두되 빈 문자열로 채우지 않는다. distinct 사진/근거가 없는 반복 visual Section은 계획하지 않는다. 실제 동일 상품 QA와 남은 한계는 [TASK-028](tasks/TASK-028.md).
