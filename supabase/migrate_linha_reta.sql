-- Migração para o modelo "linha reta + dados informados". Rode uma vez no Supabase: SQL Editor → New query → Run.
-- ATENÇÃO: apaga os trajetos antigos (os sem horas de deslocamento informadas).
delete from public.entries;

do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.entries'::regclass and contype = 'c' loop
    execute format('alter table public.entries drop constraint %I', c);
  end loop;
end $$;

alter table public.entries
  add column if not exists commute_h       numeric,  -- horas de deslocamento por dia (ida + volta)
  add column if not exists class_h_week    numeric,  -- horas de aula por semana
  add column if not exists class_h_max_day numeric;  -- máximo de horas de aula em um dia

alter table public.entries drop column if exists commute_min;
alter table public.entries alter column mode drop not null;
alter table public.entries alter column legs drop not null;

alter table public.entries
  add check (jsonb_typeof(home) = 'array' and jsonb_array_length(home) = 2),
  add check (semester between 1 and 10),
  add check (intern_hours between 0 and 80),
  add check (dist_km > 0 and dist_km < 200),
  add check (commute_h is null or commute_h between 0.25 and 10),
  add check (class_h_week is null or class_h_week between 0 and 60),
  add check (class_h_max_day is null or (class_h_max_day between 0 and 16 and class_h_max_day <= class_h_week));
