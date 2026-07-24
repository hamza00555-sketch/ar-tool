-- Holoform Studio — 3D scan jobs
-- A scan job tracks the async photogrammetry pipeline: the browser captures
-- frames of a real object, a self-hosted reconstruction worker turns them
-- into a GLB, and on success the app creates a `model` experience.

create table if not exists public.scan_jobs (
  id                text primary key,
  status            text not null default 'queued'
                      check (status in ('queued', 'processing', 'ready', 'failed')),
  title             text not null default '',
  -- URLs of the captured frames the worker reconstructs from
  frame_urls        jsonb not null default '[]'::jsonb,
  -- reconstruction output
  result_glb_url    text,
  result_usdz_url   text,
  thumbnail_url     text,
  error             text,
  -- the model experience created once the scan is ready
  experience_id     text references public.experiences (id) on delete set null,
  -- set when a worker claims the job (lets a stale claim be retried later)
  worker_claimed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists scan_jobs_status_created_idx
  on public.scan_jobs (status, created_at);

-- Same posture as the other tables: RLS on, no anon policies. Only the
-- server (secret key) touches this table; the worker authenticates to the
-- app's API with WORKER_TOKEN, never directly to the database.
alter table public.scan_jobs enable row level security;

-- claim_scan_job: atomically hand the oldest queued job to a worker so two
-- workers can never grab the same one (SKIP LOCKED).
create or replace function public.claim_scan_job()
returns setof public.scan_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id text;
begin
  select id into claimed_id
    from public.scan_jobs
   where status = 'queued'
   order by created_at
   for update skip locked
   limit 1;

  if claimed_id is null then
    return;
  end if;

  return query
    update public.scan_jobs
       set status = 'processing',
           worker_claimed_at = now(),
           updated_at = now()
     where id = claimed_id
    returning *;
end;
$$;

revoke execute on function public.claim_scan_job() from public, anon, authenticated;
