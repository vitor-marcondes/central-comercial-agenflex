# Próximos passos — ordem oficial

Não crie `banco.js` e tente ligar tudo de uma vez.

## Etapa 0 — validar a V6.6 organizada

1. Abrir esta pasta no VS Code.
2. Rodar com Live Server.
3. Testar Proposta, PDF, Clichê e Medidas.
4. Confirmar que tudo funciona igual à versão publicada.

## Etapa 1 — criar o projeto Supabase

1. Criar o projeto `Central Comercial Agenflex`.
2. Guardar a senha do banco fora do código.
3. Identificar Project URL e Publishable Key.

## Etapa 2 — banco

Revisar juntos antes de executar:

- `supabase/sql/001_schema.sql`
- `supabase/sql/002_rls_draft.sql`

## Etapa 3 — autenticação

Criar primeiro:

- 1 usuário ADM de teste;
- 1 usuário Vendedor de teste.

Depois ligar `js/services/auth.service.js`.

## Etapa 4 — salvar proposta

Somente depois do login funcionar:

- criar botão Salvar proposta;
- gravar proposta + R0 + itens;
- confirmar os registros no Supabase.

## Etapa 5 — histórico

Adicionar página Histórico com pesquisa, abrir, revisar e duplicar.

## Etapa 6 — produção

Quando estiver estável:

- publicar em subdomínio próprio da empresa;
- deixar GitHub apenas como versionamento privado/backup.
