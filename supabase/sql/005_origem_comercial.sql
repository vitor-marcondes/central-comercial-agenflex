-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 005_origem_comercial.sql
--
-- Responsabilidade:
-- - Adicionar origem comercial à proposta
-- - Padronizar as origens permitidas
-- - Fazer novas propostas nascerem com origem definida
-- - Atualizar origem + status comercial em uma única RPC
--
-- Origem:
-- - leads_mkt
-- - prospeccao
-- - gestao_carteira
--
-- IMPORTANTE:
-- A origem pertence à PROPOSTA.
-- Não pertence à revisão R0/R1/R2.
-- =========================================================


-- =========================================================
-- ## 1. INÍCIO DA TRANSAÇÃO
-- =========================================================

begin;


-- =========================================================
-- ## 2. CAMPO DE ORIGEM NA PROPOSTA
-- =========================================================

alter table public.propostas

  add column if not exists origem_comercial text;


-- =========================================================
-- ## 3. ORIGENS PERMITIDAS
-- =========================================================

do $$
begin

  if not exists (

    select 1
    from pg_constraint

    where conname =
      'propostas_origem_comercial_check'

      and conrelid =
      'public.propostas'::regclass

  ) then

    alter table public.propostas

      add constraint
        propostas_origem_comercial_check

      check (

        origem_comercial is null

        or origem_comercial in (
          'leads_mkt',
          'prospeccao',
          'gestao_carteira'
        )

      );

  end if;

end;
$$;


-- =========================================================
-- ## 4. ÍNDICE PARA FILTROS
-- =========================================================

create index if not exists
  idx_propostas_origem_comercial

on public.propostas(
  origem_comercial
);


-- =========================================================
-- ## 5. ATUALIZAR A RPC DE CRIAÇÃO DA R0
-- =========================================================

-- Mantemos a mesma assinatura existente:
--
-- criar_proposta_r0(jsonb, jsonb)
--
-- A diferença é que agora p_revisao também recebe:
--
-- origem_comercial
--
-- O campo é usado para criar o registro-pai da proposta.

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

  v_origem text :=
    lower(
      btrim(
        coalesce(
          p_revisao->>'origem_comercial',
          ''
        )
      )
    );

  v_proposta_id uuid;

  v_numero bigint;

  v_revisao_id uuid;

begin

  -- -------------------------------------------------------
  -- ## 5.1 Usuário autenticado
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
  -- ## 5.2 Validar origem
  -- -------------------------------------------------------

  if v_origem not in (

    'leads_mkt',
    'prospeccao',
    'gestao_carteira'

  ) then

    raise exception
      'Informe uma origem comercial válida.';

  end if;


  -- -------------------------------------------------------
  -- ## 5.3 Criar proposta-pai
  -- -------------------------------------------------------

  insert into public.propostas (

    criado_por,

    origem_comercial

  )
  values (

    v_user,

    v_origem

  )
  returning

    id,

    numero

  into

    v_proposta_id,

    v_numero;


  -- -------------------------------------------------------
  -- ## 5.4 Criar revisão R0
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
  -- ## 5.5 Criar itens da R0
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
    as e(item, ord);


  -- -------------------------------------------------------
  -- ## 5.6 Retorno
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
    'rascunho',

    'origem_comercial',
    v_origem,

    'status_comercial',
    'proposta'

  );

end;
$$;


-- =========================================================
-- ## 6. RPC — ATUALIZAR GESTÃO COMERCIAL
-- =========================================================

create or replace function public.atualizar_gestao_comercial(

  p_proposta_id uuid,

  p_origem_comercial text,

  p_status_comercial text,

  p_motivo_nao_conquistado text default null,

  p_detalhe_nao_conquistado text default null

)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_user uuid :=
    auth.uid();


  v_origem text :=
    lower(
      btrim(
        coalesce(
          p_origem_comercial,
          ''
        )
      )
    );


  v_status text :=
    lower(
      btrim(
        coalesce(
          p_status_comercial,
          ''
        )
      )
    );


  v_numero bigint;

  v_status_anterior text;

  v_status_atualizado_em timestamptz;

  v_status_atualizado_por uuid;

begin

  -- -------------------------------------------------------
  -- ## 6.1 Autenticação
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
  -- ## 6.2 Permissão
  -- -------------------------------------------------------

  if not public.pode_acessar_proposta(
    p_proposta_id
  ) then

    raise exception
      'Sem permissão para acessar esta proposta.';

  end if;


  -- -------------------------------------------------------
  -- ## 6.3 Origem
  -- -------------------------------------------------------

  if v_origem not in (

    'leads_mkt',
    'prospeccao',
    'gestao_carteira'

  ) then

    raise exception
      'Origem comercial inválida.';

  end if;


  -- -------------------------------------------------------
  -- ## 6.4 Status
  -- -------------------------------------------------------

  if v_status not in (

    'proposta',
    'andamento',
    'concluido',
    'nao_conquistado'

  ) then

    raise exception
      'Status comercial inválido.';

  end if;


  -- -------------------------------------------------------
  -- ## 6.5 Não conquistado
  -- -------------------------------------------------------

  if v_status =
    'nao_conquistado'
  then

    if nullif(
      btrim(
        coalesce(
          p_motivo_nao_conquistado,
          ''
        )
      ),
      ''
    ) is null then

      raise exception
        'Informe o motivo da proposta não conquistada.';

    end if;


    if nullif(
      btrim(
        coalesce(
          p_detalhe_nao_conquistado,
          ''
        )
      ),
      ''
    ) is null then

      raise exception
        'Informe o detalhamento da proposta não conquistada.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- ## 6.6 Obter status anterior
  -- -------------------------------------------------------

  select

    numero,

    status_comercial

  into

    v_numero,

    v_status_anterior

  from public.propostas

  where id =
    p_proposta_id;


  if not found then

    raise exception
      'Proposta não encontrada.';

  end if;


  -- -------------------------------------------------------
  -- ## 6.7 Atualizar proposta
  -- -------------------------------------------------------

  update public.propostas

  set

    origem_comercial =
      v_origem,


    status_comercial =
      v_status,


    motivo_nao_conquistado =
      case

        when v_status =
          'nao_conquistado'

        then nullif(
          btrim(
            coalesce(
              p_motivo_nao_conquistado,
              ''
            )
          ),
          ''
        )

        else null

      end,


    detalhe_nao_conquistado =
      case

        when v_status =
          'nao_conquistado'

        then nullif(
          btrim(
            coalesce(
              p_detalhe_nao_conquistado,
              ''
            )
          ),
          ''
        )

        else null

      end,


    status_atualizado_em =
      case

        when v_status_anterior
          is distinct from
          v_status

        then now()

        else status_atualizado_em

      end,


    status_atualizado_por =
      case

        when v_status_anterior
          is distinct from
          v_status

        then v_user

        else status_atualizado_por

      end


  where id =
    p_proposta_id


  returning

    status_atualizado_em,

    status_atualizado_por

  into

    v_status_atualizado_em,

    v_status_atualizado_por;


  -- -------------------------------------------------------
  -- ## 6.8 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'proposta_id',
    p_proposta_id,

    'numero',
    v_numero,

    'origem_comercial',
    v_origem,

    'status_comercial',
    v_status,

    'motivo_nao_conquistado',
    case

      when v_status =
        'nao_conquistado'

      then nullif(
        btrim(
          coalesce(
            p_motivo_nao_conquistado,
            ''
          )
        ),
        ''
      )

      else null

    end,

    'detalhe_nao_conquistado',
    case

      when v_status =
        'nao_conquistado'

      then nullif(
        btrim(
          coalesce(
            p_detalhe_nao_conquistado,
            ''
          )
        ),
        ''
      )

      else null

    end,

    'status_atualizado_em',
    v_status_atualizado_em,

    'status_atualizado_por',
    v_status_atualizado_por

  );

end;
$$;


-- =========================================================
-- ## 7. PERMISSÕES
-- =========================================================

revoke all
on function public.criar_proposta_r0(
  jsonb,
  jsonb
)
from public;


grant execute
on function public.criar_proposta_r0(
  jsonb,
  jsonb
)
to authenticated;


revoke all
on function public.atualizar_gestao_comercial(
  uuid,
  text,
  text,
  text,
  text
)
from public;


grant execute
on function public.atualizar_gestao_comercial(
  uuid,
  text,
  text,
  text,
  text
)
to authenticated;


-- =========================================================
-- ## 8. FINALIZAÇÃO
-- =========================================================

commit;