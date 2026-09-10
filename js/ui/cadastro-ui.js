// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: cadastro-ui.js
//
// Responsabilidade:
// - Adicionar a opção "Criar conta" à tela de login
// - Exibir o formulário de cadastro
// - Validar os campos
// - Solicitar criação da conta no Supabase
//
// Regra:
// - Toda nova conta nasce como VENDEDOR INATIVO
// - A liberação depende de Gestor / ADM
//
// Dependência:
// - js/services/usuarios.service.js
// =========================================================


// =========================================================
// ## 1. ESTADO / ELEMENTOS
// =========================================================

function obterElementosCadastro() {

  return {

    loginForm:
      document.getElementById(
        'loginForm'
      ),

    loginMessage:
      document.getElementById(
        'loginMessage'
      ),

    cadastroArea:
      document.getElementById(
        'cadastroContaArea'
      ),

    cadastroActions:
      document.getElementById(
        'cadastroLoginActions'
      ),

    cadastroForm:
      document.getElementById(
        'cadastroContaForm'
      ),

    cadastroMessage:
      document.getElementById(
        'cadastroContaMessage'
      )

  };
}


// =========================================================
// ## 2. MONTAGEM DA INTERFACE
// =========================================================

function montarInterfaceCadastroConta() {

  const loginForm =
    document.getElementById(
      'loginForm'
    );


  if (
    !loginForm ||
    document.getElementById(
      'cadastroContaArea'
    )
  ) {

    return;

  }


  const actions =
    document.createElement(
      'div'
    );


  actions.id =
    'cadastroLoginActions';


  actions.className =
    'cadastro-login-actions';


  actions.innerHTML = `
    <span>
      Não possui conta?
    </span>

    <button
      type="button"
      class="cadastro-link-btn"
      onclick="abrirCadastroConta()"
    >
      Criar conta
    </button>
  `;


  const area =
    document.createElement(
      'div'
    );


  area.id =
    'cadastroContaArea';


  area.className =
    'cadastro-conta-area';


  area.hidden =
    true;


  area.innerHTML = `
    <div class="cadastro-head">

      <h2>
        Criar conta
      </h2>

      <p>
        O cadastro será enviado para aprovação.
      </p>

    </div>


    <form id="cadastroContaForm">

      <div class="field">

        <label for="cadastroNome">
          Nome completo
        </label>

        <input
          id="cadastroNome"
          type="text"
          autocomplete="name"
          required
          placeholder="Seu nome completo"
        >

      </div>


      <div class="field">

        <label for="cadastroEmail">
          E-mail
        </label>

        <input
          id="cadastroEmail"
          type="email"
          autocomplete="email"
          required
          placeholder="seuemail@empresa.com.br"
        >

      </div>


      <div class="field">

        <label for="cadastroSenha">
          Senha
        </label>

        <input
          id="cadastroSenha"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
          placeholder="Mínimo de 8 caracteres"
        >

      </div>


      <div class="field">

        <label for="cadastroConfirmarSenha">
          Confirmar senha
        </label>

        <input
          id="cadastroConfirmarSenha"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
          placeholder="Digite a senha novamente"
        >

      </div>


      <button
        id="cadastroContaButton"
        class="btn red login-button"
        type="submit"
      >
        Solicitar acesso
      </button>


      <button
        class="cadastro-voltar-btn"
        type="button"
        onclick="voltarLoginConta()"
      >
        ← Voltar ao login
      </button>


      <div
        id="cadastroContaMessage"
        class="cadastro-message"
      ></div>

    </form>
  `;


  loginForm.insertAdjacentElement(
    'afterend',
    actions
  );


  actions.insertAdjacentElement(
    'afterend',
    area
  );


  document
    .getElementById(
      'cadastroContaForm'
    )
    ?.addEventListener(
      'submit',
      enviarCadastroConta
    );
}


// =========================================================
// ## 3. ABRIR CADASTRO
// =========================================================

function abrirCadastroConta() {

  const {
    loginForm,
    loginMessage,
    cadastroArea,
    cadastroActions,
    cadastroMessage
  } =
    obterElementosCadastro();


  if (loginForm) {

    loginForm.hidden =
      true;

  }


  if (cadastroActions) {

    cadastroActions.hidden =
      true;

  }


  if (cadastroArea) {

    cadastroArea.hidden =
      false;

  }


  if (loginMessage) {

    loginMessage.textContent =
      '';

  }


  if (cadastroMessage) {

    cadastroMessage.textContent =
      '';

    cadastroMessage.className =
      'cadastro-message';

  }


  document
    .getElementById(
      'cadastroNome'
    )
    ?.focus();
}


// =========================================================
// ## 4. VOLTAR AO LOGIN
// =========================================================

function voltarLoginConta() {

  const {
    loginForm,
    cadastroArea,
    cadastroActions,
    cadastroMessage
  } =
    obterElementosCadastro();


  if (cadastroArea) {

    cadastroArea.hidden =
      true;

  }


  if (cadastroActions) {

    cadastroActions.hidden =
      false;

  }


  if (loginForm) {

    loginForm.hidden =
      false;

  }


  if (cadastroMessage) {

    cadastroMessage.textContent =
      '';

    cadastroMessage.className =
      'cadastro-message';

  }


  document
    .getElementById(
      'loginEmail'
    )
    ?.focus();
}


// =========================================================
// ## 5. MENSAGEM DO CADASTRO
// =========================================================

function mostrarMensagemCadastro(
  mensagem,
  tipo = ''
) {

  const elemento =
    document.getElementById(
      'cadastroContaMessage'
    );


  if (!elemento) {

    return;

  }


  elemento.textContent =
    mensagem;


  elemento.className =
    'cadastro-message';


  if (tipo) {

    elemento.classList.add(
      tipo
    );

  }
}


// =========================================================
// ## 6. TRADUÇÃO BÁSICA DE ERROS
// =========================================================

function mensagemErroCadastro(
  erro
) {

  const mensagem =
    String(
      erro?.message ||
      ''
    ).toLowerCase();


  if (
    mensagem.includes(
      'already registered'
    ) ||
    mensagem.includes(
      'already been registered'
    )
  ) {

    return (
      'Este e-mail já possui cadastro.'
    );

  }


  if (
    mensagem.includes(
      'invalid email'
    )
  ) {

    return (
      'Informe um e-mail válido.'
    );

  }


  if (
    mensagem.includes(
      'password'
    ) &&
    mensagem.includes(
      'characters'
    )
  ) {

    return (
      'A senha não atende aos requisitos mínimos.'
    );

  }


  return (
    erro?.message ||
    'Não foi possível criar a conta.'
  );
}


// =========================================================
// ## 7. ENVIAR CADASTRO
// =========================================================

async function enviarCadastroConta(
  evento
) {

  evento.preventDefault();


  const nome =
    document
      .getElementById(
        'cadastroNome'
      )
      ?.value
      .trim() || '';


  const email =
    document
      .getElementById(
        'cadastroEmail'
      )
      ?.value
      .trim() || '';


  const senha =
    document
      .getElementById(
        'cadastroSenha'
      )
      ?.value || '';


  const confirmarSenha =
    document
      .getElementById(
        'cadastroConfirmarSenha'
      )
      ?.value || '';


  const botao =
    document.getElementById(
      'cadastroContaButton'
    );


  if (!nome) {

    mostrarMensagemCadastro(
      'Informe o nome completo.',
      'erro'
    );

    return;

  }


  if (!email) {

    mostrarMensagemCadastro(
      'Informe o e-mail.',
      'erro'
    );

    return;

  }


  if (
    senha.length < 8
  ) {

    mostrarMensagemCadastro(
      'A senha precisa ter pelo menos 8 caracteres.',
      'erro'
    );

    return;

  }


  if (
    senha !==
    confirmarSenha
  ) {

    mostrarMensagemCadastro(
      'As senhas não são iguais.',
      'erro'
    );

    return;

  }


  const textoOriginal =
    botao?.textContent ||
    'Solicitar acesso';


  if (botao) {

    botao.disabled =
      true;

    botao.textContent =
      'Criando conta...';

  }


  mostrarMensagemCadastro(
    'Enviando cadastro...'
  );


  try {

    const resultado =
      await cadastrarConta({
        nome,
        email,
        senha
      });


    document
      .getElementById(
        'cadastroContaForm'
      )
      ?.reset();


    let mensagem =
      'Cadastro realizado. ' +
      'Agora aguarde a aprovação de um Gestor ou ADM.';


    if (
      resultado
        ?.precisaConfirmarEmail
    ) {

      mensagem +=
        ' Se receber um e-mail de confirmação, confirme o endereço informado.';

    }


    mostrarMensagemCadastro(
      mensagem,
      'sucesso'
    );


  } catch (erro) {

    console.error(
      'Erro ao cadastrar conta:',
      erro
    );


    mostrarMensagemCadastro(
      mensagemErroCadastro(
        erro
      ),
      'erro'
    );


  } finally {

    if (botao) {

      botao.disabled =
        false;

      botao.textContent =
        textoOriginal;

    }

  }
}


// =========================================================
// ## 8. INICIALIZAÇÃO
// =========================================================

function iniciarCadastroConta() {

  montarInterfaceCadastroConta();

}


if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    iniciarCadastroConta
  );

} else {

  iniciarCadastroConta();

}