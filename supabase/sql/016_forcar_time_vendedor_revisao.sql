-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 016_forcar_time_vendedor_revisao.sql
--
-- Responsabilidade:
-- - Impedir que vendedor escolha outro Time pelo navegador
-- - Forçar o Time oficial cadastrado no perfil
-- - Manter Gestor / ADM livres para definir o Time
-- - Aplicar a regra em R0, R1, R2, R3...
--
-- Dependências:
-- - public.perfis.time_equipe
-- - public.revisoes_proposta.time_equipe
-- =========================================================


begin;


-- =========================================================
-- ## 1. FUNÇÃO DE SEGURANÇA DO TIME
-- =========================================================

create or replace function public.aplicar_time_equipe_revisao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$

declare

  v_user_id
    uuid;

  v_tipo_acesso
    text;

  v_ativo
    boolean;

  v_time_equipe
    text;

begin


  -- -------------------------------------------------------
  -- ## 1.1 Usuário autenticado
  -- -------------------------------------------------------

  v_user_id :=
    auth.uid();


  -- Operações administrativas feitas diretamente
  -- pelo banco, sem JWT autenticado, não são alteradas.

  if v_user_id is null then

    return new;

  end if;


  -- -------------------------------------------------------
  -- ## 1.2 Buscar perfil oficial
  -- -------------------------------------------------------

  select

    p.tipo_acesso,
    p.ativo,
    p.time_equipe

  into

    v_tipo_acesso,
    v_ativo,
    v_time_equipe

  from public.perfis p

  where
    p.user_id =
      v_user_id;


  if not found then

    raise exception
      'Perfil do usuário autenticado não encontrado.';

  end if;


  -- -------------------------------------------------------
  -- ## 1.3 Validar acesso
  -- -------------------------------------------------------

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


  -- -------------------------------------------------------
  -- ## 1.4 Regra do VENDEDOR
  -- -------------------------------------------------------

  if
    v_tipo_acesso =
      'vendedor'
  then


    -- Vendedor precisa obrigatoriamente possuir
    -- um Time comercial válido.

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


    -- Esta é a proteção principal.
    --
    -- Não importa o que o navegador enviou.
    -- O banco utiliza o Time oficial do perfil.

    new.time_equipe :=
      v_time_equipe;


  end if;


  -- -------------------------------------------------------
  -- ## 1.5 Regra do GESTOR / ADM
  -- -------------------------------------------------------

  -- Gestor e ADM mantêm o valor enviado.
  --
  -- A própria constraint da tabela continua garantindo
  -- que valores inválidos não sejam gravados.


  return new;


end;

$$;


-- =========================================================
-- ## 2. TRIGGER NAS REVISÕES
-- =========================================================

drop trigger if exists
  trg_aplicar_time_equipe_revisao
on public.revisoes_proposta;


create trigger
  trg_aplicar_time_equipe_revisao

before insert or update
on public.revisoes_proposta

for each row

execute function
  public.aplicar_time_equipe_revisao();


-- =========================================================
-- ## 3. PERMISSÕES
-- =========================================================

revoke all
on function
  public.aplicar_time_equipe_revisao()
from public;


commit;


-- =========================================================
-- ## 4. VERIFICAÇÃO
-- =========================================================


-- ---------------------------------------------------------
-- ## 4.1 Confirmar função
-- ---------------------------------------------------------

select

  p.proname as funcao,

  p.prosecdef as security_definer

from pg_proc p

join pg_namespace n
  on n.oid =
     p.pronamespace

where

  n.nspname =
    'public'

  and

  p.proname =
    'aplicar_time_equipe_revisao';


-- ---------------------------------------------------------
-- ## 4.2 Confirmar trigger
-- ---------------------------------------------------------

select

  tgname as trigger,

  tgenabled as habilitado

from pg_trigger

where

  tgrelid =
    'public.revisoes_proposta'::regclass

  and

  not tgisinternal

order by
  tgname;