import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { useRetryQueue } from './useRetryQueue'

// ── Network error detection ───────────────────────────────
function isNetworkError(err) {
  if (!navigator.onLine) return true
  const msg = (err?.message || '').toLowerCase()
  return msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('networkerror')
}

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
  const [expenses,      setExpenses]      = useState([])
  const [income,        setIncome]        = useState([])
  const [budgets,       setBudgets]       = useState({ daily: 0, weekly: 0, monthly: 0, categories: {} })
  const [goals,         setGoals]         = useState([])
  const [contributions, setContributions] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [syncing,         setSyncing]         = useState(false)
  const [realtimeStatus,  setRealtimeStatus]  = useState('connecting')

  const { queue, online, enqueue, remove, bumpAttempts, dropExhausted } = useRetryQueue()

  // ── Keep-alive heartbeat (prevents Supabase free-tier auto-pause) ───
  // Supabase only counts REST API calls as "activity" — not Realtime WebSocket connections.
  // This lightweight HEAD query runs at most once every 3 days to keep the project active.
  useEffect(() => {
    if (!userId) return
    const KEY = 'et_v6_ka_ts'
    const THREE_DAYS = 3 * 24 * 3600 * 1000
    const last = parseInt(localStorage.getItem(KEY) || '0', 10)
    if (Date.now() - last < THREE_DAYS) return
    supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(() => { try { localStorage.setItem(KEY, String(Date.now())) } catch {} })
  }, [userId])

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

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('goal_contributions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    ]).then(([gRes, cRes]) => {
      if (gRes.error) setError(gRes.error.message)
      if (cRes.error) setError(cRes.error.message)
      setGoals((gRes.data || []).map(g => ({
        id: g.id, name: g.name, target: parseFloat(g.target),
        targetDate: g.target_date || '', icon: g.icon || '🎯',
        note: g.note || '', createdAt: g.created_at || '',
      })))
      setContributions((cRes.data || []).map(c => ({
        id: c.id, goalId: c.goal_id, date: c.date,
        amount: parseFloat(c.amount), note: c.note || '',
      })))
    })
  }, [userId])

  // ── Realtime event handlers ───────────────────────────────

  function handleExpenseEvent(event, payload) {
    if (event === 'INSERT') {
      const incoming = expenseFromDb(payload.new)
      setExpenses(prev => {
        if (prev.some(e => e.id === incoming.id && !e._pending)) return prev
        const hasPending = prev.some(e => e.id === incoming.id && e._pending)
        if (hasPending) return prev.map(e => e.id === incoming.id ? incoming : e)
        return [incoming, ...prev]
      })
    } else if (event === 'UPDATE') {
      const incoming = expenseFromDb(payload.new)
      setExpenses(prev => prev.map(e => e.id === incoming.id ? incoming : e))
    } else if (event === 'DELETE') {
      setExpenses(prev => prev.filter(e => e.id !== payload.old.id))
    }
  }

  function handleIncomeEvent(event, payload) {
    if (event === 'INSERT') {
      const incoming = incomeFromDb(payload.new)
      setIncome(prev => {
        if (prev.some(i => i.id === incoming.id && !i._pending)) return prev
        const hasPending = prev.some(i => i.id === incoming.id && i._pending)
        if (hasPending) return prev.map(i => i.id === incoming.id ? incoming : i)
        return [incoming, ...prev]
      })
    } else if (event === 'UPDATE') {
      const incoming = incomeFromDb(payload.new)
      setIncome(prev => prev.map(i => i.id === incoming.id ? incoming : i))
    } else if (event === 'DELETE') {
      setIncome(prev => prev.filter(i => i.id !== payload.old.id))
    }
  }

  function handleBudgetEvent(payload) {
    if (payload.eventType === 'DELETE') return
    const row = payload.new
    setBudgets({
      daily:      parseFloat(row.daily)   || 0,
      weekly:     parseFloat(row.weekly)  || 0,
      monthly:    parseFloat(row.monthly) || 0,
      categories: row.categories || {},
    })
  }

  function handleGoalEvent(payload) {
    if (payload.eventType === 'INSERT') {
      const g = payload.new
      const incoming = {
        id: g.id, name: g.name, target: parseFloat(g.target),
        targetDate: g.target_date || '', icon: g.icon || '🎯',
        note: g.note || '', createdAt: g.created_at || '',
      }
      setGoals(prev => {
        if (prev.some(x => x.id === incoming.id && !x._pending)) return prev
        const hasPending = prev.some(x => x.id === incoming.id && x._pending)
        if (hasPending) return prev.map(x => x.id === incoming.id ? incoming : x)
        return [incoming, ...prev]
      })
    } else if (payload.eventType === 'UPDATE') {
      const g = payload.new
      setGoals(prev => prev.map(x => x.id === g.id ? {
        id: g.id, name: g.name, target: parseFloat(g.target),
        targetDate: g.target_date || '', icon: g.icon || '🎯',
        note: g.note || '', createdAt: g.created_at || '',
      } : x))
    } else if (payload.eventType === 'DELETE') {
      setGoals(prev => prev.filter(x => x.id !== payload.old.id))
    }
  }

  function handleContributionEvent(payload) {
    if (payload.eventType === 'INSERT') {
      const c = payload.new
      const incoming = { id: c.id, goalId: c.goal_id, date: c.date, amount: parseFloat(c.amount), note: c.note || '' }
      setContributions(prev => {
        if (prev.some(x => x.id === incoming.id && !x._pending)) return prev
        const hasPending = prev.some(x => x.id === incoming.id && x._pending)
        if (hasPending) return prev.map(x => x.id === incoming.id ? incoming : x)
        return [incoming, ...prev]
      })
    } else if (payload.eventType === 'DELETE') {
      setContributions(prev => prev.filter(x => x.id !== payload.old.id))
    }
  }

  // ── Realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (!userId) return
    setRealtimeStatus('connecting')

    const channel = supabase
      .channel(`user-data-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses',           filter: `user_id=eq.${userId}` }, p => handleExpenseEvent('INSERT', p))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'expenses',           filter: `user_id=eq.${userId}` }, p => handleExpenseEvent('UPDATE', p))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'expenses',           filter: `user_id=eq.${userId}` }, p => handleExpenseEvent('DELETE', p))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'income',             filter: `user_id=eq.${userId}` }, p => handleIncomeEvent('INSERT', p))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'income',             filter: `user_id=eq.${userId}` }, p => handleIncomeEvent('UPDATE', p))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'income',             filter: `user_id=eq.${userId}` }, p => handleIncomeEvent('DELETE', p))
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'budgets',            filter: `user_id=eq.${userId}` }, p => handleBudgetEvent(p))
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'goals',              filter: `user_id=eq.${userId}` }, p => handleGoalEvent(p))
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'goal_contributions', filter: `user_id=eq.${userId}` }, p => handleContributionEvent(p))
      .subscribe(status => {
        if (status === 'SUBSCRIBED')    setRealtimeStatus('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
        else if (status === 'CLOSED')   setRealtimeStatus('offline')
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── executeOp: replay a single queued operation ───────────
  const executeOp = useCallback(async (op, payload) => {
    switch (op) {
      case 'addExpense': {
        const { data, error: err } = await supabase.from('expenses').insert(expenseToDb(payload, userId)).select().single()
        if (err) throw new Error(err.message)
        setExpenses(prev => prev.map(e => e.id === payload.id ? expenseFromDb(data) : e))
        break
      }
      case 'editExpense': {
        const { error: err } = await supabase.from('expenses').update(expenseToDb(payload, userId)).eq('id', payload.id)
        if (err) throw new Error(err.message)
        setExpenses(prev => prev.map(e => e.id === payload.id ? { ...e, _pending: false } : e))
        break
      }
      case 'deleteExpense': {
        const { error: err } = await supabase.from('expenses').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'addIncome': {
        const { data, error: err } = await supabase.from('income').insert(incomeToDb(payload, userId)).select().single()
        if (err) throw new Error(err.message)
        setIncome(prev => prev.map(i => i.id === payload.id ? incomeFromDb(data) : i))
        break
      }
      case 'editIncome': {
        const { error: err } = await supabase.from('income').update(incomeToDb(payload, userId)).eq('id', payload.id)
        if (err) throw new Error(err.message)
        setIncome(prev => prev.map(i => i.id === payload.id ? { ...i, _pending: false } : i))
        break
      }
      case 'deleteIncome': {
        const { error: err } = await supabase.from('income').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'saveBudgets': {
        const { error: err } = await supabase.from('budgets').upsert({
          user_id: userId, daily: payload.daily || 0, weekly: payload.weekly || 0,
          monthly: payload.monthly || 0, categories: payload.categories || {},
          updated_at: new Date().toISOString(),
        })
        if (err) throw new Error(err.message)
        break
      }
      case 'addGoal': {
        const { error: err } = await supabase.from('goals').insert({
          id: payload.id, user_id: userId, name: payload.name,
          target: payload.target, target_date: payload.targetDate || null,
          icon: payload.icon || '🎯', note: payload.note || null,
        })
        if (err) throw new Error(err.message)
        setGoals(prev => prev.map(g => g.id === payload.id ? { ...g, _pending: false } : g))
        break
      }
      case 'deleteGoal': {
        const { error: err } = await supabase.from('goals').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'addContribution': {
        const { error: err } = await supabase.from('goal_contributions').insert({
          id: payload.id, goal_id: payload.goalId, user_id: userId,
          date: payload.date, amount: payload.amount, note: payload.note || null,
        })
        if (err) throw new Error(err.message)
        setContributions(prev => prev.map(c => c.id === payload.id ? { ...c, _pending: false } : c))
        break
      }
      case 'deleteContribution': {
        const { error: err } = await supabase.from('goal_contributions').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      default:
        break
    }
  }, [userId])

  // ── Replay queue ──────────────────────────────────────────
  const replay = useCallback(async () => {
    const snapshot = loadQueueSnapshot()
    if (!snapshot.length || syncing) return
    setSyncing(true)
    for (const item of snapshot) {
      try {
        await executeOp(item.op, item.payload)
        remove(item.id)
      } catch {
        bumpAttempts(item.id)
      }
    }
    dropExhausted(5)
    setSyncing(false)
  }, [syncing, executeOp, remove, bumpAttempts, dropExhausted])

  // Replay on reconnect
  useEffect(() => {
    if (online && queue.length > 0 && !syncing) replay()
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps

  // Replay on mount if previous session left items queued
  useEffect(() => {
    if (online && queue.length > 0) replay()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Expenses ─────────────────────────────────────────────
  const addExpense = useCallback(async (exp) => {
    setExpenses(prev => [{ ...exp, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addExpense', exp); return }
    const { data, error: err } = await supabase.from('expenses').insert(expenseToDb(exp, userId)).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addExpense', exp) }
      else { setError(err.message); setExpenses(prev => prev.filter(e => e.id !== exp.id)) }
      return
    }
    setExpenses(prev => prev.map(e => e.id === exp.id ? expenseFromDb(data) : e))
  }, [userId, enqueue])

  const editExpense = useCallback(async (exp) => {
    setExpenses(prev => prev.map(e => e.id === exp.id ? { ...exp, _pending: true } : e))
    if (!navigator.onLine) { enqueue('editExpense', exp); return }
    const { data, error: err } = await supabase.from('expenses').update(expenseToDb(exp, userId)).eq('id', exp.id).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('editExpense', exp) }
      else { setError(err.message) }
      return
    }
    setExpenses(prev => prev.map(e => e.id === exp.id ? expenseFromDb(data) : e))
  }, [userId, enqueue])

  const deleteExpense = useCallback(async (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
    if (!navigator.onLine) { enqueue('deleteExpense', { id }); return }
    const { error: err } = await supabase.from('expenses').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteExpense', { id })
    else if (err) setError(err.message)
  }, [userId, enqueue])

  const deleteManyExpenses = useCallback(async (ids) => {
    const idSet = new Set(ids)
    setExpenses(prev => prev.filter(e => !idSet.has(e.id)))
    if (!navigator.onLine) { ids.forEach(id => enqueue('deleteExpense', { id })); return }
    const { error: err } = await supabase.from('expenses').delete().in('id', ids)
    if (err && isNetworkError(err)) ids.forEach(id => enqueue('deleteExpense', { id }))
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Income ───────────────────────────────────────────────
  const addIncome = useCallback(async (inc) => {
    setIncome(prev => [{ ...inc, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addIncome', inc); return }
    const { data, error: err } = await supabase.from('income').insert(incomeToDb(inc, userId)).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addIncome', inc) }
      else { setError(err.message); setIncome(prev => prev.filter(i => i.id !== inc.id)) }
      return
    }
    setIncome(prev => prev.map(i => i.id === inc.id ? incomeFromDb(data) : i))
  }, [userId, enqueue])

  const editIncome = useCallback(async (inc) => {
    setIncome(prev => prev.map(i => i.id === inc.id ? { ...inc, _pending: true } : i))
    if (!navigator.onLine) { enqueue('editIncome', inc); return }
    const { data, error: err } = await supabase.from('income').update(incomeToDb(inc, userId)).eq('id', inc.id).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('editIncome', inc) }
      else { setError(err.message) }
      return
    }
    setIncome(prev => prev.map(i => i.id === inc.id ? incomeFromDb(data) : i))
  }, [userId, enqueue])

  const deleteIncome = useCallback(async (id) => {
    setIncome(prev => prev.filter(i => i.id !== id))
    if (!navigator.onLine) { enqueue('deleteIncome', { id }); return }
    const { error: err } = await supabase.from('income').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteIncome', { id })
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Budgets ──────────────────────────────────────────────
  const saveBudgets = useCallback(async (nb) => {
    setBudgets(nb)
    if (!navigator.onLine) { enqueue('saveBudgets', nb); return }
    const { error: err } = await supabase.from('budgets').upsert({
      user_id: userId, daily: nb.daily || 0, weekly: nb.weekly || 0,
      monthly: nb.monthly || 0, categories: nb.categories || {},
      updated_at: new Date().toISOString(),
    })
    if (err && isNetworkError(err)) enqueue('saveBudgets', nb)
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Goals ─────────────────────────────────────────────────
  const addGoal = useCallback(async (goal) => {
    setGoals(prev => [{ ...goal, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addGoal', goal); return }
    const { data, error: err } = await supabase.from('goals').insert({
      id: goal.id, user_id: userId, name: goal.name, target: goal.target,
      target_date: goal.targetDate || null, icon: goal.icon || '🎯', note: goal.note || null,
    }).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addGoal', goal) }
      else { setError(err.message); setGoals(prev => prev.filter(g => g.id !== goal.id)) }
      return
    }
    setGoals(prev => prev.map(g => g.id === goal.id ? {
      id: data.id, name: data.name, target: parseFloat(data.target),
      targetDate: data.target_date || '', icon: data.icon || '🎯',
      note: data.note || '', createdAt: data.created_at || '',
    } : g))
  }, [userId, enqueue])

  const deleteGoal = useCallback(async (id) => {
    setGoals(prev => prev.filter(g => g.id !== id))
    setContributions(prev => prev.filter(c => c.goalId !== id))
    if (!navigator.onLine) { enqueue('deleteGoal', { id }); return }
    const { error: err } = await supabase.from('goals').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteGoal', { id })
    else if (err) setError(err.message)
  }, [userId, enqueue])

  const addContribution = useCallback(async (goalId, contrib) => {
    setContributions(prev => [{ ...contrib, goalId, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addContribution', { ...contrib, goalId }); return }
    const { data, error: err } = await supabase.from('goal_contributions').insert({
      id: contrib.id, goal_id: goalId, user_id: userId,
      date: contrib.date, amount: contrib.amount, note: contrib.note || null,
    }).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addContribution', { ...contrib, goalId }) }
      else { setError(err.message); setContributions(prev => prev.filter(c => c.id !== contrib.id)) }
      return
    }
    setContributions(prev => prev.map(c => c.id === contrib.id
      ? { id: data.id, goalId: data.goal_id, date: data.date, amount: parseFloat(data.amount), note: data.note || '' }
      : c))
  }, [userId, enqueue])

  const deleteContribution = useCallback(async (contribId) => {
    setContributions(prev => prev.filter(c => c.id !== contribId))
    if (!navigator.onLine) { enqueue('deleteContribution', { id: contribId }); return }
    const { error: err } = await supabase.from('goal_contributions').delete().eq('id', contribId)
    if (err && isNetworkError(err)) enqueue('deleteContribution', { id: contribId })
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Bulk import ──────────────────────────────────────────
  const bulkAddExpenses = useCallback(async (exps) => {
    if (!exps.length) return { added: 0, errors: 0 }
    const rows = exps.map(e => expenseToDb(e, userId))
    const { data, error: err } = await supabase.from('expenses').insert(rows).select()
    if (err) { setError(err.message); return { added: 0, errors: exps.length } }
    setExpenses(prev => [...(data || []).map(expenseFromDb), ...prev])
    return { added: (data || []).length, errors: 0 }
  }, [userId])

  const bulkAddIncome = useCallback(async (incs) => {
    if (!incs.length) return { added: 0, errors: 0 }
    const rows = incs.map(i => incomeToDb(i, userId))
    const { data, error: err } = await supabase.from('income').insert(rows).select()
    if (err) { setError(err.message); return { added: 0, errors: incs.length } }
    setIncome(prev => [...(data || []).map(incomeFromDb), ...prev])
    return { added: (data || []).length, errors: 0 }
  }, [userId])

  // ── Clear / danger zone ──────────────────────────────────
  const clearExpenses = useCallback(async () => {
    const { error: err } = await supabase.from('expenses').delete().eq('user_id', userId)
    if (err) { setError(err.message); return }
    setExpenses([])
  }, [userId])

  const clearIncome = useCallback(async () => {
    const { error: err } = await supabase.from('income').delete().eq('user_id', userId)
    if (err) { setError(err.message); return }
    setIncome([])
  }, [userId])

  const clearAll = useCallback(async () => {
    await Promise.all([
      supabase.from('expenses').delete().eq('user_id', userId),
      supabase.from('income').delete().eq('user_id', userId),
    ])
    setExpenses([])
    setIncome([])
  }, [userId])

  const factoryReset = useCallback(async () => {
    await Promise.all([
      supabase.from('expenses').delete().eq('user_id', userId),
      supabase.from('income').delete().eq('user_id', userId),
      supabase.from('budgets').delete().eq('user_id', userId),
      supabase.from('goals').delete().eq('user_id', userId),
      supabase.from('goal_contributions').delete().eq('user_id', userId),
    ])
    setExpenses([])
    setIncome([])
    setBudgets({ daily: 0, weekly: 0, monthly: 0, categories: {} })
    setGoals([])
    setContributions([])
    try {
      ['et_v6_rates', 'et_v6_dark', 'et_v6_cb', 'et_v6_base', 'et_v6_retry_queue'].forEach(k => localStorage.removeItem(k))
    } catch {}
  }, [userId])

  return {
    expenses, income, budgets, goals, contributions,
    loading, error,
    pendingCount: queue.length,
    syncing,
    online,
    realtimeStatus,
    addExpense, editExpense, deleteExpense, deleteManyExpenses,
    addIncome,  editIncome,  deleteIncome,
    saveBudgets,
    addGoal, deleteGoal, addContribution, deleteContribution,
    bulkAddExpenses, bulkAddIncome,
    clearExpenses, clearIncome, clearAll, factoryReset,
  }
}

// Read queue directly from localStorage (needed inside replay to get fresh snapshot)
function loadQueueSnapshot() {
  try { return JSON.parse(localStorage.getItem('et_v6_retry_queue') || '[]') } catch { return [] }
}
