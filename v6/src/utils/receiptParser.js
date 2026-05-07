import { CATS, PAY_METHODS, UPI_APPS, DINING_APPS } from './constants.js';

// Known merchant → { category, subcategory } mappings
const MERCHANT_MAP = {
  // Food delivery
  swiggy:      { category: 'Food', subcategory: 'Takeaway' },
  zomato:      { category: 'Food', subcategory: 'Takeaway' },
  blinkit:     { category: 'Food', subcategory: 'Groceries' },
  zepto:       { category: 'Food', subcategory: 'Groceries' },
  dunzo:       { category: 'Food', subcategory: 'Groceries' },
  bigbasket:   { category: 'Food', subcategory: 'Groceries' },
  grofers:     { category: 'Food', subcategory: 'Groceries' },
  instamart:   { category: 'Food', subcategory: 'Groceries' },
  grab:        { category: 'Food', subcategory: 'Takeaway' },
  // Supermarkets / retail
  dmart:       { category: 'Food', subcategory: 'Groceries' },
  reliance:    { category: 'Food', subcategory: 'Groceries' },
  more:        { category: 'Food', subcategory: 'Groceries' },
  lulu:        { category: 'Food', subcategory: 'Groceries' },
  spencers:    { category: 'Food', subcategory: 'Groceries' },
  // Fuel
  'indian oil': { category: 'Transport', subcategory: 'Fuel' },
  indianoil:    { category: 'Transport', subcategory: 'Fuel' },
  hpcl:         { category: 'Transport', subcategory: 'Fuel' },
  bpcl:         { category: 'Transport', subcategory: 'Fuel' },
  iocl:         { category: 'Transport', subcategory: 'Fuel' },
  'hp petrol':  { category: 'Transport', subcategory: 'Fuel' },
  // Transport
  ola:          { category: 'Transport', subcategory: 'Auto/Cab' },
  uber:         { category: 'Transport', subcategory: 'Auto/Cab' },
  rapido:       { category: 'Transport', subcategory: 'Auto/Cab' },
  irctc:        { category: 'Transport', subcategory: 'Bus/Train' },
  makemytrip:   { category: 'Transport', subcategory: 'Flight' },
  indigo:       { category: 'Transport', subcategory: 'Flight' },
  spicejet:     { category: 'Transport', subcategory: 'Flight' },
  vistara:      { category: 'Transport', subcategory: 'Flight' },
  airindia:     { category: 'Transport', subcategory: 'Flight' },
  // Health & pharma
  apollo:       { category: 'Health', subcategory: 'Medicine' },
  medplus:      { category: 'Health', subcategory: 'Medicine' },
  netmeds:      { category: 'Health', subcategory: 'Medicine' },
  '1mg':        { category: 'Health', subcategory: 'Medicine' },
  pharmeasy:    { category: 'Health', subcategory: 'Medicine' },
  practo:       { category: 'Health', subcategory: 'Doctor' },
  // Shopping
  amazon:       { category: 'Shopping', subcategory: 'Electronics' },
  flipkart:     { category: 'Shopping', subcategory: 'Electronics' },
  meesho:       { category: 'Shopping', subcategory: 'Clothes' },
  myntra:       { category: 'Shopping', subcategory: 'Clothes' },
  ajio:         { category: 'Shopping', subcategory: 'Clothes' },
  nykaa:        { category: 'Personal', subcategory: 'Skincare' },
  // Entertainment
  netflix:      { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  hotstar:      { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  'disney+':    { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  prime:        { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  spotify:      { category: 'Entertainment', subcategory: 'OTT/Streaming' },
  bookmyshow:   { category: 'Entertainment', subcategory: 'Movies' },
  pvr:          { category: 'Entertainment', subcategory: 'Movies' },
  inox:         { category: 'Entertainment', subcategory: 'Movies' },
  // Utilities
  airtel:       { category: 'Utilities', subcategory: 'Phone' },
  jio:          { category: 'Utilities', subcategory: 'Phone' },
  bsnl:         { category: 'Utilities', subcategory: 'Phone' },
  vi:           { category: 'Utilities', subcategory: 'Phone' },
  // Dining
  starbucks:    { category: 'Food', subcategory: 'Beverages' },
  dominos:      { category: 'Food', subcategory: 'Takeaway' },
  pizzahut:     { category: 'Food', subcategory: 'Takeaway' },
  mcdonalds:    { category: 'Food', subcategory: 'Takeaway' },
  kfc:          { category: 'Food', subcategory: 'Takeaway' },
  subway:       { category: 'Food', subcategory: 'Takeaway' },
  // Gym / personal
  'cult.fit':   { category: 'Personal', subcategory: 'Gym' },
  cultfit:      { category: 'Personal', subcategory: 'Gym' },
  // Laundry
  uclean:       { category: 'Personal', subcategory: 'Laundry' },
  washmart:     { category: 'Personal', subcategory: 'Laundry' },
};

// UPI app keyword detection
const UPI_KEYWORD_MAP = {
  gpay: 'GPay', 'google pay': 'GPay',
  phonepe: 'PhonePe', 'phone pe': 'PhonePe',
  paytm: 'Paytm',
  payzapp: 'PayZapp',
  bhim: 'BHIM',
  'amazon pay': 'Amazon Pay',
  'whatsapp': 'WhatsApp Pay',
  cred: 'Cred',
  slice: 'Slice',
};

// Amount: find ₹ / Rs. / INR followed by a number, collect all, pick the largest
// (receipts often show line items; grand total is largest value)
function extractAmount(text) {
  const patterns = [
    /(?:grand\s*total|total\s*amount|amount\s*paid|net\s*amount|bill\s*amount|total)[^\d₹Rs]{0,10}(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  ];

  const values = [];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(v) && v > 0) values.push(v);
    }
  }

  if (!values.length) {
    // Last-resort: any standalone number that looks like a price
    const fallback = /\b(\d{2,6}(?:\.\d{1,2})?)\b/g;
    let m;
    while ((m = fallback.exec(text)) !== null) {
      const v = parseFloat(m[1]);
      if (v >= 1 && v <= 999999) values.push(v);
    }
  }

  if (!values.length) return null;
  // Prefer the largest value (grand total), but cap at a sane ceiling
  return Math.max(...values);
}

// Date: try multiple Indian receipt formats
function extractDate(text) {
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    { re: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/, parse: m => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
    // DD/MM/YY
    { re: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/, parse: m => `20${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
    // YYYY-MM-DD (ISO)
    { re: /\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/, parse: m => `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` },
    // DD Month YYYY  e.g. "12 May 2026"
    { re: /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/i,
      parse: m => {
        const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
        return `${m[3]}-${months[m[2].toLowerCase().slice(0,3)]}-${m[1].padStart(2,'0')}`;
      }
    },
    // Month DD, YYYY  e.g. "May 12, 2026"
    { re: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i,
      parse: m => {
        const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
        return `${m[3]}-${months[m[1].toLowerCase().slice(0,3)]}-${m[2].padStart(2,'0')}`;
      }
    },
  ];

  for (const { re, parse } of datePatterns) {
    const m = text.match(re);
    if (m) {
      const iso = parse(m);
      // Sanity check
      const d = new Date(iso + 'T12:00:00');
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2010 && d.getFullYear() <= 2035) {
        return iso;
      }
    }
  }
  return null;
}

// Merchant name: match against MERCHANT_MAP keys in the first 10 lines
function extractMerchant(text) {
  const lines = text.split('\n').slice(0, 10).map(l => l.trim().toLowerCase());
  const fullLower = lines.join(' ');

  for (const key of Object.keys(MERCHANT_MAP)) {
    if (fullLower.includes(key)) {
      return key;
    }
  }
  // Fallback: return the first non-empty, non-number line (likely business name)
  for (const line of text.split('\n')) {
    const clean = line.trim();
    if (clean.length > 2 && !/^[\d\s\W]+$/.test(clean)) {
      return clean;
    }
  }
  return null;
}

// Category + subcategory from merchant key
function extractCategory(merchantKey) {
  if (!merchantKey) return { category: '', subcategory: '' };
  const lower = merchantKey.toLowerCase();
  for (const key of Object.keys(MERCHANT_MAP)) {
    if (lower.includes(key)) return MERCHANT_MAP[key];
  }
  return { category: '', subcategory: '' };
}

// Payment method detection
function extractPaymentMethod(text) {
  const lower = text.toLowerCase();

  if (/\bcash\b/.test(lower)) return { paymentMethod: 'Cash', paymentDescription: '' };

  for (const [kw, appName] of Object.entries(UPI_KEYWORD_MAP)) {
    if (lower.includes(kw)) return { paymentMethod: 'UPI/QR', paymentDescription: appName };
  }

  if (/\bupi\b/.test(lower)) return { paymentMethod: 'UPI/QR', paymentDescription: '' };

  if (/\b(visa|master|mastercard|rupay|credit\s*card)\b/i.test(lower))
    return { paymentMethod: 'Credit Card', paymentDescription: '' };

  if (/\bdebit\s*card\b/i.test(lower))
    return { paymentMethod: 'Debit Card', paymentDescription: '' };

  if (/\b(net\s*banking|netbanking|neft|imps|rtgs)\b/i.test(lower))
    return { paymentMethod: 'Net Banking', paymentDescription: '' };

  if (/\b(wallet|paytm|phonepe|gpay)\b/i.test(lower))
    return { paymentMethod: 'Wallet', paymentDescription: '' };

  return { paymentMethod: '', paymentDescription: '' };
}

// Dining app detection (for Food category)
function extractDiningApp(text) {
  const lower = text.toLowerCase();
  for (const app of DINING_APPS) {
    if (app && lower.includes(app.toLowerCase())) return app;
  }
  return '';
}

// Main export: takes raw OCR text, returns partial expense fields + confidence map
export function parseReceipt(rawText) {
  if (!rawText || !rawText.trim()) return null;

  const text = rawText;
  const merchantKey = extractMerchant(text);
  const { category, subcategory } = extractCategory(merchantKey);
  const { paymentMethod, paymentDescription } = extractPaymentMethod(text);
  const amount = extractAmount(text);
  const date = extractDate(text);

  // Description: prefer known merchant display name, else first clean line
  let description = '';
  if (merchantKey) {
    // Capitalise first letter of each word
    description = merchantKey.replace(/\b\w/g, c => c.toUpperCase());
  }

  const diningApp = category === 'Food' ? extractDiningApp(text) : '';

  // Confidence: flag which fields we actually found vs guessed
  const confidence = {
    amount: amount !== null,
    date: date !== null,
    description: !!description,
    category: !!category,
    paymentMethod: !!paymentMethod,
  };

  return {
    amount: amount !== null ? String(amount) : '',
    date: date || '',
    description,
    category,
    subcategory,
    paymentMethod,
    paymentDescription,
    diningApp,
    // raw text preserved so ReceiptScanner can show it to the user
    _rawText: rawText,
    _confidence: confidence,
  };
}
