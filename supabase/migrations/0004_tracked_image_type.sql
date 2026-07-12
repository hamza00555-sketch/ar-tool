-- New experience type: image tracking (MindAR) — content anchored to a real printed image.
-- The target image URL and compiled .mind feature file live in the config jsonb,
-- so no new columns are needed.
alter table public.experiences drop constraint if exists experiences_type_check;
alter table public.experiences add constraint experiences_type_check
  check (type in ('model3d', 'image', 'video', 'text3d', 'tracked_image'));
