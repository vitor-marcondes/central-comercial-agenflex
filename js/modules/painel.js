// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: painel.js
//
// Responsabilidade:
// - Painel comercial por perfil
// - Visão Vendedor / Gestor / ADM
// - Filtro comercial por Time
// - Meta individual do vendedor
// - Meta Oficial por Time
// - Resultado conquistado
// - Visão consolidada dos Times
// - Comparativo da equipe
// - Filtros comerciais
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

let painelDados =
  [];

let painelPerfis =
  [];

let painelVendedores =
  [];

let painelMetas =
  [];

let painelMetasOficiais =
  [];

let painelPerfilAtual =
  null;

let painelCarregando =
  false;

let painelMetasCarregando =
  false;


// =========================================================
// ## 2. AUXILIARES
// =========================================================

function escaparPainel(
  valor
) {

  if (
    typeof esc ===
    'function'
  ) {

    return esc(
      valor ?? ''
    );

  }


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


function formatarMoedaPainel(
  valor
) {

  return new Intl.NumberFormat(
    'pt-BR',
    {
      style:
        'currency',

      currency:
        'BRL'
    }
  ).format(
    Number(
      valor
    ) || 0
  );
}


function formatarDataPainel(
  valor
) {

  if (!valor) {

    return '—';

  }


  const iso =
    String(
      valor
    )
      .slice(
        0,
        10
      );


  if (
    typeof brDate ===
    'function'
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
    iso.split(
      '-'
    );


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
// ## 4. TIMES
// =========================================================

function normalizarTimePainel(
  time
) {

  const valor =
    String(
      time || ''
    )
      .trim()
      .toLowerCase();


  return [
    'pharma',
    'food',
    'revenda'
  ].includes(
    valor
  )
    ? valor
    : null;
}


function nomeTimePainel(
  time
) {

  const nomes = {

    pharma:
      'Pharma',

    food:
      'Food',

    revenda:
      'Revenda'

  };


  return nomes[
    normalizarTimePainel(
      time
    )
  ] || 'Sem Time';
}


function nomeTimePainelMaiusculo(
  time
) {

  const valor =
    normalizarTimePainel(
      time
    );


  if (!valor) {

    return 'SEM TIME';

  }


  return nomeTimePainel(
    valor
  ).toUpperCase();
}


// =========================================================
// ## 5. REVISÃO ATUAL
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
        (
          a,
          b
        ) =>
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
// ## 6. VALOR DA PROPOSTA
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


      return (
        total +
        subtotal +
        ipi
      );

    },
    0
  );
}


// =========================================================
// ## 7. NORMALIZAR DADOS
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

          timeDocumento:
            normalizarTimePainel(
              revisao.time_equipe
            ),

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
// ## 8. NOMES
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


  return nomes[
    origem
  ] || 'SEM ORIGEM';
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


  return nomes[
    status
  ] || 'PROPOSTA';
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
    Number(
      mes
    )
  ] || '';
}


// =========================================================
// ## 9. VENDEDOR DO REGISTRO
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
// ## 10. TIME DO REGISTRO
// =========================================================

function timeRegistroPainel(
  registro
) {

  // Primeiro utilizamos o Time que ficou registrado
  // na revisão atual da proposta.

  const timeDocumento =
    normalizarTimePainel(
      registro
        ?.timeDocumento ||
      registro
        ?.revisao
        ?.time_equipe
    );


  if (timeDocumento) {

    return timeDocumento;

  }


  // Fallback para registros antigos que ainda não
  // possuíam time_equipe na revisão.

  const vendedor =
    obterPerfilVendedorPainel(
      registro?.vendedorId
    );


  return normalizarTimePainel(
    vendedor?.time_equipe
  );
}


// =========================================================
// ## 11. PERÍODO DA META
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
// ## 12. MONTAR FILTRO DE TIME
// =========================================================

function montarFiltroTimePainel() {

  if (
    document.getElementById(
      'painelFiltroTimeWrap'
    )
  ) {

    return;

  }


  const pagina =
    document.getElementById(
      'painelPage'
    );


  const filtros =
    pagina?.querySelector(
      '.painel-filtros'
    );


  if (!filtros) {

    return;

  }


  const wrapper =
    document.createElement(
      'div'
    );


  wrapper.id =
    'painelFiltroTimeWrap';


  wrapper.className =
    'field painel-filtro-time';


  wrapper.hidden =
    true;


  wrapper.innerHTML = `

    <label>
      Time
    </label>

    <select id="painelFiltroTime">

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

    </select>

  `;


  const vendedorWrap =
    document.getElementById(
      'painelFiltroVendedorWrap'
    );


  if (
    vendedorWrap &&
    vendedorWrap.parentElement ===
    filtros
  ) {

    filtros.insertBefore(
      wrapper,
      vendedorWrap
    );

  } else {

    filtros.prepend(
      wrapper
    );

  }


  document
    .getElementById(
      'painelFiltroTime'
    )
    ?.addEventListener(
      'change',
      aoAlterarTimePainel
    );

}


function atualizarFiltroTimePainel() {

  const wrapper =
    document.getElementById(
      'painelFiltroTimeWrap'
    );


  const select =
    document.getElementById(
      'painelFiltroTime'
    );


  if (
    !wrapper ||
    !select
  ) {

    return;

  }


  if (
    painelEhGestorOuAdm()
  ) {

    wrapper.hidden =
      false;

    return;

  }


  wrapper.hidden =
    true;

  select.value =
    '';
}


function aoAlterarTimePainel() {

  const vendedor =
    document.getElementById(
      'painelFiltroVendedor'
    );


  if (vendedor) {

    vendedor.value =
      '';

  }


  atualizarFiltroVendedoresPainel();

  renderizarPainel();
}


// =========================================================
// ## 13. MONTAR ÁREA DE META
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
          Acompanhamento mensal.
        </p>

      </div>


      <div class="painel-meta-periodo">


        <div class="field">

          <label>
            Mês
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

        <span id="painelMetaLabel">
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


      <div
        id="painelMetaDistribuidaCard"
        class="painel-meta-card distribuida"
        hidden
      >

        <span>
          METAS DISTRIBUÍDAS
        </span>

        <strong id="painelMetaDistribuida">
          R$ 0,00
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
// ## 14. RESUMO DOS TIMES
// =========================================================

function montarResumoTimesPainel() {

  if (
    document.getElementById(
      'painelResumoTimes'
    )
  ) {

    return;

  }


  const metaArea =
    document.getElementById(
      'painelMetaResumo'
    );


  if (!metaArea) {

    return;

  }


  const area =
    document.createElement(
      'div'
    );


  area.id =
    'painelResumoTimes';


  area.className =
    'painel-times-resumo';


  area.hidden =
    true;


  area.innerHTML = `

    <div class="painel-times-head">

      <div>

        <h3>
          Resultado por Time
        </h3>

        <p id="painelTimesPeriodo">
          —
        </p>

      </div>

    </div>


    <div
      id="painelTimesCards"
      class="painel-times-cards"
    >
    </div>

  `;


  metaArea.insertAdjacentElement(
    'afterend',
    area
  );

}


// =========================================================
// ## 15. MONTAR COMPARATIVO
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

        <h3 id="painelComparativoTitulo">
          📈 Comparativo dos Vendedores
        </h3>

        <p id="painelComparativoSubtitulo">
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
              Time
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
// ## 16. METAS
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


function metaOficialTimePainel(
  timeEquipe
) {

  const time =
    normalizarTimePainel(
      timeEquipe
    );


  if (!time) {

    return null;

  }


  return painelMetasOficiais.find(
    meta =>
      meta.time_equipe ===
      time
  ) || null;
}


function vendedoresDoTimePainel(
  timeEquipe
) {

  const time =
    normalizarTimePainel(
      timeEquipe
    );


  if (!time) {

    return [
      ...painelVendedores
    ];

  }


  return painelVendedores.filter(
    vendedor =>
      normalizarTimePainel(
        vendedor.time_equipe
      ) ===
      time
  );
}


function somaMetasVendedoresPainel(
  vendedores
) {

  return (
    vendedores || []
  ).reduce(
    (
      total,
      vendedor
    ) => {

      const meta =
        metaDoVendedorPainel(
          vendedor.user_id
        );


      return (
        total +
        (
          Number(
            meta?.meta_valor
          ) || 0
        )
      );

    },
    0
  );
}


function somaMetasOficiaisPainel() {

  return [
    'pharma',
    'food',
    'revenda'
  ].reduce(
    (
      total,
      time
    ) => {

      const meta =
        metaOficialTimePainel(
          time
        );


      return (
        total +
        (
          Number(
            meta?.meta_valor
          ) || 0
        )
      );

    },
    0
  );
}


// =========================================================
// ## 17. DATA DO CONCLUÍDO
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
    String(
      data
    )
      .slice(
        0,
        10
      );


  const [
    dataAno,
    dataMes
  ] =
    texto
      .split(
        '-'
      )
      .map(
        Number
      );


  return (
    dataAno ===
      Number(
        ano
      ) &&
    dataMes ===
      Number(
        mes
      )
  );
}


// =========================================================
// ## 18. RESULTADO CONQUISTADO
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


function conquistadoTimePainel(
  timeEquipe,
  ano,
  mes
) {

  const time =
    normalizarTimePainel(
      timeEquipe
    );


  if (!time) {

    return 0;

  }


  return painelDados
    .filter(
      registro =>
        registro.proposta
          .status_comercial ===
          'concluido' &&

        timeRegistroPainel(
          registro
        ) ===
          time &&

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


function conquistadoGeralPainel(
  ano,
  mes
) {

  return painelDados
    .filter(
      registro =>
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
// ## 19. FILTRO DE VENDEDORES
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


  const valorAnterior =
    select.value;


  select.innerHTML =
    '';


  // -------------------------------------------------------
  // ## 19.1 Vendedor
  // -------------------------------------------------------

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


  // -------------------------------------------------------
  // ## 19.2 Gestor / ADM
  // -------------------------------------------------------

  wrapper.style.display =
    '';


  const filtroTime =
    document
      .getElementById(
        'painelFiltroTime'
      )
      ?.value || '';


  const vendedoresDisponiveis =
    filtroTime
      ? painelVendedores.filter(
          vendedor =>
            normalizarTimePainel(
              vendedor.time_equipe
            ) ===
            filtroTime
        )
      : [
          ...painelVendedores
        ];


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


  vendedoresDisponiveis.forEach(
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
      registro => {

        if (
          registro.vendedorId
        ) {

          return false;

        }


        if (
          filtroTime &&
          timeRegistroPainel(
            registro
          ) !==
          filtroTime
        ) {

          return false;

        }


        return true;

      }
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


  const aindaExiste =
    [
      ...select.options
    ].some(
      option =>
        option.value ===
        valorAnterior
    );


  select.value =
    aindaExiste
      ? valorAnterior
      : '';
}


// =========================================================
// ## 20. FILTROS
// =========================================================

function obterFiltrosPainel() {

  return {

    time:
      document
        .getElementById(
          'painelFiltroTime'
        )
        ?.value || '',

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
      // ## 20.1 Vendedor logado
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

      }


      // ---------------------------------------------------
      // ## 20.2 Time — Gestor / ADM
      // ---------------------------------------------------

      if (
        painelEhGestorOuAdm() &&
        filtros.time &&
        timeRegistroPainel(
          registro
        ) !==
        filtros.time
      ) {

        return false;

      }


      // ---------------------------------------------------
      // ## 20.3 Filtro de vendedor
      // ---------------------------------------------------

      if (
        painelEhGestorOuAdm() &&
        filtros.vendedor ===
        '__sem_responsavel__'
      ) {

        if (
          registro.vendedorId
        ) {

          return false;

        }

      } else if (
        painelEhGestorOuAdm() &&
        filtros.vendedor &&
        registro.vendedorId !==
        filtros.vendedor
      ) {

        return false;

      }


      // ---------------------------------------------------
      // ## 20.4 Origem
      // ---------------------------------------------------

      if (
        filtros.origem &&
        proposta.origem_comercial !==
        filtros.origem
      ) {

        return false;

      }


      // ---------------------------------------------------
      // ## 20.5 Status
      // ---------------------------------------------------

      if (
        filtros.status &&
        proposta.status_comercial !==
        filtros.status
      ) {

        return false;

      }


      // ---------------------------------------------------
      // ## 20.6 Data
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
// ## 21. BADGES
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


function badgeTimePainel(
  time
) {

  const normalizado =
    normalizarTimePainel(
      time
    );


  if (!normalizado) {

    return `
      <span class="painel-badge time sem-time">
        SEM TIME
      </span>
    `;

  }


  return `
    <span
      class="painel-badge time ${escaparPainel(normalizado)}"
    >
      ${
        escaparPainel(
          nomeTimePainelMaiusculo(
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
// ## 22. INDICADORES DE STATUS
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
        !indicadores[
          status
        ]
      ) {

        return;

      }


      indicadores[
        status
      ].quantidade +=
        1;


      indicadores[
        status
      ].valor +=
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
// ## 23. RESUMO DA META
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


  const labelMeta =
    document.getElementById(
      'painelMetaLabel'
    );


  const distribuidaCard =
    document.getElementById(
      'painelMetaDistribuidaCard'
    );


  if (!titulo) {

    return;

  }


  const periodo =
    periodoMetaPainel();


  const filtros =
    obterFiltrosPainel();


  const vendedorSelecionado =
    (
      filtros.vendedor &&
      filtros.vendedor !==
        '__sem_responsavel__'
    )
      ? obterPerfilVendedorPainel(
          filtros.vendedor
        )
      : null;


  let metaTotal =
    0;


  let conquistado =
    0;


  let distribuido =
    0;


  let mostrarDistribuido =
    false;


  // -------------------------------------------------------
  // ## 23.1 Vendedor logado
  // -------------------------------------------------------

  if (
    painelEhVendedor()
  ) {

    const meta =
      metaDoVendedorPainel(
        painelPerfilAtual.user_id
      );


    metaTotal =
      Number(
        meta?.meta_valor
      ) || 0;


    conquistado =
      conquistadoVendedorPainel(
        painelPerfilAtual.user_id,
        periodo.ano,
        periodo.mes
      );


    titulo.textContent =
      '🎯 Minha Meta';


    if (labelMeta) {

      labelMeta.textContent =
        'META';

    }


    if (subtitulo) {

      subtitulo.textContent =
        `${nomeMesPainel(
          periodo.mes
        )} de ${periodo.ano} • ` +
        `${nomeTimePainel(
          painelPerfilAtual.time_equipe
        )}`;

    }

  }


  // -------------------------------------------------------
  // ## 23.2 Vendedor específico — Gestor / ADM
  // -------------------------------------------------------

  else if (
    vendedorSelecionado
  ) {

    const meta =
      metaDoVendedorPainel(
        vendedorSelecionado.user_id
      );


    metaTotal =
      Number(
        meta?.meta_valor
      ) || 0;


    conquistado =
      conquistadoVendedorPainel(
        vendedorSelecionado.user_id,
        periodo.ano,
        periodo.mes
      );


    titulo.textContent =
      `🎯 Meta de ${vendedorSelecionado.nome}`;


    if (labelMeta) {

      labelMeta.textContent =
        'META INDIVIDUAL';

    }


    if (subtitulo) {

      subtitulo.textContent =
        `${nomeMesPainel(
          periodo.mes
        )} de ${periodo.ano} • ` +
        `${nomeTimePainel(
          vendedorSelecionado.time_equipe
        )}`;

    }

  }


  // -------------------------------------------------------
  // ## 23.3 Time específico — Gestor / ADM
  // -------------------------------------------------------

  else if (
    filtros.time
  ) {

    const metaOficial =
      metaOficialTimePainel(
        filtros.time
      );


    const vendedores =
      vendedoresDoTimePainel(
        filtros.time
      );


    metaTotal =
      Number(
        metaOficial?.meta_valor
      ) || 0;


    conquistado =
      conquistadoTimePainel(
        filtros.time,
        periodo.ano,
        periodo.mes
      );


    distribuido =
      somaMetasVendedoresPainel(
        vendedores
      );


    mostrarDistribuido =
      true;


    titulo.textContent =
      `🎯 Time ${nomeTimePainel(
        filtros.time
      )}`;


    if (labelMeta) {

      labelMeta.textContent =
        'META OFICIAL';

    }


    if (subtitulo) {

      subtitulo.textContent =
        `${nomeMesPainel(
          periodo.mes
        )} de ${periodo.ano}`;

    }

  }


  // -------------------------------------------------------
  // ## 23.4 Consolidado — Gestor / ADM
  // -------------------------------------------------------

  else {

    metaTotal =
      somaMetasOficiaisPainel();


    conquistado =
      conquistadoGeralPainel(
        periodo.ano,
        periodo.mes
      );


    distribuido =
      somaMetasVendedoresPainel(
        painelVendedores
      );


    mostrarDistribuido =
      true;


    titulo.textContent =
      '🎯 Resultado Geral';


    if (labelMeta) {

      labelMeta.textContent =
        'META OFICIAL TOTAL';

    }


    if (subtitulo) {

      subtitulo.textContent =
        `${nomeMesPainel(
          periodo.mes
        )} de ${periodo.ano} • ` +
        `Pharma + Food + Revenda`;

    }

  }


  // -------------------------------------------------------
  // ## 23.5 Cálculos
  // -------------------------------------------------------

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


  definir(
    'painelMetaDistribuida',
    formatarMoedaPainel(
      distribuido
    )
  );


  if (
    distribuidaCard
  ) {

    distribuidaCard.hidden =
      !mostrarDistribuido;

  }


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
// ## 24. RESUMO CONSOLIDADO DOS TIMES
// =========================================================

function renderizarResumoTimesPainel() {

  const area =
    document.getElementById(
      'painelResumoTimes'
    );


  const cards =
    document.getElementById(
      'painelTimesCards'
    );


  const periodoTexto =
    document.getElementById(
      'painelTimesPeriodo'
    );


  if (
    !area ||
    !cards
  ) {

    return;

  }


  const filtros =
    obterFiltrosPainel();


  const mostrar =
    painelEhGestorOuAdm() &&
    !filtros.time &&
    !filtros.vendedor;


  if (!mostrar) {

    area.hidden =
      true;

    return;

  }


  area.hidden =
    false;


  const periodo =
    periodoMetaPainel();


  if (
    periodoTexto
  ) {

    periodoTexto.textContent =
      `${nomeMesPainel(
        periodo.mes
      )} de ${periodo.ano}`;

  }


  cards.innerHTML =
    '';


  [
    'pharma',
    'food',
    'revenda'
  ].forEach(
    time => {

      const metaOficial =
        Number(
          metaOficialTimePainel(
            time
          )?.meta_valor
        ) || 0;


      const vendedores =
        vendedoresDoTimePainel(
          time
        );


      const distribuido =
        somaMetasVendedoresPainel(
          vendedores
        );


      const conquistado =
        conquistadoTimePainel(
          time,
          periodo.ano,
          periodo.mes
        );


      const percentual =
        metaOficial > 0
          ? (
              conquistado /
              metaOficial
            ) *
            100
          : 0;


      const card =
        document.createElement(
          'div'
        );


      card.className =
        `painel-time-card ${time}`;


      card.innerHTML = `

        <div class="painel-time-card-head">

          <strong>
            ${
              escaparPainel(
                nomeTimePainel(
                  time
                )
              )
            }
          </strong>

          ${
            badgeTimePainel(
              time
            )
          }

        </div>


        <div class="painel-time-card-grid">

          <div>

            <span>
              META OFICIAL
            </span>

            <b>
              ${
                formatarMoedaPainel(
                  metaOficial
                )
              }
            </b>

          </div>


          <div>

            <span>
              CONQUISTADO
            </span>

            <b>
              ${
                formatarMoedaPainel(
                  conquistado
                )
              }
            </b>

          </div>


          <div>

            <span>
              DISTRIBUÍDO
            </span>

            <b>
              ${
                formatarMoedaPainel(
                  distribuido
                )
              }
            </b>

          </div>


          <div>

            <span>
              ATINGIMENTO
            </span>

            <b>
              ${percentual.toFixed(1)}%
            </b>

          </div>

        </div>

      `;


      cards.appendChild(
        card
      );

    }
  );

}


// =========================================================
// ## 25. COMPARATIVO DA EQUIPE
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


  const titulo =
    document.getElementById(
      'painelComparativoTitulo'
    );


  const subtitulo =
    document.getElementById(
      'painelComparativoSubtitulo'
    );


  if (
    !area ||
    !corpo
  ) {

    return;

  }


  const filtros =
    obterFiltrosPainel();


  if (
    !painelEhGestorOuAdm() ||
    filtros.vendedor
  ) {

    area.hidden =
      true;

    return;

  }


  area.hidden =
    false;


  const periodo =
    periodoMetaPainel();


  const vendedores =
    filtros.time
      ? vendedoresDoTimePainel(
          filtros.time
        )
      : [
          ...painelVendedores
        ];


  if (titulo) {

    titulo.textContent =
      filtros.time
        ? `📈 Vendedores — ${nomeTimePainel(
            filtros.time
          )}`
        : '📈 Comparativo dos Vendedores';

  }


  if (subtitulo) {

    subtitulo.textContent =
      `${nomeMesPainel(
        periodo.mes
      )} de ${periodo.ano}`;

  }


  corpo.innerHTML =
    '';


  const linhas =
    vendedores
      .map(
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


  if (
    !linhas.length
  ) {

    corpo.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="painel-loading"
        >
          Nenhum vendedor encontrado.
        </td>

      </tr>

    `;


    return;

  }


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
            badgeTimePainel(
              linha.vendedor
                .time_equipe
            )
          }

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
// ## 26. RENDERIZAR TABELA PRINCIPAL
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


  renderizarResumoTimesPainel();


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
// ## 27. CARREGAR METAS DO RESUMO
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


    const tarefas = [

      listarMetasVendedor({

        ano:
          periodo.ano,

        mes:
          periodo.mes

      })

    ];


    if (
      painelEhGestorOuAdm()
    ) {

      tarefas.push(

        listarMetasOficiaisEquipe({

          ano:
            periodo.ano,

          mes:
            periodo.mes

        })

      );

    } else {

      tarefas.push(
        Promise.resolve(
          []
        )
      );

    }


    const [
      metasIndividuais,
      metasOficiais
    ] =
      await Promise.all(
        tarefas
      );


    painelMetas =
      metasIndividuais || [];


    painelMetasOficiais =
      metasOficiais || [];


    atualizarResumoMetaPainel();


    renderizarResumoTimesPainel();


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
// ## 28. CARREGAR PAINEL
// =========================================================

async function carregarPainel() {

  if (
    painelCarregando
  ) {

    return;

  }


  montarFiltroTimePainel();

  montarResumoMetaPainel();

  montarResumoTimesPainel();

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


    atualizarFiltroTimePainel();


    const periodo =
      periodoMetaPainel();


    const tarefas = [

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

    ];


    if (
      painelEhGestorOuAdm()
    ) {

      tarefas.push(

        listarMetasOficiaisEquipe({

          ano:
            periodo.ano,

          mes:
            periodo.mes

        })

      );

    } else {

      tarefas.push(
        Promise.resolve(
          []
        )
      );

    }


    const [
      propostas,
      perfis,
      metas,
      metasOficiais
    ] =
      await Promise.all(
        tarefas
      );


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


    painelMetasOficiais =
      metasOficiais || [];


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
// ## 29. ABRIR PÁGINA
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
// ## 30. LIMPAR FILTROS
// =========================================================

function limparFiltrosPainel() {

  const time =
    document.getElementById(
      'painelFiltroTime'
    );


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


  if (time) {

    time.value =
      '';

  }


  if (origem) {

    origem.value =
      '';

  }


  if (status) {

    status.value =
      '';

  }


  if (inicial) {

    inicial.value =
      '';

  }


  if (final) {

    final.value =
      '';

  }


  atualizarFiltroVendedoresPainel();


  if (vendedor) {

    vendedor.value =
      painelEhVendedor()
        ? painelPerfilAtual
            ?.user_id || ''
        : '';

  }


  renderizarPainel();

}


// =========================================================
// ## 31. ABRIR PROPOSTA
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
// ## 32. EVENTOS DOS FILTROS
// =========================================================

function iniciarPainel() {

  montarFiltroTimePainel();

  montarResumoMetaPainel();

  montarResumoTimesPainel();

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