// —— 简单本地存取 —— 
const $ = s => document.querySelector(s);
const kv = (k, v) => v === undefined ? localStorage.getItem(k) || "" : localStorage.setItem(k, v);

// —— UI 初始值 —— 
$("#api").value     = kv("k_api");
$("#token").value   = kv("k_token");
$("#table").value   = kv("k_table");
$("#interval").value= kv("k_interval") || "3";

let timer = null;
let lastPrintedKey = "";

// —— 事件 —— 
$("#start").onclick = start;
$("#stop").onclick  = stop;

function start(){
  const API = $("#api").value.trim();
  const TOKEN = $("#token").value.trim();
  const TABLE = $("#table").value.trim();
  const SEC = Math.max(1, Number($("#interval").value || 3));

  if(!API || !TOKEN){ alert("请先填写 API 与口令"); return; }
  kv("k_api", API); kv("k_token", TOKEN); kv("k_table", TABLE); kv("k_interval", String(SEC));

  lastPrintedKey = `k_last_${b64(API)}_${b64(TOKEN)}_${TABLE || "all"}`;

  if(timer) clearInterval(timer);
  fetchAndPrint(API, TOKEN, TABLE).catch(console.error);
  timer = setInterval(()=>fetchAndPrint(API, TOKEN, TABLE), SEC * 1000);
  $("#status").textContent = `运行中，每 ${SEC}s 拉取`;
  $("#status").className = "ok";
}

function stop(){
  if(timer) clearInterval(timer);
  timer = null;
  $("#status").textContent = "已停止";
  $("#status").className = "bad";
}

function b64(s){ try{return btoa(unescape(encodeURIComponent(s)));}catch(_){return "x"} }
function log(s){ const el=$("#log"); const t=new Date().toLocaleTimeString(); el.innerHTML = `[${t}] ${s}<br>` + el.innerHTML; }

// —— 拉单并打印 —— 
async function fetchAndPrint(API, TOKEN, TABLE){
  const url = new URL(API);
  url.searchParams.set("action","orders");
  url.searchParams.set("token", TOKEN);
  if(TABLE) url.searchParams.set("table_id", TABLE);
  const res = await fetch(url.toString(), { cache:"no-store" });
  const data = await res.json();
  if(!data.ok){ log(`× 拉取失败：${data.error||"unknown"}`); return; }

  // 取上次已打印的最大 ID
  const last = Number(localStorage.getItem(lastPrintedKey) || 0);

  // 找出新单（id 更大）
  const news = (data.rows||[])
    .filter(o => Number(o.id||0) > last)
    .sort((a,b)=>Number(a.id)-Number(b.id)); // 按时间正序逐张打印

  if(!news.length) return;

  for(const o of news){
    await printOrder(o);
    localStorage.setItem(lastPrintedKey, String(o.id||0));
    // （可选）标记已打印
    try{
      await fetch(`${API}?action=order_update&token=${encodeURIComponent(TOKEN)}`, {
        method:"POST",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify({ id:o.id, status: "printed" })
      });
    }catch(e){}
  }
  log(`√ 新打印 ${news.length} 张，小于等于 ID ${news.at(-1).id}`);
}

// —— 打印一张 —— 
async function printOrder(order){
  const items = Array.isArray(order.items) ? order.items : parseItems(order.items);
  const sum = items.reduce((s,x)=> s + Number(x.price||0)*Number(x.qty||1), 0);

  // 含税价拆分税额（默认统一税率 TICKET.taxRate）
  const taxRate = (typeof order.taxRate === "number") ? order.taxRate : TICKET.taxRate;
  const net = sum / (1 + taxRate);
  const iva = sum - net;

  const w = window.open("", "_blank", "width=420,height=680");
  w.document.write(`
  <html>
  <head>
    <meta charset="utf-8">
    <title>Documento ${order.id||""}</title>
    <style>
      @page{ margin: 3mm }
      body{ margin:0; background:#fff; }
      .ticket{ width:${TICKET.paperWidth}; margin:0 auto; font:12px/1.45 "Nimbus Mono PS","Courier New",monospace; color:#000; }
      .center{ text-align:center }
      .row{ display:flex; justify-content:space-between }
      hr{ border:none; border-top:1px dashed #888; margin:6px 0 }
      .big{ font-size:14px; font-weight:700 }
      .muted{ color:#444 }
      .lh{ line-height:1.35 }
      .caps{ text-transform:uppercase; letter-spacing:.3px }
      .col3{ display:grid; grid-template-columns: 1fr 40px 60px; gap:4px }
      .num{ text-align:right }
      .mt4{ margin-top:4px } .mt6{ margin-top:6px } .mt8{ margin-top:8px }
    </style>
  </head>
  <body onload="window.print(); setTimeout(()=>window.close(), 300);">
    <div class="ticket">
      <div class="center lh">
        <div class="big caps">${TICKET.shop.name}</div>
        <div>${TICKET.shop.owner}</div>
        <div>${TICKET.shop.addr1}</div>
        <div>${TICKET.shop.addr2}</div>
        <div>${TICKET.shop.piva}</div>
        <div>${TICKET.shop.tel}</div>
      </div>

      <hr>

      <div class="center">
        <div class="caps">Documento commerciale</div>
        <div class="muted">di vendita o prestazione</div>
      </div>

      <div class="mt8 caps muted">DESCRIZIONE   IVA   Prezzo(${TICKET.currency})</div>
      <div class="col3 mt4">
        ${items.map(x=>{
          const name = (x.name || x.id || "").toString().toUpperCase();
          const ivaTxt = Math.round((x.tax ?? taxRate)*100).toString()+",00%";
          const line = `¥${Number(x.price||0).toFixed(2)}`; // 用欧元符号时下面替换
          return `
            <div>${name}${x.qty?` x${x.qty}`:""}</div>
            <div class="num">${ivaTxt.replace(".",",")}</div>
            <div class="num">${euro(Number(x.price||0)*Number(x.qty||1))}</div>
          `;
        }).join("")}
      </div>

      <hr>

      <div class="row big">
        <div class="caps">TOTALE COMPLESSIVO</div>
        <div>${euro(sum)}</div>
      </div>
      <div class="row">
        <div class="caps">di cui IVA</div>
        <div>${euro(iva)}</div>
      </div>

      <div class="mt8">
        <div>Pagamento contante</div>
        <div class="row"><div>Importo pagato</div><div>${euro(sum)}</div></div>
      </div>

      <div class="center mt8">
        <div>${fmtIT(order.created_at || new Date())}</div>
        <div>DOCUMENTO N. ${order.id || ""}</div>
        ${order.rtCode?`<div>RT-${order.rtCode}</div>`:""}
      </div>

      <hr>

      <div class="center caps muted">DETTAGLIO FORME DI PAGAMENTO</div>
      <div class="row"><div>Contanti</div><div>${euro(sum)}</div></div>
    </div>
  </body>
  </html>
  `);

  w.document.close();
    resolve();
  });
}

function parseItems(s){ try{const a=JSON.parse(s||"[]"); return Array.isArray(a)?a:[];}catch(_){return [];} }
function fmt(s){ try{return new Date(s).toLocaleString();}catch(_){return s||"";} }
