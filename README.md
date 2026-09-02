# Central Comercial Agenflex — V6.6 organizada para VS Code

Esta pasta é a base oficial para continuar o projeto e, depois, integrar Supabase sem reescrever toda a Central.

## Estrutura

```text
central-comercial-agenflex-organizado-v6.6/
├── index.html
├── README.md
├── .gitignore
├── central-comercial-agenflex.code-workspace
├── assets/
│   └── logos/
│       ├── agenflex.jpg
│       ├── pharma.png
│       └── food.png
├── css/
│   └── styles.css
├── js/
│   ├── core/
│   │   ├── core.js
│   │   └── init.js
│   ├── modules/
│   │   ├── proposta.js
│   │   ├── cliche.js
│   │   └── medidas.js
│   ├── config/
│   │   └── supabase-config.example.js
│   └── services/
│       ├── supabase-client.js
│       ├── auth.service.js
│       └── propostas.service.js
├── supabase/
│   └── sql/
│       ├── 001_schema.sql
│       └── 002_rls_draft.sql
├── docs/
│   ├── ARQUITETURA.md
│   ├── PLANO-BANCO.md
│   └── PROXIMOS-PASSOS.md
└── backup/
    └── central-comercial-agenflex-v6.6-original.html
```

## O que está funcionando agora

A aplicação continua usando apenas os arquivos funcionais abaixo:

- `index.html`
- `css/styles.css`
- `js/core/core.js`
- `js/modules/proposta.js`
- `js/modules/medidas.js`
- `js/modules/cliche.js`
- `js/core/init.js`

Os arquivos de `js/services/`, `js/config/` e `supabase/sql/` estão preparados para a próxima fase, mas ainda NÃO são carregados pela aplicação.

Isso é proposital: primeiro preservamos a V6.6 funcionando; depois conectamos o banco de forma controlada.

## Como abrir

1. Extraia o ZIP.
2. Abra o VS Code.
3. `File > Open Folder`.
4. Selecione esta pasta.
5. Rode `index.html` usando Live Server.

## Regra importante

Não crie um único `banco.js` gigante. A integração será separada por responsabilidade:

- cliente Supabase;
- autenticação;
- propostas;
- histórico/revisões;
- configurações ADM.

## Segurança

Nunca coloque no frontend ou GitHub:

- `service_role`;
- Secret Key;
- senha do PostgreSQL;
- senhas de usuários.

Apenas a Project URL e a Publishable Key poderão ir para o navegador, sempre com RLS configurado.
