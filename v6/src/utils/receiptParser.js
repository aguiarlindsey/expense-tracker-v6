import { CATS, PAY_METHODS, UPI_APPS, DINING_APPS } from './constants.js';

// Known merchant → { category, subcategory } mappings
const MERCHANT_MAP = {
  // Food delivery
  swiggy:        { category: 'Food', subcategory: 'Takeaway' },
  zomato:        { category: 'Food', subcategory: 'Takeaway' },
  blinkit:       { category: 'Food', subcategory: 'Groceries' },
  zepto:         { category: 'Food', subcategory: 'Groceries' },
  dunzo:         { category: 'Food', subcategory: 'Groceries' },
  bigbasket:     { category: 'Food', subcategory: 'Groceries' },
  grofers:       { category: 'Food', subcategory: 'Groceries' },
  instamart:     { category: 'Food', subcategory: 'Groceries' },
  grab:          { category: 'Food', subcategory: 'Takeaway' },
  // Supermarkets / retail
  dmart:         { category: 'Food', subcategory: 'Groceries' },
  reliance:      { category: 'Food', subcategory: 'Groceries' },
  spencers:      { category: 'Food', subcategory: 'Groceries' },
  lulu:          { category: 'Food', subcategory: 'Groceries' },
  // Fuel
  'indian oil':  { category: 'Transport', subcategory: 'Fuel' },
  indianoil:     { category: 'Transport', subcategory: 'Fuel' },
  hpcl:          { category: 'Transport', subcategory: 'Fuel' },
  bpcl:          { category: 'Transport', subcategory: 'Fuel' },
  iocl:          { category: 'Transport', subcategory: 'Fuel' },
  // Transport
  ola:           { category: 'Transport', subcategory: 'Auto/Cab' },
  uber:          { category: 'Transport', subcategory: 'Auto/Cab' },
  rapido:        { category: 'Transport', subcategory: 'Auto/Cab' },
  irctc:         { category: 'Transport', subcategory: 'Bus/Train' },
  makemytrip:    { category: 'Transport', subcategory: 'Flight' },
  indigo:        { category: 'Transport', subcategory: 'Flight' },
  spicejet:      { category: 'Transport', subcategory: 'Flight' },
  vistara:       { category: 'Transport', subcategory: 'Flight' },
  airindia:      { category: 'Transport', subcategory: 'Flight' },
  // Health & pharma
  apollo:        { category: 'Health', subcategory: 'Medicine' },
  medplus:       { category: 'Health', subcategory: 'Medicine' },
  netmeds:       { category: 'Health', subcategory: 'Medicine' },
  '1mg':         { category: 'Health', subcategory: 'Medicine' },
  pharmeasy:     { category: 'Health', subcategory: 'Medicine' },
  practo:        { category: 'Health', subcategory: 'Doctor' },
  // Shopping
  amazon:        { category: 'Shopping', subcategory: 'Electronics' },
  flipkart:      { category: 'Shopping', subcategory: 'Electronics' },
  meesho:        { category: 'Shopping', subcategory: 'Clothes' },
  myntra:        { category: 'Shopping', subcategory: 'Clothes' },
  ajio:          { category: 'Shopping', subcategory: 'Clothes' },
  nykaa:         { category: 'Personal', subcategory: 'Skincare' },
  // Entertainment
  netflix:       { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  hotstar:       { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  'disney+':     { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  prime:         { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  spotify:       { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  bookmyshow:    { category: 'Entertainment', subcategory: 'Movies' },
  pvr:           { category: 'Entertainment', subcategory: 'Movies' },
  inox:          { category: 'Entertainment', subcategory: 'Movies' },
  // Utilities
  airtel:        { category: 'Utilities', subcategory: 'Phone' },
  jio:           { category: 'Utilities', subcategory: 'Phone' },
  bsnl:          { category: 'Utilities', subcategory: 'Phone' },
  // Dining chains
  starbucks:     { category: 'Food', subcategory: 'Beverages' },
  'cafe coffee': { category: 'Food', subcategory: 'Beverages' },
  ccd:           { category: 'Food', subcategory: 'Beverages' },
  'costa coffee':{ category: 'Food', subcategory: 'Beverages' },
  dominos:       { category: 'Food', subcategory: 'Takeaway' },
  'pizza hut':   { category: 'Food', subcategory: 'Takeaway' },
  pizzahut:      { category: 'Food', subcategory: 'Takeaway' },
  mcdonalds:     { category: 'Food', subcategory: 'Takeaway' },
  'mcdonald':    { category: 'Food', subcategory: 'Takeaway' },
  kfc:           { category: 'Food', subcategory: 'Takeaway' },
  subway:        { category: 'Food', subcategory: 'Takeaway' },
  'burger king': { category: 'Food', subcategory: 'Takeaway' },
  burgerking:    { category: 'Food', subcategory: 'Takeaway' },
  'barbeque nation': { category: 'Food', subcategory: 'Restaurants' },
  'paradise':    { category: 'Food', subcategory: 'Restaurants' },
  // Gym / personal
  cultfit:       { category: 'Personal', subcategory: 'Gym' },
  'cult.fit':    { category: 'Personal', subcategory: 'Gym' },
  // Laundry
  uclean:        { category: 'Personal', subcategory: 'Laundry' },
};

// Lines to skip when scanning for the business name
const SKIP_LINE_RE = /^(receipt|bill|invoice|tax\s*invoice|kot|order|cash\s*memo|cash\s*receipt|gst|gstin|fssai|table|cover|pax|phone|ph:|tel:|mob:|address|city|pincode|welcome|thank\s*you|wifi|password|subtotal|sub\s*total|total|amount|qty|item|s\.?no|sr\.?\s*no|date|time|operator|cashier|void|duplicate|copy|printed)/i;

// Food keywords for fallback category detection when merchant is unknown
const FOOD_KW = [
  // Indian dishes & ingredients
  'biryani','rice','naan','roti','paratha','chapati','puri','bhatura',
  'chicken','mutton','lamb','fish','prawn','shrimp','crab','keema',
  'paneer','dal','curry','masala','tikka','kebab','kabab','tandoori',
  'dosa','idli','vada','uttapam','appam','puttu','pesarattu',
  'samosa','pakora','pakoda','bhajia','chaat','pav','bhaji',
  'thali','pulao','biryani','fried rice','noodles','hakka','chowmein',
  'manchurian','spring roll','momos','dumpling','dim sum',
  'soup','salad','starter','appetizer','main course','dessert',
  'kheer','halwa','gulab','jalebi','rasgulla','ice cream',
  'sandwich','burger','pizza','pasta','wrap','roll','frank',
  'coffee','cappuccino','latte','espresso','tea','chai','matcha',
  'juice','lassi','milkshake','smoothie','mocktail','buttermilk',
  'water','soda','soft drink','cola','pepsi','sprite','beer','wine',
  'whisky','vodka','rum','gin','cocktail',
  // Receipt context words that imply restaurant
  'table no','table number','cover','pax','kot','steward','waiter',
  'half plate','full plate','portion','serving',
  // Generic cooking descriptors
  'grilled','fried','baked','roasted','steamed','tossed','stuffed',
  'veg ','non-veg','vegan','jain',
];

// UPI app keyword detection
const UPI_KEYWORD_MAP = {
  'gpay': 'GPay', 'google pay': 'GPay',
  'phonepe': 'PhonePe', 'phone pe': 'PhonePe',
  'paytm': 'Paytm',
  'payzapp': 'PayZapp',
  'bhim': 'BHIM',
  'amazon pay': 'Amazon Pay',
  'whatsapp pay': 'WhatsApp Pay',
  'cred': 'Cred',
  'slice': 'Slice',
};

// ── Amount ───────────────────────────────────────────────────────────────────
function extractAmount(text) {
  const values = [];

  // Priority: look near "total" keywords first
  const totalPat = /(?:grand\s*total|total\s*amount|amount\s*paid|net\s*amount|bill\s*amount|net\s*payable|payable|total)[^\d₹Rs]{0,15}(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let m;
  while ((m = totalPat.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(v) && v > 0) values.push(v);
  }

  // Secondary: any ₹ / Rs amount
  const symPat = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi;
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

  return values.length ? Math.max(...values) : null;
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
function extractMerchantName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const searchArea = lines.slice(0, 15).join(' ').toLowerCase();

  // 1. Check known merchants first (most reliable)
  for (const key of Object.keys(MERCHANT_MAP)) {
    if (searchArea.includes(key)) {
      return key.replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  // 2. Score first 8 lines and pick the best candidate for a business name
  let best = null, bestScore = -1;
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3) continue;
    if (SKIP_LINE_RE.test(line)) continue;

    const letters = (line.match(/[a-zA-Z]/g) || []).length;
    const digits  = (line.match(/\d/g) || []).length;
    if (letters < 3) continue;                        // too few letters
    if (digits > letters) continue;                   // more digits than letters
    if (/^\d/.test(line)) continue;                   // starts with a digit

    // Skip address-like lines
    if (/\b(road|rd\b|street|st\b|lane|ln\b|nagar|colony|sector|floor|shop|near|opp|opposite|ph:|no\.|door|flat|apt)\b/i.test(line)) continue;
    // Skip lines with phone numbers
    if (/\b\d{10}\b/.test(line)) continue;
    // Skip lines with email or URL patterns
    if (/@|www\.|\.com|\.in\b/.test(line)) continue;

    // Scoring: reward longer names, penalise mostly-digit lines
    let score = letters;
    // All-caps lines are very likely to be restaurant names (common on Indian receipts)
    if (line === line.toUpperCase() && letters > 4) score += 10;
    // Lines that appear early are more likely to be the name
    score += Math.max(0, 6 - lines.indexOf(line)) * 2;

    if (score > bestScore) { bestScore = score; best = line; }
  }

  return best;
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

function extractCategory(merchantName, rawText) {
  // Try known merchant map
  if (merchantName) {
    const lower = merchantName.toLowerCase();
    for (const key of Object.keys(MERCHANT_MAP)) {
      if (lower.includes(key)) return MERCHANT_MAP[key];
    }
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

  for (const [kw, appName] of Object.entries(UPI_KEYWORD_MAP)) {
    if (lower.includes(kw)) return { paymentMethod: 'UPI/QR', paymentDescription: appName };
  }
  if (/\bupi\b/.test(lower)) return { paymentMethod: 'UPI/QR', paymentDescription: '' };

  if (/\b(visa|master|mastercard|rupay|credit\s*card)\b/i.test(lower)) return { paymentMethod: 'Credit Card', paymentDescription: '' };
  if (/\bdebit\s*card\b/i.test(lower))                                  return { paymentMethod: 'Debit Card', paymentDescription: '' };
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

// ── Main export ───────────────────────────────────────────────────────────────
export function parseReceipt(rawText) {
  if (!rawText || !rawText.trim()) return null;

  const merchantName                = extractMerchantName(rawText);
  const { category, subcategory }   = extractCategory(merchantName, rawText);
  const { paymentMethod, paymentDescription } = extractPaymentMethod(rawText);
  const amount = extractAmount(rawText);
  const date   = extractDate(rawText);
  const diningApp = category === 'Food' ? extractDiningApp(rawText) : '';

  const confidence = {
    amount:        amount !== null,
    date:          date !== null,
    description:   !!merchantName,
    category:      !!category,
    paymentMethod: !!paymentMethod,
  };

  return {
    amount:             amount !== null ? String(amount) : '',
    date:               date || '',
    description:        merchantName || '',
    category,
    subcategory,
    paymentMethod,
    paymentDescription,
    diningApp,
    _rawText:           rawText,
    _confidence:        confidence,
  };
}
