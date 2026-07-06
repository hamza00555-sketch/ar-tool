-- Run this ONLY if you previously applied 0002 (publishable-key mode) and are
-- now switching to the SECRET key. It re-closes the database to the public by
-- removing the permissive anon policies and revoking the scan RPC from anon.
-- The secret key bypasses RLS, so the server keeps working after this.

drop policy if exists "anon read experiences"   on public.experiences;
drop policy if exists "anon insert experiences" on public.experiences;
drop policy if exists "anon update experiences" on public.experiences;
drop policy if exists "anon delete experiences" on public.experiences;

drop policy if exists "anon read scans"   on public.scans;
drop policy if exists "anon insert scans" on public.scans;

revoke execute on function public.record_scan(text, text, text, text, text, text)
  from anon;
