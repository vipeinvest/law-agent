-- Law Agent – Postgres Schema (Supabase)
-- Maintained by Hermes-Backend. Do not edit from other agents.

-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =========================================================
-- ENUMS
-- =========================================================
do $$ begin
  create type user_role as enum ('super_admin','kanzlei_admin','kanzlei_user','mandant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type case_status as enum ('intake','in_review','docs_pending','ready_report','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type doc_status as enum ('uploaded','classifying','classified','rejected','manual_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type doc_category as enum (
    'finanzamt','oegk','bank','lieferant','kunde','vertrag','bilanz',
    'gesellschafter','behoerde','gericht','versicherung','sonstiges'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type org_type as enum ('kanzlei','mandant');
exception when duplicate_object then null; end $$;

-- =========================================================
-- TABLES
-- =========================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  type org_type not null,
  name text not null,
  address text,
  fn text,                       -- Firmenbuchnummer
  uid text,                      -- UID-Nummer
  contact_email text,
  contact_phone text,
  branding jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role user_role not null,
  full_name text,
  email text not null,
  phone text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists users_org_idx on users(org_id);

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  kanzlei_org_id uuid not null references organizations(id) on delete cascade,
  mandant_org_id uuid not null references organizations(id) on delete cascade,
  case_number text not null,
  status case_status not null default 'intake',
  responsible_user_id uuid references users(id),
  risk_score numeric(5,2),
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kanzlei_org_id, case_number)
);
create index if not exists cases_kanzlei_idx on cases(kanzlei_org_id);
create index if not exists cases_mandant_idx on cases(mandant_org_id);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  uploader_user_id uuid references users(id),
  storage_path text not null,    -- legal-intake/case/<case_id>/<category>/<filename>
  original_filename text not null,
  proposed_filename text,
  mime_type text,
  size_bytes bigint,
  status doc_status not null default 'uploaded',
  category doc_category,
  doc_type text,
  ai_confidence numeric(4,3),
  ai_summary text,
  ai_payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists documents_case_idx on documents(case_id);
create index if not exists documents_status_idx on documents(status);

create table if not exists creditors (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  name text not null,
  category doc_category,
  contact text,
  total_amount numeric(14,2) default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists creditors_case_idx on creditors(case_id);

create table if not exists liabilities (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  creditor_id uuid references creditors(id) on delete set null,
  amount numeric(14,2) not null,
  currency text not null default 'EUR',
  due_date date,
  status text,
  source_document_id uuid references documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists liabilities_case_idx on liabilities(case_id);

create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  occurred_at timestamptz not null,
  title text not null,
  description text,
  source text,                   -- 'manual' | 'document' | 'ai'
  related_document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists timeline_case_idx on timeline_events(case_id, occurred_at);

create table if not exists questionnaire_answers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  step text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists q_case_idx on questionnaire_answers(case_id);

create table if not exists risk_matrix_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  factor text not null,
  severity int not null check (severity between 1 and 5),
  likelihood int not null check (likelihood between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  version int not null default 1,
  format text not null default 'md',
  markdown text,
  storage_path_pdf text,
  generated_by_model text,
  created_at timestamptz not null default now()
);
create index if not exists reports_case_idx on reports(case_id);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  org_id uuid references organizations(id),
  case_id uuid references cases(id),
  action text not null,
  payload jsonb,
  cost_eur numeric(8,4),
  tokens_in int,
  tokens_out int,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists audit_case_idx on audit_logs(case_id, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  case_id uuid references cases(id) on delete cascade,
  channel text not null,         -- 'email' | 'in_app'
  template text not null,
  subject text,
  body text,
  delivery_status text not null default 'queued',  -- queued|sent|sent_with_imap_warning|failed
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table organizations         enable row level security;
alter table users                 enable row level security;
alter table cases                 enable row level security;
alter table documents             enable row level security;
alter table creditors             enable row level security;
alter table liabilities           enable row level security;
alter table timeline_events       enable row level security;
alter table questionnaire_answers enable row level security;
alter table risk_matrix_items     enable row level security;
alter table reports               enable row level security;
alter table audit_logs            enable row level security;
alter table notifications         enable row level security;

-- Helper: aktuelle User-Rolle / Org / Cases
create or replace function current_user_org_id() returns uuid
language sql stable as $$
  select org_id from users where id = auth.uid()
$$;

create or replace function current_user_role() returns user_role
language sql stable as $$
  select role from users where id = auth.uid()
$$;

create or replace function user_has_case_access(c_id uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from cases c
    join users u on u.id = auth.uid()
    where c.id = c_id
      and (
        u.org_id = c.kanzlei_org_id
        or u.org_id = c.mandant_org_id
        or u.role = 'super_admin'
      )
  )
$$;

-- Policies: tenant isolation
drop policy if exists org_self_read on organizations;
create policy org_self_read on organizations for select using (
  id = current_user_org_id() or current_user_role() = 'super_admin'
);

drop policy if exists users_same_org on users;
create policy users_same_org on users for select using (
  org_id = current_user_org_id() or current_user_role() = 'super_admin'
);

drop policy if exists cases_access on cases;
create policy cases_access on cases for select using (
  current_user_role() = 'super_admin'
  or kanzlei_org_id = current_user_org_id()
  or mandant_org_id = current_user_org_id()
);

drop policy if exists cases_kanzlei_write on cases;
create policy cases_kanzlei_write on cases for insert with check (
  current_user_role() in ('super_admin','kanzlei_admin','kanzlei_user')
  and kanzlei_org_id = current_user_org_id()
);
drop policy if exists cases_kanzlei_update on cases;
create policy cases_kanzlei_update on cases for update using (
  current_user_role() in ('super_admin','kanzlei_admin','kanzlei_user')
  and kanzlei_org_id = current_user_org_id()
);

-- Generischer Pattern für case-bezogene Tabellen
do $$
declare
  t text;
begin
  foreach t in array array['documents','creditors','liabilities','timeline_events','questionnaire_answers','risk_matrix_items','reports','notifications']
  loop
    execute format($f$drop policy if exists %1$s_case_read on %1$s;
                       create policy %1$s_case_read on %1$s for select using (user_has_case_access(case_id));$f$, t);
    execute format($f$drop policy if exists %1$s_case_write on %1$s;
                       create policy %1$s_case_write on %1$s for insert with check (user_has_case_access(case_id));$f$, t);
    execute format($f$drop policy if exists %1$s_case_update on %1$s;
                       create policy %1$s_case_update on %1$s for update using (user_has_case_access(case_id));$f$, t);
  end loop;
end $$;

drop policy if exists audit_admin_read on audit_logs;
create policy audit_admin_read on audit_logs for select using (
  current_user_role() in ('super_admin','kanzlei_admin')
  and (org_id = current_user_org_id() or current_user_role() = 'super_admin')
);
