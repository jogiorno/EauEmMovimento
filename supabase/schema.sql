-- Rode no Supabase: SQL Editor → New query → Run.
create table if not exists public.entries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  home               jsonb not null,                                    -- [lat, lng] da moradia
  semester           int  not null check (semester between 1 and 10),
  dist_km            numeric not null check (dist_km > 0 and dist_km < 200), -- linha reta até a EAU
  -- tudo informado pelo estudante, em minutos
  commute_min        int check (commute_min between 1 and 600),        -- por dia na EAU, ida + volta
  class_min_week     int check (class_min_week between 0 and 3600),    -- aulas por semana
  class_min_max_day  int check (class_min_max_day between 0 and 960 and class_min_max_day <= class_min_week), -- dia mais cheio
  work_min           int check (work_min between 0 and 4800),          -- trabalho/estágio por semana
  domestic_min       int check (domestic_min between 0 and 4800),      -- trabalho doméstico por semana
  reading_min        int check (reading_min between 0 and 4800),       -- leitura por semana
  study_min          int check (study_min between 0 and 4800),         -- estudos extraclasse e trabalhos por semana
  selfcare_min       int check (selfcare_min between 0 and 4800),      -- autocuidado por semana
  check (jsonb_typeof(home) = 'array' and jsonb_array_length(home) = 2)
);

alter table public.entries enable row level security;

-- Qualquer visitante pode ler e inserir; ninguém pode alterar ou apagar pelo site.
create policy "leitura publica" on public.entries for select to anon using (true);
create policy "insercao publica" on public.entries for insert to anon with check (true);

grant usage on schema public to anon;
grant select, insert on public.entries to anon;
