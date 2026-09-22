import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { boundaryCases, m1Cases, m4Cases, EDGES, zeroInsets } from './fixtures/v0.2.1/image-boundaries.mjs';
import { validateBoundaryCorpus, renderBoundaryFixture, trimmedRect, contains, hasContentLoss } from './helpers/image-boundary-contracts.mjs';
import { detectTrim, trimCrop } from '../src/features/detail-extraction/edge-trim.ts';
import { cropImage, sourceFingerprint } from '../src/features/detail-extraction/images.ts';
import { MAX_TRIM_FRACTION, OUTPUT_QUALITY } from '../src/features/detail-extraction/policy.ts';
import { currentBoundaryInsets, separatedFrames, renderSeparatedFrame } from './fixtures/v0.2.1/separated-frames.mjs';

test('boundary corpus freezes 12 M1 and 10 M4 cases and every contract class', () => {
  validateBoundaryCorpus(boundaryCases);
  assert.deepEqual(m1Cases.map(f => f.caseId), [...'ABCDEFGHIJKL'].map(id => `M1-${id}`));
  assert.deepEqual(m4Cases.map(f => f.caseId), [...'ABCDEFGHIJ'].map(id => `M4-${id}`));
  assert.equal(new Set(m1Cases.map(f => f.expectedClass)).size, 4);
  assert.equal(new Set(m4Cases.map(f => f.expectedClass)).size, 5);
});

for (const f of boundaryCases) {
  test(`${f.caseId} desired contract: ${f.expectedClass}; reference preserves meaningful bounds`, () => {
    // This checks the authored oracle, never claims the production detector implements it.
    assert.equal(hasContentLoss(f, f.referenceInsets), false);
    for (const edge of f.expectedForbiddenEdges) assert.equal(f.referenceInsets[edge], 0);
    for (const edge of EDGES) {
      const overcut = { ...zeroInsets, [edge]: 0 };
      const b = f.knownContentBounds;
      overcut[edge] = ({ left: b.x, top: b.y, right: f.width - b.x - b.width, bottom: f.height - b.y - b.height })[edge] + 1;
      assert.equal(hasContentLoss(f, overcut), true, `Oracle must catch a one-pixel ${edge} content cut`);
    }
  });
  test(`${f.caseId} current characterization: ${f.description}`, async () => {
    const { raw, bytes, mime } = await renderBoundaryFixture(f);
    const original = Buffer.from(bytes), pixels = Buffer.from(raw), fingerprint = sourceFingerprint(bytes);
    const actual = detectTrim(raw, f.width, f.height);
    assert.deepEqual(actual, currentBoundaryInsets(f));
    assert.deepEqual(raw, pixels, 'Detector must not mutate pixels');
    assert.equal(hasContentLoss(f, actual), false, 'Revised safety-first contract');
    const trim = await trimCrop(bytes, f.width, f.height);
    assert.deepEqual(trim.insets, actual);
    const image = { bytes, mime, fingerprint, orientation: 1, dimensions: { width: f.width, height: f.height } };
    const rect = { x: 0, y: 0, width: f.width, height: f.height }, beforeRect = { ...rect };
    const output = await cropImage(image, rect), expectedRect = trimmedRect(f, actual);
    assert.deepEqual(output.trim?.insets ?? zeroInsets, actual);
    assert.equal(output.mime, mime);
    const metadata = await sharp(output.bytes).metadata();
    assert.equal(metadata.format, f.format);
    assert.deepEqual([metadata.width, metadata.height], [expectedRect.width, expectedRect.height]);
    assert.deepEqual([output.width, output.height], [metadata.width, metadata.height]);
    if (output.trim) {
      assert.equal(output.trim.policyVersion, 2);
      assert.deepEqual(output.trim.postTrimDimensions, { width: output.width, height: output.height });
    }
    assert.equal(MAX_TRIM_FRACTION, .03);
    for (const edge of EDGES) assert.ok(actual[edge] <= Math.floor((['left', 'right'].includes(edge) ? f.width : f.height) * MAX_TRIM_FRACTION));
    const extracted = sharp(bytes).extract({ left: expectedRect.x, top: expectedRect.y, width: expectedRect.width, height: expectedRect.height });
    // JPEG is intentionally lossy: compare with the existing encoder, not pre-encode pixels.
    const expectedBytes = await (f.format === 'jpeg'
      ? extracted.jpeg({ quality: OUTPUT_QUALITY, chromaSubsampling: '4:4:4' }) : extracted.png()).toBuffer();
    assert.deepEqual(await sharp(output.bytes).ensureAlpha().raw().toBuffer(), await sharp(expectedBytes).ensureAlpha().raw().toBuffer());
    assert.deepEqual(bytes, original);
    assert.equal(sourceFingerprint(bytes), fingerprint);
    assert.deepEqual(rect, beforeRect);
    assert.deepEqual(image.dimensions, { width: f.width, height: f.height });
  });
}

test('identical white-frame/fabric pixels retain the historical unsafe baseline as evidence', async () => {
  const safe = m1Cases.find(f => f.caseId === 'M1-A'), ambiguous = m1Cases.find(f => f.caseId === 'M1-H');
  assert.deepEqual((await renderBoundaryFixture(safe)).bytes, (await renderBoundaryFixture(ambiguous)).bytes);
  assert.equal(hasContentLoss(safe, safe.currentInsets), false);
  assert.equal(hasContentLoss(ambiguous, ambiguous.currentInsets), true);
  assert.notDeepEqual(safe.referenceInsets, ambiguous.referenceInsets);
});

test('identical colored frame/product edge pixels forbid treating uniformity as semantic proof', async () => {
  const frame = m4Cases.find(f => f.caseId === 'M4-A'), product = m4Cases.find(f => f.caseId === 'M4-H');
  assert.deepEqual((await renderBoundaryFixture(frame)).bytes, (await renderBoundaryFixture(product)).bytes);
  assert.equal(hasContentLoss(frame, frame.referenceInsets), false);
  assert.equal(hasContentLoss(product, frame.referenceInsets), true);
});

test('crop offset composes into source coordinates without rewriting candidate rect or source bytes', async () => {
  const f = separatedFrames[0], { bytes } = await renderSeparatedFrame(f);
  const source = await sharp({ create: { width: 768, height: 800, channels: 4, background: '#587088' } })
    .composite([{ input: bytes, left: 32, top: 64 }]).png().toBuffer();
  const fingerprint = sourceFingerprint(source), rect = { x: 32, y: 64, width: 640, height: 640 }, before = { ...rect };
  const result = await cropImage({ bytes: source, mime: 'image/png', fingerprint, orientation: 1, dimensions: { width: 768, height: 800 } }, rect);
  const sourceTrimmed = { x: rect.x + result.trim.insets.left, y: rect.y + result.trim.insets.top, width: result.width, height: result.height };
  assert.deepEqual(sourceTrimmed, { x: 48, y: 80, width: 608, height: 608 });
  assert.ok(contains(sourceTrimmed, { ...f.knownContentBounds, x: rect.x + f.knownContentBounds.x, y: rect.y + f.knownContentBounds.y }));
  assert.deepEqual(rect, before); assert.equal(sourceFingerprint(source), fingerprint);
});

const invalid = [
  ['duplicate IDs', cases => cases.push(structuredClone(cases[0]))],
  ['missing expectation', cases => delete cases[0].expectedClass],
  ['unknown expectation', cases => { cases[0].expectedClass = 'probably_safe'; }],
  ['negative bounds', cases => { cases[0].knownContentBounds.x = -1; }],
  ['fractional bounds', cases => { cases[0].knownContentBounds.width = 1.5; }],
  ['overflowing bounds', cases => { cases[0].knownContentBounds.width = 641; }],
  ['empty bounds', cases => { cases[0].knownContentBounds.height = 0; }],
  ['size overflow', cases => { cases[0].width = 100000; }],
  ['conflicting edges', cases => { cases[0].expectedForbiddenEdges = ['left']; }],
  ['missing current expectation', cases => delete cases[0].currentInsets],
  ['trim beyond three percent', cases => { cases[0].currentInsets.left = 20; }],
  ['unsafe desired rectangle', cases => { cases[0].referenceInsets.left = 17; }],
  ['unrecorded content loss', cases => { cases[7].currentContentLoss = false; }],
];
for (const [description, mutate] of invalid) test(`boundary fixture validator rejects ${description}`, () => {
  const fixtures = structuredClone(boundaryCases); mutate(fixtures);
  assert.throws(() => validateBoundaryCorpus(fixtures));
});
