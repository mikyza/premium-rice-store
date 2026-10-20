/**
 * ====================================================================================
 * USSD MODULE - shop, create an account, PIN login, checkout with M-Pesa STK, orders
 * ====================================================================================
 * Works with USSD gateways that call your server for every screen (Ping Africa style).
 *
 *   1. defineUssdModels({ sequelize, DataTypes })   -> before sequelize.sync()
 *   2. registerUssdRoutes(deps)                      -> inside startServer()
 *
 * Webhook:  POST  https://<backend>/api/ussd/<USSD_WEBHOOK_SECRET>
 *
 * Design notes
 *  - Orders, coupons and payments go through your REAL endpoints on this same server
 *    (loopback call with a 3-minute token), so stock rules, pricing, delivery fees,
 *    coupons and the PayHero STK push behave exactly like the website. Nothing is duplicated.
 *  - The USSD PIN lives in its own table. It is NOT the web password, so a 4-digit PIN can
 *    never be used to log in on the website.
 *  - The phone number comes from the network (the gateway), so it cannot be typed or faked
 *    by the customer. The webhook itself is protected by a secret.
 * ====================================================================================
 */
import crypto from 'crypto';

const PAGE = 4;
const IDLE_MS = 5 * 60 * 1000;          // a screen older than this starts again at the main menu
const CART_TTL_MS = 24 * 60 * 60 * 1000; // an abandoned cart is kept for a day
const AUTH_MS = 5 * 60 * 1000;           // PIN stays valid for 5 minutes
const PIN_MAX_FAILS = 3;
const PIN_LOCK_MS = 30 * 60 * 1000;
const MAX_CART_LINES = 4; // keeps every screen under the ~182 character USSD limit

const con = (text) => ({ text, end: false });
const end = (text) => ({ text, end: true });
const money = (n) => `KES ${Math.round(Number(n) || 0).toLocaleString('en-KE')}`;
const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}.` : String(s));
const clean = (s, max = 60) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const WEAK_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '3210', '1122', '1212', '2580', '1004', '2000', '1010']);

/* ------------------------------------------------------------------------------ */
/* MODELS                                                                          */
/* ------------------------------------------------------------------------------ */
export function defineUssdModels({ sequelize, DataTypes }) {
  const define = (name, attrs, opts = {}) => sequelize.models[name] || sequelize.define(name, attrs, { timestamps: true, ...opts });
  // Note: no DEFAULT values on JSON/TEXT columns (MySQL rejects them); the engine always sets them.
  const UssdPin = define('UssdPin', {
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    pinHash: { type: DataTypes.STRING(100), allowNull: false },
    failedAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lockedUntil: { type: DataTypes.DATE, allowNull: true }
  });
  const UssdState = define('UssdState', {
    msisdn: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    sessionId: { type: DataTypes.STRING(120), allowNull: true },
    step: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'main' },
    data: { type: DataTypes.JSON, allowNull: true },
    cart: { type: DataTypes.JSON, allowNull: true },
    authedUntil: { type: DataTypes.DATE, allowNull: true },
    lastAt: { type: DataTypes.DATE, allowNull: true }
  });
  return { UssdPin, UssdState };
}

/* ------------------------------------------------------------------------------ */
/* ENGINE (pure logic; every outside effect is injected so it can be tested)       */
/* ------------------------------------------------------------------------------ */
export function createUssdEngine(deps) {
  const {
    State, Pin, bcrypt, findUserByPhone, createUser, listOrders, internal, sendSms, sendEmailOtp,
    log = async () => {}, env = {}, now = () => Date.now()
  } = deps;

  const BRAND = env.BUSINESS_NAME || 'Mwea Rice Hub';
  const SUPPORT = env.SUPPORT_PHONE || env.BUSINESS_PHONE || '';
  const SHORTCODE = env.USSD_SHORTCODE || '';
  const limiter = new Map();
  const hit = (key, max, windowMs) => {
    const t = now(); const arr = (limiter.get(key) || []).filter((x) => t - x < windowMs);
    arr.push(t); limiter.set(key, arr);
    if (limiter.size > 5000) { for (const [k, v] of limiter) if (!v.length || t - v[v.length - 1] > windowMs) limiter.delete(k); }
    return arr.length <= max;
  };

  /* ---------- cached reads from your own API ---------- */
  const cache = {};
  const cached = async (key, ttl, loader) => {
    const c = cache[key];
    if (c && now() - c.at < ttl) return c.v;
    const v = await loader(); cache[key] = { at: now(), v }; return v;
  };
  const getCatalog = () => cached('catalog', 45 * 1000, async () => {
    const r = await internal('/api/products/catalog');
    const list = Array.isArray(r.data) ? r.data : [];
    return list
      .filter((p) => p.isAvailable !== false && Number(p.stockQuantity) > 0)
      .map((p) => ({
        id: Number(p.id),
        short: clean(`${p.brandName || 'Rice'} ${p.weightKg ? `${p.weightKg}kg` : ''}`, 28),
        full: clean(`${p.brandName || 'Rice'} ${p.variety || ''} ${p.weightKg ? `${p.weightKg}kg` : ''}`, 50),
        price: Number(p.price) || 0,
        stock: Number(p.stockQuantity) || 0,
        tiers: Array.isArray(p.wholesaleTiers) ? p.wholesaleTiers : []
      }))
      .filter((p) => p.price > 0);
  });
  const getCounties = () => cached('counties', 5 * 60 * 1000, async () => { const r = await internal('/api/config/counties'); return r.data && typeof r.data === 'object' ? r.data : {}; });
  const getHierarchy = () => cached('hierarchy', 5 * 60 * 1000, async () => { const r = await internal('/api/config/locations'); return r.data && typeof r.data === 'object' ? r.data : {}; });

  const unitPrice = (p, qty) => {
    const tier = (p.tiers || []).filter((t) => Number(t.minQty) > 1 && Number(t.price) > 0 && qty >= Number(t.minQty)).sort((a, b) => Number(b.minQty) - Number(a.minQty))[0];
    return tier && Number(tier.price) < p.price ? Number(tier.price) : p.price;
  };

  /* ---------- cart helpers ---------- */
  async function pricedCart(cart) {
    const catalog = await getCatalog();
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const lines = []; let dropped = false;
    for (const l of cart || []) {
      const p = byId.get(Number(l.productId));
      if (!p) { dropped = true; continue; }
      const qty = Math.min(Number(l.qty) || 0, p.stock);
      if (qty < 1) { dropped = true; continue; }
      if (qty !== Number(l.qty)) dropped = true;
      lines.push({ productId: p.id, qty, name: p.short, unit: unitPrice(p, qty), stock: p.stock });
    }
    return { lines, subtotal: lines.reduce((s, l) => s + l.unit * l.qty, 0), changed: dropped };
  }
  const addToCart = (cart, productId, qty) => {
    const c = [...(cart || [])];
    const i = c.findIndex((l) => Number(l.productId) === Number(productId));
    if (i >= 0) c[i] = { productId, qty: Number(c[i].qty) + qty }; else c.push({ productId, qty });
    return c.slice(0, MAX_CART_LINES);
  };

  /* ---------- matching helpers (typing a county / town) ---------- */
  const matchList = (query, list) => {
    const q = norm(query); if (q.length < 2) return [];
    const exact = list.filter((x) => norm(x) === q); if (exact.length) return exact.slice(0, 1);
    const starts = list.filter((x) => norm(x).startsWith(q));
    if (starts.length) return starts.slice(0, 5);
    return list.filter((x) => norm(x).includes(q)).slice(0, 5);
  };
  const numbered = (items, fmt = (x) => x) => items.map((x, i) => `${i + 1}. ${fmt(x)}`).join('\n');

  /* ---------- PIN handling ---------- */
  const pinProblem = (pin, phone) => {
    if (!/^\d{4}$/.test(pin)) return 'PIN must be exactly 4 digits.';
    if (WEAK_PINS.has(pin) || /^(\d)\1{3}$/.test(pin)) return 'That PIN is too easy to guess. Choose another.';
    if (phone && String(phone).slice(-4) === pin) return 'Do not use the last digits of your phone number.';
    return null;
  };
  async function checkPin(user, pin) {
    const row = await Pin.findOne({ where: { userId: user.id } });
    if (!row) return { ok: false, reason: 'nopin' };
    const t = now();
    if (row.lockedUntil && new Date(row.lockedUntil).getTime() > t) return { ok: false, reason: 'locked', mins: Math.ceil((new Date(row.lockedUntil).getTime() - t) / 60000) };
    if (await bcrypt.compare(pin, row.pinHash)) {
      if (row.failedAttempts) await row.update({ failedAttempts: 0, lockedUntil: null });
      return { ok: true };
    }
    const fails = (row.failedAttempts || 0) + 1;
    if (fails >= PIN_MAX_FAILS) {
      await row.update({ failedAttempts: 0, lockedUntil: new Date(t + PIN_LOCK_MS) });
      await log({ action: 'USSD_PIN_LOCKED', severity: 'alert', user, summary: `USSD PIN locked for ${user.phoneNumber} after ${PIN_MAX_FAILS} wrong attempts` });
      return { ok: false, reason: 'locked', mins: Math.ceil(PIN_LOCK_MS / 60000) };
    }
    await row.update({ failedAttempts: fails });
    await log({ action: 'USSD_PIN_FAILED', severity: 'warn', user, summary: `Wrong USSD PIN for ${user.phoneNumber} (attempt ${fails})` });
    return { ok: false, reason: 'wrong', left: PIN_MAX_FAILS - fails };
  }
  const hasPin = async (user) => !!(await Pin.findOne({ where: { userId: user.id } }));

  /* ---------- order labels ---------- */
  const isPaid = (o) => !!(o.paymentDetails && o.paymentDetails.isPaid === true);
  const statusLabel = (o) => {
    const st = String(o.status || '').toLowerCase();
    if (/cancel|fail/.test(st)) return 'Cancelled';
    if (!isPaid(o)) return 'Unpaid';
    if (/deliver|complete/.test(st)) return 'Delivered';
    if (/ship|dispatch|transit/.test(st)) return 'On the way';
    if (/process|pack|confirm/.test(st)) return 'Packing';
    return 'Paid';
  };

  const mainItems = async (user) => {
    if (!user) return ['shop', 'cart', 'signup', 'help'];
    const items = ['shop', 'cart'];
    const last = await listOrders(user.id, 1);
    if (last.length) items.push('reorder');
    items.push('orders', 'account', 'help');
    return items;
  };
  const LABEL = { shop: 'Shop rice', cart: 'My cart', signup: 'Create account', reorder: 'Reorder last order', orders: 'My orders', account: 'My account', help: 'Help & delivery fees' };

  /* =============================== SCREENS =============================== */
  async function renderMain(c, prefix = '') {
    const items = await mainItems(c.user);
    c.s.data.menu = items;
    const cartN = (c.s.cart || []).reduce((n, l) => n + Number(l.qty || 0), 0);
    const greet = c.user ? `Hi ${clip(String(c.user.fullName || '').split(' ')[0] || 'there', 14)}` : 'Karibu';
    const lines = items.map((k, i) => `${i + 1}. ${LABEL[k]}${k === 'cart' && cartN ? ` (${cartN})` : ''}`);
    c.s.step = 'main';
    return con(`${prefix}${BRAND}\n${greet}\n${lines.join('\n')}`);
  }

  async function renderShop(c, prefix = '') {
    const catalog = await getCatalog();
    if (!catalog.length) { c.s.step = 'shop'; return con(`${prefix}No rice is available right now. Please try later.\n0. Menu`); }
    const page = Math.max(0, Number(c.s.data.page) || 0);
    const slice = catalog.slice(page * PAGE, page * PAGE + PAGE);
    c.s.data.shopIds = slice.map((p) => p.id);
    const more = catalog.length > (page + 1) * PAGE;
    c.s.step = 'shop';
    return con(`${prefix}Choose rice:\n${numbered(slice, (p) => `${clip(p.short, 20)} ${Math.round(p.price)}`)}\n${more ? '98. More\n' : ''}0. ${page ? 'Back' : 'Menu'}`);
  }

  async function renderCart(c, prefix = '') {
    const pc = await pricedCart(c.s.cart);
    c.s.cart = pc.lines.map((l) => ({ productId: l.productId, qty: l.qty }));
    c.s.step = 'cart';
    if (!pc.lines.length) return con(`${prefix}Your cart is empty.\n1. Shop rice\n0. Menu`);
    const body = pc.lines.map((l, i) => `${i + 1}) ${l.qty}x ${clip(l.name, 18)} ${Math.round(l.unit * l.qty)}`).join('\n');
    return con(`${prefix}${pc.changed ? 'Cart updated to current stock.\n' : ''}${body}\nTotal ${money(pc.subtotal)}\n1.Checkout 2.Remove\n3.Clear 4.Add more 0.Menu`);
  }

  async function renderConfirm(c, prefix = '') {
    const pc = await pricedCart(c.s.cart);
    const counties = await getCounties();
    const fee = counties[c.s.data.county] !== undefined ? Number(counties[c.s.data.county]) : 250;
    const disc = c.s.data.coupon ? Number(c.s.data.coupon.discount) : 0;
    const total = Math.max(0, pc.subtotal - disc) + fee;
    c.s.data.quote = { subtotal: pc.subtotal, fee, disc, total };
    c.s.step = 'ck_confirm';
    return con(`${prefix}Items ${Math.round(pc.subtotal)}${disc ? `\nCoupon -${Math.round(disc)}` : ''}\nDelivery ${Math.round(fee)} (${clip(c.s.data.county, 14)})\nTotal ${money(total)}\nPay: ${c.s.data.payPhone}\n1.Confirm & pay\n2.Cancel${disc ? '' : ' 3.Coupon'}`);
  }

  /* ---------- flows that need a signed-in customer ---------- */
  const needPin = async (c, after) => {
    if (!(await hasPin(c.user))) { c.s.data.mode = 'setpin'; c.s.data.after = after; c.s.step = 'su_pin'; return con('Set a 4-digit PIN to protect your account.\nEnter new PIN:'); }
    if (c.s.authedUntil && new Date(c.s.authedUntil).getTime() > now()) return goAfter(c, after);
    c.s.data.after = after; c.s.step = 'pin';
    return con('Enter your 4-digit PIN:\n(00 = forgot PIN, 0 = cancel)');
  };

  async function goAfter(c, after) {
    switch (after) {
      case 'checkout': return startAddress(c);
      case 'orders': return renderOrders(c);
      case 'account': return renderAccount(c);
      default: return renderMain(c);
    }
  }

  async function startCheckout(c) {
    const pc = await pricedCart(c.s.cart);
    c.s.cart = pc.lines.map((l) => ({ productId: l.productId, qty: l.qty }));
    if (!pc.lines.length) return renderCart(c, 'Your cart is empty.\n');
    if (!c.user) { c.s.step = 'ck_noacct'; return con('Create a free account to order.\n1. Create account\n0. Back'); }
    c.s.data.payPhone = c.msisdn;
    return needPin(c, 'checkout');
  }

  async function startAddress(c) {
    const last = (await listOrders(c.user.id, 1))[0];
    if (last && last.county && last.county !== 'Not Specified' && last.town) {
      const street = last.shippingAddress && last.shippingAddress.streetAddress && last.shippingAddress.streetAddress !== 'Not Specified' ? last.shippingAddress.streetAddress : '';
      c.s.data.last = { county: last.county, town: last.town, street };
      c.s.step = 'ck_last';
      return con(`Deliver to ${clip(last.town, 20)}, ${clip(last.county, 16)}?\n1. Yes\n2. Another address\n0. Back`);
    }
    c.s.step = 'ck_county';
    return con('Enter your county (e.g. Kirinyaga):\n0. Back');
  }

  async function renderOrders(c) {
    const orders = await listOrders(c.user.id, 5);
    c.s.step = 'orders';
    if (!orders.length) return con('You have no orders yet.\n0. Menu');
    c.s.data.orderIds = orders.map((o) => o.id);
    return con(`Your orders:\n${numbered(orders, (o) => `#${o.id} ${Math.round(o.grandTotal)} ${statusLabel(o)}`)}\n0. Menu`);
  }

  async function renderAccount(c) {
    c.s.step = 'account';
    return con(`${clip(c.user.fullName, 24)}\nPoints: ${Number(c.user.rewardPoints || 0).toFixed(0)}\n1. Change PIN\n0. Menu`);
  }

  async function placeOrder(c) {
    const pc = await pricedCart(c.s.cart);
    if (!pc.lines.length) return renderCart(c, 'Your cart is empty.\n');
    if (!hit(`order:${c.msisdn}`, 5, 24 * 3600 * 1000)) return end('Order limit reached for today. Please call us or use our website.');
    const body = {
      cartItems: pc.lines.map((l) => ({ productId: l.productId, quantity: l.qty })),
      paymentMethod: 'mpesa_stk',
      mpesaPhoneNumber: c.s.data.payPhone || c.msisdn,
      county: c.s.data.county,
      town: c.s.data.town,
      location: c.s.data.town,
      streetAddress: c.s.data.street || undefined,
      couponCode: c.s.data.coupon ? c.s.data.coupon.code : undefined
    };
    const r = await internal('/api/orders/create', { method: 'POST', user: c.user, body });
    if (r.status === 201 && r.data && r.data.id) {
      const o = r.data;
      c.s.cart = [];
      await log({ action: 'USSD_ORDER_PLACED', user: c.user, targetType: 'order', targetId: o.id, summary: `Order #${o.id} placed over USSD for KES ${o.grandTotal}` });
      const paid = `KES ${Math.round(o.grandTotal)}`;
      return end(o.stkPromptSent
        ? `Order #${o.id} placed (${paid}).\nEnter your M-Pesa PIN on the prompt sent to ${c.s.data.payPhone || c.msisdn}.\nWe will SMS you when paid. Asante!`
        : `Order #${o.id} placed (${paid}).\nM-Pesa prompt could not be sent. Dial ${SHORTCODE || 'us'} > My orders > Pay now.`);
    }
    const msg = r.data && r.data.error ? String(r.data.error) : '';
    if (r.status === 422) { c.s.step = 'cart'; return renderCart(c, `${clip(msg || 'Some items are no longer available.', 80)}\n`); }
    if (r.status === 400 && msg) return end(clip(msg, 150));
    return end('Sorry, we could not place your order. Please try again shortly.');
  }

  /* ============================ INPUT ROUTER ============================ */
  async function route(c) {
    const { s, input: raw } = c;
    const input = clean(raw, 80);
    const d = s.data;

    switch (s.step) {
      /* ---------- main ---------- */
      case 'main': {
        const items = d.menu || (await mainItems(c.user));
        const pick = items[Number(input) - 1];
        if (!pick) return renderMain(c, 'Invalid choice.\n');
        if (pick === 'shop') { d.page = 0; return renderShop(c); }
        if (pick === 'cart') return renderCart(c);
        if (pick === 'signup') { d.mode = 'new'; d.after = 'main'; s.step = 'su_name'; return con('Welcome to ' + BRAND + '!\nEnter your full name:'); }
        if (pick === 'reorder') {
          const last = (await listOrders(c.user.id, 1))[0];
          let cart = s.cart || [];
          for (const it of (last && Array.isArray(last.items) ? last.items : [])) cart = addToCart(cart, Number(it.productId), Number(it.quantity) || 1);
          s.cart = cart;
          return renderCart(c, 'Added from your last order.\n');
        }
        if (pick === 'orders') return needPin(c, 'orders');
        if (pick === 'account') return needPin(c, 'account');
        if (pick === 'help') { s.step = 'help'; return con('Help\n1. Delivery fee by county\n2. Contact us\n0. Menu'); }
        return renderMain(c);
      }

      /* ---------- shopping ---------- */
      case 'shop': {
        const catalog = await getCatalog();
        if (input === '0') { if (Number(d.page) > 0) { d.page -= 1; return renderShop(c); } return renderMain(c); }
        if (input === '98' && catalog.length > (Number(d.page) + 1) * PAGE) { d.page = Number(d.page) + 1; return renderShop(c); }
        const id = (d.shopIds || [])[Number(input) - 1];
        const p = catalog.find((x) => x.id === id);
        if (!p) return renderShop(c, 'Invalid choice.\n');
        d.pid = p.id; s.step = 'qty';
        const tier = (p.tiers || []).filter((t) => Number(t.minQty) > 1 && Number(t.price) < p.price).sort((a, b) => Number(a.minQty) - Number(b.minQty))[0];
        return con(`${clip(p.full, 40)}\n${money(p.price)} each | ${p.stock} in stock${tier ? `\nBuy ${tier.minQty}+: ${money(tier.price)} each` : ''}\nEnter quantity (1-${Math.min(p.stock, 1000)}):\n0. Back`);
      }
      case 'qty': {
        if (input === '0') return renderShop(c);
        const p = (await getCatalog()).find((x) => x.id === Number(d.pid));
        if (!p) return renderShop(c, 'That item just sold out.\n');
        const qty = Number(input);
        const inCart = (s.cart || []).find((l) => Number(l.productId) === p.id);
        const have = inCart ? Number(inCart.qty) : 0;
        if (!/^\d{1,4}$/.test(input) || qty < 1) return con(`Enter a whole number from 1 to ${Math.min(p.stock, 1000)}:\n0. Back`);
        if (qty + have > p.stock || qty > 1000) return con(`Only ${Math.max(0, p.stock - have)} more available.\nEnter quantity:\n0. Back`);
        if (!inCart && (s.cart || []).length >= MAX_CART_LINES) return con(`Your cart is full (${MAX_CART_LINES} items). Checkout first.\n0. Back`);
        s.cart = addToCart(s.cart, p.id, qty);
        const pc = await pricedCart(s.cart);
        s.step = 'after_add';
        return con(`Added ${qty} x ${clip(p.short, 22)}\nCart total ${money(pc.subtotal)}\n1. Add more rice\n2. Checkout\n3. View cart\n0. Menu`);
      }
      case 'after_add':
        if (input === '1') { d.page = 0; return renderShop(c); }
        if (input === '2') return startCheckout(c);
        if (input === '3') return renderCart(c);
        if (input === '0') return renderMain(c);
        return con('Invalid choice.\n1. Add more rice\n2. Checkout\n3. View cart\n0. Menu');
      case 'cart': {
        if (!(s.cart || []).length) { if (input === '1') { d.page = 0; return renderShop(c); } return renderMain(c); }
        if (input === '1') return startCheckout(c);
        if (input === '2') { s.step = 'cart_remove'; return con(`Remove which item? (1-${s.cart.length})\n0. Back`); }
        if (input === '3') { s.cart = []; return renderCart(c, 'Cart cleared.\n'); }
        if (input === '4') { d.page = 0; return renderShop(c); }
        if (input === '0') return renderMain(c);
        return renderCart(c, 'Invalid choice.\n');
      }
      case 'cart_remove': {
        if (input === '0') return renderCart(c);
        const i = Number(input) - 1;
        if (!Number.isInteger(i) || i < 0 || i >= (s.cart || []).length) return con(`Enter a number from 1 to ${s.cart.length}:\n0. Back`);
        s.cart = s.cart.filter((_, k) => k !== i);
        return renderCart(c, 'Item removed.\n');
      }

      /* ---------- account creation (also used to add a PIN to an existing web account) ---------- */
      case 'ck_noacct':
        if (input === '1') { d.mode = 'new'; d.after = 'checkout'; s.step = 'su_name'; return con('Enter your full name:'); }
        return renderCart(c);
      case 'su_name': {
        if (input === '0') return renderMain(c);
        if (!/^[A-Za-z][A-Za-z .'-]{1,58}$/.test(input) || input.length < 3) return con('Please enter your real full name (letters only).\n0. Cancel');
        d.name = input; s.step = 'su_pin';
        return con('Create a 4-digit PIN. You will use it to order and view orders.\nEnter PIN:');
      }
      case 'su_pin': {
        if (input === '0' && d.mode !== 'setpin') return renderMain(c);
        const problem = pinProblem(input, c.msisdn);
        if (problem) return con(`${problem}\nEnter a 4-digit PIN:`);
        d.newPinHash = await bcrypt.hash(input, 10);
        s.step = 'su_pin2';
        return con('Confirm your PIN (enter it again):');
      }
      case 'su_pin2': {
        if (!d.newPinHash || !(await bcrypt.compare(input, d.newPinHash))) { s.step = 'su_pin'; delete d.newPinHash; return con('PINs did not match.\nEnter a new 4-digit PIN:'); }
        if (d.mode === 'new') { s.step = 'su_terms'; return con('Accept our Terms & Conditions?\n(Read them on our website)\n1. Yes, create account\n2. No'); }
        return finishPin(c, d.mode === 'reset' ? 'PIN reset. ' : d.mode === 'change' ? 'PIN changed. ' : 'PIN set. ');
      }
      case 'su_terms': {
        if (input !== '1') return renderMain(c, 'Account not created.\n');
        let user = c.user;
        if (!user) {
          try { user = await createUser({ phone: c.msisdn, fullName: d.name }); }
          catch (e) { console.error('USSD signup failed:', e.message); return end('Sorry, we could not create your account. Please try again.'); }
          await log({ action: 'USSD_ACCOUNT_CREATED', user, summary: `Account created over USSD for ${c.msisdn}` });
          sendSms(c.msisdn, `Welcome to ${BRAND}, ${clip(d.name.split(' ')[0], 20)}! Your account is ready${SHORTCODE ? `. Dial ${SHORTCODE} to order rice anytime` : ''}.`).catch(() => {});
        }
        c.user = user;
        const row = await Pin.findOne({ where: { userId: user.id } });
        if (row) await row.update({ pinHash: d.newPinHash, failedAttempts: 0, lockedUntil: null }); else await Pin.create({ userId: user.id, pinHash: d.newPinHash, failedAttempts: 0, lockedUntil: null });
        delete d.newPinHash;
        s.authedUntil = new Date(now() + AUTH_MS);
        const after = d.after; d.after = null;
        return after === 'checkout' ? startCheckout(c) : renderMain(c, 'Account created!\n');
      }

      /* ---------- PIN entry ---------- */
      case 'pin': {
        if (input === '0') return renderMain(c);
        if (input === '00') return startForgot(c);
        if (!/^\d{4}$/.test(input)) return con('PIN must be 4 digits.\nEnter your PIN:\n(00 = forgot PIN, 0 = cancel)');
        const r = await checkPin(c.user, input);
        if (r.ok) { s.authedUntil = new Date(now() + AUTH_MS); const after = d.after; d.after = null; return goAfter(c, after); }
        if (r.reason === 'locked') return end(`Your PIN is locked for ${r.mins} min after too many wrong tries. ${SUPPORT ? `Call ${SUPPORT} for help.` : 'Try again later.'}`);
        return con(`Wrong PIN. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.\nEnter your PIN:\n(00 = forgot PIN)`);
      }

      /* ---------- forgot PIN (code sent to the email on the account) ---------- */
      case 'fp_code': {
        if (input === '0') return renderMain(c);
        d.fpTries = (d.fpTries || 0) + 1;
        if (d.fpTries > 3) return end('Too many wrong codes. Please start again.');
        const ok = d.fpHash && d.fpExp > now() && crypto.createHash('sha256').update(`${c.msisdn}:${input}`).digest('hex') === d.fpHash;
        if (!ok) return con(`Wrong or expired code.\nEnter the 6-digit code:\n0. Cancel`);
        d.mode = 'reset'; d.after = 'main'; delete d.fpHash; s.step = 'su_pin';
        return con('Code accepted.\nCreate a new 4-digit PIN:');
      }

      /* ---------- change PIN ---------- */
      case 'account':
        if (input === '1') { s.step = 'cp_old'; return con('Enter your current PIN:\n0. Cancel'); }
        return renderMain(c);
      case 'cp_old': {
        if (input === '0') return renderMain(c);
        const r = await checkPin(c.user, input);
        if (r.ok) { d.mode = 'change'; s.step = 'su_pin'; return con('Enter your new 4-digit PIN:'); }
        if (r.reason === 'locked') return end(`PIN locked for ${r.mins} min.`);
        return con(`Wrong PIN. ${r.left} left.\nEnter current PIN:\n0. Cancel`);
      }

      /* ---------- delivery details ---------- */
      case 'ck_last':
        if (input === '1') { Object.assign(d, { county: d.last.county, town: d.last.town, street: d.last.street }); s.step = 'ck_pay'; return con(`Pay with M-Pesa on:\n1. ${c.msisdn}\n2. Another number\n0. Back`); }
        if (input === '2') { s.step = 'ck_county'; return con('Enter your county (e.g. Kirinyaga):\n0. Back'); }
        return renderCart(c);
      case 'ck_county': {
        if (input === '0') return renderCart(c);
        const counties = Object.keys(await getCounties());
        const m = matchList(input, counties);
        if (!m.length) return con('County not found. Check spelling.\nEnter your county (e.g. Nairobi):\n0. Back');
        if (m.length === 1) { d.county = m[0]; s.step = 'ck_town'; return con(`Enter your town/area in ${clip(m[0], 20)}:\n0. Back`); }
        d.countyOptions = m; s.step = 'ck_county_pick';
        return con(`Select county:\n${numbered(m)}\n0. Retype`);
      }
      case 'ck_county_pick': {
        const pick = (d.countyOptions || [])[Number(input) - 1];
        if (input === '0' || !pick) { s.step = 'ck_county'; return con('Enter your county:\n0. Back'); }
        d.county = pick; s.step = 'ck_town';
        return con(`Enter your town/area in ${clip(pick, 20)}:\n0. Back`);
      }
      case 'ck_town': {
        if (input === '0') { s.step = 'ck_county'; return con('Enter your county:\n0. Back'); }
        if (!/^[A-Za-z0-9][A-Za-z0-9 .,'-]{1,39}$/.test(input)) return con('Enter a town or area name (2-40 letters).\n0. Back');
        const towns = Array.isArray((await getHierarchy())[d.county]) ? (await getHierarchy())[d.county].map(String) : [];
        const m = matchList(input, towns);
        if (m.length === 1) { d.town = m[0]; s.step = 'ck_street'; return con('Landmark / estate / street (helps the rider).\nEnter it, or 0 to skip:'); }
        if (m.length > 1) { d.townOptions = m; s.step = 'ck_town_pick'; return con(`Select area:\n${numbered(m)}\n0. Retype`); }
        d.townTyped = input; s.step = 'ck_town_confirm';
        return con(`Use "${clip(input, 30)}" as your delivery area?\n1. Yes\n2. Retype`);
      }
      case 'ck_town_pick': {
        const pick = (d.townOptions || [])[Number(input) - 1];
        if (input === '0' || !pick) { s.step = 'ck_town'; return con(`Enter your town/area in ${clip(d.county, 20)}:\n0. Back`); }
        d.town = pick; s.step = 'ck_street';
        return con('Landmark / estate / street (helps the rider).\nEnter it, or 0 to skip:');
      }
      case 'ck_town_confirm':
        if (input === '1') { d.town = d.townTyped; s.step = 'ck_street'; return con('Landmark / estate / street (helps the rider).\nEnter it, or 0 to skip:'); }
        s.step = 'ck_town'; return con(`Enter your town/area in ${clip(d.county, 20)}:\n0. Back`);
      case 'ck_street': {
        if (input === '0') d.street = '';
        else if (input.length < 3) return con('Too short. Enter a landmark/estate/street,\nor 0 to skip:');
        else d.street = input;
        s.step = 'ck_pay';
        return con(`Pay with M-Pesa on:\n1. ${c.msisdn}\n2. Another number\n0. Back`);
      }
      case 'ck_pay': {
        if (input === '0') return renderCart(c);
        if (input === '1') { d.payPhone = c.msisdn; return renderConfirm(c); }
        if (input === '2') { s.step = 'ck_paynum'; return con('Enter the M-Pesa number (e.g. 0712345678):\n0. Back'); }
        return con(`Invalid choice.\n1. ${c.msisdn}\n2. Another number\n0. Back`);
      }
      case 'ck_paynum': {
        if (input === '0') return renderCart(c);
        const p = deps.normalizePhone(input);
        if (!p) return con('Not a valid Safaricom number.\nEnter e.g. 0712345678:\n0. Back');
        d.payPhone = p; return renderConfirm(c);
      }
      case 'ck_coupon': {
        if (input === '0') return renderConfirm(c);
        const pc = await pricedCart(s.cart);
        const r = await internal('/api/coupons/validate', { method: 'POST', user: c.user, body: { code: input, subtotal: pc.subtotal } });
        if (r.status === 200 && r.data && r.data.valid) { d.coupon = { code: r.data.code, discount: Number(r.data.discount) }; return renderConfirm(c, `Coupon ${r.data.code} applied!\n`); }
        return con(`${clip((r.data && r.data.error) || 'Coupon not valid.', 90)}\nEnter coupon code:\n0. Back`);
      }
      case 'ck_confirm': {
        if (input === '1') return placeOrder(c);
        if (input === '2') { d.coupon = null; return renderMain(c, 'Checkout cancelled. Your cart is saved.\n'); }
        if (input === '3' && !d.coupon) { s.step = 'ck_coupon'; return con('Enter your coupon code:\n0. Back'); }
        return renderConfirm(c, 'Invalid choice.\n');
      }

      /* ---------- orders ---------- */
      case 'orders': {
        if (input === '0') return renderMain(c);
        const id = (d.orderIds || [])[Number(input) - 1];
        const o = (await listOrders(c.user.id, 5)).find((x) => x.id === id);
        if (!o) return renderOrders(c);
        d.orderId = o.id; d.orderPaid = isPaid(o); d.orderCancelled = statusLabel(o) === 'Cancelled';
        const items = (Array.isArray(o.items) ? o.items : []).map((i) => `${i.quantity}x ${clip(String(i.name).replace(/\s*\(.*?\)\s*$/, ''), 16)}`).join(', ');
        s.step = 'order_view';
        const action = d.orderCancelled ? '' : d.orderPaid ? '\n1. SMS me the details' : '\n1. Pay now (M-Pesa)';
        return con(`Order #${o.id}: ${statusLabel(o)}\n${clip(items, 60)}\nTotal ${money(o.grandTotal)}${action}\n0. Back`);
      }
      case 'order_view': {
        if (input === '0') return renderOrders(c);
        const o = (await listOrders(c.user.id, 5)).find((x) => x.id === d.orderId);
        if (!o || input !== '1' || d.orderCancelled) return renderOrders(c);
        if (d.orderPaid) {
          const items = (Array.isArray(o.items) ? o.items : []).map((i) => `${i.quantity}x ${i.name}`).join(', ');
          sendSms(c.msisdn, `${BRAND} order #${o.id}: ${items}. Total ${money(o.grandTotal)}. Status: ${statusLabel(o)}.`).catch(() => {});
          return end('Order details sent to your phone by SMS.');
        }
        if (!hit(`pay:${c.msisdn}`, 4, 30 * 60 * 1000)) return end('Too many payment prompts. Please wait a while and try again.');
        const r = await internal('/api/payments/stkpush', { method: 'POST', user: c.user, body: { orderId: o.id, phoneNumber: c.msisdn } });
        return end(r.status === 200 && r.data && r.data.success
          ? `M-Pesa prompt sent to ${c.msisdn} for ${money(o.grandTotal)}. Enter your M-Pesa PIN.`
          : 'We could not send the M-Pesa prompt right now. Please try again shortly.');
      }

      /* ---------- help ---------- */
      case 'help': {
        if (input === '1') { s.step = 'help_fee'; return con('Enter your county to see the delivery fee:\n0. Back'); }
        if (input === '2') return end(`${BRAND}\n${SUPPORT ? `Call/WhatsApp: ${SUPPORT}\n` : ''}${env.SUPPORT_EMAIL || env.EMAIL_USER || ''}\nWe deliver countrywide. Pay by M-Pesa.`);
        return renderMain(c);
      }
      case 'help_fee': {
        if (input === '0') { s.step = 'help'; return con('Help\n1. Delivery fee by county\n2. Contact us\n0. Menu'); }
        const counties = await getCounties();
        const m = matchList(input, Object.keys(counties));
        if (!m.length) return con('County not found.\nEnter county name:\n0. Back');
        return con(`Delivery to ${m[0]}: ${money(counties[m[0]])}\nEnter another county or 0 to go back:`);
      }
      default:
        return renderMain(c);
    }
  }

  async function finishPin(c, note) {
    const { s } = c;
    const user = c.user;
    const row = await Pin.findOne({ where: { userId: user.id } });
    if (row) await row.update({ pinHash: s.data.newPinHash, failedAttempts: 0, lockedUntil: null });
    else await Pin.create({ userId: user.id, pinHash: s.data.newPinHash, failedAttempts: 0, lockedUntil: null });
    delete s.data.newPinHash;
    s.authedUntil = new Date(now() + AUTH_MS);
    sendSms(c.msisdn, `${BRAND}: your USSD PIN was ${s.data.mode === 'reset' ? 'reset' : s.data.mode === 'change' ? 'changed' : 'set'}. If this was not you, call us immediately.`).catch(() => {});
    await log({ action: 'USSD_PIN_CHANGED', user, severity: 'warn', summary: `USSD PIN ${s.data.mode} for ${c.msisdn}` });
    const after = s.data.after; s.data.after = null;
    if (after === 'checkout') return startCheckout(c);
    if (after && after !== 'main') return goAfter(c, after);
    return renderMain(c, note);
  }

  async function startForgot(c) {
    const email = c.user.email && String(c.user.email).includes('@') ? String(c.user.email) : '';
    if (!email) return end(`We cannot reset your PIN by USSD because no email is saved on your account. ${SUPPORT ? `Call ${SUPPORT}.` : 'Please contact customer care.'}`);
    if (!hit(`fp:${c.msisdn}`, 3, 60 * 60 * 1000)) return end('Too many reset requests. Please try again in an hour.');
    const code = String(crypto.randomInt(100000, 1000000));
    c.s.data.fpHash = crypto.createHash('sha256').update(`${c.msisdn}:${code}`).digest('hex');
    c.s.data.fpExp = now() + 10 * 60 * 1000; c.s.data.fpTries = 0;
    try { await sendEmailOtp(email, c.user.fullName, code); }
    catch (e) { console.error('USSD reset email failed:', e.message); return end('We could not send the reset code. Please try again later.'); }
    const [name, host] = email.split('@');
    c.s.step = 'fp_code';
    return con(`A 6-digit code was emailed to ${name.slice(0, 2)}***@${host}.\nEnter the code:\n0. Cancel`);
  }

  /* ============================== ENTRY POINT ============================== */
  // One request at a time per phone, so a gateway retry or a double tap can never place an order twice.
  const chains = new Map();
  function handle(req) {
    const prev = chains.get(req.msisdn) || Promise.resolve();
    const run = prev.catch(() => {}).then(() => handleOne(req));
    chains.set(req.msisdn, run);
    run.finally(() => { if (chains.get(req.msisdn) === run) chains.delete(req.msisdn); }).catch(() => {});
    return run;
  }

  async function handleOne({ msisdn, sessionId, input, isNew }) {
    const t = now();
    let row = await State.findOne({ where: { msisdn } });
    if (!row) row = await State.create({ msisdn, sessionId: sessionId || null, step: 'main', data: {}, cart: [], authedUntil: null, lastAt: new Date(t) });

    const lastAt = row.lastAt ? new Date(row.lastAt).getTime() : 0;
    const stale = !lastAt || t - lastAt > IDLE_MS || (sessionId && row.sessionId && row.sessionId !== sessionId);
    const s = {
      step: isNew || stale ? 'main' : row.step,
      data: isNew || stale ? {} : { ...(row.data || {}) },
      cart: lastAt && t - lastAt > CART_TTL_MS ? [] : [...(Array.isArray(row.cart) ? row.cart : [])],
      authedUntil: isNew || stale ? null : row.authedUntil
    };
    const user = await findUserByPhone(msisdn);
    const c = { msisdn, s, user, input };

    let reply;
    try {
      if (user && ['admin', 'support'].includes(user.staffRole || user.role)) reply = end('Staff accounts cannot use USSD. Please use the website.');
      else if (user && user.isActive === false) reply = end('Your account is suspended. Please contact customer care.');
      else if (!hit(`rate:${msisdn}`, 90, 10 * 60 * 1000)) reply = end('Too many requests. Please try again in a few minutes.');
      else reply = isNew || stale ? await renderMain(c) : await route(c);
    } catch (e) {
      console.error('USSD error:', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
      reply = end('Sorry, something went wrong. Please dial again.');
    }
    if (reply.text.length > 182) reply = { ...reply, text: reply.text.slice(0, 181) + '.' };

    const done = reply.end;
    await row.update({
      sessionId: sessionId || row.sessionId || null,
      step: done ? 'main' : s.step,
      data: done ? {} : s.data,
      cart: s.cart,
      authedUntil: s.authedUntil,
      lastAt: new Date(t)
    });
    return reply;
  }

  return { handle };
}

/* ------------------------------------------------------------------------------ */
/* GATEWAY ADAPTER (accepts the common USSD request styles, replies in kind)       */
/* ------------------------------------------------------------------------------ */
const lower = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [String(k).toLowerCase(), v]));
const pick = (o, keys) => { for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && String(v) !== '') return { key: k, value: String(v) }; } return { key: null, value: '' }; };
const NEW_TYPES = new Set(['initiate', 'initiation', 'new', 'begin', 'start', '1', 'true', 'ussd_new', 'request', 'open']);

export function parseGatewayRequest(body = {}, query = {}) {
  const o = lower({ ...query, ...body });
  const session = pick(o, ['sessionid', 'session_id', 'session', 'transactionid', 'ussd_session_id', 'sid', 'sessionidentifier']);
  const phone = pick(o, ['phonenumber', 'msisdn', 'phone', 'phone_number', 'mobile', 'mobilenumber', 'subscriber', 'sourceaddress', 'from', 'customer_msisdn']);
  const text = pick(o, ['text', 'ussdstring', 'ussd_string', 'userdata', 'userinput', 'input', 'ussdinput', 'message', 'msg', 'response', 'answer', 'content']);
  const type = pick(o, ['type', 'msgtype', 'event', 'ussdtype', 'requesttype', 'operation', 'session_event']);
  let input = text.value.trim();
  // Africa's-Talking style sends everything typed so far joined by '*': only the last answer is new.
  if (text.key === 'text' && input.includes('*')) input = input.split('*').pop().trim();
  const typeVal = type.value.toLowerCase();
  const dial = /^\*[\d*#]+#?$/.test(input);
  const isNew = dial || (typeVal ? NEW_TYPES.has(typeVal) && !input : false) || (!input && !/^(2|response|continue|cont|false|reply)$/.test(typeVal));
  return {
    sessionId: session.value,
    msisdn: phone.value,
    input: dial ? '' : input,
    isNew,
    style: o.text !== undefined || o.phonenumber !== undefined ? 'text' : 'json'
  };
}

export function formatGatewayReply(reply, req, parsed, env = {}) {
  const forced = String(env.USSD_RESPONSE_FORMAT || '').toLowerCase();
  const asJson = forced ? forced === 'json' : (parsed.style === 'json' && /json/i.test(String(req.headers['content-type'] || '')));
  if (!asJson) return { type: 'text/plain; charset=utf-8', body: `${reply.end ? 'END' : 'CON'} ${reply.text}` };
  return {
    type: 'application/json; charset=utf-8',
    body: JSON.stringify({
      message: reply.text, response: reply.text, text: reply.text, msg: reply.text, ussdMessage: reply.text,
      continueSession: !reply.end, action: reply.end ? 'end' : 'con', type: reply.end ? 'end' : 'continue',
      MSGTYPE: !reply.end, MSG: reply.text, sessionId: parsed.sessionId, msisdn: parsed.msisdn, status: 'success'
    })
  };
}

/* ------------------------------------------------------------------------------ */
/* EXPRESS ROUTE                                                                   */
/* ------------------------------------------------------------------------------ */
export function registerUssdRoutes(deps) {
  const {
    expressApp, models, axios, jwt, JWT_SECRET, pwVersion, bcrypt, logEvent, normalizeKenyanPhone,
    findUserByPhone, createUser, Order, sendSmsRaw, sendOtpEmail, isProduction, env = process.env
  } = deps;
  const { UssdPin, UssdState } = models;

  const port = env.PORT || 5000;
  const base = (env.USSD_INTERNAL_BASE || `http://127.0.0.1:${port}`).replace(/\/$/, '');
  const fakeIp = (msisdn) => { const h = crypto.createHash('md5').update(msisdn).digest(); return `10.${h[0]}.${h[1]}.${h[2] || 1}`; };

  // Calls this same server (so the website's own rules are used), as the customer, for a few minutes only.
  const internal = async (path, { method = 'GET', user = null, body } = {}) => {
    const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': user ? fakeIp(String(user.phoneNumber)) : '10.0.0.1' };
    if (user) headers.Authorization = `Bearer ${jwt.sign({ id: user.id, role: 'customer', pv: pwVersion(user) }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '3m' })}`;
    try {
      const r = await axios({ url: `${base}${path}`, method, data: body, headers, timeout: 25000, validateStatus: () => true });
      return { status: r.status, data: r.data };
    } catch (e) { return { status: 599, data: { error: e.message } }; }
  };

  const engine = createUssdEngine({
    State: UssdState, Pin: UssdPin, bcrypt, internal, env,
    findUserByPhone,
    createUser,
    normalizePhone: normalizeKenyanPhone,
    listOrders: (userId, limit) => Order.findAll({ where: { userId }, order: [['createdAt', 'DESC']], limit }).then((rows) => rows.map((r) => r.get({ plain: true }))),
    sendSms: (to, msg) => sendSmsRaw(to, msg),
    sendEmailOtp: (email, name, code) => sendOtpEmail(email, name, code, 'reset'),
    log: ({ action, severity = 'info', user, targetType = null, targetId = null, summary }) =>
      logEvent({ actor: { id: user ? user.id : null, role: 'customer', name: user ? user.fullName : null }, action, category: 'auth', severity, targetType, targetId, summary })
  });

  const mask = (v) => { const s = String(v); return s.length <= 2 ? '*'.repeat(s.length) : `${s[0]}${'*'.repeat(Math.min(8, s.length - 2))}${s[s.length - 1]}`; };
  const safeEq = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  let lastWarn = 0;

  const handler = async (req, res) => {
    const reply = (text, endIt = true, status = 200) => res.status(status).type('text/plain').send(`${endIt ? 'END' : 'CON'} ${text}`);
    try {
      const secret = env.USSD_WEBHOOK_SECRET || '';
      if (!secret) {
        if (isProduction) return reply('USSD is not configured yet.', true, 503);
      } else {
        const given = req.params.secret || req.query.key || req.headers['x-ussd-token'] || '';
        if (!safeEq(given, secret)) {
          if (Date.now() - lastWarn > 60000) {
            lastWarn = Date.now();
            logEvent({ req, actor: { id: null, role: 'anonymous', name: null }, action: 'USSD_WEBHOOK_REJECTED', category: 'auth', severity: 'alert', summary: 'A USSD request with a wrong or missing secret was rejected' });
          }
          return res.status(401).type('text/plain').send('Unauthorized');
        }
      }
      const allow = String(env.USSD_ALLOWED_IPS || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (allow.length && !allow.includes(req.ip)) return res.status(403).type('text/plain').send('Forbidden');

      const { key: _k, ...query } = req.query || {};
      const parsed = parseGatewayRequest(req.body || {}, query);
      if (String(env.USSD_DEBUG).toLowerCase() === 'true') {
        console.log('🔎 USSD request fields:', Object.fromEntries(Object.entries({ ...query, ...(req.body || {}) }).map(([k, v]) => [k, mask(v)])), '| parsed:', { isNew: parsed.isNew, style: parsed.style, hasSession: !!parsed.sessionId, hasPhone: !!parsed.msisdn, inputLen: parsed.input.length });
      }
      const msisdn = normalizeKenyanPhone(parsed.msisdn);
      if (!msisdn) { const out = formatGatewayReply({ text: 'We could not read your phone number. Please try again.', end: true }, req, parsed, env); return res.status(200).type(out.type).send(out.body); }

      const result = await engine.handle({ msisdn, sessionId: parsed.sessionId, input: parsed.input, isNew: parsed.isNew });
      const out = formatGatewayReply(result, req, parsed, env);
      res.status(200).type(out.type).send(out.body);
    } catch (e) {
      console.error('❌ USSD webhook error:', e && e.message);
      reply('Sorry, something went wrong. Please dial again.');
    }
  };

  expressApp.all(['/api/ussd', '/api/ussd/:secret'], handler);
  console.log(`📟 USSD module active${env.USSD_WEBHOOK_SECRET ? '' : ' (WARNING: USSD_WEBHOOK_SECRET not set)'}. Webhook: /api/ussd/<secret>`);
}
