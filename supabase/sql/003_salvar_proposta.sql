-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 003_salvar_proposta.sql
--
-- Responsabilidade:
-- - Criar uma nova proposta com revisão inicial R0
-- - Salvar os itens vinculados à revisão
-- - Atualizar uma revisão enquanto estiver em rascunho
-- - Substituir os itens pelo estado atual do formulário
-- - Executar cada salvamento de forma transacional
--
-- Dependências:
-- - 001_schema.sql
-- - 002_rls_draft.sql
--
-- Funções criadas:
-- - public.criar_proposta_r0(jsonb, jsonb)
-- - public.salvar_rascunho_proposta(
--     uuid,
--     uuid,
--     jsonb,
--     jsonb
--   )
--
-- IMPORTANTE:
-- - As artes NÃO são armazenadas no banco.
-- - As funções utilizam SECURITY INVOKER.
-- - Portanto, continuam respeitando RLS e permissões
--   do usuário autenticado que executou a RPC.
-- =========================================================


-- =========================================================
-- ## 1. INÍCIO DA TRANSAÇÃO
-- =========================================================

begin;


-- =========================================================
-- ## 2. CRIAR NOVA PROPOSTA + R0 + ITENS
-- =========================================================

-- Cria em uma única operação:
--
-- 1. public.propostas
-- 2. public.revisoes_proposta com numero_revisao = 0
-- 3. public.itens_revisao
--
-- Retorna ao frontend:
--
-- proposta_id
-- numero
-- revisao_id
-- numero_revisao
-- status

create or replace function public.criar_proposta_r0(
  p_revisao jsonb,
  p_itens jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_user uuid :=
    auth.uid();


  v_proposta_id uuid;

  v_numero bigint;

  v_revisao_id uuid;

begin

  -- -------------------------------------------------------
  -- ## 2.1 Validação do usuário
  -- -------------------------------------------------------

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  if not public.usuario_ativo() then

    raise exception
      'Usuário inativo.';

  end if;


  -- -------------------------------------------------------
  -- ## 2.2 Criação do registro-pai da proposta
  -- -------------------------------------------------------

  insert into public.propostas (
    criado_por
  )
  values (
    v_user
  )
  returning
    id,
    numero
  into
    v_proposta_id,
    v_numero;


  -- -------------------------------------------------------
  -- ## 2.3 Criação da revisão inicial R0
  -- -------------------------------------------------------

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


  -- -------------------------------------------------------
  -- ## 2.4 Inserção dos itens da revisão
  -- -------------------------------------------------------

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


    -- A ordinality começa em 1.
    -- No banco armazenamos a ordem começando em 0.

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

      else 'UN'

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


  from jsonb_array_elements(
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


  -- -------------------------------------------------------
  -- ## 2.5 Retorno para o frontend
  -- -------------------------------------------------------

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
    'rascunho'

  );

end;
$$;


-- =========================================================
-- ## 3. ATUALIZAR UMA REVISÃO EM RASCUNHO
-- =========================================================

-- Esta função NÃO cria outra proposta.
--
-- Ela atualiza a revisão já vinculada ao formulário.
--
-- Fluxo dos itens:
--
-- itens antigos
-- ↓
-- DELETE
-- ↓
-- estado atual enviado pelo frontend
-- ↓
-- INSERT
--
-- Revisões ENVIADAS não podem ser alteradas.

create or replace function public.salvar_rascunho_proposta(

  p_proposta_id uuid,

  p_revisao_id uuid,

  p_revisao jsonb,

  p_itens jsonb

)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_user uuid :=
    auth.uid();


  v_numero bigint;

  v_numero_revisao integer;

  v_status text;

begin

  -- -------------------------------------------------------
  -- ## 3.1 Validação do usuário
  -- -------------------------------------------------------

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  if not public.usuario_ativo() then

    raise exception
      'Usuário inativo.';

  end if;


  -- -------------------------------------------------------
  -- ## 3.2 Verificação de permissão sobre a proposta
  -- -------------------------------------------------------

  if not public.pode_acessar_proposta(
    p_proposta_id
  ) then

    raise exception
      'Sem permissão para acessar esta proposta.';

  end if;


  -- -------------------------------------------------------
  -- ## 3.3 Localização da proposta e revisão
  -- -------------------------------------------------------

  select

    p.numero,

    r.numero_revisao,

    r.status

  into

    v_numero,

    v_numero_revisao,

    v_status

  from public.propostas p

  join public.revisoes_proposta r

    on r.proposta_id =
       p.id

  where p.id =
    p_proposta_id

    and r.id =
    p_revisao_id;


  -- -------------------------------------------------------
  -- ## 3.4 Validação de existência
  -- -------------------------------------------------------

  if not found then

    raise exception
      'Proposta ou revisão não encontrada.';

  end if;


  -- -------------------------------------------------------
  -- ## 3.5 Proteção contra alteração de revisão enviada
  -- -------------------------------------------------------

  if v_status <> 'rascunho' then

    raise exception
      'Esta revisão já foi enviada. Crie uma nova revisão.';

  end if;


  -- -------------------------------------------------------
  -- ## 3.6 Atualização dos dados da revisão
  -- -------------------------------------------------------

  update public.revisoes_proposta

  set

    nome_proposta =
      coalesce(
        p_revisao->>'nome_proposta',
        ''
      ),


    data_proposta =
      coalesce(
        nullif(
          p_revisao->>'data_proposta',
          ''
        )::date,
        current_date
      ),


    validade =
      coalesce(
        nullif(
          p_revisao->>'validade',
          ''
        ),
        '7 DIAS'
      ),


    time_equipe =
      nullif(
        p_revisao->>'time_equipe',
        ''
      ),


    cliente =
      coalesce(
        p_revisao->>'cliente',
        ''
      ),


    comprador =
      coalesce(
        p_revisao->>'comprador',
        ''
      ),


    cnpj =
      coalesce(
        p_revisao->>'cnpj',
        ''
      ),


    inscricao_estadual =
      coalesce(
        p_revisao->>'inscricao_estadual',
        ''
      ),


    telefone =
      coalesce(
        p_revisao->>'telefone',
        ''
      ),


    email =
      coalesce(
        p_revisao->>'email',
        ''
      ),


    endereco =
      coalesce(
        p_revisao->>'endereco',
        ''
      ),


    bairro =
      coalesce(
        p_revisao->>'bairro',
        ''
      ),


    cidade_uf_cep =
      coalesce(
        p_revisao->>'cidade_uf_cep',
        ''
      ),


    cliche =
      coalesce(
        nullif(
          p_revisao->>'cliche',
          ''
        ),
        'A CALCULAR'
      ),


    forma_pagamento =
      coalesce(
        nullif(
          p_revisao->>'forma_pagamento',
          ''
        ),
        '1/30/60 (APÓS ANÁLISE)'
      ),


    vendedor_nome =
      coalesce(
        p_revisao->>'vendedor_nome',
        ''
      ),


    projeto =
      coalesce(
        p_revisao->>'projeto',
        ''
      ),


    previsao_faturamento =
      nullif(
        p_revisao->>'previsao_faturamento',
        ''
      )::date,


    destinacao =
      coalesce(
        p_revisao->>'destinacao',
        ''
      ),


    frete =
      coalesce(
        p_revisao->>'frete',
        ''
      ),


    regras_comerciais =
      coalesce(
        p_revisao->>'regras_comerciais',
        ''
      ),


    mostrar_totais_pdf =
      coalesce(
        nullif(
          p_revisao->>'mostrar_totais_pdf',
          ''
        )::boolean,
        true
      )


  where id =
    p_revisao_id

    and proposta_id =
    p_proposta_id;


  -- -------------------------------------------------------
  -- ## 3.7 Remoção dos itens anteriores
  -- -------------------------------------------------------

  delete from public.itens_revisao

  where revisao_id =
    p_revisao_id;


  -- -------------------------------------------------------
  -- ## 3.8 Inserção do estado atual dos itens
  -- -------------------------------------------------------

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

    p_revisao_id,


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

      else 'UN'

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


  from jsonb_array_elements(
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


  -- -------------------------------------------------------
  -- ## 3.9 Retorno para o frontend
  -- -------------------------------------------------------

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
    'rascunho'

  );

end;
$$;


-- =========================================================
-- ## 4. PERMISSÕES DAS RPCs
-- =========================================================

-- Remove acesso genérico concedido a PUBLIC.

revoke all
on function public.criar_proposta_r0(
  jsonb,
  jsonb
)
from public;


revoke all
on function public.salvar_rascunho_proposta(
  uuid,
  uuid,
  jsonb,
  jsonb
)
from public;


-- Libera execução apenas para usuários autenticados.

grant execute
on function public.criar_proposta_r0(
  jsonb,
  jsonb
)
to authenticated;


grant execute
on function public.salvar_rascunho_proposta(
  uuid,
  uuid,
  jsonb,
  jsonb
)
to authenticated;


-- =========================================================
-- ## 5. FINALIZAÇÃO DA TRANSAÇÃO
-- =========================================================

commit;