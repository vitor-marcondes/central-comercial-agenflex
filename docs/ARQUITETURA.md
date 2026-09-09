# Arquitetura Oficial — Central Comercial Agenflex

## 1. Objetivo do documento

Este documento descreve a arquitetura atual da Central Comercial Agenflex.

A Central começou como uma aplicação totalmente frontend, mas atualmente já possui integração com autenticação, banco de dados e serviços externos.

A arquitetura deve continuar modular, permitindo adicionar novos recursos sem concentrar toda a lógica em um único arquivo.

---

## 2. Visão geral da arquitetura

```text
Usuário
  ↓
Navegador
  ↓
Central Comercial
HTML + CSS + JavaScript
  ↓
┌──────────────────────────────┐
│ Services                     │
│                              │
│ Supabase                     │
│ CNPJá                        │
│ futuras APIs                 │
└──────────────────────────────┘
  ↓
Supabase Auth + Data API
  ↓
PostgreSQL