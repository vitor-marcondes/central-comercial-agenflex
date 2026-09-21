// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: auth-ui.js
//
// Responsabilidade:
// - Controlar a tela de login
// - Validar a sessão atual ao abrir a Central
// - Exibir usuário e tipo de acesso na interface
// - Executar login e logout
// - Limpar rascunho local ao sair
// - Mostrar mensagens de autenticação
//
// Dependências:
// - js/services/auth.service.js
// - js/core/core.js
// - Elementos de autenticação presentes no index.html
//
// Separação de responsabilidades:
//
// auth-ui.js
// → controla a interface
//
// auth.service.js
// → conversa com o Supabase Auth e tabela "perfis"
//
// supabase-client.js
// → fornece a conexão com o Supabase
// =========================================================


// =========================================================
// ## 1. MENSAGENS DA TELA DE LOGIN
// =========================================================

function mensagemLogin(
  texto = '',
  tipo = ''
) {

  const elemento =
    document.getElementById(
      'loginMessage'
    );


  if (!elemento) {

    return;

  }


  elemento.textContent =
    texto;


  elemento.className =
    'login-message';


  if (tipo) {

    elemento.classList.add(
      tipo
    );

  }

}


// =========================================================
// ## 2. NOMES DOS PERFIS
// =========================================================

function nomePerfilAuth(
  tipoAcesso
) {

  const tipo =
    String(
      tipoAcesso || ''
    )
      .trim()
      .toLowerCase();


  const nomes = {

    vendedor:
      'Vendedor',

    gestor:
      'Gestor',

    diretor:
      'Diretor',

    adm:
      'Administrador'

  };


  return nomes[tipo] ||
    'Usuário';

}


// =========================================================
// ## 3. CONTROLE DAS TELAS DE AUTENTICAÇÃO
// =========================================================


// ---------------------------------------------------------
// ## 3.1 Mostrar tela de login
// ---------------------------------------------------------

function mostrarTelaLogin() {

  document.body.classList.add(
    'auth-pending'
  );


  const tela =
    document.getElementById(
      'loginScreen'
    );


  if (tela) {

    tela.hidden =
      false;

  }

}


// ---------------------------------------------------------
// ## 3.2 Mostrar a Central após autenticação
// ---------------------------------------------------------

function mostrarCentral(
  perfil
) {

  const telaLogin =
    document.getElementById(
      'loginScreen'
    );


  if (telaLogin) {

    telaLogin.hidden =
      true;

  }


  document.body.classList.remove(
    'auth-pending'
  );


  // -------------------------------------------------------
  // ## 3.2.1 Nome do usuário
  // -------------------------------------------------------

  const nomeUsuario =
    document.getElementById(
      'authUserName'
    );


  if (nomeUsuario) {

    nomeUsuario.textContent =
      perfil.nome ||
      'Usuário';

  }


  // -------------------------------------------------------
  // ## 3.2.2 Tipo de acesso
  // -------------------------------------------------------

  const tipoUsuario =
    document.getElementById(
      'authUserRole'
    );


  if (tipoUsuario) {

    tipoUsuario.textContent =
      nomePerfilAuth(
        perfil.tipo_acesso
      );

  }


  // -------------------------------------------------------
  // ## 3.2.3 Preenchimento inicial do vendedor
  // -------------------------------------------------------
  //
  // Vendedor:
  // → pode trabalhar nas próprias propostas.
  //
  // Gestor:
  // → pode trabalhar nas próprias propostas.
  //
  // ADM:
  // → possui acesso total e pode operar quando necessário.
  //
  // Diretor:
  // → possui visão executiva e não opera propostas.
  // -------------------------------------------------------

  const tipo =
    String(
      perfil.tipo_acesso || ''
    )
      .trim()
      .toLowerCase();


  const campoVendedor =
    document.getElementById(
      'vendedor'
    );


  if (
    campoVendedor &&
    !campoVendedor.value &&
    [
      'vendedor',
      'gestor',
      'adm'
    ].includes(
      tipo
    )
  ) {

    campoVendedor.value =
      perfil.nome ||
      '';

  }

}


// =========================================================
// ## 4. VALIDAÇÃO DA SESSÃO ATUAL
// =========================================================
//
// Executada ao abrir a Central.
//
// Fluxo:
//
// existe usuário autenticado?
//
// NÃO
// → mostra login
//
// SIM
// → busca perfil
// → verifica se está ativo
// → libera a Central
// =========================================================

async function validarUsuarioLogado() {

  try {

    // -----------------------------------------------------
    // ## 4.1 Verificar usuário no Supabase Auth
    // -----------------------------------------------------

    const user =
      await usuarioAtual();


    if (!user) {

      mostrarTelaLogin();

      return;

    }


    // -----------------------------------------------------
    // ## 4.2 Buscar perfil interno
    // -----------------------------------------------------

    const perfil =
      await perfilAtual();


    if (!perfil) {

      await logoutCentral();


      mostrarTelaLogin();


      mensagemLogin(
        'Seu usuário não possui perfil cadastrado.',
        'error'
      );


      return;

    }


    // -----------------------------------------------------
    // ## 4.3 Verificar se o usuário está ativo
    // -----------------------------------------------------

    if (
      !perfil.ativo
    ) {

      await logoutCentral();


      mostrarTelaLogin();


      mensagemLogin(
        'Usuário desativado. Procure o administrador.',
        'error'
      );


      return;

    }


    // -----------------------------------------------------
    // ## 4.4 Liberar acesso à Central
    // -----------------------------------------------------

    mostrarCentral(
      perfil
    );


  } catch (erro) {

    console.error(
      'Erro ao validar usuário:',
      erro
    );


    mostrarTelaLogin();


    mensagemLogin(
      'Não foi possível validar o usuário.',
      'error'
    );

  }

}


// =========================================================
// ## 5. LOGIN
// =========================================================

async function realizarLogin(
  event
) {

  // Evita o envio tradicional do formulário,
  // que recarregaria a página.

  event.preventDefault();


  // -------------------------------------------------------
  // ## 5.1 Leitura dos campos
  // -------------------------------------------------------

  const email =
    document
      .getElementById(
        'loginEmail'
      )
      .value
      .trim();


  const senha =
    document
      .getElementById(
        'loginSenha'
      )
      .value;


  const botao =
    document.getElementById(
      'loginButton'
    );


  mensagemLogin(
    ''
  );


  // -------------------------------------------------------
  // ## 5.2 Estado visual durante o login
  // -------------------------------------------------------

  if (botao) {

    botao.disabled =
      true;


    botao.textContent =
      'Entrando...';

  }


  // -------------------------------------------------------
  // ## 5.3 Autenticação e validação do perfil
  // -------------------------------------------------------

  try {

    await loginComEmail(
      email,
      senha
    );


    const perfil =
      await perfilAtual();


    if (!perfil) {

      await logoutCentral();


      throw new Error(
        'Usuário sem perfil cadastrado.'
      );

    }


    if (
      !perfil.ativo
    ) {

      await logoutCentral();


      throw new Error(
        'Usuário desativado.'
      );

    }


    mensagemLogin(
      'Login realizado com sucesso.',
      'success'
    );


    mostrarCentral(
      perfil
    );


  } catch (erro) {

    console.error(
      'Erro no login:',
      erro
    );


    // -----------------------------------------------------
    // ## 5.4 Tratamento das mensagens de erro
    // -----------------------------------------------------

    let mensagem =
      'Não foi possível realizar o login.';


    if (
      erro.message &&
      erro.message
        .toLowerCase()
        .includes(
          'invalid login'
        )
    ) {

      mensagem =
        'E-mail ou senha inválidos.';

    }


    if (
      erro.message &&
      erro.message.includes(
        'sem perfil'
      )
    ) {

      mensagem =
        'Usuário sem perfil cadastrado.';

    }


    if (
      erro.message &&
      erro.message.includes(
        'desativado'
      )
    ) {

      mensagem =
        'Usuário desativado. Procure o administrador.';

    }


    mensagemLogin(
      mensagem,
      'error'
    );


  } finally {

    // -----------------------------------------------------
    // ## 5.5 Restaurar botão
    // -----------------------------------------------------

    if (botao) {

      botao.disabled =
        false;


      botao.textContent =
        'Entrar';

    }

  }

}


// =========================================================
// ## 6. RASCUNHO LOCAL
// =========================================================


// ---------------------------------------------------------
// ## 6.1 Limpar rascunho ao sair
// ---------------------------------------------------------
//
// Regra definida para a Central:
//
// Ao fazer logout:
// → o rascunho local é apagado.
//
// Propostas salvas continuam disponíveis normalmente
// através do Histórico / Supabase.
// ---------------------------------------------------------

function limparRascunhoLocalAoSair() {

  try {

    if (
      typeof LS_KEY !==
        'undefined' &&
      LS_KEY
    ) {

      localStorage.removeItem(
        LS_KEY
      );

    }

  } catch (erro) {

    console.warn(
      'Não foi possível limpar o rascunho local:',
      erro
    );

  }

}


// =========================================================
// ## 7. LOGOUT
// =========================================================

async function sairDaCentral() {

  try {

    // -----------------------------------------------------
    // ## 7.1 Apagar o rascunho local
    // -----------------------------------------------------

    limparRascunhoLocalAoSair();


    // -----------------------------------------------------
    // ## 7.2 Encerrar sessão
    // -----------------------------------------------------

    await logoutCentral();


  } catch (erro) {

    console.error(
      'Erro ao sair:',
      erro
    );


  } finally {

    // -----------------------------------------------------
    // ## 7.3 Recarregar a aplicação
    // -----------------------------------------------------

    window.location.reload();

  }

}


// =========================================================
// ## 8. INICIALIZAÇÃO DA INTERFACE DE AUTENTICAÇÃO
// =========================================================

async function iniciarInterfaceAuth() {

  // -------------------------------------------------------
  // ## 8.1 Evento do formulário de login
  // -------------------------------------------------------

  const formulario =
    document.getElementById(
      'loginForm'
    );


  if (formulario) {

    formulario.addEventListener(
      'submit',
      realizarLogin
    );

  }


  // -------------------------------------------------------
  // ## 8.2 Verificação inicial da sessão
  // -------------------------------------------------------

  await validarUsuarioLogado();

}


// =========================================================
// ## 9. INÍCIO DO MÓDULO
// =========================================================

// Inicia automaticamente a autenticação
// quando este arquivo é carregado.

iniciarInterfaceAuth();