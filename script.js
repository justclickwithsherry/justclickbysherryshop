// Main shop logic: products rendering, cart, and checkout to Firestore
// Firebase is initialized inline in HTML via window.FIREBASE_CONFIG.
let firebaseApp = null;
let firestoreDb = null;

// --- Product Catalog (clothes + lip tints) ---
const products = [
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
  products.forEach((p) => {
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
}

function updateQty(productId, quantity) {
  if (quantity <= 0) delete cart[productId];
  else cart[productId] = quantity;
  renderCart();
}

function removeFromCart(productId) {
  delete cart[productId];
  renderCart();
}

// --- Firestore Checkout ---
async function checkout() {
  const items = getCartItems().map(({ id, name, price, quantity }) => ({ id, name, price, quantity }));
  if (items.length === 0) return alert('Your cart is empty.');
  const total = computeSubtotal();
  try {
    // Lazy-load Firebase only on checkout
    if (!firebaseApp || !firestoreDb) {
      const [{ initializeApp }, { getFirestore, collection, addDoc, serverTimestamp }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
      ]);
      firebaseApp = initializeApp(window.FIREBASE_CONFIG);
      firestoreDb = getFirestore(firebaseApp);
      // attach helpers to window for reuse
      window.__fb = { collection, addDoc, serverTimestamp };
    }
    const { collection, addDoc, serverTimestamp } = window.__fb;
    await addDoc(collection(firestoreDb, 'orders'), {
      items,
      total,
      createdAt: serverTimestamp(),
    });
    cart = {};
    renderCart();
    alert('Thank you! Your order was placed.');
  } catch (err) {
    console.error(err);
    alert('Failed to place order. Please try again.');
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
document.getElementById('checkoutBtn').addEventListener('click', checkout);

// Init
renderProducts();
renderCart();

// Expose for debugging if needed
window.addToCart = addToCart;


