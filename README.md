# EAU EM MOVIMENTO

Webmap participativo dos deslocamentos de estudantes de Arquitetura e Urbanismo da UFF. Cada estudante marca a moradia (uma linha reta até a Escola de Arquitetura e Urbanismo, Praia Vermelha) e informa, em minutos, deslocamento diário, aulas, maior dia de aula, trabalho/estágio, trabalho doméstico, leitura, estudos extraclasse e autocuidado (o site exibe horas); o dashboard calcula o sono possível.

- Site estático em `docs/` (GitHub Pages).
- Banco: Supabase. Crie a tabela com `supabase/schema.sql` (banco já existente: rode, em ordem, `migrate_linha_reta.sql` e `migrate_minutos.sql`) e preencha `docs/config.js`.
