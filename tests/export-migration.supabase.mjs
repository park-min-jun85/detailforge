import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {connectLocal,output} from './helpers/export-local.mjs';
const c=connectLocal(),checks=[],db='df062_fresh_'+randomUUID().replaceAll('-','');
mkdirSync(output,{recursive:true});
// Restore genuine platform DDL only. Remove precisely the application's known
// Storage policies/trigger, then migrations recreate and validate them.
const platform=c.platform().replace(/CREATE POLICY product_assets_[\s\S]*?;\r?\n/g,'')
  .replace(/CREATE TRIGGER product_assets_consume_admission[\s\S]*?;\r?\n/g,'');
assert.doesNotMatch(platform,/EXECUTE FUNCTION app_private\.|CREATE POLICY product_assets_/);
c.sql(`create database ${db} template template0`);c.sql(platform,db);
c.sql('create schema if not exists public;grant usage on schema public to anon,authenticated,service_role;',db);
for(const f of readdirSync('supabase/migrations').filter(f=>/^\d{4}_/.test(f)).sort())c.sql(readFileSync('supabase/migrations/'+f,'utf8'),db);
assert.equal(c.sql('select count(*) from app_private.export_tickets',db),'0');
assert.equal(c.sql('select count(*) from app_private.admission_limits',db),'0');checks.push({name:'fresh 0001–0010 on genuine platform schema',status:'PASS'});
const catalog=database=>c.sql("select jsonb_agg(jsonb_build_object('name',p.proname,'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('issue_export_ticket','use_export_ticket','close_export_ticket','expire_export_tickets')",database);
// Platform databases may grant postgres EXECUTE via default privileges; compare
// the exposed API roles explicitly, while preserving managed DBA privileges.
const normalized=value=>JSON.parse(value).map(({acl,...rest})=>{void acl;return rest;});
assert.deepEqual(normalized(catalog(db)),normalized(catalog('postgres')));
for(const role of ['anon','authenticated','service_role'])for(const database of [db,'postgres']) {
  assert.equal(c.sql(`select bool_and(has_function_privilege('${role}',p.oid,'EXECUTE')=${role==='service_role'}) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('issue_export_ticket','use_export_ticket','close_export_ticket','expire_export_tickets')`,database),'t');
}
checks.push({name:'fresh/upgrade definitions and API-role ACL match',status:'PASS'});
for(const name of ['anon','authenticated','service_role'])assert.equal(c.sql(`select has_table_privilege('${name}','app_private.export_tickets','SELECT,INSERT,UPDATE,DELETE')`,db),'f');
assert.equal(c.sql("select relrowsecurity from pg_class where oid='app_private.export_tickets'::regclass",db),'t');checks.push({name:'private ledger RLS and direct CRUD revocations',status:'PASS'});
const result={status:'PASS',checks,checkCount:checks.length,freshDatabase:db,cloneRetained:true,remoteMutations:0};
writeFileSync(join(output,'migration.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
