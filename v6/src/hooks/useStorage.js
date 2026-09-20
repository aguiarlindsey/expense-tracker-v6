import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { useRetryQueue, topoSort } from './useRetryQueue'

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
    tax_amount:          e.taxAmount || 0,
    tax_breakdown:       e.taxBreakdown && Object.keys(e.taxBreakdown).length ? e.taxBreakdown : null,
    fuel_rate:               e.fuelRate || null,
    fuel_quantity:           e.fuelQuantity || null,
    fuel_type:               e.fuelType || null,
    odo_reading:             e.odoReading   ? parseFloat(e.odoReading)   : null,
    trip_a_reading:          e.tripA        ? parseFloat(e.tripA)        : null,
    trip_b_reading:          e.tripB        ? parseFloat(e.tripB)        : null,
    trip_selected:           e.tripSelected || null,
    vehicle_km_at_service:   e.vehicleCurrentKm    ? parseInt(e.vehicleCurrentKm, 10)    || null : null,
    vehicle_next_service_km: e.vehicleNextServiceKm ? parseInt(e.vehicleNextServiceKm, 10) || null : null,
    asset_type:              e.assetType || null,
    asset_id:                e.assetId || null,
    service_parts:           Array.isArray(e.serviceParts) && e.serviceParts.length ? e.serviceParts : null,
    card_id:                 e.cardId || null,
    fingerprint:             e._fp || null,
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
    taxAmount:          parseFloat(row.tax_amount || 0),
    taxBreakdown:       row.tax_breakdown || {},
    fuelRate:            row.fuel_rate ? parseFloat(row.fuel_rate) : null,
    fuelQuantity:        row.fuel_quantity ? parseFloat(row.fuel_quantity) : null,
    fuelType:            row.fuel_type || null,
    odoReading:          row.odo_reading    ? parseFloat(row.odo_reading)    : null,
    tripA:               row.trip_a_reading ? parseFloat(row.trip_a_reading) : null,
    tripB:               row.trip_b_reading ? parseFloat(row.trip_b_reading) : null,
    tripSelected:        row.trip_selected  || null,
    vehicleCurrentKm:    row.vehicle_km_at_service    ? parseInt(row.vehicle_km_at_service)    : null,
    vehicleNextServiceKm: row.vehicle_next_service_km ? parseInt(row.vehicle_next_service_km) : null,
    assetType:           row.asset_type || null,
    assetId:             row.asset_id || null,
    serviceParts:        row.service_parts || [],
    cardId:              row.card_id || null,
    _fp:                 row.fingerprint || '',
    migratedFrom:       row.migrated_from || '',
    importedFrom:       row.imported_from || '',
    version:            6,
    _rowVersion:        row.row_version || 1,
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
    _rowVersion:     row.row_version || 1,
  }
}

// ── Trip mappers ──────────────────────────────────────────

function tripToDb(t, userId) {
  return {
    id:         t.id,
    user_id:    userId,
    name:       t.name,
    start_date: t.startDate,
    end_date:   t.endDate,
    currency:   t.currency,
    notes:      t.notes || null,
  }
}

function tripFromDb(row) {
  return {
    id:          row.id,
    name:        row.name,
    startDate:   row.start_date,
    endDate:     row.end_date,
    currency:    row.currency,
    notes:       row.notes || '',
    createdAt:   row.created_at || '',
    _rowVersion: row.row_version || 1,
  }
}

// ── Vehicle mappers ───────────────────────────────────────

function vehicleToDb(v, userId) {
  return {
    id:            v.id,
    user_id:       userId,
    name:          v.name,
    type:          v.type || 'car',
    fuel_type:     v.fuelType || 'petrol',
    reg_number:    v.regNumber || null,
    purchase_date: v.purchaseDate || null,
    next_puc_date: v.nextPucDate || null,
    notes:         v.notes || null,
  }
}

function vehicleFromDb(row) {
  return {
    id:           row.id,
    name:         row.name,
    type:         row.type || 'car',
    fuelType:     row.fuel_type || 'petrol',
    regNumber:    row.reg_number || '',
    purchaseDate: row.purchase_date || '',
    nextPucDate:  row.next_puc_date || '',
    notes:        row.notes || '',
    createdAt:    row.created_at || '',
    _rowVersion:  row.row_version || 1,
  }
}

// ── Credit card mappers ───────────────────────────────────

function cardToDb(c, userId) {
  return {
    id:                c.id,
    user_id:           userId,
    name:              c.name,
    bank:              c.bank || null,
    last4:             c.last4 || null,
    credit_limit:      c.creditLimit ? parseFloat(c.creditLimit) : null,
    billing_cycle_day: c.billingCycleDay ? parseInt(c.billingCycleDay, 10) : null,
    due_day:           c.dueDay ? parseInt(c.dueDay, 10) : null,
    notes:             c.notes || null,
  }
}

function cardFromDb(row) {
  return {
    id:               row.id,
    name:             row.name,
    bank:             row.bank || '',
    last4:            row.last4 || '',
    creditLimit:      row.credit_limit ? parseFloat(row.credit_limit) : null,
    billingCycleDay:  row.billing_cycle_day || null,
    dueDay:           row.due_day || null,
    notes:            row.notes || '',
    createdAt:        row.created_at || '',
    _rowVersion:      row.row_version || 1,
  }
}

// ── House mappers ──────────────────────────────────────────

function houseToDb(h, userId) {
  return {
    id:            h.id,
    user_id:       userId,
    name:          h.name,
    address:       h.address || null,
    ownership:     h.ownership || 'owned',
    move_in_date:  h.moveInDate || null,
    rent_amount:         h.rentAmount ? parseFloat(h.rentAmount) : null,
    rent_due_day:        h.rentDueDay ? parseInt(h.rentDueDay, 10) : null,
    electricity_due_day: h.electricityDueDay ? parseInt(h.electricityDueDay, 10) : null,
    maintenance_due_day: h.maintenanceDueDay ? parseInt(h.maintenanceDueDay, 10) : null,
    notes:         h.notes || null,
  }
}

function houseFromDb(row) {
  return {
    id:           row.id,
    name:         row.name,
    address:      row.address || '',
    ownership:    row.ownership || 'owned',
    moveInDate:   row.move_in_date || '',
    rentAmount:         row.rent_amount ? parseFloat(row.rent_amount) : null,
    rentDueDay:         row.rent_due_day || null,
    electricityDueDay:  row.electricity_due_day || null,
    maintenanceDueDay:  row.maintenance_due_day || null,
    notes:        row.notes || '',
    createdAt:    row.created_at || '',
    _rowVersion:  row.row_version || 1,
  }
}

// ── Other Asset mappers ────────────────────────────────────

function otherAssetToDb(o, userId) {
  return {
    id:             o.id,
    user_id:        userId,
    name:           o.name,
    category:       o.category || 'Other',
    purchase_date:  o.purchaseDate || null,
    purchase_price: o.purchasePrice ? parseFloat(o.purchasePrice) : null,
    reminder_label: o.reminderLabel || null,
    reminder_date:  o.reminderDate || null,
    emi_amount:     o.emiAmount ? parseFloat(o.emiAmount) : null,
    emi_due_day:    o.emiDueDay ? parseInt(o.emiDueDay, 10) : null,
    notes:          o.notes || null,
  }
}

function otherAssetFromDb(row) {
  return {
    id:             row.id,
    name:           row.name,
    category:       row.category || 'Other',
    purchaseDate:   row.purchase_date || '',
    purchasePrice:  row.purchase_price ? parseFloat(row.purchase_price) : null,
    reminderLabel:  row.reminder_label || '',
    reminderDate:   row.reminder_date || '',
    emiAmount:      row.emi_amount ? parseFloat(row.emi_amount) : null,
    emiDueDay:      row.emi_due_day || null,
    notes:          row.notes || '',
    createdAt:      row.created_at || '',
    _rowVersion:    row.row_version || 1,
  }
}

// ── Debt mappers ───────────────────────────────────────────

function debtToDb(d, userId) {
  return {
    id:              d.id,
    user_id:         userId,
    name:            d.name,
    principal:       parseFloat(d.principal) || 0,
    interest_rate:   parseFloat(d.interestRate) || 0,
    term_months:     parseInt(d.termMonths, 10) || 0,
    minimum_payment: parseFloat(d.minimumPayment) || 0,
    start_date:      d.startDate || null,
    notes:           d.notes || null,
    months_paid:     parseInt(d.monthsPaid, 10) || 0,
    extra_payments:  d.extraPayments || [],
    rate_changes:    d.rateChanges || [],
    rate_method:     d.rateMethod || 'monthly',
  }
}

function debtFromDb(row) {
  return {
    id:             row.id,
    name:           row.name,
    principal:      parseFloat(row.principal) || 0,
    interestRate:   parseFloat(row.interest_rate) || 0,
    termMonths:     row.term_months || 0,
    minimumPayment: parseFloat(row.minimum_payment) || 0,
    startDate:      row.start_date || '',
    notes:          row.notes || '',
    monthsPaid:     row.months_paid || 0,
    extraPayments:  row.extra_payments || [],
    rateChanges:    row.rate_changes || [],
    rateMethod:     row.rate_method || 'monthly',
    createdAt:      row.created_at || '',
    _rowVersion:    row.row_version || 1,
  }
}

// ── Hook ─────────────────────────────────────────────────

export function useStorage(userId) {
  const [expenses,      setExpenses]      = useState([])
  const [income,        setIncome]        = useState([])
  const [budgets,       setBudgets]       = useState({ daily: 0, weekly: 0, monthly: 0, categories: {}, rolloverEnabled: {} })
  const [goals,         setGoals]         = useState([])
  const [contributions, setContributions] = useState([])
  const [trips,         setTrips]         = useState([])
  const [vehicles,      setVehicles]      = useState([])
  const [creditCards,   setCreditCards]   = useState([])
  const [houses,        setHouses]        = useState([])
  const [otherAssets,   setOtherAssets]   = useState([])
  const [debts,         setDebts]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [syncing,         setSyncing]         = useState(false)
  const [realtimeStatus,  setRealtimeStatus]  = useState('connecting')
  const [conflicts,       setConflicts]       = useState([])

  // Auto-expire conflicts older than 1 hour to prevent unbounded memory growth
  useEffect(() => {
    if (conflicts.length === 0) return
    const t = setTimeout(() => {
      const cutoff = Date.now() - 60 * 60 * 1000
      setConflicts(prev => prev.filter(c => new Date(c.detectedAt).getTime() > cutoff))
    }, 60 * 60 * 1000)
    return () => clearTimeout(t)
  }, [conflicts.length])

  const { queue, online, enqueue, remove, bumpAttempts, dropExhausted } = useRetryQueue()

  // ── Conflict helpers ──────────────────────────────────
  function makeConflictId() {
    return `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }

  function addConflict(table, local, remote) {
    setConflicts(prev => {
      if (prev.some(c => c.table === table && c.local.id === local.id)) return prev
      return [...prev, { id: makeConflictId(), table, local, remote, detectedAt: new Date().toISOString() }]
    })
  }

  // ── Initial load — all 6 tables in one round-trip ────
  useEffect(() => {
    if (!userId) return
    let mounted = true
    setLoading(true)
    setError(null)
    Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('income').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('goal_contributions').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('trips').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
      supabase.from('vehicles').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('credit_cards').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('houses').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('other_assets').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('debts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]).then(([expRes, incRes, budRes, gRes, cRes, tRes, vRes, ccRes, hRes, oaRes, dRes]) => {
      if (!mounted) return
      if (expRes.error) setError(expRes.error.message)
      if (incRes.error) setError(incRes.error.message)
      setExpenses((expRes.data || []).map(expenseFromDb))
      setIncome((incRes.data || []).map(incomeFromDb))
      if (budRes.data) {
        setBudgets({
          daily:           parseFloat(budRes.data.daily)   || 0,
          weekly:          parseFloat(budRes.data.weekly)  || 0,
          monthly:         parseFloat(budRes.data.monthly) || 0,
          categories:      budRes.data.categories      || {},
          rolloverEnabled: budRes.data.rollover_enabled || {},
        })
      }
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
      setTrips((tRes.data || []).map(tripFromDb))
      setVehicles((vRes.data || []).map(vehicleFromDb))
      setCreditCards((ccRes.data || []).map(cardFromDb))
      setHouses((hRes.data || []).map(houseFromDb))
      if (oaRes.error) setError(oaRes.error.message)
      setOtherAssets((oaRes.data || []).map(otherAssetFromDb))
      if (dRes.error) setError(dRes.error.message)
      setDebts((dRes.data || []).map(debtFromDb))
      setLoading(false)
    })
    return () => { mounted = false }
  }, [userId])

  // ── Realtime event handlers ───────────────────────────────

  function handleExpenseEvent(event, payload) {
    // Guard: ensure realtime events only apply to current user's data
    if (payload.new?.user_id && payload.new.user_id !== userId) return
    if (payload.old?.user_id && payload.old.user_id !== userId) return
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
    if (payload.new?.user_id && payload.new.user_id !== userId) return
    if (payload.old?.user_id && payload.old.user_id !== userId) return
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
      daily:           parseFloat(row.daily)   || 0,
      weekly:          parseFloat(row.weekly)  || 0,
      monthly:         parseFloat(row.monthly) || 0,
      categories:      row.categories     || {},
      rolloverEnabled: row.rollover_enabled || {},
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

  function handleTripEvent(payload) {
    if (payload.eventType === 'INSERT') {
      const incoming = tripFromDb(payload.new)
      setTrips(prev => {
        if (prev.some(t => t.id === incoming.id && !t._pending)) return prev
        const hasPending = prev.some(t => t.id === incoming.id && t._pending)
        if (hasPending) return prev.map(t => t.id === incoming.id ? incoming : t)
        return [incoming, ...prev]
      })
    } else if (payload.eventType === 'UPDATE') {
      setTrips(prev => prev.map(t => t.id === payload.new.id ? tripFromDb(payload.new) : t))
    } else if (payload.eventType === 'DELETE') {
      setTrips(prev => prev.filter(t => t.id !== payload.old.id))
    }
  }

  function handleVehicleEvent(payload) {
    if (payload.eventType === 'INSERT') {
      const incoming = vehicleFromDb(payload.new)
      setVehicles(prev => {
        if (prev.some(v => v.id === incoming.id && !v._pending)) return prev
        const hasPending = prev.some(v => v.id === incoming.id && v._pending)
        if (hasPending) return prev.map(v => v.id === incoming.id ? incoming : v)
        return [incoming, ...prev]
      })
    } else if (payload.eventType === 'UPDATE') {
      setVehicles(prev => prev.map(v => v.id === payload.new.id ? vehicleFromDb(payload.new) : v))
    } else if (payload.eventType === 'DELETE') {
      setVehicles(prev => prev.filter(v => v.id !== payload.old.id))
    }
  }

  function handleCardEvent(payload) {
    if (payload.eventType === 'INSERT') {
      const incoming = cardFromDb(payload.new)
      setCreditCards(prev => {
        if (prev.some(c => c.id === incoming.id && !c._pending)) return prev
        const hasPending = prev.some(c => c.id === incoming.id && c._pending)
        if (hasPending) return prev.map(c => c.id === incoming.id ? incoming : c)
        return [incoming, ...prev]
      })
    } else if (payload.eventType === 'UPDATE') {
      setCreditCards(prev => prev.map(c => c.id === payload.new.id ? cardFromDb(payload.new) : c))
    } else if (payload.eventType === 'DELETE') {
      setCreditCards(prev => prev.filter(c => c.id !== payload.old.id))
    }
  }

  function handleHouseEvent(payload) {
    if (payload.eventType === 'INSERT') {
      const incoming = houseFromDb(payload.new)
      setHouses(prev => {
        if (prev.some(h => h.id === incoming.id && !h._pending)) return prev
        const hasPending = prev.some(h => h.id === incoming.id && h._pending)
        if (hasPending) return prev.map(h => h.id === incoming.id ? incoming : h)
        return [incoming, ...prev]
      })
    } else if (payload.eventType === 'UPDATE') {
      setHouses(prev => prev.map(h => h.id === payload.new.id ? houseFromDb(payload.new) : h))
    } else if (payload.eventType === 'DELETE') {
      setHouses(prev => prev.filter(h => h.id !== payload.old.id))
    }
  }

  function handleOtherAssetEvent(payload) {
    if (payload.eventType === 'INSERT') {
      const incoming = otherAssetFromDb(payload.new)
      setOtherAssets(prev => {
        if (prev.some(o => o.id === incoming.id && !o._pending)) return prev
        const hasPending = prev.some(o => o.id === incoming.id && o._pending)
        if (hasPending) return prev.map(o => o.id === incoming.id ? incoming : o)
        return [incoming, ...prev]
      })
    } else if (payload.eventType === 'UPDATE') {
      setOtherAssets(prev => prev.map(o => o.id === payload.new.id ? otherAssetFromDb(payload.new) : o))
    } else if (payload.eventType === 'DELETE') {
      setOtherAssets(prev => prev.filter(o => o.id !== payload.old.id))
    }
  }

  function handleDebtEvent(payload) {
    if (payload.eventType === 'INSERT') {
      const incoming = debtFromDb(payload.new)
      setDebts(prev => {
        if (prev.some(d => d.id === incoming.id && !d._pending)) return prev
        const hasPending = prev.some(d => d.id === incoming.id && d._pending)
        if (hasPending) return prev.map(d => d.id === incoming.id ? incoming : d)
        return [incoming, ...prev]
      })
    } else if (payload.eventType === 'UPDATE') {
      setDebts(prev => prev.map(d => d.id === payload.new.id ? debtFromDb(payload.new) : d))
    } else if (payload.eventType === 'DELETE') {
      setDebts(prev => prev.filter(d => d.id !== payload.old.id))
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
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'trips',              filter: `user_id=eq.${userId}` }, p => handleTripEvent(p))
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'vehicles',           filter: `user_id=eq.${userId}` }, p => handleVehicleEvent(p))
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'credit_cards',        filter: `user_id=eq.${userId}` }, p => handleCardEvent(p))
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'houses',              filter: `user_id=eq.${userId}` }, p => handleHouseEvent(p))
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'other_assets',        filter: `user_id=eq.${userId}` }, p => handleOtherAssetEvent(p))
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'debts',                filter: `user_id=eq.${userId}` }, p => handleDebtEvent(p))
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
        const rowVersion = payload._rowVersion || 1
        const { data, error: err } = await supabase
          .from('expenses').update(expenseToDb(payload, userId))
          .eq('id', payload.id).eq('row_version', rowVersion).select()
        if (err) throw new Error(err.message)
        if (!data || data.length === 0) {
          const { data: dbRow } = await supabase.from('expenses').select('*').eq('id', payload.id).single()
          if (dbRow) addConflict('expenses', payload, expenseFromDb(dbRow))
          else setError('This expense was deleted on another device.')
          break
        }
        setExpenses(prev => prev.map(e => e.id === payload.id ? expenseFromDb(data[0]) : e))
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
        const rowVersion = payload._rowVersion || 1
        const { data, error: err } = await supabase
          .from('income').update(incomeToDb(payload, userId))
          .eq('id', payload.id).eq('row_version', rowVersion).select()
        if (err) throw new Error(err.message)
        if (!data || data.length === 0) {
          const { data: dbRow } = await supabase.from('income').select('*').eq('id', payload.id).single()
          if (dbRow) addConflict('income', payload, incomeFromDb(dbRow))
          else setError('This income entry was deleted on another device.')
          break
        }
        setIncome(prev => prev.map(i => i.id === payload.id ? incomeFromDb(data[0]) : i))
        break
      }
      case 'deleteIncome': {
        const { error: err } = await supabase.from('income').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'addVehicle': {
        const { data, error: err } = await supabase.from('vehicles').insert(vehicleToDb(payload, userId)).select().single()
        if (err) throw new Error(err.message)
        setVehicles(prev => prev.map(v => v.id === payload.id ? vehicleFromDb(data) : v))
        break
      }
      case 'editVehicle': {
        const rowVersion = payload._rowVersion || 1
        const { data, error: err } = await supabase
          .from('vehicles').update(vehicleToDb(payload, userId))
          .eq('id', payload.id).eq('row_version', rowVersion).select()
        if (err) throw new Error(err.message)
        if (!data || data.length === 0) {
          const { data: dbRow } = await supabase.from('vehicles').select('*').eq('id', payload.id).single()
          if (dbRow) addConflict('vehicles', payload, vehicleFromDb(dbRow))
          else setError('This vehicle was deleted on another device.')
          break
        }
        setVehicles(prev => prev.map(v => v.id === payload.id ? vehicleFromDb(data[0]) : v))
        break
      }
      case 'deleteVehicle': {
        const { error: err } = await supabase.from('vehicles').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'addCreditCard': {
        const { data, error: err } = await supabase.from('credit_cards').insert(cardToDb(payload, userId)).select().single()
        if (err) throw new Error(err.message)
        setCreditCards(prev => prev.map(c => c.id === payload.id ? cardFromDb(data) : c))
        break
      }
      case 'editCreditCard': {
        const rowVersion = payload._rowVersion || 1
        const { data, error: err } = await supabase
          .from('credit_cards').update(cardToDb(payload, userId))
          .eq('id', payload.id).eq('row_version', rowVersion).select()
        if (err) throw new Error(err.message)
        if (!data || data.length === 0) {
          const { data: dbRow } = await supabase.from('credit_cards').select('*').eq('id', payload.id).single()
          if (dbRow) addConflict('credit_cards', payload, cardFromDb(dbRow))
          else setError('This card was deleted on another device.')
          break
        }
        setCreditCards(prev => prev.map(c => c.id === payload.id ? cardFromDb(data[0]) : c))
        break
      }
      case 'deleteCreditCard': {
        const { error: err } = await supabase.from('credit_cards').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'addHouse': {
        const { data, error: err } = await supabase.from('houses').insert(houseToDb(payload, userId)).select().single()
        if (err) throw new Error(err.message)
        setHouses(prev => prev.map(h => h.id === payload.id ? houseFromDb(data) : h))
        break
      }
      case 'editHouse': {
        const rowVersion = payload._rowVersion || 1
        const { data, error: err } = await supabase
          .from('houses').update(houseToDb(payload, userId))
          .eq('id', payload.id).eq('row_version', rowVersion).select()
        if (err) throw new Error(err.message)
        if (!data || data.length === 0) {
          const { data: dbRow } = await supabase.from('houses').select('*').eq('id', payload.id).single()
          if (dbRow) addConflict('houses', payload, houseFromDb(dbRow))
          else setError('This house was deleted on another device.')
          break
        }
        setHouses(prev => prev.map(h => h.id === payload.id ? houseFromDb(data[0]) : h))
        break
      }
      case 'deleteHouse': {
        const { error: err } = await supabase.from('houses').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'addOtherAsset': {
        const { data, error: err } = await supabase.from('other_assets').insert(otherAssetToDb(payload, userId)).select().single()
        if (err) throw new Error(err.message)
        setOtherAssets(prev => prev.map(o => o.id === payload.id ? otherAssetFromDb(data) : o))
        break
      }
      case 'editOtherAsset': {
        const rowVersion = payload._rowVersion || 1
        const { data, error: err } = await supabase
          .from('other_assets').update(otherAssetToDb(payload, userId))
          .eq('id', payload.id).eq('row_version', rowVersion).select()
        if (err) throw new Error(err.message)
        if (!data || data.length === 0) {
          const { data: dbRow } = await supabase.from('other_assets').select('*').eq('id', payload.id).single()
          if (dbRow) addConflict('other_assets', payload, otherAssetFromDb(dbRow))
          else setError('This item was deleted on another device.')
          break
        }
        setOtherAssets(prev => prev.map(o => o.id === payload.id ? otherAssetFromDb(data[0]) : o))
        break
      }
      case 'deleteOtherAsset': {
        const { error: err } = await supabase.from('other_assets').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'addDebt': {
        const { data, error: err } = await supabase.from('debts').insert(debtToDb(payload, userId)).select().single()
        if (err) throw new Error(err.message)
        setDebts(prev => prev.map(d => d.id === payload.id ? debtFromDb(data) : d))
        break
      }
      case 'editDebt': {
        const rowVersion = payload._rowVersion || 1
        const { data, error: err } = await supabase
          .from('debts').update(debtToDb(payload, userId))
          .eq('id', payload.id).eq('row_version', rowVersion).select()
        if (err) throw new Error(err.message)
        if (!data || data.length === 0) {
          const { data: dbRow } = await supabase.from('debts').select('*').eq('id', payload.id).single()
          if (dbRow) addConflict('debts', payload, debtFromDb(dbRow))
          else setError('This debt was deleted on another device.')
          break
        }
        setDebts(prev => prev.map(d => d.id === payload.id ? debtFromDb(data[0]) : d))
        break
      }
      case 'deleteDebt': {
        const { error: err } = await supabase.from('debts').delete().eq('id', payload.id)
        if (err) throw new Error(err.message)
        break
      }
      case 'saveBudgets': {
        const { error: err } = await supabase.from('budgets').upsert({
          user_id: userId, daily: payload.daily || 0, weekly: payload.weekly || 0,
          monthly: payload.monthly || 0, categories: payload.categories || {},
          rollover_enabled: payload.rolloverEnabled || {},
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
    const raw = loadQueueSnapshot()
    if (!raw.length || syncing) return
    setSyncing(true)
    const snapshot = topoSort(raw)
    const completed = new Set()
    const rawIds = new Set(raw.map(i => i.id))

    for (const item of snapshot) {
      // Skip if any dep is still pending (don't bump — not our fault)
      const depsReady = (item.dependsOn || []).every(dep => completed.has(dep) || !rawIds.has(dep))
      if (!depsReady) continue
      try {
        await executeOp(item.op, item.payload)
        remove(item.id)
        completed.add(item.id)
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
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addExpense' && i.payload.id === exp.id).map(i => i.id)
    if (!navigator.onLine) { enqueue('editExpense', exp, deps()); return }
    const rowVersion = exp._rowVersion || 1
    const { data, error: err } = await supabase
      .from('expenses')
      .update(expenseToDb(exp, userId))
      .eq('id', exp.id)
      .eq('row_version', rowVersion)
      .select()
    if (err) {
      if (isNetworkError(err)) { enqueue('editExpense', exp, deps()) }
      else { setError(err.message) }
      return
    }
    if (!data || data.length === 0) {
      const { data: dbRow } = await supabase.from('expenses').select('*').eq('id', exp.id).single()
      if (dbRow) addConflict('expenses', exp, expenseFromDb(dbRow))
      else setError('This expense was deleted on another device.')
      setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, _pending: false } : e))
      return
    }
    setExpenses(prev => prev.map(e => e.id === exp.id ? expenseFromDb(data[0]) : e))
  }, [userId, enqueue]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteExpense = useCallback(async (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
    const deps = () => loadQueueSnapshot().filter(i => ['addExpense','editExpense'].includes(i.op) && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteExpense', { id }, deps()); return }
    const { error: err } = await supabase.from('expenses').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteExpense', { id }, deps())
    else if (err) setError(err.message)
  }, [userId, enqueue])

  const deleteManyExpenses = useCallback(async (ids) => {
    const idSet = new Set(ids)
    setExpenses(prev => prev.filter(e => !idSet.has(e.id)))
    const deps = (id) => loadQueueSnapshot().filter(i => ['addExpense','editExpense'].includes(i.op) && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { ids.forEach(id => enqueue('deleteExpense', { id }, deps(id))); return }
    const { error: err } = await supabase.from('expenses').delete().in('id', ids)
    if (err && isNetworkError(err)) ids.forEach(id => enqueue('deleteExpense', { id }, deps(id)))
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
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addIncome' && i.payload.id === inc.id).map(i => i.id)
    if (!navigator.onLine) { enqueue('editIncome', inc, deps()); return }
    const rowVersion = inc._rowVersion || 1
    const { data, error: err } = await supabase
      .from('income')
      .update(incomeToDb(inc, userId))
      .eq('id', inc.id)
      .eq('row_version', rowVersion)
      .select()
    if (err) {
      if (isNetworkError(err)) { enqueue('editIncome', inc, deps()) }
      else { setError(err.message) }
      return
    }
    if (!data || data.length === 0) {
      const { data: dbRow } = await supabase.from('income').select('*').eq('id', inc.id).single()
      if (dbRow) addConflict('income', inc, incomeFromDb(dbRow))
      else setError('This income entry was deleted on another device.')
      setIncome(prev => prev.map(i => i.id === inc.id ? { ...i, _pending: false } : i))
      return
    }
    setIncome(prev => prev.map(i => i.id === inc.id ? incomeFromDb(data[0]) : i))
  }, [userId, enqueue]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteIncome = useCallback(async (id) => {
    setIncome(prev => prev.filter(i => i.id !== id))
    const deps = () => loadQueueSnapshot().filter(i => ['addIncome','editIncome'].includes(i.op) && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteIncome', { id }, deps()); return }
    const { error: err } = await supabase.from('income').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteIncome', { id }, deps())
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Budgets ──────────────────────────────────────────────
  const saveBudgets = useCallback(async (nb) => {
    setBudgets(nb)
    if (!navigator.onLine) { enqueue('saveBudgets', nb); return }
    const { error: err } = await supabase.from('budgets').upsert({
      user_id: userId, daily: nb.daily || 0, weekly: nb.weekly || 0,
      monthly: nb.monthly || 0, categories: nb.categories || {},
      rollover_enabled: nb.rolloverEnabled || {},
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
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addGoal' && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteGoal', { id }, deps()); return }
    const { error: err } = await supabase.from('goals').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteGoal', { id }, deps())
    else if (err) setError(err.message)
  }, [userId, enqueue])

  const addContribution = useCallback(async (goalId, contrib) => {
    setContributions(prev => [{ ...contrib, goalId, _pending: true }, ...prev])
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addGoal' && i.payload.id === goalId).map(i => i.id)
    if (!navigator.onLine) { enqueue('addContribution', { ...contrib, goalId }, deps()); return }
    const { data, error: err } = await supabase.from('goal_contributions').insert({
      id: contrib.id, goal_id: goalId, user_id: userId,
      date: contrib.date, amount: contrib.amount, note: contrib.note || null,
    }).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addContribution', { ...contrib, goalId }, deps()) }
      else { setError(err.message); setContributions(prev => prev.filter(c => c.id !== contrib.id)) }
      return
    }
    setContributions(prev => prev.map(c => c.id === contrib.id
      ? { id: data.id, goalId: data.goal_id, date: data.date, amount: parseFloat(data.amount), note: data.note || '' }
      : c))
  }, [userId, enqueue])

  const deleteContribution = useCallback(async (contribId) => {
    setContributions(prev => prev.filter(c => c.id !== contribId))
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addContribution' && i.payload.id === contribId).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteContribution', { id: contribId }, deps()); return }
    const { error: err } = await supabase.from('goal_contributions').delete().eq('id', contribId)
    if (err && isNetworkError(err)) enqueue('deleteContribution', { id: contribId }, deps())
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Trips ─────────────────────────────────────────────────
  const addTrip = useCallback(async (trip) => {
    setTrips(prev => [{ ...trip, _pending: true }, ...prev])
    const { data, error: err } = await supabase.from('trips').insert(tripToDb(trip, userId)).select().single()
    if (err) { setError(err.message); setTrips(prev => prev.filter(t => t.id !== trip.id)); return }
    setTrips(prev => prev.map(t => t.id === trip.id ? tripFromDb(data) : t))
  }, [userId])

  const editTrip = useCallback(async (trip) => {
    setTrips(prev => prev.map(t => t.id === trip.id ? { ...trip, _pending: true } : t))
    const rowVersion = trip._rowVersion || 1
    const { data, error: err } = await supabase
      .from('trips')
      .update(tripToDb(trip, userId))
      .eq('id', trip.id)
      .eq('row_version', rowVersion)
      .select()
    if (err) { setError(err.message); return }
    if (!data || data.length === 0) {
      const { data: dbRow } = await supabase.from('trips').select('*').eq('id', trip.id).single()
      if (dbRow) addConflict('trips', trip, tripFromDb(dbRow))
      else setError('This trip was deleted on another device.')
      setTrips(prev => prev.map(t => t.id === trip.id ? { ...t, _pending: false } : t))
      return
    }
    setTrips(prev => prev.map(t => t.id === trip.id ? tripFromDb(data[0]) : t))
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteTrip = useCallback(async (id) => {
    setTrips(prev => prev.filter(t => t.id !== id))
    const { error: err } = await supabase.from('trips').delete().eq('id', id)
    if (err) setError(err.message)
  }, [userId])

  // ── Vehicles ─────────────────────────────────────────────
  const addVehicle = useCallback(async (vehicle) => {
    setVehicles(prev => [{ ...vehicle, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addVehicle', vehicle); return }
    const { data, error: err } = await supabase.from('vehicles').insert(vehicleToDb(vehicle, userId)).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addVehicle', vehicle) }
      else { setError(err.message); setVehicles(prev => prev.filter(v => v.id !== vehicle.id)) }
      return
    }
    setVehicles(prev => prev.map(v => v.id === vehicle.id ? vehicleFromDb(data) : v))
  }, [userId, enqueue])

  const editVehicle = useCallback(async (vehicle) => {
    setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...vehicle, _pending: true } : v))
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addVehicle' && i.payload.id === vehicle.id).map(i => i.id)
    if (!navigator.onLine) { enqueue('editVehicle', vehicle, deps()); return }
    const rowVersion = vehicle._rowVersion || 1
    const { data, error: err } = await supabase
      .from('vehicles')
      .update(vehicleToDb(vehicle, userId))
      .eq('id', vehicle.id)
      .eq('row_version', rowVersion)
      .select()
    if (err) {
      if (isNetworkError(err)) { enqueue('editVehicle', vehicle, deps()) }
      else { setError(err.message) }
      return
    }
    if (!data || data.length === 0) {
      const { data: dbRow } = await supabase.from('vehicles').select('*').eq('id', vehicle.id).single()
      if (dbRow) addConflict('vehicles', vehicle, vehicleFromDb(dbRow))
      else setError('This vehicle was deleted on another device.')
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...v, _pending: false } : v))
      return
    }
    setVehicles(prev => prev.map(v => v.id === vehicle.id ? vehicleFromDb(data[0]) : v))
  }, [userId, enqueue]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteVehicle = useCallback(async (id) => {
    setVehicles(prev => prev.filter(v => v.id !== id))
    const deps = () => loadQueueSnapshot().filter(i => ['addVehicle','editVehicle'].includes(i.op) && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteVehicle', { id }, deps()); return }
    const { error: err } = await supabase.from('vehicles').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteVehicle', { id }, deps())
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Credit Cards ─────────────────────────────────────────
  const addCreditCard = useCallback(async (card) => {
    setCreditCards(prev => [{ ...card, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addCreditCard', card); return }
    const { data, error: err } = await supabase.from('credit_cards').insert(cardToDb(card, userId)).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addCreditCard', card) }
      else { setError(err.message); setCreditCards(prev => prev.filter(c => c.id !== card.id)) }
      return
    }
    setCreditCards(prev => prev.map(c => c.id === card.id ? cardFromDb(data) : c))
  }, [userId, enqueue])

  const editCreditCard = useCallback(async (card) => {
    setCreditCards(prev => prev.map(c => c.id === card.id ? { ...card, _pending: true } : c))
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addCreditCard' && i.payload.id === card.id).map(i => i.id)
    if (!navigator.onLine) { enqueue('editCreditCard', card, deps()); return }
    const rowVersion = card._rowVersion || 1
    const { data, error: err } = await supabase
      .from('credit_cards')
      .update(cardToDb(card, userId))
      .eq('id', card.id)
      .eq('row_version', rowVersion)
      .select()
    if (err) {
      if (isNetworkError(err)) { enqueue('editCreditCard', card, deps()) }
      else { setError(err.message) }
      return
    }
    if (!data || data.length === 0) {
      const { data: dbRow } = await supabase.from('credit_cards').select('*').eq('id', card.id).single()
      if (dbRow) addConflict('credit_cards', card, cardFromDb(dbRow))
      else setError('This card was deleted on another device.')
      setCreditCards(prev => prev.map(c => c.id === card.id ? { ...c, _pending: false } : c))
      return
    }
    setCreditCards(prev => prev.map(c => c.id === card.id ? cardFromDb(data[0]) : c))
  }, [userId, enqueue]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteCreditCard = useCallback(async (id) => {
    setCreditCards(prev => prev.filter(c => c.id !== id))
    const deps = () => loadQueueSnapshot().filter(i => ['addCreditCard','editCreditCard'].includes(i.op) && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteCreditCard', { id }, deps()); return }
    const { error: err } = await supabase.from('credit_cards').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteCreditCard', { id }, deps())
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Houses ───────────────────────────────────────────────
  const addHouse = useCallback(async (house) => {
    setHouses(prev => [{ ...house, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addHouse', house); return }
    const { data, error: err } = await supabase.from('houses').insert(houseToDb(house, userId)).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addHouse', house) }
      else { setError(err.message); setHouses(prev => prev.filter(h => h.id !== house.id)) }
      return
    }
    setHouses(prev => prev.map(h => h.id === house.id ? houseFromDb(data) : h))
  }, [userId, enqueue])

  const editHouse = useCallback(async (house) => {
    setHouses(prev => prev.map(h => h.id === house.id ? { ...house, _pending: true } : h))
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addHouse' && i.payload.id === house.id).map(i => i.id)
    if (!navigator.onLine) { enqueue('editHouse', house, deps()); return }
    const rowVersion = house._rowVersion || 1
    const { data, error: err } = await supabase
      .from('houses')
      .update(houseToDb(house, userId))
      .eq('id', house.id)
      .eq('row_version', rowVersion)
      .select()
    if (err) {
      if (isNetworkError(err)) { enqueue('editHouse', house, deps()) }
      else { setError(err.message) }
      return
    }
    if (!data || data.length === 0) {
      const { data: dbRow } = await supabase.from('houses').select('*').eq('id', house.id).single()
      if (dbRow) addConflict('houses', house, houseFromDb(dbRow))
      else setError('This house was deleted on another device.')
      setHouses(prev => prev.map(h => h.id === house.id ? { ...h, _pending: false } : h))
      return
    }
    setHouses(prev => prev.map(h => h.id === house.id ? houseFromDb(data[0]) : h))
  }, [userId, enqueue]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteHouse = useCallback(async (id) => {
    setHouses(prev => prev.filter(h => h.id !== id))
    const deps = () => loadQueueSnapshot().filter(i => ['addHouse','editHouse'].includes(i.op) && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteHouse', { id }, deps()); return }
    const { error: err } = await supabase.from('houses').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteHouse', { id }, deps())
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Other Assets ─────────────────────────────────────────
  const addOtherAsset = useCallback(async (item) => {
    setOtherAssets(prev => [{ ...item, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addOtherAsset', item); return }
    const { data, error: err } = await supabase.from('other_assets').insert(otherAssetToDb(item, userId)).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addOtherAsset', item) }
      else { setError(err.message); setOtherAssets(prev => prev.filter(o => o.id !== item.id)) }
      return
    }
    setOtherAssets(prev => prev.map(o => o.id === item.id ? otherAssetFromDb(data) : o))
  }, [userId, enqueue])

  const editOtherAsset = useCallback(async (item) => {
    setOtherAssets(prev => prev.map(o => o.id === item.id ? { ...item, _pending: true } : o))
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addOtherAsset' && i.payload.id === item.id).map(i => i.id)
    if (!navigator.onLine) { enqueue('editOtherAsset', item, deps()); return }
    const rowVersion = item._rowVersion || 1
    const { data, error: err } = await supabase
      .from('other_assets')
      .update(otherAssetToDb(item, userId))
      .eq('id', item.id)
      .eq('row_version', rowVersion)
      .select()
    if (err) {
      if (isNetworkError(err)) { enqueue('editOtherAsset', item, deps()) }
      else { setError(err.message) }
      return
    }
    if (!data || data.length === 0) {
      const { data: dbRow } = await supabase.from('other_assets').select('*').eq('id', item.id).single()
      if (dbRow) addConflict('other_assets', item, otherAssetFromDb(dbRow))
      else setError('This item was deleted on another device.')
      setOtherAssets(prev => prev.map(o => o.id === item.id ? { ...o, _pending: false } : o))
      return
    }
    setOtherAssets(prev => prev.map(o => o.id === item.id ? otherAssetFromDb(data[0]) : o))
  }, [userId, enqueue]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteOtherAsset = useCallback(async (id) => {
    setOtherAssets(prev => prev.filter(o => o.id !== id))
    const deps = () => loadQueueSnapshot().filter(i => ['addOtherAsset','editOtherAsset'].includes(i.op) && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteOtherAsset', { id }, deps()); return }
    const { error: err } = await supabase.from('other_assets').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteOtherAsset', { id }, deps())
    else if (err) setError(err.message)
  }, [userId, enqueue])

  // ── Debts ────────────────────────────────────────────────
  const addDebt = useCallback(async (debt) => {
    setDebts(prev => [{ ...debt, _pending: true }, ...prev])
    if (!navigator.onLine) { enqueue('addDebt', debt); return }
    const { data, error: err } = await supabase.from('debts').insert(debtToDb(debt, userId)).select().single()
    if (err) {
      if (isNetworkError(err)) { enqueue('addDebt', debt) }
      else { setError(err.message); setDebts(prev => prev.filter(d => d.id !== debt.id)) }
      return
    }
    setDebts(prev => prev.map(d => d.id === debt.id ? debtFromDb(data) : d))
  }, [userId, enqueue])

  const editDebt = useCallback(async (debt) => {
    setDebts(prev => prev.map(d => d.id === debt.id ? { ...debt, _pending: true } : d))
    const deps = () => loadQueueSnapshot().filter(i => i.op === 'addDebt' && i.payload.id === debt.id).map(i => i.id)
    if (!navigator.onLine) { enqueue('editDebt', debt, deps()); return }
    const rowVersion = debt._rowVersion || 1
    const { data, error: err } = await supabase
      .from('debts')
      .update(debtToDb(debt, userId))
      .eq('id', debt.id)
      .eq('row_version', rowVersion)
      .select()
    if (err) {
      if (isNetworkError(err)) { enqueue('editDebt', debt, deps()) }
      else { setError(err.message) }
      return
    }
    if (!data || data.length === 0) {
      const { data: dbRow } = await supabase.from('debts').select('*').eq('id', debt.id).single()
      if (dbRow) addConflict('debts', debt, debtFromDb(dbRow))
      else setError('This debt was deleted on another device.')
      setDebts(prev => prev.map(d => d.id === debt.id ? { ...d, _pending: false } : d))
      return
    }
    setDebts(prev => prev.map(d => d.id === debt.id ? debtFromDb(data[0]) : d))
  }, [userId, enqueue]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteDebt = useCallback(async (id) => {
    setDebts(prev => prev.filter(d => d.id !== id))
    const deps = () => loadQueueSnapshot().filter(i => ['addDebt','editDebt'].includes(i.op) && i.payload.id === id).map(i => i.id)
    if (!navigator.onLine) { enqueue('deleteDebt', { id }, deps()); return }
    const { error: err } = await supabase.from('debts').delete().eq('id', id)
    if (err && isNetworkError(err)) enqueue('deleteDebt', { id }, deps())
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

  // ── Conflict resolution ──────────────────────────────────
  const resolveConflict = useCallback(async (conflictId, resolution, mergedData) => {
    let conflict
    setConflicts(prev => {
      conflict = prev.find(c => c.id === conflictId)
      return prev.filter(c => c.id !== conflictId)
    })
    if (!conflict) return

    if (resolution === 'theirs') {
      // Accept DB state — replace local record with remote version
      if (conflict.table === 'expenses') setExpenses(es => es.map(e => e.id === conflict.remote.id ? conflict.remote : e))
      if (conflict.table === 'income')   setIncome(is => is.map(i => i.id === conflict.remote.id ? conflict.remote : i))
      if (conflict.table === 'trips')    setTrips(ts => ts.map(t => t.id === conflict.remote.id ? conflict.remote : t))
      if (conflict.table === 'vehicles') setVehicles(vs => vs.map(v => v.id === conflict.remote.id ? conflict.remote : v))
      if (conflict.table === 'credit_cards') setCreditCards(cs => cs.map(c => c.id === conflict.remote.id ? conflict.remote : c))
      if (conflict.table === 'houses') setHouses(hs => hs.map(h => h.id === conflict.remote.id ? conflict.remote : h))
      if (conflict.table === 'other_assets') setOtherAssets(oas => oas.map(o => o.id === conflict.remote.id ? conflict.remote : o))
      if (conflict.table === 'debts') setDebts(ds => ds.map(d => d.id === conflict.remote.id ? conflict.remote : d))
    } else {
      // 'mine' or 'merge' — re-attempt write using remote's current row_version
      const base = resolution === 'merge' && mergedData ? mergedData : conflict.local
      const forceWrite = { ...base, _rowVersion: conflict.remote._rowVersion }
      if (conflict.table === 'expenses') await editExpense(forceWrite)
      if (conflict.table === 'income')   await editIncome(forceWrite)
      if (conflict.table === 'trips')    await editTrip(forceWrite)
      if (conflict.table === 'vehicles') await editVehicle(forceWrite)
      if (conflict.table === 'credit_cards') await editCreditCard(forceWrite)
      if (conflict.table === 'houses') await editHouse(forceWrite)
      if (conflict.table === 'other_assets') await editOtherAsset(forceWrite)
      if (conflict.table === 'debts') await editDebt(forceWrite)
    }
  }, [editExpense, editIncome, editTrip, editVehicle, editCreditCard, editHouse, editOtherAsset, editDebt]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismissConflict = useCallback((conflictId) => {
    setConflicts(prev => prev.filter(c => c.id !== conflictId))
  }, [])

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
      supabase.from('trips').delete().eq('user_id', userId),
      supabase.from('vehicles').delete().eq('user_id', userId),
      supabase.from('credit_cards').delete().eq('user_id', userId),
      supabase.from('houses').delete().eq('user_id', userId),
      supabase.from('other_assets').delete().eq('user_id', userId),
      supabase.from('debts').delete().eq('user_id', userId),
    ])
    setExpenses([])
    setIncome([])
    setBudgets({ daily: 0, weekly: 0, monthly: 0, categories: {}, rolloverEnabled: {} })
    setGoals([])
    setContributions([])
    setTrips([])
    setVehicles([])
    setCreditCards([])
    setHouses([])
    setOtherAssets([])
    setDebts([])
    try {
      ['et_v6_rates', 'et_v6_dark', 'et_v6_cb', 'et_v6_base', 'et_v6_retry_queue'].forEach(k => localStorage.removeItem(k))
    } catch {}
  }, [userId])

  return {
    expenses, income, budgets, goals, contributions, trips, vehicles, creditCards, houses, otherAssets, debts,
    loading, error,
    pendingCount: queue.length,
    syncing,
    online,
    realtimeStatus,
    conflicts, resolveConflict, dismissConflict,
    addExpense, editExpense, deleteExpense, deleteManyExpenses,
    addIncome,  editIncome,  deleteIncome,
    saveBudgets,
    addGoal, deleteGoal, addContribution, deleteContribution,
    addTrip, editTrip, deleteTrip,
    addVehicle, editVehicle, deleteVehicle,
    addCreditCard, editCreditCard, deleteCreditCard,
    addHouse, editHouse, deleteHouse,
    addOtherAsset, editOtherAsset, deleteOtherAsset,
    addDebt, editDebt, deleteDebt,
    bulkAddExpenses, bulkAddIncome,
    clearExpenses, clearIncome, clearAll, factoryReset,
  }
}

// Read queue directly from localStorage (needed inside replay to get fresh snapshot)
function loadQueueSnapshot() {
  try { return JSON.parse(localStorage.getItem('et_v6_retry_queue') || '[]') } catch { return [] }
}
