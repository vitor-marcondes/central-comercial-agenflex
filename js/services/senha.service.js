// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: senha.service.js
//
// Responsabilidade:
// - Solicitar redefinição de senha por e-mail
// - Atualizar a senha durante uma sessão de recuperação
//
// Segurança:
// - Nunca consulta ou exibe senha existente
// - Usa o fluxo oficial do Supabase Auth
// =========================================================


// =========================================================
// ## 1. URL DE RETORNO
// =========================================================

function obterUrlRetornoSenha() {

  return (
    window.location.origin +
    window.location.pathname
  );
}


// =========================================================
// ## 2. SOLICITAR REDEFINIÇÃO
// =========================================================

async function solicitarRedefinicaoSenha(
  email
) {

  const client =
    getSupabaseClient();


  const emailLimpo =
    String(
      email || ''
    )
      .trim()
      .toLowerCase();


  if (!emailLimpo) {

    throw new Error(
      'Informe o e-mail.'
    );

  }


  const {
    data,
    error
  } =
    await client.auth
      .resetPasswordForEmail(
        emailLimpo,
        {
          redirectTo:
            obterUrlRetornoSenha()
        }
      );


  if (error) {

    throw error;

  }


  return data;
}


// =========================================================
// ## 3. DEFINIR NOVA SENHA
// =========================================================

async function atualizarSenhaRecuperacao(
  novaSenha
) {

  const client =
    getSupabaseClient();


  if (
    !novaSenha ||
    novaSenha.length < 8
  ) {

    throw new Error(
      'A nova senha precisa ter pelo menos 8 caracteres.'
    );

  }


  const {
    data,
    error
  } =
    await client.auth.updateUser({
      password:
        novaSenha
  });


  if (error) {

    throw error;

  }


  return data;
}
