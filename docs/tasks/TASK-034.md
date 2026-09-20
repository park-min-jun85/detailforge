# TASK-034 — v0.1.1 Internal Polish & Release Backlog Burn-down

2026-09-20 · `fix/v0.1.1-polish` · 기준 `06d80bb` (`v0.1.0` tag와 일치). 시작 작업 트리는 clean이었다. **v0.1.1 Local/Internal MVP Release Candidate 추천**. 버전은 0.1.0 유지, commit/main merge/tag 미실행.

## 요청한 37개 완료 항목

1. **시작 MEDIUM 4**: M1 ‘인물/제품 잘림 구분’, M2 ‘부분 타일 실패 복구’, M3 ‘보고체에 가까운 짧은 카피’, M4 ‘원본 장식 경계 보존’. RELEASE_BACKLOG의 실제 항목을 기준으로 했다.
2. **시작 LOW 2**: L1 ‘sparse Section 여백’, L2 ‘읽기 갱신 중 상태 문구’.
3. **실제 재현 결과**: M1은 B의 기존 실제 분석에서 얼굴/머리 잘림을 cropped로 표시하는 것을 Images에서 다시 확인했다. M2는 B의 14구간 중 실패2번(1개) partial 결과와 전체 재분석 동작을 재현했다. M3는 A의 ‘손으로 누른 구도’, B의 ‘근접 구성’이 기존 검사에 걸리지 않는 fixture를 확인했다. M4는 A Hero의 회색/초록 프레임을 재확인했다. L1은 A1933px/B2744px의 sparse split 여백, L2는 공용 busy의 저장 문구를 코드에서 확인했다. 이 중 이미 해결되어 변경이 불필요한 항목은 없었다.
4. **해결한 항목**: L2 완료. 읽기/쓰기/순서 복구/AI 생성/후보 적용/옵션 반영 문구를 구분했다. M3의 알려진 camera-framing 패턴 검증과 M2의 비용/복구 안내는 부분 보완이며 전체 해결로 세지 않는다.
5. **유지 backlog**: M1~M4/L1. M1은 시각 의미 평가가 필요하고, M2의 실패 타일 전용 복구는 cache/비용/입력 정합성 설계가 필요하다. M3는 새 실제 모델 첫 출력과 일반적인 건조함/반복의 평가가 남는다. M4의 모호한 유색 프레임 제거는 제품 잘림 위험 때문에 보류했다. L1은 전역 여백을 줄이는 대신 기존 visual system을 유지했다.
6. **생성 파일**: `src/features/detail-editor/components/editor-status.tsx`, `tests/internal-polish.test.mjs`, `docs/tasks/TASK-034.md`.
7. **수정 파일**: `src/features/detail-editor/components/editor.tsx`, `src/features/detail-extraction/components/extraction-panel.tsx`, `src/features/page-quality/commerce.ts`, `src/features/page-planner/schemas.ts`, `docs/04_AI_PIPELINE.md`, `docs/05_UI_UX.md`, `docs/RELEASE_BACKLOG.md`, `docs/tasks/README.md`, `CHANGELOG.md`. 외부 작업공간의 QA helper/산출물은 repository diff에 포함하지 않는다.
8. **Migration**: 없음. 원격 schema/RLS/Storage policy/generated DB types 변경 없음.
9. **Dependency**: 없음. package/lock 모두 0.1.0 유지. CHANGELOG에는 Unreleased만 추가했다.
10. **카피 변경**: 시각 문구의 제한된 문장 말미 패턴(근접/클로즈업 모습·구성, 누른/잡은/들고 있는/촬영한/담은 구도)을 meta-observation으로 검증한다. 공유 기존 정책에는 제목만 반복하는 visual body를 null로 둘 것, 근거 없는 성능/편안함 주장으로 채우지 않을 것을 추가했다. 자동 문구 치환은 없다.
11. **카피 안전성**: exact Facts/Options 값은 검사 대상에서 제외하고 제품 부위·디자인·포켓 구성 등 중립적 표현은 허용한다. 기존 V-only claim·meta-observation·title relevance 회귀 유지. 정책 version 2를 새 Plan/재생성 fingerprint에 반영하며 저장된 version1/필드 누락은 읽을 수 있다. 옛 Plan은 stale가 될 수 있지만 기존 문구/Plan을 자동 변경하지 않는다. 새 전체 생성·개별 재생성 거부 시 이전 성공 및 upstream 불변을 검증했다. 자연어 전반의 품질/진위 판정으로 과장하지 않는다.
12. **Crop 변경**: 알고리즘·threshold·margin·좌표·provenance 변경 없음. tile white-row boundary snapping → AI box mapping → bounded margin → 승인 crop → 최대3% edge trim 흐름을 확인하고 6종 회귀를 추가했다.
13. **Crop 안전성**: uniform white 5px와 light gray 3px는 제거된다. 진회색200의 모호한 border는 유지한다. 제품이 왼쪽 edge에 닿거나 인접 글자가 있는 경우 왼쪽 trim0, 여러 panel의 내부 separator·clean crop은 그대로다. PNG fixture로 출력 pixel이 실제 보존 영역과 정확히 일치하고 원본 bytes/hash가 유지됨을 검사했다. 모델 segmentation·aggressive trim·upscale 없음. 실제 유색 프레임 M4는 유지한다.
14. **Recovery UX**: 읽기 실패의 원인과 ‘최신 섹션 다시 불러오기’ 행동을 연결했다. 느린 조회 중 ‘최신 섹션을 불러오는 중…’, 실패 후 ‘QA 미저장 변경’ draft 보존, 확인창 취소, 정상 재조회까지 실제 로컬 브라우저에서 확인했다. 부분 추출 화면에서는 기존 B partial fixture로 성공 후보 저장 가능·전체 AI 재분석 비용·이전 성공 보존 안내를 확인했다. AI 재호출 버튼은 누르지 않았다. 다른 Import/Export/409 등의 core 동작은 기존 회귀 검사로 유지하며 별도 신규 기능을 추가하지 않았다.
15. **기존 성공 데이터 보호**: CAS/lease/candidate-first/저장 순서 코드를 유지했다. 새 copy failure mock에서 한 번만 provider를 실행하고 기존 Section/Fact/Plan/Assets를 보존한다. 읽기 실패 시 draft를 지우지 않는다. QA는 읽기 전용 loopback 데이터이며 실제 DB/Storage 변경 0, fixture hash 불변이다.
16. **CASE A regression**: 실제 TASK-032의 67399861 canonical 4 Sections, 단일 옵션 ‘단일상품’, Derived2개를 재현했다. TASK-024에 보관한 동일 원본의 SHA-256이 A provenance와 일치함을 확인하고 동일 rect/trim으로 crop을 복원했다. Hero/ImageText/Specification/compact Option 및 최종 출력 확인. 새 Import/AI E2E는 아니다.
17. **CASE B regression**: TASK-030의 67695797 canonical 5 Sections, Derived3개, 옵션1그룹6값(아이보리90/95, 코코아90/95, 브라운90/95)을 유지했다. 색상/사이즈 분해 없음. Hero/ImageText/Detail/Specification/Option, 옵션 글자 잘림0·가로 overflow0. 원본 hash와 provenance 일치. Source 밖 미사용 원본 thumbnail bytes는 fixture에 재수집하지 않아 Images 목록 해당 카드의 preview는 unavailable이며 Final이 참조하는 모든 이미지는 로드됐다.
18. **Actual AI calls**: OpenAI0, 도매 API0. QA Next/서비스 실행은 실제 키 대신 local fake 설정과 non-loopback fetch 차단을 사용했다. 새 모델 생성 품질의 검증은 이번 결과에 포함하지 않는다.
19. **Renderer regression**: CSS/layout 변경 없음. 실제 A/B 브라우저 Final 영역 폭860, 이미지 각각2/3개 정상, controls0, review/debug 문구0, horizontal overflow0. 기존 저장 카피는 그대로이며 새 경고는 capture 밖에만 표시된다. B 결과 PNG는 v0.1.0 canonical replay와 byte-for-byte 동일. A는 크기/배치 동일하나 미세한 raster 차이가 있어 byte 동일이라고 보고하지 않는다.
20. **PNG 결과**: A860×1933px / 613,063 bytes. B860×2744px / 1,009,246 bytes. 첫 Hero부터 마지막 Option까지 직접 확인했다.
21. **JPG 결과**: A860×1933px / 180,465 bytes. B860×2744px / 278,564 bytes. PNG와 동일한 배치, 이미지 누락·글자 잘림·Editor UI·검토 경고 혼입 없음. 실제 파일을 열어 확인했다.
22. **Tests**: 기존849개 유지 + 신규16개. 실제 A/B camera-framing3, 안전한 카피/원문 제외1, 전체/개별 생성 실패 보존2, Editor 상태2, crop6, 정책 version 호환1, 부분 추출 안내 SSR1. 초기 version2 저장 시 구 literal1 schema가 거부하는 회귀를 발견해 구/신 양쪽을 허용하고 호환성 검사를 추가한 뒤 전체 통과했다.
23. **Total tests**: 최종865 pass, fail0, skip0, cancel0. 자동 검사에는 실제 유료 호출 없음.
24. **Typegen**: `npx.cmd next typegen` PASS.
25. **Typecheck**: `npx.cmd tsc --noEmit` PASS.
26. **Lint**: `npm.cmd run lint` PASS. 마지막 테스트 추가 후 다시 통과.
27. **Build**: `npm.cmd run build` PASS. 해당 production build로 UI/Export를 확인했다.
28. **Diff check**: `git diff --check` PASS. 변경 범위 직접 검토, package/schema migration/원격 데이터/기존 test 삭제 없음.
29. **Secret scan**: Git tracked+신규 파일, production client bundles, TASK-034 텍스트 산출물의 실제 OpenAI/Supabase service-role/Domeggook 키 일치0, client provider marker0. 토큰 패턴의 명시적 fake fixture와 실제 secret을 구분했다. 실제 key·원본 네트워크 오류 객체·signed token을 보고서에 남기지 않았다. 검사는 알려진 실제 키/패턴 범위다.
30. **Product/Facts/Options 불변**: 읽기 전용 A/B fixture hash 유지, DB mutation0. canonical option/spec exact 대조 및 기존 upstream/CAS/provenance/security tests 통과. 실사용 원격 데이터에는 연결하지 않았다. QA DB 생성/cleanup 대상 없음.
31. **BLOCKER**: 0.
32. **HIGH**: 0.
33. **MEDIUM**: 4 유지. M2/M3 부분 보완을 완전 해결로 집계하지 않는다.
34. **LOW**: 1. L1 유지, L2 해결.
35. **RELEASE_BACKLOG 변경**: 시작 항목을 보존하고 항목별 재현/보완/보류 근거를 추가했다. L2는 완료 영역으로 이동했다. 공개 SaaS 전제는 그대로다.
36. **v0.1.1 RC 여부**: **Local/Internal MVP Release Candidate 추천**. 선택한 저위험 L2 수정 완료, 알려진 카피 패턴/복구 안내 보완과 전체865 tests·필수 검사·A/B Export·secret0·실사용 데이터 불변을 근거로 한다. 모든 MEDIUM 해결 또는 새 실제 AI 카피 품질 검증 완료를 뜻하지 않는다.
37. **다음 단계**: 별도 release TASK에서 diff/변경 범위를 검토하고 버전0.1.1·릴리스 노트·태그 여부를 결정한다. M3의 새 첫 출력 평가는 필요한 최소 실제 호출로 별도 수행하고, M1/M4 사진 경계와 M2 cache/부분 복구는 각각 범위를 정한다. Auth/owner_id/사용자별 RLS/Storage ownership 이전의 공개 SaaS 배포는 계속 차단한다.

## 검증 한계와 산출물

외부 작업공간 `artifacts/TASK-034/`에 전체 검사 로그와 A/B PNG/JPG, export/fixture/secret 결과를 보관한다. replay helper는 앱 구현이 아니며 Git에 포함하지 않는다. multi-product fixture의 OR 소속 필터와 read-only 서명 요청을 구분하여 실제 app read 경계를 재현했다. 실패 UI는 fixture의 명시적 읽기 오류로 검증하며 자동 유료 재시도를 만들지 않았다. 테스트 서버와 생성한 브라우저 탭은 QA 종료 후 정리한다.

실제 사용자 데이터 변경, migration, dependency, package version 변경, Git commit, main merge, tag는 하지 않았다.
