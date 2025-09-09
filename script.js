// Main shop logic: products rendering, cart, and checkout to Firestore
// Firebase is initialized inline in HTML via window.FIREBASE_CONFIG.
let firebaseApp = null;
let firestoreDb = null;

async function ensureFirebaseHelpers() {
  // Returns { collection, addDoc, serverTimestamp }
  if (window.__fb && firebaseApp && firestoreDb) return window.__fb;
  try {
    const [{ initializeApp }, { getFirestore, collection, addDoc, serverTimestamp }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
    ]);
    if (!firebaseApp) firebaseApp = initializeApp(window.FIREBASE_CONFIG);
    if (!firestoreDb) firestoreDb = getFirestore(firebaseApp);
    window.__fb = { collection, addDoc, serverTimestamp };
    return window.__fb;
  } catch (e) {
    // Retry once in case of transient network failure
    try {
      const [{ initializeApp }, { getFirestore, collection, addDoc, serverTimestamp }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
      ]);
      if (!firebaseApp) firebaseApp = initializeApp(window.FIREBASE_CONFIG);
      if (!firestoreDb) firestoreDb = getFirestore(firebaseApp);
      window.__fb = { collection, addDoc, serverTimestamp };
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
  { id: 'dress-soft-mint', name: 'Soft Mint Dress', price: 899, category: 'clothes', image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Soft+Mint+Dress' },
  { id: 'linen-set-cream', name: 'Cream Linen Set', price: 1199, category: 'clothes', image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Cream+Linen+Set' },
  { id: 'cardigan-plum', name: 'Plum Cardigan', price: 980, category: 'clothes', image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Plum+Cardigan' },
  { id: 'tint-rose', name: 'Velvet Lip Tint – Rose', price: 299, category: 'lip-tint', image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Tint+Rose' },
  { id: 'tint-plum', name: 'Velvet Lip Tint – Plum', price: 299, category: 'lip-tint', image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Tint+Plum' },
  { id: 'tint-mocha', name: 'Velvet Lip Tint – Mocha', price: 299, category: 'lip-tint', image: 'https://placehold.co/600x450/FFFFFF/5A2753?text=Tint+Mocha' },
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
  return Object.entries(cart).map(([id, quantity]) => {
    const p = products.find((x) => x.id === id);
    return { ...p, quantity };
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
    toRender = toRender.filter(p => (p.category||'') === cat);
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
    const card = document.createElement('div');
    card.className = 'group bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden hover:-translate-y-0.5 hover:shadow transition';
    card.innerHTML = `
      <div class="aspect-[4/3] overflow-hidden">
        <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition" />
      </div>
      <div class="p-4">
        <div class="font-medium">${p.name}</div>
        <div class="text-sm text-slate-500">${p.category === 'clothes' ? 'Women\'s apparel' : 'Lip tint'}</div>
        <div class="mt-2 font-semibold">${peso(p.price)}</div>
        <button data-id="${p.id}" class="mt-4 w-full rounded-full bg-plum-500 text-white px-4 py-2 hover:bg-plum-600 transition">Add to Cart</button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
}

function renderCart() {
  const itemsEl = document.getElementById('cartItems');
  const countEl = document.getElementById('cartCount');
  const subtotalEl = document.getElementById('cartSubtotal');
  const items = getCartItems();

  itemsEl.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'flex gap-3 items-center';
    row.innerHTML = `
      <img src="${item.image}" class="w-16 h-16 rounded-lg object-cover" alt="${item.name}" />
      <div class="flex-1">
        <div class="font-medium">${item.name}</div>
        <div class="text-sm text-slate-500">${peso(item.price)}</div>
        <div class="mt-2 inline-flex items-center gap-2">
          <button class="qty-dec px-2 py-1 rounded ring-1 ring-slate-200">-</button>
          <span class="min-w-[24px] text-center">${item.quantity}</span>
          <button class="qty-inc px-2 py-1 rounded ring-1 ring-slate-200">+</button>
          <button class="remove text-xs text-red-500 ml-2">Remove</button>
        </div>
      </div>
      <div class="font-semibold">${peso(item.price * item.quantity)}</div>
    `;

    row.querySelector('.qty-dec').addEventListener('click', () => updateQty(item.id, item.quantity - 1));
    row.querySelector('.qty-inc').addEventListener('click', () => updateQty(item.id, item.quantity + 1));
    row.querySelector('.remove').addEventListener('click', () => removeFromCart(item.id));
    itemsEl.appendChild(row);
  });

  const count = items.reduce((s, i) => s + i.quantity, 0);
  countEl.textContent = String(count);
  subtotalEl.textContent = peso(computeSubtotal());
}

// --- Mutations ---
function addToCart(productId) {
  cart[productId] = (cart[productId] || 0) + 1;
  renderCart();
  saveCartToStorage();
}

function updateQty(productId, quantity) {
  if (quantity <= 0) delete cart[productId];
  else cart[productId] = quantity;
  renderCart();
  saveCartToStorage();
}

function removeFromCart(productId) {
  delete cart[productId];
  renderCart();
  saveCartToStorage();
}

// --- Firestore Checkout ---
async function checkout(customer) {
  const items = getCartItems().map(({ id, name, price, quantity }) => ({ id, name, price, quantity }));
  if (items.length === 0) return alert('Your cart is empty.');
  const total = computeSubtotal();
  try {
    const { collection, addDoc, serverTimestamp } = await ensureFirebaseHelpers();
    await addDoc(collection(firestoreDb, 'orders'), {
      items,
      total,
      customer: customer || null,
      createdAt: serverTimestamp(),
    });
    cart = {};
    renderCart();
    saveCartToStorage();
    alert('Thank you! Your order was placed.');
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
        category: p.category || 'clothes',
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






