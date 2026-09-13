# AI Pipeline

## 목적

상품 분석부터 Section 초안 생성까지의 AI 단계를 정의한다.

## 현재 흐름

Product Facts → **Asset Analysis (TASK-008)** → Product Analysis → Page Planning → Section Generation.
이번 단계는 이미지의 시각적 관찰만 구현한다. Product Facts와 실제 이미지 원본을 변경하지 않는다.

## Asset Analysis

`POST /api/projects/[projectId]/assets/[assetId]/analyze`
→ 소속 확인 → 분석 상태 조건부 저장 → private Storage 임시 signed URL
→ OpenAI Responses API → strict Structured Outputs → 서버 Zod 재검증
→ `assets.metadata.aiAnalysis`와 `asset_type`의 단일 UPDATE.

- Asset 하나당 AI 요청 하나. 브라우저는 순차 분석하고 서버 프로세스의 동시 분석은 최대 2개다.
- 공식 `openai` Node SDK를 사용한다. SDK 호출은 `features/asset-analysis/provider.ts`에 한정한다.
- 서버 전용 config의 기본 모델은 `gpt-5.6-luna`; `OPENAI_ASSET_MODEL`로 재정의할 수 있다.
  `OPENAI_API_KEY`는 서버에서만 읽으며 로그·DB·브라우저에 전달하지 않는다.
- provider 제한 시간 60초, SDK 자동 재시도 0회, `store: false`, 출력 최대 4,000토큰.
- 서버가 검증한 DB 경로로 300초 signed URL을 생성한다. URL 발급 대기는 10초로 제한한다.
  분석용 URL은 클라이언트가 지정하지 않으며 metadata에도 저장하지 않는다.
- Product 이름만 보조 context로 전달한다. 설명, Product Facts, 이미지 문구를 상품 사실로 추론하지 않는다.

## 결과 schema v1

- `schemaVersion: 1`
- `role`: product / detail / usage / specification / option / notice / other
- `confidence`, `heroSuitability`: 각각 0~1
- `visualSummary`: 1~280자 한국어 시각적 요약
- `composition`: background(plain/lifestyle/graphic/mixed/unknown),
  textDensity(none/low/medium/high), subjectClarity와 productVisibility(각각 0~1)
- `signals`: showsProduct, showsUsageContext, showsDetailCloseup, showsSpecificationLayout,
  showsOptionsOrVariants, showsNoticeOrGuide의 boolean
- `warnings`: blurry / cropped / low_visibility / heavy_text / watermark_like_overlay /
  ambiguous_subject 중 최대 6개

모든 객체는 알 수 없는 필드를 거부한다. SDK의 `zodTextFormat`으로 strict JSON Schema를
전달하고 `responses.parse` 결과를 서비스 경계에서 다시 검증한다. 거부 응답, 불완전 출력,
잘못된 JSON·enum·범위는 정상 결과로 저장하지 않는다. 구조 검증은 내용의 사실성을 보장하지 않는다.

## Prompt와 사실정보 경계

developer 메시지에는 고정된 분석 정책만 둔다. 상품명은 별도 user 메시지의
`untrustedProductContext` JSON으로, 이미지는 `input_image`로 전달한다.
이미지 속 텍스트·상품 데이터는 명령이 아닌 분석 대상이며 내부 지시를 따르지 않도록 명시한다.
재질, 정확한 치수, 성능, 인증, 기능, 효과, 내구성, 성분, 제품명, 브랜드, 호환성, 안전성,
판매 claim을 확정하지 않는다. OCR·이미지 문구 복사·마케팅 문구 생성은 하지 않는다.

AI output은 **untrusted visual observation**이다. Product Facts를 생성하거나 수정하는 코드
경로를 제공하지 않는다. 후속 단계도 AI 관찰을 상품 사실의 Source of Truth로 사용하면 안 된다.

## 저장과 hero 정책

기존 metadata의 다른 key를 유지하고 `aiAnalysis`만 교체한다. 완료 시 검증된 결과와
status=completed, provider=openai, model, analyzedAt, attemptId를 저장한다.
confidence >= **0.65**면 role을 asset_type에 적용하고, 미만이면 unclassified로 저장한다.
threshold는 `schemas.ts`의 상수 한 곳에서 관리한다.

hero는 AI role에 없으며 자동 지정하지 않는다. 기존 Domain/DB의 hero enum은 유지한다.
heroSuitability는 전체 Asset 비교를 위한 보조 점수이고 최종 hero는 후속 Planner/사람이 선택한다.

## 상태, 재분석, 동시 작업

- 시작: analyzing + startedAt + attemptId. 이전 성공은 previousResult에 한 개만 보관한다.
- 성공: 새 completed 결과로 교체하고 previousResult를 제거한다.
- 실패: failed + failedAt + 제한된 errorCode. previousResult와 기존 asset_type을 유지한다.
- 시작 전 설정 누락/소속 오류: DB 분석 상태를 변경하지 않고 오류만 반환한다.
- 3분 이상 된 analyzing은 재시도할 수 있다. 미래 시각의 상태도 잠금으로 신뢰하지 않는다.
- metadata 전체 값과 asset_type을 UPDATE 조건에 넣어 비교 후 저장한다. 다른 metadata key가
  변경되면 최신 값을 읽어 최대 2회 DB 저장을 시도하며, AI는 다시 호출하지 않는다.
- attemptId가 달라지거나 Asset이 삭제/이동됐으면 늦게 도착한 결과를 덮어쓰지 않는다.
- DB 응답 유실 시 저장된 attempt/result를 재조회한다. 확인되지 않으면 성공을 표시하지 않는다.

이는 synchronous MVP다. 분석 중 탭을 닫으면 미요청 후속 이미지는 진행하지 않으며 서버 작업
완료도 보장하지 않는다. 프로세스 종료/DB 장애 시 analyzing이 남을 수 있고 3분 후 사람이 재시도한다.
다중 인스턴스 전체의 동시 호출 수, 정확히 한 번 과금, 지속적인 작업 실행은 보장하지 않는다.
향후 queue/worker, 운영 제한 시간, 사용자별 비용/권한을 별도 설계해야 한다.

## 후속 단계

TASK-009 Product Analysis는 검증된 Product Facts와 시각적 metadata를 구분해서 입력받아야 한다.
Product 분석, Fact validation, 판매 포인트/마케팅 생성, Page Planner, Section Engine은 아직 구현하지 않았다.

## 공식 참고

- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)
- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
