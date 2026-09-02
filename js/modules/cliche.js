// Central Comercial Agenflex — Calculadora de Clichê

/* Clichê */
function calcCliche(){const cil=+cCil.value||0,bob=+cBob.value||0,cores=+cCores.value||0,base=+cValor.value||0,desc=+cDesconto.value||0;const cm=cil+10,bm=bob+10,area=cm*bm*cores,prev=area*base,econ=prev*(desc/100),total=prev-econ;cTotal.textContent=BRL.format(total);dCil.textContent=N2.format(cil)+' cm';dCilM.textContent=N2.format(cm)+' cm';dBob.textContent=N2.format(bob)+' cm';dBobM.textContent=N2.format(bm)+' cm';dArea.textContent=N2.format(area)+' cm²';dBase.textContent=BRL.format(base)+'/cm²';dPrevisto.textContent=BRL.format(prev);dDesc.textContent=desc+'%';dEconomia.textContent=BRL.format(econ);return total}
async function copyCliche(){try{await navigator.clipboard.writeText(BRL.format(calcCliche()));toastMsg('Valor copiado')}catch(e){}}
function useCliche(){cliche.value=BRL.format(calcCliche());refresh();go('orcamentoPage');toastMsg('Clichê enviado à proposta')}
