// 将此 URL 替换为你的 Web 应用 URL
const API_URL = "YOUR_GOOGLE_APP_SCRIPT_URL"; 

let cart = {};

// 获取菜单数据并渲染
async function fetchMenu() {
    try {
        const response = await fetch(`${API_URL}?action=menu&lang=zh`);
        const result = await response.json();
        
        if (!result.ok) {
            console.error('获取菜单失败:', result.error);
            return;
        }

        const menuItems = result.items;
        const menuList = document.getElementById('menu-list');
        menuList.innerHTML = ''; 

        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.innerHTML = `
                <h3>${item.name}</h3>
                <p>${item.desc}</p>
                <p>¥${item.price.toFixed(2)}</p>
                <button onclick="addToCart('${item.id}', '${item.name}', ${item.price})">加入购物车</button>
            `;
            menuList.appendChild(menuItem);
        });
    } catch (error) {
        console.error('获取菜单失败:', error);
    }
}

// 添加菜品到购物车
function addToCart(id, name, price) {
    if (cart[id]) {
        cart[id].quantity++;
    } else {
        cart[id] = { id, name, price, quantity: 1 };
    }
    renderCart();
}

// 渲染购物车
function renderCart() {
    const cartItemsDiv = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');
    let total = 0;
    
    cartItemsDiv.innerHTML = '';
    
    for (const id in cart) {
        const item = cart[id];
        const itemElement = document.createElement('p');
        itemElement.textContent = `${item.name} x ${item.quantity} - ¥${(item.price * item.quantity).toFixed(2)}`;
        cartItemsDiv.appendChild(itemElement);
        total += item.price * item.quantity;
    }
    
    cartTotalSpan.textContent = `¥${total.toFixed(2)}`;
}

// 提交订单
async function submitOrder() {
    const tableNumber = document.getElementById('table-number').value;
    if (!tableNumber || Object.keys(cart).length === 0) {
        alert('请输入桌号并选择菜品！');
        return;
    }
    
    const orderData = {
        table_id: tableNumber,
        items: Object.values(cart).map(item => ({ id: item.id, quantity: item.quantity })),
        lang: 'zh'
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(orderData),
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.ok) {
            alert('订单提交成功！');
            cart = {};
            renderCart();
            document.getElementById('table-number').value = '';
        } else {
            alert('订单提交失败：' + result.error);
        }
    } catch (error) {
        console.error('提交订单失败:', error);
        alert('网络错误，请稍后重试。');
    }
}

// 绑定提交按钮事件
document.getElementById('submit-order').addEventListener('click', submitOrder);

// 页面加载时执行
document.addEventListener('DOMContentLoaded', fetchMenu);
