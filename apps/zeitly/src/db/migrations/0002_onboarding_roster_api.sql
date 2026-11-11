-- Zeitly schema v2: Onboarding, Personalstammdaten, Dokumente, Dienstplanung, API-Schlüssel

-- time entries may originate from the published roster
alter table zt_time_entries drop constraint if exists zt_time_entries_source_check;
alter table zt_time_entries add constraint zt_time_entries_source_check check (source in ('timer','manual','import','correction','plan'));

-- binary documents (ID photos, Meldezettel, …) – pilot-scale storage inside Postgres, encrypted at rest by the provider
create table if not exists zt_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  user_id uuid references zt_users(id) on delete cascade,
  kind text not null,
  filename text not null,
  mime text not null,
  size_bytes int not null check (size_bytes >= 0 and size_bytes <= 8388608),
  sha256 text not null,
  content bytea not null,
  extracted jsonb,
  uploaded_via text not null default 'onboarding',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists zt_files_user_idx on zt_files (org_id, user_id);

-- payroll master data collected during onboarding (Personalfragebogen)
create table if not exists zt_employee_profiles (
  user_id uuid primary key references zt_users(id) on delete cascade,
  org_id uuid not null references zt_orgs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  consents jsonb not null default '{}'::jsonb,
  completeness int not null default 0,
  validation jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  reviewed_by uuid references zt_users(id) on delete set null,
  reviewed_at timestamptz,
  sent_to_payroll_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- onboarding invitations (token links, no login required)
create table if not exists zt_onboarding (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  user_id uuid not null references zt_users(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'sent' check (status in ('sent','opened','submitted','reviewed','expired','cancelled')),
  expires_at timestamptz not null,
  opened_at timestamptz,
  submitted_at timestamptz,
  created_by uuid references zt_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists zt_onboarding_user_idx on zt_onboarding (org_id, user_id);

-- roster / Dienstplan
create table if not exists zt_shift_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  name text not null,
  start_time text not null,
  end_time text not null,
  break_minutes int not null default 30,
  location text not null default 'office',
  color text,
  created_at timestamptz not null default now()
);

create table if not exists zt_shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  user_id uuid not null references zt_users(id) on delete cascade,
  date date not null,
  start_time text not null,
  end_time text not null,
  break_minutes int not null default 0 check (break_minutes >= 0),
  location text not null default 'office' check (location in ('office','remote','field')),
  project_id uuid references zt_projects(id) on delete set null,
  note text,
  status text not null default 'draft' check (status in ('draft','published')),
  adopted_entry_id uuid references zt_time_entries(id) on delete set null,
  created_by uuid references zt_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists zt_shifts_user_date_idx on zt_shifts (org_id, user_id, date);
create index if not exists zt_shifts_org_date_idx on zt_shifts (org_id, date);

-- API keys for payroll / accounting integrations
create table if not exists zt_api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references zt_orgs(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['read:payroll'],
  created_by uuid references zt_users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

do $$
declare t text;
begin
  for t in select unnest(array['zt_files','zt_employee_profiles','zt_onboarding','zt_shift_templates','zt_shifts','zt_api_keys']) loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on %I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on %I from authenticated', t); end if;
  end loop;
end $$;
