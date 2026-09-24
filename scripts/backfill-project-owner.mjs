import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

// Offline operator tool. Never loads .env.local or uses the web service-role client.
export function parseBackfillArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!['--user-id', '--project-ids-file', '--service', '--apply', '--dry-run'].includes(key) || Object.hasOwn(args, key)) throw Error('Invalid arguments');
    if (key === '--apply' || key === '--dry-run') args[key] = true;
    else { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('Missing argument'); args[key] = argv[++i]; }
  }
  if (args['--apply'] && args['--dry-run']) throw Error('Conflicting mode');
  if (!z.uuid().safeParse(args['--user-id']).success || !/^[a-zA-Z0-9_-]{1,64}$/.test(args['--service'] ?? '') || !args['--project-ids-file']) throw Error('Explicit user, allowlist file and connection service required');
  return { userId: args['--user-id'], file: args['--project-ids-file'], service: args['--service'], apply: args['--apply'] === true };
}

export function parseProjectAllowlist(text) {
  if (Buffer.byteLength(text) > 1_048_576) throw Error('Allowlist too large');
  const ids = z.array(z.uuid()).max(10000).parse(JSON.parse(text));
  const normalized = ids.map(id => id.toLowerCase());
  if (new Set(normalized).size !== ids.length) throw Error('Duplicate project');
  return normalized;
}

export function runBackfill(argv, { read = readFileSync, exec = execFileSync } = {}) {
  try {
    const args = parseBackfillArgs(argv), ids = parseProjectAllowlist(read(args.file, 'utf8'));
    const sql = fileURLToPath(new URL('../supabase/operations/backfill-project-owner.sql', import.meta.url));
    const output = exec('psql', ['-X', '-q', '-A', '-t', '--no-password', '--dbname', `service=${args.service}`,
      '--set', `bootstrap_user_id=${args.userId}`, '--set', `project_ids=${JSON.stringify(ids)}`,
      '--set', `apply=${args.apply}`, '--file', sql], { encoding: 'utf8', timeout: 40000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 65536 });
    return z.strictObject({ applied: z.boolean(), updated: z.number().int().nonnegative(), totalProjects: z.number().int().nonnegative(),
      ownedProjects: z.number().int().nonnegative(), nullOwnerProjects: z.number().int().nonnegative(),
      distinctOwners: z.number().int().nonnegative(), eligibleProjects: z.number().int().nonnegative() }).parse(JSON.parse(output.trim()));
  } catch { throw Error('Ownership backfill failed. Check explicit inputs, connection service and migration prerequisites in a private operator session.'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(JSON.stringify(runBackfill(process.argv.slice(2))) + '\n'); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
