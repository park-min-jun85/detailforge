// Synthetic semantic labels belong only to tests; production has no content mask.
export const EDGES = ['top', 'right', 'bottom', 'left'];
export const zeroInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const inset = (n, edges = EDGES) => Object.fromEntries(EDGES.map(edge => [edge, edges.includes(edge) ? n : 0]));
const box = (x, y, width, height) => ({ x, y, width, height });
const inner = box(16, 16, 608, 608);
const whole = box(0, 0, 640, 640);
function fixture(caseId, description, expectedClass, scene, overrides = {}) {
  return {
    caseId, description, expectedClass, width: 640, height: 640,
    scene, border: 16, color: [255, 255, 255, 255], format: 'png',
    knownContentBounds: inner, expectedAllowedEdges: EDGES, expectedForbiddenEdges: [],
    referenceInsets: inset(16), currentInsets: inset(16), currentContentLoss: false,
    ...overrides,
  };
}
const preserve = { knownContentBounds: whole, expectedAllowedEdges: [], expectedForbiddenEdges: EDGES,
  referenceInsets: zeroInsets, currentInsets: zeroInsets };

export const m1Cases = [
  fixture('M1-A', 'Pure white 16px outer border', 'safe_trim', 'frame'),
  fixture('M1-B', 'Very light gray outer border', 'safe_trim', 'frame', { color: [244, 244, 244, 255] }),
  fixture('M1-C', 'Transparent alpha outer border', 'safe_trim', 'frame', { color: [0, 0, 0, 0] }),
  fixture('M1-D', 'Deterministic 1–2px near-uniform compression-like noise', 'safe_trim', 'noise', { color: [250, 250, 250, 255] }),
  fixture('M1-E', 'Product extends through the left edge', 'unsafe_content_loss', 'left-product', {
    knownContentBounds: box(0, 16, 624, 608), expectedAllowedEdges: ['top', 'right', 'bottom'], expectedForbiddenEdges: ['left'],
    referenceInsets: inset(16, ['top', 'right', 'bottom']), currentInsets: inset(16, ['top', 'right', 'bottom']),
  }),
  fixture('M1-F', 'Product extends through the top edge', 'unsafe_content_loss', 'top-product', {
    knownContentBounds: box(16, 0, 608, 624), expectedAllowedEdges: ['right', 'bottom', 'left'], expectedForbiddenEdges: ['top'],
    referenceInsets: inset(16, ['right', 'bottom', 'left']), currentInsets: inset(16, ['right', 'bottom', 'left']),
  }),
  fixture('M1-G', 'Black product edge resembles a black frame', 'unsafe_content_loss', 'frame', { ...preserve, color: [12, 12, 12, 255] }),
  fixture('M1-H', 'White fabric fills the left white edge; pixels alone are ambiguous', 'ambiguous', 'frame', {
    knownContentBounds: box(0, 16, 624, 608), expectedAllowedEdges: [], expectedForbiddenEdges: EDGES,
    referenceInsets: zeroInsets, currentContentLoss: true,
  }),
  fixture('M1-I', 'Small label glyphs touch the left edge', 'unsafe_content_loss', 'label', {
    knownContentBounds: box(0, 16, 624, 608), expectedAllowedEdges: ['top', 'right', 'bottom'], expectedForbiddenEdges: ['left'],
    referenceInsets: inset(16, ['top', 'right', 'bottom']), currentInsets: inset(16, ['top', 'right', 'bottom']),
  }),
  fixture('M1-J', 'Stylized hand/head/body touches top and left', 'unsafe_content_loss', 'person', {
    knownContentBounds: box(0, 0, 624, 624), expectedAllowedEdges: ['right', 'bottom'], expectedForbiddenEdges: ['top', 'left'],
    referenceInsets: inset(16, ['right', 'bottom']), currentInsets: inset(16, ['right', 'bottom']),
  }),
  fixture('M1-K', 'Two product panels with an internal vertical separator', 'no_trim_needed', 'vertical-panels', { ...preserve, border: 0 }),
  fixture('M1-L', 'Stacked panels with internal top/bottom panel boundaries', 'no_trim_needed', 'horizontal-panels', { ...preserve, border: 0 }),
];

function colored(id, description, expectedClass, scene = 'frame', overrides = {}) {
  return fixture(id, description, expectedClass, scene, {
    border: 12, color: [220, 200, 170, 255], knownContentBounds: box(12, 12, 616, 616),
    referenceInsets: inset(12), currentInsets: zeroInsets, ...overrides,
  });
}
export const m4Cases = [
  colored('M4-A', 'Uniform beige 12px decorative frame', 'uniform_frame'),
  colored('M4-B', 'Uniform pale pink decorative frame', 'uniform_frame', 'frame', { color: [248, 218, 229, 255] }),
  colored('M4-C', 'Near-uniform colored frame after real JPEG encoding', 'near_uniform_frame', 'noise', { format: 'jpeg' }),
  colored('M4-D', 'Colored frame only at left/right', 'uniform_frame', 'sides', {
    knownContentBounds: box(12, 0, 616, 640), expectedAllowedEdges: ['left', 'right'], expectedForbiddenEdges: ['top', 'bottom'],
    referenceInsets: inset(12, ['left', 'right']),
  }),
  colored('M4-E', 'Single colored band at top', 'uniform_frame', 'top-band', {
    knownContentBounds: box(0, 12, 640, 628), expectedAllowedEdges: ['top'], expectedForbiddenEdges: ['right', 'bottom', 'left'],
    referenceInsets: inset(12, ['top']),
  }),
  colored('M4-F', 'Product and surrounding frame have similar color', 'ambiguous', 'similar', preserve),
  colored('M4-G', 'Background wall continues all the way to the edge', 'background_like', 'wall', preserve),
  colored('M4-H', 'Product occupies a same-colored edge', 'content_like', 'frame', preserve),
  colored('M4-I', 'Text/icon embedded inside the colored border', 'content_like', 'icon-frame', preserve),
  colored('M4-J', 'Gradient and shadow reach the edge', 'ambiguous', 'gradient', preserve),
];
export const boundaryCases = [...m1Cases, ...m4Cases];
