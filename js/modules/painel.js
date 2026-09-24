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
// - Transferência de propostas por Gestor / ADM
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

let painelResponsaveisComerciais =
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


let painelTransferenciaAtual =
  null;


let painelTransferenciaProcessando =
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

function painelTemVisaoGlobal() {

  return [
    'gestor',
    'diretor',
    'adm'
  ].includes(
    painelPerfilAtual
      ?.tipo_acesso
  );
}


function painelPodeGerenciarComercial() {

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
// ## 4.1 VALIDADE COMERCIAL
// =========================================================

function validadeDiasPainel(
  validade
) {

  const valor =
    String(
      validade || ''
    )
      .trim()
      .toUpperCase();


  if (
    [
      'HOJE',
      '0 DIA',
      '0 DIAS'
    ].includes(
      valor
    )
  ) {

    return 0;

  }


  const numero =
    Number(
      valor.match(
        /\d+/
      )?.[0]
    );


  return Number.isFinite(
    numero
  )
    ? numero
    : null;
}


function dataSaoPauloPainel(
  valor = new Date()
) {

  const data =
    valor instanceof Date
      ? valor
      : new Date(
        valor
      );


  if (
    Number.isNaN(
      data.getTime()
    )
  ) {

    return null;

  }


  const partes =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          'America/Sao_Paulo',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit'
      }
    )
      .formatToParts(
        data
      );


  const obter =
    tipo =>
      partes.find(
        parte =>
          parte.type ===
          tipo
      )?.value;


  const ano =
    obter(
      'year'
    );


  const mes =
    obter(
      'month'
    );


  const dia =
    obter(
      'day'
    );


  if (
    !ano ||
    !mes ||
    !dia
  ) {

    return null;

  }


  return `${ano}-${mes}-${dia}`;
}


function adicionarDiasDataPainel(
  dataIso,
  dias
) {

  if (
    !dataIso ||
    !Number.isFinite(
      Number(
        dias
      )
    )
  ) {

    return null;

  }


  const partes =
    String(
      dataIso
    )
      .split(
        '-'
      )
      .map(
        Number
      );


  if (
    partes.length !== 3
  ) {

    return null;

  }


  const [
    ano,
    mes,
    dia
  ] =
    partes;


  const data =
    new Date(
      Date.UTC(
        ano,
        mes - 1,
        dia
      )
    );


  data.setUTCDate(
    data.getUTCDate() +
    Number(
      dias
    )
  );


  return data
    .toISOString()
    .slice(
      0,
      10
    );
}


function diferencaDiasPainel(
  dataInicial,
  dataFinal
) {

  if (
    !dataInicial ||
    !dataFinal
  ) {

    return 0;

  }


  const converter =
    valor => {

      const [
        ano,
        mes,
        dia
      ] =
        String(
          valor
        )
          .split(
            '-'
          )
          .map(
            Number
          );


      return Date.UTC(
        ano,
        mes - 1,
        dia
      );

    };


  return Math.round(
    (
      converter(
        dataFinal
      ) -
      converter(
        dataInicial
      )
    ) /
    86400000
  );
}


function calcularValidadePainel(
  proposta,
  revisao
) {

  const retorno = {

    dias:
      null,

    validadeAte:
      null,

    situacao:
      'sem_validade',

    diasVencida:
      0

  };


  if (
    !revisao ||
    String(
      revisao.status || ''
    ).toLowerCase() !==
    'enviada' ||
    !revisao.enviado_em
  ) {

    return retorno;

  }


  // Proposta encerrada não entra no acompanhamento
  // comercial de vencidas.

  if (
    [
      'concluido',
      'nao_conquistado'
    ].includes(
      proposta
        ?.status_comercial
    )
  ) {

    retorno.situacao =
      'encerrada';


    return retorno;

  }


  const dias =
    validadeDiasPainel(
      revisao.validade
    );


  if (
    dias === null
  ) {

    return retorno;

  }


  const dataEnvio =
    dataSaoPauloPainel(
      revisao.enviado_em
    );


  if (!dataEnvio) {

    return retorno;

  }


  const validadeAte =
    adicionarDiasDataPainel(
      dataEnvio,
      dias
    );


  if (!validadeAte) {

    return retorno;

  }


  const hoje =
    dataSaoPauloPainel();


  retorno.dias =
    dias;


  retorno.validadeAte =
    validadeAte;


  if (
    validadeAte <
    hoje
  ) {

    retorno.situacao =
      'vencida';


    retorno.diasVencida =
      diferencaDiasPainel(
        validadeAte,
        hoje
      );


    return retorno;

  }


  if (
    validadeAte ===
    hoje
  ) {

    retorno.situacao =
      'vence_hoje';


    return retorno;

  }


  retorno.situacao =
    'vigente';


  return retorno;
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


  // -------------------------------------------------------
  // O banco é a fonte oficial do valor de cada item.
  //
  // valor_total já considera:
  // - quantidade
  // - valor unitário com precisão
  // - desconto
  // - IPI após desconto
  // -------------------------------------------------------

  const totalRevisao =
    itens.reduce(
      (
        total,
        item
      ) => {

        return (
          total +
          (
            Number(
              item.valor_total
            ) || 0
          )
        );

      },
      0
    );


  // -------------------------------------------------------
  // A proposta comercial fecha em centavos.
  //
  // As 4 casas do valor unitário continuam sendo utilizadas
  // nos cálculos. O arredondamento ocorre somente depois que
  // o valor final da proposta foi calculado.
  // -------------------------------------------------------

  return Math.round(
    (
      totalRevisao +
      Number.EPSILON
    ) *
    100
  ) / 100;

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


        const validade =
          calcularValidadePainel(
            proposta,
            revisao
          );
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
            ),

          validadeDias:
            validade.dias,

          validadeAte:
            validade.validadeAte,

          situacaoValidade:
            validade.situacao,

          diasVencida:
            validade.diasVencida
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


function obterPerfilResponsavelPainel(
  userId
) {

  return painelResponsaveisComerciais.find(
    responsavel =>
      responsavel.user_id ===
      userId
  ) || null;

}


function nomeVendedorRegistroPainel(
  registro
) {

  const perfil =
    obterPerfilResponsavelPainel(
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


function diasRestantesMesPainel(
  ano,
  mes
) {

  const hojeIso =
    dataSaoPauloPainel();


  if (!hojeIso) {

    return null;

  }


  const [
    anoHoje,
    mesHoje,
    diaHoje
  ] =
    hojeIso
      .split('-')
      .map(Number);


  // Meta diária somente para o mês atual.

  if (
    Number(ano) !==
    anoHoje ||
    Number(mes) !==
    mesHoje
  ) {

    return null;

  }


  const ultimoDia =
    new Date(
      Date.UTC(
        anoHoje,
        mesHoje,
        0
      )
    )
      .getUTCDate();


  // Não contamos o dia atual.
  //
  // Exemplo:
  // dia 28 de um mês com 31 dias
  // → restam 3 dias.

  return Math.max(
    ultimoDia -
    diaHoje,
    0
  );

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

  const metaValorCard =
    document.getElementById(
      'painelMetaValorCard'
    );


  const faltaCard =
    document.getElementById(
      'painelMetaFaltaCard'
    );


  const atingimentoCard =
    document.getElementById(
      'painelMetaAtingimentoCard'
    );


  const progress =
    document.getElementById(
      'painelMetaProgress'
    );

  const esconderMetaIndividual =
    Boolean(
      gestorSelecionado
    );


  if (metaValorCard) {

    metaValorCard.hidden =
      esconderMetaIndividual;

  }


  if (faltaCard) {

    faltaCard.hidden =
      esconderMetaIndividual;

  }


  if (atingimentoCard) {

    atingimentoCard.hidden =
      esconderMetaIndividual;

  }


  if (progress) {

    progress.hidden =
      esconderMetaIndividual;

  }


  if (
    !wrapper ||
    !select
  ) {

    return;

  }


  if (
    painelTemVisaoGlobal()
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

            ${Array.from(
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
                      ${mes ===
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


      <div
  id="painelMetaValorCard"
  class="painel-meta-card"
>

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


      <div
  id="painelMetaFaltaCard"
  class="painel-meta-card falta"
>

        <span>
          FALTA
        </span>

        <strong id="painelMetaFalta">
          R$ 0,00
        </strong>

      </div>


      <div
  id="painelMetaDiariaCard"
  class="painel-meta-card diaria"
  hidden
>

  <span>
    META DIÁRIA NECESSÁRIA
  </span>

  <strong id="painelMetaDiaria">
    R$ 0,00
  </strong>

  <small id="painelMetaDiariaInfo">
    —
  </small>

</div>

      <div
  id="painelMetaAtingimentoCard"
  class="painel-meta-card atingimento"
>

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


    <div
  id="painelMetaProgress"
  class="painel-meta-progress"
>

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

function conquistadoResponsavelPainel(
  userId,
  ano,
  mes,
  timeEquipe = ''
) {

  const time =
    normalizarTimePainel(
      timeEquipe
    );


  return painelDados
    .filter(
      registro =>
        registro.vendedorId ===
        userId &&

        registro.proposta
          .status_comercial ===
        'concluido' &&

        (
          !time ||
          timeRegistroPainel(
            registro
          ) ===
          time
        ) &&

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
  // ## 19.2 Visão global — Gestor / Diretor / ADM
  // -------------------------------------------------------

  wrapper.style.display =
    '';


  const filtroTime =
    document
      .getElementById(
        'painelFiltroTime'
      )
      ?.value || '';


  const responsaveisDisponiveis =
    painelResponsaveisComerciais.filter(
      responsavel => {

        if (
          responsavel.tipo_acesso ===
          'gestor'
        ) {

          return true;

        }


        if (
          responsavel.tipo_acesso !==
          'vendedor'
        ) {

          return false;

        }


        if (!filtroTime) {

          return true;

        }


        return (
          normalizarTimePainel(
            responsavel.time_equipe
          ) ===
          filtroTime
        );

      }
    );


  const todos =
    document.createElement(
      'option'
    );


  todos.value =
    '';


  todos.textContent =
    'Todos os responsáveis';


  select.appendChild(
    todos
  );


  responsaveisDisponiveis.forEach(
    responsavel => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        responsavel.user_id;


      option.textContent =
        responsavel.tipo_acesso ===
          'gestor'
          ? `${responsavel.nome} — Gestor`
          : `${responsavel.nome} — ${nomeTimePainel(
            responsavel.time_equipe
          )}`;


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
        painelTemVisaoGlobal() &&
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
        painelTemVisaoGlobal() &&
        filtros.vendedor ===
        '__sem_responsavel__'
      ) {

        if (
          registro.vendedorId
        ) {

          return false;

        }

      } else if (
        painelTemVisaoGlobal() &&
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
        filtros.status ===
        '__vencida__'
      ) {

        if (
          registro.situacaoValidade !==
          'vencida'
        ) {

          return false;

        }

      } else if (
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
      ${escaparPainel(
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
      ${escaparPainel(
    nomeStatusPainel(
      normalizado
    )
  )
    }
    </span>
  `;
}

function badgeValidadePainel(
  registro
) {

  const situacao =
    registro
      ?.situacaoValidade ||
    'sem_validade';


  const validadeAte =
    registro
      ?.validadeAte ||
    null;


  if (
    situacao ===
    'vencida'
  ) {

    const dias =
      Number(
        registro.diasVencida
      ) || 0;


    return `

      <div class="painel-validade">

        <span class="painel-badge validade vencida">
          VENCIDA
        </span>

        <small>
          ${dias === 1
        ? 'há 1 dia'
        : `há ${dias} dias`
      }
        </small>

      </div>

    `;

  }


  if (
    situacao ===
    'vence_hoje'
  ) {

    return `

      <div class="painel-validade">

        <span class="painel-badge validade vence-hoje">
          VENCE HOJE
        </span>

      </div>

    `;

  }


  if (
    situacao ===
    'vigente'
  ) {

    return `

      <div class="painel-validade">

        <span class="painel-badge validade vigente">
          VIGENTE
        </span>

        <small>
          até ${escaparPainel(
      formatarDataPainel(
        validadeAte
      )
    )
      }
        </small>

      </div>

    `;

  }


  if (
    situacao ===
    'encerrada'
  ) {

    return `

      <div class="painel-validade">

        <span class="painel-badge validade encerrada">
          ENCERRADA
        </span>

      </div>

    `;

  }


  return `

    <div class="painel-validade">

      <span class="painel-badge validade sem-validade">
        —
      </span>

    </div>

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
      ${escaparPainel(
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
        ${status ===
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

    vencida: {
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

      if (
        registro.situacaoValidade ===
        'vencida'
      ) {

        indicadores.vencida.quantidade +=
          1;


        indicadores.vencida.valor +=
          registro.valor;

      }

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
    'painelQtdVencida',
    'painelValorVencida',
    indicadores.vencida
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

  const diariaCard =
    document.getElementById(
      'painelMetaDiariaCard'
    );


  const diariaInfo =
    document.getElementById(
      'painelMetaDiariaInfo'
    );


  if (!titulo) {

    return;

  }


  const periodo =
    periodoMetaPainel();


  const filtros =
    obterFiltrosPainel();


  const responsavelSelecionado =
    (
      filtros.vendedor &&
      filtros.vendedor !==
      '__sem_responsavel__'
    )
      ? obterPerfilResponsavelPainel(
        filtros.vendedor
      )
      : null;


  const vendedorSelecionado =
    responsavelSelecionado
      ?.tipo_acesso ===
      'vendedor'
      ? responsavelSelecionado
      : null;


  const gestorSelecionado =
    responsavelSelecionado
      ?.tipo_acesso ===
      'gestor'
      ? responsavelSelecionado
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

  else if (
    gestorSelecionado
  ) {

    metaTotal =
      0;


    conquistado =
      conquistadoResponsavelPainel(
        gestorSelecionado.user_id,
        periodo.ano,
        periodo.mes,
        filtros.time
      );


    titulo.textContent =
      `📊 Resultado de ${gestorSelecionado.nome}`;


    if (labelMeta) {

      labelMeta.textContent =
        'SEM META INDIVIDUAL';

    }


    if (subtitulo) {

      subtitulo.textContent =
        filtros.time
          ? `${nomeMesPainel(
            periodo.mes
          )} de ${periodo.ano} • ` +
          `Time ${nomeTimePainel(
            filtros.time
          )}`
          : `${nomeMesPainel(
            periodo.mes
          )} de ${periodo.ano} • Gestor`;

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

  const diasRestantes =
    diasRestantesMesPainel(
      periodo.ano,
      periodo.mes
    );


  const mostrarMetaDiaria =
    painelEhVendedor() &&
    diasRestantes !== null &&
    metaTotal > 0;


  let metaDiaria =
    0;


  let textoMetaDiaria =
    '';


  if (
    mostrarMetaDiaria
  ) {

    if (
      falta <= 0
    ) {

      metaDiaria =
        0;


      textoMetaDiaria =
        'Meta atingida';

    } else if (
      diasRestantes > 0
    ) {

      metaDiaria =
        falta /
        diasRestantes;


      textoMetaDiaria =
        diasRestantes === 1
          ? '1 dia restante'
          : `${diasRestantes} dias restantes`;

    } else {

      metaDiaria =
        falta;


      textoMetaDiaria =
        'Último dia do mês';

    }

  }


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
    'painelMetaDiaria',
    formatarMoedaPainel(
      metaDiaria
    )
  );


  if (
    diariaInfo
  ) {

    diariaInfo.textContent =
      textoMetaDiaria;

  }


  if (
    diariaCard
  ) {

    diariaCard.hidden =
      !mostrarMetaDiaria;

  }

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
    painelTemVisaoGlobal() &&
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
            ${escaparPainel(
        nomeTimePainel(
          time
        )
      )
        }
          </strong>

          ${badgeTimePainel(
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
              ${formatarMoedaPainel(
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
              ${formatarMoedaPainel(
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
              ${formatarMoedaPainel(
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
    !painelTemVisaoGlobal() ||
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
            ${escaparPainel(
        linha.vendedor.nome
      )
        }
          </b>

        </td>


        <td>

          ${badgeTimePainel(
          linha.vendedor
            .time_equipe
        )
        }

        </td>


        <td>

          ${formatarMoedaPainel(
          linha.meta
        )
        }

        </td>


        <td>

          <b>
            ${formatarMoedaPainel(
          linha.conquistado
        )
        }
          </b>

        </td>


        <td>

          ${formatarMoedaPainel(
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
// ## 26. TRANSFERÊNCIA DE PROPOSTA
// =========================================================

function montarModalTransferenciaPainel() {

  if (
    document.getElementById(
      'painelTransferenciaModal'
    )
  ) {

    return;

  }


  const modal =
    document.createElement(
      'div'
    );


  modal.id =
    'painelTransferenciaModal';

  modal.className =
    'painel-transferencia-modal';

  modal.hidden =
    true;


  modal.innerHTML = `

    <div
      class="painel-transferencia-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="painelTransferenciaTitulo"
    >

      <div class="painel-transferencia-head">

        <div>

          <span class="painel-transferencia-kicker">
            GESTÃO DE RESPONSÁVEL
          </span>

          <h3 id="painelTransferenciaTitulo">
            Transferir proposta
          </h3>

          <p id="painelTransferenciaSubtitulo">
            Selecione o novo responsável e registre o motivo.
          </p>

        </div>


        <button
          type="button"
          class="painel-transferencia-fechar"
          aria-label="Fechar"
          onclick="fecharTransferenciaPainel()"
        >
          ×
        </button>

      </div>


      <div class="painel-transferencia-body">

        <div class="painel-transferencia-atual">

          <span>
            RESPONSÁVEL ATUAL
          </span>

          <strong id="painelTransferenciaResponsavelAtual">
            —
          </strong>

          <small id="painelTransferenciaTimeAtual">
            —
          </small>

        </div>


        <div class="field">

          <label for="painelTransferenciaVendedor">
            Novo responsável
          </label>

          <select id="painelTransferenciaVendedor">

            <option value="">
              Selecione um vendedor
            </option>

          </select>

          <div
            id="painelTransferenciaDestinoInfo"
            class="painel-transferencia-destino-info"
          >
            Selecione o novo responsável.
          </div>

        </div>


        <div class="field">

          <label for="painelTransferenciaMotivo">
            Motivo da transferência
          </label>

          <textarea
            id="painelTransferenciaMotivo"
            rows="4"
            maxlength="500"
            placeholder="Ex.: redistribuição de carteira, troca de responsável ou atendimento por outro vendedor."
          ></textarea>

          <div class="painel-transferencia-ajuda">
            Obrigatório • mínimo de 5 caracteres • máximo de 500
          </div>

        </div>

      </div>


      <div class="painel-transferencia-footer">

        <button
          type="button"
          class="btn light"
          onclick="fecharTransferenciaPainel()"
        >
          Cancelar
        </button>

        <button
          type="button"
          id="painelTransferenciaConfirmar"
          class="btn navy"
          onclick="confirmarTransferenciaPainel()"
        >
          Confirmar transferência
        </button>

      </div>

    </div>

  `;


  modal.addEventListener(
    'click',
    evento => {

      if (
        evento.target === modal
      ) {

        fecharTransferenciaPainel();

      }

    }
  );


  document.body.appendChild(
    modal
  );


  document
    .getElementById(
      'painelTransferenciaVendedor'
    )
    ?.addEventListener(
      'change',
      atualizarDestinoTransferenciaPainel
    );

}


function atualizarDestinoTransferenciaPainel() {

  const select =
    document.getElementById(
      'painelTransferenciaVendedor'
    );


  const info =
    document.getElementById(
      'painelTransferenciaDestinoInfo'
    );


  if (
    !select ||
    !info
  ) {

    return;

  }


  const responsavel =
    painelResponsaveisComerciais.find(
      item =>
        item.user_id ===
        select.value
    );

  if (!responsavel) {

    info.textContent =
      'Selecione o novo responsável.';

    return;

  }


  info.textContent =
    responsavel.tipo_acesso ===
      'gestor'
      ? `${responsavel.nome} • Gestor`
      : `${responsavel.nome} • Time ${nomeTimePainel(
        responsavel.time_equipe
      )}`;
}


function abrirTransferenciaPainel(
  propostaId
) {

  if (
    !painelPodeGerenciarComercial()
  ) {

    alert(
      'Apenas Gestor ou ADM podem transferir propostas.'
    );

    return;

  }


  montarModalTransferenciaPainel();


  const registro =
    painelDados.find(
      item =>
        item.proposta.id ===
        propostaId
    );


  if (!registro) {

    alert(
      'Não foi possível localizar a proposta no painel.'
    );

    return;

  }


  const responsavelAtualPerfil =
    obterPerfilResponsavelPainel(
      registro.vendedorId
    );


  const timeProposta =
    timeRegistroPainel(
      registro
    );


  const candidatos =
    painelResponsaveisComerciais.filter(
      responsavel => {

        if (
          responsavel.user_id ===
          registro.vendedorId
        ) {

          return false;

        }


        if (
          responsavel.tipo_acesso ===
          'gestor'
        ) {

          return true;

        }


        if (
          responsavel.tipo_acesso ===
          'vendedor'
        ) {

          return (
            normalizarTimePainel(
              responsavel.time_equipe
            ) ===
            timeProposta
          );

        }


        return false;

      }
    );

  if (!candidatos.length) {

    alert(
      'Não existe outro responsável comercial disponível para receber esta proposta.'
    );

    return;

  }


  painelTransferenciaAtual =
    registro;


  const modal =
    document.getElementById(
      'painelTransferenciaModal'
    );


  const titulo =
    document.getElementById(
      'painelTransferenciaTitulo'
    );


  const subtitulo =
    document.getElementById(
      'painelTransferenciaSubtitulo'
    );


  const responsavelAtual =
    document.getElementById(
      'painelTransferenciaResponsavelAtual'
    );


  const timeAtual =
    document.getElementById(
      'painelTransferenciaTimeAtual'
    );


  const select =
    document.getElementById(
      'painelTransferenciaVendedor'
    );


  const motivo =
    document.getElementById(
      'painelTransferenciaMotivo'
    );


  if (
    !modal ||
    !select ||
    !motivo
  ) {

    return;

  }


  if (titulo) {

    titulo.textContent =
      `Transferir proposta #${registro.proposta.numero}`;

  }


  if (subtitulo) {

    subtitulo.textContent =
      registro.revisao.nome_proposta ||
      'Selecione o novo responsável e registre o motivo.';

  }


  if (responsavelAtual) {

    responsavelAtual.textContent =
      responsavelAtualPerfil?.nome ||
      registro.revisao.vendedor_nome ||
      'Sem responsável';

  }


  if (timeAtual) {

    const timeDoResponsavel =
      normalizarTimePainel(
        responsavelAtualPerfil?.time_equipe
      );


    const timeDocumento =
      timeRegistroPainel(
        registro
      );


    timeAtual.textContent =
      timeDoResponsavel
        ? `Time atual do responsável: ${nomeTimePainel(
          timeDoResponsavel
        )} • Documento: ${nomeTimePainel(
          timeDocumento
        )}`
        : `Documento: ${nomeTimePainel(
          timeDocumento
        )}`;

  }


  select.innerHTML = `

    <option value="">
      Selecione um responsável
    </option>

  `;


  candidatos.forEach(
    responsavel => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        responsavel.user_id;


      const tipo =
        responsavel.tipo_acesso ===
          'gestor'
          ? 'Gestor'
          : nomeTimePainel(
            responsavel.time_equipe
          );


      option.textContent =
        `${responsavel.nome} — ${tipo}`;


      select.appendChild(
        option
      );

    }
  );

  motivo.value =
    '';


  atualizarDestinoTransferenciaPainel();


  modal.hidden =
    false;


  document.body.classList.add(
    'painel-modal-aberto'
  );


  setTimeout(
    () => {

      select.focus();

    },
    30
  );

}


function fecharTransferenciaPainel() {

  if (
    painelTransferenciaProcessando
  ) {

    return;

  }


  const modal =
    document.getElementById(
      'painelTransferenciaModal'
    );


  if (modal) {

    modal.hidden =
      true;

  }


  document.body.classList.remove(
    'painel-modal-aberto'
  );


  painelTransferenciaAtual =
    null;

}


async function confirmarTransferenciaPainel() {

  if (
    painelTransferenciaProcessando ||
    !painelTransferenciaAtual
  ) {

    return;

  }


  if (
    !painelPodeGerenciarComercial()
  ) {

    alert(
      'Apenas Gestor ou ADM podem transferir propostas.'
    );

    return;

  }


  const select =
    document.getElementById(
      'painelTransferenciaVendedor'
    );


  const motivoEl =
    document.getElementById(
      'painelTransferenciaMotivo'
    );


  const botao =
    document.getElementById(
      'painelTransferenciaConfirmar'
    );


  const vendedorNovoId =
    String(
      select?.value || ''
    ).trim();


  const motivo =
    String(
      motivoEl?.value || ''
    ).trim();


  if (!vendedorNovoId) {

    alert(
      'Selecione o novo responsável comercial.'
    );

    select?.focus();

    return;

  }


  if (
    vendedorNovoId ===
    painelTransferenciaAtual.vendedorId
  ) {

    alert(
      'Selecione um vendedor diferente do responsável atual.'
    );

    return;

  }


  if (
    motivo.length < 5
  ) {

    alert(
      'Informe um motivo com pelo menos 5 caracteres.'
    );

    motivoEl?.focus();

    return;

  }


  if (
    motivo.length > 500
  ) {

    alert(
      'O motivo pode ter no máximo 500 caracteres.'
    );

    motivoEl?.focus();

    return;

  }


  const novoResponsavel =
    obterPerfilResponsavelPainel(
      vendedorNovoId
    );


  const confirmar =
    window.confirm(
      `Transferir a proposta #${painelTransferenciaAtual.proposta.numero} ` +
      `para ${novoResponsavel?.nome || 'o vendedor selecionado'}?\n\n` +
      'A alteração será registrada no histórico de transferências.'
    );


  if (!confirmar) {

    return;

  }


  painelTransferenciaProcessando =
    true;


  const textoOriginal =
    botao?.textContent ||
    'Confirmar transferência';


  if (botao) {

    botao.disabled =
      true;

    botao.textContent =
      'Transferindo...';

  }


  if (select) {

    select.disabled =
      true;

  }


  if (motivoEl) {

    motivoEl.disabled =
      true;

  }


  try {

    const propostaNumero =
      painelTransferenciaAtual
        .proposta
        .numero;


    await transferirProposta({

      propostaId:
        painelTransferenciaAtual
          .proposta
          .id,

      vendedorNovoId,

      motivo

    });


    const modal =
      document.getElementById(
        'painelTransferenciaModal'
      );


    if (modal) {

      modal.hidden =
        true;

    }


    document.body.classList.remove(
      'painel-modal-aberto'
    );


    painelTransferenciaAtual =
      null;


    toastMsg(
      `Proposta #${propostaNumero} transferida para ${novoResponsavel?.nome || 'o novo responsável'}`
    );


    await carregarPainel();

  } catch (erro) {

    console.error(
      'Erro ao transferir proposta:',
      erro
    );


    toastMsg(
      'Erro ao transferir proposta'
    );


    alert(
      'Não foi possível transferir a proposta.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  } finally {

    painelTransferenciaProcessando =
      false;


    if (botao) {

      botao.disabled =
        false;

      botao.textContent =
        textoOriginal;

    }


    if (select) {

      select.disabled =
        false;

    }


    if (motivoEl) {

      motivoEl.disabled =
        false;

    }

  }

}

// =========================================================
// ## 26.1 CONSULTAR REVISÕES PELO PAINEL
// =========================================================

function abrirRevisoesPainel(
  propostaId
) {

  if (
    typeof abrirRevisoesHistorico !==
    'function'
  ) {

    alert(
      'O histórico de revisões ainda não está disponível.\n\n' +
      'Atualize a página e tente novamente.'
    );

    return;

  }


  abrirRevisoesHistorico(
    propostaId
  );

}

// =========================================================
// ## 27. RENDERIZAR TABELA PRINCIPAL
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


      const responsavelPerfil =
        obterPerfilResponsavelPainel(
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
            ${escaparPainel(
        revisao.nome_proposta ||
        'Sem nome'
      )
        }
          </b>

          <div class="painel-secondary">

            ${escaparPainel(
          revisao.cliente ||
          'Cliente não informado'
        )
        }

          </div>

        </td>


        <td>

          ${escaparPainel(
          nomeVendedorRegistroPainel(
            registro
          )
        )
        }

          ${!responsavelPerfil
          ? `
                <div class="painel-secondary">
                  ${registro.vendedorId
            ? 'USUÁRIO NÃO LOCALIZADO'
            : 'SEM VÍNCULO'
          }
                </div>
              `
          : ''
        }

        </td>


        <td>

          ${formatarDataPainel(
          revisao.data_proposta
        )
        }

        </td>


        <td>

          ${badgeOrigemPainel(
          proposta.origem_comercial
        )
        }

        </td>


        <td>

          ${badgeStatusPainel(
          proposta.status_comercial
        )
        }

        </td>


        <td class="painel-value">

          ${formatarMoedaPainel(
          registro.valor
        )
        }

        </td>


        <td>

          ${badgeRevisaoPainel(
          revisao
        )
        }

        </td>

        <td>

          ${badgeValidadePainel(
          registro
        )
        }

        </td>

        
        <td>

          <div class="painel-actions">

            <button
              type="button"
              class="btn light painel-revisoes"
              onclick="
                abrirRevisoesPainel(
                  '${escaparPainel(
          proposta.id
        )}'
                )
              "
            >
              Revisões
            </button>


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


            ${painelPodeGerenciarComercial()
          ? `
                  <button
                    type="button"
                    class="btn light painel-transferir"
                    onclick="
                      abrirTransferenciaPainel(
                        '${escaparPainel(
            proposta.id
          )}'
                      )
                    "
                  >
                    Transferir
                  </button>
                `
          : ''
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
// ## 28. CARREGAR METAS DO RESUMO
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
      painelTemVisaoGlobal()
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
// ## 29. CARREGAR PAINEL
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

  montarModalTransferenciaPainel();


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
          colspan="10"
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
      painelTemVisaoGlobal()
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


    painelResponsaveisComerciais =
      painelPerfis
        .filter(
          perfil =>
            perfil.ativo &&
            [
              'vendedor',
              'gestor'
            ].includes(
              perfil.tipo_acesso
            )
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
// ## 30. ABRIR PÁGINA
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
// ## 31. LIMPAR FILTROS
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
// ## 32. ABRIR PROPOSTA
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


    if (
      typeof instalarSuporteRevisoesHistoricas ===
      'function'
    ) {

      instalarSuporteRevisoesHistoricas();

    }


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
// ## 33. EVENTOS DOS FILTROS
// =========================================================

function iniciarPainel() {

  montarFiltroTimePainel();

  montarResumoMetaPainel();

  montarResumoTimesPainel();

  montarComparativoPainel();

  montarModalTransferenciaPainel();


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


  document.addEventListener(
    'keydown',
    evento => {

      if (
        evento.key === 'Escape' &&
        !document
          .getElementById(
            'painelTransferenciaModal'
          )
          ?.hidden
      ) {

        fecharTransferenciaPainel();

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
    iniciarPainel
  );

} else {

  iniciarPainel();

}