// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: painel.service.js
//
// Responsabilidade:
// - Buscar os dados necessários ao Painel Comercial
// - Trazer vendedor responsável
// - Trazer Time registrado na revisão
// - Trazer data da atualização comercial
// - Trazer somente os dados permitidos pelo RLS
// =========================================================


// =========================================================
// ## 1. LISTAR DADOS DO PAINEL
// =========================================================

async function listarDadosPainelGestao({
  limite = 500
} = {}) {

  const client =
    getSupabaseClient();


  const {
    data,
    error
  } =
    await client
      .from(
        'propostas'
      )
      .select(`
        id,
        numero,
        revisao_atual,

        criado_por,
        vendedor_responsavel_id,

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

          time_equipe,

          data_proposta,

          status,
          enviado_em,

          itens_revisao (
            quantidade,
            valor_unitario,
            desconto_percentual,
            ipi_percentual,
            valor_total
          )
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