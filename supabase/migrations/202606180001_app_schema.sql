create extension if not exists pgcrypto;

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  id_number text not null default '',
  area text not null,
  job_type text not null,
  status text not null default 'new',
  notes text not null default '',
  hire_date timestamptz,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  key text primary key,
  title text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image text not null default '',
  notes text not null default '',
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.areas enable row level security;
alter table public.leads enable row level security;
alter table public.templates enable row level security;
alter table public.ads enable row level security;

drop policy if exists "areas are public readable" on public.areas;
create policy "areas are public readable"
  on public.areas for select
  using (true);

drop policy if exists "authenticated users manage areas" on public.areas;
create policy "authenticated users manage areas"
  on public.areas for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "public can create leads" on public.leads;
create policy "public can create leads"
  on public.leads for insert
  to anon
  with check (true);

drop policy if exists "authenticated users manage leads" on public.leads;
create policy "authenticated users manage leads"
  on public.leads for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users manage templates" on public.templates;
create policy "authenticated users manage templates"
  on public.templates for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users manage ads" on public.ads;
create policy "authenticated users manage ads"
  on public.ads for all
  to authenticated
  using (true)
  with check (true);

insert into public.areas (name) values
  ('אשדוד'),
  ('אשקלון'),
  ('באר שבע'),
  ('בית שמש'),
  ('בני ברק'),
  ('דימונה'),
  ('חדרה'),
  ('חולון'),
  ('חיפה'),
  ('טבריה'),
  ('טירת הכרמל'),
  ('יקום'),
  ('ירושלים'),
  ('ירושלים מרכזית'),
  ('כרמיאל'),
  ('נשר'),
  ('נתיבות'),
  ('נתניה'),
  ('סיין'),
  ('עכו'),
  ('עפולה'),
  ('פתח תקווה'),
  ('צפת'),
  ('צ''ק פוסט'),
  ('קדמת גליל טבריה'),
  ('קריית שמונה'),
  ('קריית אתא'),
  ('קריית גת'),
  ('קריית מוצקין'),
  ('ראשון לציון'),
  ('רחובות'),
  ('רמת גן'),
  ('תל אביב אנוש'),
  ('תל אביב מי אביבים'),
  ('עבודה מהבית')
on conflict (name) do nothing;

insert into public.templates (key, title, body) values
  ('initial', 'הודעה ראשונית', 'היי {שם פרטי}, תודה שהשארת פרטים למשרה. אשמח להעביר לך פרטים נוספים לגבי העבודה באזור {אזור/אתר}.'),
  ('sent', 'פרטים נשלחו', 'היי {שם פרטי}, שלחתי לך את פרטי המשרה. אשמח לדעת אם זה עדיין רלוונטי עבורך.'),
  ('hired', 'התקבל לעבודה', 'היי {שם פרטי}, שמחים שהתקבלת לעבודה. מאחלים לך המון הצלחה!'),
  ('two_months_check', 'בדיקה אחרי חודשיים', 'היי {שם פרטי}, רציתי לבדוק אם אתה עדיין עובד באתר {אזור/אתר} והכול מתקדם כמו שצריך.'),
  ('irrelevant', 'לא רלוונטי', 'היי {שם פרטי}, תודה על הזמן שלך. אם בעתיד המשרה תחזור להיות רלוונטית עבורך, אשמח לעזור.')
on conflict (key) do nothing;
