// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: usuarios.service.js
//
// Responsabilidade:
// - Cadastro de novas contas
// - Consulta de perfis da equipe
// - Aprovação / bloqueio de vendedores
// - Alteração de tipo de acesso pelo ADM
// - Definição do Time comercial do vendedor
// - Consulta e manutenção de metas individuais
// - Consulta e manutenção de metas oficiais dos Times
// - Transferência auditada de propostas entre vendedores
//
// Dependência:
// - js/services/supabase-client.js
// =========================================================


// =========================================================
// ## 1. CADASTRO DE CONTA
// =========================================================

async function cadastrarConta({
  nome,
  email,
  senha
}) {

  const client =
    getSupabaseClient();


  const nomeLimpo =
    String(
      nome || ''
    )
      .trim();


  const emailLimpo =
    String(
      email || ''
    )
      .trim()
      .toLowerCase();


  if (!nomeLimpo) {

    throw new Error(
      'Informe o nome completo.'
    );

  }


  if (!emailLimpo) {

    throw new Error(
      'Informe o e-mail.'
    );

  }


  if (
    !senha ||
    senha.length < 8
  ) {

    throw new Error(
      'A senha precisa ter pelo menos 8 caracteres.'
    );

  }


  const {
    data,
    error
  } =
    await client.auth.signUp({

      email:
        emailLimpo,

      password:
        senha,

      options: {

        data: {

          nome:
            nomeLimpo

        }

      }

    });


  if (error) {

    throw error;

  }


  if (
    data?.session
  ) {

    await client.auth.signOut();

  }


  return {

    user:
      data?.user || null,

    precisaConfirmarEmail:
      !data?.session

  };
}


// =========================================================
// ## 2. PERFIL DO USUÁRIO LOGADO
// =========================================================

async function obterMeuPerfil() {

  const client =
    getSupabaseClient();


  const {
    data: authData,
    error: authError
  } =
    await client.auth.getUser();


  if (authError) {

    throw authError;

  }


  const user =
    authData?.user;


  if (!user) {

    return null;

  }


  const {
    data,
    error
  } =
    await client
      .from(
        'perfis'
      )
      .select(`
        user_id,
        nome,
        email,
        tipo_acesso,
        ativo,
        time_equipe,
        created_at,
        updated_at
      `)
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  return data || null;
}


// =========================================================
// ## 3. PERFIS DA EQUIPE
// =========================================================

async function listarPerfisEquipe() {

  const client =
    getSupabaseClient();


  const {
    data,
    error
  } =
    await client
      .from(
        'perfis'
      )
      .select(`
        user_id,
        nome,
        email,
        tipo_acesso,
        ativo,
        time_equipe,
        created_at,
        updated_at
      `)
      .order(
        'nome',
        {
          ascending: true
        }
      );


  if (error) {

    throw error;

  }


  return data || [];
}


// =========================================================
// ## 4. APROVAR / BLOQUEAR VENDEDOR
// =========================================================

async function definirAcessoVendedor(
  userId,
  ativo
) {

  const client =
    getSupabaseClient();


  const {
    data,
    error
  } =
    await client.rpc(
      'definir_acesso_vendedor',
      {

        p_user_id:
          userId,

        p_ativo:
          Boolean(
            ativo
          )

      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 5. ALTERAR TIPO DE ACESSO
// =========================================================

async function definirTipoAcesso(
  userId,
  tipoAcesso
) {

  const client =
    getSupabaseClient();


  const tipoNormalizado =
    String(
      tipoAcesso || ''
    )
      .trim()
      .toLowerCase();


  if (
    ![
      'vendedor',
      'gestor',
      'adm'
    ].includes(
      tipoNormalizado
    )
  ) {

    throw new Error(
      'Tipo de acesso inválido.'
    );

  }


  const {
    data,
    error
  } =
    await client.rpc(
      'definir_tipo_acesso',
      {

        p_user_id:
          userId,

        p_tipo_acesso:
          tipoNormalizado

      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 6. DEFINIR TIME DO VENDEDOR
// =========================================================

async function definirTimeVendedor(
  userId,
  timeEquipe
) {

  const client =
    getSupabaseClient();


  const timeNormalizado =
    String(
      timeEquipe || ''
    )
      .trim()
      .toLowerCase();


  if (
    ![
      'pharma',
      'food',
      'revenda'
    ].includes(
      timeNormalizado
    )
  ) {

    throw new Error(
      'Selecione um Time válido.'
    );

  }


  const {
    data,
    error
  } =
    await client.rpc(
      'definir_time_vendedor',
      {

        p_user_id:
          userId,

        p_time_equipe:
          timeNormalizado

      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 7. LISTAR METAS INDIVIDUAIS
// =========================================================

async function listarMetasVendedor({
  ano = null,
  mes = null
} = {}) {

  const client =
    getSupabaseClient();


  let query =
    client
      .from(
        'metas_vendedor'
      )
      .select(`
        id,
        user_id,
        ano,
        mes,
        meta_valor,
        criado_por,
        atualizado_por,
        created_at,
        updated_at
      `)
      .order(
        'ano',
        {
          ascending: false
        }
      )
      .order(
        'mes',
        {
          ascending: false
        }
      );


  if (
    Number.isInteger(
      Number(
        ano
      )
    ) &&
    Number(
      ano
    ) > 0
  ) {

    query =
      query.eq(
        'ano',
        Number(
          ano
        )
      );

  }


  if (
    Number.isInteger(
      Number(
        mes
      )
    ) &&
    Number(
      mes
    ) >= 1 &&
    Number(
      mes
    ) <= 12
  ) {

    query =
      query.eq(
        'mes',
        Number(
          mes
        )
      );

  }


  const {
    data,
    error
  } =
    await query;


  if (error) {

    throw error;

  }


  return data || [];
}


// =========================================================
// ## 8. SALVAR META INDIVIDUAL
// =========================================================

async function salvarMetaVendedor({
  userId,
  ano,
  mes,
  metaValor
}) {

  const client =
    getSupabaseClient();


  const valor =
    Number(
      metaValor
    );


  if (
    !Number.isFinite(
      valor
    ) ||
    valor < 0
  ) {

    throw new Error(
      'Informe uma meta individual válida.'
    );

  }


  const {
    data,
    error
  } =
    await client.rpc(
      'salvar_meta_vendedor',
      {

        p_user_id:
          userId,

        p_ano:
          Number(
            ano
          ),

        p_mes:
          Number(
            mes
          ),

        p_meta_valor:
          valor

      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 9. LISTAR METAS OFICIAIS DOS TIMES
// =========================================================

async function listarMetasOficiaisEquipe({
  ano = null,
  mes = null,
  timeEquipe = null
} = {}) {

  const client =
    getSupabaseClient();


  let query =
    client
      .from(
        'metas_equipe'
      )
      .select(`
        id,
        time_equipe,
        ano,
        mes,
        meta_valor,
        criado_por,
        atualizado_por,
        created_at,
        updated_at
      `)
      .order(
        'ano',
        {
          ascending: false
        }
      )
      .order(
        'mes',
        {
          ascending: false
        }
      );


  if (
    Number.isInteger(
      Number(
        ano
      )
    ) &&
    Number(
      ano
    ) > 0
  ) {

    query =
      query.eq(
        'ano',
        Number(
          ano
        )
      );

  }


  if (
    Number.isInteger(
      Number(
        mes
      )
    ) &&
    Number(
      mes
    ) >= 1 &&
    Number(
      mes
    ) <= 12
  ) {

    query =
      query.eq(
        'mes',
        Number(
          mes
        )
      );

  }


  const timeNormalizado =
    String(
      timeEquipe || ''
    )
      .trim()
      .toLowerCase();


  if (
    [
      'pharma',
      'food',
      'revenda'
    ].includes(
      timeNormalizado
    )
  ) {

    query =
      query.eq(
        'time_equipe',
        timeNormalizado
      );

  }


  const {
    data,
    error
  } =
    await query;


  if (error) {

    throw error;

  }


  return data || [];
}


// =========================================================
// ## 10. SALVAR META OFICIAL DO TIME
// =========================================================

async function salvarMetaOficialEquipe({
  timeEquipe,
  ano,
  mes,
  metaValor
}) {

  const client =
    getSupabaseClient();


  const timeNormalizado =
    String(
      timeEquipe || ''
    )
      .trim()
      .toLowerCase();


  if (
    ![
      'pharma',
      'food',
      'revenda'
    ].includes(
      timeNormalizado
    )
  ) {

    throw new Error(
      'Selecione um Time válido.'
    );

  }


  const valor =
    Number(
      metaValor
    );


  if (
    !Number.isFinite(
      valor
    ) ||
    valor < 0
  ) {

    throw new Error(
      'Informe uma meta oficial válida.'
    );

  }


  const {
    data,
    error
  } =
    await client.rpc(
      'salvar_meta_equipe',
      {

        p_time_equipe:
          timeNormalizado,

        p_ano:
          Number(
            ano
          ),

        p_mes:
          Number(
            mes
          ),

        p_meta_valor:
          valor

      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 11. TRANSFERIR PROPOSTA
// =========================================================

async function transferirProposta({
  propostaId,
  vendedorNovoId,
  motivo
}) {

  const client =
    getSupabaseClient();


  const propostaIdLimpo =
    String(
      propostaId || ''
    ).trim();


  const vendedorNovoIdLimpo =
    String(
      vendedorNovoId || ''
    ).trim();


  const motivoLimpo =
    String(
      motivo || ''
    ).trim();


  if (!propostaIdLimpo) {

    throw new Error(
      'Proposta não informada.'
    );

  }


  if (!vendedorNovoIdLimpo) {

    throw new Error(
      'Selecione o novo vendedor responsável.'
    );

  }


  if (
    motivoLimpo.length < 5
  ) {

    throw new Error(
      'Informe um motivo com pelo menos 5 caracteres.'
    );

  }


  if (
    motivoLimpo.length > 500
  ) {

    throw new Error(
      'O motivo pode ter no máximo 500 caracteres.'
    );

  }


  const {
    data,
    error
  } =
    await client.rpc(
      'transferir_proposta',
      {

        p_proposta_id:
          propostaIdLimpo,

        p_vendedor_novo_id:
          vendedorNovoIdLimpo,

        p_motivo:
          motivoLimpo

      }
    );


  if (error) {

    throw error;

  }


  return data;
}