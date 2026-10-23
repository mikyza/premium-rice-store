/**
 * MWEA RICE HUB — CHAT BRAIN (pure language logic, no third-party AI, no network calls)
 * Understands English, Swahili and Sheng mixes, tolerates typos, and can be taught new
 * phrases at run time (addExample) so it improves from real customer messages.
 */

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'am', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'it', 'me', 'my', 'i', 'you', 'your', 'we', 'us', 'please', 'pls', 'kindly', 'can', 'could', 'would', 'do', 'does', 'that', 'this', 'with', 'be', 'so', 'just', 'ya', 'za', 'wa', 'na', 'kwa', 'la', 'hii', 'hiyo', 'yangu', 'yako', 'sana', 'tafadhali']);

// word -> canonical word. Swahili / Sheng / SMS spelling all collapse to one concept.
const SYN = {
  mchele: 'rice', pilau: 'pilau', pishori: 'pishori', biryani: 'biryani', wali: 'rice', ugali: 'ugali',
  bei: 'price', ngapi: 'price', gharama: 'price', cost: 'price', costs: 'price', pricing: 'price', prices: 'price', much: 'price', amount: 'price', rate: 'price', charges: 'price',
  nataka: 'want', ninataka: 'want', naomba: 'want', nahitaji: 'want', need: 'want', wanna: 'want', get: 'want', order: 'order', buy: 'buy', nunua: 'buy', ninunue: 'buy', purchase: 'buy', kununua: 'buy', agiza: 'order',
  gunia: 'bag', magunia: 'bag', bags: 'bag', sack: 'bag', sacks: 'bag', packet: 'bag', packets: 'bag', pkt: 'bag',
  kilo: 'kg', kilos: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  lipa: 'pay', kulipa: 'pay', payment: 'pay', paying: 'pay', paid: 'pay', malipo: 'pay', paybill: 'paybill', till: 'till', buygoods: 'till', mpesa: 'mpesa', 'm-pesa': 'mpesa', stk: 'stk', push: 'stk',
  deliver: 'delivery', delivered: 'delivery', kuleta: 'delivery', leta: 'delivery', mizigo: 'delivery', shipping: 'delivery', transport: 'delivery', usafiri: 'delivery', dispatch: 'delivery',
  wapi: 'where', mahali: 'location', location: 'location', eneo: 'location', area: 'location', town: 'location', county: 'location',
  habari: 'hello', hujambo: 'hello', mambo: 'hello', niaje: 'hello', vipi: 'hello', hi: 'hello', hey: 'hello', hello: 'hello', hallo: 'hello', sasa: 'hello', salaam: 'hello', good: 'good',
  asante: 'thanks', shukran: 'thanks', thanks: 'thanks', thank: 'thanks', thx: 'thanks', ahsante: 'thanks',
  ndio: 'yes', yes: 'yes', yeah: 'yes', yep: 'yes', sawa: 'yes', ok: 'yes', okay: 'yes', fine: 'yes', sure: 'yes', proceed: 'yes', confirm: 'yes', confirmed: 'yes', endelea: 'yes', haya: 'yes',
  hapana: 'no', no: 'no', nope: 'no', siwezi: 'no', sitaki: 'no',
  cancel: 'cancel', sitisha: 'cancel', acha: 'cancel', ghairi: 'cancel', stop: 'cancel', restart: 'cancel', reset: 'cancel',
  rahisi: 'cheap', cheapest: 'cheap', cheap: 'cheap', affordable: 'cheap', budget: 'cheap', ghali: 'expensive',
  nzuri: 'best', bora: 'best', best: 'best', recommend: 'recommend', suggest: 'recommend', pendekeza: 'recommend', ushauri: 'recommend', advise: 'recommend',
  jumla: 'bulk', wholesale: 'bulk', bulk: 'bulk', 'in-bulk': 'bulk', kubwa: 'bulk',
  stock: 'stock', ipo: 'stock', available: 'stock', availability: 'stock', zipo: 'stock', inapatikana: 'stock',
  track: 'track', status: 'track', fika: 'track', reached: 'track', arrived: 'track', yangu: 'my',
  refund: 'refund', return: 'refund', rudisha: 'refund', damaged: 'complaint', complaint: 'complaint', complain: 'complaint', problem: 'complaint', issue: 'complaint', tatizo: 'complaint', shida: 'complaint',
  agent: 'human', human: 'human', person: 'human', representative: 'human', staff: 'human', mtu: 'human', support: 'human', care: 'human', mhudumu: 'human',
  masaa: 'hours', hours: 'hours', open: 'hours', closing: 'hours', fungua: 'hours', funga: 'hours',
  points: 'points', reward: 'points', rewards: 'points', zawadi: 'points', pointi: 'points',
  promo: 'promo', coupon: 'promo', voucher: 'promo', discount: 'promo', punguzo: 'promo', offa: 'promo', offer: 'promo',
  number: 'number', namba: 'number', phone: 'number', simu: 'number',
  expired: 'expired', failed: 'failed', fail: 'failed', stuck: 'failed', hakuna: 'failed', pending: 'pending', resend: 'resend', retry: 'resend', again: 'resend', tena: 'resend',
  aromatic: 'aromatic', sticky: 'sticky', organic: 'organic', brown: 'brown', white: 'white', basmati: 'basmati', long: 'long',
  family: 'family', familia: 'family', people: 'family', watu: 'family', household: 'family', restaurant: 'restaurant', hoteli: 'restaurant', hotel: 'restaurant', shop: 'restaurant', duka: 'restaurant',
  back: 'back', rudi: 'back', change: 'change', badilisha: 'change', edit: 'change', remove: 'remove', ondoa: 'remove',
  summary: 'summary', cart: 'cart', basket: 'cart', trolley: 'cart', kikapu: 'cart', total: 'total', jumla_yote: 'total',
  who: 'who', name: 'who', bot: 'who', robot: 'who', real: 'who',
  help: 'help', msaada: 'help', saidia: 'help', menu: 'help', options: 'help'
};

const SWAHILI_MARKERS = new Set(['nataka', 'ninataka', 'naomba', 'mchele', 'bei', 'ngapi', 'habari', 'asante', 'tafadhali', 'karibu', 'sawa', 'ndio', 'hapana', 'gunia', 'magunia', 'kilo', 'lipa', 'nunua', 'wapi', 'sasa', 'nahitaji', 'mambo', 'vipi', 'niaje', 'tena', 'rudi', 'leta', 'jumla', 'shukran', 'ahsante', 'pendekeza', 'ndiyo', 'bado', 'mimi', 'yako', 'kwa', 'nimelipa', 'imefika', 'agiza', 'ninunue', 'badilisha', 'ghairi', 'sitisha']);

export const isSwahili = (text) => {
  const t = String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);
  return t.filter((w) => SWAHILI_MARKERS.has(w)).length >= 1;
};

export const normalize = (text) => String(text || '').toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9#\s.+\-@]/g, ' ').replace(/\s+/g, ' ').trim();

const stem = (w) => (w.length > 4 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

export function tokens(text, { keepStop = false } = {}) {
  const raw = normalize(text).replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2').split(' ').filter(Boolean);
  const out = [];
  for (const w of raw) {
    const base = SYN[w] || SYN[stem(w)] || stem(w);
    if (!keepStop && STOP.has(base)) continue;
    out.push(base);
  }
  return out;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}
/** typo tolerant word equality: "pishori" ~ "pisori", "delivry" ~ "delivery" */
export const fuzzyEq = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1));

// ------------------------------------------------------------------ intent classifier (TF-IDF cosine + learned examples)
export class IntentClassifier {
  constructor(seed = {}) {
    this.examples = []; // { intent, toks, weight }
    this.df = new Map();
    this.vocab = new Set();
    this.dirty = true;
    Object.entries(seed).forEach(([intent, list]) => list.forEach((t) => this.addExample(intent, t, 1, true)));
    this.rebuild();
  }
  addExample(intent, text, weight = 1, defer = false) {
    const toks = tokens(text);
    if (!toks.length) return;
    const sig = `${intent}|${toks.join(' ')}`;
    if (this.sigs && this.sigs.has(sig)) return;
    (this.sigs = this.sigs || new Set()).add(sig);
    this.examples.push({ intent, toks, weight });
    this.dirty = true;
    if (!defer) this.rebuild();
  }
  rebuild() {
    this.df = new Map(); this.vocab = new Set();
    this.examples.forEach((e) => new Set(e.toks).forEach((t) => { this.df.set(t, (this.df.get(t) || 0) + 1); this.vocab.add(t); }));
    const N = Math.max(1, this.examples.length);
    this.idf = (t) => Math.log(1 + N / (1 + (this.df.get(t) || 0)));
    this.examples.forEach((e) => { e.vec = this.vec(e.toks); });
    this.dirty = false;
  }
  correct(toks) {
    return toks.map((t) => {
      if (this.vocab.has(t) || t.length < 4 || /\d/.test(t)) return t;
      let best = null, bd = 9;
      for (const v of this.vocab) { if (Math.abs(v.length - t.length) > 2) continue; const d = levenshtein(t, v); if (d < bd) { bd = d; best = v; } }
      return best && bd <= (t.length >= 7 ? 2 : 1) ? best : t;
    });
  }
  vec(toks) {
    const m = new Map();
    toks.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
    for (let i = 0; i < toks.length - 1; i += 1) { const bg = `${toks[i]}_${toks[i + 1]}`; m.set(bg, (m.get(bg) || 0) + 0.7); }
    let norm = 0;
    m.forEach((tf, t) => { const w = tf * (t.includes('_') ? 1.3 : this.idf(t)); m.set(t, w); norm += w * w; });
    return { m, norm: Math.sqrt(norm) || 1 };
  }
  /** returns [{intent, score}] best first; score 0..1 */
  classify(text) {
    if (this.dirty) this.rebuild();
    const neutral = this.neutral || new Set();
    const all = this.correct(tokens(text)).filter((t) => !/^\d+(\.\d+)?$/.test(t) && !neutral.has(t));
    const toks = all.filter((t) => this.vocab.has(t));
    if (!toks.length) return [];
    const coverage = Math.pow(toks.length / all.length, 1.5);
    const q = this.vec(toks);
    const best = new Map();
    for (const e of this.examples) {
      let dot = 0;
      q.m.forEach((w, t) => { const o = e.vec.m.get(t); if (o) dot += w * o; });
      let s = dot / (q.norm * e.vec.norm);
      // short utterances that exactly equal an example are certain
      if (e.toks.length === toks.length && e.toks.every((t, i) => t === toks[i])) s = Math.max(s, 1);
      s *= e.weight * coverage;
      if (s > (best.get(e.intent) || 0)) best.set(e.intent, s);
    }
    return [...best.entries()].map(([intent, score]) => ({ intent, score: Math.min(1, score) })).sort((a, b) => b.score - a.score);
  }
}

/** similarity between a question and a stored Q&A (used for admin-taught knowledge) */
export function textSimilarity(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((t) => { if (B.has(t) || [...B].some((x) => fuzzyEq(t, x))) hit += 1; });
  return (2 * hit) / (A.size + B.size);
}

// ------------------------------------------------------------------ entity extractors
const NUM_WORDS = { one: 1, moja: 1, mmoja: 1, two: 2, mbili: 2, three: 3, tatu: 3, four: 4, nne: 4, five: 5, tano: 5, six: 6, sita: 6, seven: 7, saba: 7, eight: 8, nane: 8, nine: 9, tisa: 9, ten: 10, kumi: 10, twenty: 20, ishirini: 20, fifty: 50, hamsini: 50, hundred: 100, mia: 100 };

export function extractQuantity(text) {
  const t = normalize(text).replace(/(\d),(\d{3})/g, '$1$2');
  const unitRe = '(kg|kgs|kilo|kilos|kilogram|kilograms|bag|bags|gunia|magunia|sack|sacks|packet|packets|pkt|pcs|pieces|x)';
  let m = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitRe}\\b`));
  if (!m) m = t.match(new RegExp(`\\b(${Object.keys(NUM_WORDS).join('|')})\\s*${unitRe}\\b`));
  if (m) {
    const value = Number.isNaN(Number(m[1])) ? NUM_WORDS[m[1]] : Number(m[1]);
    const u = m[2];
    const unit = /^k/.test(u) && u !== 'kg' ? 'kg' : u === 'kg' || u === 'kgs' ? 'kg' : 'bag';
    return { value, unit: /^(kg|kgs|kilo|kilos|kilogram|kilograms)$/.test(u) ? 'kg' : unit === 'kg' ? 'kg' : 'bag' };
  }
  const lone = t.match(/^\s*(\d{1,4}(?:\.\d+)?)\s*$/);
  if (lone) return { value: Number(lone[1]), unit: null };
  const w = t.split(' ').find((x) => NUM_WORDS[x]);
  if (w && t.split(' ').length <= 3) return { value: NUM_WORDS[w], unit: null };
  return null;
}
export const extractBudget = (text) => {
  const m = normalize(String(text || '').replace(/(\d),(\d{3})/g, '$1$2')).match(/(?:under|below|less than|within|max|maximum|budget(?: of| is)?|chini ya|hadi|up to)\s*(?:kes|ksh|sh|shs)?\s*(\d{3,6})/);
  return m ? Number(m[1]) : null;
};
export const extractPromo = (text) => {
  const m = String(text || '').match(/\b(?:code|promo|coupon|voucher)\s*(?:is|:|-)?\s*([A-Za-z0-9_-]{3,24})\b/i);
  if (m && !['is', 'please', 'pls', 'here', 'the'].includes(m[1].toLowerCase())) return m[1].toUpperCase();
  const solo = String(text || '').trim().match(/^[A-Z0-9_-]{4,24}$/);
  return solo ? solo[0] : null;
};
export const extractMpesaCode = (text) => {
  const m = String(text || '').toUpperCase().match(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10}\b/);
  return m ? m[0] : null;
};
export const extractOrderId = (text) => { const m = String(text || '').match(/#\s*(\d{1,9})\b|\border\s*(?:no\.?|number|id)?\s*(\d{1,9})\b/i); return m ? Number(m[1] || m[2]) : null; };
export const extractPhoneRaw = (text) => { const m = String(text || '').replace(/[\s-]/g, '').match(/(?:\+?254|0)[17]\d{8}/); return m ? m[0] : null; };
export const extractFamilySize = (text) => { const m = normalize(text).match(/(?:family of|household of|watu|people|kids|children|we are|sisi ni)\s*(\d{1,2})|(\d{1,2})\s*(?:people|persons|watu|members)/); return m ? Number(m[1] || m[2]) : null; };

export const isYes = (text) => { const t = tokens(text, { keepStop: true }); return t.length > 0 && t.length <= 4 && t.includes('yes') && !t.includes('no'); };
export const isNo = (text) => { const t = tokens(text, { keepStop: true }); return t.length > 0 && t.length <= 4 && t.includes('no') && !t.includes('yes'); };
export const ordinalPick = (text, max) => {
  const t = normalize(text);
  const words = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5, moja: 1, pili: 2 };
  const w = Object.keys(words).find((k) => new RegExp(`\\b${k}\\b`).test(t));
  if (w && words[w] <= max) return words[w];
  const m = t.match(/^(?:no\.?|number|option|#)?\s*(\d{1,2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= max) return Number(m[1]);
  return null;
};

// ------------------------------------------------------------------ seed knowledge: what each intent sounds like
export const SEED_INTENTS = {
  greet: ['hello', 'hi there', 'good morning', 'good afternoon', 'habari', 'mambo vipi', 'niaje', 'hey', 'hujambo', 'sasa'],
  thanks: ['thanks', 'thank you so much', 'asante', 'asante sana', 'shukran', 'thanks a lot'],
  who_are_you: ['who are you', 'are you a bot', 'are you human', 'is this a robot', 'wewe ni nani', 'am i talking to a real person'],
  help: ['help', 'what can you do', 'menu', 'options', 'msaada', 'how do i use this', 'saidia'],
  browse: ['what rice do you sell', 'show me your rice', 'list products', 'what do you have', 'mnauza mchele gani', 'catalog', 'show me rice', 'available rice types', 'rice varieties'],
  price: ['how much is the rice', 'price of pishori', 'bei ya mchele', 'how much per kg', 'what does it cost', 'ngapi', 'price list', 'bei ngapi', 'cost of a 5kg bag'],
  stock: ['is it in stock', 'do you have basmati', 'available', 'bado ipo', 'is pishori available', 'out of stock'],
  recommend: ['recommend me a rice', 'which rice is best for pilau', 'suggest something cheap', 'what is the best rice', 'nipendekeze mchele', 'rice for a family of five', 'cheapest rice', 'best rice for biryani', 'which one should i buy'],
  buy: ['i want 3 bags of rice', 'give me 2 bags', 'nipe magunia mawili', 'i will take 5 bags', 'add 2 bags to my order', 'i want to buy rice', 'nataka kununua mchele', 'i would like to order', 'place an order', 'i need rice', 'naomba mchele', 'let me buy', 'order rice', 'i want to order 2 bags', 'add to cart', 'ninataka kuagiza', 'buy now'],
  bulk: ['i want a bulk order', 'wholesale prices', 'bei ya jumla', 'i need 100kg', 'do you sell in bulk', 'large quantity discount', 'bulk discount', 'restaurant supply', 'magunia mengi'],
  delivery_info: ['how much is delivery', 'do you deliver to nakuru', 'delivery time', 'how long will delivery take', 'mnaleta mombasa', 'shipping cost', 'delivery fee to nairobi', 'gharama ya kuleta', 'do you deliver to my area'],
  payment_info: ['how do i pay', 'payment methods', 'do you accept mpesa', 'is there a till number', 'paybill number', 'njia za kulipa', 'can i pay on delivery', 'pay with mpesa', 'how to pay'],
  order_status: ['where is my order', 'track my order', 'order status', 'has my order shipped', 'order yangu iko wapi', 'my order has not arrived', 'when will my order arrive', 'check my order'],
  payment_check: ['i have paid', 'nimelipa', 'did my payment go through', 'payment status', 'i paid but no confirmation', 'check payment', 'mpesa deducted'],
  payment_resend: ['resend the stk', 'send the prompt again', 'i did not get the mpesa prompt', 'no prompt on my phone', 'retry payment', 'tuma tena', 'stk did not come', 'payment prompt failed'],
  store_info: ['what are your opening hours', 'where are you located', 'contact number', 'phone number for support', 'saa ngapi mnafunga', 'whatsapp number', 'business hours', 'call you'],
  points: ['how do reward points work', 'my points', 'how many points do i have', 'zawadi pointi', 'redeem points', 'loyalty points'],
  promo: ['do you have a promo code', 'any discount', 'coupon code', 'punguzo', 'any offers today', 'discount code', 'flash sale'],
  complaint: ['i have a complaint', 'my rice was damaged', 'i want a refund', 'wrong item delivered', 'return the rice', 'tatizo na order yangu', 'bad service', 'rice is spoiled'],
  human: ['talk to a person', 'i want to speak to an agent', 'call me', 'customer care', 'nataka kuongea na mtu', 'connect me to support', 'human please'],
  cancel: ['cancel', 'start over', 'forget it', 'stop', 'sitaki tena', 'cancel my order', 'reset', 'ghairi', 'never mind'],
  show_cart: ['show my cart', 'what is in my basket', 'order summary', 'what have i ordered so far', 'view cart', 'total so far', 'kikapu changu'],
  change: ['change quantity', 'remove an item', 'change the rice', 'badilisha', 'edit my order', 'go back', 'rudi nyuma', 'i want to change my order'],
  proceed: ['checkout', 'proceed to checkout', 'i am done', 'that is all', 'nimemaliza', 'continue to payment', 'finish the order', 'ready to pay', 'lets pay', 'that will be all']
};

export const LANG = {
  en: {
    ok: 'OK', yes: 'Yes', no: 'No',
  },
  sw: {}
};
