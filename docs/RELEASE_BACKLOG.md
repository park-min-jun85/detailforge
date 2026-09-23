# Release Backlog

## TASK-052 — Manual Crop UI 구현 / 실제 상품 QA 대기

2026-09-23. Candidate Review의 saveAllowed 카드 진입, bounded dialog/SVG clip/dim/4 edge pointer+numeric, keyboard/focus/375px, source pixel draft와 selection/retry/URL reconciliation, V2 save를 구현했다. `[후보 전체로]`는0px manual 승인, `[수동 조정 해제]`는 auto 경로 복귀다. 성공·재사용 selection/draft 제거와 F receipt, 실패 selection/draft 유지, stale/conflict 갱신 후 재승인을 검증했다. [75항목 보고](tasks/TASK-052.md), [최신 계약](V0_2_1_MANUAL_CROP_DESIGN.md).

**M1 RESOLVED / M4 NEEDS_WORK, BLOCKER0/HIGH0/MEDIUM1/LOW0.** 새28 포함 **1417 tests**, Desktop/375px local Chromium QA 및 필수검사 PASS. 자동 detector/3%/동일-pixels invariant 유지. AI·remote mutation·migration·dependency0, package0.2.0, commit/main merge/tag0. 다음 **TASK-053 Actual A01/B01/B02 Manual Crop Browser & Save QA**, 그 결과로054 release gate를 판단한다. 아래 TASK-051은 당시 기록이다.

## TASK-051 — Manual Crop 서버 구현 / UI·실제 QA 대기

2026-09-23. 기존 Derived save route의 V1 호환 + strict V2/revision/inward insets, manual0px 포함 auto bypass, exact source pixels, v2 manual provenance/legacy reader, final-rect duplicate/30슬롯 preflight, partial failure·CAS·lease·ack-lost 보상을 구현했다. GET의 crop/basis projection과 safe save response도 제공한다. Crop Editor UI/선택 draft 변경0, 기존 파일·provenance 자동 수정0. [설계의 최신 실행 상태](V0_2_1_MANUAL_CROP_DESIGN.md), [78항목 보고](tasks/TASK-051.md).

**M1 RESOLVED 유지 / M4 NEEDS_WORK, BLOCKER0/HIGH0/MEDIUM1/LOW0.** 자동 detector/threshold/3%·same pixels/config invariant 유지. 새98 포함 **전체1389 tests·typegen/typecheck/lint/build/diff/secret PASS**. server/Sharp/loopback tests는 실제 사용자 review QA가 아니다. 다음 **TASK-052 Crop Editor UI + selection/retry integration**, 이어053 실제 A01/B01/B02 Browser/save QA 후054 release gate를 판단한다. version0.2.0, migration/dependency/OpenAI/외부 API/원격 mutation/commit/merge/tag0. 아래 TASK-050의 구현 전 상태는 당시 기록이다.

## TASK-050 — Manual Crop 설계 확정 / 구현 전

2026-09-23. Candidate Review 저장 전 `[자르기 조정]`, inward-only 4 edge+numeric, normalized pixel inset, local Apply/Cancel/Reset, ID/basis별 draft와 explicit true/false selection 보존을 설계했다. 수동 override는0px도 자동 trim을 대체하고3% 초과를 허용하되 최소160×160·면적64000을 검증한다. strict V2 save/기존 revision CAS, manual v2 provenance/legacy reader, 최종 영역 duplicate/30슬롯/기존 automatic 승인 결과 재사용을 명시했다. [설계](V0_2_1_MANUAL_CROP_DESIGN.md), [69항목 보고](tasks/TASK-050.md).

**M1 RESOLVED 유지 / M4 NEEDS_WORK, BLOCKER0/HIGH0/MEDIUM1/LOW0.** M4는 보수 자동 trim과 ambiguous preserve를 유지하면서, 사용자가 실제 manual review/save로 원하는 영역을 승인하고 preview와 저장 결과가 일치하는 흐름을 실제 QA로 검증해야 닫는다. 설계만으로 해결 처리하지 않는다. A01/B01/B02 분류·자동3%·동일 pixels/config 동일 decision·A2 회귀는 유지한다.

다음은 **TASK-051 domain/API/save/provenance 및 reader 호환**, TASK-052 crop UI/selection/retry, TASK-053 실제 A01/B01/B02 Browser/저장 QA, 해결 시 TASK-054 release 검증이다. 기존 Derived 편집(version/Page 참조 교체), outward crop 복구, free transform은 별도 future backlog다. 이번 production/tests/migration/dependency/version 변경0, AI/원격 mutation0, package0.2.0, commit/merge/tag0. 전체1291 tests·typegen/typecheck/lint/build PASS. 아래 TASK-049의 다음050 안내는 당시 기록이다.

## TASK-049 — M4 원인·안전 분류 계약 확정

2026-09-23. A01의 layered frame은 자동 승인 근거 부족으로 ambiguous, B01은 불연속 panel_background(완전 제거26px>cap17), B02는 제품 texture와 연결된 내부 card/content_touching_edge(38px>cap16)로 고정했다. 실제 helper 반환값과 pixel 통계, bounded real patch3개, positive3/paired negative3/real analogue3/동일-pixels alias1을 보존 계약으로 검증했다. positive는 기존 v2 양성 대조이며 실제 개선0이다. **M1 RESOLVED 유지 / M4 NEEDS_WORK — root cause/classification established. BLOCKER0/HIGH0/MEDIUM1/LOW0.** [실측·3행 gap matrix·57항목](tasks/TASK-049.md).

M4는 명확히 분리된 decorative frame만 자동 제거하고 ambiguous residue를 사용자 검토에 남기는 목표다. 목표 명확화는 해결 처리가 아니다. **다음 TASK-050: Review/Manual Crop UX 설계**. 실제 safe extension 후보0이므로 threshold/cap 완화나 detector 최소 확장으로 바로 가지 않는다. production/기존fixture/UI/package/migration/dependency 변경0, source·Derived 보존, AI/Domeggook/원격 DB·Storage0. 새38 포함1291 tests·필수 검사 PASS. package0.2.0, commit/merge/tag0. 아래 각 TASK 상태는 당시 기록이다.

## TASK-048 — M1 RESOLVED / M4 NEEDS_WORK

2026-09-23, 실제 상품67399861/67695797 source2개, 중복 없는 crop26개를 동일 source bytes/candidate로 pre047과 비교했다. AFTER26개 모두 preserve: clear/possible new content loss0, false-positive trim0. 합성30종·전체1253 tests·typegen/typecheck/lint/build/diff/secret 및 실제 AFTER3개 save/read/Planner/Renderer/PNG·JPG860px PASS. **BLOCKER0/HIGH0/MEDIUM1(M4)/LOW0**. M1 종료는 고정 후보에 대한 추가 trim 안전성 gate 범위이며 기존 후보의 인물/제품 의미 구분 전체 해결은 아니다.

**M4 NEEDS_WORK:** cleaner0/same17/minor worse9, obvious residue3→3(A01 녹색 테두리/B01 갈색 L자 패널/B02 내부 카드 조각). frame/background 후보6개에서 실제 개선을 확인하지 못했다. 모호한 배경 보존과 보기 나쁜 패널 miss를 분리하고, 후자를 제거하려고 threshold/cap을 완화하지 않았다. 실제 적극 trim 표본0이라는 한계도 명시한다. 시각 판정은 Codex 검토이며 사용자 sign-off 아님. [66항목·26개 전수 QA](tasks/TASK-048.md), [최신 계약 상태](V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md).

다음 권장은 **TASK-049 M4 실제 frame/panel miss 구분 및 최소 재현 계약**이다. pixel-level 구별 가능성을 먼저 확인하고 일반화되는 안전한 최소 수정만 검토한다. Final Release Validation으로 바로 가지 않는다. production/fixture/UI/Renderer/migration/dependency/version 변경0, AI/Domeggook/원격 DB·Storage0, package0.2.0, 기존 Derived 보존, commit/merge/tag0. 아래 각 TASK의 MEDIUM2/QA pending은 당시 기록이다.

## TASK-047 — v2 conservative frame trim 구현 / 실제 QA 대기

사용자 승인으로 **same pixels + same config => same decision** 계약을 적용했다. M1-A/H·M4-A/H는 동일 픽셀이라 모두 ambiguous/preserve, 기존22종에서 content-loss0(M1-H9,728→0). 신호 없는 opaque frame 잔존은 허용하고, 실제 separator/interior 구분이 있는 A2 8종에서 white/gray/beige/pink/JPEG noise/비대칭 band만 제거한다. 구분선 자체·원본 픽셀은 유지한다. 위험/alpha/미세 detail 우선, 최대3%·최소크기 유지, 새 trim version2/legacy1·없음 읽기 지원, 기존 Derived 자동 변경0.

**M1/M4 implementation complete / real QA pending, MEDIUM2/LOW0 유지. RESOLVED 아님.** 전체1253 tests·typegen/typecheck/lint/build/diff·secret scan PASS. package0.2.0, AI/원격 DB·Storage/UI/Renderer/migration/dependency0. 다음 TASK-048에서 흰/어두운 제품·컬러 frame·착용·close-up 실제 원본 전후를 비교한다. [정책·30종 결과](V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md), [67항목 보고](tasks/TASK-047.md). 아래는 각 TASK 당시 기록이다.

## TASK-046 — v0.2.1 M1/M4 corpus·계약 동결

2026-09-22, 기준 release tag `v0.2.0` / `df312b6`. M1 12종/M4 10종 deterministic synthetic fixture와 test-only content-loss oracle, 용어·안전 계약·case별 current gap matrix를 고정했다. **M1/M4 미해결, MEDIUM2/LOW0 유지**. 현재 M1-H 흰 제품 edge 손실과 M4-A~E 유색 frame 잔존을 characterization으로 기록했으며 해결로 표시하지 않는다. 같은 pixels의 frame/제품 반례는 보존·abstain 정책이 필요함을 보여 준다.

신규61 포함 **전체1217 tests**, typegen/typecheck/lint/build/diff·secret scan PASS. production/prompt/UI/Renderer/SQL/dependency/version 변경0, OpenAI/Domeggook/원격 DB·Storage0, package0.2.0. 다음은 TASK-047 detector+content-loss risk guard, TASK-048 crop 적용/검토, TASK-049 실제 혼합 상품 QA다. [계약과22행 matrix](V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md), [48항목 보고](tasks/TASK-046.md). 아래 release 대기·과거 backlog 수치는 해당 TASK 당시 기록이다.

## TASK-045 — v0.2.0 RC PASS

2026-09-22, Local/Internal MVP 후보 검증 완료. **M2 RESOLVED / M3 RESOLVED / L1 RESOLVED**, **BLOCKER0 / HIGH0 / MEDIUM2(M1/M4) / LOW0**. 전체1156 tests, 단계별 fixture 재사용 full smoke, Editor 저장 실패·복구·후보 적용, A/B Renderer·PNG/JPG·반복 출력·데이터 보호·보안 검사 통과. 이번 외부 API0회이며 실제 AI 근거는 TASK-040/043을 재사용했다. package/lock0.2.0, commit/merge/tag/Release 게시 대기. [검증 범위 및62개 항목](tasks/TASK-045.md).

M1 잘림 구분과 M4 원본 유색 프레임은 의도적으로 이월한다. Auth/owner_id/사용자별 RLS/Storage ownership 미완료로 공개 SaaS 배포는 계속 차단한다. 아래 이전 TASK 수치는 당시 기록이다.

## TASK-044 — L1 RESOLVED

짧은 text-only Section과 소수 스펙의 padding/내부 간격을 bounded CSS로 조정했다. A67399861 계열 deterministic fixture2115→2035px, B67695797 canonical3057px 유지. 이미지/글자 크기·스펙/옵션 원문·저장 style 불변, Editor100%/Final parity 및 PNG/JPG860px PASS. 전체1156 tests·필수 검사/secret scan PASS. **BLOCKER0/HIGH0, MEDIUM2(M1/M4), LOW0**. M2/M3 RESOLVED 유지. [57개 항목과 실측 범위](tasks/TASK-044.md). 아래 LOW1은 이전 관찰 당시 기록이다.

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

- **L1 — sparse Section 여백: RESOLVED by TASK-044**. type/visual/항목 수/short text에 따른 공유 Renderer spacing mapping으로 해결. 초기 A4개1933px/B5개2744px는 과거 관찰값이며 이번 고정 A6개2115→2035px/B4개3057px 비교와 구분한다. saved token/visual/860px/1.5배 cap/PNG-JPG 회귀 유지, 열린 LOW 수에서 제외한다.
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
