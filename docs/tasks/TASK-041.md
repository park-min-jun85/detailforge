# TASK-041 — Copy Role Separation & Review

## 후속 TASK-042 실제 QA 상태

사용자 지정 TASK-042에서 첫 실제 Planner1/Section1/regen1, Desktop Editor 수동 중복 경고·후보 명시 적용·Final/PNG/JPG를 검증했다. 전체1091 tests와 필수 검사 PASS. Final **review shell**에만 검토 UI가 있고 canonical article 및860×3057 PNG/JPG에 내부 경고0을 확인했다. 아래 실제 QA 미실행 문장은 TASK-041 당시 범위다. [TASK-042 결과](TASK-042.md)는 gallery ‘외관을 담았습니다’의 자동 meta0/human1(HIGH1)로 **M3 NEEDS_WORK**다. 이 문서의 Final 표현은 판매용 article을 뜻하지 않는다.

`feat/copy-role-dedup`, 시작 HEAD `c0a13bf`, 시작 작업 트리 clean. TASK-037의 C1~C22 기대 분류와 roadmap의 TASK-041 범위를 따른다. 실제 외부 호출 없이 공통 카피 정책·검토 UI·mock 회귀를 보완한다.

## 구현

- `page-quality/copy-review.ts`의 순수 `reviewCopyRoles`가 제목/본문 재진술, 여러 marketing 섹션의 같은 F 사용, 기존 F/V·Asset·type/intent·purpose/title 서명 중복을 검토 finding으로 반환한다. 이유, 현재 배열 기준 섹션 위치, copy intents, evidence IDs를 담으며 저장 모델을 추가하지 않는다.
- Hero의 headline/subheadline, feature/imageText/detail의 title/body, gallery의 title/intro를 비교한다. NFKC, 공백·구두점, 제한된 조사와 소개합니다/적용되어 있습니다/드러난 착용 외관, 여밈선→여밈, 구성/양쪽을 비교용으로만 정리한다. 최소 두 정보 token의 집합 일치를 요구한다. 원문·Fact·Options를 수정하거나 일반 의미 동등성을 판정하지 않는다.
- C19의 양쪽/여밈선 같은 차이는 **사람 검토 경고**다. 모든 차이가 무의미하다는 단정이나 hard reject가 아니다. 새로운 부위·숫자·부정·앞/뒤 차이는 비교 token에 남으며 단일 명사 반복은 새 검사를 통과한다.
- 반복 F는 사진이 달라도 역할별 검토 이유를 표시한다. F 사용 신호일 뿐 진위 판정이나 자동 제거 근거가 아니다. specification/option/notice 값은 대상에서 제외하며 Spec/Option 제목의 기존 prose guard는 유지한다.
- `copyQuality`는 기존 `repetitive_copy` warning과 runtime `copyReview`를 반환한다. 기존 exact-copy/duplicate-title count 의미는 유지한다. 새 DB schema/저장 finding/자동 migration은 없다.
- Editor/Final review shell `QualitySummary`에 해당 섹션 번호·역할·검토 이유를 표시한다. 기존 renderer/capture surface 밖이다. 재생성 후보는 현재 peer와 함께 검토하되 후보와 무관한 peer끼리의 finding은 제외한다. 경고가 적용 버튼을 막지 않는다.
- 공통 `validateCommerceCopy`에 ‘모델/사람이 착용하고 있는 모습입니다/이다’ 패턴을 추가한다. 새 전체 생성·candidate-first 재생성에서 `copy_quality`로 거부한다. 수동 저장·legacy 읽기는 기존 비차단 경고 경계를 유지한다.
- Planner 역할 배분 지침과 Section/Regen 공통 `COMMERCE_COPY_POLICY`를 보완한다. 추가 근거가 없으면 schema가 허용하는 nullable 본문만 생략하도록 권고한다. 필수 본문·사실·옵션 원문은 삭제하지 않으며 경고를 hard reject로 승격하지 않는다.
- Copy policy 2→3이 기존 Planner/Regeneration fingerprint 경로에 반영된다. Plan reader는 누락/v1/v2/v3를 읽는다. 옛 입력 fingerprint는 stale가 되지만 조회만으로 AI 실행·기존 데이터 변경은 없다. 앱 version은 0.1.1이다.

## C1~C22와 계약 보존

- C1~C5/C12/C17/C18/C22: **allow 9**. canonical 재표시, 다른 F/V/Asset, 외형 명사구, null body 유지.
- C6/C10/C19: 새 제목/본문 경고. C9/C11: 반복 F의 섹션별 역할 경고. C20/C21: 기존 exact/normalized 경고와 새 역할 경고. **warning 7**.
- C13: 새 보고체 거부. C14~C16: 기존 보고체 거부. C7/C8: 기존 목적 중복 거부. **reject 6**.
- fixture의 기대값·출처·동결 BEFORE는 수정하지 않았다. characterization은 C13 hard-meta 관찰만 명시 delta로 비교한다. 새 finding과 최종22개 분류는 별도 production-policy test가 검증한다.
- corpus22개는 helper 수준 분류다. 전부 실제 provider/grounding E2E로 실행했다고 주장하지 않는다. 별도 mock service는 보고체 거부, warning 생성/후보/명시 적용, 원본 보존을 확인한다.

## 검증과 한계

- 초기 관련140개와 신규 service4개 PASS. 신규37개는 corpus22개, 추가 정보/부정/숫자/긴 한글/null/정규화, 다른 사진의 같은 F, SSR 역할 설명·renderer 경고 제외, 실패 보존·호출1회, 수동 저장, 후보 적용, legacy 읽기·stale 무변경을 포함한다.
- 첫 전체 실행1091개 중1090개 PASS. 이전 정책 version2를 고정한 테스트1개를 version3 쓰기, v1/v2/누락 읽기, 미래v4 거부로 갱신했다. 최종 재실행은 아래에 기록한다.
- Typegen/TypeScript/lint/production build PASS. 실제 OpenAI/도매 API 호출0, 원격 DB/Storage mutation0. service 테스트는 loopback mock만 사용한다. 추가 AI pass/embedding/semantic judge/자동 retry·후처리 없음.
- 브라우저 클릭·스크린샷·새 PNG/JPG·새 실제 AI 출력 QA는 미실행이다. SSR로 검토 문구와 비차단 버튼, renderer에서 경고 제외를 확인했다.
- 일반 의미 중복·동의어·토큰 없는 띄어쓰기·다른 Asset ID의 동일 사진을 전부 검출하지 않는다. 정상 corpus/추가 negative control에서 false positive0이며 모든 상품으로 일반화하지 않는다.
- M3 deterministic 구현·mock gate와 실제 품질 최종 판정은 구분한다. 후속 사용자 지정으로 실제 판정은 TASK-042에서 수행하고 시각 리듬은 선택 L1(TASK-044)에 남긴다. TASK-041 mock 결과만으로 backlog를 닫지 않는다. 초기화·commit/merge/tag 없음.

## 최종 검사

- `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`: **1091/1091 PASS**, 실패/skip/todo0, 약60초. 기존1054개+신규37개.
- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`: 모두 PASS. 설치된 Next.js16.3.4, 기존 package0.1.1 유지.
- `git diff --check`: PASS. 브랜치는 `feat/copy-role-dedup` 유지. 기존 tracked 파일 삭제0, AGENTS/의존성/SQL/추출 경로 변경0. 테스트 로그는 gitignore된 `tmp/`에만 보관했다.
- TASK-041 구현·mock 회귀 완료. 실제 AI 품질 gate와 브라우저/Export 재검증은 이 결과에 포함하지 않는다.
