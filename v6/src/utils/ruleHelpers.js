// Smart Rules (V8 Epic C3) — pure auto-categorization, no external deps.
// First-match-wins: rules are checked in priority order (lowest number first),
// the first enabled rule whose condition matches sets the category — not layered.

function fieldValue(rule, expense) {
  if (rule.field === 'amount') return parseFloat(expense.amount) || 0
  if (rule.field === 'paymentMethod') return expense.paymentMethod || ''
  return expense.description || ''
}

function matches(rule, expense) {
  const field = fieldValue(rule, expense)
  if (rule.operator === 'gt') return parseFloat(field) > parseFloat(rule.value)
  if (rule.operator === 'lt') return parseFloat(field) < parseFloat(rule.value)
  const a = String(field).toLowerCase(), b = String(rule.value || '').toLowerCase()
  if (rule.operator === 'equals') return a === b
  return b.length > 0 && a.includes(b) // 'contains', the default
}

// Returns { rule, category, subcategory, tags, isRecurring, recurringPeriod, recurringDays }
// for the first matching enabled rule, or null if none match. Recurring fields
// are only meaningful when isRecurring is true (a rule can categorize without
// touching recurrence at all).
export function applyRules(expense, rules) {
  const sorted = [...(rules || [])]
    .filter(r => r.enabled !== false)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0))
  for (const rule of sorted) {
    if (matches(rule, expense)) {
      return {
        rule, category: rule.setCategory, subcategory: rule.setSubcategory || '', tags: rule.setTags || [],
        isRecurring: rule.setIsRecurring || false,
        recurringPeriod: rule.setRecurringPeriod || 'monthly',
        recurringDays: rule.setRecurringDays || null,
      }
    }
  }
  return null
}
