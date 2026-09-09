// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: auth-ui.js
//
// Responsabilidade:
// - Controlar a tela de login
// - Validar a sessão atual ao abrir a Central
// - Exibir usuário e tipo de acesso na interface
// - Executar login e logout
// - Mostrar mensagens de autenticação
//
// Dependências:
// - js/services/auth.service.js
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
// ## 2. CONTROLE DAS TELAS DE AUTENTICAÇÃO
// =========================================================


// ---------------------------------------------------------
// ## 2.1 Mostrar tela de login
// ---------------------------------------------------------

function mostrarTelaLogin() {

  document.body.classList.add(
    'auth-pending'
  );


  document
    .getElementById(
      'loginScreen'
    )
    .hidden =
      false;
}


// ---------------------------------------------------------
// ## 2.2 Mostrar a Central após autenticação
// ---------------------------------------------------------

function mostrarCentral(
  perfil
) {

  document
    .getElementById(
      'loginScreen'
    )
    .hidden =
      true;


  document.body.classList.remove(
    'auth-pending'
  );


  // -------------------------------------------------------
  // ## 2.2.1 Nome do usuário
  // -------------------------------------------------------

  document
    .getElementById(
      'authUserName'
    )
    .textContent =
      perfil.nome ||
      'Usuário';


  // -------------------------------------------------------
  // ## 2.2.2 Tipo de acesso
  // -------------------------------------------------------

  document
    .getElementById(
      'authUserRole'
    )
    .textContent =

      perfil.tipo_acesso === 'adm'

        ? 'Administrador'

        : 'Vendedor';


  // -------------------------------------------------------
  // ## 2.2.3 Preenchimento inicial do vendedor
  // -------------------------------------------------------

  // O campo "Vendedor" pode começar preenchido
  // automaticamente com o usuário autenticado.

  const campoVendedor =
    document.getElementById(
      'vendedor'
    );


  if (
    campoVendedor &&
    !campoVendedor.value
  ) {

    campoVendedor.value =
      perfil.nome ||
      '';

  }
}


// =========================================================
// ## 3. VALIDAÇÃO DA SESSÃO ATUAL
// =========================================================

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

async function validarUsuarioLogado() {

  try {

    // -----------------------------------------------------
    // ## 3.1 Verificar usuário no Supabase Auth
    // -----------------------------------------------------

    const user =
      await usuarioAtual();


    if (!user) {

      mostrarTelaLogin();

      return;
    }


    // -----------------------------------------------------
    // ## 3.2 Buscar perfil interno
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
    // ## 3.3 Verificar se o usuário está ativo
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
    // ## 3.4 Liberar acesso à Central
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
// ## 4. LOGIN
// =========================================================

async function realizarLogin(
  event
) {

  // Evita o envio tradicional do formulário,
  // que recarregaria a página.
  event.preventDefault();


  // -------------------------------------------------------
  // ## 4.1 Leitura dos campos
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
  // ## 4.2 Estado visual durante o login
  // -------------------------------------------------------

  botao.disabled =
    true;


  botao.textContent =
    'Entrando...';


  // -------------------------------------------------------
  // ## 4.3 Autenticação e validação do perfil
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
    // ## 4.4 Tratamento das mensagens de erro
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
    // ## 4.5 Restaurar botão
    // -----------------------------------------------------

    botao.disabled =
      false;


    botao.textContent =
      'Entrar';

  }
}


// =========================================================
// ## 5. LOGOUT
// =========================================================

async function sairDaCentral() {

  try {

    await logoutCentral();

  } catch (erro) {

    console.error(
      'Erro ao sair:',
      erro
    );

  } finally {

    // Recarrega a aplicação para voltar ao estado inicial.
    window.location.reload();

  }
}


// =========================================================
// ## 6. INICIALIZAÇÃO DA INTERFACE DE AUTENTICAÇÃO
// =========================================================

async function iniciarInterfaceAuth() {

  // -------------------------------------------------------
  // ## 6.1 Evento do formulário de login
  // -------------------------------------------------------

  document
    .getElementById(
      'loginForm'
    )
    .addEventListener(
      'submit',
      realizarLogin
    );


  // -------------------------------------------------------
  // ## 6.2 Verificação inicial da sessão
  // -------------------------------------------------------

  await validarUsuarioLogado();
}


// =========================================================
// ## 7. INÍCIO DO MÓDULO
// =========================================================

// Inicia automaticamente a autenticação
// quando este arquivo é carregado.

iniciarInterfaceAuth();