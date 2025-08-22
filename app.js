// ===== 你的后端 API（保持你的 /exec）=====
const ORDER_API = "https://script.google.com/macros/s/AKfycbzxyxz_yA4MyXTXKQSk3FL_9Pemk-hEDVa_b24mvFEgG5WBYH110Jd0ugO0R4V7uaxVrQ/exec";
const PLACEHOLDER_IMG = "./images/placeholder.webp"; // 没有图时的占位，可放一张通用占位图

// ===== 多语言 =====
const I18N = {
  zh: { brand:"智能点餐", subtitle:t=>`桌号：${t||"—"}（扫描桌贴可自动带入）`, add:"加入", cart:"购物车", notePH:"口味/忌口/过敏说明（可选）", place:"下单", empty:"购物车为空", total:s=>`合计：¥${s.toFixed(2)}` },
  en: { brand:"Smart Menu", subtitle:t=>`Table: ${t||"—"} (scan table QR to auto-fill)`, add:"Add", cart:"Cart", notePH:"Note: preferences/allergies (optional)", place:"Place Order", empty:"Your cart is empty", total:s=>`Total: ¥${s.toFixed(2)}` },
  it: { brand:"Menu Intelligente", subtitle:t=>`Tavolo: ${t||"—"} (scansiona il QR del tavolo)`, add:"Aggiungi", cart:"Carrello", notePH:"Note: preferenze/allergie (opzionale)", place:"Invia Ordine", empty:"Il carrello è vuoto", total:s=>`Totale: ¥${s.toFixed(2)}` }
};
const LANGS = ["zh","en","it"];
let currentLang = localStorage.getItem("lang");
if(!LANGS.includes(currentLang)){ currentLang="zh"; localStorage.setItem("lang","zh"); }

let MENU = [];   // 从后端拉取（含 image 字段）
let cart = [];

function getTableId(){ const m=location.pathname.match(/\/t\/([^\/?#]+)/); return m?decodeURIComponent(m[1]):""; }
function setActiveLangBtn(){ document.querySelectorAll(".lang-switch button").forEach(b=>b.classList.toggle("active", b.dataset.lang===currentLang)); }
function setupLangSelector(){ document.querySelectorAll(".lang-switch button").forEach(b=>b.addEventListener("click", async ()=>{ currentLang=b.dataset.lang; localStorage.setItem("lang",currentLang); await loadMenu(); render(); })); }

// 拉菜单（统一菜单，包含图片）
async function loadMenu(){
  try{
    const res = await fetch(`${ORDER_API}?action=menu&lang=${encodeURIComponent(currentLang)}`);
    const data = await res.json();
    MENU = data.ok ? (data.items || []) : [];
  }catch(_){ MENU = []; }
}

function renderMenu(){
  const box=document.getElementById("menu"); box.innerHTML="";
  MENU.forEach(it=>{
    const img = it.image && String(it.image).startsWith("http") ? it.image : PLACEHOLDER_IMG;
    const card=document.createElement("div"); card.className="card";
    card.innerHTML = `
      <div class="thumb">
        <img src="${img}" alt="${it.name || ''}" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <h4>${it.name}</h4>
      <div class="muted">${it.desc||""}</div>
      <div class="row" style="margin-top:8px;">
        <div>¥${Number(it.price||0).toFixed(2)}</div>
        <button class="btn" data-id="${it.id}">${I18N[currentLang].add}</button>
      </div>`;
    card.querySelector("button").addEventListener("click",()=>addToCart(it));
    box.appendChild(card);
  });
}

function addToCart(it){ const hit=cart.find(x=>x.id===it.id); if(hit) hit.qty+=1; else cart.push({id:it.id, name:it.name, price:Number(it.price||0), qty:1}); renderCart(); }

function renderCart(){
  const t=I18N[currentLang]||I18N.zh;
  document.getElementById("cartTitle").textContent=t.cart;
  document.getElementById("note").placeholder=t.notePH;
  if(cart.length===0){ document.getElementById("cartItems").textContent=t.empty; document.getElementById("total").textContent=t.total(0); }
  else { const list=cart.map(x=>`${x.name} × ${x.qty}`).join(" · "); const sum=cart.reduce((s,x)=>s+x.price*x.qty,0); document.getElementById("cartItems").textContent=list; document.getElementById("total").textContent=t.total(sum); }
  const btn=document.getElementById("placeOrder"); btn.textContent=t.place; btn.onclick=placeOrder;
}

function toast(msg){ const el=document.getElementById("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),1800); }

async function placeOrder(){
  if(cart.length===0) return alert((I18N[currentLang]||I18N.zh).empty);
  const payload={ table_id:getTableId(), items:cart, note:document.getElementById("note").value||"", lang:currentLang };
  if(navigator.sendBeacon){ try{ const ok=navigator.sendBeacon(ORDER_API,new Blob([JSON.stringify(payload)],{type:"text/plain"})); if(ok){ cart=[]; renderCart(); toast(currentLang==="zh"?"✓ 下单成功":currentLang==="it"?"✓ Ordine inviato":"✓ Order placed"); return;} }catch(_){} }
  try{ await fetch(ORDER_API,{method:"POST",mode:"no-cors",headers:{ "Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)}); cart=[]; renderCart(); toast(currentLang==="zh"?"✓ 下单成功":currentLang==="it"?"✓ Ordine inviato":"✓ Order placed"); }
  catch(e){ alert("× Failed"); }
}

async function bootstrap(){ setupLangSelector(); await loadMenu(); render(); }
function render(){ setActiveLangBtn(); const t=I18N[currentLang]||I18N.zh; document.getElementById("brand").textContent=t.brand; document.getElementById("subtitle").textContent=t.subtitle(getTableId()); renderMenu(); renderCart(); }
bootstrap();
