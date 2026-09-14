// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: equipe.js
//
// Responsabilidade:
// - Identificar Vendedor / Gestor / ADM
// - Sincronizar o Time do vendedor com o Orçamento
// - Exibir Gestão da Equipe somente para Gestor / ADM
// - Listar usuários
// - Mostrar contas pendentes
// - Aprovar / bloquear vendedores
// - Permitir que ADM altere o perfil
// - Permitir que Gestor / ADM alterem o Time do vendedor
// - Exibir ação de redefinição de senha
//
// Dependências:
// - js/services/usuarios.service.js
// - js/ui/senha-ui.js
// - js/modules/proposta.js
// =========================================================


// =========================================================
// ## 1. ESTADO
// =========================================================

let equipePerfilAtual =
  null;

let equipePerfis =
  [];

let equipeCarregando =
  false;


// =========================================================
// ## 2. AUXILIARES
// =========================================================

function escaparEquipe(
  valor
) {

  return String(
    valor ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );

}


function nomePerfilEquipe(
  tipo
) {

  const nomes = {

    vendedor:
      'VENDEDOR',

    gestor:
      'GESTOR',

    adm:
      'ADM'

  };


  return nomes[tipo] ||
    String(
      tipo || '—'
    ).toUpperCase();

}


// Nome específico deste módulo para evitar
// conflito com funções do Painel / Metas.

function nomeTimeGestaoEquipe(
  time
) {

  const nomes = {

    pharma:
      'PHARMA',

    food:
      'FOOD',

    revenda:
      'REVENDA'

  };


  const chave =
    String(
      time || ''
    )
      .trim()
      .toLowerCase();


  return nomes[chave] ||
    '—';

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
// ## 4. TIME DO ORÇAMENTO
// =========================================================


// ---------------------------------------------------------
// ## 4.1 Identificar se existe proposta salva aberta
// ---------------------------------------------------------

function propostaSalvaAbertaEquipe() {

  try {

    return (
      typeof propostaNuvemAtual !==
        'undefined' &&
      Boolean(
        propostaNuvemAtual
          ?.propostaId
      )
    );

  } catch (erro) {

    return false;

  }

}


// ---------------------------------------------------------
// ## 4.2 Sincronizar perfil → Orçamento
// ---------------------------------------------------------

function sincronizarTimeOrcamentoComPerfil(
  perfil
) {

  const campo =
    document.getElementById(
      'timeEquipe'
    );


  if (
    !campo ||
    !perfil
  ) {

    return;

  }


  const field =
    campo.closest(
      '.field'
    );


  const label =
    field
      ?.querySelector(
        'label'
      );


  const tipo =
    String(
      perfil.tipo_acesso ||
      ''
    )
      .trim()
      .toLowerCase();


  // -------------------------------------------------------
  // ## 4.2.1 Vendedor
  // -------------------------------------------------------

  if (
    tipo ===
    'vendedor'
  ) {

    const timePerfil =
      String(
        perfil.time_equipe ||
        ''
      )
        .trim()
        .toLowerCase();


    const propostaSalva =
      propostaSalvaAbertaEquipe();


    // Se for uma NOVA proposta, o Time vem
    // obrigatoriamente do perfil do vendedor.
    //
    // Se uma proposta JÁ SALVA estiver aberta,
    // preservamos o Time gravado naquela revisão.

    if (
      !propostaSalva
    ) {

      campo.value =
        [
          'pharma',
          'food',
          'revenda'
        ].includes(
          timePerfil
        )
          ? timePerfil
          : '';

    }


    // Vendedor não pode escolher outro Time
    // pela interface.

    campo.disabled =
      true;


    campo.title =
      timePerfil
        ? (
            'Time definido automaticamente ' +
            'pelo perfil do vendedor.'
          )
        : (
            'Seu perfil ainda não possui ' +
            'um Time comercial definido.'
          );


    if (label) {

      label.textContent =
        'Time (definido pelo perfil)';

    }


    // Atualiza imediatamente a identidade visual
    // do PDF de acordo com o Time.

    if (
      typeof updateTeamLogo ===
      'function' &&
      campo.value
    ) {

      updateTeamLogo();

    }


    return;

  }


  // -------------------------------------------------------
  // ## 4.2.2 Gestor / ADM
  // -------------------------------------------------------

  if (
    [
      'gestor',
      'adm'
    ].includes(
      tipo
    )
  ) {

    campo.disabled =
      false;


    campo.title =
      'Selecione o Time da proposta.';


    if (label) {

      label.textContent =
        'Time (interno)';

    }


    if (
      typeof updateTeamLogo ===
      'function'
    ) {

      updateTeamLogo();

    }


    return;

  }


  // -------------------------------------------------------
  // ## 4.2.3 Perfil não reconhecido
  // -------------------------------------------------------

  campo.disabled =
    true;


  campo.title =
    'Perfil sem permissão para definir Time.';

}


// =========================================================
// ## 5. CRIAR INTERFACE DE GESTÃO DA EQUIPE
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
          Usuários, perfis, Times e acessos
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
            Time
          </label>

          <select id="equipeFiltroTime">

            <option value="">
              Todos os Times
            </option>

            <option value="pharma">
              Pharma
            </option>

            <option value="food">
              Food
            </option>

            <option value="revenda">
              Revenda
            </option>

            <option value="sem_time">
              Vendedores sem Time
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
                Time
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
                colspan="6"
                class="equipe-loading-cell"
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
// ## 6. EVENTOS
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
      'equipeFiltroTime'
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
// ## 7. FILTROS
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


  const filtroTime =
    document
      .getElementById(
        'equipeFiltroTime'
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
          perfil.email,
          perfil.tipo_acesso ===
            'vendedor'
            ? nomeTimeGestaoEquipe(
                perfil.time_equipe
              )
            : ''
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
        filtroTime ===
        'sem_time'
      ) {

        if (
          perfil.tipo_acesso !==
            'vendedor' ||
          perfil.time_equipe
        ) {

          return false;

        }

      }


      if (
        filtroTime &&
        filtroTime !==
        'sem_time'
      ) {

        if (
          perfil.tipo_acesso !==
            'vendedor' ||
          perfil.time_equipe !==
            filtroTime
        ) {

          return false;

        }

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
// ## 8. INDICADORES
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
// ## 9. BADGES
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
// ## 10. DATA
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
// ## 11. SELECT DE PERFIL DO ADM
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
// ## 12. SELECT DE TIME
// =========================================================

function selectTimeEquipe(
  perfil
) {

  if (
    perfil.tipo_acesso !==
    'vendedor'
  ) {

    return `
      <span class="equipe-time-empty">
        —
      </span>
    `;

  }


  if (
    !usuarioPodeGerenciarEquipe()
  ) {

    const classeTime =
      perfil.time_equipe
        ? `time-${perfil.time_equipe}`
        : 'time-sem-time';


    return `
      <span
        class="
          equipe-badge
          ${escaparEquipe(
            classeTime
          )}
        "
      >
        ${
          escaparEquipe(
            nomeTimeGestaoEquipe(
              perfil.time_equipe
            )
          )
        }
      </span>
    `;

  }


  return `
    <select
      class="
        equipe-team-select
        ${
          !perfil.time_equipe
            ? 'sem-time'
            : ''
        }
      "
      onchange="
        alterarTimeUsuarioEquipe(
          '${escaparEquipe(
            perfil.user_id
          )}',
          this.value
        )
      "
    >

      <option
        value=""
        ${
          !perfil.time_equipe
            ? 'selected'
            : ''
        }
        disabled
      >
        Selecionar Time
      </option>

      <option
        value="pharma"
        ${
          perfil.time_equipe ===
          'pharma'
            ? 'selected'
            : ''
        }
      >
        Pharma
      </option>

      <option
        value="food"
        ${
          perfil.time_equipe ===
          'food'
            ? 'selected'
            : ''
        }
      >
        Food
      </option>

      <option
        value="revenda"
        ${
          perfil.time_equipe ===
          'revenda'
            ? 'selected'
            : ''
        }
      >
        Revenda
      </option>

    </select>
  `;

}


// =========================================================
// ## 13. AÇÕES
// =========================================================

function botoesEquipe(
  perfil
) {

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
// ## 14. RENDERIZAÇÃO
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
            selectTimeEquipe(
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
// ## 15. CARREGAR EQUIPE
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
          colspan="6"
          class="equipe-loading-cell"
        >
          Carregando equipe...
        </td>

      </tr>

    `;

  }


  try {

    equipePerfis =
      await listarPerfisEquipe();


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
            colspan="6"
            class="equipe-loading-cell"
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
// ## 16. RECARREGAR METAS RELACIONADAS
// =========================================================

async function recarregarMetasEquipeSeDisponivel() {

  if (
    typeof carregarMetasEquipe !==
    'function'
  ) {

    return;

  }


  try {

    await carregarMetasEquipe();

  } catch (erro) {

    console.warn(
      'Equipe atualizada, mas não foi possível recarregar metas:',
      erro
    );

  }

}


// =========================================================
// ## 17. APROVAR USUÁRIO
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


  if (
    perfil.tipo_acesso ===
      'vendedor' &&
    !perfil.time_equipe
  ) {

    alert(
      'Defina o Time comercial do vendedor antes de aprovar o acesso.'
    );

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

    await recarregarMetasEquipeSeDisponivel();


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
// ## 18. BLOQUEAR VENDEDOR
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


  if (!confirmimar) {

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

    await recarregarMetasEquipeSeDisponivel();


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
// ## 19. ALTERAR PERFIL
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

    await recarregarMetasEquipeSeDisponivel();


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
// ## 20. ALTERAR TIME DO VENDEDOR
// =========================================================

async function alterarTimeUsuarioEquipe(
  userId,
  novoTime
) {

  if (
    !usuarioPodeGerenciarEquipe()
  ) {

    return;

  }


  const perfil =
    equipePerfis.find(
      item =>
        item.user_id ===
        userId
    );


  if (
    !perfil ||
    perfil.tipo_acesso !==
      'vendedor'
  ) {

    renderizarEquipe();

    return;

  }


  const timeNormalizado =
    String(
      novoTime || ''
    )
      .trim()
      .toLowerCase();


  if (
    ![
      'pharma',
      'food',
      'revenda'
    ].includes(
      timeNormalizado
    )
  ) {

    renderizarEquipe();

    return;

  }


  if (
    perfil.time_equipe ===
    timeNormalizado
  ) {

    return;

  }


  const timeAnterior =
    nomeTimeGestaoEquipe(
      perfil.time_equipe
    );


  const timeNovo =
    nomeTimeGestaoEquipe(
      timeNormalizado
    );


  const confirmar =
    confirm(
      `Alterar o Time de ${perfil.nome} ` +
      `de ${timeAnterior} para ${timeNovo}?`
    );


  if (!confirmar) {

    renderizarEquipe();

    return;

  }


  try {

    await definirTimeVendedor(
      userId,
      timeNormalizado
    );


    toastMsg(
      `${perfil.nome} agora pertence ao Time ${timeNovo}`
    );


    await carregarGestaoEquipe();

    await recarregarMetasEquipeSeDisponivel();


  } catch (erro) {

    console.error(
      'Erro ao alterar Time do vendedor:',
      erro
    );


    alert(
      'Não foi possível alterar o Time do vendedor.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );


    await carregarGestaoEquipe();

  }

}


// =========================================================
// ## 21. LIMPAR FILTROS
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


  const time =
    document.getElementById(
      'equipeFiltroTime'
    );


  const acesso =
    document.getElementById(
      'equipeFiltroAcesso'
    );


  if (busca) {
    busca.value = '';
  }


  if (perfil) {
    perfil.value = '';
  }


  if (time) {
    time.value = '';
  }


  if (acesso) {
    acesso.value = '';
  }


  renderizarEquipe();

}


// =========================================================
// ## 22. SINCRONIZAR USUÁRIO / ACESSO
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


    // IMPORTANTE:
    // A sincronização do Time do Orçamento acontece
    // para TODOS os perfis, inclusive vendedor.
    //
    // Por isso ela deve acontecer antes de esconder
    // a Gestão da Equipe do vendedor.

    sincronizarTimeOrcamentoComPerfil(
      equipePerfilAtual
    );


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
// ## 23. INICIALIZAÇÃO
// =========================================================

function iniciarModuloEquipe() {

  montarInterfaceGestaoEquipe();


  sincronizarGestaoEquipe();


  try {

    const client =
      getSupabaseClient();


    client.auth.onAuthStateChange(
      () => {

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