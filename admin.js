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

async function printOrder({id}){
  const API = $("#api").value.trim(), token = $("#token").value.trim();
  const r = await fetch(`${API}?action=order&id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(()=>({ok:false}));
  if(!d.ok){ alert("读取失败"); return; }
  const o = d.order;
  const items = parseItems(o.items);
  const sum = items.reduce((s,x)=>s + Number(x.price||0)*Number(x.qty||1), 0);
  const w = window.open("", "PRINT");
  w.document.write(`
    <html><head><title>票据 ${o.id}</title>
    <style>
    body{font:14px/1.4 -apple-system,Segoe UI,Roboto,Arial}
    .ticket{width:58mm;margin:0 auto}
    hr{border:none;border-top:1px dashed #999;margin:8px 0}
    </style></head><body onload="window.print();window.close()">
      <div class="ticket">
        <h3>Cucina Cai</h3>
        <div>订单：${o.id}</div>
        <div>桌号：${o.table_id||""}</div>
        <div>时间：${fmt(o.created_at)}</div>
        <hr/>
        ${items.map(x=>`<div>${(x.name||x.id)} × ${x.qty||1} <span style="float:right">¥${Number(x.price||0).toFixed(2)}</span></div>`).join("")}
        <hr/>
        <div>合计 <span style="float:right">¥${sum.toFixed(2)}</span></div>
        ${o.note?`<hr/><div>备注：${o.note}</div>`:""}
      </div>
    </body></html>
  `);
  w.document.close(); w.focus();
}

load();

