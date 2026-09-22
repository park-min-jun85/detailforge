# Changelog

## Unreleased

## 0.2.0 - 2026-09-22

검토와 재시도의 예측 가능성. Local/Internal MVP Release Candidate 검증 완료, v0.2.0 commit/merge/tag·GitHub Release는 사용자 검토 후 진행한다.

### Added

- 상세이미지 분석이 부분 실패했을 때 실패한 영역만 명시적으로 다시 분석한다. 자동 재시도 없이 대상 수와 결과를 안내한다.
- 부분 분석 결과를 구간별로 보존하고, 후보가 갱신되거나 재정렬돼도 기존 체크·해제 선택을 유지한다.

### Improved

- Section 제목/본문 및 역할 간 반복을 검토 이유와 함께 표시한다. 수동 문구와 확정 스펙·옵션 원문은 자동 수정하지 않는다.
- 촬영·관찰 보고체와 사진 수록을 설명하는 카피에 대한 생성 검증을 보완했다.
- 정보가 적은 텍스트 Section의 세로 여백을 줄이고, 이미지 크기와 상세한 스펙·복수 옵션의 배치를 유지한다.

### Safety / Data Integrity

- 재시도는 성공 Tile checkpoint를 보존하고 실패 대상만 호출한다. 입력 변경·동시 작업 충돌·불완전 cache를 검사한다.
- 실패 시 기존 성공 결과, Product Facts, 확정 Options, 원본 이미지와 Derived 출처를 보호한다.
- 검토 이유와 retry/Editor controls를 최종 상품 이미지에 포함하지 않는다.

### Validation

- TASK-045 전체1156 tests·typegen/typecheck/lint/build 및 secret scan PASS. 상품67695797의 격리 fixture/service/browser 흐름과 TASK-043 첫 accepted 출력 재검증, A sparse fixture 회귀를 수행했다. 이번 외부 API/OpenAI0회이며 기존 실제 TASK-040/043 근거를 재사용했다.
- A PNG/JPG860×2035, B PNG/JPG860×3057. B PNG2회의 크기·픽셀·bytes가 동일했다. M2/M3/L1 RESOLVED, BLOCKER0/HIGH0, MEDIUM2/LOW0.

### Known Limitations

- M1: 착용 인물 잘림과 제품 본체 잘림을 완전히 구분하지 못한다.
- M4: 제품 픽셀 보호를 위해 원본의 회색·초록 등 유색 장식 프레임이 남을 수 있다.
- Auth, owner_id, 사용자별 RLS와 Storage ownership policy가 없어 공개 SaaS 배포는 차단한다. 내부 RC PASS는 공개 운영 승인이 아니다.
- AI 카피·시각 해석은 사람의 검토 대상이며, 규칙 검증이 모든 자연어 품질이나 사실의 외부 진위를 보장하지 않는다.

## 0.1.1 - 2026-09-20

로컬·내부 MVP Release Candidate. 검증 완료, commit/merge/tag 대기.

### Improved

- Editor의 읽기·저장·복구·AI 후보 적용 상태 안내를 구분했다.
- 부분 이미지 분석에서 전체 재분석의 AI 비용과 이전 성공 보존을 안내한다. 실패 타일만 재시도하는 기능은 미지원이다.
- 촬영 구도에 머무는 짧은 AI 카피의 제한된 패턴 검증을 강화했다. 기존 문구를 자동 수정하지 않는다.

### Fixed

- Editor 갱신 실패 안내를 보강하고, 저장·갱신 실패 시 미저장 입력 보존과 명시적 재시도를 확인했다.

### Validation

- 상품 67695797에서 실제 Planner 1회·Section Engine 1회의 첫 신규 결과를 검증했다. 촬영 설명형/기존 meta-observation/근거 없는 성능 주장/제목 불일치 0건, 원문 스펙과 확정 옵션 6개 유지.
- 전체 865개 mock 테스트와 crop 안전 fixture 6종, 상태·실패 UI 회귀, 새 결과 PNG/JPG 860×2744px 출력을 확인했다.
- M2의 부분 재시도 기능과 M3의 제목·본문 정보 반복 등 일반 카피 품질 개선은 남아 있다. 미해결 MEDIUM 4/LOW 1을 [Release Backlog](docs/RELEASE_BACKLOG.md)에 유지한다.

## 0.1.0 - 2026-09-20

로컬·내부 단일 사용자 MVP. 공개 SaaS 릴리스가 아니며 commit/tag는 별도 승인 후 진행한다.

### Added

- Project 관리, Product 정보·Facts·Assets, 수동 옵션 편집과 명시적 저장.
- Generic Wholesale URL Import와 도매꾹 공식 API 옵션 후보 가져오기·검토·반영.
- 긴 상세 이미지의 제품컷 후보 추천, Product-Relevance Guard, 선택 승인 후 실제 crop으로 Derived Asset 생성.
- Asset/Product AI Analysis, Fact Validation, Page Planner, Section Engine.
- Detail Editor, Section reorder, 개별 Section AI 재생성 후보 검토·적용.
- 공유 Final Renderer와 저장된 상세페이지의 PNG/JPG Export.

### Improved

- Fact placeholder 필터링, 공개 상품 본문과 가격 제한의 구분, byte signature를 검증한 octet-stream 이미지 지원.
- 확정 옵션 snapshot의 Section·Editor·Export 전달 및 최신 옵션의 명시적 반영.
- Commerce Copy Quality Guards, Commerce Visual System, Hero 해상도·제목 관련성 검사.
- 상품 저장 후 옵션 source 갱신, 동일 원본 crop 재사용과 중복 저장 방지, 단계별 안내 정리.

### Safety / Data Integrity

- Facts와 AI 해석 분리, Structured Output/Zod·evidence ID 검증, 입력 fingerprint와 stale 표시. 근거 없는 주장 방지 장치가 있어도 사람의 검토가 필요하다.
- 원본/파생 이미지 분리, 추출 후보 사용자 승인, 재생성 candidate-first 적용과 실패 시 이전 성공 보존.
- 조건부 저장·version CAS·lease·복구 경계, private Storage와 단기 signed URL.
- URL Import의 SSRF/DNS/redirect·응답 크기 검증과 서버 전용 키 경계 유지.

### Known Limitations

- Auth, owner_id, 사용자별 RLS/Storage ownership policy가 없어 공개 인터넷 SaaS 배포를 차단한다. 다중 사용자 지원은 없다.
- Generic Import와 현재 공식 옵션 API 범위만 지원한다. SKU 조합 엔진, 가격/재고 동기화, marketplace publishing은 제공하지 않는다.
- 카피·이미지 해석·긴 이미지 crop 추천은 사람의 확인 대상이다. supported는 입력된 근거 범위에서의 일관성이지 외부 진위 보장이 아니다.
- 저해상도 원본은 확대 상한·후보 순위·경고로 대응한다. AI 이미지 생성/upscale/배경 제거는 제공하지 않는다.
- PDF/분할 Export, theme marketplace, 광범위한 도매 Adapter는 미지원이다. 출력은 현재 크기·시간 제한 내 PNG/JPG다.
- 내부 QA의 BLOCKER/HIGH는 0, MEDIUM 4/LOW 2는 [Release Backlog](docs/RELEASE_BACKLOG.md)에 유지한다. [체크리스트](docs/RELEASE_CHECKLIST.md)에 실제 검증 범위와 미확인 항목을 기록한다.
