-- Counts only. No Project names, user IDs, credential or Storage URLs.
select json_build_object(
  'totalProjects', count(*), 'ownedProjects', count(owner_id),
  'nullOwnerProjects', count(*) filter (where owner_id is null), 'distinctOwners', count(distinct owner_id),
  'assetProjectMismatches', (select count(*) from public.assets a join public.products p on p.id = a.product_id where a.project_id <> p.project_id),
  'duplicateStoragePaths', (select count(*) from (select storage_path from public.assets group by storage_path having count(*) > 1) duplicates),
  'storagePathMismatches', (select count(*) from public.assets a where a.storage_path !~
    ('^projects/' || a.project_id || '/products/' || a.product_id || '/' || a.id || '\.(jpg|png|webp)$')))
from public.projects;
