// Isolated real React/Chromium QA. No app credentials, database, AI or external requests.
// Run: node tests/manual-crop.browser.mjs
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { review, insets } from './fixtures/v0.2.1/manual-crop-ui.mjs';
const require = createRequire(import.meta.url), root = process.cwd();
const cache = resolve('node_modules/.cache/task052'), artifacts = resolve('artifacts/TASK-052');
mkdirSync(cache, { recursive: true }); mkdirSync(artifacts, { recursive: true });
writeFileSync(cache + '/loader.cjs', `const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;};`);
writeFileSync(cache + '/entry.tsx', `import {useState} from 'react';import{createRoot}from'react-dom/client';
import{ExtractionPanel}from'@/features/detail-extraction/components/extraction-panel';
function App(){const[version,bump]=useState(0),[url,setUrl]=useState('/source.png'),[asset,setAsset]=useState({id:'source',originalFilename:'로컬 합성 QA 원본.png',metadata:{}});
window.fixture={url:setUrl,remount:()=>bump(v=>v+1)};
return <main className="mx-auto max-w-6xl p-4"><h1 className="mb-4 text-xl font-semibold">자르기 조정 · 로컬 검증</h1><ExtractionPanel key={version} projectId="local" asset={asset} assets={[asset]} previewUrl={url} busy={false} begin={()=>true} end={()=>{}} refresh={async()=>{}} update={setAsset} close={()=>bump(v=>v+1)}/></main>;}
createRoot(document.getElementById('root')!).render(<App/>);`);
const compiled = require('next/dist/compiled/webpack/webpack');
const stats = await new Promise((ok, fail) => compiled.webpack({ mode: 'development', devtool: false,
  entry: cache + '/entry.tsx', output: { path: cache, filename: 'bundle.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': resolve('src') } },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules[\\/](?!\.cache)/, use: cache + '/loader.cjs' }] },
}, (err, result) => err ? fail(err) : ok(result)));
assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
const modules = stats.toJson({ all: false, modules: true }).modules.map(m => m.name);
assert.ok(!modules.some(name => /server-only|node_modules[\\/]sharp|supabase|features[\\/]detail-extraction[\\/](?:service|images|review)\.ts/.test(name)), 'server code in client graph');
const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss');
const css = (await postcss([tailwind({ base: root })]).process(readFileSync('src/app/globals.css', 'utf8'), { from: resolve('src/app/globals.css') })).css;
const image = await sharp(Buffer.from(`<svg width="800" height="4000" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="4000" fill="#e6e5e2"/>${[100,700,1300,1900].map((y,i)=>`<g transform="translate(80 ${y})"><rect width="600" height="500" fill="#608b80"/><rect x="20" y="20" width="560" height="460" fill="#f6ede0"/><path d="M150 150L220 85H380L450 150L405 210L375 180V415H225V180L195 210Z" fill="${['#9b5747','#485d86','#577665','#966242'][i]}"/><circle cx="480" cy="400" r="35" fill="#d0b99a"/></g>`).join('')}</svg>`)).png().toBuffer();
let current = review(), mode = 'partial', retryNext = null;
const requests = [], errors = [], results = [], external = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const send = (data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (path.startsWith('/api/')) {
    let body = ''; for await (const part of req) body += part;
    requests.push({ method: req.method, path, body: body ? JSON.parse(body) : null });
    if (req.method === 'GET') return send(current);
    if (path.endsWith('/retry')) { if (retryNext) current = retryNext; return send({ code: 'retry_completed', attemptedTileCount: 1, succeededTileCount: 1, failedTileCount: 0, remainingFailedTileCount: 0 }); }
    assert.ok(path.endsWith('/save'), 'unexpected analyze request');
    const request = JSON.parse(body);
    if (mode !== 'partial' && mode !== 'success') return send({ code: mode, available: 0 }, 409);
    const saved = [], failed = [];
    for (const item of request.items) {
      if (mode === 'partial' && item.candidateId === 'B') { failed.push({ candidateId: 'B', code: 'crop_too_small', message: 'safe error' }); continue; }
      const c = current.result.candidates.find(c => c.id === item.candidateId), i = item.manualInsets ?? { left: 0, top: 0, right: 0, bottom: 0 };
      const f = { x: c.rect.x + i.left, y: c.rect.y + i.top, width: c.rect.width - i.left - i.right, height: c.rect.height - i.top - i.bottom };
      saved.push({ candidateId: c.id, existing: c.id === 'C', asset: { id: `saved-${c.id}`, width: f.width, height: f.height, mimeType: 'image/png', assetType: 'unclassified' } });
      current.savedCrops.push({ assetId: `saved-${c.id}`, finalRect: f, adjustmentMode: item.manualInsets ? 'manual' : 'automatic' });
      if (!item.manualInsets) current.savedCandidateIds.push(c.id);
    }
    return send({ saved, failed, available: 26 });
  }
  if (path === '/bundle.js') { res.setHeader('content-type', 'application/javascript; charset=utf-8'); res.end(readFileSync(cache + '/bundle.js')); }
  else if (path === '/style.css') { res.setHeader('content-type', 'text/css'); res.end(css); }
  else if (path === '/source.png') { res.setHeader('content-type', 'image/png'); res.end(image); }
  else if (path === '/broken.png') { res.writeHead(404); res.end(); }
  else { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Local crop QA</title><div id="root"></div><script src="/bundle.js"></script></html>'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('node_modules/.cache/ms-playwright');
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width === 375 });
    await context.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(8000);
    const card = id => page.locator(`[data-candidate-id="${id}"]`), checkbox = id => card(id).getByRole('checkbox');
    const open = async id => { await card(id).getByRole('button', { name: '자르기 조정', exact: true }).click(); await page.getByRole('dialog').waitFor(); };
    const field = edge => page.getByRole('spinbutton', { name: `${{ left: '왼쪽', top: '위쪽', right: '오른쪽', bottom: '아래쪽' }[edge]} 제외 폭 (px)`, exact: true });
    const button = name => page.getByRole('dialog').getByRole('button', { name, exact: true });
    const writeInsets = async values => { for (const [edge, value] of Object.entries(values)) await field(edge).fill(String(value)); };
    const apply = async (id, values = insets) => { await open(id); await writeInsets(values); await button('적용').click(); };
    const posts = () => requests.filter(r => r.method === 'POST').length;
    async function fresh() { current = review(); mode = 'partial'; retryNext = null; await page.goto(origin); await card('A').getByRole('button').first().waitFor(); await page.waitForFunction(() => !document.querySelector('[data-candidate-id="A"] button')?.disabled); }
    await fresh();
    await page.getByRole('checkbox', { name: '제외 후보 보기' }).check();
    assert.equal(await card('P').getByRole('button').count(), 0);
    const before = posts();
    await open('A'); assert.equal(await page.getByRole('dialog').getAttribute('aria-modal'), 'true');
    await writeInsets(insets); assert.ok((await page.getByRole('dialog').innerText()).includes('550 × 450 px'));
    await button('취소').click(); assert.equal(await card('A').getByText('자르기 조정됨', { exact: true }).count(), 0);
    assert.equal(await card('A').getByRole('button', { name: '자르기 조정', exact: true }).evaluate(e => e === document.activeElement), true);
    await apply('C'); assert.equal(await checkbox('C').isChecked(), false); assert.equal(posts(), before);
    await checkbox('A').uncheck(); await apply('A'); assert.equal(await checkbox('A').isChecked(), false);
    await open('A'); await field('left').fill('590'); assert.equal(await button('적용').isDisabled(), true); assert.ok(await page.getByRole('dialog').getByRole('alert').count());
    await button('후보 전체로').click(); assert.equal(await field('left').inputValue(), '0');
    const slider = page.getByRole('slider', { name: '왼쪽 자르기 경계', exact: true });
    await slider.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowRight'); assert.equal(await field('left').inputValue(), '11');
    const box = await slider.boundingBox(); assert.ok(box.width >= 43.9, `small touch target ${box.width}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2, { steps: 5 }); await page.mouse.up();
    assert.ok(Number(await field('left').inputValue()) > 11);
    // Oversized drag clamps to server minimum rather than crossing/inverting the rectangle.
    const nextBox = await slider.boundingBox(); await page.mouse.move(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2); await page.mouse.down(); await page.mouse.move(viewport.width + 300, nextBox.y + nextBox.height / 2); await page.mouse.up();
    assert.equal(await field('left').inputValue(), '440'); assert.equal(await button('적용').isEnabled(), true);
    if (viewport.width === 375) {
      await button('후보 전체로').click(); const touchBox = await slider.boundingBox(), session = await context.newCDPSession(page);
      const x = touchBox.x + touchBox.width / 2, y = touchBox.y + touchBox.height / 2;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 25, y }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.ok(Number(await field('left').inputValue()) > 0, 'touch pointer did not adjust'); await session.detach();
    }
    await writeInsets(insets);
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 60 });
    assert.equal(await field('left').inputValue(), '20'); await page.setViewportSize(viewport);
    // Dialog keyboard focus stays contained, including reverse tab at the first handle.
    await slider.focus(); await page.keyboard.press('Shift+Tab');
    assert.equal(await page.getByRole('dialog').evaluate(e => e.contains(document.activeElement)), true);
    const rect = await page.getByRole('dialog').boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= viewport.width && rect.height <= viewport.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${artifacts}/editor-${viewport.width}.png` });
    await button('후보 전체로').click(); await button('적용').click();
    await open('A'); assert.equal(await field('left').inputValue(), '0'); await field('left').fill('40'); await page.keyboard.press('Escape');
    await open('A'); assert.equal(await field('left').inputValue(), '0'); await button('취소').click();
    await card('A').getByRole('button', { name: '수동 조정 해제' }).click();
    assert.equal(await card('A').getByRole('button', { name: '수동 조정 해제' }).count(), 0);
    await apply('A', { left: 0, top: 0, right: 0, bottom: 0 }); await apply('B');
    await checkbox('A').check(); await checkbox('C').check();
    assert.equal(posts(), before, 'editing performed server mutation');
    await page.getByRole('button', { name: '선택한 제품컷 저장 (3)' }).click();
    await page.getByText(/1번 후보|2번 후보/).filter({ hasText: '저장 영역이 너무 작습니다.' }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-candidate-id="B"] button')?.disabled);
    const body = requests.filter(r => r.path.endsWith('/save')).at(-1).body;
    assert.equal(body.schemaVersion, 2); assert.equal(body.expectedRevision, current.revision);
    assert.deepEqual(body.items.find(i => i.candidateId === 'A').manualInsets, { left: 0, top: 0, right: 0, bottom: 0 });
    for (const id of ['A', 'C']) { assert.equal(await checkbox(id).isChecked(), false); assert.equal(await card(id).getByRole('button', { name: '수동 조정 해제' }).count(), 0); }
    assert.equal(await checkbox('B').isChecked(), true); assert.equal(await card('B').getByRole('button', { name: '수동 조정 해제' }).count(), 1);
    assert.equal(await card('C').getByRole('img').getAttribute('viewBox'), '100 1310 550 450');
    await page.screenshot({ path: `${artifacts}/partial-${viewport.width}.png`, fullPage: true });
    // Retry reorders by ID and keeps explicit false + draft. URL renewal is independent.
    await checkbox('B').uncheck(); retryNext = structuredClone(current); retryNext.result.candidates.reverse();
    retryNext.revision = '52000000-0000-4000-8000-000000000002';
    await page.getByRole('button', { name: '실패한 1개 영역 다시 분석' }).click();
    await page.waitForFunction(() => !document.querySelector('[data-candidate-id="B"] button')?.disabled);
    assert.equal(await checkbox('B').isChecked(), false); await open('B'); assert.equal(await field('left').inputValue(), '20'); await button('취소').click();
    await page.evaluate(() => window.fixture.url('/source.png?renew=1'));
    await open('B'); assert.equal(await field('left').inputValue(), '20'); await button('취소').click();
    // Server error responses never delete failed drafts or automatically re-save.
    await checkbox('B').check();
    for (const code of ['stale', 'conflict', 'asset_limit', 'upload', 'database']) {
      mode = code; const n = posts(); await page.getByRole('button', { name: '선택한 제품컷 저장 (1)' }).click();
      await page.waitForFunction(() => !document.querySelector('[data-candidate-id="B"] button')?.disabled);
      assert.equal(posts(), n + 1); assert.equal(await checkbox('B').isChecked(), true);
      await open('B'); assert.equal(await field('left').inputValue(), '20'); await button('취소').click();
    }
    current.result.candidates.find(c => c.id === 'B').rect.x++;
    await page.getByRole('button', { name: '상태 새로고침', exact: true }).click();
    await card('B').getByText('후보가 변경되었습니다. 자르기 조정을 다시 확인해 주세요.').waitFor();
    assert.equal(await page.getByRole('button', { name: '선택한 제품컷 저장 (0)' }).isDisabled(), true);
    // Stale draft remains visible until human re-approval; image failure prevents blind editing.
    await page.evaluate(() => window.fixture.url('/broken.png'));
    await page.getByText(/미리보기를 불러오지 못했거나 크기가 일치하지 않습니다/).waitFor();
    assert.equal(await card('B').getByRole('button', { name: '자르기 조정', exact: true }).isDisabled(), true);
    await page.evaluate(() => window.fixture.url('/source.png?renew=2')); await open('B');
    assert.equal(await field('left').inputValue(), '0'); await button('적용').click();
    assert.equal(await card('B').getByText('후보가 변경되었습니다. 자르기 조정을 다시 확인해 주세요.').count(), 0);
    await open('B'); await page.evaluate(() => window.fixture.url('/broken.png?editor=1'));
    await page.getByRole('dialog').getByText('이미지를 불러오지 못했습니다. 취소 후 상태 새로고침을 실행해 주세요.').waitFor();
    assert.equal(await button('적용').isDisabled(), true); await button('취소').click();
    results.push({ viewport, passed: true, touchTested: viewport.width === 375, flows: ['eligible/prohibited', 'open/cancel/focus/trap', 'local apply/selection', 'numeric/minimum', 'keyboard/drag/clamp/resize', 'zero/remove', 'V2/partial/reused', 'retry/reorder/URL', 'stale/conflict/limit/storage', 'stale-base/image-error'] });
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  writeFileSync(artifacts + '/browser.json', JSON.stringify({ results, requests, errors, externalRequests: external.length, externalAI: 0, remoteMutations: 0, clientServerLeakage: false }, null, 2));
  console.log(JSON.stringify({ results, errors, externalRequests: external.length }, null, 2));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
