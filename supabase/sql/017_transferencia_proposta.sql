-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 017_transferencia_proposta.sql
--
-- Responsabilidade:
-- - Transferir proposta entre vendedores
-- - Registrar histórico obrigatório da transferência
-- - Exigir motivo
-- - Impedir troca direta do responsável
-- - Remover criado_por como critério de propriedade atual
-- - Manter criado_por apenas como auditoria
--
-- Dependências:
-- - public.propostas
-- - public.perfis
-- - public.usuario_ativo()
-- - public.usuario_adm()
-- - public.usuario_gestor_ou_adm()
-- - public.preparar_vendedor_responsavel()
-- =========================================================

begin;


-- =========================================================
-- ## 1. HISTÓRICO DE TRANSFERÊNCIAS
-- =========================================================

create table if not exists public.transferencias_proposta (

  id uuid
    primary key
    default gen_random_uuid(),

  proposta_id uuid
    references public.propostas(id)
    on delete set null,

  proposta_numero text
    not null,

  vendedor_anterior_id uuid
    references public.perfis(user_id)
    on delete set null,

  vendedor_anterior_nome text,

  time_anterior text,

  vendedor_novo_id uuid
    references public.perfis(user_id)
    on delete set null,

  vendedor_novo_nome text
    not null,

  time_novo text,

  transferido_por uuid
    references public.perfis(user_id)
    on delete set null,

  transferido_por_nome text
    not null,

  motivo text
    not null,

  created_at timestamptz
    not null
    default now(),

  constraint transferencias_proposta_time_anterior_check
    check (
      time_anterior is null
      or time_anterior in (
        'pharma',
        'food',
        'revenda'
      )
    ),

  constraint transferencias_proposta_time_novo_check
    check (
      time_novo is null
      or time_novo in (
        'pharma',
        'food',
        'revenda'
      )
    ),

  constraint transferencias_proposta_motivo_check
    check (
      char_length(
        btrim(motivo)
      ) between 5 and 500
    )

);


-- =========================================================
-- ## 2. ÍNDICES
-- =========================================================

create index if not exists
  idx_transferencias_proposta_proposta
on public.transferencias_proposta(
  proposta_id
);


create index if not exists
  idx_transferencias_proposta_data
on public.transferencias_proposta(
  created_at desc
);


create index if not exists
  idx_transferencias_proposta_novo_vendedor
on public.transferencias_proposta(
  vendedor_novo_id
);


-- =========================================================
-- ## 3. RLS DO HISTÓRICO
-- =========================================================

alter table
  public.transferencias_proposta
enable row level security;


drop policy if exists
  transferencias_proposta_select
on public.transferencias_proposta;


create policy
  transferencias_proposta_select
on public.transferencias_proposta

for select

to authenticated

using (
  public.usuario_gestor_ou_adm()
);


-- ---------------------------------------------------------
-- ## 3.1 Permissões
-- ---------------------------------------------------------

revoke all
on public.transferencias_proposta
from public;


revoke all
on public.transferencias_proposta
from anon;


revoke insert,
       update,
       delete
on public.transferencias_proposta
from authenticated;


grant select
on public.transferencias_proposta
to authenticated;


-- =========================================================
-- ## 4. VISIBILIDADE DA PROPOSTA
--
-- REGRA NOVA:
--
-- Gestor / ADM
-- → podem visualizar todas.
--
-- Vendedor
-- → visualiza somente quando é o responsável ATUAL.
--
-- criado_por
-- → continua registrado, mas deixa de definir propriedade.
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

    public.usuario_gestor_ou_adm()

    or

    (

      public.usuario_ativo()

      and

      exists (

        select
          1

        from public.propostas p

        where
          p.id = p_proposta_id

          and
          p.vendedor_responsavel_id =
            auth.uid()

      )

    );

$$;


-- =========================================================
-- ## 5. ACESSO OPERACIONAL
--
-- Mantemos a lógica antiga:
--
-- ADM
-- → acesso administrativo.
--
-- Vendedor
-- → somente proposta sob sua responsabilidade atual.
--
-- A principal alteração é a remoção de criado_por.
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

      public.usuario_ativo()

      and

      exists (

        select
          1

        from public.propostas p

        where
          p.id = p_proposta_id

          and
          p.vendedor_responsavel_id =
            auth.uid()

      )

    );

$$;


-- =========================================================
-- ## 6. UPDATE DIRETO DA PROPOSTA
--
-- Retiramos criado_por da política.
--
-- ADM:
-- → mantém acesso administrativo direto.
--
-- Vendedor:
-- → somente quando é o responsável atual.
--
-- Gestor:
-- → ações gerenciais sensíveis continuam sendo feitas
--   pelas RPCs específicas SECURITY DEFINER.
-- =========================================================

drop policy if exists
  propostas_update
on public.propostas;


create policy
  propostas_update
on public.propostas

for update

to authenticated

using (

  public.usuario_adm()

  or

  (

    public.usuario_ativo()

    and

    vendedor_responsavel_id =
      auth.uid()

  )

)

with check (

  public.usuario_adm()

  or

  (

    public.usuario_ativo()

    and

    vendedor_responsavel_id =
      auth.uid()

  )

);


-- =========================================================
-- ## 7. BLOQUEAR TROCA DIRETA DE RESPONSÁVEL
--
-- Mesmo Gestor / ADM não deve alterar
-- vendedor_responsavel_id diretamente.
--
-- A alteração precisa passar pela RPC transferir_proposta()
-- para que motivo e histórico sejam obrigatórios.
-- =========================================================

create or replace function
  public.bloquear_transferencia_direta()

returns trigger

language plpgsql

set search_path = public, pg_temp

as $$

begin

  if
    new.vendedor_responsavel_id
      is distinct from
    old.vendedor_responsavel_id
  then

    if
      coalesce(
        current_setting(
          'app.transferencia_proposta_autorizada',
          true
        ),
        ''
      ) <> '1'
    then

      raise exception
        'A transferência do responsável deve ser realizada pela função oficial de transferência.';

    end if;

  end if;


  return new;

end;

$$;


drop trigger if exists
  trg_bloquear_transferencia_direta
on public.propostas;


create trigger
  trg_bloquear_transferencia_direta

before update of vendedor_responsavel_id

on public.propostas

for each row

execute function
  public.bloquear_transferencia_direta();


revoke all
on function public.bloquear_transferencia_direta()
from public;


-- =========================================================
-- ## 8. RPC OFICIAL DE TRANSFERÊNCIA
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

  v_vendedor_anterior
    public.perfis%rowtype;

  v_vendedor_novo
    public.perfis%rowtype;

  v_usuario_atual
    public.perfis%rowtype;

  v_motivo
    text;

  v_transferencia_id
    uuid;

begin

  -- -------------------------------------------------------
  -- ## 8.1 Autenticação
  -- -------------------------------------------------------

  if auth.uid() is null then

    raise exception
      'Usuário não autenticado.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.2 Permissão
  -- -------------------------------------------------------

  if not public.usuario_gestor_ou_adm() then

    raise exception
      'Apenas Gestor ou ADM pode transferir propostas.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.3 Validar parâmetros
  -- -------------------------------------------------------

  if p_proposta_id is null then

    raise exception
      'Proposta não informada.';

  end if;


  if p_vendedor_novo_id is null then

    raise exception
      'Novo vendedor não informado.';

  end if;


  v_motivo :=
    btrim(
      coalesce(
        p_motivo,
        ''
      )
    );


  if
    char_length(
      v_motivo
    ) < 5
  then

    raise exception
      'Informe o motivo da transferência com pelo menos 5 caracteres.';

  end if;


  if
    char_length(
      v_motivo
    ) > 500
  then

    raise exception
      'O motivo da transferência pode possuir no máximo 500 caracteres.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.4 Usuário que está transferindo
  -- -------------------------------------------------------

  select
    *

  into
    v_usuario_atual

  from public.perfis

  where
    user_id =
      auth.uid();


  if not found then

    raise exception
      'Perfil do usuário atual não encontrado.';

  end if;


  if
    v_usuario_atual.ativo
      is distinct from
    true
  then

    raise exception
      'Usuário inativo não pode transferir propostas.';

  end if;


  if
    v_usuario_atual.tipo_acesso
      not in (
        'gestor',
        'adm'
      )
  then

    raise exception
      'Perfil sem permissão para transferir propostas.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.5 Bloquear a proposta durante a transferência
  -- -------------------------------------------------------

  select
    *

  into
    v_proposta

  from public.propostas

  where
    id =
      p_proposta_id

  for update;


  if not found then

    raise exception
      'Proposta não encontrada.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.6 Responsável atual
  -- -------------------------------------------------------

  if
    v_proposta.vendedor_responsavel_id
      is not null
  then

    select
      *

    into
      v_vendedor_anterior

    from public.perfis

    where
      user_id =
        v_proposta.vendedor_responsavel_id;

  end if;


  -- -------------------------------------------------------
  -- ## 8.7 Novo vendedor
  -- -------------------------------------------------------

  select
    *

  into
    v_vendedor_novo

  from public.perfis

  where
    user_id =
      p_vendedor_novo_id;


  if not found then

    raise exception
      'Novo vendedor não encontrado.';

  end if;


  if
    v_vendedor_novo.tipo_acesso
      is distinct from
    'vendedor'
  then

    raise exception
      'O novo responsável precisa possuir perfil VENDEDOR.';

  end if;


  if
    v_vendedor_novo.ativo
      is distinct from
    true
  then

    raise exception
      'Não é possível transferir para um vendedor inativo.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.8 Impedir transferência para o mesmo responsável
  -- -------------------------------------------------------

  if
    v_proposta.vendedor_responsavel_id =
      p_vendedor_novo_id
  then

    raise exception
      'Este vendedor já é o responsável pela proposta.';

  end if;


  -- -------------------------------------------------------
  -- ## 8.9 Autorizar somente esta alteração
  --
  -- O valor é local à transação da RPC.
  -- Depois que a função termina, ele desaparece.
  -- -------------------------------------------------------

  perform set_config(
    'app.transferencia_proposta_autorizada',
    '1',
    true
  );


  -- -------------------------------------------------------
  -- ## 8.10 Alterar responsável
  --
  -- O trigger preparar_vendedor_responsavel continua ativo
  -- e também validará a operação.
  -- -------------------------------------------------------

  update public.propostas

  set
    vendedor_responsavel_id =
      p_vendedor_novo_id

  where
    id =
      p_proposta_id

  returning
    *

  into
    v_proposta;


  -- -------------------------------------------------------
  -- ## 8.11 Registrar auditoria
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

    v_vendedor_anterior.user_id,

    case

      when
        v_vendedor_anterior.user_id
          is null
      then
        null

      else
        coalesce(
          nullif(
            btrim(
              v_vendedor_anterior.nome
            ),
            ''
          ),
          v_vendedor_anterior.email,
          'Responsável anterior'
        )

    end,

    v_vendedor_anterior.time_equipe,

    v_vendedor_novo.user_id,

    coalesce(
      nullif(
        btrim(
          v_vendedor_novo.nome
        ),
        ''
      ),
      v_vendedor_novo.email,
      'Novo responsável'
    ),

    v_vendedor_novo.time_equipe,

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

  returning
    id

  into
    v_transferencia_id;


  -- -------------------------------------------------------
  -- ## 8.12 Retorno
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
      v_vendedor_anterior.user_id,

    'vendedor_anterior_nome',
      v_vendedor_anterior.nome,

    'vendedor_novo_id',
      v_vendedor_novo.user_id,

    'vendedor_novo_nome',
      v_vendedor_novo.nome,

    'time_novo',
      v_vendedor_novo.time_equipe,

    'transferido_por',
      v_usuario_atual.user_id,

    'transferido_por_nome',
      v_usuario_atual.nome,

    'motivo',
      v_motivo

  );

end;

$$;


-- =========================================================
-- ## 9. PERMISSÃO DA NOVA RPC
-- =========================================================

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
-- ## 10. DESATIVAR RPC ANTIGA DE TROCA DIRETA
--
-- Ela não possui motivo nem histórico.
-- Mantemos a função no banco por compatibilidade,
-- mas o navegador não poderá mais executá-la.
-- =========================================================

revoke all
on function public.definir_vendedor_responsavel(
  uuid,
  uuid
)
from public;


revoke all
on function public.definir_vendedor_responsavel(
  uuid,
  uuid
)
from authenticated;


commit;


-- =========================================================
-- ## 11. VERIFICAÇÃO FINAL
-- =========================================================

select

  'Tabela de histórico' as item,

  exists (

    select
      1

    from information_schema.tables

    where
      table_schema = 'public'
      and
      table_name =
        'transferencias_proposta'

  ) as ok


union all


select

  'RPC transferir_proposta',

  exists (

    select
      1

    from pg_proc p

    join pg_namespace n
      on n.oid =
        p.pronamespace

    where
      n.nspname =
        'public'

      and
      p.proname =
        'transferir_proposta'

      and
      p.prosecdef =
        true

  )


union all


select

  'Trigger anti-bypass',

  exists (

    select
      1

    from pg_trigger

    where
      tgrelid =
        'public.propostas'::regclass

      and
      tgname =
        'trg_bloquear_transferencia_direta'

      and
      not tgisinternal

  )


union all


select

  'RLS histórico',

  exists (

    select
      1

    from pg_policies

    where
      schemaname =
        'public'

      and
      tablename =
        'transferencias_proposta'

      and
      policyname =
        'transferencias_proposta_select'

  )


union all


select

  'Política UPDATE propostas',

  exists (

    select
      1

    from pg_policies

    where
      schemaname =
        'public'

      and
      tablename =
        'propostas'

      and
      policyname =
        'propostas_update'

  );
