import { makeExpense, makeIncome, fingerprint } from './dataHelpers'

// ── Field normalisation helpers ───────────────────────────

function normaliseDate(raw) {
  if (!raw) return new Date().toISOString().split('T')[0]
  const s = String(raw)
  return s.includes('T') ? s.split('T')[0] : s
}

function normSplitParts(raw) {
  if (!raw) return 1
  if (typeof raw === 'object' && raw !== null) return parseInt(raw.n || 1) || 1
  return parseInt(raw) || 1
}

// ── Record transformers ───────────────────────────────────

export function transformV5Expense(v5) {
  const partial = {
    id:                 v5.id,
    date:               normaliseDate(v5.date),
    description:        v5.desc || v5.description || 'Expense',
    amount:             parseFloat(v5.amount || 0),
    currency:           v5.currency || 'INR',
    conversionRate:     parseFloat(v5.conversionRate || 1),
    amountINR:          v5.amountINR != null ? parseFloat(v5.amountINR) : undefined,
    category:           v5.category,
    subcategory:        v5.subcategory || '',
    expenseType:        v5.expenseType || 'variable',
    paymentMethod:      v5.paymentMethod,
    paymentDescription: v5.paymentDescription || '',
    diningApp:          v5.diningApp || '',
    tags:               Array.isArray(v5.tags) ? v5.tags : [],
    notes:              v5.notes || '',
    customColor:        v5.customColor || null,
    budgetCategory:     v5.budgetCategory || null,
    isRecurring:        v5.isRecurring || false,
    recurringPeriod:    v5.recurringPeriod || 'monthly',
    nextDueDate:        v5.nextDueDate || '',
    splitWith:          v5.splitWith || '',
    splitParts:         normSplitParts(v5.splitParts),
    receiptRef:         v5.receiptRef || '',
    importedFrom:       'v5-migration',
  }

  const result = makeExpense(partial, 'v5')

  // Preserve v5's original fingerprint so dedup works on re-import.
  // If v5 record has no _fp, generate one from the mapped fields.
  result._fp = v5._fp || fingerprint(partial)

  return result
}

export function transformV5Income(v5) {
  const partial = {
    id:              v5.id,
    date:            normaliseDate(v5.date),
    description:     v5.desc || v5.description || 'Income',
    amount:          parseFloat(v5.amount || 0),
    currency:        v5.currency || 'INR',
    conversionRate:  parseFloat(v5.conversionRate || 1),
    amountINR:       v5.amountINR != null ? parseFloat(v5.amountINR) : undefined,
    source:          v5.source,
    paymentMethod:   v5.paymentMethod,
    notes:           v5.notes || '',
    isRecurring:     v5.isRecurring || false,
    recurringPeriod: v5.recurringPeriod || 'monthly',
    importedFrom:    'v5-migration',
  }

  const result = makeIncome(partial, 'v5')
  result._fp = v5._fp || fingerprint(partial)

  return result
}

// ── File validation ───────────────────────────────────────

export function validateV5File(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, reason: 'File must contain a JSON object, not an array or primitive.' }
  }

  const hasExp = Array.isArray(raw.expenses) && raw.expenses.length > 0
  const hasInc = Array.isArray(raw.income)   && raw.income.length   > 0

  if (!hasExp && !hasInc) {
    return { valid: false, reason: 'No expenses or income records found in this file.' }
  }

  if (raw.version === 6) {
    return { valid: false, reason: 'This looks like a V6 backup. Use the "Import Data" button above instead.' }
  }

  return { valid: true, reason: null }
}

// ── Main entry point ─────────────────────────────────────
// Returns { expenses, income, warnings }
// warnings: array of strings for individual record issues (non-fatal)

export function migrateV5Data(raw) {
  const warnings = []
  const expenses = []
  const income   = []

  const rawExps = Array.isArray(raw.expenses) ? raw.expenses : []
  const rawIncs = Array.isArray(raw.income)   ? raw.income   : []

  rawExps.forEach((v5, i) => {
    try {
      const e = transformV5Expense(v5)
      if (!e.amount) warnings.push(`Expense #${i + 1} ("${e.description}") has zero amount`)
      expenses.push(e)
    } catch (err) {
      warnings.push(`Expense #${i + 1} skipped: ${err.message}`)
    }
  })

  rawIncs.forEach((v5, i) => {
    try {
      const inc = transformV5Income(v5)
      if (!inc.amount) warnings.push(`Income #${i + 1} ("${inc.description}") has zero amount`)
      income.push(inc)
    } catch (err) {
      warnings.push(`Income #${i + 1} skipped: ${err.message}`)
    }
  })

  return { expenses, income, warnings }
}
