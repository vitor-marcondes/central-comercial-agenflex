-- Central Comercial Agenflex
-- 001_schema.sql
-- Estrutura inicial do banco para login, propostas, revisões e itens.
-- Execute no Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- FUNÇÃO PADRÃO PARA updated_at
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- 1) PERFIS
-- Complementa auth.users com dados internos da Central.
-- =========================================================
create table if not exists public.perfis (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  nome text not null,
  email text not null,

  tipo_acesso text not null default 'vendedor'
    check (tipo_acesso in ('vendedor', 'adm')),

  ativo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_perfis_updated_at on public.perfis;
create trigger trg_perfis_updated_at
before update on public.perfis
for each row
execute function public.set_updated_at();

-- =========================================================
-- 2) PROPOSTAS
-- Registro "pai". Cada proposta pode ter R0, R1, R2...
-- =========================================================
create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),

  numero bigint generated always as identity unique,

  criado_por uuid not null
    references public.perfis(user_id)
    on delete restrict,

  -- Se esta proposta nasceu de "Duplicar proposta", registra a origem.
  origem_proposta_id uuid
    references public.propostas(id)
    on delete set null,

  revisao_atual integer not null default 0
    check (revisao_atual >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_propostas_updated_at on public.propostas;
create trigger trg_propostas_updated_at
before update on public.propostas
for each row
execute function public.set_updated_at();

-- =========================================================
-- 3) REVISÕES DA PROPOSTA
-- Snapshot completo dos dados comerciais em cada revisão.
-- =========================================================
create table if not exists public.revisoes_proposta (
  id uuid primary key default gen_random_uuid(),

  proposta_id uuid not null
    references public.propostas(id)
    on delete cascade,

  numero_revisao integer not null default 0
    check (numero_revisao >= 0),

  -- Identificação
  nome_proposta text not null default '',
  data_proposta date not null default current_date,
  validade text not null default '7 DIAS',

  time_equipe text
    check (time_equipe is null or time_equipe in ('revenda', 'pharma', 'food')),

  -- Cliente
  cliente text not null default '',
  comprador text not null default '',
  cnpj text not null default '',
  inscricao_estadual text not null default '',
  telefone text not null default '',
  email text not null default '',
  endereco text not null default '',
  bairro text not null default '',
  cidade_uf_cep text not null default '',

  -- Condições comerciais
  cliche text not null default 'A CALCULAR',
  forma_pagamento text not null default '1/30/60 (APÓS ANÁLISE)',
  vendedor_nome text not null default '',
  projeto text not null default '',
  previsao_faturamento date,
  destinacao text not null default '',
  frete text not null default '',
  regras_comerciais text not null default '',
  mostrar_totais_pdf boolean not null default true,

  -- Fluxo da revisão
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviada')),

  criado_por uuid not null
    references public.perfis(user_id)
    on delete restrict,

  enviado_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (proposta_id, numero_revisao)
);

drop trigger if exists trg_revisoes_updated_at on public.revisoes_proposta;
create trigger trg_revisoes_updated_at
before update on public.revisoes_proposta
for each row
execute function public.set_updated_at();

-- Atualiza propostas.revisao_atual sempre que uma nova revisão for criada.
create or replace function public.sync_revisao_atual()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.propostas
     set revisao_atual = greatest(revisao_atual, new.numero_revisao),
         updated_at = now()
   where id = new.proposta_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_revisao_atual on public.revisoes_proposta;
create trigger trg_sync_revisao_atual
after insert on public.revisoes_proposta
for each row
execute function public.sync_revisao_atual();

-- Depois que uma revisão estiver ENVIADA, ela vira histórico imutável.
create or replace function public.proteger_revisao_enviada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'enviada' then
      raise exception 'Uma revisão enviada não pode ser excluída. Crie uma nova revisão.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'enviada' then
    raise exception 'Uma revisão enviada não pode ser alterada. Crie uma nova revisão.';
  end if;

  if new.status = 'enviada' and new.enviado_em is null then
    new.enviado_em = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_revisao_enviada on public.revisoes_proposta;
create trigger trg_proteger_revisao_enviada
before insert or update or delete on public.revisoes_proposta
for each row
execute function public.proteger_revisao_enviada();

-- =========================================================
-- 4) ITENS DE CADA REVISÃO
-- R0 e R1 têm seus próprios itens para preservar o histórico.
-- =========================================================
create table if not exists public.itens_revisao (
  id uuid primary key default gen_random_uuid(),

  revisao_id uuid not null
    references public.revisoes_proposta(id)
    on delete cascade,

  ordem integer not null default 0,

  codigo text not null default '',
  produto text not null default '',
  observacoes text not null default '',
  ncm text not null default '',

  quantidade numeric(16,4) not null default 0,
  unidade text not null default 'UN'
    check (unidade in ('UN', 'PCT')),

  valor_unitario numeric(16,6) not null default 0,
  ipi_percentual numeric(8,4) not null default 9.75,

  subtotal numeric(18,6)
    generated always as (quantidade * valor_unitario) stored,

  valor_total numeric(18,6)
    generated always as (
      (quantidade * valor_unitario)
      * (1 + (ipi_percentual / 100))
    ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_itens_updated_at on public.itens_revisao;
create trigger trg_itens_updated_at
before update on public.itens_revisao
for each row
execute function public.set_updated_at();

-- Impede adicionar, alterar ou apagar itens de uma revisão já enviada.
create or replace function public.proteger_itens_revisao_enviada()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  revisao_antiga uuid;
  revisao_nova uuid;
begin
  if tg_op = 'DELETE' then
    revisao_antiga := old.revisao_id;

    if exists (
      select 1
      from public.revisoes_proposta r
      where r.id = revisao_antiga
        and r.status = 'enviada'
    ) then
      raise exception 'Itens de uma revisão enviada não podem ser excluídos.';
    end if;

    return old;
  end if;

  if tg_op = 'INSERT' then
    revisao_nova := new.revisao_id;

    if exists (
      select 1
      from public.revisoes_proposta r
      where r.id = revisao_nova
        and r.status = 'enviada'
    ) then
      raise exception 'Não é possível adicionar itens a uma revisão enviada.';
    end if;

    return new;
  end if;

  -- UPDATE: protege tanto a revisão de origem quanto a de destino.
  revisao_antiga := old.revisao_id;
  revisao_nova := new.revisao_id;

  if exists (
    select 1
    from public.revisoes_proposta r
    where r.id in (revisao_antiga, revisao_nova)
      and r.status = 'enviada'
  ) then
    raise exception 'Itens de uma revisão enviada não podem ser alterados.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_itens_enviados on public.itens_revisao;
create trigger trg_proteger_itens_enviados
before insert or update or delete on public.itens_revisao
for each row
execute function public.proteger_itens_revisao_enviada();

-- =========================================================
-- ÍNDICES
-- =========================================================
create index if not exists idx_propostas_criado_por
  on public.propostas(criado_por);

create index if not exists idx_propostas_created_at
  on public.propostas(created_at desc);

create index if not exists idx_revisoes_proposta_id
  on public.revisoes_proposta(proposta_id);

create index if not exists idx_revisoes_cnpj
  on public.revisoes_proposta(cnpj);

create index if not exists idx_revisoes_vendedor
  on public.revisoes_proposta(vendedor_nome);

create index if not exists idx_revisoes_created_at
  on public.revisoes_proposta(created_at desc);

create index if not exists idx_itens_revisao_id
  on public.itens_revisao(revisao_id);

create index if not exists idx_itens_revisao_ordem
  on public.itens_revisao(revisao_id, ordem);

-- =========================================================
-- SEGURANÇA INICIAL
-- RLS fica ligado desde o primeiro dia.
-- As policies serão criadas no próximo passo.
-- =========================================================
alter table public.perfis enable row level security;
alter table public.propostas enable row level security;
alter table public.revisoes_proposta enable row level security;
alter table public.itens_revisao enable row level security;

-- Nada para usuários anônimos.
revoke all on public.perfis from anon;
revoke all on public.propostas from anon;
revoke all on public.revisoes_proposta from anon;
revoke all on public.itens_revisao from anon;

-- Usuários autenticados terão os privilégios básicos,
-- mas o RLS continuará bloqueando até criarmos as policies.
grant select, insert, update, delete on public.perfis to authenticated;
grant select, insert, update, delete on public.propostas to authenticated;
grant select, insert, update, delete on public.revisoes_proposta to authenticated;
grant select, insert, update, delete on public.itens_revisao to authenticated;

grant usage, select on all sequences in schema public to authenticated;

commit;
