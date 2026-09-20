# Release Backlog

TASK-032의 내부 MVP RC 범위와 분리한 후속 과제다. 아래 MEDIUM/LOW는 자동 수정하거나 추가 유료 호출을 실행하지 않았다.

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
- **L2 — 읽기 갱신 중 상태 문구**: Editor ‘최신 섹션 다시 불러오기’ 실행 중에도 공용 busy 상태가 ‘저장 중…’으로 표시된다. 복구 동작은 정상이고 데이터 손상 없음. 읽기/쓰기 상태 문구 구분은 작은 후속 polish로 남긴다.
- 단계별 안전한 wall-clock/token usage 관측. 현재 저장하지 않는 수치를 과거 결과에서 추정하지 않는다.

## TASK-032에서 처리한 항목

- Product 저장 후 옵션 source availability 갱신 지연: `router.refresh()`와 기존 Product key로 해결. 기존 draft 유지 실제 QA.
- 같은 parent/hash/rect의 역할 변경 시 Derived 중복 가능성: 영역 기준 기존 Asset 재사용과 UI/서버 슬롯 계산 일치. service 회귀3개.
- Images 하단의 ‘이후 단계에서 제공’ 안내: 현재 실제 다음 단계로 수정.

## 권장 순서

로컬 판매자 검토에서 M3/M4의 우선순위를 먼저 정한다. 외부 공개를 원하면 품질 polish보다 Auth/owner_id/RLS/Storage 격리 TASK를 먼저 수행한다. Commit/merge/v0.1.0 tag는 사용자의 별도 승인 후 처리한다.
