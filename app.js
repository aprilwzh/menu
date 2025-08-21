// ========= 配置 =========
const ORDER_API = "https://script.google.com/macros/s/AKfycbxvIonq1SFMVuODE1NLXhWjNTds0TZwZq3_fis3p6WKvWzpHNvjceIt7ew5CB2F1HUadQ/exec"; // ← 改这里

// ========= 多语言 =========
const I18N = {
  zh: { brand: "智能点餐", subtitle: t => `桌号：${t || '—'}（扫描桌贴可自动带入）`, add:"加入", cart:"购物车", notePH:"口味/忌口/过敏说明（可选）", place:"下单", empty:"购物车为空", total: s=>`合计：¥${s.toFixed(2)}` },
  en: { brand: "Smart Menu", subtitle: t => `Table: ${t || '—'} (scan table QR to auto-fill)`, add:"Add", cart:"Cart", notePH:"Note: preferences/allergies (optional)", place:"Place Order", empty:"Your cart is empty", total: s=>`Total: ¥${s.toFixed(2)}` },
  it: { brand: "Menu Intelligente", subtitle: t => `Tavolo: ${t || '—'} (scansiona il QR del tavolo)`, add:"Aggiungi", cart:"Carrello", notePH:"Note: preferenze/allergie (opzionale)", place:"Invia Ordine", empty:"Il carrello è vuoto", total: s=>`Totale: ¥${s.toFixed(2)}` }
};

// ========= 示例菜单 =========
const MENU = [
  { id: "margherita", price: 48, name: { zh:"玛格丽塔披萨", en:"Margherita Pizza", it:"Pizza Margherita" }, desc: { zh:"西红柿/马苏里拉/罗勒", en:"Tomato/Mozzarella/Basil", it:"Pomodoro/Mozzarella/Basilico" } },
  { id: "carbonara",  price: 56, name: { zh:"培根蛋面",   en:"Spaghetti Carbonara", it:"Spaghetti alla Carbonara" }, desc: { zh:"培根/蛋黄/帕玛森",  en:"Guanciale/Egg/Parmigiano", it:"Guanciale/Uovo/Parmigiano" } },
  { id: "tiramisu",   price: 28, name: { zh:"提拉米苏",     en:"Tiramisù",            it:"Tiramisù" }, desc: { zh:"咖啡/马斯卡彭",       en:"Coffee/Mascarpone",     it:"Caffè/Mascarpone" } }
];

let currentLang = localStorage.getItem('lang') || 'zh';
let cart = [];

function getTableId(){ const m = location.pathname.match(/\/t\/(.+)$/); return m ? decodeURIComponent(m[1]) : ''; }
function setActiveLangBtn(){ document.querySelectorAll('.lang-switch button').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === currentLang)); }
function setupLangSelector(){ document.querySelectorAll('.lang-switch button').forEach(btn => btn.addEventListener('click', ()=>{ currentLang = btn.dataset.lang; localStorage.setItem('lang', currentLang); render(); })); }

function renderMenu(){ const box=document.getElementById('menu'); box.innerHTML=''; MENU.forEach(it=>{ const card=document.createElement('div'); card.className='card'; card.innerHTML = `
  <h4>${it.name[currentLang]}</h4>
  <div class="muted">${it.desc[currentLang]||''}</div>
  <div class="row" style="margin-top:8px;">
    <div>¥${it.price.toFixed(2)}</div>
    <button class="btn" data-id="${it.id}">${I18N[currentLang].add}</button>
  </div>`; card.querySelector('button').addEventListener('click',()=>addToCart(it)); box.appendChild(card); }); }

function addToCart(it){ const hit=cart.find(x=>x.id===it.id); if(hit) hit.qty+=1; else cart.push({id:it.id, name:it.name[currentLang], price:it.price, qty:1}); renderCart(); }

function renderCart(){ const t=I18N[currentLang]; document.getElementById('cartTitle').textContent=t.cart; document.getElementById('note').placeholder=t.notePH; if(cart.length===0){ document.getElementById('cartItems').textContent=t.empty; document.getElementById('total').textContent=t.total(0); } else { const list=cart.map(x=>`${x.name} × ${x.qty}`).join(' · '); const sum=cart.reduce((s,x)=>s+x.price*x.qty,0); document.getElementById('cartItems').textContent=list; document.getElementById('total').textContent=t.total(sum);} const btn=document.getElementById('placeOrder'); btn.textContent=t.place; btn.onclick=placeOrder; }

function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1800); }

async function placeOrder(){ if(cart.length===0) return alert(I18N[currentLang].empty); const payload={ table_id:getTableId(), items:cart, note:document.getElementById('note').value||'', lang:currentLang };
  // 方式1：sendBeacon（无需 CORS 响应，可“发后即忘”）
  if(navigator.sendBeacon){ try{ const ok = navigator.sendBeacon(ORDER_API, new Blob([JSON.stringify(payload)], {type: 'text/plain'})); if(ok){ cart=[]; renderCart(); toast(currentLang==='zh'?'✓ 下单成功':'it'===currentLang?'✓ Ordine inviato':'✓ Order placed'); return; } }catch(e){}
  }
  // 方式2：fetch + no-cors（不读取响应，效果同上）
  try{ await fetch(ORDER_API, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(payload)}); cart=[]; renderCart(); toast(currentLang==='zh'?'✓ 下单成功':'it'===currentLang?'✓ Ordine inviato':'✓ Order placed'); }
  catch(e){ alert('× Failed'); }
}

function render(){ setActiveLangBtn(); const t=I18N[currentLang]; document.getElementById('brand').textContent=t.brand; document.getElementById('subtitle').textContent=t.subtitle(getTableId()); renderMenu(); renderCart(); }

setupLangSelector();
render();
