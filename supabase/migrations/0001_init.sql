-- Holoform Studio — initial schema
-- Apply with: Supabase SQL editor, `supabase db push`, or the MCP apply_migration tool.

-- ---------------------------------------------------------------------------
-- experiences: one row per AR experience
-- ---------------------------------------------------------------------------
create table if not exists public.experiences (
  id            text primary key,
  title         text not null,
  description   text not null default '',
  type          text not null check (type in ('model3d', 'image', 'video', 'text3d')),
  status        text not null default 'draft' check (status in ('draft', 'published')),
  asset_url     text,
  asset_type    text,
  usdz_url      text,
  thumbnail_url text,
  -- text3d content (text, textStyle) and the original upload filename
  config        jsonb not null default '{}'::jsonb,
  -- denormalized analytics so the dashboard list is a single query
  total_views   integer not null default 0,
  last_viewed_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- scans: one row per public AR-page view (analytics events)
-- ---------------------------------------------------------------------------
create table if not exists public.scans (
  id            bigint generated always as identity primary key,
  experience_id text not null references public.experiences (id) on delete cascade,
  device_type   text not null default 'other',
  os            text not null default 'Unknown',
  browser       text not null default 'Unknown',
  referrer      text not null default '',
  user_agent    text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists scans_experience_created_idx
  on public.scans (experience_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Security: RLS on, no anon policies.
-- The app talks to the database exclusively through the service-role /
-- secret key on the server (which bypasses RLS), so browser-held keys can
-- never read or write these tables. When user accounts are added later,
-- replace this with per-owner policies.
-- ---------------------------------------------------------------------------
alter table public.experiences enable row level security;
alter table public.scans enable row level security;

-- ---------------------------------------------------------------------------
-- record_scan: insert the event and bump the denormalized counters atomically
-- ---------------------------------------------------------------------------
create or replace function public.record_scan(
  p_experience_id text,
  p_device text,
  p_os text,
  p_browser text,
  p_referrer text,
  p_user_agent text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.experiences
     set total_views = total_views + 1,
         last_viewed_at = now()
   where id = p_experience_id;
  if not found then
    return false;
  end if;

  insert into public.scans (experience_id, device_type, os, browser, referrer, user_agent)
  values (p_experience_id, p_device, p_os, p_browser, p_referrer, p_user_agent);

  return true;
end;
$$;

-- Only the server (service role) may record scans — block direct RPC access
-- so the anon key can't be used to spam fake analytics.
revoke execute on function public.record_scan(text, text, text, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for AR assets (GLB/USDZ/images/videos).
-- Public = files get a stable public *download* URL; uploads still require
-- authorization (the app uses signed upload URLs minted server-side).
-- 50 MB per-file limit — keep in sync with MAX_UPLOAD_BYTES in the app.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('ar-assets', 'ar-assets', true, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;
