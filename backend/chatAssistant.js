/**
 * ====================================================================================
 * MWEA RICE HUB — SELF-HOSTED CHAT ASSISTANT (backend)
 * ====================================================================================
 * No Claude, no OpenAI, no third-party AI. Everything runs inside your own server:
 *  - chatBrain.js understands English / Swahili / typos (intent scoring, entity extraction)
 *  - this file runs the SALES CONVERSATION: choose rice -> quantity -> county/town -> review
 *    -> pay (M-Pesa STK prompt, or Till/Paybill + code) -> order saved in the customer's account
 *  - every price, stock level, delivery fee and total comes from YOUR database, computed by
 *    the server (the same code /api/orders/create uses), never guessed.
 *  - buying requires a signed-in customer; the user id always comes from the login token.
 *
 * It LEARNS from use (all learning is gated so one customer cannot poison it):
 *  1. Every message is logged with the topic it matched and its confidence.
 *  2. Questions it could not answer are grouped for the admin, who types the answer once
 *     (Admin > Chat AI) and it answers that from then on.
 *  3. If a customer rephrases an unknown question by tapping an option, the phrase is
 *     remembered as a candidate and becomes active after TWO different customers confirm it.
 *  4. New nicknames for a rice ("pisori", "ya pilau") are linked to the rice customers pick,
 *     and become active after two different customers do the same.
 *  5. Thumbs-down on an answer sends that question back to the admin; repeated thumbs-down
 *     switches an admin-taught answer off automatically.
 *
 * It SCALES safely: when usage grows it PROPOSES new tables (daily stats, rice demand,
 * returning-customer preferences, message archive). Nothing is created until an admin
 * approves it, by typing the table name, in Admin > Chat AI. Only "chat_" tables built
 * from a validated whitelist of column types can ever be created; nothing is dropped.
 * ====================================================================================
 */
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as B from './chatBrain.js';

const DEFAULT_SETTINGS = {
  assistantName: 'Wanjiru',
  businessHours: 'Monday to Saturday, 8:00 AM to 6:00 PM (East Africa Time)',
  supportPhone: '',
  whatsapp: '',
  deliveryTimes: {
    default: '3 to 5 working days',
    byCounty: {
      Kirinyaga: 'same day or next day',
      Nairobi: 'same-day dispatch, usually delivered within 1 to 2 working days',
      Kiambu: 'same-day dispatch, usually delivered within 1 to 2 working days',
      Embu: '1 to 2 working days', "Murang'a": '1 to 2 working days', Nyeri: '1 to 2 working days', Machakos: '1 to 2 working days',
      Meru: '2 to 3 working days', Nakuru: '2 to 3 working days', Mombasa: '3 to 4 working days', Kisumu: '3 to 4 working days',
      Mandera: '5 to 7 working days', Wajir: '5 to 7 working days', Turkana: '5 to 7 working days'
    }
  },
  // One per line, "question | answer". The assistant uses these straight away.
  extraKnowledge: ''
};

export function registerChatAssistant(app, deps) {
  const {
    User, Order, RiceProduct, Delivery, SystemConfig, JWT_SECRET, flashSaleState,
    authenticateToken, requireAdmin, getBulkConfig, bulkRuleFor, bulkTransportFor,
    getPaymentConfig, getOps, evaluatePromo, getWholesaleTiers, bestTier,
    resolveLocationName, getOrderItems, round2, countyOverrides, logisticsHierarchy, logEvent,
    sequelize, DataTypes, Op, port, normalizeKenyanPhone
  } = deps;

  // ======================================================================== tables (auto-created, never touch existing ones)
  const def = (name, attrs, opts = {}) => sequelize.models[name] || sequelize.define(name, attrs, { timestamps: true, ...opts });
  const ChatSession = def('ChatSession', {
    id: { type: DataTypes.STRING(40), primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    state: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    lastActiveAt: { type: DataTypes.DATE, allowNull: true }
  });
  const ChatLog = def('ChatLog', {
    sessionId: { type: DataTypes.STRING(40), allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    role: { type: DataTypes.STRING(10), allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    intent: { type: DataTypes.STRING(40), allowNull: true },
    confidence: { type: DataTypes.FLOAT, allowNull: true },
    handled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    signature: { type: DataTypes.STRING(120), allowNull: true },
    source: { type: DataTypes.STRING(16), allowNull: true }, // intent | stage | knowledge | button | fallback
    knowledgeId: { type: DataTypes.INTEGER, allowNull: true },
    feedback: { type: DataTypes.INTEGER, allowNull: true },  // 1 helpful, -1 not helpful
    resolved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    meta: { type: DataTypes.JSON, allowNull: true }
  }, { indexes: [{ fields: ['sessionId'] }, { fields: ['createdAt'] }, { fields: ['handled', 'signature'] }] });
  const ChatKnowledge = def('ChatKnowledge', {
    question: { type: DataTypes.TEXT, allowNull: false },
    answer: { type: DataTypes.TEXT, allowNull: true },
    intent: { type: DataTypes.STRING(40), allowNull: true },       // learned: "this phrase means <intent>"
    source: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'admin' }, // admin | learned
    status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'active' }, // active | candidate | off
    hits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    upVotes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    downVotes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    voters: { type: DataTypes.JSON, allowNull: true }
  });
  const ChatTerm = def('ChatTerm', {
    term: { type: DataTypes.STRING(60), allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    uses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    voters: { type: DataTypes.JSON, allowNull: true },
    status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'candidate' } // candidate | active | off
  }, { indexes: [{ fields: ['term'] }] });
  const ChatSchemaProposal = def('ChatSchemaProposal', {
    tableName: { type: DataTypes.STRING(60), allowNull: false },
    title: { type: DataTypes.STRING(160), allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    evidence: { type: DataTypes.JSON, allowNull: true },
    spec: { type: DataTypes.JSON, allowNull: false },
    sqlPreview: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pending' }, // pending | applied | rejected | failed
    decidedBy: { type: DataTypes.INTEGER, allowNull: true },
    decidedAt: { type: DataTypes.DATE, allowNull: true },
    note: { type: DataTypes.STRING(300), allowNull: true }
  });

  const classifier = new B.IntentClassifier(B.SEED_INTENTS);
  let knowledgeCache = [];   // active admin Q&A + parsed owner notes
  let termCache = new Map(); // learned word -> productId
  const ready = (async () => {
    for (const M of [ChatSession, ChatLog, ChatKnowledge, ChatTerm, ChatSchemaProposal]) await M.sync();
    await refreshLearning();
  })().catch((e) => console.error('❌ Chat tables could not be prepared:', e.message));

  // ======================================================================== settings (admin editable)
  async function getSettings() {
    let stored = {};
    try { const row = await SystemConfig.findOne({ where: { key: 'chat_settings' } }); stored = (row && row.value) || {}; } catch (_) { /* table not ready */ }
    const dt = stored.deliveryTimes || {};
    return {
      ...DEFAULT_SETTINGS, ...stored,
      deliveryTimes: { default: dt.default || DEFAULT_SETTINGS.deliveryTimes.default, byCounty: { ...DEFAULT_SETTINGS.deliveryTimes.byCounty, ...(dt.byCounty || {}) } }
    };
  }
  const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

  async function refreshLearning() {
    try {
      const rows = await ChatKnowledge.findAll({ where: { status: 'active' } });
      knowledgeCache = rows.map((r) => r.toJSON());
      rows.filter((r) => r.intent && r.source === 'learned').forEach((r) => classifier.addExample(r.intent, r.question, 0.9, true));
      classifier.rebuild();
      const s = await getSettings();
      String(s.extraKnowledge || '').split('\n').forEach((line, i) => {
        const [q, ...a] = line.split('|');
        if (q && a.length && q.trim().length > 3) knowledgeCache.push({ id: -(i + 1), question: q.trim(), answer: a.join('|').trim(), source: 'notes', status: 'active' });
      });
      const terms = await ChatTerm.findAll({ where: { status: 'active' } });
      termCache = new Map(terms.map((t) => [t.term, t.productId]));
    } catch (e) { console.error('Chat learning refresh failed:', e.message); }
  }
  setInterval(() => { refreshLearning(); }, 10 * 60 * 1000).unref?.();

  // ======================================================================== catalog + pricing helpers
  const effectivePrice = (p) => {
    let price = Number(p.basePrice != null ? p.basePrice : p.price) || 0;
    if (flashSaleState && flashSaleState.active && p.flashSalePrice !== null && p.flashSalePrice !== undefined) price = Number(p.flashSalePrice);
    return price;
  };
  const stockLabel = (n) => (Number(n) <= 0 ? 'out of stock' : Number(n) <= 10 ? `only ${n} left` : 'in stock');
  const loadCatalog = async () => (await RiceProduct.findAll()).filter((p) => p.isAvailable !== false);
  const cardOf = (p, cfg) => {
    const price = effectivePrice(p); const kg = Number(p.weightKg) || 0;
    const rule = cfg ? bulkRuleFor(cfg, p.id) : null;
    return {
      id: p.id, name: p.brandName, variety: p.variety || null, bagKg: kg, priceKes: price,
      perKg: kg > 0 ? round2(price / kg) : null, stock: stockLabel(p.stockQuantity), inStock: Number(p.stockQuantity) > 0,
      flash: !!(flashSaleState && flashSaleState.active && p.flashSalePrice != null),
      bulk: cfg && cfg.enabled && rule && rule.discountPercent > 0 ? `${rule.discountPercent}% off from ${rule.minKg}kg` : null,
      image: p.imageUrl || p.image || null
    };
  };
  const countyFeeMap = async () => {
    let stored = {};
    try { const row = await SystemConfig.findOne({ where: { key: 'county_overrides' } }); stored = (row && row.value) || {}; } catch (_) { /* ignore */ }
    return { ...(countyOverrides || {}), ...stored };
  };
  const deliveryTimeFor = (settings, county) => {
    const key = resolveLocationName(county, Object.keys(settings.deliveryTimes.byCounty || {}));
    return (key && settings.deliveryTimes.byCounty[key]) || settings.deliveryTimes.default;
  };

  /** Finds a county (and town) inside free text: "deliver to kitengela", "nakuru town", "Murang'a" */
  async function findPlace(text) {
    const map = await countyFeeMap();
    const counties = Object.keys(map);
    const words = B.normalize(text).replace(/\bcounty\b|\btown\b/g, ' ').split(' ').filter((w) => w.length > 1);
    const grams = [];
    for (let n = 3; n >= 1; n -= 1) for (let i = 0; i + n <= words.length; i += 1) grams.push(words.slice(i, i + n).join(' '));
    let county = null;
    for (const g of grams) { county = resolveLocationName(g, counties); if (county) break; }
    if (!county) for (const g of grams) { if (g.length < 5) continue; county = counties.find((c) => B.fuzzyEq(B.normalize(c).replace(/\s/g, ''), g.replace(/\s/g, ''))) || null; if (county) break; }
    let town = null;
    const hier = logisticsHierarchy || {};
    const search = county ? [county] : Object.keys(hier);
    for (const c of search) {
      const areas = Array.isArray(hier[c]) ? hier[c] : [];
      for (const g of grams) { const hit = resolveLocationName(g, areas); if (hit && B.normalize(hit) !== B.normalize(c)) { town = hit; if (!county) county = canonicalKey(map, c); break; } }
      if (town) break;
    }
    return { county, town, map };
  }
  const canonicalKey = (map, name) => resolveLocationName(name, Object.keys(map)) || name;

  // ---- price a basket exactly the way /api/orders/create will (server does the arithmetic, never the user)
  async function priceBasket(basket, { county, promoCode, userId, settings }) {
    const cfg = await getBulkConfig(); const tiers = await getWholesaleTiers();
    const lines = []; let subtotal = 0; let anyBulk = false; const issues = [];
    for (const it of basket) {
      const product = await RiceProduct.findByPk(Number(it.productId));
      const qty = Math.round(Number(it.quantity));
      if (!product || product.isAvailable === false || !(qty >= 1)) { issues.push(`${it.name || 'An item'} is no longer available.`); continue; }
      let price = effectivePrice(product); const notes = [];
      const tier = bestTier(tiers[product.id], qty);
      if (tier && Number(tier.price) < price) { price = Number(tier.price); notes.push('quantity price'); }
      const kg = (Number(product.weightKg) || 0) * qty; const rule = bulkRuleFor(cfg, product.id);
      const lineBulk = it.bulk === true && cfg.enabled && kg >= rule.minKg;
      if (lineBulk) {
        anyBulk = true;
        const bp = round2(price * (1 - rule.discountPercent / 100));
        if (rule.discountPercent > 0 && bp < price) { price = bp; notes.push(`${rule.discountPercent}% bulk discount`); }
      } else if (Number(product.stockQuantity) < qty) {
        issues.push(Number(product.stockQuantity) <= 0 ? `${product.brandName} is out of stock.` : `Only ${product.stockQuantity} bags of ${product.brandName} are left.`);
      }
      const lineTotal = round2(price * qty); subtotal += lineTotal;
      lines.push({ productId: product.id, name: product.brandName, bagKg: Number(product.weightKg) || 0, quantity: qty, unit: price, total: lineTotal, kg, bulk: lineBulk, notes });
    }
    subtotal = round2(subtotal);
    const out = { lines, subtotal, discount: 0, promo: null, issues, anyBulk };
    if (promoCode) {
      const pr = await evaluatePromo(promoCode, userId || null, subtotal);
      out.promo = { code: pr.code || String(promoCode).toUpperCase(), valid: !!pr.valid, message: pr.message };
      if (pr.valid) out.discount = pr.discount;
    }
    out.net = round2(subtotal - out.discount);
    if (county) {
      const map = await countyFeeMap(); const canon = resolveLocationName(county, Object.keys(map));
      if (canon) {
        let fee = Number(map[canon]);
        if (anyBulk) { const bf = bulkTransportFor(cfg, canon); if (bf !== undefined && Number.isFinite(bf)) fee = bf; }
        out.county = canon; out.delivery = fee; out.total = round2(out.net + fee); out.eta = deliveryTimeFor(settings, canon);
      }
    }
    return out;
  }
  const summaryText = (q, lang) => {
    const L = q.lines.map((l) => `- ${l.quantity} x ${l.name}${l.bagKg ? ` ${l.bagKg}kg` : ''} @ ${money(l.unit)} = ${money(l.total)}${l.notes.length ? ` (${l.notes.join(', ')})` : ''}`);
    L.push(`${lang === 'sw' ? 'Jumla ya mchele' : 'Rice subtotal'}: ${money(q.subtotal)}`);
    if (q.discount) L.push(`${lang === 'sw' ? 'Punguzo' : 'Promo'} ${q.promo.code}: -${money(q.discount)}`);
    if (q.delivery !== undefined) { L.push(`${lang === 'sw' ? 'Usafiri' : 'Delivery'} (${q.county}): ${money(q.delivery)}`); L.push(`${lang === 'sw' ? 'JUMLA' : 'TOTAL'}: ${money(q.total)}`); }
    return L.join('\n');
  };

  // ======================================================================== product matching (fuzzy + learned vocabulary)
  const GENERIC = new Set(['rice', 'want', 'buy', 'order', 'bag', 'kg', 'price', 'stock', 'need', 'get', 'add', 'cart', 'please', 'much', 'number', 'location', 'delivery', 'pay', 'yes', 'no', 'best', 'cheap', 'family', 'pilau', 'biryani', 'help', 'total', 'hello']);
  const USE_HINTS = { pilau: ['pishori', 'aromatic', 'pilau', 'basmati'], biryani: ['basmati', 'long', 'aromatic'], ugali: [], brown: ['brown', 'organic'], organic: ['organic'], sticky: ['sticky', 'sushi', 'short'], basmati: ['basmati'], pishori: ['pishori'] };
  function matchProducts(text, products) {
    const pw = new Set(products.flatMap((p) => B.normalize(`${p.brandName || ''} ${p.variety || ''} ${p.description || ''} ${p.millingGrade || ''}`).split(' ')));
    const q = B.normalize(text).split(' ').filter((w) => w.length > 2 && !/\d/.test(w) && (pw.has(w) || termCache.has(w) || !classifier.vocab.has(B.tokens(w, { keepStop: true })[0] || w)));
    const qt = q.map((w) => B.tokens(w)[0] || w).filter((w) => !GENERIC.has(w));
    const scored = products.map((p) => {
      const hay = B.normalize(`${p.brandName || ''} ${p.variety || ''} ${p.description || ''} ${p.millingGrade || ''} ${p.isOrganic ? 'organic' : ''}`).split(' ').filter((w) => w.length > 2);
      const nameWords = B.normalize(`${p.brandName || ''} ${p.variety || ''}`).split(' ');
      let s = 0;
      for (const w of q) {
        if (termCache.get(w) === p.id) { s += 1.3; continue; }
        if (GENERIC.has(B.tokens(w)[0] || w)) continue;
        if (nameWords.includes(w)) s += 1; else if (nameWords.some((h) => B.fuzzyEq(w, h))) s += 0.85; else if (hay.includes(w)) s += 0.45; else if (hay.some((h) => B.fuzzyEq(w, h))) s += 0.35;
      }
      return { p, score: qt.length || q.length ? s / Math.max(1, Math.min(2, qt.length || q.length)) : 0 };
    }).filter((x) => x.score > 0.3).sort((a, b) => b.score - a.score);
    return scored;
  }
  const whyFits = (p, use) => {
    const hay = B.normalize(`${p.brandName} ${p.variety || ''} ${p.description || ''}`);
    if (use && (USE_HINTS[use] || []).some((h) => hay.includes(h))) return `good for ${use}`;
    return p.variety ? `${p.variety} rice` : 'popular choice';
  };

  // ======================================================================== conversation engine
  const L = (ctx, en, sw) => (ctx.state.lang === 'sw' && sw ? sw : en);
  const R = (reply, x = {}) => ({ reply, options: x.options || [], cards: x.cards || [], actions: x.actions || [] });
  const opt = (label, value) => ({ label, value });
  const mainOptions = (ctx) => [opt(L(ctx, 'Browse rice', 'Angalia mchele'), 'intent:browse'), opt(L(ctx, 'Bulk order', 'Oda ya jumla'), 'intent:bulk'), opt(L(ctx, 'Delivery cost', 'Gharama ya usafiri'), 'intent:delivery_info'), opt(L(ctx, 'Track my order', 'Fuatilia oda'), 'intent:order_status')];
  const SLOT_STAGES = new Set(['pick_product', 'pick_qty', 'more', 'ask_county', 'ask_town', 'ask_street', 'review', 'ask_pay_method', 'ask_phone', 'awaiting_payment']);
  const signatureOf = (text) => [...new Set(B.tokens(text))].sort().slice(0, 8).join(' ').slice(0, 120);
  const askAgain = (ctx, r) => { ctx.state.ask = { text: r.reply, options: r.options }; return r; };

  const priceCtx = (ctx) => ({ county: ctx.state.county, promoCode: ctx.state.promo, userId: ctx.user && ctx.user.id, settings: ctx.settings });

  async function internalApi(ctx, method, url, data) {
    if (!ctx.token) return { status: 401, data: {} };
    const base = process.env.INTERNAL_API_URL || (process.env.VERCEL ? `${ctx.req.protocol}://${ctx.req.get('host')}` : `http://127.0.0.1:${port}`);
    try {
      const r = await axios({ method, url: `${base}/api${url}`, data, timeout: 30000, validateStatus: () => true, headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' } });
      return { status: r.status, data: r.data || {} };
    } catch (e) { return { status: 0, data: { error: e.message } }; }
  }

  // ---------------------------------------------------------------- browsing
  async function showProducts(ctx, list, intro) {
    const cfg = await getBulkConfig();
    const shown = list.slice(0, 6);
    ctx.state.lastShown = shown.map((p) => p.id);
    ctx.state.stage = ctx.state.basket.length ? ctx.state.stage : 'pick_product';
    if (!shown.length) return R(L(ctx, 'I could not find rice matching that. Here is what we usually have, tell me which you like.', 'Sijapata mchele huo. Niambie unachopenda.'), { options: mainOptions(ctx) });
    const names = shown.map((p, i) => `${i + 1}. ${p.brandName}${p.variety ? ' ' + p.variety : ''} ${p.weightKg || ''}kg: ${money(effectivePrice(p))}`).join('\n');
    return R(`${intro}\n${names}\n${L(ctx, 'Tap one, or tell me the name and how many bags.', 'Bonyeza moja, au niambie jina na idadi ya magunia.')}`, {
      cards: shown.map((p) => cardOf(p, cfg)), options: shown.slice(0, 4).map((p) => opt(`${p.brandName} ${p.weightKg || ''}kg`, `pick:${p.id}`))
    });
  }

  async function cmdPickProduct(ctx, product) {
    const cfg = await getBulkConfig(); const rule = bulkRuleFor(cfg, product.id);
    ctx.meta.productId = product.id; learnTerms(ctx, product.id);
    ctx.state.pending = { productId: product.id, name: product.brandName };
    ctx.state.stage = 'pick_qty';
    const bulkOk = cfg.enabled && rule.discountPercent > 0;
    const out = Number(product.stockQuantity) <= 0;
    const lead = out
      ? L(ctx, `${product.brandName} is out of shelf stock right now${bulkOk ? ', but large bulk orders are still possible' : ''}.`, `${product.brandName} haipo kwa sasa.`)
      : `${product.brandName} ${product.weightKg || ''}kg: ${money(effectivePrice(product))} (${stockLabel(product.stockQuantity)}).`;
    const options = [];
    if (!out) [1, 2, 5, 10].forEach((n) => options.push(opt(`${n} ${n === 1 ? 'bag' : 'bags'}`, `qty:${n}`)));
    if (bulkOk) options.push(opt(`Bulk ${rule.minKg}kg (${rule.discountPercent}% off)`, `kg:${rule.minKg}`));
    if (out && !bulkOk) { ctx.state.stage = 'pick_product'; return R(`${lead} ${L(ctx, 'Would you like another rice?', 'Ungependa mchele mwingine?')}`, { options: [opt(L(ctx, 'Show other rice', 'Mchele mwingine'), 'intent:browse')] }); }
    return askAgain(ctx, R(`${lead}\n${L(ctx, 'How many bags would you like? You can also say kilograms, e.g. "50kg".', 'Unataka magunia mangapi? Unaweza kusema kilo, mfano "50kg".')}`, { cards: [cardOf(product, cfg)], options }));
  }

  async function addToBasket(ctx, product, qtyIn) {
    const cfg = await getBulkConfig(); const rule = bulkRuleFor(cfg, product.id);
    const w = Number(product.weightKg) || 1;
    let bags = qtyIn.unit === 'kg' ? Math.max(1, Math.round(qtyIn.value / w)) : Math.round(qtyIn.value);
    if (!(bags >= 1) || bags > 1000) return { error: L(ctx, 'Please give a quantity between 1 and 1000 bags.', 'Tafadhali toa idadi kati ya magunia 1 na 1000.') };
    const kg = bags * w;
    const bulk = cfg.enabled && rule.discountPercent > 0 && kg >= rule.minKg;
    const existing = ctx.state.basket.find((b) => b.productId === product.id);
    const totalBags = bags + (existing ? existing.quantity : 0);
    const totalKg = totalBags * w;
    const nowBulk = cfg.enabled && rule.discountPercent > 0 && totalKg >= rule.minKg;
    if (!nowBulk && Number(product.stockQuantity) < totalBags) {
      return { error: Number(product.stockQuantity) <= 0 ? L(ctx, `${product.brandName} is out of stock.`, `${product.brandName} haipo.`) : L(ctx, `Only ${product.stockQuantity} bags of ${product.brandName} are in stock. Choose up to ${product.stockQuantity}${cfg.enabled && rule.discountPercent > 0 ? `, or order ${rule.minKg}kg or more as a bulk order` : ''}.`, `Zimebaki magunia ${product.stockQuantity} tu.`) };
    }
    if (existing) { existing.quantity = totalBags; existing.bulk = nowBulk; } else ctx.state.basket.push({ productId: product.id, name: product.brandName, bagKg: w, quantity: bags, bulk });
    return { bags, kg, bulk: nowBulk, rounded: qtyIn.unit === 'kg' && bags * w !== qtyIn.value ? `${qtyIn.value}kg rounds to ${bags} bags (${kg}kg) because the rice comes in ${w}kg bags.` : null };
  }

  async function cmdSetQty(ctx, qty) {
    const product = ctx.state.pending && (await RiceProduct.findByPk(ctx.state.pending.productId));
    if (!product) { ctx.state.stage = 'pick_product'; return handleIntent(ctx, 'browse'); }
    const r = await addToBasket(ctx, product, qty);
    if (r.error) return askAgain(ctx, R(r.error));
    ctx.state.pending = null; ctx.state.stage = 'more'; ctx.state.promoAsked = false;
    const q = await priceBasket(ctx.state.basket, priceCtx(ctx));
    const notes = [r.rounded, r.bulk ? L(ctx, 'Bulk price applied, nice saving!', 'Bei ya jumla imetumika!') : null].filter(Boolean).join(' ');
    return askAgain(ctx, R(`${L(ctx, 'Added', 'Nimeongeza')} ${r.bags} x ${product.brandName}. ${notes}\n\n${summaryText(q, ctx.state.lang)}\n\n${L(ctx, 'Would you like anything else, or shall we go to delivery and payment?', 'Unataka kitu kingine, au tuendelee na usafiri na malipo?')}`, {
      options: [opt(L(ctx, 'Checkout', 'Endelea kulipa'), 'checkout'), opt(L(ctx, 'Add more rice', 'Ongeza mchele'), 'intent:browse'), opt(L(ctx, 'Change order', 'Badilisha'), 'edit')],
      actions: [{ type: 'basket', items: ctx.state.basket.map((b) => ({ productId: b.productId, quantity: b.quantity, bulk: b.bulk })) }]
    }));
  }

  // ---------------------------------------------------------------- checkout flow
  async function lastPlaceFor(userId) {
    try { const o = await Order.findOne({ where: { userId }, order: [['createdAt', 'DESC']] }); return o && o.county && o.county !== 'Not Specified' ? { county: o.county, town: o.town || '' } : null; } catch (_) { return null; }
  }
  async function cmdCheckout(ctx) {
    if (!ctx.state.basket.length) return handleIntent(ctx, 'browse');
    if (!ctx.user) {
      ctx.state.stage = 'need_login';
      return R(L(ctx, 'Great, your rice is saved in this chat. To place an order you need to be signed in, so your purchase is recorded in your account. Please sign in or create an account, then tap "I\'m signed in".', 'Vizuri, mchele wako umehifadhiwa. Ili kuagiza lazima uingie kwenye akaunti yako ili ununuzi uhifadhiwe. Ingia kisha bonyeza "Nimeingia".'), {
        actions: [{ type: 'require_login' }], options: [opt(L(ctx, "I'm signed in", 'Nimeingia'), 'login_done')]
      });
    }
    ctx.state.stage = 'ask_county';
    const map = await countyFeeMap();
    const options = [];
    const last = await lastPlaceFor(ctx.user.id);
    if (last && last.county) options.push(opt(`${L(ctx, 'Same as last time', 'Kama mara ya mwisho')}: ${last.town ? last.town + ', ' : ''}${last.county}`, `place:${last.county}|${last.town}`));
    ['Nairobi', 'Kiambu', 'Kirinyaga', 'Nakuru', 'Mombasa', 'Kisumu'].filter((c) => map[c] !== undefined && !options.some((o) => o.value.startsWith(`place:${c}`))).slice(0, 5 - options.length).forEach((c) => options.push(opt(c, `county:${c}`)));
    return askAgain(ctx, R(L(ctx, `Thanks ${firstName(ctx)}, now delivery. Which county should we deliver to? You can also type your town.`, `Asante ${firstName(ctx)}, sasa usafiri. Tutaleta kaunti gani? Unaweza pia kuandika mji wako.`), { options }));
  }
  const firstName = (ctx) => (ctx.user && ctx.user.fullName ? String(ctx.user.fullName).trim().split(/\s+/)[0] : '');

  async function cmdSetCounty(ctx, county, town) {
    const map = await countyFeeMap(); const canon = resolveLocationName(county, Object.keys(map));
    if (!canon) return askAgain(ctx, R(L(ctx, `I do not recognise "${clip(county, 30)}" as a Kenyan county. Please type your county again.`, 'Sijatambua kaunti hiyo. Andika tena.')));
    ctx.state.county = canon; ctx.state.town = null;
    const q = await priceBasket(ctx.state.basket, priceCtx(ctx));
    const info = L(ctx, `Delivery to ${canon} is ${money(q.delivery)} per order, usually ${q.eta}.`, `Usafiri hadi ${canon} ni ${money(q.delivery)} kwa oda, kwa kawaida ${q.eta}.`);
    if (town) return cmdSetTown(ctx, town, info);
    ctx.state.stage = 'ask_town';
    const areas = Array.isArray(logisticsHierarchy && logisticsHierarchy[canon]) ? logisticsHierarchy[canon] : [];
    return askAgain(ctx, R(`${info}\n${L(ctx, 'Which town or area exactly?', 'Mji au eneo gani hasa?')}`, { options: areas.slice(0, 8).map((a) => opt(a, `town:${a}`)) }));
  }
  async function cmdSetTown(ctx, town, prefix) {
    const areas = Array.isArray(logisticsHierarchy && logisticsHierarchy[ctx.state.county]) ? logisticsHierarchy[ctx.state.county] : [];
    ctx.state.town = resolveLocationName(town, areas) || clip(town, 60);
    ctx.state.stage = 'ask_street';
    return askAgain(ctx, R(`${prefix ? prefix + '\n' : ''}${L(ctx, `${ctx.state.town}, ${ctx.state.county}. Please add your street, estate or a landmark so the rider finds you easily.`, `${ctx.state.town}, ${ctx.state.county}. Ongeza mtaa, estate au alama ili mwendeshaji akupate.`)}`, { options: [opt(L(ctx, 'Skip', 'Ruka'), 'skip')] }));
  }
  async function cmdReview(ctx) {
    const q = await priceBasket(ctx.state.basket, priceCtx(ctx));
    if (q.issues.length || !q.lines.length) { ctx.state.stage = 'more'; return askAgain(ctx, R(`${q.issues.join(' ')} ${L(ctx, 'Let us fix your order first.', 'Turekebishe oda kwanza.')}`, { options: [opt(L(ctx, 'Change order', 'Badilisha'), 'edit'), opt(L(ctx, 'Add other rice', 'Mchele mwingine'), 'intent:browse')] })); }
    ctx.state.stage = 'review';
    const where = [ctx.state.street, ctx.state.town, ctx.state.county].filter(Boolean).join(', ');
    return askAgain(ctx, R(`${L(ctx, 'Here is your order', 'Hii ndio oda yako')}:\n${summaryText(q, ctx.state.lang)}\n${L(ctx, 'Deliver to', 'Kupelekwa')}: ${where}\n${L(ctx, 'Expected', 'Muda')}: ${q.eta} ${L(ctx, '(starts once payment is confirmed)', '(huanza malipo yakithibitishwa)')}\n\n${L(ctx, 'Is everything correct? If you have a promo code, type it now.', 'Kila kitu ni sahihi? Ukiwa na promo code, iandike sasa.')}`, {
      options: [opt(L(ctx, 'Yes, pay now', 'Ndio, lipa sasa'), 'confirm'), opt(L(ctx, 'Change order', 'Badilisha'), 'edit'), opt(L(ctx, 'Change location', 'Badilisha eneo'), 'relocate')]
    }));
  }
  async function cmdAskPayMethod(ctx) {
    const pay = await getPaymentConfig();
    ctx.state.stage = 'ask_pay_method';
    const options = [];
    if (pay.stkEnabled) options.push(opt(L(ctx, 'M-Pesa STK prompt', 'M-Pesa STK'), 'pay:stk'));
    if (pay.tillEnabled || pay.paybillNumber) options.push(opt(L(ctx, 'Till / Paybill (manual)', 'Till / Paybill'), 'pay:till'));
    if (!options.length) return R(L(ctx, 'Online payments are switched off at the moment. Please contact customer care to complete your order.', 'Malipo yamezimwa kwa sasa. Wasiliana na huduma kwa wateja.'), { options: [opt(L(ctx, 'Contact info', 'Mawasiliano'), 'intent:store_info')] });
    if (options.length === 1) return cmdPayMethod(ctx, options[0].value.split(':')[1]);
    return askAgain(ctx, R(L(ctx, 'How would you like to pay?\n- STK prompt: a pop-up comes to your phone and you enter your M-Pesa PIN.\n- Till / Paybill: you pay from the M-Pesa menu, then paste the code from the SMS here.', 'Ungependa kulipaje?\n- STK: ujumbe unakuja kwenye simu, unaweka PIN ya M-Pesa.\n- Till / Paybill: unalipa mwenyewe kisha unaweka msimbo wa SMS hapa.'), { options }));
  }
  async function cmdPayMethod(ctx, method) {
    const pay = await getPaymentConfig();
    if (method === 'stk') {
      if (!pay.stkEnabled) return askAgain(ctx, R(L(ctx, 'STK prompts are switched off right now. Please use Till / Paybill.', 'STK imezimwa. Tumia Till / Paybill.'), { options: [opt('Till / Paybill', 'pay:till')] }));
      ctx.state.payMethod = 'mpesa_stk'; ctx.state.stage = 'ask_phone';
      const phone = ctx.user && ctx.user.phoneNumber;
      return askAgain(ctx, R(phone
        ? L(ctx, `Which M-Pesa number should I send the prompt to? Your account number is ${phone}. Tap below, or type another number.`, `Nitume STK kwa namba gani? Namba ya akaunti ni ${phone}. Bonyeza hapa chini au andika nyingine.`)
        : L(ctx, 'Type the M-Pesa number to send the prompt to, e.g. 0712345678.', 'Andika namba ya M-Pesa, mfano 0712345678.'), { options: phone ? [opt(`Use ${phone}`, 'phone:account')] : [] }));
    }
    if (!(pay.tillEnabled || pay.paybillNumber)) return askAgain(ctx, R(L(ctx, 'Manual payment is not available right now. Please use the STK prompt.', 'Malipo ya mkono hayapatikani. Tumia STK.'), { options: [opt('STK', 'pay:stk')] }));
    return placeOrder(ctx, 'mpesa_till', null);
  }

  async function placeOrder(ctx, method, phone) {
    if (!ctx.user) return cmdCheckout(ctx);
    if (ctx.state.placingAt && Date.now() - ctx.state.placingAt < 20000) return R(L(ctx, 'Your order is already being placed, one moment…', 'Oda yako inaandaliwa, subiri kidogo…'));
    const q = await priceBasket(ctx.state.basket, priceCtx(ctx));
    if (q.issues.length || !q.lines.length || q.total === undefined) return cmdReview(ctx);
    ctx.state.placingAt = Date.now();
    const body = {
      cartItems: ctx.state.basket.map((b) => ({ productId: b.productId, quantity: b.quantity, bulk: b.bulk })),
      paymentMethod: method, mpesaPhoneNumber: phone || undefined,
      county: ctx.state.county, town: ctx.state.town, location: ctx.state.town, streetAddress: ctx.state.street || '',
      shippingAddress: [ctx.state.street, ctx.state.town, ctx.state.county].filter(Boolean).join(', '),
      promoCode: ctx.state.promo || undefined
    };
    const res = await internalApi(ctx, 'POST', '/orders/create', body);
    ctx.state.placingAt = 0;
    if (res.status === 401) { ctx.state.stage = 'need_login'; return R(L(ctx, 'Your sign-in expired. Please sign in again, then tap "I\'m signed in". Your order is still saved here.', 'Muda wa kuingia umeisha. Ingia tena, kisha bonyeza "Nimeingia".'), { actions: [{ type: 'require_login' }], options: [opt(L(ctx, "I'm signed in", 'Nimeingia'), 'login_done')] }); }
    if (res.status !== 201 || !res.data || !res.data.id) {
      const msg = (res.data && res.data.error) || 'The order could not be created.';
      ctx.state.stage = 'review';
      return askAgain(ctx, R(`${L(ctx, 'Sorry, I could not place the order', 'Samahani, oda haikuweza kuwekwa')}: ${msg}`, { options: [opt(L(ctx, 'Try again', 'Jaribu tena'), 'confirm'), opt(L(ctx, 'Change order', 'Badilisha'), 'edit')] }));
    }
    const o = res.data; const total = Number(o.grandTotal) || q.total;
    // record that this purchase came from the chat (the order itself is already saved to the customer's account by /orders/create)
    try { const fresh = await Order.findByPk(o.id); fresh.paymentDetails = { ...(fresh.paymentDetails || {}), channel: 'chat', chatSessionId: ctx.sessionId }; fresh.changed('paymentDetails', true); await fresh.save(); } catch (_) { /* best effort */ }
    logChat(ctx, { role: 'system', text: `order_placed #${o.id}`, intent: 'order_placed', meta: { orderId: o.id, total, items: ctx.state.basket.map((b) => b.productId), county: ctx.state.county } });
    if (logEvent) logEvent({ req: ctx.req, actor: { id: ctx.user.id, role: 'customer', name: ctx.user.fullName }, action: 'CHAT_ORDER_PLACED', category: 'orders', targetType: 'order', targetId: o.id, summary: `Order #${o.id} was placed through the chat assistant (${money(total)})` });
    ctx.state.orderId = o.id; ctx.state.orderMethod = method; ctx.state.stage = 'awaiting_payment'; ctx.state.lastCheck = 0;
    ctx.state.basket = []; ctx.state.promo = null; ctx.state.street = null;
    const acts = [{ type: 'payment_started', orderId: o.id, method, phone: phone || null, amount: total, stkPromptSent: !!o.stkPromptSent, till: o.till || null }, { type: 'basket', items: [] }, { type: 'refresh_orders' }];
    if (method === 'mpesa_stk') {
      const shown = normalizeKenyanPhone ? normalizeKenyanPhone(phone) : phone;
      return askAgain(ctx, R(o.stkPromptSent
        ? L(ctx, `Order #${o.id} is created and saved in your account. I have sent an M-Pesa prompt for ${money(total)} to ${shown}. Check your phone, enter your M-Pesa PIN, and I will confirm here as soon as it goes through.`, `Oda #${o.id} imewekwa kwenye akaunti yako. Nimetuma STK ya ${money(total)} kwa ${shown}. Weka PIN ya M-Pesa, nitakuthibitishia hapa.`)
        : L(ctx, `Order #${o.id} is saved in your account, but the M-Pesa prompt could not be sent (${o.stkStatusMessage || 'network problem'}). Tap "Resend prompt" to try again.`, `Oda #${o.id} imehifadhiwa, lakini STK haikutumwa. Bonyeza "Tuma tena".`), {
        actions: acts, options: [opt(L(ctx, 'Resend prompt', 'Tuma tena'), 'resend'), opt(L(ctx, "I've paid", 'Nimelipa'), 'checkpay')]
      }));
    }
    const tillLine = pay_tillLine(await getPaymentConfig(), o.id, total);
    return askAgain(ctx, R(`${L(ctx, `Order #${o.id} is saved in your account.`, `Oda #${o.id} imehifadhiwa kwenye akaunti yako.`)}\n${tillLine}\n${L(ctx, 'After paying, paste the 10-character M-Pesa code from the SMS here (for example SJK4L9XQ2P) and I will verify it.', 'Ukishalipa, bandika msimbo wa herufi 10 wa M-Pesa hapa nitauhakiki.')}`, { actions: acts, options: [opt(L(ctx, "I've paid", 'Nimelipa'), 'checkpay')] }));
  }
  const pay_tillLine = (pay, orderId, total) => {
    const parts = [];
    if (pay.tillEnabled) parts.push(`Till number ${pay.tillNumber}${pay.tillName ? ` (${pay.tillName})` : ''}`);
    if (pay.paybillNumber) parts.push(`Paybill ${pay.paybillNumber}${pay.paybillAccount ? `, account ${pay.paybillAccount}` : `, account ORD${orderId}`}`);
    return `Pay ${money(Math.ceil(total))} to ${parts.join(' or ')}.`;
  };

  async function checkPayment(ctx, { quiet = false } = {}) {
    const id = ctx.state.orderId;
    if (!id) return R(L(ctx, 'I do not see a payment in progress in this chat. If you ordered earlier, ask me to "track my order".', 'Sioni malipo yanayoendelea. Uliza "fuatilia oda".'));
    const res = await internalApi(ctx, 'GET', `/payments/payhero/status/${id}`);
    if (res.status !== 200) return quiet ? null : R(L(ctx, 'I could not check the payment just now. Please try again in a moment.', 'Sijaweza kuangalia malipo sasa. Jaribu tena.'));
    const d = res.data; const pd = d.paymentDetails || {};
    if (pd.isPaid === true) {
      ctx.state.stage = 'done'; ctx.state.orderId = null; ctx.state.ask = null;
      const settings = ctx.settings; const eta = ctx.state.county ? deliveryTimeFor(settings, ctx.state.county) : settings.deliveryTimes.default;
      return R(L(ctx, `Payment received. Thank you${firstName(ctx) ? ' ' + firstName(ctx) : ''}! Order #${id} is confirmed${pd.mpesaReceipt ? ` (M-Pesa receipt ${pd.mpesaReceipt})` : ''}. You earn ${d.pointsEarned || 0} reward points. Expected delivery: ${eta}. You can see every detail under Account, My Orders.`, `Malipo yamepokelewa. Asante! Oda #${id} imethibitishwa${pd.mpesaReceipt ? ` (risiti ${pd.mpesaReceipt})` : ''}. Utapata pointi ${d.pointsEarned || 0}. Utapokea ndani ya ${eta}. Angalia maelezo yote kwenye Akaunti, Oda zangu.`), {
        actions: [{ type: 'payment_result', orderId: id, status: 'PAID' }, { type: 'refresh_orders' }], options: [opt(L(ctx, 'Order more rice', 'Agiza mchele zaidi'), 'intent:browse'), opt(L(ctx, 'My orders', 'Oda zangu'), 'intent:order_status')]
      });
    }
    if (d.paymentStatus === 'FAILED' || d.status === 'payment_failed') {
      return R(L(ctx, `The payment for order #${id} did not go through${pd.failureReason ? ` (${pd.failureReason})` : ''}. No money was taken for it. Shall I resend the prompt?`, `Malipo ya oda #${id} hayakufanikiwa. Nitume STK tena?`), { actions: [{ type: 'payment_result', orderId: id, status: 'FAILED' }], options: [opt(L(ctx, 'Resend prompt', 'Tuma tena'), 'resend'), opt(L(ctx, 'Start over', 'Anza upya'), 'cancel')] });
    }
    if (quiet) return null;
    const till = ctx.state.orderMethod === 'mpesa_till';
    return R(till ? L(ctx, 'I have not seen your payment yet. If you have paid, paste the M-Pesa code from the SMS here.', 'Sijaona malipo yako. Ukishalipa, bandika msimbo wa M-Pesa hapa.') : L(ctx, 'Still waiting for your M-Pesa confirmation. Please enter your PIN on the prompt. If nothing came, I can resend it.', 'Bado ninasubiri uthibitisho wa M-Pesa. Weka PIN. Nikituma tena?'), { options: [opt(L(ctx, 'Resend prompt', 'Tuma tena'), 'resend'), opt(L(ctx, "I've paid", 'Nimelipa'), 'checkpay')] });
  }
  async function resendStk(ctx, phone) {
    if (!ctx.state.orderId) return R(L(ctx, 'There is no pending order in this chat to resend for.', 'Hakuna oda inayosubiri hapa.'));
    const res = await internalApi(ctx, 'POST', `/orders/${ctx.state.orderId}/retry-stk`, phone ? { phoneNumber: phone } : {});
    if (res.status === 200 && res.data.success) return R(L(ctx, 'Done, I have sent a fresh M-Pesa prompt. Enter your PIN, and I will confirm here.', 'Nimetuma STK mpya. Weka PIN, nitakuthibitishia.'), { actions: [{ type: 'payment_started', orderId: ctx.state.orderId, method: 'mpesa_stk', phone: phone || null, amount: 0, stkPromptSent: true }], options: [opt(L(ctx, "I've paid", 'Nimelipa'), 'checkpay')] });
    return R(`${(res.data && res.data.error) || L(ctx, 'Could not resend the prompt.', 'Imeshindwa kutuma tena.')}`, { options: [opt(L(ctx, "I've paid", 'Nimelipa'), 'checkpay')] });
  }
  async function submitTillCode(ctx, code) {
    if (!ctx.state.orderId) return null;
    const res = await internalApi(ctx, 'POST', `/orders/${ctx.state.orderId}/till-payment`, { mpesaCode: code, phoneNumber: ctx.user && ctx.user.phoneNumber });
    if (res.status === 200 && res.data.status === 'PAID') return checkPayment(ctx);
    return R((res.data && (res.data.message || res.data.error)) || L(ctx, 'I received the code and the shop is verifying it. I will tell you once it is confirmed.', 'Nimepokea msimbo, tunauhakiki. Nitakuambia ukithibitishwa.'), { options: [opt(L(ctx, 'Check payment', 'Angalia malipo'), 'checkpay')] });
  }

  // ---------------------------------------------------------------- orders & info
  async function orderStatusReply(ctx, text) {
    if (!ctx.user) return R(L(ctx, 'Please sign in first so I can show your orders safely.', 'Tafadhali ingia kwanza ili nikuonyeshe oda zako.'), { actions: [{ type: 'require_login' }] });
    const wanted = B.extractOrderId(text);
    let orders;
    if (wanted) { const o = await Order.findByPk(wanted); orders = o && o.userId === ctx.user.id ? [o] : []; if (!orders.length) return R(L(ctx, `I could not find order #${wanted} on your account.`, `Sijapata oda #${wanted} kwenye akaunti yako.`)); }
    else orders = await Order.findAll({ where: { userId: ctx.user.id }, order: [['createdAt', 'DESC']], limit: 3 });
    if (!orders.length) return R(L(ctx, 'You have no orders yet. Want to order some rice?', 'Bado huna oda. Ungependa kuagiza?'), { options: [opt(L(ctx, 'Browse rice', 'Angalia mchele'), 'intent:browse')] });
    const lines = [];
    for (const o of orders) {
      const pd = o.paymentDetails || {}; let d = null;
      try { d = await Delivery.findOne({ where: { orderId: o.id } }); } catch (_) { /* none */ }
      const items = getOrderItems(o).map((i) => `${i.quantity} x ${i.brandName || i.name}`).join(', ');
      lines.push(`Order #${o.id} (${new Date(o.createdAt).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short' })}): ${items}\n  ${money(o.grandTotal)} - ${pd.isPaid ? 'PAID' : (pd.paidTag || 'PENDING')}${pd.mpesaReceipt ? ` (${pd.mpesaReceipt})` : ''} - ${o.status}${d ? ` - delivery ${d.status}${d.riderName ? `, rider ${d.riderName} ${d.riderPhone || ''}` : ''}` : ''}`);
    }
    const unpaid = orders.find((o) => !(o.paymentDetails || {}).isPaid && !['cancelled'].includes(o.status));
    if (unpaid) { ctx.state.orderId = unpaid.id; ctx.state.orderMethod = (unpaid.paymentDetails || {}).method; }
    return R(lines.join('\n'), { options: unpaid ? [opt(L(ctx, `Pay order #${unpaid.id}`, `Lipa oda #${unpaid.id}`), 'checkpay'), opt(L(ctx, 'Resend prompt', 'Tuma tena'), 'resend')] : mainOptions(ctx) });
  }
  async function storeInfoReply(ctx) {
    const [cfg, pay, ops] = await Promise.all([getBulkConfig(), getPaymentConfig(), getOps().catch(() => ({}))]);
    const s = ctx.settings; const parts = [];
    if (s.businessHours) parts.push(`Hours: ${s.businessHours}`);
    if (s.supportPhone) parts.push(`Call: ${s.supportPhone}`);
    if (s.whatsapp) parts.push(`WhatsApp: ${s.whatsapp}`);
    parts.push(`Pay with: ${[pay.stkEnabled ? 'M-Pesa STK prompt' : null, pay.tillEnabled ? `Till ${pay.tillNumber}` : null, pay.paybillNumber ? `Paybill ${pay.paybillNumber}` : null].filter(Boolean).join(', ') || 'currently switched off'}`);
    if (ops && ops.orderExpiryMinutes) parts.push(`Unpaid orders are held for ${ops.orderExpiryMinutes} minutes.`);
    return R(parts.join('\n'), { options: mainOptions(ctx) });
  }
  async function deliveryReply(ctx, text) {
    const place = await findPlace(text);
    if (!place.county) { ctx.state.sub = 'delivery_county'; return R(L(ctx, 'Which county or town should I check delivery for?', 'Nikagulie usafiri kwenda kaunti au mji gani?')); }
    const cfg = await getBulkConfig(); const fee = Number(place.map[place.county]); const bulk = bulkTransportFor(cfg, place.county);
    ctx.state.sub = null;
    return R(`${L(ctx, 'Delivery to', 'Usafiri hadi')} ${place.town ? place.town + ', ' : ''}${place.county}: ${money(fee)} ${L(ctx, 'per order (not per bag)', 'kwa oda')}${bulk !== undefined && Number.isFinite(bulk) ? `. ${L(ctx, 'Bulk orders', 'Oda za jumla')}: ${money(bulk)}` : ''}.\n${L(ctx, 'Usually', 'Kwa kawaida')}: ${deliveryTimeFor(ctx.settings, place.county)}.`, { options: [opt(L(ctx, 'Order rice', 'Agiza mchele'), 'intent:buy'), opt(L(ctx, 'Other county', 'Kaunti nyingine'), 'intent:delivery_info')] });
  }

  // ---------------------------------------------------------------- learning hooks
  function learnTerms(ctx, productId) {
    const source = `${(ctx.state.lastUnknown && ctx.state.lastUnknown.text) || ''} ${ctx.text || ''}`;
    const known = ctx.productWords || new Set();
    const words = B.normalize(source).split(' ').filter((w) => w.length >= 4 && w.length <= 20 && !/\d/.test(w) && !classifier.vocab.has(B.tokens(w)[0] || w) && !known.has(w) && !GENERIC.has(w));
    const key = crypto.createHash('sha1').update(String(ctx.user ? `u${ctx.user.id}` : ctx.sessionId)).digest('hex').slice(0, 10);
    words.slice(0, 3).forEach((w) => {
      (async () => {
        const row = (await ChatTerm.findOne({ where: { term: w, productId } })) || (await ChatTerm.create({ term: w, productId, uses: 0, voters: [] }));
        const voters = Array.isArray(row.voters) ? row.voters : [];
        if (!voters.includes(key)) voters.push(key);
        row.voters = voters.slice(-8); row.changed('voters', true); row.uses += 1;
        if (row.status === 'candidate' && voters.length >= 2) { row.status = 'active'; termCache.set(w, productId); }
        await row.save();
      })().catch(() => {});
    });
  }
  async function learnIntentFromChoice(ctx, intent) {
    const u = ctx.state.lastUnknown;
    if (!u || Date.now() - u.at > 4 * 60 * 1000 || !intent || ['cancel', 'help'].includes(intent)) return;
    ctx.state.lastUnknown = null;
    const text = B.normalize(u.text); if (text.length < 4) return;
    const key = crypto.createHash('sha1').update(String(ctx.user ? `u${ctx.user.id}` : ctx.sessionId)).digest('hex').slice(0, 10);
    const row = (await ChatKnowledge.findOne({ where: { source: 'learned', intent, question: text } })) || (await ChatKnowledge.create({ question: text, intent, source: 'learned', status: 'candidate', voters: [] }));
    const voters = Array.isArray(row.voters) ? row.voters : [];
    if (!voters.includes(key)) voters.push(key);
    row.voters = voters.slice(-8); row.changed('voters', true);
    if (row.status === 'candidate' && voters.length >= 2) { row.status = 'active'; classifier.addExample(intent, text, 0.9); await ChatLog.update({ resolved: true }, { where: { signature: signatureOf(text), handled: false } }); }
    await row.save();
  }
  function logChat(ctx, row) {
    ChatLog.create({ sessionId: ctx.sessionId, userId: ctx.user ? ctx.user.id : null, handled: true, ...row, text: clip(row.text, 1200) }).catch(() => {});
  }
  function bestKnowledge(text) {
    let best = null;
    for (const k of knowledgeCache) { if (!k.answer) continue; const s = B.textSimilarity(text, k.question); if (!best || s > best.score) best = { k, score: s }; }
    return best;
  }

  // ---------------------------------------------------------------- recommendation
  async function recommend(ctx, text, products) {
    const budget = B.extractBudget(text); const fam = B.extractFamilySize(text);
    const toks = B.tokens(text); const use = ['pilau', 'biryani', 'brown', 'organic', 'sticky', 'basmati'].find((u) => B.normalize(text).includes(u));
    let list = products.filter((p) => Number(p.stockQuantity) > 0);
    if (budget) list = list.filter((p) => effectivePrice(p) <= budget);
    if (!list.length) return R(L(ctx, 'Nothing fits that budget in stock right now. Want to see everything we have?', 'Hakuna kinachofaa bajeti hiyo kwa sasa. Uone vyote?'), { options: [opt(L(ctx, 'Browse rice', 'Angalia mchele'), 'intent:browse')] });
    const scored = list.map((p) => {
      let s = 0; const hay = B.normalize(`${p.brandName} ${p.variety || ''} ${p.description || ''}`);
      if (use && (USE_HINTS[use] || []).some((h) => hay.includes(h))) s += 3;
      if (toks.includes('cheap')) s -= (effectivePrice(p) / (Number(p.weightKg) || 1)) / 100;
      if (toks.includes('best')) s += (p.isOrganic ? 0.5 : 0) + (p.millingGrade ? 0.5 : 0);
      return { p, s };
    }).sort((a, b) => b.s - a.s || (effectivePrice(a.p) / (a.p.weightKg || 1)) - (effectivePrice(b.p) / (b.p.weightKg || 1)));
    const top = scored.slice(0, 3).map((x) => x.p);
    let note = '';
    if (fam) { const kgMonth = Math.max(2, Math.round(fam * 2.5)); note = L(ctx, ` For ${fam} people, roughly ${kgMonth}kg lasts a month.`, ` Kwa watu ${fam}, takriban kilo ${kgMonth} kwa mwezi.`); }
    ctx.state.lastShown = top.map((p) => p.id);
    return R(`${L(ctx, 'My picks for you', 'Ninapendekeza')}${use ? ` (${use})` : ''}${budget ? ` ${L(ctx, 'under', 'chini ya')} ${money(budget)}` : ''}:\n${top.map((p, i) => `${i + 1}. ${p.brandName} ${p.weightKg || ''}kg ${money(effectivePrice(p))} - ${whyFits(p, use)}`).join('\n')}.${note}`, { cards: top.map((p) => cardOf(p)), options: top.map((p) => opt(`${L(ctx, 'Buy', 'Nunua')} ${p.brandName}`, `pick:${p.id}`)) });
  }

  // ---------------------------------------------------------------- button commands
  async function handlePayload(ctx) {
    const [cmd, ...rest] = String(ctx.payload).split(':'); const arg = rest.join(':'); const st = ctx.state;
    switch (cmd) {
      case 'pick': { const p = ctx.products.find((x) => x.id === Number(arg)); return p ? cmdPickProduct(ctx, p) : null; }
      case 'qty': return cmdSetQty(ctx, { value: Number(arg), unit: 'bag' });
      case 'kg': return cmdSetQty(ctx, { value: Number(arg), unit: 'kg' });
      case 'checkout': return cmdCheckout(ctx);
      case 'login_done': return ctx.user ? (st.basket.length ? cmdCheckout(ctx) : R(L(ctx, `Welcome ${firstName(ctx)}! What rice would you like?`, `Karibu ${firstName(ctx)}! Unataka mchele gani?`), { options: mainOptions(ctx) })) : R(L(ctx, 'I do not see you signed in yet. Please sign in from the Login page, then tap again.', 'Bado sikuoni umeingia. Ingia kisha bonyeza tena.'), { actions: [{ type: 'require_login' }], options: [opt(L(ctx, "I'm signed in", 'Nimeingia'), 'login_done')] });
      case 'county': return cmdSetCounty(ctx, arg);
      case 'place': { const [c, t] = arg.split('|'); return cmdSetCounty(ctx, c, t || null); }
      case 'town': return cmdSetTown(ctx, arg);
      case 'skip': st.street = ''; return cmdReview(ctx);
      case 'relocate': st.county = null; st.town = null; return cmdCheckout(ctx);
      case 'confirm': return st.stage === 'review' ? cmdAskPayMethod(ctx) : null;
      case 'pay': return cmdPayMethod(ctx, arg);
      case 'phone': return arg === 'account' && ctx.user ? placeOrder(ctx, 'mpesa_stk', ctx.user.phoneNumber) : null;
      case 'edit': {
        if (!st.basket.length) return handleIntent(ctx, 'browse');
        return askAgain(ctx, R(L(ctx, 'What would you like to change?', 'Unataka kubadilisha nini?'), { options: [...st.basket.map((b, i) => opt(`${L(ctx, 'Remove', 'Ondoa')} ${b.name}`, `remove:${i}`)), opt(L(ctx, 'Add more rice', 'Ongeza mchele'), 'intent:browse'), opt(L(ctx, 'Clear all', 'Futa vyote'), 'clear'), opt(L(ctx, 'Back to checkout', 'Rudi kulipa'), 'checkout')] }));
      }
      case 'remove': { st.basket.splice(Number(arg), 1); st.stage = 'more'; return st.basket.length ? cmdShowCart(ctx) : handleIntent(ctx, 'browse'); }
      case 'clear': st.basket = []; st.promo = null; return handleIntent(ctx, 'browse');
      case 'resend': return resendStk(ctx);
      case 'checkpay': return ctx.state.orderId ? checkPayment(ctx) : orderStatusReply(ctx, '');
      case 'cancel': return resetFlow(ctx);
      case 'intent': await learnIntentFromChoice(ctx, arg); ctx.intentName = arg; return handleIntent(ctx, arg);
      default: return null;
    }
  }
  function resetFlow(ctx) {
    const st = ctx.state; const waiting = st.stage === 'awaiting_payment' && st.orderId;
    Object.assign(st, { stage: 'idle', basket: [], pending: null, county: null, town: null, street: null, promo: null, sub: null, ask: null, lastUnknown: null });
    if (waiting) return R(L(ctx, `I cleared this chat's basket. Note: order #${st.orderId} is already created and unpaid; it will expire by itself, or you can still pay it. Anything else?`, `Nimefuta kikapu. Oda #${st.orderId} bado haijalipwa; itaisha yenyewe. Kitu kingine?`), { options: [opt(L(ctx, 'Pay order', 'Lipa oda'), 'checkpay'), ...mainOptions(ctx)] });
    st.orderId = null;
    return R(L(ctx, 'No problem, I have cleared everything. What would you like to do?', 'Sawa, nimefuta kila kitu. Unataka kufanya nini?'), { options: mainOptions(ctx) });
  }
  async function cmdShowCart(ctx) {
    if (!ctx.state.basket.length) return R(L(ctx, 'Your basket is empty. Shall we pick some rice?', 'Kikapu chako ni tupu. Tuchague mchele?'), { options: [opt(L(ctx, 'Browse rice', 'Angalia mchele'), 'intent:browse')] });
    const q = await priceBasket(ctx.state.basket, priceCtx(ctx));
    return askAgain(ctx, R(`${summaryText(q, ctx.state.lang)}`, { options: [opt(L(ctx, 'Checkout', 'Endelea kulipa'), 'checkout'), opt(L(ctx, 'Add more rice', 'Ongeza mchele'), 'intent:browse'), opt(L(ctx, 'Change order', 'Badilisha'), 'edit')] }));
  }

  // ---------------------------------------------------------------- stage handlers (fill the slot the bot just asked for)
  function productFromText(ctx) {
    const m = matchProducts(ctx.text, ctx.products);
    if (!m.length) return { product: null, list: [] };
    const top = m[0]; const second = m[1];
    if (top.score >= 0.8 && (!second || top.score >= second.score * 1.4)) return { product: top.p, list: [top.p] };
    return { product: null, list: m.slice(0, 4).map((x) => x.p) };
  }
  async function handleStage(ctx) {
    const { state: st, text } = ctx;
    const topIntent = ctx.cls[0] && ctx.cls[0].score >= 0.7 ? ctx.cls[0].intent : null;
    if (st.sub === 'delivery_county') { const p = await findPlace(text); st.sub = null; if (p.county) return deliveryReply(ctx, text); }
    switch (st.stage) {
      case 'pick_product': {
        const k = B.ordinalPick(text, (st.lastShown || []).length);
        if (k) { const p = ctx.products.find((x) => x.id === st.lastShown[k - 1]); if (p) return cmdPickProduct(ctx, p); }
        const pm = productFromText(ctx);
        if (pm.product) { ctx.meta.productId = pm.product.id; const qty = B.extractQuantity(text); if (qty && qty.value) { st.pending = { productId: pm.product.id, name: pm.product.brandName }; learnTerms(ctx, pm.product.id); return cmdSetQty(ctx, qty.unit ? qty : { value: qty.value, unit: 'bag' }); } return cmdPickProduct(ctx, pm.product); }
        if (pm.list.length > 1) return showProducts(ctx, pm.list, L(ctx, 'Which of these do you mean?', 'Ni ipi kati ya hizi?'));
        return null;
      }
      case 'pick_qty': {
        const qty = B.extractQuantity(text);
        if (qty && qty.value) {
          if (!qty.unit && qty.value > 30) return askAgain(ctx, R(L(ctx, `Do you mean ${qty.value} bags or ${qty.value}kg?`, `Unamaanisha magunia ${qty.value} au kilo ${qty.value}?`), { options: [opt(`${qty.value} bags`, `qty:${qty.value}`), opt(`${qty.value}kg`, `kg:${qty.value}`)] }));
          return cmdSetQty(ctx, qty.unit ? qty : { value: qty.value, unit: 'bag' });
        }
        const pm = productFromText(ctx); if (pm.product && pm.product.id !== (st.pending && st.pending.productId)) return cmdPickProduct(ctx, pm.product);
        return null;
      }
      case 'more': {
        if (B.isNo(text)) return cmdCheckout(ctx);
        if (B.isYes(text)) return handleIntent(ctx, 'browse');
        const pm = productFromText(ctx); if (pm.product) { const qty = B.extractQuantity(text); if (qty && qty.value) { st.pending = { productId: pm.product.id, name: pm.product.brandName }; return cmdSetQty(ctx, qty.unit ? qty : { value: qty.value, unit: 'bag' }); } return cmdPickProduct(ctx, pm.product); }
        return null;
      }
      case 'need_login': return ctx.user ? cmdCheckout(ctx) : null;
      case 'ask_county': { const p = await findPlace(text); return p.county ? cmdSetCounty(ctx, p.county, p.town) : null; }
      case 'ask_town': {
        if (/\?/.test(text) || topIntent || text.length > 50) return null;
        const p = await findPlace(text); if (p.county && p.county !== st.county && !p.town) return cmdSetCounty(ctx, p.county);
        return B.normalize(text).length >= 2 ? cmdSetTown(ctx, text) : null;
      }
      case 'ask_street': {
        if (B.isNo(text)) { st.street = ''; return cmdReview(ctx); }
        if (/\?/.test(text) || topIntent || text.length < 3) return null;
        st.street = clip(text, 120); return cmdReview(ctx);
      }
      case 'review': {
        if (B.isYes(text) || topIntent === 'proceed') return cmdAskPayMethod(ctx);
        if (B.isNo(text)) return handlePayload({ ...ctx, payload: 'edit' });
        const code = B.extractPromo(text);
        if (code && !topIntent) {
          const q = await priceBasket(ctx.state.basket, { ...priceCtx(ctx), promoCode: code });
          if (q.promo && q.promo.valid) { st.promo = code; const r = await cmdReview(ctx); r.reply = `${L(ctx, `Promo ${q.promo.code} applied, you save ${money(q.discount)}.`, `Promo ${q.promo.code} imetumika, unaokoa ${money(q.discount)}.`)}\n\n${r.reply}`; return r; }
          return askAgain(ctx, R(`${(q.promo && q.promo.message) || L(ctx, 'That code is not valid.', 'Msimbo huo si sahihi.')} ${L(ctx, 'Try another code, or continue.', 'Jaribu mwingine, au endelea.')}`, { options: [opt(L(ctx, 'Yes, pay now', 'Ndio, lipa sasa'), 'confirm'), opt(L(ctx, 'Change order', 'Badilisha'), 'edit')] }));
        }
        return null;
      }
      case 'ask_pay_method': {
        const t = B.tokens(text);
        if (t.includes('till') || t.includes('paybill')) return cmdPayMethod(ctx, 'till');
        if (t.includes('stk') || t.includes('mpesa')) return cmdPayMethod(ctx, 'stk');
        return null;
      }
      case 'ask_phone': {
        const raw = B.extractPhoneRaw(text);
        if (raw) { const n = normalizeKenyanPhone ? normalizeKenyanPhone(raw) : raw; if (n) return placeOrder(ctx, 'mpesa_stk', n); }
        if (B.isYes(text) && ctx.user && ctx.user.phoneNumber) return placeOrder(ctx, 'mpesa_stk', ctx.user.phoneNumber);
        if (/\d{6,}/.test(text)) return askAgain(ctx, R(L(ctx, 'That does not look like a valid M-Pesa number. Please type it like 0712345678.', 'Namba hiyo si sahihi. Andika kama 0712345678.')));
        return null;
      }
      case 'awaiting_payment': {
        const code = B.extractMpesaCode(text);
        if (code && st.orderMethod === 'mpesa_till') return submitTillCode(ctx, code);
        if (code) return submitTillCode(ctx, code);
        return null;
      }
      default: return null;
    }
  }

  // ---------------------------------------------------------------- intents
  const INTERRUPTING = new Set(['price', 'stock', 'delivery_info', 'payment_info', 'store_info', 'points', 'promo', 'who_are_you', 'thanks']);
  async function handleIntent(ctx, intent) {
    const r = await intentReply(ctx, intent);
    if (r && INTERRUPTING.has(intent) && SLOT_STAGES.has(ctx.state.stage) && ctx.state.ask && ctx.state.ask.text) {
      r.reply = `${r.reply}\n\n${L(ctx, 'Back to your order:', 'Turudi kwenye oda yako:')} ${ctx.state.ask.text}`;
      r.options = ctx.state.ask.options && ctx.state.ask.options.length ? ctx.state.ask.options : r.options;
    }
    return r;
  }
  async function intentReply(ctx, intent) {
    const st = ctx.state; const products = ctx.products; const cfg = await getBulkConfig();
    switch (intent) {
      case 'greet': {
        const prefs = ctx.user ? await readPrefs(ctx.user.id) : null; const options = mainOptions(ctx);
        const fav = prefs && products.find((p) => p.id === prefs.favorite_product_id);
        if (fav) options.unshift(opt(`${L(ctx, 'Reorder', 'Agiza tena')} ${fav.brandName}`, `pick:${fav.id}`));
        return R(L(ctx, `Hello${firstName(ctx) ? ' ' + firstName(ctx) : ''}! I am ${ctx.settings.assistantName}, the Mwea Rice Hub assistant. I can help you choose rice, work out delivery, and take your order right here, including M-Pesa payment. What would you like?`, `Habari${firstName(ctx) ? ' ' + firstName(ctx) : ''}! Mimi ni ${ctx.settings.assistantName} wa Mwea Rice Hub. Nakusaidia kuchagua mchele, usafiri, na kuagiza hapa hapa pamoja na malipo ya M-Pesa. Unataka nini?`), { options });
      }
      case 'thanks': return R(L(ctx, 'You are welcome! Anything else I can help with?', 'Karibu sana! Kuna kingine?'), { options: mainOptions(ctx) });
      case 'who_are_you': return R(L(ctx, `I am ${ctx.settings.assistantName}, Mwea Rice Hub's virtual assistant (not a human). I answer from our live prices, stock and delivery data, and our customer care team is there for anything I cannot sort out.`, `Mimi ni ${ctx.settings.assistantName}, msaidizi wa kidijitali wa Mwea Rice Hub (si binadamu). Najibu kwa bei na hisa za sasa, na timu ya huduma kwa wateja iko kwa mengine.`), { options: [...mainOptions(ctx).slice(0, 3), opt(L(ctx, 'Talk to a person', 'Ongea na mtu'), 'intent:human')] });
      case 'help': return R(L(ctx, 'I can: show our rice and prices, recommend rice for your cooking or budget, quote bulk orders, check delivery to your county, take your order and send the M-Pesa prompt (or give you the Till/Paybill), and track your orders. Just type naturally, English or Swahili.', 'Naweza: kuonyesha mchele na bei, kupendekeza, kuhesabu oda za jumla, usafiri, kuchukua oda na kutuma M-Pesa, na kufuatilia oda. Andika kawaida, Kiswahili au Kiingereza.'), { options: mainOptions(ctx) });
      case 'browse': return showProducts(ctx, products, L(ctx, 'Here is our rice right now:', 'Huu ndio mchele wetu sasa:'));
      case 'price': case 'stock': {
        const pm = productFromText(ctx);
        if (pm.product) {
          ctx.meta.productId = pm.product.id; const p = pm.product; const c = cardOf(p, cfg); const tiers = (await getWholesaleTiers())[p.id];
          const extra = [c.perKg ? `${money(c.perKg)} per kg` : null, c.flash ? 'flash-sale price' : null, c.bulk ? `bulk: ${c.bulk}` : null, Array.isArray(tiers) && tiers.length ? `quantity prices: ${tiers.map((t) => `${t.minQty}+ bags ${money(t.price)}`).join(', ')}` : null].filter(Boolean).join(' | ');
          st.lastShown = [p.id];
          return R(`${p.brandName} ${p.weightKg || ''}kg: ${money(c.priceKes)} - ${c.stock}.${extra ? `\n${extra}` : ''}`, { cards: [c], options: [opt(`${L(ctx, 'Buy', 'Nunua')} ${p.brandName}`, `pick:${p.id}`), opt(L(ctx, 'Other rice', 'Mchele mwingine'), 'intent:browse')] });
        }
        if (pm.list.length > 1) return showProducts(ctx, pm.list, L(ctx, 'Which one do you mean?', 'Ni ipi?'));
        return showProducts(ctx, products, intent === 'price' ? L(ctx, 'Here are our prices:', 'Hizi ni bei zetu:') : L(ctx, 'Here is what is available:', 'Hiki ndicho kilichopo:'));
      }
      case 'recommend': return recommend(ctx, ctx.text, products);
      case 'buy': {
        const pm = productFromText(ctx); const qty = B.extractQuantity(ctx.text);
        if (pm.product) {
          ctx.meta.productId = pm.product.id;
          if (qty && qty.value && !(!qty.unit && qty.value > 30)) { st.pending = { productId: pm.product.id, name: pm.product.brandName }; learnTerms(ctx, pm.product.id); return cmdSetQty(ctx, qty.unit ? qty : { value: qty.value, unit: 'bag' }); }
          return cmdPickProduct(ctx, pm.product);
        }
        if (pm.list.length > 1) return showProducts(ctx, pm.list, L(ctx, 'Which one would you like?', 'Unataka ipi?'));
        if (st.basket.length) return cmdShowCart(ctx);
        return showProducts(ctx, products, `${L(ctx, 'Happy to help you order. Pick a rice below (you will sign in only when you pay).', 'Nitakusaidia kuagiza. Chagua mchele hapa chini (utaingia kwenye akaunti ukilipa tu).')}`);
      }
      case 'bulk': {
        const pm = productFromText(ctx); const qty = B.extractQuantity(ctx.text);
        const rule = pm.product ? bulkRuleFor(cfg, pm.product.id) : { minKg: cfg.minKg, discountPercent: cfg.discountPercent };
        if (pm.product && qty && qty.value) { st.pending = { productId: pm.product.id, name: pm.product.brandName }; return cmdSetQty(ctx, qty.unit === 'bag' ? qty : { value: qty.value, unit: 'kg' }); }
        const lead = cfg.enabled ? L(ctx, `Bulk orders start at ${rule.minKg}kg per rice type and get ${rule.discountPercent}% off, with a bulk delivery rate per county. Bulk orders are not limited by shelf stock.`, `Oda za jumla huanza kilo ${rule.minKg} na punguzo la ${rule.discountPercent}%. Hazizuiliwi na hisa ya rafu.`) : L(ctx, 'Bulk pricing is not running right now, but you can still order any number of bags.', 'Bei ya jumla haipo sasa, lakini unaweza kuagiza magunia mengi.');
        return showProducts(ctx, pm.list.length ? pm.list : products, `${lead}\n${L(ctx, 'Which rice and how many kilograms?', 'Mchele gani na kilo ngapi?')}`);
      }
      case 'delivery_info': return deliveryReply(ctx, ctx.text);
      case 'payment_info': {
        const pay = await getPaymentConfig();
        return R([pay.stkEnabled ? L(ctx, '- M-Pesa STK: I send a prompt to your phone and you enter your PIN.', '- M-Pesa STK: nakutumia ujumbe kwenye simu, unaweka PIN.') : null, pay.tillEnabled ? `- Till ${pay.tillNumber}${pay.tillName ? ` (${pay.tillName})` : ''}: ${L(ctx, 'pay yourself, then paste the M-Pesa code here', 'lipa mwenyewe kisha bandika msimbo hapa')}.` : null, pay.paybillNumber ? `- Paybill ${pay.paybillNumber}${pay.paybillAccount ? `, account ${pay.paybillAccount}` : ''}.` : null].filter(Boolean).join('\n') || L(ctx, 'Online payments are switched off right now.', 'Malipo yamezimwa kwa sasa.'), { options: [opt(L(ctx, 'Order rice', 'Agiza mchele'), 'intent:buy'), ...mainOptions(ctx).slice(2, 3)] });
      }
      case 'order_status': return orderStatusReply(ctx, ctx.text);
      case 'payment_check': return st.orderId ? checkPayment(ctx) : orderStatusReply(ctx, ctx.text);
      case 'payment_resend': { const raw = B.extractPhoneRaw(ctx.text); return resendStk(ctx, raw && normalizeKenyanPhone ? normalizeKenyanPhone(raw) : null); }
      case 'store_info': return storeInfoReply(ctx);
      case 'points': return R(ctx.user ? L(ctx, `You have ${ctx.user.rewardPoints || 0} reward points. You earn 0.2 points for every kg you buy.`, `Una pointi ${ctx.user.rewardPoints || 0}. Unapata pointi 0.2 kwa kila kilo.`) : L(ctx, 'You earn 0.2 reward points for every kg you buy. Sign in to see your balance.', 'Unapata pointi 0.2 kwa kila kilo. Ingia kuona salio lako.'), { options: mainOptions(ctx) });
      case 'promo': {
        const code = B.extractPromo(ctx.text);
        if (code) { const q = await priceBasket(st.basket.length ? st.basket : [], { ...priceCtx(ctx), promoCode: code }); const pr = await evaluatePromo(code, ctx.user ? ctx.user.id : null, q.subtotal || 0).catch(() => null); if (pr && pr.valid) { st.promo = code; return R(L(ctx, `Code ${pr.code || code} is valid. It will be applied at your order summary.`, `Msimbo ${pr.code || code} ni sahihi. Utatumika kwenye muhtasari wa oda.`)); } return R((pr && pr.message) || L(ctx, 'That code is not valid.', 'Msimbo huo si sahihi.')); }
        return R(`${flashSaleState && flashSaleState.active ? L(ctx, 'A flash sale is running now, prices already include it! ', 'Kuna flash sale sasa, bei tayari zinajumuisha! ') : ''}${L(ctx, 'If you have a promo code, type it here (for example "code WELCOME") and I will apply it at checkout. Bulk and quantity discounts apply automatically.', 'Ukiwa na promo code, iandike hapa nitaitumia unapolipa. Punguzo la jumla hutumika moja kwa moja.')}`, { options: [opt(L(ctx, 'Browse rice', 'Angalia mchele'), 'intent:browse')] });
      }
      case 'complaint': case 'human': {
        const s = ctx.settings; const contact = [s.supportPhone ? `Call ${s.supportPhone}` : null, s.whatsapp ? `WhatsApp ${s.whatsapp}` : null, s.businessHours ? `Hours: ${s.businessHours}` : null].filter(Boolean).join('\n');
        return R(`${intent === 'complaint' ? L(ctx, 'I am sorry about that, I want it sorted. ', 'Pole sana, tutalitatua. ') : ''}${L(ctx, 'Our customer care team can help you directly. I have noted your request.', 'Timu yetu ya huduma kwa wateja itakusaidia. Nimeandika ombi lako.')}${contact ? `\n${contact}` : ''}${ctx.user ? `\n${L(ctx, 'Quote your name', 'Taja jina lako')}: ${ctx.user.fullName}.` : ''}`, { options: ctx.user ? [opt(L(ctx, 'My orders', 'Oda zangu'), 'intent:order_status')] : mainOptions(ctx) });
      }
      case 'cancel': return resetFlow(ctx);
      case 'show_cart': return cmdShowCart(ctx);
      case 'change': return handlePayload({ ...ctx, payload: 'edit' });
      case 'proceed': return st.basket.length ? cmdCheckout(ctx) : showProducts(ctx, products, L(ctx, 'Your basket is empty. Pick some rice first:', 'Kikapu ni tupu. Chagua mchele kwanza:'));
      default: return null;
    }
  }
  function unknownReply(ctx) {
    const st = ctx.state; st.unknownStreak = (st.unknownStreak || 0) + 1; st.lastUnknown = { text: ctx.text, at: Date.now() };
    const s = ctx.settings;
    const base = L(ctx, 'I am not sure I understood that, and I am still learning. What are you after?', 'Sijaelewa vizuri, bado ninajifunza. Unatafuta nini?');
    const contact = st.unknownStreak >= 2 && (s.supportPhone || s.whatsapp) ? `\n${L(ctx, 'You can also reach customer care', 'Unaweza pia kupiga huduma kwa wateja')}: ${[s.supportPhone, s.whatsapp].filter(Boolean).join(' / ')}.` : '';
    const r = R(base + contact, { options: [opt(L(ctx, 'Prices', 'Bei'), 'intent:price'), opt(L(ctx, 'Buy rice', 'Nunua mchele'), 'intent:buy'), opt(L(ctx, 'Delivery', 'Usafiri'), 'intent:delivery_info'), opt(L(ctx, 'Payment', 'Malipo'), 'intent:payment_info'), opt(L(ctx, 'Talk to a person', 'Ongea na mtu'), 'intent:human')] });
    if (st.ask && SLOT_STAGES.has(st.stage)) { r.reply += `\n\n${L(ctx, 'Or continue your order:', 'Au endelea na oda yako:')} ${st.ask.text}`; }
    return r;
  }

  async function converse(ctx) {
    ctx.products = await loadCatalog(); ctx.meta = {};
    ctx.productWords = new Set(ctx.products.flatMap((p) => B.normalize(`${p.brandName} ${p.variety || ''}`).split(' ')));
    if (ctx.text) { if (B.isSwahili(ctx.text)) ctx.state.lang = 'sw'; else if (ctx.text.split(' ').length >= 4) ctx.state.lang = 'en'; }
    if (!classifier.neutral) classifier.neutral = new Set(Object.keys(countyOverrides || {}).flatMap((c) => B.normalize(c).split(' ')));
    ctx.productWords.forEach((w) => { const t = B.tokens(w, { keepStop: true })[0] || w; if (!GENERIC.has(t) && !classifier.vocab.has(t)) classifier.neutral.add(t); });
    ctx.cls = ctx.text ? classifier.classify(ctx.text) : [];
    const top = ctx.cls[0]; const second = ctx.cls[1];
    let result = null; ctx.source = 'fallback'; ctx.intentName = top ? top.intent : null; ctx.conf = top ? top.score : 0;
    if (ctx.payload) { result = await handlePayload(ctx); if (result) ctx.source = 'button'; }
    if (!result && ctx.text) { result = await handleStage(ctx); if (result) ctx.source = 'stage'; }
    if (!result && ctx.text) {
      const kn = bestKnowledge(ctx.text);
      if (kn && kn.score >= 0.8) { ctx.knowledgeId = kn.k.id; ctx.source = 'knowledge'; result = R(kn.k.answer, { options: mainOptions(ctx) }); }
      else if (top && ((top.score >= 0.6 && (!second || top.score - second.score >= 0.04 || top.score >= 0.85)) || (top.score >= 0.5 && (!second || top.score - second.score >= 0.12)) || (top.score >= 0.45 && (!second || top.score - second.score >= 0.25)))) { ctx.source = 'intent'; result = await handleIntent(ctx, top.intent); }
      else if (kn && kn.score >= 0.5) { ctx.knowledgeId = kn.k.id; ctx.source = 'knowledge'; result = R(kn.k.answer, { options: mainOptions(ctx) }); }
    }
    if (!result && ctx.text) {
      const pm = matchProducts(ctx.text, ctx.products);
      if (pm[0] && pm[0].score >= 0.8) { const hasQty = (B.extractQuantity(ctx.text) || {}).value; const it = hasQty ? 'buy' : 'price'; ctx.source = 'intent'; ctx.intentName = it; result = await handleIntent(ctx, it); }
      else { const pl = await findPlace(ctx.text); if (pl.county) { ctx.source = 'intent'; ctx.intentName = 'delivery_info'; result = await handleIntent(ctx, 'delivery_info'); } }
    }
    ctx.handled = !!result;
    if (!result) { ctx.intentName = null; result = unknownReply(ctx); } else if (ctx.source !== 'button') ctx.state.unknownStreak = 0;
    if (ctx.state.county) ctx.meta.county = ctx.state.county;
    return result;
  }

  // ======================================================================== sessions + routes
  const freshState = () => ({ stage: 'idle', basket: [], lang: 'en', lastShown: [] });
  async function getSession(req, user) {
    let id = clip((req.body || {}).sessionId, 40);
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) id = crypto.randomBytes(12).toString('hex');
    let row = await ChatSession.findByPk(id);
    if (row && row.userId && (!user || row.userId !== user.id)) { id = crypto.randomBytes(12).toString('hex'); row = null; } // never expose one customer's basket to another
    if (!row) row = await ChatSession.create({ id, userId: user ? user.id : null, state: freshState(), lastActiveAt: new Date() });
    else if (user && !row.userId) row.userId = user.id;
    const st = { ...freshState(), ...(row.state || {}) };
    if (row.lastActiveAt && Date.now() - new Date(row.lastActiveAt).getTime() > 3 * 3600 * 1000 && ['awaiting_payment', 'done'].includes(st.stage)) { st.stage = 'idle'; st.orderId = null; st.ask = null; }
    return { row, state: st };
  }
  const saveSession = async (row, state) => { row.state = state; row.changed('state', true); row.lastActiveAt = new Date(); await row.save(); };

  const hitsPerMinute = new Map(); const hitsPerHour = new Map();
  setInterval(() => { const now = Date.now(); for (const m of [hitsPerMinute, hitsPerHour]) for (const [k, v] of m) if (!v.length || now - v[v.length - 1] > 3600000) m.delete(k); }, 10 * 60 * 1000).unref?.();
  const tooMany = (map, key, windowMs, max) => { const now = Date.now(); const arr = (map.get(key) || []).filter((t) => now - t < windowMs); if (arr.length >= max) { map.set(key, arr); return true; } arr.push(now); map.set(key, arr); return false; };
  const rawToken = (req) => { const h = req.headers['authorization']; return h && h.startsWith('Bearer ') ? h.split(' ')[1].trim() : null; };
  async function resolveUser(req) {
    const raw = rawToken(req); if (!raw) return null;
    try { const d = jwt.verify(raw, JWT_SECRET); const u = await User.findByPk(d.id, { attributes: ['id', 'fullName', 'phoneNumber', 'rewardPoints', 'isActive'] }); return u && u.isActive !== false ? u : null; } catch (_) { return null; }
  }
  const publicOut = (r, extra) => ({ reply: r.reply, options: (r.options || []).slice(0, 6), cards: (r.cards || []).slice(0, 6), actions: r.actions || [], ...extra });

  app.post('/api/chat', async (req, res) => {
    try {
      const ip = req.ip || 'unknown';
      if (tooMany(hitsPerMinute, ip, 60 * 1000, 30) || tooMany(hitsPerHour, ip, 60 * 60 * 1000, 400)) return res.status(429).json({ error: 'You are sending messages very fast. Please wait a moment and try again.' });
      await ready;
      const body = req.body || {};
      const text = clip(body.message, 1000); const payload = clip(body.payload, 120);
      if (!text && !payload) return res.status(400).json({ error: 'Type a message first.' });
      const settings = await getSettings(); const user = await resolveUser(req);
      const { row, state } = await getSession(req, user);
      const ctx = { req, user, token: rawToken(req), settings, state, sessionId: row.id, text, payload };
      let result;
      try { result = await converse(ctx); }
      catch (e) { console.error('❌ Chat engine error:', e); result = R('Sorry, something went wrong on my side. Please try again, or contact customer care.', { options: mainOptions(ctx) }); ctx.handled = false; ctx.intentName = 'error'; }
      await saveSession(row, ctx.state);
      if (text) await ChatLog.create({ sessionId: row.id, userId: user ? user.id : null, role: 'user', text, intent: ctx.intentName, confidence: ctx.conf || null, handled: ctx.handled !== false, signature: signatureOf(text), source: ctx.source, meta: Object.keys(ctx.meta || {}).length ? ctx.meta : null }).catch(() => {});
      const bot = await ChatLog.create({ sessionId: row.id, userId: user ? user.id : null, role: 'assistant', text: clip(result.reply, 1500), intent: ctx.intentName, handled: ctx.handled !== false, knowledgeId: ctx.knowledgeId || null, source: ctx.source }).catch(() => null);
      if (ctx.knowledgeId > 0) ChatKnowledge.increment('hits', { where: { id: ctx.knowledgeId } }).catch(() => {});
      res.json(publicOut(result, { sessionId: row.id, messageId: bot ? bot.id : null, stage: ctx.state.stage, signedIn: !!user }));
    } catch (err) {
      console.error('❌ Chat route error:', err.message);
      let fallback = 'The shopping assistant is unavailable right now. Please try again shortly, or contact customer care.';
      try { const s = await getSettings(); if (s.supportPhone) fallback += ` You can call ${s.supportPhone}.`; } catch (_) { /* ignore */ }
      res.status(500).json({ error: fallback });
    }
  });

  // the widget calls this every few seconds while a payment is pending, so the customer is told the moment M-Pesa confirms
  app.post('/api/chat/poll', async (req, res) => {
    try {
      await ready; const user = await resolveUser(req); if (!user) return res.json({ message: null });
      const row = await ChatSession.findByPk(clip((req.body || {}).sessionId, 40));
      if (!row || row.userId !== user.id) return res.json({ message: null });
      const state = { ...freshState(), ...(row.state || {}) };
      if (state.stage !== 'awaiting_payment' || !state.orderId || Date.now() - (state.lastCheck || 0) < 3500) return res.json({ message: null });
      state.lastCheck = Date.now();
      const ctx = { req, user, token: rawToken(req), settings: await getSettings(), state, sessionId: row.id, text: '', payload: '' };
      const r = await checkPayment(ctx, { quiet: true });
      await saveSession(row, ctx.state);
      if (!r) return res.json({ message: null });
      const bot = await ChatLog.create({ sessionId: row.id, userId: user.id, role: 'assistant', text: clip(r.reply, 1500), intent: 'payment_update', handled: true, source: 'poll' }).catch(() => null);
      res.json({ message: publicOut(r, { messageId: bot ? bot.id : null }) });
    } catch (err) { res.json({ message: null }); }
  });

  app.post('/api/chat/feedback', async (req, res) => {
    try {
      await ready; const { messageId, sessionId } = req.body || {}; const value = Number((req.body || {}).value) > 0 ? 1 : -1;
      const row = await ChatLog.findByPk(Number(messageId));
      if (!row || row.sessionId !== clip(sessionId, 40) || row.role !== 'assistant' || row.feedback) return res.json({ ok: true });
      row.feedback = value; await row.save();
      if (row.knowledgeId > 0) {
        const k = await ChatKnowledge.findByPk(row.knowledgeId);
        if (k) { if (value > 0) k.upVotes += 1; else k.downVotes += 1; if (k.downVotes >= 3 && k.downVotes > k.upVotes * 2) { k.status = 'off'; } await k.save(); if (k.status === 'off') refreshLearning(); }
      }
      if (value < 0) { // a thumbs-down means the question was NOT really answered: surface it to the admin
        const prev = await ChatLog.findOne({ where: { sessionId: row.sessionId, role: 'user', id: { [Op.lt]: row.id } }, order: [['id', 'DESC']] });
        if (prev) { prev.handled = false; prev.resolved = false; await prev.save(); }
      }
      res.json({ ok: true });
    } catch (err) { res.json({ ok: false }); }
  });

  app.get('/api/config/chat-assistant', async (req, res) => { try { const s = await getSettings(); res.json({ assistantName: s.assistantName }); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.get('/api/admin/config/chat-assistant', authenticateToken, requireAdmin, async (req, res) => { try { res.json(await getSettings()); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.put('/api/admin/config/chat-assistant', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const b = req.body || {}; const byCounty = {};
      Object.entries((b.deliveryTimes && b.deliveryTimes.byCounty) || {}).slice(0, 60).forEach(([k, v]) => { if (typeof v === 'string' && v.trim()) byCounty[clip(k, 40)] = clip(v, 100); });
      const next = { assistantName: clip(b.assistantName, 40) || DEFAULT_SETTINGS.assistantName, businessHours: clip(b.businessHours, 160), supportPhone: clip(b.supportPhone, 30), whatsapp: clip(b.whatsapp, 30), extraKnowledge: clip(b.extraKnowledge, 4000), deliveryTimes: { default: clip(b.deliveryTimes && b.deliveryTimes.default, 100) || DEFAULT_SETTINGS.deliveryTimes.default, byCounty } };
      const [row] = await SystemConfig.findOrCreate({ where: { key: 'chat_settings' }, defaults: { value: next } });
      row.value = next; row.changed('value', true); await row.save();
      if (logEvent) await logEvent({ req, action: 'CHAT_SETTINGS_CHANGED', category: 'settings', summary: `${req.adminUser.fullName} updated the chat assistant settings` });
      refreshLearning(); res.json(await getSettings());
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ======================================================================== admin: insights + teaching the assistant
  const admin = [authenticateToken, requireAdmin];
  app.get('/api/admin/chat/overview', ...admin, async (req, res) => {
    try {
      await ready; const since = new Date(Date.now() - 7 * 864e5); const w = { role: 'user', createdAt: { [Op.gte]: since } };
      const cnt = sequelize.fn('COUNT', sequelize.col('id'));
      const [messages, unhandled, orders, up, down, sessions, topIntents, unanswered, candidates, pendingProposals] = await Promise.all([
        ChatLog.count({ where: w }), ChatLog.count({ where: { ...w, handled: false } }),
        ChatLog.count({ where: { intent: 'order_placed', createdAt: { [Op.gte]: since } } }),
        ChatLog.count({ where: { feedback: 1, createdAt: { [Op.gte]: since } } }), ChatLog.count({ where: { feedback: -1, createdAt: { [Op.gte]: since } } }),
        ChatSession.count({ where: { lastActiveAt: { [Op.gte]: since } } }),
        ChatLog.findAll({ attributes: ['intent', [cnt, 'n']], where: { ...w, intent: { [Op.ne]: null } }, group: ['intent'], order: [[cnt, 'DESC']], limit: 10, raw: true }),
        ChatLog.findAll({ attributes: ['signature', [cnt, 'n'], [sequelize.fn('MAX', sequelize.col('text')), 'example']], where: { role: 'user', handled: false, resolved: false, signature: { [Op.ne]: null } }, group: ['signature'], order: [[cnt, 'DESC']], limit: 30, raw: true }),
        ChatKnowledge.findAll({ where: { status: 'candidate' }, order: [['updatedAt', 'DESC']], limit: 30 }),
        ChatSchemaProposal.count({ where: { status: 'pending' } })
      ]);
      res.json({ days: 7, messages, unhandled, handledRate: messages ? Math.round(((messages - unhandled) / messages) * 100) : 100, ordersPlaced: orders, helpful: up, notHelpful: down, activeChats: sessions, topIntents, unanswered, candidates, pendingProposals });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/admin/chat/knowledge', ...admin, async (req, res) => { try { await ready; res.json(await ChatKnowledge.findAll({ order: [['updatedAt', 'DESC']], limit: 300 })); } catch (err) { res.status(500).json({ error: err.message }); } });
  // Teach the assistant: either a brand-new Q&A, or an answer for a question customers keep asking that it could not answer
  app.post('/api/admin/chat/knowledge', ...admin, async (req, res) => {
    try {
      await ready; const b = req.body || {}; const question = clip(b.question, 400); const answer = clip(b.answer, 1500);
      if (question.length < 4 || answer.length < 2) return res.status(400).json({ error: 'Write both the question customers ask and the answer you want given.' });
      const row = await ChatKnowledge.create({ question, answer, source: 'admin', status: 'active' });
      if (b.signature) await ChatLog.update({ resolved: true }, { where: { signature: clip(b.signature, 120), handled: false } });
      await refreshLearning();
      if (logEvent) await logEvent({ req, action: 'CHAT_TAUGHT', category: 'settings', summary: `${req.adminUser.fullName} taught the assistant a new answer` });
      res.status(201).json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/admin/chat/knowledge/:id', ...admin, async (req, res) => {
    try {
      await ready; const row = await ChatKnowledge.findByPk(req.params.id); if (!row) return res.status(404).json({ error: 'Not found.' });
      const b = req.body || {};
      if (b.question !== undefined) row.question = clip(b.question, 400);
      if (b.answer !== undefined) row.answer = clip(b.answer, 1500);
      if (['active', 'off', 'candidate'].includes(b.status)) row.status = b.status;
      await row.save(); await refreshLearning(); res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/admin/chat/knowledge/:id', ...admin, async (req, res) => { try { await ready; await ChatKnowledge.destroy({ where: { id: req.params.id } }); await refreshLearning(); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); } });

  // ======================================================================== scalability: the assistant asks the admin before it adds tables
  const COL_TYPES = { STRING: 'VARCHAR', TEXT: 'TEXT', INTEGER: 'INTEGER', BIGINT: 'BIGINT', FLOAT: 'DOUBLE PRECISION', BOOLEAN: 'BOOLEAN', DATEONLY: 'DATE', DATE: 'TIMESTAMPTZ', JSON: 'JSONB' };
  const parseType = (t) => { const m = String(t).match(/^(STRING|TEXT|INTEGER|BIGINT|FLOAT|BOOLEAN|DATEONLY|DATE|JSON)(?:\((\d{1,3})\))?$/); if (!m) throw new Error(`Column type "${t}" is not allowed.`); return { base: m[1], len: m[2] ? Number(m[2]) : null }; };
  function validateSpec(spec) {
    if (!spec || !/^chat_[a-z0-9_]{3,50}$/.test(spec.table || '')) throw new Error('Table names must start with "chat_" and use only lowercase letters, numbers and underscores.');
    if (!Array.isArray(spec.columns) || !spec.columns.length || spec.columns.length > 20) throw new Error('A table needs between 1 and 20 columns.');
    const names = new Set();
    spec.columns.forEach((c) => {
      if (!/^[a-z][a-z0-9_]{1,40}$/.test(c.name || '') || ['id', 'createdat', 'updatedat'].includes(c.name.toLowerCase()) || names.has(c.name)) throw new Error(`Column name "${c.name}" is not allowed.`);
      names.add(c.name); parseType(c.type);
    });
    (spec.unique || []).forEach((n) => { if (!names.has(n)) throw new Error(`Unique column "${n}" does not exist.`); });
  }
  const sqlPreview = (spec) => {
    const my = sequelize.getDialect() === 'mysql'; const q = my ? '`' : '"';
    const cols = spec.columns.map((c) => { const t = parseType(c.type); let ty = COL_TYPES[t.base]; if (t.base === 'STRING') ty = `VARCHAR(${t.len || 255})`; if (my) ty = ty.replace('DOUBLE PRECISION', 'DOUBLE').replace('TIMESTAMPTZ', 'DATETIME').replace('JSONB', 'JSON').replace('BOOLEAN', 'TINYINT(1)'); return `  ${q}${c.name}${q} ${ty}${c.allowNull === false ? ' NOT NULL' : ''}${c.defaultValue !== undefined ? ` DEFAULT ${typeof c.defaultValue === 'string' ? `'${c.defaultValue}'` : c.defaultValue}` : ''}`; });
    const lines = [`  ${q}id${q} ${my ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'SERIAL PRIMARY KEY'}`, ...cols, `  ${q}createdAt${q} ${my ? 'DATETIME' : 'TIMESTAMPTZ'} NOT NULL`, `  ${q}updatedAt${q} ${my ? 'DATETIME' : 'TIMESTAMPTZ'} NOT NULL`];
    if ((spec.unique || []).length) lines.push(`  UNIQUE (${spec.unique.map((u) => `${q}${u}${q}`).join(', ')})`);
    return `CREATE TABLE IF NOT EXISTS ${q}${spec.table}${q} (\n${lines.join(',\n')}\n);`;
  };
  const attrsOf = (spec) => Object.fromEntries(spec.columns.map((c) => { const t = parseType(c.type); return [c.name, { type: t.len ? DataTypes[t.base](t.len) : DataTypes[t.base], allowNull: c.allowNull !== false, ...(c.defaultValue !== undefined ? { defaultValue: c.defaultValue } : {}) }]; }));
  async function createFromSpec(spec) {
    validateSpec(spec);
    const qi = sequelize.getQueryInterface();
    const existing = (await qi.showAllTables()).map((t) => String(typeof t === 'string' ? t : t.tableName || t.name));
    if (existing.includes(spec.table)) return 'already-existed';
    await qi.createTable(spec.table, { id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, ...attrsOf(spec), createdAt: { type: DataTypes.DATE, allowNull: false }, updatedAt: { type: DataTypes.DATE, allowNull: false } });
    if ((spec.unique || []).length) await qi.addIndex(spec.table, spec.unique, { unique: true, name: `${spec.table}_uq` });
    return 'created';
  }

  const PROPOSALS = [
    { table: 'chat_intent_daily_metrics', title: 'Daily chat statistics', when: (m) => m.totalLogs >= 2000,
      why: (m) => `The chat has now stored ${m.totalLogs.toLocaleString()} messages. Counting them live is getting slow. This small table keeps one row per day per topic (messages, unanswered, average confidence) so the admin dashboard stays fast.`,
      spec: { table: 'chat_intent_daily_metrics', columns: [{ name: 'day', type: 'DATEONLY', allowNull: false }, { name: 'intent', type: 'STRING(40)', allowNull: false }, { name: 'messages', type: 'INTEGER', allowNull: false, defaultValue: 0 }, { name: 'unhandled', type: 'INTEGER', allowNull: false, defaultValue: 0 }, { name: 'avg_confidence', type: 'FLOAT' }], unique: ['day', 'intent'] } },
    { table: 'chat_product_demand', title: 'Rice demand from chats (for restocking)', when: (m) => m.productEvents >= 300,
      why: (m) => `Customers asked about rice products ${m.productEvents.toLocaleString()} times in chat. This table records, per day and per rice, how many people asked about it and how many started to buy it, so you can see what to restock before it runs out.`,
      spec: { table: 'chat_product_demand', columns: [{ name: 'day', type: 'DATEONLY', allowNull: false }, { name: 'product_id', type: 'INTEGER', allowNull: false }, { name: 'asks', type: 'INTEGER', allowNull: false, defaultValue: 0 }, { name: 'buys', type: 'INTEGER', allowNull: false, defaultValue: 0 }], unique: ['day', 'product_id'] } },
    { table: 'chat_customer_preferences', title: 'Returning-customer preferences', when: (m) => m.signedInUsers >= 25,
      why: (m) => `${m.signedInUsers} signed-in customers have used the chat. Remembering each one's usual rice and county lets the assistant offer "Reorder your usual rice" and skip questions. Only the rice id, county and chat count are stored, never phone numbers or messages.`,
      spec: { table: 'chat_customer_preferences', columns: [{ name: 'user_id', type: 'INTEGER', allowNull: false }, { name: 'favorite_product_id', type: 'INTEGER' }, { name: 'usual_county', type: 'STRING(60)' }, { name: 'chats', type: 'INTEGER', allowNull: false, defaultValue: 0 }], unique: ['user_id'] } },
    { table: 'chat_message_archive', title: 'Archive for old chat messages', when: (m) => m.totalLogs >= 40000,
      why: (m) => `The live message table holds ${m.totalLogs.toLocaleString()} rows. Moving messages older than 90 days into an archive table keeps the chat fast while still keeping the history.`,
      spec: { table: 'chat_message_archive', columns: [{ name: 'original_id', type: 'INTEGER', allowNull: false }, { name: 'session_id', type: 'STRING(40)', allowNull: false }, { name: 'user_id', type: 'INTEGER' }, { name: 'role', type: 'STRING(10)', allowNull: false }, { name: 'text', type: 'TEXT', allowNull: false }, { name: 'intent', type: 'STRING(40)' }, { name: 'handled', type: 'BOOLEAN', allowNull: false, defaultValue: true }, { name: 'sent_at', type: 'DATE', allowNull: false }], unique: ['original_id'] } }
  ];
  async function gatherMetrics() {
    const [totalLogs, productEvents, signedInUsers] = await Promise.all([
      ChatLog.count(), ChatLog.count({ where: { role: 'user', intent: { [Op.in]: ['price', 'stock', 'buy', 'recommend', 'browse'] } } }),
      ChatLog.count({ distinct: true, col: 'userId', where: { userId: { [Op.ne]: null } } })
    ]);
    return { totalLogs, productEvents, signedInUsers };
  }
  async function scanSchemaNeeds({ force = false } = {}) {
    await ready; const m = await gatherMetrics(); const prior = await ChatSchemaProposal.findAll(); const created = [];
    for (const c of PROPOSALS) {
      if (!force && !c.when(m)) continue;
      const old = prior.find((p) => p.tableName === c.table);
      if (old && !(old.status === 'rejected' && Date.now() - new Date(old.decidedAt || old.updatedAt).getTime() > 30 * 864e5)) continue;
      validateSpec(c.spec);
      created.push(await ChatSchemaProposal.create({ tableName: c.table, title: c.title, reason: c.why(m), evidence: m, spec: c.spec, sqlPreview: sqlPreview(c.spec) }));
    }
    if (created.length && logEvent) logEvent({ actor: { id: null, role: 'system', name: 'Chat assistant' }, action: 'CHAT_SCHEMA_PROPOSED', category: 'system', severity: 'warn', summary: `The chat assistant needs your approval to add ${created.length} database table(s): ${created.map((c) => c.tableName).join(', ')}. Open Admin > Chat AI.` });
    return created;
  }
  app.get('/api/admin/chat/schema-proposals', ...admin, async (req, res) => { try { await ready; res.json(await ChatSchemaProposal.findAll({ order: [['createdAt', 'DESC']], limit: 100 })); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.post('/api/admin/chat/schema-proposals/scan', ...admin, async (req, res) => { try { const created = await scanSchemaNeeds({ force: (req.body || {}).force === true }); res.json({ created: created.length, metrics: await gatherMetrics() }); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.post('/api/admin/chat/schema-proposals/:id/approve', ...admin, async (req, res) => {
    try {
      await ready; const p = await ChatSchemaProposal.findByPk(req.params.id);
      if (!p || p.status !== 'pending') return res.status(400).json({ error: 'This proposal is not waiting for approval.' });
      if (String((req.body || {}).confirmTable || '').trim() !== p.tableName) return res.status(400).json({ error: `To confirm, type the table name exactly: ${p.tableName}` });
      try {
        const outcome = await createFromSpec(p.spec); p.status = 'applied'; p.note = outcome === 'already-existed' ? 'The table already existed, so nothing was changed.' : null; defineWriter(p.spec);
      } catch (e) { p.status = 'failed'; p.note = clip(e.message, 290); }
      p.decidedBy = req.adminUser.id; p.decidedAt = new Date(); await p.save();
      if (logEvent) await logEvent({ req, action: p.status === 'applied' ? 'CHAT_TABLE_APPROVED' : 'CHAT_TABLE_FAILED', category: 'system', severity: p.status === 'applied' ? 'info' : 'alert', summary: `${req.adminUser.fullName} ${p.status === 'applied' ? 'approved and created' : 'tried to create'} table ${p.tableName}${p.note ? ` (${p.note})` : ''}` });
      if (p.status === 'applied') rollup().catch(() => {});
      res.status(p.status === 'applied' ? 200 : 500).json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/admin/chat/schema-proposals/:id/reject', ...admin, async (req, res) => {
    try {
      await ready; const p = await ChatSchemaProposal.findByPk(req.params.id);
      if (!p || p.status !== 'pending') return res.status(400).json({ error: 'This proposal is not waiting for approval.' });
      p.status = 'rejected'; p.decidedBy = req.adminUser.id; p.decidedAt = new Date(); p.note = clip((req.body || {}).note, 290) || null; await p.save();
      if (logEvent) await logEvent({ req, action: 'CHAT_TABLE_REJECTED', category: 'system', summary: `${req.adminUser.fullName} declined the new table ${p.tableName}` });
      res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ---- once a table is approved and exists, the assistant starts using it
  const W = {}; // writer models for approved tables
  function defineWriter(spec) {
    try {
      const key = { chat_intent_daily_metrics: 'daily', chat_product_demand: 'demand', chat_customer_preferences: 'prefs', chat_message_archive: 'archive' }[spec.table]; if (!key) return;
      W[key] = sequelize.models[spec.table] || sequelize.define(spec.table, attrsOf(spec), { tableName: spec.table, freezeTableName: true, timestamps: true });
    } catch (e) { console.error('Chat writer model failed:', e.message); }
  }
  (async () => { await ready; try { (await ChatSchemaProposal.findAll({ where: { status: 'applied' } })).forEach((p) => defineWriter(p.spec)); } catch (_) { /* first run */ } })();
  const dayOf = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
  const upsert = async (Model, where, values) => { const row = await Model.findOne({ where }); if (row) { await row.update(values); } else await Model.create({ ...where, ...values }); };
  async function rollup() {
    await ready; const since = new Date(Date.now() - 3 * 864e5);
    const logs = (W.daily || W.demand || W.prefs) ? await ChatLog.findAll({ where: { role: 'user', createdAt: { [Op.gte]: since } }, attributes: ['createdAt', 'intent', 'handled', 'confidence', 'meta', 'userId', 'sessionId', 'source'], limit: 50000, raw: true }) : [];
    if (W.daily) {
      const g = {}; logs.forEach((l) => { const k = `${dayOf(l.createdAt)}|${l.intent || 'unknown'}`; const e = g[k] || (g[k] = { n: 0, un: 0, c: 0, cn: 0 }); e.n += 1; if (!l.handled) e.un += 1; if (l.confidence != null) { e.c += l.confidence; e.cn += 1; } });
      for (const [k, e] of Object.entries(g)) { const [day, intent] = k.split('|'); await upsert(W.daily, { day, intent }, { messages: e.n, unhandled: e.un, avg_confidence: e.cn ? e.c / e.cn : null }); }
    }
    if (W.demand) {
      const g = {}; logs.forEach((l) => { const pid = l.meta && l.meta.productId; if (!pid) return; const k = `${dayOf(l.createdAt)}|${pid}`; const e = g[k] || (g[k] = { a: 0, b: 0 }); if (['price', 'stock', 'recommend', 'browse'].includes(l.intent)) e.a += 1; else e.b += 1; });
      for (const [k, e] of Object.entries(g)) { const [day, pid] = k.split('|'); await upsert(W.demand, { day, product_id: Number(pid) }, { asks: e.a, buys: e.b }); }
    }
    if (W.prefs) {
      const users = {}; logs.forEach((l) => { if (l.userId) (users[l.userId] = users[l.userId] || []).push(l); });
      for (const uid of Object.keys(users).slice(0, 200)) {
        const all = await ChatLog.findAll({ where: { userId: uid, role: 'user' }, attributes: ['meta', 'sessionId'], order: [['id', 'DESC']], limit: 400, raw: true });
        const mode = (arr) => { const c = {}; arr.forEach((x) => { c[x] = (c[x] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]; };
        const fav = mode(all.map((a) => a.meta && a.meta.productId).filter(Boolean)); const cty = mode(all.map((a) => a.meta && a.meta.county).filter(Boolean));
        await upsert(W.prefs, { user_id: Number(uid) }, { favorite_product_id: fav ? Number(fav[0]) : null, usual_county: cty ? cty[0] : null, chats: new Set(all.map((a) => a.sessionId)).size });
      }
    }
    if (W.archive) {
      const cutoff = new Date(Date.now() - 90 * 864e5); const old = await ChatLog.findAll({ where: { createdAt: { [Op.lt]: cutoff } }, order: [['id', 'ASC']], limit: 2000 });
      if (old.length) {
        await W.archive.bulkCreate(old.map((o) => ({ original_id: o.id, session_id: o.sessionId, user_id: o.userId, role: o.role, text: o.text, intent: o.intent, handled: o.handled, sent_at: o.createdAt })), { ignoreDuplicates: true });
        await ChatLog.destroy({ where: { id: old.map((o) => o.id) } });
      }
    }
  }
  async function readPrefs(userId) { if (!W.prefs) return null; try { const r = await W.prefs.findOne({ where: { user_id: userId } }); return r ? r.toJSON() : null; } catch (_) { return null; } }
  const timers = [setInterval(() => { scanSchemaNeeds().catch(() => {}); }, 30 * 60 * 1000), setInterval(() => { rollup().catch(() => {}); }, 3 * 3600 * 1000)];
  timers.forEach((t) => t.unref?.());
  setTimeout(() => { scanSchemaNeeds().catch(() => {}); rollup().catch(() => {}); }, 90 * 1000).unref?.();

  console.log('🤖 Self-hosted chat assistant ready (no third-party AI): sales flow, STK/Till payments, self-learning, admin-approved scaling tables.');
  return ready;
}
