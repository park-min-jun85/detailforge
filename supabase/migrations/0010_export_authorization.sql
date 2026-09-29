begin;
-- Ephemeral exact render projections. No session credentials or bearer secrets.
create table app_private.export_tickets (
  id uuid primary key,
  actor uuid not null,
  project_id uuid not null,
  detail_page_id uuid not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  worker_hash text not null check (worker_hash ~ '^[a-f0-9]{64}$'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  options jsonb not null,
  width integer not null check (width = 860),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '90 seconds',
  state text not null default 'issued' check (state in ('issued','used','closed','expired')),
  snapshot jsonb,
  check (snapshot is null or octet_length(snapshot::text) <= 16777216)
);
alter table app_private.export_tickets enable row level security;
revoke all on app_private.export_tickets from public,anon,authenticated,service_role;
create index export_tickets_expiry on app_private.export_tickets(expires_at);

create function public.expire_export_tickets() returns void language plpgsql security definer set search_path = '' as $$
begin
  update app_private.export_tickets set state='expired',snapshot=null
    where state='issued' and expires_at<=clock_timestamp();
  -- Deleted random IDs can never be recreated by a browser. No consume upsert.
  delete from app_private.export_tickets where expires_at<clock_timestamp()-interval '1 day';
end;
$$;

create function public.issue_export_ticket(p_id uuid,p_actor uuid,p_project uuid,p_page uuid,
  p_token_hash text,p_worker_hash text,p_fingerprint text,p_options jsonb,p_snapshot jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.expire_export_tickets();
  if not exists(select 1 from public.projects p join public.detail_pages d on d.project_id=p.id
    where p.id=p_project and p.owner_id=p_actor and d.id=p_page and d.width=860)
    or p_options->>'format' not in ('png','jpg')
    or (p_snapshot->>'width')::integer<>860
    or p_snapshot->>'fingerprint' is distinct from p_fingerprint then
    raise exception 'export denied' using errcode='42501';
  end if;
  insert into app_private.export_tickets(id,actor,project_id,detail_page_id,token_hash,worker_hash,fingerprint,options,width,snapshot)
    values(p_id,p_actor,p_project,p_page,p_token_hash,p_worker_hash,p_fingerprint,p_options,860,p_snapshot);
end;
$$;

-- Atomic transition is the authorization point, never SELECT -> capture -> UPDATE.
-- Only the exact snapshot is returned; no arbitrary business/Storage loader.
create function public.use_export_ticket(p_id uuid,p_token_hash text,p_worker_hash text,p_consume boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ticket app_private.export_tickets; payload jsonb;
begin
  select * into ticket from app_private.export_tickets where id=p_id for update;
  if not found or ticket.state<>'issued' or ticket.expires_at<=clock_timestamp()
    or ticket.token_hash is distinct from p_token_hash or ticket.worker_hash is distinct from p_worker_hash
    or not exists(select 1 from public.projects p join public.detail_pages d on d.project_id=p.id
      where p.id=ticket.project_id and p.owner_id=ticket.actor and d.id=ticket.detail_page_id and d.width=ticket.width)
    then return null; end if;
  if not p_consume then return '{"authorized":true}'::jsonb; end if;
  payload:=ticket.snapshot;
  update app_private.export_tickets set state='used',snapshot=null where id=p_id;
  return payload;
end;
$$;

create function public.close_export_ticket(p_id uuid,p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update app_private.export_tickets set state=case when state='issued' then 'closed' else state end,snapshot=null
    where id=p_id and actor=p_actor;
end;
$$;
revoke all on function public.expire_export_tickets(), public.issue_export_ticket(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb),
  public.use_export_ticket(uuid,text,text,boolean),public.close_export_ticket(uuid,uuid) from public,anon,authenticated;
grant execute on function public.expire_export_tickets(), public.issue_export_ticket(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb),
  public.use_export_ticket(uuid,text,text,boolean),public.close_export_ticket(uuid,uuid) to service_role;
commit;
