// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: historico.js
//
// Responsabilidade:
// - Carregar, pesquisar e filtrar propostas
// - Exibir revisão atual
// - Listar R0 / R1 / R2 / R3...
// - Consultar revisão antiga em somente leitura
// - Gerar PDF de uma revisão específica
// =========================================================

// =========================================================
// ## 1. ESTADO
// =========================================================

let historicoPropostas = [];
let historicoCarregando = false;
let historicoRevisoesCarregando = false;
let historicoPropostaRevisoesAtual = null;
let historicoAplicarPropostaOriginal = null;

// =========================================================
// ## 2. AUXILIARES
// =========================================================

function escaparHistorico(valor) {
  return esc(valor ?? '');
}

function formatarDataHistorico(valor) {
  if (!valor) return '—';
  return brDate(String(valor).slice(0, 10));
}

function revisaoAtualDaLista(proposta) {
  const revisoes = Array.isArray(proposta?.revisoes_proposta)
    ? proposta.revisoes_proposta
    : [];

  return (
    revisoes.find(
      revisao =>
        Number(revisao.numero_revisao) ===
        Number(proposta.revisao_atual)
    ) ||
    [...revisoes].sort(
      (a, b) => Number(b.numero_revisao) - Number(a.numero_revisao)
    )[0] ||
    null
  );
}

function localizarRevisaoHistorico(proposta, revisaoId) {
  const revisoes = Array.isArray(proposta?.revisoes_proposta)
    ? proposta.revisoes_proposta
    : [];

  return revisoes.find(
    revisao => String(revisao.id) === String(revisaoId)
  ) || null;
}

function nomeOrigemHistorico(origem) {
  const nomes = {
    leads_mkt: 'LEADS - MKT',
    prospeccao: 'PROSPECÇÃO',
    gestao_carteira: 'GESTÃO DE CARTEIRA'
  };

  return nomes[origem] || 'SEM ORIGEM';
}

function nomeTimeHistorico(time) {
  const nomes = {
    pharma: 'Pharma',
    food: 'Food',
    revenda: 'Revenda'
  };

  return nomes[String(time || '').toLowerCase()] || 'Sem Time';
}

// =========================================================
// ## 3. BUSCA E FILTROS
// =========================================================

function normalizarBuscaHistorico(texto) {
  return String(texto || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function obterFiltrosHistorico() {
  return {
    busca: normalizarBuscaHistorico(
      document.getElementById('historicoBusca')?.value
    ),

    origem:
      document.getElementById('historicoFiltroOrigem')?.value || '',

    statusComercial:
      document.getElementById('historicoFiltroStatusComercial')?.value || '',

    statusRevisao:
      document.getElementById('historicoFiltroStatusRevisao')?.value || ''
  };
}

function propostasFiltradasHistorico() {
  const filtros = obterFiltrosHistorico();

  return historicoPropostas.filter(proposta => {
    const revisao = revisaoAtualDaLista(proposta);

    if (!revisao) {
      return false;
    }

    if (
      filtros.origem &&
      proposta.origem_comercial !== filtros.origem
    ) {
      return false;
    }

    if (
      filtros.statusComercial &&
      proposta.status_comercial !== filtros.statusComercial
    ) {
      return false;
    }

    if (
      filtros.statusRevisao &&
      String(revisao.status || '').toLowerCase() !==
        filtros.statusRevisao
    ) {
      return false;
    }

    if (filtros.busca) {
      const textoBusca = [
        proposta.numero,
        revisao.nome_proposta,
        revisao.cliente,
        revisao.cnpj,
        revisao.vendedor_nome
      ].join(' ');

      if (
        !normalizarBuscaHistorico(textoBusca)
          .includes(filtros.busca)
      ) {
        return false;
      }
    }

    return true;
  });
}

// =========================================================
// ## 4. BADGES
// =========================================================

function badgeRevisaoHistorico(status) {
  const normalizado =
    String(status || 'rascunho')
      .toLowerCase();

  if (normalizado === 'enviada') {
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

function badgeStatusComercialHistorico(status) {
  const normalizado =
    String(status || 'proposta')
      .toLowerCase();

  const nomes = {
    proposta: 'PROPOSTA',
    andamento: 'ANDAMENTO',
    concluido: 'CONCLUÍDO',
    nao_conquistado: 'NÃO CONQUISTADO'
  };

  const permitidos = [
    'proposta',
    'andamento',
    'concluido',
    'nao_conquistado'
  ];

  const classe =
    permitidos.includes(normalizado)
      ? normalizado
      : 'proposta';

  return (
    `<span class="history-badge commercial ${classe}">` +
    escaparHistorico(
      nomes[normalizado] || 'PROPOSTA'
    ) +
    '</span>'
  );
}

function badgeOrigemHistorico(origem) {
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
      nomeOrigemHistorico(origem)
    ) +
    '</span>'
  );
}

function badgeRevisaoAtualHistorico() {
  return (
    '<span class="history-current-badge">' +
    'ATUAL' +
    '</span>'
  );
}

// =========================================================
// ## 5. PROTEÇÃO DO RASCUNHO LOCAL
// =========================================================

function capturarLocalStorageHistorico() {
  const snapshot = {};
  [KEY, SELLERS_KEY].forEach(base => {
    const chave = chaveLocalUsuario(base);
    if (chave) snapshot[chave] = localStorage.getItem(chave);
  });
  return snapshot;
}

function restaurarLocalStorageHistorico(snapshot) {
  // Não capturar/restaurar tokens do Supabase nem dados de outros usuários.
  [KEY, SELLERS_KEY].forEach(base => {
    const chave = chaveLocalUsuario(base);
    if (!chave || !Object.prototype.hasOwnProperty.call(snapshot, chave)) return;
    const valor = snapshot[chave];
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  });
}

// =========================================================
// ## 6. CONSULTA HISTÓRICA NO FORMULÁRIO
// =========================================================

function garantirBannerConsultaHistorica() {
  let banner =
    document.getElementById(
      'revisaoHistoricaBanner'
    );

  if (banner) {
    return banner;
  }

  const pagina =
    document.getElementById(
      'orcamentoPage'
    );

  if (!pagina) {
    return null;
  }

  banner =
    document.createElement(
      'div'
    );

  banner.id =
    'revisaoHistoricaBanner';

  banner.className =
    'revisao-historica-banner';

  banner.hidden =
    true;

  pagina.prepend(
    banner
  );

  return banner;
}

function aplicarEstadoConsultaHistorica(
  ativa,
  proposta,
  revisao
) {
  document.body.classList.toggle(
    'consulta-historica-ativa',
    Boolean(ativa)
  );

  const banner =
    garantirBannerConsultaHistorica();

  if (!ativa) {
    if (banner) {
      banner.hidden = true;
    }

    [
      'origemComercial',
      'motivoNaoConquistado',
      'detalheNaoConquistado'
    ].forEach(id => {
      const elemento =
        document.getElementById(id);

      if (elemento) {
        elemento.disabled = false;
      }
    });

    if (
      typeof atualizarInterfaceGestaoComercial ===
      'function'
    ) {
      atualizarInterfaceGestaoComercial();
    }

    if (
      typeof atualizarInterfaceRevisao ===
      'function'
    ) {
      atualizarInterfaceRevisao();
    }

    return;
  }

  if (banner) {
    banner.hidden = false;

    banner.innerHTML = `
      <div>

        <strong>
          R${escaparHistorico(
            revisao?.numero_revisao ?? '—'
          )} • SOMENTE LEITURA
        </strong>

        <span>
          Você está consultando uma revisão histórica da proposta
          #${escaparHistorico(
            proposta?.numero ?? '—'
          )}.
          Alterações não são permitidas.
        </span>

      </div>

      <button
        type="button"
        class="btn light"
        onclick="abrirRevisaoAtualDaConsultaHistorica()"
      >
        Abrir revisão atual
      </button>
    `;
  }

  [
    'orcamento',
    'orcData',
    'validade',
    'timeEquipe',

    'cliente',
    'comprador',
    'cnpj',
    'ie',
    'telefone',
    'email',
    'endereco',
    'bairro',
    'cidade',

    'cliche',
    'pagamento',
    'vendedor',
    'projeto',
    'previsao',
    'destinacao',
    'frete',
    'regras',

    'mostrarTotalPdf',

    'btnBuscarCnpj',
    'arteInput',

    'origemComercial',
    'statusComercial',
    'motivoNaoConquistado',
    'detalheNaoConquistado',
    'btnAtualizarStatusComercial'
  ].forEach(id => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.disabled = true;
    }
  });

  document
    .querySelectorAll(
      '#itemsEditor input, ' +
      '#itemsEditor textarea, ' +
      '#itemsEditor select, ' +
      '#itemsEditor button, ' +
      '[onclick="addItem()"], ' +
      '[onclick="duplicateLast()"], ' +
      '[onclick="removeArts()"]'
    )
    .forEach(elemento => {
      elemento.disabled = true;
    });

  const status =
    document.getElementById(
      'saveStatus'
    );

  if (status) {
    status.textContent =
      `Proposta #${proposta?.numero ?? '—'} ` +
      `• R${revisao?.numero_revisao ?? '—'} ` +
      '• CONSULTA • SOMENTE LEITURA';
  }
}

function instalarSuporteRevisoesHistoricas() {
  if (
    window.__agenflexRevisoesHistoricasInstalado
  ) {
    return true;
  }

  if (
    typeof window.aplicarPropostaNoFormulario !==
    'function'
  ) {
    return false;
  }

  historicoAplicarPropostaOriginal =
    window.aplicarPropostaNoFormulario;

  window.aplicarPropostaNoFormulario =
    function(
      proposta,
      opcoes = {}
    ) {
      const revisaoId =
        opcoes?.revisaoId || null;

      let propostaParaAbrir =
        proposta;

      let revisaoSelecionada =
        null;

      if (revisaoId) {
        revisaoSelecionada =
          localizarRevisaoHistorico(
            proposta,
            revisaoId
          );

        if (!revisaoSelecionada) {
          throw new Error(
            'A revisão selecionada não foi encontrada.'
          );
        }

        propostaParaAbrir = {
          ...proposta,

          revisao_atual:
            revisaoSelecionada
              .numero_revisao
        };
      }

      const historica =
        Boolean(
          revisaoSelecionada &&
          Number(
            revisaoSelecionada
              .numero_revisao
          ) !==
          Number(
            proposta.revisao_atual
          )
        );

      const snapshotLocalStorage =
        historica
          ? capturarLocalStorageHistorico()
          : null;

      const resultado =
        historicoAplicarPropostaOriginal(
          propostaParaAbrir
        );

      if (
        historica &&
        snapshotLocalStorage
      ) {
        restaurarLocalStorageHistorico(
          snapshotLocalStorage
        );
      }

      const revisaoCarregada =
        revisaoSelecionada ||
        resultado ||
        revisaoAtualDaLista(
          proposta
        );

      window.__agenflexConsultaHistorica = {
        ativa:
          historica,

        propostaId:
          proposta?.id || null,

        revisaoId:
          revisaoCarregada?.id || null
      };

      aplicarEstadoConsultaHistorica(
        historica,
        proposta,
        revisaoCarregada
      );

      return resultado;
    };

  window.__agenflexRevisoesHistoricasInstalado =
    true;

  return true;
}

async function abrirRevisaoAtualDaConsultaHistorica() {
  const propostaId =
    window.__agenflexConsultaHistorica
      ?.propostaId;

  if (!propostaId) {
    return;
  }

  try {
    const proposta =
      await obterPropostaCompleta(
        propostaId
      );

    instalarSuporteRevisoesHistoricas();

    aplicarPropostaNoFormulario(
      proposta
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    toastMsg(
      `Revisão atual R${proposta.revisao_atual} aberta`
    );

  } catch (erro) {
    console.error(
      'Erro ao abrir revisão atual:',
      erro
    );

    alert(
      'Não foi possível abrir a revisão atual.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );
  }
}

// =========================================================
// ## 7. MODAL DE REVISÕES
// =========================================================

function montarModalRevisoesHistorico() {
  if (
    document.getElementById(
      'historicoRevisoesModal'
    )
  ) {
    return;
  }

  const modal =
    document.createElement(
      'div'
    );

  modal.id =
    'historicoRevisoesModal';

  modal.className =
    'history-revisions-modal';

  modal.hidden =
    true;

  modal.innerHTML = `

    <div
      class="history-revisions-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historicoRevisoesTitulo"
    >

      <div class="history-revisions-head">

        <div>

          <span class="history-revisions-kicker">
            HISTÓRICO DA PROPOSTA
          </span>

          <h3 id="historicoRevisoesTitulo">
            Revisões
          </h3>

          <p id="historicoRevisoesSubtitulo">
            —
          </p>

        </div>

        <button
          type="button"
          class="history-revisions-close"
          aria-label="Fechar"
          onclick="fecharRevisoesHistorico()"
        >
          ×
        </button>

      </div>

      <div
        id="historicoRevisoesConteudo"
        class="history-revisions-content"
      ></div>

    </div>
  `;

  modal.addEventListener(
    'click',
    evento => {
      if (
        evento.target === modal
      ) {
        fecharRevisoesHistorico();
      }
    }
  );

  document.body.appendChild(
    modal
  );
}

async function abrirRevisoesHistorico(
  propostaId
) {
  if (
    historicoRevisoesCarregando
  ) {
    return;
  }

  montarModalRevisoesHistorico();

  const modal =
    document.getElementById(
      'historicoRevisoesModal'
    );

  const conteudo =
    document.getElementById(
      'historicoRevisoesConteudo'
    );

  if (
    !modal ||
    !conteudo
  ) {
    return;
  }

  modal.hidden =
    false;

  document.body.classList.add(
    'history-modal-open'
  );

  conteudo.innerHTML = `
    <div class="history-revisions-loading">
      Carregando revisões...
    </div>
  `;

  historicoRevisoesCarregando =
    true;

  try {
    const proposta =
      await obterPropostaCompleta(
        propostaId
      );

    historicoPropostaRevisoesAtual =
      proposta;

    renderizarRevisoesHistorico(
      proposta
    );

  } catch (erro) {
    console.error(
      'Erro ao carregar revisões:',
      erro
    );

    conteudo.innerHTML = `
      <div class="history-revisions-error">

        <b>
          Não foi possível carregar as revisões.
        </b>

        <span>
          ${escaparHistorico(
            erro?.message ||
            'Erro desconhecido.'
          )}
        </span>

      </div>
    `;

  } finally {
    historicoRevisoesCarregando =
      false;
  }
}

function renderizarRevisoesHistorico(
  proposta
) {
  const conteudo =
    document.getElementById(
      'historicoRevisoesConteudo'
    );

  const titulo =
    document.getElementById(
      'historicoRevisoesTitulo'
    );

  const subtitulo =
    document.getElementById(
      'historicoRevisoesSubtitulo'
    );

  if (!conteudo) {
    return;
  }

  const revisoes =
    Array.isArray(
      proposta.revisoes_proposta
    )
      ? [
          ...proposta.revisoes_proposta
        ]
      : [];

  revisoes.sort(
    (a, b) =>
      Number(
        b.numero_revisao
      ) -
      Number(
        a.numero_revisao
      )
  );

  const atual =
    revisaoAtualDaLista(
      proposta
    );

  if (titulo) {
    titulo.textContent =
      `Revisões da proposta #${proposta.numero}`;
  }

  if (subtitulo) {
    subtitulo.textContent =
      atual?.nome_proposta ||
      atual?.cliente ||
      'Histórico de revisões';
  }

  if (!revisoes.length) {
    conteudo.innerHTML = `
      <div class="history-revisions-empty">
        Nenhuma revisão encontrada.
      </div>
    `;

    return;
  }

  conteudo.innerHTML =
    '';

  revisoes.forEach(
    revisao => {
      const ehAtual =
        Number(
          revisao.numero_revisao
        ) ===
        Number(
          proposta.revisao_atual
        );

      const dataReferencia =
        revisao.enviado_em ||
        revisao.updated_at ||
        revisao.data_proposta;

      const item =
        document.createElement(
          'div'
        );

      item.className =
        'history-revision-card' +
        (
          ehAtual
            ? ' current'
            : ''
        );

      item.innerHTML = `

        <div class="history-revision-card-main">

          <div class="history-revision-card-title">

            <strong>
              R${escaparHistorico(
                revisao.numero_revisao
              )}
            </strong>

            ${badgeRevisaoHistorico(
              revisao.status
            )}

            ${
              ehAtual
                ? badgeRevisaoAtualHistorico()
                : ''
            }

          </div>

          <div class="history-revision-card-meta">

            <span>
              ${formatarDataHistorico(
                dataReferencia
              )}
            </span>

            <span>
              ${escaparHistorico(
                nomeTimeHistorico(
                  revisao.time_equipe
                )
              )}
            </span>

            <span>
              ${escaparHistorico(
                revisao.vendedor_nome ||
                'Vendedor não informado'
              )}
            </span>

          </div>

          <div class="history-revision-card-client">
            ${escaparHistorico(
              revisao.cliente ||
              'Cliente não informado'
            )}
          </div>

        </div>

        <div class="history-revision-card-actions">

          <button
            type="button"
            class="btn ${
              ehAtual
                ? 'navy'
                : 'light'
            }"
            onclick="abrirRevisaoEspecificaHistorico(
              '${escaparHistorico(
                proposta.id
              )}',
              '${escaparHistorico(
                revisao.id
              )}',
              false
            )"
          >
            ${
              ehAtual
                ? 'Abrir'
                : 'Consultar'
            }
          </button>

          <button
            type="button"
            class="btn red"
            onclick="abrirRevisaoEspecificaHistorico(
              '${escaparHistorico(
                proposta.id
              )}',
              '${escaparHistorico(
                revisao.id
              )}',
              true
            )"
          >
            Gerar PDF
          </button>

        </div>
      `;

      conteudo.appendChild(
        item
      );
    }
  );
}

function fecharRevisoesHistorico() {
  const modal =
    document.getElementById(
      'historicoRevisoesModal'
    );

  if (modal) {
    modal.hidden = true;
  }

  document.body.classList.remove(
    'history-modal-open'
  );

  historicoPropostaRevisoesAtual =
    null;
}

async function abrirRevisaoEspecificaHistorico(
  propostaId,
  revisaoId,
  gerarPdf = false
) {
  try {
    toastMsg(
      gerarPdf
        ? 'Preparando PDF da revisão...'
        : 'Abrindo revisão...'
    );

    let proposta =
      historicoPropostaRevisoesAtual;

    if (
      !proposta ||
      String(proposta.id) !==
      String(propostaId)
    ) {
      proposta =
        await obterPropostaCompleta(
          propostaId
        );
    }

    const revisao =
      localizarRevisaoHistorico(
        proposta,
        revisaoId
      );

    if (!revisao) {
      throw new Error(
        'A revisão selecionada não foi encontrada.'
      );
    }

    if (
      !instalarSuporteRevisoesHistoricas()
    ) {
      throw new Error(
        'O módulo de proposta ainda não está disponível.'
      );
    }

    aplicarPropostaNoFormulario(
      proposta,
      {
        revisaoId:
          revisao.id
      }
    );

    fecharRevisoesHistorico();

    showPage(
      'orcamentoPage',
      null
    );

    window.scrollTo({
      top: 0,
      behavior:
        gerarPdf
          ? 'auto'
          : 'smooth'
    });

    const ehAtual =
      Number(
        revisao.numero_revisao
      ) ===
      Number(
        proposta.revisao_atual
      );

    toastMsg(
      `Proposta #${proposta.numero} ` +
      `• R${revisao.numero_revisao} ` +
      (
        ehAtual
          ? 'aberta'
          : 'em consulta'
      )
    );

    if (gerarPdf) {
      setTimeout(
        () => {
          printPDF();
        },
        180
      );
    }

  } catch (erro) {
    console.error(
      'Erro ao abrir revisão específica:',
      erro
    );

    alert(
      'Não foi possível abrir a revisão selecionada.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );
  }
}

// =========================================================
// ## 8. TABELA DO HISTÓRICO
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
    contador.textContent =
      lista.length ===
      historicoPropostas.length

        ? `${lista.length} proposta(s)`

        : `${lista.length} de ` +
          `${historicoPropostas.length} proposta(s)`;
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

      const quantidadeRevisoes =
        Array.isArray(
          proposta.revisoes_proposta
        )
          ? proposta
              .revisoes_proposta
              .length
          : 0;

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
            ${escaparHistorico(
              revisao.nome_proposta ||
              'Sem nome'
            )}
          </b>

          <div class="history-muted">
            ${escaparHistorico(
              revisao.cliente ||
              'Cliente não informado'
            )}
          </div>

          <div class="history-origin-wrap">
            ${badgeOrigemHistorico(
              proposta.origem_comercial
            )}
          </div>

        </td>

        <td>
          ${escaparHistorico(
            revisao.cnpj ||
            '—'
          )}
        </td>

        <td>
          ${escaparHistorico(
            revisao.vendedor_nome ||
            '—'
          )}
        </td>

        <td>
          ${formatarDataHistorico(
            revisao.data_proposta
          )}
        </td>

        <td>

          <div class="history-revision">

            <b>
              R${escaparHistorico(
                revisao.numero_revisao
              )}
            </b>

            ${badgeRevisaoHistorico(
              revisao.status
            )}

            <span class="history-revision-count">
              ${quantidadeRevisoes} revisão(ões)
            </span>

          </div>

        </td>

        <td>
          ${badgeStatusComercialHistorico(
            proposta.status_comercial
          )}
        </td>

        <td>

          <div class="history-actions">

            <button
              type="button"
              class="btn light history-revisions"
              onclick="abrirRevisoesHistorico('${escaparHistorico(
                proposta.id
              )}')"
            >
              Revisões
            </button>

            <button
              type="button"
              class="btn navy history-open"
              onclick="abrirPropostaHistorico('${escaparHistorico(
                proposta.id
              )}')"
            >
              Abrir
            </button>

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
// ## 9. CARREGAMENTO
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
// ## 10. ABERTURA DA PÁGINA E PROPOSTA ATUAL
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

    instalarSuporteRevisoesHistoricas();

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
// ## 11. LIMPEZA DOS FILTROS
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

function limparBuscaHistorico() {
  limparFiltrosHistorico();
}

// =========================================================
// ## 12. INICIALIZAÇÃO
// =========================================================

function iniciarHistorico() {
  instalarSuporteRevisoesHistoricas();

  montarModalRevisoesHistorico();

  garantirBannerConsultaHistorica();

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

  busca?.addEventListener(
    'input',
    renderizarHistorico
  );

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

  document.addEventListener(
    'keydown',
    evento => {
      if (
        evento.key === 'Escape' &&
        !document
          .getElementById(
            'historicoRevisoesModal'
          )
          ?.hidden
      ) {
        fecharRevisoesHistorico();
      }
    }
  );
}

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    iniciarHistorico
  );

} else {
  iniciarHistorico();
}