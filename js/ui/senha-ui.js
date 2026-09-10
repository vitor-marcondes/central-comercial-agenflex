// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: senha-ui.js
//
// Responsabilidade:
// - "Esqueci minha senha" no login
// - Envio de reset pela Gestão da Equipe
// - Detectar PASSWORD_RECOVERY
// - Permitir definição da nova senha
//
// Dependência:
// - js/services/senha.service.js
// =========================================================


// =========================================================
// ## 1. MONTAR "ESQUECI MINHA SENHA"
// =========================================================

function montarEsqueciSenhaLogin() {

  if (
    document.getElementById(
      'senhaLoginAction'
    )
  ) {

    return;

  }


  const botaoEntrar =
    document.getElementById(
      'loginButton'
    );


  if (!botaoEntrar) {

    return;

  }


  const area =
    document.createElement(
      'div'
    );


  area.id =
    'senhaLoginAction';


  area.className =
    'senha-login-action';


  area.innerHTML = `

    <button
      type="button"
      class="senha-link-btn"
      onclick="esqueciMinhaSenha()"
    >
      Esqueci minha senha
    </button>

  `;


  botaoEntrar.insertAdjacentElement(
    'afterend',
    area
  );

}


// =========================================================
// ## 2. REDEFINIR PELO LOGIN
// =========================================================

async function esqueciMinhaSenha() {

  const emailInput =
    document.getElementById(
      'loginEmail'
    );


  const mensagem =
    document.getElementById(
      'loginMessage'
    );


  const email =
    emailInput
      ?.value
      .trim() || '';


  if (!email) {

    if (mensagem) {

      mensagem.textContent =
        'Informe seu e-mail primeiro.';

    }


    emailInput?.focus();

    return;

  }


  if (mensagem) {

    mensagem.textContent =
      'Enviando link de redefinição...';

  }


  try {

    await solicitarRedefinicaoSenha(
      email
    );


    if (mensagem) {

      mensagem.textContent =
        'Link enviado. Verifique seu e-mail para criar uma nova senha.';

    }


  } catch (erro) {

    console.error(
      'Erro ao solicitar redefinição:',
      erro
    );


    if (mensagem) {

      mensagem.textContent =
        erro?.message ||
        'Não foi possível enviar o link.';

    }

  }

}


// =========================================================
// ## 3. RESET PELA GESTÃO DA EQUIPE
// =========================================================

async function redefinirSenhaUsuarioEquipe(
  userId
) {

  if (
    typeof equipePerfis ===
    'undefined'
  ) {

    return;

  }


  const perfil =
    equipePerfis.find(
      item =>
        item.user_id ===
        userId
    );


  if (!perfil) {

    alert(
      'Usuário não localizado.'
    );

    return;

  }


  if (!perfil.email) {

    alert(
      'Este usuário não possui e-mail cadastrado.'
    );

    return;

  }


  // Gestor pode auxiliar vendedores.
  // ADM também pode utilizar essa ação.

  if (
    typeof equipePerfilAtual !==
    'undefined' &&
    equipePerfilAtual
      ?.tipo_acesso ===
      'gestor' &&
    perfil.tipo_acesso !==
      'vendedor'
  ) {

    alert(
      'O Gestor pode solicitar redefinição apenas para vendedores.'
    );

    return;

  }


  const confirmar =
    confirm(
      `Enviar um link de redefinição de senha para:\n\n` +
      `${perfil.nome}\n` +
      `${perfil.email}?`
    );


  if (!confirmar) {

    return;

  }


  try {

    await solicitarRedefinicaoSenha(
      perfil.email
    );


    toastMsg(
      'Link de redefinição enviado'
    );


    alert(
      `O link para criar uma nova senha foi enviado para:\n\n` +
      `${perfil.email}`
    );


  } catch (erro) {

    console.error(
      'Erro ao enviar redefinição de senha:',
      erro
    );


    alert(
      'Não foi possível enviar o link.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  }

}


// =========================================================
// ## 4. MONTAR TELA DE NOVA SENHA
// =========================================================

function montarTelaNovaSenha() {

  if (
    document.getElementById(
      'senhaRecoveryOverlay'
    )
  ) {

    return;

  }


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'senhaRecoveryOverlay';


  overlay.className =
    'senha-recovery-overlay';


  overlay.hidden =
    true;


  overlay.innerHTML = `

    <div class="senha-recovery-card">

      <h2>
        🔐 Criar nova senha
      </h2>

      <p>
        Informe a nova senha que será utilizada
        para acessar a Central Comercial.
      </p>


      <form id="senhaRecoveryForm">


        <div class="field">

          <label for="senhaRecoveryNova">
            Nova senha
          </label>

          <input
            id="senhaRecoveryNova"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
            placeholder="Mínimo de 8 caracteres"
          >

        </div>


        <div class="field">

          <label for="senhaRecoveryConfirmar">
            Confirmar nova senha
          </label>

          <input
            id="senhaRecoveryConfirmar"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
            placeholder="Digite novamente"
          >

        </div>


        <button
          id="senhaRecoveryButton"
          type="submit"
          class="btn red login-button"
        >
          Salvar nova senha
        </button>


        <div
          id="senhaRecoveryMessage"
          class="senha-recovery-message"
        ></div>


      </form>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      'senhaRecoveryForm'
    )
    ?.addEventListener(
      'submit',
      salvarNovaSenhaRecovery
    );

}


// =========================================================
// ## 5. ABRIR TELA DE NOVA SENHA
// =========================================================

function abrirTelaNovaSenha() {

  montarTelaNovaSenha();


  const overlay =
    document.getElementById(
      'senhaRecoveryOverlay'
    );


  if (overlay) {

    overlay.hidden =
      false;

  }


  document
    .getElementById(
      'senhaRecoveryNova'
    )
    ?.focus();

}


// =========================================================
// ## 6. SALVAR NOVA SENHA
// =========================================================

async function salvarNovaSenhaRecovery(
  evento
) {

  evento.preventDefault();


  const novaSenha =
    document
      .getElementById(
        'senhaRecoveryNova'
      )
      ?.value || '';


  const confirmarSenha =
    document
      .getElementById(
        'senhaRecoveryConfirmar'
      )
      ?.value || '';


  const mensagem =
    document.getElementById(
      'senhaRecoveryMessage'
    );


  const botao =
    document.getElementById(
      'senhaRecoveryButton'
    );


  if (
    novaSenha.length < 8
  ) {

    if (mensagem) {

      mensagem.textContent =
        'A senha precisa ter pelo menos 8 caracteres.';

      mensagem.className =
        'senha-recovery-message erro';

    }


    return;

  }


  if (
    novaSenha !==
    confirmarSenha
  ) {

    if (mensagem) {

      mensagem.textContent =
        'As senhas não são iguais.';

      mensagem.className =
        'senha-recovery-message erro';

    }


    return;

  }


  const textoOriginal =
    botao?.textContent ||
    'Salvar nova senha';


  if (botao) {

    botao.disabled =
      true;

    botao.textContent =
      'Salvando...';

  }


  if (mensagem) {

    mensagem.textContent =
      'Atualizando senha...';

    mensagem.className =
      'senha-recovery-message';

  }


  try {

    await atualizarSenhaRecuperacao(
      novaSenha
    );


    if (mensagem) {

      mensagem.textContent =
        'Senha alterada com sucesso.';

      mensagem.className =
        'senha-recovery-message sucesso';

    }


    const client =
      getSupabaseClient();


    setTimeout(
      async () => {

        await client.auth.signOut();

        window.location.href =
          obterUrlRetornoSenha();

      },
      1200
    );


  } catch (erro) {

    console.error(
      'Erro ao atualizar senha:',
      erro
    );


    if (mensagem) {

      mensagem.textContent =
        erro?.message ||
        'Não foi possível alterar a senha.';

      mensagem.className =
        'senha-recovery-message erro';

    }


    if (botao) {

      botao.disabled =
        false;

      botao.textContent =
        textoOriginal;

    }

  }

}


// =========================================================
// ## 7. MONITORAR RECUPERAÇÃO DO SUPABASE
// =========================================================

function iniciarMonitoramentoSenha() {

  montarEsqueciSenhaLogin();

  montarTelaNovaSenha();


  try {

    const client =
      getSupabaseClient();


    client.auth.onAuthStateChange(
      (
        event,
        session
      ) => {

        if (
          event ===
          'PASSWORD_RECOVERY'
        ) {

          console.log(
            'Sessão de recuperação de senha detectada.',
            session?.user?.email
          );


          setTimeout(
            abrirTelaNovaSenha,
            0
          );

        }

      }
    );


  } catch (erro) {

    console.error(
      'Erro ao iniciar recuperação de senha:',
      erro
    );

  }

}


// =========================================================
// ## 8. INICIALIZAÇÃO
// =========================================================

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    iniciarMonitoramentoSenha
  );

} else {

  iniciarMonitoramentoSenha();

}
