// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: usuarios.service.js
//
// Responsabilidade:
// - Cadastro de novas contas
// - Consulta de perfis da equipe
// - Aprovação / bloqueio de vendedores
// - Alteração de tipo de acesso pelo ADM
// - Consulta e manutenção de metas
// - Atribuição de vendedor responsável
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
    ).trim();


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


  const { data, error } =
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


  // Se o Supabase iniciar uma sessão automaticamente
  // após o cadastro, encerramos essa sessão.
  //
  // A nova conta nasce como vendedor INATIVO
  // e precisa ser aprovada antes do uso.

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
      .from('perfis')
      .select(`
        user_id,
        nome,
        email,
        tipo_acesso,
        ativo,
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
      .from('perfis')
      .select(`
        user_id,
        nome,
        email,
        tipo_acesso,
        ativo,
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
          Boolean(ativo)
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
          tipoAcesso
      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 6. LISTAR METAS
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
      Number(ano)
    ) &&
    Number(ano) > 0
  ) {

    query =
      query.eq(
        'ano',
        Number(ano)
      );

  }


  if (
    Number.isInteger(
      Number(mes)
    ) &&
    Number(mes) >= 1 &&
    Number(mes) <= 12
  ) {

    query =
      query.eq(
        'mes',
        Number(mes)
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
// ## 7. SALVAR META
// =========================================================

async function salvarMetaVendedor({
  userId,
  ano,
  mes,
  metaValor
}) {

  const client =
    getSupabaseClient();


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
          Number(ano),

        p_mes:
          Number(mes),

        p_meta_valor:
          Number(metaValor)
      }
    );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 8. DEFINIR VENDEDOR RESPONSÁVEL
// =========================================================

async function definirVendedorResponsavel(
  propostaId,
  vendedorId
) {

  const client =
    getSupabaseClient();


  const {
    data,
    error
  } =
    await client.rpc(
      'definir_vendedor_responsavel',
      {
        p_proposta_id:
          propostaId,

        p_vendedor_id:
          vendedorId
      }
    );


  if (error) {

    throw error;

  }


  return data;
}