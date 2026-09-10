-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 008_perfis_gestor.sql
--
-- Objetivo:
-- - Adicionar o perfil GESTOR
-- - Manter ADM como perfil administrativo
-- - Permitir que GESTOR visualize a equipe inteira
-- - Manter alterações administrativas de perfis restritas ao ADM
-- - Preservar as regras atuais de edição das propostas
--
-- Perfis:
-- - vendedor
-- - gestor
-- - adm
-- =========================================================

begin;


-- =========================================================
-- ## 1. TIPO DE ACESSO
-- =========================================================

alter table public.perfis
  drop constraint if exists perfis_tipo_acesso_check;

alter table public.perfis
  add constraint perfis_tipo_acesso_check
  check (
    tipo_acesso in (
      'vendedor',
      'gestor',
      'adm'
    )
  );


-- =========================================================
-- ## 2. FUNÇÕES AUXILIARES DE PERFIL
-- =========================================================

create or replace function public.usuario_gestor()
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
      and p.tipo_acesso = 'gestor'
  );
$$;


create or replace function public.usuario_gestor_ou_adm()
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
      and p.tipo_acesso in ('gestor', 'adm')
  );
$$;


-- =========================================================
-- ## 3. FUNÇÕES DE VISUALIZAÇÃO
-- =========================================================

create or replace function public.pode_visualizar_proposta(
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
          and p.criado_por = auth.uid()
      )
    );
$$;


create or replace function public.pode_visualizar_revisao(
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


-- =========================================================
-- ## 4. PERMISSÕES DAS FUNÇÕES
-- =========================================================

revoke all
on function public.usuario_gestor()
from public;

revoke all
on function public.usuario_gestor_ou_adm()
from public;

revoke all
on function public.pode_visualizar_proposta(uuid)
from public;

revoke all
on function public.pode_visualizar_revisao(uuid)
from public;


grant execute
on function public.usuario_gestor()
to authenticated;

grant execute
on function public.usuario_gestor_ou_adm()
to authenticated;

grant execute
on function public.pode_visualizar_proposta(uuid)
to authenticated;

grant execute
on function public.pode_visualizar_revisao(uuid)
to authenticated;


-- =========================================================
-- ## 5. RLS - PERFIS
-- =========================================================

-- Vendedor:
-- lê apenas o próprio perfil.
--
-- Gestor:
-- lê os perfis da equipe.
--
-- ADM:
-- lê todos.
--
-- INSERT / UPDATE / DELETE continuam restritos ao ADM.

drop policy if exists "perfis_select"
on public.perfis;

create policy "perfis_select"
on public.perfis
for select
to authenticated
using (
  public.usuario_gestor_ou_adm()
  or (
    public.usuario_ativo()
    and user_id = auth.uid()
  )
);


-- =========================================================
-- ## 6. RLS - PROPOSTAS
-- =========================================================

-- Apenas a LEITURA muda.
--
-- Vendedor:
-- próprias propostas.
--
-- Gestor / ADM:
-- todas as propostas.

drop policy if exists "propostas_select"
on public.propostas;

create policy "propostas_select"
on public.propostas
for select
to authenticated
using (
  public.pode_visualizar_proposta(id)
);


-- =========================================================
-- ## 7. RLS - REVISÕES
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


-- =========================================================
-- ## 8. RLS - ITENS
-- =========================================================

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


commit;


-- =========================================================
-- ## 9. VERIFICAÇÕES
-- =========================================================

-- 9.1 Deve aceitar vendedor / gestor / adm.

select
  conname,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.perfis'::regclass
  and contype = 'c'
order by conname;


-- 9.2 Deve mostrar as quatro funções novas.

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'usuario_gestor',
    'usuario_gestor_ou_adm',
    'pode_visualizar_proposta',
    'pode_visualizar_revisao'
  )
order by routine_name;


-- 9.3 As 16 policies principais continuam existindo.

select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'perfis',
    'propostas',
    'revisoes_proposta',
    'itens_revisao'
  )
order by tablename, policyname;