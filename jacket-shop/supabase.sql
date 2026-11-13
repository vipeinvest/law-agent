-- Waitlist table for the Keynote Jacket page.
-- Anonymous visitors may INSERT only; nobody can read the list with the public key.

create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  size        text check (size in ('XS','S','M','L','XL','XXL')),
  ref_code    text not null unique check (length(ref_code) between 5 and 12),
  referred_by text check (length(referred_by) <= 12),
  utm         text check (length(utm) <= 300),
  confirmed   boolean not null default false,   -- set true after double opt-in click
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create policy "anon can join waitlist"
  on public.waitlist for insert to anon
  with check (confirmed = false);

-- Referral leaderboard (run in the dashboard / with the service role only).
create or replace view public.waitlist_referrals with (security_invoker = true) as
  select w.email, w.ref_code, count(r.id) as referrals
  from public.waitlist w
  left join public.waitlist r on r.referred_by = w.ref_code and r.confirmed
  group by w.id
  order by referrals desc;
