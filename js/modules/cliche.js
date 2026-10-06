// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: cliche.js
//
// Responsabilidade:
// - Calcular o valor do clichê
// - Aplicar margens de cilindro e bobina
// - Aplicar desconto comercial
// - Atualizar os detalhes do cálculo na interface
// - Copiar o valor calculado
// - Enviar o valor para a proposta
//
// Dependências:
// - js/core/core.js
// - Elementos da calculadora de clichê no index.html
//
// Fórmula atual:
//
// (Cilindro + 10)
// ×
// (Bobina + 10)
// ×
// Quantidade de cores
// ×
// Valor por cm²
//
// Depois:
// valor previsto - desconto = valor final
// =========================================================


// =========================================================
// ## 1. CÁLCULO DO CLICHÊ
// =========================================================

function calcCliche() {

  // -------------------------------------------------------
  // ## 1.1 Leitura dos valores informados
  // -------------------------------------------------------

  const cilindro =
    +cCil.value || 0;


  const bobina =
    +cBob.value || 0;


  const cores =
    +cCores.value || 0;


  const valorBase =
    +cValor.value || 0;


  const desconto =
    +cDesconto.value || 0;


  // -------------------------------------------------------
  // ## 1.2 Aplicação das margens
  // -------------------------------------------------------

  const cilindroComMargem =
    cilindro + 10;


  const bobinaComMargem =
    bobina + 10;


  // -------------------------------------------------------
  // ## 1.3 Cálculo da área
  // -------------------------------------------------------

  const area =
    cilindroComMargem *
    bobinaComMargem *
    cores;


  // -------------------------------------------------------
  // ## 1.4 Valor previsto antes do desconto
  // -------------------------------------------------------

  const valorPrevisto =
    area *
    valorBase;


  // -------------------------------------------------------
  // ## 1.5 Desconto e economia
  // -------------------------------------------------------

  const economia =
    valorPrevisto *
    (
      desconto / 100
    );


  const total =
    valorPrevisto -
    economia;


  // =======================================================
  // ## 2. ATUALIZAÇÃO DA INTERFACE
  // =======================================================

  cTotal.textContent =
    BRL.format(
      total
    );


  dCil.textContent =
    N2.format(
      cilindro
    ) +
    ' cm';


  dCilM.textContent =
    N2.format(
      cilindroComMargem
    ) +
    ' cm';


  dBob.textContent =
    N2.format(
      bobina
    ) +
    ' cm';


  dBobM.textContent =
    N2.format(
      bobinaComMargem
    ) +
    ' cm';


  dArea.textContent =
    N2.format(
      area
    ) +
    ' cm²';


  dBase.textContent =
    BRL.format(
      valorBase
    ) +
    '/cm²';


  dPrevisto.textContent =
    BRL.format(
      valorPrevisto
    );


  dDesc.textContent =
    desconto +
    '%';


  dEconomia.textContent =
    BRL.format(
      economia
    );


  return total;
}


// =========================================================
// ## 3. COPIAR VALOR DO CLICHÊ
// =========================================================

async function copyCliche() {

  try {

    await navigator.clipboard.writeText(
      BRL.format(
        calcCliche()
      )
    );


    toastMsg(
      'Valor copiado'
    );

  } catch (e) {

    // Mantido sem mensagem de erro para preservar
    // o comportamento atual da Central.

  }
}


// =========================================================
// ## 4. ENVIAR VALOR PARA A PROPOSTA
// =========================================================

function useCliche() {

  if (
    !revisaoEhEditavel() ||
    window.__agenflexConsultaHistorica?.ativa
  ) {

    toastMsg(
      'Esta revisão é somente leitura. Crie ou abra um rascunho para alterar o clichê.'
    );

    return;
  }


  // -------------------------------------------------------
  // Calcula o valor comercial do clichê
  // -------------------------------------------------------

  const valorCliche =
    calcCliche();


  // -------------------------------------------------------
  // Mantém o campo antigo preenchido por compatibilidade
  // com o fluxo atual da proposta.
  // -------------------------------------------------------

  cliche.value =
    BRL.format(
      valorCliche
    );


  // -------------------------------------------------------
  // Estrutura oficial do item CLICHE
  // -------------------------------------------------------

  const itemCliche = {

    codigo:
      'CLICHE',

    produto:
      'CLICHÊ',

    detalhes:
      '',

    ncm:
      '',

    quant:
      1,

    unidade:
      'UN',

    unit:
      valorCliche,

    desc:
      0,

    ipi:
      0

  };


  // -------------------------------------------------------
  // Procura um CLICHE já existente na proposta
  // -------------------------------------------------------

  const indiceCliche =
    items.findIndex(
      it =>
        String(
          it.codigo || ''
        )
          .trim()
          .toUpperCase() ===
        'CLICHE'
    );


  // -------------------------------------------------------
  // Se já existe, atualiza.
  // Se não existe, adiciona.
  // -------------------------------------------------------

  if (
    indiceCliche >= 0
  ) {

    items[indiceCliche] =
      itemCliche;

  } else {

    items.push(
      itemCliche
    );

  }


  // -------------------------------------------------------
  // Atualiza tabela, cálculos e prévia
  // -------------------------------------------------------

  renderItems();


  // -------------------------------------------------------
  // Retorna ao orçamento
  // -------------------------------------------------------

  go(
    'orcamentoPage'
  );


  toastMsg(
    indiceCliche >= 0
      ? 'Clichê atualizado na proposta'
      : 'Clichê adicionado à proposta'
  );

}