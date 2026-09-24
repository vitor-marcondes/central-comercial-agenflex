// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: auth.service.js
//
// Responsabilidade:
// - Realizar login com e-mail e senha
// - Encerrar a sessão do usuário
// - Consultar o usuário autenticado no Supabase Auth
// - Buscar o perfil interno do usuário na tabela "perfis"
//
// Dependências:
// - js/services/supabase-client.js
// - Supabase Auth
// - Tabela public.perfis
//
// Utilizado por:
// - js/ui/auth-ui.js
//
// Observação:
// O Supabase Auth controla a autenticação.
// A tabela "perfis" complementa o usuário com informações
// internas da Central, como nome, tipo de acesso e status.
// =========================================================


// =========================================================
// ## 1. LOGIN COM E-MAIL E SENHA
// =========================================================

async function loginComEmail(email, senha) {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client.auth.signInWithPassword({
      email: email,
      password: senha
    });


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 2. LOGOUT / ENCERRAMENTO DA SESSÃO
// =========================================================

async function logoutCentral() {

  const client =
    getSupabaseClient();


  const { error } =
    await client.auth.signOut();


  if (error) {

    throw error;

  }
}


// =========================================================
// ## 3. USUÁRIO AUTENTICADO
// =========================================================

async function usuarioAtual() {

  const client =
    getSupabaseClient();


  const { data, error } =
    await client.auth.getUser();


  if (error) {

    throw error;

  }


  return data.user ?? null;
}


// =========================================================
// ## 4. PERFIL INTERNO DO USUÁRIO
// =========================================================

async function perfilAtual() {

  const client =
    getSupabaseClient();


  const user =
    await usuarioAtual();


  if (!user) {

    return null;

  }


  const { data, error } =
    await client
      .from('perfis')
      .select('*')
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  return data;
}