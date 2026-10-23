/**
 * ====================================================================================
 * MWEA RICE HUB — CHAT LANGUAGE ENGINE (chatNlu.js)
 * ====================================================================================
 * 100% in-house. No AI service, no API key, no network. Pure functions that turn a
 * customer's message (English, Swahili or a mix) into:
 *   - an INTENT (what they want)           -> classify()
 *   - ENTITIES (kg, bags, county, phone...) -> extract*()
 *
 * It gets smarter without being retrained: classify() accepts extra phrases that the
 * assistant has LEARNED from real customers (approved or auto-promoted), see
 * chatAssistant.js. Nothing in here ever touches prices, stock or money.
 * ====================================================================================
 */

// ------------------------------------------------------------------ text helpers
const SLANG = {
  pls: 'please', plz: 'please', plss: 'please', wat: 'what', wht: 'what', hw: 'how', u: 'you', ur: 'your', r: 'are',
  abt: 'about', thx: 'thanks', tnx: 'thanks', hv: 'have', bt: 'but', nw: 'now', b4: 'before', mpesa: 'mpesa', 'm-pesa': 'mpesa',
  kilos: 'kg', kilo: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg', sacks: 'bags', sack: 'bag', gunia: 'bag', magunia: 'bags',
  didnt: 'did not', dont: 'do not', cant: 'can not', wont: 'will not', isnt: 'is not', doesnt: 'does not', havent: 'have not', hasnt: 'has not', wasnt: 'was not', ive: 'i have', im: 'i am', thats: 'that is', whats: 'what is', lets: 'let us', ill: 'i will',
  pcs: 'bags', packets: 'bags', packet: 'bag', oda: 'order', agizo: 'order', maagizo: 'orders', tafadhali: 'please'
};

const STOP = new Set(('what how where when who which why a an the is are was were be been am do does did to of for in on at by with and or but if so it its my me i we you your our us ' +
  'this that these those there here can could would should will shall may might please kindly just some any ' +
  'na ya wa la za kwa ni ndio ili kama au pia sana tu hii hiyo hizo huu huo yangu yako wetu wako').split(' '));

const GENERIC = new Set(['rice', 'mchele', 'bag', 'bags', 'kg', 'grain', 'grains', 'product', 'products', 'one', 'some', 'want', 'need',
  'buy', 'order', 'get', 'give', 'like', 'nataka', 'naomba', 'nipe', 'please', 'wanna', 'of', 'ya', 'wa', 'much', 'many', 'price', 'bei']);

export const stripAccents = (s) => String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export function normalize(text) {
  const t = stripAccents(text).toLowerCase().replace(/['’`]/g, '')
    .replace(/(\d),(\d{3})/g, '$1$2')              // 1,200 -> 1200
    .replace(/(\d)\s*(kgs?|kilos?|kilograms?)\b/g, '$1 kg ')
    .replace(/[^a-z0-9.#:\s-]/g, ' ');
  return t.split(/\s+/).map((w) => w.replace(/^[.\-:]+|[.\-:]+$/g, '')).filter(Boolean)
    .map((w) => (SLANG[w] !== undefined ? SLANG[w] : w)).join(' ');
}
export const tokens = (norm) => String(norm || '').split(' ').filter(Boolean);
export const contentTokens = (norm) => tokens(norm).filter((w) => !STOP.has(w) && !GENERIC.has(w) && !/^\d+(\.\d+)?$/.test(w) && w.length > 1);

function lev(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** 1 = same word, ~0.9 = same stem (deliver/delivery), ~0.8 = typo, 0 = different. */
export function wordSim(a, b) {
  if (a === b) return 1;
  const s = Math.min(a.length, b.length);
  if (s < 3) return 0;
  if (s >= 5 && (a.startsWith(b) || b.startsWith(a))) return 0.9;
  if (/\d/.test(a) || /\d/.test(b)) return 0;
  const max = s >= 8 ? 2 : s >= 4 ? 1 : 0;
  if (!max) return 0;
  return lev(a, b, max) <= max ? 0.8 : 0;
}

const weight = (w) => (STOP.has(w) ? 0.2 : GENERIC.has(w) ? 0.6 : 1);

/** How well does a message cover a known phrase? 0..1 */
export function phraseScore(msgToks, phraseToks) {
  if (!msgToks.length || !phraseToks.length) return 0;
  let covered = 0, total = 0;
  const usedMsg = new Set();
  for (const p of phraseToks) {
    const wp = weight(p); total += wp;
    let best = 0, bi = -1;
    msgToks.forEach((m, i) => { const s = wordSim(m, p); if (s > best) { best = s; bi = i; } });
    if (best > 0) { covered += wp * best; usedMsg.add(bi); }
  }
  const coverage = covered / total;
  // a phrase that has meaningful words must match at least one of them, filler words alone prove nothing
  const meaningful = phraseToks.filter((p) => weight(p) >= 0.6);
  if (meaningful.length && !meaningful.some((p) => msgToks.some((m) => wordSim(m, p) >= 0.8))) return Math.min(0.3, coverage * 0.5);
  let mTot = 0, mHit = 0;
  msgToks.forEach((m, i) => { const w = weight(m); mTot += w; if (usedMsg.has(i)) mHit += w; });
  const precision = mTot ? mHit / mTot : 0;
  return coverage * 0.75 + precision * 0.25;
}

// ------------------------------------------------------------------ intents
// kind: 'info' = harmless, may be auto-learned.  'txn' = touches an order/payment: learned phrases
// for these ALWAYS wait for an admin to approve.  'ctrl' = conversation control.
export const INTENTS = {
  greet: { kind: 'ctrl', phrases: ['hi', 'hello', 'hey', 'hey there', 'good morning', 'good afternoon', 'good evening', 'habari', 'mambo', 'niaje', 'sasa', 'hujambo', 'jambo', 'salaam', 'habari yako'] },
  thanks: { kind: 'ctrl', phrases: ['thanks', 'thank you', 'thank you very much', 'asante', 'asante sana', 'shukran', 'much appreciated', 'cheers'] },
  bye: { kind: 'ctrl', phrases: ['bye', 'goodbye', 'see you', 'see you later', 'kwaheri', 'tutaonana', 'talk later'] },
  help: { kind: 'info', phrases: ['help', 'what can you do', 'how does this work', 'how do i order', 'how to buy', 'how do i buy rice', 'how to order', 'msaada', 'nisaidie', 'unafanya nini', 'jinsi ya kuagiza', 'what do you do'] },
  identity: { kind: 'info', phrases: ['are you a bot', 'are you human', 'are you a robot', 'who are you', 'what is your name', 'wewe ni nani', 'are you real', 'am i talking to a person'] },
  list_products: { kind: 'info', phrases: ['what rice do you sell', 'what rice do you have', 'show me rice', 'show me your rice', 'list products', 'product list', 'catalog', 'catalogue', 'do you have rice', 'mchele gani mnauza', 'mna mchele gani', 'aina za mchele', 'available rice', 'your products', 'what do you sell', 'types of rice', 'which rice varieties', 'menu', 'mnauza nini'] },
  price: { kind: 'info', phrases: ['how much', 'price of', 'cost of', 'how much is', 'how much does it cost', 'what is the price', 'bei ya', 'bei gani', 'ni bei gani', 'bei ni ngapi', 'gharama', 'price per kg', 'ni shilingapi', 'how much for'] },
  stock: { kind: 'info', phrases: ['in stock', 'is it available', 'do you have', 'stock left', 'out of stock', 'mna', 'iko', 'is it in stock', 'bado mnayo', 'available now'] },
  recommend: { kind: 'info', phrases: ['which rice is best', 'recommend', 'recommend a rice', 'suggest rice', 'best rice for pilau', 'best rice for biryani', 'cheapest rice', 'ipi ni nzuri', 'nishauri', 'what should i buy', 'good for pilau', 'good for biryani', 'for my family', 'best rice', 'which one is better', 'which rice should i buy', 'most popular', 'best seller', 'rice for everyday'] },
  buy: { kind: 'txn', phrases: ['i want', 'nataka', 'naomba', 'nipe', 'i want to buy', 'i want rice', 'i need rice', 'i want to order', 'place an order', 'buy rice', 'nataka kununua', 'nataka mchele', 'naomba mchele', 'nipe mchele', 'ninunue', 'i would like to buy', 'can i get', 'give me rice', 'get me rice', 'purchase', 'make an order', 'start an order', 'nataka kuagiza', 'order rice', 'i want to buy rice', 'buy now', 'add to cart', 'ongeza'] },
  delivery: { kind: 'info', phrases: ['delivery', 'do you deliver', 'deliver to', 'shipping', 'how long does delivery take', 'delivery fee', 'delivery cost', 'delivery time', 'usafirishaji', 'mnaleta', 'mnafikisha', 'mnasafirisha', 'do you deliver to', 'transport cost', 'delivery charges'] },
  bulk: { kind: 'info', phrases: ['bulk', 'wholesale', 'large order', 'many bags', 'jumla', 'kwa wingi', 'bulk order', 'bulk discount', 'bulk price', 'bulk prices', 'discount for bulk', 'buying in bulk', 'big quantity', 'hotel supply', 'supply my shop'] },
  order_status: { kind: 'txn', phrases: ['where is my order', 'track order', 'track my order', 'order status', 'my orders', 'my order', 'agizo langu', 'oda yangu', 'has my order been delivered', 'status of my order', 'when will my order arrive', 'order history', 'past orders', 'my purchases', 'orders i made'] },
  payment_info: { kind: 'info', phrases: ['how do i pay', 'payment methods', 'mpesa', 'till number', 'paybill', 'pay by mpesa', 'jinsi ya kulipa', 'malipo', 'lipa na mpesa', 'do you accept', 'ways to pay', 'can i pay on delivery', 'pay on delivery', 'payment options', 'cash on delivery'] },
  paid: { kind: 'txn', phrases: ['i have paid', 'i paid', 'payment done', 'nimelipa', 'nimetuma pesa', 'i sent the money', 'paid already', 'i have sent the money', 'done paying', 'payment complete', 'nimemaliza kulipa', 'i entered my pin', 'check my payment'] },
  retry_stk: { kind: 'txn', phrases: ['resend prompt', 'send again', 'no prompt', 'did not get prompt', 'stk not received', 'prompt not showing', 'resend stk', 'sijapata', 'tuma tena', 'i did not receive the prompt', 'nothing on my phone', 'try again stk', 'didnt get the prompt', 'didnt receive the prompt', 'no stk prompt', 'where is the prompt', 'prompt not received', 'stk push not coming', 'no mpesa prompt', 'did not get the mpesa prompt', 'resend the mpesa prompt', 'prompt expired'] },
  store_info: { kind: 'info', phrases: ['opening hours', 'working hours', 'business hours', 'when are you open', 'contact', 'contacts', 'phone number', 'whatsapp', 'where are you', 'address', 'customer care number', 'support number', 'saa za kufanya kazi', 'mko wapi', 'namba ya simu', 'are you open', 'open today', 'email address', 'where are you located'] },
  rewards: { kind: 'info', phrases: ['reward points', 'my points', 'loyalty', 'points balance', 'pointi', 'zawadi', 'how do i earn points', 'redeem points', 'loyalty points'] },
  promo: { kind: 'txn', phrases: ['promo code', 'coupon', 'voucher', 'discount code', 'i have a code', 'msimbo wa punguzo', 'kuponi', 'apply code', 'promo', 'offer code', 'any discount', 'any offers', 'discounts'] },
  human: { kind: 'ctrl', phrases: ['talk to a human', 'real person', 'agent', 'speak to someone', 'call me', 'representative', 'manager', 'talk to customer care', 'nataka kuongea na mtu', 'mhudumu', 'live agent', 'human please', 'speak to an agent', 'customer service', 'someone to help me'] },
  complaint: { kind: 'ctrl', phrases: ['refund', 'damaged', 'wrong item', 'bad rice', 'not satisfied', 'complaint', 'i want to complain', 'sijaridhika', 'mchele mbovu', 'wrong rice delivered', 'missing items', 'order never arrived', 'my money', 'overcharged', 'stones in rice', 'poor quality'] },
  cart_show: { kind: 'txn', phrases: ['my cart', 'show cart', 'what is in my cart', 'view cart', 'kikapu changu', 'basket', 'my basket', 'show my order', 'order summary', 'what have i ordered', 'cart'] },
  cart_clear: { kind: 'txn', phrases: ['clear cart', 'empty cart', 'remove everything', 'futa kikapu', 'start over', 'anza upya', 'clear my order', 'delete everything', 'reset', 'begin again', 'clear my cart', 'empty my cart', 'remove all', 'delete my cart', 'remove everything from cart'] },
  checkout: { kind: 'txn', phrases: ['checkout', 'check out', 'proceed', 'continue', 'go ahead', 'place order', 'that is all', 'thats all', 'nothing else', 'done', 'finish', 'lipa sasa', 'endelea', 'malizia', 'nimemaliza', 'proceed to payment', 'proceed to checkout', 'i am done', 'pay now', 'let us pay', 'ready to pay', 'ready to checkout'] },
  remove_item: { kind: 'txn', phrases: ['remove', 'delete', 'take out', 'ondoa', 'toa', 'remove item', 'drop', 'remove the', 'i do not want the'] },
  repeat_order: { kind: 'txn', phrases: ['same as last time', 'repeat my last order', 'order again', 'reorder', 're order', 'same order', 'kama mara ya mwisho', 'rudia oda', 'repeat last order', 'my usual', 'same as before', 'buy again'] },
  signin: { kind: 'info', phrases: ['how do i sign in', 'login', 'log in', 'sign in', 'sign up', 'create account', 'register', 'jisajili', 'ingia', 'how to register', 'i cannot log in', 'forgot password', 'reset password'] },
  change_qty: { kind: 'txn', phrases: ['make it', 'change quantity', 'change it to', 'update quantity', 'badilisha idadi', 'instead make it', 'change to'] }
};

const YES = new Set(['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'k', 'correct', 'confirm', 'confirmed', 'sawa', 'ndio', 'ndiyo', 'naam', 'poa', 'fine', 'alright', 'right', 'proceed', 'agreed', 'definitely', 'absolutely', 'y', 'yess', 'yea']);
const YES_PHRASES = ['looks good', 'go ahead', 'that is right', 'thats right', 'that is correct', 'thats correct', 'sounds good', 'do it', 'yes please', 'ok proceed', 'ndio sawa', 'sawa kabisa', 'send it', 'place it', 'confirm order', 'yes confirm'];
const NO = new Set(['no', 'nope', 'nah', 'hapana', 'la', 'siyo', 'not', 'n', 'noo']);
const NO_PHRASES = ['not now', 'no thanks', 'no thank you', 'not yet', 'sio sasa', 'hapana asante', 'do not', 'dont'];
const CANCEL = new Set(['cancel', 'stop', 'exit', 'quit', 'acha', 'sitaki', 'ghairi', 'abort']);
const CANCEL_PHRASES = ['never mind', 'nevermind', 'forget it', 'i changed my mind', 'cancel order', 'cancel this', 'stop this', 'nimeacha', 'achana nayo'];

export function yesNo(norm) {
  const t = tokens(norm);
  if (!t.length || t.length > 5) {
    return YES_PHRASES.some((p) => norm.includes(p)) ? 'yes' : null;
  }
  if (YES_PHRASES.some((p) => norm.includes(p))) return 'yes';
  if (NO_PHRASES.some((p) => norm.includes(p))) return 'no';
  const hasYes = t.some((w) => YES.has(w)); const hasNo = t.some((w) => NO.has(w));
  if (hasYes && !hasNo) return 'yes';
  if (hasNo && !hasYes) return 'no';
  return null;
}
export function isCancel(norm) {
  const t = tokens(norm);
  if (CANCEL_PHRASES.some((p) => norm.includes(p))) return true;
  return t.length <= 3 && t.some((w) => CANCEL.has(w));
}
export const isBack = (norm) => /^(back|go back|previous|rudi nyuma|rudi|undo|change that|edit)$/.test(norm.trim());

// ------------------------------------------------------------------ classifier
/**
 * extras = { phrases: [{ text, intent, weight? }], faqs: [{ id, triggers: [..] }] }  (learned at runtime)
 * returns { intent, score, margin, runnerUp, source: 'seed'|'learned'|'faq', faqId? }
 */
export function classify(rawText, extras = {}) {
  const norm = normalize(rawText);
  const mt = tokens(norm);
  if (!mt.length) return { intent: 'unknown', score: 0, margin: 0, norm };
  const board = [];
  const consider = (intent, phrase, source, bonus = 0, faqId) => {
    const pt = tokens(normalize(phrase));
    if (!pt.length) return;
    let s = phraseScore(mt, pt);
    // exact phrase inside the message beats a loose overlap
    if (s > 0.5 && ` ${norm} `.includes(` ${pt.join(' ')} `)) s += 0.12;
    if (s > 0.5) s += 0.01 * pt.length;   // on a tie the more specific (longer) phrase wins
    // one-word phrases are easy to hit by accident: only trust them if the message is short or it is the first word
    if (pt.length === 1 && mt.length > 4 && mt[0] !== pt[0]) s *= 0.8;
    board.push({ intent, score: s + bonus, source, faqId });
  };
  for (const [intent, def] of Object.entries(INTENTS)) for (const p of def.phrases) consider(intent, p, 'seed');
  for (const lp of (extras.phrases || [])) consider(lp.intent, lp.text, 'learned', 0.04);
  for (const f of (extras.faqs || [])) for (const tr of (f.triggers || [])) consider(`faq:${f.id}`, tr, 'faq', 0.04, f.id);
  const best = new Map();
  for (const b of board) { const cur = best.get(b.intent); if (!cur || b.score > cur.score) best.set(b.intent, b); }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score);
  const top = ranked[0] || { intent: 'unknown', score: 0 };
  const second = ranked[1] || { intent: null, score: 0 };
  return { intent: top.intent, score: Math.min(1, top.score), margin: top.score - second.score, runnerUp: second.intent, source: top.source, faqId: top.faqId, norm };
}

/** accept / ask / reject */
export function verdict(c) {
  if (c.score >= 0.62 && c.margin >= 0.04) return 'accept';
  if (c.score >= 0.62) return 'accept';           // a tie between two close intents is still better than "I did not get that"
  if (c.score >= 0.42) return 'ask';
  return 'reject';
}

// ------------------------------------------------------------------ entities
const NUMWORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100,
  moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8, tisa: 9, kumi: 10, ishirini: 20, thelathini: 30, hamsini: 50, mia: 100, a: 1, an: 1 };

const numFrom = (w) => (/^\d+(\.\d+)?$/.test(w) ? Number(w) : NUMWORDS[w]);

/** { bags, kg, sizeKg } : "2 bags of 5kg" -> {bags:2,sizeKg:5}; "50 kg" -> {kg:50}; "3" (bare) -> {bare:3} */
export function extractQuantity(norm) {
  const t = tokens(norm);
  const out = {};
  for (let i = 0; i < t.length; i += 1) {
    const n = numFrom(t[i]);
    if (n === undefined || !(n > 0)) continue;
    const next = t[i + 1];
    const prevW = t[i - 1];
    if ((prevW === 'bags' || prevW === 'bag') && out.bags === undefined && n === Math.round(n)) { out.bags = n; continue; }   // "magunia 2" / "bags 2"
    if (t[i] === 'a' || t[i] === 'an') { if (next === 'bag' || next === 'bags') out.bags = out.bags || 1; continue; }
    if (next === 'kg') {
      const prevPrev = `${t[i - 2] || ''} ${t[i - 1] || ''}`;
      const afterKg = `${t[i + 2] || ''} ${t[i + 3] || ''}`;
      if (/\bof\b/.test(prevPrev) || /^(bag|bags|pack|sack)/.test(afterKg.trim()) && out.bags !== undefined) out.sizeKg = n; else if (out.kg === undefined) out.kg = n;
    } else if (next === 'bag' || next === 'bags') { if (out.bags === undefined) out.bags = Math.round(n); }
    else if (next === 'x' && (t[i + 2] === 'kg' || /^\d/.test(t[i + 2] || ''))) { /* "2 x 5kg" handled below */ }
  }
  const mult = norm.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*kg/);
  if (mult) { out.bags = Number(mult[1]); out.sizeKg = Number(mult[2]); delete out.kg; }
  // "bags of 5 kg" written as: 2 bags 5 kg
  if (out.bags !== undefined && out.kg !== undefined && out.sizeKg === undefined) { out.sizeKg = out.kg; delete out.kg; }
  const bare = t.length <= 3 ? t.map(numFrom).find((n) => n !== undefined && n > 0 && t.length && !['a', 'an'].includes(t[t.indexOf(String(n))])) : undefined;
  if (out.bags === undefined && out.kg === undefined && bare !== undefined && t.every((w) => numFrom(w) !== undefined || STOP.has(w) || GENERIC.has(w) || w === 'only' || w === 'make' || w === 'it')) out.bare = bare;
  return out;
}

/** Best match of free text to a list of place names. Returns { name, score } or null. */
export function fuzzyPlace(rawText, candidates, minScore = 0.82) {
  const clean = (v) => stripAccents(v).toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '');
  const words = stripAccents(rawText).toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean).filter((w) => !STOP.has(w) || w.length > 3);
  let best = null;
  for (let size = 3; size >= 1; size -= 1) {
    for (let i = 0; i + size <= words.length; i += 1) {
      const gram = clean(words.slice(i, i + size).join(''));
      if (gram.length < 3) continue;
      for (const c of candidates) {
        const cc = clean(c);
        if (!cc) continue;
        let s = 0;
        if (gram === cc) s = 1;
        else if (gram.length >= 5 && lev(gram, cc, 2) <= (cc.length >= 8 ? 2 : 1)) s = 0.86 - lev(gram, cc, 2) * 0.02;
        if (s > 0 && (!best || s > best.score || (s === best.score && cc.length > clean(best.name).length))) best = { name: c, score: s, size };
      }
    }
    if (best && best.score >= 0.99) break;
  }
  return best && best.score >= minScore ? best : null;
}

export function extractPhone(rawText, normalizePhone) {
  const m = String(rawText || '').match(/(\+?254[\s-]?[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[\s-]?[17]\d{2}[\s-]?\d{3}[\s-]?\d{3})/);
  if (!m) return null;
  return normalizePhone(m[1].replace(/[\s-]/g, ''));
}

export function extractMpesaCode(rawText, cleanCode, codeRe) {
  const words = String(rawText || '').toUpperCase().split(/\s+/);
  for (const w of words) {
    const c = cleanCode(w);
    if (codeRe.test(c) && /\d/.test(c) && /[A-Z]/.test(c)) return c;
  }
  return null;
}

export function extractPromo(rawText) {
  const m = String(rawText || '').match(/(?:promo|code|coupon|voucher|kuponi)[\s:#-]*(?:code[\s:#-]*)?([A-Za-z0-9_-]{3,24})/i);
  if (m && !['code', 'promo', 'please', 'is', 'for', 'the'].includes(m[1].toLowerCase())) return m[1].toUpperCase();
  const solo = String(rawText || '').trim();
  if (/^[A-Za-z0-9_-]{4,24}$/.test(solo) && /\d|[A-Z]{4,}/.test(solo) && !/^(yes|okay|sawa|hello|thanks|cancel)$/i.test(solo)) return solo.toUpperCase();
  return null;
}

export function extractOrderId(norm) {
  const m = norm.match(/(?:order|oda|agizo|#)\s*(?:no|number|namba)?\s*#?(\d{1,9})/) || norm.match(/#(\d{1,9})/);
  return m ? Number(m[1]) : null;
}

/**
 * Product matching. products = [{ id, name, variety, grade, description, weightKg, aliases:[] }]
 * Returns candidates sorted best first: [{ id, score }]
 */
export function matchProducts(norm, products, aliasMap = {}) {
  const q = contentTokens(norm);
  const wantKg = (extractQuantity(norm).kg || extractQuantity(norm).sizeKg) || null;
  if (!q.length) return [];
  const out = [];
  for (const p of products) {
    const nameToks = contentTokens(normalize(`${p.name || ''} ${p.variety || ''}`));
    const gradeToks = contentTokens(normalize(`${p.grade || ''} ${p.description || ''}`));
    const aliasToks = (aliasMap[p.id] || []).flatMap((a) => contentTokens(normalize(a)));
    let hit = 0, weightSum = 0, nameHit = 0;
    for (const w of q) {
      weightSum += 1;
      let best = 0, inName = false;
      for (const n of nameToks) { const s = wordSim(w, n); if (s > best) { best = s; inName = true; } }
      for (const a of aliasToks) { const s = wordSim(w, a); if (s > best) { best = s; inName = true; } }
      for (const g of gradeToks) { const s = wordSim(w, g) * 0.6; if (s > best) { best = s; inName = false; } }
      hit += best; if (inName && best > 0) nameHit += 1;
    }
    if (!nameHit) continue;
    let score = hit / weightSum;
    if (wantKg && Number(p.weightKg) === wantKg) score += 0.08;
    out.push({ id: p.id, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ------------------------------------------------------------------ language + privacy
const SW_WORDS = new Set(['nataka', 'naomba', 'nipe', 'mchele', 'bei', 'habari', 'asante', 'sawa', 'ndio', 'hapana', 'kwa', 'ya', 'gani', 'ngapi', 'pesa', 'lipa', 'agizo', 'oda', 'mnaleta', 'mna', 'kuagiza', 'kununua', 'tafadhali', 'jambo', 'mambo', 'niaje', 'poa', 'sijapata', 'nimelipa', 'kikapu', 'gunia', 'magunia', 'wapi', 'saa', 'nyumbani', 'tuma', 'tena', 'bado', 'nina', 'yangu', 'kuongea', 'mtu', 'sasa', 'leo', 'kesho', 'siku', 'karibu', 'pole']);
export function detectLang(norm, previous = 'en') {
  const t = tokens(norm);
  if (!t.length) return previous;
  const sw = t.filter((w) => SW_WORDS.has(w)).length;
  if (sw >= 2 || (sw === 1 && t.length <= 3)) return 'sw';
  if (sw === 0 && t.length >= 3) return 'en';
  return previous;
}

/** Remove anything that looks like a phone number, M-Pesa code, e-mail or long number before a message is stored for learning. */
export function redact(text) {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(\+?254|0)[\s-]?[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}/g, '[phone]')
    .replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10}\b/g, '[code]')
    .replace(/\d{6,}/g, '[number]')
    .slice(0, 200);
}

/** Stable key so "pishori price??" and "Price of pishori" count as the same unanswered question. */
export function questionKey(raw) {
  const t = contentTokens(normalize(raw)).sort();
  return t.slice(0, 8).join(' ') || normalize(raw).slice(0, 60);
}
