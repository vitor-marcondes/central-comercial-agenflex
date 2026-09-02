// Central Comercial Agenflex — inicialização da interface
// Deve ser carregado por último.

document.querySelectorAll('#orcamentoPage input:not(#arteInput),#orcamentoPage select,#orcamentoPage textarea').forEach(x=>{x.addEventListener('input',refresh);x.addEventListener('change',refresh)});
document.querySelectorAll('#clichePage input,#clichePage select').forEach(x=>{x.addEventListener('input',calcCliche);x.addEventListener('change',calcCliche)});
document.querySelectorAll('#medidasPage input,#medidasPage select').forEach(x=>{x.addEventListener('input',calcMedidas);x.addEventListener('change',calcMedidas)});
document.getElementById('mCategoria').addEventListener('change',()=>{ajustarDensidadeCategoria();renderCatalogo();renderEspessuras();calcMedidas()});
renderSellers();loadDraft();renderItems();calcCliche();updateTeamLogo();renderCatalogo();renderEspessuras();calcMedidas();
