# EAU EM MOVIMENTO

Webmap participativo dos deslocamentos de estudantes de Arquitetura e Urbanismo da UFF. Cada estudante marca a moradia (uma linha reta até a Escola de Arquitetura e Urbanismo, Praia Vermelha) e informa deslocamento diário, horas de aula por semana, maior dia de aula e horas de trabalho/estágio; o dashboard calcula o sono possível.

- Site estático em `docs/` (GitHub Pages).
- Banco: Supabase. Crie a tabela com `supabase/schema.sql` (banco já existente: rode `supabase/migrate_linha_reta.sql`) e preencha `docs/config.js`.
