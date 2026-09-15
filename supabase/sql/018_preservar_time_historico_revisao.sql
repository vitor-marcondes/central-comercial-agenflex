-- =========================================================
-- 018_preservar_time_historico_revisao.sql
--
-- CENTRAL AGENFLEX
--
-- OBJETIVO
-- ---------------------------------------------------------
-- Preservar o Time comercial histórico das revisões.
--
-- REGRAS:
--
-- 1. Nova R0 criada por vendedor:
--    usa o Time atual do perfil do vendedor.
--
-- 2. UPDATE de revisão já existente:
--    mantém obrigatoriamente o Time que a revisão já tinha.
--
-- 3. Nova R1 / R2 / R3...:
--    herda o Time da revisão anterior da mesma proposta.
--
-- 4. Gestor / ADM:
--    mantêm o valor enviado pela aplicação.
--
-- Isso evita que uma transferência de proposta entre
-- vendedores de Times diferentes reescreva o histórico.
-- =========================================================


create or replace function
  public.aplicar_time_equipe_revisao()

returns trigger

language plpgsql

security definer

set search_path to
  'public',
  'pg_temp'

as $function$

declare

  -- -------------------------------------------------------
  -- ## 1.1 Usuário autenticado
  -- -------------------------------------------------------

  v_user_id
    uuid;


  -- -------------------------------------------------------
  -- ## 1.2 Dados do perfil
  -- -------------------------------------------------------

  v_tipo_acesso
    text;

  v_ativo
    boolean;

  v_time_equipe
    text;


  -- -------------------------------------------------------
  -- ## 1.3 Time histórico anterior
  -- -------------------------------------------------------

  v_time_revisao_anterior
    text;


begin


  -- =======================================================
  -- ## 2. IDENTIFICAR USUÁRIO
  -- =======================================================

  v_user_id :=
    auth.uid();


  -- Operações administrativas executadas diretamente
  -- pelo banco podem não possuir JWT / auth.uid().
  --
  -- Nesses casos, esta função não interfere.

  if
    v_user_id is null
  then

    return new;

  end if;


  -- =======================================================
  -- ## 3. BUSCAR PERFIL OFICIAL
  -- =======================================================

  select

    p.tipo_acesso,
    p.ativo,
    p.time_equipe

  into

    v_tipo_acesso,
    v_ativo,
    v_time_equipe

  from
    public.perfis p

  where
    p.user_id = v_user_id;


  if not found then

    raise exception
      'Perfil do usuário autenticado não encontrado.';

  end if;


  -- =======================================================
  -- ## 4. VALIDAR ACESSO
  -- =======================================================

  if
    v_ativo is distinct from true
  then

    raise exception
      'Usuário inativo não pode alterar propostas.';

  end if;


  if
    v_tipo_acesso not in (
      'vendedor',
      'gestor',
      'adm'
    )
  then

    raise exception
      'Perfil sem permissão para alterar propostas.';

  end if;


  -- =======================================================
  -- ## 5. REGRA DO VENDEDOR
  -- =======================================================

  if
    v_tipo_acesso = 'vendedor'
  then


    -- -----------------------------------------------------
    -- ## 5.1 Validar Time oficial do vendedor
    -- -----------------------------------------------------

    if
      v_time_equipe is null
      or
      v_time_equipe not in (
        'pharma',
        'food',
        'revenda'
      )
    then

      raise exception
        'Vendedor sem Time comercial definido.';

    end if;


    -- -----------------------------------------------------
    -- ## 5.2 UPDATE
    --
    -- Revisão existente NÃO muda de Time.
    --
    -- Exemplo:
    --
    -- R0 nasceu Pharma.
    -- Proposta foi transferida para vendedor Food.
    --
    -- Ao salvar a R0:
    --
    -- OLD.time_equipe = pharma
    -- NEW.time_equipe continua pharma.
    -- -----------------------------------------------------

    if
      tg_op = 'UPDATE'
    then

      new.time_equipe :=
        old.time_equipe;

      return new;

    end if;


    -- -----------------------------------------------------
    -- ## 5.3 INSERT DA R0
    --
    -- A primeira revisão pertence ao Time atual
    -- do vendedor que está criando a proposta.
    -- -----------------------------------------------------

    if
      tg_op = 'INSERT'
      and
      coalesce(
        new.numero_revisao,
        0
      ) = 0
    then

      new.time_equipe :=
        v_time_equipe;

      return new;

    end if;


    -- -----------------------------------------------------
    -- ## 5.4 INSERT DE NOVA REVISÃO
    --
    -- R1, R2, R3...
    --
    -- O Time deve ser herdado da revisão anterior.
    --
    -- Não utilizamos o Time atual do vendedor,
    -- pois a proposta pode ter sido transferida.
    -- -----------------------------------------------------

    if
      tg_op = 'INSERT'
      and
      new.numero_revisao > 0
    then


      select
        r.time_equipe

      into
        v_time_revisao_anterior

      from
        public.revisoes_proposta r

      where
        r.proposta_id =
          new.proposta_id

        and
        r.numero_revisao <
          new.numero_revisao

      order by
        r.numero_revisao desc

      limit 1;


      -- ---------------------------------------------------
      -- ## 5.5 Integridade do histórico
      -- ---------------------------------------------------

      if
        v_time_revisao_anterior is null
      then

        raise exception
          'Não foi possível identificar o Time da revisão anterior.';

      end if;


      if
        v_time_revisao_anterior not in (
          'pharma',
          'food',
          'revenda'
        )
      then

        raise exception
          'A revisão anterior possui um Time comercial inválido.';

      end if;


      new.time_equipe :=
        v_time_revisao_anterior;


      return new;

    end if;


  end if;


  -- =======================================================
  -- ## 6. GESTOR / ADM
  -- =======================================================
  --
  -- Gestor e ADM continuam mantendo o valor enviado.
  --
  -- As constraints da tabela continuam responsáveis
  -- por impedir valores inválidos.
  -- =======================================================

  return new;


end;

$function$;


-- =========================================================
-- ## 7. DOCUMENTAÇÃO DA FUNÇÃO
-- =========================================================

comment on function
  public.aplicar_time_equipe_revisao()

is
  'Define e preserva o Time comercial histórico das revisões. R0 usa o Time atual do vendedor; UPDATE preserva o Time existente; novas revisões herdam o Time da revisão anterior.';


-- =========================================================
-- FIM
-- =========================================================