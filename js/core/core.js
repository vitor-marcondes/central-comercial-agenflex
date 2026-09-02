// Central Comercial Agenflex — núcleo compartilhado
// Navegação, formatação, logos e utilidades globais.

const teamLogos={
  revenda:'assets/logos/agenflex.jpg',
  pharma:'assets/logos/pharma.png',
  food:'assets/logos/food.png'
};
const BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const N2=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const N4=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4});
const KEY='agenflex_v61_orc';
function isoToday(){const d=new Date(),o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10)}
function brDate(iso){if(!iso)return'';const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
orcData.value=isoToday();

function showPage(id,btn){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');else{const b=document.querySelector(`[data-page="${id}"]`);if(b)b.classList.add('active')}window.scrollTo({top:0,behavior:'smooth'})}
function go(id){showPage(id,null)}
function toastMsg(msg){toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
