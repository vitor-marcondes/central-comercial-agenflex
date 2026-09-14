-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 015_times_metas_equipe.sql
--
-- Objetivos:
-- - Vincular vendedores aos Times Pharma / Food / Revenda
-- - Criar meta oficial mensal independente por Time
-- - Permitir Gestor / ADM administrarem Times e metas
-- - Permitir vendedor consultar a meta oficial do próprio Time
--
-- Observação:
-- - A meta oficial do Time NÃO é calculada pela soma
--   das metas individuais.
-- - A soma individual será apenas indicador de distribuição.
-- =========================================================


begin;


-- =========================================================
-- ## 1. TIME DO USUÁRIO
-- =========================================================

alter table public.perfis

add column if not exists
time_equipe text;


-- ---------------------------------------------------------
-- ## 1.1 Constraint do Time
-- ---------------------------------------------------------

alter table public.perfis

drop constraint if exists
perfis_time_equipe_check;


alter table public.perfis

add constraint
perfis_time_equipe_check

check (

  time_equipe is null

  or

  time_equipe in (
    'pharma',
    'food',
    'revenda'
  )

);


-- ---------------------------------------------------------
-- ## 1.2 Índice
-- ---------------------------------------------------------

create index if not exists
idx_perfis_time_equipe

on public.perfis (
  time_equipe
);


-- =========================================================
-- ## 2. META OFICIAL DOS TIMES
-- =========================================================

create table if not exists
public.metas_equipe (

  id uuid
    primary key
    default gen_random_uuid(),


  time_equipe text
    not null,


  ano integer
    not null,


  mes integer
    not null,


  meta_valor numeric(18,2)
    not null
    default 0,


  criado_por uuid
    not null
    references public.perfis(user_id)
    on delete restrict,


  atualizado_por uuid
    not null
    references public.perfis(user_id)
    on delete restrict,


  created_at timestamptz
    not null
    default now(),


  updated_at timestamptz
    not null
    default now(),


  constraint
  metas_equipe_time_check

  check (
    time_equipe in (
      'pharma',
      'food',
      'revenda'
    )
  ),


  constraint
  metas_equipe_mes_check

  check (
    mes between 1 and 12
  ),


  constraint
  metas_equipe_ano_check

  check (
    ano between 2020 and 2100
  ),


  constraint
  metas_equipe_valor_check

  check (
    meta_valor >= 0
  ),


  constraint
  metas_equipe_periodo_unique

  unique (
    time_equipe,
    ano,
    mes
  )

);


-- =========================================================
-- ## 3. UPDATED_AT
-- =========================================================

drop trigger if exists
trg_metas_equipe_updated_at

on public.metas_equipe;


create trigger
trg_metas_equipe_updated_at

before update

on public.metas_equipe

for each row

execute function
public.set_updated_at();


-- =========================================================
-- ## 4. ÍNDICES DA META DE TIME
-- =========================================================

create index if not exists
idx_metas_equipe_periodo

on public.metas_equipe (
  ano,
  mes
);


create index if not exists
idx_metas_equipe_time

on public.metas_equipe (
  time_equipe
);


-- =========================================================
-- ## 5. RLS
-- =========================================================

alter table public.metas_equipe
enable row level security;


revoke all
on public.metas_equipe
from anon;


grant
select,
insert,
update,
delete

on public.metas_equipe

to authenticated;


-- =========================================================
-- ## 6. SELECT DE METAS DE TIME
-- =========================================================

drop policy if exists
"metas_equipe_select"

on public.metas_equipe;


create policy
"metas_equipe_select"

on public.metas_equipe

for select

to authenticated

using (

  -- Gestor / ADM enxergam todos os Times.

  public.usuario_gestor_ou_adm()

  or

  (

    -- Vendedor ativo enxerga apenas
    -- a meta oficial do próprio Time.

    public.usuario_ativo()

    and

    exists (

      select 1

      from public.perfis p

      where
        p.user_id = auth.uid()

        and
        p.ativo = true

        and
        p.tipo_acesso = 'vendedor'

        and
        p.time_equipe =
          metas_equipe.time_equipe

    )

  )

);


-- =========================================================
-- ## 7. BLOQUEAR ALTERAÇÃO DIRETA
-- =========================================================

-- Alterações serão feitas pelas RPCs abaixo.
-- Assim centralizamos validação e auditoria.

drop policy if exists
"metas_equipe_insert"

on public.metas_equipe;


drop policy if exists
"metas_equipe_update"

on public.metas_equipe;


drop policy if exists
"metas_equipe_delete"

on public.metas_equipe;


-- =========================================================
-- ## 8. DEFINIR TIME DE UM VENDEDOR
-- =========================================================

create or replace function
public.definir_time_vendedor(

  p_user_id uuid,

  p_time_equipe text

)
returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_time text :=

    lower(
      btrim(
        coalesce(
          p_time_equipe,
          ''
        )
      )
    );


  v_perfil public.perfis%rowtype;


begin


  -- -------------------------------------------------------
  -- ## 8.1 Autenticação
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.2 Permissão
  -- -------------------------------------------------------

  if not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode definir o Time do vendedor.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.3 Validar Time
  -- -------------------------------------------------------

  if v_time not in (
    'pharma',
    'food',
    'revenda'
  ) then

    raise exception
      'Informe um Time válido: Pharma, Food ou Revenda.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.4 Localizar usuário
  -- -------------------------------------------------------

  select *

  into v_perfil

  from public.perfis

  where user_id =
    p_user_id;


  if not found then

    raise exception
      'Usuário não encontrado.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.5 Somente vendedor
  -- -------------------------------------------------------

  if v_perfil.tipo_acesso
     <> 'vendedor' then

    raise exception
      'O Time comercial deve ser definido para usuários vendedores.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.6 Atualizar
  -- -------------------------------------------------------

  update public.perfis

  set time_equipe =
    v_time

  where user_id =
    p_user_id;


  -- -------------------------------------------------------
  -- ## 8.7 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'user_id',
    p_user_id,

    'nome',
    v_perfil.nome,

    'time_equipe',
    v_time

  );


end;
$$;


-- =========================================================
-- ## 9. SALVAR META OFICIAL DO TIME
-- =========================================================

create or replace function
public.salvar_meta_equipe(

  p_time_equipe text,

  p_ano integer,

  p_mes integer,

  p_meta_valor numeric

)
returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user uuid :=
    auth.uid();


  v_time text :=

    lower(
      btrim(
        coalesce(
          p_time_equipe,
          ''
        )
      )
    );


  v_meta public.metas_equipe%rowtype;


begin


  -- -------------------------------------------------------
  -- ## 9.1 Autenticação
  -- -------------------------------------------------------

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- ## 9.2 Permissão
  -- -------------------------------------------------------

  if not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode definir metas oficiais dos Times.';

  end if;


  -- -------------------------------------------------------
  -- ## 9.3 Validar Time
  -- -------------------------------------------------------

  if v_time not in (
    'pharma',
    'food',
    'revenda'
  ) then

    raise exception
      'Time comercial inválido.';

  end if;


  -- -------------------------------------------------------
  -- ## 9.4 Validar período
  -- -------------------------------------------------------

  if p_mes not between 1 and 12 then

    raise exception
      'Mês inválido.';

  end if;


  if p_ano not between 2020 and 2100 then

    raise exception
      'Ano inválido.';

  end if;


  -- -------------------------------------------------------
  -- ## 9.5 Validar valor
  -- -------------------------------------------------------

  if p_meta_valor is null
     or p_meta_valor < 0 then

    raise exception
      'Informe uma meta válida.';

  end if;


  -- -------------------------------------------------------
  -- ## 9.6 Inserir / atualizar
  -- -------------------------------------------------------

  insert into public.metas_equipe (

    time_equipe,

    ano,

    mes,

    meta_valor,

    criado_por,

    atualizado_por

  )
  values (

    v_time,

    p_ano,

    p_mes,

    p_meta_valor,

    v_user,

    v_user

  )


  on conflict (
    time_equipe,
    ano,
    mes
  )


  do update

  set

    meta_valor =
      excluded.meta_valor,

    atualizado_por =
      v_user,

    updated_at =
      now()


  returning *

  into v_meta;


  -- -------------------------------------------------------
  -- ## 9.7 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'id',
    v_meta.id,

    'time_equipe',
    v_meta.time_equipe,

    'ano',
    v_meta.ano,

    'mes',
    v_meta.mes,

    'meta_valor',
    v_meta.meta_valor

  );


end;
$$;


-- =========================================================
-- ## 10. PERMISSÕES DAS RPCs
-- =========================================================

revoke all
on function
public.definir_time_vendedor(
  uuid,
  text
)
from public;


grant execute
on function
public.definir_time_vendedor(
  uuid,
  text
)
to authenticated;


revoke all
on function
public.salvar_meta_equipe(
  text,
  integer,
  integer,
  numeric
)
from public;


grant execute
on function
public.salvar_meta_equipe(
  text,
  integer,
  integer,
  numeric
)
to authenticated;


commit;


-- =========================================================
-- ## 11. VERIFICAÇÕES
-- =========================================================


-- ---------------------------------------------------------
-- ## 11.1 Coluna do Time
-- ---------------------------------------------------------

select

  column_name,

  data_type,

  is_nullable

from information_schema.columns

where
  table_schema =
    'public'

  and

  table_name =
    'perfis'

  and

  column_name =
    'time_equipe';


-- ---------------------------------------------------------
-- ## 11.2 Tabela de metas oficiais
-- ---------------------------------------------------------

select

  column_name,

  data_type,

  is_nullable

from information_schema.columns

where
  table_schema =
    'public'

  and

  table_name =
    'metas_equipe'

order by
  ordinal_position;


-- ---------------------------------------------------------
-- ## 11.3 Policies
-- ---------------------------------------------------------

select

  policyname,

  cmd,

  qual,

  with_check

from pg_policies

where
  schemaname =
    'public'

  and

  tablename =
    'metas_equipe'

order by
  policyname;


-- ---------------------------------------------------------
-- ## 11.4 Funções
-- ---------------------------------------------------------

select

  routine_name

from information_schema.routines

where
  routine_schema =
    'public'

  and

  routine_name in (

    'definir_time_vendedor',

    'salvar_meta_equipe'

  )

order by
  routine_name;