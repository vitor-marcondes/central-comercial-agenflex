-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 006_enviar_revisao.sql
--
-- Responsabilidade:
-- - Enviar a revisão atual de uma proposta
-- - Alterar o status:
--   rascunho → enviada
-- - Garantir que somente a revisão atual seja enviada
-- - Respeitar RLS e permissões existentes
--
-- IMPORTANTE:
-- O bloqueio de revisões enviadas já é controlado
-- pelos triggers criados anteriormente.
--
-- Esta RPC apenas realiza a transição segura:
--
-- RASCUNHO
-- ↓
-- ENVIADA
-- =========================================================


-- =========================================================
-- ## 1. INÍCIO DA TRANSAÇÃO
-- =========================================================

begin;


-- =========================================================
-- ## 2. RPC — ENVIAR REVISÃO
-- =========================================================

create or replace function public.enviar_revisao(

  p_proposta_id uuid,

  p_revisao_id uuid

)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare

  -- -------------------------------------------------------
  -- Usuário autenticado
  -- -------------------------------------------------------

  v_user uuid :=
    auth.uid();


  -- -------------------------------------------------------
  -- Dados da proposta
  -- -------------------------------------------------------

  v_numero bigint;

  v_revisao_atual integer;


  -- -------------------------------------------------------
  -- Dados da revisão
  -- -------------------------------------------------------

  v_numero_revisao integer;

  v_status text;

  v_enviado_em timestamptz;

begin

  -- =======================================================
  -- ## 2.1 VALIDAR AUTENTICAÇÃO
  -- =======================================================

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- =======================================================
  -- ## 2.2 VALIDAR USUÁRIO ATIVO
  -- =======================================================

  if not public.usuario_ativo() then

    raise exception
      'Usuário inativo.';

  end if;


  -- =======================================================
  -- ## 2.3 VALIDAR ACESSO À PROPOSTA
  -- =======================================================

  if not public.pode_acessar_proposta(
    p_proposta_id
  ) then

    raise exception
      'Sem permissão para acessar esta proposta.';

  end if;


  -- =======================================================
  -- ## 2.4 CARREGAR A PROPOSTA
  -- =======================================================

  select

    numero,

    revisao_atual

  into

    v_numero,

    v_revisao_atual

  from public.propostas

  where id =
    p_proposta_id;


  if not found then

    raise exception
      'Proposta não encontrada.';

  end if;


  -- =======================================================
  -- ## 2.5 CARREGAR E BLOQUEAR A REVISÃO
  -- =======================================================

  -- FOR UPDATE evita que duas operações tentem
  -- enviar a mesma revisão ao mesmo tempo.

  select

    numero_revisao,

    status,

    enviado_em

  into

    v_numero_revisao,

    v_status,

    v_enviado_em

  from public.revisoes_proposta

  where id =
    p_revisao_id

    and proposta_id =
      p_proposta_id

  for update;


  if not found then

    raise exception
      'Revisão não encontrada para esta proposta.';

  end if;


  -- =======================================================
  -- ## 2.6 VALIDAR SE É A REVISÃO ATUAL
  -- =======================================================

  if
    v_numero_revisao <>
    v_revisao_atual
  then

    raise exception
      'Somente a revisão atual da proposta pode ser enviada.';

  end if;


  -- =======================================================
  -- ## 2.7 VALIDAR STATUS DA REVISÃO
  -- =======================================================

  if
    v_status <>
    'rascunho'
  then

    raise exception
      'A revisão atual não está em rascunho.';

  end if;


  -- =======================================================
  -- ## 2.8 ENVIAR A REVISÃO
  -- =======================================================

  -- O trigger existente:
  --
  -- proteger_revisao_enviada
  --
  -- cuidará da proteção da revisão e do enviado_em.

  update public.revisoes_proposta

  set

    status =
      'enviada'

  where id =
    p_revisao_id

    and proposta_id =
      p_proposta_id

  returning

    status,

    enviado_em

  into

    v_status,

    v_enviado_em;


  -- =======================================================
  -- ## 2.9 RETORNO PARA O FRONTEND
  -- =======================================================

  return jsonb_build_object(

    'proposta_id',
    p_proposta_id,

    'numero',
    v_numero,

    'revisao_id',
    p_revisao_id,

    'numero_revisao',
    v_numero_revisao,

    'status',
    v_status,

    'enviado_em',
    v_enviado_em

  );

end;
$$;


-- =========================================================
-- ## 3. PERMISSÕES
-- =========================================================

revoke all
on function public.enviar_revisao(
  uuid,
  uuid
)
from public;


grant execute
on function public.enviar_revisao(
  uuid,
  uuid
)
to authenticated;


-- =========================================================
-- ## 4. FINALIZAÇÃO
-- =========================================================

commit;