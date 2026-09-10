-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 012_corrigir_rls_criacao_vendedor.sql
--
-- Objetivo:
-- - Corrigir criação de propostas por VENDEDOR
-- - Garantir autoria correta da proposta
-- - Vincular automaticamente o vendedor responsável
-- - Manter Gestor / ADM com as permissões previstas
-- - Preservar segurança do RLS
--
-- Regra:
-- VENDEDOR
--   criado_por = próprio usuário
--   vendedor_responsavel_id = próprio usuário
--
-- GESTOR / ADM
--   criado_por = usuário autenticado
--   responsável poderá ser administrado separadamente
-- =========================================================

begin;


-- =========================================================
-- ## 1. PREPARAR AUTORIA E RESPONSÁVEL
-- =========================================================

create or replace function
public.preparar_vendedor_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

  v_tipo_usuario_atual text;
  v_ativo_usuario_atual boolean;

  v_tipo_responsavel text;

begin

  -- -------------------------------------------------------
  -- ## 1.1 Identificar usuário atual
  -- -------------------------------------------------------

  if auth.uid() is not null then

    select
      p.tipo_acesso,
      p.ativo

    into
      v_tipo_usuario_atual,
      v_ativo_usuario_atual

    from public.perfis p

    where p.user_id =
      auth.uid();

  end if;


  -- -------------------------------------------------------
  -- ## 1.2 Regras na criação
  -- -------------------------------------------------------

  if tg_op = 'INSERT' then

    if auth.uid() is null then

      raise exception
        'Usuário não autenticado.';

    end if;


    if not coalesce(
      v_ativo_usuario_atual,
      false
    ) then

      raise exception
        'Usuário inativo não pode criar propostas.';

    end if;


    -- -----------------------------------------------------
    -- VENDEDOR
    --
    -- Não confiamos no navegador para definir autoria.
    -- O próprio banco força:
    --
    -- criado_por = usuário logado
    -- responsável = usuário logado
    -- -----------------------------------------------------

    if v_tipo_usuario_atual = 'vendedor' then

      new.criado_por =
        auth.uid();


      new.vendedor_responsavel_id =
        auth.uid();

    end if;


    -- -----------------------------------------------------
    -- GESTOR / ADM
    -- -----------------------------------------------------

    if v_tipo_usuario_atual in (
      'gestor',
      'adm'
    ) then

      if new.criado_por is null then

        new.criado_por =
          auth.uid();

      end if;

    end if;


    -- -----------------------------------------------------
    -- Tipo inválido
    -- -----------------------------------------------------

    if v_tipo_usuario_atual not in (
      'vendedor',
      'gestor',
      'adm'
    ) then

      raise exception
        'Perfil sem permissão para criar propostas.';

    end if;

  end if;


  -- =======================================================
  -- ## 1.3 CRIADOR É IMUTÁVEL
  -- =======================================================

  if tg_op = 'UPDATE'
     and new.criado_por
         is distinct from
         old.criado_por then

    raise exception
      'O criador original da proposta não pode ser alterado.';

  end if;


  -- =======================================================
  -- ## 1.4 VALIDAR RESPONSÁVEL
  -- =======================================================

  if new.vendedor_responsavel_id
     is not null then

    select
      p.tipo_acesso

    into
      v_tipo_responsavel

    from public.perfis p

    where p.user_id =
      new.vendedor_responsavel_id;


    if v_tipo_responsavel
       is distinct from
       'vendedor' then

      raise exception
        'O responsável comercial precisa ser um usuário do tipo vendedor.';

    end if;

  end if;


  -- =======================================================
  -- ## 1.5 TROCA DE RESPONSÁVEL
  -- =======================================================

  if tg_op = 'UPDATE'
     and new.vendedor_responsavel_id
         is distinct from
         old.vendedor_responsavel_id
     and not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode alterar o vendedor responsável.';

  end if;


  return new;

end;
$$;


-- =========================================================
-- ## 2. GARANTIR TRIGGER
-- =========================================================

drop trigger if exists
trg_preparar_vendedor_responsavel
on public.propostas;


create trigger
trg_preparar_vendedor_responsavel

before insert or update

on public.propostas

for each row

execute function
public.preparar_vendedor_responsavel();


-- =========================================================
-- ## 3. RLS - CRIAÇÃO DE PROPOSTA
-- =========================================================

drop policy if exists
"propostas_insert"
on public.propostas;


create policy "propostas_insert"

on public.propostas

for insert

to authenticated

with check (

  public.usuario_ativo()

  and

  criado_por =
    auth.uid()

  and

  (

    vendedor_responsavel_id
      is null

    or

    vendedor_responsavel_id =
      auth.uid()

    or

    public.usuario_gestor_ou_adm()

  )

);


-- =========================================================
-- ## 4. RLS - ATUALIZAÇÃO DE PROPOSTA
-- =========================================================

-- Usamos os campos da própria linha.
--
-- Isso também protege o UPDATE automático realizado
-- quando uma revisão R0/R1/R2 é criada.

drop policy if exists
"propostas_update"
on public.propostas;


create policy "propostas_update"

on public.propostas

for update

to authenticated

using (

  public.usuario_adm()

  or

  (

    public.usuario_ativo()

    and

    (

      criado_por =
        auth.uid()

      or

      vendedor_responsavel_id =
        auth.uid()

    )

  )

)

with check (

  public.usuario_adm()

  or

  (

    public.usuario_ativo()

    and

    (

      criado_por =
        auth.uid()

      or

      vendedor_responsavel_id =
        auth.uid()

    )

  )

);


commit;


-- =========================================================
-- ## 5. VERIFICAÇÃO
-- =========================================================

select

  policyname,

  cmd,

  qual,

  with_check

from pg_policies

where schemaname =
  'public'

  and tablename =
    'propostas'

order by
  policyname;