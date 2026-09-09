// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: historico.js
//
// Responsabilidade:
// - Carregar propostas salvas no Supabase
// - Filtrar propostas pelo campo de busca
// - Renderizar a tabela do histórico
// - Exibir o status da revisão atual
// - Abrir uma proposta existente no formulário
//
// Dependências:
// - js/core/core.js
// - js/services/propostas.service.js
// - js/modules/proposta.js
// - Elementos da página de histórico no index.html
//
// Segurança:
// - Este módulo apenas solicita as propostas
// - O RLS do Supabase define quais registros o usuário
//   realmente pode visualizar
//
// Observação:
// ADM visualiza todas as propostas permitidas pelo RLS.
// Vendedor visualiza somente as propostas permitidas
// pelas políticas configuradas no banco.
// =========================================================


// =========================================================
// ## 1. ESTADO DO HISTÓRICO
// =========================================================

// Lista carregada do Supabase.
let historicoPropostas = [];


// Evita múltiplos carregamentos simultâneos.
let historicoCarregando = false;


// =========================================================
// ## 2. FUNÇÕES AUXILIARES
// =========================================================


// ---------------------------------------------------------
// ## 2.1 Escape de conteúdo HTML
// ---------------------------------------------------------

function escaparHistorico(valor) {

  return esc(
    valor ?? ''
  );
}


// ---------------------------------------------------------
// ## 2.2 Formatação de data
// ---------------------------------------------------------

function formatarDataHistorico(valor) {

  if (!valor) {

    return '—';

  }


  return brDate(
    String(valor)
      .slice(
        0,
        10
      )
  );
}


// ---------------------------------------------------------
// ## 2.3 Identificação da revisão atual
// ---------------------------------------------------------

function revisaoAtualDaLista(
  proposta
) {

  const revisoes =
    Array.isArray(
      proposta.revisoes_proposta
    )
      ? proposta.revisoes_proposta
      : [];


  return (

    revisoes.find(
      revisao =>
        Number(
          revisao.numero_revisao
        ) ===
        Number(
          proposta.revisao_atual
        )
    )

    ||

    [...revisoes]
      .sort(
        (a, b) =>
          Number(
            b.numero_revisao
          ) -
          Number(
            a.numero_revisao
          )
      )[0]

    ||

    null
  );
}


// =========================================================
// ## 3. BUSCA E FILTRO
// =========================================================


// ---------------------------------------------------------
// ## 3.1 Normalização do texto de busca
// ---------------------------------------------------------

function normalizarBuscaHistorico(
  texto
) {

  return String(
    texto || ''
  )
    .toLocaleLowerCase(
      'pt-BR'
    )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    );
}


// ---------------------------------------------------------
// ## 3.2 Filtragem das propostas
// ---------------------------------------------------------

function propostasFiltradasHistorico() {

  const termo =
    normalizarBuscaHistorico(
      document
        .getElementById(
          'historicoBusca'
        )
        ?.value
    );


  if (!termo) {

    return historicoPropostas;

  }


  return historicoPropostas.filter(
    proposta => {

      const revisao =
        revisaoAtualDaLista(
          proposta
        );


      const texto = [

        proposta.numero,

        revisao?.nome_proposta,

        revisao?.cliente,

        revisao?.cnpj,

        revisao?.vendedor_nome,

        revisao?.status,

        revisao?.data_proposta

      ].join(' ');


      return normalizarBuscaHistorico(
        texto
      ).includes(
        termo
      );

    }
  );
}


// =========================================================
// ## 4. BADGE DE STATUS
// =========================================================

function badgeHistorico(
  status
) {

  const statusNormalizado =
    String(
      status || 'rascunho'
    )
      .toLowerCase();


  if (
    statusNormalizado === 'enviada'
  ) {

    return (
      '<span class="history-badge enviada">' +
      'ENVIADA' +
      '</span>'
    );

  }


  return (
    '<span class="history-badge rascunho">' +
    'RASCUNHO' +
    '</span>'
  );
}


// =========================================================
// ## 5. RENDERIZAÇÃO DA TABELA
// =========================================================

function renderizarHistorico() {

  const corpo =
    document.getElementById(
      'historicoBody'
    );


  const vazio =
    document.getElementById(
      'historicoVazio'
    );


  const contador =
    document.getElementById(
      'historicoContador'
    );


  if (!corpo) {

    return;

  }


  const lista =
    propostasFiltradasHistorico();


  corpo.innerHTML =
    '';


  contador.textContent =
    `${lista.length} proposta(s)`;


  vazio.style.display =
    lista.length
      ? 'none'
      : 'block';


  lista.forEach(
    proposta => {

      const revisao =
        revisaoAtualDaLista(
          proposta
        );


      if (!revisao) {

        return;

      }


      const tr =
        document.createElement(
          'tr'
        );


      tr.innerHTML = `
        <td>
          <b>
            #${escaparHistorico(proposta.numero)}
          </b>
        </td>

        <td>
          <b>
            ${
              escaparHistorico(
                revisao.nome_proposta ||
                'Sem nome'
              )
            }
          </b>

          <div class="history-muted">
            ${
              escaparHistorico(
                revisao.cliente ||
                'Cliente não informado'
              )
            }
          </div>
        </td>

        <td>
          ${
            escaparHistorico(
              revisao.cnpj ||
              '—'
            )
          }
        </td>

        <td>
          ${
            escaparHistorico(
              revisao.vendedor_nome ||
              '—'
            )
          }
        </td>

        <td>
          ${
            formatarDataHistorico(
              revisao.data_proposta
            )
          }
        </td>

        <td>
          R${
            escaparHistorico(
              revisao.numero_revisao
            )
          }
        </td>

        <td>
          ${
            badgeHistorico(
              revisao.status
            )
          }
        </td>

        <td>
          <button
            type="button"
            class="btn navy history-open"
            onclick="abrirPropostaHistorico('${escaparHistorico(proposta.id)}')"
          >
            Abrir
          </button>
        </td>
      `;


      corpo.appendChild(
        tr
      );

    }
  );
}


// =========================================================
// ## 6. CARREGAMENTO DAS PROPOSTAS
// =========================================================

async function carregarHistorico() {

  // Evita executar duas consultas ao mesmo tempo.
  if (
    historicoCarregando
  ) {

    return;

  }


  const corpo =
    document.getElementById(
      'historicoBody'
    );


  const vazio =
    document.getElementById(
      'historicoVazio'
    );


  const contador =
    document.getElementById(
      'historicoContador'
    );


  historicoCarregando =
    true;


  // -------------------------------------------------------
  // ## 6.1 Estado visual de carregamento
  // -------------------------------------------------------

  if (corpo) {

    corpo.innerHTML =
      `
        <tr>
          <td
            colspan="8"
            class="history-loading"
          >
            Carregando propostas...
          </td>
        </tr>
      `;

  }


  if (vazio) {

    vazio.style.display =
      'none';

  }


  if (contador) {

    contador.textContent =
      'Carregando...';

  }


  // -------------------------------------------------------
  // ## 6.2 Consulta ao Supabase
  // -------------------------------------------------------

  try {

    historicoPropostas =
      await listarPropostas({
        limite: 200
      });


    renderizarHistorico();

  } catch (erro) {

    console.error(
      'Erro ao carregar histórico:',
      erro
    );


    // -----------------------------------------------------
    // ## 6.3 Tratamento de erro
    // -----------------------------------------------------

    if (corpo) {

      corpo.innerHTML =
        '';

    }


    if (contador) {

      contador.textContent =
        'Erro ao carregar';

    }


    if (vazio) {

      vazio.style.display =
        'block';


      vazio.innerHTML =
        '<b>Não foi possível carregar o histórico.</b><br>' +
        escaparHistorico(
          erro?.message ||
          'Erro desconhecido.'
        );

    }

  } finally {

    historicoCarregando =
      false;

  }
}


// =========================================================
// ## 7. ABERTURA DA PÁGINA DE HISTÓRICO
// =========================================================

async function abrirHistorico(
  btn
) {

  showPage(
    'historicoPage',
    btn
  );


  await carregarHistorico();


  // Após a página carregar, envia o foco
  // automaticamente para o campo de busca.
  setTimeout(
    () => {

      document
        .getElementById(
          'historicoBusca'
        )
        ?.focus();

    },
    50
  );
}


// =========================================================
// ## 8. ABERTURA DE UMA PROPOSTA
// =========================================================

async function abrirPropostaHistorico(
  propostaId
) {

  const botoes =
    document.querySelectorAll(
      '.history-open'
    );


  // Bloqueia temporariamente todos os botões Abrir
  // enquanto a proposta é carregada.
  botoes.forEach(
    botao => {

      botao.disabled =
        true;

    }
  );


  try {

    toastMsg(
      'Abrindo proposta...'
    );


    // -----------------------------------------------------
    // ## 8.1 Consulta completa da proposta
    // -----------------------------------------------------

    const proposta =
      await obterPropostaCompleta(
        propostaId
      );


    // -----------------------------------------------------
    // ## 8.2 Preenchimento do formulário
    // -----------------------------------------------------

    aplicarPropostaNoFormulario(
      proposta
    );


    // -----------------------------------------------------
    // ## 8.3 Navegação para a proposta
    // -----------------------------------------------------

    showPage(
      'orcamentoPage',
      null
    );


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });


    // -----------------------------------------------------
    // ## 8.4 Confirmação visual
    // -----------------------------------------------------

    const revisao =
      revisaoAtualDaLista(
        proposta
      );


    toastMsg(
      `Proposta #${proposta.numero} ` +
      `• R${
        revisao?.numero_revisao ??
        proposta.revisao_atual
      } aberta`
    );

  } catch (erro) {

    console.error(
      'Erro ao abrir proposta:',
      erro
    );


    alert(
      'Não foi possível abrir a proposta.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  } finally {

    botoes.forEach(
      botao => {

        botao.disabled =
          false;

      }
    );

  }
}


// =========================================================
// ## 9. LIMPEZA DA BUSCA
// =========================================================

function limparBuscaHistorico() {

  const campo =
    document.getElementById(
      'historicoBusca'
    );


  if (!campo) {

    return;

  }


  campo.value =
    '';


  renderizarHistorico();


  campo.focus();
}


// =========================================================
// ## 10. INICIALIZAÇÃO DO HISTÓRICO
// =========================================================

function iniciarHistorico() {

  const busca =
    document.getElementById(
      'historicoBusca'
    );


  if (busca) {

    busca.addEventListener(
      'input',
      renderizarHistorico
    );

  }
}


// Inicializa os eventos específicos do histórico
// assim que este módulo é carregado.
iniciarHistorico();