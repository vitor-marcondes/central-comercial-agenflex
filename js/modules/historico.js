// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: historico.js
//
// Responsabilidade:
// - Carregar propostas salvas no Supabase
// - Pesquisar propostas por dados de identificação
// - Filtrar propostas por origem
// - Filtrar propostas por status comercial
// - Filtrar propostas por status da revisão
// - Identificar a revisão atual
// - Renderizar a tabela do histórico
// - Abrir propostas existentes
//
// IMPORTANTE:
//
// Busca livre:
// → número
// → nome da proposta
// → cliente
// → CNPJ
// → vendedor
//
// Filtros:
// → origem comercial
// → status comercial
// → status da revisão
// =========================================================


// =========================================================
// ## 1. ESTADO DO HISTÓRICO
// =========================================================

let historicoPropostas = [];

let historicoCarregando = false;


// =========================================================
// ## 2. FUNÇÕES AUXILIARES
// =========================================================


// ---------------------------------------------------------
// ## 2.1 Escape HTML
// ---------------------------------------------------------

function escaparHistorico(
  valor
) {

  return esc(
    valor ?? ''
  );
}


// ---------------------------------------------------------
// ## 2.2 Formatação de data
// ---------------------------------------------------------

function formatarDataHistorico(
  valor
) {

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
// ## 2.3 Revisão atual
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


// ---------------------------------------------------------
// ## 2.4 Nome da origem
// ---------------------------------------------------------

function nomeOrigemHistorico(
  origem
) {

  const nomes = {

    leads_mkt:
      'LEADS - MKT',

    prospeccao:
      'PROSPECÇÃO',

    gestao_carteira:
      'GESTÃO DE CARTEIRA'
  };


  return nomes[origem] ||
    'SEM ORIGEM';
}


// ---------------------------------------------------------
// ## 2.5 Nome do status comercial
// ---------------------------------------------------------

function nomeStatusComercialHistorico(
  status
) {

  const nomes = {

    proposta:
      'PROPOSTA',

    andamento:
      'ANDAMENTO',

    concluido:
      'CONCLUÍDO',

    nao_conquistado:
      'NÃO CONQUISTADO'
  };


  return nomes[status] ||
    'PROPOSTA';
}


// =========================================================
// ## 3. BUSCA E FILTROS
// =========================================================


// ---------------------------------------------------------
// ## 3.1 Normalizar texto
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
    )
    .trim();
}


// ---------------------------------------------------------
// ## 3.2 Ler filtros
// ---------------------------------------------------------

function obterFiltrosHistorico() {

  return {

    busca:
      normalizarBuscaHistorico(
        document
          .getElementById(
            'historicoBusca'
          )
          ?.value
      ),

    origem:
      document
        .getElementById(
          'historicoFiltroOrigem'
        )
        ?.value || '',

    statusComercial:
      document
        .getElementById(
          'historicoFiltroStatusComercial'
        )
        ?.value || '',

    statusRevisao:
      document
        .getElementById(
          'historicoFiltroStatusRevisao'
        )
        ?.value || ''
  };
}


// ---------------------------------------------------------
// ## 3.3 Aplicação da busca e filtros
// ---------------------------------------------------------

function propostasFiltradasHistorico() {

  const filtros =
    obterFiltrosHistorico();


  return historicoPropostas.filter(
    proposta => {

      const revisao =
        revisaoAtualDaLista(
          proposta
        );


      if (!revisao) {

        return false;

      }


      // ---------------------------------------------------
      // Filtro por origem
      // ---------------------------------------------------

      if (
        filtros.origem &&
        proposta.origem_comercial !==
        filtros.origem
      ) {

        return false;

      }


      // ---------------------------------------------------
      // Filtro por status comercial
      // ---------------------------------------------------

      if (
        filtros.statusComercial &&
        proposta.status_comercial !==
        filtros.statusComercial
      ) {

        return false;

      }


      // ---------------------------------------------------
      // Filtro por status da revisão
      // ---------------------------------------------------

      if (
        filtros.statusRevisao &&
        String(
          revisao.status || ''
        ).toLowerCase() !==
        filtros.statusRevisao
      ) {

        return false;

      }


      // ---------------------------------------------------
      // Busca textual
      //
      // Não inclui:
      // - origem
      // - status comercial
      // - status da revisão
      //
      // Esses dados pertencem aos filtros.
      // ---------------------------------------------------

      if (
        filtros.busca
      ) {

        const textoBusca = [

          proposta.numero,

          revisao.nome_proposta,

          revisao.cliente,

          revisao.cnpj,

          revisao.vendedor_nome

        ].join(' ');


        if (
          !normalizarBuscaHistorico(
            textoBusca
          ).includes(
            filtros.busca
          )
        ) {

          return false;

        }

      }


      return true;

    }
  );
}


// =========================================================
// ## 4. BADGES
// =========================================================


// ---------------------------------------------------------
// ## 4.1 Status da revisão
// ---------------------------------------------------------

function badgeRevisaoHistorico(
  status
) {

  const normalizado =
    String(
      status || 'rascunho'
    ).toLowerCase();


  if (
    normalizado ===
    'enviada'
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


// ---------------------------------------------------------
// ## 4.2 Status comercial
// ---------------------------------------------------------

function badgeStatusComercialHistorico(
  status
) {

  const normalizado =
    String(
      status || 'proposta'
    ).toLowerCase();


  const nomes = {

    proposta:
      'PROPOSTA',

    andamento:
      'ANDAMENTO',

    concluido:
      'CONCLUÍDO',

    nao_conquistado:
      'NÃO CONQUISTADO'
  };


  const permitidos = [

    'proposta',

    'andamento',

    'concluido',

    'nao_conquistado'
  ];


  const classe =
    permitidos.includes(
      normalizado
    )
      ? normalizado
      : 'proposta';


  return (
    `<span class="history-badge commercial ${classe}">` +
    escaparHistorico(
      nomes[normalizado] ||
      'PROPOSTA'
    ) +
    '</span>'
  );
}


// ---------------------------------------------------------
// ## 4.3 Origem comercial
// ---------------------------------------------------------

function badgeOrigemHistorico(
  origem
) {

  if (!origem) {

    return (
      '<span class="history-origin sem-origem">' +
      'SEM ORIGEM' +
      '</span>'
    );

  }


  const classe =
    String(origem)
      .replace(
        /[^a-z0-9_-]/gi,
        ''
      );


  return (
    `<span class="history-origin ${classe}">` +
    escaparHistorico(
      nomeOrigemHistorico(
        origem
      )
    ) +
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


  if (contador) {

    if (
      lista.length ===
      historicoPropostas.length
    ) {

      contador.textContent =
        `${lista.length} proposta(s)`;

    } else {

      contador.textContent =
        `${lista.length} de ` +
        `${historicoPropostas.length} proposta(s)`;

    }

  }


  if (vazio) {

    vazio.style.display =
      lista.length
        ? 'none'
        : 'block';

  }


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
            #${escaparHistorico(
              proposta.numero
            )}
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

          <div class="history-origin-wrap">
            ${
              badgeOrigemHistorico(
                proposta.origem_comercial
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

          <div class="history-revision">

            <b>
              R${
                escaparHistorico(
                  revisao.numero_revisao
                )
              }
            </b>

            ${
              badgeRevisaoHistorico(
                revisao.status
              )
            }

          </div>

        </td>


        <td>
          ${
            badgeStatusComercialHistorico(
              proposta.status_comercial
            )
          }
        </td>


        <td>

          <button
            type="button"
            class="btn navy history-open"
            onclick="abrirPropostaHistorico('${escaparHistorico(
              proposta.id
            )}')"
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
// ## 6. CARREGAMENTO
// =========================================================

async function carregarHistorico() {

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


  if (corpo) {

    corpo.innerHTML = `
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
// ## 7. ABERTURA DO HISTÓRICO
// =========================================================

async function abrirHistorico(
  btn
) {

  showPage(
    'historicoPage',
    btn
  );


  await carregarHistorico();


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
// ## 8. ABERTURA DE PROPOSTA
// =========================================================

async function abrirPropostaHistorico(
  propostaId
) {

  const botoes =
    document.querySelectorAll(
      '.history-open'
    );


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


    const proposta =
      await obterPropostaCompleta(
        propostaId
      );


    aplicarPropostaNoFormulario(
      proposta
    );


    showPage(
      'orcamentoPage',
      null
    );


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });


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
// ## 9. LIMPEZA DOS FILTROS
// =========================================================

function limparFiltrosHistorico() {

  const busca =
    document.getElementById(
      'historicoBusca'
    );


  const origem =
    document.getElementById(
      'historicoFiltroOrigem'
    );


  const statusComercial =
    document.getElementById(
      'historicoFiltroStatusComercial'
    );


  const statusRevisao =
    document.getElementById(
      'historicoFiltroStatusRevisao'
    );


  if (busca) {

    busca.value =
      '';

  }


  if (origem) {

    origem.value =
      '';

  }


  if (statusComercial) {

    statusComercial.value =
      '';

  }


  if (statusRevisao) {

    statusRevisao.value =
      '';

  }


  renderizarHistorico();


  busca?.focus();
}


// Mantido por compatibilidade caso exista alguma
// referência antiga no HTML.
function limparBuscaHistorico() {

  limparFiltrosHistorico();
}


// =========================================================
// ## 10. INICIALIZAÇÃO
// =========================================================

function iniciarHistorico() {

  const busca =
    document.getElementById(
      'historicoBusca'
    );


  const origem =
    document.getElementById(
      'historicoFiltroOrigem'
    );


  const statusComercial =
    document.getElementById(
      'historicoFiltroStatusComercial'
    );


  const statusRevisao =
    document.getElementById(
      'historicoFiltroStatusRevisao'
    );


  if (busca) {

    busca.addEventListener(
      'input',
      renderizarHistorico
    );

  }


  [
    origem,
    statusComercial,
    statusRevisao
  ].forEach(
    campo => {

      campo?.addEventListener(
        'change',
        renderizarHistorico
      );

    }
  );
}


iniciarHistorico();