import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { analyzeCropEdges, analyzeCropEdge } from '../src/features/detail-extraction/frame-analysis.ts';
import { detectTrim, trimCrop } from '../src/features/detail-extraction/edge-trim.ts';
import { cropImage, sourceFingerprint } from '../src/features/detail-extraction/images.ts';
import { derivationSchema } from '../src/features/detail-extraction/schemas.ts';
import { buildVisualAssetInventory } from '../src/features/visual-assets/policy.ts';
import { assetRowSchema } from '../src/features/assets/schemas.ts';
import { assetRow, projectId, productId } from './helpers/page-planner.mjs';
import { EDGES, zeroInsets, boundaryCases } from './fixtures/v0.2.1/image-boundaries.mjs';
import { separatedFrames, renderSeparatedFrame } from './fixtures/v0.2.1/separated-frames.mjs';
import { renderBoundaryFixture, hasContentLoss, validateBoundaryCorpus } from './helpers/image-boundary-contracts.mjs';

const all = n => Object.fromEntries(EDGES.map(edge => [edge, n]));
const png = (raw, width, height) => sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
const sized = (width, height, border) => ({ ...separatedFrames[0], width, height, border, referenceInsets: all(border),
  knownContentBounds: { x: border, y: border, width: width - 2 * border, height: height - 2 * border } });

test('A2 corpus validates without replacing the 22 original semantic fixtures', () => {
  validateBoundaryCorpus([...boundaryCases, ...separatedFrames]);
  assert.equal(boundaryCases.length, 22); assert.equal(separatedFrames.length, 8);
});
for (const f of separatedFrames) test(`${f.caseId}: separator-backed trim, actual crop, retained pixels and immutable source`, async () => {
  const { raw, bytes, mime } = await renderSeparatedFrame(f), sourceBefore = Buffer.from(bytes), rawBefore = Buffer.from(raw);
  const decisions = analyzeCropEdges(raw, f.width, f.height), insets = detectTrim(raw, f.width, f.height);
  assert.deepEqual(insets, f.referenceInsets);
  assert.deepEqual(analyzeCropEdges(Buffer.from(raw), f.width, f.height), decisions);
  assert.equal(hasContentLoss(f, insets), false);
  assert.deepEqual(raw, rawBefore);
  for (const edge of EDGES) if (insets[edge]) {
    assert.equal(decisions[edge].contentRisk, 'safe'); assert.equal(decisions[edge].frameConfidence, 1);
    assert.equal(decisions[edge].reason, 'confirmed_frame');
  }
  const image = { bytes, mime, dimensions: { width: f.width, height: f.height }, orientation: 1, fingerprint: sourceFingerprint(bytes) };
  const rect = { x: 0, y: 0, ...image.dimensions }, originalRect = { ...rect };
  const result = await cropImage(image, rect), width = f.width - insets.left - insets.right, height = f.height - insets.top - insets.bottom;
  assert.deepEqual(result.trim, { policyVersion: 2, insets, postTrimDimensions: { width, height } });
  assert.equal(result.mime, mime);
  const decoded = await sharp(result.bytes).metadata();
  assert.deepEqual([decoded.width, decoded.height, decoded.format], [width, height, f.format]);
  const extract = sharp(bytes).extract({ left: insets.left, top: insets.top, width, height });
  const reference = await (f.format === 'jpeg' ? extract.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }) : extract.png()).toBuffer();
  assert.deepEqual(await sharp(result.bytes).ensureAlpha().raw().toBuffer(), await sharp(reference).ensureAlpha().raw().toBuffer());
  assert.deepEqual(bytes, sourceBefore); assert.deepEqual(rect, originalRect);
});

for (const prefix of ['M1', 'M4']) test(`${prefix} identical A/H pixels and config yield identical ambiguous preservation`, async () => {
  const a = boundaryCases.find(f => f.caseId === `${prefix}-A`), h = boundaryCases.find(f => f.caseId === `${prefix}-H`);
  const first = await renderBoundaryFixture(a), second = await renderBoundaryFixture(h);
  assert.deepEqual(first.bytes, second.bytes); assert.deepEqual(first.raw, second.raw);
  const decisions = analyzeCropEdges(first.raw, a.width, a.height);
  assert.deepEqual(decisions, analyzeCropEdges(second.raw, h.width, h.height));
  for (const decision of Object.values(decisions)) {
    assert.equal(decision.trimPixels, 0); assert.equal(decision.contentRisk, 'ambiguous');
  }
  assert.equal(hasContentLoss(h, detectTrim(second.raw, h.width, h.height)), false);
});

for (const [name, color] of [['single dark pixel', [0, 0, 0, 255]], ['skin-colored pocket', [210, 150, 120, 255]],
  ['near-transparent detail', [255, 255, 255, 1]], ['partial alpha', [255, 255, 255, 254]]]) {
  test(`high confidence on other edges cannot override ${name} inside the left band`, async () => {
    const f = separatedFrames[0], { raw } = await renderSeparatedFrame(f);
    raw.set(color, (250 * f.width + 5) * 4);
    const decision = analyzeCropEdges(raw, f.width, f.height);
    assert.equal(decision.left.trimPixels, 0);
    assert.notEqual(decision.left.contentRisk, 'safe');
    assert.equal(decision.right.trimPixels, 16, 'Edges decide independently');
  });
}
test('narrow text strokes at the outer edge remain even with a valid inner separator', async () => {
  const f = separatedFrames[3], { raw } = await renderSeparatedFrame(f);
  for (let y = 280; y < 300; y++) raw.set([10, 10, 10, 255], (y * f.width) * 4);
  assert.equal(analyzeCropEdge(raw, f.width, f.height, 'left').contentRisk, 'detail');
});
test('smooth band gradient is not accepted merely because each line is uniform', async () => {
  const f = separatedFrames.find(f => f.caseId === 'M4-E2'), { raw } = await renderSeparatedFrame(f);
  for (let y = 0; y < f.border; y++) for (let x = 0; x < f.width; x++) raw.set([220 - y * 2, 200 - y * 2, 170 - y * 2, 255], (y * f.width + x) * 4);
  assert.equal(detectTrim(raw, f.width, f.height).top, 0);
});
test('a separator with a flat interior remains ambiguous', async () => {
  const f = separatedFrames[0], { raw } = await renderSeparatedFrame(f), start = f.border + f.separatorWidth;
  for (let y = start; y < f.height - start; y++) for (let x = start; x < f.width - start; x++) raw.set([95, 105, 115, 255], (y * f.width + x) * 4);
  assert.deepEqual(detectTrim(raw, f.width, f.height), zeroInsets);
});
test('dark product-colored edges stay even when an artificial separator is present', async () => {
  const f = { ...separatedFrames[0], color: [15, 15, 15, 255] }, { raw } = await renderSeparatedFrame(f);
  assert.deepEqual(detectTrim(raw, f.width, f.height), zeroInsets);
});
for (const width of [1, 4]) test(`${width}px separator is ${width === 1 ? 'supported and retained' : 'too broad and preserved'}`, async () => {
  const f = { ...separatedFrames[0], separatorWidth: width }, { raw } = await renderSeparatedFrame(f);
  assert.deepEqual(detectTrim(raw, f.width, f.height), width === 1 ? f.referenceInsets : zeroInsets);
});
for (const border of [1, 19, 20]) test(`640px crop ${border}px band respects minimum and floor(3%)`, async () => {
  const f = sized(640, 640, border), { raw } = await renderSeparatedFrame(f);
  assert.deepEqual(detectTrim(raw, f.width, f.height), border === 19 ? all(19) : zeroInsets);
});
test('three-percent cap uses each edge axis on a nonsquare image', async () => {
  const top = { ...sized(400, 800, 16), scene: 'top-band', referenceInsets: { ...zeroInsets, top: 16 } };
  assert.deepEqual(detectTrim((await renderSeparatedFrame(top)).raw, top.width, top.height), top.referenceInsets);
  const sides = { ...top, scene: 'sides', referenceInsets: { ...zeroInsets, left: 16, right: 16 } };
  assert.deepEqual(detectTrim((await renderSeparatedFrame(sides)).raw, sides.width, sides.height), zeroInsets);
});
for (const [angle, edge] of [[90, 'right'], [180, 'bottom'], [270, 'left']]) {
  test(`single-sided colored frame rotated ${angle} degrees only trims ${edge}`, async () => {
    const f = separatedFrames.find(f => f.caseId === 'M4-E2'), { bytes } = await renderSeparatedFrame(f);
    const { data, info } = await sharp(bytes).rotate(angle).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual(detectTrim(data, info.width, info.height), { ...zeroInsets, [edge]: 12 });
  });
}
for (const [width, height, border] of [[160, 500, 4], [260, 260, 7], [300, 300, 8]]) {
  test(`actual crop minimum safeguards ${width}x${height} with ${border}px recommendation`, async () => {
    const f = sized(width, height, border), { bytes, raw } = await renderSeparatedFrame(f);
    assert.deepEqual(detectTrim(raw, width, height), all(border));
    const trim = await trimCrop(bytes, width, height), permitted = width === 300;
    assert.equal(trim.applied, permitted);
    assert.deepEqual(trim.insets, permitted ? all(border) : zeroInsets);
    assert.ok(trim.width > 0 && trim.height > 0);
  });
}
test('invalid raw dimensions, mismatched decode and malformed image cannot produce a crop', async () => {
  const { bytes, raw } = await renderSeparatedFrame(separatedFrames[0]);
  for (const [data, width, height] of [[raw, -1, 640], [raw, 640.5, 640], [raw, 640, 639], [raw, 0, 0], [raw, 10000, 10000], [raw.subarray(4), 640, 640]]) {
    assert.deepEqual(detectTrim(data, width, height), zeroInsets);
  }
  await assert.rejects(trimCrop(bytes, 639, 640), /dimensions mismatch/);
  await assert.rejects(trimCrop(Buffer.from('not an image'), 640, 640));
});
test('invisible RGB in alpha-zero bands is ignored, alpha-one detail is preserved', async () => {
  const f = boundaryCases.find(f => f.caseId === 'M1-C'), { raw } = await renderBoundaryFixture(f);
  raw.set([255, 5, 195, 0], 0);
  assert.deepEqual(detectTrim(raw, f.width, f.height), all(16));
  raw.set([255, 5, 195, 1], 0);
  const result = detectTrim(raw, f.width, f.height);
  assert.equal(result.top, 0); assert.equal(result.left, 0);
  const bytes = await png(raw, f.width, f.height);
  assert.equal((await trimCrop(bytes, f.width, f.height)).insets.left, 0);
});
for (const version of [undefined, 1, 2]) test(`legacy derivation with trim version ${version ?? 'absent'} reads without mutation`, () => {
  const dimensions = version ? 608 : 640;
  const derivation = derivationSchema.parse({ schemaVersion: 1, kind: 'detail_image_crop', parentAssetId: randomUUID(),
    sourceFingerprint: 'a'.repeat(64), candidateId: 'b'.repeat(64), sourceRect: { x: 0, y: 0, width: 640, height: 640 },
    sourceDimensions: { width: 640, height: 4000 }, coordinateSpace: 'orientation_normalized_pixels', suggestedRole: 'product',
    confidence: .9, extractedAt: '2026-09-22T00:00:00Z', provider: 'openai', model: 'mock',
    ...(version ? { trim: { policyVersion: version, insets: all(16), postTrimDimensions: { width: dimensions, height: dimensions } } } : {}) });
  const asset = assetRowSchema.parse(assetRow({ width: dimensions, height: dimensions, metadata: { derivation } })), before = structuredClone(asset);
  assert.equal(buildVisualAssetInventory([asset], projectId, productId)[0].visual.kind, 'derived');
  assert.deepEqual(asset, before);
  if (version) assert.equal(derivationSchema.safeParse({ ...derivation, trim: { ...derivation.trim, policyVersion: 3 } }).success, false);
});
