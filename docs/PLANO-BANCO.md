# Plano do Banco — Central Comercial Agenflex

## 1. Objetivo

Este documento registra as regras e decisões relacionadas ao banco de dados da Central Comercial Agenflex.

Parte do plano inicial já foi implementada no Supabase/PostgreSQL.

O documento deve servir para separar:

- estrutura existente;
- regras já protegidas pelo banco;
- funcionalidades que ainda dependem de desenvolvimento;
- evoluções futuras.

---

## 2. Estado atual

O banco já possui as tabelas principais do MVP:

```text
public.perfis
public.propostas
public.revisoes_proposta
public.itens_revisao