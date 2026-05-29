// Natural-language query parser for the Expenses search bar.
// Returns structured filter components + leftover plain-text remainder.

const MONTHS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december',
]
const MONTH_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

// Common aliases → canonical PAY_METHODS values
const PAY_ALIASES = {
  'buy now pay later': 'Buy Now Pay Later',
  'net banking':       'Net Banking',
  'netbanking':        'Net Banking',
  'credit card':       'Credit Card',
  'debit card':        'Debit Card',
  'forex card':        'Forex Card',
  'upi/qr':            'UPI/QR',
  'google pay':        'UPI/QR',
  'gpay':              'UPI/QR',
  'phonepe':           'UPI/QR',
  'paytm':             'UPI/QR',
  'upi':               'UPI/QR',
  'credit':            'Credit Card',
  'debit':             'Debit Card',
  'cash':              'Cash',
  'wallet':            'Wallet',
  'cheque':            'Cheque',
  'check':             'Cheque',
  'emi':               'EMI',
  'bnpl':              'Buy Now Pay Later',
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10)
}

function monday(d) {
  const dow  = d.getDay()
  const diff = dow === 0 ? 6 : dow - 1
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
}

function lastOfMonth(y, m) { // m is 0-indexed
  return new Date(y, m + 1, 0)
}

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * parseNLQuery(raw, { catNames, payMethods })
 *
 * Returns:
 *   text       – unconsumed words (for plain-text matchesSearch)
 *   categories – string[]
 *   payment    – string | null
 *   amtMin     – string ('' if not set)
 *   amtMax     – string ('' if not set)
 *   dateFrom   – string YYYY-MM-DD ('' if not set)
 *   dateTo     – string YYYY-MM-DD ('' if not set)
 *   tokens     – { label }[] shown as chips in the UI
 */
export function parseNLQuery(raw, { catNames = [], payMethods = [] } = {}) {
  const empty = { text: raw, categories: [], payment: null, amtMin: '', amtMax: '', dateFrom: '', dateTo: '', tokens: [] }
  if (!raw || !raw.trim()) return { ...empty, text: '' }

  const tokens = []
  let q = raw.toLowerCase()

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const todayStr = fmtDate(today)
  const Y  = today.getFullYear()
  const Mo = today.getMonth() // 0-indexed

  const result = { categories: [], payment: null, amtMin: '', amtMax: '', dateFrom: '', dateTo: '' }

  // ── Amounts ─────────────────────────────────────────────────────────────────
  let m

  m = q.match(/\bbetween\s+([\d,]+(?:\.\d+)?)\s+(?:and|to|-)\s+([\d,]+(?:\.\d+)?)\b/)
  if (m) {
    result.amtMin = m[1].replace(/,/g, '')
    result.amtMax = m[2].replace(/,/g, '')
    tokens.push({ label: `${m[1]} – ${m[2]}` })
    q = q.slice(0, m.index) + ' ' + q.slice(m.index + m[0].length)
  }

  m = q.match(/\b(?:over|above|more than|greater than|at least|atleast)\s*([\d,]+(?:\.\d+)?)\b/)
  if (m && !result.amtMin) {
    result.amtMin = m[1].replace(/,/g, '')
    tokens.push({ label: `≥ ${m[1]}` })
    q = q.slice(0, m.index) + ' ' + q.slice(m.index + m[0].length)
  }

  m = q.match(/\b(?:under|below|less than|at most|atmost)\s*([\d,]+(?:\.\d+)?)\b/)
  if (m && !result.amtMax) {
    result.amtMax = m[1].replace(/,/g, '')
    tokens.push({ label: `≤ ${m[1]}` })
    q = q.slice(0, m.index) + ' ' + q.slice(m.index + m[0].length)
  }

  // ── Dates ────────────────────────────────────────────────────────────────────
  const datePatterns = [
    [/\btoday\b/, () => {
      result.dateFrom = result.dateTo = todayStr
      tokens.push({ label: 'Today' })
    }],
    [/\byesterday\b/, () => {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      result.dateFrom = result.dateTo = fmtDate(y)
      tokens.push({ label: 'Yesterday' })
    }],
    [/\bthis\s+week\b/, () => {
      result.dateFrom = fmtDate(monday(today))
      result.dateTo   = todayStr
      tokens.push({ label: 'This week' })
    }],
    [/\blast\s+week\b/, () => {
      const sw = monday(today); sw.setDate(sw.getDate() - 7)
      const ew = new Date(sw); ew.setDate(ew.getDate() + 6)
      result.dateFrom = fmtDate(sw)
      result.dateTo   = fmtDate(ew)
      tokens.push({ label: 'Last week' })
    }],
    [/\bthis\s+month\b/, () => {
      result.dateFrom = fmtDate(new Date(Y, Mo, 1))
      result.dateTo   = todayStr
      tokens.push({ label: 'This month' })
    }],
    [/\blast\s+month\b/, () => {
      const lm = Mo === 0 ? 11 : Mo - 1
      const ly = Mo === 0 ? Y - 1 : Y
      result.dateFrom = fmtDate(new Date(ly, lm, 1))
      result.dateTo   = fmtDate(lastOfMonth(ly, lm))
      tokens.push({ label: 'Last month' })
    }],
    [/\bthis\s+year\b/, () => {
      result.dateFrom = `${Y}-01-01`
      result.dateTo   = todayStr
      tokens.push({ label: String(Y) })
    }],
    [/\blast\s+year\b/, () => {
      result.dateFrom = `${Y - 1}-01-01`
      result.dateTo   = `${Y - 1}-12-31`
      tokens.push({ label: String(Y - 1) })
    }],
  ]

  let dateMatched = false
  for (const [re, apply] of datePatterns) {
    if (re.test(q)) {
      apply()
      q = q.replace(re, ' ')
      dateMatched = true
      break
    }
  }

  if (!dateMatched) {
    // in <month> <year?> — e.g. "in may", "march 2026", "in january 2025"
    const allM = [...MONTHS, ...MONTH_SHORT].map(esc).join('|')
    const re   = new RegExp(`\\b(?:in\\s+)?(${allM})\\s*(\\d{4})?\\b`)
    m = q.match(re)
    if (m) {
      const mn   = m[1]
      const mIdx = MONTHS.includes(mn) ? MONTHS.indexOf(mn) : MONTH_SHORT.indexOf(mn)
      if (mIdx !== -1) {
        const yr = m[2] ? parseInt(m[2]) : Y
        result.dateFrom = fmtDate(new Date(yr, mIdx, 1))
        result.dateTo   = fmtDate(lastOfMonth(yr, mIdx))
        const label = MONTHS[mIdx][0].toUpperCase() + MONTHS[mIdx].slice(1) + (m[2] ? ` ${yr}` : '')
        tokens.push({ label })
        q = q.slice(0, m.index) + ' ' + q.slice(m.index + m[0].length)
      }
    }
  }

  // ── Payment method ────────────────────────────────────────────────────────────
  // Try longest aliases first so "credit card" beats "credit"
  const aliasKeys = Object.keys(PAY_ALIASES).sort((a, b) => b.length - a.length)
  for (const alias of aliasKeys) {
    const re = new RegExp(`\\b${esc(alias)}\\b`)
    if (re.test(q)) {
      result.payment = PAY_ALIASES[alias]
      tokens.push({ label: result.payment })
      q = q.replace(re, ' ')
      break
    }
  }

  // ── Categories ────────────────────────────────────────────────────────────────
  for (const cat of catNames) {
    const re = new RegExp(`\\b${esc(cat.toLowerCase())}\\b`)
    if (re.test(q)) {
      result.categories.push(cat)
      tokens.push({ label: cat })
      q = q.replace(re, ' ')
    }
  }

  // ── Remainder ─────────────────────────────────────────────────────────────────
  result.text   = tokens.length > 0 ? q.replace(/\s+/g, ' ').trim() : raw
  result.tokens = tokens

  if (tokens.length === 0) return empty
  return result
}
