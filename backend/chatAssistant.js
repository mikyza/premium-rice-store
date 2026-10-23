/**
 * ====================================================================================
 * MWEA RICE HUB — SELF-CONTAINED SALES & SUPPORT ASSISTANT (backend module)
 * ====================================================================================
 * NO Claude, NO OpenAI, NO third-party AI and NO API key. Everything here runs inside
 * your own server and reads your own database:
 *
 *   chatNlu.js        understands English / Swahili / mixed messages (intents + entities)
 *   this file         a guided buying flow, answers built from live data, and a learning loop
 *
 * WHAT IT DOES
 *  - Answers about rice, prices, stock, bulk deals, delivery, payments, hours, points,
 *    promo codes and the customer's own orders, always from the live database.
 *  - Guided purchase for SIGNED-IN customers: choose rice -> quantity -> county/town/address
 *    -> promo -> payment method (M-Pesa STK prompt or Till/Paybill) -> confirm -> order is
 *    created through YOUR existing /api/orders/create logic (same stock deduction, bulk rules,
 *    pricing, referral, logging) -> the STK prompt pops up on the customer's phone -> the chat
 *    confirms the payment and the order sits in the customer's account like any other order.
 *  - The assistant never decides a price. Every number comes from the same code paths the
 *    checkout uses, and the customer must say YES to a full summary before an order exists.
 *
 * HOW IT IMPROVES ITSELF (no retraining, no outside service)
 *  1. Every message is logged (phone numbers / M-Pesa codes / e-mails are stripped first).
 *  2. Questions it could not understand are grouped and counted -> Admin > AI Assistant > Teach.
 *  3. When a customer rephrases right after a miss, or confirms "Did you mean...?", that pair
 *     becomes a vote. Harmless intents (info, greetings) are auto-learned after 3 votes from
 *     2 different chats. Anything touching orders/payments ALWAYS waits for an admin.
 *  4. Customers' nicknames for rice ("mchele wa pilau") are learned the same way.
 *  5. Admin can teach answers directly and reject/undo anything it learned.
 *
 * SCALING WITHOUT SURPRISES  (this is the part you asked for)
 *  - Out of the box it needs NO new tables: memory lives in your existing SystemConfig table
 *    (small, capped). It also never creates a table on its own.
 *  - When it needs more room, it writes a TABLE PROPOSAL (what, why, SQL preview) and shows it
 *    to the admin (Admin > AI Assistant > Approvals, plus an alert in the activity log).
 *    Nothing is created until an admin approves WITH THEIR PASSWORD. Then it creates the tables,
 *    copies what it learned so far into them, and switches over. Reject = it keeps working as is.
 *  - Proposals can only name the fixed set of chat_* tables defined below, so no one can use
 *    this feature to run arbitrary SQL.
 * ====================================================================================
 */
import * as N from './chatNlu.js';

// ---------------------------------------------------------------- settings (admin editable)
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
  extraKnowledge: ''
};

// ---------------------------------------------------------------- storage layout
// Every collection has the same simple shape, so ONE table design covers them all:
//   k (unique key) | status | hits | data (JSON) | lastSeenAt | createdAt | updatedAt
const COLLECTIONS = {
  turns:      { table: 'chat_turns',            cap: 400, label: 'Conversation log (what customers asked, what the assistant understood)' },
  unanswered: { table: 'chat_unanswered',       cap: 300, label: 'Questions the assistant could not understand yet' },
  learned:    { table: 'chat_learned',          cap: 600, label: 'Learned phrases, rice nicknames and admin-taught answers' },
  escalations:{ table: 'chat_escalations',      cap: 200, label: 'Hand-offs to human customer care' },
  sessions:   { table: 'chat_sessions',         cap: 0,   label: 'Saved chat baskets (survive restarts and multiple servers)' },
  requests:   { table: 'chat_catalog_requests', cap: 200, label: 'Rice customers asked for that is not in the catalogue' },
  abandoned:  { table: 'chat_abandoned_carts',  cap: 200, label: 'Baskets customers built in chat but never paid for' }
};

// What the assistant may ask the admin for, and when.
const NEEDS = [
  { key: 'core_storage', collections: ['turns', 'unanswered', 'learned', 'escalations', 'sessions'],
    title: 'Chat memory and learning tables',
    why: () => 'So the assistant can remember what customers ask, learn new phrases, keep chat baskets safe across server restarts, and hand questions to your team. Without these it keeps a small, capped memory inside the existing SystemConfig table, which works but cannot grow with your customers.',
    when: () => true },
  { key: 'catalog_requests', collections: ['requests'],
    title: 'Customer demand tracker (rice people ask for that you do not list)',
    why: (st) => `Customers have asked for rice that is not in your catalogue ${st.requests} times. A dedicated table lets you see exactly what to stock next.`,
    when: (st) => st.requests >= 15 },
  { key: 'abandoned_carts', collections: ['abandoned'],
    title: 'Abandoned chat baskets',
    why: (st) => `${st.abandoned} customers built a basket in chat and left without paying. A dedicated table lets you follow up on them and measure lost sales.`,
    when: (st) => st.abandoned >= 10 }
];

const SAFE_AUTO_KINDS = new Set(['info', 'ctrl']);   // intents whose learned phrases may auto-activate
const AUTO_VOTES = 3;                                 // votes needed ...
const AUTO_SESSIONS = 2;                              // ... from at least this many different chats
const SESSION_TTL_MS = 3 * 3600 * 1000;
const PROPOSAL_RETRY_DAYS = 14;

export function registerChatAssistant(app, deps) {
  const {
    User, Order, RiceProduct, Delivery, SystemConfig, Cart, sequelize, DataTypes, jwt, bcrypt, JWT_SECRET, io, flashSaleState,
    authenticateToken, requireAdmin, getBulkConfig, bulkRuleFor, bulkTransportFor,
    getPaymentConfig, getOps, evaluatePromo, getWholesaleTiers, bestTier,
    getOrderItems, round2, countyOverrides, logisticsHierarchy, logEvent,
    normalizeKenyanPhone, cleanMpesaCode, MPESA_CODE_RE,
    createOrderHandler, startPayHeroStk, syncPayHeroPayment, submitTillCode
  } = deps;

  const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const now = () => new Date();
  const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const safeLog = (o) => { try { return logEvent ? logEvent(o) : null; } catch (_) { return null; } };

  // ================================================================ STORAGE LAYER
  const mem = {};       // name -> Map(k -> row)    (config mode cache)
  const mode = {};      // name -> 'config' | 'table'
  const models = {};    // name -> Sequelize model  (table mode, only after an admin approved the table)
  const dirty = new Set();
  Object.keys(COLLECTIONS).forEach((n) => { mem[n] = new Map(); mode[n] = 'config'; });

  function tableModel(name) {
    const c = COLLECTIONS[name];
    const modelName = `ChatCol_${name}`;
    if (sequelize.models[modelName]) return sequelize.models[modelName];
    return sequelize.define(modelName, {
      k: { type: DataTypes.STRING(190), allowNull: false, unique: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'new' },
      hits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      data: { type: DataTypes.JSON, allowNull: true },
      lastSeenAt: { type: DataTypes.DATE, allowNull: true }
    }, { tableName: c.table, timestamps: true, indexes: [{ fields: ['status'] }, { fields: ['lastSeenAt'] }] });
  }

  const plain = (r) => ({ k: r.k, status: r.status, hits: r.hits, data: r.data || {}, lastSeenAt: r.lastSeenAt });
  const cfgKey = (name) => `chat_col_${name}`;

  async function loadConfigCollections() {
    for (const name of Object.keys(COLLECTIONS)) {
      try {
        const row = await SystemConfig.findOne({ where: { key: cfgKey(name) } });
        const items = (row && row.value && row.value.items) || [];
        items.forEach((it) => mem[name].set(it.k, it));
      } catch (_) { /* table not ready yet */ }
    }
  }

  async function flushCollections() {
    for (const name of [...dirty]) {
      dirty.delete(name);
      if (mode[name] !== 'config') continue;
      try {
        const [row] = await SystemConfig.findOrCreate({ where: { key: cfgKey(name) }, defaults: { value: { items: [] } } });
        row.value = { items: [...mem[name].values()] };
        row.changed('value', true);
        await row.save();
      } catch (e) { dirty.add(name); console.error(`⚠️ Chat memory (${name}) could not be saved:`, e.message); }
    }
    if (statsDirty) {
      statsDirty = false;
      try {
        const [row] = await SystemConfig.findOrCreate({ where: { key: 'chat_stats' }, defaults: { value: {} } });
        row.value = stats; row.changed('value', true); await row.save();
      } catch (_) { statsDirty = true; }
    }
  }

  async function load(name, k) {
    if (mode[name] === 'table') { const r = await models[name].findOne({ where: { k } }); return r ? plain(r) : null; }
    const r = mem[name].get(k); return r ? JSON.parse(JSON.stringify(r)) : null;
  }
  async function save(name, row, isNew) {
    if (mode[name] === 'table') {
      if (isNew) await models[name].create({ k: row.k, status: row.status, hits: row.hits, data: row.data, lastSeenAt: row.lastSeenAt });
      else await models[name].update({ status: row.status, hits: row.hits, data: row.data, lastSeenAt: row.lastSeenAt }, { where: { k: row.k } });
      return;
    }
    mem[name].set(row.k, row);
    const cap = COLLECTIONS[name].cap;
    if (cap && mem[name].size > cap) {
      const victims = [...mem[name].values()].filter((r) => r.status !== 'active')
        .sort((a, b) => new Date(a.lastSeenAt || 0) - new Date(b.lastSeenAt || 0)).slice(0, mem[name].size - cap);
      victims.forEach((v) => mem[name].delete(v.k));
    }
    dirty.add(name);
  }
  /** create-or-update one row. mutate(row, isNew) may change status / data. hits goes up on every touch. */
  async function upsert(name, k, init, mutate) {
    k = clip(k, 190);
    const existing = await load(name, k);
    const t = now();
    if (!existing) {
      const row = { k, status: (init && init.status) || 'new', hits: 1, data: JSON.parse(JSON.stringify((init && init.data) || {})), lastSeenAt: t };
      if (mutate) mutate(row, true);
      await save(name, row, true);
      return row;
    }
    existing.hits = (Number(existing.hits) || 0) + 1; existing.lastSeenAt = t;
    if (mutate) mutate(existing, false);
    await save(name, existing, false);
    return existing;
  }
  async function patchRow(name, k, mutate) {
    const r = await load(name, k); if (!r) return null;
    mutate(r); await save(name, r, false); return r;
  }
  async function list(name, { status, limit = 50, sort = 'recent' } = {}) {
    if (mode[name] === 'table') {
      const rows = await models[name].findAll({ where: status ? { status } : {}, order: [sort === 'hits' ? ['hits', 'DESC'] : ['lastSeenAt', 'DESC']], limit });
      return rows.map(plain);
    }
    let rows = [...mem[name].values()];
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => sort === 'hits' ? (b.hits - a.hits) : (new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0)));
    return rows.slice(0, limit).map((r) => JSON.parse(JSON.stringify(r)));
  }
  async function remove(name, k) {
    if (mode[name] === 'table') await models[name].destroy({ where: { k } }); else { mem[name].delete(k); dirty.add(name); }
  }
  async function countRows(name, status) {
    if (mode[name] === 'table') return models[name].count({ where: status ? { status } : {} });
    if (!status) return mem[name].size;
    let n = 0; for (const r of mem[name].values()) if (r.status === status) n += 1; return n;
  }

  // ---- counters
  let stats = { total: 0, handled: 0, asked: 0, unhandled: 0, escalations: 0, orders: 0, paid: 0, thumbsUp: 0, thumbsDown: 0, byIntent: {}, since: new Date().toISOString() };
  let statsDirty = false;
  const bump = (field, n = 1) => { stats[field] = (stats[field] || 0) + n; statsDirty = true; };
  const bumpIntent = (i) => { stats.byIntent[i] = (stats.byIntent[i] || 0) + 1; statsDirty = true; };

  // ================================================================ SETTINGS
  async function getSettings() {
    let stored = {};
    try { const row = await SystemConfig.findOne({ where: { key: 'chat_settings' } }); stored = (row && row.value) || {}; } catch (_) { /* table not ready */ }
    const dt = stored.deliveryTimes || {};
    return {
      ...DEFAULT_SETTINGS, ...stored,
      deliveryTimes: { default: dt.default || DEFAULT_SETTINGS.deliveryTimes.default, byCounty: { ...DEFAULT_SETTINGS.deliveryTimes.byCounty, ...(dt.byCounty || {}) } }
    };
  }

  // ================================================================ LEARNING
  let learned = { phrases: [], faqs: [], aliases: {} };       // active knowledge used by the classifier
  let learnedStamp = 0;
  async function rebuildLearned() {
    const rows = await list('learned', { status: 'active', limit: 1000 });
    const next = { phrases: [], faqs: [], aliases: {} };
    for (const r of rows) {
      const d = r.data || {};
      if (d.type === 'phrase' && d.text && d.intent) next.phrases.push({ text: d.text, intent: d.intent });
      else if (d.type === 'faq' && d.answer) next.faqs.push({ id: r.k, triggers: d.triggers || [], answer: d.answer, answerSw: d.answerSw || '' });
      else if (d.type === 'alias' && d.word && d.productId) (next.aliases[d.productId] = next.aliases[d.productId] || []).push(d.word);
    }
    learned = next; learnedStamp = Date.now();
  }
  const learnedFresh = async () => { if (Date.now() - learnedStamp > 120000) { try { await rebuildLearned(); } catch (_) { /* keep old */ } } };

  const hashSession = (key) => String(key).split('').reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 7).toString(36);

  /** Record that "text" probably means "intent" (or that a word means a product). Safe intents auto-activate after enough independent votes. */
  async function vote({ type, key, data, sessionKey, weight = 1, intentKind = 'txn' }) {
    let promoted = false;
    await upsert('learned', key, { status: 'candidate', data: { type, ...data, votes: 0, sessions: [] } }, (r) => {
      if (r.status === 'rejected') return;
      const d = r.data;
      d.votes = (d.votes || 0) + weight;
      const sh = hashSession(sessionKey);
      d.sessions = Array.isArray(d.sessions) ? d.sessions : [];
      if (!d.sessions.includes(sh)) d.sessions.push(sh);
      d.sessions = d.sessions.slice(-12);
      if (r.status === 'candidate' && SAFE_AUTO_KINDS.has(intentKind) && d.votes >= AUTO_VOTES && d.sessions.length >= AUTO_SESSIONS) {
        r.status = 'active'; d.autoPromoted = true; d.promotedAt = new Date().toISOString(); promoted = true;
      }
    });
    if (promoted) { learnedStamp = 0; await learnedFresh(); }
  }

  async function noteUnanswered(text, sessionKey) {
    const k = N.questionKey(text);
    if (!k) return;
    await upsert('unanswered', k, { status: 'new', data: { samples: [], sessions: [] } }, (r) => {
      if (r.status === 'dismissed') return;
      const d = r.data; d.samples = d.samples || []; d.sessions = d.sessions || [];
      const red = N.redact(text);
      if (!d.samples.includes(red) && d.samples.length < 6) d.samples.push(red);
      const sh = hashSession(sessionKey); if (!d.sessions.includes(sh) && d.sessions.length < 20) d.sessions.push(sh);
    });
    bump('unhandled');
  }

  // ================================================================ TABLE PROPOSALS (admin approval)
  const SQL_TYPES = { id: 'INTEGER PRIMARY KEY AUTO_INCREMENT', k: 'VARCHAR(190) NOT NULL UNIQUE', status: "VARCHAR(20) NOT NULL DEFAULT 'new'", hits: 'INTEGER NOT NULL DEFAULT 1', data: 'JSON NULL', lastSeenAt: 'DATETIME NULL', createdAt: 'DATETIME NOT NULL', updatedAt: 'DATETIME NOT NULL' };
  function previewSql(collection) {
    const c = COLLECTIONS[collection];
    return `CREATE TABLE IF NOT EXISTS ${c.table} (\n${Object.entries(SQL_TYPES).map(([col, t]) => `  ${col} ${t}`).join(',\n')}\n);\nCREATE INDEX ${c.table}_status ON ${c.table} (status);\nCREATE INDEX ${c.table}_lastseen ON ${c.table} (lastSeenAt);`;
  }

  async function getProposals() {
    try { const row = await SystemConfig.findOne({ where: { key: 'chat_proposals' } }); return (row && row.value && row.value.items) || []; } catch (_) { return []; }
  }
  async function setProposals(items) {
    const [row] = await SystemConfig.findOrCreate({ where: { key: 'chat_proposals' }, defaults: { value: { items: [] } } });
    row.value = { items }; row.changed('value', true); await row.save();
  }
  const publicProposal = (p) => ({
    id: p.id, needKey: p.needKey, title: p.title, why: p.why, status: p.status, createdAt: p.createdAt, decidedAt: p.decidedAt || null, decidedBy: p.decidedBy || null, error: p.error || null,
    tables: p.collections.map((c) => ({ table: COLLECTIONS[c].table, purpose: COLLECTIONS[c].label, sql: previewSql(c) })),
    note: 'This only creates NEW tables named chat_*. It never changes or deletes any existing table or data.'
  });

  async function currentNeedStats() {
    return { requests: await countRows('requests'), abandoned: await countRows('abandoned') };
  }

  /** Looks at how the assistant is being used and files (never applies) a proposal when it needs room to grow. */
  async function evaluateNeeds() {
    try {
      const st = await currentNeedStats();
      const items = await getProposals();
      let changed = false;
      for (const need of NEEDS) {
        if (need.collections.every((c) => mode[c] === 'table')) continue;
        if (!need.when(st)) continue;
        const open = items.find((p) => p.needKey === need.key && ['pending', 'failed'].includes(p.status));
        if (open) continue;
        const rejected = items.filter((p) => p.needKey === need.key && p.status === 'rejected').sort((a, b) => new Date(b.decidedAt) - new Date(a.decidedAt))[0];
        if (rejected && Date.now() - new Date(rejected.decidedAt).getTime() < PROPOSAL_RETRY_DAYS * 86400000) continue;
        const p = { id: `prop_${rid()}`, needKey: need.key, title: need.title, why: need.why(st), collections: need.collections, status: 'pending', createdAt: new Date().toISOString() };
        items.push(p); changed = true;
        await safeLog({ actor: { id: null, role: 'system', name: 'AI Assistant' }, action: 'CHAT_TABLES_PROPOSED', category: 'system', severity: 'alert', summary: `The chat assistant asks to add ${p.collections.length} database table(s): ${p.title}. Review it in Admin > AI Assistant > Approvals.` });
        try { io.to('admin-dashboard-room').emit('chatProposal', publicProposal(p)); } catch (_) { /* no socket */ }
      }
      if (changed) await setProposals(items.slice(-60));
    } catch (e) { console.error('⚠️ Chat needs check failed:', e.message); }
  }

  async function migrateToTable(name) {
    const rows = [...mem[name].values()];
    if (rows.length) {
      await models[name].bulkCreate(rows.map((r) => ({ k: r.k, status: r.status, hits: r.hits, data: r.data, lastSeenAt: r.lastSeenAt })), { ignoreDuplicates: true });
    }
    mem[name].clear();
    mode[name] = 'table';
    try {
      const row = await SystemConfig.findOne({ where: { key: cfgKey(name) } });
      if (row) { row.value = { items: [], migratedAt: new Date().toISOString() }; row.changed('value', true); await row.save(); }
    } catch (_) { /* best effort */ }
    dirty.delete(name);
  }

  /** Runs ONLY after an admin approved. Only the fixed chat_* tables above can ever be created. */
  async function applyProposal(p) {
    for (const name of p.collections) {
      if (!COLLECTIONS[name]) throw new Error(`Unknown chat table "${name}"`);
      models[name] = tableModel(name);
      await models[name].sync();                 // CREATE TABLE IF NOT EXISTS: never alters or drops anything
      await migrateToTable(name);
    }
    await rebuildLearned();
  }

  async function detectExistingTables() {
    try {
      const qi = sequelize.getQueryInterface();
      const have = (await qi.showAllTables()).map((t) => String(typeof t === 'string' ? t : (t.tableName || t.name || Object.values(t)[0])).toLowerCase());
      for (const [name, c] of Object.entries(COLLECTIONS)) {
        if (have.includes(c.table.toLowerCase())) { models[name] = tableModel(name); await migrateToTable(name); }
      }
    } catch (e) { console.error('⚠️ Chat table check failed:', e.message); }
  }

  // ================================================================ LIVE DATA HELPERS
  const kes = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return `KES ${v.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`; };
  const maskPhone = (p) => { const n = normalizeKenyanPhone(p); return n ? `0${n.slice(3, 6)} ••• ${n.slice(-3)}` : 'your number'; };

  const effectivePrice = (p) => {
    let price = Number(p.basePrice != null ? p.basePrice : p.price) || 0;
    if (flashSaleState && flashSaleState.active && p.flashSalePrice !== null && p.flashSalePrice !== undefined) price = Number(p.flashSalePrice);
    return price;
  };

  let productCache = { at: 0, rows: [] };
  async function loadProducts(force) {
    if (!force && Date.now() - productCache.at < 15000) return productCache.rows;
    const rows = (await RiceProduct.findAll()).filter((p) => p.isAvailable !== false).map((p) => ({
      id: p.id, name: p.brandName || `Rice #${p.id}`, variety: p.variety || '', grade: p.millingGrade || '', description: p.description || '',
      weightKg: Number(p.weightKg) || 0, price: effectivePrice(p), stock: Number(p.stockQuantity) || 0, organic: !!p.isOrganic,
      onFlash: !!(flashSaleState && flashSaleState.active && p.flashSalePrice !== null && p.flashSalePrice !== undefined), regular: Number(p.basePrice) || null
    }));
    productCache = { at: Date.now(), rows };
    return rows;
  }
  const productById = async (id) => (await loadProducts()).find((p) => Number(p.id) === Number(id)) || null;
  const pName = (p) => `${p.name}${p.weightKg ? ` ${p.weightKg}kg` : ''}`;
  const stockText = (p, L) => (p.stock <= 0 ? L('out of stock', 'imeisha') : p.stock <= 10 ? L(`only ${p.stock} left`, `zimebaki ${p.stock} tu`) : L('in stock', 'ipo'));

  async function countyFeeMap() {
    let stored = {};
    try { const row = await SystemConfig.findOne({ where: { key: 'county_overrides' } }); stored = (row && row.value) || {}; } catch (_) { /* ignore */ }
    return { ...(countyOverrides || {}), ...stored };
  }
  const countyList = async () => Object.keys(await countyFeeMap());
  const areasOf = (county) => (Array.isArray(logisticsHierarchy && logisticsHierarchy[county]) ? logisticsHierarchy[county] : []);

  let townIndex = null;
  function townLookup(rawText) {
    if (!townIndex) {
      townIndex = new Map();
      Object.entries(logisticsHierarchy || {}).forEach(([county, areas]) => (Array.isArray(areas) ? areas : []).forEach((a) => {
        const k = N.stripAccents(a).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (k.length >= 4) { const arr = townIndex.get(k) || []; arr.push({ county, area: a }); townIndex.set(k, arr); }
        // also index the distinctive first word ("Thika Town" -> "thika"), skipping generic words
        const first = N.stripAccents(a).toLowerCase().split(/[\s,/-]+/)[0].replace(/[^a-z0-9]/g, '');
        if (first.length >= 5 && !['north', 'south', 'east', 'west', 'central', 'town', 'upper', 'lower', 'kisumu'].includes(first) && first !== k) { const arr2 = townIndex.get(first) || []; if (!arr2.some((x) => x.area === a)) arr2.push({ county, area: a }); townIndex.set(first, arr2); }
      }));
    }
    const words = N.stripAccents(rawText).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (let size = 3; size >= 1; size -= 1) for (let i = 0; i + size <= words.length; i += 1) {
      const hit = townIndex.get(words.slice(i, i + size).join(''));
      if (hit) return hit;
    }
    return null;
  }

  function deliveryTimeFor(settings, county) {
    const names = Object.keys(settings.deliveryTimes.byCounty || {});
    const m = N.fuzzyPlace(county, names, 0.99);
    return (m && settings.deliveryTimes.byCounty[m.name]) || settings.deliveryTimes.default;
  }

  /** The SAME maths as /api/orders/create (flash price, quantity tiers, bulk %, promo, county / bulk delivery fee). */
  async function priceBasket(items, { county, promoCode, user, settings } = {}) {
    const cfg = await getBulkConfig();
    const tiers = await getWholesaleTiers();
    const lines = []; const problems = []; let subtotal = 0, anyBulk = false, kg = 0;
    for (const it of items) {
      const product = await RiceProduct.findByPk(Number(it.productId));
      const qty = Math.round(Number(it.quantity));
      if (!product || product.isAvailable === false || !(qty >= 1)) { problems.push({ productId: it.productId, text: 'no longer available' }); continue; }
      let price = effectivePrice(product);
      const notes = [];
      const tier = bestTier(tiers[product.id], qty);
      if (tier && Number(tier.price) < price) { price = Number(tier.price); notes.push('quantity price'); }
      const lineKg = (Number(product.weightKg) || 0) * qty;
      const rule = bulkRuleFor(cfg, product.id);
      const isBulk = it.bulk === true && cfg.enabled && lineKg >= rule.minKg;
      if (isBulk) {
        anyBulk = true;
        const bp = round2(price * (1 - rule.discountPercent / 100));
        if (rule.discountPercent > 0 && bp < price) { price = bp; notes.push(`${rule.discountPercent}% bulk discount`); }
      }
      const inStock = isBulk ? true : Number(product.stockQuantity) >= qty;
      if (!inStock) problems.push({ productId: product.id, text: Number(product.stockQuantity) <= 0 ? 'is out of stock' : `only ${product.stockQuantity} left` , available: Number(product.stockQuantity) });
      const lineTotal = round2(price * qty);
      subtotal += lineTotal; kg += lineKg;
      lines.push({ productId: product.id, name: `${product.brandName} ${product.weightKg || 0}kg`, bagKg: Number(product.weightKg) || 0, quantity: qty, unitPrice: price, lineTotal, bulk: isBulk, inStock, notes });
    }
    subtotal = round2(subtotal);
    const out = { lines, problems, subtotal, discount: 0, net: subtotal, kg, anyBulk, points: Number((kg * 0.2).toFixed(2)) };
    if (promoCode) {
      const pr = await evaluatePromo(promoCode, user ? user.id : null, subtotal);
      out.promo = { code: pr.code || String(promoCode).toUpperCase(), valid: !!pr.valid, message: pr.message };
      if (pr.valid) { out.discount = pr.discount; out.net = round2(subtotal - pr.discount); }
    }
    if (county) {
      const map = await countyFeeMap();
      let fee = Number(map[county]);
      if (!Number.isFinite(fee)) fee = 250;
      if (anyBulk) { const bf = bulkTransportFor(cfg, county); if (bf !== undefined && Number.isFinite(bf)) fee = bf; }
      out.county = county; out.fee = fee; out.total = round2(out.net + fee);
      if (settings) out.eta = deliveryTimeFor(settings, county);
    }
    return out;
  }

  // ================================================================ SESSIONS (the conversation memory)
  const sessions = new Map();
  const freshSession = () => ({ lang: 'en', stage: 'IDLE', draft: { items: [], county: null, town: null, street: null, method: null, phone: null, promo: null }, pending: null, expect: null,
    lastUnknown: null, pendingClarify: null, misses: 0, active: null, lastOrderId: null, orderLock: false, touched: Date.now(), reachedStage: 'IDLE' });

  async function getSession(key, guestKey) {
    let s = sessions.get(key);
    if (!s && mode.sessions === 'table') {
      try { const r = await load('sessions', key); if (r && r.data && r.data.s) { s = { ...freshSession(), ...r.data.s, orderLock: false }; sessions.set(key, s); } } catch (_) { /* start fresh */ }
    }
    if (!s) { s = freshSession(); sessions.set(key, s); }
    // customer signed in during the chat: bring their guest basket along
    if (guestKey && guestKey !== key && sessions.has(guestKey)) {
      const g = sessions.get(guestKey);
      if (g.draft.items.length && !s.draft.items.length) { s.draft = g.draft; s.stage = g.stage === 'IDLE' ? 'CART_REVIEW' : g.stage; s.lang = g.lang; }
      sessions.delete(guestKey);
    }
    s.touched = Date.now();
    return s;
  }
  async function persistSession(key, s) {
    if (mode.sessions !== 'table') return;
    try { await upsert('sessions', key, { status: 'open', data: {} }, (r) => { r.data = { s: { ...s, lastUnknown: null, pendingClarify: null } }; }); } catch (_) { /* best effort */ }
  }
  async function noteAbandoned(key, s, userId) {
    if (!s.draft.items.length || s.active) return;
    try {
      const rows = await priceBasket(s.draft.items, {});
      await upsert('abandoned', `${userId ? 'u' + userId : 'g'}:${rid()}`, { status: 'open', data: {} }, (r) => {
        r.data = { userId: userId || null, items: rows.lines.map((l) => `${l.quantity} x ${l.name}`), subtotal: rows.subtotal, stage: s.reachedStage, at: new Date().toISOString() };
      });
    } catch (_) { /* ignore */ }
  }
  setInterval(async () => {
    const t = Date.now();
    for (const [key, s] of sessions) {
      if (t - s.touched > SESSION_TTL_MS) { sessions.delete(key); await noteAbandoned(key, s, key.startsWith('u') ? Number(key.slice(1)) : null); }
    }
    try { await flushCollections(); await evaluateNeeds(); } catch (_) { /* ignore */ }
  }, 60 * 1000).unref?.();

  // ================================================================ ORDERS (the signed-in customer's own, ownership checked here)
  async function shapeOrder(o, settings) {
    const pd = o.paymentDetails || {};
    let delivery = null;
    try { const d = await Delivery.findOne({ where: { orderId: o.id } }); if (d) delivery = { status: d.status, riderName: d.riderName, riderPhone: d.riderPhone, vehicle: d.vehicle }; } catch (_) { /* none */ }
    return {
      id: o.id, date: new Date(o.createdAt).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric' }),
      status: o.status, paid: pd.isPaid === true, paymentStatus: pd.paidTag || (pd.isPaid ? 'PAID' : 'PENDING'), method: pd.method === 'mpesa_till' ? 'Till' : 'M-Pesa prompt',
      receipt: pd.mpesaReceipt || null, problem: pd.failureReason || null, total: Number(o.grandTotal) || 0, fee: Number(o.transportFee) || 0,
      items: getOrderItems(o).map((i) => `${i.quantity} x ${i.name || i.brandName}`), to: [o.town, o.county].filter(Boolean).join(', '),
      delivery, eta: o.county ? deliveryTimeFor(settings, o.county) : null, points: Number(o.pointsEarned) || 0
    };
  }
  async function myOrder(user, id) {
    const o = await Order.findByPk(Number(id));
    return o && o.userId === user.id ? o : null;
  }

  // ================================================================ CONVERSATION ENGINE
  const R = (reply, chips = [], actions = []) => ({ reply, chips, actions });
  const chip = (label, value) => ({ label, value });
  const FLOW_STAGES = new Set(['ASK_PRODUCT', 'ASK_QTY', 'CART_REVIEW', 'ASK_COUNTY', 'ASK_TOWN', 'ASK_STREET', 'ASK_PROMO', 'SUMMARY', 'ASK_METHOD', 'ASK_PHONE', 'CONFIRM_FINAL']);
  const SIDE_INTENTS = new Set(['price', 'stock', 'list_products', 'recommend', 'delivery', 'bulk', 'payment_info', 'store_info', 'rewards', 'identity', 'help', 'thanks', 'greet', 'signin']);
  const INTENT_LABEL = { price: 'prices', stock: 'stock', list_products: 'the rice we sell', recommend: 'a recommendation', buy: 'placing an order', delivery: 'delivery', bulk: 'bulk orders',
    order_status: 'your orders', payment_info: 'how to pay', paid: 'checking your payment', retry_stk: 'resending the M-Pesa prompt', store_info: 'our contacts and hours', rewards: 'reward points',
    promo: 'a promo code', human: 'talking to our team', complaint: 'a complaint', cart_show: 'your basket', cart_clear: 'clearing your basket', checkout: 'checking out', repeat_order: 'repeating your last order',
    signin: 'signing in', help: 'how this works', greet: 'saying hello', thanks: 'thanks', identity: 'who I am' };

  const freshDraft = () => ({ items: [], county: null, town: null, street: null, method: null, phone: null, promo: null });
  const titleCase = (t) => String(t).toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const firstName = (u) => (u && u.fullName ? String(u.fullName).trim().split(/\s+/)[0] : '');

  async function resolveProduct(c, norm = c.norm) {
    const prods = await loadProducts();
    const ms = N.matchProducts(norm, prods, learned.aliases);
    if (!ms.length) return { kind: 'none' };
    const top = ms[0];
    const near = ms.filter((m) => m.score >= top.score - 0.12);
    const byId = (id) => prods.find((p) => p.id === id);
    if (top.score >= 0.7 && near.length === 1) return { kind: 'one', p: byId(top.id) };
    return { kind: 'many', list: (top.score >= 0.7 ? near : ms).slice(0, 5).map((m) => byId(m.id)) };
  }
  const productChips = (list) => list.filter((p) => p.stock > 0 || true).slice(0, 6).map((p) => chip(`${pName(p)} · ${kes(p.price)}`, `product:${p.id}`));

  // ---------------------------------------------------------------- product menu / details
  async function productMenu(c, intro) {
    const { L, s } = c;
    s.stage = 'ASK_PRODUCT'; s.reachedStage = s.reachedStage === 'IDLE' ? 'ASK_PRODUCT' : s.reachedStage;
    const prods = (await loadProducts()).slice().sort((a, b) => ((b.stock > 0) - (a.stock > 0)) || a.price - b.price);
    if (!prods.length) return R(L('Our catalogue is empty right now. Please check back soon or contact customer care.', 'Hakuna bidhaa sasa. Tafadhali jaribu baadaye au wasiliana nasi.'));
    const lines = prods.slice(0, 12).map((p) => `- ${pName(p)}: ${kes(p.price)} (${stockText(p, L)})${p.onFlash ? ' ⚡ flash sale' : ''}`);
    return R(`${intro || L('Here is our rice. Tap one to order, or type the name:', 'Hii ndiyo mchele wetu. Bonyeza ili kuagiza, au andika jina:')}\n${lines.join('\n')}`, productChips(prods));
  }

  async function productDetail(c, p) {
    const { L } = c;
    const cfg = await getBulkConfig(); const tiers = await getWholesaleTiers(); const rule = bulkRuleFor(cfg, p.id);
    const perKg = p.weightKg ? kes(p.price / p.weightKg) : null;
    const parts = [`${pName(p)}: ${kes(p.price)} ${L('per bag', 'kwa gunia')}${perKg ? ` (${perKg}/kg)` : ''}, ${stockText(p, L)}.`];
    if (p.onFlash && p.regular) parts.push(L(`Flash sale price (usually ${kes(p.regular)}).`, `Bei ya flash sale (kawaida ${kes(p.regular)}).`));
    if (p.grade) parts.push(`${L('Grade', 'Daraja')}: ${p.grade}.`);
    if (p.description) parts.push(clip(p.description, 160));
    const t = tiers[p.id];
    if (Array.isArray(t) && t.length) parts.push(L('Buy more, pay less: ', 'Nunua zaidi, lipa kidogo: ') + t.map((x) => `${x.minQty}+ ${L('bags', 'magunia')} = ${kes(x.price)} ${L('each', 'kila moja')}`).join('; ') + '.');
    if (cfg.enabled && rule.discountPercent > 0) parts.push(L(`Bulk: ${rule.discountPercent}% off from ${rule.minKg}kg.`, `Jumla: punguzo la ${rule.discountPercent}% kuanzia ${rule.minKg}kg.`));
    return parts.join(' ');
  }

  async function productInfo(c) {
    const { L, s } = c;
    const r = await resolveProduct(c);
    if (r.kind === 'one') return R(await productDetail(c, r.p), [chip(L('Buy this', 'Nunua hii'), `product:${r.p.id}`), chip(L('Delivery cost', 'Gharama ya usafiri'), 'delivery cost')]);
    if (r.kind === 'many') return R(L('I found a few matches:', 'Nimepata zinazofanana:') + '\n' + r.list.map((p) => `- ${pName(p)}: ${kes(p.price)} (${stockText(p, L)})`).join('\n'), productChips(r.list));
    return productMenu(c, L('Here is everything we sell right now:', 'Hiki ndicho tunachouza sasa:'));
  }

  async function recommend(c) {
    const { L } = c;
    const prods = (await loadProducts()).filter((p) => p.stock > 0);
    if (!prods.length) return R(L('Everything is out of stock right now, sorry. Please check again soon.', 'Samahani, kila kitu kimeisha sasa. Tafadhali angalia tena baadaye.'));
    const n = c.norm;
    const perKg = (p) => (p.weightKg ? p.price / p.weightKg : p.price);
    let picks = []; let why = '';
    const fam = n.match(/(?:family of|for|watu|we are|kwa watu)\s*(\d{1,2})/);
    if (/pilau|biryani|aromatic|fragrant|basmati|pishori|special|wedding/.test(n)) {
      const m = prods.filter((p) => /basmati|pishori|aromatic|pilau|biryani/i.test(`${p.name} ${p.variety} ${p.description}`));
      picks = (m.length ? m : prods).sort((a, b) => perKg(a) - perKg(b)).slice(0, 2); why = L('good for pilau and biryani', 'nzuri kwa pilau na biryani');
    } else if (/cheap|budget|afford|low price|bei nafuu|nafuu|save/.test(n)) {
      picks = prods.slice().sort((a, b) => perKg(a) - perKg(b)).slice(0, 2); why = L('lowest price per kg', 'bei ya chini kwa kilo');
    } else if (/brown|health|organic|diet|diabet|sukari/.test(n)) {
      const m = prods.filter((p) => p.organic || /brown|organic/i.test(`${p.name} ${p.variety} ${p.description}`));
      picks = (m.length ? m : prods).slice(0, 2); why = L('the healthier choices we have', 'chaguo bora kiafya tulilonalo');
    } else {
      const sold = await topSellers();
      picks = prods.slice().sort((a, b) => (sold[b.id] || 0) - (sold[a.id] || 0) || perKg(a) - perKg(b)).slice(0, 2);
      why = Object.keys(sold).length ? L('our most ordered', 'zinazonunuliwa zaidi') : L('a good all-round choice', 'chaguo zuri la kila siku');
    }
    let text = L(`I would suggest (${why}):`, `Ningependekeza (${why}):`) + '\n' + picks.map((p) => `- ${pName(p)}: ${kes(p.price)}${p.weightKg ? ` (${kes(p.price / p.weightKg)}/kg)` : ''}`).join('\n');
    if (fam) { const people = Math.min(50, Number(fam[1])); text += '\n' + L(`Rough guide: a household of ${people} eating rice daily uses about ${Math.ceil(people * 3)}kg a month.`, `Makadirio: watu ${people} wakila wali kila siku hutumia takriban ${Math.ceil(people * 3)}kg kwa mwezi.`); }
    else text += '\n' + L('Tell me how many people you cook for and I can estimate how much you need.', 'Niambie mnapika kwa watu wangapi nikupe makadirio ya kiasi.');
    return R(text, productChips(picks));
  }
  let sellerCache = { at: 0, map: {} };
  async function topSellers() {
    if (Date.now() - sellerCache.at < 600000) return sellerCache.map;
    const map = {};
    try {
      const orders = await Order.findAll({ order: [['createdAt', 'DESC']], limit: 300 });
      orders.forEach((o) => { if ((o.paymentDetails || {}).isPaid === true) getOrderItems(o).forEach((i) => { map[i.productId] = (map[i.productId] || 0) + (Number(i.quantity) || 1); }); });
    } catch (_) { /* no history */ }
    sellerCache = { at: Date.now(), map }; return map;
  }

  // ---------------------------------------------------------------- basket
  async function basketText(c, price) {
    const { L } = c;
    const lines = price.lines.map((l) => `- ${l.quantity} x ${l.name}: ${kes(l.unitPrice)} ${L('each', 'kila moja')} = ${kes(l.lineTotal)}${l.notes.length ? ` (${l.notes.join(', ')})` : ''}${l.inStock ? '' : ' ⚠️'}`);
    return lines.join('\n');
  }

  async function cartReview(c, { added, notes } = {}) {
    const { L, s } = c;
    s.stage = 'CART_REVIEW'; if (['IDLE', 'ASK_PRODUCT', 'ASK_QTY'].includes(s.reachedStage)) s.reachedStage = 'CART_REVIEW';
    if (!s.draft.items.length) return productMenu(c, L('Your basket is empty. What would you like?', 'Kikapu chako ni tupu. Ungependa nini?'));
    const price = await priceBasket(s.draft.items, { promoCode: s.draft.promo, user: c.user, settings: c.settings });
    let text = '';
    if (added) text += `${L('Added', 'Nimeongeza')}: ${added}\n`;
    if (notes) text += `${notes}\n`;
    text += `${L('Your order so far:', 'Oda yako hadi sasa:')}\n${await basketText(c, price)}\n${L('Rice total', 'Jumla ya mchele')}: ${kes(price.net)}${price.discount ? ` (${L('promo saved', 'punguzo')} ${kes(price.discount)})` : ''}. ${L('Delivery is added once I know where to send it.', 'Gharama ya usafiri itaongezwa baada ya kujua anwani.')}`;
    if (price.problems.length) text += '\n⚠️ ' + price.problems.map((p) => `${p.productId}: ${p.text}`).join('; ');
    return R(text, [chip(L('Checkout', 'Lipa / Endelea'), 'cmd:checkout'), chip(L('Add more rice', 'Ongeza mchele'), 'cmd:more'), chip(L('Remove an item', 'Ondoa kitu'), 'cmd:remove'), chip(L('Clear basket', 'Futa kikapu'), 'cmd:clear')]);
  }

  async function qtyPrompt(c) {
    const { L, s } = c;
    const p = await productById(s.pending && s.pending.productId);
    if (!p) { s.pending = null; return productMenu(c); }
    s.stage = 'ASK_QTY';
    const cfg = await getBulkConfig(); const rule = bulkRuleFor(cfg, p.id);
    const stockNote = p.stock <= 0 ? L(' It is out of shelf stock, so only a bulk order is possible.', ' Imeisha dukani, kwa hivyo ni oda ya jumla tu inawezekana.') : '';
    let text = L(`${pName(p)} is ${kes(p.price)} per bag${p.onFlash ? ' (flash sale!)' : ''}.${stockNote} How many bags do you want? You can also type kilograms, like "50 kg".`,
      `${pName(p)} ni ${kes(p.price)} kwa gunia${p.onFlash ? ' (flash sale!)' : ''}.${stockNote} Unataka magunia mangapi? Unaweza pia kuandika kilo, mfano "50 kg".`);
    if (cfg.enabled && rule.discountPercent > 0) text += L(` From ${rule.minKg}kg you get ${rule.discountPercent}% off (bulk).`, ` Kuanzia ${rule.minKg}kg unapata punguzo la ${rule.discountPercent}% (jumla).`);
    const chips = [chip(L('1 bag', 'Gunia 1'), 'qty:1'), chip(L('2 bags', 'Magunia 2'), 'qty:2'), chip(L('5 bags', 'Magunia 5'), 'qty:5')];
    if (cfg.enabled && rule.discountPercent > 0) chips.push(chip(L(`Bulk ${rule.minKg} kg`, `Jumla ${rule.minKg} kg`), `kg:${rule.minKg}`));
    return R(text, chips);
  }

  async function selectProduct(c, p, q) {
    c.s.pending = { productId: p.id };
    if (q && (q.bags || q.kg || q.bare)) return applyQty(c, p, q);
    return qtyPrompt(c);
  }

  async function applyQty(c, p, q, { replace } = {}) {
    const { L, s } = c;
    const w = p.weightKg || 1;
    let bags = q.bags != null ? Math.round(q.bags) : null; let note = '';
    if (bags == null && q.kg != null) {
      bags = Math.max(1, Math.round(q.kg / w));
      if (Math.abs(bags * w - q.kg) > 0.01) note = L(`${p.name} comes in ${w}kg bags, so ${q.kg}kg becomes ${bags} bag(s) = ${bags * w}kg.`, `${p.name} inauzwa kwa magunia ya ${w}kg, kwa hivyo ${q.kg}kg ni gunia ${bags} = ${bags * w}kg.`);
    }
    if (bags == null && q.bare != null) bags = Math.round(q.bare);
    if (!Number.isFinite(bags) || bags < 1) return R(L('Please tell me a number of bags (like 2) or kilograms (like 50 kg).', 'Tafadhali niambie idadi ya magunia (mfano 2) au kilo (mfano 50 kg).'), [chip('1', 'qty:1'), chip('2', 'qty:2'), chip('5', 'qty:5')]);
    if (bags > 1000) return R(L('That is a very large amount. For quantities above 1000 bags please talk to our team.', 'Hiyo ni kubwa sana. Kwa zaidi ya magunia 1000 tafadhali ongea na timu yetu.'), [chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')]);
    const cfg = await getBulkConfig(); const rule = bulkRuleFor(cfg, p.id);
    const bulk = cfg.enabled && rule.discountPercent > 0 && bags * (p.weightKg || 0) >= rule.minKg;
    const same = s.draft.items.find((i) => i.productId === p.id && !!i.bulk === bulk);
    const newQty = replace || !same ? bags : same.quantity + bags;
    if (!bulk) {
      const otherLines = s.draft.items.filter((i) => i.productId === p.id && !i.bulk && i !== same).reduce((n, i) => n + i.quantity, 0);
      if (p.stock < newQty + otherLines) {
        const alts = (await loadProducts()).filter((x) => x.id !== p.id && x.stock > 0).slice(0, 3);
        const left = Math.max(0, p.stock - otherLines);
        const need = Math.max(1, Math.ceil((rule.minKg - 0) / w));
        let text = left > 0 ? L(`Only ${left} bag(s) of ${pName(p)} are in stock.`, `Zimebaki gunia ${left} tu za ${pName(p)}.`) : L(`${pName(p)} is out of stock.`, `${pName(p)} imeisha.`);
        if (cfg.enabled && rule.discountPercent > 0) text += L(` Bulk orders (${rule.minKg}kg or more, about ${need} bags) are supplied separately and are not limited by shelf stock.`, ` Oda za jumla (${rule.minKg}kg au zaidi, takriban magunia ${need}) hazizuiwi na hisa ya dukani.`);
        const chips = [];
        if (left > 0) chips.push(chip(L(`Take ${left}`, `Chukua ${left}`), `qty:${left}`));
        alts.forEach((a) => chips.push(chip(`${pName(a)} · ${kes(a.price)}`, `product:${a.id}`)));
        s.stage = 'ASK_QTY';
        return R(text, chips);
      }
    }
    if (same) same.quantity = newQty; else s.draft.items.push({ productId: p.id, quantity: newQty, bulk });
    s.pending = null; s.lastItem = { productId: p.id, bulk };
    const extra = [note, bulk ? L(`That is ${bags * (p.weightKg || 0)}kg, so it counts as a BULK order: ${rule.discountPercent}% off and bulk delivery rates.`, `Hiyo ni ${bags * (p.weightKg || 0)}kg, kwa hivyo ni oda ya JUMLA: punguzo la ${rule.discountPercent}% na ada ya usafiri ya jumla.`) : ''].filter(Boolean).join(' ');
    return cartReview(c, { added: `${newQty} x ${pName(p)}${bulk ? ' (bulk)' : ''}`, notes: extra });
  }

  // ---------------------------------------------------------------- checkout steps
  async function proceedCheckout(c) {
    const { L, s, user } = c;
    if (!s.draft.items.length) return productMenu(c, L('Your basket is empty. Pick some rice first:', 'Kikapu chako ni tupu. Chagua mchele kwanza:'));
    if (!user) {
      s.stage = 'CART_REVIEW'; s.needLogin = true;
      return R(L('To buy through chat you need to be signed in, so your order and receipt are saved in your account. Please sign in or create an account. Your basket will wait for you here.', 'Ili kununua kupitia gumzo lazima uwe umeingia kwenye akaunti, ili oda na risiti zihifadhiwe. Tafadhali ingia au jisajili. Kikapu chako kitasubiri hapa.'),
        [chip(L('I have signed in', 'Nimeingia'), 'cmd:resume')], [{ type: 'open_login' }]);
    }
    s.needLogin = false;
    const price = await priceBasket(s.draft.items, { user, settings: c.settings });
    if (price.problems.length) {
      const bad = price.problems[0];
      const p = await productById(bad.productId);
      return R(L(`Before we continue: ${p ? pName(p) : 'one item'} ${bad.text}. Let me adjust your basket.`, `Kabla hatujaendelea: ${p ? pName(p) : 'kitu kimoja'} ${bad.text}. Hebu nirekebishe kikapu.`), [chip(L('Remove it', 'Ondoa'), `cmd:remove:${bad.productId}`), chip(L('Change quantity', 'Badilisha idadi'), `cmd:setqty:${bad.productId}`)]);
    }
    if (!s.draft.county) {
      const last = await Order.findOne({ where: { userId: user.id }, order: [['createdAt', 'DESC']] });
      if (last && last.county && last.county !== 'Not Specified' && last.town) {
        const sa = last.shippingAddress || {};
        s.lastAddr = { county: last.county, town: last.town, street: sa.streetAddress && sa.streetAddress !== 'Not Specified' ? sa.streetAddress : null };
        s.stage = 'ASK_COUNTY';
        return R(L(`Deliver to the same place as last time: ${s.lastAddr.street ? s.lastAddr.street + ', ' : ''}${last.town}, ${last.county}?`, `Tuleta mahali pale pale kama mara ya mwisho: ${s.lastAddr.street ? s.lastAddr.street + ', ' : ''}${last.town}, ${last.county}?`),
          [chip(L('Yes, same address', 'Ndio, anwani ile ile'), 'cmd:lastaddr'), chip(L('A different address', 'Anwani tofauti'), 'cmd:newaddr')]);
      }
    }
    return nextAddressStep(c);
  }

  async function nextAddressStep(c) {
    const d = c.s.draft;
    if (!d.county) return promptCounty(c);
    if (!d.town) return promptTown(c);
    if (!d.street) return promptStreet(c);
    return showSummary(c);
  }

  async function promptCounty(c) {
    const { L, s } = c;
    s.stage = 'ASK_COUNTY'; s.reachedStage = 'ASK_COUNTY';
    const all = await countyList();
    const quick = Object.keys(c.settings.deliveryTimes.byCounty).filter((n) => all.includes(n)).slice(0, 6);
    return R(L('Which county should we deliver to? You can also type your town, like "Thika".', 'Tunaleta kaunti gani? Unaweza pia kuandika mji wako, mfano "Thika".'), quick.map((n) => chip(n, `county:${n}`)));
  }
  async function promptTown(c) {
    const { L, s } = c;
    s.stage = 'ASK_TOWN';
    const areas = areasOf(s.draft.county);
    const fee = (await countyFeeMap())[s.draft.county];
    const eta = deliveryTimeFor(c.settings, s.draft.county);
    return R(L(`Delivery to ${s.draft.county}: ${kes(fee)} per order, usually ${eta}. Which town or area?`, `Usafiri kwenda ${s.draft.county}: ${kes(fee)} kwa oda, kwa kawaida ${eta}. Mji au eneo gani?`), areas.slice(0, 8).map((a) => chip(a, `town:${a}`)));
  }
  async function promptStreet(c) {
    const { L, s } = c;
    s.stage = 'ASK_STREET';
    return R(L(`Almost there. Where exactly in ${s.draft.town} should the rider deliver? Type your estate, street or a landmark (e.g. "Greenpark Estate, near Naivas").`, `Karibu tumemaliza. Rider akufikishie wapi hasa ${s.draft.town}? Andika mtaa, barabara au alama (mfano "Greenpark Estate, karibu na Naivas").`),
      [chip(L('Town centre', 'Katikati ya mji'), 'cmd:centre')]);
  }

  async function showSummary(c) {
    const { L, s, user } = c;
    const d = s.draft;
    if (!d.county || !d.town || !d.street) return nextAddressStep(c);
    s.stage = 'SUMMARY'; s.reachedStage = 'SUMMARY';
    const price = await priceBasket(d.items, { county: d.county, promoCode: d.promo, user, settings: c.settings });
    let text = `${L('Here is your order summary:', 'Muhtasari wa oda yako:')}\n${await basketText(c, price)}\n`;
    text += `${L('Rice', 'Mchele')}: ${kes(price.subtotal)}\n`;
    if (price.discount) text += `${L('Promo', 'Punguzo')} ${price.promo.code}: -${kes(price.discount)}\n`;
    else if (price.promo && !price.promo.valid) text += `⚠️ ${price.promo.message}\n`;
    text += `${L('Delivery', 'Usafiri')} (${price.county}): ${kes(price.fee)}${price.anyBulk ? L(' (bulk rate)', ' (bei ya jumla)') : ''}\n`;
    text += `${L('TOTAL', 'JUMLA')}: ${kes(price.total)}\n`;
    text += `${L('Deliver to', 'Tuleta')}: ${d.street}, ${d.town}, ${d.county}\n${L('Usually', 'Kwa kawaida')}: ${price.eta}. ${L('You will earn', 'Utapata')} ${price.points} ${L('reward points.', 'pointi za zawadi.')}`;
    const chips = [chip(L('Continue to payment', 'Endelea kulipa'), 'cmd:continue')];
    if (!d.promo || (price.promo && !price.promo.valid)) chips.push(chip(L('Add promo code', 'Weka kuponi'), 'cmd:promo'));
    chips.push(chip(L('Change address', 'Badilisha anwani'), 'cmd:newaddr'), chip(L('Add more rice', 'Ongeza mchele'), 'cmd:more'));
    return R(text, chips);
  }

  async function promptMethod(c) {
    const { L, s } = c;
    const pay = await getPaymentConfig();
    s.stage = 'ASK_METHOD'; s.reachedStage = 'ASK_METHOD';
    const chips = [];
    if (pay.stkEnabled) chips.push(chip(L('M-Pesa prompt (STK)', 'M-Pesa kwenye simu (STK)'), 'method:stk'));
    if (pay.tillEnabled) chips.push(chip(L(`Pay to Till ${pay.tillNumber}`, `Lipa Till ${pay.tillNumber}`), 'method:till'));
    if (!chips.length) return R(L('Payments are switched off right now. Please try again shortly or contact customer care.', 'Malipo yamezimwa sasa. Tafadhali jaribu tena baadaye au wasiliana nasi.'));
    if (chips.length === 1) { s.draft.method = pay.stkEnabled ? 'mpesa_stk' : 'mpesa_till'; return afterMethod(c); }
    return R(L('How would you like to pay?\n- M-Pesa prompt (STK): a payment pop-up appears on your phone, you just enter your PIN.\n- Till / Paybill: you pay the shop Till yourself, then send me the M-Pesa code from the SMS.', 'Ungependa kulipa vipi?\n- M-Pesa (STK): dirisha la malipo linatokea kwenye simu, unaweka PIN tu.\n- Till / Paybill: unalipa Till ya duka mwenyewe kisha unanitumia msimbo wa M-Pesa kutoka kwenye SMS.'), chips);
  }
  async function afterMethod(c) {
    const { L, s, user } = c;
    if (s.draft.method === 'mpesa_stk') {
      const own = normalizeKenyanPhone(user.phoneNumber);
      s.stage = 'ASK_PHONE';
      if (own && !s.draft.phone) return R(L(`Should I send the M-Pesa prompt to ${maskPhone(own)} (the number on your account)?`, `Nitume ombi la M-Pesa kwa ${maskPhone(own)} (namba ya akaunti yako)?`), [chip(L('Yes, that number', 'Ndio, namba hiyo'), 'phone:self'), chip(L('Use another number', 'Namba nyingine'), 'phone:other')]);
      return R(L('Which M-Pesa number should I send the prompt to? (e.g. 0712345678)', 'Nitume ombi la M-Pesa kwa namba gani? (mfano 0712345678)'));
    }
    return promptConfirm(c);
  }
  async function promptConfirm(c) {
    const { L, s, user } = c;
    const d = s.draft;
    if (!d.county || !d.town || !d.street) return nextAddressStep(c);
    s.stage = 'CONFIRM_FINAL'; s.reachedStage = 'CONFIRM_FINAL';
    const price = await priceBasket(d.items, { county: d.county, promoCode: d.promo, user, settings: c.settings });
    const how = d.method === 'mpesa_stk' ? L(`send an M-Pesa prompt for ${kes(Math.ceil(price.total))} to ${maskPhone(d.phone || user.phoneNumber)}`, `kutuma ombi la M-Pesa la ${kes(Math.ceil(price.total))} kwa ${maskPhone(d.phone || user.phoneNumber)}`)
      : L(`give you the Till number to pay ${kes(Math.ceil(price.total))}`, `kukupa namba ya Till ya kulipa ${kes(Math.ceil(price.total))}`);
    return R(L(`Final check: ${price.lines.length} item(s), total ${kes(price.total)}, delivered to ${d.town}, ${d.county}. If you confirm, I will place the order and ${how}. Shall I go ahead?`, `Mwisho: bidhaa ${price.lines.length}, jumla ${kes(price.total)}, kuletwa ${d.town}, ${d.county}. Ukithibitisha, nitaweka oda na ${how}. Niendelee?`),
      [chip(L('Yes, place order', 'Ndio, weka oda'), 'cmd:confirm'), chip(L('Not yet', 'Bado'), 'cmd:notyet')]);
  }

  // ---------------------------------------------------------------- placing the order and payment
  function invokeHandler(handler, reqLike) {
    return new Promise((resolve) => {
      let status = 200; let done = false;
      const finish = (b) => { if (!done) { done = true; resolve({ status, body: b }); } };
      const res = { status(code) { status = code; return res; }, json(b) { finish(b); return res; }, send(b) { finish(b); return res; }, setHeader() { return res; }, set() { return res; } };
      Promise.resolve().then(() => handler(reqLike, res)).then(() => setTimeout(() => finish({}), 50)).catch((e) => { status = 500; finish({ error: e.message }); });
    });
  }

  async function placeOrder(c) {
    const { L, s, user } = c;
    if (!user) return proceedCheckout(c);
    if (s.orderLock) return R(L('One moment, I am still placing your order…', 'Subiri kidogo, bado naweka oda yako…'));
    if (!s.draft.items.length || !s.draft.county || !s.draft.town || !s.draft.street || !s.draft.method) return nextAddressStep(c);
    s.orderLock = true;
    try {
      const d = s.draft;
      const price = await priceBasket(d.items, { county: d.county, promoCode: d.promo, user, settings: c.settings });
      if (price.problems.length) { s.stage = 'CART_REVIEW'; return R(L('Stock changed while we were chatting. Let me show your basket again.', 'Hisa imebadilika tulipokuwa tunaongea. Nikuonyeshe kikapu tena.')); }
      const snap = Cart ? (await Cart.findAll({ where: { userId: user.id } })).map((r) => ({ userId: r.userId, productId: r.productId, quantity: r.quantity })) : [];
      const body = {
        cartItems: d.items.map((i) => ({ productId: i.productId, quantity: i.quantity, bulk: !!i.bulk })),
        paymentMethod: d.method, mpesaPhoneNumber: d.method === 'mpesa_stk' ? (d.phone || normalizeKenyanPhone(user.phoneNumber)) : undefined,
        county: d.county, town: d.town, location: d.town, sublocation: '', streetAddress: d.street,
        shippingAddress: `${d.street}, ${d.town}, ${d.county}`, promoCode: price.promo && price.promo.valid ? d.promo : undefined
      };
      const result = await invokeHandler(createOrderHandler, { user: { id: user.id, role: user.role || 'customer', fullName: user.fullName, phoneNumber: user.phoneNumber, email: user.email }, body, ip: c.ip, headers: c.headers || {}, query: {}, params: {} });
      if (snap.length && Cart) { try { for (const r of snap) await Cart.create(r); } catch (_) { /* web cart restore is best effort */ } }
      const o = result.body || {};
      if (result.status >= 400 || !o.id) {
        const msg = (o && o.error) || 'The order could not be placed.';
        s.stage = result.status === 422 ? 'CART_REVIEW' : 'CONFIRM_FINAL';
        return R(L(`I could not place the order: ${msg}`, `Sikuweza kuweka oda: ${msg}`), result.status === 422 ? [chip(L('Show my basket', 'Nionyeshe kikapu'), 'cmd:checkout')] : [chip(L('Try again', 'Jaribu tena'), 'cmd:confirm'), chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')]);
      }
      // record where this order came from, without touching the payment fields
      try { const fresh = await Order.findByPk(o.id); fresh.paymentDetails = { ...(fresh.paymentDetails || {}), channel: 'chat_assistant' }; fresh.changed('paymentDetails', true); await fresh.save(); } catch (_) { /* tag is optional */ }
      await safeLog({ actor: { id: user.id, role: user.role || 'customer', name: user.fullName }, action: 'CHAT_ORDER_PLACED', category: 'orders', targetType: 'order', targetId: o.id, summary: `Order #${o.id} placed through the chat assistant for ${kes(o.grandTotal)}` });
      bump('orders');
      s.active = { orderId: o.id, method: d.method, phone: d.phone || normalizeKenyanPhone(user.phoneNumber), total: Number(o.grandTotal) || price.total, at: Date.now(), stkSent: !!o.stkPromptSent, lastCheck: 0, notified: null };
      s.lastOrderId = o.id; s.draft = freshDraft(); s.pending = null;
      const act = [{ type: 'order_placed', orderId: o.id, method: d.method, total: Number(o.grandTotal) }, { type: 'watch_payment', orderId: o.id, method: d.method }, { type: 'refresh_orders' }];
      if (d.method === 'mpesa_stk') {
        s.stage = 'AWAIT_PAYMENT';
        if (o.stkPromptSent) return R(L(`✅ Order #${o.id} is placed (${kes(o.grandTotal)}). I have sent an M-Pesa prompt to ${maskPhone(s.active.phone)}: enter your M-Pesa PIN on your phone to pay. I will confirm here the moment it goes through.`, `✅ Oda #${o.id} imewekwa (${kes(o.grandTotal)}). Nimetuma ombi la M-Pesa kwa ${maskPhone(s.active.phone)}: weka PIN yako ya M-Pesa kwenye simu ili ulipe. Nitakuthibitishia hapa pindi itakapopita.`),
          [chip(L('I have paid', 'Nimelipa'), 'cmd:check_payment'), chip(L('Resend prompt', 'Tuma tena'), 'cmd:resend'), chip(L('Use another number', 'Namba nyingine'), 'phone:other')], act);
        return R(L(`Order #${o.id} is saved (${kes(o.grandTotal)}) but the M-Pesa prompt did not go through${o.stkStatusMessage ? ` (${o.stkStatusMessage})` : ''}. Shall I try again?`, `Oda #${o.id} imehifadhiwa (${kes(o.grandTotal)}) lakini ombi la M-Pesa halikupita. Nijaribu tena?`),
          [chip(L('Resend prompt', 'Tuma tena'), 'cmd:resend'), chip(L('Use another number', 'Namba nyingine'), 'phone:other')], act);
      }
      s.stage = 'AWAIT_TILL_CODE';
      const t = o.till || {};
      return R(L(`✅ Order #${o.id} is placed. Pay ${kes(Math.ceil(o.grandTotal))} to Till ${t.number}${t.name ? ` (${t.name})` : ''} using M-Pesa, then paste the M-Pesa code from the confirmation SMS here (10 letters and numbers, like SJK4L9XQ2P).`,
        `✅ Oda #${o.id} imewekwa. Lipa ${kes(Math.ceil(o.grandTotal))} kwa Till ${t.number}${t.name ? ` (${t.name})` : ''} kupitia M-Pesa, kisha bandika msimbo wa M-Pesa kutoka kwenye SMS hapa (herufi na namba 10, mfano SJK4L9XQ2P).`), [], act);
    } catch (e) {
      console.error('❌ Chat order failed:', e.message);
      return R(L('Something went wrong while placing your order. Nothing was charged. Please try again or contact customer care.', 'Kuna hitilafu wakati wa kuweka oda. Hakuna pesa iliyokatwa. Tafadhali jaribu tena au wasiliana nasi.'), [chip(L('Try again', 'Jaribu tena'), 'cmd:confirm'), chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')]);
    } finally { s.orderLock = false; }
  }

  async function checkPayment(c, silent) {
    const { L, s, user } = c;
    const a = s.active;
    if (!user || !a) return silent ? null : R(L('You have no payment waiting. Would you like to see your recent orders?', 'Huna malipo yanayosubiri. Ungependa kuona oda zako za hivi karibuni?'), [chip(L('My orders', 'Oda zangu'), 'track my order')]);
    if (silent) { if (Date.now() - (a.lastPoll || 0) < 4000) return null; a.lastPoll = Date.now(); }
    let o = await myOrder(user, a.orderId);
    if (!o) { s.active = null; return silent ? null : R(L('I could not find that order on your account.', 'Sikupata oda hiyo kwenye akaunti yako.')); }
    let pd = o.paymentDetails || {};
    if (pd.isPaid !== true && pd.method !== 'mpesa_till') {
      try { await syncPayHeroPayment(o, 'chat payment check'); o = await Order.findByPk(o.id); pd = o.paymentDetails || {}; } catch (_) { /* gateway unreachable: report what we know */ }
    }
    if (pd.isPaid === true) {
      s.active = null; s.stage = 'DONE'; bump('paid');
      const so = await shapeOrder(o, c.settings);
      return { ...R(L(`🎉 Payment received! Order #${o.id} is confirmed.${pd.mpesaReceipt ? ` M-Pesa receipt: ${pd.mpesaReceipt}.` : ''}\n${so.items.join(', ')}\nTotal ${kes(so.total)}, delivery to ${so.to}, usually ${so.eta}. You earned ${so.points} reward points. The full details are saved under My Orders in your account.`,
        `🎉 Malipo yamepokelewa! Oda #${o.id} imethibitishwa.${pd.mpesaReceipt ? ` Risiti ya M-Pesa: ${pd.mpesaReceipt}.` : ''}\n${so.items.join(', ')}\nJumla ${kes(so.total)}, kuletwa ${so.to}, kwa kawaida ${so.eta}. Umepata pointi ${so.points}. Maelezo kamili yamehifadhiwa kwenye Oda Zangu.`),
        [chip(L('Track my order', 'Fuatilia oda'), 'track my order'), chip(L('Buy more rice', 'Nunua mchele zaidi'), 'cmd:more')], [{ type: 'refresh_orders' }, { type: 'payment_result', orderId: o.id, status: 'paid' }]), status: 'paid' };
    }
    if (pd.paidTag === 'FAILED' || o.status === 'payment_failed') {
      if (silent && a.notified === 'failed') return null;
      a.notified = 'failed';
      const isStk = a.method === 'mpesa_stk';
      return { ...R(L(`The payment for order #${o.id} did not go through${pd.failureReason ? `: ${pd.failureReason}` : ''}. No worries, your order is still saved. What would you like to do?`, `Malipo ya oda #${o.id} hayakupita${pd.failureReason ? `: ${pd.failureReason}` : ''}. Usijali, oda yako bado imehifadhiwa. Ungependa kufanya nini?`),
        [...(isStk ? [chip(L('Resend prompt', 'Tuma tena'), 'cmd:resend'), chip(L('Use another number', 'Namba nyingine'), 'phone:other')] : []), chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')], [{ type: 'refresh_orders' }, { type: 'payment_result', orderId: o.id, status: 'failed' }]), status: 'failed' };
    }
    if (o.status === 'cancelled') {
      s.active = null; s.stage = 'IDLE';
      return { ...R(L(`Order #${o.id} expired because it was not paid in time. You can start a new order any time.`, `Oda #${o.id} imeisha muda kwa sababu haikulipwa. Unaweza kuanza oda mpya wakati wowote.`), [chip(L('Start a new order', 'Anza oda mpya'), 'cmd:more')], [{ type: 'refresh_orders' }, { type: 'payment_result', orderId: o.id, status: 'expired' }]), status: 'expired' };
    }
    if (silent) return null;
    return { ...R(a.method === 'mpesa_till' ? L('I have not seen that payment yet. If you already paid, paste the M-Pesa code from your SMS and I will check it.', 'Sijaona malipo hayo bado. Ukishalipa, bandika msimbo wa M-Pesa kutoka kwenye SMS nitaukagua.')
      : L('Still waiting for the payment. Check your phone for the M-Pesa prompt and enter your PIN. If nothing appeared, I can resend it.', 'Bado ninasubiri malipo. Angalia simu yako ombi la M-Pesa uweke PIN. Kama hakuna kilichotokea, naweza kutuma tena.'),
      a.method === 'mpesa_stk' ? [chip(L('Resend prompt', 'Tuma tena'), 'cmd:resend'), chip(L('Use another number', 'Namba nyingine'), 'phone:other')] : []), status: 'pending' };
  }

  async function resendStk(c, phone) {
    const { L, s, user } = c;
    const a = s.active;
    if (!user || !a) return R(L('There is no unpaid order to resend a prompt for.', 'Hakuna oda isiyolipwa ya kutumia ombi tena.'));
    const o = await myOrder(user, a.orderId);
    if (!o) return R(L('I could not find that order.', 'Sikupata oda hiyo.'));
    const pd = o.paymentDetails || {};
    if (pd.isPaid === true) return checkPayment(c, false);
    if (o.status === 'cancelled') return R(L('That order expired. Please place a new order.', 'Oda hiyo imeisha muda. Tafadhali weka oda mpya.'), [chip(L('Start a new order', 'Anza oda mpya'), 'cmd:more')]);
    const pay = await getPaymentConfig();
    if (!pay.stkEnabled) return R(L('The M-Pesa prompt is switched off right now. You can pay to the Till instead.', 'Ombi la M-Pesa limezimwa sasa. Unaweza kulipa kwa Till badala yake.'));
    if (pd.stkSentAt && Date.now() - new Date(pd.stkSentAt).getTime() < 25000) return R(L('Please wait about 30 seconds before I send another prompt.', 'Tafadhali subiri sekunde 30 kabla sijatuma ombi lingine.'), [chip(L('I have paid', 'Nimelipa'), 'cmd:check_payment')]);
    if ((Number(pd.stkAttempts) || 0) >= 8) return R(L('Too many prompts were sent for this order. Please contact customer care.', 'Maombi mengi yametumwa kwa oda hii. Tafadhali wasiliana nasi.'), [chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')]);
    const target = phone || pd.mpesaNumber || user.phoneNumber;
    const r = await startPayHeroStk(o, target);
    if (!r.ok) return R(L(`I could not send the prompt: ${r.error}`, `Sikuweza kutuma ombi: ${r.error}`), [chip(L('Use another number', 'Namba nyingine'), 'phone:other'), chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')]);
    a.phone = normalizeKenyanPhone(target); a.notified = null; s.stage = 'AWAIT_PAYMENT';
    return R(L(`Done. I have sent a new M-Pesa prompt to ${maskPhone(target)}. Enter your PIN to pay.`, `Tayari. Nimetuma ombi jipya la M-Pesa kwa ${maskPhone(target)}. Weka PIN ulipe.`), [chip(L('I have paid', 'Nimelipa'), 'cmd:check_payment')], [{ type: 'watch_payment', orderId: o.id, method: 'mpesa_stk' }]);
  }

  async function submitTill(c, code) {
    const { L, s, user } = c;
    const a = s.active;
    if (!user || !a || a.method !== 'mpesa_till') return R(L('I do not have a Till order waiting for a code. Want to see your orders?', 'Sina oda ya Till inayosubiri msimbo. Unataka kuona oda zako?'), [chip(L('My orders', 'Oda zangu'), 'track my order')]);
    const order = await myOrder(user, a.orderId);
    if (!order) return R(L('I could not find that order.', 'Sikupata oda hiyo.'));
    const pd = order.paymentDetails || {};
    if (pd.isPaid === true) return checkPayment(c, false);
    if (order.status === 'cancelled' && !pd.expiredAt) return R(L('That order was cancelled.', 'Oda hiyo ilifutwa.'));
    const pay = await getPaymentConfig();
    if (!pay.tillEnabled) return R(L('Till payments are not available right now.', 'Malipo ya Till hayapatikani sasa.'));
    if (!MPESA_CODE_RE.test(code)) return R(L('The M-Pesa code is 10 letters and numbers, like SJK4L9XQ2P. Copy it from your M-Pesa SMS.', 'Msimbo wa M-Pesa ni herufi na namba 10, mfano SJK4L9XQ2P. Unakili kutoka kwenye SMS yako.'));
    const attempts = Number(pd.tillAttempts) || 0;
    if (attempts >= 8) return R(L('Too many attempts on this order. Please contact customer care.', 'Majaribio mengi kwa oda hii. Tafadhali wasiliana nasi.'), [chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')]);
    order.paymentDetails = { ...pd, method: 'mpesa_till', tillNumber: pay.tillNumber, tillName: pay.tillName, tillAttempts: attempts + 1, tillCodeSubmitted: code, failureReason: null };
    if (order.status === 'payment_failed') order.status = 'pending';
    await order.save();
    const result = await submitTillCode(order, code, normalizeKenyanPhone(user.phoneNumber) || null);
    await safeLog({ actor: { id: user.id, role: user.role || 'customer', name: user.fullName }, action: 'TILL_CODE_SUBMITTED', category: 'orders', severity: result.status === 'PAID' ? 'info' : 'warn', targetType: 'order', targetId: order.id, summary: `Order #${order.id}: customer submitted Till code ${code} through chat (${result.status})` });
    try { io.emit('orderStatusUpdated', await Order.findByPk(order.id)); } catch (_) { /* no socket */ }
    if (result.status === 'PAID') return checkPayment(c, false);
    const chips = result.status === 'SUBMITTED' ? [chip(L('Check my payment', 'Kagua malipo'), 'cmd:check_payment')] : [chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')];
    return R(`${result.message}`, chips, [{ type: 'watch_payment', orderId: order.id, method: 'mpesa_till' }]);
  }

  // ---------------------------------------------------------------- information answers
  async function deliveryAnswer(c, county) {
    const { L } = c;
    const map = await countyFeeMap(); const cfg = await getBulkConfig();
    const fee = Number(map[county]); const bulkFee = bulkTransportFor(cfg, county);
    const eta = deliveryTimeFor(c.settings, county);
    let text = L(`Delivery to ${county}: ${kes(fee)} per order (not per bag), usually ${eta}.`, `Usafiri kwenda ${county}: ${kes(fee)} kwa oda (si kwa gunia), kwa kawaida ${eta}.`);
    if (bulkFee !== undefined && Number.isFinite(bulkFee) && bulkFee !== fee) text += L(` Bulk orders to ${county} are ${kes(bulkFee)}.`, ` Oda za jumla kwenda ${county} ni ${kes(bulkFee)}.`);
    text += L(' The time starts once payment is confirmed. The exact fee shows before you pay.', ' Muda unaanza malipo yakithibitishwa. Ada kamili inaonekana kabla ya kulipa.');
    return R(text, [chip(L('Order now', 'Agiza sasa'), 'cmd:more')]);
  }

  async function bulkAnswer(c) {
    const { L } = c;
    const cfg = await getBulkConfig(); const prods = await loadProducts();
    if (!cfg.enabled) return R(L('Bulk pricing is not running right now, but you can still order as many bags as are in stock. Tell me what you need.', 'Bei ya jumla haipo sasa, lakini unaweza kuagiza magunia kadri yalivyopo. Niambie unachohitaji.'), [chip(L('Order rice', 'Agiza mchele'), 'cmd:more')]);
    const lines = prods.slice(0, 8).map((p) => { const r = bulkRuleFor(cfg, p.id); return r.discountPercent > 0 ? `- ${p.name}: ${r.discountPercent}% ${L('off from', 'punguzo kuanzia')} ${r.minKg}kg` : null; }).filter(Boolean);
    return R(L(`Bulk orders: order a big amount and get a discount, plus bulk delivery rates per county. Bulk orders are supplied separately, so they are not limited by shelf stock.\n${lines.join('\n') || `Default: ${cfg.discountPercent}% off from ${cfg.minKg}kg`}\nJust tell me the rice and how many kilograms, like "100 kg pishori".`,
      `Oda za jumla: agiza kiasi kikubwa upate punguzo na ada ya usafiri ya jumla kwa kila kaunti. Oda za jumla hazizuiwi na hisa ya dukani.\n${lines.join('\n') || `Kawaida: punguzo la ${cfg.discountPercent}% kuanzia ${cfg.minKg}kg`}\nNiambie aina ya mchele na kilo, mfano "100 kg pishori".`), [chip(L('Order in bulk', 'Agiza kwa jumla'), 'cmd:more')]);
  }

  async function paymentInfoAnswer(c) {
    const { L } = c;
    const pay = await getPaymentConfig(); const ops = await getOps().catch(() => ({}));
    const lines = [];
    if (pay.stkEnabled) lines.push(L('- M-Pesa prompt (STK): a pop-up appears on your phone, enter your PIN.', '- M-Pesa (STK): dirisha linatokea kwenye simu, weka PIN.'));
    if (pay.tillEnabled) lines.push(L(`- Till ${pay.tillNumber}${pay.tillName ? ` (${pay.tillName})` : ''}: pay it yourself, then send the M-Pesa code from the SMS.`, `- Till ${pay.tillNumber}${pay.tillName ? ` (${pay.tillName})` : ''}: lipa mwenyewe kisha tuma msimbo wa M-Pesa kutoka kwenye SMS.`));
    if (!lines.length) lines.push(L('Payments are switched off right now.', 'Malipo yamezimwa sasa.'));
    let text = `${L('You can pay with M-Pesa:', 'Unaweza kulipa kwa M-Pesa:')}\n${lines.join('\n')}\n${L('We do not take cash on delivery.', 'Hatupokei pesa taslimu wakati wa kuletewa.')}`;
    if (ops && ops.orderExpiryMinutes) text += ' ' + L(`An unpaid order is held for ${ops.orderExpiryMinutes} minutes.`, `Oda isiyolipwa inahifadhiwa dakika ${ops.orderExpiryMinutes}.`);
    return R(text, [chip(L('Order now', 'Agiza sasa'), 'cmd:more')]);
  }

  async function storeInfoAnswer(c) {
    const { L } = c; const s = c.settings;
    const parts = [];
    if (s.businessHours) parts.push(`${L('Hours', 'Saa za kazi')}: ${s.businessHours}.`);
    if (s.supportPhone) parts.push(`${L('Call', 'Piga')}: ${s.supportPhone}.`);
    if (s.whatsapp) parts.push(`WhatsApp: ${s.whatsapp}.`);
    if (s.extraKnowledge) parts.push(s.extraKnowledge);
    if (!parts.length) parts.push(L('Our customer care team is available on the contact details shown on the website.', 'Timu yetu ya huduma kwa wateja inapatikana kupitia mawasiliano yaliyo kwenye tovuti.'));
    return R(parts.join('\n'), [chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human')]);
  }

  async function ordersAnswer(c, orderId) {
    const { L, user } = c;
    if (!user) return R(L('Please sign in so I can show your orders.', 'Tafadhali ingia ili nikuonyeshe oda zako.'), [], [{ type: 'open_login' }]);
    let orders;
    if (orderId) { const o = await myOrder(user, orderId); if (!o) return R(L(`I could not find order #${orderId} on your account.`, `Sikupata oda #${orderId} kwenye akaunti yako.`)); orders = [o]; }
    else { orders = await Order.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 3 }); if (!orders.length) return R(L('You have no orders yet. Want to place one?', 'Bado huna oda. Ungependa kuweka?'), [chip(L('Order rice', 'Agiza mchele'), 'cmd:more')]); }
    const blocks = [];
    for (const o of orders) {
      const x = await shapeOrder(o, c.settings);
      let t = `#${x.id} (${x.date}) · ${x.status} · ${L('payment', 'malipo')}: ${x.paymentStatus}${x.receipt ? ` (${x.receipt})` : ''}\n${x.items.join(', ')}\n${L('Total', 'Jumla')} ${kes(x.total)} · ${x.to}`;
      if (x.delivery && x.delivery.riderName) t += `\n${L('Rider', 'Rider')}: ${x.delivery.riderName}${x.delivery.riderPhone ? ` (${x.delivery.riderPhone})` : ''} · ${x.delivery.status}`;
      else if (x.paid && x.eta) t += `\n${L('Usually', 'Kwa kawaida')} ${x.eta}`;
      if (!x.paid && x.problem) t += `\n${L('Payment problem', 'Tatizo la malipo')}: ${x.problem}`;
      blocks.push(t);
    }
    const unpaid = orders.find((o) => (o.paymentDetails || {}).isPaid !== true && o.status !== 'cancelled');
    const chips = [];
    if (unpaid) { s_activate(c, unpaid); chips.push(chip(L('Check payment', 'Kagua malipo'), 'cmd:check_payment')); if ((unpaid.paymentDetails || {}).method !== 'mpesa_till') chips.push(chip(L('Resend M-Pesa prompt', 'Tuma tena ombi'), 'cmd:resend')); }
    return R(blocks.join('\n\n'), chips);
  }
  function s_activate(c, order) {
    const pd = order.paymentDetails || {};
    if (!c.s.active || c.s.active.orderId !== order.id) c.s.active = { orderId: order.id, method: pd.method === 'mpesa_till' ? 'mpesa_till' : 'mpesa_stk', phone: normalizeKenyanPhone(pd.mpesaNumber || c.user.phoneNumber), total: Number(order.grandTotal) || 0, at: Date.now(), lastCheck: 0, notified: null };
  }

  async function repeatLast(c) {
    const { L, s, user } = c;
    if (!user) return R(L('Please sign in and I will repeat your last order.', 'Tafadhali ingia nikurudie oda yako ya mwisho.'), [], [{ type: 'open_login' }]);
    const orders = await Order.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 5 });
    const last = orders.find((o) => o.status !== 'cancelled' && getOrderItems(o).length);
    if (!last) return R(L('You have no earlier order to repeat yet.', 'Bado huna oda ya awali ya kurudia.'), [chip(L('Order rice', 'Agiza mchele'), 'cmd:more')]);
    s.draft = freshDraft(); const dropped = [];
    for (const it of getOrderItems(last)) {
      const p = await productById(it.productId);
      if (!p) { dropped.push(it.name || it.brandName); continue; }
      const qty = Number(it.quantity) || 1;
      const cfg = await getBulkConfig(); const rule = bulkRuleFor(cfg, p.id);
      const bulk = !!it.bulk && cfg.enabled && qty * p.weightKg >= rule.minKg;
      if (!bulk && p.stock < qty) { dropped.push(`${pName(p)} (${p.stock <= 0 ? 'out of stock' : 'only ' + p.stock + ' left'})`); if (p.stock > 0) s.draft.items.push({ productId: p.id, quantity: p.stock, bulk: false }); continue; }
      s.draft.items.push({ productId: p.id, quantity: qty, bulk });
    }
    if (!s.draft.items.length) return R(L('Sorry, none of the items from your last order are available right now.', 'Samahani, hakuna bidhaa kutoka oda yako ya mwisho inayopatikana sasa.'), [chip(L('See our rice', 'Ona mchele wetu'), 'cmd:list')]);
    return cartReview(c, { notes: `${L('From your order of', 'Kutoka oda yako ya')} ${new Date(last.createdAt).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short' })}, ${L('at today\'s prices.', 'kwa bei za leo.')}${dropped.length ? ' ' + L('Not included: ', 'Hazijajumuishwa: ') + dropped.join(', ') + '.' : ''}` });
  }

  async function escalate(c, reason) {
    const { L, s, user } = c;
    const k = `esc:${rid()}`; s.lastEsc = k;
    await upsert('escalations', k, { status: 'open', data: {} }, (r) => {
      r.data = { reason, userId: user ? user.id : null, name: user ? user.fullName : 'Guest', phone: user ? user.phoneNumber : null, lastOrderId: s.lastOrderId || null, recent: (s.history || []).slice(-8), at: new Date().toISOString() };
    });
    bump('escalations');
    try { io.to('admin-dashboard-room').emit('chatEscalation', { key: k, reason, name: user ? user.fullName : 'Guest' }); } catch (_) { /* no socket */ }
    await safeLog({ actor: user ? { id: user.id, role: user.role || 'customer', name: user.fullName } : { id: null, role: 'guest', name: 'Guest' }, action: 'CHAT_HANDOFF', category: 'support', severity: 'warn', summary: `Chat customer asked for a human (${reason})` });
    const st = c.settings; const contact = [st.supportPhone && `${L('Call', 'Piga')} ${st.supportPhone}`, st.whatsapp && `WhatsApp ${st.whatsapp}`].filter(Boolean).join(' · ');
    if (!user) s.expect = 'contact_phone';
    return R(L(`I have passed this to our customer care team along with our chat so you do not have to repeat yourself. ${contact ? contact + '. ' : ''}${st.businessHours ? 'Hours: ' + st.businessHours + '. ' : ''}${user ? '' : 'If you want them to call you back, type your phone number now.'}`,
      `Nimewapa timu yetu ya huduma kwa wateja pamoja na mazungumzo yetu ili usirudie. ${contact ? contact + '. ' : ''}${st.businessHours ? 'Saa: ' + st.businessHours + '. ' : ''}${user ? '' : 'Ukitaka wakupigie, andika namba yako ya simu sasa.'}`));
  }

  // ================================================================ ROUTING
  const INTENT_WORDS = new Set(Object.values(N.INTENTS).flatMap((d) => d.phrases.flatMap((p) => N.tokens(N.normalize(p)))));

  async function getCls(c) {
    if (!c.cls) { c.cls = N.classify(c.raw, { phrases: learned.phrases, faqs: learned.faqs }); c.verdict = N.verdict(c.cls); }
    return c.cls;
  }
  const looksLikeIntent = async (c) => { await getCls(c); return c.verdict === 'accept' && c.cls.score >= 0.75 && c.cls.intent !== 'unknown'; };

  async function applyPlace(c, text) {
    const counties = await countyList();
    const m = N.fuzzyPlace(text, counties);
    if (m) {
      const rest = text.replace(new RegExp(m.name.replace(/[^a-z]/gi, '.?'), 'ig'), ' ');
      let t = N.fuzzyPlace(rest, areasOf(m.name), 0.9);
      if (!t) { const tl0 = townLookup(rest); const hit = tl0 && tl0.find((x) => x.county === m.name); if (hit) t = { name: hit.area }; }
      return { county: m.name, town: t ? t.name : null };
    }
    const tl = townLookup(text);
    if (tl) {
      const counties2 = [...new Set(tl.map((x) => x.county))];
      if (counties2.length === 1) return { county: counties2[0], town: tl[0].area };
      return { ask: counties2.slice(0, 4), word: text };
    }
    return {};
  }

  async function stagePrompt(c) {
    const { s } = c;
    switch (s.stage) {
      case 'ASK_PRODUCT': return productMenu(c);
      case 'ASK_QTY': return qtyPrompt(c);
      case 'CART_REVIEW': return cartReview(c);
      case 'ASK_COUNTY': return promptCounty(c);
      case 'ASK_TOWN': return promptTown(c);
      case 'ASK_STREET': return promptStreet(c);
      case 'ASK_PROMO': return R(c.L('Type your promo code, or tap "No promo".', 'Andika kuponi yako, au bonyeza "Hakuna".'), [chip(c.L('No promo', 'Hakuna'), 'cmd:nopromo')]);
      case 'SUMMARY': return showSummary(c);
      case 'ASK_METHOD': return promptMethod(c);
      case 'ASK_PHONE': return afterMethod(c);
      case 'CONFIRM_FINAL': return promptConfirm(c);
      default: return null;
    }
  }
  const stale = async (c) => {
    const p = await stagePrompt(c);
    return p ? R(`${c.L('That option is no longer current. ', 'Chaguo hilo halipo tena. ')}${p.reply}`, p.chips) : R(c.L('That option is no longer current. What would you like to do?', 'Chaguo hilo halipo tena. Ungependa kufanya nini?'), mainChips(c));
  };
  const mainChips = (c) => [chip(c.L('See our rice', 'Ona mchele wetu'), 'cmd:list'), chip(c.L('Place an order', 'Weka oda'), 'cmd:more'), chip(c.L('Delivery info', 'Usafiri'), 'delivery'), chip(c.L('Track my order', 'Fuatilia oda'), 'track my order')];

  function cancelFlow(c) {
    const { L, s } = c;
    s.draft = freshDraft(); s.pending = null; s.stage = 'IDLE'; s.expect = null; s.needLogin = false;
    const wait = s.active ? L(` Your order #${s.active.orderId} is still waiting for payment.`, ` Oda yako #${s.active.orderId} bado inasubiri malipo.`) : '';
    return R(L(`No problem, I have cleared that.${wait} Anything else I can help with?`, `Sawa, nimefuta. ${wait} Kuna kingine ninachoweza kukusaidia?`), s.active ? [chip(L('Check my payment', 'Kagua malipo'), 'cmd:check_payment'), ...mainChips(c).slice(0, 2)] : mainChips(c));
  }

  async function removeFlow(c, productId) {
    const { L, s } = c;
    if (!s.draft.items.length) return R(L('Your basket is already empty.', 'Kikapu chako tayari ni tupu.'), mainChips(c));
    let target = productId;
    if (!target) {
      const r = await resolveProduct(c);
      if (r.kind === 'one') target = r.p.id;
      else if (s.draft.items.length === 1) target = s.draft.items[0].productId;
    }
    if (!target) {
      const prods = await loadProducts();
      return R(L('Which one should I remove?', 'Niondoe kipi?'), s.draft.items.map((i) => { const p = prods.find((x) => x.id === i.productId); return chip(`${p ? pName(p) : '#' + i.productId} x${i.quantity}`, `cmd:remove:${i.productId}`); }));
    }
    s.draft.items = s.draft.items.filter((i) => i.productId !== Number(target));
    if (!s.draft.items.length) { s.stage = 'IDLE'; return R(L('Removed. Your basket is empty now.', 'Nimeondoa. Kikapu chako ni tupu sasa.'), mainChips(c)); }
    return cartReview(c, { added: L('Removed that item.', 'Nimeondoa kitu hicho.') });
  }

  async function startBuy(c) {
    const { L, s } = c;
    const q = N.extractQuantity(c.norm); const hasQ = !!(q.bags || q.kg);
    const r = await resolveProduct(c);
    if (r.kind === 'one') return selectProduct(c, r.p, hasQ ? q : null);
    if (r.kind === 'many') { s.stage = 'ASK_PRODUCT'; s.pending = { qty: hasQ ? q : null }; return R(L('Which one do you mean?', 'Unamaanisha ipi?'), productChips(r.list)); }
    await noteMissingProduct(c);
    s.pending = hasQ ? { qty: q } : null;
    return productMenu(c, N.contentTokens(c.norm).filter((w) => !INTENT_WORDS.has(w)).length ? L('I could not find that exact rice, but here is what we have:', 'Sikupata mchele huo hasa, lakini hiki ndicho tulichonacho:') : undefined);
  }

  async function noteMissingProduct(c) {
    const words = N.contentTokens(c.norm).filter((w) => w.length >= 4 && !INTENT_WORDS.has(w) && !/^\d/.test(w)).slice(0, 3);
    if (!words.length) return;
    c.s.lastUnknownProduct = { words, at: Date.now() };
    try { await upsert('requests', words.join(' '), { status: 'open', data: { samples: [] } }, (r) => { const red = N.redact(c.raw); if (!r.data.samples.includes(red) && r.data.samples.length < 5) r.data.samples.push(red); }); } catch (_) { /* optional */ }
  }

  async function unknownReply(c) {
    const { L, s } = c;
    s.misses = (s.misses || 0) + 1; s.lastUnknown = { text: c.raw, at: Date.now() };
    await noteUnanswered(c.raw, c.sessionKey);
    const words = N.contentTokens(c.norm).filter((w) => w.length >= 4 && !INTENT_WORDS.has(w)).slice(0, 3);
    if (words.length && words.length <= 2) s.lastUnknownProduct = { words, at: Date.now() };
    const chips = [chip(L('What rice do you sell?', 'Mnauza mchele gani?'), 'cmd:list'), chip(L('Place an order', 'Weka oda'), 'cmd:more'), chip(L('Delivery info', 'Usafiri'), 'delivery')];
    if (s.misses >= 2) chips.push(chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human'));
    return R(L('Sorry, I did not quite understand that. I can help with our rice and prices, placing an order, delivery, payments and your orders. I have saved your question so I can learn from it. Try saying it another way, or pick an option.', 'Samahani, sijaelewa vizuri. Naweza kusaidia kuhusu mchele na bei, kuweka oda, usafiri, malipo na oda zako. Nimehifadhi swali lako ili nijifunze. Jaribu kulisema tofauti, au chagua mojawapo.'), chips);
  }

  async function handleCmd(c, arg) {
    const { L, s, user } = c;
    const [cmd, param] = arg.split(':');
    switch (cmd) {
      case 'more': return productMenu(c, s.draft.items.length ? L('What else would you like to add?', 'Ungependa kuongeza nini?') : undefined);
      case 'list': return productMenu(c, L('Here is everything we sell right now:', 'Hiki ndicho tunachouza sasa:'));
      case 'checkout': case 'resume': return proceedCheckout(c);
      case 'clear': s.draft = freshDraft(); s.pending = null; s.stage = 'IDLE'; return R(L('Your basket is cleared.', 'Kikapu chako kimefutwa.'), mainChips(c));
      case 'remove': return removeFlow(c, param ? Number(param) : null);
      case 'setqty': { const p = await productById(Number(param)); if (!p) return productMenu(c); s.pending = { productId: p.id, replace: true }; return qtyPrompt(c); }
      case 'continue': return s.stage === 'SUMMARY' ? promptMethod(c) : stale(c);
      case 'promo': if (!s.draft.items.length || !(s.draft.county && s.draft.town && s.draft.street)) return stale(c); s.stage = 'ASK_PROMO'; return stagePrompt(c);
      case 'nopromo': s.draft.promo = null; return s.draft.county && s.draft.town && s.draft.street ? showSummary(c) : stale(c);
      case 'newaddr': s.draft.county = null; s.draft.town = null; s.draft.street = null; return user ? promptCounty(c) : proceedCheckout(c);
      case 'lastaddr': if (!s.lastAddr) return promptCounty(c); Object.assign(s.draft, { county: s.lastAddr.county, town: s.lastAddr.town, street: s.lastAddr.street }); return s.draft.street ? showSummary(c) : promptStreet(c);
      case 'centre': if (s.stage !== 'ASK_STREET') return stale(c); s.draft.street = 'Town centre'; return showSummary(c);
      case 'method': return s.draft.items.length ? promptMethod(c) : stale(c);
      case 'confirm': return s.stage === 'CONFIRM_FINAL' ? placeOrder(c) : stale(c);
      case 'notyet': s.stage = s.draft.county ? 'SUMMARY' : s.stage; return R(L('No problem. What would you like to change?', 'Sawa. Ungependa kubadilisha nini?'), [chip(L('Items', 'Bidhaa'), 'cmd:more'), chip(L('Address', 'Anwani'), 'cmd:newaddr'), chip(L('Payment method', 'Njia ya malipo'), 'cmd:method'), chip(L('Cancel everything', 'Futa yote'), 'cmd:cancel')]);
      case 'cancel': return cancelFlow(c);
      case 'check_payment': return checkPayment(c, false);
      case 'resend': return resendStk(c, null);
      case 'human': return escalate(c, 'asked for a person');
      default: return stale(c);
    }
  }

  async function handleValue(c, type, arg) {
    const { L, s, user } = c;
    switch (type) {
      case 'product': {
        const p = await productById(Number(arg));
        if (!p) return productMenu(c, L('That rice is no longer available. Please pick another:', 'Mchele huo haupatikani tena. Tafadhali chagua mwingine:'));
        if (s.lastUnknownProduct && Date.now() - s.lastUnknownProduct.at < 180000) {
          for (const w of s.lastUnknownProduct.words) await vote({ type: 'alias', key: `alias:${w}:${p.id}`, data: { word: w, productId: p.id }, sessionKey: c.sessionKey, intentKind: 'info' });
          s.lastUnknownProduct = null;
        }
        const q = s.pending && s.pending.qty;
        return selectProduct(c, p, q);
      }
      case 'qty': case 'kg': {
        const p = await productById(s.pending && s.pending.productId);
        if (!p || s.stage !== 'ASK_QTY') return stale(c);
        const n = Number(arg); const replace = s.pending.replace;
        return applyQty(c, p, type === 'qty' ? { bags: n } : { kg: n }, { replace });
      }
      case 'county': {
        if (s.stage !== 'ASK_COUNTY') return stale(c);
        const m = N.fuzzyPlace(arg, await countyList(), 0.8);
        if (!m) return promptCounty(c);
        s.draft.county = m.name; s.draft.town = null;
        return promptTown(c);
      }
      case 'town': {
        if (s.stage !== 'ASK_TOWN') return stale(c);
        s.draft.town = clip(arg, 60);
        return s.draft.street ? showSummary(c) : promptStreet(c);
      }
      case 'method': {
        if (s.stage !== 'ASK_METHOD') return stale(c);
        const pay = await getPaymentConfig();
        if (arg === 'stk' && pay.stkEnabled) s.draft.method = 'mpesa_stk';
        else if (arg === 'till' && pay.tillEnabled) s.draft.method = 'mpesa_till';
        else return R(L('That payment method is not available right now.', 'Njia hiyo ya malipo haipatikani sasa.'), (await promptMethod(c)).chips);
        return afterMethod(c);
      }
      case 'phone': {
        if (!user) return proceedCheckout(c);
        if (arg === 'self') {
          const own = normalizeKenyanPhone(user.phoneNumber);
          if (s.stage !== 'ASK_PHONE') return stale(c);
          if (!own) return R(L('I do not have a valid M-Pesa number on your account. Type the number to use (e.g. 0712345678).', 'Sina namba sahihi ya M-Pesa kwenye akaunti yako. Andika namba ya kutumia (mfano 0712345678).'));
          s.draft.phone = own; return promptConfirm(c);
        }
        if (s.active && s.active.method === 'mpesa_stk' && s.stage === 'AWAIT_PAYMENT') { s.expect = 'resend_phone'; return R(L('Which M-Pesa number should I send the new prompt to? (e.g. 0712345678)', 'Nitume ombi jipya kwa namba gani ya M-Pesa? (mfano 0712345678)')); }
        s.stage = 'ASK_PHONE'; s.draft.phone = null;
        return R(L('Which M-Pesa number should I send the prompt to? (e.g. 0712345678)', 'Nitume ombi la M-Pesa kwa namba gani? (mfano 0712345678)'));
      }
      case 'cmd': return handleCmd(c, arg);
      default: return null;
    }
  }

  /** Slot filling for the step the customer is on. Returns null when the message is not an answer to the current question. */
  async function handleStage(c) {
    const { L, s, user } = c;
    const yn = N.yesNo(c.norm);
    // "also 5 bags of basmati" while giving an address: treat it as shopping, not as a place name
    if (['ASK_COUNTY', 'ASK_TOWN', 'ASK_STREET', 'SUMMARY', 'ASK_METHOD', 'ASK_PHONE', 'CONFIRM_FINAL'].includes(s.stage)) {
      const q0 = N.extractQuantity(c.norm);
      if (q0.bags || q0.kg) { const r0 = await resolveProduct(c); if (r0.kind === 'one') { s.stage = 'CART_REVIEW'; return selectProduct(c, r0.p, q0); } }
    }
    switch (s.stage) {
      case 'ASK_PRODUCT': {
        const r = await resolveProduct(c); const q = N.extractQuantity(c.norm); const hasQ = !!(q.bags || q.kg);
        if (r.kind === 'one') return selectProduct(c, r.p, hasQ ? q : (s.pending && s.pending.qty));
        if (r.kind === 'many') { s.pending = { qty: hasQ ? q : (s.pending && s.pending.qty) }; return R(L('Which one do you mean?', 'Unamaanisha ipi?'), productChips(r.list)); }
        if (N.contentTokens(c.norm).length && !(await looksLikeIntent(c))) { await noteMissingProduct(c); return productMenu(c, L('I could not find that rice. Here is what we have:', 'Sikupata mchele huo. Hiki ndicho tulichonacho:')); }
        return null;
      }
      case 'ASK_QTY': {
        const p = await productById(s.pending && s.pending.productId);
        if (!p) return productMenu(c);
        const q = N.extractQuantity(c.norm);
        const r = await resolveProduct(c);
        if (r.kind === 'one' && r.p.id !== p.id) return selectProduct(c, r.p, (q.bags || q.kg) ? q : null);   // they named a different rice
        if (q.bags || q.kg || q.bare) return applyQty(c, p, q, { replace: s.pending.replace });
        return null;
      }
      case 'CART_REVIEW': {
        const cls = await getCls(c); const q = N.extractQuantity(c.norm);
        const r = await resolveProduct(c);
        if (r.kind !== 'none' && (cls.intent === 'buy' || q.bags || q.kg || !(await looksLikeIntent(c)))) {
          if (r.kind === 'one') return selectProduct(c, r.p, (q.bags || q.kg) ? q : null);
          s.stage = 'ASK_PRODUCT'; s.pending = { qty: (q.bags || q.kg) ? q : null };
          return R(L('Which one do you mean?', 'Unamaanisha ipi?'), productChips(r.list));
        }
        if (yn === 'yes') return proceedCheckout(c);
        if (yn === 'no') return R(L('Okay. Add anything else, or tap Checkout when you are ready.', 'Sawa. Ongeza kingine, au bonyeza Lipa ukiwa tayari.'), (await cartReview(c)).chips);
        return null;
      }
      case 'ASK_COUNTY': {
        if (s.lastAddr && !s.draft.county && yn === 'yes') return handleCmd(c, 'lastaddr');
        if (s.lastAddr && !s.draft.county && yn === 'no') return promptCounty(c);
        const r = await applyPlace(c, c.raw);
        if (r.ask) return R(L('That name exists in more than one county. Which county?', 'Jina hilo lipo kwenye kaunti zaidi ya moja. Kaunti gani?'), r.ask.map((n) => chip(n, `county:${n}`)));
        if (r.county) { s.draft.county = r.county; s.draft.town = r.town || null; return r.town ? (s.draft.street ? showSummary(c) : promptStreet(c)) : promptTown(c); }
        const near = N.fuzzyPlace(c.raw, await countyList(), 0.7);
        if (near) return R(L(`Did you mean ${near.name}?`, `Unamaanisha ${near.name}?`), [chip(near.name, `county:${near.name}`)]);
        if (await looksLikeIntent(c)) return null;
        return R(L('I could not find that county or town. Please type a Kenyan county (like Nairobi, Kiambu or Kirinyaga) or your town.', 'Sikupata kaunti au mji huo. Tafadhali andika kaunti ya Kenya (kama Nairobi, Kiambu au Kirinyaga) au mji wako.'), (await promptCounty(c)).chips);
      }
      case 'ASK_TOWN': {
        const areas = areasOf(s.draft.county);
        const m = N.fuzzyPlace(c.raw, areas, 0.8);
        let town = m ? m.name : null;
        if (!town && !(await looksLikeIntent(c)) && /^[a-z0-9][a-z0-9\s.,'-]{1,58}$/i.test(c.raw.trim())) town = titleCase(c.raw.trim().split(',')[0].trim());
        if (!town) return null;
        s.draft.town = town;
        return s.draft.street ? showSummary(c) : promptStreet(c);
      }
      case 'ASK_STREET': {
        const t = c.raw.trim();
        if (t.length < 3) return R(L('Please give a little more detail: an estate, street or landmark.', 'Tafadhali toa maelezo zaidi: mtaa, barabara au alama.'));
        if (t.includes('?') && await looksLikeIntent(c)) return null;
        s.draft.street = clip(t, 120);
        return showSummary(c);
      }
      case 'ASK_PROMO': {
        if (yn === 'no' || /\b(skip|no promo|hakuna)\b/.test(c.norm)) return handleCmd(c, 'nopromo');
        const code = N.extractPromo(c.raw) || clip(c.raw, 24).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        if (!code) return null;
        const price = await priceBasket(s.draft.items, { promoCode: code, user, settings: c.settings });
        if (price.promo && price.promo.valid) { s.draft.promo = code; return showSummary(c); }
        return R(`${price.promo ? price.promo.message : L('That code did not work.', 'Kuponi hiyo haikufanya kazi.')} ${L('Try another code or tap "No promo".', 'Jaribu nyingine au bonyeza "Hakuna".')}`, [chip(L('No promo', 'Hakuna'), 'cmd:nopromo')]);
      }
      case 'SUMMARY': {
        if (yn === 'yes') return promptMethod(c);
        const cls = await getCls(c);
        if (cls.intent === 'promo' && c.verdict === 'accept') return null;
        return null;
      }
      case 'ASK_METHOD': {
        const n = c.norm; let m = null;
        if (/\b(stk|prompt|popup|pop up|pin|push|kwenye simu|on my phone)\b/.test(n)) m = 'mpesa_stk';
        else if (/\b(till|paybill|pay bill|manual|mwenyewe|buy goods)\b/.test(n)) m = 'mpesa_till';
        if (!m) return null;
        return handleValue(c, 'method', m === 'mpesa_stk' ? 'stk' : 'till');
      }
      case 'ASK_PHONE': {
        const ph = N.extractPhone(c.raw, normalizeKenyanPhone);
        if (ph) { s.draft.phone = ph; return promptConfirm(c); }
        if (yn === 'yes' && normalizeKenyanPhone(user.phoneNumber)) { s.draft.phone = normalizeKenyanPhone(user.phoneNumber); return promptConfirm(c); }
        if (/\d{5,}/.test(c.raw)) return R(L('That does not look like a valid M-Pesa number. Please type it like 0712345678.', 'Hiyo haionekani kama namba sahihi ya M-Pesa. Tafadhali andika kama 0712345678.'));
        return null;
      }
      case 'CONFIRM_FINAL': {
        if (yn === 'yes') return placeOrder(c);
        if (yn === 'no') return handleCmd(c, 'notyet');
        return null;
      }
      case 'AWAIT_TILL_CODE': {
        const code = N.extractMpesaCode(c.raw, cleanMpesaCode, MPESA_CODE_RE);
        if (code) return submitTill(c, code);
        return null;
      }
      case 'AWAIT_PAYMENT': {
        const ph = N.extractPhone(c.raw, normalizeKenyanPhone);
        if (ph && c.norm.replace(/\D/g, '').length >= 9 && c.norm.replace(/[\d\s+-]/g, '').length < 4) return resendStk(c, ph);
        return null;
      }
      default: return null;
    }
  }

  async function dispatch(c) {
    const { L, s, user } = c;
    const cls = await getCls(c); const v = c.verdict;
    // "5 bags of basmati" is an order whatever else the words look like
    { const q = N.extractQuantity(c.norm);
      if ((q.bags || q.kg) && (cls.intent === 'buy' || v !== 'accept')) { const r = await resolveProduct(c); if (r.kind !== 'none') return { out: await startBuy(c), handled: true }; } }
    // a bare rice name ("pishori", or a nickname customers taught us) shows that rice
    if (v !== 'accept' && N.tokens(c.norm).length <= 5) { const rp = await resolveProduct(c); if (rp.kind !== 'none') return { out: await productInfo(c), handled: true }; }
    if (v === 'reject') return { out: await unknownReply(c), handled: false };
    if (v === 'ask') {
      s.pendingClarify = { text: c.raw, intent: cls.intent };
      const label = cls.intent.startsWith('faq:') ? L('that topic', 'mada hiyo') : (INTENT_LABEL[cls.intent] || cls.intent);
      return { out: R(L(`Just checking: are you asking about ${label}?`, `Nahakikisha: unauliza kuhusu ${label}?`), [chip(L('Yes', 'Ndio'), 'yes'), chip(L('No', 'Hapana'), 'no')]), handled: false, asked: true };
    }
    let out;
    if (cls.intent.startsWith('faq:')) {
      const f = learned.faqs.find((x) => x.id === cls.faqId);
      if (f) { await upsert('learned', f.id, {}, () => {}); out = R(c.lang === 'sw' && f.answerSw ? f.answerSw : f.answer, mainChips(c)); }
      else out = await unknownReply(c);
      return { out, handled: !!f };
    }
    switch (cls.intent) {
      case 'greet': {
        const n = firstName(user);
        out = R(L(`Hi${n ? ' ' + n : ''}! 👋 I am ${c.settings.assistantName}, Mwea Rice Hub's virtual assistant. I can show you our rice, help you order and pay by M-Pesa, check delivery, or track your order. What would you like?`, `Habari${n ? ' ' + n : ''}! 👋 Mimi ni ${c.settings.assistantName}, msaidizi wa Mwea Rice Hub. Naweza kukuonyesha mchele wetu, kukusaidia kuagiza na kulipa kwa M-Pesa, kukuambia kuhusu usafiri, au kufuatilia oda yako. Unahitaji nini?`), mainChips(c));
        if (s.draft.items.length) out.reply += L(`\nYou still have ${s.draft.items.length} item(s) in your basket.`, `\nBado una bidhaa ${s.draft.items.length} kwenye kikapu.`);
        break;
      }
      case 'thanks': out = R(L('You are welcome! Anything else I can help with?', 'Karibu sana! Kuna kingine ninachoweza kukusaidia?'), mainChips(c)); break;
      case 'bye': out = R(L('Thank you for visiting Mwea Rice Hub. Have a lovely day!', 'Asante kwa kutembelea Mwea Rice Hub. Siku njema!')); break;
      case 'identity': out = R(L(`I am ${c.settings.assistantName}, Mwea Rice Hub's virtual assistant: a computer program, not a person. I can do most things here, and I can pass you to our customer care team any time.`, `Mimi ni ${c.settings.assistantName}, msaidizi wa mtandaoni wa Mwea Rice Hub: programu ya kompyuta, si mtu. Naweza kufanya mengi hapa, na naweza kukupitisha kwa timu yetu wakati wowote.`), [chip(L('Talk to a person', 'Ongea na mtu'), 'cmd:human'), ...mainChips(c).slice(0, 2)]); break;
      case 'help': out = R(L('Here is what I can do:\n- Show our rice, prices and stock\n- Recommend rice for pilau, budget or family size\n- Take your order step by step and send an M-Pesa prompt to your phone (you need to be signed in to buy)\n- Delivery fees and times, bulk discounts, promo codes, reward points\n- Track your orders and check or retry payments\nTry: "I want 2 bags of pishori".', 'Haya ndiyo ninayoweza kufanya:\n- Kukuonyesha mchele, bei na hisa\n- Kupendekeza mchele wa pilau, bajeti au ukubwa wa familia\n- Kuchukua oda hatua kwa hatua na kutuma ombi la M-Pesa kwenye simu yako (lazima uwe umeingia ili ununue)\n- Gharama na muda wa usafiri, punguzo la jumla, kuponi, pointi\n- Kufuatilia oda na kukagua au kujaribu tena malipo\nJaribu: "nataka magunia 2 ya pishori".'), mainChips(c)); break;
      case 'list_products': case 'price': case 'stock': out = await productInfo(c); break;
      case 'recommend': out = await recommend(c); break;
      case 'buy': out = await startBuy(c); break;
      case 'bulk': {
        const q = N.extractQuantity(c.norm); const r = await resolveProduct(c);
        out = (q.kg || q.bags) && r.kind === 'one' ? await startBuy(c) : await bulkAnswer(c); break;
      }
      case 'delivery': {
        const r = await applyPlace(c, c.raw);
        if (r.county) out = await deliveryAnswer(c, r.county);
        else if (s.draft.county) out = await deliveryAnswer(c, s.draft.county);
        else { s.expect = 'delivery_county'; out = R(L('Which county or town should I check delivery for?', 'Nikague usafiri kwa kaunti au mji gani?'), (await countyList()).filter((n) => Object.keys(c.settings.deliveryTimes.byCounty).includes(n)).slice(0, 5).map((n) => chip(n, `county_info:${n}`))); }
        break;
      }
      case 'order_status': out = await ordersAnswer(c, N.extractOrderId(c.norm)); break;
      case 'payment_info': out = await paymentInfoAnswer(c); break;
      case 'store_info': out = await storeInfoAnswer(c); break;
      case 'rewards': out = R(user ? L(`You have ${Number(user.rewardPoints || 0)} reward points. You earn 0.2 points for every kg you buy.`, `Una pointi ${Number(user.rewardPoints || 0)} za zawadi. Unapata pointi 0.2 kwa kila kilo unayonunua.`) : L('You earn 0.2 reward points for every kg you buy. Sign in to see your balance.', 'Unapata pointi 0.2 kwa kila kilo unayonunua. Ingia ili uone salio lako.'), user ? mainChips(c).slice(0, 2) : [], user ? [] : [{ type: 'open_login' }]); break;
      case 'promo': {
        const code = N.extractPromo(c.raw);
        if (!s.draft.items.length) { out = R(L('Add some rice to your basket first, then I will apply your promo code at checkout.', 'Weka mchele kwenye kikapu kwanza, kisha nitaweka kuponi yako wakati wa kulipa.'), [chip(L('Order rice', 'Agiza mchele'), 'cmd:more')]); break; }
        if (!code) { s.expect = 'promo_code'; out = R(L('Type your promo code.', 'Andika kuponi yako.')); break; }
        const price = await priceBasket(s.draft.items, { promoCode: code, user, settings: c.settings });
        if (price.promo && price.promo.valid) { s.draft.promo = code; out = await cartReview(c, { added: `${L('promo', 'kuponi')} ${price.promo.code} (-${kes(price.discount)})` }); }
        else out = R(price.promo ? price.promo.message : L('That code did not work.', 'Kuponi hiyo haikufanya kazi.'));
        break;
      }
      case 'paid': out = s.active ? await checkPayment(c, false) : await ordersAnswer(c, null); break;
      case 'retry_stk': out = s.active ? await resendStk(c, null) : await ordersAnswer(c, null); break;
      case 'human': out = await escalate(c, 'asked for a person'); break;
      case 'complaint': { const e = await escalate(c, 'complaint'); out = R(`${L('I am sorry about that. ', 'Pole kwa hilo. ')}${e.reply}`, e.chips); break; }
      case 'cart_show': out = await cartReview(c); break;
      case 'cart_clear': out = await handleCmd(c, 'clear'); break;
      case 'checkout': out = s.draft.items.length ? await proceedCheckout(c) : await productMenu(c, L('Your basket is empty. Pick some rice first:', 'Kikapu chako ni tupu. Chagua mchele kwanza:')); break;
      case 'remove_item': out = await removeFlow(c, null); break;
      case 'repeat_order': out = await repeatLast(c); break;
      case 'change_qty': {
        const q = N.extractQuantity(c.norm); const r = await resolveProduct(c);
        const pid = r.kind === 'one' ? r.p.id : (s.lastItem && s.lastItem.productId);
        const p = pid ? await productById(pid) : null;
        out = p && (q.bags || q.kg || q.bare) ? await applyQty(c, p, q, { replace: true }) : await cartReview(c);
        break;
      }
      case 'signin': out = user ? R(L('You are already signed in. 👍', 'Tayari umeingia. 👍'), mainChips(c)) : R(L('Tap below to sign in or create your account. Your basket will wait for you.', 'Bonyeza hapa chini kuingia au kujisajili. Kikapu chako kitasubiri.'), [], [{ type: 'open_login' }]); break;
      default: out = await unknownReply(c); return { out, handled: false };
    }
    // a side question in the middle of an order: answer it, then take the customer back to where they were
    if (SIDE_INTENTS.has(cls.intent) && FLOW_STAGES.has(s.stage) && !['list_products', 'price', 'stock'].includes(cls.intent) ) {
      const back = await stagePrompt(c);
      if (back) { out = R(`${out.reply}\n\n${L('Back to your order:', 'Turudi kwenye oda yako:')} ${back.reply}`, back.chips, out.actions); }
    }
    return { out, handled: true };
  }

  async function converse({ user, s, sessionKey, text, silent, req }) {
    const settings = await getSettings();
    const c = { user, s, sessionKey, raw: clip(text, 500), settings, ip: req.ip, headers: req.headers };
    c.norm = N.normalize(c.raw);
    c.lang = N.detectLang(c.norm, s.lang); s.lang = c.lang;
    c.L = (en, sw) => (c.lang === 'sw' && sw ? sw : en);
    await learnedFresh();

    if (silent) { const r = await checkPayment(c, true); return r ? { out: r, intent: 'payment_poll', handled: true, status: r.status } : null; }

    const done = async (out, extra = {}) => ({ out, intent: (c.cls && c.cls.intent) || extra.intent || 'flow', score: c.cls ? c.cls.score : 1, handled: extra.handled !== false, asked: !!extra.asked, verdict: c.verdict || (extra.asked ? 'ask' : 'flow') });

    // 1) buttons / structured values
    const vm = c.raw.match(/^(product|qty|kg|county|county_info|town|method|phone|cmd):([\w'’ .:-]{0,60})$/);
    if (vm) {
      c.raw = vm[0]; c.norm = N.normalize(c.raw);
      if (vm[1] === 'county_info') { const m = N.fuzzyPlace(vm[2], await countyList(), 0.8); if (m) return done(await deliveryAnswer(c, m.name)); }
      const out = await handleValue(c, vm[1], vm[2]);
      if (out) return done(out, { intent: `value:${vm[1]}` });
    }

    // 2) "Did you mean ...?" answers teach the assistant (strong vote)
    const yn = N.yesNo(c.norm);
    if (s.pendingClarify && yn) {
      const pc = s.pendingClarify; s.pendingClarify = null;
      if (yn === 'yes' && pc.intent && N.INTENTS[pc.intent]) {
        await vote({ type: 'phrase', key: `phrase:${pc.intent}:${N.questionKey(pc.text)}`, data: { text: N.redact(pc.text), intent: pc.intent }, sessionKey, weight: 2, intentKind: N.INTENTS[pc.intent].kind });
        c.raw = pc.text; c.norm = N.normalize(pc.text); c.cls = { intent: pc.intent, score: 0.8, margin: 0.3, source: 'confirmed' }; c.verdict = 'accept';
        const r = await dispatch(c); return done(r.out, { handled: true });
      }
      if (yn === 'no') return done(R(c.L('Sorry about that. Could you say it another way, or pick one of these?', 'Pole. Unaweza kuliweka tofauti, au uchague mojawapo?'), mainChips(c)), { handled: false });
    }
    s.pendingClarify = null;

    // 3) a pasted M-Pesa code when a Till order is waiting
    if (s.active && s.active.method === 'mpesa_till' && ['IDLE', 'DONE', 'AWAIT_TILL_CODE', 'AWAIT_PAYMENT'].includes(s.stage)) {
      const code = N.extractMpesaCode(c.raw, cleanMpesaCode, MPESA_CODE_RE);
      if (code) return done(await submitTill(c, code), { intent: 'till_code' });
    }

    // 4) stop / cancel
    if (N.isCancel(c.norm) && (FLOW_STAGES.has(s.stage) || s.expect || s.draft.items.length)) return done(cancelFlow(c), { intent: 'cancel' });
    if (N.isBack(c.norm) && FLOW_STAGES.has(s.stage)) { const p = await stagePrompt(c); if (p) return done(p, { intent: 'back' }); }

    // 5) one-shot follow-ups ("which county?", "your phone number?")
    if (s.expect) {
      const e = s.expect;
      if (e === 'delivery_county') { s.expect = null; const r = await applyPlace(c, c.raw); if (r.county) return done(await deliveryAnswer(c, r.county), { intent: 'delivery' }); }
      else if (e === 'contact_phone') { s.expect = null; const ph = N.extractPhone(c.raw, normalizeKenyanPhone); if (ph && s.lastEsc) { await patchRow('escalations', s.lastEsc, (r) => { r.data.phone = ph; }); return done(R(c.L('Thank you, our team will call you back.', 'Asante, timu yetu itakupigia.')), { intent: 'contact_phone' }); } }
      else if (e === 'promo_code') { s.expect = null; const code = N.extractPromo(c.raw) || clip(c.raw, 24).toUpperCase().replace(/[^A-Z0-9_-]/g, ''); if (code && s.draft.items.length) { const price = await priceBasket(s.draft.items, { promoCode: code, user, settings }); if (price.promo && price.promo.valid) { s.draft.promo = code; return done(await cartReview(c, { added: `${c.L('promo', 'kuponi')} ${code} (-${kes(price.discount)})` }), { intent: 'promo' }); } return done(R(price.promo ? price.promo.message : c.L('That code did not work.', 'Kuponi hiyo haikufanya kazi.')), { intent: 'promo' }); } }
      else if (e === 'resend_phone') { s.expect = null; const ph = N.extractPhone(c.raw, normalizeKenyanPhone); if (ph) return done(await resendStk(c, ph), { intent: 'retry_stk' }); }
      else s.expect = null;
    }

    // 6) the question the customer is currently answering
    const staged = await handleStage(c);
    if (staged) { s.misses = 0; return done(staged, { intent: `stage:${s.stage}` }); }

    // 7) everything else: understand what they want
    const r = await dispatch(c);
    if (r.handled) {
      s.misses = 0;
      const cls = c.cls;
      if (s.lastUnknown && Date.now() - s.lastUnknown.at < 180000 && cls && c.verdict === 'accept' && cls.score >= 0.75 && cls.source === 'seed' && N.INTENTS[cls.intent] && N.questionKey(s.lastUnknown.text) !== N.questionKey(c.raw)) {
        await vote({ type: 'phrase', key: `phrase:${cls.intent}:${N.questionKey(s.lastUnknown.text)}`, data: { text: N.redact(s.lastUnknown.text), intent: cls.intent }, sessionKey, weight: 1, intentKind: N.INTENTS[cls.intent].kind });
        s.lastUnknown = null;
      }
    }
    return done(r.out, { handled: r.handled, asked: r.asked });
  }

  // ================================================================ AUTH (same checks as the rest of the site)
  function optionalAuth(req, res) {
    return new Promise((resolve) => {
      if (!req.headers['authorization']) return resolve(null);
      const proxy = { setHeader: (k, v) => { try { res.setHeader(k, v); } catch (_) { /* ignore */ } }, status() { return proxy; }, json() { resolve(null); return proxy; }, send() { resolve(null); return proxy; } };
      try { authenticateToken(req, proxy, () => resolve(req.user || null)); } catch (_) { resolve(null); }
    });
  }

  // ================================================================ ROUTES: customers
  const hitsPerMinute = new Map(); const hitsPerHour = new Map(); const pollHits = new Map();
  setInterval(() => { const t = Date.now(); for (const m of [hitsPerMinute, hitsPerHour, pollHits]) for (const [k, v] of m) if (!v.length || t - v[v.length - 1] > 3600000) m.delete(k); }, 10 * 60 * 1000).unref?.();
  const tooMany = (map, key, windowMs, max) => { const t = Date.now(); const arr = (map.get(key) || []).filter((x) => t - x < windowMs); if (arr.length >= max) { map.set(key, arr); return true; } arr.push(t); map.set(key, arr); return false; };

  app.get('/api/config/chat-assistant', async (req, res) => {
    try { const s = await getSettings(); res.json({ assistantName: s.assistantName }); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const body = req.body || {};
      const silent = body.silent === true;
      const ip = req.ip || 'unknown';
      if (silent) { if (tooMany(pollHits, ip, 60 * 1000, 30)) return res.json({ reply: null, status: 'pending' }); }
      else if (tooMany(hitsPerMinute, ip, 60 * 1000, 20) || tooMany(hitsPerHour, ip, 60 * 60 * 1000, 200)) return res.status(429).json({ error: 'You are sending messages very fast. Please wait a moment and try again.' });
      const text = clip(body.message, 500);
      if (!text) return res.status(400).json({ error: 'Type a message first.' });

      const user = await optionalAuth(req, res);
      let fullUser = null;
      if (user) { try { const u = await User.findByPk(user.id, { attributes: ['id', 'rewardPoints'] }); fullUser = { ...user, rewardPoints: u ? u.rewardPoints : 0 }; } catch (_) { fullUser = user; } }
      const sid = /^[A-Za-z0-9_-]{8,64}$/.test(String(body.sessionId || '')) ? String(body.sessionId) : null;
      const guestKey = sid ? `g:${sid}` : `ip:${ip}`;
      const key = fullUser ? `u${fullUser.id}` : guestKey;
      const s = await getSession(key, fullUser ? guestKey : null);

      // one message at a time per customer (double taps, slow networks)
      const prev = s.queue || Promise.resolve();
      let release; s.queue = new Promise((r) => { release = r; });
      await prev.catch(() => {});
      let result;
      try { result = await converse({ user: fullUser, s, sessionKey: key, text, silent, req }); } finally { release(); }

      if (silent) return res.json(result ? { reply: result.out.reply, chips: result.out.chips, actions: result.out.actions, status: result.status, signedIn: !!fullUser } : { reply: null, status: s.active ? 'pending' : 'idle', signedIn: !!fullUser });

      const out = result.out;
      let turnId = null;
      try {
        bump('total'); if (result.handled) bump('handled'); else if (result.asked) bump('asked'); bumpIntent(result.intent || 'unknown');
        turnId = rid();
        await upsert('turns', turnId, { status: 'ok', data: {} }, (r) => { r.data = { t: N.redact(text), intent: result.intent, score: Number((result.score || 0).toFixed(2)), verdict: result.verdict, stage: s.stage, lang: s.lang, handled: !!result.handled, signedIn: !!fullUser, at: new Date().toISOString() }; });
      } catch (_) { /* logging must never break the chat */ }
      s.history = [...(s.history || []), { r: 'u', t: N.redact(text).slice(0, 160) }, { r: 'b', t: String(out.reply || '').slice(0, 160) }].slice(-12);
      persistSession(key, s);
      res.json({ reply: out.reply, chips: out.chips || [], actions: out.actions || [], turnId, stage: s.stage, signedIn: !!fullUser, awaitingLogin: !!s.needLogin });
    } catch (err) {
      console.error('❌ Chat assistant error:', err.stack || err.message);
      let fallback = 'Sorry, I hit a problem. Please try again, or contact customer care.';
      try { const st = await getSettings(); if (st.supportPhone) fallback += ` You can call ${st.supportPhone}.`; } catch (_) { /* ignore */ }
      res.status(500).json({ error: fallback });
    }
  });

  app.post('/api/chat/feedback', async (req, res) => {
    try {
      const { turnId, value } = req.body || {};
      if (!turnId || !['up', 'down'].includes(value)) return res.status(400).json({ error: 'Invalid feedback.' });
      const row = await patchRow('turns', clip(turnId, 190), (r) => { r.data.feedback = value; });
      if (row) {
        bump(value === 'up' ? 'thumbsUp' : 'thumbsDown');
        if (value === 'down' && row.data && row.data.t) await noteUnanswered(`[wrong answer] ${row.data.t}`, `fb${turnId}`);
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ================================================================ ROUTES: admin
  const adminOnly = [authenticateToken, requireAdmin];

  app.get('/api/admin/config/chat-assistant', ...adminOnly, async (req, res) => { try { res.json(await getSettings()); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.put('/api/admin/config/chat-assistant', ...adminOnly, async (req, res) => {
    try {
      const b = req.body || {}; const byCounty = {};
      Object.entries((b.deliveryTimes && b.deliveryTimes.byCounty) || {}).slice(0, 60).forEach(([k, v]) => { if (typeof v === 'string' && v.trim()) byCounty[clip(k, 40)] = clip(v, 100); });
      const next = {
        assistantName: clip(b.assistantName, 40) || DEFAULT_SETTINGS.assistantName, businessHours: clip(b.businessHours, 160), supportPhone: clip(b.supportPhone, 30), whatsapp: clip(b.whatsapp, 30),
        extraKnowledge: clip(b.extraKnowledge, 4000), deliveryTimes: { default: clip(b.deliveryTimes && b.deliveryTimes.default, 100) || DEFAULT_SETTINGS.deliveryTimes.default, byCounty }
      };
      const [row] = await SystemConfig.findOrCreate({ where: { key: 'chat_settings' }, defaults: { value: next } });
      row.value = next; row.changed('value', true); await row.save();
      await safeLog({ req, action: 'CHAT_SETTINGS_CHANGED', category: 'settings', summary: `${req.adminUser.fullName} updated the AI assistant settings` });
      res.json(await getSettings());
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/admin/chat/overview', ...adminOnly, async (req, res) => {
    try {
      const props = await getProposals();
      const turns = await list('turns', { limit: 400 });
      const down = turns.filter((t) => t.data && t.data.feedback === 'down').slice(0, 15).map((t) => ({ text: t.data.t, intent: t.data.intent, at: t.data.at }));
      const top = Object.entries(stats.byIntent).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([intent, n]) => ({ intent, n }));
      res.json({
        storage: Object.fromEntries(Object.keys(COLLECTIONS).map((n) => [COLLECTIONS[n].table, mode[n]])),
        stats: { ...stats, handledRate: stats.total ? Math.round((stats.handled / stats.total) * 100) : null },
        counts: { unanswered: await countRows('unanswered', 'new'), candidates: await countRows('learned', 'candidate'), learned: await countRows('learned', 'active'), escalations: await countRows('escalations', 'open'), proposals: props.filter((p) => p.status === 'pending' || p.status === 'failed').length, catalogRequests: await countRows('requests'), abandoned: await countRows('abandoned') },
        topIntents: top, flagged: down
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/admin/chat/intents', ...adminOnly, (req, res) => res.json(Object.entries(N.INTENTS).map(([id, d]) => ({ id, kind: d.kind, label: INTENT_LABEL[id] || id }))));
  app.get('/api/admin/chat/unanswered', ...adminOnly, async (req, res) => { try { res.json((await list('unanswered', { status: 'new', limit: 60, sort: 'hits' })).map((r) => ({ key: r.k, count: r.hits, samples: r.data.samples || [], chats: (r.data.sessions || []).length, lastSeenAt: r.lastSeenAt }))); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.get('/api/admin/chat/requests', ...adminOnly, async (req, res) => { try { res.json((await list('requests', { limit: 60, sort: 'hits' })).map((r) => ({ key: r.k, count: r.hits, samples: r.data.samples || [], lastSeenAt: r.lastSeenAt }))); } catch (err) { res.status(500).json({ error: err.message }); } });

  app.post('/api/admin/chat/teach', ...adminOnly, async (req, res) => {
    try {
      const { key, intent, answer, answerSw, title } = req.body || {};
      const row = await load('unanswered', clip(key, 190));
      if (!row) return res.status(404).json({ error: 'That question is no longer in the list.' });
      const samples = (row.data.samples || []).map((x) => x.replace(/^\[wrong answer\]\s*/, '')).filter((x) => x.length > 1);
      if (intent) {
        if (!N.INTENTS[intent]) return res.status(400).json({ error: 'Unknown intent.' });
        for (const smp of samples) await upsert('learned', `phrase:${intent}:${N.questionKey(smp)}`, { status: 'active', data: { type: 'phrase', text: smp, intent, votes: 99, sessions: [], adminTaught: true } }, (r) => { r.status = 'active'; r.data.adminTaught = true; });
      } else if (answer && String(answer).trim().length >= 3) {
        await upsert('learned', `faq:${rid()}`, { status: 'active', data: { type: 'faq', title: clip(title, 80) || samples[0] || key, triggers: samples.length ? samples : [key], answer: clip(answer, 1500), answerSw: clip(answerSw, 1500), adminTaught: true } }, () => {});
      } else return res.status(400).json({ error: 'Choose what the question means, or type an answer.' });
      await remove('unanswered', key);
      learnedStamp = 0; await learnedFresh();
      await safeLog({ req, action: 'CHAT_TAUGHT', category: 'settings', summary: `${req.adminUser.fullName} taught the assistant: "${clip(samples[0] || key, 80)}" ${intent ? '-> ' + intent : '-> custom answer'}` });
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/admin/chat/unanswered/dismiss', ...adminOnly, async (req, res) => { try { await patchRow('unanswered', clip((req.body || {}).key, 190), (r) => { r.status = 'dismissed'; }); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.post('/api/admin/chat/faqs', ...adminOnly, async (req, res) => {
    try {
      const b = req.body || {}; const triggers = (Array.isArray(b.triggers) ? b.triggers : String(b.triggers || '').split('\n')).map((x) => clip(x, 120)).filter((x) => x.length > 2).slice(0, 12);
      if (!triggers.length || !clip(b.answer, 1500)) return res.status(400).json({ error: 'Add at least one example question and an answer.' });
      await upsert('learned', `faq:${rid()}`, { status: 'active', data: { type: 'faq', title: clip(b.title, 80) || triggers[0], triggers, answer: clip(b.answer, 1500), answerSw: clip(b.answerSw, 1500), adminTaught: true } }, () => {});
      learnedStamp = 0; await learnedFresh();
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/admin/chat/learned', ...adminOnly, async (req, res) => {
    try {
      const status = ['candidate', 'active', 'rejected'].includes(req.query.status) ? req.query.status : 'candidate';
      res.json((await list('learned', { status, limit: 100, sort: 'hits' })).map((r) => ({ key: r.k, status: r.status, type: r.data.type, text: r.data.text || r.data.title || r.data.word, intent: r.data.intent, productId: r.data.productId, answer: r.data.answer, triggers: r.data.triggers, votes: r.data.votes || 0, chats: (r.data.sessions || []).length, auto: !!r.data.autoPromoted, adminTaught: !!r.data.adminTaught })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/admin/chat/learned/decision', ...adminOnly, async (req, res) => {
    try {
      const { key, action } = req.body || {}; const k = clip(key, 190);
      if (action === 'delete') await remove('learned', k);
      else if (action === 'approve') await patchRow('learned', k, (r) => { r.status = 'active'; r.data.approvedBy = req.adminUser.fullName; });
      else if (action === 'reject') await patchRow('learned', k, (r) => { r.status = 'rejected'; });
      else return res.status(400).json({ error: 'Unknown action.' });
      learnedStamp = 0; await learnedFresh();
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/admin/chat/escalations', ...adminOnly, async (req, res) => { try { res.json((await list('escalations', { status: req.query.status === 'closed' ? 'closed' : 'open', limit: 60 })).map((r) => ({ key: r.k, ...r.data, lastSeenAt: r.lastSeenAt }))); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.post('/api/admin/chat/escalations/resolve', ...adminOnly, async (req, res) => { try { await patchRow('escalations', clip((req.body || {}).key, 190), (r) => { r.status = 'closed'; r.data.closedBy = req.adminUser.fullName; }); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); } });

  // ---- table approvals
  const approveAttempts = new Map();
  app.get('/api/admin/chat/proposals', ...adminOnly, async (req, res) => {
    try { await evaluateNeeds(); res.json((await getProposals()).slice().reverse().map(publicProposal)); } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/admin/chat/proposals/:id/approve', ...adminOnly, async (req, res) => {
    try {
      const adminId = req.adminUser.id;
      const tries = (approveAttempts.get(adminId) || []).filter((t) => Date.now() - t < 15 * 60 * 1000);
      if (tries.length >= 5) return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.' });
      const hash = req.adminUser.password;
      if (!hash) return res.status(400).json({ error: 'This admin account has no password set, so it cannot approve database changes.' });
      const ok = await bcrypt.compare(String((req.body || {}).confirmPassword || ''), hash);
      if (!ok) { tries.push(Date.now()); approveAttempts.set(adminId, tries); return res.status(401).json({ error: 'Wrong password. Nothing was changed.' }); }
      approveAttempts.delete(adminId);
      const items = await getProposals();
      const p = items.find((x) => x.id === req.params.id);
      if (!p) return res.status(404).json({ error: 'Proposal not found.' });
      if (!['pending', 'failed'].includes(p.status)) return res.status(400).json({ error: `This proposal is already ${p.status}.` });
      try {
        await applyProposal(p);
        p.status = 'applied'; p.error = null;
      } catch (e) { p.status = 'failed'; p.error = clip(e.message, 300); }
      p.decidedAt = new Date().toISOString(); p.decidedBy = req.adminUser.fullName;
      await setProposals(items);
      await safeLog({ req, action: p.status === 'applied' ? 'CHAT_TABLES_APPROVED' : 'CHAT_TABLES_FAILED', category: 'system', severity: 'warn', summary: `${req.adminUser.fullName} ${p.status === 'applied' ? 'approved and created' : 'tried to create'} the chat tables: ${p.collections.map((c) => COLLECTIONS[c].table).join(', ')}${p.error ? ' (' + p.error + ')' : ''}` });
      res.status(p.status === 'applied' ? 200 : 500).json(p.status === 'applied' ? { ok: true, proposal: publicProposal(p) } : { error: `The tables could not be created: ${p.error}`, proposal: publicProposal(p) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/admin/chat/proposals/:id/reject', ...adminOnly, async (req, res) => {
    try {
      const items = await getProposals(); const p = items.find((x) => x.id === req.params.id);
      if (!p) return res.status(404).json({ error: 'Proposal not found.' });
      if (!['pending', 'failed'].includes(p.status)) return res.status(400).json({ error: `This proposal is already ${p.status}.` });
      p.status = 'rejected'; p.decidedAt = new Date().toISOString(); p.decidedBy = req.adminUser.fullName;
      await setProposals(items);
      await safeLog({ req, action: 'CHAT_TABLES_REJECTED', category: 'system', summary: `${req.adminUser.fullName} declined the chat tables: ${p.title}. The assistant keeps using its small built-in memory.` });
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ================================================================ BOOT
  (async () => {
    try {
      await loadConfigCollections();
      try { const row = await SystemConfig.findOne({ where: { key: 'chat_stats' } }); if (row && row.value && row.value.total !== undefined) stats = { ...stats, ...row.value, byIntent: { ...(row.value.byIntent || {}) } }; } catch (_) { /* fresh stats */ }
      await detectExistingTables();
      await rebuildLearned();
      await evaluateNeeds();
    } catch (e) { console.error('⚠️ Chat assistant start-up problem:', e.message); }
  })();
  setInterval(() => { flushCollections().catch(() => {}); }, 20 * 1000).unref?.();
  const flushOnExit = () => { flushCollections().catch(() => {}); };
  process.on('SIGTERM', flushOnExit); process.on('SIGINT', flushOnExit);

  console.log('🤖 Chat assistant ready: built-in engine (no external AI), guided checkout, self-learning, admin-approved tables.');
}
