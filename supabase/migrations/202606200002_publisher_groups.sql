create table if not exists public.publisher_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  language text not null default 'he',
  image_path text not null default '',
  link text not null default 'https://israel-jobs-center2026.netlify.app/',
  region text not null default 'center',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.publisher_groups enable row level security;

drop policy if exists "publisher groups are public readable" on public.publisher_groups;
create policy "publisher groups are public readable"
  on public.publisher_groups for select
  to anon
  using (active = true);

drop policy if exists "authenticated users manage publisher groups" on public.publisher_groups;
create policy "authenticated users manage publisher groups"
  on public.publisher_groups for all
  to authenticated
  using (true)
  with check (true);
