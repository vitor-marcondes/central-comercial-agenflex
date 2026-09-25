// Consultas paginadas da 024. Nenhum teto total nem soma de itens truncados.
// Sem fallback silencioso: banco sem 024 precisa ser atualizado antes desta V1.
async function carregarPaginasPainel(rpc) {
  const usuario = usuarioLocalAtual;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const registros = [];
    const ids = new Set();
    let cursor = null;
    let versao = null;
    let mudou = false;
    do {
      const { data, error } = await getSupabaseClient().rpc(rpc, { p_apos: cursor });
      if (error) throw error;
      if (usuario !== usuarioLocalAtual || !usuario) throw new Error('A sessão foi alterada.');
      if (!data || !Array.isArray(data.registros) || !data.versao) throw new Error('Resposta inválida ao carregar o painel.');
      if (versao && versao !== data.versao) { mudou = true; break; }
      versao = data.versao;
      for (const registro of data.registros) {
        const id = registro.proposta_id || registro.id;
        if (!id || ids.has(id)) throw new Error('Registro duplicado ou inválido na paginação.');
        ids.add(id);
        registros.push(registro);
      }
      const proximo = data.proximo || null;
      if (proximo && (proximo === cursor || !data.registros.length)) throw new Error('A paginação não avançou.');
      cursor = proximo;
    } while (cursor);
    if (!mudou) return registros;
  }
  throw new Error('Os dados mudaram durante a consulta. Atualize o painel novamente.');
}

async function listarDadosPainelGestao() {
  return carregarPaginasPainel('consultar_carteira_painel');
}

async function listarResultadosHistoricos() {
  return carregarPaginasPainel('consultar_resultados_historicos');
}
