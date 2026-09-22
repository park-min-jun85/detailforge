// Test-only geometry oracle and synthetic rasterizer, not a proposed detector.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { EDGES } from '../fixtures/v0.2.1/image-boundaries.mjs';

export function contains(outer, inner) {
  return outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width
    && outer.y + outer.height >= inner.y + inner.height;
}
export function trimmedRect(fixture, insets) {
  return { x: insets.left, y: insets.top, width: fixture.width - insets.left - insets.right,
    height: fixture.height - insets.top - insets.bottom };
}
export const hasContentLoss = (fixture, insets) => !contains(trimmedRect(fixture, insets), fixture.knownContentBounds);
const classes = { M1: ['safe_trim', 'ambiguous', 'unsafe_content_loss', 'no_trim_needed'],
  M4: ['uniform_frame', 'near_uniform_frame', 'background_like', 'content_like', 'ambiguous'] };
const scenes = ['frame', 'noise', 'left-product', 'top-product', 'label', 'person', 'vertical-panels',
  'horizontal-panels', 'sides', 'top-band', 'similar', 'wall', 'icon-frame', 'gradient'];
export function validateBoundaryCorpus(fixtures) {
  assert.ok(Array.isArray(fixtures) && fixtures.length > 0, 'Empty corpus');
  const ids = new Set();
  for (const f of fixtures) {
    assert.match(f.caseId, /^M[14]-[A-Z]$/);
    assert.ok(!ids.has(f.caseId), 'Duplicate caseId'); ids.add(f.caseId);
    assert.ok(typeof f.description === 'string' && f.description.trim(), 'Missing description');
    assert.ok(classes[f.caseId.slice(0, 2)].includes(f.expectedClass), 'Missing/invalid expectation');
    assert.ok(scenes.includes(f.scene) && ['png', 'jpeg'].includes(f.format), 'Invalid recipe');
    assert.ok([f.width, f.height].every(n => Number.isSafeInteger(n) && n >= 160 && n <= 2048)
      && f.width * f.height <= 4_000_000, 'Fixture size overflow');
    assert.ok(Number.isSafeInteger(f.border) && f.border >= 0 && f.border <= Math.min(f.width, f.height) / 2, 'Invalid border');
    assert.ok(Array.isArray(f.color) && f.color.length === 4 && f.color.every(n => Number.isInteger(n) && n >= 0 && n <= 255), 'Invalid RGBA');
    const b = f.knownContentBounds;
    assert.ok(b && [b.x, b.y, b.width, b.height].every(Number.isSafeInteger)
      && b.x >= 0 && b.y >= 0 && b.width > 0 && b.height > 0
      && contains({ x: 0, y: 0, width: f.width, height: f.height }, b), 'Invalid content bounds');
    for (const edges of [f.expectedAllowedEdges, f.expectedForbiddenEdges]) {
      assert.ok(Array.isArray(edges) && edges.every(e => EDGES.includes(e)) && new Set(edges).size === edges.length, 'Invalid edges');
    }
    assert.deepEqual([...f.expectedAllowedEdges, ...f.expectedForbiddenEdges].sort(), [...EDGES].sort(), 'Edge partition');
    for (const insets of [f.referenceInsets, f.currentInsets]) {
      assert.deepEqual(Object.keys(insets ?? {}).sort(), [...EDGES].sort(), 'Missing insets');
      for (const edge of EDGES) assert.ok(Number.isSafeInteger(insets[edge]) && insets[edge] >= 0
        && insets[edge] <= Math.floor((['left', 'right'].includes(edge) ? f.width : f.height) * .03), 'Inset cap');
    }
    assert.equal(typeof f.currentContentLoss, 'boolean', 'Missing current loss expectation');
    for (const edge of f.expectedForbiddenEdges) assert.equal(f.referenceInsets[edge], 0, 'Forbidden reference trim');
    assert.equal(hasContentLoss(f, f.referenceInsets), false, 'Unsafe reference');
    assert.equal(hasContentLoss(f, f.currentInsets), f.currentContentLoss, 'Inconsistent characterization');
  }
  return fixtures;
}

export async function renderBoundaryFixture(f) {
  const raw = Buffer.alloc(f.width * f.height * 4);
  const paint = (x, y, width, height, rgba) => {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) raw.set(rgba, (yy * f.width + xx) * 4);
  };
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
    const outer = f.scene === 'sides' ? x < f.border || x >= f.width - f.border
      : f.scene === 'top-band' ? y < f.border
      : x < f.border || y < f.border || x >= f.width - f.border || y >= f.height - f.border;
    let color = outer ? f.color : [70 + x % 17, 90 + y % 19, 115, 255];
    if (outer && f.scene === 'noise') {
      const delta = (Math.floor(x / 2) + y) % 3 - 1;
      color = f.color.map((value, i) => i === 3 ? value : value + delta);
    }
    if (f.scene === 'similar') color = outer ? f.color : [216, 197, 168, 255];
    if (f.scene === 'wall') color = f.color;
    if (f.scene === 'gradient') color = [180 + Math.floor(x / 16), 165 + Math.floor(y / 32), 140, 255];
    raw.set(color, (y * f.width + x) * 4);
  }
  if (f.scene === 'left-product') paint(0, 150, 110, 250, [100, 135, 165, 255]);
  if (f.scene === 'top-product') paint(180, 0, 260, 120, [100, 135, 165, 255]);
  if (f.scene === 'label' || f.scene === 'icon-frame') {
    // Tiny block glyphs: meaningful edge pixels even when no OCR can identify text.
    paint(0, 250, 8, 3, [25, 25, 25, 255]); paint(3, 250, 3, 24, [25, 25, 25, 255]);
  }
  if (f.scene === 'person') {
    paint(260, 0, 100, 100, [205, 155, 120, 255]);
    paint(240, 90, 140, 300, [125, 75, 65, 255]);
    paint(0, 210, 250, 35, [205, 155, 120, 255]);
  }
  if (f.scene === 'vertical-panels') paint(314, 0, 12, 640, [255, 255, 255, 255]);
  if (f.scene === 'horizontal-panels') paint(0, 314, 640, 12, [255, 255, 255, 255]);
  if (f.scene === 'wall') paint(220, 150, 200, 400, [95, 65, 45, 255]);
  const encoder = sharp(raw, { raw: { width: f.width, height: f.height, channels: 4 } });
  const bytes = await (f.format === 'jpeg' ? encoder.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }) : encoder.png()).toBuffer();
  // All characterization uses decoded pixels, including actual JPEG artifacts.
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer();
  return { raw: decoded, bytes, mime: `image/${f.format}` };
}
