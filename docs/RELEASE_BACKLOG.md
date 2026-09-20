# Release Backlog

TASK-032에서 시작한 내부 MVP 후속 과제다. TASK-034 후 미해결 **MEDIUM 4 / LOW 1**, 이번 회귀 관찰 BLOCKER 0 / HIGH 0. L2는 해결했고 M2/M3는 일부 보완했지만 원래 문제 전체가 해결된 것으로 세지 않는다. 실제 AI 추가 호출 없이 기존 fixture와 mock으로 검증했다.

## TASK-034 판정 범위

- M1 유지: 기존 A/B 분석의 cropped 판단과 Hero 제외 정책을 확인했다. 인물/제품 경계 의미를 deterministic 문구 치환으로 바꾸면 실제 제품 잘림을 놓칠 수 있다. 모델 평가 corpus가 필요한 후속 작업이다.
- M2 부분 보완, 유지: 부분 성공 화면에 현재 후보 저장 가능·전체 재분석·AI 비용·실패 시 이전 성공 보존을 안내했다. 실패 구간만 재시도하는 cache/비용/입력 정합성 설계는 추가하지 않았다.
- M3 부분 보완, 유지: 실제 A/B의 ‘근접 모습’, ‘근접 구성’, ‘손으로 누른 구도’ 패턴을 새 생성/재생성에서 거부하고 기존 저장 문구에는 검토 경고를 표시한다. 제목 반복 시 visual body=null 권고를 기존 정책에 추가했다. 단어 자동 치환·새 AI pass 없음. 새 모델 첫 출력 품질은 재검증하지 않았으며 일반적인 건조한 카피/반복을 모두 해결하지는 않았다.
- M4 유지: 원본 A Hero의 회색/초록 프레임은 재현된다. 기존 밝은 중성 경계 trim과 최대3%를 유지했고 흰 테두리·얇은 회색·제품 edge·인접 글자·여러 panel·clean crop 6종 회귀를 추가했다. 어두운/유색 프레임은 제품 픽셀과 구분을 보장할 수 없어 보존한다.
- L1 유지: A4개1933px/B5개2744px의 적은 텍스트와 큰 여백을 재확인했다. 빈 Section/overflow 없이 기존 bounded spacing을 유지하며 전역 padding 축소로 사진/장문 배치를 변경하지 않았다.
- L2 해결: 아래 완료 기록 참조. 이미 해결된 것으로 확인된 다른 항목은 없다.

## Before public deployment

- Auth, owner_id, 사용자별 RLS, private Storage 사용자 정책. 현재 service-role 기반 단일 사용자 구조를 인터넷에 공개하지 않는다.
- 위 권한 경계의 공격·소속·삭제·비용 제어 검증과 배포 환경의 Chromium/글꼴 고정. 내부 RC 통과가 공개 운영 승인은 아니다.

## Post-MVP enhancement

- **M1 — 인물/제품 잘림 구분**: Asset AI의 cropped 경고가 착용 인물의 얼굴 잘림과 제품 본체 잘림을 구분하지 못한다. TASK030 B 및 이번 A 대표/근접 분석에서 관찰. `asset-analysis`, `page-quality/images`의 판단·평가 corpus 개선. 기존 Facts 손상 없음, 역할/대표성 mock 회귀 필요.
- **M2 — 부분 타일 실패 복구**: 현재 일부 성공 후보 보존과 명시적 전체 재분석을 제공한다. 실패 타일만 재시도하는 복구는 없음. 이번 A8/8 성공이 과거 실패 문제의 해결 증거는 아니다. `detail-extraction`의 비용·cache 계약을 먼저 설계. 기존 성공 보존 tests 유지.
- **M3 — 보고체에 가까운 짧은 카피**: A 첫 imageText 제목 ‘패드 표면 근접 모습’, 본문 ‘흰색 패드 표면 일부와 손으로 누른 구도.’는 hard detector를 통과했지만 판매 문구로는 건조하다. B replay의 ‘근접 구성’도 동일 계열. `page-quality/commerce`, Planner/Section prompt의 별도 품질 TASK. 근거 부족을 과장 카피로 보충하지 않으며 첫 결과 평가 corpus와 V-only claim 회귀 필요.
- **M4 — 원본 장식 경계 보존**: A Hero 실제 사진의 회색·초록 프레임이 crop에 남는다. `detail-extraction/images`의 보수적 rect/trim 한계. source pixels 자체이므로 CSS stretch 문제가 아니며 제품을 자르는 임의 trim은 금지. 최대3% edge·원본 불변 회귀와 수동 가장자리 검토 필요.
- 추가 도매 Adapter, SKU/가격/재고·종속 조합 모델, PDF/분할 출력, theme/template는 각각 별도 명시 요청 시 검토한다.
- AI upscale/background removal은 현재 금지 범위다. 원본 이미지·제품 동일성 보장을 별도 설계하기 전 추가하지 않는다.

## Nice-to-have

- **L1 — sparse Section 여백**: A는4개1933px, B replay는5개2744px. 빈 Section이나 사진 반복은 없지만 사진 아래 여백·텍스트가 적은 split의 균형은 더 다듬을 수 있다. `section-renderer` bounded CSS만 고려하고 860px/1.5배 cap/PNG-JPG 동일 레이아웃 회귀 유지.
- 단계별 안전한 wall-clock/token usage 관측. 현재 저장하지 않는 수치를 과거 결과에서 추정하지 않는다.

## TASK-032에서 처리한 항목

- Product 저장 후 옵션 source availability 갱신 지연: `router.refresh()`와 기존 Product key로 해결. 기존 draft 유지 실제 QA.
- 같은 parent/hash/rect의 역할 변경 시 Derived 중복 가능성: 영역 기준 기존 Asset 재사용과 UI/서버 슬롯 계산 일치. service 회귀3개.
- Images 하단의 ‘이후 단계에서 제공’ 안내: 현재 실제 다음 단계로 수정.

## TASK-034에서 해결한 항목

- **L2 — 읽기 갱신 중 상태 문구**: Editor의 refresh/save/recover/generate/apply/options 상태를 구분한다. 느린 읽기의 ‘최신 섹션을 불러오는 중…’, 읽기 실패 후 미저장 draft 보존·재시도 안내·취소 및 성공 재조회까지 로컬 브라우저로 확인했다. 기존 CAS/후보 적용/저장 경계는 유지한다.

## 권장 순서

v0.1.0 tag는 TASK-034 시작 시 06d80bb로 확인됐다. v0.1.1 후보의 별도 release 판정/버전 변경은 후속 TASK에서 한다. 실제 새 카피 품질은 향후 필요한 최소 호출로 검증하고, M1/M4의 보수적 사진 경계를 우선 유지한다. 외부 공개를 원하면 품질 polish보다 Auth/owner_id/RLS/Storage 격리 TASK를 먼저 수행한다. 이번 commit/merge/tag는 하지 않는다.
