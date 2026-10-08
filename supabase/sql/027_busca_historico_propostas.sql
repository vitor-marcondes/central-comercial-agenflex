-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 027_busca_historico_propostas.sql
--
-- Objetivo:
-- - Ajustar a busca do Histórico de Propostas
-- - Número da proposta deve ser pesquisado de forma exata
-- - Aceitar número com ou sem #
-- - Permitir busca parcial/completa por CNPJ
-- - Permitir busca textual por proposta e cliente
-- - Remover vendedor da busca textual
--
-- Observação:
-- Esta versão já foi validada no ambiente atual do Supabase.
-- Esta migration registra no repositório a definição aplicada.
-- =========================================================

begin;


create or replace function public.consultar_historico_propostas(
  p_pagina integer default 1,
  p_busca text default ''::text,
  p_origem text default ''::text,
  p_status text default ''::text,
  p_status_revisao text default ''::text
)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$

declare

  v_resultado jsonb;

  v_busca text;

  v_busca_numero text;

  v_busca_e_numero boolean;

begin

  if auth.uid() is null
     or not public.usuario_ativo() then

    raise exception
      'Consulta exige usuário autenticado e ativo.';

  end if;


  if p_pagina is null
     or p_pagina < 1 then

    raise exception
      'Página inválida.';

  end if;


  v_busca :=
    translate(
      lower(
        btrim(
          coalesce(
            p_busca,
            ''
          )
        )
      ),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    );


  v_busca_numero :=
    regexp_replace(
      v_busca,
      '^#',
      ''
    );


  v_busca_e_numero :=
    v_busca ~ '^#?[0-9]+$'
    and char_length(
      v_busca_numero
    ) <= 6;


  with filtradas as materialized (

    select
      p.*,
      r.id as atual_id

    from public.propostas p

    join public.revisoes_proposta r
      on r.proposta_id = p.id
     and r.numero_revisao = p.revisao_atual

    where
      (
        coalesce(
          p_origem,
          ''
        ) = ''

        or

        p.origem_comercial = p_origem
      )

      and
      (
        coalesce(
          p_status,
          ''
        ) = ''

        or

        p.status_comercial = p_status
      )

      and
      (
        coalesce(
          p_status_revisao,
          ''
        ) = ''

        or

        r.status = p_status_revisao
      )

      and
      (
        v_busca = ''

        or
        (
          v_busca_e_numero
          and p.numero::text = v_busca_numero
        )

        or
        (
          v_busca ~ '^[0-9]+$'
          and char_length(v_busca) > 6

          and strpos(
            regexp_replace(
              coalesce(
                r.cnpj,
                ''
              ),
              '[^0-9]',
              '',
              'g'
            ),
            v_busca
          ) > 0
        )

        or
        (
          v_busca !~ '^[0-9]+$'

          and strpos(
            translate(
              lower(
                concat_ws(
                  ' ',
                  r.nome_proposta,
                  r.cliente,
                  r.cnpj
                )
              ),
              'áàâãäéèêëíìîïóòôõöúùûüç',
              'aaaaaeeeeiiiiooooouuuuc'
            ),
            v_busca
          ) > 0
        )
      )

  ),


  pagina as (

    select *
    from filtradas

    order by
      updated_at desc,
      id

    offset (
      (
        p_pagina::bigint - 1
      ) * 50
    )

    limit 50

  )


  select jsonb_build_object(

    'total',
    (
      select count(*)
      from filtradas
    ),

    'pagina',
    p_pagina,

    'versao',
    md5(
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_array(
                id,
                updated_at,
                atual_id
              )
              order by
                updated_at desc,
                id
            )::text

          from filtradas
        ),
        '[]'
      )
    ),

    'registros',
    coalesce(
      (
        select jsonb_agg(

          (
            to_jsonb(p)
            - 'atual_id'
          )

          ||

          jsonb_build_object(

            'responsavel_nome',
            (
              select nome
              from public.perfis
              where user_id =
                p.vendedor_responsavel_id
            ),

            'responsavel_conclusao_nome',
            (
              select nome
              from public.perfis
              where user_id =
                p.responsavel_conclusao_id
            ),

            'quantidade_revisoes',
            (
              select count(*)
              from public.revisoes_proposta
              where proposta_id =
                p.id
            ),

            'revisoes_proposta',
            (
              select jsonb_build_array(
                jsonb_build_object(

                  'id',
                  r.id,

                  'numero_revisao',
                  r.numero_revisao,

                  'nome_proposta',
                  r.nome_proposta,

                  'cliente',
                  r.cliente,

                  'cnpj',
                  r.cnpj,

                  'vendedor_nome',
                  r.vendedor_nome,

                  'time_equipe',
                  r.time_equipe,

                  'status',
                  r.status,

                  'data_proposta',
                  r.data_proposta,

                  'enviado_em',
                  r.enviado_em,

                  'validade_dias',
                  r.validade_dias,

                  'validade_ate',
                  r.validade_ate
                )
              )

              from public.revisoes_proposta r

              where r.id =
                p.atual_id
            )
          )

          order by
            p.updated_at desc,
            p.id
        )

        from pagina p
      ),

      '[]'::jsonb
    )

  )
  into v_resultado;


  return v_resultado;

end;

$function$;


commit;