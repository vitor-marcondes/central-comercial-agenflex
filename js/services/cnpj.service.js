// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: cnpj.service.js
//
// Responsabilidade:
// - Consultar dados de empresas pelo CNPJ
// - Validar e formatar o CNPJ informado
// - Traduzir a resposta da CNPJá para o padrão da Agenflex
// - Tratar erros HTTP da API externa
//
// API atual:
// - CNPJá Open
//
// Endpoint atual:
// - https://open.cnpja.com/office/:cnpj
//
// Utilizado por:
// - js/modules/proposta.js
//
// Observação:
// A proposta não deve depender diretamente do formato
// retornado pela CNPJá.
//
// Este service funciona como uma camada de tradução entre:
//
// CNPJá
// ↓
// padrão interno Agenflex
// ↓
// formulário da proposta
//
// Futuramente, caso a API seja trocada ou passe pelo n8n,
// este arquivo será um dos principais pontos de adaptação.
// =========================================================


// =========================================================
// ## 1. CONFIGURAÇÃO DA API
// =========================================================

const CNPJA_OPEN_URL =
  'https://open.cnpja.com/office';


// =========================================================
// ## 2. TRATAMENTO E FORMATAÇÃO DO CNPJ
// =========================================================

// Remove qualquer caractere que não seja número.
//
// Exemplo:
//
// 07.348.604/0001-72
// ↓
// 07348604000172

function limparCnpj(valor) {

  return String(valor || '')
    .replace(
      /\D/g,
      ''
    );
}


// Formata um CNPJ com 14 dígitos para:
//
// 00.000.000/0000-00
//
// Caso não tenha exatamente 14 dígitos,
// devolve o valor recebido sem alteração.

function formatarCnpj(valor) {

  const cnpj =
    limparCnpj(valor);


  if (cnpj.length !== 14) {

    return valor;

  }


  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}


// =========================================================
// ## 3. NORMALIZAÇÃO DOS DADOS DA EMPRESA
// =========================================================

// Converte a resposta específica da CNPJá para o
// formato padrão utilizado internamente pela Agenflex.
//
// Essa função é importante porque evita espalhar nomes
// específicos da API externa pelo restante do sistema.
//
// Exemplo:
//
// CNPJá:
// data.company.name
//
// Agenflex:
// empresa.razaoSocial
//
// Se a API for trocada futuramente, o formulário poderá
// continuar utilizando o mesmo padrão interno.

function normalizarEmpresaCnpja(data) {

  const telefone =
    data?.phones?.[0];


  return {

    cnpj:
      formatarCnpj(
        data?.taxId || ''
      ),


    razaoSocial:
      data?.company?.name || '',


    nomeFantasia:
      data?.alias || '',


    situacao:
      data?.status?.text || '',


    telefone:
      telefone
        ? `(${telefone.area}) ${telefone.number}`
        : '',


    email:
      data?.emails?.[0]?.address || '',


    logradouro:
      data?.address?.street || '',


    numero:
      data?.address?.number || '',


    complemento:
      data?.address?.details || '',


    bairro:
      data?.address?.district || '',


    cidade:
      data?.address?.city || '',


    uf:
      data?.address?.state || '',


    cep:
      data?.address?.zip || ''

  };
}


// =========================================================
// ## 4. CONSULTA DA API CNPJá
// =========================================================

// Consulta os dados da empresa utilizando o CNPJ.
//
// Fluxo:
//
// CNPJ informado
// ↓
// limparCnpj()
// ↓
// validação
// ↓
// fetch()
// ↓
// CNPJá
// ↓
// JSON
// ↓
// normalizarEmpresaCnpja()
// ↓
// objeto no padrão Agenflex

async function consultarCnpj(
  cnpjInformado
) {

  const cnpj =
    limparCnpj(
      cnpjInformado
    );


  // -------------------------------------------------------
  // ## 4.1 Validação do CNPJ informado
  // -------------------------------------------------------

  if (cnpj.length !== 14) {

    throw new Error(
      'Informe um CNPJ com 14 dígitos.'
    );

  }


  // -------------------------------------------------------
  // ## 4.2 Montagem do endpoint
  // -------------------------------------------------------

  const url =
    `${CNPJA_OPEN_URL}/${cnpj}`;


  // -------------------------------------------------------
  // ## 4.3 Requisição HTTP
  // -------------------------------------------------------

  const resposta =
    await fetch(
      url,
      {
        method: 'GET',

        headers: {
          Accept: 'application/json'
        }
      }
    );


  // -------------------------------------------------------
  // ## 4.4 Tratamento de limite da API
  // -------------------------------------------------------

  if (resposta.status === 429) {

    throw new Error(
      'Limite de consultas da API atingido. ' +
      'Aguarde um momento e tente novamente.'
    );

  }


  // -------------------------------------------------------
  // ## 4.5 CNPJ não encontrado
  // -------------------------------------------------------

  if (resposta.status === 404) {

    throw new Error(
      'CNPJ não encontrado.'
    );

  }


  // -------------------------------------------------------
  // ## 4.6 Outros erros HTTP
  // -------------------------------------------------------

  if (!resposta.ok) {

    throw new Error(
      `Erro ao consultar CNPJ. ` +
      `Código HTTP: ${resposta.status}`
    );

  }


  // -------------------------------------------------------
  // ## 4.7 Conversão da resposta para JSON
  // -------------------------------------------------------

  const data =
    await resposta.json();


  // -------------------------------------------------------
  // ## 4.8 Normalização para o padrão Agenflex
  // -------------------------------------------------------

  return normalizarEmpresaCnpja(
    data
  );
}