// TASK037_M3_CORPUS_V1 — hand-labelled minimal cases, not AI-generated classifications.
const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const C = '10000000-0000-4000-8000-000000000003';
export const pageContext = {
  productName: '검증용 상품',
  evidence: [
    { id: 'F1', kind: 'supported_fact', label: '상품명', value: '검증용 상품' },
    { id: 'F2', kind: 'supported_fact', label: '크기', value: '60 x 60 cm' },
    { id: 'F3', kind: 'supported_fact', label: '수량', value: '40매' },
    { id: 'V1', kind: 'visual_observation', assetId: A, summary: '앞면 지퍼 여밈과 전체 실루엣' },
    { id: 'V2', kind: 'visual_observation', assetId: B, summary: '목둘레 봉제선 외관' },
  ], assets: [A, B, C],
};
const intents = { hero: 'identity', feature: 'feature_from_fact', imageText: 'visual_description', detail: 'detail_description',
  specification: 'specification', option: 'selection_information' };
const section = (key, type, purpose, fields, evidenceIds, assetIds = []) => ({
  copyIntent: intents[type], purpose, content: { plannerKey: key, type, ...fields, evidenceIds, assetIds },
});
const hero = (headline, subheadline = null, refs = ['F1'], assets = [A]) =>
  section('hero', 'hero', '상품 정체성', { headline, subheadline, highlights: [] }, refs, assets);
const visual = (key, type, title, body, refs = ['V1'], assets = [A]) =>
  section(key, type, title, { title, body, ...(type === 'detail' ? { points: [] } : {}) }, refs, assets);
const feature = (title, body, refs = ['F2'], assets = [B]) =>
  section('feature', 'feature', title, { title, body, bullets: [] }, refs, assets);
const spec = (label, value, id) => section('spec', 'specification', '원문 사실 표',
  { title: '상품 표기', rows: [{ label, value, evidenceIds: [id] }] }, [id]);
const entry = (id, title, sections, classification, categories, rationale, extra = {}) => ({
  id, title, provenance: { kind: 'synthetic', reference: 'TASK-037 requested case' },
  pageContext: structuredClone(pageContext), sections,
  expected: { classification, categories, rationale }, ...extra,
});
export const m3Corpus = [
  entry('C1', 'Hero identity + canonical name', [hero('검증용 상품'), spec('상품명', '검증용 상품', 'F1')], 'allow', ['fact_reuse'], '정체성 소개와 원문 표의 역할이 다르다.'),
  entry('C2', 'Visual description + size row', [visual('visual', 'imageText', '지퍼 디자인', '앞면 지퍼 여밈 디자인'), spec('크기', '60 x 60 cm', 'F2')], 'allow', [], '관찰 외형과 크기 표는 다른 정보다.'),
  entry('C3', 'Hero identity + confirmed options', [hero('검증용 상품'), section('option', 'option', '확정 선택값', {
    title: '옵션 안내', optionSnapshot: { source: 'confirmed_options', appliedAt: '2026-01-01T00:00:00.000Z', confirmed: {
      schemaVersion: 1, policyVersion: 1, productId: '20000000-0000-4000-8000-000000000001', rowId: '20000000-0000-4000-8000-000000000002',
      version: 1, state: 'present', fingerprint: 'e'.repeat(64), groups: [{ id: '20000000-0000-4000-8000-000000000003', name: '옵션',
        values: [{ id: '20000000-0000-4000-8000-000000000004', label: '검증용 상품' }] }],
    } },
  }, [])], 'allow', ['fact_reuse'], '확정 선택값은 marketing prose 중복 검사에서 제외한다.'),
  entry('C4', 'Distinct visual/evidence', [visual('visual', 'imageText', '앞면 디자인', '앞면 지퍼 여밈 디자인'),
    visual('detail', 'detail', '목둘레 디테일', '목둘레 봉제선 외관', ['V2'], [B])], 'allow', [], '서로 다른 실제 관찰과 이미지.'),
  entry('C5', 'Same image with a different supported Fact', [hero('검증용 상품'), feature('크기 안내', '60 x 60 cm', ['F2'], [A])],
    'allow', [], '이미지 재사용만으로 정보 중복이 되지 않는다.'),
  entry('C6', 'Hero title/body paraphrase', [hero('검증용 상품', '검증용 상품을 소개합니다')], 'warning', ['title_body_redundancy'], '새 정보 없는 정체성 재진술.'),
  entry('C7', 'Hero/ImageText same Fact, Asset and message', [hero('검증용 상품', null, ['F1', 'V1']),
    visual('visual', 'imageText', '패드 소개', '검증용 상품의 정체성', ['F1', 'V1'])], 'reject', ['cross_section_purpose', 'fact_reuse', 'visual_message_reuse'], '별도 시각 근거/역할이 없는 두 번째 Section.'),
  entry('C8', 'ImageText/Detail same observation', [visual('visual', 'imageText', '앞면 디자인', '앞면 지퍼 여밈 디자인'),
    visual('detail', 'detail', '여밈 외관', '지퍼가 있는 앞면 디자인')], 'reject', ['visual_message_reuse', 'cross_section_purpose'], '같은 V1/A를 재서술.'),
  entry('C9', 'Quantity paraphrase', [hero('40매 구성', null, ['F3']), feature('수량 안내', '총 40매로 구성', ['F3'])],
    'warning', ['fact_reuse'], '같은 수량 Fact의 marketing 반복.'),
  entry('C10', 'Title/body same closure', [visual('visual', 'imageText', '앞면 지퍼 여밈', '앞면에는 지퍼 여밈이 적용되어 있습니다.')],
    'warning', ['title_body_redundancy'], '본문에 제목 외의 새 관찰이 없다.'),
  entry('C11', 'Size in three marketing roles', [hero('검증용 상품 60 x 60 cm', null, ['F1', 'F2']),
    feature('가로와 세로 치수', '60 x 60 cm'), visual('detail', 'detail', '규격 안내', '가로 60 cm, 세로 60 cm', ['F2'], [C])],
    'warning', ['fact_reuse', 'cross_section_purpose'], '같은 크기 F2를 세 marketing 역할에 반복.'),
  entry('C12', 'Canonical size repeat is allowed', [hero('검증용 상품 60 x 60 cm', null, ['F1', 'F2']), spec('크기', '60 x 60 cm', 'F2')],
    'allow', ['fact_reuse'], 'canonical 표는 marketing 사용 예산에서 제외.'),
  ...['모델이 착용하고 있는 모습입니다.', '제품을 촬영한 사진입니다.', '정면에서 촬영한 이미지입니다.', '사진에는 제품의 앞모습이 보입니다.']
    .map((body, i) => entry(`C${13 + i}`, '촬영/관찰 보고체', [visual('visual', 'imageText', '외형 안내', body)], 'reject', ['meta_observation'], '제품 외형보다 사진을 보는 행위를 서술.')),
  entry('C17', 'Grounded closure phrase', [visual('visual', 'imageText', '여밈 디자인', '앞면 지퍼 여밈 디자인')], 'allow', [], 'V1의 여밈 디자인 범위.'),
  entry('C18', 'Grounded silhouette phrase', [visual('visual', 'imageText', '전체 형태', '제품의 전체 실루엣')], 'allow', [], 'V1의 전체 실루엣 범위.'),
  entry('C19', 'TASK-035 actual title/body overlap', [visual('visual', 'imageText', '앞면 여밈과 포켓 구성', '앞면 여밈선과 양쪽 포켓이 드러난 착용 외관.')],
    'warning', ['title_body_redundancy'], '첫 실제 출력은 accepted였으나 제목과 본문의 정보가 겹쳤다.', {
      provenance: { kind: 'historical_minimal_quote', reference: 'docs/tasks/TASK-035.md: 첫 신규 Section 결과 / imageText' },
      pageContext: { productName: '검증용 조끼', assets: [A], evidence: [
        { id: 'V1', kind: 'visual_observation', assetId: A, summary: '조끼 전면·여밈선·양쪽 포켓 관찰' },
      ] },
    }),
  entry('C20', 'Exact marketing text repetition', [visual('visual', 'imageText', '앞면 지퍼 여밈 디자인', '앞면 지퍼 여밈 디자인')],
    'warning', ['exact_text', 'title_body_redundancy'], '현재 normalized exact copy 경고의 양성 control.'),
  entry('C21', 'Normalized marketing text repetition', [visual('visual', 'imageText', '앞면 지퍼 여밈 디자인', '앞면  지퍼 여밈 디자인!')],
    'warning', ['normalized_text', 'title_body_redundancy'], '공백/구두점 정규화 후 동일한 양성 control.'),
  entry('C22', 'Null body is a valid non-repetition', [visual('visual', 'imageText', '앞면 지퍼 여밈 디자인', null)],
    'allow', [], '추가 정보 없이 문장을 채울 필요가 없다. 이미지와 실제 V는 존재.'),
];

// Frozen current observations, independent of desired labels above.
// Compact fields: hard meta section indices, message duplicate pairs, over-budget F IDs, exact-copy count.
export const currentBaseline = {
  C1: [[], [], [], 0], C2: [[], [], [], 0], C3: [[], [], [], 0], C4: [[], [], [], 0], C5: [[], [], [], 0],
  C6: [[], [], [], 0], C7: [[], [[0, 1]], ['F1'], 0], C8: [[], [[0, 1]], [], 0],
  C9: [[], [], ['F3'], 0], C10: [[], [], [], 0], C11: [[], [], ['F2'], 0], C12: [[], [], [], 0],
  C13: [[], [], [], 0], C14: [[0], [], [], 0], C15: [[0], [], [], 0], C16: [[0], [], [], 0],
  C17: [[], [], [], 0], C18: [[], [], [], 0], C19: [[], [], [], 0], C20: [[], [], [], 1],
  C21: [[], [], [], 1], C22: [[], [], [], 0],
};
