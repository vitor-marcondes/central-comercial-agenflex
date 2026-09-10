-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 014_corrigir_criar_proposta_r0.sql
--
-- Objetivo:
-- - Adequar criar_proposta_r0 à arquitetura atual
-- - Executar a transação internamente sem conflito de RLS
-- - Manter autenticação e autorização explícitas
-- - Definir corretamente vendedor_responsavel_id
--
-- Segurança:
-- - A função roda como SECURITY DEFINER
-- - auth.uid() continua identificando o usuário logado
-- - somente usuário autenticado + ativo pode criar
-- - criado_por nunca vem do navegador
-- - vendedor comum é automaticamente o responsável
-- =========================================================


begin;


-- =========================================================
-- ## 1. RECRIAR RPC
-- =========================================================

create or replace function
public.criar_proposta_r0(
  p_revisao jsonb,
  p_itens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$

declare

  -- -------------------------------------------------------
  -- Usuário da sessão Supabase
  -- -------------------------------------------------------

  v_user uuid :=
    auth.uid();


  -- -------------------------------------------------------
  -- Perfil do usuário
  -- -------------------------------------------------------

  v_tipo_acesso text;

  v_usuario_ativo boolean;


  -- -------------------------------------------------------
  -- Origem comercial
  -- -------------------------------------------------------

  v_origem text :=
    lower(
      btrim(
        coalesce(
          p_revisao->>'origem_comercial',
          ''
        )
      )
    );


  -- -------------------------------------------------------
  -- IDs gerados
  -- -------------------------------------------------------

  v_proposta_id uuid;

  v_numero bigint;

  v_revisao_id uuid;


  -- -------------------------------------------------------
  -- Vendedor responsável
  -- -------------------------------------------------------

  v_vendedor_responsavel_id uuid;


begin


  -- =======================================================
  -- ## 2. VALIDAR AUTENTICAÇÃO
  -- =======================================================

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- =======================================================
  -- ## 3. CARREGAR PERFIL
  -- =======================================================

  select

    p.tipo_acesso,

    p.ativo

  into

    v_tipo_acesso,

    v_usuario_ativo

  from public.perfis p

  where p.user_id =
    v_user;


  if not found then

    raise exception
      'Perfil do usuário não encontrado.';

  end if;


  if not coalesce(
    v_usuario_ativo,
    false
  ) then

    raise exception
      'Usuário inativo.';

  end if;


  if v_tipo_acesso not in (
    'vendedor',
    'gestor',
    'adm'
  ) then

    raise exception
      'Perfil sem permissão para criar propostas.';

  end if;


  -- =======================================================
  -- ## 4. DEFINIR VENDEDOR RESPONSÁVEL
  -- =======================================================

  if v_tipo_acesso =
    'vendedor' then

    v_vendedor_responsavel_id :=
      v_user;

  else

    -- Gestor e ADM podem criar proposta sem responsável.
    -- A atribuição poderá ser feita depois pela gestão.

    v_vendedor_responsavel_id :=
      null;

  end if;


  -- =======================================================
  -- ## 5. VALIDAR ORIGEM
  -- =======================================================

  if v_origem not in (

    'leads_mkt',
    'prospeccao',
    'gestao_carteira'

  ) then

    raise exception
      'Informe uma origem comercial válida.';

  end if;


  -- =======================================================
  -- ## 6. CRIAR PROPOSTA-PAI
  -- =======================================================

  insert into public.propostas (

    criado_por,

    vendedor_responsavel_id,

    origem_comercial

  )
  values (

    v_user,

    v_vendedor_responsavel_id,

    v_origem

  )
  returning

    id,

    numero

  into

    v_proposta_id,

    v_numero;


  -- =======================================================
  -- ## 7. CRIAR REVISÃO R0
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
  values (

    v_proposta_id,

    0,


    coalesce(
      p_revisao->>'nome_proposta',
      ''
    ),


    coalesce(
      nullif(
        p_revisao->>'data_proposta',
        ''
      )::date,
      current_date
    ),


    coalesce(
      nullif(
        p_revisao->>'validade',
        ''
      ),
      '7 DIAS'
    ),


    nullif(
      p_revisao->>'time_equipe',
      ''
    ),


    coalesce(
      p_revisao->>'cliente',
      ''
    ),


    coalesce(
      p_revisao->>'comprador',
      ''
    ),


    coalesce(
      p_revisao->>'cnpj',
      ''
    ),


    coalesce(
      p_revisao->>'inscricao_estadual',
      ''
    ),


    coalesce(
      p_revisao->>'telefone',
      ''
    ),


    coalesce(
      p_revisao->>'email',
      ''
    ),


    coalesce(
      p_revisao->>'endereco',
      ''
    ),


    coalesce(
      p_revisao->>'bairro',
      ''
    ),


    coalesce(
      p_revisao->>'cidade_uf_cep',
      ''
    ),


    coalesce(
      nullif(
        p_revisao->>'cliche',
        ''
      ),
      'A CALCULAR'
    ),


    coalesce(
      nullif(
        p_revisao->>'forma_pagamento',
        ''
      ),
      '1/30/60 (APÓS ANÁLISE)'
    ),


    coalesce(
      p_revisao->>'vendedor_nome',
      ''
    ),


    coalesce(
      p_revisao->>'projeto',
      ''
    ),


    nullif(
      p_revisao->>'previsao_faturamento',
      ''
    )::date,


    coalesce(
      p_revisao->>'destinacao',
      ''
    ),


    coalesce(
      p_revisao->>'frete',
      ''
    ),


    coalesce(
      p_revisao->>'regras_comerciais',
      ''
    ),


    coalesce(
      nullif(
        p_revisao->>'mostrar_totais_pdf',
        ''
      )::boolean,
      true
    ),


    'rascunho',

    v_user

  )
  returning id

  into v_revisao_id;


  -- =======================================================
  -- ## 8. CRIAR ITENS DA R0
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

    v_revisao_id,


    (e.ord - 1)::integer,


    coalesce(
      e.item->>'codigo',
      ''
    ),


    coalesce(
      e.item->>'produto',
      ''
    ),


    coalesce(
      e.item->>'observacoes',
      ''
    ),


    coalesce(
      e.item->>'ncm',
      ''
    ),


    coalesce(
      nullif(
        e.item->>'quantidade',
        ''
      )::numeric,
      0
    ),


    case

      when upper(
        coalesce(
          e.item->>'unidade',
          'UN'
        )
      ) in (
        'UN',
        'PCT'
      )

      then upper(
        coalesce(
          e.item->>'unidade',
          'UN'
        )
      )

      else
        'UN'

    end,


    coalesce(
      nullif(
        e.item->>'valor_unitario',
        ''
      )::numeric,
      0
    ),


    coalesce(
      nullif(
        e.item->>'ipi_percentual',
        ''
      )::numeric,
      9.75
    )


  from pg_catalog.jsonb_array_elements(

    coalesce(
      p_itens,
      '[]'::jsonb
    )

  )

  with ordinality
    as e(
      item,
      ord
    );


  -- =======================================================
  -- ## 9. RETORNO
  -- =======================================================

  return jsonb_build_object(

    'proposta_id',
    v_proposta_id,

    'numero',
    v_numero,

    'revisao_id',
    v_revisao_id,

    'numero_revisao',
    0,

    'status',
    'rascunho',

    'origem_comercial',
    v_origem,

    'status_comercial',
    'proposta',

    'vendedor_responsavel_id',
    v_vendedor_responsavel_id

  );


end;
$function$;


-- =========================================================
-- ## 10. PERMISSÕES DA RPC
-- =========================================================

revoke all
on function
public.criar_proposta_r0(
  jsonb,
  jsonb
)
from public;


grant execute
on function
public.criar_proposta_r0(
  jsonb,
  jsonb
)
to authenticated;


commit;


-- =========================================================
-- ## 11. VERIFICAÇÃO
-- =========================================================

select

  p.proname as funcao,

  pg_get_userbyid(
    p.proowner
  ) as proprietario,

  p.prosecdef
    as security_definer,

  p.proconfig
    as configuracoes,

  pg_get_function_identity_arguments(
    p.oid
  ) as argumentos

from pg_proc p

join pg_namespace n

  on n.oid =
    p.pronamespace

where

  n.nspname =
    'public'

  and

  p.proname =
    'criar_proposta_r0';