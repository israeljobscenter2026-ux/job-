alter table public.ads
  add column if not exists target_region text not null default 'allcountry';

alter table public.ads
  drop constraint if exists ads_target_region_check;

alter table public.ads
  add constraint ads_target_region_check
  check (target_region in ('north', 'south', 'center', 'sharon', 'jerusalem', 'allcountry', 'all'));
