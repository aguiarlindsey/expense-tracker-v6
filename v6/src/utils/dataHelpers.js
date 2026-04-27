import { VALID_CATS, PAY_METHODS, INC_SOURCES } from './constants'

// ── Date utilities ────────────────────────────────────────
// All dates stored as YYYY-MM-DD; always append T12:00:00 to avoid timezone day shifts
export function toISODate(date) {
  if (!date) return ''
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const d = new Date(date)
  return isNaN(d) ? '' : d.toISOString().split('T')[0]
}
export function isValidISODate(str) {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(str)
}
export function safeDate(str) {
  return new Date((str || '') + 'T12:00:00')
}

// ── Fingerprint / dedup ───────────────────────────────────
function djb2(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return (h >>> 0).toString(36)
}

export function fingerprint(e) {
  const date   = e.date   || ''
  const desc   = (e.description || e.item || e.name || '').toLowerCase().trim()
  const amount = String(parseFloat(e.amount || e.price || 0).toFixed(2))
  const curr   = e.currency || 'INR'
  const cat    = (e.category || '').toLowerCase()
  return djb2(`${date}|${desc}|${amount}|${curr}|${cat}`)
}

export function stableId(partial) {
  if (partial.id && typeof partial.id === 'string' && partial.id.length > 4) return partial.id
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function makeDedupContext(existingList) {
  const byId  = new Set((existingList || []).map(e => e.id))
  const byFp  = new Set((existingList || []).map(e => e._fp).filter(Boolean))
  return {
    isDuplicate: (entry) => byId.has(entry.id) || (entry._fp && byFp.has(entry._fp)),
    register:    (entry) => { byId.add(entry.id); if (entry._fp) byFp.add(entry._fp) },
  }
}

// ── Normalisation ─────────────────────────────────────────
export function normCategory(raw) {
  if (!raw) return 'Other'
  const lower = (raw || '').toLowerCase()
  const found = VALID_CATS.find(c => c.toLowerCase() === lower)
  return found || 'Other'
}

export function normPayment(raw) {
  if (!raw) return 'Cash'
  const lower = (raw || '').toLowerCase()
  const found = PAY_METHODS.find(p => p.toLowerCase() === lower)
  return found || 'Cash'
}

export function normIncomeSource(raw) {
  if (!raw) return 'Other'
  const lower = (raw || '').toLowerCase()
  const found = INC_SOURCES.find(s => s.toLowerCase() === lower)
  return found || 'Other'
}

// ── Record builders ───────────────────────────────────────
export function makeExpense(partial = {}, source = 'manual') {
  const id     = stableId(partial)
  const amount = parseFloat(partial.amount || 0)
  const currency = partial.currency || 'INR'
  const rate   = parseFloat(partial.conversionRate || 1)
  return {
    id,
    _fp:                fingerprint(partial),
    date:               partial.date || new Date().toISOString().split('T')[0],
    description:        partial.description || 'Expense',
    amount,
    currency,
    conversionRate:     rate,
    amountINR:          currency === 'INR' ? amount : parseFloat(partial.amountINR || amount * rate),
    category:           normCategory(partial.category),
    subcategory:        partial.subcategory || '',
    expenseType:        partial.expenseType || 'variable',
    paymentMethod:      normPayment(partial.paymentMethod),
    paymentDescription: partial.paymentDescription || '',
    diningApp:          partial.diningApp || '',
    tags:               Array.isArray(partial.tags) ? partial.tags : [],
    notes:              partial.notes || '',
    customColor:        partial.customColor || null,
    budgetCategory:     partial.budgetCategory || null,
    isRecurring:        partial.isRecurring || false,
    recurringPeriod:    partial.recurringPeriod || 'monthly',
    nextDueDate:        partial.nextDueDate || '',
    splitWith:          partial.splitWith || '',
    splitParts:         parseInt(partial.splitParts || 1) || 1,
    receiptRef:         partial.receiptRef || '',
    migratedFrom:       source,
    version:            6,
  }
}

export function makeIncome(partial = {}, source = 'manual') {
  const id     = stableId(partial)
  const amount = parseFloat(partial.amount || 0)
  const currency = partial.currency || 'INR'
  const rate   = parseFloat(partial.conversionRate || 1)
  return {
    id,
    _fp:             fingerprint(partial),
    date:            partial.date || new Date().toISOString().split('T')[0],
    description:     partial.description || 'Income',
    amount,
    currency,
    conversionRate:  rate,
    amountINR:       currency === 'INR' ? amount : parseFloat(partial.amountINR || amount * rate),
    source:          normIncomeSource(partial.source),
    paymentMethod:   normPayment(partial.paymentMethod || 'Net Banking'),
    notes:           partial.notes || '',
    isRecurring:     partial.isRecurring || false,
    recurringPeriod: partial.recurringPeriod || 'monthly',
    migratedFrom:    source,
    type:            'income',
    version:         6,
  }
}

// ── Anomaly Detection ─────────────────────────────────────
export function detectAnomaly(newExpense, allExpenses, thresholdPct = 0.30, minSamples = 2) {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const similar = allExpenses.filter(e =>
    e.category === newExpense.category &&
    new Date(e.date + 'T12:00:00') >= threeMonthsAgo &&
    e.id !== newExpense.id
  )

  if (similar.length < minSamples) return null

  const avg = similar.reduce((s, e) => s + (e.amountINR || e.amount || 0), 0) / similar.length
  const thisAmt = newExpense.amountINR || newExpense.amount || 0
  const deviation = avg > 0 ? (thisAmt - avg) / avg : 0

  if (deviation <= thresholdPct) return null

  return {
    category:    newExpense.category,
    description: newExpense.description,
    date:        newExpense.date,
    avgAmount:   avg,
    thisAmount:  thisAmt,
    deviationPct: Math.round(deviation * 100),
  }
}

// ── Search ────────────────────────────────────────────────
export function matchesSearch(item, q) {
  if (!q || !q.trim()) return true
  const query = q.trim().toLowerCase()

  // amount: operator
  const amtMatch = query.match(/amount:(>|<|>=|<=)?(\d+(?:\.\d+)?)/)
  if (amtMatch) {
    const op  = amtMatch[1] || '>='
    const val = parseFloat(amtMatch[2])
    const amt = parseFloat(item.amountINR || item.amount || 0)
    if (op === '>'  && !(amt >  val)) return false
    if (op === '<'  && !(amt <  val)) return false
    if (op === '>=' && !(amt >= val)) return false
    if (op === '<=' && !(amt <= val)) return false
    return true
  }

  // category: operator
  const catMatch = query.match(/category:(\S+)/)
  if (catMatch) {
    return (item.category || '').toLowerCase().includes(catMatch[1])
  }

  // date: operator
  const dateMatch = query.match(/date:(\S+)/)
  if (dateMatch) {
    return (item.date || '').startsWith(dateMatch[1])
  }

  // tag: operator
  const tagMatch = query.match(/tag:(\S+)/)
  if (tagMatch) {
    return (item.tags || []).some(t => t.toLowerCase().includes(tagMatch[1]))
  }

  // free-text fallback
  const fields = [
    item.description, item.category, item.subcategory,
    item.paymentMethod, item.notes, item.source,
    ...(item.tags || []),
  ].filter(Boolean).map(f => f.toLowerCase())
  return fields.some(f => f.includes(query))
}
