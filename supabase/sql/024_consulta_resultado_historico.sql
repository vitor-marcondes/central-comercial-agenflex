-- CENTRAL AGENFLEX — consultas V1. Aplicação futura após 020–023.
-- Não altera RLS operacional nem dados comerciais. Cada página retorna um
-- objeto JSON: o limite de linhas do PostgREST não trunca agregações/contagens.
-- Cursor exclusivo por UUID imutável + linha 201 para detectar continuação.
-- A versão do universo visível permite ao cliente reiniciar se houve mudança
-- entre páginas. Hash é detector de mudança, não token de autorização.
-- Custo: materialização/hash do universo a cada página; adequado à V1, medir
-- volume antes de evoluir. Nunca devolver snapshot parcial como total completo.
begin;
do $ordem_024$
begin
  if to_regprocedure('public.proteger_integridade_revisao()') is null
     or to_regprocedure('public.congelar_resultado_comercial()') is null then
    raise exception '024: aplicar e conferir 022 e 023 primeiro.';
  end if;
end;
$ordem_024$;

-- Única consulta DEFINER: projeção mínima, escopo explícito por auth.uid().
-- Antigo responsável recebe seu crédito, não o documento/carteira transferido.
create or replace function public.consultar_resultados_historicos(p_apos uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tipo text; v_resultado jsonb;
begin
  select tipo_acesso into v_tipo from public.perfis
    where user_id = auth.uid() and ativo = true;
  if v_tipo is null or v_tipo not in ('vendedor', 'gestor', 'diretor', 'adm') then
    raise exception 'Consulta exige usuário autenticado e ativo.';
  end if;
  with visiveis as materialized (
    select p.id as proposta_id, p.numero, p.concluido_em,
      p.responsavel_conclusao_id, p.time_conclusao,
      p.revisao_conclusao_id, p.valor_conclusao, u.nome as responsavel_nome
    from public.propostas p
    left join public.perfis u on u.user_id = p.responsavel_conclusao_id
    where p.status_comercial = 'concluido'
      and (v_tipo in ('gestor', 'diretor', 'adm') or p.responsavel_conclusao_id = auth.uid())
  ), candidatos as materialized (
    select * from visiveis where p_apos is null or proposta_id > p_apos
    order by proposta_id limit 201
  ), pagina as (
    select * from candidatos order by proposta_id limit 200
  )
  select jsonb_build_object(
    'versao', md5(coalesce((select jsonb_agg(to_jsonb(v) order by proposta_id)::text from visiveis v), '[]')),
    'registros', coalesce(jsonb_agg(to_jsonb(pagina) order by proposta_id), '[]'::jsonb),
    'proximo', case when (select count(*) from candidatos) > 200 then (array_agg(proposta_id order by proposta_id desc))[1] end
  ) into v_resultado from pagina;
  return v_resultado;
end;
$$;

-- Carteira: INVOKER preserva todas as policies do 020. Total de itens somado
-- no banco, sem truncamento de relacionamento aninhado nem fórmula duplicada.
create or replace function public.consultar_carteira_painel(p_apos uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.usuario_ativo() then
    raise exception 'Consulta exige usuário autenticado e ativo.';
  end if;
  with dados as materialized (
    select p.id, to_jsonb(p) || jsonb_build_object('revisoes_proposta',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'numero_revisao', r.numero_revisao,
        'nome_proposta', r.nome_proposta, 'cliente', r.cliente, 'cnpj', r.cnpj,
        'vendedor_nome', r.vendedor_nome, 'time_equipe', r.time_equipe,
        'data_proposta', r.data_proposta, 'validade', r.validade,
        'validade_dias', r.validade_dias, 'validade_ate', r.validade_ate,
        'status', r.status, 'enviado_em', r.enviado_em,
        'valor_total_revisao', (select coalesce(sum(i.valor_total), 0)
          from public.itens_revisao i where i.revisao_id = r.id)))
        from public.revisoes_proposta r
        where r.proposta_id = p.id and r.numero_revisao = p.revisao_atual), '[]'::jsonb)) as registro
    from public.propostas p
  ), candidatos as materialized (
    select * from dados where p_apos is null or id > p_apos order by id limit 201
  ), pagina as (
    select * from candidatos order by id limit 200
  )
  select jsonb_build_object(
    'versao', md5(coalesce((select jsonb_agg(registro order by id)::text from dados), '[]')),
    'registros', coalesce(jsonb_agg(registro order by id), '[]'::jsonb),
    'proximo', case when (select count(*) from candidatos) > 200 then (array_agg(id order by id desc))[1] end)
  into v_resultado from pagina;
  return v_resultado;
end;
$$;

-- Histórico operacional: filtros sobre a revisão ATUAL antes de COUNT/OFFSET.
-- Busca literal, sem SQL dinâmico; mesma remoção de acentos da interface.
create or replace function public.consultar_historico_propostas(
  p_pagina integer default 1, p_busca text default '', p_origem text default '',
  p_status text default '', p_status_revisao text default ''
)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_resultado jsonb; v_busca text;
begin
  if auth.uid() is null or not public.usuario_ativo() then
    raise exception 'Consulta exige usuário autenticado e ativo.';
  end if;
  if p_pagina is null or p_pagina < 1 then raise exception 'Página inválida.'; end if;
  v_busca := translate(lower(btrim(coalesce(p_busca, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  with filtradas as materialized (
    select p.*, r.id as atual_id
    from public.propostas p
    join public.revisoes_proposta r on r.proposta_id = p.id and r.numero_revisao = p.revisao_atual
    where (coalesce(p_origem, '') = '' or p.origem_comercial = p_origem)
      and (coalesce(p_status, '') = '' or p.status_comercial = p_status)
      and (coalesce(p_status_revisao, '') = '' or r.status = p_status_revisao)
      and (v_busca = '' or strpos(translate(lower(concat_ws(' ', p.numero::text,
        r.nome_proposta, r.cliente, r.cnpj, r.vendedor_nome)),
        'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), v_busca) > 0)
  ), pagina as (
    select * from filtradas order by updated_at desc, id
    offset ((p_pagina::bigint - 1) * 50) limit 50
  )
  select jsonb_build_object('total', (select count(*) from filtradas), 'pagina', p_pagina,
    'versao', md5(coalesce((select jsonb_agg(jsonb_build_array(id, updated_at, atual_id) order by updated_at desc, id)::text from filtradas), '[]')),
    'registros', coalesce((select jsonb_agg(
      (to_jsonb(p) - 'atual_id') || jsonb_build_object(
        'responsavel_nome', (select nome from public.perfis where user_id = p.vendedor_responsavel_id),
        'responsavel_conclusao_nome', (select nome from public.perfis where user_id = p.responsavel_conclusao_id),
        'quantidade_revisoes', (select count(*) from public.revisoes_proposta where proposta_id = p.id),
        'revisoes_proposta', (select jsonb_build_array(jsonb_build_object(
          'id', r.id, 'numero_revisao', r.numero_revisao, 'nome_proposta', r.nome_proposta,
          'cliente', r.cliente, 'cnpj', r.cnpj, 'vendedor_nome', r.vendedor_nome,
          'time_equipe', r.time_equipe, 'status', r.status, 'data_proposta', r.data_proposta,
          'enviado_em', r.enviado_em, 'validade_dias', r.validade_dias, 'validade_ate', r.validade_ate))
          from public.revisoes_proposta r where r.id = p.atual_id))
      order by p.updated_at desc, p.id) from pagina p), '[]'::jsonb)) into v_resultado;
  return v_resultado;
end;
$$;

revoke execute on function public.consultar_resultados_historicos(uuid) from PUBLIC, anon;
revoke execute on function public.consultar_carteira_painel(uuid) from PUBLIC, anon;
revoke execute on function public.consultar_historico_propostas(integer,text,text,text,text) from PUBLIC, anon;
grant execute on function public.consultar_resultados_historicos(uuid) to authenticated, service_role;
grant execute on function public.consultar_carteira_painel(uuid) to authenticated, service_role;
grant execute on function public.consultar_historico_propostas(integer,text,text,text,text) to authenticated, service_role;
do $acl_024$
begin
  if has_function_privilege('anon', 'public.consultar_resultados_historicos(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.consultar_carteira_painel(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.consultar_historico_propostas(integer,text,text,text,text)', 'EXECUTE') then
    raise exception '024: EXECUTE herdado inesperado para anon.';
  end if;
end;
$acl_024$;
commit;
