// Actual local PostgreSQL/Storage regressions for abandoned reservations.
import assert from 'node:assert/strict';

export async function verifyAbandonedUploads({c,a,b,admin,bytes,check,report,config,limit,issueUpload,ok}) {
  const cap=10485760,sql=text=>c.sql('postgres',text);
  const issue=()=>issueUpload(a.client,a.p,a.q,'image/png',bytes.length);
  const expire=tickets=>sql(`update app_private.admissions set expires_at=clock_timestamp()-interval '1 second'
    where asset_id in (${tickets.map(t=>`'${t.id}'`).join(',')})`);
  const clean=async()=>ok(await admin.rpc('expire_admissions'));
  const state=t=>sql(`select state from app_private.admissions where asset_id='${t.id}'`);
  const object=t=>sql(`select exists(select 1 from storage.objects where bucket_id='product-assets' and name='${t.path}')`)==='t';
  const footprint=()=>JSON.parse(sql(`with paths as (
    select o.name as path,n.owner_id as actor from storage.objects o left join app_private.project_namespace_owners n
      on split_part(o.name,'/',2)=n.project_id::text where o.bucket_id='product-assets'
    union select storage_path,actor from app_private.admissions where operation='upload' and state in ('reserved','uncertain','expired')
    union select storage_path,owner_id from app_private.asset_upload_intents where finalized_at is null
  ) select jsonb_build_object('user',count(*) filter(where actor='${a.id}')*${cap},'global',count(*)*${cap}) from paths`));
  const active=()=>Number(sql(`select count(*) from app_private.asset_upload_intents i left join app_private.admissions a on a.asset_id=i.asset_id
    where i.finalized_at is null and i.expires_at>clock_timestamp() and (a.id is null or (a.state='reserved' and a.expires_at>clock_timestamp()))`));
  const reset=()=>{for(const key of ['user_bytes','global_bytes','upload_user_slots','upload_global_slots'])limit(key,config[key]);};
  const baseline=footprint(),initialActive=active();
  report.abuse={baselineBytes:baseline,initialActive,checks:[]};
  const recorded=(id,data)=>report.abuse.checks.push({id,...data});

  await check('ABUSE-01 abandoned expired admissions return slots and permit new admissions',async()=>{
    limit('upload_user_slots',3);limit('upload_global_slots',initialActive+3);
    const tickets=await Promise.all(Array.from({length:3},issue));
    await assert.rejects(issue());assert.equal(active(),initialActive+3);
    await clean();for(const t of tickets)assert.equal(state(t),'reserved');
    expire(tickets);await clean();
    for(const t of tickets){assert.equal(state(t),'released');assert.equal(sql(`select count(*) from app_private.asset_upload_intents where asset_id='${t.id}'`),'0');}
    assert.equal(active(),initialActive);
    const next=await issue();await next.settle('released');
    recorded('ABUSE-01',{abandoned:3,reclaimed:3,newAdmission:true,activeAfter:active()});reset();
  });
  await check('ABUSE-02 safe expiry returns exact user and global reserved byte capacity',async()=>{
    limit('user_bytes',baseline.user+3*cap);limit('global_bytes',baseline.global+3*cap);
    limit('upload_user_slots',10);limit('upload_global_slots',30);
    const tickets=await Promise.all(Array.from({length:3},issue));
    await tickets[0].settle('uncertain');
    assert.deepEqual(footprint(),{user:baseline.user+3*cap,global:baseline.global+3*cap});
    await assert.rejects(issue());expire(tickets);await clean();assert.deepEqual(footprint(),baseline);
    const replacements=await Promise.all(Array.from({length:3},issue));await assert.rejects(issue());
    for(const t of replacements)await t.settle('released');assert.deepEqual(footprint(),baseline);
    recorded('ABUSE-02',{userBytesReturned:3*cap,globalBytesReturned:3*cap,after:footprint()});reset();
  });
  await check('ABUSE-03 expired stored object retains bytes but not active upload slot',async()=>{
    const t=await issue();ok(await a.client.storage.from('product-assets').upload(t.path,bytes,{contentType:'image/png'}));
    expire([t]);await clean();assert.equal(state(t),'expired');assert.equal(object(t),true);
    assert.deepEqual(Buffer.from(await ok(await a.client.storage.from('product-assets').download(t.path)).arrayBuffer()),bytes);
    assert.deepEqual(footprint(),{user:baseline.user+cap,global:baseline.global+cap});
    limit('upload_user_slots',1);limit('upload_global_slots',initialActive+1);
    const next=await issue();await next.settle('released');
    limit('user_bytes',baseline.user+cap);await assert.rejects(issue());limit('user_bytes',config.user_bytes);
    limit('global_bytes',baseline.global+cap);await assert.rejects(issue());reset();
    recorded('ABUSE-03',{objectPreserved:true,bytesCharged:cap,expiredActiveSlot:0});
    ok(await a.client.storage.from('product-assets').remove([t.path]));await clean();assert.equal(state(t),'released');
  });
  await check('ABUSE-04 finalized Asset alone prevents automatic refund even without object',async()=>{
    const t=await issue();ok(await a.client.storage.from('product-assets').upload(t.path,bytes,{contentType:'image/png'}));
    ok(await a.client.from('assets').insert({id:t.id,project_id:a.p,product_id:a.q,storage_path:t.path,original_filename:'abuse.png',mime_type:'image/png',size_bytes:bytes.length}));
    // Response/settle was abandoned after the Asset finalizer committed.
    ok(await a.client.storage.from('product-assets').remove([t.path]));expire([t]);await clean();
    assert.equal(state(t),'expired');assert.equal(object(t),false);
    assert.equal(sql(`select count(*) from public.assets where id='${t.id}'`),'1');
    assert.equal(sql(`select finalized_at is not null from app_private.asset_upload_intents where asset_id='${t.id}'`),'t');
    assert.deepEqual(footprint(),{user:baseline.user+cap,global:baseline.global+cap});
    limit('user_bytes',baseline.user+cap);await assert.rejects(issue());reset();
    recorded('ABUSE-04',{assetPreserved:true,objectAbsent:true,bytesCharged:cap});
    ok(await a.client.from('assets').delete().eq('id',t.id));await clean();assert.equal(state(t),'released');
  });
  await check('ABUSE-05 cleanup and Storage INSERT serialize in both lock orders',async()=>{
    const waitLock=async(name)=>{
      for(let i=0;i<100;i++){
        if(sql(`select exists(select 1 from pg_stat_activity where application_name='${name}' and wait_event_type='Lock')`)==='t')return;
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      assert.fail('Expected a real PostgreSQL lock wait: '+name);
    };
    const insert=t=>`insert into storage.objects(bucket_id,name,owner_id) values('product-assets','${t.path}','${a.id}');`;
    // The privileged fixture connection controls transaction timing; INSERT uses
    // the exact production Storage trigger and holds its RowExclusiveLock. All
    // ordinary acceptance checks and HTTP races below still use real user JWTs.
    const t=await issue(),writer=c.openSqlSession(),cleaner=c.openSqlSession();
    try {
      writer.send(`begin;${insert(t)}select 'inserted';`);await writer.waitFor('inserted');
      // Expiry is set in the writer transaction, then a waiting cleaner obtains
      // its table lock after commit. A second already-expired empty ticket makes
      // cleanup enter its locking path before the first ticket becomes visible.
      const empty=await issue();expire([empty]);
      writer.send(`update app_private.admissions set expires_at=clock_timestamp()-interval '1 second' where asset_id='${t.id}';`);
      cleaner.send("set application_name='df060_abuse_cleanup';select public.expire_admissions();select 'cleaned';");
      await waitLock('df060_abuse_cleanup');writer.end('commit;');assert.equal((await writer.done).code,0);
      await cleaner.waitFor('cleaned');cleaner.end('');assert.equal((await cleaner.done).code,0);
      assert.equal(object(t),true);assert.equal(state(t),'expired');assert.equal(state(empty),'released');
    } finally {writer.end('rollback;');cleaner.end('rollback;');await Promise.all([writer.done,cleaner.done]);}
    // Cleanup-first: hold the cleanup transaction open and queue INSERT behind
    // its conflicting table lock. The subsequent admission check must reject.
    const empty=await issue();expire([empty]);const first=c.openSqlSession(),second=c.openSqlSession();
    try {
      first.send("begin;select public.expire_admissions();select 'reclaimed';");await first.waitFor('reclaimed');
      second.send(`set application_name='df060_abuse_insert';${insert(empty)}select 'unexpected';`);
      await waitLock('df060_abuse_insert');first.end('commit;');assert.equal((await first.done).code,0);
      const result=await second.done;assert.notEqual(result.code,0);assert.match(result.stderr,/Upload admission unavailable/);
      assert.equal(object(empty),false);assert.equal(state(empty),'released');
    } finally {first.end('rollback;');second.end('rollback;');await Promise.all([first.done,second.done]);}
    // Actual Storage HTTP calls concurrently with cleanup, rather than SQL-only.
    let httpRaces=0;
    for(let i=0;i<8;i++){
      const pending=await issue();expire([pending]);
      const results=await Promise.all([clean(),a.client.storage.from('product-assets').upload(pending.path,bytes,{contentType:'image/png'})]);
      assert.ok(results[1].error);assert.equal(state(pending),'released');assert.equal(object(pending),false);httpRaces++;
    }
    // A retained repeatable-read snapshot must never be used for absence proof.
    assert.throws(()=>sql('begin isolation level repeatable read;select public.expire_admissions();commit;'),/requires read committed/);
    recorded('ABUSE-05',{writerFirst:'object retained and charged',cleanupFirst:'insert denied',httpRaces,unsafeOutcomes:0});
    // Storage remove also tolerates an absent blob for this DB-only race fixture.
    ok(await a.client.storage.from('product-assets').remove([t.path]));await clean();
  });
  await check('ABUSE-06 repeated reserve/disconnect cannot permanently exhaust global capacity',async()=>{
    limit('upload_user_slots',3);limit('upload_global_slots',initialActive+3);
    limit('user_bytes',baseline.user+3*cap);limit('global_bytes',baseline.global+3*cap);
    let abandoned=[];
    for(let cycle=0;cycle<5;cycle++){
      if(abandoned.length)expire(abandoned);
      // No explicit cleanup or client settle between cycles: production reserve
      // itself reclaims proven-empty expired paths before enforcing capacity.
      abandoned=await Promise.all(Array.from({length:3},issue));
      await assert.rejects(issue());assert.deepEqual(footprint(),{user:baseline.user+3*cap,global:baseline.global+3*cap});
    }
    expire(abandoned);
    const other=await issueUpload(b.client,b.p,b.q,'image/png',bytes.length);await other.settle('released');
    assert.deepEqual(footprint(),baseline);assert.equal(active(),initialActive);
    recorded('ABUSE-06',{cycles:5,abandoned:15,otherUserAdmission:true,finalBytes:footprint(),finalActive:active()});reset();
  });
}
