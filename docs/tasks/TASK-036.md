# TASK-036 — v0.2.0 Scope Definition & Architecture Planning

계획 문서 작업. 기준 `plan/v0.2.0` / `bd856d5`, package `0.1.1`. 앱 구현·실제 외부 API·DB/Storage mutation·commit/merge/tag를 수행하지 않는다. 상세 코드 근거, 비교 표와 후속 계약은 [v0.2.0 Roadmap](../V0_2_ROADMAP.md)에 있다.

## 완료 보고

1. **현재 기능 inventory**: Project부터 Export까지18개 필수 영역과 Auth/Commerce 확장을 실제 service/schema/migration과 대조했다. [Roadmap §2](../V0_2_ROADMAP.md)의 각 행에 source 링크를 기록했다. 문서의 옛 ‘후속 구현’ 문구보다 현재 코드를 우선했다.
2. **Partial 기능**: Project는 생성/목록/상세/집계까지이며 rename/delete/소유권은 없다. 도매매는 공식 옵션 API와 Generic HTML을 조합하며 전용 HTML Adapter는 없다. Extraction은 부분 성공 보존까지이며 실패 타일 전용 복구가 없다.
3. **Not implemented**: Auth/사용자 격리, SKU/가격/재고/옵션 이미지, Theme/Template 선택, 이미지 upscale/배경 제거, split/PDF 등 확장 Export.
4. **남은 MEDIUM**: M1 인물/제품 잘림 구분, M2 실패 타일 복구, M3 보고체·제목/본문 반복, M4 원본 유색 프레임. 4개 유지. M2/M3 부분 개선을 완료로 세지 않았다.
5. **남은 LOW**: L1 sparse Section 여백1개. L2 읽기/쓰기 상태 안내는 해결 이력이며 열린 수에서 제외한다. 계획만으로 새로 닫은 항목0.
6. **Public SaaS blockers**: session/Auth, projects owner FK와 기존 데이터 귀속, 7테이블 사용자 권한/RLS, Storage ownership이 없다. service-role 서버·process-local ticket/lock·cookie-less Export의 사용자 경계와 비용 제어도 필요하다.
7. **후보 A**: 기존 내부 흐름의 M2/M3에 직접 가치. 예상 SQL0·새 AI 단계0이며 안전한 cache와 카피 false positive가 주 위험. 필수8 TASK+선택1 TASK.
8. **후보 B**: 공개 준비에 가장 직접적이나 request-scoped user client, backfill/권한/Storage/Export/비용 경계를 함께 바꿔야 한다. 약10~14 TASK로 예상하며 로그인 UI만의 과제가 아니다.
9. **후보 C**: Adapter·SKU·enhancement·theme·Export 중 하나의 vertical을 선택할 경우 약4~8 TASK. 실제 공급처 계약/양성 자료가 선행되어야 하고 전부를 한 릴리스에 넣지 않는다.
10. **권장 방향**: **A — Internal Quality Release**, theme는 ‘검토와 재시도의 예측 가능성’.
11. **권장 이유**: 실제 재현 M2/M3, 현 내부 MVP 사용 목적, metadata CAS/shared renderer 재사용 가능성을 근거로 한다. 공개 출시가 우선 목표가 되면 B를 독립적으로 재승인해야 한다.
12. **Must Have**: 완료 타일 재호출 없는 명시 복구, 근거를 유지한 제목·본문 역할 개선, 검토 UI·legacy/CAS 보존·실제2상품 QA와 Export 회귀.
13. **Should Have**: Must 통과 후 L1의 제한된 sparse layout 개선, 위 핵심 흐름의 상태·비용·오류 안내 보완.
14. **Out of Scope**: 공개 SaaS/Auth·새 SQL·M1/M4 알고리즘 변경·Commerce 확장·새 AI pass·자동 retry·기존 canonical 일괄 수정.
15. **예상 DB 영향**: assets.metadata.detailExtraction의 bounded versioned cache. pre-NMS16×8regions, cache256KiB는 측정 후 확정할 제안 상한이다. 기존7테이블·Facts/Options는 유지.
16. **예상 migration**: A는0. 현재 마지막0005를 확인했으며 미래 SQL 작업의 다음 사용 가능 번호는0006이다. 예약/생성하지 않았고 적용된 SQL을 고치지 않는다.
17. **Storage 영향**: 기존 private product-assets/project-product-UUID 경로/5분 서명/독립 삭제·불확실 commit 보존 유지. cache용 새 bucket/object 없음.
18. **Auth 영향**: A에서 구현하지 않으며 공개 차단 유지. B의 root owner FK/backfill/child RLS, request-scoped user와 privileged maintenance 분리, Proxy·ticket·capture 권한 설계를 별도로 기록했다.
19. **AI 영향**: Extraction 실패 대상만 명시 호출; Planner/Section/Regen의 기존 prompt·검증만 보완. Asset/Product Analysis/Validation의 사실 경계와 호출 흐름 유지, 추가 평가 AI 없음.
20. **Options 영향**: 현 group/value/UUID/confirmed snapshot/CAS 불변. 후속 SKU는 명시 combination과 공급처 ID·가격/재고 시점 계약이 필요하며 독립 그룹으로 임의 평탄화하지 않는다.
21. **Image pipeline 영향**: 원본 hash/좌표/relevance/provenance 보존, durable tile checkpoint 제안. enhancement는 deterministic/AI upscale/배경 제거를 구분해 이월했다.
22. **Theme/template 영향**: 기존 Commerce Visual System 위 application-owned versioned token registry 가능성을 기록했다. 실제 Theme 선택/AI CSS 구현 없음.
23. **Export 영향**: 860px PNG/JPG shared Renderer 유지. split/시장별 크기/PDF는 각각 pagination·한도·font QA가 필요한 후속 범위다.
24. **Wholesale adapter 영향**: 현재 HTML ImportAdapter와 공식 API provider 경계를 확인했다. 새 사이트는 공통 secure fetch와 normalized candidate를 재사용하는 후속안만 기록했다.
25. **Security risk**: A의 stale cache/숨은 비용/metadata 경합을 우선 통제. 기존 SSRF/DNS/redirect/size/server-only 정책 불변. service-role 구조를 public-safe로 오인하지 않는다.
26. **Regression risk**: NMS/cap 이후 후보 ID 선택, interrupted checkpoint, legacy reader, copy false positive. downstream Facts/Options·canonical과 기존 Derived는 자동 변경하지 않는다.
27. **TASK decomposition**: 037 corpus·계약,038 cache 순수 로직,039 서버 복구,040 복구 UI,041 copy 정책,042 검토 UX,043 실제 QA,044 선택 L1,045 release 검증. 각 dependency/migration/API/완료 기준은 Roadmap §11 표에 있다.
28. **실행 순서**: 원인→순수 로직→서버→UI→copy 정책/UI→실제 QA→선택 polish→release. TASK-037 이후 기능 구현은 아직 시작하지 않았다.
29. **예상 실제 API 사용**: 후속 QA 기본 Planner2+Section2, 타일 source1개 N≤16의 controlled partial+명시 retry 총≤N. 추가 Regen1은 필요 시 별도 명시. upstream/API 재사용 가능성을 먼저 확인한다. **이번 실제 OpenAI/도매 API 호출0**.
30. **테스트 전략**: 12개 불변 조건, 실패/중단/CAS/key/bounds/정상 negative copy corpus, 실제 첫 출력과 replay/mock 분리, PNG/JPG dimensions·한글·이미지·옵션. 이번 docs-only 검사 결과는 아래에 기록한다.
31. **생성 문서**: `docs/V0_2_ROADMAP.md`, `docs/tasks/TASK-036.md`.
32. **수정 문서**: `docs/tasks/README.md`, `docs/RELEASE_BACKLOG.md`. 열린 M4/L1 수 유지, release 기준점과 계획 연결만 갱신.
33. **Application code**: 변경 없음. src/app 구현과 테스트 파일 추가/변경 없음.
34. **Migration**: 변경/생성/적용 없음. 원격 DB 조회나 타입 재생성도 하지 않음.
35. **Dependency**: 추가/변경 없음.
36. **Package version**: package/lock 모두0.1.1 유지. 앱 semver, schemaVersion, policyVersion, Facts/Options CAS version을 구분.
37. **Git diff summary**: 문서4개(신규2/수정2)만 변경. `src/**`, `app/**`, `supabase/**`, package/lock, next-env tracked diff0을 확인했다. commit/main merge/tag 없음.
38. **권장 다음 TASK**: **TASK-037 — M2/M3 재현 corpus와 계약 확정**. 먼저 실제 실패/정상 사례와 cache bounds/비용·품질 gate를 확정한다.

## 이번 검증 결과

- `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`: **865 PASS / 0 fail / 0 skip / 0 cancelled / 0 todo**. 약59.2초, mock 기반 기존 전체 테스트. 새 test 파일 없음.
- `npx.cmd next typegen`: PASS.
- `npx.cmd tsc --noEmit`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS, Next16.3.4 production build·static generation 완료.
- `git diff --check`: PASS. 신규 문서 포함 trailing whitespace0, 최종 문서 링크 검사 broken0.
- 문서4개만 변경, package/lock0.1.1, 앱·SQL·의존성·generated type의 추적된 변경0. build/typecheck 산출물은 기능 변경이 아니다.
- 문서4개의 API-key/JWT/credential query URL 패턴 검출0. 실제 비밀값을 출력/문서/fixture에 옮기지 않았다. 이 제한된 문서 검사로 전체 Git 역사나 모든 secret의 부재를 보증하지 않는다.
- 실제 OpenAI/도매 API0, 원격 Supabase DB/Storage mutation0. 실제 provider QA·브라우저 Export·원격 migration 검증은 이번에 다시 수행하지 않았다. TASK-035 결과와 이번 mock/build 검증을 구분한다.
