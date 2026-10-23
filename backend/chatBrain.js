/**
 * MWEA RICE HUB — CHAT BRAIN (pure language logic, no third-party AI, no network calls)
 * Understands English, Swahili and Sheng mixes, tolerates typos, and can be taught new
 * phrases at run time (addExample) so it improves from real customer messages.
 */

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'am', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'it', 'me', 'my', 'i', 'you', 'your', 'we', 'us', 'please', 'pls', 'kindly', 'can', 'could', 'would', 'do', 'does', 'that', 'this', 'with', 'be', 'so', 'just', 'ya', 'za', 'wa', 'na', 'kwa', 'la', 'hii', 'hiyo', 'yangu', 'yako', 'sana', 'tafadhali',
  'there', 'any', 'some', 'if', 'but', 'will', 'shall', 'should', 'may', 'might', 'did', 'was', 'were', 'been', 'im', 'ive', 'id', 'ill', 'its', 'thats', 'theres', 'tell', 'know', 'about', 'like', 'also', 'then', 'now', 'today', 'there',
  'kuna', 'kwenda', 'yoyote', 'yeyote', 'leo', 'tu', 'pia', 'ni', 'ya', 'kama', 'au', 'ili', 'huko', 'hapa', 'pale', 'hivi', 'kujua', 'kuhusu', 'je', 'basi', 'hata', 'mimi', 'wewe', 'yetu', 'yenu', 'zako', 'zangu', 'wake']);

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
  who: 'who', name: 'who', bot: 'who', robot: 'who', real: 'who', nani: 'who',
  help: 'help', msaada: 'help', saidia: 'help', menu: 'help',
  // --- added: opening hours, comparison, comparatives, SMS shorthand
  close: 'hours', closes: 'hours', closed: 'hours', opens: 'hours', wazi: 'hours', mnafunga: 'hours', mnafungua: 'hours',
  compare: 'compare', comparison: 'compare', versus: 'compare', vs: 'compare', difference: 'compare', different: 'compare', tofauti: 'compare', linganisha: 'compare',
  cheaper: 'cheap', cheapest: 'cheap', rahisisha: 'cheap', pricey: 'expensive', pricier: 'expensive', costly: 'expensive', 'bei-nafuu': 'cheap', nafuu: 'cheap',
  better: 'best', nicer: 'best', tastier: 'best',
  u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', plss: 'please', wat: 'what', wht: 'what', hw: 'how', abt: 'about', bt: 'but', msg: 'message', thnx: 'thanks', thnks: 'thanks', tnx: 'thanks',
  prompt: 'stk', prompts: 'stk',
  imeisha: 'stock', zimeisha: 'stock', soldout: 'stock', torn: 'complaint', broken: 'complaint', leaking: 'complaint', spoilt: 'complaint', rotten: 'complaint', mbaya: 'complaint', mbovu: 'complaint', imeharibika: 'complaint', bad: 'complaint', wrong: 'complaint',
  dont: 'not', doesnt: 'not', didnt: 'not', isnt: 'not', cant: 'not', wont: 'not', never: 'not', not: 'not', without: 'not',
  bob: 'kes', ksh: 'kes', kes: 'kes', shillings: 'kes', shilingi: 'kes'
};

// strong markers are unmistakably Swahili/Sheng; weak ones also show up in English chat ("sawa", "sasa", "tena")
const SWAHILI_STRONG = new Set(['nataka', 'ninataka', 'naomba', 'mchele', 'bei', 'ngapi', 'habari', 'asante', 'tafadhali', 'karibu', 'hapana', 'gunia', 'magunia', 'kilo', 'lipa', 'nunua', 'wapi', 'nahitaji', 'mambo', 'vipi', 'niaje', 'leta', 'jumla', 'shukran', 'ahsante', 'pendekeza', 'ndiyo', 'mimi', 'yako', 'nimelipa', 'imefika', 'agiza', 'ninunue', 'badilisha', 'ghairi', 'sitisha', 'nipe', 'nina', 'mnauza', 'mnaleta', 'kuna', 'gani', 'sitaki', 'kununua', 'kuagiza', 'oda', 'usafiri', 'malipo', 'pesa', 'mawili', 'matatu', 'manne', 'matano', 'mbili', 'tatu', 'elfu', 'bila', 'wangu', 'yangu', 'changu', 'zangu', 'nimemaliza', 'mtu', 'saidia', 'msaada']);
const SWAHILI_WEAK = new Set(['sawa', 'sasa', 'tena', 'bado', 'ndio', 'kwa', 'rudi', 'na', 'ya', 'wa', 'ni', 'tu', 'hii', 'hiyo']);
const ENGLISH_MARKERS = new Set(['the', 'is', 'are', 'you', 'your', 'do', 'does', 'how', 'what', 'where', 'when', 'which', 'can', 'could', 'would', 'want', 'need', 'please', 'much', 'bags', 'bag', 'deliver', 'delivery', 'price', 'order', 'have', 'with', 'for', 'and', 'my', 'me', 'i', 'rice', 'recommend', 'cheapest', 'cheap', 'best', 'track', 'hours', 'wholesale', 'bulk', 'stock', 'available', 'pay', 'payment', 'cancel', 'help', 'cart', 'total', 'promo', 'discount', 'thanks', 'thank', 'about', 'tell', 'show', 'get', 'buy', 'any', 'cost', 'much', 'many', 'of', 'to', 'in', 'on']);

/** 0..n: how Swahili the message looks. Strong markers count 1, weak markers 0.4 (and only help when something else agrees). */
export function swahiliScore(text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  let strong = 0, weak = 0, en = 0;
  for (const w of t) { if (SWAHILI_STRONG.has(w)) strong += 1; else if (SWAHILI_WEAK.has(w)) weak += 1; if (ENGLISH_MARKERS.has(w)) en += 1; }
  return { strong, weak, en, words: t.length };
}
/** true when the message is Swahili/Sheng-leaning. One strong marker is enough unless English clearly dominates. */
export const isSwahili = (text) => {
  const { strong, weak, en, words } = swahiliScore(text);
  if (!words) return false;
  if (strong >= 2) return true;
  if (strong === 1) return en < 3;                  // "nataka the price of pishori and delivery" is still English-ish
  return weak >= 2 && en === 0;                     // "sawa tena" alone
};
/** language to reply in: switch only on clear evidence, otherwise stay with what the customer was already using */
export function detectLang(text, current = 'en') {
  const s = swahiliScore(text);
  if (!s.words) return current;
  if (isSwahili(text)) return 'sw';
  if (s.strong === 0 && (s.en >= 2 || (s.en >= 1 && s.words >= 3))) return 'en';     // clearly English
  return current;                                    // "ok", "sawa", "mpesa", a place name: do not flip
}

export const normalize = (text) => String(text || '').toLowerCase().replace(/[\u2018\u2019']/g, '')
  .replace(/([a-z])\1{2,}/g, '$1$1')                   // "pleaseeee" -> "pleasee", "heyyyy" -> "heyy" (baseOf() finishes the job)
  .replace(/[^a-z0-9#\s.+\-@]/g, ' ').replace(/\s+/g, ' ').trim();

const stem = (w) => (w.length > 4 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** canonical concept for one raw word: synonyms, plural/-ing stemming, and stretched spellings ("heyyy", "thankss") */
function baseOf(w) {
  if (SYN[w]) return SYN[w];
  const st = stem(w);
  if (SYN[st]) return SYN[st];
  if (STOP.has(w)) return w;
  const sq = w.replace(/(.)\1+/g, '$1');
  if (sq !== w) { if (SYN[sq]) return SYN[sq]; if (STOP.has(sq)) return sq; if (SYN[stem(sq)]) return SYN[stem(sq)]; }
  return st;
}
/** true for words that carry no meaning of their own (the, for, you, tu, kuna ...) */
export const isFiller = (w) => STOP.has(w) || STOP.has(baseOf(w));
const splitWords = (text) => normalize(text).replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2').split(' ').filter(Boolean);

export function tokens(text, { keepStop = false } = {}) {
  const out = [];
  for (const w of splitWords(text)) {
    const base = baseOf(w);
    if (!keepStop && STOP.has(base)) continue;
    out.push(base);
  }
  return out;
}

// ------------------------------------------------------------------ negation: "I don't want to buy, just tell me the price"
// Only desire/action words are cancelled (want / buy / order). Words like "arrived" or "paid" keep their meaning in
// "my order has not arrived", which is a complaint, not a denial.
const NEG_TARGETS = new Set(['want', 'buy', 'order']);
const NEG_RAW_CUES = new Set(['sitaki', 'sihitaji', 'sipendi']);
const NEG_BOUNDARY = new Set(['but', 'and', 'then', 'so', 'na', 'lakini', 'ila', 'halafu', 'just', 'only', 'tu', 'instead', 'badala']);
/** returns { toks, negated } where toks are the meaningful concepts with negated wants/buys removed */
export function analyze(text) {
  const clauses = String(text || '').split(/[,;!?]+|\.(?=\s|$)/);
  const all = []; const negated = [];
  for (const clause of clauses) {
    const raw = splitWords(clause); const bases = raw.map(baseOf); const dead = new Set();
    for (let i = 0; i < raw.length; i += 1) {
      const cue = bases[i] === 'not' || NEG_RAW_CUES.has(raw[i]);
      if (!cue) continue;
      if (bases[i + 1] === 'forget' || raw[i + 1] === 'forget' || bases[i + 1] === 'worry') { dead.add(i); dead.add(i + 1); continue; }   // "don't forget to order": a reminder, not a refusal
      let killed = false;
      for (let j = i + 1; j < raw.length && j <= i + 5; j += 1) {
        if (NEG_BOUNDARY.has(bases[j]) || NEG_BOUNDARY.has(raw[j])) break;
        if (NEG_TARGETS.has(bases[j])) { dead.add(j); negated.push(bases[j]); killed = true; }
      }
      if (killed) dead.add(i);                                  // the "not" itself has done its job; leaving it would pollute the intent score
    }
    bases.forEach((b, i) => { if (!STOP.has(b) && !dead.has(i)) all.push(b); });
  }
  if (!all.length) return { toks: tokens(text), negated };   // never let negation erase the whole message
  return { toks: all, negated };
}

/** Damerau-Levenshtein (adjacent swaps cost 1): "prcie" ~ "price", "stcok" ~ "stock" */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
  }
  return dp[a.length][b.length];
}
/** typo tolerant word equality: "pishori" ~ "pisori", "delivry" ~ "delivery" */
export const fuzzyEq = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1));

// ------------------------------------------------------------------ number words (English + Swahili) -> digits
const UNIT_N = { moja: 1, mmoja: 1, kimoja: 1, one: 1, mbili: 2, mawili: 2, miwili: 2, viwili: 2, wawili: 2, two: 2, tatu: 3, matatu: 3, mitatu: 3, watatu: 3, three: 3, nne: 4, manne: 4, minne: 4, wanne: 4, four: 4, tano: 5, matano: 5, mitano: 5, watano: 5, five: 5, sita: 6, six: 6, saba: 7, seven: 7, nane: 8, eight: 8, tisa: 9, nine: 9, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS_N = { kumi: 10, ten: 10, ishirini: 20, twenty: 20, thelathini: 30, thirty: 30, arobaini: 40, forty: 40, hamsini: 50, fifty: 50, sitini: 60, sixty: 60, sabini: 70, seventy: 70, themanini: 80, eighty: 80, tisini: 90, ninety: 90 };
const NUM_WORDS = { ...UNIT_N, ...TENS_N, hundred: 100, mia: 100, thousand: 1000, elfu: 1000 };
const isNumWord = (w) => Object.prototype.hasOwnProperty.call(NUM_WORDS, w);

/** "magunia mawili" -> "magunia 2", "kumi na tano" -> "15", "elfu tano" -> "5000", "two thousand five hundred" -> "2500" */
export function numerize(text) {
  const w = String(text || '').split(' '); const out = [];
  for (let i = 0; i < w.length;) {
    if (!isNumWord(w[i])) { out.push(w[i]); i += 1; continue; }
    let j = i; const run = [];
    while (j < w.length && (isNumWord(w[j]) || ((w[j] === 'na' || w[j] === 'and') && j > i && isNumWord(w[j + 1] || '')))) { if (w[j] !== 'na' && w[j] !== 'and') run.push(w[j]); j += 1; }
    let total = 0; let cur = 0;
    for (let k = 0; k < run.length; k += 1) {
      const x = run[k];
      if (x === 'hundred') cur = (cur || 1) * 100;
      else if (x === 'thousand') { total += (cur || 1) * 1000; cur = 0; }
      else if (x === 'mia' || x === 'elfu') {                       // Swahili puts the multiplier AFTER: "mia mbili" = 200, "elfu tano" = 5000
        const mult = x === 'mia' ? 100 : 1000; let n = 0; let used = 0;
        while (k + 1 < run.length && (UNIT_N[run[k + 1]] || TENS_N[run[k + 1]]) && used < 2) { n += UNIT_N[run[k + 1]] || TENS_N[run[k + 1]]; k += 1; used += 1; }
        if (x === 'mia') cur += (n || 1) * mult; else { total += (n || 1) * mult; }
      } else cur += NUM_WORDS[x];
    }
    out.push(String(total + cur)); i = j;
  }
  return out.join(' ');
}

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
    const out = [];
    for (const t of toks) {
      if (this.vocab.has(t) || t.length < 4 || /\d/.test(t)) { out.push(t); continue; }
      let best = null, bd = 9;
      for (const v of this.vocab) { if (Math.abs(v.length - t.length) > 2) continue; const d = levenshtein(t, v); if (d < bd) { bd = d; best = v; } }
      if (best && bd <= (t.length >= 7 ? 2 : 1)) { out.push(best); continue; }
      // glued words: "howmuch" -> how + much, "deliveryfee" -> delivery + fee
      let split = null;
      if (t.length >= 6) for (let i = 3; i <= t.length - 3 && !split; i += 1) { const l = baseOf(t.slice(0, i)); const r = baseOf(t.slice(i)); if ((this.vocab.has(l) || STOP.has(l)) && (this.vocab.has(r) || STOP.has(r))) split = [l, r].filter((x) => !STOP.has(x)); }
      if (split && split.length) out.push(...split); else out.push(t);
    }
    return out;
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
    const all = this.correct(analyze(text).toks).filter((t) => !/^\d+(\.\d+)?$/.test(t) && !neutral.has(t));
    const toks = all.filter((t) => this.vocab.has(t));
    if (!toks.length) return [];
    // unknown words (typos we could not fix, names, filler) lower confidence a little, they no longer sink it
    const coverage = Math.pow(toks.length / (toks.length + 0.6 * (all.length - toks.length)), 1.2);
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
const KG_UNITS = '(?:kg|kgs|kilo|kilos|kilogram|kilograms)';
const BAG_UNITS = '(?:bags?|gunia|magunia|sacks?|packets?|pkts?|pcs|pieces?|x)';
const kindOf = (u) => (/^(kg|kgs|kilo|kilos|kilogram|kilograms)$/.test(u) ? 'kg' : 'bag');

/** { value, unit: 'kg'|'bag'|null, sizeKg? } or null. Understands "2 bags", "magunia mawili", "gunia 3", "kilo kumi", "a bag", "3 x 5kg", "2 bags of 5kg" */
export function extractQuantity(text) {
  const t = numerize(normalize(text).replace(/(\d),(\d{3})/g, '$1$2'));
  let m = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:bags?|gunia|magunia|sacks?|packets?|pkts?)\\s*(?:of|za|ya|wa)?\\s*(\\d+(?:\\.\\d+)?)\\s*${KG_UNITS}\\b`));
  if (m) return { value: Number(m[1]), unit: 'bag', sizeKg: Number(m[2]) };
  m = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${KG_UNITS}\\s*(?:x|\\*|times)\\s*(\\d+)\\b`)) || null;
  if (m) return { value: Number(m[2]), unit: 'bag', sizeKg: Number(m[1]) };
  m = t.match(new RegExp(`(\\d+)\\s*(?:x|\\*)\\s*(\\d+(?:\\.\\d+)?)\\s*${KG_UNITS}\\b`));
  if (m) return { value: Number(m[1]), unit: 'bag', sizeKg: Number(m[2]) };
  m = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${KG_UNITS}|${BAG_UNITS})\\b`));
  if (m) return { value: Number(m[1]), unit: kindOf(m[2]) };
  m = t.match(new RegExp(`\\b(${KG_UNITS}|bags?|gunia|magunia|sacks?)\\s*(?:ya|za|wa)?\\s*(\\d+(?:\\.\\d+)?)\\b(?!\\s*${KG_UNITS})`));   // Swahili order: "magunia 3", "kilo 10"
  if (m) return { value: Number(m[2]), unit: kindOf(m[1]) };
  m = t.match(/\b(?:a|an|one)\s+(bag|sack|packet|pkt|gunia)\b/); if (m) return { value: 1, unit: 'bag' };
  m = t.match(new RegExp(`\\b(?:a|an)\\s+${KG_UNITS}\\b`)); if (m) return { value: 1, unit: 'kg' };
  const nums = t.match(/(?<![\d.])\d{1,4}(?:\.\d+)?(?![\d.])/g);
  if (nums && nums.length === 1 && t.split(' ').length <= 3) return { value: Number(nums[0]), unit: null };
  return null;
}

const MONEY = '(?:kes|ksh|sh|shs|bob|shillings|shilingi)';
/** budget in KES from "under 3000", "budget of 5k", "I have 5000", "nina elfu tano", "ksh 2500". Returns null when no money is mentioned. */
export const extractBudget = (text) => {
  let t = numerize(normalize(String(text || '').replace(/(\d),(\d{3})/g, '$1$2')));
  t = t.replace(/(\d+(?:\.\d+)?)\s*k\b(?!g)/g, (_, n) => String(Math.round(Number(n) * 1000))).replace(/\/=/g, ' kes ');
  const notUnit = `(?!\\s*(?:${KG_UNITS}|bags?|gunia|magunia|sacks?|x|\\d))`;
  const prefix = '(?:under|below|less than|within|max|maximum|budget(?: of| is)?|chini ya|hadi|up to|not more than|around|about|only|i have|ive got|i got|i can spend|can afford|nina|ninazo|nimebaki na|bajeti(?: ya| yangu ni)?|with|kwa)';
  let m = t.match(new RegExp(`${prefix}\\s*${MONEY}?\\s*(\\d{3,7})${notUnit}`));
  if (m) return Number(m[1]);
  m = t.match(new RegExp(`${MONEY}\\s*(\\d{3,7})${notUnit}`)) || t.match(new RegExp(`(\\d{3,7})\\s*${MONEY}\\b`));
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
export const isNo = (text) => { const t = tokens(text, { keepStop: true }); return t.length > 0 && t.length <= 4 && (t.includes('no') || (t.includes('not') && t.length <= 3)) && !t.includes('yes'); };
export const ordinalPick = (text, max) => {
  const t = normalize(text);
  const words = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5, moja: 1, pili: 2 };
  const w = Object.keys(words).find((k) => new RegExp(`\\b${k}\\b`).test(t));
  if (w && words[w] <= max) return words[w];
  const m = t.match(/^(?:no\.?|number|option|#)?\s*(\d{1,2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= max) return Number(m[1]);
  return null;
};

/** "how much is pishori and do you deliver to nakuru" -> ["how much is pishori", "do you deliver to nakuru"] */
export function splitClauses(text) {
  const out = [];
  for (const chunk of String(text || '').split(/[?!;,]+|\.(?=\s|$)/)) {
    const t = numerize(normalize(chunk));
    t.split(/\s+(?:and|na|pia|also|plus|halafu|then|but|lakini|while)\s+/).map((x) => x.trim()).forEach((x) => { if (tokens(x).length >= 2) out.push(x); });
  }
  return out;
}

// ------------------------------------------------------------------ seed knowledge: what each intent sounds like
export const SEED_INTENTS = {
  greet: ['hello', 'hi there', 'good morning', 'good afternoon', 'habari', 'mambo vipi', 'niaje', 'hey', 'hujambo', 'sasa'],
  thanks: ['thanks', 'thank you so much', 'asante', 'asante sana', 'shukran', 'thanks a lot', 'asante kwa msaada', 'much appreciated'],
  who_are_you: ['who are you', 'are you a bot', 'are you a real human or a bot', 'is this a robot', 'wewe ni nani', 'am i talking to a real person'],
  help: ['help', 'what can you do', 'menu', 'options', 'msaada', 'how do i use this', 'saidia'],
  browse: ['what rice do you sell', 'show me your rice', 'list products', 'what do you have', 'mnauza mchele gani', 'catalog', 'show me rice', 'available rice types', 'rice varieties', 'what types of rice', 'mna aina gani', 'mnauza nini'],
  price: ['how much is the rice', 'price of pishori', 'bei ya mchele', 'how much per kg', 'what does it cost', 'ngapi', 'price list', 'bei ngapi', 'cost of a 5kg bag', 'what is the price', 'how much for', 'bei gani', 'kilo moja ni ngapi', 'how much do you sell', 'bei ya pishori'],
  stock: ['is it in stock', 'do you have basmati', 'available', 'bado ipo', 'is pishori available', 'out of stock'],
  recommend: ['recommend me a rice', 'which rice is best for pilau', 'suggest something cheap', 'what is the best rice', 'nipendekeze mchele', 'rice for a family of five', 'cheapest rice', 'best rice for biryani', 'which one should i buy'],
  buy: ['i want 3 bags of rice', 'give me 2 bags', 'nipe magunia mawili', 'i will take 5 bags', 'add 2 bags to my order', 'i want to buy rice', 'nataka kununua mchele', 'i would like to order', 'place an order', 'i need rice', 'naomba mchele', 'let me buy', 'order rice', 'i want to order 2 bags', 'add to cart', 'ninataka kuagiza', 'buy now', 'i would like 3 bags of pishori', 'let me get 2 bags', 'nipe magunia matatu', 'i will take it', 'add it', 'nataka gunia mbili', 'naomba kununua', 'i will take 2', 'give me 5kg', 'nipe kilo kumi'],
  bulk: ['i want a bulk order', 'wholesale prices', 'bei ya jumla', 'i need 100kg', 'do you sell in bulk', 'i want to buy in bulk', 'large quantity discount', 'bulk discount', 'restaurant supply', 'i run a hotel and need rice', 'i need 200kg for my shop', 'magunia mengi'],
  delivery_info: ['how much is delivery', 'do you deliver to nakuru', 'delivery time', 'how long will delivery take', 'mnaleta mombasa', 'shipping cost', 'delivery fee to nairobi', 'how much to send to mombasa', 'cost to send to nairobi', 'do you send to kisumu', 'delivery charges to mombasa', 'gharama ya kuleta', 'do you deliver to my area'],
  payment_info: ['how do i pay', 'payment methods', 'do you accept mpesa', 'is there a till number', 'paybill number', 'njia za kulipa', 'can i pay on delivery', 'pay with mpesa', 'how to pay', 'do you take mpesa', 'what is your till number', 'tunalipa vipi'],
  order_status: ['where is my order', 'track my order', 'order status', 'has my order shipped', 'order yangu iko wapi', 'my order has not arrived', 'when will my order arrive', 'check my order', 'has my order been dispatched', 'oda yangu imefika wapi'],
  payment_check: ['i have paid', 'nimelipa', 'did my payment go through', 'payment status', 'i paid but no confirmation', 'check payment', 'mpesa deducted', 'i sent the money', 'nimetuma pesa', 'i already sent payment'],
  payment_resend: ['resend the stk', 'send the prompt again', 'i did not get the mpesa prompt', 'no prompt on my phone', 'retry payment', 'tuma tena', 'stk did not come', 'payment prompt failed'],
  store_info: ['what are your opening hours', 'where are you located', 'contact number', 'phone number for support', 'saa ngapi mnafunga', 'whatsapp number', 'business hours', 'number to call you', 'where is your shop', 'where is your office', 'when do you close', 'what time do you open', 'are you open today', 'mnafungua saa ngapi', 'mko wazi leo', 'are you open on sunday'],
  points: ['how do reward points work', 'my points', 'how many points do i have', 'zawadi pointi', 'redeem points', 'loyalty points'],
  promo: ['do you have a promo code', 'any discount', 'coupon code', 'punguzo', 'any offers today', 'discount code', 'flash sale'],
  complaint: ['i have a complaint', 'my rice was damaged', 'i want a refund', 'wrong item delivered', 'return the rice', 'tatizo na order yangu', 'i want my money back', 'the bag came torn', 'bad service', 'rice is spoiled'],
  human: ['talk to a person', 'i want to speak to an agent', 'i want to talk to a real person', 'speak to someone real', 'please call me back', 'customer care', 'nataka kuongea na mtu', 'connect me to support', 'human please'],
  cancel: ['cancel', 'start over', 'forget it', 'stop', 'sitaki tena', 'cancel my order', 'reset', 'ghairi', 'never mind'],
  show_cart: ['show my cart', 'what is in my basket', 'order summary', 'what have i ordered so far', 'view cart', 'total so far', 'kikapu changu'],
  change: ['change quantity', 'remove an item', 'change the rice', 'badilisha', 'edit my order', 'go back', 'rudi nyuma', 'i want to change my order'],
  compare: ['which is cheaper pishori or basmati', 'compare pishori and basmati', 'difference between pishori and brown rice', 'pishori vs basmati', 'which is better pishori or basmati', 'tofauti ya pishori na basmati', 'linganisha bei'],
  proceed: ['checkout', 'proceed to checkout', 'i am done', 'that is all', 'nimemaliza', 'continue to payment', 'finish the order', 'ready to pay', 'lets pay', 'that will be all']
};

export const LANG = {
  en: {
    ok: 'OK', yes: 'Yes', no: 'No',
  },
  sw: {}
};
