// ====== 小票配置（可按需修改）======
const TICKET = {
  shop: {
    name: "SHOW CAFE'",
    owner: "di LIAN ZHAOCHEN",
    addr1: "Via Ettore Bugatti, 7",
    addr2: "20142 - Milano",
    piva:  "P. IVA 12668910966",
    tel:   "Tel. 02/89302316"
  },
  currency: "€",
  paperWidth: "58mm",  // 58mm 纸宽，如用 80mm 改成 "80mm"
  taxRate: 0.10,       // 统一 IVA 税率（含税价→拆分税额），若你以后想按菜品设置，可给每个 item 加 tax
};
const euro = n => (Number(n||0).toFixed(2)).replace(".", ","); // 1.20 -> "1,20"
const fmtIT = ts => {
  const d = new Date(ts);
  const date = d.toLocaleDateString("it-IT");
  const time = d.toLocaleTimeString("it-IT", {hour:'2-digit', minute:'2-digit'});
  return `${date} ${time}`;
};
const parseItems = s => { try{const a=JSON.parse(s||"[]");return Array.isArray(a)?a:[];}catch(_){return[];} };

const $ = s=>document.querySelector(s);
function ls(k,v){ if(v===undefined) return localStorage.getItem(k)||""; localStorage.setItem(k,v); }

$("#api").value = ls("api");
$("#token").value = ls("token");
$("#tableId").value = ls("tableId");

$("#load").onclick = load;

async function load(){
  const API = $("#api").value.trim();
  const token = $("#token").value.trim();
  const table = $("#tableId").value.trim();
  if(!API || !token){ alert("请先填写 API 与口令"); return; }
  ls("api",API); ls("token",token); ls("tableId",table);

  const url = new URL(API);
  url.searchParams.set("action","orders");
  url.searchParams.set("token", token);
  if(table) url.searchParams.set("table_id", table);

  const r = await fetch(url.toString());
  const d = await r.json().catch(()=>({ok:false,error:"非 JSON 返回"}));
  if(!d.ok){ alert("加载失败："+(d.error||"unknown")); return; }

  const tb = $("#tbl tbody"); tb.innerHTML="";
  d.rows.forEach(row=>{
    const items = parseItems(row.items);
    const sum = items.reduce((s,x)=>s + Number(x.price||0)*Number(x.qty||1), 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${fmt(row.created_at)}</td>
      <td>${row.table_id||""}</td>
      <td><pre>${items.map(x=>`${x.name||x.id} × ${x.qty||1}  ¥${Number(x.price||0).toFixed(2)}`).join('\n')}</pre><div class="muted">合计：¥${sum.toFixed(2)}</div></td>
      <td>${row.note||""}</td>
      <td><span class="status">${row.status||"new"}</span></td>
      <td class="actions">
        <button onclick='editOrder(${JSON.stringify(row).replace(/'/g,"&#39;")})'>编辑</button>
        <button onclick='printOrder(${JSON.stringify({id:row.id}).replace(/'/g,"&#39;")})'>打印</button>
        <button onclick='deleteOrder("${row.id}")'>删除</button>
      </td>
    `;
    tb.appendChild(tr);
  });
}

function parseItems(s){
  try{ const a = JSON.parse(s||"[]"); return Array.isArray(a)?a:[]; }catch(_){ return []; }
}
function fmt(s){ try{ return new Date(s).toLocaleString(); }catch(_){ return s||""; } }

async function editOrder(row){
  const items = parseItems(row.items);
  const content = prompt(
    `编辑 JSON（仅 items、note、status 会被保存）\n例：[{ "id":"margherita","name":"玛格丽塔披萨","price":48,"qty":2 }]`,
    JSON.stringify({ items, note: row.note||"", status: row.status||"new" }, null, 2)
  );
  if(!content) return;
  let body; try{ body = JSON.parse(content); }catch(_){ alert("JSON 不合法"); return; }
  const API = $("#api").value.trim(), token = $("#token").value.trim();
  const r = await fetch(`${API}?action=order_update&token=${encodeURIComponent(token)}`, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify({ id: row.id, ...body })
  });
  const d = await r.json().catch(()=>({ok:false}));
  if(d.ok){ alert("已保存"); load(); } else { alert("保存失败："+(d.error||"unknown")); }
}

async function deleteOrder(id){
  if(!confirm(`确认删除订单 ${id} ？不可恢复`)) return;
  const API = $("#api").value.trim(), token = $("#token").value.trim();
  const r = await fetch(`${API}?action=order_delete&token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`, {method:"POST"});
  const d = await r.json().catch(()=>({ok:false}));
  if(d.ok){ load(); } else { alert("删除失败："+(d.error||"unknown")); }
}

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
}


load();

