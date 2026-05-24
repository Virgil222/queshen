create table if not exists public.queshen_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.queshen_state enable row level security;

grant usage on schema public to anon;
grant select, insert, update on public.queshen_state to anon;

drop policy if exists "allow public read queshen state" on public.queshen_state;
create policy "allow public read queshen state"
on public.queshen_state
for select
to anon
using (true);

drop policy if exists "allow public write queshen state" on public.queshen_state;
create policy "allow public write queshen state"
on public.queshen_state
for insert
to anon
with check (true);

drop policy if exists "allow public update queshen state" on public.queshen_state;
create policy "allow public update queshen state"
on public.queshen_state
for update
to anon
using (true)
with check (true);
