import { CATS, PAY_METHODS, UPI_APPS, DINING_APPS } from './constants.js';
import { applyCorrections } from './ocrCorrections.js';

// Known merchant → { category, subcategory } mappings
const MERCHANT_MAP = {
  // ── India: Food delivery ──────────────────────────────────────────────────
  swiggy:        { category: 'Food', subcategory: 'Takeaway' },
  zomato:        { category: 'Food', subcategory: 'Takeaway' },
  blinkit:       { category: 'Food', subcategory: 'Groceries' },
  zepto:         { category: 'Food', subcategory: 'Groceries' },
  dunzo:         { category: 'Food', subcategory: 'Groceries' },
  bigbasket:     { category: 'Food', subcategory: 'Groceries' },
  grofers:       { category: 'Food', subcategory: 'Groceries' },
  instamart:     { category: 'Food', subcategory: 'Groceries' },
  // ── India: Supermarkets ───────────────────────────────────────────────────
  dmart:         { category: 'Food', subcategory: 'Groceries' },
  spencers:      { category: 'Food', subcategory: 'Groceries' },
  // ── India: Fuel stations ──────────────────────────────────────────────────
  'indian oil':       { category: 'Transport', subcategory: 'Fuel' },
  'indianoil':        { category: 'Transport', subcategory: 'Fuel' },
  'iocl':             { category: 'Transport', subcategory: 'Fuel' },
  'hpcl':             { category: 'Transport', subcategory: 'Fuel' },
  'hp service':       { category: 'Transport', subcategory: 'Fuel' },
  'hp petrol':        { category: 'Transport', subcategory: 'Fuel' },
  'hindustan petroleum': { category: 'Transport', subcategory: 'Fuel' },
  'bpcl':             { category: 'Transport', subcategory: 'Fuel' },
  'bharat petroleum': { category: 'Transport', subcategory: 'Fuel' },
  'reliance petrol':  { category: 'Transport', subcategory: 'Fuel' },
  // ── India: Transport ──────────────────────────────────────────────────────
  ola:           { category: 'Transport', subcategory: 'Auto/Cab' },
  rapido:        { category: 'Transport', subcategory: 'Auto/Cab' },
  irctc:         { category: 'Transport', subcategory: 'Bus/Train' },
  makemytrip:    { category: 'Transport', subcategory: 'Flight' },
  indigo:        { category: 'Transport', subcategory: 'Flight' },
  spicejet:      { category: 'Transport', subcategory: 'Flight' },
  vistara:       { category: 'Transport', subcategory: 'Flight' },
  airindia:      { category: 'Transport', subcategory: 'Flight' },
  // ── India: Health ─────────────────────────────────────────────────────────
  apollo:        { category: 'Health', subcategory: 'Medicine' },
  medplus:       { category: 'Health', subcategory: 'Medicine' },
  netmeds:       { category: 'Health', subcategory: 'Medicine' },
  '1mg':         { category: 'Health', subcategory: 'Medicine' },
  pharmeasy:     { category: 'Health', subcategory: 'Medicine' },
  practo:        { category: 'Health', subcategory: 'Doctor' },
  // ── India: Shopping ───────────────────────────────────────────────────────
  flipkart:      { category: 'Shopping', subcategory: 'Electronics' },
  meesho:        { category: 'Shopping', subcategory: 'Clothes' },
  myntra:        { category: 'Shopping', subcategory: 'Clothes' },
  ajio:          { category: 'Shopping', subcategory: 'Clothes' },
  nykaa:         { category: 'Personal', subcategory: 'Skincare' },
  // ── India: Entertainment ──────────────────────────────────────────────────
  hotstar:       { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  bookmyshow:    { category: 'Entertainment', subcategory: 'Movies' },
  pvr:           { category: 'Entertainment', subcategory: 'Movies' },
  inox:          { category: 'Entertainment', subcategory: 'Movies' },
  // ── India: Utilities ──────────────────────────────────────────────────────
  airtel:        { category: 'Utilities', subcategory: 'Phone' },
  jio:           { category: 'Utilities', subcategory: 'Phone' },
  bsnl:          { category: 'Utilities', subcategory: 'Phone' },
  // ── India: Personal / Gym ─────────────────────────────────────────────────
  cultfit:       { category: 'Personal', subcategory: 'Gym' },
  'cult.fit':    { category: 'Personal', subcategory: 'Gym' },
  uclean:        { category: 'Personal', subcategory: 'Laundry' },
  // ── Australia: Supermarkets / Retail ─────────────────────────────────────
  woolworths:    { category: 'Food', subcategory: 'Groceries' },
  coles:         { category: 'Food', subcategory: 'Groceries' },
  aldi:          { category: 'Food', subcategory: 'Groceries' },
  iga:           { category: 'Food', subcategory: 'Groceries' },
  'harris farm': { category: 'Food', subcategory: 'Groceries' },
  'dan murphy':  { category: 'Food', subcategory: 'Beverages' },
  'bws':         { category: 'Food', subcategory: 'Beverages' },
  // ── Australia: Pharmacy / Health ─────────────────────────────────────────
  'chemist warehouse': { category: 'Health', subcategory: 'Medicine' },
  priceline:     { category: 'Health', subcategory: 'Medicine' },
  'terry white': { category: 'Health', subcategory: 'Medicine' },
  amcal:         { category: 'Health', subcategory: 'Medicine' },
  // ── Australia: Electronics / Home ────────────────────────────────────────
  'jb hi-fi':    { category: 'Shopping', subcategory: 'Electronics' },
  jbhifi:        { category: 'Shopping', subcategory: 'Electronics' },
  'harvey norman': { category: 'Shopping', subcategory: 'Electronics' },
  bunnings:      { category: 'Shopping', subcategory: 'Home' },
  kmart:         { category: 'Shopping', subcategory: 'Home' },
  target:        { category: 'Shopping', subcategory: 'Clothes' },
  bigw:          { category: 'Shopping', subcategory: 'Home' },
  'big w':       { category: 'Shopping', subcategory: 'Home' },
  myer:          { category: 'Shopping', subcategory: 'Clothes' },
  // ── Australia: Transport ──────────────────────────────────────────────────
  'opal':        { category: 'Transport', subcategory: 'Bus/Train' },
  'myki':        { category: 'Transport', subcategory: 'Bus/Train' },
  'go card':     { category: 'Transport', subcategory: 'Bus/Train' },
  qantas:        { category: 'Transport', subcategory: 'Flight' },
  'virgin australia': { category: 'Transport', subcategory: 'Flight' },
  jetstar:       { category: 'Transport', subcategory: 'Flight' },
  // ── Australia: Fuel ───────────────────────────────────────────────────────
  'bp australia': { category: 'Transport', subcategory: 'Fuel' },
  'ampol':        { category: 'Transport', subcategory: 'Fuel' },
  caltex:         { category: 'Transport', subcategory: 'Fuel' },
  '7-eleven':     { category: 'Transport', subcategory: 'Fuel' },
  'united petroleum': { category: 'Transport', subcategory: 'Fuel' },
  // ── Saudi Arabia: Supermarkets ────────────────────────────────────────────
  danube:        { category: 'Food', subcategory: 'Groceries' },
  panda:         { category: 'Food', subcategory: 'Groceries' },
  tamimi:        { category: 'Food', subcategory: 'Groceries' },
  'bin dawood':  { category: 'Food', subcategory: 'Groceries' },
  othaim:        { category: 'Food', subcategory: 'Groceries' },
  nesto:         { category: 'Food', subcategory: 'Groceries' },
  // ── Saudi Arabia: Electronics / Retail ───────────────────────────────────
  'extra':       { category: 'Shopping', subcategory: 'Electronics' },
  jarir:         { category: 'Shopping', subcategory: 'Electronics' },
  'virgin megastore': { category: 'Shopping', subcategory: 'Electronics' },
  // ── Saudi Arabia: Fuel ────────────────────────────────────────────────────
  aramco:        { category: 'Transport', subcategory: 'Fuel' },
  'sahar':       { category: 'Transport', subcategory: 'Fuel' },
  // ── Saudi Arabia: Transport ───────────────────────────────────────────────
  careem:        { category: 'Transport', subcategory: 'Auto/Cab' },
  'saudi airlines': { category: 'Transport', subcategory: 'Flight' },
  saudia:        { category: 'Transport', subcategory: 'Flight' },
  flynas:        { category: 'Transport', subcategory: 'Flight' },
  // ── International / Global ────────────────────────────────────────────────
  reliance:      { category: 'Food', subcategory: 'Groceries' },  // India + global
  lulu:          { category: 'Food', subcategory: 'Groceries' },  // India + Saudi + UAE
  carrefour:     { category: 'Food', subcategory: 'Groceries' },
  grab:          { category: 'Transport', subcategory: 'Auto/Cab' },
  uber:          { category: 'Transport', subcategory: 'Auto/Cab' },
  lyft:          { category: 'Transport', subcategory: 'Auto/Cab' },
  shell:         { category: 'Transport', subcategory: 'Fuel' },
  bp:            { category: 'Transport', subcategory: 'Fuel' },
  essar:         { category: 'Transport', subcategory: 'Fuel' },
  amazon:        { category: 'Shopping', subcategory: 'Electronics' },
  ikea:          { category: 'Shopping', subcategory: 'Home' },
  zara:          { category: 'Shopping', subcategory: 'Clothes' },
  'h&m':         { category: 'Shopping', subcategory: 'Clothes' },
  uniqlo:        { category: 'Shopping', subcategory: 'Clothes' },
  'marks & spencer': { category: 'Shopping', subcategory: 'Clothes' },
  netflix:       { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  'disney+':     { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  prime:         { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  spotify:       { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  starbucks:     { category: 'Food', subcategory: 'Beverages' },
  'cafe coffee': { category: 'Food', subcategory: 'Beverages' },
  ccd:           { category: 'Food', subcategory: 'Beverages' },
  'costa coffee':{ category: 'Food', subcategory: 'Beverages' },
  'tim hortons': { category: 'Food', subcategory: 'Beverages' },
  'gloria jeans':{ category: 'Food', subcategory: 'Beverages' },
  mcdonalds:     { category: 'Food', subcategory: 'Takeaway' },
  'mcdonald':    { category: 'Food', subcategory: 'Takeaway' },
  kfc:           { category: 'Food', subcategory: 'Takeaway' },
  subway:        { category: 'Food', subcategory: 'Takeaway' },
  dominos:       { category: 'Food', subcategory: 'Takeaway' },
  'pizza hut':   { category: 'Food', subcategory: 'Takeaway' },
  pizzahut:      { category: 'Food', subcategory: 'Takeaway' },
  'burger king': { category: 'Food', subcategory: 'Takeaway' },
  burgerking:    { category: 'Food', subcategory: 'Takeaway' },
  'hungry jacks':{ category: 'Food', subcategory: 'Takeaway' },  // Australia (Burger King)
  'nando':       { category: 'Food', subcategory: 'Takeaway' },
  'barbeque nation': { category: 'Food', subcategory: 'Restaurants' },
  'paradise':    { category: 'Food', subcategory: 'Restaurants' },
};

// Lines to skip when scanning for the business name
const SKIP_LINE_RE = /^(receipt|bill|invoice|tax\s*invoice|kot|order|cash\s*memo|cash\s*receipt|gst|gstin|fssai|table|cover|pax|phone|ph:|tel:|mob:|address|city|pincode|welcome|thank\s*you|wifi|password|subtotal|sub\s*total|total|amount|qty|item|s\.?no|sr\.?\s*no|date|time|operator|cashier|void|duplicate|copy|printed)/i;

// When a line contains a company suffix, try to extract the name before it.
// For hospitality names (TRIFECTA CATERING SERVICES PVT LTD) the actual brand
// follows on the next line — skip those entirely. For non-hospitality companies
// (RAJ WHEELERS LLP) the company name IS the merchant — extract the part before
// the suffix.
const COMPANY_SUFFIX_RE     = /^(.+?)\s*\b(pvt\.?\s*ltd\.?|private\s+limited|limited|llp|llc|inc\.?|corp\.?|co\.?\s*ltd\.?)\b/i;
const HOSPITALITY_SUFFIX_RE = /\b(catering|hospitality|restaurants?|hotels?|food\s*services?|enterprises|solutions)\b/i;

// Food keywords for fallback category detection when merchant is unknown
const FOOD_KW = [
  // Indian dishes & ingredients
  'biryani','rice','naan','roti','paratha','chapati','puri','bhatura',
  'chicken','mutton','lamb','fish','prawn','shrimp','crab','keema',
  'salmon','tuna','sea bass','lobster','squid','octopus',
  'steak','ribeye','tenderloin','sirloin','brisket','pork','bacon',
  'paneer','dal','curry','masala','tikka','kebab','kabab','tandoori',
  'dosa','idli','vada','uttapam','appam','puttu','pesarattu',
  'samosa','pakora','pakoda','bhajia','chaat','pav','bhaji',
  'thali','pulao','fried rice','noodles','hakka','chowmein',
  'manchurian','spring roll','momos','dumpling','dim sum','sushi','sashimi',
  'soup','salad','starter','appetizer','main course','dessert',
  'kheer','halwa','gulab','jalebi','rasgulla','ice cream','tiramisu','mousse',
  'sandwich','burger','pizza','pasta','wrap','roll','frank',
  'truffle','risotto','bruschetta','carpaccio',
  'coffee','cappuccino','latte','espresso','tea','chai','matcha',
  'juice','lassi','milkshake','smoothie','mocktail','buttermilk',
  'water','soda','soft drink','cola','pepsi','sprite',
  'beer','hoegaarden','heineken','wine','whisky','vodka','rum','gin','cocktail',
  // Receipt context words that imply restaurant
  'table no','table number','table-','cover','pax','kot','steward','waiter',
  'half plate','full plate','portion','serving','dine in','dine-in',
  // Generic cooking descriptors
  'grilled','fried','baked','roasted','steamed','tossed','stuffed','flamed','smoked',
  'veg ','non-veg','vegan','jain','butter','garlic','sauce','gravy',
];

// ── Currency detection ────────────────────────────────────────────────────────
// Returns the most likely currency code for this receipt based on symbols and context
export function detectCurrency(text) {
  const t = text.toLowerCase();
  // Saudi Riyal — SR, SAR, ر.س, ﷼ symbol
  if (/\b(sar|sr)\b|ر\.س|﷼/.test(t)) return 'SAR';
  // UAE Dirham
  if (/\b(aed)\b|د\.إ/.test(t)) return 'AED';
  // Australian dollar — AUD or A$ or Australian context keywords
  if (/\baud\b|(?<!\w)a\$/.test(t) || (/(?<!\w)\$/.test(t) && /woolworths|coles|bunnings|eftpos|payid|abn\b|gst\b/.test(t))) return 'AUD';
  // Indian Rupee — ₹, Rs, INR, or Indian tax terms
  if (/₹|rs\b|rs\.|inr|\bsgst\b|\bcgst\b/.test(t)) return 'INR';
  // Euro, GBP, JPY
  if (/€/.test(t)) return 'EUR';
  if (/£/.test(t)) return 'GBP';
  if (/¥/.test(t)) return 'JPY';
  // Generic $ — could be USD, AUD, SGD etc.; return USD as default
  if (/\$/.test(t)) return 'USD';
  return null;
}

// Currency symbol for display
const CURRENCY_SYMBOLS = {
  INR: '₹', AUD: 'A$', SAR: 'SR ', AED: 'د.إ ',
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', SGD: 'S$',
};
export function currencySymbol(code) { return CURRENCY_SYMBOLS[code] || (code ? code + ' ' : ''); }

// Payment method keyword detection — India + Australia + Saudi + international
const PAYMENT_KW_MAP = {
  // India — UPI
  'gpay': 'GPay', 'google pay': 'GPay',
  'phonepe': 'PhonePe', 'phone pe': 'PhonePe',
  'paytm': 'Paytm',
  'payzapp': 'PayZapp',
  'bhim': 'BHIM',
  'amazon pay': 'Amazon Pay',
  'whatsapp pay': 'WhatsApp Pay',
  'cred': 'Cred',
  'slice': 'Slice',
  // Australia
  'eftpos': 'EFTPOS',
  'payid': 'PayID',
  'afterpay': 'Afterpay',
  'zip pay': 'Zip Pay',
  'zippay': 'Zip Pay',
  'bpay': 'BPAY',
  // Saudi Arabia
  'mada': 'mada',
  'stc pay': 'STC Pay',
  'stcpay': 'STC Pay',
  // International
  'apple pay': 'Apple Pay',
  'samsung pay': 'Samsung Pay',
  'paypal': 'PayPal',
};

// ── Fuzzy merchant matching ───────────────────────────────────────────────────
// Levenshtein distance for catching OCR errors like "Sw1ggy" → "Swiggy"
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function fuzzyMerchantLookup(searchArea) {
  // Only try fuzzy on tokens of 4+ chars to avoid false matches on short words
  const tokens = searchArea.split(/\s+/).filter(t => t.length >= 4);
  let bestKey = null, bestDist = 3; // max edit distance = 2 (allows 1-2 OCR errors)
  for (const key of Object.keys(MERCHANT_MAP)) {
    const keyWords = key.split(/\s+/);
    for (const token of tokens) {
      for (const kw of keyWords) {
        if (kw.length < 4) continue;
        const dist = levenshtein(token, kw);
        if (dist < bestDist) { bestDist = dist; bestKey = key; }
      }
    }
  }
  return bestKey;
}

// ── Amount ───────────────────────────────────────────────────────────────────
function extractAmount(text) {
  const values = [];

  // Priority: look near "total" keywords — covers Indian, Australian, Saudi bill formats
  const totalPat = /(?:grand\s*total|bill\s*total|total\s*amount|amount\s*paid|net\s*amount|bill\s*amount|sale\s*amount|billed\s*amount|net\s*payable|net\s*total|bill\s*value|bill\s*amt|payable\s*amount|amount\s*payable|total\s*due|amount\s*due|total\s*payable|balance\s*due|payable|total)[^\d₹Rs¥€£$SR]{0,15}(?:₹|Rs\.?|INR|A\$|AUD|SR\s*|SAR|AED|¥|€|£|\$)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let m;
  while ((m = totalPat.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(v) && v > 0) values.push(v);
  }

  // Secondary: any currency symbol/code + amount
  // Covers ₹ Rs INR (India), $ A$ AUD (Australia), SR SAR ر.س (Saudi), €, £, ¥
  const symPat = /(?:₹|Rs\.?|INR|A\$|AUD|SR\s*|SAR|ر\.س|AED|¥|€|£|\$)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  while ((m = symPat.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(v) && v > 0) values.push(v);
  }

  // Fallback: standalone price-looking numbers
  if (!values.length) {
    const fallback = /\b(\d{2,6}(?:\.\d{1,2})?)\b/g;
    while ((m = fallback.exec(text)) !== null) {
      const v = parseFloat(m[1]);
      if (v >= 10 && v <= 999999) values.push(v);
    }
  }

  // Dedup before picking max — prevents phantom duplicates when same number matches two patterns
  const unique = [...new Set(values)];
  return unique.length ? Math.max(...unique) : null;
}

// ── Date ─────────────────────────────────────────────────────────────────────
function extractDate(text) {
  const pats = [
    { re: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/,  parse: m => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
    { re: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/,    parse: m => `20${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
    { re: /\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,  parse: m => `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` },
    { re: /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/i,
      parse: m => { const mo = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; return `${m[3]}-${mo[m[2].toLowerCase().slice(0,3)]}-${m[1].padStart(2,'0')}`; } },
    { re: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i,
      parse: m => { const mo = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; return `${m[3]}-${mo[m[1].toLowerCase().slice(0,3)]}-${m[2].padStart(2,'0')}`; } },
  ];
  for (const { re, parse } of pats) {
    const m = text.match(re);
    if (m) {
      const iso = parse(m);
      const d = new Date(iso + 'T12:00:00');
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2010 && d.getFullYear() <= 2035) return iso;
    }
  }
  return null;
}

// ── Merchant name ─────────────────────────────────────────────────────────────
const ADDR_RE = /\b(road|rd\b|street|st\b|lane|ln\b|avenue|ave\b|drive|dr\b|boulevard|blvd|nagar|colony|sector|floor|shop|near|opp|opposite|ph:|no\.|door|flat|apt|suite|level|nsw|vic|qld|wa\b|sa\b|riyadh|jeddah|dammam)\b/i;

function isNameCandidate(line) {
  if (line.length < 3) return false;
  if (SKIP_LINE_RE.test(line)) return false;
  if (/^\d/.test(line)) return false;
  if (/\b\d{10}\b/.test(line)) return false;          // phone number
  if (/@|www\.|\.com|\.in\b/.test(line)) return false; // email/URL
  if (ADDR_RE.test(line)) return false;                // address
  const letters = (line.match(/[a-zA-Z]/g) || []).length;
  const digits  = (line.match(/\d/g) || []).length;
  if (letters < 3) return false;
  if (digits > letters) return false;
  return true;
}

function extractMerchantName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const searchArea = lines.slice(0, 15).join(' ').toLowerCase();

  // 1. Known merchant map — exact match first, then fuzzy (catches OCR errors like "Sw1ggy")
  for (const key of Object.keys(MERCHANT_MAP)) {
    if (searchArea.includes(key)) {
      return key.replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  const fuzzyKey = fuzzyMerchantLookup(searchArea);
  if (fuzzyKey) return fuzzyKey.replace(/\b\w/g, c => c.toUpperCase());

  // 2. Priority pass: first all-caps line in top 5.
  //    If the line has a company suffix, extract the part before it.
  //    Exception: hospitality names (TRIFECTA CATERING SERVICES PVT LTD) —
  //    skip those entirely; the real brand (e.g. "TORII") follows on the next line.
  for (const line of lines.slice(0, 5)) {
    if (!isNameCandidate(line)) continue;
    let candidate = line;
    const suffixM = line.match(COMPANY_SUFFIX_RE);
    if (suffixM) {
      if (HOSPITALITY_SUFFIX_RE.test(suffixM[1])) continue; // brand is on next line
      candidate = suffixM[1].trim();                          // e.g. "RAJ WHEELERS"
    }
    if (!isNameCandidate(candidate)) continue;
    const letters = (candidate.match(/[a-zA-Z]/g) || []).length;
    const isAllCaps = candidate.replace(/[^a-zA-Z]/g, '') === candidate.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (isAllCaps && letters >= 3) return cleanName(candidate);
  }

  // 3. Scoring fallback for mixed-case names (e.g. "The Bombay Canteen")
  let best = null, bestScore = -1;
  for (const line of lines.slice(0, 8)) {
    if (!isNameCandidate(line)) continue;
    let candidate = line;
    const suffixM = line.match(COMPANY_SUFFIX_RE);
    if (suffixM) {
      if (HOSPITALITY_SUFFIX_RE.test(suffixM[1])) continue;
      candidate = suffixM[1].trim();
    }
    if (!isNameCandidate(candidate)) continue;
    const letters = (candidate.match(/[a-zA-Z]/g) || []).length;
    let score = letters + Math.max(0, 6 - lines.indexOf(line)) * 2;
    if (score > bestScore) { bestScore = score; best = candidate; }
  }

  return best ? cleanName(best) : null;
}

// Strip OCR noise characters from start/end of extracted name (e.g. 'TORII "-' → 'TORII')
function cleanName(name) {
  return name.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9\s&'.()\-]+$/g, '').trim();
}

// ── Category ─────────────────────────────────────────────────────────────────
function hasFoodContent(text) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of FOOD_KW) {
    if (lower.includes(kw)) {
      hits++;
      if (hits >= 2) return true; // 2+ food keywords = confident it's food
    }
  }
  return false;
}

function isRestaurantContext(text) {
  return /\b(table\s*(no|number|#)?|cover|pax|steward|waiter|server|dine|restaurant|cafe|dhaba|hotel\b|bistro|eatery|lounge)\b/i.test(text);
}

// Fuel receipt keywords — petrol pump bills always have at least 2 of these
const FUEL_KW = ['petrol','diesel','cng','lpg','fuel','rate per litre','rate per ltr','sale quantity','nozzle','bay number','pump','litre','liter'];

function hasFuelContent(text) {
  const lower = text.toLowerCase();
  return FUEL_KW.filter(kw => lower.includes(kw)).length >= 2;
}

// Vehicle service / maintenance receipt keywords
const VEHICLE_SERVICE_KW = [
  // Service bill structure
  'job card','job order','jobcard','jc no',
  'service centre','service center','service station','workshop','garage',
  'parts total','labour total','labor total','labour charges','labor charges',
  'spare parts','spares',
  // Components
  'engine oil','engine flush','oil filter','air filter','oil change',
  'brake pad','brake oil','brake fluid','brake shoe',
  'chain','clutch plate','spark plug','battery terminal',
  'tyre','tire',
  // Vehicle brands / models (common on service bills)
  'tvs','ntorq','apache','jupiter','raider',
  'hero motocorp','splendor','passion','glamour','xpulse',
  'bajaj','pulsar','avenger','dominar','chetak',
  'royal enfield','bullet','himalayan','meteor',
  'yamaha','fz','r15','mt15','fascino','ray zr',
  'honda activa','activa','dio','shine','unicorn','hornet',
  'suzuki access','access 125','burgman',
  'ola electric','ola s1','ather','revolt',
  'kawasaki','ktm',
  // Context
  'mechanic','two wheeler','two-wheeler','scooter','motorcycle','bike service',
  'free service','periodic service','general service','first service',
  'frame no','regn no','regnno','reg no','chassis no',
  'next due','nxtdue',
];

function hasVehicleServiceContent(text) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of VEHICLE_SERVICE_KW) {
    if (lower.includes(kw)) { hits++; if (hits >= 2) return true; }
  }
  return false;
}

function extractCategory(merchantName, rawText) {
  // Try known merchant map
  if (merchantName) {
    const lower = merchantName.toLowerCase();
    for (const key of Object.keys(MERCHANT_MAP)) {
      if (lower.includes(key)) return MERCHANT_MAP[key];
    }
  }

  // Fallback: detect vehicle service/maintenance
  if (rawText && hasVehicleServiceContent(rawText)) {
    return { category: 'Transport', subcategory: 'Vehicle Maintenance' };
  }

  // Fallback: detect fuel from receipt body (petrol pump bills)
  if (rawText && hasFuelContent(rawText)) {
    return { category: 'Transport', subcategory: 'Fuel' };
  }

  // Fallback: detect food items from receipt body
  if (rawText && hasFoodContent(rawText)) {
    const subcategory = isRestaurantContext(rawText) ? 'Restaurants' : 'Takeaway';
    return { category: 'Food', subcategory };
  }

  return { category: '', subcategory: '' };
}

// ── Payment method ────────────────────────────────────────────────────────────
function extractPaymentMethod(text) {
  const lower = text.toLowerCase();

  if (/\bcash\b/.test(lower)) return { paymentMethod: 'Cash', paymentDescription: '' };

  // Named digital wallets / tap-and-pay / UPI apps (India + Australia + Saudi + global)
  for (const [kw, appName] of Object.entries(PAYMENT_KW_MAP)) {
    if (lower.includes(kw)) {
      // EFTPOS and mada are card-based, not UPI
      if (['EFTPOS', 'mada'].includes(appName)) return { paymentMethod: 'Debit Card', paymentDescription: appName };
      if (['BPAY'].includes(appName))            return { paymentMethod: 'Net Banking', paymentDescription: appName };
      return { paymentMethod: 'UPI/QR', paymentDescription: appName };
    }
  }
  if (/\bupi\b/.test(lower)) return { paymentMethod: 'UPI/QR', paymentDescription: '' };

  if (/\b(visa|master|mastercard|rupay|amex|american\s*express|credit\s*card)\b/i.test(lower)) return { paymentMethod: 'Credit Card', paymentDescription: '' };
  if (/\bdebit\s*card\b/i.test(lower))                                  return { paymentMethod: 'Debit Card', paymentDescription: '' };
  // "MOP CARD" / "From CARD" / "CARD" on fuel receipts
  if (/\b(mop\s*card|from\s*card|paid\s*by\s*card|card\s*payment|tap\s*&?\s*go|contactless)\b/i.test(lower)) return { paymentMethod: 'Credit Card', paymentDescription: '' };
  if (/\b(net\s*banking|netbanking|neft|imps|rtgs)\b/i.test(lower))    return { paymentMethod: 'Net Banking', paymentDescription: '' };
  if (/\bwallet\b/i.test(lower))                                         return { paymentMethod: 'Wallet', paymentDescription: '' };

  return { paymentMethod: '', paymentDescription: '' };
}

// ── Dining app ────────────────────────────────────────────────────────────────
function extractDiningApp(text) {
  const lower = text.toLowerCase();
  for (const app of DINING_APPS) {
    if (app && lower.includes(app.toLowerCase())) return app;
  }
  return '';
}

// ── Tax extraction ────────────────────────────────────────────────────────────
// Currency-agnostic amount capture suffix — matches any currency symbol or none
const CUR = /(?:₹|Rs\.?|INR|A\$|AUD|SR\s*|SAR|AED|¥|€|£|\$)?/;
const AMT = /([\d,]+(?:\.\d{1,2})?)/;
function taxRe(keyword) {
  return new RegExp(`\\b${keyword}\\b[^:\\d₹Rs$A]*(?:\\d+\\.?\\d*\\s*%\\s*)?${CUR.source}\\s*${AMT.source}`, 'i');
}

const TAX_PATTERNS = [
  // India
  { key: 'sgst',          re: taxRe('SGST') },
  { key: 'cgst',          re: taxRe('CGST') },
  { key: 'igst',          re: taxRe('IGST') },
  { key: 'cess',          re: taxRe('(?:Cess|Surcharge)') },
  { key: 'serviceCharge', re: taxRe('Service\\s*Charge') },
  // India + international (VAT used in Saudi, UAE, EU)
  { key: 'vat',           re: taxRe('VAT') },
  // Australia + India generic GST
  { key: 'gst',           re: taxRe('GST') },
  // Saudi Arabic VAT label (ضريبة القيمة المضافة)
  { key: 'vat',           re: /ضريبة القيمة المضافة[^:\d]*(\d+(?:\.\d{1,2})?)/ },
];

function extractTaxes(text) {
  const breakdown = {};
  let total = 0;

  // Standard inline patterns — e.g. "SGST 9%: 36.23" or "SGST : 36.23"
  for (const { key, re } of TAX_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(v) && v > 0) { breakdown[key] = v; total += v; }
    }
  }

  // Column-table format — SGST/CGST are column headers; values are in rows.
  // The Sub Total summary row contains the accumulated totals.
  // e.g. "Sub Total 5.00 0.00 1102.54 99.23 99.23"
  if (total === 0 && /\bsgst\b/i.test(text) && /\bcgst\b/i.test(text)) {
    // Match Sub Total row: any number of leading numerics then two final captures (SGST, CGST)
    const subM = text.match(
      /(?:sub\s*total|subtotal)\s+(?:[\d,]+\.?\d*\s+){1,}([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*(?:\r?\n|$)/im
    );
    if (subM) {
      const sgst = parseFloat(subM[1].replace(/,/g, ''));
      const cgst = parseFloat(subM[2].replace(/,/g, ''));
      if (!isNaN(sgst) && sgst > 0) { breakdown.sgst = sgst; total += sgst; }
      if (!isNaN(cgst) && cgst > 0) { breakdown.cgst = cgst; total += cgst; }
    }
  }

  return total > 0
    ? { taxBreakdown: breakdown, taxAmount: parseFloat(total.toFixed(2)) }
    : { taxBreakdown: {}, taxAmount: 0 };
}

// ── Fuel data extraction ──────────────────────────────────────────────────────
// Normalise OCR space-as-decimal: "103 80" → "103.80", "19 36" → "19.36"
// Only treats a space as decimal when the fraction part is 1-2 digits (rate) or 1-3 digits (qty)
function normaliseDecimal(str, maxFracDigits = 3) {
  const re = new RegExp(`^(\\d+)\\s+(\\d{1,${maxFracDigits}})$`);
  return str.replace(re, '$1.$2').replace(',', '.');
}

function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }

function extractFuelData(text) {
  // Rate per litre: handles "103.80", "103 80", "103,80"
  const rateRe = /(?:rate\s*(?:per\s*)?(?:lit(?:re|er)?|ltr|l)|price\s*per\s*lit(?:re|er)?)[^\d]*(\d+[\s.,]\d+|\d+)/i;
  const rateM  = text.match(rateRe);
  let fuelRate = null;
  if (rateM) {
    const v = parseFloat(normaliseDecimal(rateM[1], 2));
    if (!isNaN(v) && v > 0 && v < 500) fuelRate = round2(v);
  }

  // Quantity: handles "19.401", "19 363", "369" (OCR dropped decimal → 3.69)
  // Also accepts plain integers; /100 correction applied when value > 100 and no separator
  const qtyRe = /(?:sale\s*quant(?:ity)?|qty|quantity|volume|litres?\s*filled?|liter(?:s)?)[^\d]*(\d+[\s.,]\d+|\d+)/i;
  const qtyM  = text.match(qtyRe);
  let fuelQuantity = null;
  if (qtyM) {
    const raw = qtyM[1];
    let v = parseFloat(normaliseDecimal(raw, 3));
    // Plain integer with no decimal separator: OCR likely dropped the decimal point
    // e.g. "369" → 3.690, "3690" → 36.900, "5000" → 50.000
    if (!isNaN(v) && v > 100 && !raw.match(/[\s.,]/)) v = round3(v / 100);
    if (!isNaN(v) && v > 0 && v < 200) fuelQuantity = round3(v);
  }

  // Fuel type: "Product Name Petrol" / "Product Diesel" / "MOP Petrol"
  const typeM = text.match(/(?:product\s*(?:name|type)?|fuel\s*type)[^\w]*(petrol|diesel|cng|lpg|premium|speed|power)/i);
  const fuelType = typeM ? typeM[1].charAt(0).toUpperCase() + typeM[1].slice(1).toLowerCase() : null;

  return { fuelRate, fuelQuantity, fuelType };
}

// ── Vehicle service data ──────────────────────────────────────────────────────
function extractVehicleServiceData(text) {
  // Current odometer KMs — "KMs 1145", "KM: 1145", "Odometer 12345"
  const kmM = text.match(/\b(?:kms?|odometer|odo)\s*[:\-]?\s*(\d{3,7})\b/i);
  const currentKm = kmM ? parseInt(kmM[1], 10) : null;

  // Next service due date — "NxtDueDt:10/09/2026", "Next Due Date: 10-09-2026"
  let nextServiceDate = null;
  const nxtDtM = text.match(/nxt\s*due\s*dt\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-](?:20)?\d{2})/i)
    || text.match(/next\s*(?:service\s*)?due\s*date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-](?:20)?\d{2})/i);
  if (nxtDtM) {
    const parts = nxtDtM[1].split(/[\/\-]/);
    if (parts.length === 3) {
      let [d, mo, y] = parts;
      if (y.length === 2) y = '20' + y;
      const iso = `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
      const dateObj = new Date(iso + 'T12:00:00');
      if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() >= 2024) nextServiceDate = iso;
    }
  }

  // Next service type — "NxtDue :2nd Free Service", "Next Due: 10000 KM"
  const nxtTypeM = text.match(/nxt\s*due\s*[:\-\s]+([a-zA-Z0-9 ]{3,50}?)(?=\s+nxt|\s*\n|$)/i)
    || text.match(/next\s*service\s*[:\-]?\s*([^\n\r]{3,50})/i);
  const nextServiceType = nxtTypeM ? nxtTypeM[1].trim() : null;

  // Vehicle model — "Model TVS Ntorq 150 TFT ABS OBDIIB"
  const modelM = text.match(/\bmodel\s+([A-Za-z0-9 ]{4,50})/i);
  let vehicleModel = null;
  if (modelM) {
    vehicleModel = modelM[1]
      .replace(/\b(tft|abs|obdi+|efi|bs[iv6]+|ubs|gps|iot|bt|cbs|arai|orn|esp)\b.*/i, '')
      .replace(/\s+/g, ' ').trim();
  }

  // Vehicle registration — Indian format MH02GU1566
  const regM = text.match(/reg(?:n)?\.?\s*no\.?\s*[:\-]?\s*([A-Z]{2}\s*\d{2}\s*[A-Z]{1,3}\s*\d{1,4})/i);
  const vehicleReg = regM ? regM[1].replace(/\s+/g, ' ').trim().toUpperCase() : null;

  // Job / service type — "JobType 1st Free Service"
  const jobM = text.match(/job\s*type\s*[:\-]?\s*(.{3,60}?)(?=\s+nxt\b|\s*\n|$)/i);
  const serviceType = jobM ? jobM[1].trim() : null;

  return { currentKm, nextServiceDate, nextServiceType, vehicleModel, vehicleReg, serviceType };
}

// ── Main export ───────────────────────────────────────────────────────────────
export function parseReceipt(rawText) {
  if (!rawText || !rawText.trim()) return null;

  const detectedCurrency            = detectCurrency(rawText);
  const merchantName                = extractMerchantName(rawText);
  const { category, subcategory }   = extractCategory(merchantName, rawText);
  const { paymentMethod, paymentDescription } = extractPaymentMethod(rawText);
  const amount                      = extractAmount(rawText);
  const date                        = extractDate(rawText);
  const diningApp                   = category === 'Food' ? extractDiningApp(rawText) : '';
  const { taxBreakdown, taxAmount } = extractTaxes(rawText);
  const { fuelRate, fuelType, fuelQuantity: fuelQtyRaw } = extractFuelData(rawText);
  // Math override: amount ÷ rate is the most reliable source for quantity on fuel receipts
  // Corrects cases where OCR drops the decimal entirely (e.g. reads "359" instead of "3.59")
  let fuelQuantity = fuelQtyRaw;
  if (fuelRate && fuelRate > 0 && amount > 0) {
    const mathQty = round3(amount / fuelRate);
    if (mathQty > 0 && mathQty < 200 && (!fuelQuantity || Math.abs(mathQty - fuelQuantity) > 0.3)) {
      fuelQuantity = mathQty;
    }
  }
  const isVehicleService            = category === 'Transport' && subcategory === 'Vehicle Maintenance';
  const vehicleData                 = isVehicleService ? extractVehicleServiceData(rawText) : {};

  // Confidence: true = high confidence, false = low/none (used by UI to flag uncertain fields)
  // Amount is high-confidence only when found near a "total" keyword, not just any ₹ symbol
  const amountHighConf = amount !== null && /(?:grand\s*total|bill\s*total|total\s*amount|amount\s*paid|net\s*(?:total|amount|payable)|bill\s*(?:value|amount|amt)|payable)/i.test(rawText);
  const confidence = {
    amount:        amountHighConf,
    date:          date !== null,
    description:   !!merchantName,
    category:      !!category,
    paymentMethod: !!paymentMethod,
    taxes:         taxAmount > 0,
    fuel:          !!fuelRate,
  };

  const raw = {
    amount:             amount !== null ? String(amount) : '',
    date:               date || '',
    description:        merchantName || '',
    detectedCurrency,
    category,
    subcategory,
    paymentMethod,
    paymentDescription,
    diningApp,
    taxAmount,
    taxBreakdown,
    fuelRate,
    fuelQuantity,
    fuelType,
    ...vehicleData,
    _rawText:           rawText,
    _confidence:        confidence,
  };

  // Apply any saved user corrections for this merchant/context
  return applyCorrections(raw, rawText);
}
