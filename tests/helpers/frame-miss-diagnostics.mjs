// Test-only descriptive measurements. These thresholds never authorize production trim.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const edges = ['top', 'right', 'bottom', 'left'];
export const diagnosticConfig = Object.freeze({ transitionDelta: 12, continuityDistance: 6, detailDelta: 12 });
export const rgbDistance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const luminance = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];

function validate(raw, width, height) {
  if (!(raw instanceof Uint8Array) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1 || width * height > 40_000_000 || raw.length !== width * height * 4) throw new Error('Invalid RGBA dimensions');
}
function summarize(points, config) {
  const mean = [0, 0, 0], squares = [0, 0, 0], min = [255, 255, 255], max = [0, 0, 0];
  let adjacentMax = 0, detailPairs = 0, pairs = 0, opaque = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]; opaque += Number(p[3] === 255);
    for (let c = 0; c < 3; c++) { mean[c] += p[c]; squares[c] += p[c] ** 2; min[c] = Math.min(min[c], p[c]); max[c] = Math.max(max[c], p[c]); }
    // Only adjacent pixels on one continuous line are compared.
    if (i) { const delta = Math.max(...p.slice(0, 3).map((v, c) => Math.abs(v - points[i - 1][c]))); adjacentMax = Math.max(adjacentMax, delta); detailPairs += Number(delta > config.detailDelta); pairs++; }
  }
  for (let c = 0; c < 3; c++) mean[c] /= points.length;
  return { mean, variance: squares.map((v, c) => Math.max(0, v / points.length - mean[c] ** 2)), range: max.map((v, c) => v - min[c]),
    adjacentMax, detailRatio: pairs ? detailPairs / pairs : 0, opaqueRatio: opaque / points.length,
    continuity: points.filter(p => rgbDistance(p.slice(0, 3), mean) <= config.continuityDistance).length / points.length };
}
export function edgeProfile(raw, width, height, edge, depth, inset = 0, config = diagnosticConfig) {
  validate(raw, width, height);
  if (!edges.includes(edge)) throw new Error('Invalid edge');
  const vertical = edge === 'left' || edge === 'right', axis = vertical ? width : height, length = vertical ? height : width;
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > axis || !Number.isSafeInteger(inset) || inset < 0 || inset * 2 >= length) throw new Error('Invalid profile bounds');
  if (!['transitionDelta', 'continuityDistance', 'detailDelta'].every(k => Number.isFinite(config[k]) && config[k] >= 0)) throw new Error('Invalid diagnostic config');
  const lines = [];
  for (let offset = 0; offset < depth; offset++) {
    const points = [];
    for (let i = inset; i < length - inset; i++) {
      const x = vertical ? (edge === 'left' ? offset : width - 1 - offset) : i;
      const y = vertical ? i : (edge === 'top' ? offset : height - 1 - offset), p = (y * width + x) * 4;
      points.push(Array.from(raw.subarray(p, p + 4)));
    }
    lines.push({ offset, ...summarize(points, config) });
  }
  const transitions = lines.slice(1).map((line, i) => ({ offset: line.offset, rgbDistance: rgbDistance(lines[i].mean, line.mean), luminanceDistance: Math.abs(luminance(lines[i].mean) - luminance(line.mean)) }));
  return { edge, axis, length, inset, lines, transitions, transitionCount: transitions.filter(t => t.rgbDistance > config.transitionDelta).length };
}
export function regionStats(raw, width, height, rect, config = diagnosticConfig) {
  validate(raw, width, height);
  const { x, y, width: w, height: h } = rect;
  if (![x, y, w, h].every(Number.isSafeInteger) || x < 0 || y < 0 || w < 1 || h < 1 || x + w > width || y + h > height) throw new Error('Invalid region');
  const sum = [0, 0, 0], square = [0, 0, 0]; let details = 0, pairs = 0;
  for (let dy = y; dy < y + h; dy++) for (let dx = x; dx < x + w; dx++) {
    const p = (dy * width + dx) * 4;
    for (let c = 0; c < 3; c++) { sum[c] += raw[p + c]; square[c] += raw[p + c] ** 2; }
    for (const q of [dx + 1 < x + w ? p + 4 : -1, dy + 1 < y + h ? p + width * 4 : -1]) if (q >= 0) {
      pairs++; details += Number(Math.max(...[0, 1, 2].map(c => Math.abs(raw[p + c] - raw[q + c]))) > config.detailDelta);
    }
  }
  const n = w * h, mean = sum.map(v => v / n);
  return { rect, pixels: n, mean, variance: square.map((v, c) => Math.max(0, v / n - mean[c] ** 2)), detailRatio: pairs ? details / pairs : 0 };
}

// Validates declared desired contracts; does not infer semantic classes from metrics.
// Raw pixels and fixed dimensions/config are the equality key, never a fixture label.
export function validateMissCorpus(fixtures, render) {
  assert.ok(Array.isArray(fixtures) && fixtures.length, 'Empty corpus');
  const ids = new Set(), inputs = new Map();
  for (const f of fixtures) {
    assert.ok(typeof f.id === 'string' && !ids.has(f.id), 'Duplicate/missing id'); ids.add(f.id);
  }
  for (const f of fixtures) {
    assert.ok(['decorative_frame', 'panel_background', 'photo_background', 'content_touching_edge', 'ambiguous'].includes(f.expectedClass), 'Invalid class');
    assert.ok(['safe_to_trim', 'unsafe_to_trim', 'ambiguous'].includes(f.safety), 'Invalid safety');
    if (f.futureAction !== undefined) assert.ok(['detector_extension', 'preserve', 'manual_review', 'manual_crop_candidate'].includes(f.futureAction), 'Invalid action');
    const raw = render(f); validate(raw, f.width, f.height);
    assert.deepEqual(Object.keys(f.desiredInsets).sort(), [...edges].sort(), 'Missing insets');
    for (const edge of edges) assert.ok(Number.isSafeInteger(f.desiredInsets[edge]) && f.desiredInsets[edge] >= 0
      && f.desiredInsets[edge] <= Math.floor((['left', 'right'].includes(edge) ? f.width : f.height) * .03), 'Inset cap');
    const i = f.desiredInsets, b = f.knownContentBounds;
    assert.ok(b && [b.x, b.y, b.width, b.height].every(Number.isSafeInteger) && b.x >= 0 && b.y >= 0 && b.width > 0 && b.height > 0
      && b.x + b.width <= f.width && b.y + b.height <= f.height, 'Invalid protected bounds');
    assert.ok(i.left <= b.x && i.top <= b.y && f.width - i.right >= b.x + b.width && f.height - i.bottom >= b.y + b.height, 'Content loss');
    const trims = Object.values(i).some(Boolean);
    assert.equal(trims, f.safety === 'safe_to_trim', 'Safety/inset mismatch');
    if (trims) {
      assert.equal(f.expectedClass, 'decorative_frame', 'Only separated decorative controls may trim');
      assert.ok(f.width - i.left - i.right >= 160 && f.height - i.top - i.bottom >= 160
        && (f.width - i.left - i.right) * (f.height - i.top - i.bottom) >= 64000, 'Minimum crop');
      const pair = fixtures.find(v => v.id === f.pairedWith);
      assert.ok(pair && pair.safety !== 'safe_to_trim' && pair.width === f.width && pair.height === f.height, 'Missing preserve pair');
      assert.ok(!Buffer.from(raw).equals(Buffer.from(render(pair))), 'Positive and negative need a pixel signal');
    }
    const key = `${f.width}/${f.height}/${createHash('sha256').update(raw).digest('hex')}`;
    const expected = { classification: f.expectedClass, safety: f.safety, insets: f.desiredInsets };
    if (inputs.has(key)) assert.deepEqual(expected, inputs.get(key), 'Same pixels require same desired decision');
    inputs.set(key, expected);
  }
}
