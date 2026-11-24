-- Rode no Supabase: SQL Editor → New query → Run. Pode ser rodado de novo.
-- Espelha no banco as regras de docs/model.js (validate): ninguém consegue gravar dados impossíveis nem pela API.
-- "not valid": vale para novos registros; registros antigos que violem a regra continuam lá, mas o site já os ignora nos gráficos.
alter table public.entries drop constraint if exists entries_validacao;
alter table public.entries add constraint entries_validacao check (
  dist_km <= 150                                        -- moradia a no máximo 150 km da EAU (ida e volta no mesmo dia)
  and commute_min between 1 and 480                     -- até 8 h por dia, ida + volta
  and commute_min >= dist_km * 1.5                      -- não dá para ir mais rápido que ~80 km/h em linha reta
  and class_min_week <= 3600 and class_min_max_day <= 840
  and class_min_max_day <= class_min_week
  and class_min_week <= 7 * class_min_max_day
  and work_min <= 3600 and domestic_min <= 3600 and reading_min <= 2400 and study_min <= 3600 and selfcare_min <= 2400
  -- semana: deslocamento × 5 dias + demais atividades ≤ 140 h (sobram ≥ 28 h para dormir e comer)
  and commute_min * 5 + class_min_week + work_min + domestic_min + reading_min + study_min + selfcare_min <= 8400
  -- dia mais pesado: ≤ 30 h de atividades (acima de 24 h o site aceita, mostra 0 h de sono e sinaliza)
  and commute_min + class_min_max_day + (work_min + study_min) / 5.0 + (domestic_min + reading_min + selfcare_min) / 7.0 <= 1800
) not valid;
notify pgrst, 'reload schema';
