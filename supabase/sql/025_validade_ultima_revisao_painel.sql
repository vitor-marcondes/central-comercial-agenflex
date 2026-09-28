-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 025_validade_ultima_revisao_enviada_painel.sql
--
-- Objetivo:
-- - Manter a revisão atual no Painel Comercial
-- - Trazer também a revisão enviada mais recente
-- - Impedir que uma nova revisão em rascunho esconda
--   a validade comercial da última revisão enviada
--
-- Exemplo:
--
-- R0 ENVIADA  -> validade até 01/10
-- R1 RASCUNHO -> revisão atual
--
-- O Painel recebe as duas:
-- - R1 para exibição/valor atual
-- - R0 para validade vigente
-- =========================================================

begin;

set local lock_timeout = '5s';


-- =========================================================
-- ## 1. CONSULTA DA CARTEIRA DO PAINEL
-- =========================================================

create or replace function
public.consultar_carteira_painel(
  p_apos uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$

declare

  v_resultado jsonb;

begin

  if auth.uid() is null
     or not public.usuario_ativo() then

    raise exception
      'Consulta exige usuário autenticado e ativo.';

  end if;


  with dados as materialized (

    select

      p.id,

      to_jsonb(p)

      ||

      jsonb_build_object(

        'revisoes_proposta',

        coalesce(

          (

            select

              jsonb_agg(

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

                  'data_proposta',
                    r.data_proposta,

                  'validade',
                    r.validade,

                  'validade_dias',
                    r.validade_dias,

                  'validade_ate',
                    r.validade_ate,

                  'status',
                    r.status,

                  'enviado_em',
                    r.enviado_em,

                  'valor_total_revisao',

                    (

                      select
                        coalesce(
                          sum(
                            i.valor_total
                          ),
                          0
                        )

                      from public.itens_revisao i

                      where i.revisao_id =
                        r.id

                    )

                )

                order by
                  r.numero_revisao

              )

            from public.revisoes_proposta r

            where r.proposta_id =
              p.id

              and (

                -- Revisão atualmente aberta na proposta.
                r.numero_revisao =
                  p.revisao_atual

                or

                -- Última revisão efetivamente enviada.
                r.id = (

                  select
                    r_enviada.id

                  from public.revisoes_proposta
                    r_enviada

                  where r_enviada.proposta_id =
                    p.id

                    and r_enviada.status =
                      'enviada'

                    and r_enviada.enviado_em
                      is not null

                  order by
                    r_enviada.numero_revisao desc,
                    r_enviada.enviado_em desc

                  limit 1

                )

              )

          ),

          '[]'::jsonb

        )

      ) as registro

    from public.propostas p

  ),


  candidatos as materialized (

    select *

    from dados

    where p_apos is null
       or id > p_apos

    order by id

    limit 201

  ),


  pagina as (

    select *

    from candidatos

    order by id

    limit 200

  )


  select

    jsonb_build_object(

      'versao',

        md5(

          coalesce(

            (

              select

                jsonb_agg(
                  registro
                  order by id
                )::text

              from dados

            ),

            '[]'

          )

        ),


      'registros',

        coalesce(

          jsonb_agg(
            registro
            order by id
          ),

          '[]'::jsonb

        ),


      'proximo',

        case

          when (
            select count(*)
            from candidatos
          ) > 200

          then
            (
              array_agg(
                id
                order by id desc
              )
            )[1]

        end

    )

  into v_resultado

  from pagina;


  return v_resultado;

end;

$function$;


-- =========================================================
-- ## 2. PERMISSÕES
-- =========================================================

revoke all
on function public.consultar_carteira_painel(uuid)
from public, anon;


grant execute
on function public.consultar_carteira_painel(uuid)
to authenticated, service_role;


commit;


-- =========================================================
-- ## 3. VERIFICAÇÕES
-- =========================================================

select

  p.proname as funcao,

  p.prosecdef as security_definer,

  has_function_privilege(
    'anon',
    'public.consultar_carteira_painel(uuid)',
    'EXECUTE'
  ) as anon_execute,

  has_function_privilege(
    'authenticated',
    'public.consultar_carteira_painel(uuid)',
    'EXECUTE'
  ) as authenticated_execute,

  has_function_privilege(
    'service_role',
    'public.consultar_carteira_painel(uuid)',
    'EXECUTE'
  ) as service_role_execute

from pg_proc p

join pg_namespace n
  on n.oid = p.pronamespace

where n.nspname = 'public'
  and p.proname =
    'consultar_carteira_painel';