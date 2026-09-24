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

let authVersao = 0;
let authEncerrando = false;
let authRecuperacao = false;

const MENSAGEM_ACESSO_PENDENTE =
  'Seu acesso está aguardando aprovação, foi desativado ou ainda não possui perfil. Procure o gestor ou administrador.';

function invalidarInterfaceSessao(mensagem) {
  authVersao++;
  authEncerrando = true;
  mostrarTelaLogin();
  limparRascunhoLocalAoSair();
  usuarioLocalAtual = null;
  try {
    sessionStorage.setItem('agenflex_aviso_sessao', mensagem);
  } catch (erro) {
    console.warn('Não foi possível guardar o aviso de sessão.', erro);
  }
  // Descarta também formulário, artes, caches e requisições da sessão anterior.
  window.location.reload();
}

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

  if (authEncerrando || authRecuperacao) return;
  if (usuarioLocalAtual && usuarioLocalAtual !== perfil.user_id) {
    invalidarInterfaceSessao('A conta foi alterada. Entre novamente se necessário.');
    return;
  }
  if (!usuarioLocalAtual) {
    // Descarta somente as chaves legadas, sem importar dados de dono desconhecido.
    limparDadosLocaisUsuario();
    usuarioLocalAtual = perfil.user_id;
    loadDraft();
    renderSellers();
    renderItems();
    refresh();
  }

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
  if (authEncerrando || authRecuperacao) return;
  const versao = ++authVersao;
  try {
    const user = await usuarioAtual();
    if (versao !== authVersao || authRecuperacao) return;
    if (!user) {
      if (usuarioLocalAtual) {
        invalidarInterfaceSessao('Sua sessão terminou. Entre novamente.');
      } else {
        mostrarTelaLogin();
      }
      return;
    }
    const perfil = await perfilAtual();
    if (versao !== authVersao || authRecuperacao) return;
    if (!perfil || !perfil.ativo) {
      if (usuarioLocalAtual) {
        invalidarInterfaceSessao(MENSAGEM_ACESSO_PENDENTE);
      } else {
        await logoutCentral();
        mostrarTelaLogin();
        mensagemLogin(MENSAGEM_ACESSO_PENDENTE, 'error');
      }
      return;
    }
    mostrarCentral(perfil);
  } catch (erro) {
    if (versao !== authVersao || authRecuperacao) return;
    console.error('Erro ao validar usuário:', erro);
    if (usuarioLocalAtual && (
      erro?.name === 'AuthSessionMissingError' ||
      erro?.status === 401 || erro?.status === 403
    )) {
      invalidarInterfaceSessao('Sua sessão terminou. Entre novamente.');
      return;
    }
    // Uma falha de rede não deve apagar o rascunho nem simular logout.
    if (!usuarioLocalAtual) {
      mostrarTelaLogin();
      mensagemLogin('Não foi possível validar o acesso. Verifique a conexão e tente novamente.', 'error');
    }
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
  if (authEncerrando || authRecuperacao) return;
  const versao = ++authVersao;


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


    if (versao !== authVersao || authRecuperacao) return;

    if (!perfil || !perfil.ativo) {
      await logoutCentral();
      throw new Error(MENSAGEM_ACESSO_PENDENTE);
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

    if (authEncerrando || authRecuperacao) return;
    let mensagem = erro.message === MENSAGEM_ACESSO_PENDENTE
      ? MENSAGEM_ACESSO_PENDENTE
      : 'Não foi possível realizar o login.';


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
  limparDadosLocaisUsuario();
}


// =========================================================
// ## 7. LOGOUT
// =========================================================

async function sairDaCentral() {
  const usuarioAnterior = usuarioLocalAtual;
  authVersao++;
  authEncerrando = true;
  mostrarTelaLogin();
  limparRascunhoLocalAoSair();
  usuarioLocalAtual = null;
  try {
    await logoutCentral();
    window.location.reload();
  } catch (erro) {
    console.error('Erro ao sair:', erro);
    // Não recarregar e autenticar silenciosamente de novo quando o logout falhar.
    authEncerrando = false;
    usuarioLocalAtual = usuarioAnterior;
    await validarUsuarioLogado();
    mensagemLogin('Não foi possível sair. Verifique a conexão e tente novamente.', 'error');
    toastMsg('Não foi possível sair. Tente novamente.');
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

  try {
    const aviso = sessionStorage.getItem('agenflex_aviso_sessao');
    sessionStorage.removeItem('agenflex_aviso_sessao');
    if (aviso) mensagemLogin(aviso, 'error');
  } catch (erro) {
    console.warn('Não foi possível ler o aviso de sessão.', erro);
  }

  try {
    getSupabaseClient().auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY') {
        authRecuperacao = true;
        authVersao++;
        mostrarTelaLogin();
        return;
      }
      if (evento === 'SIGNED_OUT') {
        authVersao++;
        if (usuarioLocalAtual && !authEncerrando) {
          invalidarInterfaceSessao('Sua sessão terminou. Entre novamente.');
        }
        return;
      }
      if (usuarioLocalAtual && sessao?.user?.id &&
          usuarioLocalAtual !== sessao.user.id && !authEncerrando) {
        invalidarInterfaceSessao('A conta foi alterada em outra aba.');
      }
    });
  } catch (erro) {
    console.error('Erro ao monitorar a sessão:', erro);
  }

  window.addEventListener('focus', () => {
    if (usuarioLocalAtual) validarUsuarioLogado();
  });
  await validarUsuarioLogado();

}


// =========================================================
// ## 9. INÍCIO DO MÓDULO
// =========================================================

// Inicia automaticamente a autenticação após carregar os módulos.

// Aguarda core e módulos antes de restaurar dados do usuário.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarInterfaceAuth);
} else {
  iniciarInterfaceAuth();
}
