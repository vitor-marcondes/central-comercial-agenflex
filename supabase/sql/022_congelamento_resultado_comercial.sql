-- CENTRAL AGENFLEX — 022: crédito histórico da venda, separado da carteira.
-- Preparação local. Aplicação futura: 019 -> 020 -> 021 -> 022 -> 023.
-- Executar o arquivo inteiro por owner administrativo, em manutenção.
-- ATENÇÃO: o inventário informa concluídas sem responsável. Neste estado
-- o preflight ABORTARÁ; resolver a evidência histórica fora desta migration.
-- Não reaplicar 021 depois desta etapa (seu inventário de triggers é fechado).
begin;
set local lock_timeout = '5s';
lock table public.propostas, public.revisoes_proposta, public.itens_revisao,
  public.perfis, public.transferencias_proposta in access exclusive mode;

do $preflight_022$
declare
  v_erros text;
begin
  if to_regprocedure('public.normalizar_validade_revisao()') is null
     or to_regprocedure('public.usuario_operacao_comercial()') is null then
    raise exception '022: conferir a aplicação de 020 e 021 antes de continuar.';
  end if;
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.itens_revisao'::regclass
      and attname = 'valor_total' and attgenerated = 's' and not attisdropped
      and format_type(atttypid, atttypmod) = 'numeric(18,6)'
  ) then
    raise exception '022: valor_total deve ser o numeric(18,6) gerado do 019. Auditar schema.';
  end if;
  -- Conferir TODAS antes de qualquer UPDATE. Não presumir que ainda são quatro.
  -- Qualquer transferência exige conferência humana: a RPC 004 podia renovar
  -- status_atualizado_em sem transição, impedindo ordenar conclusão/transferência
  -- com segurança. Também não aceitar revisão posterior à apontada como atual.
  select string_agg(p.id::text, ', ' order by p.id) into v_erros
  from public.propostas p
  left join public.perfis u on u.user_id = p.vendedor_responsavel_id
  left join public.revisoes_proposta r
    on r.proposta_id = p.id and r.numero_revisao = p.revisao_atual
  left join lateral (
    select count(*) as quantidade, sum(i.valor_total) as total,
      bool_or(i.valor_total is null or i.valor_total < 0
        or i.valor_total::text in ('NaN', 'Infinity', '-Infinity')) as invalido
    from public.itens_revisao i where i.revisao_id = r.id
  ) itens on true
  where p.status_comercial = 'concluido' and (
    u.user_id is null or p.status_atualizado_em is null
    or r.id is null or r.status <> 'enviada' or r.enviado_em is null
    or r.enviado_em > p.status_atualizado_em
    or r.time_equipe is null or r.time_equipe not in ('pharma', 'food', 'revenda')
    or itens.quantidade = 0 or itens.invalido or itens.total is null
    or itens.total < 0 or itens.total >= 1000000000000
    or exists (select 1 from public.revisoes_proposta posterior
      where posterior.proposta_id = p.id and posterior.numero_revisao > p.revisao_atual)
    or exists (select 1 from public.transferencias_proposta t
      where t.proposta_id = p.id)
  );
  if v_erros is not null then
    raise exception '022: conclusão legada não reconstruível nas propostas [%]. Conferir responsável, data, revisão enviada, itens e transferências; nenhum dado será inventado.', v_erros;
  end if;
end;
$preflight_022$;

-- Sem IF NOT EXISTS: aplicação duplicada deve falhar, nunca refazer o crédito
-- usando o responsável de uma carteira já transferida.
alter table public.propostas
  add column concluido_em timestamptz,
  add column responsavel_conclusao_id uuid,
  add column time_conclusao text,
  add column revisao_conclusao_id uuid,
  add column valor_conclusao numeric(18,6);

-- FK composta assegura também que a revisão pertence à própria proposta.
-- O frontend deverá explicitar o relacionamento de revisões no PostgREST,
-- pois passa a existir uma segunda relação entre propostas e revisões.
alter table public.revisoes_proposta
  add constraint revisoes_proposta_id_proposta_022_key unique (id, proposta_id);
alter table public.propostas
  add constraint propostas_responsavel_conclusao_022_fk
    foreign key (responsavel_conclusao_id) references public.perfis(user_id) on delete restrict,
  add constraint propostas_revisao_conclusao_022_fk
    foreign key (revisao_conclusao_id, id)
    references public.revisoes_proposta(id, proposta_id) on delete restrict,
  add constraint propostas_time_conclusao_022_check
    check (time_conclusao is null or time_conclusao in ('pharma', 'food', 'revenda')),
  add constraint propostas_valor_conclusao_022_check
    check (valor_conclusao is null or (valor_conclusao >= 0
      and valor_conclusao::text not in ('NaN', 'Infinity', '-Infinity')));

-- O backfill não muda responsável atual/status/data de status, nem toca em
-- revisões/itens. Suspender apenas o timestamp das propostas e restaurar seu
-- modo original. Qualquer erro reverte inclusive o DISABLE transacional.
do $backfill_022$
declare
  v_modo "char";
  v_antes jsonb;
  v_depois jsonb;
begin
  if exists (
    select 1 from pg_trigger t
    join pg_proc f on f.oid = t.tgfoid
    join pg_namespace n on n.oid = f.pronamespace
    where t.tgrelid = 'public.propostas'::regclass and not t.tgisinternal
      and (t.tgtype::integer & 16) <> 0 and (
        n.nspname <> 'public' or t.tgenabled not in ('O', 'A')
        or t.tgqual is not null or t.tgnargs <> 0
        or not ((t.tgname = 'trg_propostas_updated_at' and f.proname = 'set_updated_at' and t.tgtype = 19)
          or (t.tgname = 'trg_preparar_vendedor_responsavel' and f.proname = 'preparar_vendedor_responsavel' and t.tgtype = 23)
          or (t.tgname = 'trg_bloquear_transferencia_direta' and f.proname = 'bloquear_transferencia_direta' and t.tgtype = 19))
      )
  ) then
    raise exception '022: trigger UPDATE de propostas não inventariado. Auditar antes do backfill.';
  end if;
  select tgenabled into v_modo from pg_trigger
  where tgrelid = 'public.propostas'::regclass and tgname = 'trg_propostas_updated_at';
  select coalesce(jsonb_agg(to_jsonb(p) - array['concluido_em', 'responsavel_conclusao_id',
    'time_conclusao', 'revisao_conclusao_id', 'valor_conclusao'] order by id), '[]'::jsonb)
  into v_antes from public.propostas p;
  if v_modo is not null then
    alter table public.propostas disable trigger trg_propostas_updated_at;
  end if;
  update public.propostas p
  set concluido_em = p.status_atualizado_em,
      responsavel_conclusao_id = p.vendedor_responsavel_id,
      time_conclusao = r.time_equipe,
      revisao_conclusao_id = r.id,
      valor_conclusao = (select sum(i.valor_total) from public.itens_revisao i where i.revisao_id = r.id)
  from public.revisoes_proposta r
  where p.status_comercial = 'concluido'
    and r.proposta_id = p.id and r.numero_revisao = p.revisao_atual;
  if v_modo = 'A' then
    alter table public.propostas enable always trigger trg_propostas_updated_at;
  elsif v_modo is not null then
    alter table public.propostas enable trigger trg_propostas_updated_at;
  end if;
  select coalesce(jsonb_agg(to_jsonb(p) - array['concluido_em', 'responsavel_conclusao_id',
    'time_conclusao', 'revisao_conclusao_id', 'valor_conclusao'] order by id), '[]'::jsonb)
  into v_depois from public.propostas p;
  if v_antes is distinct from v_depois then
    raise exception '022: backfill alterou campos fora do resultado. Reverter toda a transação.';
  end if;
end;
$backfill_022$;

-- Todos os cinco campos são obrigatórios; Time vem da revisão, nunca do perfil.
alter table public.propostas add constraint propostas_resultado_022_check check (
  (status_comercial = 'concluido' and time_conclusao is not null and concluido_em is not null
    and responsavel_conclusao_id is not null and revisao_conclusao_id is not null
    and valor_conclusao is not null)
  or (status_comercial <> 'concluido' and concluido_em is null
    and responsavel_conclusao_id is null and time_conclusao is null
    and revisao_conclusao_id is null and valor_conclusao is null)
);

-- Autoridade final para atualizar_status_comercial(uuid,text,text,text),
-- atualizar_gestao_comercial(uuid,text,text,text,text) e UPDATE direto.
-- As duas RPCs continuam INVOKER e com as assinaturas/grants do 020.
create or replace function public.congelar_resultado_comercial()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_revisao public.revisoes_proposta%rowtype;
  v_valor numeric;
begin
  if tg_op = 'DELETE' then
    if old.status_comercial = 'concluido' then
      raise exception 'Venda concluída não pode ser excluída.';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.status_comercial = 'concluido' or new.concluido_em is not null
       or new.responsavel_conclusao_id is not null or new.time_conclusao is not null
       or new.revisao_conclusao_id is not null or new.valor_conclusao is not null then
      raise exception 'Crie e envie a revisão antes de concluir a proposta.';
    end if;
    return new;
  end if;
  if row(new.concluido_em, new.responsavel_conclusao_id, new.time_conclusao,
         new.revisao_conclusao_id, new.valor_conclusao)
     is distinct from row(old.concluido_em, old.responsavel_conclusao_id,
         old.time_conclusao, old.revisao_conclusao_id, old.valor_conclusao) then
    raise exception 'Campos de conclusão são calculados pelo banco e imutáveis.';
  end if;
  if old.status_comercial = 'concluido' then
    if new.status_comercial is distinct from old.status_comercial
       or new.revisao_atual is distinct from old.revisao_atual
       or new.id is distinct from old.id then
      raise exception 'Concluído é estado final na V1; não permite reabertura ou troca da revisão.';
    end if;
    -- Transferência altera somente a carteira, mesmo com perfil histórico inativo.
    return new;
  end if;
  if new.status_comercial = 'concluido' then
    if auth.uid() is null or not public.pode_acessar_proposta(old.id) then
      raise exception 'Usuário sem permissão para concluir esta proposta.';
    end if;
    if new.vendedor_responsavel_id is distinct from old.vendedor_responsavel_id
       or new.revisao_atual is distinct from old.revisao_atual then
      raise exception 'Transfira/defina a revisão em operação separada antes de concluir.';
    end if;
    perform 1 from public.perfis where user_id = new.vendedor_responsavel_id
      and ativo = true and tipo_acesso in ('vendedor', 'gestor') for share;
    if not found then
      raise exception 'Conclusão exige responsável comercial ativo, Vendedor ou Gestor.';
    end if;
    select * into v_revisao from public.revisoes_proposta
    where proposta_id = old.id and numero_revisao = old.revisao_atual for update;
    if not found or v_revisao.status <> 'enviada' then
      raise exception 'Conclusão exige que a revisão atual esteja enviada.';
    end if;
    if exists (select 1 from public.revisoes_proposta
      where proposta_id = old.id and numero_revisao > old.revisao_atual) then
      raise exception 'Revisão atual inconsistente; conferir histórico antes de concluir.';
    end if;
    if v_revisao.time_equipe is null or v_revisao.time_equipe not in ('pharma', 'food', 'revenda') then
      raise exception 'Conclusão exige Time oficial na revisão enviada.';
    end if;
    select sum(valor_total) into v_valor from public.itens_revisao where revisao_id = v_revisao.id;
    if v_valor is null or v_valor < 0 or v_valor >= 1000000000000
       or v_valor::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Conclusão exige itens com total oficial válido e não negativo.';
    end if;
    new.concluido_em := now();
    new.responsavel_conclusao_id := old.vendedor_responsavel_id;
    new.time_conclusao := v_revisao.time_equipe;
    new.revisao_conclusao_id := v_revisao.id;
    new.valor_conclusao := v_valor;
  end if;
  return new;
end;
$$;
create trigger trg_congelar_resultado_comercial
before insert or update or delete on public.propostas
for each row execute function public.congelar_resultado_comercial();

-- INSERT direto também não pode criar revisão após conclusão. O bloqueio do
-- pai serializa com conclusão e transferência; 023 acrescenta sequência/envio.
create or replace function public.bloquear_revisao_proposta_concluida()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  select status_comercial into v_status from public.propostas
    where id = new.proposta_id for update;
  if not found then raise exception 'Proposta da revisão não encontrada.'; end if;
  if v_status = 'concluido' then
    raise exception 'Venda concluída não permite nova revisão.';
  end if;
  return new;
end;
$$;
create trigger trg_00_bloquear_revisao_concluida
before insert on public.revisoes_proposta
for each row execute function public.bloquear_revisao_proposta_concluida();

-- A RPC revisada abaixo preserva a cópia de descontos do 019. O trigger do
-- 021 continua sendo a proteção final contra R3 futura; R3 legada não muda.

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

  -- O pai já está bloqueado FOR UPDATE pelo bloco anterior.
  if exists (select 1 from public.propostas
    where id = p_proposta_id and status_comercial = 'concluido') then
    raise exception 'Venda concluída não permite nova revisão.';
  end if;
  if v_revisao_atual >= 2 then
    raise exception 'Limite de revisões atingido: somente R0, R1 e R2.';
  end if;
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

  if v_status_anterior <>
    'enviada'
  then
    raise exception
      'A revisão atual precisa estar enviada antes de criar uma nova revisão.';
  end if;

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

  update public.propostas
  set revisao_atual =
    v_numero_nova_revisao
  where id =
    p_proposta_id;

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

revoke execute on function public.criar_nova_revisao(uuid) from PUBLIC, anon;
grant execute on function public.criar_nova_revisao(uuid) to authenticated, service_role;
revoke execute on function public.congelar_resultado_comercial() from PUBLIC, anon, authenticated;
revoke execute on function public.bloquear_revisao_proposta_concluida() from PUBLIC, anon, authenticated;
grant execute on function public.congelar_resultado_comercial() to service_role;
grant execute on function public.bloquear_revisao_proposta_concluida() to service_role;

do $acl_022$
begin
  if has_function_privilege('anon', 'public.criar_nova_revisao(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.congelar_resultado_comercial()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.congelar_resultado_comercial()', 'EXECUTE')
     or has_function_privilege('anon', 'public.bloquear_revisao_proposta_concluida()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.bloquear_revisao_proposta_concluida()', 'EXECUTE') then
    raise exception '022: privilégios EXECUTE herdados inesperados; auditar antes de aplicar.';
  end if;
end;
$acl_022$;

comment on column public.propostas.valor_conclusao is
  'Soma congelada dos valor_total gerados pelo 019, numeric(18,6); arredondamento monetário somente na apresentação.';
comment on column public.propostas.responsavel_conclusao_id is
  'Crédito histórico imutável, independente do vendedor_responsavel_id atual e do perfil futuro.';
commit;
