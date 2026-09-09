// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: propostas.service.js
//
// Responsabilidade:
// - Criar propostas e revisão inicial R0
// - Atualizar revisões em rascunho
// - Enviar revisões
// - Criar novas revisões
// - Atualizar gestão comercial
// - Manter compatibilidade com status comercial legado
// - Listar propostas permitidas pelo RLS
// - Carregar proposta completa com revisões e itens
//
// Dependências:
// - js/services/supabase-client.js
// - RPCs PostgreSQL / Supabase
// =========================================================


// =========================================================
// ## 1. CRIAÇÃO DA PROPOSTA R0
// =========================================================

async function criarPropostaR0(
  revisao,
  itens
) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client.rpc(
      'criar_proposta_r0',
      {
        p_revisao:
          revisao,

        p_itens:
          itens
      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 2. ATUALIZAÇÃO DE RASCUNHO
// =========================================================

async function salvarRascunhoProposta(
  propostaId,
  revisaoId,
  revisao,
  itens
) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client.rpc(
      'salvar_rascunho_proposta',
      {
        p_proposta_id:
          propostaId,

        p_revisao_id:
          revisaoId,

        p_revisao:
          revisao,

        p_itens:
          itens
      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 3. ENVIO DE REVISÃO
// =========================================================

async function enviarRevisao(
  propostaId,
  revisaoId
) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client.rpc(
      'enviar_revisao',
      {
        p_proposta_id:
          propostaId,

        p_revisao_id:
          revisaoId
      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 4. CRIAÇÃO DE NOVA REVISÃO
// =========================================================

// Fluxo:
//
// R0 ENVIADA
// ↓
// criarNovaRevisao()
// ↓
// R1 RASCUNHO
//
// Depois:
//
// R1 ENVIADA
// ↓
// R2 RASCUNHO
//
// O número da nova revisão é calculado pelo banco.

async function criarNovaRevisao(
  propostaId
) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client.rpc(
      'criar_nova_revisao',
      {
        p_proposta_id:
          propostaId
      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 5. GESTÃO COMERCIAL
// =========================================================

async function atualizarGestaoComercial(

  propostaId,

  origemComercial,

  statusComercial,

  motivoNaoConquistado = null,

  detalheNaoConquistado = null

) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client.rpc(
      'atualizar_gestao_comercial',
      {
        p_proposta_id:
          propostaId,

        p_origem_comercial:
          origemComercial,

        p_status_comercial:
          statusComercial,

        p_motivo_nao_conquistado:
          motivoNaoConquistado,

        p_detalhe_nao_conquistado:
          detalheNaoConquistado
      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 6. STATUS COMERCIAL — COMPATIBILIDADE
// =========================================================

async function atualizarStatusComercial(

  propostaId,

  statusComercial,

  motivoNaoConquistado = null,

  detalheNaoConquistado = null

) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client.rpc(
      'atualizar_status_comercial',
      {
        p_proposta_id:
          propostaId,

        p_status_comercial:
          statusComercial,

        p_motivo_nao_conquistado:
          motivoNaoConquistado,

        p_detalhe_nao_conquistado:
          detalheNaoConquistado
      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 7. LISTAGEM DE PROPOSTAS
// =========================================================

async function listarPropostas(
  { limite = 200 } = {}
) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client
      .from('propostas')
      .select(`
        id,
        numero,
        revisao_atual,
        criado_por,

        origem_comercial,

        status_comercial,
        motivo_nao_conquistado,
        detalhe_nao_conquistado,
        status_atualizado_em,
        status_atualizado_por,

        created_at,
        updated_at,

        revisoes_proposta (
          id,
          numero_revisao,
          nome_proposta,
          cliente,
          cnpj,
          vendedor_nome,
          status,
          data_proposta,
          enviado_em,
          updated_at
        )
      `)
      .order(
        'updated_at',
        {
          ascending: false
        }
      )
      .limit(
        limite
      );


  if (error) {

    throw error;

  }


  return data ?? [];
}


// =========================================================
// ## 8. CARREGAMENTO COMPLETO DA PROPOSTA
// =========================================================

async function obterPropostaCompleta(
  propostaId
) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client
      .from('propostas')
      .select(`
        id,
        numero,
        revisao_atual,
        criado_por,
        origem_proposta_id,

        origem_comercial,

        status_comercial,
        motivo_nao_conquistado,
        detalhe_nao_conquistado,
        status_atualizado_em,
        status_atualizado_por,

        created_at,
        updated_at,

        revisoes_proposta (
          *,
          itens_revisao (*)
        )
      `)
      .eq(
        'id',
        propostaId
      )
      .single();


  if (error) {

    throw error;

  }


  return data;
}