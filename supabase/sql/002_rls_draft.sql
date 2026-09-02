-- Central Comercial Agenflex
-- 002_rls.sql
-- Políticas de segurança (RLS) para Vendedor e ADM.
--
-- Regra desta primeira versão:
-- - usuário deslogado: não acessa as tabelas
-- - vendedor ativo: acessa as próprias propostas e revisões
-- - adm ativo: acessa todas as propostas e perfis
-- - revisão ENVIADA continua imutável pelos triggers criados em 001_schema.sql

begin;

-- =========================================================
-- FUNÇÕES AUXILIARES
-- SECURITY DEFINER evita recursão de RLS ao consultar public.perfis.
-- =========================================================

create or replace function public.usuario_ativo()
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
  );
$$;

create or replace function public.usuario_adm()
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
      and p.tipo_acesso = 'adm'
  );
$$;

create or replace function public.pode_acessar_proposta(p_proposta_id uuid)
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
          and p.criado_por = auth.uid()
      )
    );
$$;

create or replace function public.pode_acessar_revisao(p_revisao_id uuid)
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
      and public.pode_acessar_proposta(r.proposta_id)
  );
$$;

revoke all on function public.usuario_ativo() from public;
revoke all on function public.usuario_adm() from public;
revoke all on function public.pode_acessar_proposta(uuid) from public;
revoke all on function public.pode_acessar_revisao(uuid) from public;

grant execute on function public.usuario_ativo() to authenticated;
grant execute on function public.usuario_adm() to authenticated;
grant execute on function public.pode_acessar_proposta(uuid) to authenticated;
grant execute on function public.pode_acessar_revisao(uuid) to authenticated;

-- =========================================================
-- LIMPA POLICIES ANTIGAS, SE O ARQUIVO FOR EXECUTADO DE NOVO
-- =========================================================

drop policy if exists "perfis_select" on public.perfis;
drop policy if exists "perfis_insert" on public.perfis;
drop policy if exists "perfis_update" on public.perfis;
drop policy if exists "perfis_delete" on public.perfis;

drop policy if exists "propostas_select" on public.propostas;
drop policy if exists "propostas_insert" on public.propostas;
drop policy if exists "propostas_update" on public.propostas;
drop policy if exists "propostas_delete" on public.propostas;

drop policy if exists "revisoes_select" on public.revisoes_proposta;
drop policy if exists "revisoes_insert" on public.revisoes_proposta;
drop policy if exists "revisoes_update" on public.revisoes_proposta;
drop policy if exists "revisoes_delete" on public.revisoes_proposta;

drop policy if exists "itens_select" on public.itens_revisao;
drop policy if exists "itens_insert" on public.itens_revisao;
drop policy if exists "itens_update" on public.itens_revisao;
drop policy if exists "itens_delete" on public.itens_revisao;

-- =========================================================
-- PERFIS
-- Vendedor lê apenas o próprio perfil.
-- ADM lê e administra todos os perfis.
-- =========================================================

create policy "perfis_select"
on public.perfis
for select
to authenticated
using (
  public.usuario_adm()
  or (
    public.usuario_ativo()
    and user_id = auth.uid()
  )
);

create policy "perfis_insert"
on public.perfis
for insert
to authenticated
with check (
  public.usuario_adm()
);

create policy "perfis_update"
on public.perfis
for update
to authenticated
using (
  public.usuario_adm()
)
with check (
  public.usuario_adm()
);

create policy "perfis_delete"
on public.perfis
for delete
to authenticated
using (
  public.usuario_adm()
);

-- =========================================================
-- PROPOSTAS
-- Vendedor: próprias propostas.
-- ADM: todas.
-- =========================================================

create policy "propostas_select"
on public.propostas
for select
to authenticated
using (
  public.usuario_adm()
  or (
    public.usuario_ativo()
    and criado_por = auth.uid()
  )
);

create policy "propostas_insert"
on public.propostas
for insert
to authenticated
with check (
  public.usuario_ativo()
  and (
    criado_por = auth.uid()
    or public.usuario_adm()
  )
);

create policy "propostas_update"
on public.propostas
for update
to authenticated
using (
  public.pode_acessar_proposta(id)
)
with check (
  public.usuario_ativo()
  and (
    criado_por = auth.uid()
    or public.usuario_adm()
  )
);

create policy "propostas_delete"
on public.propostas
for delete
to authenticated
using (
  public.pode_acessar_proposta(id)
);

-- =========================================================
-- REVISÕES
-- Herda o acesso da proposta-pai.
-- Os triggers do 001 impedem alterações após status = 'enviada'.
-- =========================================================

create policy "revisoes_select"
on public.revisoes_proposta
for select
to authenticated
using (
  public.pode_acessar_proposta(proposta_id)
);

create policy "revisoes_insert"
on public.revisoes_proposta
for insert
to authenticated
with check (
  public.pode_acessar_proposta(proposta_id)
  and (
    criado_por = auth.uid()
    or public.usuario_adm()
  )
);

create policy "revisoes_update"
on public.revisoes_proposta
for update
to authenticated
using (
  public.pode_acessar_proposta(proposta_id)
)
with check (
  public.pode_acessar_proposta(proposta_id)
  and (
    criado_por = auth.uid()
    or public.usuario_adm()
  )
);

create policy "revisoes_delete"
on public.revisoes_proposta
for delete
to authenticated
using (
  public.pode_acessar_proposta(proposta_id)
);

-- =========================================================
-- ITENS
-- O acesso depende da revisão e da proposta-pai.
-- =========================================================

create policy "itens_select"
on public.itens_revisao
for select
to authenticated
using (
  public.pode_acessar_revisao(revisao_id)
);

create policy "itens_insert"
on public.itens_revisao
for insert
to authenticated
with check (
  public.pode_acessar_revisao(revisao_id)
);

create policy "itens_update"
on public.itens_revisao
for update
to authenticated
using (
  public.pode_acessar_revisao(revisao_id)
)
with check (
  public.pode_acessar_revisao(revisao_id)
);

create policy "itens_delete"
on public.itens_revisao
for delete
to authenticated
using (
  public.pode_acessar_revisao(revisao_id)
);

commit;

-- =========================================================
-- VERIFICAÇÃO
-- Deve retornar 16 policies: 4 em cada tabela.
-- =========================================================
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
