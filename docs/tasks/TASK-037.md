# TASK-037 — M2/M3 Reproduction Corpus & Contract Freeze

`feat/v0.2-repro-contracts` / 시작 HEAD `4f33eab`, 시작 작업 트리 clean. v0.1.1 내부 MVP의 **BEFORE 재현·계약 동결** 작업이며 M2/M3 기능 수정은 아니다. 상세 정의와 case별 gap은 [Contracts](../V0_2_M2_M3_CONTRACTS.md)에 기록한다.

## 요청한 46개 보고 항목

1. **목적**: 후속 구현 전에 현재 실패·정상 사례, 용어·상태·예상 동작을 deterministic corpus와 PASS 가능한 characterization으로 고정.
2. **Branch**: `feat/v0.2-repro-contracts` 확인. commit/main merge/tag 없음.
3. **M2 root problem**: 최종 NMS/cap24후보만 저장하며 성공 타일 pre-NMS 결과가 없다. 동일 partial 재사용은 추가0호출, force는 성공 타일까지 전체 재실행한다.
4. **M3 root problem**: exact/normalized 검사와 일부 메시지·Fact 재사용 신호는 있으나 title/body의 역할·의미 반복은 놓친다. TASK-035 실제 짧은 반복 쌍도 현재 helper를 통과한다.
5. **M2 terminology**: run/source/context fingerprint, TileRect/identity/index/pixel range, success/failure/cache/stale/retryable, complete/partial/failed를 정의했다. 현재 attempt.completed는 partial도 포함함을 구분.
6. **M2 corpus 수**: **8개**, T1~T8.
7. **M2 목록**: 전부 성공,1실패,비연속2실패,전부 실패,같은 입력 재실패·성공 보존,source 변경,context 변경,동일 타일 retry 성공 전이.
8. **Tile identity**: source/context/index/x/y/width/height의 versioned SHA-256 tuple. golden vector·응답/점수 불변·geometry 변경을 test-only reference로 검사. 현 candidateId와 구분.
9. **Failure classification**: provider_error/timeout/structured_output_invalid/local_processing_error는 test-only 원인 분류. current code와 대응·축약 한계를 기록하고 안전한 code/eligibility/billing만 허용.
10. **Retry contract**: 명시 실행만, 동일 입력의 failed+retryable만, 성공 호출0, 대상당1이하, 실패 시 성공/Derived 보존. pending/in_flight와 stale는 즉시 retry 대상이 아님.
11. **Cache logical shape**: schemaVersion/input/tiles; tileId/index/geometry/status, completed에만 strict result, failed에만 bounded failure. 저장 코드 없음.
12. **Boundedness**: 한 입력 세대, 최대16×8, cache256KiB UTF-8 JSON, history/bytes/raw response/error 금지. 상한 문자열 fixture155,616B와 escaped control270,816B를 측정했고 후자는 명시 거부한다. 전체 JSONB metadata 실측은 후속.
13. **Stale rules**: source/context뿐 아니라 model/policy/prompt/tiling/normalization/output schema/orientation/dimensions/layout 호환성 변경 시 재사용 금지. object key 순서와 응답 score는 identity 변경 원인이 아님.
14. **Legacy**: 실제 reader로 v1/v2 cache 없는 결과 읽기·불변 확인. v1에 relevance를 발명하지 않음. cache 없음→명시 전체 분석 안내, 자동 AI 없음.
15. **M3 taxonomy**: 현 COPY_INTENTS10 type/9 intent 그대로. feature_from_fact를 benefit_from_fact와 구분. Hero는 title/body 대신 실제 headline/subheadline을 사용.
16. **M3 corpus 수**: **22개**, allow9/warning7/reject6. 이 분류는 기대 계약이며 새 classifier 결과가 아니다.
17. **허용 case**: C1~C5, C12, C17, C18, C22. canonical 재표시, 다른 근거/역할, grounded 명사구, null body.
18. **문제 case**: warning C6/C9/C10/C11/C19/C20/C21; reject 목표 C7/C8/C13~C16. 실제 인용은 C19만이며 나머지는 synthetic.
19. **반복 종류**: exact_text, normalized_text, fact_reuse, title_body_redundancy, cross_section_purpose, visual_message_reuse. meta_observation은 별도 보조 축.
20. **Spec/Option 예외**: canonical row/confirmed 값은 marketing 반복 대상 제외, 제목은 prose 검사 유지. 값·UUID·순서 자동 변경 금지.
21. **현재 잡힘**: C7/C8 목적 중복 거부, C14~C16 보고체 거부, C20/C21 exact-copy 경고. C9/C11은 Fact 예산 초과 신호만 잡는 부분 검출.
22. **현재 놓침**: **C6/C10/C13/C19**. 기대값을 바꾸어 성공으로 포장하지 않고 currentBaseline에 미검출을 고정했다.
23. **Gap matrix**: Contracts §4 T1~T8, §8 C1~C22에 현재 저장/검출·미지원/누락·후속 필요를 각각 기록.
24. **Fixture 위치**: `tests/fixtures/v0.2/m2-tile-recovery.mjs`, `m3-copy-repetition.mjs`. 고정 UUID/시각, 비밀/외부 URL/로컬 절대경로/이미지 bytes 없음.
25. **Test-only helper**: `tests/helpers/v0.2-contracts.mjs`. validator/reference identity/cache projection/기존 helper 관찰만. retry 실행·DB writer·semantic classifier 없음.
26. **Characterization**: planTiles/candidateId/legacy reader, 현재 analyzeProductShots+mock, commerce/meta/message/signature/title/factCoverage를 직접 호출. 전체 생성 AI E2E PASS를 의미하지 않음.
27. **생성 파일**: fixture2, helper1, test2, 문서2 — 총7개.
28. **수정 파일**: `docs/tasks/README.md`, `docs/V0_2_ROADMAP.md`, `docs/RELEASE_BACKLOG.md` — 총3개. production 파일 변경 없음.
29. **Production code**: src/app/prompt/algorithm/UI 변경0. fixture/test만으로 구현 가능해 예외 수정 없음.
30. **Migration**:0. 기존0001~0005/generated types/RLS 불변.
31. **Dependency**:0. package/lock 변경 없음.
32. **External API**: OpenAI0, Domeggook0. 새 service tests는 주입 mock provider와 loopback-only fetch guard를 사용.
33. **Remote DB/Storage**: 연결/변경0. in-memory mock DB와 synthetic Sharp crop만 사용, 테스트 종료 시 서버 정리. 사용자 데이터 cleanup 대상 없음.
34. **Tests**: fixture integrity/negative corruption/bounds/stale/전이 보존/현행 미검출 characterization과 기존 회귀를 실행. 실패한 미래 기능 테스트·skip/TODO 없음.
35. **Total tests**: **933 PASS / 0 fail / 0 skip / 0 cancelled / 0 todo**. 기존865 + 신규68(M2 34/M3 34), 최종 실행 약56.6초.
36. **Typegen**: `npx.cmd next typegen` PASS.
37. **Typecheck**: `npx.cmd tsc --noEmit` PASS.
38. **Lint**: `npm.cmd run lint` PASS.
39. **Build**: `npm.cmd run build` PASS, Next16.3.4 production build.
40. **Diff check**: `git diff --check` PASS. 신규 파일 포함 whitespace0, tests/docs 밖 변경0.
41. **Secret scan**: tracked+신규382파일 및 build JS/map/JSON682파일에 실제 설정 키3종 일치0. 신규 파일 secret 패턴0, fixture 비결정성/URL/절대경로0, build fixture marker/reference0, production의 fixture import0. 값은 출력하지 않았으며 검사 범위 밖의 모든 secret 부재를 보증하지 않는다.
42. **Package version**: **0.1.1 유지**. logical cache schemaVersion은 앱 semver/기존 outer state version과 구분.
43. **M2 해결 여부**: **미해결**. 재현·계약만 완료, 실패 타일 retry 기능 미구현.
44. **M3 해결 여부**: **미해결**. 허용·문제 corpus 및 현재 gap만 고정. MEDIUM4/LOW1 유지.
45. **다음 TASK**: **TASK-038 Tile checkpoint/cache domain model 및 persistence**. 이 계약을 기반으로 reader/CAS/byte bound/JSONB 수용성/legacy부터 구현하고 provider retry는 TASK-039로 분리.
46. **Git diff summary**: tests/docs 10파일(신규7/수정3)만. commit/main merge/tag 없음.

## 최종 검증

- 전체 자동 검사 명령: `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`. 신규 corpus·계약을 모두 반영한 마지막 실행933/933 PASS. 기존 tests 삭제/제외0.
- 초기 신규66개 targeted 검사와 전체932개 검사도 통과했다. 이후 compatibility key-order/정책 변경 계약 test를 추가한 최종 전체 실행은933개다. 중간 수를 최종 수와 혼동하지 않는다.
- typegen/typecheck/lint/build/diff 모두 PASS. 신규 tests/docs의 local Markdown 링크 broken0, package/lock/root package version0.1.1.
- git tracked production 경로 `src`, `app`, `supabase`, package/lock, next-env diff0. HEAD `4f33eab` 유지. commit/main merge/tag 없음.
- source 경로 naming과 현재 schema/helper를 사용했다. 설치된 Next testing 지침도 확인했으나 새 framework·test dependency를 도입하지 않았다.
- known-key 검사는 `.env.local` 값을 메모리에서만 비교하고 값·원본 응답을 출력/저장하지 않았다. 새 fixture의 build 혼입 검사는 `.next/server`·`.next/static`의 JS/map/JSON(추적 manifest 포함)과 source import를 확인했다. build cache 전체나 모든 형태의 secret을 증명하는 검사는 아니다.
- 검증 로그와 값 없는 audit 요약은 저장소 밖 작업공간에 보관한다. corpus에는 timestamp/UUID randomness, signed URL, key, local absolute path가 없다. fixed timestamp는 C3 snapshot schema의 필수값이고 만료 URL과 무관하다.
- 실제 provider·브라우저 UI·Export QA는 이번에 수행하지 않았다. mock 결과를 새 AI 품질 PASS나 M2/M3 구현 완료로 보고하지 않는다.
