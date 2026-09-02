// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Interface de autenticação
// =========================================================

function mensagemLogin(texto = '', tipo = '') {
  const el = document.getElementById('loginMessage');

  el.textContent = texto;
  el.className = 'login-message';

  if (tipo) {
    el.classList.add(tipo);
  }
}


function mostrarTelaLogin() {
  document.body.classList.add('auth-pending');

  document.getElementById('loginScreen').hidden = false;
}


function mostrarCentral(perfil) {
  document.getElementById('loginScreen').hidden = true;

  document.body.classList.remove('auth-pending');

  document.getElementById('authUserName').textContent =
    perfil.nome || 'Usuário';

  document.getElementById('authUserRole').textContent =
    perfil.tipo_acesso === 'adm'
      ? 'Administrador'
      : 'Vendedor';

  // O vendedor da proposta já pode começar preenchido
  // com o usuário autenticado.
  const campoVendedor = document.getElementById('vendedor');

  if (campoVendedor && !campoVendedor.value) {
    campoVendedor.value = perfil.nome || '';
  }
}


async function validarUsuarioLogado() {
  try {

    const user = await usuarioAtual();

    if (!user) {
      mostrarTelaLogin();
      return;
    }

    const perfil = await perfilAtual();

    if (!perfil) {
      await logoutCentral();
      mostrarTelaLogin();
      mensagemLogin(
        'Seu usuário não possui perfil cadastrado.',
        'error'
      );
      return;
    }

    if (!perfil.ativo) {
      await logoutCentral();
      mostrarTelaLogin();
      mensagemLogin(
        'Usuário desativado. Procure o administrador.',
        'error'
      );
      return;
    }

    mostrarCentral(perfil);

  } catch (erro) {

    console.error('Erro ao validar usuário:', erro);

    mostrarTelaLogin();

    mensagemLogin(
      'Não foi possível validar o usuário.',
      'error'
    );
  }
}


async function realizarLogin(event) {

  event.preventDefault();

  const email =
    document.getElementById('loginEmail').value.trim();

  const senha =
    document.getElementById('loginSenha').value;

  const botao =
    document.getElementById('loginButton');

  mensagemLogin('');

  botao.disabled = true;
  botao.textContent = 'Entrando...';

  try {

    await loginComEmail(email, senha);

    const perfil = await perfilAtual();

    if (!perfil) {
      await logoutCentral();

      throw new Error(
        'Usuário sem perfil cadastrado.'
      );
    }

    if (!perfil.ativo) {
      await logoutCentral();

      throw new Error(
        'Usuário desativado.'
      );
    }

    mensagemLogin(
      'Login realizado com sucesso.',
      'success'
    );

    mostrarCentral(perfil);

  } catch (erro) {

    console.error('Erro no login:', erro);

    let mensagem =
      'Não foi possível realizar o login.';

    if (
      erro.message &&
      erro.message.toLowerCase().includes('invalid login')
    ) {
      mensagem = 'E-mail ou senha inválidos.';
    }

    if (
      erro.message &&
      erro.message.includes('sem perfil')
    ) {
      mensagem =
        'Usuário sem perfil cadastrado.';
    }

    if (
      erro.message &&
      erro.message.includes('desativado')
    ) {
      mensagem =
        'Usuário desativado. Procure o administrador.';
    }

    mensagemLogin(mensagem, 'error');

  } finally {

    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
}


async function sairDaCentral() {

  try {

    await logoutCentral();

  } catch (erro) {

    console.error('Erro ao sair:', erro);

  } finally {

    window.location.reload();
  }
}


async function iniciarInterfaceAuth() {

  document
    .getElementById('loginForm')
    .addEventListener(
      'submit',
      realizarLogin
    );

  await validarUsuarioLogado();
}


iniciarInterfaceAuth();