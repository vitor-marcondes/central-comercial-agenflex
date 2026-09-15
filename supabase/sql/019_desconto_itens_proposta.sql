-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 019_desconto_itens_proposta.sql
--
-- Responsabilidade:
-- - Adicionar desconto percentual por item
-- - Calcular desconto no banco
-- - Calcular subtotal líquido
-- - Aplicar IPI depois do desconto
-- - Atualizar valor_total
-- - Fazer R0 persistir desconto
-- - Fazer rascunhos persistirem desconto
-- - Fazer R1/R2/R3... herdarem o desconto anterior
--
-- Regra:
--
-- subtotal_bruto =
--   quantidade * valor_unitario
--
-- desconto_valor =
--   subtotal_bruto * desconto_percentual / 100
--
-- subtotal_liquido =
--   subtotal_bruto - desconto_valor
--
-- valor_total =
--   subtotal_liquido
--   * (1 + ipi_percentual / 100)
--
-- IMPORTANTE:
-- - Registros antigos recebem desconto = 0.
-- - Revisões já enviadas continuam imutáveis.
-- - Não altera as migrations 003, 007 ou 014.
-- =========================================================


-- =========================================================
-- ## 1. INÍCIO
-- =========================================================

begin;


-- =========================================================
-- ## 2. ESTRUTURA DOS ITENS
-- =========================================================

alter table public.itens_revisao

add column if not exists
desconto_percentual numeric(8,4)
not null
default 0;


-- =========================================================
-- ## 2.1 VALIDAR FAIXA DO DESCONTO
-- =========================================================

do $bloco$

begin

  if not exists (

    select 1

    from pg_constraint

    where conname =
      'itens_revisao_desconto_percentual_check'

      and conrelid =
        'public.itens_revisao'::regclass

  ) then

    alter table public.itens_revisao

    add constraint
      itens_revisao_desconto_percentual_check

    check (
      desconto_percentual >= 0
      and
      desconto_percentual <= 100
    );

  end if;

end;

$bloco$;


-- =========================================================
-- ## 2.2 VALOR DO DESCONTO
-- =========================================================

alter table public.itens_revisao

add column if not exists
desconto_valor numeric(18,6)

generated always as (

  (
    quantidade *
    valor_unitario
  )

  *

  (
    desconto_percentual /
    100
  )

) stored;


-- =========================================================
-- ## 2.3 SUBTOTAL APÓS DESCONTO
-- =========================================================

alter table public.itens_revisao

add column if not exists
subtotal_liquido numeric(18,6)

generated always as (

  (
    quantidade *
    valor_unitario
  )

  *

  (
    1 -
    (
      desconto_percentual /
      100
    )
  )

) stored;


-- =========================================================
-- ## 2.4 RECALCULAR VALOR TOTAL
-- =========================================================

-- A coluna valor_total já existia, mas calculava:
--
-- subtotal + IPI
--
-- Agora ela precisa considerar:
--
-- subtotal
-- ↓
-- desconto
-- ↓
-- subtotal líquido
-- ↓
-- IPI

alter table public.itens_revisao

drop column if exists
valor_total;


alter table public.itens_revisao

add column
valor_total numeric(18,6)

generated always as (

  (
    (
      quantidade *
      valor_unitario
    )

    *

    (
      1 -
      (
        desconto_percentual /
        100
      )
    )
  )

  *

  (
    1 +
    (
      ipi_percentual /
      100
    )
  )

) stored;


-- =========================================================
-- ## 3. RPC — CRIAR PROPOSTA R0
-- =========================================================
--
-- Mantém a arquitetura segura implementada no 014.
--
-- IMPORTANTE:
-- - SECURITY DEFINER permanece.
-- - vendedor responsável permanece protegido.
-- - criado_por continua vindo de auth.uid().
-- - origem comercial continua validada.
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
  -- Usuário
  -- -------------------------------------------------------

  v_user uuid :=
    auth.uid();


  -- -------------------------------------------------------
  -- Perfil
  -- -------------------------------------------------------

  v_tipo_acesso text;

  v_usuario_ativo boolean;


  -- -------------------------------------------------------
  -- Origem
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
  -- IDs
  -- -------------------------------------------------------

  v_proposta_id uuid;

  v_numero bigint;

  v_revisao_id uuid;


  -- -------------------------------------------------------
  -- Responsável
  -- -------------------------------------------------------

  v_vendedor_responsavel_id uuid;


begin


  -- =======================================================
  -- ## 3.1 VALIDAR AUTENTICAÇÃO
  -- =======================================================

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- =======================================================
  -- ## 3.2 CARREGAR PERFIL
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
  -- ## 3.3 DEFINIR RESPONSÁVEL
  -- =======================================================

  if v_tipo_acesso =
    'vendedor'
  then

    v_vendedor_responsavel_id :=
      v_user;

  else

    v_vendedor_responsavel_id :=
      null;

  end if;


  -- =======================================================
  -- ## 3.4 VALIDAR ORIGEM
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
  -- ## 3.5 CRIAR PROPOSTA-PAI
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
  -- ## 3.6 CRIAR R0
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
  -- ## 3.7 CRIAR ITENS DA R0
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

    desconto_percentual,

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
        e.item->>'desconto_percentual',
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
  -- ## 3.8 RETORNO
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
-- ## 4. RPC — SALVAR RASCUNHO
-- =========================================================

create or replace function
public.salvar_rascunho_proposta(

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


  -- =======================================================
  -- ## 4.1 VALIDAR USUÁRIO
  -- =======================================================

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  if not public.usuario_ativo() then

    raise exception
      'Usuário inativo.';

  end if;


  -- =======================================================
  -- ## 4.2 VALIDAR ACESSO
  -- =======================================================

  if not public.pode_acessar_proposta(
    p_proposta_id
  ) then

    raise exception
      'Sem permissão para acessar esta proposta.';

  end if;


  -- =======================================================
  -- ## 4.3 LOCALIZAR PROPOSTA / REVISÃO
  -- =======================================================

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


  if not found then

    raise exception
      'Proposta ou revisão não encontrada.';

  end if;


  -- =======================================================
  -- ## 4.4 BLOQUEAR REVISÃO ENVIADA
  -- =======================================================

  if v_status <>
    'rascunho'
  then

    raise exception
      'Esta revisão já foi enviada. Crie uma nova revisão.';

  end if;


  -- =======================================================
  -- ## 4.5 ATUALIZAR DADOS DA REVISÃO
  -- =======================================================

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


  -- =======================================================
  -- ## 4.6 SUBSTITUIR ITENS DO RASCUNHO
  -- =======================================================

  delete from
    public.itens_revisao

  where revisao_id =
    p_revisao_id;


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

    desconto_percentual,

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
        e.item->>'desconto_percentual',
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


  -- =======================================================
  -- ## 4.7 RETORNO
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
    'rascunho'

  );


end;

$$;


-- =========================================================
-- ## 5. RPC — CRIAR NOVA REVISÃO
-- =========================================================
--
-- R0 ENVIADA
-- ↓
-- R1 RASCUNHO
--
-- Agora desconto_percentual também é copiado.
-- =========================================================

create or replace function
public.criar_nova_revisao(

  p_proposta_id uuid

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

  v_revisao_atual integer;


  v_revisao_anterior_id uuid;

  v_status_anterior text;


  v_numero_nova_revisao integer;

  v_nova_revisao_id uuid;


begin


  -- =======================================================
  -- ## 5.1 VALIDAR AUTENTICAÇÃO
  -- =======================================================

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  if not public.usuario_ativo() then

    raise exception
      'Usuário inativo.';

  end if;


  -- =======================================================
  -- ## 5.2 VALIDAR ACESSO
  -- =======================================================

  if not public.pode_acessar_proposta(
    p_proposta_id
  ) then

    raise exception
      'Sem permissão para acessar esta proposta.';

  end if;


  -- =======================================================
  -- ## 5.3 BLOQUEAR PROPOSTA
  -- =======================================================

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
  -- ## 5.4 LOCALIZAR REVISÃO ATUAL
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
  -- ## 5.5 EXIGIR REVISÃO ENVIADA
  -- =======================================================

  if v_status_anterior <>
    'enviada'
  then

    raise exception
      'A revisão atual precisa estar enviada antes de criar uma nova revisão.';

  end if;


  -- =======================================================
  -- ## 5.6 CALCULAR NOVA REVISÃO
  -- =======================================================

  v_numero_nova_revisao :=
    v_revisao_atual + 1;


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
  -- ## 5.7 COPIAR DADOS DA REVISÃO
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
  -- ## 5.8 COPIAR ITENS + DESCONTO
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

    desconto_percentual,

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

    desconto_percentual,

    ipi_percentual

  from public.itens_revisao

  where revisao_id =
    v_revisao_anterior_id;


  -- =======================================================
  -- ## 5.9 ATUALIZAR REVISÃO ATUAL
  -- =======================================================

  update public.propostas

  set revisao_atual =
    v_numero_nova_revisao

  where id =
    p_proposta_id;


  -- =======================================================
  -- ## 5.10 RETORNO
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
-- ## 6. PERMISSÕES
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
on function public.salvar_rascunho_proposta(
  uuid,
  uuid,
  jsonb,
  jsonb
)
from public;


grant execute
on function public.salvar_rascunho_proposta(
  uuid,
  uuid,
  jsonb,
  jsonb
)
to authenticated;


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
-- ## 7. FINALIZAR
-- =========================================================

commit;


-- =========================================================
-- ## 8. VERIFICAÇÃO DA ESTRUTURA
-- =========================================================

select

  column_name,

  data_type,

  is_nullable,

  column_default,

  is_generated,

  generation_expression

from information_schema.columns

where table_schema =
  'public'

  and table_name =
    'itens_revisao'

  and column_name in (

    'subtotal',

    'desconto_percentual',

    'desconto_valor',

    'subtotal_liquido',

    'valor_total'

  )

order by ordinal_position;


-- =========================================================
-- ## 9. VERIFICAÇÃO DAS RPCs
-- =========================================================

select

  p.proname
    as funcao,

  p.prosecdef
    as security_definer,

  pg_get_function_identity_arguments(
    p.oid
  ) as argumentos

from pg_proc p

join pg_namespace n

  on n.oid =
    p.pronamespace

where n.nspname =
  'public'

  and p.proname in (

    'criar_proposta_r0',

    'salvar_rascunho_proposta',

    'criar_nova_revisao'

  )

order by p.proname;