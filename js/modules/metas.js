// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: metas.js
//
// Responsabilidade:
// - Exibir metas mensais dos vendedores
// - Permitir Gestor / ADM cadastrar e alterar metas
// - Calcular resumo das metas da equipe
//
// Dependências:
// - js/services/usuarios.service.js
// - js/modules/equipe.js
// =========================================================


// =========================================================
// ## 1. ESTADO
// =========================================================

let metasPerfilAtual =
  null;

let metasVendedores =
  [];

let metasPeriodo =
  [];

let metasCarregando =
  false;


// =========================================================
// ## 2. AUXILIARES
// =========================================================

function escaparMeta(
  valor
) {

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


function formatarMoedaMeta(
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
    Number(valor) || 0
  );
}


function podeGerenciarMetas() {

  return [
    'gestor',
    'adm'
  ].includes(
    metasPerfilAtual
      ?.tipo_acesso
  );
}


// =========================================================
// ## 3. MÊS
// =========================================================

function nomeMesMeta(
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
  ] || '—';
}


// =========================================================
// ## 4. PERÍODO ATUAL
// =========================================================

function periodoAtualMeta() {

  const hoje =
    new Date();


  return {

    ano:
      hoje.getFullYear(),

    mes:
      hoje.getMonth() + 1

  };
}


// =========================================================
// ## 5. MONTAR INTERFACE
// =========================================================

function montarInterfaceMetas() {

  if (
    document.getElementById(
      'gestaoMetasEquipe'
    )
  ) {

    return;

  }


  const painelEquipe =
    document.getElementById(
      'gestaoEquipePanel'
    );


  if (!painelEquipe) {

    return;

  }


  const panelBody =
    painelEquipe.querySelector(
      '.panel-body'
    );


  if (!panelBody) {

    return;

  }


  const periodo =
    periodoAtualMeta();


  const area =
    document.createElement(
      'div'
    );


  area.id =
    'gestaoMetasEquipe';


  area.className =
    'metas-equipe';


  area.hidden =
    true;


  area.innerHTML = `

    <div class="metas-equipe-head">

      <div>

        <h3>
          🎯 Metas da Equipe
        </h3>

        <p>
          Defina a meta mensal de cada vendedor.
        </p>

      </div>

    </div>


    <!-- ================================================
         PERÍODO
         ================================================ -->

    <div class="metas-periodo">


      <div class="field">

        <label>
          Mês
        </label>

        <select id="metasMes">

          <option value="1">
            Janeiro
          </option>

          <option value="2">
            Fevereiro
          </option>

          <option value="3">
            Março
          </option>

          <option value="4">
            Abril
          </option>

          <option value="5">
            Maio
          </option>

          <option value="6">
            Junho
          </option>

          <option value="7">
            Julho
          </option>

          <option value="8">
            Agosto
          </option>

          <option value="9">
            Setembro
          </option>

          <option value="10">
            Outubro
          </option>

          <option value="11">
            Novembro
          </option>

          <option value="12">
            Dezembro
          </option>

        </select>

      </div>


      <div class="field">

        <label>
          Ano
        </label>

        <select id="metasAno">
        </select>

      </div>


      <button
        type="button"
        class="btn navy"
        onclick="carregarMetasEquipe()"
      >
        ↻ Carregar período
      </button>


    </div>


    <!-- ================================================
         RESUMO
         ================================================ -->

    <div class="metas-resumo">


      <div class="meta-resumo-card">

        <span>
          VENDEDORES ATIVOS
        </span>

        <strong id="metasQtdVendedores">
          0
        </strong>

      </div>


      <div class="meta-resumo-card">

        <span>
          COM META DEFINIDA
        </span>

        <strong id="metasQtdDefinidas">
          0
        </strong>

      </div>


      <div class="meta-resumo-card">

        <span>
          META TOTAL DA EQUIPE
        </span>

        <strong id="metasValorTotal">
          R$ 0,00
        </strong>

      </div>


    </div>


    <!-- ================================================
         TABELA
         ================================================ -->

    <div class="table-wrap">

      <table class="editor metas-table">

        <thead>

          <tr>

            <th>
              Vendedor
            </th>

            <th>
              Meta atual
            </th>

            <th>
              Situação
            </th>

            <th>
              Nova meta
            </th>

            <th>
              Ação
            </th>

          </tr>

        </thead>


        <tbody id="metasBody">

          <tr>

            <td
              colspan="5"
              style="
                text-align:center;
                padding:30px;
              "
            >

              Carregando metas...

            </td>

          </tr>

        </tbody>

      </table>

    </div>


    <div id="metasVazio">
      Nenhum vendedor ativo encontrado.
    </div>

  `;


  panelBody.appendChild(
    area
  );


  // -------------------------------------------------------
  // ## 5.1 Preencher anos
  // -------------------------------------------------------

  const selectAno =
    area.querySelector(
      '#metasAno'
    );


  const anoAtual =
    periodo.ano;


  for (
    let ano =
      anoAtual - 1;

    ano <=
      anoAtual + 2;

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
      anoAtual
    ) {

      option.selected =
        true;

    }


    selectAno.appendChild(
      option
    );

  }


  const selectMes =
    area.querySelector(
      '#metasMes'
    );


  if (selectMes) {

    selectMes.value =
      String(
        periodo.mes
      );

  }


  // -------------------------------------------------------
  // ## 5.2 Eventos
  // -------------------------------------------------------

  selectMes
    ?.addEventListener(
      'change',
      carregarMetasEquipe
    );


  selectAno
    ?.addEventListener(
      'change',
      carregarMetasEquipe
    );

}


// =========================================================
// ## 6. OBTER PERÍODO
// =========================================================

function obterPeriodoMetaSelecionado() {

  const periodo =
    periodoAtualMeta();


  const ano =
    Number(
      document
        .getElementById(
          'metasAno'
        )
        ?.value
    ) ||
    periodo.ano;


  const mes =
    Number(
      document
        .getElementById(
          'metasMes'
        )
        ?.value
    ) ||
    periodo.mes;


  return {
    ano,
    mes
  };
}


// =========================================================
// ## 7. OBTER META DO VENDEDOR
// =========================================================

function obterMetaVendedorPeriodo(
  userId
) {

  return metasPeriodo.find(
    meta =>
      meta.user_id ===
      userId
  ) || null;
}


// =========================================================
// ## 8. INDICADORES
// =========================================================

function atualizarResumoMetas() {

  const definidas =
    metasVendedores.filter(
      vendedor =>
        Boolean(
          obterMetaVendedorPeriodo(
            vendedor.user_id
          )
        )
    );


  const total =
    metasPeriodo.reduce(
      (
        soma,
        meta
      ) =>
        soma +
        (
          Number(
            meta.meta_valor
          ) || 0
        ),
      0
    );


  const qtdVendedores =
    document.getElementById(
      'metasQtdVendedores'
    );


  const qtdDefinidas =
    document.getElementById(
      'metasQtdDefinidas'
    );


  const valorTotal =
    document.getElementById(
      'metasValorTotal'
    );


  if (qtdVendedores) {

    qtdVendedores.textContent =
      metasVendedores.length;

  }


  if (qtdDefinidas) {

    qtdDefinidas.textContent =
      definidas.length;

  }


  if (valorTotal) {

    valorTotal.textContent =
      formatarMoedaMeta(
        total
      );

  }

}


// =========================================================
// ## 9. RENDERIZAR
// =========================================================

function renderizarMetasEquipe() {

  const corpo =
    document.getElementById(
      'metasBody'
    );


  const vazio =
    document.getElementById(
      'metasVazio'
    );


  if (!corpo) {

    return;

  }


  corpo.innerHTML =
    '';


  atualizarResumoMetas();


  if (vazio) {

    vazio.style.display =
      metasVendedores.length
        ? 'none'
        : 'block';

  }


  metasVendedores.forEach(
    vendedor => {

      const meta =
        obterMetaVendedorPeriodo(
          vendedor.user_id
        );


      const valor =
        Number(
          meta?.meta_valor
        ) || 0;


      const tr =
        document.createElement(
          'tr'
        );


      tr.innerHTML = `

        <td>

          <div class="meta-vendedor-nome">

            ${
              escaparMeta(
                vendedor.nome
              )
            }

          </div>


          <div class="meta-vendedor-email">

            ${
              escaparMeta(
                vendedor.email
              )
            }

          </div>

        </td>


        <td class="meta-atual">

          ${
            meta
              ? formatarMoedaMeta(
                  valor
                )
              : '—'
          }

        </td>


        <td>

          ${
            meta
              ? `
                <span class="meta-status definida">
                  DEFINIDA
                </span>
              `
              : `
                <span class="meta-status nao-definida">
                  NÃO DEFINIDA
                </span>
              `
          }

        </td>


        <td>

          <input
            id="metaInput_${escaparMeta(
              vendedor.user_id
            )}"
            class="meta-input"
            type="number"
            min="0"
            step="0.01"
            value="${
              meta
                ? valor
                : ''
            }"
            placeholder="Ex.: 100000"
          >

        </td>


        <td>

          <button
            type="button"
            class="btn green"
            onclick="
              salvarMetaUsuarioEquipe(
                '${escaparMeta(
                  vendedor.user_id
                )}'
              )
            "
          >
            Salvar meta
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
// ## 10. CARREGAR METAS
// =========================================================

async function carregarMetasEquipe() {

  if (
    metasCarregando ||
    !podeGerenciarMetas()
  ) {

    return;

  }


  const corpo =
    document.getElementById(
      'metasBody'
    );


  metasCarregando =
    true;


  if (corpo) {

    corpo.innerHTML = `

      <tr>

        <td
          colspan="5"
          style="
            text-align:center;
            padding:30px;
          "
        >
          Carregando metas...
        </td>

      </tr>

    `;

  }


  try {

    const periodo =
      obterPeriodoMetaSelecionado();


    const [
      perfis,
      metas
    ] =
      await Promise.all([

        listarPerfisEquipe(),

        listarMetasVendedor({
          ano:
            periodo.ano,

          mes:
            periodo.mes
        })

      ]);


    metasVendedores =
      perfis
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
            )
              .localeCompare(
                String(
                  b.nome || ''
                ),
                'pt-BR'
              )
        );


    metasPeriodo =
      metas || [];


    renderizarMetasEquipe();


  } catch (erro) {

    console.error(
      'Erro ao carregar metas:',
      erro
    );


    if (corpo) {

      corpo.innerHTML = `

        <tr>

          <td
            colspan="5"
            style="
              text-align:center;
              padding:30px;
            "
          >
            Não foi possível carregar as metas.
          </td>

        </tr>

      `;

    }

  } finally {

    metasCarregando =
      false;

  }

}


// =========================================================
// ## 11. SALVAR META DE UM VENDEDOR
// =========================================================

async function salvarMetaUsuarioEquipe(
  userId
) {

  if (
    !podeGerenciarMetas()
  ) {

    return;

  }


  const vendedor =
    metasVendedores.find(
      perfil =>
        perfil.user_id ===
        userId
    );


  if (!vendedor) {

    return;

  }


  const input =
    document.getElementById(
      `metaInput_${userId}`
    );


  const valor =
    Number(
      input?.value
    );


  if (
    !Number.isFinite(
      valor
    ) ||
    valor < 0
  ) {

    alert(
      'Informe uma meta válida.'
    );

    input?.focus();

    return;

  }


  const periodo =
    obterPeriodoMetaSelecionado();


  const confirmar =
    confirm(
      `Salvar meta de ${vendedor.nome} ` +
      `para ${nomeMesMeta(periodo.mes)}/${periodo.ano} ` +
      `em ${formatarMoedaMeta(valor)}?`
    );


  if (!confirmar) {

    return;

  }


  try {

    await salvarMetaVendedor({

      userId,

      ano:
        periodo.ano,

      mes:
        periodo.mes,

      metaValor:
        valor

    });


    toastMsg(
      `Meta de ${vendedor.nome} salva`
    );


    await carregarMetasEquipe();


  } catch (erro) {

    console.error(
      'Erro ao salvar meta:',
      erro
    );


    alert(
      'Não foi possível salvar a meta.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  }

}


// =========================================================
// ## 12. SINCRONIZAR PERMISSÃO
// =========================================================

async function sincronizarGestaoMetas() {

  montarInterfaceMetas();


  const area =
    document.getElementById(
      'gestaoMetasEquipe'
    );


  try {

    metasPerfilAtual =
      await obterMeuPerfil();


    if (
      !metasPerfilAtual ||
      !podeGerenciarMetas()
    ) {

      if (area) {

        area.hidden =
          true;

      }


      return;

    }


    if (area) {

      area.hidden =
        false;

    }


    await carregarMetasEquipe();


  } catch (erro) {

    console.error(
      'Erro ao inicializar metas:',
      erro
    );


    if (area) {

      area.hidden =
        true;

    }

  }

}


// =========================================================
// ## 13. INICIALIZAÇÃO
// =========================================================

function iniciarModuloMetas() {

  // equipe.js cria o painel dinamicamente.
  // Executamos depois dele terminar a montagem.

  setTimeout(
    sincronizarGestaoMetas,
    0
  );


  try {

    const client =
      getSupabaseClient();


    client.auth.onAuthStateChange(
      () => {

        setTimeout(
          sincronizarGestaoMetas,
          0
        );

      }
    );


  } catch (erro) {

    console.error(
      'Erro ao monitorar autenticação das metas:',
      erro
    );

  }

}


if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    iniciarModuloMetas
  );

} else {

  iniciarModuloMetas();

}