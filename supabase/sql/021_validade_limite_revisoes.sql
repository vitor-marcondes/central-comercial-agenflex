-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 021_validade_limite_revisoes.sql
--
-- Objetivo:
-- - Validade: HOJE / 3 / 5 / 7 dias
-- - Calcular vencimento no momento do envio
-- - Limitar revisões a R0 / R1 / R2
-- - Preparar o Painel para propostas vencidas
-- =========================================================

begin;


-- =========================================================
-- ## 1. VALIDADE ESTRUTURADA
-- =========================================================

alter table public.revisoes_proposta
add column if not exists validade_dias smallint;

alter table public.revisoes_proposta
add column if not exists validade_ate date;


comment on column public.revisoes_proposta.validade_dias
is 'Validade comercial em dias: 0, 3, 5 ou 7.';

comment on column public.revisoes_proposta.validade_ate
is 'Data final da validade, calculada quando a revisão é enviada.';


alter table public.revisoes_proposta
drop constraint if exists revisoes_validade_dias_check;

alter table public.revisoes_proposta
add constraint revisoes_validade_dias_check
check (
  validade_dias is null
  or validade_dias in (0, 3, 5, 7)
);


-- =========================================================
-- ## 2. CONVERTER VALIDADES ANTIGAS
-- =========================================================

update public.revisoes_proposta
set validade_dias =
  case

    when upper(trim(coalesce(validade, '')))
      in ('HOJE', '0 DIA', '0 DIAS')
    then 0

    when upper(trim(coalesce(validade, '')))
      in ('3 DIA', '3 DIAS')
    then 3

    when upper(trim(coalesce(validade, '')))
      in ('5 DIA', '5 DIAS')
    then 5

    when upper(trim(coalesce(validade, '')))
      in ('7 DIA', '7 DIAS')
    then 7

    else validade_dias

  end
where validade_dias is null;


-- =========================================================
-- ## 3. CALCULAR VALIDADE DE REVISÕES ANTIGAS ENVIADAS
-- =========================================================

update public.revisoes_proposta
set validade_ate =
  (
    enviado_em
      at time zone 'America/Sao_Paulo'
  )::date
  + validade_dias

where status = 'enviada'
  and enviado_em is not null
  and validade_dias in (0, 3, 5, 7)
  and validade_ate is null;


-- =========================================================
-- ## 4. NORMALIZAR VALIDADE
-- =========================================================

create or replace function
public.normalizar_validade_revisao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_validade text;
begin

  v_validade :=
    upper(
      trim(
        coalesce(
          new.validade,
          ''
        )
      )
    );


  -- Compatibilidade com registros antigos.
  if v_validade = '' then
    v_validade := '7 DIAS';
  end if;


  case v_validade

    when 'HOJE' then
      new.validade := 'HOJE';
      new.validade_dias := 0;

    when '0 DIA' then
      new.validade := 'HOJE';
      new.validade_dias := 0;

    when '0 DIAS' then
      new.validade := 'HOJE';
      new.validade_dias := 0;

    when '3 DIA' then
      new.validade := '3 DIAS';
      new.validade_dias := 3;

    when '3 DIAS' then
      new.validade := '3 DIAS';
      new.validade_dias := 3;

    when '5 DIA' then
      new.validade := '5 DIAS';
      new.validade_dias := 5;

    when '5 DIAS' then
      new.validade := '5 DIAS';
      new.validade_dias := 5;

    when '7 DIA' then
      new.validade := '7 DIAS';
      new.validade_dias := 7;

    when '7 DIAS' then
      new.validade := '7 DIAS';
      new.validade_dias := 7;

    else
      raise exception
        'Validade inválida. Escolha HOJE, 3 DIAS, 5 DIAS ou 7 DIAS.';

  end case;


  -- Rascunho ainda não possui vencimento real.
  if new.status = 'rascunho' then
    new.validade_ate := null;
  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_normalizar_validade_revisao
on public.revisoes_proposta;


create trigger trg_normalizar_validade_revisao

before insert
or update of validade, validade_dias

on public.revisoes_proposta

for each row

execute function
  public.normalizar_validade_revisao();


-- =========================================================
-- ## 5. LIMITE R0 / R1 / R2
-- =========================================================
--
-- NOT VALID preserva eventual histórico antigo R3+,
-- mas impede novos registros acima de R2.
-- =========================================================

alter table public.revisoes_proposta
drop constraint if exists revisoes_numero_limite_check;


alter table public.revisoes_proposta
add constraint revisoes_numero_limite_check
check (
  numero_revisao between 0 and 2
)
not valid;


create or replace function
public.bloquear_limite_revisoes()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  if new.numero_revisao < 0
     or new.numero_revisao > 2 then

    raise exception
      'Limite de revisões atingido. A proposta permite somente R0, R1 e R2.';

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_bloquear_limite_revisoes
on public.revisoes_proposta;


create trigger trg_bloquear_limite_revisoes

before insert
or update of numero_revisao

on public.revisoes_proposta

for each row

execute function
  public.bloquear_limite_revisoes();


-- =========================================================
-- ## 6. ENVIAR REVISÃO + CALCULAR VENCIMENTO
-- =========================================================

create or replace function public.enviar_revisao(

  p_proposta_id uuid,
  p_revisao_id uuid

)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_user uuid := auth.uid();

  v_numero bigint;
  v_revisao_atual integer;

  v_numero_revisao integer;
  v_status text;
  v_enviado_em timestamptz;

  v_validade_dias smallint;
  v_validade_ate date;

  v_data_envio date :=
    (
      now()
      at time zone 'America/Sao_Paulo'
    )::date;

begin

  -- -------------------------------------------------------
  -- Autenticação
  -- -------------------------------------------------------

  if v_user is null then
    raise exception
      'Usuário não autenticado.';
  end if;


  if not public.usuario_ativo() then
    raise exception
      'Usuário inativo.';
  end if;


  if not public.pode_acessar_proposta(
    p_proposta_id
  ) then

    raise exception
      'Sem permissão para acessar esta proposta.';

  end if;


  -- -------------------------------------------------------
  -- Proposta
  -- -------------------------------------------------------

  select
    numero,
    revisao_atual

  into
    v_numero,
    v_revisao_atual

  from public.propostas

  where id =
    p_proposta_id;


  if not found then
    raise exception
      'Proposta não encontrada.';
  end if;


  -- -------------------------------------------------------
  -- Revisão
  -- -------------------------------------------------------

  select
    numero_revisao,
    status,
    enviado_em,
    validade_dias

  into
    v_numero_revisao,
    v_status,
    v_enviado_em,
    v_validade_dias

  from public.revisoes_proposta

  where id =
    p_revisao_id

    and proposta_id =
      p_proposta_id

  for update;


  if not found then
    raise exception
      'Revisão não encontrada para esta proposta.';
  end if;


  if v_numero_revisao <>
     v_revisao_atual then

    raise exception
      'Somente a revisão atual da proposta pode ser enviada.';

  end if;


  if v_status <> 'rascunho' then

    raise exception
      'A revisão atual não está em rascunho.';

  end if;


  if v_validade_dias is null
     or v_validade_dias not in (
       0,
       3,
       5,
       7
     ) then

    raise exception
      'Selecione uma validade válida: HOJE, 3 DIAS, 5 DIAS ou 7 DIAS.';

  end if;


  -- -------------------------------------------------------
  -- Calcular vencimento
  -- -------------------------------------------------------

  v_validade_ate :=
    v_data_envio
    +
    v_validade_dias;


  -- -------------------------------------------------------
  -- Enviar
  -- -------------------------------------------------------

  update public.revisoes_proposta

  set
    status =
      'enviada',

    validade_ate =
      v_validade_ate

  where id =
    p_revisao_id

    and proposta_id =
      p_proposta_id

  returning
    status,
    enviado_em,
    validade_ate

  into
    v_status,
    v_enviado_em,
    v_validade_ate;


  -- -------------------------------------------------------
  -- Retorno
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
      v_status,

    'enviado_em',
      v_enviado_em,

    'validade_dias',
      v_validade_dias,

    'validade_ate',
      v_validade_ate

  );

end;
$$;


revoke all
on function public.enviar_revisao(
  uuid,
  uuid
)
from public;


grant execute
on function public.enviar_revisao(
  uuid,
  uuid
)
to authenticated;


-- =========================================================
-- ## 7. ÍNDICE PARA CONSULTA DE VENCIDAS
-- =========================================================

create index if not exists
  idx_revisoes_validade_ate_enviada

on public.revisoes_proposta(
  validade_ate
)

where status = 'enviada'
  and validade_ate is not null;


-- =========================================================
-- ## 8. FINALIZAR
-- =========================================================

commit;


-- =========================================================
-- ## 9. VERIFICAÇÕES
-- =========================================================


-- Validades existentes.
select
  validade,
  validade_dias,
  status,
  count(*) as quantidade

from public.revisoes_proposta

group by
  validade,
  validade_dias,
  status

order by
  status,
  validade_dias nulls last;


-- Verificar se existe histórico antigo acima de R2.
select
  proposta_id,
  numero_revisao,
  status,
  created_at

from public.revisoes_proposta

where numero_revisao > 2

order by
  proposta_id,
  numero_revisao;


-- Revisões enviadas que não puderam receber validade.
select
  id,
  proposta_id,
  numero_revisao,
  validade,
  validade_dias,
  enviado_em,
  validade_ate

from public.revisoes_proposta

where status = 'enviada'
  and validade_ate is null

order by
  enviado_em desc nulls last;