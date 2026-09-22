# Release Backlog

## TASK-043 — H1 및 M3 RESOLVED

기존 관찰 보고체 detector에 시각 대상·capture 동사·매체 문맥의 bounded 패턴을 추가했다. TASK-042 H1 replay/유사 reject19·allow19·기존 report6 및 frozen22개 분류 PASS, 전체1142 tests와 필수 검사/secret scan PASS. 실제 상품67695797 **Section Engine1회, Planner0/regen0**, 첫 accepted output의 meta/camera/capture narration·문제 title/body/cross-section 반복·unsupported V-only0. Browser manual warning/원문 보존, Final article·PNG/JPG 내부 경고0, 둘 다860×3057을 확인했다. [56개 항목·검증 한계](tasks/TASK-043.md).

**H1 resolved by TASK-043, M3 RESOLVED. 현재 BLOCKER0/HIGH0, MEDIUM2(M1/M4), LOW1(L1)**. M2 RESOLVED 유지. 아래 TASK-042의 HIGH1/MEDIUM3 및 이전 pending은 발견 당시 기록이다. 이번 종료는 고정 corpus와 실제 단일 상품의 명시 gate에 한정하며 모든 한국어 표현에 대한 보장은 아니다.

## TASK-042 실제 QA — M3 NEEDS_WORK

상품67695797의 격리 fixture에서 첫 실제 Planner1/Section1/regen1과 Desktop Editor·수동 중복 경고·명시 후보 적용·Final/PNG/JPG를 검증했다. 첫 output의 문제 반복6범주0, Final article/PNG/JPG 내부 warning0, 두 export860×3057, 스펙6행/옵션6개 exact. 그러나 gallery의 “외관을 담았습니다”는 자동 meta 검출0에 대해 human 관찰 보고체1로 남는다. **BLOCKER0/HIGH1(H1, 기존 M3 연결), M3 NEEDS_WORK**. 정상 regen의 null intro로 첫 결과를 대체해 판정하지 않았다. [59개 항목 및 검증 범위](tasks/TASK-042.md).

전체1091 tests·typegen/typecheck/lint·원본 기본 production build PASS로 TASK-040의 문서 적용/원본 build 대기를 해소했다. 기존 실제 controlled E2E 근거와 합쳐 **M2 RESOLVED**. 현재 backlog는 **MEDIUM3(M1/M3/M4), LOW1(L1)**이다. HIGH1은 M3에 연결한 QA finding 등급이며 과제를 중복 추가한 수치가 아니다. M3 해결에 따른3→2 감소는 하지 않는다. 아래 MEDIUM4·M2 finalization pending·TASK-043 actual pending은 당시 기록이며 최신 상태는 이 절을 따른다.

## TASK-041 M3 deterministic 개선

제목/본문·반복 F의 역할별 검토와 착용 모습 보고체 guard를 보완했다. C1~C22 allow9/warning7/reject6, 수동/legacy 비차단, 원문·이전 성공 보존을 mock으로 검증했다. TASK-041 당시 실제 QA는 미실행이었으며 후속 TASK-042 결과는 위 절에 기록했다. [구현과 한계](tasks/TASK-041.md).

## TASK-040 UI 및 실제 검증

**TASK-040:** failed-Tile retry UI와 최소 read-only DTO, stable-ID true/false 선택 보존을 구현했다. 실제 도매상품67695797의 연속800×3600 source2-Tile에서 partial→complete, retry OpenAI1회(준비 포함2), 후보5→10, Derived3개 저장/중복 방어를 확인했다. 전체1054 tests PASS. 문서 적용 및 원본 최종 build 재확인은 workspace 쓰기 권한 제한으로 대기 중이다. M2는 기능 gate 충족/최종 확정 대기, M3·MEDIUM4/LOW1은 아직 유지한다. [67개 항목과 한계](tasks/TASK-040.md).


TASK-032에서 시작한 내부 MVP 후속 과제다. TASK-035 후 미해결 **MEDIUM 4 / LOW 1**, 이번 관찰 BLOCKER 0 / HIGH 0. L2는 해결했고 M2/M3는 일부 보완했지만 원래 문제 전체가 해결된 것으로 세지 않는다.

## TASK-037 reproduction contract established

**TASK-039:** server logic implemented; UI/E2E pending. 명시 POST retry와 실패 대상 검증, 입력 재검증, 성공 즉시 저장, 전체 regions 재집계, strict revision/run CAS 및 중단 보호를 추가했다. 기존 성공 Tile 재호출0은 mock으로 검증했다. 실제 사용자 UI/유료 호출 E2E와 client-local 선택 보존 연결 전에는 **M2 완전 해결로 표시하지 않는다**. M3/미해결 MEDIUM4·LOW1 유지. [보고](tasks/TASK-039.md).

**TASK-038:** checkpoint persistence implemented; failed-only retry UI/server pending. 정상 전체 분석에 terminal tile 저장, 입력 호환성, bounded serialization, CAS를 추가했다. 재분석의 provider 대상 선택은 여전히 전체 타일이므로 **M2 해결로 처리하지 않는다**. M3 변경 없음, MEDIUM4/LOW1 유지. [검증·제약](tasks/TASK-038.md).

M2 T1~T8과 M3 C1~C22의 BEFORE·기대 동작·gap을 [계약 문서](V0_2_M2_M3_CONTRACTS.md)에 고정했다. 현재 전체 재분석 호출과 성공 보존을 mock service로 재현했고, 제목/본문 및 보고체 미검출4사례를 기록했다. production 수정이나 실제 API 호출은 없으며 **M2/M3 미해결, MEDIUM4/LOW1 유지**. 다음은 TASK-038 cache domain/persistence다.

## TASK-036 계획 연결 — 해결 상태 변경 없음

- 현재 릴리스 기준은 v0.1.1 / `bd856d5`다. TASK-036에서 로컬 main·origin/main·tag의 commit 일치를 확인했다. 아래 TASK-035의 RC/commit 대기 문구는 당시 기록이며, 이번에 새 실제 AI/시각 QA를 수행했다는 뜻은 아니다.
- [v0.2.0 Roadmap](V0_2_ROADMAP.md)은 **A: Internal Quality**를 권장한다. M2 실패 타일 전용 복구와 M3 제목/본문 역할 개선을 Must, L1 bounded spacing을 Should로 제안한다. M1/M4는 평가 사례·기존 회귀를 유지하고 알고리즘 확대를 이월한다.
- M2는 현재 최종24개 후보만으로 성공 타일 원본을 복원할 수 없어 별도 bounded pre-NMS cache 계약이 필요하다. M3는 안전성 hard guard와 일반적인 카피 자연스러움을 구분한다. 해당 구현·실제 QA 완료 전에는 두 항목을 닫지 않는다.
- 공개 SaaS의 Auth/owner_id/RLS/Storage·사용량 통제, SKU/가격/재고/옵션 이미지, 추가 Adapter, enhancement, Theme, 확장 Export는 후속 설계 목록이다. 이번 v0.2.0 권장 scope에 함께 넣지 않는다.
- 열린 수는 **MEDIUM4/LOW1 그대로**다. L2 외에 이미 해결됐으나 열린 목록에 잘못 남아 있다고 확인된 항목은 없다. [TASK-036 보고](tasks/TASK-036.md).

## TASK-035 실제 AI·릴리스 판정

- 상품 67695797의 기존 upstream 자료를 격리된 로컬 QA DB에 복제했다. 실제 OpenAI Planner 1회·Section Engine 1회, 자동 재시도 0회. 첫 신규 출력 5 Sections가 기존 서비스 검증을 통과했다. 원격 DB/Storage 변경은 없다.
- M3의 촬영 설명형 카피 0, 기존 meta-observation 0, unsupported V-only claim 0, title mismatch 0. Hero 정체성/전면 포켓 외관/목둘레·봉제선 상세의 역할과 이미지가 구분된다. 원문 스펙 6행·확정 옵션 1그룹 6값/UUID/순서 보존. 실제 나쁜 출력 reject 사례나 모든 표현에 대한 false-positive 부재를 검증했다는 뜻은 아니다.
- **M3 부분 보완 유지**: 새 ImageText 제목 ‘앞면 여밈과 포켓 구성’과 본문 ‘앞면 여밈선과 양쪽 포켓이 드러난 착용 외관.’에는 같은 정보가 남아 있다. 필수 카피 안전성/Section 간 목적 분리 QA는 PASS지만 일반적인 자연스러움·제목/본문 역할 개선까지 완료 처리하지 않는다.
- M2 UI는 성공 후보 저장 가능·전체 재분석 AI 비용·이전 성공 보존을 실제 partial fixture에서 확인했다. 실패 타일 전용 재시도는 여전히 미지원이다. 추가 AI 실행 없이 확인했다.
- L2는 실제 UI에서 읽는 중/저장 중/저장 실패/갱신 실패, 미저장 draft 보존, 확인창 취소와 성공 재조회를 통과했다. M1/M4/L1은 알고리즘·CSS 변경 없이 유지한다.
- 865 tests, crop 6종, 필수 검사와 새 결과 PNG/JPG 860×2744 통과. **v0.1.1 Local/Internal MVP RC PASS**, package 0.1.1. 공개 SaaS 전제와 commit/merge/tag 대기는 별개다. 상세 근거는 [TASK-035](tasks/TASK-035.md).

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
- **M2 — 부분 타일 실패 복구: RESOLVED**. TASK-038~040 checkpoint/failed-only retry/선택 보존 및 실제 controlled E2E에 TASK-042 원본 최종 검사를 더해 종료했다. 전체 성공 타일을 재호출하지 않는 비용·입력·CAS·이전 성공 보존 회귀를 유지한다. 열린 MEDIUM 수에서 제외한다.
- **M3 — 보고체에 가까운 짧은 카피: RESOLVED by TASK-043**. TASK-041 frozen22개 보완에 TASK-042 H1의 bounded guard/정상 negative/실제 첫 출력 재검증을 더해 종료했다. 과거 H1 accepted 이력은 TASK-042에 보존한다. 문구 자동 rewrite/과장 benefit/추가 생성으로 실패 숨김 없음. 열린 MEDIUM 수에서 제외한다.
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

현재 M2/M3 Must gate는 통과했다. 다음은 선택 TASK-044 L1 bounded spacing 또는 TASK-045 release 검증이며 M1/M4는 유지한다. 아래 TASK-036 순서는 최초 계획 기록이다.

v0.1.0은 `06d80bb`, v0.1.1은 `bd856d5`로 확인됐다. 다음 권장은 TASK-037의 M2/M3 재현 corpus·계약 확정 → cache/복구 → copy 정책/검토 UI → 실제 QA이며, L1은 Must 통과 후 선택한다. 상세 순서와 완료 기준은 [Roadmap](V0_2_ROADMAP.md)을 따른다. M1/M4의 보수적 사진 경계는 유지한다. 외부 공개가 우선 목표로 바뀌면 Auth/owner_id/RLS/Storage·비용 격리를 독립 릴리스로 먼저 승인해야 한다. TASK-036은 문서 계획만 수행하며 commit/merge/tag는 하지 않는다.
