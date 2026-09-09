-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 004_status_comercial.sql
--
-- Responsabilidade:
-- - Adicionar o status comercial às propostas
-- - Registrar motivo de propostas não conquistadas
-- - Registrar quem alterou o status
-- - Registrar quando o status foi alterado
-- - Criar RPC segura para atualização do status comercial
--
-- IMPORTANTE:
-- O status comercial pertence à PROPOSTA.
--
-- Ele é diferente do status da REVISÃO:
--
-- Revisão:
-- - rascunho
-- - enviada
--
-- Proposta:
-- - proposta
-- - andamento
-- - concluido
-- - nao_conquistado
-- =========================================================


-- =========================================================
-- ## 1. INÍCIO DA TRANSAÇÃO
-- =========================================================

begin;


-- =========================================================
-- ## 2. NOVOS CAMPOS EM public.propostas
-- =========================================================

alter table public.propostas

  add column if not exists status_comercial text
    not null
    default 'proposta',

  add column if not exists motivo_nao_conquistado text,

  add column if not exists detalhe_nao_conquistado text,

  add column if not exists status_atualizado_em timestamptz,

  add column if not exists status_atualizado_por uuid
    references public.perfis(user_id)
    on delete set null;


-- =========================================================
-- ## 3. REGRAS DO STATUS COMERCIAL
-- =========================================================

-- ---------------------------------------------------------
-- ## 3.1 Status permitidos
-- ---------------------------------------------------------

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname = 'propostas_status_comercial_check'
      and conrelid = 'public.propostas'::regclass
  ) then

    alter table public.propostas

      add constraint propostas_status_comercial_check

      check (
        status_comercial in (
          'proposta',
          'andamento',
          'concluido',
          'nao_conquistado'
        )
      );

  end if;

end;
$$;


-- ---------------------------------------------------------
-- ## 3.2 Motivo obrigatório quando não conquistada
-- ---------------------------------------------------------

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname = 'propostas_nao_conquistado_dados_check'
      and conrelid = 'public.propostas'::regclass
  ) then

    alter table public.propostas

      add constraint propostas_nao_conquistado_dados_check

      check (

        status_comercial <> 'nao_conquistado'

        or (

          nullif(
            btrim(
              coalesce(
                motivo_nao_conquistado,
                ''
              )
            ),
            ''
          ) is not null

          and

          nullif(
            btrim(
              coalesce(
                detalhe_nao_conquistado,
                ''
              )
            ),
            ''
          ) is not null

        )

      );

  end if;

end;
$$;


-- =========================================================
-- ## 4. ÍNDICE PARA CONSULTAS POR STATUS
-- =========================================================

create index if not exists idx_propostas_status_comercial
  on public.propostas(status_comercial);


-- =========================================================
-- ## 5. RPC — ATUALIZAR STATUS COMERCIAL
-- =========================================================

create or replace function public.atualizar_status_comercial(

  p_proposta_id uuid,

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

  v_status_atualizado_em timestamptz;

begin

  -- -------------------------------------------------------
  -- ## 5.1 Validar autenticação
  -- -------------------------------------------------------

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- ## 5.2 Validar usuário ativo
  -- -------------------------------------------------------

  if not public.usuario_ativo() then

    raise exception
      'Usuário inativo.';

  end if;


  -- -------------------------------------------------------
  -- ## 5.3 Validar acesso à proposta
  -- -------------------------------------------------------

  if not public.pode_acessar_proposta(
    p_proposta_id
  ) then

    raise exception
      'Sem permissão para acessar esta proposta.';

  end if;


  -- -------------------------------------------------------
  -- ## 5.4 Validar status recebido
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
  -- ## 5.5 Validar não conquistado
  -- -------------------------------------------------------

  if v_status = 'nao_conquistado' then

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
  -- ## 5.6 Atualizar proposta
  -- -------------------------------------------------------

  update public.propostas

  set

    status_comercial =
      v_status,


    motivo_nao_conquistado =
      case

        when v_status = 'nao_conquistado'

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

        when v_status = 'nao_conquistado'

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
      now(),


    status_atualizado_por =
      v_user


  where id =
    p_proposta_id


  returning

    numero,

    status_atualizado_em

  into

    v_numero,

    v_status_atualizado_em;


  -- -------------------------------------------------------
  -- ## 5.7 Garantir que a proposta foi encontrada
  -- -------------------------------------------------------

  if not found then

    raise exception
      'Proposta não encontrada.';

  end if;


  -- -------------------------------------------------------
  -- ## 5.8 Retorno para o frontend
  -- -------------------------------------------------------

  return jsonb_build_object(

    'proposta_id',
    p_proposta_id,

    'numero',
    v_numero,

    'status_comercial',
    v_status,

    'motivo_nao_conquistado',
    case

      when v_status = 'nao_conquistado'

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

      when v_status = 'nao_conquistado'

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
    v_user

  );

end;
$$;


-- =========================================================
-- ## 6. PERMISSÕES DA RPC
-- =========================================================

revoke all
on function public.atualizar_status_comercial(
  uuid,
  text,
  text,
  text
)
from public;


grant execute
on function public.atualizar_status_comercial(
  uuid,
  text,
  text,
  text
)
to authenticated;


-- =========================================================
-- ## 7. FINALIZAÇÃO
-- =========================================================

commit;