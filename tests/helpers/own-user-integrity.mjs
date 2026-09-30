import assert from 'node:assert/strict';

export function auditGraph(sql,projectId,productId,actor) {
  for(const id of [projectId,productId,actor])assert.match(id,/^[0-9a-f-]{36}$/);
  const graph=JSON.parse(sql(`select jsonb_build_object(
    'project',(select to_jsonb(r) from public.projects r where id='${projectId}'),
    'products',(select jsonb_agg(r) from public.products r where project_id='${projectId}'),
    'facts',(select jsonb_agg(r) from public.product_facts r where product_id='${productId}'),
    'options',(select jsonb_agg(r) from public.product_options r where product_id='${productId}'),
    'assets',(select jsonb_agg(r) from public.assets r where project_id='${projectId}'),
    'pages',(select jsonb_agg(r) from public.detail_pages r where project_id='${projectId}'),
    'sections',(select jsonb_agg(r order by sort_order) from public.sections r where detail_page_id in(select id from public.detail_pages where project_id='${projectId}')))`));
  assert.equal(graph.project.owner_id,actor);
  for(const key of ['products','facts','options','pages'])assert.equal(graph[key].length,1,key);
  assert.equal(graph.products[0].id,productId);
  for(const r of [...graph.products,...graph.pages,...graph.assets])assert.equal(r.project_id,projectId);
  for(const r of [...graph.facts,...graph.options,...graph.assets])assert.equal(r.product_id,productId);
  const ids=new Set(graph.assets.map(a=>a.id));
  for(const r of graph.sections){assert.equal(r.detail_page_id,graph.pages[0].id);for(const id of r.content.assetIds)assert.ok(ids.has(id));}
  assert.deepEqual(graph.sections.map(r=>r.sort_order),[0,1,2,3]);
  const all=[graph.project,...graph.products,...graph.facts,...graph.options,...graph.assets,...graph.pages,...graph.sections];
  assert.equal(new Set(all.map(r=>r.id)).size,all.length);
  const orphanRows=Number(sql(`select
    (select count(*) from public.products c left join public.projects p on p.id=c.project_id where p.id is null)+
    (select count(*) from public.product_facts c left join public.products p on p.id=c.product_id where p.id is null)+
    (select count(*) from public.product_options c left join public.products p on p.id=c.product_id where p.id is null)+
    (select count(*) from public.assets c left join public.products p on p.id=c.product_id left join public.projects j on j.id=c.project_id where p.id is null or j.id is null)+
    (select count(*) from public.detail_pages c left join public.projects p on p.id=c.project_id where p.id is null)+
    (select count(*) from public.sections c left join public.detail_pages p on p.id=c.detail_page_id where p.id is null)`));
  const wrongProject=Number(sql(`select count(*) from public.assets a join public.products p on p.id=a.product_id where a.project_id<>p.project_id`));
  const orphanObjects=Number(sql(`select count(*) from storage.objects o left join public.assets a on a.storage_path=o.name where o.bucket_id='product-assets' and o.name like 'projects/${projectId}/%' and a.id is null`));
  assert.equal(orphanRows,0);assert.equal(wrongProject,0);assert.equal(orphanObjects,0);
  return {orphanRows,wrongProject,orphanObjects,duplicateIds:0,counts:Object.fromEntries(Object.entries(graph).map(([key,rows])=>[key,Array.isArray(rows)?rows.length:1]))};
}
