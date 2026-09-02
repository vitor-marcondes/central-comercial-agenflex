// Central Comercial Agenflex — serviço de propostas
// Comunicação entre o frontend e o PostgreSQL/Supabase.

async function criarPropostaR0(revisao, itens) {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('criar_proposta_r0', {
    p_revisao: revisao,
    p_itens: itens
  });

  if (error) throw error;
  return data;
}

async function salvarRascunhoProposta(propostaId, revisaoId, revisao, itens) {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('salvar_rascunho_proposta', {
    p_proposta_id: propostaId,
    p_revisao_id: revisaoId,
    p_revisao: revisao,
    p_itens: itens
  });

  if (error) throw error;
  return data;
}

// Lista propostas que o RLS permite ao usuário atual.
// ADM: todas. Vendedor: apenas as próprias.
async function listarPropostas({ limite = 200 } = {}) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('propostas')
    .select(`
      id,
      numero,
      revisao_atual,
      criado_por,
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
        updated_at
      )
    `)
    .order('updated_at', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data ?? [];
}

// Carrega uma proposta completa com todas as revisões e itens.
// O frontend escolhe a revisão atual pelo campo propostas.revisao_atual.
async function obterPropostaCompleta(propostaId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('propostas')
    .select(`
      id,
      numero,
      revisao_atual,
      criado_por,
      origem_proposta_id,
      created_at,
      updated_at,
      revisoes_proposta (
        *,
        itens_revisao (*)
      )
    `)
    .eq('id', propostaId)
    .single();

  if (error) throw error;
  return data;
}
