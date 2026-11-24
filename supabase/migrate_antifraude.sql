-- Rode no Supabase: SQL Editor → New query → Run. Pode ser rodado de novo.
-- Complementa migrate_validacao.sql: a moradia precisa estar na região metropolitana do Rio e a distância
-- gravada precisa corresponder à coordenada (distância em linha reta até a EAU, tolerância de 0,5 km).
-- "not valid": vale só para novos registros; os antigos continuam lá e o site os ignora se não passarem.
alter table public.entries drop constraint if exists entries_local;
alter table public.entries add constraint entries_local check (
  (home->>0)::float8 between -23.2 and -22.5
  and (home->>1)::float8 between -43.9 and -42.7
  and abs(dist_km - 12742 * asin(sqrt(
        power(sin(radians((home->>0)::float8 - (-22.90464)) / 2), 2)
      + cos(radians(-22.90464)) * cos(radians((home->>0)::float8))
        * power(sin(radians((home->>1)::float8 - (-43.13083)) / 2), 2)))) <= 0.5
) not valid;
notify pgrst, 'reload schema';
