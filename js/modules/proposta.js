// Central Comercial Agenflex — Propostas
// Itens, PDF, artes temporárias, vendedor e rascunho local.

let items=[{codigo:'',produto:'',detalhes:'',ncm:'',quant:0,unidade:'UN',unit:0,ipi:9.75}];

let propostaNuvemAtual={
  propostaId:null,
  numero:null,
  revisaoId:null,
  numeroRevisao:0,
  status:'rascunho'
};
function calcItem(it){const subtotal=(+it.quant||0)*(+it.unit||0);const ipi=subtotal*(+it.ipi||0)/100;return{subtotal,ipi,total:subtotal+ipi,unitImp:(+it.quant||0)?(subtotal+ipi)/(+it.quant):0}}
function addItem(base={codigo:'',produto:'',detalhes:'',ncm:'',quant:0,unidade:'UN',unit:0,ipi:9.75}){items.push({...base});renderItems()}
function duplicateLast(){addItem(items[items.length-1]||{})}
function deleteItem(i){items.splice(i,1);if(!items.length)items.push({codigo:'',produto:'',detalhes:'',ncm:'',quant:0,unidade:'UN',unit:0,ipi:9.75});renderItems()}
function upd(i,k,v){if(['quant','unit','ipi'].includes(k))v=Number(v)||0;items[i][k]=v;refresh()}
function ncmSelect(it,i){return `<select onchange="upd(${i},'ncm',this.value)"><option value="" ${!it.ncm?'selected':''}>Selecionar NCM</option><optgroup label="NCM PLÁSTICO"><option value="3923.29.10 - 39" ${it.ncm==='3923.29.10 - 39'?'selected':''}>3923.29.10 - 39</option></optgroup><optgroup label="NCM PAPEL"><option value="4819.40.00" ${it.ncm==='4819.40.00'?'selected':''}>4819.40.00</option></optgroup></select>`}
function unitSelect(it,i){return `<select onchange="upd(${i},'unidade',this.value)"><option value="UN" ${it.unidade==='UN'?'selected':''}>UN</option><option value="PCT" ${it.unidade==='PCT'?'selected':''}>PCT</option></select>`}
function renderItems(){
  itemsEditor.innerHTML='';
  items.forEach((it,i)=>{
    const tr=document.createElement('tr'),c=calcItem(it);
    tr.innerHTML=`<td><input value="${esc(it.codigo)}" oninput="upd(${i},'codigo',this.value)"></td>
      <td><input value="${esc(it.produto)}" placeholder="Produto" oninput="upd(${i},'produto',this.value)"><textarea placeholder="Observações do item" oninput="upd(${i},'detalhes',this.value)">${esc(it.detalhes)}</textarea></td>
      <td>${ncmSelect(it,i)}</td>
      <td><input type="number" value="${it.quant}" oninput="upd(${i},'quant',this.value)"></td>
      <td>${unitSelect(it,i)}</td>
      <td><input type="number" step="0.0001" value="${it.unit}" oninput="upd(${i},'unit',this.value)"></td>
      <td><input type="number" step="0.01" value="${it.ipi}" oninput="upd(${i},'ipi',this.value)"></td>
      <td>${BRL.format(c.total)}</td>
      <td><button class="del" onclick="deleteItem(${i})">×</button></td>`;
    itemsEditor.appendChild(tr);
  });
  refresh();
}
function totals(){return items.reduce((a,it)=>{const c=calcItem(it);a.sub+=c.subtotal;a.ipi+=c.ipi;a.total+=c.total;return a},{sub:0,ipi:0,total:0})}
function updateTeamLogo(){
  const team=timeEquipe.value||'revenda';pdfLogo.src=teamLogos[team]||teamLogos.revenda;
  pdfLogo.classList.remove('logo-revenda','logo-pharma','logo-food');pdfLogo.classList.add('logo-'+team);
}
function refresh(){
  updateTeamLogo();
  const t=totals();
  mSubtotal.textContent=BRL.format(t.sub);mIpi.textContent=BRL.format(t.ipi);mTotal.textContent=BRL.format(t.total);
  pOrcamento.textContent=orcamento.value||'—';pCliente.textContent=(cliente.value||'').toUpperCase();pComprador.textContent=comprador.value;
  pCnpj.textContent=cnpj.value;pIe.textContent=ie.value;pTelefone.textContent=telefone.value;pEmail.textContent=email.value;pEndereco.textContent=endereco.value;pBairro.textContent=bairro.value;pCidade.textContent=cidade.value;
  pSubtotal.textContent=N2.format(t.sub);pIpi.textContent=N2.format(t.ipi);pTotal.textContent=N2.format(t.total);
  const mostrarTotais = mostrarTotalPdf.checked;
  pSubtotalRow.style.display = mostrarTotais ? 'table-row' : 'none';
  pIpiRow.style.display = mostrarTotais ? 'table-row' : 'none';
  pTotalRow.style.display = mostrarTotais ? 'table-row' : 'none';
  pIncluido.textContent=brDate(orcData.value)+' às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  pPrevisao.textContent=brDate(previsao.value);pVendedor.textContent=(vendedor.value||'').toUpperCase();pProjeto.textContent=projeto.value;
  pFrete.textContent=frete.value.replace(/^FRETE COBRADO DO CLIENTE:\s*/i,'');pValidade.textContent=validade.value;pCliche.textContent=cliche.value;pPagamento.textContent=pagamento.value;pDestinacao.textContent=(destinacao.value||'').toUpperCase();pRegras.textContent=regras.value;
  pGerado.textContent=new Date().toLocaleDateString('pt-BR')+' às '+new Date().toLocaleTimeString('pt-BR');pGeradoPor.textContent=vendedor.value;
  pdfRows.innerHTML='';
  items.forEach(it=>{const c=calcItem(it),tr=document.createElement('tr');tr.innerHTML=`<td>${esc((it.codigo?it.codigo+' - ':'')+it.produto)}${it.detalhes?'<div class="item-notes">'+esc(it.detalhes).replace(/\n/g,'<br>')+'</div>':''}</td><td>${esc(it.ncm)}</td><td>${N2.format(it.quant)} ${esc(it.unidade)}</td><td>${N4.format(it.unit)}</td><td>${N2.format(c.ipi)}${it.ipi?'<div>('+String(it.ipi).replace('.',',')+'%)</div>':''}</td><td>${N4.format(c.unitImp)}</td><td>${N2.format(c.total)}</td>`;pdfRows.appendChild(tr)});
  renderArts();
  saveStatus.textContent=propostaNuvemAtual.propostaId
    ? `Proposta #${propostaNuvemAtual.numero} • R${propostaNuvemAtual.numeroRevisao} • alterações não salvas`
    : 'Alterações não salvas';
}

let arts=[];
function addArtFiles(fileList){
  const files=[...fileList].filter(file=>file.type.startsWith('image/')||file.type==='application/pdf');
  if(!files.length)return;
  let pending=files.length,added=0;
  files.forEach(file=>{
    const r=new FileReader();
    r.onload=()=>{
      arts.push({name:file.name,type:file.type,data:r.result});added++;
      if(--pending===0){renderArts();arteInput.value='';toastMsg(added+' arte(s) adicionada(s)')}
    };
    r.onerror=()=>{if(--pending===0)renderArts()};
    r.readAsDataURL(file);
  });
}
arteInput.addEventListener('change',e=>addArtFiles(e.target.files));
function removeArt(idx){arts.splice(idx,1);renderArts();toastMsg('Arte removida')}
function removeArts(){arts=[];arteInput.value='';renderArts();toastMsg('Artes removidas')}
const artDropZone=document.getElementById('artDropZone');
['dragenter','dragover'].forEach(evt=>artDropZone.addEventListener(evt,e=>{e.preventDefault();e.stopPropagation();artDropZone.style.borderColor='#e30613';artDropZone.style.background='#fff5f5'}));
['dragleave','drop'].forEach(evt=>artDropZone.addEventListener(evt,e=>{e.preventDefault();e.stopPropagation();artDropZone.style.borderColor='';artDropZone.style.background=''}));
artDropZone.addEventListener('drop',e=>addArtFiles(e.dataTransfer.files));
function renderArts(){
  artThumbs.innerHTML='';
  artPages.innerHTML='';
  pagesLabel.textContent=arts.length ? 'Paginação automática • '+arts.length+' arte(s)' : 'Paginação automática';

  arts.forEach((art,idx)=>{
    const th=document.createElement('div');
    th.className='thumb';
    th.style.position='relative';
    if(art.type.startsWith('image/')) th.innerHTML=`<img src="${art.data}" alt="${esc(art.name)}">`;
    else th.innerHTML=`<span>PDF: ${esc(art.name)}</span>`;
    const del=document.createElement('button');
    del.type='button';del.textContent='×';del.title='Remover esta arte';
    del.style.cssText='position:absolute;top:3px;right:3px;width:24px;height:24px;border:0;border-radius:50%;background:#e30613;color:#fff;font-weight:900;cursor:pointer;line-height:24px;padding:0';
    del.onclick=()=>removeArt(idx);th.appendChild(del);
    artThumbs.appendChild(th);

    const page=document.createElement('div');
    page.className='pdf-page art-page '+(idx===0?'first-art':'subsequent-art');

    let content=art.type.startsWith('image/')
      ? `<div class="art-frame"><img src="${art.data}"></div>`
      : `<div class="art-frame"><div><b>Arquivo PDF anexado:</b><br>${esc(art.name)}<br><br>O navegador pode não incorporar visualmente o PDF anexado nesta impressão.</div></div>`;

    page.innerHTML=`<h2>Arte anexada pelo cliente</h2>
      <div class="art-sub">Proposta: ${esc(orcamento.value)} • ${esc(cliente.value)}</div>
      ${content}
      <div class="generated">Anexo de arte • Agenflex</div>`;

    artPages.appendChild(page);
  });
}

/* Vendedores recentes */
function recentSellers(){try{return JSON.parse(localStorage.getItem('agenflex_vendedores_recentes')||'[]')}catch(e){return[]}}
function renderSellers(){vendedoresRecentes.innerHTML='';recentSellers().forEach(n=>{const op=document.createElement('option');op.value=n;vendedoresRecentes.appendChild(op)})}
function rememberSeller(){const n=vendedor.value.trim();if(!n)return;let a=recentSellers().filter(x=>x.toLowerCase()!==n.toLowerCase());a.unshift(n);localStorage.setItem('agenflex_vendedores_recentes',JSON.stringify(a.slice(0,8)));renderSellers()}

/* Draft local + vínculo com a proposta salva no Supabase */
function collectFields(){return{
  orcamento:orcamento.value,orcData:orcData.value,validade:validade.value,timeEquipe:timeEquipe.value,
  cliente:cliente.value,comprador:comprador.value,cnpj:cnpj.value,ie:ie.value,telefone:telefone.value,email:email.value,endereco:endereco.value,bairro:bairro.value,cidade:cidade.value,
  cliche:cliche.value,pagamento:pagamento.value,vendedor:vendedor.value,projeto:projeto.value,previsao:previsao.value,destinacao:destinacao.value,frete:frete.value,regras:regras.value,
  mostrarTotalPdf:mostrarTotalPdf.checked
}}

function persistirRascunhoLocal(){
  localStorage.setItem(KEY,JSON.stringify({
    fields:collectFields(),
    items,
    propostaNuvemAtual
  }));
}

function saveDraft(){
  rememberSeller();
  persistirRascunhoLocal();
  saveStatus.textContent='Rascunho salvo neste navegador';
  toastMsg('Rascunho salvo no navegador');
}

function loadDraft(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return;

    const d=JSON.parse(raw);

    Object.entries(d.fields||{}).forEach(([id,v])=>{
      const el=document.getElementById(id);
      if(!el)return;
      if(id==='mostrarTotalPdf')el.checked=Boolean(v);
      else el.value=v;
    });

    if(Array.isArray(d.items)&&d.items.length)items=d.items;

    if(d.propostaNuvemAtual){
      propostaNuvemAtual={
        ...propostaNuvemAtual,
        ...d.propostaNuvemAtual
      };
    }
  }catch(e){
    console.warn('Não foi possível restaurar o rascunho local.',e);
  }
}

function clearForm(){
  if(!confirm('Limpar o orçamento atual?'))return;
  localStorage.removeItem(KEY);
  location.reload();
}

function montarPayloadRevisao(){
  return {
    nome_proposta: orcamento.value.trim(),
    data_proposta: orcData.value || isoToday(),
    validade: validade.value,
    time_equipe: timeEquipe.value || null,

    cliente: cliente.value.trim(),
    comprador: comprador.value.trim(),
    cnpj: cnpj.value.trim(),
    inscricao_estadual: ie.value.trim(),
    telefone: telefone.value.trim(),
    email: email.value.trim(),
    endereco: endereco.value.trim(),
    bairro: bairro.value.trim(),
    cidade_uf_cep: cidade.value.trim(),

    cliche: cliche.value.trim() || 'A CALCULAR',
    forma_pagamento: pagamento.value.trim(),
    vendedor_nome: vendedor.value.trim(),
    projeto: projeto.value.trim(),
    previsao_faturamento: previsao.value || null,
    destinacao: destinacao.value.trim(),
    frete: frete.value.trim(),
    regras_comerciais: regras.value,
    mostrar_totais_pdf: mostrarTotalPdf.checked
  };
}

function montarItensBanco(){
  return items
    .filter(it=>
      String(it.codigo||'').trim() ||
      String(it.produto||'').trim() ||
      Number(it.quant||0)>0 ||
      Number(it.unit||0)>0
    )
    .map(it=>({
      codigo:String(it.codigo||'').trim(),
      produto:String(it.produto||'').trim(),
      observacoes:String(it.detalhes||''),
      ncm:String(it.ncm||''),
      quantidade:Number(it.quant)||0,
      unidade:it.unidade==='PCT'?'PCT':'UN',
      valor_unitario:Number(it.unit)||0,
      ipi_percentual:Number(it.ipi)||0
    }));
}

async function salvarPropostaNuvem(){
  const botao=document.getElementById('btnSalvarPropostaNuvem');

  if(!orcamento.value.trim()){
    toastMsg('Informe o nome da proposta');
    orcamento.focus();
    return;
  }

  if(!cliente.value.trim()){
    toastMsg('Informe o cliente');
    cliente.focus();
    return;
  }

  if(!timeEquipe.value){
    toastMsg('Selecione o time');
    timeEquipe.focus();
    return;
  }

  const revisao=montarPayloadRevisao();
  const itensBanco=montarItensBanco();

  botao.disabled=true;
  const textoOriginal=botao.textContent;
  botao.textContent='Salvando...';

  try{
    let resultado;

    if(!propostaNuvemAtual.propostaId){
      resultado=await criarPropostaR0(revisao,itensBanco);
    }else{
      if(propostaNuvemAtual.status!=='rascunho'){
        throw new Error('A revisão atual já foi enviada. Crie uma nova revisão.');
      }

      resultado=await salvarRascunhoProposta(
        propostaNuvemAtual.propostaId,
        propostaNuvemAtual.revisaoId,
        revisao,
        itensBanco
      );
    }

    propostaNuvemAtual={
      propostaId:resultado.proposta_id,
      numero:resultado.numero,
      revisaoId:resultado.revisao_id,
      numeroRevisao:resultado.numero_revisao,
      status:resultado.status
    };

    rememberSeller();
    persistirRascunhoLocal();

    saveStatus.textContent=
      `Proposta #${propostaNuvemAtual.numero} • R${propostaNuvemAtual.numeroRevisao} • salva no banco`;

    toastMsg(`Proposta #${propostaNuvemAtual.numero} salva`);

    console.log('Proposta salva no Supabase:',resultado);

  }catch(erro){
    console.error('Erro ao salvar proposta no Supabase:',erro);
    toastMsg('Erro ao salvar proposta');
    alert(
      'Não foi possível salvar a proposta no Supabase.\n\n' +
      (erro?.message || 'Erro desconhecido.')
    );
  }finally{
    botao.disabled=false;
    botao.textContent=textoOriginal;
  }
}


function aplicarPropostaNoFormulario(proposta){
  if(!proposta) throw new Error('Proposta não informada.');

  const revisoes=Array.isArray(proposta.revisoes_proposta)
    ? proposta.revisoes_proposta
    : [];

  const revisaoAtual=
    revisoes.find(r=>Number(r.numero_revisao)===Number(proposta.revisao_atual))
    || [...revisoes].sort((a,b)=>Number(b.numero_revisao)-Number(a.numero_revisao))[0];

  if(!revisaoAtual){
    throw new Error('A proposta não possui revisão cadastrada.');
  }

  const definir=(id,valor)=>{
    const el=document.getElementById(id);
    if(!el)return;

    if(el.type==='checkbox') el.checked=Boolean(valor);
    else el.value=valor ?? '';
  };

  definir('orcamento',revisaoAtual.nome_proposta);
  definir('orcData',revisaoAtual.data_proposta);
  definir('validade',revisaoAtual.validade || '7 DIAS');
  definir('timeEquipe',revisaoAtual.time_equipe || '');

  definir('cliente',revisaoAtual.cliente);
  definir('comprador',revisaoAtual.comprador);
  definir('cnpj',revisaoAtual.cnpj);
  definir('ie',revisaoAtual.inscricao_estadual);
  definir('telefone',revisaoAtual.telefone);
  definir('email',revisaoAtual.email);
  definir('endereco',revisaoAtual.endereco);
  definir('bairro',revisaoAtual.bairro);
  definir('cidade',revisaoAtual.cidade_uf_cep);

  definir('cliche',revisaoAtual.cliche || 'A CALCULAR');
  definir('pagamento',revisaoAtual.forma_pagamento);
  definir('vendedor',revisaoAtual.vendedor_nome);
  definir('projeto',revisaoAtual.projeto);
  definir('previsao',revisaoAtual.previsao_faturamento || '');
  definir('destinacao',revisaoAtual.destinacao);
  definir('frete',revisaoAtual.frete);
  definir('regras',revisaoAtual.regras_comerciais);
  definir('mostrarTotalPdf',revisaoAtual.mostrar_totais_pdf);

  const itensBanco=Array.isArray(revisaoAtual.itens_revisao)
    ? revisaoAtual.itens_revisao
    : [];

  items=itensBanco
    .sort((a,b)=>Number(a.ordem||0)-Number(b.ordem||0))
    .map(it=>({
      codigo:it.codigo || '',
      produto:it.produto || '',
      detalhes:it.observacoes || '',
      ncm:it.ncm || '',
      quant:Number(it.quantidade)||0,
      unidade:it.unidade || 'UN',
      unit:Number(it.valor_unitario)||0,
      ipi:Number(it.ipi_percentual)||0
    }));

  if(!items.length){
    items=[{
      codigo:'',
      produto:'',
      detalhes:'',
      ncm:'',
      quant:0,
      unidade:'UN',
      unit:0,
      ipi:9.75
    }];
  }

  // As artes não ficam no banco.
  arts=[];
  if(typeof arteInput!=='undefined' && arteInput) arteInput.value='';

  propostaNuvemAtual={
    propostaId:proposta.id,
    numero:proposta.numero,
    revisaoId:revisaoAtual.id,
    numeroRevisao:revisaoAtual.numero_revisao,
    status:revisaoAtual.status
  };

  rememberSeller();
  renderItems();
  renderArts();
  updateTeamLogo();
  refresh();
  persistirRascunhoLocal();

  saveStatus.textContent=
    `Proposta #${proposta.numero} • R${revisaoAtual.numero_revisao} • ${String(revisaoAtual.status).toUpperCase()}`;

  return revisaoAtual;
}

function printPDF(){if(!timeEquipe.value){toastMsg('Selecione o time antes de gerar o PDF');timeEquipe.focus();return}rememberSeller();refresh();window.print()}
async function copySummary(){rememberSeller();const t=totals();const lines=items.map(it=>`${it.produto} | ${N2.format(it.quant)} ${it.unidade} | ${BRL.format(calcItem(it).total)}`).join('\n');const txt=`PROPOSTA AGENFLEX\nProposta: ${orcamento.value}\nCliente: ${cliente.value}\nComprador: ${comprador.value}\n\n${lines}\n\nClichê: ${cliche.value}\nTotal: ${BRL.format(t.total)}\nPagamento: ${pagamento.value}\nVendedor: ${vendedor.value}`;try{await navigator.clipboard.writeText(txt);toastMsg('Resumo copiado')}catch(e){toastMsg('Não foi possível copiar')}}

// =========================================================
// CONSULTA DE CNPJ
// =========================================================

function definirStatusConsultaCnpj(
  mensagem = '',
  tipo = ''
) {

  const status =
    document.getElementById('cnpjConsultaStatus');

  if (!status) {
    return;
  }

  status.textContent = mensagem;

  status.className =
    'cnpj-consulta-status';

  if (tipo) {
    status.classList.add(tipo);
  }
}


function formatarCepConsulta(valor) {

  const cep =
    String(valor || '').replace(/\D/g, '');

  if (cep.length !== 8) {
    return valor || '';
  }

  return cep.replace(
    /^(\d{5})(\d{3})$/,
    '$1-$2'
  );
}


function montarEnderecoEmpresa(empresa) {

  const partes = [];

  if (empresa.logradouro) {
    partes.push(empresa.logradouro);
  }

  if (empresa.numero) {
    partes.push(empresa.numero);
  }

  let endereco =
    partes.join(', ');

  if (empresa.complemento) {

    endereco +=
      endereco
        ? ` - ${empresa.complemento}`
        : empresa.complemento;
  }

  return endereco;
}


function montarCidadeEmpresa(empresa) {

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


  if (cidadeUf && cep) {
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


function preencherDadosEmpresa(empresa) {

  // CNPJ
  if (empresa.cnpj) {
    document.getElementById('cnpj').value =
      empresa.cnpj;
  }


  // Razão Social
  if (empresa.razaoSocial) {
    document.getElementById('cliente').value =
      empresa.razaoSocial;
  }


  // Nome fantasia
  if (empresa.nomeFantasia) {
    document.getElementById('orcamento').value =
      empresa.nomeFantasia;
  }


  // Telefone
  if (empresa.telefone) {
    document.getElementById('telefone').value =
      empresa.telefone;
  }


  // E-mail
  if (empresa.email) {
    document.getElementById('email').value =
      empresa.email;
  }


  // Endereço
  const endereco =
    montarEnderecoEmpresa(empresa);

  if (endereco) {
    document.getElementById('endereco').value =
      endereco;
  }


  // Bairro
  if (empresa.bairro) {
    document.getElementById('bairro').value =
      empresa.bairro;
  }


  // Cidade / UF / CEP
  const cidade =
    montarCidadeEmpresa(empresa);

  if (cidade) {
    document.getElementById('cidade').value =
      cidade;
  }


  // Atualiza a prévia da proposta
  if (typeof refresh === 'function') {
    refresh();
  }
}


async function buscarCnpjEPreencher() {

  const campoCnpj =
    document.getElementById('cnpj');

  const botao =
    document.getElementById('btnBuscarCnpj');


  if (!campoCnpj || !botao) {
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


  botao.disabled = true;

  botao.textContent =
    'Buscando...';


  definirStatusConsultaCnpj(
    'Consultando dados da empresa...',
    'loading'
  );


  try {

    const empresa =
      await consultarCnpj(cnpj);


    preencherDadosEmpresa(
      empresa
    );


    definirStatusConsultaCnpj(
      empresa.situacao
        ? `✓ Empresa localizada • ${empresa.situacao}`
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

    botao.disabled = false;

    botao.textContent =
      textoOriginal;
  }
}

const campoCnpjConsulta =
  document.getElementById('cnpj');


if (campoCnpjConsulta) {

  campoCnpjConsulta.addEventListener(
    'keydown',
    function(event) {

      if (event.key === 'Enter') {

        event.preventDefault();

        buscarCnpjEPreencher();

      }

    }
  );

}

// =========================================================
// MÁSCARA VISUAL DO CNPJ
// =========================================================

function aplicarMascaraCnpj(valor) {

  let numeros =
    String(valor || '')
      .replace(/\D/g, '')
      .slice(0, 14);


  if (numeros.length <= 2) {
    return numeros;
  }


  if (numeros.length <= 5) {

    return numeros.replace(
      /^(\d{2})(\d+)/,
      '$1.$2'
    );

  }


  if (numeros.length <= 8) {

    return numeros.replace(
      /^(\d{2})(\d{3})(\d+)/,
      '$1.$2.$3'
    );

  }


  if (numeros.length <= 12) {

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


const campoCnpjMascara =
  document.getElementById('cnpj');


if (campoCnpjMascara) {

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


      // Normalmente o usuário estará digitando no final.
      // Mantém o cursor no final nesses casos.
      if (
        posicaoFinal === antes.length
      ) {

        this.setSelectionRange(
          this.value.length,
          this.value.length
        );

      }

    }
  );

}