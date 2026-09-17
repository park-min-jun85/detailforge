// Run only on explicit operator request. No API route, DB client, fixtures or automatic retry.
// Existing integration commands use Node --env-file=.env.local and tests/register.mjs.
import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';
import { diagnoseApprovedProducts, diagnoseDomemeProduct } from '../src/features/wholesale-import/domeme-api/client.ts';
import { safeDomemeError } from '../src/features/wholesale-import/domeme-api/errors.ts';

let currentProductNo = null;
try {
  if (process.argv.slice(2).join(' ') !== '--approved-three') {
    console.error('세 상품을 각 1회 조회하려면 --approved-three를 명시하세요. 자동 재실행하지 마세요.');
    process.exitCode = 1;
  } else {
    // Explicit project-local file, independent of cwd; do not load unrelated secrets into output.
    let key;
    try { key = parseEnv(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')).DOMEGGOOK_API_KEY; }
    catch { /* Missing/inaccessible file is handled by key_missing, never expose fs errors. */ }
    await diagnoseApprovedProducts(async productNo => {
      currentProductNo = productNo;
      const report = await diagnoseDomemeProduct(productNo, { key: key ?? '' });
      console.log(JSON.stringify(report, null, 2));
      return report;
    });
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, productNo: currentProductNo, ...safeDomemeError(error), stopped: true }));
  process.exitCode = 1;
}
