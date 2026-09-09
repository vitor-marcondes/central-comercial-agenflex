# Próximos Passos — Central Comercial Agenflex

## 1. Objetivo

Este documento define a ordem oficial de evolução técnica da Central Comercial Agenflex.

A regra principal continua sendo:

> Evoluir por etapas pequenas, testáveis e separadas.

Não criar um arquivo `banco.js` e tentar integrar toda a aplicação de uma vez.

A arquitetura deve continuar dividida entre:

```text
core
modules
services
ui
supabase
docs