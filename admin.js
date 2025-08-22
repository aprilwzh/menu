const ORDER_API = "https://script.google.com/macros/s/AKfycbx1i0rJx92cB-vbaN8qGvbRiqrfMXQCoyZOOGbriD1VFckclPYsMyzkLuYvqtE_JYQZXg/exec";
let ADMIN_TOKEN = localStorage.getItem("ADMIN_TOKEN") || "";

const $ = s => document.querySelector(s);
$("#token").value = ADMIN_TOKEN;
$("#saveToken").onclick = ()=>{ ADMIN_TOKEN = $("#token").value.trim(); localStorage.setItem("ADMIN_TOKEN", ADMIN_TOKEN); loadOrders(); loadMenuAll(); };
$("#refresh").onclick = ()=> loadOrders();
$("#flt").oninput = ()=> renderOrders(window.__orders||[]);
$("#loadMenu").onclick = ()=> loadMenuAll();

function fmt(t){ try{return new Date(t).toLocaleString()}catch(_){return t} }

/** 订单 **/
async function loadOrders(){
  if(!ADMIN_TOKEN) return alert("先输入管理口令并保存");
  const res = await fetch(`${ORDER_API}?action=orders&token=${encodeURIComponent(ADMIN_TOKEN)}`);
  const data = await res.json();
  if(!data.ok) return alert("口令错误或接口异常");
  window.__orders = data.rows||[];
  renderOrders(window.__orders);
}

function renderOrders(rows){
  const q = $("#flt").value.trim();
  const list = rows.slice().reverse().filter(r => !q || String(r.table_id)===q);
  const tb = $("#tbl tbody"); tb.innerHTML="";
  for(const r of list){
    let items=[]; try{ items=JSON.parse(r.items||"[]"); }catch(_){}
    const lines = items.map(x=>`${x.name} × ${x.qty}  ¥${(x.price*x.qty).toFixed(2)}`).join("<br>");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmt(r.created_at)}</td>
      <td><b>${r.table_id||""}</b></td>
      <td>${lines||"<i>空</i>"}${r.note?("<div class='muted'>备注："+r.note+"</div>"):""}</td>
      <td><button class="btn">打印小票</button></td>`;
    tr.querySelector("button").onclick = ()=> printTicket(r, items);
    tb.appendChild(tr);
  }
}

function printTicket(order, items){
  const total = items.reduce((s,x)=>s+(Number(x.price)||0)*(Number(x.qty)||0), 0);
  const w = window.open("", "_blank");
  w.document.write(`
  <html><head><meta charset="utf-8"><title>ticket</title>
  <style>@media print{body{margin:0}.ticket{width:58mm;padding:6px;font-family:monospace;font-size:12px}.trow{display:flex;justify-content:space-between}h3{margin:0 0 6px 0;text-align:center}}</style>
  </head><body>
    <div class="ticket">
      <h3>Cucina Cai</h3>
      <div>桌号: ${order.table_id||""}</div>
      <div>时间: ${fmt(order.created_at)}</div>
      <hr/>
      ${items.map(x=>`<div class="trow"><span>${x.name} × ${x.qty}</span><span>¥${(x.price*x.qty).toFixed(2)}</span></div>`).join("")}
      <hr/>
      <div class="trow"><strong>合计</strong><strong>¥${total.toFixed(2)}</strong></div>
      ${order.note?`<div>备注: ${order.note}</div>`:""}
    </div>
    <script>window.onload=()=>window.print()</script>
  </body></html>`);
  w.document.close();
}

/** 菜单管理（增/改/删） **/
async function loadMenuAll(){
  if(!ADMIN_TOKEN) return alert("先输入管理口令并保存");
  const res = await fetch(`${ORDER_API}?action=menu_all&token=${encodeURIComponent(ADMIN_TOKEN)}`);
  const data = await res.json();
  if(!data.ok) return alert("口令错误或接口异常");
  renderMenu(data.rows || []);
}

function renderMenu(rows){
  const tb = $("#menuTbl tbody"); tb.innerHTML = "";
  // 增加一个“空白行”用于新增
  rows = rows.concat([{id:"",price:"",name_zh:"",name_en:"",name_it:"",desc_zh:"",desc_en:"",desc_it:"",available:true}]);
  for(const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td contenteditable>${r.id||""}</td>
      <td contenteditable>${r.price||""}</td>
      <td contenteditable>${r.name_zh||""}</td>
      <td contenteditable>${r.name_en||""}</td>
      <td contenteditable>${r.name_it||""}</td>
      <td contenteditable>${r.desc_zh||""}</td>
      <td contenteditable>${r.desc_en||""}</td>
      <td contenteditable>${r.desc_it||""}</td>
      <td contenteditable>${String(r.available).toLowerCase()!=="false"?"TRUE":"FALSE"}</td>
      <td class="row">
        <button class="btn save">保存</button>
        <button class="btn del">删除</button>
      </td>`;
    tr.querySelector(".save").onclick = ()=> saveRow(tr);
    tr.querySelector(".del").onclick  = ()=> delRow(tr);
    tb.appendChild(tr);
  }
}

async function saveRow(tr){
  const td = s => tr.children[s].textContent.trim();
  const payload = {
    id: td(0), price: Number(td(1)||0),
    name_zh: td(2), name_en: td(3), name_it: td(4),
    desc_zh: td(5), desc_en: td(6), desc_it: td(7),
    available: td(8).toUpperCase()!=="FALSE"
  };
  if(!payload.id) return alert("id 不能为空");
  await fetch(`${ORDER_API}?action=menu_upsert&token=${encodeURIComponent(ADMIN_TOKEN)}`, {
    method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
  });
  loadMenuAll();
}

async function delRow(tr){
  const id = tr.children[0].textContent.trim();
  if(!id) return alert("先选中要删除的行（id 不能为空）");
  if(!confirm(`确定删除 ${id} ?`)) return;
  await fetch(`${ORDER_API}?action=menu_delete&token=${encodeURIComponent(ADMIN_TOKEN)}&id=${encodeURIComponent(id)}`, { method:"POST" });
  loadMenuAll();
}

loadOrders();
loadMenuAll();
