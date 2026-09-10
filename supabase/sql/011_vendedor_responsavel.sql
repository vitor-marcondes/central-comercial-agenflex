-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 011_vendedor_responsavel.sql
--
-- Objetivo:
-- - Separar "quem criou" de "quem é o vendedor responsável"
-- - Ligar cada proposta a um usuário vendedor
-- - Preparar cálculo confiável de metas por usuário
-- - Permitir que vendedor responsável acesse sua proposta
-- - Permitir que Gestor/ADM atribuam ou troquem o responsável
--
-- Conceito:
-- criado_por              = auditoria / quem criou o registro
-- vendedor_responsavel_id = dono comercial da oportunidade
-- =========================================================

begin;


-- =========================================================
-- ## 1. COLUNA VENDEDOR RESPONSÁVEL
-- =========================================================

alter table public.propostas
add column if not exists vendedor_responsavel_id uuid;


-- =========================================================
-- ## 2. CHAVE ESTRANGEIRA
-- =========================================================

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'propostas_vendedor_responsavel_id_fkey'
      and conrelid =
        'public.propostas'::regclass
  ) then

    alter table public.propostas
    add constraint propostas_vendedor_responsavel_id_fkey
    foreign key (
      vendedor_responsavel_id
    )
    references public.perfis(user_id)
    on delete set null;

  end if;

end;
$$;


-- =========================================================
-- ## 3. BACKFILL DOS REGISTROS EXISTENTES
-- =========================================================

-- Se uma proposta antiga foi criada por um usuário que já é
-- VENDEDOR, esse usuário passa a ser o responsável.
--
-- Propostas antigas criadas por ADM/GESTOR ficam sem responsável
-- até serem atribuídas futuramente pela interface de gestão.

update public.propostas p
set vendedor_responsavel_id =
  p.criado_por
from public.perfis pf
where
  p.vendedor_responsavel_id is null
  and pf.user_id = p.criado_por
  and pf.tipo_acesso = 'vendedor';


-- =========================================================
-- ## 4. ÍNDICE
-- =========================================================

create index if not exists
idx_propostas_vendedor_responsavel
on public.propostas (
  vendedor_responsavel_id
);


-- =========================================================
-- ## 5. PREPARAR / PROTEGER VENDEDOR RESPONSÁVEL
-- =========================================================

create or replace function
public.preparar_vendedor_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

  v_tipo_usuario_atual text;
  v_tipo_responsavel text;

begin

  -- -------------------------------------------------------
  -- ## 5.1 Criador da proposta é imutável
  -- -------------------------------------------------------

  if tg_op = 'UPDATE'
     and new.criado_por is distinct from old.criado_por then

    raise exception
      'O criador original da proposta não pode ser alterado.';

  end if;


  -- -------------------------------------------------------
  -- ## 5.2 Vendedor criando a própria proposta
  -- -------------------------------------------------------

  if tg_op = 'INSERT'
     and new.vendedor_responsavel_id is null
     and auth.uid() is not null then

    select p.tipo_acesso
    into v_tipo_usuario_atual
    from public.perfis p
    where p.user_id = auth.uid()
      and p.ativo = true;


    if v_tipo_usuario_atual = 'vendedor' then

      new.vendedor_responsavel_id :=
        auth.uid();

    end if;

  end if;


  -- -------------------------------------------------------
  -- ## 5.3 Responsável precisa ser VENDEDOR
  -- -------------------------------------------------------

  if new.vendedor_responsavel_id is not null then

    select p.tipo_acesso
    into v_tipo_responsavel
    from public.perfis p
    where p.user_id =
      new.vendedor_responsavel_id;


    if v_tipo_responsavel is distinct from 'vendedor' then

      raise exception
        'O responsável comercial precisa ser um usuário do tipo vendedor.';

    end if;

  end if;


  -- -------------------------------------------------------
  -- ## 5.4 Troca de responsável somente por Gestor/ADM
  -- -------------------------------------------------------

  if tg_op = 'UPDATE'
     and new.vendedor_responsavel_id
         is distinct from
         old.vendedor_responsavel_id
     and not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode alterar o vendedor responsável.';

  end if;


  return new;

end;
$$;


drop trigger if exists
trg_preparar_vendedor_responsavel
on public.propostas;

create trigger
trg_preparar_vendedor_responsavel
before insert or update
on public.propostas
for each row
execute function
public.preparar_vendedor_responsavel();


-- =========================================================
-- ## 6. PROTEGER AUTORIA DAS REVISÕES
-- =========================================================

create or replace function
public.proteger_autoria_revisao()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  if tg_op = 'UPDATE'
     and new.criado_por
         is distinct from
         old.criado_por then

    raise exception
      'O criador original da revisão não pode ser alterado.';

  end if;


  return new;

end;
$$;


drop trigger if exists
trg_proteger_autoria_revisao
on public.revisoes_proposta;

create trigger
trg_proteger_autoria_revisao
before update
on public.revisoes_proposta
for each row
execute function
public.proteger_autoria_revisao();


-- =========================================================
-- ## 7. ACESSO OPERACIONAL À PROPOSTA
-- =========================================================

-- ADM:
-- pode acessar qualquer proposta.
--
-- VENDEDOR:
-- pode acessar propostas criadas por ele OU atribuídas a ele.
--
-- GESTOR:
-- visualiza todas pelo RLS criado no 008,
-- mas edição operacional continua apenas nas propostas
-- criadas por ele. Gestão ampla ficará separada.

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
    or (
      public.usuario_ativo()
      and exists (
        select 1
        from public.propostas p
        where p.id = p_proposta_id
          and (
            p.criado_por = auth.uid()
            or
            p.vendedor_responsavel_id = auth.uid()
          )
      )
    );
$$;


-- =========================================================
-- ## 8. ACESSO OPERACIONAL À REVISÃO
-- =========================================================

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
-- ## 9. VISUALIZAÇÃO DA PROPOSTA
-- =========================================================

-- Mantém:
-- VENDEDOR → próprias/atribuídas
-- GESTOR   → todas
-- ADM      → todas

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
    public.usuario_gestor_ou_adm()
    or (
      public.usuario_ativo()
      and exists (
        select 1
        from public.propostas p
        where p.id = p_proposta_id
          and (
            p.criado_por = auth.uid()
            or
            p.vendedor_responsavel_id = auth.uid()
          )
      )
    );
$$;


-- =========================================================
-- ## 10. RLS - UPDATE DE PROPOSTAS
-- =========================================================

-- A policy antiga exigia criado_por = auth.uid().
-- Agora a proposta também pode pertencer comercialmente
-- a um vendedor diferente do usuário que a criou.
--
-- O trigger da seção 5 impede vendedor comum de trocar
-- vendedor_responsavel_id.

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
-- ## 11. RLS - REVISÕES
-- =========================================================

-- Responsável comercial também precisa conseguir trabalhar
-- nas revisões R0/R1/R2 da proposta atribuída a ele.
--
-- A autoria da revisão continua protegida pelo trigger
-- criado na seção 6.

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


-- =========================================================
-- ## 12. RPC - DEFINIR VENDEDOR RESPONSÁVEL
-- =========================================================

create or replace function
public.definir_vendedor_responsavel(
  p_proposta_id uuid,
  p_vendedor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

  v_proposta public.propostas%rowtype;
  v_vendedor public.perfis%rowtype;

begin

  -- -------------------------------------------------------
  -- ## 12.1 Autenticação
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.2 Permissão
  -- -------------------------------------------------------

  if not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode definir o vendedor responsável.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.3 Proposta
  -- -------------------------------------------------------

  select *
  into v_proposta
  from public.propostas
  where id = p_proposta_id;


  if not found then

    raise exception
      'Proposta não encontrada.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.4 Vendedor
  -- -------------------------------------------------------

  select *
  into v_vendedor
  from public.perfis
  where user_id = p_vendedor_id;


  if not found then

    raise exception
      'Vendedor não encontrado.';

  end if;


  if v_vendedor.tipo_acesso <> 'vendedor' then

    raise exception
      'O responsável precisa possuir perfil VENDEDOR.';

  end if;


  if not v_vendedor.ativo then

    raise exception
      'Não é possível atribuir a proposta a um vendedor inativo.';

  end if;


  -- -------------------------------------------------------
  -- ## 12.5 Atualização
  -- -------------------------------------------------------

  update public.propostas
  set vendedor_responsavel_id =
    p_vendedor_id
  where id = p_proposta_id
  returning *
  into v_proposta;


  -- -------------------------------------------------------
  -- ## 12.6 Retorno
  -- -------------------------------------------------------

  return jsonb_build_object(
    'proposta_id',
    v_proposta.id,
    'numero',
    v_proposta.numero,
    'vendedor_responsavel_id',
    v_proposta.vendedor_responsavel_id,
    'vendedor_nome',
    v_vendedor.nome
  );

end;
$$;


revoke all
on function
public.definir_vendedor_responsavel(
  uuid,
  uuid
)
from public;

grant execute
on function
public.definir_vendedor_responsavel(
  uuid,
  uuid
)
to authenticated;


commit;


-- =========================================================
-- ## 13. VERIFICAÇÕES
-- =========================================================

-- 13.1 A coluna deve existir.

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'propostas'
  and column_name =
    'vendedor_responsavel_id';


-- 13.2 A FK e o índice devem existir.

select
  conname,
  pg_get_constraintdef(oid)
from pg_constraint
where conrelid =
  'public.propostas'::regclass
  and conname =
    'propostas_vendedor_responsavel_id_fkey';


-- 13.3 A RPC deve existir.

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name =
    'definir_vendedor_responsavel';


-- 13.4 Conferência dos vínculos atuais.

select
  p.numero,
  p.criado_por,
  p.vendedor_responsavel_id,
  pf.nome as vendedor_responsavel
from public.propostas p
left join public.perfis pf
  on pf.user_id =
     p.vendedor_responsavel_id
order by p.numero desc;
