import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'

// ── DB ↔ App field mapping ────────────────────────────────

function expenseToDb(e, userId) {
  return {
    id:                  e.id,
    user_id:             userId,
    date:                e.date,
    description:         e.description,
    amount:              e.amount,
    currency:            e.currency || 'INR',
    conversion_rate:     e.conversionRate || 1,
    amount_inr:          e.amountINR || e.amount,
    category:            e.category || null,
    subcategory:         e.subcategory || null,
    expense_type:        e.expenseType || null,
    payment_method:      e.paymentMethod || null,
    payment_description: e.paymentDescription || null,
    dining_app:          e.diningApp || null,
    tags:                e.tags || [],
    notes:               e.notes || null,
    custom_color:        e.customColor || null,
    budget_category:     e.budgetCategory || null,
    is_recurring:        e.isRecurring || false,
    recurring_period:    e.recurringPeriod || null,
    next_due_date:       e.nextDueDate || null,
    split_with:          e.splitWith || null,
    split_parts:         e.splitParts || 1,
    receipt_ref:         e.receiptRef || null,
    fingerprint:         e._fp || null,
    migrated_from:       e.migratedFrom || null,
    imported_from:       e.importedFrom || null,
  }
}

function expenseFromDb(row) {
  return {
    id:                 row.id,
    date:               row.date,
    description:        row.description,
    amount:             parseFloat(row.amount),
    currency:           row.currency,
    conversionRate:     parseFloat(row.conversion_rate),
    amountINR:          parseFloat(row.amount_inr),
    category:           row.category || 'Other',
    subcategory:        row.subcategory || '',
    expenseType:        row.expense_type || 'variable',
    paymentMethod:      row.payment_method || 'Cash',
    paymentDescription: row.payment_description || '',
    diningApp:          row.dining_app || '',
    tags:               row.tags || [],
    notes:              row.notes || '',
    customColor:        row.custom_color || null,
    budgetCategory:     row.budget_category || null,
    isRecurring:        row.is_recurring || false,
    recurringPeriod:    row.recurring_period || 'monthly',
    nextDueDate:        row.next_due_date || '',
    splitWith:          row.split_with || '',
    splitParts:         row.split_parts || 1,
    receiptRef:         row.receipt_ref || '',
    _fp:                row.fingerprint || '',
    migratedFrom:       row.migrated_from || '',
    importedFrom:       row.imported_from || '',
    version:            6,
  }
}

function incomeToDb(i, userId) {
  return {
    id:              i.id,
    user_id:         userId,
    date:            i.date,
    description:     i.description,
    amount:          i.amount,
    currency:        i.currency || 'INR',
    conversion_rate: i.conversionRate || 1,
    amount_inr:      i.amountINR || i.amount,
    source:          i.source || 'Other',
    payment_method:  i.paymentMethod || 'Net Banking',
    notes:           i.notes || null,
    is_recurring:    i.isRecurring || false,
    recurring_period:i.recurringPeriod || null,
    fingerprint:     i._fp || null,
    migrated_from:   i.migratedFrom || null,
    imported_from:   i.importedFrom || null,
  }
}

function incomeFromDb(row) {
  return {
    id:              row.id,
    date:            row.date,
    description:     row.description,
    amount:          parseFloat(row.amount),
    currency:        row.currency,
    conversionRate:  parseFloat(row.conversion_rate),
    amountINR:       parseFloat(row.amount_inr),
    source:          row.source || 'Other',
    paymentMethod:   row.payment_method || 'Net Banking',
    notes:           row.notes || '',
    isRecurring:     row.is_recurring || false,
    recurringPeriod: row.recurring_period || 'monthly',
    _fp:             row.fingerprint || '',
    migratedFrom:    row.migrated_from || '',
    importedFrom:    row.imported_from || '',
    type:            'income',
    version:         6,
  }
}

// ── Hook ─────────────────────────────────────────────────

export function useStorage(userId) {
  const [expenses, setExpenses] = useState([])
  const [income,   setIncome]   = useState([])
  const [budgets,  setBudgets]  = useState({ daily: 0, weekly: 0, monthly: 0, categories: {} })
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  // ── Initial load ──────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setError(null)

    Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('income').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', userId).maybeSingle(),
    ]).then(([expRes, incRes, budRes]) => {
      if (expRes.error) setError(expRes.error.message)
      if (incRes.error) setError(incRes.error.message)
      setExpenses((expRes.data || []).map(expenseFromDb))
      setIncome((incRes.data || []).map(incomeFromDb))
      if (budRes.data) {
        setBudgets({
          daily:      parseFloat(budRes.data.daily)   || 0,
          weekly:     parseFloat(budRes.data.weekly)  || 0,
          monthly:    parseFloat(budRes.data.monthly) || 0,
          categories: budRes.data.categories || {},
        })
      }
      setLoading(false)
    })
  }, [userId])

  // ── Expenses ─────────────────────────────────────────
  const addExpense = useCallback(async (exp) => {
    const row = expenseToDb(exp, userId)
    const { data, error: err } = await supabase.from('expenses').insert(row).select().single()
    if (err) { setError(err.message); return }
    setExpenses(prev => [expenseFromDb(data), ...prev])
  }, [userId])

  const editExpense = useCallback(async (exp) => {
    const row = expenseToDb(exp, userId)
    const { data, error: err } = await supabase.from('expenses').update(row).eq('id', exp.id).select().single()
    if (err) { setError(err.message); return }
    setExpenses(prev => prev.map(e => e.id === exp.id ? expenseFromDb(data) : e))
  }, [userId])

  const deleteExpense = useCallback(async (id) => {
    const { error: err } = await supabase.from('expenses').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
  }, [])

  const deleteManyExpenses = useCallback(async (ids) => {
    const { error: err } = await supabase.from('expenses').delete().in('id', ids)
    if (err) { setError(err.message); return }
    const idSet = new Set(ids)
    setExpenses(prev => prev.filter(e => !idSet.has(e.id)))
  }, [])

  // ── Income ───────────────────────────────────────────
  const addIncome = useCallback(async (inc) => {
    const row = incomeToDb(inc, userId)
    const { data, error: err } = await supabase.from('income').insert(row).select().single()
    if (err) { setError(err.message); return }
    setIncome(prev => [incomeFromDb(data), ...prev])
  }, [userId])

  const editIncome = useCallback(async (inc) => {
    const row = incomeToDb(inc, userId)
    const { data, error: err } = await supabase.from('income').update(row).eq('id', inc.id).select().single()
    if (err) { setError(err.message); return }
    setIncome(prev => prev.map(i => i.id === inc.id ? incomeFromDb(data) : i))
  }, [userId])

  const deleteIncome = useCallback(async (id) => {
    const { error: err } = await supabase.from('income').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setIncome(prev => prev.filter(i => i.id !== id))
  }, [])

  // ── Budgets ──────────────────────────────────────────
  const saveBudgets = useCallback(async (nb) => {
    setBudgets(nb) // optimistic
    const { error: err } = await supabase.from('budgets').upsert({
      user_id:    userId,
      daily:      nb.daily    || 0,
      weekly:     nb.weekly   || 0,
      monthly:    nb.monthly  || 0,
      categories: nb.categories || {},
      updated_at: new Date().toISOString(),
    })
    if (err) setError(err.message)
  }, [userId])

  return {
    expenses, income, budgets,
    loading, error,
    addExpense, editExpense, deleteExpense, deleteManyExpenses,
    addIncome,  editIncome,  deleteIncome,
    saveBudgets,
  }
}
