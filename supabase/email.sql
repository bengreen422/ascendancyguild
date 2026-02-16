-- Daily email send tracking (dedupe: one send per user per date)
create table if not exists public.daily_email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  sent_at timestamptz default now() not null,
  unique (user_id, date)
);

-- RLS: users can read their own rows; inserts are done server-side with service role only (no insert policy for authenticated).
alter table public.daily_email_sends enable row level security;

create policy "daily_email_sends_select_own"
  on public.daily_email_sends
  for select
  using (auth.uid() = user_id);
