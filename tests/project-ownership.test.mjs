import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject, listOwnedProjects, getOwnedProject, updateOwnedProject, deleteOwnedProject } from '../src/features/projects/service.ts';
import { ownedProjectRowSchema, legacyProjectOwnershipSchema, toProjectSummary } from '../src/features/projects/ownership.ts';
import { requireOwnedResource } from '../src/features/projects/ownership-chain.ts';
import { createLegacyInternalProject } from '../src/features/projects/legacy.ts';
import { parseProjectFormData } from '../src/features/projects/schemas.ts';
import { parseBackfillArgs, parseProjectAllowlist, runBackfill } from '../scripts/backfill-project-owner.mjs';
import { A,B,PA,PB,LEGACY,project,ownershipDb } from './helpers/ownership-db.mjs';
const read = p => readFileSync(p,'utf8');
const migration = read('supabase/migrations/0006_add_project_owner.sql');
const backfill = read('supabase/operations/backfill-project-owner.sql');
const finalize = read('supabase/operations/finalize-project-owner.sql');
const deny = code => e => e.code === code && !e.message.includes('private-db');
const args = ['--user-id',A,'--project-ids-file','operator-only.json','--service','local_fixture'];

test('OWN-01 staged owner column has no magic default, NOT NULL or RLS/grant mutation',()=>{
  assert.match(migration,/add column owner_id uuid/);assert.doesNotMatch(migration,/default\s+['(]|set not null|enable row level security|create policy|grant\s/i);
});
test('OWN-02 owner FK restricts user deletion and owner lookup has a non-composite index',()=>{
  assert.match(migration,/references auth.users\(id\) on delete restrict/i);assert.match(migration,/on public.projects\(owner_id\)/);
});
test('OWN-03 owned mapping requires owner UUID and UI projection never exposes it',()=>{
  const mapped = ownedProjectRowSchema.parse(project(PA,A));assert.equal(mapped.ownerId,A);assert.equal(mapped.updatedAt,project(PA,A).updated_at);
  assert.equal(Object.hasOwn(toProjectSummary(mapped),'ownerId'),false);
});
test('OWN-04 create uses each verified principal and requires a principal',async()=>{
  const db=ownershipDb();for(const userId of [A,B])assert.equal((await createProject({userId},{name:' New '},db.client)).ownerId,userId);
  const inserts=db.calls.filter(c=>c.method==='POST');assert.deepEqual(inserts.map(c=>c.body.owner_id),[A,B]);
  for(const principal of [null,{}, {userId:'forged'}])await assert.rejects(createProject(principal,{name:'x'},db.client),deny('unauthenticated'));
  assert.equal(db.calls.length,2);
});
test('OWN-05 forged owner/user fields are strict rejects including real FormData boundary',async()=>{
  const db=ownershipDb();for(const key of ['ownerId','owner_id','userId','id','status','__proto__']){
    await assert.rejects(createProject({userId:A},{name:'x',[key]:B},db.client),deny('invalid_input'));
    const form=new FormData();form.set('name','x');form.set(key,B);assert.equal(parseProjectFormData(form).success,false);
  }
  const form=new FormData();form.set('name','x');form.set('$ACTION_ID_test','');assert.equal(parseProjectFormData(form).success,true);
  form.append('name','duplicate');assert.equal(parseProjectFormData(form).success,false);assert.equal(db.calls.length,0);
});
test('OWN-06 update accepts only name/status and preserves owner/id/createdAt',async()=>{
  const db=ownershipDb();for(const input of [{ownerId:B},{owner_id:B},{userId:B},{id:PB},{created_at:'forged'},{}])
    await assert.rejects(updateOwnedProject({userId:A},PA,input,db.client),deny('invalid_input'));
  const result=await updateOwnedProject({userId:A},PA,{name:' renamed ',status:'editing'},db.client);
  assert.equal(result.ownerId,A);assert.equal(result.name,'renamed');assert.equal(result.createdAt,project(PA,A).created_at);
  assert.deepEqual(db.calls[0].body,{name:'renamed',status:'editing'});
});
for(const [caseId,userId,id]of [['07',A,PA],['08',B,PB]])test(`OWN-${caseId} list and count filter the same owner`,async()=>{
  const db=ownershipDb(), result=await listOwnedProjects({userId},Infinity,db.client);assert.equal(result.total,1);assert.equal(result.page,1);assert.deepEqual(result.projects.map(p=>p.id),[id]);
  assert.ok(db.calls.every(c=>c.url.searchParams.get('owner_id')===`eq.${userId}`));
});
test('OWN-09 A cannot read/update B or legacy project; foreign/missing share 404',async()=>{
  const db=ownershipDb();for(const id of [PB,LEGACY,'20000000-0000-4000-8000-000000000099']){
    await assert.rejects(getOwnedProject({userId:A},id,db.client),deny('not_found'));
    await assert.rejects(updateOwnedProject({userId:A},id,{name:'forged'},db.client),deny('not_found'));
  }
  assert.equal(db.tables.projects.find(p=>p.id===PB).name,'Fixture project');
  assert.ok(db.calls.every(c=>c.url.searchParams.get('owner_id')===`eq.${A}`));
});
test('OWN-10 A cannot delete B; owner filter is on DELETE itself',async()=>{
  const db=ownershipDb();await assert.rejects(deleteOwnedProject({userId:A},PB,db.client),deny('not_found'));
  assert.equal(db.tables.projects.length,3);assert.deepEqual(await deleteOwnedProject({userId:A},PA,db.client),{deleted:true});
  assert.ok(db.calls.every(c=>c.method==='DELETE'&&c.url.searchParams.get('owner_id')===`eq.${A}`));
});
test('OWN-11 legacy null/missing owner is visible only through explicit migration read/legacy create',async()=>{
  for(const row of [project(LEGACY,null),{...project(LEGACY,null),owner_id:undefined}]){
    assert.equal(ownedProjectRowSchema.safeParse(row).success,false);assert.equal(legacyProjectOwnershipSchema.parse(row).ownerId,null);
  }
  const db=ownershipDb();await createLegacyInternalProject({name:'legacy'},db.client);assert.equal(Object.hasOwn(db.calls[0].body,'owner_id'),false);
});
test('OWN-12 CLI validates explicit bootstrap/allowlist, defaults dry-run and only prints count DTO (mock psql)',()=>{
  const counts={applied:false,updated:0,totalProjects:3,ownedProjects:1,nullOwnerProjects:2,distinctOwners:1,eligibleProjects:2};let called=0;
  assert.deepEqual(runBackfill(args,{read:()=>JSON.stringify([PA,PB]),exec:(exe,argv)=>{called++;assert.equal(exe,'psql');assert.ok(argv.includes('apply=false'));assert.ok(argv.includes(`bootstrap_user_id=${A}`));return JSON.stringify(counts);}}),counts);
  assert.equal(called,1);assert.match(backfill,/perform id from auth.users where id = target for key share/);
});
test('OWN-13 SQL repeat contract updates NULL only, explicit apply branch, locked coverage before write',()=>{
  assert.match(backfill,/if should_apply then[\s\S]*update public.projects set owner_id = target where owner_id is null and id = any\(ids\)/);
  assert.ok(backfill.indexOf('lock table public.projects')<backfill.indexOf('Unowned projects missing'));
});
test('OWN-14 SQL refuses conflicting existing owner and unknown/duplicate/incomplete allowlist',()=>{
  for(const text of ['Existing ownership conflicts','Unknown project allowlist','Duplicate project allowlist','Unowned projects missing'])assert.ok(backfill.includes(text));
  assert.doesNotMatch(backfill,/delete from|truncate|disable trigger/i);
});
test('OWN-15 invalid user/input rejects before psql; nonexistent auth user SQL preflight is explicit',()=>{
  for(const invalid of [[],['--user-id','bad'],[...args,'--apply','--dry-run'],[...args,'--unknown'],[...args,'--user-id',B]])assert.throws(()=>parseBackfillArgs(invalid));
  for(const invalid of ['[null]','{}',JSON.stringify([PA,PA]),'not-json',JSON.stringify(['bad'])])assert.throws(()=>parseProjectAllowlist(invalid));
  assert.match(backfill,/if not found then raise exception 'Bootstrap auth user not found'/);
});
test('OWN-16 zero-row allowlist accepted, apply is opt-in, DB errors never echo raw psql output',()=>{
  assert.deepEqual(parseProjectAllowlist('[]'),[]);assert.equal(parseBackfillArgs([...args,'--apply']).apply,true);
  assert.throws(()=>runBackfill(args,{read:()=>JSON.stringify([PA]),exec:()=>{throw Error('private-db-url-password-token');}}),e=>!e.message.includes('private-db'));
  assert.match(backfill,/coalesce\(array_agg\(value::uuid\), array\[\]::uuid\[\]\)/);
});
test('OWN-18 database Row/Insert/Update matches nullable Stage A; no generated public auth relation',()=>{
  const block=read('src/lib/supabase/database.types.ts').split('      projects: {')[1].split('      sections: {')[0];
  assert.match(block,/owner_id: string \| null/);assert.equal([...block.matchAll(/owner_id\?: string \| null/g)].length,2);
});
test('OWN-19 fresh SQL sequence contract has no bootstrap identity requirement in automatic migration',()=>{
  assert.doesNotMatch(migration,/[0-9a-f]{8}-[0-9a-f-]{27}|bootstrap_user_id/);
  assert.match(finalize,/alter table public.projects alter column owner_id set not null/);
});
test('OWN-20 Stage C checks NULL/mixed Asset chain before explicit NOT NULL; no policies',()=>{
  assert.ok(finalize.indexOf('Ownership backfill incomplete')<finalize.indexOf('set not null'));
  assert.match(finalize,/Asset ownership chain mismatch/);assert.match(finalize,/\\set apply false/);assert.doesNotMatch(finalize,/create policy|grant\s|disable row level/i);
});
test('child chain follows actual FK paths and denies mixed-project Asset even when both roots have same owner',async()=>{
  const db=ownershipDb(), productId='30000000-0000-4000-8000-000000000001', assetId='40000000-0000-4000-8000-000000000001';
  db.tables.products.push({id:productId,project_id:PA});db.tables.assets.push({id:assetId,project_id:PA,product_id:productId});
  db.tables.detail_pages.push({id:assetId,project_id:PA});db.tables.sections.push({id:assetId,detail_page_id:assetId});
  db.tables.product_facts.push({id:assetId,product_id:productId});db.tables.product_options.push({id:assetId,product_id:productId});
  for(const kind of ['asset','detailPage','section','productFacts','productOptions']){
    assert.deepEqual(await requireOwnedResource({userId:A},{kind,id:assetId},db.client),{projectId:PA,ownerId:A});
    await assert.rejects(requireOwnedResource({userId:B},{kind,id:assetId},db.client),deny('not_found'));
  }
  db.tables.projects.find(p=>p.id===PB).owner_id=A;db.tables.assets[0].project_id=PB;
  await assert.rejects(requireOwnedResource({userId:A},{kind:'asset',id:assetId},db.client),deny('not_found'));
});
test('owned operations sanitize provider failures and never fall back to legacy/admin clients',async()=>{
  const db=ownershipDb();db.state.fail=true;
  for(const work of [()=>createProject({userId:A},{name:'x'},db.client),()=>listOwnedProjects({userId:A},1,db.client),()=>getOwnedProject({userId:A},PA,db.client),()=>updateOwnedProject({userId:A},PA,{name:'x'},db.client),()=>deleteOwnedProject({userId:A},PA,db.client)])await assert.rejects(work(),deny('unavailable'));
  for(const file of ['service','ownership','ownership-chain'])assert.doesNotMatch(read(`src/features/projects/${file}.ts`),/SUPABASE_SERVICE_ROLE_KEY|supabase\/(?:server|admin)["']/);
});
