import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { manualInsetsSchema, saveRequestSchema, derivationSchema, derivationProjectionSchema } from '../src/features/detail-extraction/schemas.ts';
import { manualCropRect, effectiveCropRect, validatedDerivedRect } from '../src/features/detail-extraction/crop-geometry.ts';
import { cropImage, decodeSource, sourceFingerprint } from '../src/features/detail-extraction/images.ts';
import { buildVisualAssetInventory, nearDuplicate, visualPromptAsset } from '../src/features/visual-assets/policy.ts';
import { assetRowSchema } from '../src/features/assets/schemas.ts';
import { assetRow, assetId, projectId, productId } from './helpers/asset-db.mjs';
import { separatedFrames, renderSeparatedFrame } from './fixtures/v0.2.1/separated-frames.mjs';

const zero = { left: 0, top: 0, right: 0, bottom: 0 };
const base = { x: 100, y: 200, width: 400, height: 300 }, dimensions = { width: 600, height: 3000 };
const insets = { left: 20, top: 10, right: 30, bottom: 40 };
const request = manualInsets => ({ schemaVersion: 2, expectedRevision: randomUUID(), items: [{ candidateId: 'a'.repeat(64), ...(manualInsets === undefined ? {} : { manualInsets }) }] });
const derivation = () => ({ schemaVersion: 2, kind: 'detail_image_crop', parentAssetId: assetId, candidateId: 'a'.repeat(64), sourceFingerprint: 'b'.repeat(64),
  sourceRect: { ...base }, sourceDimensions: { ...dimensions }, coordinateSpace: 'orientation_normalized_pixels', suggestedRole: 'product', confidence: .9,
  extractedAt: '2026-09-23T00:00:00.000Z', provider: 'openai', model: 'fixture', adjustment: { mode: 'manual', insets: { ...insets } } });
const code = expected => error => error.code === expected;

for (const [label, value] of [['absent', undefined], ['zero', zero], ['positive', insets]]) test(`V2 accepts ${label} override without conflating absence`, () => {
  const result = saveRequestSchema.parse(request(value));
  assert.equal(Object.hasOwn(result.items[0], 'manualInsets'), value !== undefined);
  if (value) assert.deepEqual(result.items[0].manualInsets, value);
});
for (const [label, value] of [['negative', -1], ['float', .5], ['NaN', NaN], ['Infinity', Infinity], ['negative infinity', -Infinity],
  ['string', '16'], ['null', null], ['oversized', 60001], ['unsafe integer', Number.MAX_SAFE_INTEGER + 1]]) test(`manual inset rejects ${label}`, () => {
  assert.equal(manualInsetsSchema.safeParse({ ...zero, left: value }).success, false);
  assert.equal(saveRequestSchema.safeParse(request({ ...zero, left: value })).success, false);
});
for (const edge of Object.keys(zero)) test(`manual requires ${edge}`, () => {
  const value = { ...zero }; delete value[edge]; assert.equal(manualInsetsSchema.safeParse(value).success, false);
});
for (const field of ['sourcePath', 'storageKey', 'sourceFingerprint', 'rect', 'parentAssetId', 'signedUrl', 'sourceDimensions']) test(`V2 refuses authority field ${field} at every level`, () => {
  const body = request(zero);
  assert.equal(saveRequestSchema.safeParse({ ...body, [field]: 'untrusted' }).success, false);
  assert.equal(saveRequestSchema.safeParse({ ...body, items: [{ ...body.items[0], [field]: 'untrusted' }] }).success, false);
  assert.equal(manualInsetsSchema.safeParse({ ...zero, [field]: 'untrusted' }).success, false);
});
test('V1 remains strict; no mixed-version downgrade or duplicate candidate variants', () => {
  const legacy = { candidateIds: ['a'.repeat(64)] };
  assert.ok(saveRequestSchema.safeParse(legacy).success);
  for (const body of [{ ...legacy, manualInsets: zero }, { ...legacy, ...request(zero) }, { ...request(zero), expectedRevision: 'bad' },
    { ...request(zero), schemaVersion: 3 }, { ...request(zero), items: [] }, { ...request(zero), items: [...request(zero).items, ...request(insets).items] }])
    assert.equal(saveRequestSchema.safeParse(body).success, false);
});
test('largest V2 body of 24 bounded items fits existing 8KiB limit', () => {
  const body = request(zero); body.items = Array.from({ length: 24 }, (_, i) => ({ candidateId: i.toString(16).padStart(64, '0'), manualInsets: { left: 60000, top: 60000, right: 60000, bottom: 60000 } }));
  assert.ok(saveRequestSchema.safeParse(body).success); assert.ok(Buffer.byteLength(JSON.stringify(body)) <= 8192);
  body.items.push({ ...body.items[0], candidateId: 'f'.repeat(64) }); assert.equal(saveRequestSchema.safeParse(body).success, false);
});
test('Sharp half-open rect math: x100 y200 w400 h300 + L20 T10 R30 B40', () => {
  assert.deepEqual(manualCropRect(base, dimensions, insets), { x: 120, y: 210, width: 350, height: 250 });
  assert.deepEqual(manualCropRect(base, dimensions, zero), base);
});
for (const value of [{ ...zero, left: 401 }, { ...zero, left: 200, right: 200 }, { ...zero, bottom: 300 }, { ...zero, top: 301 }])
  test(`inward rejects empty/inverted rect ${JSON.stringify(value)}`, () => assert.throws(() => manualCropRect(base, dimensions, value), code('invalid_rect')));
for (const value of [{ ...zero, left: 241 }, { ...zero, top: 141 }, { ...zero, left: 200 }])
  test(`minimum width/height/area ${JSON.stringify(value)}`, () => assert.throws(() => manualCropRect(base, dimensions, value), code('crop_too_small')));
test('minimum is inclusive and manual may exceed 3 percent', () => {
  assert.deepEqual(manualCropRect({ x: 0, y: 0, width: 400, height: 500 }, dimensions, { ...zero, right: 240, bottom: 100 }), { x: 0, y: 0, width: 160, height: 400 });
  assert.equal(manualCropRect(base, dimensions, { ...zero, bottom: 26 }).height, 274);
});
for (const rect of [{ ...base, x: -1 }, { ...base, x: 201 }, { ...base, y: 2800 }, { ...base, width: .5 }])
  test(`invalid canonical base cannot be repaired by inward crop ${JSON.stringify(rect)}`, () => assert.throws(() => manualCropRect(rect, dimensions, insets), code('invalid_rect')));

test('manual path including zero invokes auto trim zero times (isolated module instrumentation)', () => {
  const script = `import {registerHooks} from 'node:module';
    registerHooks({load(url,context,next){if(url.endsWith('/edge-trim.ts')) return {format:'module',shortCircuit:true,source:'export async function trimCrop(){globalThis.trimCalls=(globalThis.trimCalls??0)+1;throw new Error("called auto");}'};return next(url,context);}});
    const {planCrop}=await import('./src/features/detail-extraction/images.ts');
    const sharp=(await import('sharp')).default;const bytes=await sharp({create:{width:400,height:400,channels:3,background:'white'}}).png().toBuffer();
    const image={bytes,mime:'image/png',dimensions:{width:400,height:400},orientation:1,fingerprint:'a'.repeat(64)},base={x:0,y:0,width:400,height:400};
    await planCrop(image,base,{left:0,top:0,right:0,bottom:0});await planCrop(image,base,{left:16,top:16,right:16,bottom:16});
    if((globalThis.trimCalls??0)!==0)throw new Error('manual called auto');
    try{await planCrop(image,base);}catch{}if(globalThis.trimCalls!==1)throw new Error('automatic bypassed detector');`;
  execFileSync(process.execPath, ['--conditions=react-server', '--import', './tests/register.mjs', '--input-type=module', '-e', script], { stdio: 'pipe' });
});
test('A2 automatic regression versus explicit zero/manual exact PNG pixels', async () => {
  const f = separatedFrames[0], { bytes, mime } = await renderSeparatedFrame(f);
  const image = { bytes, mime, dimensions: { width: f.width, height: f.height }, orientation: 1, fingerprint: sourceFingerprint(bytes) };
  const rect = { x: 0, y: 0, ...image.dimensions }, auto = await cropImage(image, rect);
  assert.deepEqual(auto.trim.insets, f.referenceInsets); assert.equal(auto.trim.policyVersion, 2);
  for (const insets of [zero, { ...zero, left: 20, top: 10, bottom: 26 }]) {
    const final = manualCropRect(rect, image.dimensions, insets), output = await cropImage(image, rect, insets);
    assert.equal(output.trim, undefined); assert.deepEqual([output.width, output.height], [final.width, final.height]);
    assert.deepEqual(await sharp(output.bytes).ensureAlpha().raw().toBuffer(), await sharp(bytes).extract({ left: final.x, top: final.y, width: final.width, height: final.height }).ensureAlpha().raw().toBuffer());
  }
});
for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8]) test(`EXIF ${orientation} manual rect uses normalized pixels and current JPEG encoding`, async () => {
  const rotated = orientation >= 5, width = rotated ? 2400 : 400, height = rotated ? 400 : 2400;
  const patch = await sharp({ create: { width: 180, height: 180, channels: 3, background: '#c32847' } }).png().toBuffer();
  const bytes = await sharp({ create: { width, height, channels: 3, background: '#abc987' } }).composite([{ input: patch, left: 10, top: 30 }]).withMetadata({ orientation }).jpeg({ quality: 95 }).toBuffer();
  const image = await decodeSource(bytes, 'image/jpeg'); assert.deepEqual(image.dimensions, { width: 400, height: 2400 });
  const rect = { x: 0, y: 0, width: 400, height: 600 }, insets = { ...zero, left: 16, bottom: 26 };
  const output = await cropImage(image, rect, insets), final = manualCropRect(rect, image.dimensions, insets);
  const reference = await sharp(bytes).rotate().png().toBuffer();
  const encoded = await sharp(reference).extract({ left: final.x, top: final.y, width: final.width, height: final.height }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
  assert.deepEqual(output.bytes, encoded); assert.equal(output.trim, undefined);
});
test('WebP manual encoding retains current quality policy', async () => {
  const bytes = await sharp({ create: { width: 600, height: 3000, channels: 3, background: '#5b907a' } }).webp({ quality: 95 }).toBuffer();
  const image = await decodeSource(bytes, 'image/webp'), output = await cropImage(image, base, insets), final = manualCropRect(base, dimensions, insets);
  const expected = await sharp(image.bytes).extract({ left: final.x, top: final.y, width: final.width, height: final.height }).webp({ quality: 95 }).toBuffer();
  assert.deepEqual(output.bytes, expected);
});
test('manual provenance is bounded, strict, readable and reconstructs final geometry', () => {
  const d = derivationSchema.parse(derivation()); assert.deepEqual(effectiveCropRect(d), { x: 120, y: 210, width: 350, height: 250 });
  assert.deepEqual(validatedDerivedRect(d, { width: 350, height: 250 }), effectiveCropRect(d));
  assert.equal(validatedDerivedRect(d, { width: 400, height: 300 }), null);
  assert.ok(Buffer.byteLength(JSON.stringify(d)) < 1024);
  for (const patch of [{ history: [] }, { trim: { policyVersion: 2, insets: zero, postTrimDimensions: dimensions } }, { finalRect: base }, { schemaVersion: 3 }])
    assert.equal(derivationSchema.safeParse({ ...d, ...patch }).success, false);
});
for (const version of [null, 1, 2]) test(`legacy auto provenance ${version ?? 'no trim'} remains readable without rewrite`, () => {
  const d = derivation(); delete d.adjustment; d.schemaVersion = 1;
  if (version) d.trim = { policyVersion: version, insets: { left: 6, right: 6, top: 6, bottom: 6 }, postTrimDimensions: { width: 388, height: 288 } };
  const before = structuredClone(d); assert.deepEqual(derivationSchema.parse(d), before);
  assert.ok(validatedDerivedRect(d, version ? { width: 388, height: 288 } : base));
  assert.equal(derivationSchema.safeParse({ ...d, adjustment: derivation().adjustment }).success, false);
});
test('manual visual inventory accepts >3 percent, uses final rect, excludes provenance from prompt', () => {
  const id = randomUUID(), d = derivation(), asset = assetRowSchema.parse(assetRow({ id, width: 350, height: 250, metadata: { derivation: d } }));
  const item = buildVisualAssetInventory([asset], projectId, productId)[0]; assert.equal(item.visual.kind, 'derived'); assert.equal(item.visual.available, true);
  assert.ok(derivationProjectionSchema.safeParse(item.visual.derivation).success);
  assert.doesNotMatch(JSON.stringify(visualPromptAsset(item)), /adjustment|insets|sourceRect|sourceFingerprint/);
  const other = structuredClone(item); other.visual.derivation.adjustment.insets.left = 200;
  assert.equal(nearDuplicate(item, other), false);
  asset.metadata.derivation.adjustment.insets.left = 400;
  assert.equal(buildVisualAssetInventory([asset], projectId, productId)[0].visual.kind, 'unusable');
});
