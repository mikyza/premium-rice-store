/**
 * ====================================================================================
 * PREMIUM MODULE - Coupons, Wishlist, Invoices, Order Tracking, Business Insights,
 *                  Safe Backups and Security Audit
 * ====================================================================================
 * Drop-in module for server.js. No new npm packages are needed.
 *
 *   1. definePremiumModels({ sequelize, DataTypes })   -> call once, BEFORE sequelize.sync()
 *   2. registerPremiumRoutes(deps)                     -> call once, inside startServer()
 *
 * Exposed helpers for the checkout flow:
 *   evaluateCoupon(code, subtotal, userId)  -> { ok, coupon, discount, error }
 *   reserveCoupon(coupon)                   -> boolean (atomic, respects usage limit)
 *   recordRedemption({ coupon, userId, orderId, amount })
 * ====================================================================================
 */
import crypto from 'crypto';
import zlib from 'zlib';
import { once } from 'events';

let M = null; // { Coupon, CouponRedemption, WishlistItem }
let SQ = null;
let OP = null;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `KES ${Math.round(Number(n) || 0).toLocaleString('en-KE')}`;
const toInt = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

/* ------------------------------------------------------------------------------ */
/* 1. MODELS                                                                       */
/* ------------------------------------------------------------------------------ */
export function definePremiumModels({ sequelize, DataTypes }) {
  SQ = sequelize;
  const define = (name, attrs, opts = {}) => sequelize.models[name] || sequelize.define(name, attrs, { timestamps: true, ...opts });

  const Coupon = define('Coupon', {
    code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(200), allowNull: true },
    type: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'percent' }, // percent | fixed
    value: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    minOrder: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    maxDiscount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    usageLimit: { type: DataTypes.INTEGER, allowNull: true },
    perUserLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    startsAt: { type: DataTypes.DATE, allowNull: true },
    expiresAt: { type: DataTypes.DATE, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true }
  });

  const CouponRedemption = define('CouponRedemption', {
    couponId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    orderId: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }
  });

  const WishlistItem = define('WishlistItem', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false }
  }, { indexes: [{ unique: true, fields: ['userId', 'productId'] }] });

  M = { Coupon, CouponRedemption, WishlistItem };
  return M;
}

/* ------------------------------------------------------------------------------ */
/* 2. COUPON ENGINE                                                                */
/* ------------------------------------------------------------------------------ */
const CODE_RE = /^[A-Z0-9_-]{3,40}$/;
export const normalizeCouponCode = (raw) => String(raw ?? '').toUpperCase().replace(/\s+/g, '').trim();

export async function evaluateCoupon(rawCode, subtotal, userId) {
  const code = normalizeCouponCode(rawCode);
  if (!code || !CODE_RE.test(code)) return { ok: false, error: 'Enter a valid coupon code.' };
  const coupon = await M.Coupon.findOne({ where: { code } });
  // One generic message for unknown / inactive so codes cannot be enumerated.
  const generic = { ok: false, error: 'This coupon is not valid.' };
  if (!coupon || !coupon.isActive) return generic;
  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return { ok: false, error: 'This coupon is not active yet.' };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return { ok: false, error: 'This coupon has expired.' };
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, error: 'This coupon has been fully redeemed.' };
  }
  const sub = Number(subtotal) || 0;
  if (sub < Number(coupon.minOrder || 0)) {
    return { ok: false, error: `Spend at least ${money(coupon.minOrder)} to use this coupon.` };
  }
  if (userId) {
    const used = await M.CouponRedemption.count({ where: { couponId: coupon.id, userId } });
    if (used >= (coupon.perUserLimit || 1)) return { ok: false, error: 'You have already used this coupon.' };
  }
  let discount = coupon.type === 'fixed' ? Number(coupon.value) : (sub * Number(coupon.value)) / 100;
  if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
  discount = Math.max(0, Math.min(Math.floor(discount), Math.floor(sub))); // never more than the goods, never negative
  if (discount <= 0) return generic;
  return { ok: true, coupon, discount };
}

/** Atomically takes one use of the coupon. Returns false when the limit was hit by a concurrent order. */
export async function reserveCoupon(coupon) {
  const where = { id: coupon.id, isActive: true };
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) where.usedCount = { [OP.lt]: coupon.usageLimit };
  const col = SQ.getQueryInterface().queryGenerator.quoteIdentifier('usedCount');
  const [affected] = await M.Coupon.update({ usedCount: SQ.literal(`${col} + 1`) }, { where });
  return affected > 0;
}

export async function recordRedemption({ coupon, userId, orderId, amount }) {
  try { await M.CouponRedemption.create({ couponId: coupon.id, userId, orderId, amount }); } catch (e) { console.error('⚠️ Coupon redemption log skipped:', e.message); }
}

/* ------------------------------------------------------------------------------ */
/* 3. ROUTES                                                                       */
/* ------------------------------------------------------------------------------ */
export function registerPremiumRoutes(deps) {
  const {
    expressApp, Op, authenticateToken, requireAdmin, makeRateLimiter, logEvent,
    normalizeKenyanPhone, Order, User, RiceProduct, isProduction, env = process.env
  } = deps;
  OP = Op;
  if (!M) throw new Error('definePremiumModels() must run before registerPremiumRoutes().');
  const { Coupon, CouponRedemption, WishlistItem } = M;

  const byIp = (r) => r.ip || 'unknown';
  const rl = (name, windowMs, max, message, keyFn = byIp) => makeRateLimiter({ name, windowMs, max, keyFn, message });
  const fail = (res, e, status = 500) => { console.error('❌ premium module:', e && e.message); return res.status(status).json({ error: 'Something went wrong. Please try again.' }); };
  const isStaff = (u) => u && (u.role === 'admin' || u.role === 'support');

  /* ---------- Coupons: customer ---------- */
  expressApp.post('/api/coupons/validate', rl('coupon check', 10 * 60 * 1000, 30, 'Too many coupon checks. Please wait a few minutes.'), authenticateToken, async (req, res) => {
    try {
      const { code, subtotal } = req.body || {};
      const r = await evaluateCoupon(code, subtotal, req.user.id);
      if (!r.ok) return res.status(422).json({ valid: false, error: r.error });
      res.json({ valid: true, code: r.coupon.code, type: r.coupon.type, discount: r.discount, description: r.coupon.description || null });
    } catch (e) { fail(res, e); }
  });

  /* ---------- Coupons: admin ---------- */
  const cleanCouponBody = (b, isNew) => {
    const out = {};
    if (isNew || b.code !== undefined) {
      const code = normalizeCouponCode(b.code);
      if (!CODE_RE.test(code)) throw Object.assign(new Error('Code must be 3-40 letters, numbers, - or _.'), { status: 400 });
      out.code = code;
    }
    if (isNew || b.type !== undefined) {
      if (!['percent', 'fixed'].includes(b.type)) throw Object.assign(new Error('Type must be percent or fixed.'), { status: 400 });
      out.type = b.type;
    }
    if (isNew || b.value !== undefined) {
      const v = Number(b.value);
      const type = out.type || b.type;
      if (!Number.isFinite(v) || v <= 0 || (type === 'percent' && v > 100)) throw Object.assign(new Error('Enter a valid discount value (percent must be 1-100).'), { status: 400 });
      out.value = v;
    }
    if (b.description !== undefined) out.description = String(b.description || '').slice(0, 200);
    if (b.minOrder !== undefined) out.minOrder = Math.max(0, Number(b.minOrder) || 0);
    if (b.maxDiscount !== undefined) out.maxDiscount = b.maxDiscount === '' || b.maxDiscount === null ? null : Math.max(0, Number(b.maxDiscount) || 0);
    if (b.usageLimit !== undefined) out.usageLimit = b.usageLimit === '' || b.usageLimit === null ? null : Math.max(1, toInt(b.usageLimit, 1));
    if (b.perUserLimit !== undefined) out.perUserLimit = Math.max(1, toInt(b.perUserLimit, 1));
    if (b.startsAt !== undefined) out.startsAt = b.startsAt ? new Date(b.startsAt) : null;
    if (b.expiresAt !== undefined) out.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
    if (b.isActive !== undefined) out.isActive = !!b.isActive;
    for (const k of ['startsAt', 'expiresAt']) if (out[k] && Number.isNaN(out[k].getTime())) throw Object.assign(new Error('Invalid date supplied.'), { status: 400 });
    return out;
  };

  expressApp.get('/api/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']], limit: 500 });
      const sums = await CouponRedemption.findAll({ attributes: ['couponId', 'amount'], limit: 50000, raw: true });
      const given = {};
      sums.forEach((s) => { given[s.couponId] = (given[s.couponId] || 0) + Number(s.amount || 0); });
      res.json({ coupons: coupons.map((c) => ({ ...c.toJSON(), totalDiscountGiven: given[c.id] || 0 })) });
    } catch (e) { fail(res, e); }
  });

  expressApp.post('/api/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const data = cleanCouponBody(req.body || {}, true);
      if (await Coupon.findOne({ where: { code: data.code } })) return res.status(409).json({ error: 'A coupon with this code already exists.' });
      const c = await Coupon.create({ ...data, createdBy: req.user.id });
      await logEvent({ req, action: 'COUPON_CREATED', category: 'config', targetType: 'coupon', targetId: c.id, summary: `Coupon ${c.code} created (${c.type} ${c.value})` });
      res.status(201).json({ coupon: c });
    } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); fail(res, e); }
  });

  expressApp.put('/api/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const c = await Coupon.findByPk(toInt(req.params.id));
      if (!c) return res.status(404).json({ error: 'Coupon not found.' });
      const data = cleanCouponBody({ ...req.body, type: req.body && req.body.type !== undefined ? req.body.type : c.type }, false);
      if (data.code && data.code !== c.code && await Coupon.findOne({ where: { code: data.code } })) return res.status(409).json({ error: 'A coupon with this code already exists.' });
      await c.update(data);
      await logEvent({ req, action: 'COUPON_UPDATED', category: 'config', targetType: 'coupon', targetId: c.id, summary: `Coupon ${c.code} updated` });
      res.json({ coupon: c });
    } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); fail(res, e); }
  });

  expressApp.delete('/api/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const c = await Coupon.findByPk(toInt(req.params.id));
      if (!c) return res.status(404).json({ error: 'Coupon not found.' });
      const used = await CouponRedemption.count({ where: { couponId: c.id } });
      if (used > 0) { await c.update({ isActive: false }); }
      else { await c.destroy(); }
      await logEvent({ req, action: 'COUPON_REMOVED', category: 'config', severity: 'warn', targetType: 'coupon', targetId: c.id, summary: `Coupon ${c.code} ${used ? 'deactivated (it has history)' : 'deleted'}` });
      res.json({ ok: true, deactivatedOnly: used > 0 });
    } catch (e) { fail(res, e); }
  });

  /* ---------- Wishlist ---------- */
  expressApp.get('/api/wishlist', authenticateToken, async (req, res) => {
    try {
      const rows = await WishlistItem.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']], limit: 200, raw: true });
      res.json({ productIds: rows.map((r) => r.productId) });
    } catch (e) { fail(res, e); }
  });

  expressApp.post('/api/wishlist/:productId', rl('wishlist', 10 * 60 * 1000, 120, 'Slow down a little.'), authenticateToken, async (req, res) => {
    try {
      const productId = toInt(req.params.productId, -1);
      if (productId <= 0) return res.status(400).json({ error: 'Invalid product.' });
      const product = await RiceProduct.findByPk(productId, { attributes: ['id'] });
      if (!product) return res.status(404).json({ error: 'Product not found.' });
      const count = await WishlistItem.count({ where: { userId: req.user.id } });
      if (count >= 200) return res.status(422).json({ error: 'Your wishlist is full (200 items).' });
      await WishlistItem.findOrCreate({ where: { userId: req.user.id, productId } });
      res.status(201).json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  expressApp.delete('/api/wishlist/:productId', authenticateToken, async (req, res) => {
    try {
      await WishlistItem.destroy({ where: { userId: req.user.id, productId: toInt(req.params.productId, -1) } });
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  /* ---------- Printable invoice / receipt ---------- */
  expressApp.get('/api/orders/:id/invoice', authenticateToken, async (req, res) => {
    try {
      const order = await Order.findByPk(toInt(req.params.id, -1));
      // Same answer for "missing" and "not yours" so order numbers cannot be probed.
      if (!order || (order.userId !== req.user.id && !isStaff(req.user))) return res.status(404).json({ error: 'Order not found.' });
      const customer = await User.findByPk(order.userId, { attributes: ['fullName', 'phoneNumber', 'email'] });
      const pd = order.paymentDetails || {};
      const items = Array.isArray(order.items) ? order.items : [];
      const addr = order.shippingAddress && typeof order.shippingAddress === 'object'
        ? (order.shippingAddress.details || [order.shippingAddress.streetAddress, order.shippingAddress.town, order.shippingAddress.county].filter(Boolean).join(', '))
        : String(order.shippingAddress || '');
      const biz = esc(env.BUSINESS_NAME || 'Mwea Rice Hub');
      const rows = items.map((it) => {
        const qty = Number(it.quantity) || 0; const price = Number(it.priceAtPurchase) || 0;
        return `<tr><td>${esc(it.name || it.brandName || 'Item')}</td><td class="r">${qty}</td><td class="r">${money(price)}</td><td class="r">${money(qty * price)}</td></tr>`;
      }).join('');
      const discount = Number(pd.discount) || 0;
      const nonce = crypto.randomBytes(16).toString('base64');
      const paid = pd.isPaid === true;
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice #${esc(order.id)} - ${biz}</title>
<style>
*{box-sizing:border-box}body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:0;background:#f1f5f9}
.sheet{max-width:780px;margin:24px auto;background:#fff;padding:40px;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #047857;padding-bottom:18px}
h1{margin:0;font-size:24px;color:#064e3b}.muted{color:#64748b;font-size:12px}
.tag{display:inline-block;padding:3px 10px;border-radius:99px;font-weight:700;font-size:11px;background:${paid ? '#d1fae5' : '#fef3c7'};color:${paid ? '#065f46' : '#92400e'}}
table{width:100%;border-collapse:collapse;margin-top:22px}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0;padding:8px 6px}
td{padding:10px 6px;border-bottom:1px solid #f1f5f9}.r{text-align:right}
.tot{margin-left:auto;margin-top:18px;width:300px}.tot div{display:flex;justify-content:space-between;padding:4px 0}
.tot .g{border-top:2px solid #0f172a;margin-top:6px;padding-top:8px;font-weight:800;font-size:16px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:22px}
button{margin-top:24px;background:#047857;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer}
@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;padding:0}button{display:none}}
</style></head><body><div class="sheet">
<header><div><h1>${biz}</h1><div class="muted">${esc(env.BUSINESS_ADDRESS || 'Mwea, Kirinyaga County, Kenya')}<br>${esc(env.BUSINESS_PHONE || '')}${env.BUSINESS_PIN ? `<br>KRA PIN: ${esc(env.BUSINESS_PIN)}` : ''}</div></div>
<div style="text-align:right"><div style="font-weight:800;font-size:18px">INVOICE #${esc(order.id)}</div><div class="muted">${esc(new Date(order.createdAt).toLocaleString('en-KE'))}</div><div style="margin-top:6px"><span class="tag">${paid ? 'PAID' : 'UNPAID'}</span></div></div></header>
<div class="grid"><div><div class="muted">BILLED TO</div><strong>${esc(customer && customer.fullName)}</strong><br>${esc(customer && customer.phoneNumber)}<br>${esc(customer && customer.email)}</div>
<div><div class="muted">DELIVER TO</div>${esc(addr)}<br><span class="muted">Status: ${esc(String(order.status || '').replace(/_/g, ' '))}</span></div></div>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot"><div><span>Subtotal</span><span>${money(Number(order.subTotal) + discount)}</span></div>
${discount ? `<div><span>Coupon ${esc(pd.couponCode || '')}</span><span>- ${money(discount)}</span></div>` : ''}
<div><span>Delivery</span><span>${money(order.transportFee)}</span></div>
<div class="g"><span>Total</span><span>${money(order.grandTotal)}</span></div></div>
<p class="muted" style="margin-top:22px">Payment: ${esc(String(pd.method || 'M-Pesa').replace(/_/g, ' '))}${pd.mpesaReceipt ? ` &middot; M-Pesa code ${esc(pd.mpesaReceipt)}` : ''}${pd.paidAt ? ` &middot; paid ${esc(new Date(pd.paidAt).toLocaleString('en-KE'))}` : ''}</p>
<p class="muted">Thank you for shopping with ${biz}.</p>
<button id="p">Print / Save as PDF</button></div>
<script nonce="${nonce}">document.getElementById('p').addEventListener('click',function(){window.print()})</script></body></html>`;
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`
      });
      res.send(html);
    } catch (e) { fail(res, e); }
  });

  /* ---------- Public order tracking (order number + phone) ---------- */
  const lastNine = (raw) => String(normalizeKenyanPhone(raw) || '').slice(-9);
  const STEPS = [
    { key: 'placed', label: 'Order placed' },
    { key: 'paid', label: 'Payment confirmed' },
    { key: 'processing', label: 'Being packed' },
    { key: 'shipped', label: 'Out for delivery' },
    { key: 'delivered', label: 'Delivered' }
  ];
  expressApp.post('/api/orders/track',
    rl('order tracking', 15 * 60 * 1000, 15, 'Too many tracking attempts. Please try again in a few minutes.'),
    rl('order tracking (per order)', 15 * 60 * 1000, 8, 'Too many attempts for this order. Please try later.', (r) => `trk:${toInt(r.body && r.body.orderId, 0)}`),
    async (req, res) => {
      const notFound = () => res.status(404).json({ error: 'We could not find an order matching those details.' });
      try {
        const orderId = toInt(req.body && req.body.orderId, -1);
        const phone9 = lastNine(req.body && req.body.phone);
        if (orderId <= 0 || phone9.length !== 9) return notFound();
        const order = await Order.findByPk(orderId);
        if (!order) return notFound();
        const owner = await User.findByPk(order.userId, { attributes: ['phoneNumber'] });
        const pd = order.paymentDetails || {};
        const matches = [owner && owner.phoneNumber, pd.mpesaNumber].some((p) => p && lastNine(p) === phone9);
        if (!matches) return notFound();
        const status = String(order.status || 'pending');
        const paid = pd.isPaid === true;
        let reached = 0;
        if (paid) reached = 1;
        if (/process|pack|confirm/.test(status)) reached = Math.max(reached, 2);
        if (/ship|dispatch|transit|out/.test(status)) reached = 3;
        if (/deliver|complete/.test(status)) reached = 4;
        const cancelled = /cancel|fail/.test(status);
        res.json({
          orderId: order.id, status, cancelled, paid,
          placedAt: order.createdAt, county: order.county, town: order.town,
          total: Number(order.grandTotal) || 0,
          items: (Array.isArray(order.items) ? order.items : []).map((i) => ({ name: i.name, quantity: i.quantity })),
          timeline: STEPS.map((s, i) => ({ ...s, done: !cancelled && i <= reached }))
        });
      } catch (e) { fail(res, e); }
    });

  /* ---------- Business insights ---------- */
  expressApp.get('/api/admin/analytics/insights', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const days = Math.min(365, Math.max(7, toInt(req.query.days, 90)));
      const now = Date.now();
      const from = new Date(now - days * 86400000);
      const prevFrom = new Date(now - 2 * days * 86400000);
      let rows = await Order.findAll({
        where: { createdAt: { [Op.gte]: prevFrom } },
        attributes: ['id', 'userId', 'items', 'grandTotal', 'transportFee', 'county', 'status', 'paymentDetails', 'createdAt'],
        order: [['createdAt', 'DESC']], limit: 50000
      }).then((list) => list.map((r) => r.get({ plain: true })));
      const isPaid = (o) => !!(o.paymentDetails && o.paymentDetails.isPaid === true);
      const cur = rows.filter((o) => new Date(o.createdAt) >= from);
      const prev = rows.filter((o) => new Date(o.createdAt) < from);
      const paidCur = cur.filter(isPaid); const paidPrev = prev.filter(isPaid);
      const sum = (a) => a.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0);
      const revenue = sum(paidCur); const prevRevenue = sum(paidPrev);

      const prod = {}; const county = {}; const cust = {}; const weekday = Array(7).fill(0); const hour = Array(24).fill(0); const daily = {};
      const EAT = 3 * 3600000;
      for (const o of paidCur) {
        const t = new Date(new Date(o.createdAt).getTime() + EAT);
        weekday[t.getUTCDay()] += Number(o.grandTotal) || 0;
        hour[t.getUTCHours()] += 1;
        const day = t.toISOString().slice(0, 10); daily[day] = (daily[day] || 0) + (Number(o.grandTotal) || 0);
        county[o.county || 'Unknown'] = (county[o.county || 'Unknown'] || 0) + (Number(o.grandTotal) || 0);
        cust[o.userId] = cust[o.userId] || { orders: 0, spent: 0 }; cust[o.userId].orders += 1; cust[o.userId].spent += Number(o.grandTotal) || 0;
        for (const it of (Array.isArray(o.items) ? o.items : [])) {
          const k = it.productId || it.name; prod[k] = prod[k] || { name: it.name, qty: 0, revenue: 0 };
          prod[k].qty += Number(it.quantity) || 0; prod[k].revenue += (Number(it.quantity) || 0) * (Number(it.priceAtPurchase) || 0);
        }
      }
      const topIds = Object.entries(cust).sort((a, b) => b[1].spent - a[1].spent).slice(0, 10).map(([id]) => Number(id));
      const users = topIds.length ? await User.findAll({ where: { id: topIds }, attributes: ['id', 'fullName', 'phoneNumber'], raw: true }) : [];
      const uname = Object.fromEntries(users.map((u) => [u.id, u]));
      const custIds = Object.keys(cust);
      const repeat = custIds.filter((id) => cust[id].orders > 1).length;
      const unpaid = cur.filter((o) => !isPaid(o) && !/cancel/.test(String(o.status)));

      res.json({
        days,
        kpis: {
          revenue, orders: paidCur.length, avgOrderValue: paidCur.length ? Math.round(revenue / paidCur.length) : 0,
          customers: custIds.length, repeatRate: custIds.length ? Math.round((repeat / custIds.length) * 100) : 0,
          growthPct: prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null,
          paymentConversionPct: cur.length ? Math.round((paidCur.length / cur.length) * 100) : 0,
          unpaidValue: sum(unpaid)
        },
        topProducts: Object.values(prod).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
        topCustomers: topIds.map((id) => ({ id, name: uname[id] ? uname[id].fullName : `Customer #${id}`, phone: uname[id] ? uname[id].phoneNumber : null, ...cust[id] })),
        byCounty: Object.entries(county).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, revenue]) => ({ name, revenue })),
        byWeekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, i) => ({ name, revenue: weekday[i] })),
        byHour: hour.map((orders, h) => ({ hour: h, orders })),
        daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }))
      });
    } catch (e) { fail(res, e); }
  });

  /* ---------- Safe database backup (secrets are never exported) ---------- */
  const SECRET_KEY = /pass(word)?|otp|secret|token|2fa|twofactor|hash|challenge|pin$/i;
  expressApp.get('/api/admin/backup/export', rl('backup', 60 * 60 * 1000, 3, 'Backups are limited to 3 per hour.'), authenticateToken, requireAdmin, async (req, res) => {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.set({ 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="backup-${stamp}.json.gz"`, 'Cache-Control': 'no-store' });
      const gz = zlib.createGzip();
      gz.pipe(res);
      const write = async (s) => { if (!gz.write(s)) await once(gz, 'drain'); };
      await write(`{"exportedAt":${JSON.stringify(new Date().toISOString())},"note":"Password hashes, OTPs and tokens are excluded.","tables":{`);
      const names = Object.keys(SQ.models);
      for (let i = 0; i < names.length; i += 1) {
        const model = SQ.models[names[i]];
        const attrs = Object.keys(model.rawAttributes).filter((k) => !SECRET_KEY.test(k));
        await write(`${i ? ',' : ''}${JSON.stringify(names[i])}:[`);
        let offset = 0; let first = true;
        for (;;) {
          const batch = await model.findAll({ attributes: attrs, limit: 2000, offset, order: [[model.primaryKeyAttribute || attrs[0], 'ASC']], raw: true });
          if (!batch.length) break;
          for (const row of batch) { await write(`${first ? '' : ','}${JSON.stringify(row)}`); first = false; }
          offset += batch.length;
          if (offset >= 100000) break;
        }
        await write(']');
      }
      await write('}}');
      gz.end();
      await logEvent({ req, action: 'BACKUP_EXPORTED', category: 'system', severity: 'warn', summary: `Database backup downloaded by ${req.user.fullName || req.user.id}` });
    } catch (e) {
      console.error('❌ backup failed:', e.message);
      if (!res.headersSent) res.status(500).json({ error: 'Backup failed.' }); else res.end();
    }
  });

  /* ---------- Security audit ---------- */
  expressApp.get('/api/admin/security/audit', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const secret = env.JWT_SECRET || '';
      const checks = [
        { id: 'jwt', label: 'Strong JWT secret (32+ characters)', ok: secret.length >= 32, fix: 'Set JWT_SECRET to a random 48+ character value.', weight: 25 },
        { id: 'prod', label: 'Running in production mode', ok: isProduction, fix: 'Set NODE_ENV=production.', weight: 10 },
        { id: 'cors', label: 'CORS restricted to your own domains', ok: !!(env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS.trim()), fix: 'Set ALLOWED_ORIGINS=https://yourstore.com,https://www.yourstore.com', weight: 20 },
        { id: 'https', label: 'Public URL uses HTTPS', ok: /^https:\/\//i.test(env.BASE_URL || ''), fix: 'Set BASE_URL to your https:// address.', weight: 10 },
        { id: 'cb', label: 'Payment callback protected by a secret', ok: !!env.PAYHERO_CALLBACK_SECRET && env.PAYHERO_CALLBACK_SECRET.length >= 24, fix: 'Set PAYHERO_CALLBACK_SECRET to a random 32+ character value.', weight: 15 },
        { id: 'smtp', label: 'Email (OTP / 2-step) is configured', ok: !!(env.EMAIL_USER && env.EMAIL_PASS), fix: 'Set EMAIL_USER and EMAIL_PASS.', weight: 10 },
        { id: 'sentry', label: 'Error monitoring connected', ok: !!env.SENTRY_DSN, fix: 'Set SENTRY_DSN to be alerted about crashes.', weight: 5 },
        { id: 'payhero', label: 'Payment credentials present', ok: !!(env.PAYHERO_BASIC_AUTH || (env.PAYHERO_API_KEY && env.PAYHERO_API_SECRET)), fix: 'Set PayHero credentials.', weight: 5 }
      ];
      const total = checks.reduce((s, c) => s + c.weight, 0);
      const score = Math.round((checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0) / total) * 100);
      const ActivityEvent = SQ.models.ActivityEvent;
      let events = []; const summary = {}; const ips = {};
      if (ActivityEvent) {
        events = await ActivityEvent.findAll({
          where: { createdAt: { [Op.gte]: new Date(Date.now() - 7 * 86400000) }, [Op.or]: [{ category: 'auth' }, { severity: { [Op.in]: ['warn', 'alert'] } }] },
          attributes: ['action', 'severity', 'ipAddress', 'summary', 'createdAt'], order: [['createdAt', 'DESC']], limit: 1000, raw: true
        });
        for (const e of events) {
          summary[e.action] = (summary[e.action] || 0) + 1;
          if (e.ipAddress && /FAIL|LOCK|BLOCK|RATE|UNVERIFIED|UNAUTH/.test(e.action)) ips[e.ipAddress] = (ips[e.ipAddress] || 0) + 1;
        }
      }
      res.json({
        score, grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : 'D', checks,
        last7Days: { byAction: summary, suspiciousIps: Object.entries(ips).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ip, count]) => ({ ip, count })) },
        recent: events.filter((e) => e.severity !== 'info').slice(0, 25)
      });
    } catch (e) { fail(res, e); }
  });

  console.log('💎 Premium module active: coupons, wishlist, invoices, tracking, insights, backup, security audit.');
}
