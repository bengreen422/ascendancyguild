-- Ascendancy Guild – Supabase Postgres schema
-- Tables, indexes, RLS policies, and quest_templates seed

-- =============================================================================
-- 1) TABLES
-- =============================================================================

-- Profiles: one per auth user
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goals jsonb default '{}',
  constraints jsonb default '{}',
  tone int default 0,
  class_selected text,
  class_recommended text,
  onboarding_complete bool default false,
  tz text default 'UTC',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Quest templates: shared read-only catalog
create table if not exists public.quest_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  tags text[] default '{}',
  base_minutes int not null,
  completion_type text not null check (completion_type in ('binary', 'measurable')),
  metric_name text,
  is_repeatable bool default true,
  safe_level text default 'low_risk' not null,
  title_template text not null,
  description_template text not null,
  created_at timestamptz default now() not null
);

-- Daily check-ins: one per user per day
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  time_available int not null,
  energy text,
  avoid_tags text[] default '{}',
  created_at timestamptz default now() not null,
  unique (user_id, date)
);

-- Daily quest sets: one per user per day (generated plan)
create table if not exists public.daily_quest_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  minutes_budget int not null,
  generation_version text,
  created_at timestamptz default now() not null
);

-- Daily quests: individual quests within a set
create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  quest_set_id uuid not null references public.daily_quest_sets (id) on delete cascade,
  template_id uuid references public.quest_templates (id) on delete set null,
  source text not null,
  category text not null,
  tags text[] default '{}',
  title text not null,
  description text not null,
  est_minutes int not null,
  completion_type text not null,
  metric_name text,
  target_value numeric,
  created_at timestamptz default now() not null
);

-- Quest logs: completion records for daily quests
create table if not exists public.quest_logs (
  id uuid primary key default gen_random_uuid(),
  daily_quest_id uuid not null references public.daily_quests (id) on delete cascade,
  completed_value numeric,
  completion_percent int not null default 0,
  completed_at timestamptz,
  created_at timestamptz default now() not null
);

-- Progress: aggregate stats per user
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp_total int default 0 not null,
  streak_current int default 0 not null,
  streak_best int default 0 not null,
  attributes jsonb default '{}',
  updated_at timestamptz default now() not null
);

-- Updated_at trigger for profiles and progress
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger progress_updated_at
  before update on public.progress
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 2) INDEXES (user_id, date) and other lookups
-- =============================================================================

create index if not exists idx_daily_checkins_user_date
  on public.daily_checkins (user_id, date);

create index if not exists idx_daily_quest_sets_user_date
  on public.daily_quest_sets (user_id, date);

create index if not exists idx_daily_quests_quest_set_id
  on public.daily_quests (quest_set_id);

create index if not exists idx_quest_logs_daily_quest_id
  on public.quest_logs (daily_quest_id);

-- =============================================================================
-- 3) ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.quest_templates enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.daily_quest_sets enable row level security;
alter table public.daily_quests enable row level security;
alter table public.quest_logs enable row level security;
alter table public.progress enable row level security;

-- Profiles: user can read/write only their own row
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

-- Quest templates: any authenticated user can read; no write
create policy "quest_templates_select_authenticated" on public.quest_templates
  for select to authenticated using (true);

-- Daily checkins: user can read/write only their own rows
create policy "daily_checkins_select_own" on public.daily_checkins
  for select using (auth.uid() = user_id);
create policy "daily_checkins_insert_own" on public.daily_checkins
  for insert with check (auth.uid() = user_id);
create policy "daily_checkins_update_own" on public.daily_checkins
  for update using (auth.uid() = user_id);
create policy "daily_checkins_delete_own" on public.daily_checkins
  for delete using (auth.uid() = user_id);

-- Daily quest sets: user can read/write only their own rows
create policy "daily_quest_sets_select_own" on public.daily_quest_sets
  for select using (auth.uid() = user_id);
create policy "daily_quest_sets_insert_own" on public.daily_quest_sets
  for insert with check (auth.uid() = user_id);
create policy "daily_quest_sets_update_own" on public.daily_quest_sets
  for update using (auth.uid() = user_id);
create policy "daily_quest_sets_delete_own" on public.daily_quest_sets
  for delete using (auth.uid() = user_id);

-- Daily quests: user can read/write only quests in their own sets
create policy "daily_quests_select_own" on public.daily_quests
  for select using (
    exists (
      select 1 from public.daily_quest_sets dqs
      where dqs.id = daily_quests.quest_set_id and dqs.user_id = auth.uid()
    )
  );
create policy "daily_quests_insert_own" on public.daily_quests
  for insert with check (
    exists (
      select 1 from public.daily_quest_sets dqs
      where dqs.id = daily_quests.quest_set_id and dqs.user_id = auth.uid()
    )
  );
create policy "daily_quests_update_own" on public.daily_quests
  for update using (
    exists (
      select 1 from public.daily_quest_sets dqs
      where dqs.id = daily_quests.quest_set_id and dqs.user_id = auth.uid()
    )
  );
create policy "daily_quests_delete_own" on public.daily_quests
  for delete using (
    exists (
      select 1 from public.daily_quest_sets dqs
      where dqs.id = daily_quests.quest_set_id and dqs.user_id = auth.uid()
    )
  );

-- Quest logs: user can read/write only logs for their daily quests (via set ownership)
create policy "quest_logs_select_own" on public.quest_logs
  for select using (
    exists (
      select 1 from public.daily_quests dq
      join public.daily_quest_sets dqs on dqs.id = dq.quest_set_id
      where dq.id = quest_logs.daily_quest_id and dqs.user_id = auth.uid()
    )
  );
create policy "quest_logs_insert_own" on public.quest_logs
  for insert with check (
    exists (
      select 1 from public.daily_quests dq
      join public.daily_quest_sets dqs on dqs.id = dq.quest_set_id
      where dq.id = quest_logs.daily_quest_id and dqs.user_id = auth.uid()
    )
  );
create policy "quest_logs_update_own" on public.quest_logs
  for update using (
    exists (
      select 1 from public.daily_quests dq
      join public.daily_quest_sets dqs on dqs.id = dq.quest_set_id
      where dq.id = quest_logs.daily_quest_id and dqs.user_id = auth.uid()
    )
  );
create policy "quest_logs_delete_own" on public.quest_logs
  for delete using (
    exists (
      select 1 from public.daily_quests dq
      join public.daily_quest_sets dqs on dqs.id = dq.quest_set_id
      where dq.id = quest_logs.daily_quest_id and dqs.user_id = auth.uid()
    )
  );

-- Progress: only owner can read/write
create policy "progress_select_own" on public.progress
  for select using (auth.uid() = user_id);
create policy "progress_insert_own" on public.progress
  for insert with check (auth.uid() = user_id);
create policy "progress_update_own" on public.progress
  for update using (auth.uid() = user_id);

-- =============================================================================
-- 4) SEED: quest_templates (~60, no-cost, low-risk)
-- =============================================================================

insert into public.quest_templates (
  category, tags, base_minutes, completion_type, metric_name, is_repeatable,
  safe_level, title_template, description_template
) values
-- Body – mobility / light movement
('Body', array['no_gym','low_energy','indoors','mobility'], 5, 'binary', null, true, 'low_risk', 'Full body stretch', 'Do a gentle full-body stretch. Hold each stretch 15–30 seconds.'),
('Body', array['no_gym','low_energy','indoors','mobility'], 10, 'binary', null, true, 'low_risk', 'Neck and shoulder release', 'Release tension in neck and shoulders with slow circles and stretches.'),
('Body', array['no_gym','low_energy','indoors','mobility'], 5, 'binary', null, true, 'low_risk', 'Wrist and ankle circles', 'Perform slow circles at wrists and ankles in both directions.'),
('Body', array['no_gym','low_energy','indoors','mobility'], 10, 'measurable', 'minutes', true, 'low_risk', 'Stand and move', 'Stand and move gently (walk in place, sway, stretch) for {{minutes}} minutes.'),
('Body', array['no_gym','medium_energy','indoors','mobility'], 15, 'binary', null, true, 'low_risk', 'Hip openers', 'Do hip-opening stretches: figure-four, butterfly, lunges.'),
('Body', array['no_gym','low_energy','indoors','mobility'], 8, 'binary', null, true, 'low_risk', 'Lower back care', 'Cat-cow and child’s pose to ease lower back.'),
-- Body – light strength (no gym)
('Body', array['no_gym','medium_energy','indoors','strength_light'], 5, 'measurable', 'reps', true, 'low_risk', 'Wall push-ups', 'Do {{reps}} wall push-ups with controlled form.'),
('Body', array['no_gym','medium_energy','indoors','strength_light'], 5, 'measurable', 'reps', true, 'low_risk', 'Bodyweight squats', 'Do {{reps}} bodyweight squats. Focus on form over speed.'),
('Body', array['no_gym','medium_energy','indoors','strength_light'], 5, 'binary', null, true, 'low_risk', 'Plank hold', 'Hold a plank for as long as comfortable (aim 20–60 seconds).'),
('Body', array['no_gym','medium_energy','indoors','strength_light'], 5, 'measurable', 'reps', true, 'low_risk', 'Standing leg lifts', 'Do {{reps}} standing leg lifts per side for balance and leg strength.'),
('Body', array['no_gym','medium_energy','indoors','strength_light'], 8, 'binary', null, true, 'low_risk', 'Chair sit-stands', 'Perform 10–15 sit-to-stand from a chair with control.'),
('Body', array['no_gym','medium_energy','indoors','strength_light'], 5, 'measurable', 'reps', true, 'low_risk', 'Calf raises', 'Do {{reps}} calf raises; use wall for balance if needed.'),
-- Body – light cardio / walking
('Body', array['no_gym','low_energy','outdoors','cardio_light'], 10, 'measurable', 'minutes', true, 'low_risk', 'Gentle walk outside', 'Take a gentle walk outside for {{minutes}} minutes.'),
('Body', array['no_gym','medium_energy','outdoors','cardio_light'], 15, 'measurable', 'minutes', true, 'low_risk', 'Brisk walk', 'Take a brisk walk for {{minutes}} minutes.'),
('Body', array['no_gym','low_energy','indoors','cardio_light'], 10, 'measurable', 'minutes', true, 'low_risk', 'Walk in place', 'Walk in place or around the room for {{minutes}} minutes.'),
('Body', array['no_gym','high_energy','outdoors','cardio_light'], 20, 'measurable', 'minutes', true, 'low_risk', 'Power walk', 'Power walk for {{minutes}} minutes.'),
('Body', array['no_gym','medium_energy','indoors','cardio_light'], 5, 'binary', null, true, 'low_risk', 'Dance break', 'Put on a song and move to the music for a few minutes.'),
-- Body – optional gym (still low-risk)
('Body', array['gym_ok','medium_energy','strength_light'], 15, 'binary', null, true, 'low_risk', 'Light resistance band work', 'Use a resistance band for rows, presses, or leg work.'),
('Body', array['gym_ok','medium_energy','cardio_light'], 15, 'measurable', 'minutes', true, 'low_risk', 'Easy treadmill or bike', 'Easy treadmill walk or bike for {{minutes}} minutes.'),
-- Mind – mindfulness / breathing
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 5, 'measurable', 'minutes', true, 'low_risk', 'Box breathing', 'Practice box breathing (4-4-4-4) for {{minutes}} minutes.'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 5, 'binary', null, true, 'low_risk', 'Three deep breaths', 'Pause and take three slow, deep breaths.'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 10, 'measurable', 'minutes', true, 'low_risk', 'Guided meditation', 'Do a 10-minute guided meditation (app or video).'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 5, 'binary', null, true, 'low_risk', 'Body scan', 'Do a quick body scan from head to toes, noticing tension.'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 8, 'binary', null, true, 'low_risk', 'Gratitude pause', 'List three things you’re grateful for right now.'),
-- Mind – journaling / reflection
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 5, 'binary', null, true, 'low_risk', 'One-sentence journal', 'Write one sentence about how you feel today.'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 10, 'binary', null, true, 'low_risk', 'Morning intentions', 'Write 2–3 intentions for the day.'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 5, 'binary', null, true, 'low_risk', 'Evening reflection', 'Write one thing that went well and one thing to try tomorrow.'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 15, 'binary', null, false, 'low_risk', 'Weekly review', 'Spend 15 minutes reviewing the week: wins, challenges, next steps.'),
-- Mind – reading / learning
('Mind', array['no_gym','low_energy','indoors'], 10, 'measurable', 'minutes', true, 'low_risk', 'Read for pleasure', 'Read a book or article for {{minutes}} minutes.'),
('Mind', array['no_gym','low_energy','indoors'], 5, 'binary', null, true, 'low_risk', 'Learn one thing', 'Read or watch something that teaches you one new thing.'),
-- Mind – social light
('Mind', array['no_gym','low_energy','social_light'], 5, 'binary', null, true, 'low_risk', 'Reach out to one person', 'Send a short message or call one person you care about.'),
('Mind', array['no_gym','medium_energy','social_light','outdoors'], 15, 'binary', null, true, 'low_risk', 'Short social walk', 'Take a short walk with a friend or family member.'),
-- Sustenance – hydration / nutrition
('Sustenance', array['no_gym','low_energy','indoors','nutrition'], 2, 'binary', null, true, 'low_risk', 'Drink a glass of water', 'Drink one full glass of water.'),
('Sustenance', array['no_gym','low_energy','nutrition'], 5, 'binary', null, true, 'low_risk', 'Eat one mindful meal', 'Eat one meal without screens; focus on taste and fullness.'),
('Sustenance', array['no_gym','low_energy','nutrition'], 5, 'binary', null, true, 'low_risk', 'Prep one healthy snack', 'Prepare one healthy snack for later (e.g. fruit, nuts).'),
('Sustenance', array['no_gym','low_energy','nutrition'], 10, 'binary', null, false, 'low_risk', 'Plan tomorrow’s meals', 'Write a simple plan for what you’ll eat tomorrow.'),
('Sustenance', array['no_gym','low_energy','nutrition'], 3, 'binary', null, true, 'low_risk', 'Herbal tea or decaf', 'Make and enjoy a cup of herbal tea or decaf.'),
-- Sustenance – sleep
('Sustenance', array['no_gym','low_energy','indoors','sleep'], 5, 'binary', null, true, 'low_risk', 'Wind-down routine start', 'Begin wind-down: dim lights, no screens, quiet activity.'),
('Sustenance', array['no_gym','low_energy','indoors','sleep'], 5, 'binary', null, true, 'low_risk', 'Set a consistent wake time', 'Decide and set your wake time for tomorrow.'),
('Sustenance', array['no_gym','low_energy','indoors','sleep'], 2, 'binary', null, true, 'low_risk', 'No screens 30 min before bed', 'Commit to no screens for 30 minutes before bed tonight.'),
('Sustenance', array['no_gym','low_energy','indoors','sleep'], 10, 'binary', null, true, 'low_risk', 'Relaxation before bed', 'Do a short relaxation (breathing or stretch) before bed.'),
-- More Body variety
('Body', array['no_gym','medium_energy','indoors','mobility'], 10, 'binary', null, true, 'low_risk', 'Desk stretch break', 'Stand and do a 10-minute desk stretch routine.'),
('Body', array['no_gym','high_energy','indoors','strength_light'], 10, 'measurable', 'reps', true, 'low_risk', 'Lunge series', 'Do {{reps}} lunges per leg (forward or reverse).'),
('Body', array['no_gym','medium_energy','indoors','mobility'], 12, 'binary', null, true, 'low_risk', 'Yoga flow (gentle)', 'Follow a gentle 12-minute yoga flow (video or from memory).'),
('Body', array['no_gym','low_energy','indoors','mobility'], 5, 'binary', null, true, 'low_risk', 'Foam roll or self-massage', 'Use a foam roller or self-massage on one tight area.'),
('Body', array['no_gym','medium_energy','outdoors'], 15, 'binary', null, true, 'low_risk', 'Stairs or incline', 'Walk stairs or a gentle incline for about 15 minutes.'),
-- More Mind variety
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 5, 'binary', null, true, 'low_risk', 'Single-task focus', 'Pick one task and do only that for 5 minutes with full attention.'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 7, 'measurable', 'minutes', true, 'low_risk', 'Silent meditation', 'Sit in silence and focus on breath for {{minutes}} minutes.'),
('Mind', array['no_gym','low_energy','indoors'], 10, 'binary', null, true, 'low_risk', 'Digital declutter', 'Unsubscribe from one list or archive 10 old emails.'),
('Mind', array['no_gym','low_energy','indoors'], 5, 'binary', null, true, 'low_risk', 'Plan tomorrow', 'Write the top 2–3 priorities for tomorrow.'),
-- More Sustenance variety
('Sustenance', array['no_gym','low_energy','nutrition'], 5, 'binary', null, true, 'low_risk', 'Eat a vegetable or fruit', 'Include at least one vegetable or fruit in your next meal or snack.'),
('Sustenance', array['no_gym','low_energy','nutrition'], 3, 'binary', null, true, 'low_risk', 'Check in with hunger', 'Pause and rate your hunger 1–10 before eating.'),
('Sustenance', array['no_gym','low_energy','sleep'], 5, 'binary', null, true, 'low_risk', 'Consistent bedtime', 'Go to bed within 30 minutes of your usual time tonight.'),
('Sustenance', array['no_gym','low_energy','indoors','nutrition'], 15, 'binary', null, false, 'low_risk', 'Weekly meal idea list', 'Write 5 simple meal ideas for the week.'),
-- Extra mixed
('Body', array['no_gym','medium_energy','indoors','mobility'], 8, 'binary', null, true, 'low_risk', 'Stand every hour', 'Set a reminder and stand (or stretch) at least once per hour today.'),
('Mind', array['no_gym','low_energy','social_light'], 10, 'binary', null, true, 'low_risk', 'Compliment someone', 'Give one genuine compliment in person or by message.'),
('Sustenance', array['no_gym','low_energy','indoors','sleep'], 5, 'binary', null, true, 'low_risk', 'Darken bedroom', 'Make your sleep space darker (curtains, eye mask, or dim lights).'),
('Body', array['no_gym','low_energy','indoors','mobility'], 5, 'binary', null, true, 'low_risk', 'Eye rest (20-20-20)', 'Every 20 min, look at something 20 feet away for 20 seconds. Do 2–3 rounds.'),
('Mind', array['no_gym','low_energy','indoors','mindfulness'], 5, 'binary', null, true, 'low_risk', 'Name three sensations', 'Pause and name three things you see, hear, and feel right now.'),
('Sustenance', array['no_gym','low_energy','nutrition'], 5, 'binary', null, true, 'low_risk', 'Eat without rushing', 'Eat one snack or meal slowly, without multitasking.');
