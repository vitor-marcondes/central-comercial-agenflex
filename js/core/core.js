// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: core.js
//
// Responsabilidade:
// - Centralizar configurações e utilidades compartilhadas
// - Controlar navegação entre páginas
// - Fornecer formatação de moeda, números e datas
// - Disponibilizar funções globais usadas por outros módulos
//
// Dependências:
// - Elementos HTML com IDs usados diretamente no arquivo
// - css/styles.css para classes visuais como "active" e "show"
//
// Observação:
// Este arquivo deve concentrar apenas funções genéricas que
// possam ser reutilizadas por diferentes módulos da Central.
// =========================================================


// =========================================================
// ## 1. CONFIGURAÇÕES GLOBAIS
// =========================================================

const teamLogos = {
  revenda: 'assets/logos/agenflex.jpg',
  pharma: 'assets/logos/pharma.png',
  food: 'assets/logos/food.png'
};


// Chave utilizada pelo armazenamento local do orçamento.
const KEY = 'agenflex_v61_orc';


// =========================================================
// ## 2. FORMATADORES
// =========================================================

// Moeda brasileira.
const BRL = new Intl.NumberFormat(
  'pt-BR',
  {
    style: 'currency',
    currency: 'BRL'
  }
);


// Número com 2 casas decimais.
const N2 = new Intl.NumberFormat(
  'pt-BR',
  {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }
);


// Número com 4 casas decimais.
const N4 = new Intl.NumberFormat(
  'pt-BR',
  {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }
);


// =========================================================
// ## 3. FUNÇÕES DE DATA
// =========================================================

function isoToday() {

  const data = new Date();
  const offset = data.getTimezoneOffset();

  return new Date(
    data.getTime() - offset * 60000
  )
    .toISOString()
    .slice(0, 10);
}


function brDate(iso) {

  if (!iso) {
    return '';
  }

  const [ano, mes, dia] =
    iso.split('-');

  return `${dia}/${mes}/${ano}`;
}


// Define a data atual no campo da proposta ao carregar o sistema.
orcData.value = isoToday();


// =========================================================
// ## 4. SEGURANÇA / ESCAPE DE TEXTO
// =========================================================

// Converte caracteres especiais para entidades HTML.
// Usado antes de inserir textos dinâmicos no HTML.
function esc(valor) {

  return String(valor ?? '')
    .replace(
      /[&<>"']/g,
      caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[caractere])
    );
}


// =========================================================
// ## 5. NAVEGAÇÃO ENTRE PÁGINAS
// =========================================================

function showPage(id, btn) {

  document
    .querySelectorAll('.page')
    .forEach(
      pagina => pagina.classList.remove('active')
    );


  document
    .getElementById(id)
    .classList.add('active');


  document
    .querySelectorAll('.nav-btn')
    .forEach(
      botao => botao.classList.remove('active')
    );


  if (btn) {

    btn.classList.add('active');

  } else {

    const botaoMenu =
      document.querySelector(
        `[data-page="${id}"]`
      );

    if (botaoMenu) {
      botaoMenu.classList.add('active');
    }

  }


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


function go(id) {

  showPage(
    id,
    null
  );
}


// =========================================================
// ## 6. MENSAGENS GLOBAIS / TOAST
// =========================================================

function toastMsg(msg) {

  toast.textContent = msg;

  toast.classList.add('show');


  setTimeout(
    () => toast.classList.remove('show'),
    1800
  );
}