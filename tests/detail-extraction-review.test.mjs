import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { retryFeedback, reconcileSelection, selectedCandidateIds } from '../src/features/detail-extraction/review-model.ts';
import { publicExtractionResponse } from '../src/features/detail-extraction/public-response.ts';
import { getExtractionReview } from '../src/features/detail-extraction/review.ts';
import { GET } from '../src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/route.ts';
import { startAssetDb, assetRow, projectId, assetId } from './helpers/asset-db.mjs';
import { buildCheckpointInput, createCheckpoint, recordTileCheckpoint, completedTileCheckpoint, failedTileCheckpoint } from '../src/features/detail-extraction/checkpoint.ts';
import { aggregateCheckpoint } from '../src/features/detail-extraction/retry.ts';
import { decodeSource, imageTiles } from '../src/features/detail-extraction/images.ts';
import { buildExtractionProductContext, productContextFingerprint } from '../src/features/detail-extraction/product-context.ts';
import { getExtractionModel, EXTRACTION_PROMPT, RELEVANCE_PROMPT } from '../src/features/detail-extraction/provider.ts';
import { region, failures } from './fixtures/v0.2/m2-tile-recovery.mjs';

const c = (id, defaultSelected = true, saveAllowed = true) => ({ id, defaultSelected, saveAllowed });
test('S1 explicit unchecked survives refreshed default true', () => assert.deepEqual(reconcileSelection({ A: false }, [c('A')]), { A: false }));
test('S2 explicit checked survives default false', () => assert.deepEqual(reconcileSelection({ C: true }, [c('C', false)]), { C: true }));
test('S3 new IDs use their own defaults', () => assert.deepEqual(reconcileSelection({ A: false }, [c('A'), c('N'), c('M', false)]), { A: false, N: true, M: false }));
test('S4 removed IDs are pruned and never sent to save', () => {
  const next = reconcileSelection({ A: true, removed: true }, [c('A')]);
  assert.deepEqual(next, { A: true }); assert.deepEqual(selectedCandidateIds({ ...next, removed: true }, [c('A')], []), ['A']);
});
test('S5 reorder follows stable IDs, not indices', () => assert.deepEqual(reconcileSelection({ A: false, B: true }, [c('B', false), c('A')]), { B: true, A: false }));
test('S6 repeated refresh preserves both values without mutating previous state', () => {
  const before = Object.freeze({ A: false, B: true });
  assert.deepEqual(reconcileSelection(reconcileSelection(before, [c('A'), c('B')]), [c('B'), c('A')]), before);
});
test('S7 save filters blocked/saved candidates and retains explicitly checked default exclusions', () => {
  assert.deepEqual(selectedCandidateIds({ A: true, B: true, C: true, D: true }, [c('A'), c('B', true, false), c('C', false), c('D')], ['D']), ['A', 'C']);
});
test('feedback uses returned success/mixed/failure counts, never fabricated completion', () => {
  for (const [success, failed, remaining] of [[2, 0, 0], [1, 1, 1], [0, 2, 2]]) {
    const text = retryFeedback({ code: success ? 'retry_completed' : 'provider_failure', attemptedTileCount: 2, succeededTileCount: success, failedTileCount: failed, remainingFailedTileCount: remaining });
    assert.ok(text.includes(`성공 ${success}개`)); assert.ok(text.includes(`재실패 ${failed}개`)); assert.ok(text.includes(`남은 실패 ${remaining}개`));
    assert.ok(text.includes('기존 성공 후보와 저장 이미지는 유지')); assert.equal(text.includes('전체 완료'), false);
  }
  assert.ok(retryFeedback({ code: 'no_retryable_tiles' }).includes('다시 분석할 실패 구간이 없습니다'));
});

async function fixture(t) {
  const db = await startAssetDb(); t.after(() => db.close());
  const original = globalThis.fetch;
  globalThis.fetch = (target, init) => { assert.equal(new URL(typeof target === 'object' && 'url' in target ? target.url : target).hostname, '127.0.0.1'); return original(target, init); };
  t.after(() => { globalThis.fetch = original; });
  const bytes = await sharp({ create: { width: 400, height: 3600, channels: 3, background: '#aaa' } }).png().toBuffer();
  const image = await decodeSource(bytes, 'image/png'), layout = await imageTiles(image);
  const input = buildCheckpointInput(image, productContextFingerprint(buildExtractionProductContext(db.state.product, null)), getExtractionModel(), layout, `${EXTRACTION_PROMPT}\n${RELEVANCE_PROMPT}`);
  let cache = createCheckpoint(input, layout, randomUUID());
  for (const tile of layout) cache = recordTileCheckpoint(cache, tile.index === 0
    ? completedTileCheckpoint(input, tile, { schemaVersion: 2, regions: [region] }) : failedTileCheckpoint(input, tile, failures.timeout));
  const state = { schemaVersion: 2, revision: randomUUID(), saveLease: null, checkpoint: cache, checkpointWriteError: null,
    attempt: { status: 'completed', runId: cache.runId, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z', errorCode: null },
    latestResult: aggregateCheckpoint(cache, '2026-01-01T00:00:01.000Z') };
  const row = assetRow({ metadata: { detailExtraction: state, source: { retained: true } } });
  db.state.assets.push(row); db.state.objects.add(row.storage_path); db.state.objectBytes.set(row.storage_path, bytes);
  return { ...db, row, cache, extraction: state };
}
test('review GET: partial counts, revision and candidate view only; read-only/no provider', async t => {
  const f = await fixture(t), before = structuredClone(f.row);
  const response = await GET(new Request('http://localhost/'), { params: Promise.resolve({ projectId, assetId }) });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const view = await response.json(); assert.equal(view.status, 'partial'); assert.equal(view.retryable, 1); assert.equal(view.successful, 1); assert.equal(view.total, 2);
  assert.equal(view.revision, f.extraction.revision); assert.ok(view.result.candidates.length);
  for (const key of ['checkpoint', 'sourceFingerprint', 'productContextFingerprint', 'layoutFingerprint', 'model', 'failure', 'tileId', 'tileIndices', 'box', 'relevanceReason']) assert.equal(JSON.stringify(view).includes('"' + key + '"'), false, key);
  assert.deepEqual(f.row, before); assert.equal(f.state.requests.some(r => r.method === 'PATCH' || r.method === 'DELETE'), false);
});
for (const status of ['missing', 'invalid', 'stale', 'incomplete', 'complete', 'failed']) test(`review ${status} state is not a retryable partial`, async t => {
  const f = await fixture(t);
  if (status === 'missing') delete f.extraction.checkpoint;
  if (status === 'invalid') f.extraction.checkpoint = { broken: true };
  if (status === 'stale') f.state.product.name = 'new product identity';
  if (status === 'incomplete') f.cache.tiles.pop();
  if (status === 'complete') f.cache.tiles[1] = completedTileCheckpoint(f.cache.input, f.cache.layout[1], { schemaVersion: 2, regions: [region] });
  if (status === 'failed') f.cache.tiles[0] = failedTileCheckpoint(f.cache.input, f.cache.layout[0], failures.timeout);
  const view = await getExtractionReview(projectId, assetId);
  assert.equal(view.status, status); assert.equal(view.retryable, status === 'failed' ? 2 : 0);
});
test('expired analyzing lease is retryable; live lease is disabled', async t => {
  const f = await fixture(t); f.extraction.attempt.status = 'analyzing';
  assert.equal((await getExtractionReview(projectId, assetId)).retryable, 1);
  f.extraction.attempt.startedAt = new Date().toISOString();
  const view = await getExtractionReview(projectId, assetId); assert.equal(view.active, true); assert.equal(view.retryable, 0);
});
test('changed source is stale even when replacement bytes cannot decode', async t => {
  const f = await fixture(t); f.state.objectBytes.set(f.row.storage_path, Buffer.from('replaced source bytes'));
  const view = await getExtractionReview(projectId, assetId); assert.equal(view.status, 'stale'); assert.equal(view.retryable, 0); assert.ok(view.result.candidates.length);
});
test('malformed outer state is invalid and offers explicit full reanalysis', async t => {
  const f = await fixture(t); f.row.metadata.detailExtraction = { damaged: true };
  const view = await getExtractionReview(projectId, assetId); assert.equal(view.status, 'invalid'); assert.equal(view.hasAttempt, true); assert.equal(view.retryable, 0);
});
test('projection strips raw cache from nested asset responses without changing stored metadata', async t => {
  const f = await fixture(t), before = structuredClone(f.row.metadata);
  const reply = publicExtractionResponse({ items: [{ asset: { id: assetId, metadata: f.row.metadata } }], extractionContextFingerprint: 'private' });
  assert.equal(reply.items[0].asset.metadata.detailExtraction, undefined);
  assert.equal(reply.items[0].asset.metadata.extractionDisplay.hasResult, true);
  assert.deepEqual(reply.items[0].asset.metadata.source, { retained: true });
  assert.equal(reply.extractionContextFingerprint, undefined); assert.deepEqual(f.row.metadata, before);
});
test('UI state component renders complete/partial/failed/stale/missing/invalid/incomplete and pending accessibly', () => {
  // Render actual TSX in a normal React process (the service tests use react-server condition).
  const script = `const fs=require('fs'),ts=require('typescript'),Module=require('module'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
    const file=require('path').resolve('src/features/detail-extraction/components/retry-status.tsx');
    const m=new Module(file,module);m.filename=file;m.paths=module.paths;
    m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
    const views={};for(const status of ['complete','partial','failed','stale','missing','invalid','incomplete']){
      views[status]=renderToStaticMarkup(React.createElement(m.exports.RetryStatus,{review:{status,hasAttempt:true,total:4,successful:3,failed:1,retryable:['partial','failed'].includes(status)?1:0},busy:false,pending:false,retry(){},reanalyze(){}}));}
    views.partial2=renderToStaticMarkup(React.createElement(m.exports.RetryStatus,{review:{status:'partial',hasAttempt:true,total:4,successful:2,failed:2,retryable:2},busy:false,pending:false,retry(){},reanalyze(){}}));
    views.pending=renderToStaticMarkup(React.createElement(m.exports.RetryStatus,{review:{status:'partial',hasAttempt:true,total:4,successful:3,failed:1,retryable:1},busy:true,pending:true,retry(){},reanalyze(){}}));
    process.stdout.write(JSON.stringify(views));`;
  const views = JSON.parse(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
  assert.equal(views.complete, ''); assert.ok(views.partial2.includes('실패한 2개 영역 다시 분석')); assert.ok(views.partial2.includes('실패 2개'));
  for (const status of ['partial', 'failed']) assert.ok(views[status].includes('실패한 1개 영역 다시 분석'));
  for (const status of ['stale', 'missing', 'invalid', 'incomplete']) {
    assert.ok(views[status].includes('전체 제품컷 재분석')); assert.equal(views[status].includes('실패한 1개'), false);
  }
  assert.ok(views.pending.includes('disabled=""')); assert.ok(views.pending.includes('분석 중')); assert.ok(views.partial.includes('role="status"'));
});
