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
const SELLERS_KEY = 'agenflex_vendedores_recentes';
let usuarioLocalAtual = null;
let perfilCentralAtual = null;

function chaveLocalUsuario(base) {
  return usuarioLocalAtual ? `${base}:${usuarioLocalAtual}` : null;
}

function limparDadosLocaisUsuario() {
  [KEY, SELLERS_KEY].forEach(base => {
    try {
      const chave = chaveLocalUsuario(base);
      if (chave) localStorage.removeItem(chave);
      // Dados antigos não possuem dono conhecido; nunca migrar para outro usuário.
      localStorage.removeItem(base);
    } catch (erro) {
      console.warn('Não foi possível limpar os dados locais da Central.', erro);
    }
  });
}


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


function showPage(
  id,
  btn,
  opcoes = {}
) {

  // -------------------------------------------------------
  // Proteção da área comercial de Orçamento
  // -------------------------------------------------------

  if (
    id === 'orcamentoPage'
  ) {

    const tipo =
      typeof perfilCentralAtual !==
        'undefined'
        ? String(
          perfilCentralAtual
            ?.tipo_acesso || ''
        )
          .trim()
          .toLowerCase()
        : '';


    const aberturaConsulta =
      opcoes?.consulta === true;


    if (
      !aberturaConsulta &&
      ![
        'vendedor',
        'gestor'
      ].includes(
        tipo
      )
    ) {

      if (
        typeof toastMsg ===
        'function'
      ) {

        toastMsg(
          'Orçamento disponível somente para Vendedor e Gestor.'
        );

      }


      id =
        'homePage';

      btn =
        null;

    }

  }


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

// =========================================================
// ## CONFIRMAÇÃO PERSONALIZADA
// =========================================================

function confirmarAcao({
  titulo = 'Confirmar ação',
  mensagem = '',
  detalhe = '',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar'
} = {}) {

  return new Promise(
    resolve => {

      const anterior =
        document.getElementById(
          'agenflexConfirmModal'
        );

      if (anterior) {
        anterior.remove();
      }


      const modal =
        document.createElement(
          'div'
        );


      modal.id =
        'agenflexConfirmModal';

      modal.className =
        'painel-transferencia-modal';

      modal.innerHTML = `

        <div
          class="painel-transferencia-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenflexConfirmTitulo"
        >

          <div class="painel-transferencia-head">

            <div>

              <span class="painel-transferencia-kicker">
                CENTRAL COMERCIAL AGENFLEX
              </span>

              <h3 id="agenflexConfirmTitulo">
              </h3>

              <p id="agenflexConfirmMensagem">
              </p>

            </div>

            <button
              type="button"
              class="painel-transferencia-fechar"
              id="agenflexConfirmFechar"
              aria-label="Fechar"
            >
              ×
            </button>

          </div>


          <div class="painel-transferencia-body">

            <div
              id="agenflexConfirmDetalhe"
              class="painel-transferencia-atual"
              hidden
            >
            </div>

          </div>


          <div class="painel-transferencia-footer">

            <button
              type="button"
              class="btn light"
              id="agenflexConfirmCancelar"
            >
              Cancelar
            </button>

            <button
              type="button"
              class="btn navy"
              id="agenflexConfirmOk"
            >
              Confirmar
            </button>

          </div>

        </div>

      `;


      const tituloEl =
        modal.querySelector(
          '#agenflexConfirmTitulo'
        );

      const mensagemEl =
        modal.querySelector(
          '#agenflexConfirmMensagem'
        );

      const detalheEl =
        modal.querySelector(
          '#agenflexConfirmDetalhe'
        );

      const cancelarEl =
        modal.querySelector(
          '#agenflexConfirmCancelar'
        );

      const confirmarEl =
        modal.querySelector(
          '#agenflexConfirmOk'
        );

      const fecharEl =
        modal.querySelector(
          '#agenflexConfirmFechar'
        );


      tituloEl.textContent =
        titulo;

      mensagemEl.textContent =
        mensagem;

      cancelarEl.textContent =
        textoCancelar;

      confirmarEl.textContent =
        textoConfirmar;


      if (detalhe) {

        detalheEl.hidden =
          false;

        detalheEl.textContent =
          detalhe;

      }


      let encerrado =
        false;


      const finalizar =
        resultado => {

          if (encerrado) {
            return;
          }

          encerrado =
            true;

          document.removeEventListener(
            'keydown',
            aoPressionarTecla
          );

          modal.remove();


          // Se existir outro modal aberto por baixo,
          // mantém o bloqueio da página.
          const existeOutroModalAberto =
            Array.from(
              document.querySelectorAll(
                '.painel-transferencia-modal'
              )
            ).some(
              elemento =>
                !elemento.hidden
            );


          if (
            !existeOutroModalAberto
          ) {

            document.body.classList.remove(
              'painel-modal-aberto'
            );

          }


          resolve(
            resultado
          );
          
        };


      const aoPressionarTecla =
        evento => {

          if (
            evento.key ===
            'Escape'
          ) {

            finalizar(
              false
            );

          }

        };


      cancelarEl.addEventListener(
        'click',
        () => finalizar(false)
      );


      fecharEl.addEventListener(
        'click',
        () => finalizar(false)
      );


      confirmarEl.addEventListener(
        'click',
        () => finalizar(true)
      );


      modal.addEventListener(
        'click',
        evento => {

          if (
            evento.target ===
            modal
          ) {

            finalizar(
              false
            );

          }

        }
      );


      document.addEventListener(
        'keydown',
        aoPressionarTecla
      );


      document.body.appendChild(
        modal
      );

      document.body.classList.add(
        'painel-modal-aberto'
      );


      setTimeout(
        () => {
          confirmarEl.focus();
        },
        30
      );

    }
  );
}