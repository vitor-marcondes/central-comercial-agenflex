// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: metas.js
//
// Responsabilidade:
// - Gerenciar Meta Oficial por Time
// - Gerenciar metas individuais dos vendedores
// - Filtrar vendedores por Time
// - Calcular total distribuído
// - Calcular valor restante / excedente
// - Permitir manutenção por Gestor / ADM
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

let metasOficiaisPeriodo =
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
    Number(
      valor
    ) || 0
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


function nomeTimeMeta(
  timeEquipe
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
    String(
      timeEquipe || ''
    )
      .toLowerCase()
  ] || '—';
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
    Number(
      mes
    )
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
          🎯 Gestão de Metas
        </h3>

        <p>
          Defina a meta oficial do Time e distribua
          as metas individuais dos vendedores.
        </p>

      </div>

    </div>


    <!-- ================================================
         FILTROS
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


      <div class="field">

        <label>
          Time
        </label>

        <select id="metasTime">

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

      </div>


      <button
        type="button"
        class="btn navy"
        onclick="carregarMetasEquipe()"
      >
        ↻ Atualizar
      </button>


    </div>


    <!-- ================================================
         META OFICIAL
         ================================================ -->

    <div class="meta-oficial-box">

      <div class="meta-oficial-info">

        <span>
          META OFICIAL DO TIME
        </span>

        <strong id="metaOficialTitulo">
          Pharma
        </strong>

        <small id="metaOficialPeriodo">
          —
        </small>

      </div>


      <div class="meta-oficial-editor">

        <div class="field">

          <label>
            Valor da meta oficial
          </label>

          <input
            id="metaOficialInput"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex.: 500000"
          >

        </div>


        <button
          id="btnSalvarMetaOficial"
          type="button"
          class="btn navy"
          onclick="salvarMetaOficialTimeSelecionado()"
        >
          Salvar meta oficial
        </button>

      </div>

    </div>


    <!-- ================================================
         INDICADORES
         ================================================ -->

    <div class="metas-resumo">


      <div class="meta-resumo-card oficial">

        <span>
          META OFICIAL
        </span>

        <strong id="metasValorOficial">
          R$ 0,00
        </strong>

      </div>


      <div class="meta-resumo-card distribuida">

        <span>
          METAS DISTRIBUÍDAS
        </span>

        <strong id="metasValorDistribuido">
          R$ 0,00
        </strong>

      </div>


      <div
        id="metasCardDiferenca"
        class="meta-resumo-card diferenca"
      >

        <span id="metasDiferencaTitulo">
          FALTA DISTRIBUIR
        </span>

        <strong id="metasValorDiferenca">
          R$ 0,00
        </strong>

      </div>


      <div class="meta-resumo-card vendedores">

        <span>
          VENDEDORES DO TIME
        </span>

        <strong id="metasQtdVendedores">
          0
        </strong>

        <small id="metasQtdDefinidasTexto">
          0 com meta definida
        </small>

      </div>


    </div>


    <!-- ================================================
         TÍTULO DA DISTRIBUIÇÃO
         ================================================ -->

    <div class="metas-distribuicao-head">

      <div>

        <h4>
          Metas individuais
        </h4>

        <p id="metasDistribuicaoDescricao">
          Distribuição da meta entre os vendedores.
        </p>

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
              class="metas-loading-cell"
            >

              Carregando metas...

            </td>

          </tr>

        </tbody>

      </table>

    </div>


    <div id="metasVazio">
      Nenhum vendedor ativo encontrado neste Time.
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


  area
    .querySelector(
      '#metasTime'
    )
    ?.addEventListener(
      'change',
      carregarMetasEquipe
    );

}


// =========================================================
// ## 6. FILTROS SELECIONADOS
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


function obterTimeMetaSelecionado() {

  const valor =
    String(
      document
        .getElementById(
          'metasTime'
        )
        ?.value ||
      'pharma'
    )
      .trim()
      .toLowerCase();


  if (
    ![
      'pharma',
      'food',
      'revenda'
    ].includes(
      valor
    )
  ) {

    return 'pharma';

  }


  return valor;
}


// =========================================================
// ## 7. META INDIVIDUAL
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
// ## 8. META OFICIAL DO TIME
// =========================================================

function obterMetaOficialSelecionada() {

  const timeEquipe =
    obterTimeMetaSelecionado();


  return metasOficiaisPeriodo.find(
    meta =>
      meta.time_equipe ===
      timeEquipe
  ) || null;
}


// =========================================================
// ## 9. INDICADORES
// =========================================================

function atualizarResumoMetas() {

  const timeEquipe =
    obterTimeMetaSelecionado();


  const periodo =
    obterPeriodoMetaSelecionado();


  const metaOficial =
    obterMetaOficialSelecionada();


  const valorOficial =
    Number(
      metaOficial
        ?.meta_valor
    ) || 0;


  const idsVendedores =
    new Set(
      metasVendedores.map(
        vendedor =>
          vendedor.user_id
      )
    );


  const metasDoTime =
    metasPeriodo.filter(
      meta =>
        idsVendedores.has(
          meta.user_id
        )
    );


  const valorDistribuido =
    metasDoTime.reduce(
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


  const quantidadeDefinidas =
    metasVendedores.filter(
      vendedor =>
        Boolean(
          obterMetaVendedorPeriodo(
            vendedor.user_id
          )
        )
    ).length;


  const diferenca =
    valorOficial -
    valorDistribuido;


  // -------------------------------------------------------
  // ## 9.1 Elementos
  // -------------------------------------------------------

  const valorOficialEl =
    document.getElementById(
      'metasValorOficial'
    );


  const valorDistribuidoEl =
    document.getElementById(
      'metasValorDistribuido'
    );


  const valorDiferencaEl =
    document.getElementById(
      'metasValorDiferenca'
    );


  const diferencaTituloEl =
    document.getElementById(
      'metasDiferencaTitulo'
    );


  const diferencaCardEl =
    document.getElementById(
      'metasCardDiferenca'
    );


  const qtdVendedoresEl =
    document.getElementById(
      'metasQtdVendedores'
    );


  const qtdDefinidasEl =
    document.getElementById(
      'metasQtdDefinidasTexto'
    );


  const metaTituloEl =
    document.getElementById(
      'metaOficialTitulo'
    );


  const metaPeriodoEl =
    document.getElementById(
      'metaOficialPeriodo'
    );


  const metaInputEl =
    document.getElementById(
      'metaOficialInput'
    );


  const distribuicaoDescricaoEl =
    document.getElementById(
      'metasDistribuicaoDescricao'
    );


  // -------------------------------------------------------
  // ## 9.2 Valores
  // -------------------------------------------------------

  if (valorOficialEl) {

    valorOficialEl.textContent =
      formatarMoedaMeta(
        valorOficial
      );

  }


  if (valorDistribuidoEl) {

    valorDistribuidoEl.textContent =
      formatarMoedaMeta(
        valorDistribuido
      );

  }


  if (valorDiferencaEl) {

    valorDiferencaEl.textContent =
      formatarMoedaMeta(
        Math.abs(
          diferenca
        )
      );

  }


  if (qtdVendedoresEl) {

    qtdVendedoresEl.textContent =
      metasVendedores.length;

  }


  if (qtdDefinidasEl) {

    qtdDefinidasEl.textContent =
      `${quantidadeDefinidas} com meta definida`;

  }


  // -------------------------------------------------------
  // ## 9.3 Restante / excedente
  // -------------------------------------------------------

  if (
    diferencaTituloEl &&
    diferencaCardEl
  ) {

    diferencaCardEl.classList.remove(
      'restante',
      'excedente',
      'equilibrada'
    );


    if (
      diferenca > 0
    ) {

      diferencaTituloEl.textContent =
        'FALTA DISTRIBUIR';


      diferencaCardEl.classList.add(
        'restante'
      );

    } else if (
      diferenca < 0
    ) {

      diferencaTituloEl.textContent =
        'EXCEDENTE DISTRIBUÍDO';


      diferencaCardEl.classList.add(
        'excedente'
      );

    } else {

      diferencaTituloEl.textContent =
        'META DISTRIBUÍDA';


      diferencaCardEl.classList.add(
        'equilibrada'
      );

    }

  }


  // -------------------------------------------------------
  // ## 9.4 Cabeçalho da Meta Oficial
  // -------------------------------------------------------

  if (metaTituloEl) {

    metaTituloEl.textContent =
      nomeTimeMeta(
        timeEquipe
      );

  }


  if (metaPeriodoEl) {

    metaPeriodoEl.textContent =
      `${nomeMesMeta(
        periodo.mes
      )} / ${periodo.ano}`;

  }


  if (metaInputEl) {

    metaInputEl.value =
      metaOficial
        ? Number(
            metaOficial.meta_valor
          )
        : '';

  }


  if (
    distribuicaoDescricaoEl
  ) {

    distribuicaoDescricaoEl.textContent =
      `Distribuição da meta do Time ` +
      `${nomeTimeMeta(timeEquipe)} ` +
      `em ${nomeMesMeta(periodo.mes)}/${periodo.ano}.`;

  }

}


// =========================================================
// ## 10. RENDERIZAR VENDEDORES
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
            Salvar
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
// ## 11. CARREGAR METAS
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
          class="metas-loading-cell"
        >
          Carregando metas...
        </td>

      </tr>

    `;

  }


  try {

    const periodo =
      obterPeriodoMetaSelecionado();


    const timeEquipe =
      obterTimeMetaSelecionado();


    const [
      perfis,
      metasIndividuais,
      metasOficiais
    ] =
      await Promise.all([

        listarPerfisEquipe(),

        listarMetasVendedor({

          ano:
            periodo.ano,

          mes:
            periodo.mes

        }),

        listarMetasOficiaisEquipe({

          ano:
            periodo.ano,

          mes:
            periodo.mes,

          timeEquipe

        })

      ]);


    // -----------------------------------------------------
    // ## 11.1 Somente vendedores ativos do Time escolhido
    // -----------------------------------------------------

    metasVendedores =
      perfis
        .filter(
          perfil =>
            perfil.ativo &&
            perfil.tipo_acesso ===
              'vendedor' &&
            perfil.time_equipe ===
              timeEquipe
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
      metasIndividuais || [];


    metasOficiaisPeriodo =
      metasOficiais || [];


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
            class="metas-loading-cell"
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
// ## 12. SALVAR META OFICIAL DO TIME
// =========================================================

async function salvarMetaOficialTimeSelecionado() {

  if (
    !podeGerenciarMetas()
  ) {

    return;

  }


  const input =
    document.getElementById(
      'metaOficialInput'
    );


  const botao =
    document.getElementById(
      'btnSalvarMetaOficial'
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
      'Informe uma meta oficial válida.'
    );


    input?.focus();


    return;

  }


  const periodo =
    obterPeriodoMetaSelecionado();


  const timeEquipe =
    obterTimeMetaSelecionado();


  const confirmar =
    confirm(
      `Definir a meta oficial do Time ` +
      `${nomeTimeMeta(timeEquipe)} para ` +
      `${nomeMesMeta(periodo.mes)}/${periodo.ano} ` +
      `em ${formatarMoedaMeta(valor)}?`
    );


  if (!confirmar) {

    return;

  }


  const textoOriginal =
    botao
      ?.textContent ||
    'Salvar meta oficial';


  if (botao) {

    botao.disabled =
      true;


    botao.textContent =
      'Salvando...';

  }


  try {

    await salvarMetaOficialEquipe({

      timeEquipe,

      ano:
        periodo.ano,

      mes:
        periodo.mes,

      metaValor:
        valor

    });


    toastMsg(
      `Meta oficial do Time ${nomeTimeMeta(timeEquipe)} salva`
    );


    await carregarMetasEquipe();


  } catch (erro) {

    console.error(
      'Erro ao salvar meta oficial:',
      erro
    );


    alert(
      'Não foi possível salvar a meta oficial.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );


  } finally {

    if (botao) {

      botao.disabled =
        false;


      botao.textContent =
        textoOriginal;

    }

  }

}


// =========================================================
// ## 13. SALVAR META INDIVIDUAL
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
// ## 14. SINCRONIZAR PERMISSÃO
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
// ## 15. INICIALIZAÇÃO
// =========================================================

function iniciarModuloMetas() {

  // equipe.js cria o painel dinamicamente.

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