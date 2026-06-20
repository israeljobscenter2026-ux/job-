alter table public.leads
  add column if not exists city text not null default '',
  add column if not exists project text not null default '',
  add column if not exists job_role text not null default '';
