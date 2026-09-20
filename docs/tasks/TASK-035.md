# TASK-035 — v0.1.1 Final AI Validation & Release Preparation

2026-09-20 · `release/v0.1.1` · 기준 `19735a6` (`fix: polish v0.1.1 release candidate`). 시작 작업 트리 clean. **PASS — v0.1.1 Local/Internal MVP Release Candidate.** Git commit/main merge/tag는 실행하지 않았다.

## 요청한 48개 완료 항목

1. **TASK 목적**: TASK-034의 카피 정책 v2를 실제 첫 신규 AI 출력으로 평가하고 통과한 내부 MVP의 patch release를 준비한다. 기능 동결을 유지했다.
2. **Branch**: `release/v0.1.1`. 브랜치 전환·history rewrite 없음. 이전 v0.1.0 tag는 `06d80bb`다.
3. **Actual OpenAI call count**: 총 **2회**, Planner1+Section1. 둘 다 HTTP200, `gpt-5.6-terra`. 자동 retry0, 품질 개선용 반복 생성0. 도매 API/Asset Analysis/Product Analysis/Fact Validation/Extraction/embedding 호출0.
4. **QA product**: `67695797`, 여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼. TASK-030의 실제 원본·분석·Facts·확정 옵션을 격리된 로컬 QA DB에 재현했다. 원본 SHA-256과 추출 provenance의 일치를 검사한 뒤 같은 rect/trim에서 사진을 복원했다. 새 Import/full E2E나 원격 DB 검증이라고 주장하지 않는다.
5. **Planner call count**: 1회. 기존 Plan은 commerceCopyVersion1로 현재2에서 stale였다. 기존 Product Analysis/Validation은 ready였으며 fingerprint를 임의 변경하지 않고 실제 `planPage`를 실행했다. 첫 계획 accepted.
6. **Section Engine call count**: 1회. 실제 `generateSections`가 새 Plan을 사용했고 기존 provider→Structured Output/Zod→grounding/copy/title/중복 검증→staging/교체 경계를 통과했다. service의 DB만 로컬 fixture이며 OpenAI 응답은 mock이 아니다.
7. **Section 구조**: Hero → ImageText → Detail → Specification → Option, 5개. 서로 다른 Derived 이미지3개, 긴 원본 배치0. 아래에 신규 결과의 문구·근거·Asset ID를 기록했다.
8. **Title 목록**: Hero headline ‘여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼’; ‘앞면 여밈과 포켓 구성’; ‘목둘레와 앞여밈 디테일’; ‘상품 및 제조 정보’; ‘옵션 안내’.
9. **촬영 설명형 카피 count**: **0**. `camera_framing` detector 검출0, detected phrase/type 해당 없음. 사람도 새 prose 전체를 읽었고 ‘촬영한 사진/근접 구성/누른 구도’ 류를 발견하지 않았다. 저장 결과 accepted.
10. **기존 meta-observation count**: **0**. 제목/본문/목록에서 media_inspection/media_report/observation_narration 검출0. 입력된 관찰 자료나 내부 Planner brief의 보고체를 판매 문구로 혼동하여 세지 않는다.
11. **Unsupported V-only claim count**: **0**. 전면 여밈·포켓은 V1, 목둘레·봉제선은 V3 범위. 편안함/보온/촉감/흡수/내구 주장 없음. Hero 상품명의 ‘양털 후리스’는 F1 원문이며 새 소재 Fact나 성능 입증으로 승격하지 않았다. 미분석 Hero crop은 배치 전용이다.
12. **Semantic duplicate count**: 구조 검사 위험쌍0, 사람 검토에서 허용 불가능한 **Section 간 목적 중복0**. Hero=식별, ImageText=전면/포켓, Detail=목둘레·봉제선의 다른 확대 컷이다. ‘앞여밈’ 부위가 두 곳에 나오지만 다른 사진/관찰 역할로 허용한다. 다만 ImageText 제목·본문은 정보를 반복하므로 M3의 일반 카피 품질 문제는 유지한다.
13. **Title mismatch count**: **0**. 근거 없는 묶음/세트/패키지 제목 없음. Detail은 실제 detail 관찰, Spec은 실제6행, Option은 실제 confirmed snapshot과 대응한다.
14. **Specification exactness**: **PASS**, 6행 label/value/evidenceId가 supported canonical F와 완전 일치. 카테고리·원산지·제조사·모델명·제조국·상품번호. placeholder 추가나 AI rewrite 없음.
15. **Options exactness**: **PASS**, 그룹명 ‘옵션’, 아이보리 90 → 아이보리 95 → 코코아 90 → 코코아 95 → 브라운 90 → 브라운 95. 1그룹6값의 UUID/label/순서/version1 모두 원본 일치. 색상/사이즈 분할 없음. AI는 items=[]만 반환하고 서버가 기존 confirmed snapshot을 삽입했다.
16. **AI output accepted/rejected**: Planner accepted, Section accepted. 첫 출력 그대로 평가·출력, 사후 문장 치환/좋아질 때까지 재생성 없음. 이번에는 실제 bad-output reject가 발생하지 않아 실제 거부 사례의 Guard PASS라고 표현하지 않는다. 실패 보존/거부는 기존 mock 회귀가 검증한다.
17. **Validator false positive**: 이번 정상 출력에서 관찰0. 한 상품·한 번의 평가이며 모든 정상 표현에 대한 오탐 부재나 일반 성공률의 증거는 아니다.
18. **M2 UI 확인**: 실제 partial fixture(13/14구간 성공, 실패2번)의 후보 화면에서 ‘성공한 구간만 포함…검토 후 저장’, ‘전체 구간을 다시 분석하므로 AI 비용’, ‘이전 성공 후보와 저장 이미지 유지’ 안내를 확인했다. ‘제품컷 재분석 (AI 재호출)’ 버튼과 연결되고 자동 호출처럼 보이지 않는다. 위협적/개발자 전용 표현으로 인한 명백한 문제 없음. 버튼 실행0, 실패 타일 전용 retry는 미지원.
19. **L2 recovery 확인**: 느린 읽기 ‘최신 섹션을 불러오는 중…’, 쓰기 ‘저장 중…’ 구분. fixture의 저장 준비 조회 실패 후 ‘저장 결과를 확인하지 못했습니다. 입력 내용은 유지됩니다…’와 헤드라인 ‘QA 미저장 변경’ 보존. 별도 갱신 실패 후 ‘최신 섹션을 불러오지 못했습니다…다시 시도…’와 동일 draft 보존. 확인창 취소도 보존, 명시적 버리기 후 정상 재조회는 원래 헤드라인으로 복원했다. 별도 lease 쓰기 거부의 conflict 안내도 확인했다. 앱 상태/저장 코드 수정 없음.
20. **Crop fixtures**: 기존6종 PASS. 흰/밝은 회색 여백, 제품의 edge 접촉, 인접 텍스트, 여러 panel, clean crop 등 보수적 trim/보존 검사. 알고리즘/threshold/원본 bytes 변경 없음. 전체865 tests 안에서 재실행했다.
21. **PNG dimensions**: **860×2744px / 1,007,889 bytes**, 1회 생성. 실제 `exportDetail`과 Chromium으로 캡처한 파일을 직접 열어 확인했다.
22. **JPG dimensions**: **860×2744px / 277,521 bytes**, 1회 생성. PNG와 동일한 배치, 첫/마지막 Section 존재. 이미지3개·스펙6행·옵션6개 유지, 글자 잘림/Editor UI/review warning 없음. DOM article 폭860/높이2744, controls0, horizontal overflow0, overflowing text0. 앱 구현이 동일한 기존 production build에서 Export했고 버전 변경 뒤 production build도 통과했다.
23. **Version before**: 0.1.0.
24. **Version after**: 0.1.1. 실제 AI/UI/Export QA 및 전체 tests 통과 뒤 변경했다.
25. **package-lock version**: root와 packages[""] 모두0.1.1. 버전3줄 외 package/lock의 dependency/schema 변경 없음.
26. **CHANGELOG 변경**: `0.1.1 - 2026-09-20`에 Editor 상태·실패 복구/재분석 비용/제한된 카피 guard 및 실제2호출/Export 검증 기록. M2/M3 부분 보완 한계를 명시했다. 기존0.1.0 기록은 유지했다.
27. **RELEASE_BACKLOG 변경**: TASK-035 실제 결과를 추가. M3의 신규 첫 출력 안전성은 통과했지만 ImageText 제목/본문 정보 반복을 근거로 부분 보완 상태 유지. M2 기능 미지원, L2 해결 유지.
28. **남은 MEDIUM**: **4** — M1 인물/제품 잘림 구분, M2 실패 타일 전용 복구, M3 일반 카피 자연스러움/정보 반복, M4 모호한 원본 장식 경계.
29. **남은 LOW**: **1** — L1 sparse Section 여백. 이번 동결에서 CSS를 임의 조정하지 않았다.
30. **생성 파일**: `docs/tasks/TASK-035.md` 1개. QA helper/JSON/이미지/검사 로그는 저장소 밖 작업공간에만 있다.
31. **수정 파일**: `package.json`, `package-lock.json`, `CHANGELOG.md`, `README.md`, `docs/RELEASE_BACKLOG.md`, `docs/RELEASE_CHECKLIST.md`, `docs/tasks/README.md` 7개. 앱·prompt·CSS·test 구현 변경0.
32. **Migration**: 없음. 기존0001~0005/generated types/RLS/Storage policy 불변. 원격 migration push/reapply/재조회 없음.
33. **Dependency**: 추가/변경0. npm install/update 실행 없음.
34. **Tests**: `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs` 전체 실행. 자동 테스트는 mock, 실제 유료 호출0. bug fix가 없어 의미 없는 test 추가 없음. SSRF/DNS/redirect/크기 상한/Options CAS/Section CAS/이전 성공 보존 회귀 유지.
35. **Total test count**: **865 pass / 0 fail / 0 skip / 0 cancelled / 0 todo**. 기존 범위 삭제/제외0.
36. **Typegen**: `npx.cmd next typegen` PASS.
37. **Typecheck**: `npx.cmd tsc --noEmit` PASS.
38. **Lint**: `npm.cmd run lint` PASS.
39. **Build**: `npm.cmd run build` PASS, package0.1.1 기준. npm 신규 버전 안내는 정보 메시지이며 upgrade하지 않았다.
40. **Diff check**: `git diff --check` PASS. 최종 diff가 문서/버전에 한정됨을 검토했다. binary/실제 env/QA image/새 dependency/migration 추적0.
41. **Secret scan**: Git tracked+신규 문서, production client JS/map, TASK-035 텍스트 산출물의 실제 OpenAI/Supabase service-role/Domeggook 키 일치0. client provider marker0. 패턴 검출 중 asset-db의 명시적 temporary-test-token2곳은 mock이며 실제 노출0. 원본 provider envelope/system prompt/실제 signed URL을 보고서에 넣지 않았다. 알려진 키/패턴 검사이며 모든 Git 역사나 알 수 없는 비밀까지 증명하지 않는다.
42. **Existing user data protection**: 실제 Supabase DB/Storage 연결0, 변경0. real AI harness는 외부 fetch를 차단하고 명시적 OpenAI transport만 허용했다. 로컬 service fixture의 Project/Product/Facts/source_snapshot/Product Analysis/Validation/Options/Assets는 전후 deep equality 일치. 성공한 새 Plan/Sections만 로컬에서 교체했고 기존 원본 evidence 파일은 보존했다. 이후 UI/Export replay hash도 불변, 거부된 쓰기 요청1회와 실제 mutation0을 구분한다. 원격 cleanup 대상 없음. QA 서버/브라우저 탭 종료.
43. **BLOCKER**: **0**.
44. **HIGH**: **0**. 실제 bad output 통과나 심각한 false positive가 관찰되지 않아 앱 코드 수정 없음.
45. **v0.1.1 RC verdict**: **PASS — Local/Internal MVP Release Candidate**. 실제 AI 필수 조건·865 tests·필수 검사·secret0·PNG/JPG·데이터 보호 통과. 일반 카피/사진 품질의 모든 MEDIUM 해결 또는 공개 SaaS 승인을 뜻하지 않는다. Auth/owner_id/사용자별 RLS·Storage 격리 전까지 공개 배포 차단 유지.
46. **Recommended commit message**: `chore: prepare v0.1.1 release`.
47. **Recommended tag**: `v0.1.1` (사용자 검토·commit·main 반영 후). 아직 생성하지 않았다.
48. **Exact next Git commands**: 아래 제안만 기록했다. 이번에는 실행하지 않았다. main이 이동했거나 다른 변경이 추가됐으면 다시 검토한다. ff-only 실패 시 강제 reset/merge하지 않는다.

```powershell
git switch release/v0.1.1
git status --short
git diff --check
git diff -- package.json package-lock.json README.md CHANGELOG.md docs/RELEASE_BACKLOG.md docs/RELEASE_CHECKLIST.md docs/tasks/README.md
Get-Content docs/tasks/TASK-035.md
git add -- package.json package-lock.json README.md CHANGELOG.md docs/RELEASE_BACKLOG.md docs/RELEASE_CHECKLIST.md docs/tasks/README.md docs/tasks/TASK-035.md
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "chore: prepare v0.1.1 release"
git switch main
git merge --ff-only release/v0.1.1
git tag -a v0.1.1 -m "DetailForge v0.1.1"
git status --short
git show --no-patch v0.1.1
```

## 첫 신규 Section 결과

아래는 검증된 앱 도메인 출력의 필요한 필드 요약이다. 전체 provider response나 system prompt가 아니다. null/빈 배열을 임의 보충하지 않았다.

- **hero**: title 필드 없음. headline=`여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼`, subheadline=null, highlights=[]. evidenceIds=[F1]. assetIds=[9dde927e-685d-4b0f-8ad3-4fd13eb6e789]. 미분석 사용자 승인 Derived의 사진 배치만 사용하고 외형 주장 없음.
- **imageText**: title=`앞면 여밈과 포켓 구성`, body=`앞면 여밈선과 양쪽 포켓이 드러난 착용 외관.`. headline/items 없음. evidenceIds=[V1]. assetIds=[6486cb5b-aeb6-4a52-bad1-42ced34f11c5]. V1은 조끼 전면·여밈선·양쪽 포켓을 관찰했다.
- **detail**: title=`목둘레와 앞여밈 디테일`, body=null. points1개=`목둘레와 앞여밈 일부, 봉제선의 외관.` [V3]. evidenceIds=[V3]. assetIds=[927a9163-bcc2-4695-8abb-bca309b1b2bb]. V3은 목둘레/앞여밈 일부/봉제선 관찰이며 촉감/내구 주장으로 확장하지 않았다.
- **specification**: title=`상품 및 제조 정보`. evidenceIds=[F3,F4,F5,F6,F7,F8], assetIds=[]. rows는 카테고리=`의류/언더웨어 > 여성의류 > 조끼` [F3]; 원산지=`수입산 / 아시아 / 중국` [F4]; 제조사=`디에이치트레이딩` [F5]; 품명 및 모델명=`컬리 집업 베스트` [F6]; 제조국 또는 원산지=`중국` [F7]; 상품번호=`67695797` [F8]. body/headline 없음.
- **option**: title=`옵션 안내`, AI items=[], evidenceIds=[], assetIds=[]. 서버가 confirmed snapshot을 넣어 그룹 ‘옵션’과 아이보리 90/아이보리 95/코코아 90/코코아 95/브라운 90/브라운 95를 렌더링했다. AI 빈 items는 옵션 미확인/없음으로 변환한 결과가 아니다.

## 검증 범위와 산출물

저장소 밖 작업공간의 `artifacts/TASK-035/`에 호출 횟수 ledger, 최소 도메인 candidate/Plan/quality, 새 canonical의 PNG/JPG, UI 확인과 fixture hash, tests/typegen/typecheck/lint/build/secret 결과를 보관한다. Git 추가 대상이 아니다. 실제 provider 호출은 기존 서버 서비스로 실행했고 UI 검증은 브라우저, Export는 기존 서비스와 Chromium을 사용했다. 전체 흐름을 브라우저 버튼으로 새로 수행했다는 뜻은 아니다.

실패 UI 검증에는 격리 fixture의 일시적인 읽기 오류 및 쓰기 거부만 사용했다. Supabase 원격 장애를 발생시키지 않았다. 최종 출력에 쓰지 않는 기존330px 원본 thumbnail bytes는 다시 가져오지 않아 Images 목록에서 해당 카드만 preview unavailable이며, 이번 Final이 참조하는 Derived3개는 모두 정상이다.

M3의 이번 안전성 목표는 통과했지만 ImageText의 제목·본문 정보 반복은 남았다. 본문을 자동 삭제하거나 추가 호출로 결과를 고르지 않았다. 현재 finite pattern guard가 자연어 전반을 판정하지 못한다는 기존 한계를 유지하고, 다상품 첫 출력 corpus·제목/본문 역할 보완은 별도 후속 TASK로 넘긴다. M2 실패 타일 전용 복구와 M1/M4 사진 경계도 별도 설계 대상이다.
