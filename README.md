# EAU EM MOVIMENTO

Webmap participativo dos deslocamentos de estudantes de Arquitetura e Urbanismo da UFF. Cada estudante marca a moradia (uma linha reta até a Escola de Arquitetura e Urbanismo, Praia Vermelha) e informa o deslocamento diário (em minutos) e, em horas por semana, aulas, maior dia de aula, trabalho/estágio, trabalho doméstico, leitura, estudos extraclasse e autocuidado (o site exibe tudo em horas); o dashboard calcula o sono possível.

- Site estático em `docs/` (GitHub Pages).
- Banco: Supabase. Crie a tabela com `supabase/schema.sql` (banco já existente: rode, em ordem, `migrate_linha_reta.sql` e `migrate_minutos.sql`) e preencha `docs/config.js`.
