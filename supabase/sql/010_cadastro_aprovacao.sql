-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 010_cadastro_aprovacao.sql
--
-- Objetivo:
-- - Criar perfil automaticamente quando alguém se cadastra
-- - Novos cadastros entram como VENDEDOR INATIVO
-- - Gestor/ADM podem aprovar ou bloquear vendedores
-- - Gestor NÃO pode promover usuários para gestor/adm
-- - ADM continua responsável por mudança de perfil
-- =========================================================

begin;


-- =========================================================
-- ## 1. CRIAÇÃO AUTOMÁTICA DO PERFIL
-- =========================================================

create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

  v_nome text;

begin

  v_nome :=
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'nome',
          ''
        )
      ),
      ''
    );

  if v_nome is null then
    v_nome :=
      split_part(
        coalesce(new.email, 'Usuário'),
        '@',
        1
      );
  end if;


  insert into public.perfis (
    user_id,
    nome,
    email,
    tipo_acesso,
    ativo
  )
  values (
    new.id,
    v_nome,
    coalesce(new.email, ''),
    'vendedor',
    false
  )
  on conflict (user_id)
  do nothing;


  return new;

end;
$$;


-- =========================================================
-- ## 2. TRIGGER NO SUPABASE AUTH
-- =========================================================

drop trigger if exists
  trg_criar_perfil_novo_usuario
on auth.users;

create trigger
  trg_criar_perfil_novo_usuario
after insert
on auth.users
for each row
execute function public.criar_perfil_novo_usuario();


-- =========================================================
-- ## 3. APROVAR / BLOQUEAR VENDEDOR
-- =========================================================

create or replace function public.definir_acesso_vendedor(
  p_user_id uuid,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

  v_perfil public.perfis%rowtype;

begin

  -- -------------------------------------------------------
  -- ## 3.1 Usuário autenticado
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- ## 3.2 Somente Gestor / ADM
  -- -------------------------------------------------------

  if not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode aprovar ou bloquear vendedores.';

  end if;


  -- -------------------------------------------------------
  -- ## 3.3 Usuário alvo precisa existir
  -- -------------------------------------------------------

  select *
  into v_perfil
  from public.perfis
  where user_id = p_user_id;


  if not found then

    raise exception
      'Usuário não encontrado.';

  end if;


  -- -------------------------------------------------------
  -- ## 3.4 Gestor só administra VENDEDOR
  -- -------------------------------------------------------

  if v_perfil.tipo_acesso <> 'vendedor' then

    raise exception
      'Esta operação é permitida apenas para usuários vendedores.';

  end if;


  -- -------------------------------------------------------
  -- ## 3.5 Atualizar acesso
  -- -------------------------------------------------------

  update public.perfis
  set ativo = coalesce(
    p_ativo,
    false
  )
  where user_id = p_user_id
  returning *
  into v_perfil;


  -- -------------------------------------------------------
  -- ## 3.6 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(
    'user_id',
    v_perfil.user_id,
    'nome',
    v_perfil.nome,
    'email',
    v_perfil.email,
    'tipo_acesso',
    v_perfil.tipo_acesso,
    'ativo',
    v_perfil.ativo
  );

end;
$$;


-- =========================================================
-- ## 4. ALTERAÇÃO DE PERFIL - SOMENTE ADM
-- =========================================================

create or replace function public.definir_tipo_acesso(
  p_user_id uuid,
  p_tipo_acesso text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

  v_perfil public.perfis%rowtype;
  v_tipo text;

begin

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  if not public.usuario_adm() then

    raise exception
      'Apenas ADM pode alterar o tipo de acesso.';

  end if;


  v_tipo :=
    lower(
      trim(
        coalesce(
          p_tipo_acesso,
          ''
        )
      )
    );


  if v_tipo not in (
    'vendedor',
    'gestor',
    'adm'
  ) then

    raise exception
      'Tipo de acesso inválido.';

  end if;


  update public.perfis
  set tipo_acesso = v_tipo
  where user_id = p_user_id
  returning *
  into v_perfil;


  if not found then

    raise exception
      'Usuário não encontrado.';

  end if;


  return jsonb_build_object(
    'user_id',
    v_perfil.user_id,
    'nome',
    v_perfil.nome,
    'email',
    v_perfil.email,
    'tipo_acesso',
    v_perfil.tipo_acesso,
    'ativo',
    v_perfil.ativo
  );

end;
$$;


-- =========================================================
-- ## 5. PERMISSÕES DAS RPCs
-- =========================================================

revoke all
on function public.definir_acesso_vendedor(
  uuid,
  boolean
)
from public;

revoke all
on function public.definir_tipo_acesso(
  uuid,
  text
)
from public;


grant execute
on function public.definir_acesso_vendedor(
  uuid,
  boolean
)
to authenticated;

grant execute
on function public.definir_tipo_acesso(
  uuid,
  text
)
to authenticated;


commit;


-- =========================================================
-- ## 6. VERIFICAÇÕES
-- =========================================================

-- 6.1 Trigger de criação automática de perfil.

select
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table
from information_schema.triggers
where trigger_name =
  'trg_criar_perfil_novo_usuario';


-- 6.2 RPCs de administração.

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'definir_acesso_vendedor',
    'definir_tipo_acesso'
  )
order by routine_name;
