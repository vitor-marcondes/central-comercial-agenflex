// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Serviço externo: consulta de CNPJ
// API: CNPJá Open
// =========================================================

const CNPJA_OPEN_URL = 'https://open.cnpja.com/office';


// Remove pontos, barras, traços etc.
function limparCnpj(valor) {
  return String(valor || '').replace(/\D/g, '');
}


// Formata novamente para 00.000.000/0001-00
function formatarCnpj(valor) {

  const cnpj = limparCnpj(valor);

  if (cnpj.length !== 14) {
    return valor;
  }

  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}


// Converte a resposta da CNPJá para o formato da Agenflex.
// Isso é MUITO importante.
//
// Se amanhã trocarmos a CNPJá por outra API,
// a tela da proposta não precisa saber.
function normalizarEmpresaCnpja(data) {

  const telefone = data?.phones?.[0];

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


// Consulta a API
async function consultarCnpj(cnpjInformado) {

  const cnpj = limparCnpj(cnpjInformado);

  if (cnpj.length !== 14) {
    throw new Error(
      'Informe um CNPJ com 14 dígitos.'
    );
  }

  const url =
    `${CNPJA_OPEN_URL}/${cnpj}`;

  const resposta = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });


  // Limite da API
  if (resposta.status === 429) {

    throw new Error(
      'Limite de consultas da API atingido. Aguarde um momento e tente novamente.'
    );
  }


  // CNPJ não encontrado
  if (resposta.status === 404) {

    throw new Error(
      'CNPJ não encontrado.'
    );
  }


  // Qualquer outro erro HTTP
  if (!resposta.ok) {

    throw new Error(
      `Erro ao consultar CNPJ. Código HTTP: ${resposta.status}`
    );
  }


  const data =
    await resposta.json();


  return normalizarEmpresaCnpja(data);
}