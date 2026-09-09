-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 007_criar_nova_revisao.sql
--
-- Responsabilidade:
-- - Criar uma nova revisão a partir da revisão atual
-- - Exigir que a revisão anterior esteja ENVIADA
-- - Copiar dados e itens da revisão anterior
-- - Criar a nova revisão como RASCUNHO
-- - Atualizar propostas.revisao_atual
--
-- Exemplo:
--
-- R0 ENVIADA
-- ↓
-- criar_nova_revisao()
-- ↓
-- R1 RASCUNHO
--
-- Depois:
--
-- R1 ENVIADA
-- ↓
-- R2 RASCUNHO
--
-- Não existe limite fixo de revisões.
-- =========================================================


-- =========================================================
-- ## 1. INÍCIO DA TRANSAÇÃO
-- =========================================================

begin;


-- =========================================================
-- ## 2. RPC — CRIAR NOVA REVISÃO
-- =========================================================

create or replace function public.criar_nova_revisao(

  p_proposta_id uuid

)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare

  -- -------------------------------------------------------
  -- Usuário
  -- -------------------------------------------------------

  v_user uuid :=
    auth.uid();


  -- -------------------------------------------------------
  -- Proposta
  -- -------------------------------------------------------

  v_numero bigint;

  v_revisao_atual integer;


  -- -------------------------------------------------------
  -- Revisão anterior
  -- -------------------------------------------------------

  v_revisao_anterior_id uuid;

  v_status_anterior text;


  -- -------------------------------------------------------
  -- Nova revisão
  -- -------------------------------------------------------

  v_numero_nova_revisao integer;

  v_nova_revisao_id uuid;

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
  -- ## 2.4 CARREGAR E BLOQUEAR A PROPOSTA
  -- =======================================================

  -- FOR UPDATE impede que duas novas revisões sejam
  -- criadas simultaneamente para a mesma proposta.

  select

    numero,

    revisao_atual

  into

    v_numero,

    v_revisao_atual

  from public.propostas

  where id =
    p_proposta_id

  for update;


  if not found then

    raise exception
      'Proposta não encontrada.';

  end if;


  -- =======================================================
  -- ## 2.5 LOCALIZAR A REVISÃO ATUAL
  -- =======================================================

  select

    id,

    status

  into

    v_revisao_anterior_id,

    v_status_anterior

  from public.revisoes_proposta

  where proposta_id =
    p_proposta_id

    and numero_revisao =
      v_revisao_atual

  for update;


  if not found then

    raise exception
      'A revisão atual da proposta não foi encontrada.';

  end if;


  -- =======================================================
  -- ## 2.6 EXIGIR REVISÃO ANTERIOR ENVIADA
  -- =======================================================

  if
    v_status_anterior <>
    'enviada'
  then

    raise exception
      'A revisão atual precisa estar enviada antes de criar uma nova revisão.';

  end if;


  -- =======================================================
  -- ## 2.7 CALCULAR O PRÓXIMO NÚMERO
  -- =======================================================

  v_numero_nova_revisao :=
    v_revisao_atual + 1;


  -- =======================================================
  -- ## 2.8 PROTEÇÃO CONTRA REVISÃO DUPLICADA
  -- =======================================================

  if exists (

    select 1

    from public.revisoes_proposta

    where proposta_id =
      p_proposta_id

      and numero_revisao =
        v_numero_nova_revisao

  ) then

    raise exception
      'A próxima revisão desta proposta já existe.';

  end if;


  -- =======================================================
  -- ## 2.9 COPIAR DADOS PARA A NOVA REVISÃO
  -- =======================================================

  insert into public.revisoes_proposta (

    proposta_id,

    numero_revisao,

    nome_proposta,

    data_proposta,

    validade,

    time_equipe,

    cliente,

    comprador,

    cnpj,

    inscricao_estadual,

    telefone,

    email,

    endereco,

    bairro,

    cidade_uf_cep,

    cliche,

    forma_pagamento,

    vendedor_nome,

    projeto,

    previsao_faturamento,

    destinacao,

    frete,

    regras_comerciais,

    mostrar_totais_pdf,

    status,

    criado_por

  )

  select

    p_proposta_id,

    v_numero_nova_revisao,

    nome_proposta,

    data_proposta,

    validade,

    time_equipe,

    cliente,

    comprador,

    cnpj,

    inscricao_estadual,

    telefone,

    email,

    endereco,

    bairro,

    cidade_uf_cep,

    cliche,

    forma_pagamento,

    vendedor_nome,

    projeto,

    previsao_faturamento,

    destinacao,

    frete,

    regras_comerciais,

    mostrar_totais_pdf,

    'rascunho',

    v_user

  from public.revisoes_proposta

  where id =
    v_revisao_anterior_id

  returning id
  into v_nova_revisao_id;


  -- =======================================================
  -- ## 2.10 COPIAR ITENS DA REVISÃO ANTERIOR
  -- =======================================================

  insert into public.itens_revisao (

    revisao_id,

    ordem,

    codigo,

    produto,

    observacoes,

    ncm,

    quantidade,

    unidade,

    valor_unitario,

    ipi_percentual

  )

  select

    v_nova_revisao_id,

    ordem,

    codigo,

    produto,

    observacoes,

    ncm,

    quantidade,

    unidade,

    valor_unitario,

    ipi_percentual

  from public.itens_revisao

  where revisao_id =
    v_revisao_anterior_id;


  -- =======================================================
  -- ## 2.11 ATUALIZAR REVISÃO ATUAL DA PROPOSTA
  -- =======================================================

  update public.propostas

  set revisao_atual =
    v_numero_nova_revisao

  where id =
    p_proposta_id;


  -- =======================================================
  -- ## 2.12 RETORNO PARA O FRONTEND
  -- =======================================================

  return jsonb_build_object(

    'proposta_id',
    p_proposta_id,

    'numero',
    v_numero,

    'revisao_anterior_id',
    v_revisao_anterior_id,

    'numero_revisao_anterior',
    v_revisao_atual,

    'revisao_id',
    v_nova_revisao_id,

    'numero_revisao',
    v_numero_nova_revisao,

    'status',
    'rascunho'

  );

end;
$$;


-- =========================================================
-- ## 3. PERMISSÕES
-- =========================================================

revoke all
on function public.criar_nova_revisao(
  uuid
)
from public;


grant execute
on function public.criar_nova_revisao(
  uuid
)
to authenticated;


-- =========================================================
-- ## 4. FINALIZAÇÃO
-- =========================================================

commit;