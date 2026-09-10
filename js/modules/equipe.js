// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: equipe.js
//
// Responsabilidade:
// - Identificar Vendedor / Gestor / ADM
// - Exibir Gestão da Equipe somente para Gestor / ADM
// - Listar usuários
// - Mostrar contas pendentes
// - Aprovar / bloquear vendedores
// - Permitir que ADM altere o perfil
// - Exibir ação de redefinição de senha
//
// Dependências:
// - js/services/usuarios.service.js
// - js/ui/senha-ui.js
// =========================================================


// =========================================================
// ## 1. ESTADO
// =========================================================

let equipePerfilAtual = null;
let equipePerfis = [];
let equipeCarregando = false;


// =========================================================
// ## 2. AUXILIARES
// =========================================================

function escaparEquipe(valor) {

  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


function nomePerfilEquipe(tipo) {

  const nomes = {

    vendedor: 'VENDEDOR',

    gestor: 'GESTOR',

    adm: 'ADM'

  };


  return nomes[tipo] ||
    String(
      tipo || '—'
    ).toUpperCase();

}


// =========================================================
// ## 3. PERMISSÕES
// =========================================================

function usuarioPodeGerenciarEquipe() {

  return [
    'gestor',
    'adm'
  ].includes(
    equipePerfilAtual
      ?.tipo_acesso
  );

}


function usuarioEhAdmEquipe() {

  return (
    equipePerfilAtual
      ?.tipo_acesso ===
    'adm'
  );

}


// =========================================================
// ## 4. CRIAR INTERFACE
// =========================================================

function montarInterfaceGestaoEquipe() {

  if (
    document.getElementById(
      'gestaoEquipePanel'
    )
  ) {

    return;

  }


  const pagina =
    document.getElementById(
      'painelPage'
    );


  if (!pagina) {

    return;

  }


  const section =
    document.createElement(
      'section'
    );


  section.id =
    'gestaoEquipePanel';


  section.className =
    'panel gestao-equipe-panel';


  section.hidden =
    true;


  section.innerHTML = `

    <div class="panel-head">

      <div>

        <h2>
          👥 Gestão da Equipe
        </h2>

        <span>
          Usuários, acessos e vendedores
        </span>

      </div>


      <span id="equipeContador">
        0 usuário(s)
      </span>

    </div>


    <div class="panel-body">


      <!-- ================================================
           INDICADORES
           ================================================ -->

      <div class="equipe-cards">


        <div class="equipe-card pendente">

          <span>
            AGUARDANDO APROVAÇÃO
          </span>

          <strong id="equipeQtdPendentes">
            0
          </strong>

        </div>


        <div class="equipe-card vendedores">

          <span>
            VENDEDORES ATIVOS
          </span>

          <strong id="equipeQtdVendedores">
            0
          </strong>

        </div>


        <div class="equipe-card gestores">

          <span>
            GESTORES ATIVOS
          </span>

          <strong id="equipeQtdGestores">
            0
          </strong>

        </div>


        <div class="equipe-card">

          <span>
            TOTAL DE USUÁRIOS
          </span>

          <strong id="equipeQtdTotal">
            0
          </strong>

        </div>


      </div>


      <!-- ================================================
           FILTROS
           ================================================ -->

      <div class="equipe-toolbar">


        <div class="field equipe-search">

          <label>
            Pesquisar usuário
          </label>

          <input
            id="equipeBusca"
            type="search"
            placeholder="Nome ou e-mail"
          >

        </div>


        <div class="field">

          <label>
            Perfil
          </label>

          <select id="equipeFiltroPerfil">

            <option value="">
              Todos
            </option>

            <option value="vendedor">
              Vendedor
            </option>

            <option value="gestor">
              Gestor
            </option>

            <option value="adm">
              ADM
            </option>

          </select>

        </div>


        <div class="field">

          <label>
            Acesso
          </label>

          <select id="equipeFiltroAcesso">

            <option value="">
              Todos
            </option>

            <option value="ativo">
              Ativos
            </option>

            <option value="pendente">
              Aguardando aprovação
            </option>

          </select>

        </div>


        <button
          type="button"
          class="btn light"
          onclick="limparFiltrosEquipe()"
        >
          Limpar filtros
        </button>


        <button
          type="button"
          class="btn navy"
          onclick="carregarGestaoEquipe()"
        >
          ↻ Atualizar
        </button>


      </div>


      <!-- ================================================
           TABELA
           ================================================ -->

      <div class="table-wrap">

        <table class="editor equipe-table">

          <thead>

            <tr>

              <th>
                Usuário
              </th>

              <th>
                Perfil
              </th>

              <th>
                Acesso
              </th>

              <th>
                Cadastro
              </th>

              <th>
                Ações
              </th>

            </tr>

          </thead>


          <tbody id="equipeBody">

            <tr>

              <td
                colspan="5"
                style="
                  padding:30px;
                  text-align:center;
                "
              >
                Carregando equipe...
              </td>

            </tr>

          </tbody>

        </table>

      </div>


      <div id="equipeVazio">
        Nenhum usuário encontrado.
      </div>


    </div>

  `;


  pagina.appendChild(
    section
  );


  iniciarEventosEquipe();

}


// =========================================================
// ## 5. EVENTOS
// =========================================================

function iniciarEventosEquipe() {

  document
    .getElementById(
      'equipeBusca'
    )
    ?.addEventListener(
      'input',
      renderizarEquipe
    );


  document
    .getElementById(
      'equipeFiltroPerfil'
    )
    ?.addEventListener(
      'change',
      renderizarEquipe
    );


  document
    .getElementById(
      'equipeFiltroAcesso'
    )
    ?.addEventListener(
      'change',
      renderizarEquipe
    );

}


// =========================================================
// ## 6. FILTROS
// =========================================================

function obterPerfisFiltradosEquipe() {

  const busca =
    document
      .getElementById(
        'equipeBusca'
      )
      ?.value
      .trim()
      .toLowerCase() || '';


  const filtroPerfil =
    document
      .getElementById(
        'equipeFiltroPerfil'
      )
      ?.value || '';


  const filtroAcesso =
    document
      .getElementById(
        'equipeFiltroAcesso'
      )
      ?.value || '';


  return equipePerfis.filter(
    perfil => {

      const texto =
        [
          perfil.nome,
          perfil.email
        ]
          .join(
            ' '
          )
          .toLowerCase();


      if (
        busca &&
        !texto.includes(
          busca
        )
      ) {

        return false;

      }


      if (
        filtroPerfil &&
        perfil.tipo_acesso !==
        filtroPerfil
      ) {

        return false;

      }


      if (
        filtroAcesso ===
        'ativo' &&
        !perfil.ativo
      ) {

        return false;

      }


      if (
        filtroAcesso ===
        'pendente' &&
        perfil.ativo
      ) {

        return false;

      }


      return true;

    }
  );

}


// =========================================================
// ## 7. INDICADORES
// =========================================================

function atualizarIndicadoresEquipe() {

  const pendentes =
    equipePerfis.filter(
      perfil =>
        !perfil.ativo
    ).length;


  const vendedores =
    equipePerfis.filter(
      perfil =>
        perfil.ativo &&
        perfil.tipo_acesso ===
        'vendedor'
    ).length;


  const gestores =
    equipePerfis.filter(
      perfil =>
        perfil.ativo &&
        perfil.tipo_acesso ===
        'gestor'
    ).length;


  const total =
    equipePerfis.length;


  const definir =
    (
      id,
      valor
    ) => {

      const el =
        document.getElementById(
          id
        );


      if (el) {

        el.textContent =
          valor;

      }

    };


  definir(
    'equipeQtdPendentes',
    pendentes
  );


  definir(
    'equipeQtdVendedores',
    vendedores
  );


  definir(
    'equipeQtdGestores',
    gestores
  );


  definir(
    'equipeQtdTotal',
    total
  );

}


// =========================================================
// ## 8. BADGES
// =========================================================

function badgePerfilEquipe(
  perfil
) {

  return `
    <span
      class="
        equipe-badge
        ${escaparEquipe(
          perfil.tipo_acesso
        )}
      "
    >
      ${
        escaparEquipe(
          nomePerfilEquipe(
            perfil.tipo_acesso
          )
        )
      }
    </span>
  `;

}


function badgeAcessoEquipe(
  perfil
) {

  if (
    perfil.ativo
  ) {

    return `
      <span class="equipe-badge ativo">
        ATIVO
      </span>
    `;

  }


  return `
    <span class="equipe-badge pendente">
      AGUARDANDO APROVAÇÃO
    </span>
  `;

}


// =========================================================
// ## 9. DATA
// =========================================================

function formatarDataEquipe(
  data
) {

  if (!data) {

    return '—';

  }


  const valor =
    new Date(
      data
    );


  if (
    Number.isNaN(
      valor.getTime()
    )
  ) {

    return '—';

  }


  return valor.toLocaleDateString(
    'pt-BR'
  );

}


// =========================================================
// ## 10. SELECT DE PERFIL DO ADM
// =========================================================

function selectPerfilEquipe(
  perfil
) {

  if (
    !usuarioEhAdmEquipe()
  ) {

    return badgePerfilEquipe(
      perfil
    );

  }


  // Conta ainda não aprovada:
  // primeiro aprovamos como vendedor.
  // Depois o ADM pode promover para Gestor.

  if (
    !perfil.ativo
  ) {

    return `
      ${badgePerfilEquipe(perfil)}

      <div class="equipe-user-email">
        Aprove primeiro para alterar o perfil.
      </div>
    `;

  }


  return `
    <select
      class="equipe-role-select"
      onchange="
        alterarPerfilUsuarioEquipe(
          '${escaparEquipe(
            perfil.user_id
          )}',
          this.value
        )
      "
    >

      <option
        value="vendedor"
        ${
          perfil.tipo_acesso ===
          'vendedor'
            ? 'selected'
            : ''
        }
      >
        Vendedor
      </option>

      <option
        value="gestor"
        ${
          perfil.tipo_acesso ===
          'gestor'
            ? 'selected'
            : ''
        }
      >
        Gestor
      </option>

      <option
        value="adm"
        ${
          perfil.tipo_acesso ===
          'adm'
            ? 'selected'
            : ''
        }
      >
        ADM
      </option>

    </select>
  `;

}


// =========================================================
// ## 11. AÇÕES
// =========================================================

function botoesEquipe(
  perfil
) {

  // -------------------------------------------------------
  // ## 11.1 VENDEDOR PENDENTE
  // -------------------------------------------------------

  if (
    perfil.tipo_acesso ===
      'vendedor' &&
    !perfil.ativo
  ) {

    return `

      <button
        type="button"
        class="btn green"
        onclick="
          aprovarUsuarioEquipe(
            '${escaparEquipe(
              perfil.user_id
            )}'
          )
        "
      >
        ✓ Aprovar
      </button>

      <button
        type="button"
        class="btn light"
        onclick="
          redefinirSenhaUsuarioEquipe(
            '${escaparEquipe(
              perfil.user_id
            )}'
          )
        "
      >
        Redefinir senha
      </button>

    `;

  }


  // -------------------------------------------------------
  // ## 11.2 VENDEDOR ATIVO
  // -------------------------------------------------------

  if (
    perfil.tipo_acesso ===
      'vendedor'
  ) {

    return `

      <button
        type="button"
        class="btn light"
        onclick="
          bloquearUsuarioEquipe(
            '${escaparEquipe(
              perfil.user_id
            )}'
          )
        "
      >
        Bloquear
      </button>

      <button
        type="button"
        class="btn navy"
        onclick="
          redefinirSenhaUsuarioEquipe(
            '${escaparEquipe(
              perfil.user_id
            )}'
          )
        "
      >
        Redefinir senha
      </button>

    `;

  }


  // -------------------------------------------------------
  // ## 11.3 PERFIL ADMINISTRATIVO
  // -------------------------------------------------------

  if (
    usuarioEhAdmEquipe()
  ) {

    return `

      <button
        type="button"
        class="btn navy"
        onclick="
          redefinirSenhaUsuarioEquipe(
            '${escaparEquipe(
              perfil.user_id
            )}'
          )
        "
      >
        Redefinir senha
      </button>

    `;

  }


  return `
    <span class="equipe-user-email">
      Perfil administrativo
    </span>
  `;

}


// =========================================================
// ## 12. RENDERIZAÇÃO
// =========================================================

function renderizarEquipe() {

  const corpo =
    document.getElementById(
      'equipeBody'
    );


  const vazio =
    document.getElementById(
      'equipeVazio'
    );


  const contador =
    document.getElementById(
      'equipeContador'
    );


  if (!corpo) {

    return;

  }


  const lista =
    obterPerfisFiltradosEquipe();


  corpo.innerHTML =
    '';


  atualizarIndicadoresEquipe();


  if (contador) {

    if (
      lista.length ===
      equipePerfis.length
    ) {

      contador.textContent =
        `${lista.length} usuário(s)`;

    } else {

      contador.textContent =
        `${lista.length} de ${equipePerfis.length} usuário(s)`;

    }

  }


  if (vazio) {

    vazio.style.display =
      lista.length
        ? 'none'
        : 'block';

  }


  lista.forEach(
    perfil => {

      const tr =
        document.createElement(
          'tr'
        );


      tr.innerHTML = `

        <td>

          <div class="equipe-user-name">
            ${
              escaparEquipe(
                perfil.nome ||
                'Sem nome'
              )
            }
          </div>

          <div class="equipe-user-email">
            ${
              escaparEquipe(
                perfil.email ||
                '—'
              )
            }
          </div>

        </td>


        <td>

          ${
            selectPerfilEquipe(
              perfil
            )
          }

        </td>


        <td>

          ${
            badgeAcessoEquipe(
              perfil
            )
          }

        </td>


        <td>

          ${
            formatarDataEquipe(
              perfil.created_at
            )
          }

        </td>


        <td>

          <div class="equipe-actions">

            ${
              botoesEquipe(
                perfil
              )
            }

          </div>

        </td>

      `;


      corpo.appendChild(
        tr
      );

    }
  );

}


// =========================================================
// ## 13. CARREGAR EQUIPE
// =========================================================

async function carregarGestaoEquipe() {

  if (
    equipeCarregando
  ) {

    return;

  }


  if (
    !usuarioPodeGerenciarEquipe()
  ) {

    return;

  }


  const corpo =
    document.getElementById(
      'equipeBody'
    );


  equipeCarregando =
    true;


  if (corpo) {

    corpo.innerHTML = `

      <tr>

        <td
          colspan="5"
          style="
            padding:30px;
            text-align:center;
          "
        >
          Carregando equipe...
        </td>

      </tr>

    `;

  }


  try {

    equipePerfis =
      await listarPerfisEquipe();


    // Pendentes primeiro.
    // Depois ativos em ordem alfabética.

    equipePerfis.sort(
      (
        a,
        b
      ) => {

        if (
          a.ativo !==
          b.ativo
        ) {

          return a.ativo
            ? 1
            : -1;

        }


        return String(
          a.nome || ''
        ).localeCompare(
          String(
            b.nome || ''
          ),
          'pt-BR'
        );

      }
    );


    renderizarEquipe();


  } catch (erro) {

    console.error(
      'Erro ao carregar equipe:',
      erro
    );


    if (corpo) {

      corpo.innerHTML = `

        <tr>

          <td
            colspan="5"
            style="
              padding:30px;
              text-align:center;
            "
          >

            Não foi possível carregar a equipe.

          </td>

        </tr>

      `;

    }

  } finally {

    equipeCarregando =
      false;

  }

}


// =========================================================
// ## 14. APROVAR USUÁRIO
// =========================================================

async function aprovarUsuarioEquipe(
  userId
) {

  const perfil =
    equipePerfis.find(
      item =>
        item.user_id ===
        userId
    );


  if (!perfil) {

    return;

  }


  const confirmar =
    confirm(
      `Aprovar acesso de ${perfil.nome}?`
    );


  if (!confirmar) {

    return;

  }


  try {

    await definirAcessoVendedor(
      userId,
      true
    );


    toastMsg(
      `${perfil.nome} aprovado`
    );


    await carregarGestaoEquipe();


    if (
      typeof carregarMetasEquipe ===
      'function'
    ) {

      await carregarMetasEquipe();

    }


  } catch (erro) {

    console.error(
      'Erro ao aprovar usuário:',
      erro
    );


    alert(
      'Não foi possível aprovar o usuário.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  }

}


// =========================================================
// ## 15. BLOQUEAR VENDEDOR
// =========================================================

async function bloquearUsuarioEquipe(
  userId
) {

  const perfil =
    equipePerfis.find(
      item =>
        item.user_id ===
        userId
    );


  if (!perfil) {

    return;

  }


  const confirmar =
    confirm(
      `Bloquear o acesso de ${perfil.nome}?`
    );


  if (!confirmar) {

    return;

  }


  try {

    await definirAcessoVendedor(
      userId,
      false
    );


    toastMsg(
      `${perfil.nome} bloqueado`
    );


    await carregarGestaoEquipe();


    if (
      typeof carregarMetasEquipe ===
      'function'
    ) {

      await carregarMetasEquipe();

    }


  } catch (erro) {

    console.error(
      'Erro ao bloquear usuário:',
      erro
    );


    alert(
      'Não foi possível bloquear o usuário.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  }

}


// =========================================================
// ## 16. ALTERAR PERFIL
// =========================================================

async function alterarPerfilUsuarioEquipe(
  userId,
  novoTipo
) {

  if (
    !usuarioEhAdmEquipe()
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

    return;

  }


  if (
    perfil.tipo_acesso ===
    novoTipo
  ) {

    return;

  }


  const confirmar =
    confirm(
      `Alterar ${perfil.nome} de ` +
      `${nomePerfilEquipe(perfil.tipo_acesso)} ` +
      `para ${nomePerfilEquipe(novoTipo)}?`
    );


  if (!confirmar) {

    renderizarEquipe();

    return;

  }


  try {

    await definirTipoAcesso(
      userId,
      novoTipo
    );


    toastMsg(
      `Perfil de ${perfil.nome} atualizado`
    );


    await carregarGestaoEquipe();


    if (
      typeof carregarMetasEquipe ===
      'function'
    ) {

      await carregarMetasEquipe();

    }


  } catch (erro) {

    console.error(
      'Erro ao alterar perfil:',
      erro
    );


    alert(
      'Não foi possível alterar o perfil.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );


    await carregarGestaoEquipe();

  }

}


// =========================================================
// ## 17. LIMPAR FILTROS
// =========================================================

function limparFiltrosEquipe() {

  const busca =
    document.getElementById(
      'equipeBusca'
    );


  const perfil =
    document.getElementById(
      'equipeFiltroPerfil'
    );


  const acesso =
    document.getElementById(
      'equipeFiltroAcesso'
    );


  if (busca) {

    busca.value =
      '';

  }


  if (perfil) {

    perfil.value =
      '';

  }


  if (acesso) {

    acesso.value =
      '';

  }


  renderizarEquipe();

}


// =========================================================
// ## 18. SINCRONIZAR ACESSO
// =========================================================

async function sincronizarGestaoEquipe() {

  montarInterfaceGestaoEquipe();


  const painel =
    document.getElementById(
      'gestaoEquipePanel'
    );


  try {

    equipePerfilAtual =
      await obterMeuPerfil();


    if (
      !equipePerfilAtual ||
      !usuarioPodeGerenciarEquipe()
    ) {

      if (painel) {

        painel.hidden =
          true;

      }


      equipePerfis =
        [];


      return;

    }


    if (painel) {

      painel.hidden =
        false;

    }


    await carregarGestaoEquipe();


  } catch (erro) {

    console.error(
      'Erro ao verificar acesso da Gestão da Equipe:',
      erro
    );


    if (painel) {

      painel.hidden =
        true;

    }

  }

}


// =========================================================
// ## 19. INICIALIZAÇÃO
// =========================================================

function iniciarModuloEquipe() {

  montarInterfaceGestaoEquipe();


  sincronizarGestaoEquipe();


  try {

    const client =
      getSupabaseClient();


    client.auth.onAuthStateChange(
      () => {

        // Executa fora do callback imediato do Auth.

        setTimeout(
          sincronizarGestaoEquipe,
          0
        );

      }
    );


  } catch (erro) {

    console.error(
      'Erro ao iniciar monitoramento da equipe:',
      erro
    );

  }

}


if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    iniciarModuloEquipe
  );

} else {

  iniciarModuloEquipe();

}