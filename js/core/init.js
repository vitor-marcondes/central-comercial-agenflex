// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: init.js
//
// Responsabilidade:
// - Inicializar os eventos principais da interface
// - Conectar campos do formulário às funções de atualização
// - Executar os primeiros carregamentos dos módulos
//
// Dependências:
// - core.js
// - proposta.js
// - cliche.js
// - medidas.js
//
// IMPORTANTE:
// Este arquivo deve ser carregado por último no index.html,
// pois depende de funções e elementos já existentes.
// =========================================================


// =========================================================
// ## 1. EVENTOS DO ORÇAMENTO / PROPOSTA
// =========================================================

// Sempre que algum campo da proposta for alterado,
// atualiza a prévia e os dados calculados.
//
// O campo de upload de arte é excluído porque possui
// tratamento próprio no módulo de propostas.

document
  .querySelectorAll(
    '#orcamentoPage input:not(#arteInput), ' +
    '#orcamentoPage select, ' +
    '#orcamentoPage textarea'
  )
  .forEach(campo => {

    campo.addEventListener(
      'input',
      refresh
    );

    campo.addEventListener(
      'change',
      refresh
    );

  });


// =========================================================
// ## 2. EVENTOS DA CALCULADORA DE CLICHÊ
// =========================================================

// Recalcula o clichê automaticamente quando qualquer
// campo da calculadora for alterado.

document
  .querySelectorAll(
    '#clichePage input, ' +
    '#clichePage select'
  )
  .forEach(campo => {

    campo.addEventListener(
      'input',
      calcCliche
    );

    campo.addEventListener(
      'change',
      calcCliche
    );

  });


// =========================================================
// ## 3. EVENTOS DO MÓDULO DE MEDIDAS
// =========================================================

// Recalcula as informações de medidas sempre que algum
// campo do módulo for alterado.

document
  .querySelectorAll(
    '#medidasPage input, ' +
    '#medidasPage select'
  )
  .forEach(campo => {

    campo.addEventListener(
      'input',
      calcMedidas
    );

    campo.addEventListener(
      'change',
      calcMedidas
    );

  });


// =========================================================
// ## 4. EVENTO ESPECÍFICO DA CATEGORIA DE MEDIDAS
// =========================================================

// A troca da categoria exige mais ações além do cálculo:
// - ajusta a densidade sugerida;
// - atualiza o catálogo;
// - atualiza as espessuras disponíveis;
// - recalcula a medida.

document
  .getElementById('mCategoria')
  .addEventListener(
    'change',
    () => {

      ajustarDensidadeCategoria();

      renderCatalogo();

      renderEspessuras();

      calcMedidas();

    }
  );


// =========================================================
// ## 5. INICIALIZAÇÃO DOS MÓDULOS
// =========================================================

// Executa os carregamentos iniciais necessários assim que
// todos os scripts e elementos da página já estão disponíveis.

renderSellers();

loadDraft();

renderItems();

calcCliche();

updateTeamLogo();

renderCatalogo();

renderEspessuras();

calcMedidas();