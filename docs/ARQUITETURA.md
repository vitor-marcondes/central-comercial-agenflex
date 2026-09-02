# Arquitetura oficial — Central Comercial Agenflex

## Estado atual

A V6.6 continua funcionando somente no frontend:

- HTML: telas e formulários.
- CSS: aparência, responsividade e impressão/PDF.
- JavaScript: proposta, clichê, medidas e lógica da interface.
- localStorage: rascunho local atual.

## Próxima arquitetura

```text
Navegador
  ↓
Central Comercial (HTML/CSS/JS)
  ↓
Supabase Auth + Data API
  ↓
PostgreSQL
```

## Login

Dois níveis de acesso:

- `vendedor`
- `adm`

Pharma/Food/Revenda NÃO serão níveis de login. Continuam apenas como escolha de logo/identidade da proposta.

## Prioridade do banco

```text
Login
→ Criar proposta
→ Salvar
→ Fechar
→ Entrar novamente
→ Pesquisar
→ Abrir com os campos preenchidos
```

Depois:

1. editar rascunho;
2. marcar como enviada;
3. criar revisão R0/R1/R2 sem apagar a versão enviada;
4. duplicar proposta como nova proposta;
5. área ADM;
6. levar regras de medidas ao banco;
7. módulo Fator Indicado.

## Artes

As artes NÃO serão armazenadas no Supabase nesta primeira fase. Elas continuam temporárias para geração do PDF e permanecem na pasta compartilhada da empresa.
