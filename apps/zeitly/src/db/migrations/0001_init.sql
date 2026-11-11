-- Zeitly schema v1 – all tables prefixed zt_ so they can live in a shared Supabase project.
-- Access model: the application server connects with an owner/service role. Row Level Security is
-- enabled with NO policies so PostgREST roles (anon/authenticated) can never read these tables.

create table if not exists zt_orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  address text,
  uid_number text,
  contact_email text,
  payroll_email text,
  settings jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  time_zone text not null default 'Europe/Vienna',
  plan text not null default 'pilot',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists zt_users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'employee' check (role in ('owner','admin','manager','payroll','employee')),
  employment jsonb not null default '{}'::jsonb,
  manager_id uuid references zt_users(id) on delete set null,
  personnel_no text,
  active boolean not null default true,
  invited_at timestamptz,
  last_login_at timestamptz,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, email)
);
create index if not exists zt_users_email_idx on zt_users (email);

create table if not exists zt_login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists zt_login_codes_email_idx on zt_login_codes (email, created_at desc);

create table if not exists zt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zt_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip text
);
create index if not exists zt_sessions_user_idx on zt_sessions (user_id);

create table if not exists zt_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  code text not null,
  name text not null,
  customer text,
  cost_center text,
  color text,
  billable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists zt_time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  user_id uuid not null references zt_users(id) on delete cascade,
  date date not null,
  start_at timestamptz,
  end_at timestamptz,
  break_minutes int not null default 0 check (break_minutes >= 0),
  duration_minutes int check (duration_minutes is null or duration_minutes >= 0),
  type text not null default 'work' check (type in ('work','travel','oncall')),
  location text not null default 'office' check (location in ('office','remote','field')),
  project_id uuid references zt_projects(id) on delete set null,
  note text,
  source text not null default 'manual' check (source in ('timer','manual','import','correction')),
  status text not null default 'open' check (status in ('open','submitted','approved','locked')),
  created_by uuid references zt_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_at is null or start_at is null or end_at >= start_at)
);
create index if not exists zt_time_entries_user_date_idx on zt_time_entries (org_id, user_id, date);
create index if not exists zt_time_entries_org_date_idx on zt_time_entries (org_id, date);

create table if not exists zt_absences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  user_id uuid not null references zt_users(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  type text not null check (type in ('vacation','sick','time_comp','special_leave','care_leave','training','unpaid','other')),
  half_day boolean not null default false,
  note text,
  status text not null default 'requested' check (status in ('requested','approved','rejected')),
  decided_by uuid references zt_users(id) on delete set null,
  decided_at timestamptz,
  created_by uuid references zt_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (date_to >= date_from)
);
create index if not exists zt_absences_user_idx on zt_absences (org_id, user_id, date_from);

create table if not exists zt_timers (
  user_id uuid primary key references zt_users(id) on delete cascade,
  org_id uuid not null references zt_orgs(id) on delete cascade,
  started_at timestamptz not null,
  type text not null default 'work',
  location text not null default 'office',
  project_id uuid references zt_projects(id) on delete set null,
  note text,
  break_started_at timestamptz,
  break_minutes int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists zt_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  user_id uuid not null references zt_users(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  status text not null default 'open' check (status in ('open','submitted','approved','exported','reopened')),
  submitted_at timestamptz,
  submitted_ip text,
  approved_by uuid references zt_users(id) on delete set null,
  approved_at timestamptz,
  exported_at timestamptz,
  balance_start int not null default 0,
  balance_end int not null default 0,
  summary jsonb not null default '{}'::jsonb,
  employee_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, year, month)
);

create table if not exists zt_holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  date date not null,
  name text not null,
  factor real not null default 1,
  unique (org_id, date)
);

create table if not exists zt_audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  at timestamptz not null default now()
);
create index if not exists zt_audit_org_at_idx on zt_audit_log (org_id, at desc);
create index if not exists zt_audit_entity_idx on zt_audit_log (entity, entity_id);

create table if not exists zt_mail_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  to_email text not null,
  template text not null,
  subject text not null,
  status text not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists zt_import_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  created_by uuid references zt_users(id) on delete set null,
  filename text,
  mapping jsonb,
  rows_total int not null default 0,
  rows_imported int not null default 0,
  rows_skipped int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Row Level Security: enabled without policies → only the owner/service role can access.
do $$
declare t text;
begin
  for t in select unnest(array['zt_orgs','zt_users','zt_login_codes','zt_sessions','zt_projects','zt_time_entries','zt_absences','zt_timers','zt_periods','zt_holidays','zt_audit_log','zt_mail_log','zt_import_jobs']) loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on %I from authenticated', t);
    end if;
  end loop;
end $$;
