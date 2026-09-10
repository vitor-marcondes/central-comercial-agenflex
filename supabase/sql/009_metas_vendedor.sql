-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 009_metas_vendedor.sql
--
-- Objetivo:
-- - Criar metas mensais por vendedor
-- - Vendedor lê somente a própria meta
-- - Gestor e ADM leem todas as metas
-- - Gestor e ADM podem cadastrar/alterar metas
-- - Garantir uma única meta por vendedor/mês/ano
-- =========================================================

begin;


-- =========================================================
-- ## 1. FUNÇÃO AUXILIAR: VALIDAR VENDEDOR
-- =========================================================

create or replace function public.usuario_e_vendedor(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.user_id = p_user_id
      and p.tipo_acesso = 'vendedor'
  );
$$;

revoke all
on function public.usuario_e_vendedor(uuid)
from public;

grant execute
on function public.usuario_e_vendedor(uuid)
to authenticated;


-- =========================================================
-- ## 2. TABELA DE METAS
-- =========================================================

create table if not exists public.metas_vendedor (

  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references public.perfis(user_id)
    on delete cascade,

  ano integer not null
    check (
      ano between 2020 and 2100
    ),

  mes integer not null
    check (
      mes between 1 and 12
    ),

  meta_valor numeric(16,2) not null
    default 0
    check (
      meta_valor >= 0
    ),

  criado_por uuid
    references public.perfis(user_id)
    on delete set null,

  atualizado_por uuid
    references public.perfis(user_id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint metas_vendedor_usuario_mes_unico
    unique (
      user_id,
      ano,
      mes
    )
);


-- =========================================================
-- ## 3. UPDATED_AT AUTOMÁTICO
-- =========================================================

drop trigger if exists trg_metas_vendedor_updated_at
on public.metas_vendedor;

create trigger trg_metas_vendedor_updated_at
before update
on public.metas_vendedor
for each row
execute function public.set_updated_at();


-- =========================================================
-- ## 4. ÍNDICES
-- =========================================================

create index if not exists idx_metas_vendedor_periodo
on public.metas_vendedor (
  ano,
  mes
);

create index if not exists idx_metas_vendedor_user_id
on public.metas_vendedor (
  user_id
);


-- =========================================================
-- ## 5. SEGURANÇA / RLS
-- =========================================================

alter table public.metas_vendedor
enable row level security;

revoke all
on public.metas_vendedor
from anon;

grant
  select,
  insert,
  update,
  delete
on public.metas_vendedor
to authenticated;


-- =========================================================
-- ## 6. LIMPAR POLICIES ANTIGAS
-- =========================================================

drop policy if exists "metas_vendedor_select"
on public.metas_vendedor;

drop policy if exists "metas_vendedor_insert"
on public.metas_vendedor;

drop policy if exists "metas_vendedor_update"
on public.metas_vendedor;

drop policy if exists "metas_vendedor_delete"
on public.metas_vendedor;


-- =========================================================
-- ## 7. RLS - LEITURA
-- =========================================================

-- VENDEDOR:
-- lê somente a própria meta.
--
-- GESTOR / ADM:
-- leem todas as metas.

create policy "metas_vendedor_select"
on public.metas_vendedor
for select
to authenticated
using (
  public.usuario_gestor_ou_adm()
  or (
    public.usuario_ativo()
    and user_id = auth.uid()
  )
);


-- =========================================================
-- ## 8. RLS - CADASTRO
-- =========================================================

-- Somente GESTOR / ADM podem cadastrar meta.
-- A meta obrigatoriamente precisa pertencer a um VENDEDOR.

create policy "metas_vendedor_insert"
on public.metas_vendedor
for insert
to authenticated
with check (
  public.usuario_gestor_ou_adm()
  and public.usuario_e_vendedor(
    user_id
  )
);


-- =========================================================
-- ## 9. RLS - ALTERAÇÃO
-- =========================================================

create policy "metas_vendedor_update"
on public.metas_vendedor
for update
to authenticated
using (
  public.usuario_gestor_ou_adm()
)
with check (
  public.usuario_gestor_ou_adm()
  and public.usuario_e_vendedor(
    user_id
  )
);


-- =========================================================
-- ## 10. RLS - EXCLUSÃO
-- =========================================================

create policy "metas_vendedor_delete"
on public.metas_vendedor
for delete
to authenticated
using (
  public.usuario_gestor_ou_adm()
);


-- =========================================================
-- ## 11. RPC PARA CADASTRAR / ALTERAR META
-- =========================================================

create or replace function public.salvar_meta_vendedor(
  p_user_id uuid,
  p_ano integer,
  p_mes integer,
  p_meta_valor numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_meta public.metas_vendedor%rowtype;

begin

  -- -------------------------------------------------------
  -- ## 11.1 Usuário logado
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- ## 11.2 Permissão
  -- -------------------------------------------------------

  if not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode alterar metas.';

  end if;


  -- -------------------------------------------------------
  -- ## 11.3 Validar vendedor
  -- -------------------------------------------------------

  if not public.usuario_e_vendedor(
    p_user_id
  ) then

    raise exception
      'A meta deve pertencer a um usuário do tipo vendedor.';

  end if;


  -- -------------------------------------------------------
  -- ## 11.4 Validar período
  -- -------------------------------------------------------

  if p_ano is null
     or p_ano < 2020
     or p_ano > 2100 then

    raise exception
      'Ano inválido.';

  end if;


  if p_mes is null
     or p_mes < 1
     or p_mes > 12 then

    raise exception
      'Mês inválido.';

  end if;


  -- -------------------------------------------------------
  -- ## 11.5 Validar valor
  -- -------------------------------------------------------

  if p_meta_valor is null
     or p_meta_valor < 0 then

    raise exception
      'A meta não pode ser negativa.';

  end if;


  -- -------------------------------------------------------
  -- ## 11.6 Inserir ou atualizar
  -- -------------------------------------------------------

  insert into public.metas_vendedor (

    user_id,
    ano,
    mes,
    meta_valor,
    criado_por,
    atualizado_por

  )
  values (

    p_user_id,
    p_ano,
    p_mes,
    p_meta_valor,
    auth.uid(),
    auth.uid()

  )

  on conflict (
    user_id,
    ano,
    mes
  )

  do update
  set

    meta_valor =
      excluded.meta_valor,

    atualizado_por =
      auth.uid()

  returning *
  into v_meta;


  -- -------------------------------------------------------
  -- ## 11.7 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'id',
    v_meta.id,

    'user_id',
    v_meta.user_id,

    'ano',
    v_meta.ano,

    'mes',
    v_meta.mes,

    'meta_valor',
    v_meta.meta_valor,

    'updated_at',
    v_meta.updated_at

  );

end;
$$;


revoke all
on function public.salvar_meta_vendedor(
  uuid,
  integer,
  integer,
  numeric
)
from public;

grant execute
on function public.salvar_meta_vendedor(
  uuid,
  integer,
  integer,
  numeric
)
to authenticated;


commit;


-- =========================================================
-- ## 12. VERIFICAÇÕES
-- =========================================================

-- 12.1 A tabela deve existir.

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'metas_vendedor';


-- 12.2 Deve mostrar 4 policies.

select
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'metas_vendedor'
order by policyname;


-- 12.3 A RPC deve existir.

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'salvar_meta_vendedor';


-- 12.4 Constraint única vendedor + ano + mês.

select
  conname,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.metas_vendedor'::regclass
order by conname;
