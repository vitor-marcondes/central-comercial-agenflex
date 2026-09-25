-- CENTRAL AGENFLEX — 023: integridade independente da rota de gravação.
-- Aplicação futura integral após 022, por owner, em manutenção. NÃO reaplicar
-- 020/021 por cima: essas versões não conhecem todos estes triggers/ACLs.
--
-- Auditoria local antes da edição (001–022 + js/services):
-- propostas INSERT: criar_proposta_r0 (020, DEFINER), RLS propostas_insert.
-- propostas UPDATE: status 004/005, salvar/criar revisão 019/022, sync 013,
--   transferência 020. INVOKER depende dos grants de tabela existentes.
-- revisoes INSERT: criação R0 e criar_nova_revisao, mais RLS revisoes_insert.
-- revisoes UPDATE: salvar_rascunho e enviar_revisao (021), mais RLS.
-- revisoes DELETE: policy permite ao operador; nenhum uso no frontend/RPCs.
-- itens INSERT/UPDATE/DELETE: policies do 002 + salvar_rascunho (substituição),
--   criação/cópia de revisões. Trigger 001 não serializava itens versus envio.
-- Nenhum INSERT/UPDATE/DELETE direto encontrado nos services JS atuais.
-- Não revogar grants de tabela nem criar flag de sessão para contornar regras.
begin;
set local lock_timeout = '5s';
lock table public.propostas, public.revisoes_proposta, public.itens_revisao
  in access exclusive mode;

do $preflight_023$
declare v_erros text;
begin
  if to_regprocedure('public.congelar_resultado_comercial()') is null
     or to_regprocedure('public.normalizar_validade_revisao()') is null then
    raise exception '023: aplicar e conferir 021 e 022 primeiro.';
  end if;
  -- Validar antes de adicionar constraints, sem corrigir qualquer item legado.
  select string_agg(id::text, ', ' order by id) into v_erros
  from public.itens_revisao
  where quantidade < 0 or valor_unitario < 0 or ipi_percentual < 0
    or desconto_percentual < 0 or desconto_percentual > 100
    or quantidade::text in ('NaN', 'Infinity', '-Infinity')
    or valor_unitario::text in ('NaN', 'Infinity', '-Infinity')
    or ipi_percentual::text in ('NaN', 'Infinity', '-Infinity');
  if v_erros is not null then
    raise exception '023: itens legados incompatíveis [%]. Nenhuma correção automática.', v_erros;
  end if;
end;
$preflight_023$;

-- Zero continua permitido. Desconto 0..100 do 019 permanece intacto.
alter table public.itens_revisao
  add constraint itens_quantidade_023_check check (quantidade >= 0
    and quantidade::text not in ('NaN', 'Infinity', '-Infinity')),
  add constraint itens_valor_unitario_023_check check (valor_unitario >= 0
    and valor_unitario::text not in ('NaN', 'Infinity', '-Infinity')),
  add constraint itens_ipi_percentual_023_check check (ipi_percentual >= 0
    and ipi_percentual::text not in ('NaN', 'Infinity', '-Infinity'));

create or replace function public.proteger_integridade_proposta()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_max integer;
begin
  if tg_op = 'INSERT' then
    if new.status_comercial is distinct from 'proposta' or new.revisao_atual <> 0 then
      raise exception 'Nova proposta deve começar no status proposta e revisão R0.';
    end if;
    if auth.uid() is not null and new.criado_por is distinct from auth.uid() then
      raise exception 'Autoria da proposta deve corresponder ao usuário autenticado.';
    end if;
    new.status_atualizado_em := null;
    new.status_atualizado_por := null;
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'Identidade da proposta não pode ser alterada.';
  end if;
  if new.revisao_atual is distinct from old.revisao_atual then
    select max(numero_revisao) into v_max from public.revisoes_proposta where proposta_id = old.id;
    if new.revisao_atual is distinct from v_max or new.revisao_atual < old.revisao_atual then
      raise exception 'Revisão atual deve corresponder à última revisão persistida, sem retroceder.';
    end if;
  end if;
  if new.status_comercial is distinct from old.status_comercial then
    if auth.uid() is null or not public.pode_acessar_proposta(old.id) then
      raise exception 'Alteração de status exige operador autenticado e autorizado.';
    end if;
    new.status_atualizado_em := now();
    new.status_atualizado_por := auth.uid();
  else
    -- RPC 004 historicamente reescrevia a data mesmo sem transição.
    -- Normalizar mantém compatibilidade; o retorno da RPC abaixo usa os campos reais.
    new.status_atualizado_em := old.status_atualizado_em;
    new.status_atualizado_por := old.status_atualizado_por;
  end if;
  return new;
end;
$$;
-- Ordenação alfabética: auditoria antes de congelar_resultado_comercial.
create trigger trg_00_integridade_proposta
before insert or update on public.propostas
for each row execute function public.proteger_integridade_proposta();

create or replace function public.proteger_integridade_revisao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_proposta public.propostas%rowtype;
  v_max integer;
  v_count bigint;
  v_anterior_status text;
begin
  -- Sem fluxo V1 de exclusão/reuso de números. Nenhuma RPC atual exclui revisão.
  -- Impede também cascatas de exclusão da proposta que apagariam o histórico.
  if tg_op = 'DELETE' then
    raise exception 'Revisões não podem ser excluídas pela operação comercial da V1.';
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.proposta_id is distinct from old.proposta_id
       or new.numero_revisao is distinct from old.numero_revisao
       or new.criado_por is distinct from old.criado_por then
      raise exception 'Identidade, número e autoria da revisão são imutáveis.';
    end if;
    if old.status = 'enviada' then
      raise exception 'Revisão enviada é imutável.';
    end if;
  end if;
  select * into v_proposta from public.propostas where id = new.proposta_id for update;
  if not found then raise exception 'Proposta da revisão não encontrada.'; end if;
  if v_proposta.status_comercial = 'concluido' then
    raise exception 'Venda concluída não permite criar ou alterar revisões.';
  end if;
  if auth.uid() is not null and not public.pode_acessar_proposta(new.proposta_id) then
    raise exception 'Sem permissão para operar a revisão.';
  end if;
  if tg_op = 'INSERT' then
    if new.status is distinct from 'rascunho' then
      raise exception 'Nova revisão deve começar como rascunho.';
    end if;
    if new.numero_revisao is null or new.numero_revisao not between 0 and 2 then
      raise exception 'São permitidas somente R0, R1 e R2; histórico acima de R2 não é alterado.';
    end if;
    if auth.uid() is not null and new.criado_por is distinct from auth.uid() then
      raise exception 'Autoria da nova revisão deve corresponder ao usuário autenticado.';
    end if;
    select max(numero_revisao), count(*) into v_max, v_count
      from public.revisoes_proposta where proposta_id = new.proposta_id;
    if v_count = 0 then
      if new.numero_revisao <> 0 or v_proposta.revisao_atual <> 0 then
        raise exception 'A primeira revisão deve ser R0.';
      end if;
    else
      if v_proposta.revisao_atual is distinct from v_max
         or new.numero_revisao <> v_max + 1 or v_count <> v_max + 1 then
        raise exception 'Sequência de revisões inconsistente; não é permitido pular ou reutilizar números.';
      end if;
      select status into v_anterior_status from public.revisoes_proposta
        where proposta_id = new.proposta_id and numero_revisao = v_max;
      if v_anterior_status is distinct from 'enviada' then
        raise exception 'Envie a revisão atual antes de criar a próxima.';
      end if;
    end if;
    new.enviado_em := null;
  elsif new.status = 'enviada' then
    if new.numero_revisao is distinct from v_proposta.revisao_atual
       or exists (select 1 from public.revisoes_proposta
         where proposta_id = new.proposta_id and numero_revisao > new.numero_revisao) then
      raise exception 'Somente a revisão atual pode ser enviada.';
    end if;
    -- NÃO recalcular datas aqui: trg_normalizar_validade_revisao (021), que
    -- dispara depois, atribui now(), dias e vencimento em America/Sao_Paulo.
  else
    new.enviado_em := null;
  end if;
  return new;
end;
$$;
-- 00 (022) bloqueia conclusão; 01 verifica fluxo; aplicar_time (018) preserva
-- Time; bloquear_limite (021) limita; normalizar (021) calcula; proteger (001)
-- mantém imutabilidade; sync (013) continua AFTER INSERT, sem duplicação.
create trigger trg_01_integridade_revisao
before insert or update or delete on public.revisoes_proposta
for each row execute function public.proteger_integridade_revisao();

-- Proteção extra contra corrida: a leitura simples do trigger de itens do 001
-- não basta quando um envio ocorre simultaneamente. Bloquear pai -> revisão,
-- como enviar_revisao (021) e criar_nova_revisao (022), antes de gravar itens.
create or replace function public.serializar_itens_revisao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_proposta_id uuid;
  v_status text;
  v_status_proposta text;
begin
  if tg_op = 'UPDATE' and (new.revisao_id is distinct from old.revisao_id
      or new.id is distinct from old.id) then
    raise exception 'Item não pode mudar de identidade ou de revisão.';
  end if;
  if tg_op = 'DELETE' then v_id := old.revisao_id; else v_id := new.revisao_id; end if;
  select proposta_id into v_proposta_id from public.revisoes_proposta where id = v_id;
  if not found then raise exception 'Revisão do item não encontrada.'; end if;
  select status_comercial into v_status_proposta from public.propostas
    where id = v_proposta_id for update;
  if not found or v_status_proposta = 'concluido' then
    raise exception 'Proposta inexistente ou concluída: itens não podem ser alterados.';
  end if;
  select status into v_status from public.revisoes_proposta where id = v_id for update;
  if not found or v_status is distinct from 'rascunho' then
    raise exception 'Somente itens de revisão em rascunho podem ser alterados.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger trg_00_serializar_itens_revisao
before insert or update or delete on public.itens_revisao
for each row execute function public.serializar_itens_revisao();

-- RPC 004: mesma assinatura/INVOKER, retornando também o autor REAL persistido.
-- RPC 005 já retorna status_atualizado_por do RETURNING; nenhuma substituição.

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
  v_status_atualizado_por uuid;
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
  if v_status not in (
    'proposta',
    'andamento',
    'concluido',
    'nao_conquistado'
  ) then
    raise exception
      'Status comercial inválido.';
  end if;
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
    status_atualizado_em,
    status_atualizado_por
  into
    v_numero,
    v_status_atualizado_em,
    v_status_atualizado_por;
  if not found then
    raise exception
      'Proposta não encontrada.';
  end if;
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
    v_status_atualizado_por
  );
end;
$$;

revoke execute on function public.atualizar_status_comercial(uuid, text, text, text) from PUBLIC, anon;
grant execute on function public.atualizar_status_comercial(uuid, text, text, text) to authenticated, service_role;
revoke execute on function public.proteger_integridade_proposta() from PUBLIC, anon, authenticated;
grant execute on function public.proteger_integridade_proposta() to service_role;
revoke execute on function public.proteger_integridade_revisao() from PUBLIC, anon, authenticated;
grant execute on function public.proteger_integridade_revisao() to service_role;
revoke execute on function public.serializar_itens_revisao() from PUBLIC, anon, authenticated;
grant execute on function public.serializar_itens_revisao() to service_role;

do $acl_023$
declare v_funcao text;
begin
  foreach v_funcao in array array[
    'public.proteger_integridade_proposta()',
    'public.proteger_integridade_revisao()',
    'public.serializar_itens_revisao()'
  ] loop
    if has_function_privilege('anon', v_funcao, 'EXECUTE')
       or has_function_privilege('authenticated', v_funcao, 'EXECUTE') then
      raise exception '023: EXECUTE interno herdado em %. Auditar grants.', v_funcao;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.atualizar_status_comercial(uuid,text,text,text)', 'EXECUTE') then
    raise exception '023: anon ainda pode chamar atualizar_status_comercial.';
  end if;
end;
$acl_023$;
commit;
