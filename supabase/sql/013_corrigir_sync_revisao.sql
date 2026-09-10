-- =========================================================
-- CENTRAL COMERCIAL AGENFLEX
-- Arquivo: 013_corrigir_sync_revisao.sql
--
-- Objetivo:
-- - Corrigir atualização interna de revisao_atual
-- - Evitar que o trigger técnico seja bloqueado pelo RLS
-- - Manter o RLS normalmente ativo para o usuário
--
-- Importante:
-- Esta função NÃO libera o vendedor para alterar propostas.
-- Ela é executada exclusivamente pelo trigger que sincroniza
-- propostas.revisao_atual após a criação de uma revisão.
-- =========================================================

begin;


-- =========================================================
-- ## 1. RECRIAR FUNÇÃO DE SINCRONIZAÇÃO
-- =========================================================

create or replace function
public.sync_revisao_atual()
returns trigger
language plpgsql

security definer

set search_path = ''
as $$
begin

  update public.propostas

  set

    revisao_atual =
      greatest(
        revisao_atual,
        new.numero_revisao
      ),

    updated_at =
      now()

  where id =
    new.proposta_id;


  return new;

end;
$$;


-- =========================================================
-- ## 2. RECRIAR TRIGGER
-- =========================================================

drop trigger if exists
trg_sync_revisao_atual
on public.revisoes_proposta;


create trigger
trg_sync_revisao_atual

after insert

on public.revisoes_proposta

for each row

execute function
public.sync_revisao_atual();


commit;


-- =========================================================
-- ## 3. VERIFICAÇÃO
-- =========================================================

select

  p.proname as funcao,

  pg_get_userbyid(
    p.proowner
  ) as proprietario,

  p.prosecdef
    as security_definer,

  p.proconfig
    as configuracoes

from pg_proc p

join pg_namespace n
  on n.oid =
     p.pronamespace

where
  n.nspname =
    'public'

  and

  p.proname =
    'sync_revisao_atual';