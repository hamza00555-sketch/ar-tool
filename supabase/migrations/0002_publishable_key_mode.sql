-- OPTIONAL — only apply this if you run the app with the PUBLISHABLE/anon key
-- (SUPABASE_PUBLISHABLE_KEY) instead of the secret key.
--
-- The publishable key is subject to RLS, so without these policies every
-- query is blocked. These policies grant full access to the anon role, which
-- means: anyone who obtains the publishable key can read AND write your data.
-- Keep the key server-side only, and prefer the SECRET key (which bypasses
-- RLS and needs none of this) for anything beyond a throwaway MVP.
--
-- To move to the secure secret-key setup later: set SUPABASE_SECRET_KEY and
-- run 0003 (drops these policies) so the database is closed to the public again.

create policy "anon read experiences"   on public.experiences for select using (true);
create policy "anon insert experiences" on public.experiences for insert with check (true);
create policy "anon update experiences" on public.experiences for update using (true) with check (true);
create policy "anon delete experiences" on public.experiences for delete using (true);

create policy "anon read scans"   on public.scans for select using (true);
create policy "anon insert scans" on public.scans for insert with check (true);

-- The viewer records scans through this function; allow the anon role to call it.
grant execute on function public.record_scan(text, text, text, text, text, text)
  to anon;
