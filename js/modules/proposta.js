// =========================================================
// CENTRAL COMERCIAL AGENFLEX
// Arquivo: proposta.js
//
// Responsabilidade:
// - Controlar itens da proposta
// - Calcular valores, IPI e totais
// - Atualizar a prévia do PDF
// - Gerenciar artes temporárias
// - Gerenciar vendedores recentes
// - Salvar e restaurar rascunho local
// - Preparar dados para o Supabase
// - Salvar propostas no banco
// - Controlar envio e bloqueio das revisões
// - Controlar a gestão comercial
// - Reabrir propostas existentes
// - Integrar consulta automática de CNPJ
//
// Dependências:
// - js/core/core.js
// - js/services/propostas.service.js
// - js/services/cnpj.service.js
// - Elementos do index.html
//
// Observação:
// Este arquivo concentra a lógica principal da proposta.
// Funções de comunicação externa permanecem nos services.
// =========================================================


// =========================================================
// ## 1. ESTADO DA PROPOSTA
// =========================================================


// ---------------------------------------------------------
// ## 1.1 Estado da revisão atual
// ---------------------------------------------------------

let items = [
  {
    codigo: '',
    produto: '',
    detalhes: '',
    ncm: '',
    quant: 0,
    unidade: 'UN',
    unit: 0,
    desc: 0,
    ipi: 9.75
  }
];

let propostaNuvemAtual = {

  propostaId: null,

  numero: null,

  revisaoId: null,

  numeroRevisao: 0,

  status: 'rascunho',

  enviadoEm: null
};


// ---------------------------------------------------------
// ## 1.2 Estado comercial da proposta
// ---------------------------------------------------------

// IMPORTANTE:
//
// propostaNuvemAtual.status
// → status da REVISÃO
// → rascunho / enviada
//
// statusComercialAtual.status
// → status da NEGOCIAÇÃO
// → proposta / andamento / concluido / nao_conquistado
//
// statusComercialAtual.origemComercial
// → origem da oportunidade comercial

let statusComercialAtual = {

  origemComercial: null,

  status: 'proposta',

  motivoNaoConquistado: null,

  detalheNaoConquistado: null,

  atualizadoEm: null,

  atualizadoPor: null
};


// ---------------------------------------------------------
// ## 1.3 Regra de edição da revisão
// ---------------------------------------------------------

// Nova proposta:
// → ainda é editável.
//
// Revisão em rascunho:
// → editável.
//
// Revisão enviada:
// → bloqueada.

function revisaoEhEditavel() {

  return (
    !propostaNuvemAtual.propostaId ||
    propostaNuvemAtual.status === 'rascunho'
  );
}


// =========================================================
// ## 2. ITENS DA PROPOSTA
// =========================================================


// ---------------------------------------------------------
// ## 2.1 Cálculo individual do item
// ---------------------------------------------------------

function normalizarDescontoPercentual(
  valor
) {

  const numero =
    Number(valor) || 0;


  return Math.min(
    100,
    Math.max(
      0,
      numero
    )
  );

}


function calcItem(
  it
) {

  const quantidade =
    Number(
      it.quant
    ) || 0;


  const valorUnitario =
    Number(
      it.unit
    ) || 0;


  const descontoPercentual =
    normalizarDescontoPercentual(
      it.desc
    );


  const ipiPercentual =
    Number(
      it.ipi
    ) || 0;


  // -------------------------------------------------------
  // Subtotal bruto
  // -------------------------------------------------------

  const subtotal =
    quantidade *
    valorUnitario;


  // -------------------------------------------------------
  // Desconto concedido
  // -------------------------------------------------------

  const desconto =
    subtotal *
    descontoPercentual /
    100;


  // -------------------------------------------------------
  // Subtotal após desconto
  // -------------------------------------------------------

  const subtotalLiquido =
    subtotal -
    desconto;


  // -------------------------------------------------------
  // IPI sobre o valor após desconto
  // -------------------------------------------------------

  const ipi =
    subtotalLiquido *
    ipiPercentual /
    100;


  // -------------------------------------------------------
  // Total final
  // -------------------------------------------------------

  const total =
    subtotalLiquido +
    ipi;


  return {

    subtotal,

    descontoPercentual,

    desconto,

    subtotalLiquido,

    ipi,

    total,

    unitDesc:
      quantidade
        ? subtotalLiquido /
          quantidade
        : 0,

    unitImp:
      quantidade
        ? total /
          quantidade
        : 0

  };

}


// ---------------------------------------------------------
// ## 2.2 Adicionar, duplicar e excluir itens
// ---------------------------------------------------------

function addItem(

  base = {

    codigo: '',

    produto: '',

    detalhes: '',

    ncm: '',

    quant: 0,

    unidade: 'UN',

    unit: 0,

    desc: 0,

    ipi: 9.75

  }

) {

  if (
    !revisaoEhEditavel()
  ) {

    toastMsg(
      'A revisão enviada não pode ser alterada'
    );


    return;

  }


  items.push({

    ...base,

    desc:
      normalizarDescontoPercentual(
        base.desc
      )

  });


  renderItems();

}


function duplicateLast() {

  if (
    !revisaoEhEditavel()
  ) {

    toastMsg(
      'A revisão enviada não pode ser alterada'
    );


    return;

  }


  addItem(

    items[
      items.length - 1
    ] || {}

  );

}


function deleteItem(
  i
) {

  if (
    !revisaoEhEditavel()
  ) {

    toastMsg(
      'A revisão enviada não pode ser alterada'
    );


    return;

  }


  items.splice(
    i,
    1
  );


  if (
    !items.length
  ) {

    items.push({

      codigo: '',

      produto: '',

      detalhes: '',

      ncm: '',

      quant: 0,

      unidade: 'UN',

      unit: 0,

      desc: 0,

      ipi: 9.75

    });

  }


  renderItems();

}


// ---------------------------------------------------------
// ## 2.3 Atualização dos dados do item
// ---------------------------------------------------------

function upd(
  i,
  k,
  v
) {

  if (
    !revisaoEhEditavel()
  ) {

    return;

  }


  if (
    [
      'quant',
      'unit',
      'desc',
      'ipi'
    ].includes(
      k
    )
  ) {

    v =
      Number(v) || 0;

  }


  if (
    k === 'desc'
  ) {

    v =
      normalizarDescontoPercentual(
        v
      );

  }


  items[i][k] =
    v;


  refresh();

}


// ---------------------------------------------------------
// ## 2.4 Seleção de NCM
// ---------------------------------------------------------

function ncmSelect(
  it,
  i
) {

  return `

    <select
      onchange="upd(${i},'ncm',this.value)"
    >

      <option
        value=""
        ${!it.ncm ? 'selected' : ''}
      >
        Selecionar NCM
      </option>


      <optgroup
        label="NCM PLÁSTICO"
      >

        <option
          value="3923.29.10 - 39"
          ${
            it.ncm ===
            '3923.29.10 - 39'
              ? 'selected'
              : ''
          }
        >
          3923.29.10 - 39
        </option>

      </optgroup>


      <optgroup
        label="NCM PAPEL"
      >

        <option
          value="4819.40.00"
          ${
            it.ncm ===
            '4819.40.00'
              ? 'selected'
              : ''
          }
        >
          4819.40.00
        </option>

      </optgroup>

    </select>

  `;

}


// ---------------------------------------------------------
// ## 2.5 Seleção de unidade
// ---------------------------------------------------------

function unitSelect(
  it,
  i
) {

  return `

    <select
      onchange="upd(${i},'unidade',this.value)"
    >

      <option
        value="UN"
        ${
          it.unidade ===
          'UN'
            ? 'selected'
            : ''
        }
      >
        UN
      </option>


      <option
        value="PCT"
        ${
          it.unidade ===
          'PCT'
            ? 'selected'
            : ''
        }
      >
        PCT
      </option>

    </select>

  `;

}


// ---------------------------------------------------------
// ## 2.6 Renderização da tabela de itens
// ---------------------------------------------------------

function renderItems() {

  itemsEditor.innerHTML =
    '';


  items.forEach(
    (
      it,
      i
    ) => {

      const tr =
        document.createElement(
          'tr'
        );


      const c =
        calcItem(
          it
        );


      tr.innerHTML = `

        <td>

          <input
            value="${esc(it.codigo)}"
            oninput="upd(${i},'codigo',this.value)"
          >

        </td>


        <td>

          <input
            value="${esc(it.produto)}"
            placeholder="Produto"
            oninput="upd(${i},'produto',this.value)"
          >


          <textarea
            placeholder="Observações do item"
            oninput="upd(${i},'detalhes',this.value)"
          >${esc(it.detalhes)}</textarea>

        </td>


        <td>

          ${ncmSelect(
            it,
            i
          )}

        </td>


        <td>

          <input
            type="number"
            min="0"
            value="${it.quant}"
            oninput="upd(${i},'quant',this.value)"
          >

        </td>


        <td>

          ${unitSelect(
            it,
            i
          )}

        </td>


        <td>

          <input
            type="number"
            min="0"
            step="0.0001"
            value="${it.unit}"
            oninput="upd(${i},'unit',this.value)"
          >

        </td>


        <td>

          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value="${
              normalizarDescontoPercentual(
                it.desc
              )
            }"
            oninput="upd(${i},'desc',this.value)"
          >

        </td>


        <td>

          ${BRL.format(
            c.desconto
          )}

        </td>


        <td>

          <input
            type="number"
            step="0.01"
            value="${it.ipi}"
            oninput="upd(${i},'ipi',this.value)"
          >

        </td>


        <td>

          ${BRL.format(
            c.total
          )}

        </td>


        <td>

          <button
            class="del"
            onclick="deleteItem(${i})"
          >
            ×
          </button>

        </td>

      `;


      itemsEditor.appendChild(
        tr
      );

    }
  );


  refresh();


  atualizarBloqueioCamposRevisao();

}


// ---------------------------------------------------------
// ## 2.7 Totais da proposta
// ---------------------------------------------------------

function totals() {

  return items.reduce(

    (
      acumulador,
      it
    ) => {

      const c =
        calcItem(
          it
        );


      acumulador.sub +=
        c.subtotal;


      acumulador.desconto +=
        c.desconto;


      acumulador.liquido +=
        c.subtotalLiquido;


      acumulador.ipi +=
        c.ipi;


      acumulador.total +=
        c.total;


      return acumulador;

    },

    {

      sub: 0,

      desconto: 0,

      liquido: 0,

      ipi: 0,

      total: 0

    }

  );

}

// =========================================================
// ## 3. TIME E LOGOTIPO DA PROPOSTA
// =========================================================

function updateTeamLogo() {

  const team =
    timeEquipe.value ||
    'revenda';


  pdfLogo.src =
    teamLogos[team] ||
    teamLogos.revenda;


  pdfLogo.classList.remove(
    'logo-revenda',
    'logo-pharma',
    'logo-food'
  );


  pdfLogo.classList.add(
    'logo-' + team
  );
}


// =========================================================
// ## 4. ATUALIZAÇÃO DA PROPOSTA E PRÉVIA DO PDF
// =========================================================

function refresh() {

  updateTeamLogo();


  const t =
    totals();


  // -------------------------------------------------------
  // ## 4.1 Totais exibidos na interface
  // -------------------------------------------------------

mSubtotal.textContent =
  BRL.format(
    t.sub
  );


document
  .getElementById(
    'mDesconto'
  )
  .textContent =
    BRL.format(
      t.desconto
    );


mIpi.textContent =
  BRL.format(
    t.ipi
  );


mTotal.textContent =
  BRL.format(
    t.total
  );

  // -------------------------------------------------------
  // ## 4.2 Dados principais do cliente no PDF
  // -------------------------------------------------------

  pOrcamento.textContent =
    orcamento.value || '—';

  pCliente.textContent =
    (cliente.value || '').toUpperCase();

  pComprador.textContent =
    comprador.value;

  pCnpj.textContent =
    cnpj.value;

  pIe.textContent =
    ie.value;

  pTelefone.textContent =
    telefone.value;

  pEmail.textContent =
    email.value;

  pEndereco.textContent =
    endereco.value;

  pBairro.textContent =
    bairro.value;

  pCidade.textContent =
    cidade.value;


  // -------------------------------------------------------
  // ## 4.3 Totais do PDF
  // -------------------------------------------------------

pSubtotal.textContent =
  N2.format(
    t.sub
  );


document
  .getElementById(
    'pDesconto'
  )
  .textContent =
    '- ' +
    N2.format(
      t.desconto
    );


pIpi.textContent =
  N2.format(
    t.ipi
  );


pTotal.textContent =
  N2.format(
    t.total
  );

  const mostrarTotais =
    mostrarTotalPdf.checked;


pSubtotalRow.style.display =
  mostrarTotais
    ? 'table-row'
    : 'none';


document
  .getElementById(
    'pDescontoRow'
  )
  .style.display =
    (
      mostrarTotais &&
      t.desconto > 0
    )
      ? 'table-row'
      : 'none';


pIpiRow.style.display =
  mostrarTotais
    ? 'table-row'
    : 'none';


pTotalRow.style.display =
  mostrarTotais
    ? 'table-row'
    : 'none';

  // -------------------------------------------------------
  // ## 4.4 Informações comerciais
  // -------------------------------------------------------

  pIncluido.textContent =
    brDate(orcData.value) +
    ' às ' +
    new Date().toLocaleTimeString(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );


  pPrevisao.textContent =
    brDate(previsao.value);


  pVendedor.textContent =
    (vendedor.value || '')
      .toUpperCase();


  pProjeto.textContent =
    projeto.value;


  pFrete.textContent =
    frete.value.replace(
      /^FRETE COBRADO DO CLIENTE:\s*/i,
      ''
    );


  pValidade.textContent =
    validade.value;


  pCliche.textContent =
    cliche.value;


  pPagamento.textContent =
    pagamento.value;


  pDestinacao.textContent =
    (destinacao.value || '')
      .toUpperCase();


  pRegras.textContent =
    regras.value;


  // -------------------------------------------------------
  // ## 4.5 Informações de geração
  // -------------------------------------------------------

  pGerado.textContent =
    new Date().toLocaleDateString(
      'pt-BR'
    ) +
    ' às ' +
    new Date().toLocaleTimeString(
      'pt-BR'
    );


  pGeradoPor.textContent =
    vendedor.value;


  // -------------------------------------------------------
  // ## 4.6 Itens exibidos no PDF
  // -------------------------------------------------------

pdfRows.innerHTML =
  '';


items.forEach(
  it => {

    const c =
      calcItem(it);


    const tr =
      document.createElement(
        'tr'
      );


    const descontoPercentual =
      normalizarDescontoPercentual(
        it.desc
      );


    tr.innerHTML = `

      <td>

        ${
          esc(
            (
              it.codigo
                ? it.codigo + ' - '
                : ''
            ) +
            it.produto
          )
        }


        ${
          it.detalhes
            ? `
              <div class="item-notes">
                ${
                  esc(
                    it.detalhes
                  ).replace(
                    /\n/g,
                    '<br>'
                  )
                }
              </div>
            `
            : ''
        }

      </td>


      <td>
        ${esc(it.ncm)}
      </td>


      <td>

        ${N2.format(it.quant)}
        ${esc(it.unidade)}

      </td>


      <td>
        ${N4.format(it.unit)}
      </td>


      <td>

        ${
          descontoPercentual > 0
            ? `
              <b>
                ${
                  String(
                    descontoPercentual
                  ).replace(
                    '.',
                    ','
                  )
                }%
              </b>

              <div>
                ${N2.format(
                  c.desconto
                )}
              </div>
            `
            : '—'
        }

      </td>


      <td>

        ${N2.format(c.ipi)}

        ${
          it.ipi
            ? `
              <div>
                (
                ${
                  String(
                    it.ipi
                  ).replace(
                    '.',
                    ','
                  )
                }%
                )
              </div>
            `
            : ''
        }

      </td>


      <td>
        ${N4.format(
          c.unitImp
        )}
      </td>


      <td>
        ${N2.format(
          c.total
        )}
      </td>

    `;


    pdfRows.appendChild(
      tr
    );

  }
);

  // -------------------------------------------------------
  // ## 4.7 Artes anexadas
  // -------------------------------------------------------

  renderArts();


  // -------------------------------------------------------
  // ## 4.8 Status de salvamento
  // -------------------------------------------------------

  if (
    !propostaNuvemAtual.propostaId
  ) {

    saveStatus.textContent =
      'Alterações não salvas';

  } else if (
    propostaNuvemAtual.status ===
    'enviada'
  ) {

    saveStatus.textContent =
      `Proposta #${propostaNuvemAtual.numero} ` +
      `• R${propostaNuvemAtual.numeroRevisao} ` +
      `• ENVIADA`;

  } else {

    saveStatus.textContent =
      `Proposta #${propostaNuvemAtual.numero} ` +
      `• R${propostaNuvemAtual.numeroRevisao} ` +
      `• alterações não salvas`;

  }
}


// =========================================================
// ## 5. ARTES TEMPORÁRIAS DA PROPOSTA
// =========================================================

let arts = [];


// ---------------------------------------------------------
// ## 5.1 Inclusão de arquivos
// ---------------------------------------------------------

function addArtFiles(
  fileList
) {

  if (
    !revisaoEhEditavel()
  ) {

    toastMsg(
      'A revisão enviada não pode receber novas artes'
    );

    return;
  }


  const files =
    [...fileList].filter(
      file =>
        file.type.startsWith('image/') ||
        file.type === 'application/pdf'
    );


  if (!files.length) {

    return;

  }


  let pending =
    files.length;


  let added =
    0;


  files.forEach(
    file => {

      const r =
        new FileReader();


      r.onload =
        () => {

          arts.push({
            name: file.name,
            type: file.type,
            data: r.result
          });


          added++;


          if (--pending === 0) {

            renderArts();

            arteInput.value =
              '';

            toastMsg(
              added +
              ' arte(s) adicionada(s)'
            );

          }

        };


      r.onerror =
        () => {

          if (--pending === 0) {

            renderArts();

          }

        };


      r.readAsDataURL(
        file
      );

    }
  );
}


// ---------------------------------------------------------
// ## 5.2 Evento do campo de upload
// ---------------------------------------------------------

arteInput.addEventListener(
  'change',
  e =>
    addArtFiles(
      e.target.files
    )
);


// ---------------------------------------------------------
// ## 5.3 Remoção de artes
// ---------------------------------------------------------

function removeArt(
  idx
) {

  if (
    !revisaoEhEditavel()
  ) {

    toastMsg(
      'A revisão enviada não pode ser alterada'
    );

    return;
  }


  arts.splice(
    idx,
    1
  );


  renderArts();


  toastMsg(
    'Arte removida'
  );
}


function removeArts() {

  if (
    !revisaoEhEditavel()
  ) {

    toastMsg(
      'A revisão enviada não pode ser alterada'
    );

    return;
  }


  arts =
    [];


  arteInput.value =
    '';


  renderArts();


  toastMsg(
    'Artes removidas'
  );
}


// ---------------------------------------------------------
// ## 5.4 Drag and Drop
// ---------------------------------------------------------

const artDropZone =
  document.getElementById(
    'artDropZone'
  );


[
  'dragenter',
  'dragover'
].forEach(
  evt =>
    artDropZone.addEventListener(
      evt,
      e => {

        e.preventDefault();

        e.stopPropagation();


        artDropZone.style.borderColor =
          '#e30613';


        artDropZone.style.background =
          '#fff5f5';

      }
    )
);


[
  'dragleave',
  'drop'
].forEach(
  evt =>
    artDropZone.addEventListener(
      evt,
      e => {

        e.preventDefault();

        e.stopPropagation();


        artDropZone.style.borderColor =
          '';


        artDropZone.style.background =
          '';

      }
    )
);


artDropZone.addEventListener(
  'drop',
  e =>
    addArtFiles(
      e.dataTransfer.files
    )
);


// ---------------------------------------------------------
// ## 5.5 Renderização das artes
// ---------------------------------------------------------

function renderArts() {

  artThumbs.innerHTML =
    '';


  artPages.innerHTML =
    '';


  pagesLabel.textContent =
    arts.length
      ? (
          'Paginação automática • ' +
          arts.length +
          ' arte(s)'
        )
      : 'Paginação automática';


  arts.forEach(
    (art, idx) => {

      const th =
        document.createElement('div');


      th.className =
        'thumb';


      th.style.position =
        'relative';


      if (
        art.type.startsWith('image/')
      ) {

        th.innerHTML =
          `
            <img
              src="${art.data}"
              alt="${esc(art.name)}"
            >
          `;

      } else {

        th.innerHTML =
          `
            <span>
              PDF: ${esc(art.name)}
            </span>
          `;

      }


      const del =
        document.createElement(
          'button'
        );


      del.type =
        'button';


      del.textContent =
        '×';


      del.title =
        'Remover esta arte';


      del.disabled =
        !revisaoEhEditavel();


      del.style.cssText =
        'position:absolute;' +
        'top:3px;' +
        'right:3px;' +
        'width:24px;' +
        'height:24px;' +
        'border:0;' +
        'border-radius:50%;' +
        'background:#e30613;' +
        'color:#fff;' +
        'font-weight:900;' +
        'cursor:pointer;' +
        'line-height:24px;' +
        'padding:0';


      del.onclick =
        () =>
          removeArt(idx);


      th.appendChild(
        del
      );


      artThumbs.appendChild(
        th
      );


      const page =
        document.createElement(
          'div'
        );


      page.className =
        'pdf-page art-page ' +
        (
          idx === 0
            ? 'first-art'
            : 'subsequent-art'
        );


      let content =
        art.type.startsWith('image/')
          ? `
              <div class="art-frame">
                <img src="${art.data}">
              </div>
            `
          : `
              <div class="art-frame">
                <div>
                  <b>Arquivo PDF anexado:</b>
                  <br>
                  ${esc(art.name)}
                  <br><br>
                  O navegador pode não incorporar
                  visualmente o PDF anexado nesta impressão.
                </div>
              </div>
            `;


      page.innerHTML = `
        <h2>
          Arte anexada pelo cliente
        </h2>

        <div class="art-sub">
          Proposta:
          ${esc(orcamento.value)}
          •
          ${esc(cliente.value)}
        </div>

        ${content}

        <div class="generated">
          Anexo de arte • Agenflex
        </div>
      `;


      artPages.appendChild(
        page
      );

    }
  );
}


// =========================================================
// ## 6. VENDEDORES RECENTES
// =========================================================


// ---------------------------------------------------------
// ## 6.1 Leitura do localStorage
// ---------------------------------------------------------

function recentSellers() {

  try {

    return JSON.parse(
      localStorage.getItem(
        'agenflex_vendedores_recentes'
      ) || '[]'
    );

  } catch (e) {

    return [];

  }
}


// ---------------------------------------------------------
// ## 6.2 Renderização da lista
// ---------------------------------------------------------

function renderSellers() {

  vendedoresRecentes.innerHTML =
    '';


  recentSellers().forEach(
    nome => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        nome;


      vendedoresRecentes.appendChild(
        option
      );

    }
  );
}


// ---------------------------------------------------------
// ## 6.3 Armazenamento do vendedor utilizado
// ---------------------------------------------------------

function rememberSeller() {

  const nome =
    vendedor.value.trim();


  if (!nome) {

    return;

  }


  let lista =
    recentSellers()
      .filter(
        item =>
          item.toLowerCase() !==
          nome.toLowerCase()
      );


  lista.unshift(
    nome
  );


  localStorage.setItem(
    'agenflex_vendedores_recentes',
    JSON.stringify(
      lista.slice(
        0,
        8
      )
    )
  );


  renderSellers();
}


// =========================================================
// ## 7. RASCUNHO LOCAL
// =========================================================


// ---------------------------------------------------------
// ## 7.1 Coleta dos campos
// ---------------------------------------------------------

function collectFields() {

  return {

    orcamento:
      orcamento.value,

    orcData:
      orcData.value,

    validade:
      validade.value,

    timeEquipe:
      timeEquipe.value,


    origemComercial:
      document
        .getElementById(
          'origemComercial'
        )
        ?.value || '',


    cliente:
      cliente.value,

    comprador:
      comprador.value,

    cnpj:
      cnpj.value,

    ie:
      ie.value,

    telefone:
      telefone.value,

    email:
      email.value,

    endereco:
      endereco.value,

    bairro:
      bairro.value,

    cidade:
      cidade.value,


    cliche:
      cliche.value,

    pagamento:
      pagamento.value,

    vendedor:
      vendedor.value,

    projeto:
      projeto.value,

    previsao:
      previsao.value,

    destinacao:
      destinacao.value,

    frete:
      frete.value,

    regras:
      regras.value,


    mostrarTotalPdf:
      mostrarTotalPdf.checked
  };
}


// ---------------------------------------------------------
// ## 7.2 Persistência do rascunho
// ---------------------------------------------------------

function persistirRascunhoLocal() {

  localStorage.setItem(
    KEY,
    JSON.stringify({

      fields:
        collectFields(),

      items,

      propostaNuvemAtual,

      statusComercialAtual
    })
  );
}


// ---------------------------------------------------------
// ## 7.3 Salvamento manual
// ---------------------------------------------------------

function saveDraft() {

  rememberSeller();


  persistirRascunhoLocal();


  saveStatus.textContent =
    'Rascunho salvo neste navegador';


  toastMsg(
    'Rascunho salvo no navegador'
  );
}


// ---------------------------------------------------------
// ## 7.4 Restauração do rascunho
// ---------------------------------------------------------

function loadDraft() {

  try {

    const raw =
      localStorage.getItem(
        KEY
      );


    if (!raw) {

      atualizarInterfaceGestaoComercial();

      atualizarInterfaceRevisao();

      return;

    }


    const d =
      JSON.parse(raw);


    Object.entries(
      d.fields || {}
    ).forEach(
      ([id, valor]) => {

        const el =
          document.getElementById(
            id
          );


        if (!el) {

          return;

        }


        if (
          id === 'mostrarTotalPdf'
        ) {

          el.checked =
            Boolean(valor);

        } else {

          el.value =
            valor;

        }

      }
    );


    if (
      Array.isArray(d.items) &&
      d.items.length
    ) {

      items =
        d.items;

    }


    if (
      d.propostaNuvemAtual
    ) {

      propostaNuvemAtual = {

        ...propostaNuvemAtual,

        ...d.propostaNuvemAtual
      };

    }


    if (
      d.statusComercialAtual
    ) {

      statusComercialAtual = {

        ...statusComercialAtual,

        ...d.statusComercialAtual
      };

    }


    const statusEl =
      document.getElementById(
        'statusComercial'
      );


    const origemEl =
      document.getElementById(
        'origemComercial'
      );


    const motivoEl =
      document.getElementById(
        'motivoNaoConquistado'
      );


    const detalheEl =
      document.getElementById(
        'detalheNaoConquistado'
      );


    if (
      origemEl &&
      propostaNuvemAtual.propostaId &&
      statusComercialAtual.origemComercial
    ) {

      origemEl.value =
        statusComercialAtual.origemComercial;

    }


    if (statusEl) {

      statusEl.value =
        statusComercialAtual.status ||
        'proposta';

    }


    if (motivoEl) {

      motivoEl.value =
        statusComercialAtual
          .motivoNaoConquistado ||
        '';

    }


    if (detalheEl) {

      detalheEl.value =
        statusComercialAtual
          .detalheNaoConquistado ||
        '';

    }


    atualizarInterfaceGestaoComercial();

    atualizarInterfaceRevisao();

  } catch (e) {

    console.warn(
      'Não foi possível restaurar o rascunho local.',
      e
    );


    atualizarInterfaceGestaoComercial();

    atualizarInterfaceRevisao();

  }
}


// ---------------------------------------------------------
// ## 7.5 Limpeza do formulário
// ---------------------------------------------------------

function clearForm() {

  if (
    !confirm(
      'Limpar o orçamento atual?'
    )
  ) {

    return;

  }


  localStorage.removeItem(
    KEY
  );


  location.reload();
}


// =========================================================
// ## 8. PREPARAÇÃO DOS DADOS PARA O SUPABASE
// =========================================================


// ---------------------------------------------------------
// ## 8.1 Payload da revisão
// ---------------------------------------------------------

function montarPayloadRevisao() {

  return {

    origem_comercial:
      document
        .getElementById(
          'origemComercial'
        )
        ?.value || null,


    nome_proposta:
      orcamento.value.trim(),

    data_proposta:
      orcData.value ||
      isoToday(),

    validade:
      validade.value,

    time_equipe:
      timeEquipe.value ||
      null,


    cliente:
      cliente.value.trim(),

    comprador:
      comprador.value.trim(),

    cnpj:
      cnpj.value.trim(),

    inscricao_estadual:
      ie.value.trim(),

    telefone:
      telefone.value.trim(),

    email:
      email.value.trim(),

    endereco:
      endereco.value.trim(),

    bairro:
      bairro.value.trim(),

    cidade_uf_cep:
      cidade.value.trim(),


    cliche:
      cliche.value.trim() ||
      'A CALCULAR',

    forma_pagamento:
      pagamento.value.trim(),

    vendedor_nome:
      vendedor.value.trim(),

    projeto:
      projeto.value.trim(),

    previsao_faturamento:
      previsao.value ||
      null,

    destinacao:
      destinacao.value.trim(),

    frete:
      frete.value.trim(),

    regras_comerciais:
      regras.value,

    mostrar_totais_pdf:
      mostrarTotalPdf.checked
  };
}


// ---------------------------------------------------------
// ## 8.2 Conversão dos itens para o banco
// ---------------------------------------------------------

function montarItensBanco() {

  return items

    .filter(
      it =>

        String(
          it.codigo || ''
        ).trim()

        ||

        String(
          it.produto || ''
        ).trim()

        ||

        Number(
          it.quant || 0
        ) > 0

        ||

        Number(
          it.unit || 0
        ) > 0
    )

    .map(
      it => ({

        codigo:
          String(
            it.codigo || ''
          ).trim(),


        produto:
          String(
            it.produto || ''
          ).trim(),


        observacoes:
          String(
            it.detalhes || ''
          ),


        ncm:
          String(
            it.ncm || ''
          ),


        quantidade:
          Number(
            it.quant
          ) || 0,


        unidade:
          it.unidade === 'PCT'
            ? 'PCT'
            : 'UN',


        valor_unitario:
          Number(
            it.unit
          ) || 0,


        desconto_percentual:
          normalizarDescontoPercentual(
            it.desc
          ),


        ipi_percentual:
          Number(
            it.ipi
          ) || 0

      })
    );
}

// =========================================================
// ## 9. SALVAMENTO DA PROPOSTA NO SUPABASE
// =========================================================

async function salvarPropostaNuvem(
  opcoes = {}
) {

  const silencioso =
    Boolean(
      opcoes.silencioso
    );


  const botao =
    document.getElementById(
      'btnSalvarPropostaNuvem'
    );


  const origemEl =
    document.getElementById(
      'origemComercial'
    );


  // -------------------------------------------------------
  // ## 9.1 Validações obrigatórias
  // -------------------------------------------------------

  if (
    !orcamento.value.trim()
  ) {

    toastMsg(
      'Informe o nome da proposta'
    );


    orcamento.focus();


    return false;
  }


  if (
    !cliente.value.trim()
  ) {

    toastMsg(
      'Informe o cliente'
    );


    cliente.focus();


    return false;
  }


  if (
    !timeEquipe.value
  ) {

    toastMsg(
      'Selecione o time'
    );


    timeEquipe.focus();


    return false;
  }


  if (
    !origemEl ||
    !origemEl.value
  ) {

    toastMsg(
      'Selecione a origem da proposta'
    );


    origemEl?.focus();


    return false;
  }


  // -------------------------------------------------------
  // ## 9.2 Montagem dos dados
  // -------------------------------------------------------

  const revisao =
    montarPayloadRevisao();


  const itensBanco =
    montarItensBanco();


  const eraNovaProposta =
    !propostaNuvemAtual.propostaId;


  // -------------------------------------------------------
  // ## 9.3 Estado visual durante o salvamento
  // -------------------------------------------------------

  botao.disabled =
    true;


  const textoOriginal =
    botao.textContent;


  botao.textContent =
    'Salvando...';


  // -------------------------------------------------------
  // ## 9.4 Criação ou atualização no Supabase
  // -------------------------------------------------------

  try {

    let resultado;


    if (
      eraNovaProposta
    ) {

      resultado =
        await criarPropostaR0(
          revisao,
          itensBanco
        );

    } else {

      if (
        propostaNuvemAtual.status !==
        'rascunho'
      ) {

        throw new Error(
          'A revisão atual já foi enviada. ' +
          'Crie uma nova revisão.'
        );

      }


      resultado =
        await salvarRascunhoProposta(
          propostaNuvemAtual.propostaId,
          propostaNuvemAtual.revisaoId,
          revisao,
          itensBanco
        );

    }


    // -----------------------------------------------------
    // ## 9.5 Atualização do vínculo local
    // -----------------------------------------------------

    propostaNuvemAtual = {

      ...propostaNuvemAtual,

      propostaId:
        resultado.proposta_id,

      numero:
        resultado.numero,

      revisaoId:
        resultado.revisao_id,

      numeroRevisao:
        resultado.numero_revisao,

      status:
        resultado.status,

      enviadoEm:
        resultado.enviado_em ||
        null
    };


    // -----------------------------------------------------
    // ## 9.6 Gestão comercial de uma proposta recém-criada
    // -----------------------------------------------------

    if (
      eraNovaProposta
    ) {

      statusComercialAtual = {

        origemComercial:
          resultado.origem_comercial ||
          origemEl.value,

        status:
          resultado.status_comercial ||
          'proposta',

        motivoNaoConquistado:
          null,

        detalheNaoConquistado:
          null,

        atualizadoEm:
          null,

        atualizadoPor:
          null
      };


      const statusEl =
        document.getElementById(
          'statusComercial'
        );


      if (statusEl) {

        statusEl.value =
          statusComercialAtual.status;

      }

    }


    atualizarInterfaceGestaoComercial();

    atualizarInterfaceRevisao();


    rememberSeller();


    persistirRascunhoLocal();


    saveStatus.textContent =
      `Proposta #${propostaNuvemAtual.numero} ` +
      `• R${propostaNuvemAtual.numeroRevisao} ` +
      `• salva no banco`;


    if (
      !silencioso
    ) {

      toastMsg(
        `Proposta #${propostaNuvemAtual.numero} salva`
      );

    }


    console.log(
      'Proposta salva no Supabase:',
      resultado
    );


    return true;

  } catch (erro) {

    console.error(
      'Erro ao salvar proposta no Supabase:',
      erro
    );


    toastMsg(
      'Erro ao salvar proposta'
    );


    alert(
      'Não foi possível salvar a proposta no Supabase.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );


    return false;

  } finally {

    botao.textContent =
      textoOriginal;


    atualizarInterfaceRevisao();

  }
}


// =========================================================
// ## 10. CONTROLE DA REVISÃO
// =========================================================


// ---------------------------------------------------------
// ## 10.1 Bloqueio dos campos de uma revisão enviada
// ---------------------------------------------------------

function atualizarBloqueioCamposRevisao() {

  const bloqueada =
    !revisaoEhEditavel();


  const idsCamposRevisao = [

    'orcamento',
    'orcData',
    'validade',
    'timeEquipe',

    'cliente',
    'comprador',
    'cnpj',
    'ie',
    'telefone',
    'email',
    'endereco',
    'bairro',
    'cidade',

    'cliche',
    'pagamento',
    'vendedor',
    'projeto',
    'previsao',
    'destinacao',
    'frete',
    'regras',

    'mostrarTotalPdf',

    'btnBuscarCnpj',
    'arteInput'
  ];


  idsCamposRevisao.forEach(
    id => {

      const el =
        document.getElementById(
          id
        );


      if (el) {

        el.disabled =
          bloqueada;

      }

    }
  );


  document
    .querySelectorAll(
      '#itemsEditor input, ' +
      '#itemsEditor textarea, ' +
      '#itemsEditor select, ' +
      '#itemsEditor button'
    )
    .forEach(
      el => {

        el.disabled =
          bloqueada;

      }
    );


  document
    .querySelectorAll(
      '[onclick="addItem()"], ' +
      '[onclick="duplicateLast()"], ' +
      '[onclick="removeArts()"]'
    )
    .forEach(
      el => {

        el.disabled =
          bloqueada;

      }
    );
}


// ---------------------------------------------------------
// ## 10.2 Estado visual dos botões da revisão
// ---------------------------------------------------------

function atualizarInterfaceRevisao() {

  const botaoSalvar =
    document.getElementById(
      'btnSalvarPropostaNuvem'
    );


  const botaoEnviar =
    document.getElementById(
      'btnEnviarRevisao'
    );


  const botaoNovaRevisao =
    document.getElementById(
      'btnCriarNovaRevisao'
    );


  const propostaSalva =
    Boolean(
      propostaNuvemAtual.propostaId
    );


  const revisaoSalva =
    Boolean(
      propostaNuvemAtual.revisaoId
    );


  const rascunho =
    propostaNuvemAtual.status ===
    'rascunho';


  const enviada =
    propostaNuvemAtual.status ===
    'enviada';


  // -------------------------------------------------------
  // Salvar proposta
  // -------------------------------------------------------

  if (
    botaoSalvar
  ) {

    botaoSalvar.disabled =
      propostaSalva &&
      !rascunho;

  }


  // -------------------------------------------------------
  // Enviar revisão
  // -------------------------------------------------------

  if (
    botaoEnviar
  ) {

    if (
      !propostaSalva ||
      !revisaoSalva
    ) {

      botaoEnviar.disabled =
        true;


      botaoEnviar.textContent =
        '📤 Enviar revisão';

    } else if (
      rascunho
    ) {

      botaoEnviar.disabled =
        false;


      botaoEnviar.textContent =
        `📤 Enviar R${propostaNuvemAtual.numeroRevisao}`;

    } else if (
      enviada
    ) {

      botaoEnviar.disabled =
        true;


      botaoEnviar.textContent =
        `✅ R${propostaNuvemAtual.numeroRevisao} enviada`;

    } else {

      botaoEnviar.disabled =
        true;

    }

  }


  // -------------------------------------------------------
  // Criar próxima revisão
  // -------------------------------------------------------

  if (
    botaoNovaRevisao
  ) {

    const podeCriar =
      propostaSalva &&
      revisaoSalva &&
      enviada;


    botaoNovaRevisao.hidden =
      !podeCriar;


    botaoNovaRevisao.disabled =
      !podeCriar;


    if (
      podeCriar
    ) {

      const proxima =
        Number(
          propostaNuvemAtual.numeroRevisao
        ) + 1;


      botaoNovaRevisao.textContent =
        `➕ Criar R${proxima}`;

    }

  }


  atualizarBloqueioCamposRevisao();


  if (
    propostaSalva &&
    enviada
  ) {

    saveStatus.textContent =
      `Proposta #${propostaNuvemAtual.numero} ` +
      `• R${propostaNuvemAtual.numeroRevisao} ` +
      `• ENVIADA`;

  }

}


// ---------------------------------------------------------
// ## 10.3 Enviar revisão atual
// ---------------------------------------------------------

async function enviarRevisaoAtual() {

  const botao =
    document.getElementById(
      'btnEnviarRevisao'
    );


  if (
    !propostaNuvemAtual.propostaId ||
    !propostaNuvemAtual.revisaoId
  ) {

    toastMsg(
      'Salve a proposta antes de enviar a revisão'
    );


    return;
  }


  if (
    propostaNuvemAtual.status !==
    'rascunho'
  ) {

    toastMsg(
      `A revisão R${propostaNuvemAtual.numeroRevisao} já foi enviada`
    );


    atualizarInterfaceRevisao();


    return;
  }


  const numeroRevisao =
    propostaNuvemAtual.numeroRevisao;


  const confirmou =
    confirm(
      `Enviar a revisão R${numeroRevisao}?\n\n` +
      'Antes do envio, as alterações atuais serão salvas.\n\n' +
      `Depois do envio, a R${numeroRevisao} ficará bloqueada ` +
      'e não poderá mais ser alterada.'
    );


  if (
    !confirmou
  ) {

    return;
  }


  const salvou =
    await salvarPropostaNuvem({
      silencioso: true
    });


  if (
    !salvou
  ) {

    return;
  }


  if (
    propostaNuvemAtual.status !==
    'rascunho'
  ) {

    atualizarInterfaceRevisao();

    return;
  }


  if (
    botao
  ) {

    botao.disabled =
      true;


    botao.textContent =
      'Enviando...';

  }


  try {

    const resultado =
      await enviarRevisao(

        propostaNuvemAtual.propostaId,

        propostaNuvemAtual.revisaoId
      );


    propostaNuvemAtual = {

      ...propostaNuvemAtual,

      propostaId:
        resultado.proposta_id ||
        propostaNuvemAtual.propostaId,

      numero:
        resultado.numero ??
        propostaNuvemAtual.numero,

      revisaoId:
        resultado.revisao_id ||
        propostaNuvemAtual.revisaoId,

      numeroRevisao:
        resultado.numero_revisao ??
        propostaNuvemAtual.numeroRevisao,

      status:
        resultado.status ||
        'enviada',

      enviadoEm:
        resultado.enviado_em ||
        null
    };


    persistirRascunhoLocal();


    atualizarInterfaceRevisao();


    toastMsg(
      `R${propostaNuvemAtual.numeroRevisao} enviada com sucesso`
    );


    console.log(
      'Revisão enviada:',
      resultado
    );

  } catch (erro) {

    console.error(
      'Erro ao enviar revisão:',
      erro
    );


    toastMsg(
      'Erro ao enviar revisão'
    );


    alert(
      'Não foi possível enviar a revisão.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  } finally {

    atualizarInterfaceRevisao();

  }
}


// ---------------------------------------------------------
// ## 10.4 Criar nova revisão
// ---------------------------------------------------------

async function criarNovaRevisaoAtual() {

  const botao =
    document.getElementById(
      'btnCriarNovaRevisao'
    );


  if (
    !propostaNuvemAtual.propostaId
  ) {

    toastMsg(
      'Proposta não encontrada'
    );


    return;
  }


  if (
    propostaNuvemAtual.status !==
    'enviada'
  ) {

    toastMsg(
      'A revisão atual precisa estar enviada'
    );


    return;
  }


  const atual =
    Number(
      propostaNuvemAtual.numeroRevisao
    );


  const proxima =
    atual + 1;


  const confirmou =
    confirm(
      `Criar a revisão R${proxima}?\n\n` +
      `Os dados e itens da R${atual} serão copiados.\n\n` +
      `A R${atual} continuará enviada e bloqueada. ` +
      `A R${proxima} será criada como rascunho.`
    );


  if (
    !confirmou
  ) {

    return;
  }


  if (
    botao
  ) {

    botao.disabled =
      true;


    botao.textContent =
      `Criando R${proxima}...`;

  }


  try {

    const resultado =
      await criarNovaRevisao(
        propostaNuvemAtual.propostaId
      );


    propostaNuvemAtual = {

      ...propostaNuvemAtual,

      propostaId:
        resultado.proposta_id ||
        propostaNuvemAtual.propostaId,

      numero:
        resultado.numero ??
        propostaNuvemAtual.numero,

      revisaoId:
        resultado.revisao_id,

      numeroRevisao:
        resultado.numero_revisao,

      status:
        resultado.status ||
        'rascunho',

      enviadoEm:
        null
    };


    // Recarrega a proposta completa para abrir exatamente
    // a nova revisão criada pelo banco.
    const propostaAtualizada =
      await obterPropostaCompleta(
        propostaNuvemAtual.propostaId
      );


    aplicarPropostaNoFormulario(
      propostaAtualizada
    );


    atualizarInterfaceRevisao();


    persistirRascunhoLocal();


    saveStatus.textContent =
      `Proposta #${propostaNuvemAtual.numero} ` +
      `• R${propostaNuvemAtual.numeroRevisao} ` +
      `• RASCUNHO`;


    toastMsg(
      `R${propostaNuvemAtual.numeroRevisao} criada com sucesso`
    );


    console.log(
      'Nova revisão criada:',
      resultado
    );

  } catch (erro) {

    console.error(
      'Erro ao criar nova revisão:',
      erro
    );


    toastMsg(
      'Erro ao criar nova revisão'
    );


    alert(
      'Não foi possível criar a nova revisão.\n\n' +
      (
        erro?.message ||
        'Erro desconhecido.'
      )
    );

  } finally {

    atualizarInterfaceRevisao();

  }
}


// Inicializa o estado da revisão.
atualizarInterfaceRevisao();

// =========================================================
// ## 11. GESTÃO COMERCIAL
// =========================================================


// ---------------------------------------------------------
// ## 11.1 Nomes das origens para exibição
// ---------------------------------------------------------

function nomeOrigemComercial(
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


  return nomes[origem] ||
    'Sem origem';
}


// ---------------------------------------------------------
// ## 11.2 Nomes dos status para exibição
// ---------------------------------------------------------

function nomeStatusComercial(
  status
) {

  const nomes = {

    proposta:
      'Proposta',

    andamento:
      'Andamento',

    concluido:
      'Concluído',

    nao_conquistado:
      'Não conquistado'
  };


  return nomes[status] ||
    'Proposta';
}


// ---------------------------------------------------------
// ## 11.3 Controle visual da Gestão Comercial
// ---------------------------------------------------------

function atualizarInterfaceGestaoComercial() {

  const origemEl =
    document.getElementById(
      'origemComercial'
    );


  const statusEl =
    document.getElementById(
      'statusComercial'
    );


  const bloco =
    document.getElementById(
      'blocoNaoConquistado'
    );


  const motivoEl =
    document.getElementById(
      'motivoNaoConquistado'
    );


  const detalheEl =
    document.getElementById(
      'detalheNaoConquistado'
    );


  const botao =
    document.getElementById(
      'btnAtualizarStatusComercial'
    );


  const situacao =
    document.getElementById(
      'statusComercialSituacao'
    );


  const info =
    document.getElementById(
      'statusComercialInfo'
    );


  if (
    !statusEl ||
    !bloco
  ) {

    return;

  }


  const propostaSalva =
    Boolean(
      propostaNuvemAtual.propostaId
    );


  const origemSelecionada =
    origemEl
      ? origemEl.value
      : '';


  statusEl.disabled =
    !propostaSalva;


  if (
    !propostaSalva
  ) {

    statusEl.value =
      'proposta';

  }


  const statusSelecionado =
    statusEl.value ||
    'proposta';


  const naoConquistado =
    statusSelecionado ===
    'nao_conquistado';


  bloco.hidden =
    !naoConquistado;


  bloco.style.display =
    naoConquistado
      ? 'grid'
      : 'none';


  if (botao) {

    botao.disabled =
      !propostaSalva ||
      !origemSelecionada;

  }


  if (situacao) {

    situacao.value =
      propostaSalva
        ? (
            `Proposta #${propostaNuvemAtual.numero} ` +
            `• ${nomeOrigemComercial(
              statusComercialAtual.origemComercial
            )} ` +
            `• ${nomeStatusComercial(
              statusComercialAtual.status
            )}`
          )
        : 'Nova proposta';

  }


  if (info) {

    if (
      !propostaSalva
    ) {

      info.textContent =
        'Selecione a origem e salve a proposta no banco ' +
        'para liberar a gestão comercial. Propostas novas ' +
        'começam automaticamente com o status Proposta.';

    } else {

      info.textContent =
        `Origem atual: ` +
        `${nomeOrigemComercial(
          statusComercialAtual.origemComercial
        )} • ` +
        `Status atual: ` +
        `${nomeStatusComercial(
          statusComercialAtual.status
        )}.`;

    }

  }


  if (motivoEl) {

    motivoEl.required =
      naoConquistado;

  }


  if (detalheEl) {

    detalheEl.required =
      naoConquistado;

  }
}


// ---------------------------------------------------------
// ## 11.4 Mudança da Origem
// ---------------------------------------------------------

function aoAlterarOrigemComercial() {

  atualizarInterfaceGestaoComercial();

}


// ---------------------------------------------------------
// ## 11.5 Mudança do Status Comercial
// ---------------------------------------------------------

function aoAlterarStatusComercial() {

  const statusEl =
    document.getElementById(
      'statusComercial'
    );


  const motivoEl =
    document.getElementById(
      'motivoNaoConquistado'
    );


  const detalheEl =
    document.getElementById(
      'detalheNaoConquistado'
    );


  if (!statusEl) {

    return;

  }


  if (
    statusEl.value !==
    'nao_conquistado'
  ) {

    if (motivoEl) {

      motivoEl.value =
        '';

    }


    if (detalheEl) {

      detalheEl.value =
        '';

    }

  }


  atualizarInterfaceGestaoComercial();
}


// ---------------------------------------------------------
// ## 11.6 Salvar Gestão Comercial
// ---------------------------------------------------------

async function salvarStatusComercial() {

  const origemEl =
    document.getElementById(
      'origemComercial'
    );


  const statusEl =
    document.getElementById(
      'statusComercial'
    );


  const motivoEl =
    document.getElementById(
      'motivoNaoConquistado'
    );


  const detalheEl =
    document.getElementById(
      'detalheNaoConquistado'
    );


  const botao =
    document.getElementById(
      'btnAtualizarStatusComercial'
    );


  // -------------------------------------------------------
  // ## 11.6.1 Validar proposta existente
  // -------------------------------------------------------

  if (
    !propostaNuvemAtual.propostaId
  ) {

    toastMsg(
      'Salve a proposta antes de alterar a gestão comercial'
    );


    return;

  }


  // -------------------------------------------------------
  // ## 11.6.2 Validar origem
  // -------------------------------------------------------

  if (
    !origemEl ||
    !origemEl.value
  ) {

    toastMsg(
      'Selecione a origem da proposta'
    );


    origemEl?.focus();


    return;

  }


  if (
    !statusEl
  ) {

    return;

  }


  const origem =
    origemEl.value;


  const status =
    statusEl.value;


  const motivo =
    motivoEl
      ? motivoEl.value.trim()
      : '';


  const detalhe =
    detalheEl
      ? detalheEl.value.trim()
      : '';


  // -------------------------------------------------------
  // ## 11.6.3 Validar Não Conquistado
  // -------------------------------------------------------

  if (
    status ===
    'nao_conquistado'
  ) {

    if (!motivo) {

      toastMsg(
        'Selecione o motivo da não conquista'
      );


      motivoEl?.focus();


      return;

    }


    if (!detalhe) {

      toastMsg(
        'Informe o detalhamento da não conquista'
      );


      detalheEl?.focus();


      return;

    }

  }


  const textoOriginal =
    botao
      ? botao.textContent
      : 'Atualizar gestão comercial';


  if (botao) {

    botao.disabled =
      true;


    botao.textContent =
      'Atualizando...';

  }


  // -------------------------------------------------------
  // ## 11.6.4 Comunicação com o Supabase
  // -------------------------------------------------------

  try {

    const resultado =
      await atualizarGestaoComercial(

        propostaNuvemAtual.propostaId,

        origem,

        status,

        status === 'nao_conquistado'
          ? motivo
          : null,

        status === 'nao_conquistado'
          ? detalhe
          : null
      );


    // -----------------------------------------------------
    // ## 11.6.5 Atualização do estado local
    // -----------------------------------------------------

    statusComercialAtual = {

      origemComercial:
        resultado.origem_comercial ||
        origem,

      status:
        resultado.status_comercial ||
        status,

      motivoNaoConquistado:
        resultado.motivo_nao_conquistado ||
        null,

      detalheNaoConquistado:
        resultado.detalhe_nao_conquistado ||
        null,

      atualizadoEm:
        resultado.status_atualizado_em ||
        null,

      atualizadoPor:
        resultado.status_atualizado_por ||
        null
    };


    if (
      status !==
      'nao_conquistado'
    ) {

      if (motivoEl) {

        motivoEl.value =
          '';

      }


      if (detalheEl) {

        detalheEl.value =
          '';

      }

    }


    atualizarInterfaceGestaoComercial();


    persistirRascunhoLocal();


    toastMsg(
      'Gestão comercial atualizada'
    );


    console.log(
      'Gestão comercial atualizada:',
      resultado
    );

  } catch (erro) {

    console.error(
      'Erro ao atualizar gestão comercial:',
      erro
    );


    toastMsg(
      'Erro ao atualizar gestão comercial'
    );


    alert(
      'Não foi possível atualizar a gestão comercial.\n\n' +
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


    atualizarInterfaceGestaoComercial();

  }
}


// ---------------------------------------------------------
// ## 11.7 Eventos da Gestão Comercial
// ---------------------------------------------------------

const campoOrigemComercial =
  document.getElementById(
    'origemComercial'
  );


if (
  campoOrigemComercial
) {

  campoOrigemComercial.addEventListener(
    'change',
    aoAlterarOrigemComercial
  );

}


const campoStatusComercial =
  document.getElementById(
    'statusComercial'
  );


if (
  campoStatusComercial
) {

  campoStatusComercial.addEventListener(
    'change',
    aoAlterarStatusComercial
  );

}


atualizarInterfaceGestaoComercial();


// =========================================================
// ## 12. ABERTURA DE PROPOSTA EXISTENTE
// =========================================================

function aplicarPropostaNoFormulario(
  proposta
) {

  if (!proposta) {

    throw new Error(
      'Proposta não informada.'
    );

  }


  // -------------------------------------------------------
  // ## 12.1 Identificação da revisão atual
  // -------------------------------------------------------

  const revisoes =
    Array.isArray(
      proposta.revisoes_proposta
    )
      ? proposta.revisoes_proposta
      : [];


  const revisaoAtual =

    revisoes.find(
      r =>
        Number(
          r.numero_revisao
        ) ===
        Number(
          proposta.revisao_atual
        )
    )

    ||

    [...revisoes]
      .sort(
        (a, b) =>
          Number(
            b.numero_revisao
          ) -
          Number(
            a.numero_revisao
          )
      )[0];


  if (!revisaoAtual) {

    throw new Error(
      'A proposta não possui revisão cadastrada.'
    );

  }


  // -------------------------------------------------------
  // ## 12.2 Função auxiliar para preencher campos
  // -------------------------------------------------------

  const definir =
    (
      id,
      valor
    ) => {

      const el =
        document.getElementById(
          id
        );


      if (!el) {

        return;

      }


      if (
        el.type === 'checkbox'
      ) {

        el.checked =
          Boolean(valor);

      } else {

        el.value =
          valor ?? '';

      }
    };


  // -------------------------------------------------------
  // ## 12.3 Identificação da proposta
  // -------------------------------------------------------

  definir(
    'orcamento',
    revisaoAtual.nome_proposta
  );


  definir(
    'orcData',
    revisaoAtual.data_proposta
  );


  definir(
    'validade',
    revisaoAtual.validade ||
    '7 DIAS'
  );


  definir(
    'timeEquipe',
    revisaoAtual.time_equipe ||
    ''
  );


  // -------------------------------------------------------
  // ## 12.4 Dados do cliente
  // -------------------------------------------------------

  definir(
    'cliente',
    revisaoAtual.cliente
  );


  definir(
    'comprador',
    revisaoAtual.comprador
  );


  definir(
    'cnpj',
    revisaoAtual.cnpj
  );


  definir(
    'ie',
    revisaoAtual.inscricao_estadual
  );


  definir(
    'telefone',
    revisaoAtual.telefone
  );


  definir(
    'email',
    revisaoAtual.email
  );


  definir(
    'endereco',
    revisaoAtual.endereco
  );


  definir(
    'bairro',
    revisaoAtual.bairro
  );


  definir(
    'cidade',
    revisaoAtual.cidade_uf_cep
  );


  // -------------------------------------------------------
  // ## 12.5 Condições comerciais da revisão
  // -------------------------------------------------------

  definir(
    'cliche',
    revisaoAtual.cliche ||
    'A CALCULAR'
  );


  definir(
    'pagamento',
    revisaoAtual.forma_pagamento
  );


  definir(
    'vendedor',
    revisaoAtual.vendedor_nome
  );


  definir(
    'projeto',
    revisaoAtual.projeto
  );


  definir(
    'previsao',
    revisaoAtual.previsao_faturamento ||
    ''
  );


  definir(
    'destinacao',
    revisaoAtual.destinacao
  );


  definir(
    'frete',
    revisaoAtual.frete
  );


  definir(
    'regras',
    revisaoAtual.regras_comerciais
  );


  definir(
    'mostrarTotalPdf',
    revisaoAtual.mostrar_totais_pdf
  );


  // -------------------------------------------------------
  // ## 12.6 Gestão comercial da proposta
  // -------------------------------------------------------

  statusComercialAtual = {

    origemComercial:
      proposta.origem_comercial ||
      null,

    status:
      proposta.status_comercial ||
      'proposta',

    motivoNaoConquistado:
      proposta.motivo_nao_conquistado ||
      null,

    detalheNaoConquistado:
      proposta.detalhe_nao_conquistado ||
      null,

    atualizadoEm:
      proposta.status_atualizado_em ||
      null,

    atualizadoPor:
      proposta.status_atualizado_por ||
      null
  };


  definir(
    'origemComercial',
    statusComercialAtual
      .origemComercial ||
    ''
  );


  definir(
    'statusComercial',
    statusComercialAtual.status
  );


  definir(
    'motivoNaoConquistado',
    statusComercialAtual
      .motivoNaoConquistado ||
    ''
  );


  definir(
    'detalheNaoConquistado',
    statusComercialAtual
      .detalheNaoConquistado ||
    ''
  );


// -------------------------------------------------------
// ## 12.7 Conversão dos itens vindos do banco
// -------------------------------------------------------

const itensBanco =
  Array.isArray(
    revisaoAtual.itens_revisao
  )
    ? revisaoAtual.itens_revisao
    : [];


items =
  itensBanco

    .sort(
      (a, b) =>
        Number(
          a.ordem || 0
        ) -
        Number(
          b.ordem || 0
        )
    )

    .map(
      it => ({

        codigo:
          it.codigo ||
          '',

        produto:
          it.produto ||
          '',

        detalhes:
          it.observacoes ||
          '',

        ncm:
          it.ncm ||
          '',

        quant:
          Number(
            it.quantidade
          ) || 0,

        unidade:
          it.unidade ||
          'UN',

        unit:
          Number(
            it.valor_unitario
          ) || 0,

        desc:
          Number(
            it.desconto_percentual
          ) || 0,

        ipi:
          Number(
            it.ipi_percentual
          ) || 0

      })
    );


if (!items.length) {

  items = [
    {
      codigo: '',
      produto: '',
      detalhes: '',
      ncm: '',
      quant: 0,
      unidade: 'UN',
      unit: 0,
      desc: 0,
      ipi: 9.75
    }
  ];

}

  // -------------------------------------------------------
  // ## 12.8 Limpeza das artes temporárias
  // -------------------------------------------------------

  arts =
    [];


  if (
    typeof arteInput !== 'undefined' &&
    arteInput
  ) {

    arteInput.value =
      '';

  }


  // -------------------------------------------------------
  // ## 12.9 Atualização do vínculo com o Supabase
  // -------------------------------------------------------

  propostaNuvemAtual = {

    propostaId:
      proposta.id,

    numero:
      proposta.numero,

    revisaoId:
      revisaoAtual.id,

    numeroRevisao:
      revisaoAtual.numero_revisao,

    status:
      revisaoAtual.status,

    enviadoEm:
      revisaoAtual.enviado_em ||
      null
  };


  // -------------------------------------------------------
  // ## 12.10 Atualização final da interface
  // -------------------------------------------------------

  atualizarInterfaceGestaoComercial();

  atualizarInterfaceRevisao();


  rememberSeller();


  renderItems();


  renderArts();


  updateTeamLogo();


  refresh();

  atualizarInterfaceRevisao();


  persistirRascunhoLocal();


  saveStatus.textContent =
    `Proposta #${proposta.numero} ` +
    `• R${revisaoAtual.numero_revisao} ` +
    `• ${String(revisaoAtual.status).toUpperCase()}`;


  return revisaoAtual;
}


// =========================================================
// ## 13. PDF E COMPARTILHAMENTO
// =========================================================


// ---------------------------------------------------------
// ## 13.1 Impressão / geração do PDF
// ---------------------------------------------------------

function printPDF() {

  if (
    !timeEquipe.value
  ) {

    toastMsg(
      'Selecione o time antes de gerar o PDF'
    );


    timeEquipe.focus();


    return;
  }


  rememberSeller();


  refresh();


  window.print();
}


// ---------------------------------------------------------
// ## 13.2 Copiar resumo da proposta
// ---------------------------------------------------------

async function copySummary() {

  rememberSeller();


  const t =
    totals();


  const lines =
    items
      .map(
        it =>
          `${it.produto} | ` +
          `${N2.format(it.quant)} ${it.unidade} | ` +
          `${BRL.format(calcItem(it).total)}`
      )
      .join('\n');


  const txt =
    `PROPOSTA AGENFLEX\n` +
    `Proposta: ${orcamento.value}\n` +
    `Cliente: ${cliente.value}\n` +
    `Comprador: ${comprador.value}\n\n` +
    `${lines}\n\n` +
    `Clichê: ${cliche.value}\n` +
    `Total: ${BRL.format(t.total)}\n` +
    `Pagamento: ${pagamento.value}\n` +
    `Vendedor: ${vendedor.value}`;


  try {

    await navigator.clipboard.writeText(
      txt
    );


    toastMsg(
      'Resumo copiado'
    );

  } catch (e) {

    toastMsg(
      'Não foi possível copiar'
    );

  }
}


// =========================================================
// ## 14. CONSULTA DE CNPJ
// =========================================================


// ---------------------------------------------------------
// ## 14.1 Status visual da consulta
// ---------------------------------------------------------

function definirStatusConsultaCnpj(
  mensagem = '',
  tipo = ''
) {

  const status =
    document.getElementById(
      'cnpjConsultaStatus'
    );


  if (!status) {

    return;

  }


  status.textContent =
    mensagem;


  status.className =
    'cnpj-consulta-status';


  if (tipo) {

    status.classList.add(
      tipo
    );

  }
}


// ---------------------------------------------------------
// ## 14.2 Formatação do CEP
// ---------------------------------------------------------

function formatarCepConsulta(
  valor
) {

  const cep =
    String(
      valor || ''
    )
      .replace(
        /\D/g,
        ''
      );


  if (
    cep.length !== 8
  ) {

    return valor || '';

  }


  return cep.replace(
    /^(\d{5})(\d{3})$/,
    '$1-$2'
  );
}


// ---------------------------------------------------------
// ## 14.3 Montagem do endereço
// ---------------------------------------------------------

function montarEnderecoEmpresa(
  empresa
) {

  const partes =
    [];


  if (
    empresa.logradouro
  ) {

    partes.push(
      empresa.logradouro
    );

  }


  if (
    empresa.numero
  ) {

    partes.push(
      empresa.numero
    );

  }


  let endereco =
    partes.join(', ');


  if (
    empresa.complemento
  ) {

    endereco +=
      endereco
        ? ` - ${empresa.complemento}`
        : empresa.complemento;

  }


  return endereco;
}


// ---------------------------------------------------------
// ## 14.4 Montagem de cidade, UF e CEP
// ---------------------------------------------------------

function montarCidadeEmpresa(
  empresa
) {

  const cidadeUf = [

    empresa.cidade,

    empresa.uf

  ]
    .filter(Boolean)
    .join(' - ');


  const cep =
    formatarCepConsulta(
      empresa.cep
    );


  if (
    cidadeUf &&
    cep
  ) {

    return `${cidadeUf} - CEP: ${cep}`;

  }


  if (cidadeUf) {

    return cidadeUf;

  }


  if (cep) {

    return `CEP: ${cep}`;

  }


  return '';
}


// ---------------------------------------------------------
// ## 14.5 Preenchimento automático do formulário
// ---------------------------------------------------------

function preencherDadosEmpresa(
  empresa
) {

  if (
    empresa.cnpj
  ) {

    document
      .getElementById('cnpj')
      .value =
        empresa.cnpj;

  }


  if (
    empresa.razaoSocial
  ) {

    document
      .getElementById('cliente')
      .value =
        empresa.razaoSocial;

  }


  if (
    empresa.nomeFantasia
  ) {

    document
      .getElementById('orcamento')
      .value =
        empresa.nomeFantasia;

  }


  if (
    empresa.telefone
  ) {

    document
      .getElementById('telefone')
      .value =
        empresa.telefone;

  }


  if (
    empresa.email
  ) {

    document
      .getElementById('email')
      .value =
        empresa.email;

  }


  const endereco =
    montarEnderecoEmpresa(
      empresa
    );


  if (endereco) {

    document
      .getElementById('endereco')
      .value =
        endereco;

  }


  if (
    empresa.bairro
  ) {

    document
      .getElementById('bairro')
      .value =
        empresa.bairro;

  }


  const cidade =
    montarCidadeEmpresa(
      empresa
    );


  if (cidade) {

    document
      .getElementById('cidade')
      .value =
        cidade;

  }


  if (
    typeof refresh === 'function'
  ) {

    refresh();

  }
}


// ---------------------------------------------------------
// ## 14.6 Consulta e preenchimento
// ---------------------------------------------------------

async function buscarCnpjEPreencher() {

  if (
    !revisaoEhEditavel()
  ) {

    toastMsg(
      'A revisão enviada não pode ser alterada'
    );

    return;
  }


  const campoCnpj =
    document.getElementById(
      'cnpj'
    );


  const botao =
    document.getElementById(
      'btnBuscarCnpj'
    );


  if (
    !campoCnpj ||
    !botao
  ) {

    return;

  }


  const cnpj =
    campoCnpj.value.trim();


  if (!cnpj) {

    definirStatusConsultaCnpj(
      'Informe um CNPJ.',
      'error'
    );


    campoCnpj.focus();


    return;
  }


  const textoOriginal =
    botao.textContent;


  botao.disabled =
    true;


  botao.textContent =
    'Buscando...';


  definirStatusConsultaCnpj(
    'Consultando dados da empresa...',
    'loading'
  );


  try {

    const empresa =
      await consultarCnpj(
        cnpj
      );


    preencherDadosEmpresa(
      empresa
    );


    definirStatusConsultaCnpj(

      empresa.situacao

        ? (
            `✓ Empresa localizada ` +
            `• ${empresa.situacao}`
          )

        : '✓ Empresa localizada',

      'success'
    );


    toastMsg(
      'Dados da empresa preenchidos'
    );


    console.log(
      'Empresa consultada:',
      empresa
    );

  } catch (erro) {

    console.error(
      'Erro na consulta de CNPJ:',
      erro
    );


    definirStatusConsultaCnpj(
      erro.message ||
      'Não foi possível consultar o CNPJ.',
      'error'
    );

  } finally {

    botao.disabled =
      false;


    botao.textContent =
      textoOriginal;


    atualizarBloqueioCamposRevisao();

  }
}


// =========================================================
// ## 15. EVENTOS DA CONSULTA DE CNPJ
// =========================================================


// ---------------------------------------------------------
// ## 15.1 Consulta ao pressionar Enter
// ---------------------------------------------------------

const campoCnpjConsulta =
  document.getElementById(
    'cnpj'
  );


if (
  campoCnpjConsulta
) {

  campoCnpjConsulta.addEventListener(
    'keydown',
    function(event) {

      if (
        event.key === 'Enter'
      ) {

        event.preventDefault();


        buscarCnpjEPreencher();

      }

    }
  );

}


// =========================================================
// ## 16. MÁSCARA VISUAL DO CNPJ
// =========================================================


// ---------------------------------------------------------
// ## 16.1 Aplicação progressiva da máscara
// ---------------------------------------------------------

function aplicarMascaraCnpj(
  valor
) {

  let numeros =
    String(
      valor || ''
    )
      .replace(
        /\D/g,
        ''
      )
      .slice(
        0,
        14
      );


  if (
    numeros.length <= 2
  ) {

    return numeros;

  }


  if (
    numeros.length <= 5
  ) {

    return numeros.replace(
      /^(\d{2})(\d+)/,
      '$1.$2'
    );

  }


  if (
    numeros.length <= 8
  ) {

    return numeros.replace(
      /^(\d{2})(\d{3})(\d+)/,
      '$1.$2.$3'
    );

  }


  if (
    numeros.length <= 12
  ) {

    return numeros.replace(
      /^(\d{2})(\d{3})(\d{3})(\d+)/,
      '$1.$2.$3/$4'
    );

  }


  return numeros.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/,
    '$1.$2.$3/$4-$5'
  );
}


// ---------------------------------------------------------
// ## 16.2 Evento de digitação no campo
// ---------------------------------------------------------

const campoCnpjMascara =
  document.getElementById(
    'cnpj'
  );


if (
  campoCnpjMascara
) {

  campoCnpjMascara.addEventListener(
    'input',
    function() {

      const posicaoFinal =
        this.selectionStart;


      const antes =
        this.value;


      this.value =
        aplicarMascaraCnpj(
          this.value
        );


      if (
        posicaoFinal ===
        antes.length
      ) {

        this.setSelectionRange(
          this.value.length,
          this.value.length
        );

      }

    }
  );

}