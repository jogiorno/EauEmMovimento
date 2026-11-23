-- Segunda migração: tudo passa a ser informado em MINUTOS e entram novas perguntas
-- (trabalho doméstico, leitura, estudos extraclasse, autocuidado). Rode uma vez: SQL Editor → New query → Run.
-- ATENÇÃO: apaga os trajetos já enviados (não têm os campos novos). Pode ser rodada mais de uma vez.
delete from public.entries;

do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.entries'::regclass and contype = 'c' loop
    execute format('alter table public.entries drop constraint %I', c);
  end loop;
end $$;

alter table public.entries
  drop column if exists commute_h,
  drop column if exists class_h_week,
  drop column if exists class_h_max_day,
  drop column if exists intern_hours;

alter table public.entries
  add column if not exists commute_min       int,  -- por dia na EAU, ida + volta
  add column if not exists class_min_week    int,
  add column if not exists class_min_max_day int,  -- dia mais cheio de aula
  add column if not exists work_min          int,  -- trabalho/estágio por semana
  add column if not exists domestic_min      int,
  add column if not exists reading_min       int,
  add column if not exists study_min         int,
  add column if not exists selfcare_min      int;

alter table public.entries
  add check (jsonb_typeof(home) = 'array' and jsonb_array_length(home) = 2),
  add check (semester between 1 and 10),
  add check (dist_km > 0 and dist_km < 200),
  add check (commute_min between 1 and 600),
  add check (class_min_week between 0 and 3600),
  add check (class_min_max_day between 0 and 960 and class_min_max_day <= class_min_week),
  add check (work_min between 0 and 4800),
  add check (domestic_min between 0 and 4800),
  add check (reading_min between 0 and 4800),
  add check (study_min between 0 and 4800),
  add check (selfcare_min between 0 and 4800);

-- faz a API do Supabase reconhecer as colunas novas imediatamente
notify pgrst, 'reload schema';
