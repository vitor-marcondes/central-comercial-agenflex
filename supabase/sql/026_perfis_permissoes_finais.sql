-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 026_perfis_permissoes_finais.sql
-- =========================================================
--
-- OBJETIVO
-- Consolidar a matriz final de perfis da V1:
--
-- VENDEDOR
--   - operador comercial
--   - opera somente propostas sob sua responsabilidade
--
-- GESTOR
--   - operador comercial
--   - autoridade da operação comercial
--   - visão global
--
-- ADM
--   - administrador do sistema
--   - visão global
--   - NÃO é operador comercial
--
-- DIRETOR
--   - visão executiva global
--   - NÃO é operador comercial
--
-- IMPORTANTE:
-- Esta migration deve ser executada COMPLETA.
-- Não executar blocos isoladamente no Supabase.
-- =========================================================


begin;

set local lock_timeout = '5s';


-- =========================================================
-- 1. PREFLIGHT
-- =========================================================
--
-- A 026 pressupõe que a arquitetura consolidada em
-- 020–025 esteja presente.
-- Se algum componente crítico estiver ausente, abortar.
-- =========================================================

do $preflight_026$
begin

  if to_regprocedure(
    'public.usuario_operacao_comercial()'
  ) is null then
    raise exception
      '026: usuario_operacao_comercial() não encontrada.';
  end if;


  if to_regprocedure(
    'public.usuario_visao_global()'
  ) is null then
    raise exception
      '026: usuario_visao_global() não encontrada.';
  end if;


  if to_regprocedure(
    'public.usuario_gestor()'
  ) is null then
    raise exception
      '026: usuario_gestor() não encontrada.';
  end if;


  if to_regprocedure(
    'public.usuario_adm()'
  ) is null then
    raise exception
      '026: usuario_adm() não encontrada.';
  end if;


  if to_regprocedure(
    'public.pode_acessar_proposta(uuid)'
  ) is null then
    raise exception
      '026: pode_acessar_proposta(uuid) não encontrada.';
  end if;


  if to_regprocedure(
    'public.pode_visualizar_proposta(uuid)'
  ) is null then
    raise exception
      '026: pode_visualizar_proposta(uuid) não encontrada.';
  end if;


  if to_regprocedure(
    'public.consultar_carteira_painel(uuid)'
  ) is null then
    raise exception
      '026: aplicar e conferir a migration 025 antes da 026.';
  end if;

end;
$preflight_026$;


-- =========================================================
-- 2. NÚCLEO OFICIAL DE AUTORIZAÇÃO COMERCIAL
-- =========================================================


-- ---------------------------------------------------------
-- 2.1 OPERADOR COMERCIAL
-- ---------------------------------------------------------
--
-- Somente VENDEDOR e GESTOR ativos.
--
-- ADM administra o sistema.
-- DIRETOR possui visão executiva.
--
-- Nenhum dos dois é operador comercial.
-- ---------------------------------------------------------

create or replace function
public.usuario_operacao_comercial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select exists (

    select 1

    from public.perfis p

    where p.user_id = auth.uid()

      and p.ativo = true

      and p.tipo_acesso in (
        'vendedor',
        'gestor'
      )

  );

$function$;


comment on function
public.usuario_operacao_comercial()
is
'V1: identifica operador comercial ativo. Exclusivo para Vendedor e Gestor.';


-- ---------------------------------------------------------
-- 2.2 ACESSO OPERACIONAL À PROPOSTA
-- ---------------------------------------------------------
--
-- Operar significa:
-- salvar, editar, enviar, criar revisão, alterar status,
-- concluir e demais ações comerciais normais.
--
-- A regra normal é:
--
--   operador comercial
--   +
--   responsável atual da proposta
--
-- Gestor não edita qualquer proposta simplesmente por
-- possuir visão global.
--
-- Para assumir/redistribuir uma proposta, utiliza
-- transferir_proposta().
-- ---------------------------------------------------------

create or replace function
public.pode_acessar_proposta(
  p_proposta_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select

    public.usuario_operacao_comercial()

    and

    exists (

      select 1

      from public.propostas p

      where p.id = p_proposta_id

        and p.vendedor_responsavel_id =
          auth.uid()

    );

$function$;


comment on function
public.pode_acessar_proposta(uuid)
is
'V1: acesso operacional somente ao Vendedor/Gestor ativo atualmente responsável pela proposta.';


-- ---------------------------------------------------------
-- 2.3 ACESSO OPERACIONAL À REVISÃO
-- ---------------------------------------------------------

create or replace function
public.pode_acessar_revisao(
  p_revisao_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select exists (

    select 1

    from public.revisoes_proposta r

    where r.id = p_revisao_id

      and public.pode_acessar_proposta(
        r.proposta_id
      )

  );

$function$;


comment on function
public.pode_acessar_revisao(uuid)
is
'V1: revisão pode ser operada somente quando sua proposta pode ser operada pelo usuário atual.';


-- ---------------------------------------------------------
-- 2.4 VISUALIZAÇÃO DA PROPOSTA
-- ---------------------------------------------------------
--
-- VISÃO GLOBAL:
--   Gestor
--   Diretor
--   ADM
--
-- VISÃO OPERACIONAL PRÓPRIA:
--   Vendedor
--   Gestor responsável
--
-- Visualizar e operar são conceitos diferentes.
-- ---------------------------------------------------------

create or replace function
public.pode_visualizar_proposta(
  p_proposta_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select

    public.usuario_visao_global()

    or

    (

      public.usuario_operacao_comercial()

      and

      exists (

        select 1

        from public.propostas p

        where p.id = p_proposta_id

          and p.vendedor_responsavel_id =
            auth.uid()

      )

    );

$function$;


comment on function
public.pode_visualizar_proposta(uuid)
is
'V1: Gestor/Diretor/ADM possuem visão global; Vendedor visualiza propostas sob sua responsabilidade.';


-- ---------------------------------------------------------
-- 2.5 VISUALIZAÇÃO DA REVISÃO
-- ---------------------------------------------------------

create or replace function
public.pode_visualizar_revisao(
  p_revisao_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select exists (

    select 1

    from public.revisoes_proposta r

    where r.id = p_revisao_id

      and public.pode_visualizar_proposta(
        r.proposta_id
      )

  );

$function$;


comment on function
public.pode_visualizar_revisao(uuid)
is
'V1: revisão segue exatamente o escopo de visualização de sua proposta.';


-- =========================================================
-- 3. RESPONSÁVEL COMERCIAL DA PROPOSTA
-- =========================================================

create or replace function
public.preparar_vendedor_responsavel()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$

declare

  v_tipo_usuario_atual text;
  v_usuario_ativo boolean;

  v_tipo_responsavel text;
  v_responsavel_ativo boolean;

begin

  -- -------------------------------------------------------
  -- 3.1 Criador original é imutável
  -- -------------------------------------------------------

  if tg_op = 'UPDATE'
     and new.criado_por is distinct from old.criado_por
  then

    raise exception
      'O criador original da proposta não pode ser alterado.';

  end if;


  -- -------------------------------------------------------
  -- 3.2 Nova proposta
  -- -------------------------------------------------------
  --
  -- Somente Vendedor ou Gestor ativo pode criar.
  --
  -- Ambos criam exclusivamente para si mesmos.
  --
  -- ADM e Diretor não são operadores comerciais.
  -- -------------------------------------------------------

  if tg_op = 'INSERT' then

    if auth.uid() is null then

      raise exception
        'Nova proposta exige usuário autenticado.';

    end if;


    select
      p.tipo_acesso,
      p.ativo
    into
      v_tipo_usuario_atual,
      v_usuario_ativo
    from public.perfis p
    where p.user_id = auth.uid();


    if not found then

      raise exception
        'Perfil do usuário autenticado não encontrado.';

    end if;


    if v_usuario_ativo is distinct from true then

      raise exception
        'Usuário inativo não pode criar propostas.';

    end if;


    if v_tipo_usuario_atual not in (
      'vendedor',
      'gestor'
    ) then

      raise exception
        'Somente Vendedor ou Gestor pode criar propostas.';

    end if;


    if new.criado_por is distinct from auth.uid() then

      raise exception
        'O criador da proposta deve ser o usuário autenticado.';

    end if;


    if new.vendedor_responsavel_id is null then

      new.vendedor_responsavel_id :=
        auth.uid();

    elsif new.vendedor_responsavel_id
          is distinct from auth.uid()
    then

      raise exception
        'Vendedor e Gestor devem criar propostas para si próprios.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- 3.3 Validar nova atribuição de responsável
  -- -------------------------------------------------------

  if new.vendedor_responsavel_id is not null
     and (
       tg_op = 'INSERT'
       or
       new.vendedor_responsavel_id
         is distinct from old.vendedor_responsavel_id
     )
  then

    select
      p.tipo_acesso,
      p.ativo
    into
      v_tipo_responsavel,
      v_responsavel_ativo
    from public.perfis p
    where p.user_id =
      new.vendedor_responsavel_id;


    if not found then

      raise exception
        'Responsável comercial não encontrado.';

    end if;


    if v_tipo_responsavel not in (
      'vendedor',
      'gestor'
    ) then

      raise exception
        'O responsável comercial precisa possuir perfil Vendedor ou Gestor.';

    end if;


    if v_responsavel_ativo is distinct from true then

      raise exception
        'O responsável comercial precisa estar ativo.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- 3.4 Mudança de responsável
  -- -------------------------------------------------------
  --
  -- Somente Gestor pode realizar transferência.
  --
  -- O trigger bloquear_transferencia_direta() continua
  -- exigindo que a alteração passe pela RPC oficial
  -- transferir_proposta().
  -- -------------------------------------------------------

  if tg_op = 'UPDATE'
     and new.vendedor_responsavel_id
         is distinct from old.vendedor_responsavel_id
     and not public.usuario_gestor()
  then

    raise exception
      'Somente Gestor pode alterar o responsável comercial.';

  end if;


  return new;

end;

$function$;


comment on function
public.preparar_vendedor_responsavel()
is
'V1: Vendedor/Gestor criam propostas próprias; somente Gestor pode alterar o responsável pela transferência oficial.';


-- =========================================================
-- 4. TIME COMERCIAL DA REVISÃO
-- =========================================================
--
-- VENDEDOR:
--   Time vem obrigatoriamente do perfil.
--
-- GESTOR:
--   escolhe manualmente Pharma/Food/Revenda na R0.
--
-- R1/R2:
--   herdam o Time já estabelecido pela proposta.
--
-- ADM/DIRETOR:
--   não alteram revisões comerciais.
-- =========================================================

create or replace function
public.aplicar_time_equipe_revisao()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$

declare

  v_user_id uuid;

  v_tipo_acesso text;
  v_ativo boolean;
  v_time_perfil text;

  v_time_anterior text;

begin

  v_user_id :=
    auth.uid();


  if v_user_id is null then

    raise exception
      'Operação de revisão exige usuário autenticado.';

  end if;


  select
    p.tipo_acesso,
    p.ativo,
    p.time_equipe
  into
    v_tipo_acesso,
    v_ativo,
    v_time_perfil
  from public.perfis p
  where p.user_id =
    v_user_id;


  if not found then

    raise exception
      'Perfil do usuário autenticado não encontrado.';

  end if;


  if v_ativo is distinct from true then

    raise exception
      'Usuário inativo não pode alterar propostas.';

  end if;


  if v_tipo_acesso not in (
    'vendedor',
    'gestor'
  ) then

    raise exception
      'Somente Vendedor ou Gestor pode alterar revisões comerciais.';

  end if;


  -- -------------------------------------------------------
  -- 4.1 UPDATE DE REVISÃO EXISTENTE
  -- -------------------------------------------------------
  --
  -- O Time comercial é histórico da proposta.
  --
  -- Depois que a revisão nasce, alterações posteriores
  -- no perfil do Vendedor NÃO podem mudar o Time de uma
  -- proposta já existente.
  --
  -- Gestor escolhe o Time durante a criação da R0.
  --
  -- R0/R1/R2 existentes preservam seu Time.
  -- -------------------------------------------------------

  if tg_op = 'UPDATE' then

    if old.time_equipe is null
       or old.time_equipe not in (
         'pharma',
         'food',
         'revenda'
       )
    then

      raise exception
        'A revisão existente possui um Time comercial inválido.';

    end if;


    new.time_equipe :=
      old.time_equipe;


    return new;

  end if;
  
  -- -------------------------------------------------------
  -- 4.2 INSERT DA R0
  -- -------------------------------------------------------

  if tg_op = 'INSERT'
     and coalesce(new.numero_revisao, 0) = 0
  then

    if v_tipo_acesso = 'vendedor' then

      if v_time_perfil is null
         or v_time_perfil not in (
           'pharma',
           'food',
           'revenda'
         )
      then

        raise exception
          'Vendedor sem Time comercial definido.';

      end if;


      new.time_equipe :=
        v_time_perfil;

    else

      if new.time_equipe is null
         or new.time_equipe not in (
           'pharma',
           'food',
           'revenda'
         )
      then

        raise exception
          'Gestor deve selecionar um Time válido: Pharma, Food ou Revenda.';

      end if;

    end if;


    return new;

  end if;


  -- -------------------------------------------------------
  -- 4.3 INSERT DA R1 / R2
  -- -------------------------------------------------------
  --
  -- Nova revisão herda obrigatoriamente o Time
  -- da revisão imediatamente anterior.
  -- -------------------------------------------------------

  if tg_op = 'INSERT'
     and new.numero_revisao > 0
  then

    select
      r.time_equipe
    into
      v_time_anterior
    from public.revisoes_proposta r
    where r.proposta_id =
      new.proposta_id
      and r.numero_revisao =
        new.numero_revisao - 1;


    if not found
       or v_time_anterior is null
       or v_time_anterior not in (
         'pharma',
         'food',
         'revenda'
       )
    then

      raise exception
        'Não foi possível identificar um Time válido na revisão anterior.';

    end if;


    new.time_equipe :=
      v_time_anterior;


    return new;

  end if;


  return new;

end;

$function$;


comment on function
public.aplicar_time_equipe_revisao()
is
'V1: Vendedor usa Time fixo do perfil; Gestor escolhe o Time da R0; R1/R2 herdam o Time da proposta.';


-- =========================================================
-- 5. CRIAÇÃO OFICIAL DA PROPOSTA R0
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

  v_user uuid :=
    auth.uid();

  v_tipo_acesso text;
  v_usuario_ativo boolean;

  v_origem text :=
    lower(
      btrim(
        coalesce(
          p_revisao->>'origem_comercial',
          ''
        )
      )
    );

  v_time_solicitado text :=
    lower(
      btrim(
        coalesce(
          p_revisao->>'time_equipe',
          ''
        )
      )
    );

  v_proposta_id uuid;
  v_numero bigint;
  v_revisao_id uuid;

  v_vendedor_responsavel_id uuid;

begin

  -- -------------------------------------------------------
  -- 5.1 Usuário
  -- -------------------------------------------------------

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


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


  if v_usuario_ativo is distinct from true then

    raise exception
      'Usuário inativo.';

  end if;


  -- -------------------------------------------------------
  -- 5.2 Perfil permitido
  -- -------------------------------------------------------

  if v_tipo_acesso not in (
    'vendedor',
    'gestor'
  ) then

    raise exception
      'Somente Vendedor ou Gestor pode criar propostas.';

  end if;


  -- -------------------------------------------------------
  -- 5.3 Responsável
  -- -------------------------------------------------------
  --
  -- Toda proposta nasce sob responsabilidade
  -- do próprio operador que a criou.
  -- -------------------------------------------------------

  v_vendedor_responsavel_id :=
    v_user;


  if nullif(
       btrim(
         coalesce(
           p_revisao->>'vendedor_responsavel_id',
           ''
         )
       ),
       ''
     ) is not null
     and
     (
       p_revisao->>'vendedor_responsavel_id'
     )::uuid is distinct from v_user
  then

    raise exception
      'A proposta deve ser criada para o próprio usuário autenticado.';

  end if;


  -- -------------------------------------------------------
  -- 5.4 Time do Gestor
  -- -------------------------------------------------------
  --
  -- Para Vendedor, o trigger aplicar_time_equipe_revisao()
  -- substituirá qualquer valor recebido pelo Time oficial
  -- cadastrado no perfil.
  --
  -- Gestor não possui Time fixo e deve escolher.
  -- -------------------------------------------------------

  if v_tipo_acesso = 'gestor'
     and v_time_solicitado not in (
       'pharma',
       'food',
       'revenda'
     )
  then

    raise exception
      'Gestor deve selecionar um Time válido: Pharma, Food ou Revenda.';

  end if;


  -- -------------------------------------------------------
  -- 5.5 Origem comercial
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
  -- 5.6 Criar proposta
  -- -------------------------------------------------------

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


  -- -------------------------------------------------------
  -- 5.7 Criar R0
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
      v_time_solicitado,
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
  -- 5.8 Criar itens da R0
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


  -- -------------------------------------------------------
  -- 5.9 Retorno
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
      'proposta',

    'vendedor_responsavel_id',
      v_vendedor_responsavel_id

  );

end;

$function$;


comment on function
public.criar_proposta_r0(jsonb, jsonb)
is
'V1: somente Vendedor/Gestor ativo cria R0, sempre sob sua própria responsabilidade; Gestor escolhe o Time da proposta.';

-- =========================================================
-- 6. TRANSFERÊNCIA OFICIAL DE PROPOSTA
-- =========================================================
--
-- Somente GESTOR pode:
--   - transferir
--   - redistribuir
--   - assumir proposta
--
-- Destino:
--
-- VENDEDOR
--   - ativo
--   - mesmo Time comercial da proposta
--
-- GESTOR
--   - ativo
--   - transversal
--   - pode assumir proposta de qualquer Time
--
-- O resultado comercial já congelado NÃO é alterado.
-- =========================================================

create or replace function
public.transferir_proposta(
  p_proposta_id uuid,
  p_vendedor_novo_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$

declare

  v_proposta
    public.propostas%rowtype;

  v_responsavel_anterior
    public.perfis%rowtype;

  v_responsavel_novo
    public.perfis%rowtype;

  v_usuario_atual
    public.perfis%rowtype;

  v_motivo text;

  v_transferencia_id uuid;

  v_time_proposta text;
  v_time_anterior text;
  v_time_novo text;

begin

  -- -------------------------------------------------------
  -- 6.1 Autenticação
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- 6.2 Permissão
  -- -------------------------------------------------------
  --
  -- Transferência é gestão comercial.
  -- ADM e Diretor não executam esta operação.
  -- -------------------------------------------------------

  if not public.usuario_gestor() then

    raise exception
      'Somente Gestor pode transferir propostas.';

  end if;


  -- -------------------------------------------------------
  -- 6.3 Parâmetros
  -- -------------------------------------------------------

  if p_proposta_id is null then

    raise exception
      'Proposta não informada.';

  end if;


  if p_vendedor_novo_id is null then

    raise exception
      'Novo responsável não informado.';

  end if;


  v_motivo :=
    btrim(
      coalesce(
        p_motivo,
        ''
      )
    );


  if char_length(v_motivo) < 5 then

    raise exception
      'Informe o motivo da transferência com pelo menos 5 caracteres.';

  end if;


  if char_length(v_motivo) > 500 then

    raise exception
      'O motivo da transferência pode possuir no máximo 500 caracteres.';

  end if;


  -- -------------------------------------------------------
  -- 6.4 Gestor atual
  -- -------------------------------------------------------

  select *
  into v_usuario_atual
  from public.perfis
  where user_id =
    auth.uid();


  if not found then

    raise exception
      'Perfil do Gestor não encontrado.';

  end if;


  if v_usuario_atual.ativo is distinct from true
     or v_usuario_atual.tipo_acesso <> 'gestor'
  then

    raise exception
      'Somente Gestor ativo pode transferir propostas.';

  end if;


  -- -------------------------------------------------------
  -- 6.5 Bloquear proposta durante a operação
  -- -------------------------------------------------------

  select *
  into v_proposta
  from public.propostas
  where id =
    p_proposta_id
  for update;


  if not found then

    raise exception
      'Proposta não encontrada.';

  end if;


  -- -------------------------------------------------------
  -- 6.6 Identificar Time comercial da proposta
  -- -------------------------------------------------------
  --
  -- Utilizamos a revisão atual.
  --
  -- Fallback existe apenas para compatibilidade com
  -- registros legados.
  -- -------------------------------------------------------

  select
    r.time_equipe
  into
    v_time_proposta
  from public.revisoes_proposta r
  where r.proposta_id =
    v_proposta.id
    and r.numero_revisao =
      v_proposta.revisao_atual
  limit 1;


  if v_time_proposta is null then

    select
      r.time_equipe
    into
      v_time_proposta
    from public.revisoes_proposta r
    where r.proposta_id =
      v_proposta.id
    order by
      r.numero_revisao desc
    limit 1;

  end if;


  -- -------------------------------------------------------
  -- 6.7 Responsável anterior
  -- -------------------------------------------------------

  if v_proposta.vendedor_responsavel_id
     is not null
  then

    select *
    into v_responsavel_anterior
    from public.perfis
    where user_id =
      v_proposta.vendedor_responsavel_id;

  end if;


  -- -------------------------------------------------------
  -- 6.8 Novo responsável
  -- -------------------------------------------------------

  select *
  into v_responsavel_novo
  from public.perfis
  where user_id =
    p_vendedor_novo_id;


  if not found then

    raise exception
      'Novo responsável não encontrado.';

  end if;


  if v_responsavel_novo.tipo_acesso
     not in (
       'vendedor',
       'gestor'
     )
  then

    raise exception
      'O novo responsável precisa possuir perfil Vendedor ou Gestor.';

  end if;


  if v_responsavel_novo.ativo
     is distinct from true
  then

    raise exception
      'Não é possível transferir para um responsável inativo.';

  end if;


  -- -------------------------------------------------------
  -- 6.9 Regra de Time
  -- -------------------------------------------------------
  --
  -- Vendedor:
  -- precisa pertencer ao mesmo Time da proposta.
  --
  -- Gestor:
  -- é transversal e pode assumir qualquer Time.
  -- -------------------------------------------------------

  if v_responsavel_novo.tipo_acesso =
     'vendedor'
  then

    if v_time_proposta is null
       or v_time_proposta not in (
         'pharma',
         'food',
         'revenda'
       )
    then

      raise exception
        'A proposta não possui um Time comercial válido para transferência a Vendedor.';

    end if;


    if v_responsavel_novo.time_equipe is null
       or v_responsavel_novo.time_equipe
          not in (
            'pharma',
            'food',
            'revenda'
          )
    then

      raise exception
        'O Vendedor de destino não possui um Time comercial válido.';

    end if;


    if v_responsavel_novo.time_equipe
       <> v_time_proposta
    then

      raise exception
        'A proposta só pode ser transferida para Vendedor do mesmo Time comercial.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- 6.10 Mesmo responsável
  -- -------------------------------------------------------

  if v_proposta.vendedor_responsavel_id =
     p_vendedor_novo_id
  then

    raise exception
      'Este usuário já é o responsável pela proposta.';

  end if;


  -- -------------------------------------------------------
  -- 6.11 Time para auditoria
  -- -------------------------------------------------------

  v_time_anterior :=
    coalesce(
      v_responsavel_anterior.time_equipe,
      v_time_proposta
    );


  if v_responsavel_novo.tipo_acesso =
     'vendedor'
  then

    v_time_novo :=
      v_responsavel_novo.time_equipe;

  else

    -- Gestor não possui Time fixo.
    -- A proposta continua pertencendo ao seu
    -- contexto comercial histórico.

    v_time_novo :=
      v_time_proposta;

  end if;


  -- -------------------------------------------------------
  -- 6.12 Autorizar exclusivamente a RPC oficial
  -- -------------------------------------------------------

  perform set_config(
    'app.transferencia_proposta_autorizada',
    '1',
    true
  );


  -- -------------------------------------------------------
  -- 6.13 Alterar responsável
  -- -------------------------------------------------------

  update public.propostas

  set vendedor_responsavel_id =
    p_vendedor_novo_id

  where id =
    p_proposta_id

  returning *
  into v_proposta;


  -- Fechar imediatamente a autorização interna.
  --
  -- O parâmetro já é local à transação, mas zerá-lo
  -- após a operação reduz ainda mais a superfície de bypass.

  perform set_config(
    'app.transferencia_proposta_autorizada',
    '0',
    true
  );


  -- -------------------------------------------------------
  -- 6.14 Auditoria da transferência
  -- -------------------------------------------------------

  insert into public.transferencias_proposta (

    proposta_id,
    proposta_numero,

    vendedor_anterior_id,
    vendedor_anterior_nome,
    time_anterior,

    vendedor_novo_id,
    vendedor_novo_nome,
    time_novo,

    transferido_por,
    transferido_por_nome,

    motivo

  )
  values (

    v_proposta.id,

    coalesce(
      v_proposta.numero::text,
      '—'
    ),

    v_responsavel_anterior.user_id,

    case

      when v_responsavel_anterior.user_id
           is null
      then
        null

      else
        coalesce(
          nullif(
            btrim(
              v_responsavel_anterior.nome
            ),
            ''
          ),
          v_responsavel_anterior.email,
          'Responsável anterior'
        )

    end,

    v_time_anterior,

    v_responsavel_novo.user_id,

    coalesce(
      nullif(
        btrim(
          v_responsavel_novo.nome
        ),
        ''
      ),
      v_responsavel_novo.email,
      'Novo responsável'
    ),

    v_time_novo,

    v_usuario_atual.user_id,

    coalesce(
      nullif(
        btrim(
          v_usuario_atual.nome
        ),
        ''
      ),
      v_usuario_atual.email,
      'Gestor'
    ),

    v_motivo

  )

  returning id
  into v_transferencia_id;


  -- -------------------------------------------------------
  -- 6.15 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'sucesso',
      true,

    'transferencia_id',
      v_transferencia_id,

    'proposta_id',
      v_proposta.id,

    'numero',
      v_proposta.numero,

    'vendedor_anterior_id',
      v_responsavel_anterior.user_id,

    'vendedor_anterior_nome',
      v_responsavel_anterior.nome,

    'vendedor_novo_id',
      v_responsavel_novo.user_id,

    'vendedor_novo_nome',
      v_responsavel_novo.nome,

    'tipo_responsavel_novo',
      v_responsavel_novo.tipo_acesso,

    'time_proposta',
      v_time_proposta,

    'time_novo',
      v_time_novo,

    'transferido_por',
      v_usuario_atual.user_id,

    'transferido_por_nome',
      v_usuario_atual.nome,

    'motivo',
      v_motivo

  );

end;

$function$;


comment on function
public.transferir_proposta(uuid, uuid, text)
is
'V1: somente Gestor ativo transfere, redistribui ou assume propostas pela rota oficial auditada.';


-- =========================================================
-- 7. REMOVER ROTA LEGADA DE ATRIBUIÇÃO DIRETA
-- =========================================================
--
-- definir_vendedor_responsavel() pertence ao modelo antigo.
--
-- A V1 possui apenas uma rota oficial para mudança de
-- responsável:
--
--   transferir_proposta()
--
-- Não usar CASCADE.
--
-- Se existir alguma dependência inesperada, a migration
-- deve falhar em vez de apagar objetos silenciosamente.
-- =========================================================

revoke all
on function
public.definir_vendedor_responsavel(uuid, uuid)
from public, anon, authenticated;


drop function if exists
public.definir_vendedor_responsavel(uuid, uuid);

-- =========================================================
-- 8. ADMINISTRAÇÃO DE USUÁRIOS
-- =========================================================


-- =========================================================
-- 8.1 ATIVAR / INATIVAR USUÁRIO
-- =========================================================
--
-- GESTOR:
--   pode ativar/inativar somente Vendedores.
--
-- ADM:
--   pode ativar/inativar qualquer perfil.
--
-- Vendedor ativo exige Time comercial válido.
--
-- O último ADM ativo do sistema não pode ser desativado.
-- =========================================================

create or replace function
public.definir_ativo_usuario(
  p_user_id uuid,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$

declare

  v_usuario_atual
    public.perfis%rowtype;

  v_perfil_alvo
    public.perfis%rowtype;

  v_novo_ativo boolean;

  v_outros_adms_ativos bigint;

begin

  -- -------------------------------------------------------
  -- 8.1.1 Autenticação
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;

  -- Serializa alterações administrativas de perfil.
  -- Evita condição de corrida na proteção do último ADM.

  perform pg_catalog.pg_advisory_xact_lock(
    2026,
    26
  );

  -- -------------------------------------------------------
  -- 8.1.2 Operador atual
  -- -------------------------------------------------------

  select *
  into v_usuario_atual
  from public.perfis
  where user_id =
    auth.uid();


  if not found then

    raise exception
      'Perfil do usuário autenticado não encontrado.';

  end if;


  if v_usuario_atual.ativo
     is distinct from true
  then

    raise exception
      'Usuário inativo não pode administrar acessos.';

  end if;


  if v_usuario_atual.tipo_acesso
     not in (
       'gestor',
       'adm'
     )
  then

    raise exception
      'Somente Gestor ou ADM pode ativar ou inativar usuários.';

  end if;


  -- -------------------------------------------------------
  -- 8.1.3 Parâmetros
  -- -------------------------------------------------------

  if p_user_id is null then

    raise exception
      'Usuário alvo não informado.';

  end if;


  if p_ativo is null then

    raise exception
      'Informe se o usuário deve ficar ativo ou inativo.';

  end if;


  v_novo_ativo :=
    p_ativo;


  -- -------------------------------------------------------
  -- 8.1.4 Perfil alvo
  -- -------------------------------------------------------

  select *
  into v_perfil_alvo
  from public.perfis
  where user_id =
    p_user_id
  for update;


  if not found then

    raise exception
      'Usuário não encontrado.';

  end if;


  -- -------------------------------------------------------
  -- 8.1.5 Limite do Gestor
  -- -------------------------------------------------------
  --
  -- Gestor comanda a operação comercial, mas não altera
  -- o estado de Gestores, Diretores ou ADMs.
  -- -------------------------------------------------------

  if v_usuario_atual.tipo_acesso = 'gestor'
     and v_perfil_alvo.tipo_acesso <> 'vendedor'
  then

    raise exception
      'Gestor pode ativar ou inativar somente usuários Vendedores.';

  end if;


  -- -------------------------------------------------------
  -- 8.1.6 Vendedor ativo exige Time
  -- -------------------------------------------------------

  if v_perfil_alvo.tipo_acesso = 'vendedor'
     and v_novo_ativo = true
     and (
       v_perfil_alvo.time_equipe is null
       or
       v_perfil_alvo.time_equipe not in (
         'pharma',
         'food',
         'revenda'
       )
     )
  then

    raise exception
      'Defina o Time do Vendedor antes de ativá-lo.';

  end if;


  -- -------------------------------------------------------
  -- 8.1.7 Proteger último ADM ativo
  -- -------------------------------------------------------

  if v_perfil_alvo.tipo_acesso = 'adm'
     and v_perfil_alvo.ativo = true
     and v_novo_ativo = false
  then

    select count(*)
    into v_outros_adms_ativos
    from public.perfis p
    where p.tipo_acesso = 'adm'
      and p.ativo = true
      and p.user_id <> p_user_id;


    if v_outros_adms_ativos = 0 then

      raise exception
        'Não é permitido inativar o último ADM ativo do sistema.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- 8.1.8 Atualizar
  -- -------------------------------------------------------

  update public.perfis

  set ativo =
    v_novo_ativo

  where user_id =
    p_user_id

  returning *
  into v_perfil_alvo;


  -- -------------------------------------------------------
  -- 8.1.9 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'user_id',
      v_perfil_alvo.user_id,

    'nome',
      v_perfil_alvo.nome,

    'email',
      v_perfil_alvo.email,

    'tipo_acesso',
      v_perfil_alvo.tipo_acesso,

    'ativo',
      v_perfil_alvo.ativo,

    'time_equipe',
      v_perfil_alvo.time_equipe

  );

end;

$function$;


comment on function
public.definir_ativo_usuario(uuid, boolean)
is
'V1: Gestor ativa/inativa Vendedores; ADM administra estado ativo de qualquer perfil; último ADM ativo é protegido.';


-- =========================================================
-- 8.2 TIME FIXO DO VENDEDOR
-- =========================================================
--
-- Gestor ou ADM podem definir/trocar o Time do Vendedor.
--
-- Apenas perfis VENDEDOR possuem Time fixo.
--
-- Alterar o Time do perfil não reescreve revisões
-- históricas de propostas existentes.
-- =========================================================

create or replace function
public.definir_time_vendedor(
  p_user_id uuid,
  p_time_equipe text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$

declare

  v_usuario_atual
    public.perfis%rowtype;

  v_perfil_alvo
    public.perfis%rowtype;

  v_time text :=
    lower(
      btrim(
        coalesce(
          p_time_equipe,
          ''
        )
      )
    );

begin

  -- -------------------------------------------------------
  -- 8.2.1 Autenticação
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- 8.2.2 Permissão
  -- -------------------------------------------------------

  select *
  into v_usuario_atual
  from public.perfis
  where user_id =
    auth.uid();


  if not found
     or v_usuario_atual.ativo
        is distinct from true
  then

    raise exception
      'Usuário autenticado sem perfil ativo.';

  end if;


  if v_usuario_atual.tipo_acesso
     not in (
       'gestor',
       'adm'
     )
  then

    raise exception
      'Somente Gestor ou ADM pode definir o Time de Vendedores.';

  end if;


  -- -------------------------------------------------------
  -- 8.2.3 Validar Time
  -- -------------------------------------------------------

  if v_time not in (
    'pharma',
    'food',
    'revenda'
  ) then

    raise exception
      'Informe um Time válido: Pharma, Food ou Revenda.';

  end if;


  -- -------------------------------------------------------
  -- 8.2.4 Perfil alvo
  -- -------------------------------------------------------

  select *
  into v_perfil_alvo
  from public.perfis
  where user_id =
    p_user_id
  for update;


  if not found then

    raise exception
      'Usuário não encontrado.';

  end if;


  if v_perfil_alvo.tipo_acesso
     <> 'vendedor'
  then

    raise exception
      'Time fixo é permitido somente para usuários Vendedores.';

  end if;


  -- -------------------------------------------------------
  -- 8.2.5 Atualizar
  -- -------------------------------------------------------

  update public.perfis

  set time_equipe =
    v_time

  where user_id =
    p_user_id

  returning *
  into v_perfil_alvo;


  -- -------------------------------------------------------
  -- 8.2.6 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'user_id',
      v_perfil_alvo.user_id,

    'nome',
      v_perfil_alvo.nome,

    'tipo_acesso',
      v_perfil_alvo.tipo_acesso,

    'ativo',
      v_perfil_alvo.ativo,

    'time_equipe',
      v_perfil_alvo.time_equipe

  );

end;

$function$;


comment on function
public.definir_time_vendedor(uuid, text)
is
'V1: Gestor ou ADM define Pharma/Food/Revenda para perfil Vendedor; histórico comercial existente não é reescrito.';


-- =========================================================
-- 8.3 DEFINIR TIPO DE ACESSO
-- =========================================================
--
-- Somente ADM.
--
-- Regras:
--
-- VENDEDOR:
--   possui Time fixo.
--
-- GESTOR / DIRETOR / ADM:
--   não possuem Time fixo.
--
-- Ao transformar um perfil não-Vendedor em Vendedor:
--   - o usuário fica INATIVO;
--   - o Time fica NULL;
--   - depois Gestor/ADM define o Time;
--   - depois Gestor/ADM ativa o Vendedor.
--
-- Isso evita Vendedor ativo sem Time.
--
-- O último ADM ativo não pode perder o perfil ADM.
-- =========================================================

create or replace function
public.definir_tipo_acesso(
  p_user_id uuid,
  p_tipo_acesso text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$

declare

  v_tipo text;

  v_perfil_atual
    public.perfis%rowtype;

  v_perfil_final
    public.perfis%rowtype;

  v_outros_adms_ativos bigint;

begin

  -- -------------------------------------------------------
  -- 8.3.1 Autenticação / ADM
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;
  
  -- Serializa alterações administrativas de perfil.
  -- Evita condição de corrida na proteção do último ADM.

  perform pg_catalog.pg_advisory_xact_lock(
    2026,
    26
  );

  if not public.usuario_adm() then

    raise exception
      'Somente ADM pode alterar o tipo de acesso.';

  end if;


  -- -------------------------------------------------------
  -- 8.3.2 Validar tipo
  -- -------------------------------------------------------

  v_tipo :=
    lower(
      btrim(
        coalesce(
          p_tipo_acesso,
          ''
        )
      )
    );


  if v_tipo not in (
    'vendedor',
    'gestor',
    'diretor',
    'adm'
  ) then

    raise exception
      'Tipo de acesso inválido.';

  end if;


  -- -------------------------------------------------------
  -- 8.3.3 Perfil atual
  -- -------------------------------------------------------

  select *
  into v_perfil_atual
  from public.perfis
  where user_id =
    p_user_id
  for update;


  if not found then

    raise exception
      'Usuário não encontrado.';

  end if;


  -- -------------------------------------------------------
  -- 8.3.4 Proteger último ADM ativo
  -- -------------------------------------------------------

  if v_perfil_atual.tipo_acesso = 'adm'
     and v_perfil_atual.ativo = true
     and v_tipo <> 'adm'
  then

    select count(*)
    into v_outros_adms_ativos
    from public.perfis p
    where p.tipo_acesso = 'adm'
      and p.ativo = true
      and p.user_id <> p_user_id;


    if v_outros_adms_ativos = 0 then

      raise exception
        'Não é permitido alterar o tipo de acesso do último ADM ativo do sistema.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- 8.3.5 Alteração
  -- -------------------------------------------------------

  if v_tipo = 'vendedor'
     and v_perfil_atual.tipo_acesso <> 'vendedor'
  then

    -- Entrada no perfil Vendedor:
    --
    -- primeiro define-se o cargo,
    -- depois o Time,
    -- depois a ativação.

    update public.perfis

    set
      tipo_acesso = 'vendedor',
      time_equipe = null,
      ativo = false

    where user_id =
      p_user_id

    returning *
    into v_perfil_final;


  elsif v_tipo in (
    'gestor',
    'diretor',
    'adm'
  )
  then

    -- Perfis não-Vendedor não possuem Time fixo.

    update public.perfis

    set
      tipo_acesso = v_tipo,
      time_equipe = null

    where user_id =
      p_user_id

    returning *
    into v_perfil_final;


  else

    -- Vendedor -> Vendedor.
    -- Não altera Time nem estado ativo.

    update public.perfis

    set tipo_acesso =
      'vendedor'

    where user_id =
      p_user_id

    returning *
    into v_perfil_final;

  end if;


  -- -------------------------------------------------------
  -- 8.3.6 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'user_id',
      v_perfil_final.user_id,

    'nome',
      v_perfil_final.nome,

    'email',
      v_perfil_final.email,

    'tipo_acesso',
      v_perfil_final.tipo_acesso,

    'ativo',
      v_perfil_final.ativo,

    'time_equipe',
      v_perfil_final.time_equipe

  );

end;

$function$;


comment on function
public.definir_tipo_acesso(uuid, text)
is
'V1: somente ADM altera Vendedor/Gestor/Diretor/ADM; perfis não-Vendedor não possuem Time fixo; novo Vendedor nasce inativo até receber Time.';


-- =========================================================
-- 8.4 REMOVER RPC ANTIGA DE "ACESSO"
-- =========================================================
--
-- definir_acesso_vendedor() alterava somente o campo ativo,
-- mas o nome confundia estado ativo com tipo_acesso.
--
-- A função oficial passa a ser:
--
--   definir_ativo_usuario(uuid, boolean)
--
-- Não usar CASCADE.
-- =========================================================

revoke all
on function
public.definir_acesso_vendedor(uuid, boolean)
from public, anon, authenticated;


drop function if exists
public.definir_acesso_vendedor(uuid, boolean);


-- =========================================================
-- 9. METAS COMERCIAIS
-- =========================================================
--
-- GESTOR:
--   - define metas individuais dos Vendedores
--   - define metas oficiais dos Times
--
-- ADM:
--   - pode consultar conforme visão global
--   - NÃO administra metas comerciais
--
-- DIRETOR:
--   - consulta
--
-- VENDEDOR:
--   - consulta conforme seu escopo
--
-- Alteração de metas ocorre exclusivamente por RPC oficial.
-- =========================================================


-- =========================================================
-- 9.1 META INDIVIDUAL DO VENDEDOR
-- =========================================================

create or replace function
public.salvar_meta_vendedor(
  p_user_id uuid,
  p_ano integer,
  p_mes integer,
  p_meta_valor numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$

declare

  v_user uuid :=
    auth.uid();

  v_vendedor
    public.perfis%rowtype;

  v_meta
    public.metas_vendedor%rowtype;

begin

  -- -------------------------------------------------------
  -- 9.1.1 Autenticação
  -- -------------------------------------------------------

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- 9.1.2 Permissão
  -- -------------------------------------------------------

  if not public.usuario_gestor() then

    raise exception
      'Somente Gestor pode definir metas individuais de Vendedores.';

  end if;


  -- -------------------------------------------------------
  -- 9.1.3 Usuário alvo
  -- -------------------------------------------------------

  if p_user_id is null then

    raise exception
      'Vendedor não informado.';

  end if;


  select *
  into v_vendedor
  from public.perfis
  where user_id =
    p_user_id
  for share;


  if not found then

    raise exception
      'Vendedor não encontrado.';

  end if;


  if v_vendedor.tipo_acesso <> 'vendedor' then

    raise exception
      'A meta individual deve pertencer a um usuário Vendedor.';

  end if;


  -- -------------------------------------------------------
  -- 9.1.4 Período
  -- -------------------------------------------------------

  if p_ano is null
     or p_ano < 2020
     or p_ano > 2100
  then

    raise exception
      'Ano inválido.';

  end if;


  if p_mes is null
     or p_mes < 1
     or p_mes > 12
  then

    raise exception
      'Mês inválido.';

  end if;


  -- -------------------------------------------------------
  -- 9.1.5 Valor
  -- -------------------------------------------------------

  if p_meta_valor is null
     or p_meta_valor < 0
  then

    raise exception
      'A meta não pode ser negativa.';

  end if;


  -- -------------------------------------------------------
  -- 9.1.6 Inserir / atualizar
  -- -------------------------------------------------------

  insert into public.metas_vendedor (

    user_id,
    ano,
    mes,
    meta_valor,

    criado_por,
    atualizado_por

  )
  values (

    p_user_id,
    p_ano,
    p_mes,
    p_meta_valor,

    v_user,
    v_user

  )

  on conflict (
    user_id,
    ano,
    mes
  )

  do update
  set
    meta_valor =
      excluded.meta_valor,

    atualizado_por =
      v_user,

    updated_at =
      now()

  returning *
  into v_meta;


  -- -------------------------------------------------------
  -- 9.1.7 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'id',
      v_meta.id,

    'user_id',
      v_meta.user_id,

    'ano',
      v_meta.ano,

    'mes',
      v_meta.mes,

    'meta_valor',
      v_meta.meta_valor,

    'updated_at',
      v_meta.updated_at

  );

end;

$function$;


comment on function
public.salvar_meta_vendedor(uuid, integer, integer, numeric)
is
'V1: somente Gestor define ou altera meta individual de usuário com perfil Vendedor.';


-- =========================================================
-- 9.2 META OFICIAL DO TIME
-- =========================================================

create or replace function
public.salvar_meta_equipe(
  p_time_equipe text,
  p_ano integer,
  p_mes integer,
  p_meta_valor numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$

declare

  v_user uuid :=
    auth.uid();

  v_time text :=
    lower(
      btrim(
        coalesce(
          p_time_equipe,
          ''
        )
      )
    );

  v_meta
    public.metas_equipe%rowtype;

begin

  -- -------------------------------------------------------
  -- 9.2.1 Autenticação
  -- -------------------------------------------------------

  if v_user is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- 9.2.2 Permissão
  -- -------------------------------------------------------

  if not public.usuario_gestor() then

    raise exception
      'Somente Gestor pode definir metas oficiais dos Times.';

  end if;


  -- -------------------------------------------------------
  -- 9.2.3 Time
  -- -------------------------------------------------------

  if v_time not in (
    'pharma',
    'food',
    'revenda'
  ) then

    raise exception
      'Time comercial inválido.';

  end if;


  -- -------------------------------------------------------
  -- 9.2.4 Período
  -- -------------------------------------------------------

  if p_ano is null
     or p_ano < 2020
     or p_ano > 2100
  then

    raise exception
      'Ano inválido.';

  end if;


  if p_mes is null
     or p_mes < 1
     or p_mes > 12
  then

    raise exception
      'Mês inválido.';

  end if;


  -- -------------------------------------------------------
  -- 9.2.5 Valor
  -- -------------------------------------------------------

  if p_meta_valor is null
     or p_meta_valor < 0
  then

    raise exception
      'Informe uma meta válida.';

  end if;


  -- -------------------------------------------------------
  -- 9.2.6 Inserir / atualizar
  -- -------------------------------------------------------

  insert into public.metas_equipe (

    time_equipe,
    ano,
    mes,
    meta_valor,

    criado_por,
    atualizado_por

  )
  values (

    v_time,
    p_ano,
    p_mes,
    p_meta_valor,

    v_user,
    v_user

  )

  on conflict (
    time_equipe,
    ano,
    mes
  )

  do update
  set
    meta_valor =
      excluded.meta_valor,

    atualizado_por =
      v_user,

    updated_at =
      now()

  returning *
  into v_meta;


  -- -------------------------------------------------------
  -- 9.2.7 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(

    'id',
      v_meta.id,

    'time_equipe',
      v_meta.time_equipe,

    'ano',
      v_meta.ano,

    'mes',
      v_meta.mes,

    'meta_valor',
      v_meta.meta_valor

  );

end;

$function$;


comment on function
public.salvar_meta_equipe(text, integer, integer, numeric)
is
'V1: somente Gestor define ou altera meta oficial de Pharma, Food ou Revenda.';


-- =========================================================
-- 9.3 REMOVER ALTERAÇÃO DIRETA DE META DE VENDEDOR
-- =========================================================
--
-- O frontend deve utilizar exclusivamente:
--
--   salvar_meta_vendedor()
--
-- A leitura continua regida por metas_vendedor_select.
-- =========================================================

drop policy if exists
metas_vendedor_insert
on public.metas_vendedor;


drop policy if exists
metas_vendedor_update
on public.metas_vendedor;


drop policy if exists
metas_vendedor_delete
on public.metas_vendedor;


-- =========================================================
-- 9.4 BLOQUEAR DML DIRETO NAS TABELAS DE META
-- =========================================================
--
-- SELECT permanece disponível conforme RLS.
--
-- INSERT / UPDATE / DELETE da aplicação passam
-- exclusivamente pelas RPCs SECURITY DEFINER.
-- =========================================================

revoke insert, update, delete
on table public.metas_vendedor
from public, anon, authenticated;


revoke insert, update, delete
on table public.metas_equipe
from public, anon, authenticated;


-- =========================================================
-- 9.5 EXECUÇÃO DAS RPCs OFICIAIS
-- =========================================================

revoke all
on function
public.salvar_meta_vendedor(
  uuid,
  integer,
  integer,
  numeric
)
from public, anon;


revoke all
on function
public.salvar_meta_equipe(
  text,
  integer,
  integer,
  numeric
)
from public, anon;


grant execute
on function
public.salvar_meta_vendedor(
  uuid,
  integer,
  integer,
  numeric
)
to authenticated, service_role;


grant execute
on function
public.salvar_meta_equipe(
  text,
  integer,
  integer,
  numeric
)
to authenticated, service_role;


-- =========================================================
-- 10. RLS FINAL DA V1
-- =========================================================
--
-- Banco é a fonte de verdade.
--
-- Ocultar botão no frontend NÃO concede nem remove
-- autorização.
--
-- As policies abaixo consolidam:
--
--   VISUALIZAÇÃO
--   OPERAÇÃO
--   ROTAS OFICIAIS
--
-- =========================================================


-- =========================================================
-- 10.1 PROPOSTAS
-- =========================================================

alter table public.propostas
enable row level security;


-- ---------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------

drop policy if exists
propostas_select
on public.propostas;


create policy propostas_select
on public.propostas
for select
to authenticated
using (
  public.pode_visualizar_proposta(id)
);


-- ---------------------------------------------------------
-- INSERT DIRETO
-- ---------------------------------------------------------
--
-- Não existe mais criação direta de propostas pela tabela.
--
-- A única porta oficial é:
--
--   criar_proposta_r0()
--
-- Como ela é SECURITY DEFINER, não depende da permissão
-- INSERT do usuário autenticado sobre public.propostas.
-- ---------------------------------------------------------

drop policy if exists
propostas_insert
on public.propostas;


revoke insert
on table public.propostas
from public, anon, authenticated;


-- ---------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------
--
-- Continua necessário para os fluxos comerciais atuais
-- executados sob RLS.
--
-- pode_acessar_proposta() agora significa:
--
--   Vendedor/Gestor ativo
--   +
--   responsável atual
-- ---------------------------------------------------------

drop policy if exists
propostas_update
on public.propostas;


create policy propostas_update
on public.propostas
for update
to authenticated
using (
  public.pode_acessar_proposta(id)
)
with check (
  public.pode_acessar_proposta(id)
);


-- ---------------------------------------------------------
-- DELETE
-- ---------------------------------------------------------
--
-- A V1 não possui fluxo de exclusão de proposta.
-- ---------------------------------------------------------

drop policy if exists
propostas_delete
on public.propostas;


revoke delete
on table public.propostas
from public, anon, authenticated;



-- =========================================================
-- 10.2 REVISÕES DA PROPOSTA
-- =========================================================

alter table public.revisoes_proposta
enable row level security;


-- ---------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------

drop policy if exists
revisoes_select
on public.revisoes_proposta;


create policy revisoes_select
on public.revisoes_proposta
for select
to authenticated
using (
  public.pode_visualizar_proposta(
    proposta_id
  )
);


-- ---------------------------------------------------------
-- INSERT
-- ---------------------------------------------------------
--
-- Necessário para criar_nova_revisao() na arquitetura
-- atual.
--
-- Além do acesso à proposta, o autor precisa ser
-- obrigatoriamente o usuário autenticado.
-- ---------------------------------------------------------

drop policy if exists
revisoes_insert
on public.revisoes_proposta;


create policy revisoes_insert
on public.revisoes_proposta
for insert
to authenticated
with check (

  public.pode_acessar_proposta(
    proposta_id
  )

  and

  criado_por = auth.uid()

);


-- ---------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------

drop policy if exists
revisoes_update
on public.revisoes_proposta;


create policy revisoes_update
on public.revisoes_proposta
for update
to authenticated
using (
  public.pode_acessar_proposta(
    proposta_id
  )
)
with check (
  public.pode_acessar_proposta(
    proposta_id
  )
);


-- ---------------------------------------------------------
-- DELETE
-- ---------------------------------------------------------
--
-- Revisões R0/R1/R2 fazem parte do histórico oficial.
-- Não existe exclusão de revisão na V1.
-- ---------------------------------------------------------

drop policy if exists
revisoes_delete
on public.revisoes_proposta;


revoke delete
on table public.revisoes_proposta
from public, anon, authenticated;



-- =========================================================
-- 10.3 ITENS DA REVISÃO
-- =========================================================
--
-- ATENÇÃO:
--
-- DELETE de item NÃO é removido.
--
-- O fluxo atual de salvar rascunho pode reconstruir
-- itens da revisão enquanto ela ainda está editável.
--
-- As proteções de revisão enviada continuam nos triggers.
-- =========================================================

alter table public.itens_revisao
enable row level security;


-- ---------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------

drop policy if exists
itens_select
on public.itens_revisao;


create policy itens_select
on public.itens_revisao
for select
to authenticated
using (
  public.pode_visualizar_revisao(
    revisao_id
  )
);


-- ---------------------------------------------------------
-- INSERT
-- ---------------------------------------------------------

drop policy if exists
itens_insert
on public.itens_revisao;


create policy itens_insert
on public.itens_revisao
for insert
to authenticated
with check (
  public.pode_acessar_revisao(
    revisao_id
  )
);


-- ---------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------

drop policy if exists
itens_update
on public.itens_revisao;


create policy itens_update
on public.itens_revisao
for update
to authenticated
using (
  public.pode_acessar_revisao(
    revisao_id
  )
)
with check (
  public.pode_acessar_revisao(
    revisao_id
  )
);


-- ---------------------------------------------------------
-- DELETE
-- ---------------------------------------------------------

drop policy if exists
itens_delete
on public.itens_revisao;


create policy itens_delete
on public.itens_revisao
for delete
to authenticated
using (
  public.pode_acessar_revisao(
    revisao_id
  )
);



-- =========================================================
-- 10.4 PERFIS
-- =========================================================
--
-- Escrita direta não faz mais parte da API da aplicação.
--
-- Alterações oficiais:
--
--   definir_ativo_usuario()
--   definir_time_vendedor()
--   definir_tipo_acesso()
--
-- Novo perfil:
--
--   criar_perfil_novo_usuario()
--   trigger SECURITY DEFINER
--
-- =========================================================

alter table public.perfis
enable row level security;


-- ---------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------

drop policy if exists
perfis_select
on public.perfis;


create policy perfis_select
on public.perfis
for select
to authenticated
using (

  public.usuario_visao_global()

  or

  (
    user_id = auth.uid()
    and ativo = true
  )

);


-- ---------------------------------------------------------
-- ESCRITA DIRETA
-- ---------------------------------------------------------

drop policy if exists
perfis_insert
on public.perfis;


drop policy if exists
perfis_update
on public.perfis;


drop policy if exists
perfis_delete
on public.perfis;


revoke insert, update, delete
on table public.perfis
from public, anon, authenticated;



-- =========================================================
-- 10.5 METAS INDIVIDUAIS
-- =========================================================

alter table public.metas_vendedor
enable row level security;


drop policy if exists
metas_vendedor_select
on public.metas_vendedor;


create policy metas_vendedor_select
on public.metas_vendedor
for select
to authenticated
using (

  public.usuario_visao_global()

  or

  exists (

    select 1

    from public.perfis p

    where p.user_id =
      auth.uid()

      and p.ativo = true

      and p.tipo_acesso =
        'vendedor'

      and p.user_id =
        metas_vendedor.user_id

  )

);


-- Reforço idempotente:
-- nenhuma alteração direta de metas individuais.

drop policy if exists
metas_vendedor_insert
on public.metas_vendedor;


drop policy if exists
metas_vendedor_update
on public.metas_vendedor;


drop policy if exists
metas_vendedor_delete
on public.metas_vendedor;


revoke insert, update, delete
on table public.metas_vendedor
from public, anon, authenticated;



-- =========================================================
-- 10.6 METAS DOS TIMES
-- =========================================================

alter table public.metas_equipe
enable row level security;


drop policy if exists
metas_equipe_select
on public.metas_equipe;


create policy metas_equipe_select
on public.metas_equipe
for select
to authenticated
using (

  public.usuario_visao_global()

  or

  exists (

    select 1

    from public.perfis p

    where p.user_id =
      auth.uid()

      and p.ativo = true

      and p.tipo_acesso =
        'vendedor'

      and p.time_equipe =
        metas_equipe.time_equipe

  )

);


-- Não esperamos policies de escrita nesta tabela.
--
-- Mesmo assim, os privilégios diretos ficam
-- explicitamente fechados.

revoke insert, update, delete
on table public.metas_equipe
from public, anon, authenticated;


-- =========================================================
-- 10.7 ANON NÃO ACESSA AS TABELAS COMERCIAIS
-- =========================================================

revoke all
on table public.propostas
from anon;


revoke all
on table public.revisoes_proposta
from anon;


revoke all
on table public.itens_revisao
from anon;


revoke all
on table public.perfis
from anon;


revoke all
on table public.metas_vendedor
from anon;


revoke all
on table public.metas_equipe
from anon;

-- =========================================================
-- 11. NORMALIZAÇÃO FINAL DOS PERFIS
-- =========================================================
--
-- Regras oficiais:
--
-- VENDEDOR
--   - pode possuir Time fixo:
--       pharma / food / revenda
--
-- GESTOR / DIRETOR / ADM
--   - NÃO possuem Time fixo
--
-- Vendedor ativo obrigatoriamente possui Time válido.
-- =========================================================


-- ---------------------------------------------------------
-- 11.1 Validar Times existentes de Vendedores
-- ---------------------------------------------------------

do $validar_times_vendedores$
declare

  v_invalidos bigint;

begin

  select count(*)
  into v_invalidos

  from public.perfis p

  where p.tipo_acesso = 'vendedor'

    and p.time_equipe is not null

    and lower(
      btrim(
        p.time_equipe
      )
    ) not in (
      'pharma',
      'food',
      'revenda'
    );


  if v_invalidos > 0 then

    raise exception
      '026: existem % Vendedor(es) com Time comercial inválido. Corrigir antes de aplicar a migration.',
      v_invalidos;

  end if;

end;
$validar_times_vendedores$;


-- ---------------------------------------------------------
-- 11.2 Normalizar grafia dos Times válidos
-- ---------------------------------------------------------

update public.perfis

set time_equipe =
  lower(
    btrim(
      time_equipe
    )
  )

where tipo_acesso = 'vendedor'

  and time_equipe is not null;


-- ---------------------------------------------------------
-- 11.3 Remover Time fixo de perfis não-Vendedor
-- ---------------------------------------------------------
--
-- Isso NÃO altera revisões/propostas históricas.
-- O Time histórico está armazenado na revisão.
-- ---------------------------------------------------------

update public.perfis

set time_equipe = null

where tipo_acesso in (
  'gestor',
  'diretor',
  'adm'
)

and time_equipe is not null;


-- ---------------------------------------------------------
-- 11.4 Vendedor ativo exige Time
-- ---------------------------------------------------------

do $validar_vendedores_ativos$
declare

  v_sem_time bigint;

begin

  select count(*)
  into v_sem_time

  from public.perfis p

  where p.tipo_acesso = 'vendedor'

    and p.ativo = true

    and (
      p.time_equipe is null

      or p.time_equipe not in (
        'pharma',
        'food',
        'revenda'
      )
    );


  if v_sem_time > 0 then

    raise exception
      '026: existem % Vendedor(es) ativo(s) sem Time comercial válido.',
      v_sem_time;

  end if;

end;
$validar_vendedores_ativos$;



-- =========================================================
-- 12. ACL DAS RPCs OFICIAIS
-- =========================================================
--
-- PUBLIC / ANON:
--   sem execução.
--
-- AUTHENTICATED:
--   pode chamar a RPC, mas a própria RPC decide
--   se aquele perfil possui autorização.
--
-- SERVICE_ROLE:
--   mantido para administração técnica/backend.
-- =========================================================


-- ---------------------------------------------------------
-- 12.1 Criar proposta
-- ---------------------------------------------------------

revoke all
on function
public.criar_proposta_r0(jsonb, jsonb)
from public, anon, authenticated;


grant execute
on function
public.criar_proposta_r0(jsonb, jsonb)
to authenticated, service_role;


-- ---------------------------------------------------------
-- 12.2 Transferência
-- ---------------------------------------------------------

revoke all
on function
public.transferir_proposta(uuid, uuid, text)
from public, anon, authenticated;


grant execute
on function
public.transferir_proposta(uuid, uuid, text)
to authenticated, service_role;


-- ---------------------------------------------------------
-- 12.3 Administração de usuários
-- ---------------------------------------------------------

revoke all
on function
public.definir_ativo_usuario(uuid, boolean)
from public, anon, authenticated;


grant execute
on function
public.definir_ativo_usuario(uuid, boolean)
to authenticated, service_role;


revoke all
on function
public.definir_time_vendedor(uuid, text)
from public, anon, authenticated;


grant execute
on function
public.definir_time_vendedor(uuid, text)
to authenticated, service_role;


revoke all
on function
public.definir_tipo_acesso(uuid, text)
from public, anon, authenticated;


grant execute
on function
public.definir_tipo_acesso(uuid, text)
to authenticated, service_role;


-- ---------------------------------------------------------
-- 12.4 Metas
-- ---------------------------------------------------------

revoke all
on function
public.salvar_meta_vendedor(
  uuid,
  integer,
  integer,
  numeric
)
from public, anon, authenticated;


grant execute
on function
public.salvar_meta_vendedor(
  uuid,
  integer,
  integer,
  numeric
)
to authenticated, service_role;


revoke all
on function
public.salvar_meta_equipe(
  text,
  integer,
  integer,
  numeric
)
from public, anon, authenticated;


grant execute
on function
public.salvar_meta_equipe(
  text,
  integer,
  integer,
  numeric
)
to authenticated, service_role;



-- =========================================================
-- 13. ACL DOS HELPERS DE AUTORIZAÇÃO
-- =========================================================
--
-- Esses helpers não modificam dados.
--
-- Eles podem ser chamados pelas policies/RPCs,
-- mas não ficam expostos ao papel anon.
-- =========================================================

revoke all
on function
public.usuario_operacao_comercial()
from public, anon;


grant execute
on function
public.usuario_operacao_comercial()
to authenticated, service_role;


revoke all
on function
public.usuario_visao_global()
from public, anon;


grant execute
on function
public.usuario_visao_global()
to authenticated, service_role;


revoke all
on function
public.usuario_gestor()
from public, anon;


grant execute
on function
public.usuario_gestor()
to authenticated, service_role;


revoke all
on function
public.usuario_adm()
from public, anon;


grant execute
on function
public.usuario_adm()
to authenticated, service_role;


revoke all
on function
public.pode_acessar_proposta(uuid)
from public, anon;


grant execute
on function
public.pode_acessar_proposta(uuid)
to authenticated, service_role;


revoke all
on function
public.pode_acessar_revisao(uuid)
from public, anon;


grant execute
on function
public.pode_acessar_revisao(uuid)
to authenticated, service_role;


revoke all
on function
public.pode_visualizar_proposta(uuid)
from public, anon;


grant execute
on function
public.pode_visualizar_proposta(uuid)
to authenticated, service_role;


revoke all
on function
public.pode_visualizar_revisao(uuid)
from public, anon;


grant execute
on function
public.pode_visualizar_revisao(uuid)
to authenticated, service_role;



-- =========================================================
-- 14. PROVAR QUE usuario_gestor_ou_adm() NÃO É MAIS USADO
-- =========================================================
--
-- Não faremos DROP CASCADE.
--
-- Primeiro verificamos referências em:
--
--   funções
--   policies
--   views
--   materialized views
--   constraints
--   defaults
--   triggers
--
-- Se qualquer referência sobreviver, a migration ABORTA.
-- =========================================================

do $verificar_gestor_ou_adm$
declare

  v_referencias text;

begin

  select string_agg(
    tipo_objeto || ': ' || objeto,
    E'\n'
    order by tipo_objeto, objeto
  )

  into v_referencias

  from (

    select
      'FUNCAO'::text as tipo_objeto,

      n.nspname || '.' || p.proname ||
      '(' ||
      pg_get_function_identity_arguments(p.oid) ||
      ')' as objeto

    from pg_proc p

    join pg_namespace n
      on n.oid = p.pronamespace

    where n.nspname = 'public'

      and p.prokind = 'f'

      and p.oid is distinct from
        to_regprocedure(
          'public.usuario_gestor_ou_adm()'
        )

      and pg_get_functiondef(p.oid)
        ilike '%usuario_gestor_ou_adm%'


    union all


    select
      'POLICY',

      schemaname || '.' ||
      tablename || ' -> ' ||
      policyname

    from pg_policies

    where schemaname = 'public'

      and (
        coalesce(
          qual,
          ''
        ) ilike '%usuario_gestor_ou_adm%'

        or

        coalesce(
          with_check,
          ''
        ) ilike '%usuario_gestor_ou_adm%'
      )


    union all


    select
      'VIEW',

      schemaname || '.' ||
      viewname

    from pg_views

    where schemaname = 'public'

      and definition
        ilike '%usuario_gestor_ou_adm%'


    union all


    select
      'MATERIALIZED VIEW',

      schemaname || '.' ||
      matviewname

    from pg_matviews

    where schemaname = 'public'

      and definition
        ilike '%usuario_gestor_ou_adm%'


    union all


    select
      'CONSTRAINT',

      n.nspname || '.' ||
      c.relname || ' -> ' ||
      con.conname

    from pg_constraint con

    join pg_class c
      on c.oid = con.conrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    where n.nspname = 'public'

      and pg_get_constraintdef(
        con.oid
      ) ilike '%usuario_gestor_ou_adm%'


    union all


    select
      'DEFAULT',

      n.nspname || '.' ||
      c.relname || '.' ||
      a.attname

    from pg_attrdef d

    join pg_class c
      on c.oid = d.adrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    join pg_attribute a
      on a.attrelid = d.adrelid
     and a.attnum = d.adnum

    where n.nspname = 'public'

      and pg_get_expr(
        d.adbin,
        d.adrelid
      ) ilike '%usuario_gestor_ou_adm%'


    union all


    select
      'TRIGGER',

      n.nspname || '.' ||
      c.relname || ' -> ' ||
      t.tgname

    from pg_trigger t

    join pg_class c
      on c.oid = t.tgrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    where n.nspname = 'public'

      and t.tgisinternal = false

      and pg_get_triggerdef(
        t.oid
      ) ilike '%usuario_gestor_ou_adm%'

  ) referencias;


  if v_referencias is not null then

    raise exception
      E'026: usuario_gestor_ou_adm() ainda possui dependências:\n%',
      v_referencias;

  end if;

end;
$verificar_gestor_ou_adm$;


-- ---------------------------------------------------------
-- DROP definitivo
-- ---------------------------------------------------------

drop function if exists
public.usuario_gestor_ou_adm();



-- =========================================================
-- 15. PROVAR QUE usuario_e_vendedor(uuid) NÃO É MAIS USADO
-- =========================================================
--
-- O helper antigo servia principalmente à validação
-- das policies/RPC de metas.
--
-- A nova salvar_meta_vendedor() valida o perfil alvo
-- explicitamente.
-- =========================================================

do $verificar_usuario_e_vendedor$
declare

  v_referencias text;

begin

  select string_agg(
    tipo_objeto || ': ' || objeto,
    E'\n'
    order by tipo_objeto, objeto
  )

  into v_referencias

  from (

    select
      'FUNCAO'::text as tipo_objeto,

      n.nspname || '.' || p.proname ||
      '(' ||
      pg_get_function_identity_arguments(p.oid) ||
      ')' as objeto

    from pg_proc p

    join pg_namespace n
      on n.oid = p.pronamespace

    where n.nspname = 'public'

      and p.prokind = 'f'

      and p.oid is distinct from
        to_regprocedure(
          'public.usuario_e_vendedor(uuid)'
        )

      and pg_get_functiondef(p.oid)
        ilike '%usuario_e_vendedor%'


    union all


    select
      'POLICY',

      schemaname || '.' ||
      tablename || ' -> ' ||
      policyname

    from pg_policies

    where schemaname = 'public'

      and (
        coalesce(
          qual,
          ''
        ) ilike '%usuario_e_vendedor%'

        or

        coalesce(
          with_check,
          ''
        ) ilike '%usuario_e_vendedor%'
      )


    union all


    select
      'VIEW',

      schemaname || '.' ||
      viewname

    from pg_views

    where schemaname = 'public'

      and definition
        ilike '%usuario_e_vendedor%'


    union all


    select
      'MATERIALIZED VIEW',

      schemaname || '.' ||
      matviewname

    from pg_matviews

    where schemaname = 'public'

      and definition
        ilike '%usuario_e_vendedor%'


    union all


    select
      'CONSTRAINT',

      n.nspname || '.' ||
      c.relname || ' -> ' ||
      con.conname

    from pg_constraint con

    join pg_class c
      on c.oid = con.conrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    where n.nspname = 'public'

      and pg_get_constraintdef(
        con.oid
      ) ilike '%usuario_e_vendedor%'


    union all


    select
      'DEFAULT',

      n.nspname || '.' ||
      c.relname || '.' ||
      a.attname

    from pg_attrdef d

    join pg_class c
      on c.oid = d.adrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    join pg_attribute a
      on a.attrelid = d.adrelid
     and a.attnum = d.adnum

    where n.nspname = 'public'

      and pg_get_expr(
        d.adbin,
        d.adrelid
      ) ilike '%usuario_e_vendedor%'


    union all


    select
      'TRIGGER',

      n.nspname || '.' ||
      c.relname || ' -> ' ||
      t.tgname

    from pg_trigger t

    join pg_class c
      on c.oid = t.tgrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    where n.nspname = 'public'

      and t.tgisinternal = false

      and pg_get_triggerdef(
        t.oid
      ) ilike '%usuario_e_vendedor%'

  ) referencias;


  if v_referencias is not null then

    raise exception
      E'026: usuario_e_vendedor(uuid) ainda possui dependências:\n%',
      v_referencias;

  end if;

end;
$verificar_usuario_e_vendedor$;


-- ---------------------------------------------------------
-- DROP definitivo
-- ---------------------------------------------------------

drop function if exists
public.usuario_e_vendedor(uuid);

-- =========================================================
-- 16. ACL FINAL DAS TABELAS CRÍTICAS
-- =========================================================
--
-- Removemos qualquer privilégio herdado de PUBLIC / ANON
-- e declaramos explicitamente o que AUTHENTICATED pode
-- fazer diretamente.
--
-- Operações privilegiadas continuam pelas RPCs
-- SECURITY DEFINER.
-- =========================================================


-- ---------------------------------------------------------
-- 16.1 Remover privilégios genéricos
-- ---------------------------------------------------------

revoke all
on table public.propostas
from public, anon;

revoke all
on table public.revisoes_proposta
from public, anon;

revoke all
on table public.itens_revisao
from public, anon;

revoke all
on table public.perfis
from public, anon;

revoke all
on table public.metas_vendedor
from public, anon;

revoke all
on table public.metas_equipe
from public, anon;


-- ---------------------------------------------------------
-- 16.2 Privilégios diretos do usuário autenticado
-- ---------------------------------------------------------
--
-- PROPOSTAS
--   SELECT / UPDATE
--
-- Criação:
--   criar_proposta_r0()
--
-- Exclusão:
--   não existe na V1.
-- ---------------------------------------------------------

revoke all
on table public.propostas
from authenticated;

grant
  select,
  update
on table public.propostas
to authenticated;


-- ---------------------------------------------------------
-- REVISÕES
--
-- SELECT / INSERT / UPDATE
--
-- DELETE não existe na V1.
-- ---------------------------------------------------------

revoke all
on table public.revisoes_proposta
from authenticated;

grant
  select,
  insert,
  update
on table public.revisoes_proposta
to authenticated;


-- ---------------------------------------------------------
-- ITENS
--
-- DELETE continua necessário para reconstrução
-- controlada de itens de rascunho.
-- ---------------------------------------------------------

revoke all
on table public.itens_revisao
from authenticated;

grant
  select,
  insert,
  update,
  delete
on table public.itens_revisao
to authenticated;


-- ---------------------------------------------------------
-- PERFIS
--
-- Escrita exclusivamente pelas RPCs oficiais.
-- ---------------------------------------------------------

revoke all
on table public.perfis
from authenticated;

grant select
on table public.perfis
to authenticated;


-- ---------------------------------------------------------
-- METAS
--
-- Escrita exclusivamente pelas RPCs oficiais.
-- ---------------------------------------------------------

revoke all
on table public.metas_vendedor
from authenticated;

grant select
on table public.metas_vendedor
to authenticated;


revoke all
on table public.metas_equipe
from authenticated;

grant select
on table public.metas_equipe
to authenticated;



-- =========================================================
-- 17. POSTFLIGHT ESTRUTURAL
-- =========================================================
--
-- Se qualquer uma destas verificações falhar:
--
--   RAISE EXCEPTION
--        ↓
--   COMMIT não é alcançado
--        ↓
--   toda a migration sofre ROLLBACK
--
-- =========================================================

do $postflight_026$

declare

  v_quantidade integer;
  v_todos_rls boolean;
  v_policies text;

begin

  -- =======================================================
  -- 17.1 Funções obrigatórias
  -- =======================================================

  if to_regprocedure(
    'public.usuario_operacao_comercial()'
  ) is null then

    raise exception
      '026 POSTFLIGHT: usuario_operacao_comercial() ausente.';

  end if;


  if to_regprocedure(
    'public.usuario_visao_global()'
  ) is null then

    raise exception
      '026 POSTFLIGHT: usuario_visao_global() ausente.';

  end if;


  if to_regprocedure(
    'public.usuario_gestor()'
  ) is null then

    raise exception
      '026 POSTFLIGHT: usuario_gestor() ausente.';

  end if;


  if to_regprocedure(
    'public.usuario_adm()'
  ) is null then

    raise exception
      '026 POSTFLIGHT: usuario_adm() ausente.';

  end if;


  if to_regprocedure(
    'public.pode_acessar_proposta(uuid)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: pode_acessar_proposta(uuid) ausente.';

  end if;


  if to_regprocedure(
    'public.pode_acessar_revisao(uuid)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: pode_acessar_revisao(uuid) ausente.';

  end if;


  if to_regprocedure(
    'public.pode_visualizar_proposta(uuid)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: pode_visualizar_proposta(uuid) ausente.';

  end if;


  if to_regprocedure(
    'public.pode_visualizar_revisao(uuid)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: pode_visualizar_revisao(uuid) ausente.';

  end if;


  if to_regprocedure(
    'public.criar_proposta_r0(jsonb,jsonb)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: criar_proposta_r0() ausente.';

  end if;


  if to_regprocedure(
    'public.transferir_proposta(uuid,uuid,text)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: transferir_proposta() ausente.';

  end if;


  if to_regprocedure(
    'public.definir_ativo_usuario(uuid,boolean)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: definir_ativo_usuario() ausente.';

  end if;


  if to_regprocedure(
    'public.definir_time_vendedor(uuid,text)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: definir_time_vendedor() ausente.';

  end if;


  if to_regprocedure(
    'public.definir_tipo_acesso(uuid,text)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: definir_tipo_acesso() ausente.';

  end if;


  if to_regprocedure(
    'public.salvar_meta_vendedor(uuid,integer,integer,numeric)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: salvar_meta_vendedor() ausente.';

  end if;


  if to_regprocedure(
    'public.salvar_meta_equipe(text,integer,integer,numeric)'
  ) is null then

    raise exception
      '026 POSTFLIGHT: salvar_meta_equipe() ausente.';

  end if;


  -- =======================================================
  -- 17.2 Objetos legados precisam ter desaparecido
  -- =======================================================

  if to_regprocedure(
    'public.usuario_gestor_ou_adm()'
  ) is not null then

    raise exception
      '026 POSTFLIGHT: usuario_gestor_ou_adm() ainda existe.';

  end if;


  if to_regprocedure(
    'public.usuario_e_vendedor(uuid)'
  ) is not null then

    raise exception
      '026 POSTFLIGHT: usuario_e_vendedor(uuid) ainda existe.';

  end if;


  if to_regprocedure(
    'public.definir_vendedor_responsavel(uuid,uuid)'
  ) is not null then

    raise exception
      '026 POSTFLIGHT: definir_vendedor_responsavel() ainda existe.';

  end if;


  if to_regprocedure(
    'public.definir_acesso_vendedor(uuid,boolean)'
  ) is not null then

    raise exception
      '026 POSTFLIGHT: definir_acesso_vendedor() ainda existe.';

  end if;


  -- =======================================================
  -- 17.3 ADM não pode permanecer no núcleo operacional
  -- =======================================================

  if pg_get_functiondef(
       to_regprocedure(
         'public.usuario_operacao_comercial()'
       )
     ) ilike '%''adm''%'
  then

    raise exception
      '026 POSTFLIGHT: ADM ainda aparece em usuario_operacao_comercial().';

  end if;


  if pg_get_functiondef(
       to_regprocedure(
         'public.pode_acessar_proposta(uuid)'
       )
     ) ilike '%usuario_adm%'
  then

    raise exception
      '026 POSTFLIGHT: pode_acessar_proposta() ainda possui atalho de ADM.';

  end if;


  -- =======================================================
  -- 17.4 Precisa existir pelo menos um ADM ativo
  -- =======================================================

  select count(*)
  into v_quantidade

  from public.perfis p

  where p.tipo_acesso = 'adm'
    and p.ativo = true;


  if v_quantidade < 1 then

    raise exception
      '026 POSTFLIGHT: o sistema precisa possuir pelo menos um ADM ativo.';

  end if;


  -- =======================================================
  -- 17.5 Integridade dos Times
  -- =======================================================

  if exists (

    select 1

    from public.perfis p

    where p.tipo_acesso = 'vendedor'

      and p.ativo = true

      and (
        p.time_equipe is null

        or p.time_equipe not in (
          'pharma',
          'food',
          'revenda'
        )
      )

  ) then

    raise exception
      '026 POSTFLIGHT: existe Vendedor ativo sem Time comercial válido.';

  end if;


  if exists (

    select 1

    from public.perfis p

    where p.tipo_acesso in (
      'gestor',
      'diretor',
      'adm'
    )

    and p.time_equipe is not null

  ) then

    raise exception
      '026 POSTFLIGHT: perfil não-Vendedor possui Time fixo.';

  end if;


  -- =======================================================
  -- 17.6 RLS habilitado nas seis tabelas críticas
  -- =======================================================

  select
    count(*),
    bool_and(c.relrowsecurity)

  into
    v_quantidade,
    v_todos_rls

  from pg_class c

  join pg_namespace n
    on n.oid = c.relnamespace

  where n.nspname = 'public'

    and c.relname in (
      'propostas',
      'revisoes_proposta',
      'itens_revisao',
      'perfis',
      'metas_vendedor',
      'metas_equipe'
    )

    and c.relkind = 'r';


  if v_quantidade <> 6
     or v_todos_rls is distinct from true
  then

    raise exception
      '026 POSTFLIGHT: RLS não está habilitado corretamente em todas as tabelas críticas.';

  end if;


  -- =======================================================
  -- 17.7 Inventário exato das policies de PROPOSTAS
  -- =======================================================

  select string_agg(
    policyname || ':' || cmd,
    ', '
    order by policyname
  )

  into v_policies

  from pg_policies

  where schemaname = 'public'
    and tablename = 'propostas';


  if coalesce(v_policies, '') <>
     'propostas_select:SELECT, propostas_update:UPDATE'
  then

    raise exception
      '026 POSTFLIGHT: policies inesperadas em propostas: %',
      coalesce(v_policies, 'nenhuma');

  end if;


  -- =======================================================
  -- 17.8 Inventário exato das policies de REVISÕES
  -- =======================================================

  select string_agg(
    policyname || ':' || cmd,
    ', '
    order by policyname
  )

  into v_policies

  from pg_policies

  where schemaname = 'public'
    and tablename = 'revisoes_proposta';


  if coalesce(v_policies, '') <>
     'revisoes_insert:INSERT, revisoes_select:SELECT, revisoes_update:UPDATE'
  then

    raise exception
      '026 POSTFLIGHT: policies inesperadas em revisoes_proposta: %',
      coalesce(v_policies, 'nenhuma');

  end if;


  -- =======================================================
  -- 17.9 Inventário exato das policies de ITENS
  -- =======================================================

  select string_agg(
    policyname || ':' || cmd,
    ', '
    order by policyname
  )

  into v_policies

  from pg_policies

  where schemaname = 'public'
    and tablename = 'itens_revisao';


  if coalesce(v_policies, '') <>
     'itens_delete:DELETE, itens_insert:INSERT, itens_select:SELECT, itens_update:UPDATE'
  then

    raise exception
      '026 POSTFLIGHT: policies inesperadas em itens_revisao: %',
      coalesce(v_policies, 'nenhuma');

  end if;


  -- =======================================================
  -- 17.10 PERFIS possui somente SELECT
  -- =======================================================

  select string_agg(
    policyname || ':' || cmd,
    ', '
    order by policyname
  )

  into v_policies

  from pg_policies

  where schemaname = 'public'
    and tablename = 'perfis';


  if coalesce(v_policies, '') <>
     'perfis_select:SELECT'
  then

    raise exception
      '026 POSTFLIGHT: policies inesperadas em perfis: %',
      coalesce(v_policies, 'nenhuma');

  end if;


  -- =======================================================
  -- 17.11 META INDIVIDUAL possui somente SELECT
  -- =======================================================

  select string_agg(
    policyname || ':' || cmd,
    ', '
    order by policyname
  )

  into v_policies

  from pg_policies

  where schemaname = 'public'
    and tablename = 'metas_vendedor';


  if coalesce(v_policies, '') <>
     'metas_vendedor_select:SELECT'
  then

    raise exception
      '026 POSTFLIGHT: policies inesperadas em metas_vendedor: %',
      coalesce(v_policies, 'nenhuma');

  end if;


  -- =======================================================
  -- 17.12 META DE TIME possui somente SELECT
  -- =======================================================

  select string_agg(
    policyname || ':' || cmd,
    ', '
    order by policyname
  )

  into v_policies

  from pg_policies

  where schemaname = 'public'
    and tablename = 'metas_equipe';


  if coalesce(v_policies, '') <>
     'metas_equipe_select:SELECT'
  then

    raise exception
      '026 POSTFLIGHT: policies inesperadas em metas_equipe: %',
      coalesce(v_policies, 'nenhuma');

  end if;


  -- =======================================================
  -- 17.13 Sem bypass de escrita direta
  -- =======================================================

  if has_table_privilege(
       'authenticated',
       'public.propostas',
       'INSERT'
     )
  then

    raise exception
      '026 POSTFLIGHT: authenticated ainda possui INSERT direto em propostas.';

  end if;


  if has_table_privilege(
       'authenticated',
       'public.propostas',
       'DELETE'
     )
  then

    raise exception
      '026 POSTFLIGHT: authenticated ainda possui DELETE em propostas.';

  end if;


  if has_table_privilege(
       'authenticated',
       'public.revisoes_proposta',
       'DELETE'
     )
  then

    raise exception
      '026 POSTFLIGHT: authenticated ainda possui DELETE em revisões.';

  end if;


  if has_table_privilege(
       'authenticated',
       'public.perfis',
       'INSERT'
     )
     or
     has_table_privilege(
       'authenticated',
       'public.perfis',
       'UPDATE'
     )
     or
     has_table_privilege(
       'authenticated',
       'public.perfis',
       'DELETE'
     )
  then

    raise exception
      '026 POSTFLIGHT: authenticated ainda possui escrita direta em perfis.';

  end if;


  if has_table_privilege(
       'authenticated',
       'public.metas_vendedor',
       'INSERT'
     )
     or
     has_table_privilege(
       'authenticated',
       'public.metas_vendedor',
       'UPDATE'
     )
     or
     has_table_privilege(
       'authenticated',
       'public.metas_vendedor',
       'DELETE'
     )
  then

    raise exception
      '026 POSTFLIGHT: authenticated ainda possui escrita direta em metas_vendedor.';

  end if;


  if has_table_privilege(
       'authenticated',
       'public.metas_equipe',
       'INSERT'
     )
     or
     has_table_privilege(
       'authenticated',
       'public.metas_equipe',
       'UPDATE'
     )
     or
     has_table_privilege(
       'authenticated',
       'public.metas_equipe',
       'DELETE'
     )
  then

    raise exception
      '026 POSTFLIGHT: authenticated ainda possui escrita direta em metas_equipe.';

  end if;


  -- =======================================================
  -- 17.14 Privilégios necessários continuam presentes
  -- =======================================================

  if not has_table_privilege(
    'authenticated',
    'public.propostas',
    'SELECT'
  ) then

    raise exception
      '026 POSTFLIGHT: authenticated perdeu SELECT em propostas.';

  end if;


  if not has_table_privilege(
    'authenticated',
    'public.propostas',
    'UPDATE'
  ) then

    raise exception
      '026 POSTFLIGHT: authenticated perdeu UPDATE em propostas.';

  end if;


  if not has_table_privilege(
       'authenticated',
       'public.revisoes_proposta',
       'SELECT'
     )
     or not has_table_privilege(
       'authenticated',
       'public.revisoes_proposta',
       'INSERT'
     )
     or not has_table_privilege(
       'authenticated',
       'public.revisoes_proposta',
       'UPDATE'
     )
  then

    raise exception
      '026 POSTFLIGHT: privilégios necessários das revisões estão incompletos.';

  end if;

  if not has_table_privilege(
       'authenticated',
       'public.itens_revisao',
       'SELECT'
     )
     or not has_table_privilege(
       'authenticated',
       'public.itens_revisao',
       'INSERT'
     )
     or not has_table_privilege(
       'authenticated',
       'public.itens_revisao',
       'UPDATE'
     )
     or not has_table_privilege(
       'authenticated',
       'public.itens_revisao',
       'DELETE'
     )
  then

    raise exception
      '026 POSTFLIGHT: privilégios necessários dos itens estão incompletos.';

  end if;

  -- =======================================================
  -- 17.15 AUTHENTICATED executa RPCs oficiais
  -- =======================================================

  if not has_function_privilege(
    'authenticated',
    'public.criar_proposta_r0(jsonb,jsonb)',
    'EXECUTE'
  ) then

    raise exception
      '026 POSTFLIGHT: criar_proposta_r0() sem EXECUTE para authenticated.';

  end if;


  if not has_function_privilege(
    'authenticated',
    'public.transferir_proposta(uuid,uuid,text)',
    'EXECUTE'
  ) then

    raise exception
      '026 POSTFLIGHT: transferir_proposta() sem EXECUTE para authenticated.';

  end if;


  if not has_function_privilege(
    'authenticated',
    'public.definir_ativo_usuario(uuid,boolean)',
    'EXECUTE'
  ) then

    raise exception
      '026 POSTFLIGHT: definir_ativo_usuario() sem EXECUTE para authenticated.';

  end if;


  if not has_function_privilege(
    'authenticated',
    'public.definir_time_vendedor(uuid,text)',
    'EXECUTE'
  ) then

    raise exception
      '026 POSTFLIGHT: definir_time_vendedor() sem EXECUTE para authenticated.';

  end if;


  if not has_function_privilege(
    'authenticated',
    'public.definir_tipo_acesso(uuid,text)',
    'EXECUTE'
  ) then

    raise exception
      '026 POSTFLIGHT: definir_tipo_acesso() sem EXECUTE para authenticated.';

  end if;


  if not has_function_privilege(
    'authenticated',
    'public.salvar_meta_vendedor(uuid,integer,integer,numeric)',
    'EXECUTE'
  ) then

    raise exception
      '026 POSTFLIGHT: salvar_meta_vendedor() sem EXECUTE para authenticated.';

  end if;


  if not has_function_privilege(
    'authenticated',
    'public.salvar_meta_equipe(text,integer,integer,numeric)',
    'EXECUTE'
  ) then

    raise exception
      '026 POSTFLIGHT: salvar_meta_equipe() sem EXECUTE para authenticated.';

  end if;


  -- =======================================================
  -- 17.16 ANON não executa RPCs sensíveis
  -- =======================================================

  if has_function_privilege(
    'anon',
    'public.criar_proposta_r0(jsonb,jsonb)',
    'EXECUTE'
  )
     or
     has_function_privilege(
       'anon',
       'public.transferir_proposta(uuid,uuid,text)',
       'EXECUTE'
     )
     or
     has_function_privilege(
       'anon',
       'public.definir_ativo_usuario(uuid,boolean)',
       'EXECUTE'
     )
     or
     has_function_privilege(
       'anon',
       'public.definir_time_vendedor(uuid,text)',
       'EXECUTE'
     )
     or
     has_function_privilege(
       'anon',
       'public.definir_tipo_acesso(uuid,text)',
       'EXECUTE'
     )
     or
     has_function_privilege(
       'anon',
       'public.salvar_meta_vendedor(uuid,integer,integer,numeric)',
       'EXECUTE'
     )
     or
     has_function_privilege(
       'anon',
       'public.salvar_meta_equipe(text,integer,integer,numeric)',
       'EXECUTE'
     )
  then

    raise exception
      '026 POSTFLIGHT: ANON ainda executa alguma RPC sensível.';

  end if;


end;

$postflight_026$;



-- =========================================================
-- 18. MIGRATION CONCLUÍDA
-- =========================================================

commit;