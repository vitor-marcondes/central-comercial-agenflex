-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 020_perfis_permissoes_comerciais.sql
--
-- Objetivo:
-- - Adicionar o perfil DIRETOR
-- - Separar visão global de gestão operacional
-- - Manter GESTOR/ADM como responsáveis pela gestão comercial
-- - Permitir que GESTOR crie/trabalhe propostas próprias
-- - Permitir responsável comercial VENDEDOR ou GESTOR
-- - Manter DIRETOR com visão global, sem operações gerenciais
-- - Preservar ADM com acesso administrativo total
-- - Restringir transferências de vendedor ao mesmo Time da proposta
--
-- Perfis finais:
-- - vendedor
-- - gestor
-- - diretor
-- - adm
--
-- IMPORTANTE:
-- - usuario_gestor_ou_adm() continua significando GESTÃO.
-- - usuario_visao_global() significa LEITURA GLOBAL.
-- - DIRETOR não entra em usuario_gestor_ou_adm().
-- =========================================================

begin;


-- =========================================================
-- ## 1. PERFIS VÁLIDOS
-- =========================================================

alter table public.perfis
drop constraint if exists perfis_tipo_acesso_check;


alter table public.perfis
add constraint perfis_tipo_acesso_check
check (
  tipo_acesso in (
    'vendedor',
    'gestor',
    'diretor',
    'adm'
  )
);


-- =========================================================
-- ## 2. FUNÇÕES AUXILIARES DE PERFIL
-- =========================================================

create or replace function public.usuario_diretor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.user_id = auth.uid()
      and p.ativo = true
      and p.tipo_acesso = 'diretor'
  );
$$;


-- Visão global:
-- Gestor  -> sim
-- Diretor -> sim
-- ADM     -> sim
-- Vendedor -> não
create or replace function public.usuario_visao_global()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.user_id = auth.uid()
      and p.ativo = true
      and p.tipo_acesso in (
        'gestor',
        'diretor',
        'adm'
      )
  );
$$;


-- Operação comercial:
-- Vendedor -> sim
-- Gestor   -> sim
-- ADM      -> sim
-- Diretor  -> não
create or replace function public.usuario_operacao_comercial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.user_id = auth.uid()
      and p.ativo = true
      and p.tipo_acesso in (
        'vendedor',
        'gestor',
        'adm'
      )
  );
$$;


revoke all
on function public.usuario_diretor()
from public;

revoke all
on function public.usuario_visao_global()
from public;

revoke all
on function public.usuario_operacao_comercial()
from public;


grant execute
on function public.usuario_diretor()
to authenticated;

grant execute
on function public.usuario_visao_global()
to authenticated;

grant execute
on function public.usuario_operacao_comercial()
to authenticated;


-- =========================================================
-- ## 3. ALTERAR TIPO DE ACESSO - SOMENTE ADM
-- =========================================================

create or replace function public.definir_tipo_acesso(
  p_user_id uuid,
  p_tipo_acesso text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare

  v_perfil public.perfis%rowtype;
  v_tipo text;

begin

  if auth.uid() is null then
    raise exception
      'Usuário não autenticado.';
  end if;


  if not public.usuario_adm() then
    raise exception
      'Apenas ADM pode alterar o tipo de acesso.';
  end if;


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


  update public.perfis
  set tipo_acesso = v_tipo
  where user_id = p_user_id
  returning *
  into v_perfil;


  if not found then
    raise exception
      'Usuário não encontrado.';
  end if;


  return jsonb_build_object(
    'user_id',
      v_perfil.user_id,
    'nome',
      v_perfil.nome,
    'email',
      v_perfil.email,
    'tipo_acesso',
      v_perfil.tipo_acesso,
    'ativo',
      v_perfil.ativo,
    'time_equipe',
      v_perfil.time_equipe
  );

end;
$$;


revoke all
on function public.definir_tipo_acesso(
  uuid,
  text
)
from public;


grant execute
on function public.definir_tipo_acesso(
  uuid,
  text
)
to authenticated;


-- =========================================================
-- ## 4. LEITURA DE PERFIS
-- =========================================================
--
-- Vendedor:
-- -> próprio perfil.
--
-- Gestor:
-- -> todos.
--
-- Diretor:
-- -> todos, somente leitura pelas demais regras.
--
-- ADM:
-- -> todos.
-- =========================================================

drop policy if exists "perfis_select"
on public.perfis;


create policy "perfis_select"
on public.perfis
for select
to authenticated
using (
  public.usuario_visao_global()
  or (
    public.usuario_ativo()
    and user_id = auth.uid()
  )
);


-- =========================================================
-- ## 5. RESPONSÁVEL COMERCIAL
-- =========================================================
--
-- Agora o responsável pode ser:
-- - vendedor
-- - gestor
--
-- Diretor:
-- - não é responsável operacional.
--
-- ADM:
-- - possui acesso administrativo,
--   mas não precisa ser responsável.
-- =========================================================

create or replace function
public.preparar_vendedor_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare

  v_tipo_usuario_atual text;
  v_tipo_responsavel text;
  v_responsavel_ativo boolean;

begin

  -- -------------------------------------------------------
  -- ## 5.1 Criador original é imutável
  -- -------------------------------------------------------

  if tg_op = 'UPDATE'
     and new.criado_por is distinct from old.criado_por then

    raise exception
      'O criador original da proposta não pode ser alterado.';

  end if;


  -- -------------------------------------------------------
  -- ## 5.2 Vendedor/Gestor criando proposta própria
  -- -------------------------------------------------------

  if tg_op = 'INSERT'
     and new.vendedor_responsavel_id is null
     and auth.uid() is not null then

    select p.tipo_acesso
    into v_tipo_usuario_atual
    from public.perfis p
    where p.user_id = auth.uid()
      and p.ativo = true;


    if v_tipo_usuario_atual in (
      'vendedor',
      'gestor'
    ) then

      new.vendedor_responsavel_id :=
        auth.uid();

    end if;

  end if;


  -- -------------------------------------------------------
  -- ## 5.3 Validar responsável
  -- -------------------------------------------------------

  if new.vendedor_responsavel_id is not null then

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
        'O responsável comercial precisa possuir perfil VENDEDOR ou GESTOR.';

    end if;


    if v_responsavel_ativo is distinct from true then

      raise exception
        'O responsável comercial precisa estar ativo.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- ## 5.4 Mudança de responsável
  -- -------------------------------------------------------
  --
  -- Continua restrita a Gestor/ADM.
  -- O trigger anti-bypass do SQL 017 exige que a alteração
  -- passe pela RPC oficial transferir_proposta().
  -- -------------------------------------------------------

  if tg_op = 'UPDATE'
     and new.vendedor_responsavel_id
         is distinct from
         old.vendedor_responsavel_id
     and not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode alterar o responsável comercial.';

  end if;


  return new;

end;
$$;


-- =========================================================
-- ## 6. ACESSO OPERACIONAL À PROPOSTA
-- =========================================================
--
-- ADM:
-- -> qualquer proposta.
--
-- Vendedor/Gestor:
-- -> somente quando são o responsável atual.
--
-- Diretor:
-- -> não possui acesso operacional.
-- =========================================================

create or replace function
public.pode_acessar_proposta(
  p_proposta_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.usuario_adm()

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
$$;


create or replace function
public.pode_acessar_revisao(
  p_revisao_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.revisoes_proposta r
    where r.id = p_revisao_id
      and public.pode_acessar_proposta(
        r.proposta_id
      )
  );
$$;


-- =========================================================
-- ## 7. VISUALIZAÇÃO GLOBAL
-- =========================================================
--
-- Gestor/Diretor/ADM:
-- -> todas.
--
-- Vendedor:
-- -> somente quando é o responsável atual.
-- =========================================================

create or replace function
public.pode_visualizar_proposta(
  p_proposta_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
$$;


create or replace function
public.pode_visualizar_revisao(
  p_revisao_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.revisoes_proposta r
    where r.id = p_revisao_id
      and public.pode_visualizar_proposta(
        r.proposta_id
      )
  );
$$;


revoke all
on function public.pode_acessar_proposta(uuid)
from public;

revoke all
on function public.pode_acessar_revisao(uuid)
from public;

revoke all
on function public.pode_visualizar_proposta(uuid)
from public;

revoke all
on function public.pode_visualizar_revisao(uuid)
from public;


grant execute
on function public.pode_acessar_proposta(uuid)
to authenticated;

grant execute
on function public.pode_acessar_revisao(uuid)
to authenticated;

grant execute
on function public.pode_visualizar_proposta(uuid)
to authenticated;

grant execute
on function public.pode_visualizar_revisao(uuid)
to authenticated;


-- =========================================================
-- ## 8. RLS - PROPOSTAS
-- =========================================================

drop policy if exists "propostas_select"
on public.propostas;


create policy "propostas_select"
on public.propostas
for select
to authenticated
using (
  public.pode_visualizar_proposta(id)
);


-- Diretor não pode inserir propostas diretamente.
-- Vendedor/Gestor/ADM continuam operacionais.
drop policy if exists "propostas_insert"
on public.propostas;


create policy "propostas_insert"
on public.propostas
for insert
to authenticated
with check (
  public.usuario_operacao_comercial()

  and

  criado_por =
    auth.uid()

  and

  (
    vendedor_responsavel_id is null

    or

    vendedor_responsavel_id =
      auth.uid()

    or

    public.usuario_gestor_ou_adm()
  )
);


drop policy if exists "propostas_update"
on public.propostas;


create policy "propostas_update"
on public.propostas
for update
to authenticated
using (
  public.pode_acessar_proposta(id)
)
with check (
  public.pode_acessar_proposta(id)
);


-- =========================================================
-- ## 9. RLS - REVISÕES / ITENS
-- =========================================================

drop policy if exists "revisoes_select"
on public.revisoes_proposta;


create policy "revisoes_select"
on public.revisoes_proposta
for select
to authenticated
using (
  public.pode_visualizar_proposta(
    proposta_id
  )
);


drop policy if exists "revisoes_insert"
on public.revisoes_proposta;


create policy "revisoes_insert"
on public.revisoes_proposta
for insert
to authenticated
with check (
  public.pode_acessar_proposta(
    proposta_id
  )
);


drop policy if exists "revisoes_update"
on public.revisoes_proposta;


create policy "revisoes_update"
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


drop policy if exists "itens_select"
on public.itens_revisao;


create policy "itens_select"
on public.itens_revisao
for select
to authenticated
using (
  public.pode_visualizar_revisao(
    revisao_id
  )
);


-- =========================================================
-- ## 10. METAS - LEITURA DO DIRETOR
-- =========================================================
--
-- Diretor:
-- -> visualiza.
--
-- Alteração:
-- -> continua restrita ao Gestor/ADM pelas policies/RPCs
--    já existentes.
-- =========================================================

drop policy if exists "metas_vendedor_select"
on public.metas_vendedor;


create policy "metas_vendedor_select"
on public.metas_vendedor
for select
to authenticated
using (
  public.usuario_visao_global()

  or

  (
    public.usuario_ativo()
    and user_id = auth.uid()
  )
);


drop policy if exists "metas_equipe_select"
on public.metas_equipe;


create policy "metas_equipe_select"
on public.metas_equipe
for select
to authenticated
using (
  public.usuario_visao_global()

  or

  (
    public.usuario_ativo()

    and

    exists (
      select 1
      from public.perfis p
      where p.user_id = auth.uid()
        and p.ativo = true
        and p.tipo_acesso = 'vendedor'
        and p.time_equipe =
          metas_equipe.time_equipe
    )
  )
);


-- =========================================================
-- ## 11. HISTÓRICO DE TRANSFERÊNCIAS - LEITURA
-- =========================================================

drop policy if exists
  transferencias_proposta_select
on public.transferencias_proposta;


create policy
  transferencias_proposta_select
on public.transferencias_proposta
for select
to authenticated
using (
  public.usuario_visao_global()
);


-- =========================================================
-- ## 12. TRANSFERÊNCIA OFICIAL
-- =========================================================
--
-- Quem transfere:
-- -> Gestor / ADM.
--
-- Novo responsável:
-- -> Vendedor ativo do MESMO Time da proposta
-- -> Gestor ativo (gestão transversal)
--
-- Diretor:
-- -> visualiza, mas não transfere.
--
-- OBSERVAÇÃO:
-- Mantemos o nome do parâmetro p_vendedor_novo_id e os nomes
-- das colunas históricas por compatibilidade com o frontend
-- atual. A limpeza de nomenclatura ficará para a etapa final.
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
set search_path = public, pg_temp
as $$
declare

  v_proposta
    public.propostas%rowtype;

  v_responsavel_anterior
    public.perfis%rowtype;

  v_responsavel_novo
    public.perfis%rowtype;

  v_usuario_atual
    public.perfis%rowtype;

  v_motivo
    text;

  v_transferencia_id
    uuid;

  v_time_proposta
    text;

  v_time_anterior
    text;

  v_time_novo
    text;

begin

  -- -------------------------------------------------------
  -- ## 12.1 Autenticação / permissão
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  if not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode transferir propostas.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.2 Parâmetros
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
  -- ## 12.3 Usuário atual
  -- -------------------------------------------------------

  select *
  into v_usuario_atual
  from public.perfis
  where user_id = auth.uid();


  if not found then

    raise exception
      'Perfil do usuário atual não encontrado.';

  end if;


  if v_usuario_atual.ativo is distinct from true then

    raise exception
      'Usuário inativo não pode transferir propostas.';

  end if;


  if v_usuario_atual.tipo_acesso not in (
    'gestor',
    'adm'
  ) then

    raise exception
      'Perfil sem permissão para transferir propostas.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.4 Bloquear proposta durante operação
  -- -------------------------------------------------------

  select *
  into v_proposta
  from public.propostas
  where id = p_proposta_id
  for update;


  if not found then

    raise exception
      'Proposta não encontrada.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.5 Identificar Time comercial da proposta
  -- -------------------------------------------------------

  select r.time_equipe
  into v_time_proposta
  from public.revisoes_proposta r
  where r.proposta_id = v_proposta.id
    and r.numero_revisao =
      v_proposta.revisao_atual
  limit 1;


  -- Fallback defensivo para registros antigos.
  if v_time_proposta is null then

    select r.time_equipe
    into v_time_proposta
    from public.revisoes_proposta r
    where r.proposta_id =
      v_proposta.id
    order by r.numero_revisao desc
    limit 1;

  end if;


  if v_time_proposta is null
     or v_time_proposta not in (
       'pharma',
       'food',
       'revenda'
     ) then

    raise exception
      'A proposta não possui um Time comercial válido para transferência.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.6 Responsável atual
  -- -------------------------------------------------------

  if v_proposta.vendedor_responsavel_id
     is not null then

    select *
    into v_responsavel_anterior
    from public.perfis
    where user_id =
      v_proposta.vendedor_responsavel_id;

  end if;


  -- -------------------------------------------------------
  -- ## 12.7 Novo responsável
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
     ) then

    raise exception
      'O novo responsável precisa possuir perfil VENDEDOR ou GESTOR.';

  end if;


  if v_responsavel_novo.ativo
     is distinct from true then

    raise exception
      'Não é possível transferir para um responsável inativo.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.8 Regra de nicho / Time
  -- -------------------------------------------------------
  --
  -- Vendedor:
  -- -> obrigatoriamente o mesmo Time da proposta.
  --
  -- Gestor:
  -- -> transversal; pode assumir proposta de qualquer Time.
  -- -------------------------------------------------------

  if v_responsavel_novo.tipo_acesso =
     'vendedor' then

    if v_responsavel_novo.time_equipe
       is null
       or v_responsavel_novo.time_equipe
          <> v_time_proposta then

      raise exception
        'A proposta só pode ser transferida para vendedor do mesmo Time comercial.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- ## 12.9 Mesmo responsável
  -- -------------------------------------------------------

  if v_proposta.vendedor_responsavel_id =
     p_vendedor_novo_id then

    raise exception
      'Este usuário já é o responsável pela proposta.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.10 Time para auditoria
  -- -------------------------------------------------------

  v_time_anterior :=
    coalesce(
      v_responsavel_anterior.time_equipe,
      v_time_proposta
    );


  if v_responsavel_novo.tipo_acesso =
     'vendedor' then

    v_time_novo :=
      v_responsavel_novo.time_equipe;

  else

    -- Gestor não possui Time obrigatório.
    -- A oportunidade continua pertencendo ao Time histórico.
    v_time_novo :=
      v_time_proposta;

  end if;


  -- -------------------------------------------------------
  -- ## 12.11 Autorizar somente esta transferência
  -- -------------------------------------------------------

  perform set_config(
    'app.transferencia_proposta_autorizada',
    '1',
    true
  );


  -- -------------------------------------------------------
  -- ## 12.12 Atualizar responsável
  -- -------------------------------------------------------

  update public.propostas

  set vendedor_responsavel_id =
    p_vendedor_novo_id

  where id =
    p_proposta_id

  returning *
  into v_proposta;


  -- -------------------------------------------------------
  -- ## 12.13 Auditoria
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
      then null

      else coalesce(
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
  -- ## 12.14 Retorno
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
$$;


revoke all
on function public.transferir_proposta(
  uuid,
  uuid,
  text
)
from public;


grant execute
on function public.transferir_proposta(
  uuid,
  uuid,
  text
)
to authenticated;


-- =========================================================
-- ## 13. VERIFICAÇÕES
-- =========================================================

commit;


-- 13.1 Perfis permitidos.
select
  conname,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid =
  'public.perfis'::regclass
  and conname =
    'perfis_tipo_acesso_check';


-- 13.2 Funções auxiliares.
select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'usuario_diretor',
    'usuario_visao_global',
    'usuario_operacao_comercial',
    'pode_acessar_proposta',
    'pode_visualizar_proposta',
    'transferir_proposta'
  )
order by routine_name;


-- 13.3 Policies principais alteradas.
select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and (
    (
      tablename in (
        'perfis',
        'propostas',
        'revisoes_proposta',
        'itens_revisao',
        'metas_vendedor',
        'metas_equipe',
        'transferencias_proposta'
      )
    )
  )
order by
  tablename,
  policyname;


-- 13.4 Distribuição atual de perfis.
select
  tipo_acesso,
  ativo,
  count(*) as quantidade
from public.perfis
group by
  tipo_acesso,
  ativo
order by
  tipo_acesso,
  ativo;
