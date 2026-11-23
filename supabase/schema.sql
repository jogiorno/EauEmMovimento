-- Rode no Supabase: SQL Editor → New query → Run.
create table if not exists public.entries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  home            jsonb not null,                          -- [lat, lng] da moradia
  semester        int  not null check (semester between 1 and 10),
  intern_hours    int  not null check (intern_hours between 0 and 80), -- h/semana de trabalho/estágio
  dist_km         numeric not null check (dist_km > 0 and dist_km < 200), -- linha reta até a EAU
  commute_h       numeric check (commute_h between 0.25 and 10),      -- h de deslocamento por dia (ida + volta)
  class_h_week    numeric check (class_h_week between 0 and 60),      -- h de aula por semana
  class_h_max_day numeric check (class_h_max_day between 0 and 16 and class_h_max_day <= class_h_week),
  mode            text,   -- legado
  real_min        int,    -- legado
  work            jsonb,  -- legado
  legs            jsonb,  -- legado
  check (jsonb_typeof(home) = 'array' and jsonb_array_length(home) = 2)
);

alter table public.entries enable row level security;

-- Qualquer visitante pode ler e inserir; ninguém pode alterar ou apagar pelo site.
create policy "leitura publica" on public.entries for select to anon using (true);
create policy "insercao publica" on public.entries for insert to anon with check (true);

grant usage on schema public to anon;
grant select, insert on public.entries to anon;
