// Central Comercial Agenflex — Histórico de propostas

let historicoPropostas=[];
let historicoCarregando=false;

function escaparHistorico(valor){
  return esc(valor ?? '');
}

function formatarDataHistorico(valor){
  if(!valor)return '—';
  return brDate(String(valor).slice(0,10));
}

function revisaoAtualDaLista(proposta){
  const revisoes=Array.isArray(proposta.revisoes_proposta)
    ? proposta.revisoes_proposta
    : [];

  return revisoes.find(
    r=>Number(r.numero_revisao)===Number(proposta.revisao_atual)
  ) || [...revisoes].sort(
    (a,b)=>Number(b.numero_revisao)-Number(a.numero_revisao)
  )[0] || null;
}

function normalizarBuscaHistorico(texto){
  return String(texto||'')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'');
}

function propostasFiltradasHistorico(){
  const termo=normalizarBuscaHistorico(
    document.getElementById('historicoBusca')?.value
  );

  if(!termo)return historicoPropostas;

  return historicoPropostas.filter(proposta=>{
    const r=revisaoAtualDaLista(proposta);

    const texto=[
      proposta.numero,
      r?.nome_proposta,
      r?.cliente,
      r?.cnpj,
      r?.vendedor_nome,
      r?.status,
      r?.data_proposta
    ].join(' ');

    return normalizarBuscaHistorico(texto).includes(termo);
  });
}

function badgeHistorico(status){
  const s=String(status||'rascunho').toLowerCase();

  if(s==='enviada'){
    return '<span class="history-badge enviada">ENVIADA</span>';
  }

  return '<span class="history-badge rascunho">RASCUNHO</span>';
}

function renderizarHistorico(){
  const corpo=document.getElementById('historicoBody');
  const vazio=document.getElementById('historicoVazio');
  const contador=document.getElementById('historicoContador');

  if(!corpo)return;

  const lista=propostasFiltradasHistorico();

  corpo.innerHTML='';
  contador.textContent=`${lista.length} proposta(s)`;

  vazio.style.display=lista.length?'none':'block';

  lista.forEach(proposta=>{
    const r=revisaoAtualDaLista(proposta);
    if(!r)return;

    const tr=document.createElement('tr');

    tr.innerHTML=`
      <td><b>#${escaparHistorico(proposta.numero)}</b></td>
      <td>
        <b>${escaparHistorico(r.nome_proposta || 'Sem nome')}</b>
        <div class="history-muted">${escaparHistorico(r.cliente || 'Cliente não informado')}</div>
      </td>
      <td>${escaparHistorico(r.cnpj || '—')}</td>
      <td>${escaparHistorico(r.vendedor_nome || '—')}</td>
      <td>${formatarDataHistorico(r.data_proposta)}</td>
      <td>R${escaparHistorico(r.numero_revisao)}</td>
      <td>${badgeHistorico(r.status)}</td>
      <td>
        <button
          type="button"
          class="btn navy history-open"
          onclick="abrirPropostaHistorico('${escaparHistorico(proposta.id)}')"
        >
          Abrir
        </button>
      </td>
    `;

    corpo.appendChild(tr);
  });
}

async function carregarHistorico(){
  if(historicoCarregando)return;

  const corpo=document.getElementById('historicoBody');
  const vazio=document.getElementById('historicoVazio');
  const contador=document.getElementById('historicoContador');

  historicoCarregando=true;

  if(corpo) corpo.innerHTML=
    '<tr><td colspan="8" class="history-loading">Carregando propostas...</td></tr>';

  if(vazio) vazio.style.display='none';
  if(contador) contador.textContent='Carregando...';

  try{
    historicoPropostas=await listarPropostas({limite:200});
    renderizarHistorico();
  }catch(erro){
    console.error('Erro ao carregar histórico:',erro);

    if(corpo) corpo.innerHTML='';
    if(contador) contador.textContent='Erro ao carregar';

    if(vazio){
      vazio.style.display='block';
      vazio.innerHTML=
        '<b>Não foi possível carregar o histórico.</b><br>' +
        escaparHistorico(erro?.message || 'Erro desconhecido.');
    }
  }finally{
    historicoCarregando=false;
  }
}

async function abrirHistorico(btn){
  showPage('historicoPage',btn);
  await carregarHistorico();

  setTimeout(()=>{
    document.getElementById('historicoBusca')?.focus();
  },50);
}

async function abrirPropostaHistorico(propostaId){
  const botoes=document.querySelectorAll('.history-open');
  botoes.forEach(b=>b.disabled=true);

  try{
    toastMsg('Abrindo proposta...');

    const proposta=await obterPropostaCompleta(propostaId);

    aplicarPropostaNoFormulario(proposta);

    showPage('orcamentoPage',null);

    window.scrollTo({
      top:0,
      behavior:'smooth'
    });

    const r=revisaoAtualDaLista(proposta);

    toastMsg(
      `Proposta #${proposta.numero} • R${r?.numero_revisao ?? proposta.revisao_atual} aberta`
    );

  }catch(erro){
    console.error('Erro ao abrir proposta:',erro);

    alert(
      'Não foi possível abrir a proposta.\n\n' +
      (erro?.message || 'Erro desconhecido.')
    );
  }finally{
    botoes.forEach(b=>b.disabled=false);
  }
}

function limparBuscaHistorico(){
  const campo=document.getElementById('historicoBusca');
  if(!campo)return;

  campo.value='';
  renderizarHistorico();
  campo.focus();
}

function iniciarHistorico(){
  const busca=document.getElementById('historicoBusca');

  if(busca){
    busca.addEventListener('input',renderizarHistorico);
  }
}

iniciarHistorico();
