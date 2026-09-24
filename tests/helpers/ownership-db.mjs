import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
export const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
export const PA = '20000000-0000-4000-8000-000000000001', PB = '20000000-0000-4000-8000-000000000002', LEGACY = '20000000-0000-4000-8000-000000000003';
export const timestamp = '2026-09-24T00:00:00.000Z';
export const project = (id, owner_id, name = 'Fixture project') => ({ id, owner_id, name, status: 'draft', created_at: timestamp, updated_at: timestamp });
export function ownershipDb() {
  const tables = { projects: [project(PA,A),project(PB,B),project(LEGACY,null)], products: [], assets: [], detail_pages: [], sections: [], product_facts: [], product_options: [] };
  const calls = [], state = { fail: false };
  const client = createClient('http://127.0.0.1:9999', 'test-public-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init = {}) => {
    const url = new URL(input); if (url.origin !== 'http://127.0.0.1:9999') throw Error('Unexpected destination');
    const table = url.pathname.split('/').at(-1), method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ table, method, url, body });
    if (state.fail) return Response.json({ message: 'private-db-url-password-token', code: 'XX000' }, { status: 500 });
    let rows = tables[table]; if (!rows) throw Error('Unexpected table');
    const matches = row => [...url.searchParams].every(([key,value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3));
    let data = rows.filter(matches), count = data.length;
    if (method === 'POST') { const row = { ...project(randomUUID(),null), ...body }; rows.push(row); data = [row]; }
    else if (method === 'PATCH') { for (const row of data) Object.assign(row,body,{updated_at:'2026-09-24T01:00:00.000Z'}); }
    else if (method === 'DELETE') { tables[table] = rows.filter(row => !matches(row)); }
    else { data = [...data].sort((a,b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || b.id.localeCompare(a.id));
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1000); data = data.slice(offset,offset+limit); }
    const headers = new Headers(init.headers);
    const responseData = headers.get('accept')?.includes('vnd.pgrst.object') ? data[0] : data;
    return new Response(method === 'HEAD' ? null : JSON.stringify(responseData), { status:200, headers:{'content-type':'application/json','content-range':`0-${Math.max(0,data.length-1)}/${count}`} });
  } } });
  return { client, tables, calls, state };
}
