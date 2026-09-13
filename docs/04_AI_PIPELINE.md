# AI Pipeline

## 목적

상품 분석부터 Section 초안 생성까지의 AI 단계를 정의한다.

## 현재 흐름

Product Facts → **Asset Analysis (TASK-008)** → **Product Analysis (TASK-009)** → Page Planning → Section Generation.
이미지의 시각적 관찰과 상품 전략 해석을 구현한다. Product Facts와 실제 이미지 원본을 변경하지 않는다.

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

## Product Analysis (TASK-009)

Product Facts + completed Asset Analysis + 선택적 원본 설명 → 서버 evidence registry →
텍스트 전용 Responses API → strict schema/Zod/근거 ID 검증 → products.ai_analysis 저장.
원본 이미지를 다시 전송하거나 signed URL을 발급하지 않아 Vision 분석 비용이 중복되지 않는다.

### 근거와 fingerprint

- F1 상품명, F2 브랜드(있으면), F3 카테고리(있으면), F4 이후 이름/값으로 정렬한 스펙이다.
  현재 manual Facts schema만 허용하며 알 수 없는 Facts 필드를 조용히 삭제하지 않는다.
- V1 이후는 Asset id 순서의 완료된 시각적 관찰이다. 실패/진행 중의 previousResult는 사용하지 않는다.
  잘못된 Asset 분석 schema는 제외하고 coverage.invalid에 표시한다. Asset 소속 오류는 전체 요청을 거부한다.
- S1은 `UNVERIFIED SOURCE DESCRIPTION`이다. Fact가 아닌 참고 설명이며 근거 없는 사실로 승격하지 않는다.
- 객체 key 정렬, Unicode NFC, 줄끝/앞뒤 공백 정규화, 스펙/Asset 정렬, warnings 정렬을 적용한다.
  서버의 SHA-256은 실제 사용한 registry와 coverage를 대상으로 계산한다.
  모델명/분석 시도 시각/DB updated_at/미사용 metadata/파일 경로는 입력 fingerprint에 넣지 않는다.
  동일 내용의 이미지 재분석만으로는 stale이 되지 않는다. Facts/설명/관찰 내용 또는 coverage 변경은 감지한다.
- 분석 시 evidenceSnapshot과 inputFingerprint를 서버가 저장한다. 이미지 URL, 파일 경로, API 정보는 포함하지 않는다.
  이후 근거 ID의 의미는 현재 registry가 아니라 해당 저장 snapshot에서 해석해야 한다.

### 결과와 검증

schemaVersion 1, summary(text/evidenceIds), valuePropositions(최대 5), audienceHypotheses(최대 4),
useCaseHypotheses(최대 5), messagingAngles(최대 5), contentPriorities(emphasize/deEmphasize 각각 최대 6),
cautions(최대 8)를 반환한다. 전략은 title/label/angle, rationale, 0~1 confidence, evidenceIds로 구성한다.
요약 600자, 제목 100자, 이유 400자, 우선순위 160자, 주의 300자로 제한한다.

요약과 전략은 근거 1~12개를 참조한다. 요약에는 F가 필요하고 전략은 F 또는 V가 하나 이상 필요하다.
S만으로 전략을 만들 수 없다. 주의 문구의 evidenceIds는 비어 있을 수 있다. 모든 참조는 registry에
존재해야 하고 중복 ID/공백뿐인 결과/알 수 없는 필드를 거부한다. 근거 부족 시 빈 전략 배열을 허용한다.

### 의미와 prompt 정책

Product Facts가 Source of Truth다. Product Analysis는 검증 결과가 아닌 전략적 해석/가설이다.
Facts 문자열도 실행 지시로서는 비신뢰 데이터다. 고정 developer 정책과 user JSON을 분리한다.
확인되지 않은 재질·치수·인증·성능·효과, 경쟁사 우월성, 근거 없는 절대 표현을 만들지 않는다.
시각 관찰/원본 설명을 사실로 승격하거나 이미지 속 사람의 나이·직업·소득·민감속성을 추정하지 않는다.
메시지 방향은 설명 전략이며 최종 광고 카피가 아니다. schema/근거 존재 검증이 문장의 사실성을 증명하지는 않는다.

### 저장, 상태와 비용

서버 config의 기본 모델은 `gpt-5.6-terra`, override는 `OPENAI_PRODUCT_MODEL`이다. 기존 키/SDK를 사용한다.
store=false, 최대 출력 7,000토큰, provider 60초, 자동 재시도 0회다. 각 DB 요청은 10초로 제한한다.
브라우저 요청은 POST 125초/GET 45초, route maxDuration 120초이며 호스팅 한도는 별도 확인한다.

attempt(analyzing/completed/failed)와 latestResult를 분리한다. 첫 실패에는 latestResult=null이고,
재분석 실패는 이전 성공을 보존한다. 3분 이상 또는 미래 시각의 analyzing 잠금은 재시도 가능하다.
설정 누락/입력 오류는 상태 claim 전에 반환한다. DB 응답 유실은 재조회하며 AI를 자동으로 재호출하지 않는다.
저장 여부가 불명확하거나 다른 runId로 바뀌면 성공을 표시하거나 이전 상태로 덮어쓰지 않는다.

현재 fingerprint와 성공 결과의 fingerprint가 다르면 업데이트 필요 안내를 표시한다. 분석 도중 입력이
바뀌어도 기존 snapshot을 보존하고 완료 후 재조회로 stale을 알린다. stale 감지는 AI 호출을 실행하지 않는다.
이미지가 없거나 일부만 완료됐어도 Facts가 유효하면 실행할 수 있다. coverage와 시각 근거 없음은 입력/UI에 명시한다.

## 후속 단계

TASK-010 Fact Validation은 기존 Facts와 source_snapshot을 근거로 별도 검증을 설계해야 한다.
전략 결과/evidenceIds의 존재를 사실 검증으로 오해하지 않는다. 최종 마케팅 문구, hero 선택,
Page Planner와 Section Engine은 아직 구현하지 않았다.

## 공식 참고

- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)
- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
