// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: medidas.js
//
// Responsabilidade:
// - Manter o catálogo de medidas por categoria
// - Definir cilindros padrão e regras de espessura
// - Verificar compatibilidade de largura / cilindro
// - Calcular bobina, aba, kg por milheiro e pedido mínimo
// - Calcular a quantidade mínima comercial em unidades
// - Exibir classificação, motivos e sugestões comerciais
//
// Dependências:
// - js/core/core.js
// - Elementos do módulo de Medidas no index.html
//
// Regras principais atuais:
// - Cilindros padrão: 32, 35, 40, 45, 49, 52, 56 e 62 cm
// - Medida padrão: mínimo de 100 kg
// - Medida não padrão: mínimo de 200 kg
// - Alta Densidade (AD): mínimo obrigatório de 200 kg
// - Bobina = altura × 2
// - Com aba: altura de cálculo = altura + (aba / 2)
// - Quantidade comercial = base + 10%, arredondada para cima
//
// IMPORTANTE:
// As fórmulas deste arquivo já foram validadas no projeto.
// Nesta etapa o código foi apenas organizado e documentado.
// =========================================================


// =========================================================
// ## 1. CONFIGURAÇÕES E CATÁLOGO
// =========================================================

// ---------------------------------------------------------
// ## 1.1 Cilindros padrão disponíveis
// ---------------------------------------------------------

const CILINDROS_PADRAO = [
  32,
  35,
  40,
  45,
  49,
  52,
  56,
  62
];


// ---------------------------------------------------------
// ## 1.2 Medidas oficiais por categoria
// ---------------------------------------------------------

const MEDIDAS_CATALOGO = {

  sacola_vazada: [
    { larg: 16, alt: 25, aba: 0, esp: '0,008' },
    { larg: 20, alt: 30, aba: 0, esp: '0,008' },
    { larg: 26, alt: 35, aba: 0, esp: '0,008' },
    { larg: 32, alt: 35, aba: 0, esp: '0,008' },
    { larg: 32, alt: 40, aba: 0, esp: '0,010' },
    { larg: 35, alt: 50, aba: 0, esp: '0,010' },
    { larg: 40, alt: 50, aba: 0, esp: '0,010' }
  ],


  envelope_seguranca_coex: [
    { larg: 16, alt: 23, aba: 3, esp: '0,010' },
    { larg: 20, alt: 28, aba: 3, esp: '0,010' },
    { larg: 26, alt: 35, aba: 3, esp: '0,010' },
    { larg: 32, alt: 40, aba: 3, esp: '0,010' },
    { larg: 40, alt: 47, aba: 3, esp: '0,010' }
  ],


  envelope_sacola_coex: [
    { larg: 16, alt: 30, aba: 3, esp: '0,010' },
    { larg: 20, alt: 37, aba: 3, esp: '0,010' },
    { larg: 26, alt: 43, aba: 3, esp: '0,010' },
    { larg: 32, alt: 40, aba: 3, esp: '0,010' },
    { larg: 40, alt: 47, aba: 3, esp: '0,010' }
  ],


  envelope_platinum_termica_pp: [
    { larg: 20, alt: 28, aba: 4, esp: '0,013' },
    { larg: 26, alt: 36, aba: 4, esp: '0,013' },
    { larg: 32, alt: 36, aba: 4, esp: '0,013' },
    { larg: 40, alt: 46, aba: 4, esp: '0,013' }
  ],


  metalizado_pizza_lanche: [
    { larg: 22.5, alt: 22, aba: 4, esp: '0,004' },
    { larg: 32, alt: 34, aba: 4, esp: '0,004' },
    { larg: 45, alt: 46, aba: 5, esp: '0,004' },
    { larg: 52, alt: 52, aba: 5, esp: '0,004' }
  ],


  metalizado_espetinho: [
    { larg: 13.5, alt: 36, aba: 4, esp: '0,006' }
  ],


  metalizado_congelado: [
    { larg: 22.5, alt: 22, aba: 4, esp: '0,006' },
    { larg: 26, alt: 36, aba: 4, esp: '0,006' },
    { larg: 32, alt: 36, aba: 4, esp: '0,006' },
    { larg: 40, alt: 36, aba: 4, esp: '0,006' }
  ],


  sacola_metalizada_platinum_pp: [
    { larg: 20, alt: 30, aba: 0, esp: '0,013' },
    { larg: 26, alt: 37, aba: 0, esp: '0,013' },
    { larg: 32, alt: 37, aba: 0, esp: '0,013' },
    { larg: 40, alt: 50, aba: 0, esp: '0,013' }
  ]

};


// ---------------------------------------------------------
// ## 1.3 Nomes exibidos para cada categoria
// ---------------------------------------------------------

const NOMES_CATEGORIA = {

  sacola_vazada:
    'Sacola Vazada',

  envelope_seguranca_coex:
    'Envelope de Segurança (COEX)',

  envelope_sacola_coex:
    'Envelope Sacola (COEX)',

  envelope_platinum_termica_pp:
    'Envelope Platinum Térmica 0,013 (PP)',

  metalizado_pizza_lanche:
    'Envelope Metalizado — Pizza e Lanche',

  metalizado_espetinho:
    'Envelope Metalizado — Espetinho',

  metalizado_congelado:
    'Envelope Metalizado — Congelado',

  sacola_metalizada_platinum_pp:
    'Sacola Metalizada Platinum 0,013 (PP)'

};


// =========================================================
// ## 2. FORMATAÇÃO E NORMALIZAÇÃO
// =========================================================

function nomeCategoria(cat) {

  return (
    NOMES_CATEGORIA[cat] ||
    cat
  );
}


function numeroPt(v) {

  return String(v)
    .replace(
      '.',
      ','
    );
}


function normalizarEspessura(valor) {

  const txt =
    String(valor ?? '')
      .trim()
      .replace(
        ',',
        '.'
      );


  if (!txt) {

    return '';

  }


  const n =
    Number(txt);


  if (
    !Number.isFinite(n)
  ) {

    return String(valor)
      .trim();

  }


  return n
    .toFixed(3)
    .replace(
      '.',
      ','
    );
}


function formatDecimal(
  valor,
  casas = 10
) {

  if (
    !Number.isFinite(valor)
  ) {

    return '—';

  }


  return valor.toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: casas
    }
  );
}


// =========================================================
// ## 3. REGRAS DE CATÁLOGO E ESPESSURA
// =========================================================

function catalogoDaCategoria(cat) {

  return (
    MEDIDAS_CATALOGO[cat] ||
    []
  );
}


function regraEspessuraPorAltura(cat) {

  const mapa =
    {};


  catalogoDaCategoria(cat)
    .forEach(
      medida => {

        if (
          !mapa[medida.alt]
        ) {

          mapa[medida.alt] =
            medida.esp;

        }

      }
    );


  return mapa;
}


function espessuraPorAltura(
  cat,
  alt
) {

  const regras =
    regraEspessuraPorAltura(
      cat
    );


  return (
    regras[Number(alt)] ||
    ''
  );
}


function itemCatalogo(
  cat,
  larg,
  alt
) {

  return (
    catalogoDaCategoria(cat)
      .find(
        medida =>
          Math.abs(
            medida.larg - larg
          ) < 0.0001
          &&
          Math.abs(
            medida.alt - alt
          ) < 0.0001
      )
    ||
    null
  );
}


// =========================================================
// ## 4. LARGURAS, CILINDROS E SUGESTÕES
// =========================================================

function largurasDisponiveis(cat) {

  const valores =
    [];


  CILINDROS_PADRAO.forEach(
    cilindro => {

      valores.push(
        cilindro
      );

      valores.push(
        cilindro / 2
      );

    }
  );


  catalogoDaCategoria(cat)
    .forEach(
      medida => {

        valores.push(
          medida.larg
        );

      }
    );


  return [
    ...new Set(
      valores.map(
        valor =>
          Number(
            valor.toFixed(4)
          )
      )
    )
  ]
    .sort(
      (a, b) =>
        a - b
    );
}


function sugestaoLargura(
  cat,
  larg
) {

  if (!larg) {

    return [];

  }


  const valores =
    largurasDisponiveis(cat)
      .filter(
        valor =>
          Math.abs(
            valor - larg
          ) > 0.0001
      );


  if (!valores.length) {

    return [];

  }


  const menorDiferenca =
    Math.min(
      ...valores.map(
        valor =>
          Math.abs(
            valor - larg
          )
      )
    );


  return valores
    .filter(
      valor =>
        Math.abs(
          Math.abs(
            valor - larg
          ) -
          menorDiferenca
        ) < 0.0001
    )
    .slice(
      0,
      2
    );
}


function encontrarCilindro(
  cat,
  larg,
  alt
) {

  if (!larg) {

    return {

      cil: null,

      tipo: null,

      catalogo: false

    };

  }


  // -------------------------------------------------------
  // ## 4.1 Largura igual ao cilindro
  // -------------------------------------------------------

  const direto =
    CILINDROS_PADRAO.find(
      cilindro =>
        Math.abs(
          cilindro - larg
        ) < 0.0001
    );


  if (direto) {

    return {

      cil: direto,

      tipo: 'direto',

      catalogo: false

    };

  }


  // -------------------------------------------------------
  // ## 4.2 Largura batendo duas vezes no cilindro
  // -------------------------------------------------------

  const dobro =
    larg * 2;


  const batido =
    CILINDROS_PADRAO.find(
      cilindro =>
        Math.abs(
          cilindro - dobro
        ) < 0.0001
    );


  if (batido) {

    return {

      cil: batido,

      tipo: '2x',

      catalogo: false

    };

  }


  // -------------------------------------------------------
  // ## 4.3 Exceção para medidas oficiais de catálogo
  // -------------------------------------------------------

  // Medidas oficiais de catálogo são consideradas
  // produzíveis mesmo quando usam cilindro específico
  // não listado no quadro geral.

  const catItem =

    itemCatalogo(
      cat,
      larg,
      alt
    )

    ||

    catalogoDaCategoria(cat)
      .find(
        medida =>
          Math.abs(
            medida.larg - larg
          ) < 0.0001
      );


  if (catItem) {

    return {

      cil: dobro,

      tipo: 'catalogo2x',

      catalogo: true

    };

  }


  return {

    cil: null,

    tipo: null,

    catalogo: false

  };
}


// =========================================================
// ## 5. RENDERIZAÇÃO DAS TABELAS DE APOIO
// =========================================================


// ---------------------------------------------------------
// ## 5.1 Catálogo da categoria
// ---------------------------------------------------------

function renderCatalogo() {

  const cat =
    document
      .getElementById(
        'mCategoria'
      )
      .value;


  const body =
    document.getElementById(
      'catalogBody'
    );


  const title =
    document.getElementById(
      'catalogTitle'
    );


  if (!body) {

    return;

  }


  title.textContent =
    'Medidas de catálogo — ' +
    nomeCategoria(cat);


  body.innerHTML =
    '';


  catalogoDaCategoria(cat)
    .forEach(
      (medida, i) => {

        const tr =
          document.createElement(
            'tr'
          );


        tr.innerHTML = `
          <td>
            ${numeroPt(medida.larg)}
          </td>

          <td>
            ${numeroPt(medida.alt)}
          </td>

          <td>
            ${
              medida.aba
                ? (
                    '+' +
                    numeroPt(medida.aba) +
                    ' cm'
                  )
                : '—'
            }
          </td>

          <td>
            ${medida.esp}
          </td>

          <td>
            <b>100 kg*</b>
          </td>

          <td>
            <button
              class="btn light"
              type="button"
              style="padding:6px 10px"
              onclick="useCatalogo('${cat}',${i})"
            >
              Usar
            </button>
          </td>
        `;


        body.appendChild(
          tr
        );

      }
    );
}


// ---------------------------------------------------------
// ## 5.2 Regra de altura × espessura
// ---------------------------------------------------------

function renderEspessuras() {

  const cat =
    document
      .getElementById(
        'mCategoria'
      )
      .value;


  const body =
    document.getElementById(
      'espBody'
    );


  const title =
    document.getElementById(
      'espTitle'
    );


  if (!body) {

    return;

  }


  title.textContent =
    'Regra de altura × espessura — ' +
    nomeCategoria(cat);


  body.innerHTML =
    '';


  const mapa =
    regraEspessuraPorAltura(
      cat
    );


  Object.keys(mapa)

    .map(Number)

    .sort(
      (a, b) =>
        a - b
    )

    .forEach(
      alt => {

        const tr =
          document.createElement(
            'tr'
          );


        tr.innerHTML = `
          <td>
            <b>${numeroPt(alt)}</b>
          </td>

          <td>
            ${mapa[alt]} mm
          </td>
        `;


        body.appendChild(
          tr
        );

      }
    );
}


// =========================================================
// ## 6. AÇÕES DO MÓDULO
// =========================================================


// ---------------------------------------------------------
// ## 6.1 Utilizar medida do catálogo
// ---------------------------------------------------------

function useCatalogo(
  cat,
  i
) {

  const medida =
    MEDIDAS_CATALOGO[cat][i];


  document
    .getElementById(
      'mCategoria'
    )
    .value =
      cat;


  document
    .getElementById(
      'mLargDesejada'
    )
    .value =
      medida.larg;


  document
    .getElementById(
      'mAltDesejada'
    )
    .value =
      medida.alt;


  ajustarDensidadeCategoria();

  renderCatalogo();

  renderEspessuras();

  calcMedidas();
}


// ---------------------------------------------------------
// ## 6.2 Ajuste automático da densidade
// ---------------------------------------------------------

function ajustarDensidadeCategoria() {

  const cat =
    document
      .getElementById(
        'mCategoria'
      )
      .value;


  const seletor =
    document.getElementById(
      'mDensidade'
    );


  if (
    cat === 'sacola_vazada'
  ) {

    if (
      seletor.value === 'na'
    ) {

      seletor.value =
        'bd';

    }

  } else {

    if (
      seletor.value === 'bd'
      ||
      seletor.value === 'ad'
    ) {

      seletor.value =
        'na';

    }

  }
}


// ---------------------------------------------------------
// ## 6.3 Limpeza do formulário de medidas
// ---------------------------------------------------------

function clearMedidas() {

  document
    .getElementById(
      'mCategoria'
    )
    .value =
      'sacola_vazada';


  document
    .getElementById(
      'mDensidade'
    )
    .value =
      'bd';


  document
    .getElementById(
      'mLargDesejada'
    )
    .value =
      '';


  document
    .getElementById(
      'mAltDesejada'
    )
    .value =
      '';


  [
    'mEsp',
    'mAba',
    'mCil',
    'mBob'
  ]
    .forEach(
      id => {

        document
          .getElementById(id)
          .value =
            '';

      }
    );


  renderCatalogo();

  renderEspessuras();

  calcMedidas();
}


// =========================================================
// ## 7. CÁLCULO PRINCIPAL DE MEDIDAS
// =========================================================

function calcMedidas() {


  // -------------------------------------------------------
  // ## 7.1 Leitura das entradas
  // -------------------------------------------------------

  const cat =
    document
      .getElementById(
        'mCategoria'
      )
      .value;


  const dens =
    document
      .getElementById(
        'mDensidade'
      )
      .value;


  const larg =
    Number(
      document
        .getElementById(
          'mLargDesejada'
        )
        .value
    ) || 0;


  const alt =
    Number(
      document
        .getElementById(
          'mAltDesejada'
        )
        .value
    ) || 0;


  // -------------------------------------------------------
  // ## 7.2 Espessura, bobina, aba e cilindro
  // -------------------------------------------------------

  const esp =
    espessuraPorAltura(
      cat,
      alt
    );


  const espN =
    Number(
      String(esp)
        .replace(
          ',',
          '.'
        )
    ) || 0;


  const bob =
    alt
      ? alt * 2
      : 0;


  const catalogItem =
    itemCatalogo(
      cat,
      larg,
      alt
    );


  const aba =
    catalogItem
      ? catalogItem.aba
      : 0;


  const encaixe =
    encontrarCilindro(
      cat,
      larg,
      alt
    );


  const cil =
    encaixe.cil;


  // -------------------------------------------------------
  // ## 7.3 Classificação da medida
  // -------------------------------------------------------

  const medidaPreenchida =
    larg > 0 &&
    alt > 0;


  const alturaComEspessuraPadrao =
    !!esp;


  const larguraCompativel =
    !!cil;


  const catalogo =
    !!catalogItem &&
    catalogItem.esp === esp;


  const padraoProducao =

    medidaPreenchida

    &&

    larguraCompativel

    &&

    alturaComEspessuraPadrao;


  // -------------------------------------------------------
  // ## 7.4 Pedido mínimo em kg
  // -------------------------------------------------------

  const minimoPorMedida =
    padraoProducao
      ? 100
      : 200;


  const pedido =
    dens === 'ad'
      ? 200
      : minimoPorMedida;


  // -------------------------------------------------------
  // ## 7.5 Cálculo de peso e unidades
  // -------------------------------------------------------

  // Para cálculo de peso, a aba entra pela metade:
  //
  // Exemplo:
  // 20 x 28 + 4
  //
  // altura de cálculo:
  // 28 + (4 / 2)
  // = 30 cm

  const alturaCalculo =
    alt +
    (
      aba / 2
    );


  const kgMilheiro =

    medidaPreenchida &&
    espN

      ? (
          larg *
          alturaCalculo *
          espN
        )

      : 0;


  const unidadesBaseExatas =

    kgMilheiro > 0

      ? (
          pedido /
          kgMilheiro
        ) * 1000

      : 0;


  const unidadesCom10Exatas =

    unidadesBaseExatas > 0

      ? unidadesBaseExatas * 1.10

      : 0;


  // Quantidade comercial final em unidade inteira:
  // sempre arredonda para cima.

  const unidades =

    unidadesCom10Exatas > 0

      ? Math.ceil(
          unidadesCom10Exatas
        )

      : 0;


  const acrescimo10Exato =

    unidadesBaseExatas > 0

      ? unidadesBaseExatas * 0.10

      : 0;


  const sugestoesLargura =

    !larguraCompativel

      ? sugestaoLargura(
          cat,
          larg
        )

      : [];


  // -------------------------------------------------------
  // ## 7.6 Campos de resultado principais
  // -------------------------------------------------------

  document
    .getElementById(
      'mEsp'
    )
    .value =

      esp
        ? esp + ' mm'
        : '';


  document
    .getElementById(
      'mAba'
    )
    .value =

      aba
        ? (
            '+' +
            numeroPt(aba) +
            ' cm'
          )

        : (
            catalogItem
              ? 'Sem aba'
              : '—'
          );


  document
    .getElementById(
      'mCil'
    )
    .value =

      cil
        ? numeroPt(cil) + ' cm'
        : '';


  document
    .getElementById(
      'mBob'
    )
    .value =

      bob
        ? numeroPt(bob) + ' cm'
        : '';


  document
    .getElementById(
      'mPedidoMin'
    )
    .textContent =

      medidaPreenchida
        ? pedido + ' kg'
        : '—';


  document
    .getElementById(
      'mUnidadesMin'
    )
    .textContent =

      unidades

        ? (
            new Intl.NumberFormat(
              'pt-BR'
            )
              .format(
                unidades
              )
            +
            ' un.'
          )

        : '—';


  document
    .getElementById(
      'mKgMilheiro'
    )
    .textContent =

      kgMilheiro

        ? (
            `Kg/milheiro: ` +
            `${N4.format(kgMilheiro)} kg`
          )

        : 'Kg/milheiro: —';


  document
    .getElementById(
      'mUnidadesBase'
    )
    .textContent =

      unidadesBaseExatas

        ? (
            `Unidade mínima base: ` +
            `${formatDecimal(unidadesBaseExatas, 10)} un.`
          )

        : 'Unidade mínima base: —';


  // -------------------------------------------------------
  // ## 7.7 Motivo resumido do pedido mínimo
  // -------------------------------------------------------

  let resumoPedido =
    'Informe a medida para calcular.';


  if (
    medidaPreenchida
  ) {

    if (
      dens === 'ad'
    ) {

      resumoPedido =
        '200 kg: Alta Densidade (AD).';

    }

    else if (
      !larguraCompativel
      &&
      !alturaComEspessuraPadrao
    ) {

      resumoPedido =
        '200 kg: largura/cilindro e altura/espessura fora do padrão.';

    }

    else if (
      !larguraCompativel
    ) {

      resumoPedido =
        '200 kg: largura não compatível com os cilindros.';

    }

    else if (
      !alturaComEspessuraPadrao
    ) {

      resumoPedido =
        '200 kg: altura sem espessura padrão cadastrada.';

    }

    else {

      resumoPedido =
        catalogo
          ? '100 kg: medida de catálogo.'
          : '100 kg: medida produzível padrão.';

    }

  }


  document
    .getElementById(
      'mPedidoMotivo'
    )
    .textContent =
      resumoPedido;


  // -------------------------------------------------------
  // ## 7.8 Resumo técnico da medida
  // -------------------------------------------------------

  document
    .getElementById(
      'rCategoria'
    )
    .textContent =
      nomeCategoria(cat);


  document
    .getElementById(
      'rSolicitada'
    )
    .textContent =

      larg && alt

        ? (
            `${numeroPt(larg)} x ` +
            `${numeroPt(alt)}` +
            `${aba ? ' + ' + numeroPt(aba) : ''}` +
            `${esp ? ' x ' + esp : ''}`
          )

        : '—';


  document
    .getElementById(
      'rEsp'
    )
    .textContent =

      esp
        ? esp + ' mm'
        : 'Não definida para esta altura';


  document
    .getElementById(
      'rEspStatus'
    )
    .textContent =

      !alt

        ? '—'

        : (
            esp

              ? (
                  `${numeroPt(alt)} cm ` +
                  `→ ${esp} mm`
                )

              : (
                  `Altura ${numeroPt(alt)} cm ` +
                  `sem espessura padrão cadastrada`
                )
          );


  document
    .getElementById(
      'rCil'
    )
    .textContent =

      cil
        ? numeroPt(cil) + ' cm'
        : 'Não encontrado';


  // -------------------------------------------------------
  // ## 7.9 Regra de encaixe no cilindro
  // -------------------------------------------------------

  if (!larg) {

    document
      .getElementById(
        'rBateu'
      )
      .textContent =
        '—';

  }

  else if (
    encaixe.tipo === 'direto'
  ) {

    document
      .getElementById(
        'rBateu'
      )
      .textContent =

        `Não — ${numeroPt(larg)} cm ` +
        `usa cilindro ${numeroPt(cil)} cm`;

  }

  else if (
    encaixe.tipo === '2x'
  ) {

    document
      .getElementById(
        'rBateu'
      )
      .textContent =

        `Sim — ${numeroPt(larg)} × 2 ` +
        `= ${numeroPt(cil)} cm`;

  }

  else if (
    encaixe.tipo === 'catalogo2x'
  ) {

    document
      .getElementById(
        'rBateu'
      )
      .textContent =

        `Catálogo — ${numeroPt(larg)} × 2 ` +
        `= ${numeroPt(cil)} cm`;

  }

  else {

    document
      .getElementById(
        'rBateu'
      )
      .textContent =

        `Fora do padrão — não há cilindro ` +
        `${numeroPt(larg)} ou ` +
        `${numeroPt(larg * 2)} cm`;

  }


  // -------------------------------------------------------
  // ## 7.10 Sugestão, bobina, aba e classificação
  // -------------------------------------------------------

  document
    .getElementById(
      'rSugestao'
    )
    .textContent =

      larguraCompativel

        ? 'Não necessária'

        : (
            sugestoesLargura.length

              ? (
                  `${sugestoesLargura
                    .map(numeroPt)
                    .join(' cm ou ')} cm`
                )

              : 'Nenhuma sugestão cadastrada'
          );


  document
    .getElementById(
      'rBob'
    )
    .textContent =

      bob

        ? (
            `${numeroPt(alt)} × 2 ` +
            `= ${numeroPt(bob)} cm`
          )

        : '—';


  document
    .getElementById(
      'rAba'
    )
    .textContent =

      aba

        ? `+${numeroPt(aba)} cm`

        : (
            catalogItem
              ? 'Sem aba'
              : '—'
          );


  document
    .getElementById(
      'rResultante'
    )
    .textContent =

      cil &&
      bob &&
      esp

        ? (
            `${numeroPt(cil)} x ` +
            `${numeroPt(bob)} x ` +
            `${esp}`
          )

        : '—';


  document
    .getElementById(
      'rCatalogo'
    )
    .textContent =

      medidaPreenchida &&
      esp

        ? (
            catalogo
              ? 'Sim'
              : 'Não'
          )

        : '—';


  document
    .getElementById(
      'rKgMilheiro'
    )
    .textContent =

      kgMilheiro

        ? (
            `${N4.format(kgMilheiro)} ` +
            `kg/milheiro`
          )

        : '—';


  document
    .getElementById(
      'rCalcUnidades'
    )
    .textContent =

      unidades

        ? (
            `Base exata: ` +
            `(${pedido} ÷ ${N4.format(kgMilheiro)}) ` +
            `× 1.000 = ` +
            `${formatDecimal(unidadesBaseExatas, 10)} un. ` +
            `| +10% exato = ` +
            `${formatDecimal(unidadesCom10Exatas, 10)} un. ` +
            `| Para oferecer: ` +
            `${new Intl.NumberFormat('pt-BR').format(unidades)} un.`
          )

        : '—';


  // -------------------------------------------------------
  // ## 7.11 Memória detalhada da conta de unidades
  // -------------------------------------------------------

  const contaEl =
    document.getElementById(
      'mContaUnidades'
    );


  const detalheAlturaAba =

    aba

      ? (
          `${numeroPt(alt)} + ` +
          `(${numeroPt(aba)} ÷ 2) ` +
          `= ${numeroPt(alturaCalculo)} cm`
        )

      : `${numeroPt(alt)} cm`;


  const formulaKg =

    aba

      ? (
          `${numeroPt(larg)} × ` +
          `(${numeroPt(alt)} + ${numeroPt(aba)} ÷ 2) ` +
          `× ${esp}`
        )

      : (
          `${numeroPt(larg)} × ` +
          `${numeroPt(alt)} × ` +
          `${esp}`
        );


  contaEl.innerHTML =

    unidades

      ? (
          `<b>Conta das unidades:</b><br>` +

          `${aba
            ? `Altura de cálculo: ${detalheAlturaAba}<br>`
            : ''
          }` +

          `Kg/milheiro: ${formulaKg} = ` +
          `<b>${N4.format(kgMilheiro)} kg/milheiro</b><br>` +

          `Unidade mínima base: ` +
          `(${pedido} ÷ ${N4.format(kgMilheiro)}) × 1.000 = ` +
          `<b>${formatDecimal(unidadesBaseExatas, 10)} un.</b><br>` +

          `10% adicional: ` +
          `${formatDecimal(unidadesBaseExatas, 10)} × 10% = ` +
          `<b>${formatDecimal(acrescimo10Exato, 10)} un.</b><br>` +

          `Base + 10%: ` +
          `<b>${formatDecimal(unidadesCom10Exatas, 10)} un.</b><br>` +

          `<span class="calc-final">` +
          `Quantidade mínima para oferecer (arredondada): ` +
          `${new Intl.NumberFormat('pt-BR').format(unidades)} un.` +
          `</span>`
        )

      : (
          '<b>Conta das unidades:</b> ' +
          'informe uma medida para calcular.'
        );


  // -------------------------------------------------------
  // ## 7.12 Classificação visual
  // -------------------------------------------------------

  [
    'statusCatalogo',
    'statusPadrao',
    'statusNaoPadrao'
  ]
    .forEach(
      id => {

        document
          .getElementById(id)
          .classList
          .remove(
            'active'
          );

      }
    );


  if (
    medidaPreenchida
  ) {

    if (
      catalogo
    ) {

      document
        .getElementById(
          'statusCatalogo'
        )
        .classList
        .add(
          'active'
        );

    }

    else if (
      padraoProducao
    ) {

      document
        .getElementById(
          'statusPadrao'
        )
        .classList
        .add(
          'active'
        );

    }

    else {

      document
        .getElementById(
          'statusNaoPadrao'
        )
        .classList
        .add(
          'active'
        );

    }

  }


  // -------------------------------------------------------
  // ## 7.13 Explicação do pedido mínimo de 200 kg
  // -------------------------------------------------------

  const motivos200 =
    [];


  if (
    medidaPreenchida
  ) {

    if (
      dens === 'ad'
    ) {

      motivos200.push(
        'Alta Densidade (AD): mínimo obrigatório de 200 kg'
      );

    }


    if (
      !larguraCompativel
    ) {

      motivos200.push(
        `largura ${numeroPt(larg)} cm ` +
        `não corresponde a nenhum cilindro disponível ` +
        `de forma direta ou batendo 2x`
      );

    }


    if (
      !alturaComEspessuraPadrao
    ) {

      motivos200.push(
        `altura ${numeroPt(alt)} cm ` +
        `não possui espessura padrão cadastrada para ` +
        `${nomeCategoria(cat)}`
      );

    }

  }


  const motivoBox =
    document.getElementById(
      'mMotivos200'
    );


  if (
    medidaPreenchida
    &&
    pedido === 200
  ) {

    motivoBox.style.display =
      'block';


    motivoBox.classList.remove(
      'good'
    );


    motivoBox.innerHTML =

      '<b>⚠ Por que o pedido mínimo é 200 kg?</b><br>'

      +

      motivos200
        .map(
          motivo =>
            '• ' + motivo
        )
        .join(
          '<br>'
        );

  }

  else if (
    medidaPreenchida
    &&
    pedido === 100
  ) {

    motivoBox.style.display =
      'block';


    motivoBox.classList.add(
      'good'
    );


    motivoBox.innerHTML =

      '<b>✅ Pedido mínimo de 100 kg</b><br>' +

      'A medida respeita as regras de largura/cilindro ' +
      'e altura/espessura para produção padrão.';

  }

  else {

    motivoBox.style.display =
      'none';

  }


  // -------------------------------------------------------
  // ## 7.14 Sugestão comercial de largura
  // -------------------------------------------------------

  const sugestaoBox =
    document.getElementById(
      'mSugestaoComercial'
    );


  if (
    medidaPreenchida
    &&
    !larguraCompativel
    &&
    sugestoesLargura.length
  ) {

    const sugestoes =
      sugestoesLargura.map(
        valor => {

          const encaixeSugestao =
            encontrarCilindro(
              cat,
              valor,
              alt
            );


          const cilindroSugestao =
            encaixeSugestao.cil;


          const minimoSugestao =

            dens === 'ad'

              ? 200

              : (
                  alturaComEspessuraPadrao
                  &&
                  cilindroSugestao

                    ? 100

                    : 200
                );


          const kgSugestao =

            espN > 0

              ? (
                  valor *
                  alt *
                  espN
                )

              : 0;


          const baseSugestao =

            kgSugestao > 0

              ? Math.ceil(
                  (
                    minimoSugestao /
                    kgSugestao
                  ) * 1000
                )

              : 0;


          const unidadesSugestao =

            baseSugestao

              ? Math.ceil(
                  baseSugestao *
                  1.10
                )

              : 0;


          return (
            `<b>` +
            `${numeroPt(valor)} × ` +
            `${numeroPt(alt)}` +
            `${esp ? ' × ' + esp : ''}` +
            `</b>` +

            `${
              cilindroSugestao
                ? (
                    ` — cilindro ` +
                    `${numeroPt(cilindroSugestao)} cm`
                  )
                : ''
            }` +

            ` — mínimo ${minimoSugestao} kg` +

            `${
              unidadesSugestao
                ? (
                    ` — oferecer aprox. ` +
                    `${new Intl.NumberFormat('pt-BR').format(unidadesSugestao)} ` +
                    `un. (+10%)`
                  )
                : ''
            }`
          );

        }
      );


    sugestaoBox.style.display =
      'block';


    sugestaoBox.innerHTML =

      '<b>💡 Sugestão comercial</b><br>' +

      'A largura solicitada não encaixa nos cilindros disponíveis. ' +

      'Você pode oferecer a medida produzível mais próxima:<br>'

      +

      sugestoes
        .map(
          sugestao =>
            '• ' + sugestao
        )
        .join(
          '<br>'
        );

  }

  else {

    sugestaoBox.style.display =
      'none';

  }


  // -------------------------------------------------------
  // ## 7.15 Status final e observação comercial
  // -------------------------------------------------------

  if (
    !medidaPreenchida
  ) {

    document
      .getElementById(
        'rStatus'
      )
      .textContent =
        'Informe largura e altura';


    document
      .getElementById(
        'mObservacao'
      )
      .innerHTML =

        'Informe largura e altura para consultar. ' +
        'A espessura será definida automaticamente pela altura.';


    return;
  }


  if (
    padraoProducao
  ) {

    document
      .getElementById(
        'rStatus'
      )
      .textContent =

        catalogo
          ? 'Medida de catálogo — padrão'
          : 'Medida padrão de produção';


    const densidadeTexto =

      dens === 'ad'

        ? (
            '<br>' +
            '<span class="measure-bad">' +
            '⚠ Como foi selecionado AD, ' +
            'o pedido mínimo sobe para 200 kg.' +
            '</span>'
          )

        : '';


    document
      .getElementById(
        'mObservacao'
      )
      .innerHTML =

        catalogo

          ? (
              `✅ <b>Medida de catálogo.</b> ` +
              `Largura/cilindro e altura/espessura ` +
              `estão dentro do padrão.` +
              `${densidadeTexto}`
            )

          : (
              `✅ <b>Medida padrão de produção.</b> ` +
              `Mesmo fora do catálogo, a largura encaixa ` +
              `em medida produzível e a altura possui ` +
              `espessura padrão cadastrada.` +
              `${densidadeTexto}`
            );

  }

  else {

    const motivos =
      [];


    if (
      !larguraCompativel
    ) {

      motivos.push(

        `largura ${numeroPt(larg)} cm ` +
        `não encaixa nos cilindros disponíveis`

        +

        `${
          sugestoesLargura.length

            ? (
                `; medida próxima: ` +
                `${sugestoesLargura
                  .map(
                    valor =>
                      numeroPt(valor) +
                      ' cm'
                  )
                  .join(
                    ' ou '
                  )
                }`
              )

            : ''
        }`

      );

    }


    if (
      !alturaComEspessuraPadrao
    ) {

      motivos.push(
        `altura ${numeroPt(alt)} cm ` +
        `não possui espessura padrão cadastrada ` +
        `para este modelo`
      );

    }


    document
      .getElementById(
        'rStatus'
      )
      .textContent =
        'Medida não padrão';


    document
      .getElementById(
        'mObservacao'
      )
      .innerHTML =

        '⚠️ <b>Medida não padrão.</b> ' +
        'Pedido mínimo: <b>200 kg</b>.<br>' +
        'Motivo: ' +
        motivos.join(
          ' e '
        ) +
        '.';

  }
}