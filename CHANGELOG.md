# Changelog

## Unreleased

- Editor의 읽기 갱신/저장/복구/AI 후보 적용 상태를 구분하고, 갱신 실패 시 재시도 안내와 draft 보존을 확인했다.
- 부분 이미지 분석의 전체 재분석 범위·비용·이전 성공 보존을 안내한다. 실패 타일만 재시도하는 기능은 추가하지 않았다.
- 촬영 구도에 머무는 짧은 카피의 제한된 패턴 검증을 보강했다. 기존 문구를 자동 수정하지 않으며 일반적인 AI 카피 품질 개선은 계속 검토한다.
- Crop 6종 안전 fixture와 A/B canonical PNG/JPG 회귀를 추가 확인했다. 버전은 아직 0.1.0이며 v0.1.1 릴리스 확정이 아니다.

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
