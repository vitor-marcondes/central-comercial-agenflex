-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 002_rls_draft.sql
--
-- Responsabilidade:
-- - Criar as políticas de Row Level Security (RLS)
-- - Diferenciar acesso de VENDEDOR e ADM
-- - Impedir acesso de usuários não autenticados
-- - Herdar permissões entre proposta, revisão e itens
-- - Centralizar verificações de autorização em funções
--
-- Dependências:
-- - 001_schema.sql
-- - Supabase Auth
-- - public.perfis
-- - public.propostas
-- - public.revisoes_proposta
-- - public.itens_revisao
--
-- Regra atual:
--
-- DESLOGADO
-- → não acessa os dados
--
-- VENDEDOR ATIVO
-- → acessa o próprio perfil
-- → acessa as próprias propostas
-- → acessa revisões e itens dessas propostas
--
-- ADM ATIVO
-- → acessa todos os perfis
-- → acessa todas as propostas, revisões e itens
--
-- IMPORTANTE:
-- Revisões com status "enviada" continuam imutáveis
-- pelos triggers criados em 001_schema.sql.
-- =========================================================


-- =========================================================
-- ## 1. INÍCIO DA TRANSAÇÃO
-- =========================================================

begin;


-- =========================================================
-- ## 2. FUNÇÕES AUXILIARES DE AUTORIZAÇÃO
-- =========================================================

-- SECURITY DEFINER:
-- estas funções executam com os privilégios do proprietário
-- da função.
--
-- Isso é importante aqui porque elas consultam public.perfis
-- e evitam recursão nas próprias policies de RLS.
--
-- Todas as tabelas são referenciadas com schema explícito.


-- ---------------------------------------------------------
-- ## 2.1 Verificar se o usuário está ativo
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- ## 2.2 Verificar se o usuário é ADM
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- ## 2.3 Verificar acesso a uma proposta
-- ---------------------------------------------------------

-- ADM:
-- → qualquer proposta
--
-- VENDEDOR:
-- → somente proposta criada pelo próprio usuário

create or replace function public.pode_acessar_proposta(
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

          and p.criado_por = auth.uid()

      )

    );

$$;


-- ---------------------------------------------------------
-- ## 2.4 Verificar acesso a uma revisão
-- ---------------------------------------------------------

-- A revisão herda a permissão da proposta-pai.

create or replace function public.pode_acessar_revisao(
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
-- ## 3. PERMISSÃO DE EXECUÇÃO DAS FUNÇÕES
-- =========================================================

-- Primeiro remove execução genérica concedida a PUBLIC.

revoke all
on function public.usuario_ativo()
from public;


revoke all
on function public.usuario_adm()
from public;


revoke all
on function public.pode_acessar_proposta(uuid)
from public;


revoke all
on function public.pode_acessar_revisao(uuid)
from public;


-- Depois libera somente para usuários autenticados.

grant execute
on function public.usuario_ativo()
to authenticated;


grant execute
on function public.usuario_adm()
to authenticated;


grant execute
on function public.pode_acessar_proposta(uuid)
to authenticated;


grant execute
on function public.pode_acessar_revisao(uuid)
to authenticated;


-- =========================================================
-- ## 4. LIMPEZA DE POLICIES ANTIGAS
-- =========================================================

-- Permite executar este arquivo novamente sem criar
-- policies duplicadas.


-- ---------------------------------------------------------
-- ## 4.1 Perfis
-- ---------------------------------------------------------

drop policy if exists
  "perfis_select"
on public.perfis;


drop policy if exists
  "perfis_insert"
on public.perfis;


drop policy if exists
  "perfis_update"
on public.perfis;


drop policy if exists
  "perfis_delete"
on public.perfis;


-- ---------------------------------------------------------
-- ## 4.2 Propostas
-- ---------------------------------------------------------

drop policy if exists
  "propostas_select"
on public.propostas;


drop policy if exists
  "propostas_insert"
on public.propostas;


drop policy if exists
  "propostas_update"
on public.propostas;


drop policy if exists
  "propostas_delete"
on public.propostas;


-- ---------------------------------------------------------
-- ## 4.3 Revisões
-- ---------------------------------------------------------

drop policy if exists
  "revisoes_select"
on public.revisoes_proposta;


drop policy if exists
  "revisoes_insert"
on public.revisoes_proposta;


drop policy if exists
  "revisoes_update"
on public.revisoes_proposta;


drop policy if exists
  "revisoes_delete"
on public.revisoes_proposta;


-- ---------------------------------------------------------
-- ## 4.4 Itens
-- ---------------------------------------------------------

drop policy if exists
  "itens_select"
on public.itens_revisao;


drop policy if exists
  "itens_insert"
on public.itens_revisao;


drop policy if exists
  "itens_update"
on public.itens_revisao;


drop policy if exists
  "itens_delete"
on public.itens_revisao;


-- =========================================================
-- ## 5. POLICIES DA TABELA PERFIS
-- =========================================================

-- VENDEDOR:
-- → SELECT apenas do próprio perfil
--
-- ADM:
-- → SELECT, INSERT, UPDATE e DELETE de todos os perfis


-- ---------------------------------------------------------
-- ## 5.1 SELECT
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- ## 5.2 INSERT
-- ---------------------------------------------------------

create policy "perfis_insert"

on public.perfis

for insert

to authenticated

with check (

  public.usuario_adm()

);


-- ---------------------------------------------------------
-- ## 5.3 UPDATE
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- ## 5.4 DELETE
-- ---------------------------------------------------------

create policy "perfis_delete"

on public.perfis

for delete

to authenticated

using (

  public.usuario_adm()

);


-- =========================================================
-- ## 6. POLICIES DA TABELA PROPOSTAS
-- =========================================================

-- VENDEDOR:
-- → acessa somente as propostas próprias
--
-- ADM:
-- → acessa todas


-- ---------------------------------------------------------
-- ## 6.1 SELECT
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- ## 6.2 INSERT
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- ## 6.3 UPDATE
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- ## 6.4 DELETE
-- ---------------------------------------------------------

create policy "propostas_delete"

on public.propostas

for delete

to authenticated

using (

  public.pode_acessar_proposta(id)

);


-- =========================================================
-- ## 7. POLICIES DA TABELA REVISÕES
-- =========================================================

-- As revisões herdam a permissão da proposta-pai.
--
-- IMPORTANTE:
-- mesmo que o RLS permita UPDATE ou DELETE,
-- os triggers do 001_schema.sql impedem alterações
-- quando status = 'enviada'.


-- ---------------------------------------------------------
-- ## 7.1 SELECT
-- ---------------------------------------------------------

create policy "revisoes_select"

on public.revisoes_proposta

for select

to authenticated

using (

  public.pode_acessar_proposta(
    proposta_id
  )

);


-- ---------------------------------------------------------
-- ## 7.2 INSERT
-- ---------------------------------------------------------

create policy "revisoes_insert"

on public.revisoes_proposta

for insert

to authenticated

with check (

  public.pode_acessar_proposta(
    proposta_id
  )

  and (

    criado_por = auth.uid()

    or public.usuario_adm()

  )

);


-- ---------------------------------------------------------
-- ## 7.3 UPDATE
-- ---------------------------------------------------------

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

  and (

    criado_por = auth.uid()

    or public.usuario_adm()

  )

);


-- ---------------------------------------------------------
-- ## 7.4 DELETE
-- ---------------------------------------------------------

create policy "revisoes_delete"

on public.revisoes_proposta

for delete

to authenticated

using (

  public.pode_acessar_proposta(
    proposta_id
  )

);


-- =========================================================
-- ## 8. POLICIES DA TABELA ITENS
-- =========================================================

-- O item herda a autorização da revisão.
--
-- A revisão, por sua vez, herda a autorização da proposta.
--
-- Fluxo:
--
-- ITEM
-- ↓
-- REVISÃO
-- ↓
-- PROPOSTA
-- ↓
-- VENDEDOR / ADM


-- ---------------------------------------------------------
-- ## 8.1 SELECT
-- ---------------------------------------------------------

create policy "itens_select"

on public.itens_revisao

for select

to authenticated

using (

  public.pode_acessar_revisao(
    revisao_id
  )

);


-- ---------------------------------------------------------
-- ## 8.2 INSERT
-- ---------------------------------------------------------

create policy "itens_insert"

on public.itens_revisao

for insert

to authenticated

with check (

  public.pode_acessar_revisao(
    revisao_id
  )

);


-- ---------------------------------------------------------
-- ## 8.3 UPDATE
-- ---------------------------------------------------------

create policy "itens_update"

on public.itens_revisao

for update

to authenticated

using (

  public.pode_acessar_revisao(
    revisao_id
  )

)

with check (

  public.pode_acessar_revisao(
    revisao_id
  )

);


-- ---------------------------------------------------------
-- ## 8.4 DELETE
-- ---------------------------------------------------------

create policy "itens_delete"

on public.itens_revisao

for delete

to authenticated

using (

  public.pode_acessar_revisao(
    revisao_id
  )

);


-- =========================================================
-- ## 9. FINALIZAÇÃO DA TRANSAÇÃO
-- =========================================================

commit;


-- =========================================================
-- ## 10. VERIFICAÇÃO DAS POLICIES
-- =========================================================

-- Resultado esperado:
--
-- 16 policies
--
-- perfis:
-- 4
--
-- propostas:
-- 4
--
-- revisoes_proposta:
-- 4
--
-- itens_revisao:
-- 4

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

order by
  tablename,
  policyname;