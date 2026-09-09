-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 001_schema.sql
--
-- Responsabilidade:
-- - Criar a estrutura inicial do banco
-- - Complementar auth.users com perfis internos
-- - Criar propostas, revisões e itens
-- - Preservar histórico de revisões enviadas
-- - Manter campos updated_at automaticamente
-- - Criar índices básicos de consulta
-- - Ativar RLS desde a criação das tabelas
--
-- Executar em:
-- Supabase → SQL Editor
--
-- Ordem de execução:
-- 001_schema.sql
-- 002_rls_draft.sql
-- 003_salvar_proposta.sql
--
-- IMPORTANTE:
-- Este arquivo cria a estrutura.
-- As policies detalhadas de RLS ficam no arquivo 002.
-- As funções de salvamento ficam no arquivo 003.
-- =========================================================


-- =========================================================
-- ## 1. TRANSAÇÃO E EXTENSÕES
-- =========================================================

begin;


-- Necessária para funções como gen_random_uuid().
create extension if not exists pgcrypto;


-- =========================================================
-- ## 2. FUNÇÃO GLOBAL DE updated_at
-- =========================================================

-- Atualiza automaticamente a coluna updated_at
-- sempre que um registro protegido por trigger
-- sofrer UPDATE.

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
-- ## 3. PERFIS DE USUÁRIO
-- =========================================================

-- Complementa auth.users com informações internas
-- específicas da Central Comercial.
--
-- Relação:
--
-- auth.users.id
--      ↓
-- public.perfis.user_id
--
-- tipo_acesso:
-- - vendedor
-- - adm

create table if not exists public.perfis (

  user_id uuid primary key
    references auth.users(id)
    on delete cascade,


  nome text not null,

  email text not null,


  tipo_acesso text not null default 'vendedor'
    check (
      tipo_acesso in (
        'vendedor',
        'adm'
      )
    ),


  ativo boolean not null default true,


  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);


-- ---------------------------------------------------------
-- ## 3.1 Trigger de updated_at dos perfis
-- ---------------------------------------------------------

drop trigger if exists
  trg_perfis_updated_at
on public.perfis;


create trigger trg_perfis_updated_at

before update
on public.perfis

for each row

execute function public.set_updated_at();


-- =========================================================
-- ## 4. PROPOSTAS
-- =========================================================

-- Registro principal, ou "pai", da proposta.
--
-- Uma proposta pode possuir várias revisões:
--
-- Proposta
-- ├── R0
-- ├── R1
-- └── R2
--
-- revisao_atual indica qual revisão é a mais recente.

create table if not exists public.propostas (

  id uuid primary key
    default gen_random_uuid(),


  numero bigint
    generated always as identity
    unique,


  criado_por uuid not null
    references public.perfis(user_id)
    on delete restrict,


  -- Caso a proposta tenha surgido futuramente
  -- de uma operação "Duplicar proposta",
  -- este campo registra a proposta original.

  origem_proposta_id uuid
    references public.propostas(id)
    on delete set null,


  revisao_atual integer not null default 0
    check (
      revisao_atual >= 0
    ),


  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);


-- ---------------------------------------------------------
-- ## 4.1 Trigger de updated_at das propostas
-- ---------------------------------------------------------

drop trigger if exists
  trg_propostas_updated_at
on public.propostas;


create trigger trg_propostas_updated_at

before update
on public.propostas

for each row

execute function public.set_updated_at();


-- =========================================================
-- ## 5. REVISÕES DA PROPOSTA
-- =========================================================

-- Cada revisão guarda um snapshot completo
-- das condições comerciais naquele momento.
--
-- Exemplo:
--
-- R0 enviada
-- ↓
-- cliente pede alteração
-- ↓
-- R1 rascunho
--
-- Dessa forma, uma nova revisão não altera
-- os dados históricos da revisão anterior.

create table if not exists public.revisoes_proposta (

  id uuid primary key
    default gen_random_uuid(),


  proposta_id uuid not null
    references public.propostas(id)
    on delete cascade,


  numero_revisao integer not null default 0
    check (
      numero_revisao >= 0
    ),


  -- -------------------------------------------------------
  -- ## 5.1 Identificação da proposta
  -- -------------------------------------------------------

  nome_proposta text not null default '',

  data_proposta date not null default current_date,

  validade text not null default '7 DIAS',


  time_equipe text
    check (
      time_equipe is null
      or
      time_equipe in (
        'revenda',
        'pharma',
        'food'
      )
    ),


  -- -------------------------------------------------------
  -- ## 5.2 Dados do cliente
  -- -------------------------------------------------------

  cliente text not null default '',

  comprador text not null default '',

  cnpj text not null default '',

  inscricao_estadual text not null default '',

  telefone text not null default '',

  email text not null default '',

  endereco text not null default '',

  bairro text not null default '',

  cidade_uf_cep text not null default '',


  -- -------------------------------------------------------
  -- ## 5.3 Condições comerciais
  -- -------------------------------------------------------

  cliche text not null default 'A CALCULAR',

  forma_pagamento text not null
    default '1/30/60 (APÓS ANÁLISE)',

  vendedor_nome text not null default '',

  projeto text not null default '',

  previsao_faturamento date,

  destinacao text not null default '',

  frete text not null default '',

  regras_comerciais text not null default '',

  mostrar_totais_pdf boolean not null default true,


  -- -------------------------------------------------------
  -- ## 5.4 Fluxo da revisão
  -- -------------------------------------------------------

  status text not null default 'rascunho'
    check (
      status in (
        'rascunho',
        'enviada'
      )
    ),


  criado_por uuid not null
    references public.perfis(user_id)
    on delete restrict,


  enviado_em timestamptz,


  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),


  -- Impede duas revisões com o mesmo número
  -- dentro da mesma proposta.

  unique (
    proposta_id,
    numero_revisao
  )

);


-- ---------------------------------------------------------
-- ## 5.5 Trigger de updated_at das revisões
-- ---------------------------------------------------------

drop trigger if exists
  trg_revisoes_updated_at
on public.revisoes_proposta;


create trigger trg_revisoes_updated_at

before update
on public.revisoes_proposta

for each row

execute function public.set_updated_at();


-- =========================================================
-- ## 6. SINCRONIZAÇÃO DA REVISÃO ATUAL
-- =========================================================

-- Sempre que uma nova revisão é criada,
-- propostas.revisao_atual recebe o maior
-- número de revisão existente.

create or replace function public.sync_revisao_atual()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  update public.propostas

     set revisao_atual =
           greatest(
             revisao_atual,
             new.numero_revisao
           ),

         updated_at =
           now()

   where id =
     new.proposta_id;


  return new;

end;
$$;


drop trigger if exists
  trg_sync_revisao_atual
on public.revisoes_proposta;


create trigger trg_sync_revisao_atual

after insert
on public.revisoes_proposta

for each row

execute function public.sync_revisao_atual();


-- =========================================================
-- ## 7. PROTEÇÃO DE REVISÕES ENVIADAS
-- =========================================================

-- Regra:
--
-- RASCUNHO
-- → pode ser alterado
--
-- ENVIADA
-- → vira histórico imutável
--
-- Se o cliente pedir mudança após o envio,
-- deverá ser criada uma nova revisão.

create or replace function public.proteger_revisao_enviada()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  -- -------------------------------------------------------
  -- ## 7.1 Proteção contra DELETE
  -- -------------------------------------------------------

  if tg_op = 'DELETE' then

    if old.status = 'enviada' then

      raise exception
        'Uma revisão enviada não pode ser excluída. Crie uma nova revisão.';

    end if;


    return old;

  end if;


  -- -------------------------------------------------------
  -- ## 7.2 Proteção contra UPDATE
  -- -------------------------------------------------------

  if
    tg_op = 'UPDATE'
    and
    old.status = 'enviada'
  then

    raise exception
      'Uma revisão enviada não pode ser alterada. Crie uma nova revisão.';

  end if;


  -- -------------------------------------------------------
  -- ## 7.3 Registro automático da data de envio
  -- -------------------------------------------------------

  if
    new.status = 'enviada'
    and
    new.enviado_em is null
  then

    new.enviado_em =
      now();

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_proteger_revisao_enviada
on public.revisoes_proposta;


create trigger trg_proteger_revisao_enviada

before insert or update or delete
on public.revisoes_proposta

for each row

execute function public.proteger_revisao_enviada();


-- =========================================================
-- ## 8. ITENS DE CADA REVISÃO
-- =========================================================

-- Cada revisão possui sua própria lista de itens.
--
-- Portanto:
--
-- R0
-- └── itens próprios
--
-- R1
-- └── itens próprios
--
-- Isso permite preservar integralmente o histórico
-- comercial de cada revisão.

create table if not exists public.itens_revisao (

  id uuid primary key
    default gen_random_uuid(),


  revisao_id uuid not null
    references public.revisoes_proposta(id)
    on delete cascade,


  ordem integer not null default 0,


  codigo text not null default '',

  produto text not null default '',

  observacoes text not null default '',

  ncm text not null default '',


  quantidade numeric(16,4)
    not null
    default 0,


  unidade text not null default 'UN'
    check (
      unidade in (
        'UN',
        'PCT'
      )
    ),


  valor_unitario numeric(16,6)
    not null
    default 0,


  ipi_percentual numeric(8,4)
    not null
    default 9.75,


  -- -------------------------------------------------------
  -- ## 8.1 Campos calculados automaticamente pelo banco
  -- -------------------------------------------------------

  subtotal numeric(18,6)
    generated always as (
      quantidade * valor_unitario
    )
    stored,


  valor_total numeric(18,6)
    generated always as (
      (
        quantidade *
        valor_unitario
      )
      *
      (
        1 +
        (
          ipi_percentual / 100
        )
      )
    )
    stored,


  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);


-- ---------------------------------------------------------
-- ## 8.2 Trigger de updated_at dos itens
-- ---------------------------------------------------------

drop trigger if exists
  trg_itens_updated_at
on public.itens_revisao;


create trigger trg_itens_updated_at

before update
on public.itens_revisao

for each row

execute function public.set_updated_at();


-- =========================================================
-- ## 9. PROTEÇÃO DOS ITENS DE REVISÕES ENVIADAS
-- =========================================================

-- Se a revisão estiver enviada:
--
-- INSERT → bloqueado
-- UPDATE → bloqueado
-- DELETE → bloqueado

create or replace function public.proteger_itens_revisao_enviada()
returns trigger
language plpgsql
set search_path = public
as $$
declare

  revisao_antiga uuid;

  revisao_nova uuid;

begin

  -- -------------------------------------------------------
  -- ## 9.1 DELETE
  -- -------------------------------------------------------

  if tg_op = 'DELETE' then

    revisao_antiga =
      old.revisao_id;


    if exists (

      select 1

      from public.revisoes_proposta r

      where r.id =
        revisao_antiga

        and

        r.status =
        'enviada'

    ) then

      raise exception
        'Itens de uma revisão enviada não podem ser excluídos.';

    end if;


    return old;

  end if;


  -- -------------------------------------------------------
  -- ## 9.2 INSERT
  -- -------------------------------------------------------

  if tg_op = 'INSERT' then

    revisao_nova =
      new.revisao_id;


    if exists (

      select 1

      from public.revisoes_proposta r

      where r.id =
        revisao_nova

        and

        r.status =
        'enviada'

    ) then

      raise exception
        'Não é possível adicionar itens a uma revisão enviada.';

    end if;


    return new;

  end if;


  -- -------------------------------------------------------
  -- ## 9.3 UPDATE
  -- -------------------------------------------------------

  -- Protege tanto a revisão de origem
  -- quanto a revisão de destino.

  revisao_antiga =
    old.revisao_id;


  revisao_nova =
    new.revisao_id;


  if exists (

    select 1

    from public.revisoes_proposta r

    where r.id in (
      revisao_antiga,
      revisao_nova
    )

    and

    r.status =
    'enviada'

  ) then

    raise exception
      'Itens de uma revisão enviada não podem ser alterados.';

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_proteger_itens_enviados
on public.itens_revisao;


create trigger trg_proteger_itens_enviados

before insert or update or delete
on public.itens_revisao

for each row

execute function public.proteger_itens_revisao_enviada();


-- =========================================================
-- ## 10. ÍNDICES
-- =========================================================

-- Facilitam consultas frequentes sem alterar
-- a estrutura lógica das tabelas.


-- ---------------------------------------------------------
-- ## 10.1 Índices de propostas
-- ---------------------------------------------------------

create index if not exists
  idx_propostas_criado_por
on public.propostas(
  criado_por
);


create index if not exists
  idx_propostas_created_at
on public.propostas(
  created_at desc
);


-- ---------------------------------------------------------
-- ## 10.2 Índices de revisões
-- ---------------------------------------------------------

create index if not exists
  idx_revisoes_proposta_id
on public.revisoes_proposta(
  proposta_id
);


create index if not exists
  idx_revisoes_cnpj
on public.revisoes_proposta(
  cnpj
);


create index if not exists
  idx_revisoes_vendedor
on public.revisoes_proposta(
  vendedor_nome
);


create index if not exists
  idx_revisoes_created_at
on public.revisoes_proposta(
  created_at desc
);


-- ---------------------------------------------------------
-- ## 10.3 Índices dos itens
-- ---------------------------------------------------------

create index if not exists
  idx_itens_revisao_id
on public.itens_revisao(
  revisao_id
);


create index if not exists
  idx_itens_revisao_ordem
on public.itens_revisao(
  revisao_id,
  ordem
);


-- =========================================================
-- ## 11. SEGURANÇA INICIAL / RLS
-- =========================================================

-- O Row Level Security é ativado desde a criação
-- da estrutura.
--
-- As policies específicas são criadas no arquivo:
--
-- 002_rls_draft.sql


-- ---------------------------------------------------------
-- ## 11.1 Ativação do RLS
-- ---------------------------------------------------------

alter table public.perfis
  enable row level security;


alter table public.propostas
  enable row level security;


alter table public.revisoes_proposta
  enable row level security;


alter table public.itens_revisao
  enable row level security;


-- ---------------------------------------------------------
-- ## 11.2 Bloqueio para usuários anônimos
-- ---------------------------------------------------------

revoke all
on public.perfis
from anon;


revoke all
on public.propostas
from anon;


revoke all
on public.revisoes_proposta
from anon;


revoke all
on public.itens_revisao
from anon;


-- ---------------------------------------------------------
-- ## 11.3 Privilégios básicos para authenticated
-- ---------------------------------------------------------

-- Estes GRANTs não ignoram o RLS.
--
-- O usuário possui permissão SQL básica,
-- mas as policies continuam decidindo
-- quais linhas ele poderá acessar.

grant
  select,
  insert,
  update,
  delete
on public.perfis
to authenticated;


grant
  select,
  insert,
  update,
  delete
on public.propostas
to authenticated;


grant
  select,
  insert,
  update,
  delete
on public.revisoes_proposta
to authenticated;


grant
  select,
  insert,
  update,
  delete
on public.itens_revisao
to authenticated;


-- Necessário para utilização das sequences,
-- incluindo a numeração automática das propostas.

grant usage, select
on all sequences
in schema public
to authenticated;


-- =========================================================
-- ## 12. FINALIZAÇÃO DA TRANSAÇÃO
-- =========================================================

commit;