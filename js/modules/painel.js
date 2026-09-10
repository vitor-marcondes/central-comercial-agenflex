// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: painel.js
//
// Responsabilidade:
// - Painel comercial por perfil
// - Visão Vendedor / Gestor / ADM
// - Meta mensal
// - Resultado conquistado
// - Filtros comerciais
// - Comparativo da equipe
// - Tabela das propostas
//
// Dependências:
// - js/services/painel.service.js
// - js/services/usuarios.service.js
// - js/services/propostas.service.js
// =========================================================


// =========================================================
// ## 1. ESTADO
// =========================================================

let painelDados = [];
let painelPerfis = [];
let painelVendedores = [];
let painelMetas = [];

let painelPerfilAtual = null;
let painelCarregando = false;
let painelMetasCarregando = false;


// =========================================================
// ## 2. AUXILIARES
// =========================================================

function escaparPainel(valor) {

  if (
    typeof esc === 'function'
  ) {

    return esc(
      valor ?? ''
    );

  }


  return String(
    valor ?? ''
  )
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function formatarMoedaPainel(valor) {

  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL'
    }
  ).format(
    Number(valor) || 0
  );
}


function formatarDataPainel(valor) {

  if (!valor) {

    return '—';

  }


  const iso =
    String(valor)
      .slice(
        0,
        10
      );


  if (
    typeof brDate === 'function'
  ) {

    return brDate(
      iso
    );

  }


  const [
    ano,
    mes,
    dia
  ] =
    iso.split('-');


  return `${dia}/${mes}/${ano}`;
}


// =========================================================
// ## 3. PERFIL
// =========================================================

function painelEhGestorOuAdm() {

  return [
    'gestor',
    'adm'
  ].includes(
    painelPerfilAtual
      ?.tipo_acesso
  );
}


function painelEhVendedor() {

  return (
    painelPerfilAtual
      ?.tipo_acesso ===
    'vendedor'
  );
}


// =========================================================
// ## 4. REVISÃO ATUAL
// =========================================================

function revisaoAtualPainel(
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
// ## 5. VALOR DA PROPOSTA
// =========================================================

function calcularValorRevisaoPainel(
  revisao
) {

  const itens =
    Array.isArray(
      revisao?.itens_revisao
    )
      ? revisao.itens_revisao
      : [];


  return itens.reduce(
    (
      total,
      item
    ) => {

      const quantidade =
        Number(
          item.quantidade
        ) || 0;


      const valorUnitario =
        Number(
          item.valor_unitario
        ) || 0;


      const ipiPercentual =
        Number(
          item.ipi_percentual
        ) || 0;


      const subtotal =
        quantidade *
        valorUnitario;


      const ipi =
        subtotal *
        ipiPercentual /
        100;


      return total +
        subtotal +
        ipi;

    },
    0
  );
}


// =========================================================
// ## 6. NORMALIZAR DADOS
// =========================================================

function normalizarDadosPainel(
  propostas
) {

  return (
    propostas || []
  )
    .map(
      proposta => {

        const revisao =
          revisaoAtualPainel(
            proposta
          );


        if (!revisao) {

          return null;

        }


        return {

          proposta,

          revisao,

          vendedorId:
            proposta
              .vendedor_responsavel_id ||
            null,

          valor:
            calcularValorRevisaoPainel(
              revisao
            )

        };

      }
    )
    .filter(
      Boolean
    );
}


// =========================================================
// ## 7. NOMES
// =========================================================

function nomeOrigemPainel(
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


function nomeStatusPainel(
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


function nomeMesPainel(
  mes
) {

  const meses = [
    '',
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];


  return meses[
    Number(mes)
  ] || '';
}


// =========================================================
// ## 8. VENDEDOR DO REGISTRO
// =========================================================

function obterPerfilVendedorPainel(
  userId
) {

  return painelVendedores.find(
    vendedor =>
      vendedor.user_id ===
      userId
  ) || null;
}


function nomeVendedorRegistroPainel(
  registro
) {

  const perfil =
    obterPerfilVendedorPainel(
      registro.vendedorId
    );


  if (perfil) {

    return perfil.nome;

  }


  return (
    registro.revisao
      .vendedor_nome ||
    'Sem responsável'
  );
}


// =========================================================
// ## 9. PERÍODO DA META
// =========================================================

function periodoAtualPainel() {

  const hoje =
    new Date();


  return {

    ano:
      hoje.getFullYear(),

    mes:
      hoje.getMonth() + 1

  };
}


function periodoMetaPainel() {

  const atual =
    periodoAtualPainel();


  return {

    ano:
      Number(
        document
          .getElementById(
            'painelMetaAno'
          )
          ?.value
      ) ||
      atual.ano,

    mes:
      Number(
        document
          .getElementById(
            'painelMetaMes'
          )
          ?.value
      ) ||
      atual.mes

  };
}


// =========================================================
// ## 10. MONTAR ÁREA DE META
// =========================================================

function montarResumoMetaPainel() {

  if (
    document.getElementById(
      'painelMetaResumo'
    )
  ) {

    return;

  }


  const pagina =
    document.getElementById(
      'painelPage'
    );


  const cardsStatus =
    pagina?.querySelector(
      '.painel-cards'
    );


  if (
    !pagina ||
    !cardsStatus
  ) {

    return;

  }


  const periodo =
    periodoAtualPainel();


  const area =
    document.createElement(
      'div'
    );


  area.id =
    'painelMetaResumo';


  area.className =
    'painel-meta-area';


  area.innerHTML = `

    <div class="painel-meta-head">

      <div>

        <h3 id="painelMetaTitulo">
          Resultado Comercial
        </h3>

        <p id="painelMetaSubtitulo">
          Acompanhamento mensal da meta.
        </p>

      </div>


      <div class="painel-meta-periodo">


        <div class="field">

          <label>
            Mês da meta
          </label>

          <select id="painelMetaMes">

            ${
              Array.from(
                {
                  length: 12
                },
                (
                  _,
                  indice
                ) => {

                  const mes =
                    indice + 1;


                  return `
                    <option
                      value="${mes}"
                      ${
                        mes ===
                        periodo.mes
                          ? 'selected'
                          : ''
                      }
                    >
                      ${nomeMesPainel(mes)}
                    </option>
                  `;

                }
              ).join('')
            }

          </select>

        </div>


        <div class="field">

          <label>
            Ano
          </label>

          <select id="painelMetaAno">
          </select>

        </div>


      </div>

    </div>


    <div class="painel-meta-cards">


      <div class="painel-meta-card">

        <span>
          META
        </span>

        <strong id="painelMetaValor">
          R$ 0,00
        </strong>

      </div>


      <div class="painel-meta-card conquistado">

        <span>
          CONQUISTADO
        </span>

        <strong id="painelMetaConquistado">
          R$ 0,00
        </strong>

      </div>


      <div class="painel-meta-card falta">

        <span>
          FALTA
        </span>

        <strong id="painelMetaFalta">
          R$ 0,00
        </strong>

      </div>


      <div class="painel-meta-card atingimento">

        <span>
          ATINGIMENTO
        </span>

        <strong id="painelMetaPercentual">
          0%
        </strong>

      </div>


    </div>


    <div class="painel-meta-progress">

      <div
        id="painelMetaProgressBar"
        class="painel-meta-progress-bar"
        style="width:0%"
      ></div>

    </div>

  `;


  cardsStatus.insertAdjacentElement(
    'beforebegin',
    area
  );


  const anoSelect =
    document.getElementById(
      'painelMetaAno'
    );


  for (
    let ano =
      periodo.ano - 1;

    ano <=
      periodo.ano + 2;

    ano++
  ) {

    const option =
      document.createElement(
        'option'
      );


    option.value =
      ano;


    option.textContent =
      ano;


    if (
      ano ===
      periodo.ano
    ) {

      option.selected =
        true;

    }


    anoSelect?.appendChild(
      option
    );

  }


  document
    .getElementById(
      'painelMetaMes'
    )
    ?.addEventListener(
      'change',
      carregarMetasResumoPainel
    );


  document
    .getElementById(
      'painelMetaAno'
    )
    ?.addEventListener(
      'change',
      carregarMetasResumoPainel
    );

}


// =========================================================
// ## 11. MONTAR COMPARATIVO
// =========================================================

function montarComparativoPainel() {

  if (
    document.getElementById(
      'painelComparativoEquipe'
    )
  ) {

    return;

  }


  const pagina =
    document.getElementById(
      'painelPage'
    );


  const cardsStatus =
    pagina?.querySelector(
      '.painel-cards'
    );


  if (
    !pagina ||
    !cardsStatus
  ) {

    return;

  }


  const area =
    document.createElement(
      'div'
    );


  area.id =
    'painelComparativoEquipe';


  area.className =
    'painel-comparativo';


  area.hidden =
    true;


  area.innerHTML = `

    <div class="painel-comparativo-head">

      <div>

        <h3>
          📈 Comparativo dos Vendedores
        </h3>

        <p>
          Resultado do período da meta.
        </p>

      </div>

    </div>


    <div class="table-wrap">

      <table class="editor painel-comparativo-table">

        <thead>

          <tr>

            <th>
              Vendedor
            </th>

            <th>
              Meta
            </th>

            <th>
              Conquistado
            </th>

            <th>
              Falta
            </th>

            <th>
              Atingimento
            </th>

          </tr>

        </thead>


        <tbody id="painelComparativoBody">
        </tbody>

      </table>

    </div>

  `;


  cardsStatus.insertAdjacentElement(
    'afterend',
    area
  );

}


// =========================================================
// ## 12. META DE UM VENDEDOR
// =========================================================

function metaDoVendedorPainel(
  userId
) {

  return painelMetas.find(
    meta =>
      meta.user_id ===
      userId
  ) || null;
}


// =========================================================
// ## 13. DATA DO CONCLUÍDO
// =========================================================

function dataConclusaoPainel(
  registro
) {

  return (
    registro.proposta
      .status_atualizado_em ||

    registro.proposta
      .updated_at ||

    registro.revisao
      .data_proposta ||

    null
  );
}


function registroNoPeriodoMetaPainel(
  registro,
  ano,
  mes
) {

  const data =
    dataConclusaoPainel(
      registro
    );


  if (!data) {

    return false;

  }


  const texto =
    String(data)
      .slice(
        0,
        10
      );


  const [
    dataAno,
    dataMes
  ] =
    texto
      .split('-')
      .map(
        Number
      );


  return (
    dataAno ===
      Number(ano) &&
    dataMes ===
      Number(mes)
  );
}


// =========================================================
// ## 14. VALOR CONQUISTADO
// =========================================================

function conquistadoVendedorPainel(
  userId,
  ano,
  mes
) {

  return painelDados
    .filter(
      registro =>
        registro.vendedorId ===
          userId &&

        registro.proposta
          .status_comercial ===
          'concluido' &&

        registroNoPeriodoMetaPainel(
          registro,
          ano,
          mes
        )
    )
    .reduce(
      (
        total,
        registro
      ) =>
        total +
        registro.valor,
      0
    );
}


// =========================================================
// ## 15. FILTRO DE VENDEDOR
// =========================================================

function atualizarFiltroVendedoresPainel() {

  const select =
    document.getElementById(
      'painelFiltroVendedor'
    );


  const wrapper =
    document.getElementById(
      'painelFiltroVendedorWrap'
    );


  if (
    !select ||
    !wrapper
  ) {

    return;

  }


  select.innerHTML =
    '';


  if (
    painelEhVendedor()
  ) {

    wrapper.style.display =
      'none';


    const option =
      document.createElement(
        'option'
      );


    option.value =
      painelPerfilAtual.user_id;


    option.textContent =
      painelPerfilAtual.nome;


    option.selected =
      true;


    select.appendChild(
      option
    );


    return;

  }


  wrapper.style.display =
    '';


  const todos =
    document.createElement(
      'option'
    );


  todos.value =
    '';


  todos.textContent =
    'Todos';


  select.appendChild(
    todos
  );


  painelVendedores.forEach(
    vendedor => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        vendedor.user_id;


      option.textContent =
        vendedor.nome;


      select.appendChild(
        option
      );

    }
  );


  const possuiSemResponsavel =
    painelDados.some(
      registro =>
        !registro.vendedorId
    );


  if (
    possuiSemResponsavel
  ) {

    const option =
      document.createElement(
        'option'
      );


    option.value =
      '__sem_responsavel__';


    option.textContent =
      'Sem responsável';


    select.appendChild(
      option
    );

  }

}


// =========================================================
// ## 16. FILTROS
// =========================================================

function obterFiltrosPainel() {

  return {

    origem:
      document
        .getElementById(
          'painelFiltroOrigem'
        )
        ?.value || '',

    status:
      document
        .getElementById(
          'painelFiltroStatus'
        )
        ?.value || '',

    vendedor:
      document
        .getElementById(
          'painelFiltroVendedor'
        )
        ?.value || '',

    dataInicial:
      document
        .getElementById(
          'painelDataInicial'
        )
        ?.value || '',

    dataFinal:
      document
        .getElementById(
          'painelDataFinal'
        )
        ?.value || ''

  };
}


function dadosFiltradosPainel() {

  const filtros =
    obterFiltrosPainel();


  return painelDados.filter(
    registro => {

      const proposta =
        registro.proposta;


      const revisao =
        registro.revisao;


      // ---------------------------------------------------
      // VENDEDOR
      // ---------------------------------------------------

      if (
        painelEhVendedor()
      ) {

        const ehResponsavel =
          registro.vendedorId ===
          painelPerfilAtual.user_id;


        const legadoSemResponsavel =
          !registro.vendedorId &&
          proposta.criado_por ===
          painelPerfilAtual.user_id;


        if (
          !ehResponsavel &&
          !legadoSemResponsavel
        ) {

          return false;

        }

      } else if (
        filtros.vendedor ===
        '__sem_responsavel__'
      ) {

        if (
          registro.vendedorId
        ) {

          return false;

        }

      } else if (
        filtros.vendedor &&
        registro.vendedorId !==
        filtros.vendedor
      ) {

        return false;

      }


      // ---------------------------------------------------
      // ORIGEM
      // ---------------------------------------------------

      if (
        filtros.origem &&
        proposta.origem_comercial !==
        filtros.origem
      ) {

        return false;

      }


      // ---------------------------------------------------
      // STATUS
      // ---------------------------------------------------

      if (
        filtros.status &&
        proposta.status_comercial !==
        filtros.status
      ) {

        return false;

      }


      // ---------------------------------------------------
      // DATA
      // ---------------------------------------------------

      const data =
        revisao.data_proposta
          ? String(
              revisao.data_proposta
            ).slice(
              0,
              10
            )
          : '';


      if (
        filtros.dataInicial &&
        (
          !data ||
          data <
          filtros.dataInicial
        )
      ) {

        return false;

      }


      if (
        filtros.dataFinal &&
        (
          !data ||
          data >
          filtros.dataFinal
        )
      ) {

        return false;

      }


      return true;

    }
  );
}


// =========================================================
// ## 17. BADGES
// =========================================================

function badgeOrigemPainel(
  origem
) {

  const classe =
    origem ||
    'sem-origem';


  return `
    <span
      class="painel-badge origem ${escaparPainel(classe)}"
    >
      ${
        escaparPainel(
          nomeOrigemPainel(
            origem
          )
        )
      }
    </span>
  `;
}


function badgeStatusPainel(
  status
) {

  const normalizado =
    status ||
    'proposta';


  return `
    <span
      class="painel-badge status ${escaparPainel(normalizado)}"
    >
      ${
        escaparPainel(
          nomeStatusPainel(
            normalizado
          )
        )
      }
    </span>
  `;
}


function badgeRevisaoPainel(
  revisao
) {

  const status =
    String(
      revisao.status ||
      'rascunho'
    ).toLowerCase();


  return `

    <div class="painel-revisao">

      <b>
        R${escaparPainel(
          revisao.numero_revisao
        )}
      </b>

      <span
        class="painel-revisao-status ${escaparPainel(status)}"
      >
        ${
          status ===
            'enviada'
              ? 'ENVIADA'
              : 'RASCUNHO'
        }
      </span>

    </div>

  `;
}


// =========================================================
// ## 18. INDICADORES DE STATUS
// =========================================================

function atualizarIndicadoresPainel(
  lista
) {

  const indicadores = {

    proposta: {
      quantidade: 0,
      valor: 0
    },

    andamento: {
      quantidade: 0,
      valor: 0
    },

    concluido: {
      quantidade: 0,
      valor: 0
    },

    nao_conquistado: {
      quantidade: 0,
      valor: 0
    }

  };


  lista.forEach(
    registro => {

      const status =
        registro.proposta
          .status_comercial ||
        'proposta';


      if (
        !indicadores[status]
      ) {

        return;

      }


      indicadores[status]
        .quantidade +=
        1;


      indicadores[status]
        .valor +=
        registro.valor;

    }
  );


  const atualizar =
    (
      idQuantidade,
      idValor,
      dados
    ) => {

      const qtd =
        document.getElementById(
          idQuantidade
        );


      const valor =
        document.getElementById(
          idValor
        );


      if (qtd) {

        qtd.textContent =
          dados.quantidade;

      }


      if (valor) {

        valor.textContent =
          formatarMoedaPainel(
            dados.valor
          );

      }

    };


  atualizar(
    'painelQtdProposta',
    'painelValorProposta',
    indicadores.proposta
  );


  atualizar(
    'painelQtdAndamento',
    'painelValorAndamento',
    indicadores.andamento
  );


  atualizar(
    'painelQtdConcluido',
    'painelValorConcluido',
    indicadores.concluido
  );


  atualizar(
    'painelQtdNaoConquistado',
    'painelValorNaoConquistado',
    indicadores.nao_conquistado
  );

}


// =========================================================
// ## 19. RESUMO DA META
// =========================================================

function atualizarResumoMetaPainel() {

  const titulo =
    document.getElementById(
      'painelMetaTitulo'
    );


  const subtitulo =
    document.getElementById(
      'painelMetaSubtitulo'
    );


  if (
    !titulo
  ) {

    return;

  }


  const periodo =
    periodoMetaPainel();


  const filtroVendedor =
    document
      .getElementById(
        'painelFiltroVendedor'
      )
      ?.value || '';


  let vendedoresAlvo =
    [];


  if (
    painelEhVendedor()
  ) {

    vendedoresAlvo =
      [
        painelPerfilAtual
      ];


    titulo.textContent =
      '🎯 Minha Meta';

  } else if (
    filtroVendedor &&
    filtroVendedor !==
    '__sem_responsavel__'
  ) {

    const vendedor =
      obterPerfilVendedorPainel(
        filtroVendedor
      );


    vendedoresAlvo =
      vendedor
        ? [vendedor]
        : [];


    titulo.textContent =
      vendedor
        ? `🎯 Meta de ${vendedor.nome}`
        : '🎯 Meta do Vendedor';

  } else {

    vendedoresAlvo =
      [...painelVendedores];


    titulo.textContent =
      '🎯 Meta da Equipe';

  }


  if (subtitulo) {

    subtitulo.textContent =
      `${nomeMesPainel(periodo.mes)} de ${periodo.ano}`;

  }


  const ids =
    vendedoresAlvo.map(
      vendedor =>
        vendedor.user_id
    );


  const metaTotal =
    vendedoresAlvo.reduce(
      (
        total,
        vendedor
      ) => {

        const meta =
          metaDoVendedorPainel(
            vendedor.user_id
          );


        return total +
          (
            Number(
              meta?.meta_valor
            ) || 0
          );

      },
      0
    );


  const conquistado =
    ids.reduce(
      (
        total,
        userId
      ) =>
        total +
        conquistadoVendedorPainel(
          userId,
          periodo.ano,
          periodo.mes
        ),
      0
    );


  const falta =
    Math.max(
      metaTotal -
      conquistado,
      0
    );


  const percentual =
    metaTotal > 0
      ? (
          conquistado /
          metaTotal
        ) *
        100
      : 0;


  const definir =
    (
      id,
      valor
    ) => {

      const elemento =
        document.getElementById(
          id
        );


      if (elemento) {

        elemento.textContent =
          valor;

      }

    };


  definir(
    'painelMetaValor',
    formatarMoedaPainel(
      metaTotal
    )
  );


  definir(
    'painelMetaConquistado',
    formatarMoedaPainel(
      conquistado
    )
  );


  definir(
    'painelMetaFalta',
    formatarMoedaPainel(
      falta
    )
  );


  definir(
    'painelMetaPercentual',
    `${percentual.toFixed(1)}%`
  );


  const barra =
    document.getElementById(
      'painelMetaProgressBar'
    );


  if (barra) {

    barra.style.width =
      `${Math.min(
        Math.max(
          percentual,
          0
        ),
        100
      )}%`;

  }

}


// =========================================================
// ## 20. COMPARATIVO DA EQUIPE
// =========================================================

function renderizarComparativoPainel() {

  const area =
    document.getElementById(
      'painelComparativoEquipe'
    );


  const corpo =
    document.getElementById(
      'painelComparativoBody'
    );


  if (
    !area ||
    !corpo
  ) {

    return;

  }


  const filtroVendedor =
    document
      .getElementById(
        'painelFiltroVendedor'
      )
      ?.value || '';


  if (
    !painelEhGestorOuAdm() ||
    filtroVendedor
  ) {

    area.hidden =
      true;

    return;

  }


  area.hidden =
    false;


  corpo.innerHTML =
    '';


  const periodo =
    periodoMetaPainel();


  const linhas =
    painelVendedores.map(
      vendedor => {

        const meta =
          Number(
            metaDoVendedorPainel(
              vendedor.user_id
            )?.meta_valor
          ) || 0;


        const conquistado =
          conquistadoVendedorPainel(
            vendedor.user_id,
            periodo.ano,
            periodo.mes
          );


        const falta =
          Math.max(
            meta -
            conquistado,
            0
          );


        const percentual =
          meta > 0
            ? (
                conquistado /
                meta
              ) *
              100
            : 0;


        return {

          vendedor,
          meta,
          conquistado,
          falta,
          percentual

        };

      }
    )
    .sort(
      (
        a,
        b
      ) =>
        b.percentual -
        a.percentual
    );


  linhas.forEach(
    linha => {

      const tr =
        document.createElement(
          'tr'
        );


      tr.innerHTML = `

        <td>

          <b>
            ${
              escaparPainel(
                linha.vendedor.nome
              )
            }
          </b>

        </td>


        <td>
          ${
            formatarMoedaPainel(
              linha.meta
            )
          }
        </td>


        <td>
          <b>
            ${
              formatarMoedaPainel(
                linha.conquistado
              )
            }
          </b>
        </td>


        <td>
          ${
            formatarMoedaPainel(
              linha.falta
            )
          }
        </td>


        <td>

          <strong>
            ${linha.percentual.toFixed(1)}%
          </strong>

        </td>

      `;


      corpo.appendChild(
        tr
      );

    }
  );

}


// =========================================================
// ## 21. RENDERIZAR TABELA PRINCIPAL
// =========================================================

function renderizarPainel() {

  const corpo =
    document.getElementById(
      'painelBody'
    );


  const vazio =
    document.getElementById(
      'painelVazio'
    );


  const contador =
    document.getElementById(
      'painelContador'
    );


  if (!corpo) {

    return;

  }


  const lista =
    dadosFiltradosPainel();


  corpo.innerHTML =
    '';


  if (contador) {

    contador.textContent =
      lista.length ===
      painelDados.length
        ? `${lista.length} proposta(s)`
        : `${lista.length} de ${painelDados.length} proposta(s)`;

  }


  if (vazio) {

    vazio.style.display =
      lista.length
        ? 'none'
        : 'block';

  }


  atualizarIndicadoresPainel(
    lista
  );


  atualizarResumoMetaPainel();


  renderizarComparativoPainel();


  lista.forEach(
    registro => {

      const proposta =
        registro.proposta;


      const revisao =
        registro.revisao;


      const vendedorPerfil =
        obterPerfilVendedorPainel(
          registro.vendedorId
        );


      const tr =
        document.createElement(
          'tr'
        );


      tr.innerHTML = `

        <td>
          <b>
            #${escaparPainel(
              proposta.numero
            )}
          </b>
        </td>


        <td>

          <b>
            ${
              escaparPainel(
                revisao.nome_proposta ||
                'Sem nome'
              )
            }
          </b>

          <div class="painel-secondary">
            ${
              escaparPainel(
                revisao.cliente ||
                'Cliente não informado'
              )
            }
          </div>

        </td>


        <td>

          ${
            escaparPainel(
              nomeVendedorRegistroPainel(
                registro
              )
            )
          }

          ${
            !vendedorPerfil
              ? `
                <div class="painel-secondary">
                  ${
                    registro.vendedorId
                      ? 'USUÁRIO NÃO LOCALIZADO'
                      : 'SEM VÍNCULO'
                  }
                </div>
              `
              : ''
          }

        </td>


        <td>
          ${
            formatarDataPainel(
              revisao.data_proposta
            )
          }
        </td>


        <td>
          ${
            badgeOrigemPainel(
              proposta.origem_comercial
            )
          }
        </td>


        <td>
          ${
            badgeStatusPainel(
              proposta.status_comercial
            )
          }
        </td>


        <td class="painel-value">
          ${
            formatarMoedaPainel(
              registro.valor
            )
          }
        </td>


        <td>
          ${
            badgeRevisaoPainel(
              revisao
            )
          }
        </td>


        <td>

          <button
            type="button"
            class="btn navy painel-open"
            onclick="
              abrirPropostaPainel(
                '${escaparPainel(
                  proposta.id
                )}'
              )
            "
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
// ## 22. CARREGAR METAS
// =========================================================

async function carregarMetasResumoPainel() {

  if (
    painelMetasCarregando ||
    !painelPerfilAtual
  ) {

    return;

  }


  painelMetasCarregando =
    true;


  try {

    const periodo =
      periodoMetaPainel();


    painelMetas =
      await listarMetasVendedor({

        ano:
          periodo.ano,

        mes:
          periodo.mes

      });


    atualizarResumoMetaPainel();


    renderizarComparativoPainel();


  } catch (erro) {

    console.error(
      'Erro ao carregar metas do painel:',
      erro
    );

  } finally {

    painelMetasCarregando =
      false;

  }

}


// =========================================================
// ## 23. CARREGAR PAINEL
// =========================================================

async function carregarPainel() {

  if (
    painelCarregando
  ) {

    return;

  }


  montarResumoMetaPainel();
  montarComparativoPainel();


  const corpo =
    document.getElementById(
      'painelBody'
    );


  const contador =
    document.getElementById(
      'painelContador'
    );


  const vazio =
    document.getElementById(
      'painelVazio'
    );


  painelCarregando =
    true;


  if (corpo) {

    corpo.innerHTML = `

      <tr>

        <td
          colspan="9"
          class="painel-loading"
        >
          Carregando painel...
        </td>

      </tr>

    `;

  }


  if (contador) {

    contador.textContent =
      'Carregando...';

  }


  if (vazio) {

    vazio.style.display =
      'none';

  }


  try {

    painelPerfilAtual =
      await obterMeuPerfil();


    if (
      !painelPerfilAtual
    ) {

      throw new Error(
        'Perfil do usuário não encontrado.'
      );

    }


    const periodo =
      periodoMetaPainel();


    const [
      propostas,
      perfis,
      metas
    ] =
      await Promise.all([

        listarDadosPainelGestao({
          limite: 500
        }),

        listarPerfisEquipe(),

        listarMetasVendedor({
          ano:
            periodo.ano,

          mes:
            periodo.mes
        })

      ]);


    painelPerfis =
      perfis || [];


    painelVendedores =
      painelPerfis
        .filter(
          perfil =>
            perfil.ativo &&
            perfil.tipo_acesso ===
            'vendedor'
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.nome || ''
            ).localeCompare(
              String(
                b.nome || ''
              ),
              'pt-BR'
            )
        );


    painelMetas =
      metas || [];


    painelDados =
      normalizarDadosPainel(
        propostas
      );


    atualizarFiltroVendedoresPainel();


    renderizarPainel();


  } catch (erro) {

    console.error(
      'Erro ao carregar painel:',
      erro
    );


    painelDados =
      [];


    if (corpo) {

      corpo.innerHTML =
        '';

    }


    if (contador) {

      contador.textContent =
        'Erro ao carregar';

    }


    atualizarIndicadoresPainel(
      []
    );


    if (vazio) {

      vazio.style.display =
        'block';


      vazio.innerHTML =
        '<b>Não foi possível carregar o painel.</b><br>' +
        escaparPainel(
          erro?.message ||
          'Erro desconhecido.'
        );

    }

  } finally {

    painelCarregando =
      false;

  }

}


// =========================================================
// ## 24. ABRIR PÁGINA
// =========================================================

async function abrirPainel(
  btn
) {

  showPage(
    'painelPage',
    btn
  );


  await carregarPainel();

}


// =========================================================
// ## 25. LIMPAR FILTROS
// =========================================================

function limparFiltrosPainel() {

  const origem =
    document.getElementById(
      'painelFiltroOrigem'
    );


  const status =
    document.getElementById(
      'painelFiltroStatus'
    );


  const vendedor =
    document.getElementById(
      'painelFiltroVendedor'
    );


  const inicial =
    document.getElementById(
      'painelDataInicial'
    );


  const final =
    document.getElementById(
      'painelDataFinal'
    );


  if (origem) {

    origem.value =
      '';

  }


  if (status) {

    status.value =
      '';

  }


  if (vendedor) {

    vendedor.value =
      painelEhVendedor()
        ? painelPerfilAtual
            ?.user_id || ''
        : '';

  }


  if (inicial) {

    inicial.value =
      '';

  }


  if (final) {

    final.value =
      '';

  }


  renderizarPainel();

}


// =========================================================
// ## 26. ABRIR PROPOSTA
// =========================================================

async function abrirPropostaPainel(
  propostaId
) {

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


    toastMsg(
      `Proposta #${proposta.numero} aberta`
    );


  } catch (erro) {

    console.error(
      'Erro ao abrir proposta pelo painel:',
      erro
    );


    alert(
      'Não foi possível abrir a proposta.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  }

}


// =========================================================
// ## 27. EVENTOS DOS FILTROS
// =========================================================

function iniciarPainel() {

  montarResumoMetaPainel();
  montarComparativoPainel();


  const ids = [

    'painelFiltroOrigem',
    'painelFiltroStatus',
    'painelFiltroVendedor',
    'painelDataInicial',
    'painelDataFinal'

  ];


  ids.forEach(
    id => {

      const campo =
        document.getElementById(
          id
        );


      campo?.addEventListener(
        'change',
        renderizarPainel
      );

    }
  );

}


if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    iniciarPainel
  );

} else {

  iniciarPainel();

}