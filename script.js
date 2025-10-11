// Main shop logic: products rendering, cart, and checkout to Firestore
// Firebase is initialized inline in HTML via window.FIREBASE_CONFIG.
let firebaseApp = null;
let firestoreDb = null;

async function ensureFirebaseHelpers() {
  // Returns { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs }
  if (window.__fb && firebaseApp && firestoreDb) return window.__fb;
  try {
    const [{ initializeApp }, { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, getDocs }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
    ]);
    if (!firebaseApp) firebaseApp = initializeApp(window.FIREBASE_CONFIG);
    if (!firestoreDb) firestoreDb = getFirestore(firebaseApp);
    window.__fb = { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs };
    return window.__fb;
  } catch (e) {
    // Retry once in case of transient network failure
    try {
      const [{ initializeApp }, { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, getDocs }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
      ]);
      if (!firebaseApp) firebaseApp = initializeApp(window.FIREBASE_CONFIG);
      if (!firestoreDb) firestoreDb = getFirestore(firebaseApp);
      window.__fb = { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs };
      return window.__fb;
    } catch (e2) {
      console.error('Failed to load Firebase modules:', e2);
      throw e2;
    }
  }
}

// --- Product Catalog (clothes + lip tints) ---
let products = [
  // Replace each image with your own product photo URL or local path.
  { id: 'dress-soft-mint', name: 'Soft Mint Dress', price: 899, category: 'clothes', stock: 5, size: ['Small','Medium','Large'], image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Soft+Mint+Dress' },
  { id: 'Fullset', name: 'Cream Linen Set', price: 1199, category: 'clothes', stock: 3, size: ['Small','Medium','Large'], image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Cream+Linen+Set' },
  { id: 'cardigan-plum', name: 'Plum Cardigan', price: 980, category: 'clothes', stock: 0, size: ['Small','Medium','Large'], image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Plum+Cardigan' },
  { id: 'tint-rose', name: 'Velvet Lip Tint – Rose', price: 299, category: 'lip-tint', stock: 10, size: ['One Size'], image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Tint+Rose' },
  { id: 'tint-plum', name: 'Velvet Lip Tint – Plum', price: 299, category: 'lip-tint', stock: 8, size: ['One Size'], image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Tint+Plum' },
  { id: 'tint-mocha', name: 'Velvet Lip Tint – Mocha', price: 299, category: 'lip-tint', stock: 0, size: ['One Size'], image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Tint+Mocha' },
  { id: 'tint', name: 'Velvet  Tint – Mocha', price: 299, category: 'lip-tint', stock: 2, size: ['One Size'], image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Tint+Mocha' },
];

// --- State ---
let cart = {}; // key: productId, value: quantity

// --- Helpers ---
const peso = (v) => `₱${Number(v).toFixed(2)}`;

// Persist cart across pages
const CART_STORAGE_KEY = 'jcws_cart';
function saveCartToStorage() {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch (_) {}
}
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') cart = obj;
    }
  } catch (_) {}
}

function getCartItems() {
  return Object.entries(cart).map(([key, quantity]) => {
    const [id, selectedSize] = String(key).split('::');
    const p = products.find((x) => x.id === id);
    return { ...p, id, cartKey: key, sizeSelected: selectedSize || (Array.isArray(p?.size) ? p.size[0] : 'One Size'), quantity };
  });
}

function computeSubtotal() {
  return getCartItems().reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// --- Rendering ---
function renderProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  let toRender = products.slice();
  // Apply search and category filters if present
  const qEl = document.getElementById('prodSearch');
  const cEl = document.getElementById('prodCategory');
  const query = (qEl?.value || '').toLowerCase();
  const cat = (cEl?.value || 'all');
  if (query) {
    toRender = toRender.filter(p => (p.name + ' ' + (p.category||'')).toLowerCase().includes(query));
  }
  if (cat && cat !== 'all') {
    toRender = toRender.filter(p => (p.category||'').toLowerCase() === cat.toLowerCase());
  }
  // If grid has data-limit=responsive, cap to two rows based on current columns
  const limitMode = grid.getAttribute('data-limit');
  if (limitMode === 'responsive') {
    // Determine columns from CSS breakpoints using window width
    let cols = 1;
    const w = window.innerWidth || 1024;
    if (w >= 1024) cols = 3; // lg
    else if (w >= 640) cols = 2; // sm
    const maxItems = cols * 2; // two rows
    toRender = toRender.slice(0, maxItems);
  }
  toRender.forEach((p) => {
    const isOutOfStock = Number(p.stock || 0) === 0;
    const card = document.createElement('div');
    card.className = `group bg-white/80 backdrop-blur-sm rounded-3xl ring-2 ring-mint-100 shadow-lg overflow-hidden hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 hover:ring-plum-500/30 ${isOutOfStock ? 'opacity-75' : ''} animate-scale-in`;
    card.innerHTML = `
      <div class="aspect-[4/3] overflow-hidden relative">
        <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'grayscale' : ''}" />
        ${isOutOfStock ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="bg-red-500 text-white px-4 py-2 rounded-2xl font-semibold text-sm shadow-lg">Out of Stock</span></div>' : ''}
        
      </div>
      <div class="p-6">
        <div class="font-display font-bold text-lg text-plum-500 mb-2">${p.name}</div>
        <div class="text-sm text-text-muted mb-4">
  ${{
    clothes: "Clothes",
    liptint: "Lip tint",
    shoes: "Shoes",
    dress: "Dress",
    full: "Full Set",  
    top: "Top",
    pants: "Pants",
    perfume: "Perfume",
    accessories: "Accessories",
    package: "Package",
    sweater: "Sweater"
  }[p.category.toLowerCase()] || "others"}

</div>
        <div class="text-sm text-slate-600 mt-1">
          <span>${Array.isArray(p.size) && p.size.length > 1 ? 'Sizes: ' + p.size.join(' • ') : 'Size: ' + ((p.size && p.size[0]) || 'One Size')}</span>
        </div>

        <div class="flex items-center justify-between mb-4">
          <span class="font-display font-bold text-xl text-plum-500">${peso(p.price)}</span>
          <span class="text-sm font-medium ${isOutOfStock ? 'text-red-500' : 'text-green-600'}">
            Available: ${Number(p.stock || 0)}
          </span>
        </div>
        ${isOutOfStock ? 
          `<button disabled class="w-full rounded-2xl bg-gray-200 text-gray-500 px-6 py-3 cursor-not-allowed font-medium">Out of Stock</button>` :
          `<button data-id="${p.id}" class="w-full rounded-2xl bg-plum-500 text-white px-6 py-3 hover:bg-plum-600 transition-all duration-300 hover:scale-105 hover:shadow-xl font-medium group">
            <span class="flex items-center justify-center gap-2">
              <span>Add to Cart</span>
              <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"/>
              </svg>
            </span>
          </button>`
        }
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
}

// Size selection modal + add
function pickSizeThenAdd(product) {
  const sizes = Array.isArray(product.size) && product.size.length ? product.size : ['One Size'];
  if (sizes.length === 1) {
    const key = `${product.id}::${sizes[0]}`;
    const qty = cart[key] || 0;
    cart[key] = qty + 1;
    renderCart();
    saveCartToStorage();
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center';
  const card = document.createElement('div');
  card.className = 'w-[92%] max-w-sm md:max-w-md rounded-2xl shadow-2xl ring-1 ring-white/40 bg-gradient-to-br from-[#A8E6CF]/80 to-white/95 backdrop-blur-md p-6';
  card.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="shrink-0 w-12 h-12 rounded-2xl bg-white/70 ring-1 ring-white/60 flex items-center justify-center text-2xl text-[#5A2753]">📏</div>
      <div class="flex-1">
        <div class="text-lg font-semibold text-[#5A2753]">Choose Size</div>
        <div class="mt-1 text-sm text-[#2E2E2E]">${product.name}</div>
      </div>
      <button class="text-[#5A2753]/70 hover:text-[#7A3E6C] text-lg">×</button>
    </div>
    <div class="mt-4">
      <select id="__sizeSel" class="w-full rounded-xl ring-2 ring-[#DCEEEA] focus:ring-[#5A2753] px-3 py-2">
        ${sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div class="mt-6 flex justify-end gap-2">
      <button id="__cancel" class="px-4 py-2 rounded-xl ring-2 ring-[#DCEEEA] text-[#2E2E2E] hover:ring-[#5A2753] transition-all">Cancel</button>
      <button id="__confirm" class="px-5 py-2 rounded-xl bg-[#5A2753] text-white hover:bg-[#7A3E6C] transition-all">Add</button>
    </div>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  function close(){ try { document.body.removeChild(overlay); } catch(_){} }
  card.querySelector('button').addEventListener('click', close);
  card.querySelector('#__cancel').addEventListener('click', close);
  card.querySelector('#__confirm').addEventListener('click', () => {
    const sel = card.querySelector('#__sizeSel').value || sizes[0];
    const key = `${product.id}::${sel}`;
    const qty = cart[key] || 0;
    cart[key] = qty + 1;
    renderCart();
    saveCartToStorage();
    close();
  });
}

function renderCart() {
  const itemsEl = document.getElementById('cartItems');
  const countEl = document.getElementById('cartCount');
  const subtotalEl = document.getElementById('cartSubtotal');
  const items = getCartItems();

  itemsEl.innerHTML = '';
  items.forEach((item) => {
    const product = products.find(p => p.id === item.id);
    const availableStock = Number(product?.stock || 0);
    const canIncrease = item.quantity < availableStock;
    
    const row = document.createElement('div');
    row.className = 'flex gap-3 items-center';
    row.innerHTML = `
      <img src="${item.image}" class="w-16 h-16 rounded-lg object-cover" alt="${item.name}" />
      <div class="flex-1">
        <div class="font-medium">${item.name}</div>
        <div class="text-xs text-slate-500">Size: ${item.sizeSelected}</div>
        <div class="text-sm text-slate-500">${peso(item.price)} each</div>
        <div class="text-xs text-slate-400">Available: ${availableStock} in stock</div>
        <div class="mt-2 inline-flex items-center gap-2">
          <button class="qty-dec px-2 py-1 rounded ring-1 ring-slate-200">-</button>
          <span class="min-w-[24px] text-center">${item.quantity}</span>
          <button class="qty-inc px-2 py-1 rounded ring-1 ring-slate-200 ${!canIncrease ? 'opacity-50 cursor-not-allowed' : ''}" ${!canIncrease ? 'disabled' : ''}>+</button>
          <button class="remove text-xs text-red-500 ml-2">Remove</button>
        </div>
      </div>
      <div class="font-semibold">${peso(item.price * item.quantity)}</div>
    `;

    row.querySelector('.qty-dec').addEventListener('click', () => updateQty(item.cartKey, item.quantity - 1));
    if (canIncrease) {
      row.querySelector('.qty-inc').addEventListener('click', () => updateQty(item.cartKey, item.quantity + 1));
    }
    row.querySelector('.remove').addEventListener('click', () => removeFromCart(item.cartKey));
    itemsEl.appendChild(row);
  });

  const count = items.reduce((s, i) => s + i.quantity, 0);
  countEl.textContent = String(count);
  subtotalEl.textContent = peso(computeSubtotal());
}

// --- Mutations ---
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) { alert('Product not found'); return; }
  const currentStock = Number(product.stock || 0);
  if (currentStock === 0) { alert('This product is out of stock'); return; }
  pickSizeThenAdd(product);
}

function updateQty(cartKey, quantity) {
  const [productId] = String(cartKey).split('::');
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  const currentStock = Number(product.stock || 0);
  
  if (quantity <= 0) {
    delete cart[cartKey];
  } else if (quantity > currentStock) {
    alert(`Only ${currentStock} items available in stock`);
    return;
  } else {
    cart[cartKey] = quantity;
  }
  
  renderCart();
  saveCartToStorage();
}

function removeFromCart(cartKey) {
  delete cart[cartKey];
  renderCart();
  saveCartToStorage();
}

// --- Firestore Checkout ---
async function checkout(customer) {
  const items = getCartItems().map(({ id, name, price, quantity, sizeSelected }) => ({ id, name, price, quantity, size: sizeSelected }));
  if (items.length === 0) return alert('Your cart is empty.');
  
  // Validate stock before checkout
  for (const item of items) {
    const product = products.find(p => p.id === item.id);
    if (!product) {
      alert(`Product ${item.name} not found`);
      return;
    }
    if (Number(product.stock || 0) < item.quantity) {
      alert(`Insufficient stock for ${item.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      return;
    }
  }
  
  const total = computeSubtotal();
  try {
    const { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs } = await ensureFirebaseHelpers();
    
    // Create the order
    await addDoc(collection(firestoreDb, 'orders'), {
      items,
      total,
      customer: customer || null,
      createdAt: serverTimestamp(),
    });
    
    // Update stock quantities in Firestore
    for (const item of items) {
      const productQuery = await getDocs(collection(firestoreDb, 'products'));
      productQuery.forEach(async (docSnap) => {
        const productData = docSnap.data();
        if (productData.id === item.id || docSnap.id === item.id) {
          const newStock = Math.max(0, Number(productData.stock || 0) - item.quantity);
          await updateDoc(doc(firestoreDb, 'products', docSnap.id), {
            stock: newStock
          });
        }
      });
    }
    
    // Update local products array
    items.forEach(item => {
      const product = products.find(p => p.id === item.id);
      if (product) {
        product.stock = Math.max(0, Number(product.stock || 0) - item.quantity);
      }
    });
    
    cart = {};
    renderCart();
    saveCartToStorage();
    renderProducts(); // Re-render products to show updated stock
    alert('Thank you! Your order was placed, wait for the confirmation message via facebook messenger.');
  } catch (err) {
    console.error(err);
    alert('Failed to place order. Please check your internet connection and try again.');
  }
}

// --- Cart Drawer ---
const drawer = document.getElementById('cartDrawer');
document.getElementById('openCart').addEventListener('click', () => {
  drawer.classList.remove('translate-x-full');
});
document.getElementById('closeCart').addEventListener('click', () => {
  drawer.classList.add('translate-x-full');
});
// Checkout flow with details modal
const chkModal = document.getElementById('checkoutModal');
const openCheckoutModal = () => { chkModal.classList.remove('hidden'); chkModal.classList.add('flex'); };
const closeCheckoutModal = () => { chkModal.classList.add('hidden'); chkModal.classList.remove('flex'); };

// Simple CAPTCHA generation and rendering
let __captchaValue = '';
function generateCaptchaValue(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude confusing chars
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function renderCaptchaOnCanvas(value) {
  const canvas = document.getElementById('chkCaptchaCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  // background
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0,0,w,h);
  // noise lines
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(90,39,83,${0.15 + Math.random()*0.2})`;
    ctx.beginPath();
    ctx.moveTo(Math.random()*w, Math.random()*h);
    ctx.lineTo(Math.random()*w, Math.random()*h);
    ctx.stroke();
  }
  // text
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#334155';
  const spacing = w / (value.length + 2);
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const x = spacing*(i+1) + (Math.random()*4-2);
    const y = h/2 + (Math.random()*8-4);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random()*10-5) * Math.PI/180);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  // dots
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(52,63,86,${Math.random()*0.35})`;
    ctx.beginPath();
    ctx.arc(Math.random()*w, Math.random()*h, Math.random()*1.5+0.5, 0, Math.PI*2);
    ctx.fill();
  }
}
function refreshCaptcha() {
  __captchaValue = generateCaptchaValue(6);
  renderCaptchaOnCanvas(__captchaValue);
}

document.getElementById('checkoutBtn').addEventListener('click', () => {
  const items = getCartItems();
  if (!items.length) { alert('Your cart is empty.'); return; }
  // prepare captcha when opening modal
  refreshCaptcha();
  openCheckoutModal();
});

document.getElementById('chkCancel').addEventListener('click', closeCheckoutModal);
document.getElementById('chkCaptchaRefresh').addEventListener('click', refreshCaptcha);
document.getElementById('chkSubmit').addEventListener('click', async () => {
  const name = document.getElementById('chkName').value.trim();
  const phone = document.getElementById('chkPhone').value.trim();
  const address = document.getElementById('chkAddress').value.trim();
  const facebook = document.getElementById('chkFacebook').value.trim();
  const notRobot = document.getElementById('chkNotRobot').checked;
  const honey = (document.getElementById('chkHoney').value || '').trim();
  const captchaInput = document.getElementById('chkCaptchaInput').value.trim().toUpperCase();
  const err = document.getElementById('chkError');
  if (!name || !phone || !address || !notRobot || honey || !captchaInput || captchaInput !== __captchaValue) {
    err.textContent = (!captchaInput || captchaInput !== __captchaValue) ? 'CAPTCHA is incorrect. Please try again.' : 'Please fill in name, phone, address, and confirm you\'re not a robot.';
    err.classList.remove('hidden');
    if (!captchaInput || captchaInput !== __captchaValue) refreshCaptcha();
    return;
  }
  err.classList.add('hidden');
  try {
    await checkout({ name, phone, address, facebook });
    closeCheckoutModal();
    // reset inputs
    document.getElementById('chkName').value = '';
    document.getElementById('chkPhone').value = '';
    document.getElementById('chkAddress').value = '';
    document.getElementById('chkFacebook').value = '';
    document.getElementById('chkNotRobot').checked = false;
    document.getElementById('chkHoney').value = '';
    document.getElementById('chkCaptchaInput').value = '';
  } catch (e) {
    // checkout already alerts; keep modal open for correction
  }
});

// Try loading products from Firestore 'products' collection; fall back to local list
async function tryLoadProductsFromFirestore(){
  try {
    const [{ initializeApp }, { getFirestore, collection, getDocs }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
    ]);
    const app = initializeApp(window.FIREBASE_CONFIG);
    const db = getFirestore(app);
    const snap = await getDocs(collection(db, 'products'));
    const loaded = [];
    snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
    if (loaded.length) {
      products = loaded.map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        category: p.category || 'others',
        stock: Number(p.stock || 0),
        size: Array.isArray(p.size) && p.size.length ? p.size : ['One Size'],
        image: p.image || 'https://placehold.co/600x450/FFFFFF/5A2753?text=Product'
      }));
    }
  } catch (e) {
    // ignore errors (e.g., Firebase not configured); keep default products
  }
}

(async function init(){
  loadCartFromStorage();
  await tryLoadProductsFromFirestore();
  renderProducts();
  // Wire filters if present
  const qEl = document.getElementById('prodSearch');
  const cEl = document.getElementById('prodCategory');
  if (qEl) qEl.addEventListener('input', () => renderProducts());
  if (cEl) cEl.addEventListener('change', () => renderProducts());
  renderCart();
})();

// Expose for debugging if needed
window.addToCart = addToCart;

// Helper for cart item count
function getCartItemCount(){ return getCartItems().reduce((s,i)=>s+i.quantity,0); }
// Intercept back-to-start click
const backBtn = document.getElementById('backToStart');
if (backBtn) {
  backBtn.addEventListener('click', function (ev) {
    if (getCartItemCount() > 0) {
      const ok = confirm('You have items in your cart. Going back will reset your cart. Continue?');
      if (!ok) { ev.preventDefault(); return; }
      // Reset cart if they proceed
      cart = {};
      renderCart();
      saveCartToStorage();
    }
  });
}

// --- Themed Alert System (overrides window.alert without changing messages) ---
// Creates elegant toasts matching the site's mint + plum theme
(function setupThemedAlerts(){
  try {
    const ICONS = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    function createCenteredModal(type, message, ms) {
      const kind = (type || 'info').toLowerCase();
      const icon = ICONS[kind] || ICONS.info;
      const heading = kind === 'success' ? 'Success' : kind === 'error' ? 'Error' : kind === 'warning' ? 'Warning' : 'Info';
      const duration = Math.max(2000, Math.min(12000, ms || (kind === 'error' ? 6000 : 4500)));

      // Overlay
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm';

      // Card
      const card = document.createElement('div');
      card.className = [
        'w-[92%] max-w-md md:max-w-lg',
        'rounded-2xl shadow-2xl ring-1 ring-white/40',
        'bg-gradient-to-br from-[#A8E6CF]/80 to-white/95 backdrop-blur-md',
        'p-6 md:p-8',
        'transition-all duration-300 ease-in-out',
        'scale-95 opacity-0'
      ].join(' ');
      card.innerHTML = `
        <div class="flex items-start gap-4">
          <div class="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/70 ring-1 ring-white/60 flex items-center justify-center text-2xl md:text-3xl text-[#5A2753]">${icon}</div>
          <div class="flex-1">
            <div class="text-lg md:text-xl font-semibold text-[#5A2753]">${heading}</div>
            <div class="mt-1 text-[14px] md:text-[15px] leading-relaxed text-[#2E2E2E]">${String(message || '')}</div>
          </div>
          <button aria-label="Close" class="ml-2 text-[#5A2753]/80 hover:text-[#7A3E6C] transition-colors text-xl leading-none">×</button>
        </div>
      `;

      const closeBtn = card.querySelector('button');
      function hide() {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.96)';
        setTimeout(() => { try { document.body.removeChild(overlay); } catch(_){} }, 220);
      }
      closeBtn.addEventListener('click', hide);
      overlay.addEventListener('click', function(ev){ if (ev.target === overlay) hide(); });

      overlay.appendChild(card);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => {
        card.style.opacity = '1';
        card.style.transform = 'scale(1)';
      });
      setTimeout(hide, duration);
      return overlay;
    }

    // Public helper if pages want to call showAlert directly
    window.showAlert = function(type, message, opts) { return createCenteredModal(type, message, opts && opts.duration); };
    // Override native alert but keep messages/logic identical
    const nativeAlert = window.alert;
    window.alert = function(message) {
      try {
        const msg = String(message || '');
        // Keep checkout confirmation a bit longer
        const isCheckout = /thank you|order|placed|updated/i.test(msg);
        createCenteredModal('info', msg, isCheckout ? 6000 : undefined);
      }
      catch (e) { try { nativeAlert(message); } catch(_) {} }
    };
  } catch (_) { /* no-op */ }
})();






