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

-- Aplicar após 020, em uma sessão administrativa e janela de manutenção.
-- Todo o arquivo até COMMIT é uma única transação: não executar trechos.
begin;
set local lock_timeout = '5s';

-- Impede gravações concorrentes e mantém estáveis as conferências do backfill.
-- Nenhuma dessas tabelas é apagada; somente revisoes recebe dois campos derivados.
lock table public.propostas, public.revisoes_proposta, public.itens_revisao
in access exclusive mode;

-- Falhar antes de suspender proteções se a ordem 019 -> 020 não foi respeitada.
do $ordem_021$
begin
  if to_regprocedure('public.usuario_operacao_comercial()') is null
     or to_regprocedure('public.usuario_visao_global()') is null then
    raise exception '021: aplicar e conferir 020 antes desta migration.';
  end if;
end;
$ordem_021$;


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
-- ## 2. AUDITORIA DOS TRIGGERS E BACKFILL TRANSACIONAL
-- =========================================================
-- BEFORE UPDATE conhecidos em revisoes_proposta (001, 011, 016/018):
-- trg_proteger_revisao_enviada -> bloquearia as 13 enviadas: suspender.
-- trg_aplicar_time_equipe_revisao -> pode atribuir/validar Time: suspender.
-- trg_revisoes_updated_at -> mudaria updated_at: suspender, se existir.
-- trg_proteger_autoria_revisao -> só confere autoria: manter ativo.
-- Em reaplicação, suspender também nosso normalizador durante o backfill.
-- trg_sync_revisao_atual é AFTER INSERT: não dispara neste UPDATE.
-- trg_proteger_itens_enviados pertence a itens_revisao: não é suspenso.
-- Qualquer trigger UPDATE não inventariado faz a migration ABORTAR.
-- Não há DISABLE TRIGGER ALL/USER nem alteração de session_replication_role.

-- Remover eventual teto da versão antiga ANTES de tocar na R3 histórica.
-- A regra nova será um trigger para INSERT/identidade, nunca CHECK <= 2.
alter table public.revisoes_proposta
drop constraint if exists revisoes_numero_limite_check;

do $backfill_021$
declare
  v_trigger record;
  v_suspensos jsonb;
  v_revisoes_antes jsonb;
  v_propostas_antes jsonb;
  v_itens_antes jsonb;
  v_revisoes_depois jsonb;
  v_propostas_depois jsonb;
  v_itens_depois jsonb;
begin
  -- Conferir TODOS os triggers de UPDATE, inclusive AFTER/statement inesperados.
  for v_trigger in
    select t.*, n.nspname as esquema_funcao, p.proname as funcao
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'public.revisoes_proposta'::regclass
      and not t.tgisinternal
      and (t.tgtype::integer & 16) <> 0
  loop
    if not exists (
      select 1
      from (values
        ('trg_proteger_revisao_enviada', 'proteger_revisao_enviada'),
        ('trg_aplicar_time_equipe_revisao', 'aplicar_time_equipe_revisao'),
        ('trg_revisoes_updated_at', 'set_updated_at'),
        ('trg_proteger_autoria_revisao', 'proteger_autoria_revisao'),
        ('trg_normalizar_validade_revisao', 'normalizar_validade_revisao'),
        ('trg_bloquear_limite_revisoes', 'bloquear_limite_revisoes')
      ) as esperado(nome, funcao)
      where esperado.nome = v_trigger.tgname
        and esperado.funcao = v_trigger.funcao
        and v_trigger.esquema_funcao = 'public'
    ) or (v_trigger.tgtype::integer & 3) <> 3
      or v_trigger.tgenabled not in ('O', 'A')
      or v_trigger.tgqual is not null
      or v_trigger.tgnargs <> 0 then
      raise exception '021: trigger UPDATE não compatível: %. Audite sua definição antes de aplicar.',
        v_trigger.tgname;
    end if;
  end loop;

  -- Proteções fundamentais precisam existir, ativas e para todos os UPDATEs.
  if exists (
    select 1
    from (values
      ('trg_proteger_revisao_enviada', 31),
      ('trg_aplicar_time_equipe_revisao', 23),
      ('trg_proteger_autoria_revisao', 19)
    ) as esperado(nome, tipo)
    where not exists (
      select 1 from pg_trigger t
      where t.tgrelid = 'public.revisoes_proposta'::regclass
        and t.tgname = esperado.nome
        and not t.tgisinternal
        and t.tgtype::integer = esperado.tipo
        and t.tgattr = ''::int2vector
        and t.tgenabled in ('O', 'A')
    )
  ) then
    raise exception '021: gatilhos de proteção/autoria/Time ausentes ou incompatíveis. Conferir 001, 011 e 016/018.';
  end if;

  -- Não inventar datas de envio nem interpretar validades desconhecidas.
  if exists (
    select 1 from public.revisoes_proposta
    where upper(trim(coalesce(validade, ''))) not in
      ('', 'HOJE', '0 DIA', '0 DIAS', '3 DIA', '3 DIAS', '5 DIA', '5 DIAS', '7 DIA', '7 DIAS')
       or (status = 'enviada' and enviado_em is null)
  ) then
    raise exception '021: validade legada desconhecida ou revisão enviada sem enviado_em. Revisar sem alterar histórico.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'validade_dias' - 'validade_ate' order by r.id), '[]'::jsonb)
  into v_revisoes_antes from public.revisoes_proposta r;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
  into v_propostas_antes from public.propostas p;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb)
  into v_itens_antes from public.itens_revisao i;

  select coalesce(jsonb_agg(jsonb_build_object('nome', tgname, 'habilitado', tgenabled)), '[]'::jsonb)
  into v_suspensos
  from pg_trigger
  where tgrelid = 'public.revisoes_proposta'::regclass
    and not tgisinternal
    and tgname in (
      'trg_proteger_revisao_enviada',
      'trg_aplicar_time_equipe_revisao',
      'trg_revisoes_updated_at',
      'trg_normalizar_validade_revisao'
    );

  for v_trigger in
    select * from jsonb_to_recordset(v_suspensos) as t(nome text, habilitado text)
  loop
    execute format('alter table public.revisoes_proposta disable trigger %I', v_trigger.nome);
  end loop;

  -- ÚNICO UPDATE de backfill: só as duas colunas novas, incluindo a R3 legada.
  -- Preserva validade textual, enviado_em, updated_at, Time, autoria, status,
  -- número, vínculo com proposta e todos os itens. Reaplicação não duplica nada.
  with normalizada as (
    select id,
      case upper(trim(coalesce(validade, '')))
        when 'HOJE' then 0 when '0 DIA' then 0 when '0 DIAS' then 0
        when '3 DIA' then 3 when '3 DIAS' then 3
        when '5 DIA' then 5 when '5 DIAS' then 5
        else 7
      end::smallint as dias
    from public.revisoes_proposta
  )
  update public.revisoes_proposta r
  set validade_dias = n.dias,
      validade_ate = case when r.status = 'enviada'
        then (r.enviado_em at time zone 'America/Sao_Paulo')::date + n.dias
        else null end
  from normalizada n
  where r.id = n.id
    and (r.validade_dias is distinct from n.dias
      or r.validade_ate is distinct from
        case when r.status = 'enviada'
          then (r.enviado_em at time zone 'America/Sao_Paulo')::date + n.dias
          else null end);

  -- Restaurar exatamente O (normal) ou A (ALWAYS) antes de qualquer COMMIT.
  for v_trigger in
    select * from jsonb_to_recordset(v_suspensos) as t(nome text, habilitado text)
  loop
    if v_trigger.habilitado = 'A' then
      execute format('alter table public.revisoes_proposta enable always trigger %I', v_trigger.nome);
    else
      execute format('alter table public.revisoes_proposta enable trigger %I', v_trigger.nome);
    end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(r) - 'validade_dias' - 'validade_ate' order by r.id), '[]'::jsonb)
  into v_revisoes_depois from public.revisoes_proposta r;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
  into v_propostas_depois from public.propostas p;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb)
  into v_itens_depois from public.itens_revisao i;

  if v_revisoes_antes is distinct from v_revisoes_depois
     or v_propostas_antes is distinct from v_propostas_depois
     or v_itens_antes is distinct from v_itens_depois then
    raise exception '021: backfill alterou dados além da validade estruturada. Toda a transação será revertida.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(v_suspensos) as e(nome text, habilitado text)
    left join pg_trigger t on t.tgrelid = 'public.revisoes_proposta'::regclass
      and t.tgname = e.nome
    where t.tgenabled::text is distinct from e.habilitado
  ) then
    raise exception '021: estado original dos triggers não foi restaurado.';
  end if;
  -- Sem EXCEPTION WHEN OTHERS: qualquer erro aborta a transação, inclusive
  -- os DISABLEs. O bloqueio impede outras sessões de verem proteção suspensa.
end;
$backfill_021$;


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


  -- Dados novos usam uma única base para enviado_em e validade_ate.
  -- Revisão já enviada continua bloqueada pelo trigger de proteção original.
  if new.status = 'rascunho' then
    new.validade_ate := null;
  elsif new.status = 'enviada' then
    if tg_op = 'INSERT' then
      new.enviado_em := now();
    elsif old.status = 'rascunho' then
      new.enviado_em := now();
    end if;
    new.validade_ate :=
      (new.enviado_em at time zone 'America/Sao_Paulo')::date + new.validade_dias;
  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_normalizar_validade_revisao
on public.revisoes_proposta;


create trigger trg_normalizar_validade_revisao

before insert
or update

on public.revisoes_proposta

for each row

execute function
  public.normalizar_validade_revisao();


-- =========================================================
-- ## 5. LIMITE R0 / R1 / R2
-- =========================================================
--
-- Sem CHECK <= 2, inclusive NOT VALID: ele rejeitaria UPDATE da R3 legada.
-- O CHECK >= 0 e UNIQUE(proposta_id, numero_revisao) do 001 permanecem.
-- INSERT aceita só R0/R1/R2; UPDATE não pode renumerar/mover uma revisão.
-- A R3 existente continua consultável e protegida contra UPDATE/DELETE
-- pelo trg_proteger_revisao_enviada, sem apagar ou renumerar histórico.
-- =========================================================

create or replace function
public.bloquear_limite_revisoes()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  if tg_op = 'INSERT' then
    if new.numero_revisao is null
       or new.numero_revisao < 0
       or new.numero_revisao > 2 then
      raise exception
        'Limite de revisões atingido. A proposta permite somente R0, R1 e R2.';
    end if;
  elsif new.id is distinct from old.id
     or new.proposta_id is distinct from old.proposta_id
     or new.numero_revisao is distinct from old.numero_revisao then
    raise exception 'A identidade e o número de uma revisão não podem ser alterados.';
  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_bloquear_limite_revisoes
on public.revisoes_proposta;


create trigger trg_bloquear_limite_revisoes

before insert
or update

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
    p_proposta_id
  for update;


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

    enviado_em = now(),

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
from PUBLIC, anon;


grant execute
on function public.enviar_revisao(
  uuid,
  uuid
)
to authenticated, service_role;


-- Funções de trigger novas: não são RPCs de cliente. Preservar a política
-- de grants do 020 também quando CREATE FUNCTION usar defaults permissivos.
revoke execute on function public.normalizar_validade_revisao()
from PUBLIC, anon, authenticated;
revoke execute on function public.bloquear_limite_revisoes()
from PUBLIC, anon, authenticated;
grant execute on function public.normalizar_validade_revisao()
to service_role;
grant execute on function public.bloquear_limite_revisoes()
to service_role;

do $acl_021$
begin
  if has_function_privilege('anon', 'public.enviar_revisao(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.normalizar_validade_revisao()', 'EXECUTE')
     or has_function_privilege('anon', 'public.bloquear_limite_revisoes()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.normalizar_validade_revisao()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.bloquear_limite_revisoes()', 'EXECUTE') then
    raise exception '021: privilégios herdados inesperados. Auditar sem ampliar grants.';
  end if;
end;
$acl_021$;


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