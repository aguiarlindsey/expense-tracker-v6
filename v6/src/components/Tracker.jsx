import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useDebounce } from '../hooks/useDebounce'
import { CATS, CM, PAY_METHODS, INC_SOURCES, EXP_TYPES, CURRENCIES, RECURRING_PERIODS } from '../utils/constants'
import { makeExpense, makeIncome, makeDedupContext, matchesSearch } from '../utils/dataHelpers'

// ─── Helpers ─────────────────────────────────────────────

function fmtINR(n) {
  if (isNaN(n) || n == null) return '₹0'
  return '₹' + parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function toINR(e) {
  if (!e) return 0
  if (!e.currency || e.currency === 'INR') return parseFloat(e.amount || 0)
  return parseFloat(e.amountINR || e.amount || 0)
}

function byDate(list) {
  const g = {}
  list.forEach(e => {
    const d = e.date || 'Unknown';
    (g[d] || (g[d] = [])).push(e)
  })
  return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]))
}

// ─── Mini SVG Charts ──────────────────────────────────────

function PieChart({ data, size = 200 }) {
  const total = (data || []).reduce((s, d) => s + d.value, 0)
  if (!total) return <div className="chart-empty">No data</div>
  const COLORS = Object.values(CATS).map(c => c.color)
  let angle = -90
  const slices = data.map((it, i) => {
    const pct = it.value / total
    const deg = pct * 360
    const start = angle; angle += deg
    const r = (d) => (d * Math.PI) / 180
    const x1 = 50 + 40 * Math.cos(r(start))
    const y1 = 50 + 40 * Math.sin(r(start))
    const x2 = 50 + 40 * Math.cos(r(start + deg))
    const y2 = 50 + 40 * Math.sin(r(start + deg))
    return { ...it, x1, y1, x2, y2, deg, pct, color: CATS[it.label]?.color || COLORS[i % COLORS.length] }
  })
  const [hovered, setHovered] = useState(null)
  return (
    <div className="pie-wrap">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {slices.map((sl, i) => (
          sl.deg < 360 ? (
            <path key={i}
              d={`M50,50 L${sl.x1},${sl.y1} A40,40 0 ${sl.deg > 180 ? 1 : 0},1 ${sl.x2},${sl.y2} Z`}
              fill={sl.color}
              opacity={hovered === null || hovered === i ? 1 : 0.5}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ) : (
            <circle key={i} cx="50" cy="50" r="40" fill={sl.color} />
          )
        ))}
      </svg>
      <div className="pie-legend">
        {slices.map((sl, i) => (
          <div key={i} className="pie-legend-row"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}>
            <span className="pie-dot" style={{ background: sl.color }} />
            <span>{sl.label}</span>
            <span className="pie-pct">{(sl.pct * 100).toFixed(0)}%</span>
            <span className="pie-val">{fmtINR(sl.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineChart({ data }) {
  if (!data || data.length < 2) return <div className="chart-empty">Not enough data</div>
  const vals = data.map(d => d.value)
  const maxV = Math.max(...vals, 1), minV = Math.min(...vals, 0), rng = maxV - minV || 1
  const W = 500, H = 140, pl = 10, pr = 10, pt = 10, pb = 30
  const gW = W - pl - pr, gH = H - pt - pb
  const pts = data.map((d, i) => ({
    x: pl + (i / (data.length - 1)) * gW,
    y: pt + gH - ((d.value - minV) / rng) * gH,
    ...d
  }))
  const pathD = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
      <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="var(--primary)" />
          <text x={p.x} y={H - 5} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ─── Expense Form ─────────────────────────────────────────

function ExpenseForm({ onSubmit, onClose, initialData }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState(initialData ? { ...initialData } : {
    date: today, description: '', amount: '', currency: 'INR',
    category: 'Food', subcategory: '', expenseType: 'variable',
    paymentMethod: 'UPI/QR', notes: '', tags: [],
    isRecurring: false, recurringPeriod: 'monthly',
    splitWith: '', splitParts: 1,
  })
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const sub = e => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0) return
    onSubmit({ ...form, amount: parseFloat(form.amount), splitParts: parseInt(form.splitParts) || 1 })
    onClose()
  }

  const catSubs = CATS[form.category]?.subs || []

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{initialData ? '✏️ Edit Expense' : '➕ Add Expense'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={sub} className="form">
          <div className="form-row">
            <div className="form-group">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => s('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Amount *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => s('amount', e.target.value)} required placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={e => s('currency', e.target.value)}>
                {CURRENCIES.slice(0, 10).map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description *</label>
            <input value={form.description} onChange={e => s('description', e.target.value)}
              required placeholder="What did you spend on?" autoFocus={!initialData} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => { s('category', e.target.value); s('subcategory', '') }}>
                {Object.keys(CATS).map(c => <option key={c}>{CATS[c].icon} {c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Subcategory</label>
              <select value={form.subcategory} onChange={e => s('subcategory', e.target.value)}>
                <option value="">—</option>
                {catSubs.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Payment Method</label>
              <select value={form.paymentMethod} onChange={e => s('paymentMethod', e.target.value)}>
                {PAY_METHODS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.expenseType} onChange={e => s('expenseType', e.target.value)}>
                {EXP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <input value={form.notes} onChange={e => s('notes', e.target.value)} placeholder="Optional note" />
          </div>

          <div className="form-check">
            <input type="checkbox" id="recurring" checked={form.isRecurring}
              onChange={e => s('isRecurring', e.target.checked)} />
            <label htmlFor="recurring">Recurring expense</label>
            {form.isRecurring && (
              <select value={form.recurringPeriod} onChange={e => s('recurringPeriod', e.target.value)}
                style={{ marginLeft: 8 }}>
                {RECURRING_PERIODS.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {initialData ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Income Form ──────────────────────────────────────────

function IncomeForm({ onSubmit, onClose, initialData }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState(initialData ? { ...initialData } : {
    date: today, description: '', amount: '', currency: 'INR',
    source: 'Salary', paymentMethod: 'Net Banking',
    notes: '', isRecurring: false, recurringPeriod: 'monthly',
  })
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const sub = e => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0) return
    onSubmit({ ...form, amount: parseFloat(form.amount) })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{initialData ? '✏️ Edit Income' : '💵 Add Income'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={sub} className="form">
          <div className="form-row">
            <div className="form-group">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => s('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Amount *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => s('amount', e.target.value)} required placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={e => s('currency', e.target.value)}>
                {CURRENCIES.slice(0, 10).map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description *</label>
            <input value={form.description} onChange={e => s('description', e.target.value)}
              required placeholder="e.g. Monthly salary, Freelance project" autoFocus={!initialData} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Source</label>
              <select value={form.source} onChange={e => s('source', e.target.value)}>
                {INC_SOURCES.map(src => <option key={src}>{src}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select value={form.paymentMethod} onChange={e => s('paymentMethod', e.target.value)}>
                {PAY_METHODS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <input value={form.notes} onChange={e => s('notes', e.target.value)} placeholder="Optional note" />
          </div>

          <div className="form-check">
            <input type="checkbox" id="inc-recurring" checked={form.isRecurring}
              onChange={e => s('isRecurring', e.target.checked)} />
            <label htmlFor="inc-recurring">Recurring income</label>
            {form.isRecurring && (
              <select value={form.recurringPeriod} onChange={e => s('recurringPeriod', e.target.value)}
                style={{ marginLeft: 8 }}>
                {RECURRING_PERIODS.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {initialData ? 'Save Changes' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Expense Item ─────────────────────────────────────────

const ExpItem = memo(function ExpItem({ item, onDelete, onEdit, bulkMode, isSelected, onToggleSelect }) {
  const cat = CATS[item.category] || CATS['Other']
  return (
    <div className={`item ${isSelected ? 'item-selected' : ''}`}
      style={{ borderLeft: `3px solid ${item.customColor || cat.color}` }}>
      {bulkMode && (
        <input type="checkbox" className="item-checkbox"
          checked={isSelected} onChange={() => onToggleSelect(item.id)} />
      )}
      <div className="item-icon">{cat.icon}</div>
      <div className="item-body">
        <div className="item-desc">{item.description}</div>
        <div className="item-meta">
          <span className="item-cat">{item.category}</span>
          {item.subcategory && <span className="item-sub">{item.subcategory}</span>}
          <span className="item-pay">{item.paymentMethod}</span>
          {item.isRecurring && <span className="item-badge item-badge-rec">🔄 {item.recurringPeriod}</span>}
          {item.tags && item.tags.length > 0 && item.tags.map(t => (
            <span key={t} className="item-badge">{t}</span>
          ))}
        </div>
        {item.notes && <div className="item-notes">{item.notes}</div>}
      </div>
      <div className="item-right">
        <div className="item-amount">{fmtINR(toINR(item))}</div>
        {item.currency !== 'INR' && (
          <div className="item-foreign">{CM[item.currency]?.symbol || item.currency}{item.amount}</div>
        )}
        {!bulkMode && (
          <div className="item-actions">
            <button className="item-btn" onClick={() => onEdit(item)} title="Edit">✏️</button>
            <button className="item-btn item-btn-del" onClick={() => onDelete(item.id)} title="Delete">🗑️</button>
          </div>
        )}
      </div>
    </div>
  )
})

// ─── Income Item ──────────────────────────────────────────

const IncItem = memo(function IncItem({ item, onDelete, onEdit }) {
  return (
    <div className="item" style={{ borderLeft: '3px solid #10b981' }}>
      <div className="item-icon">💵</div>
      <div className="item-body">
        <div className="item-desc">{item.description}</div>
        <div className="item-meta">
          <span className="item-cat">{item.source}</span>
          <span className="item-pay">{item.paymentMethod}</span>
          {item.isRecurring && <span className="item-badge item-badge-rec">🔄 {item.recurringPeriod}</span>}
        </div>
        {item.notes && <div className="item-notes">{item.notes}</div>}
      </div>
      <div className="item-right">
        <div className="item-amount" style={{ color: '#10b981' }}>+{fmtINR(toINR(item))}</div>
        {item.currency !== 'INR' && (
          <div className="item-foreign">{CM[item.currency]?.symbol || item.currency}{item.amount}</div>
        )}
        <div className="item-actions">
          <button className="item-btn" onClick={() => onEdit(item)} title="Edit">✏️</button>
          <button className="item-btn item-btn-del" onClick={() => onDelete(item.id)} title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  )
})

// ─── Delete Confirm Dialog ────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-sm">
        <div className="modal-header"><h2>Confirm Delete</h2></div>
        <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>{message}</p>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Tracker ─────────────────────────────────────────

export default function Tracker({ session }) {
  const userId = session.user.id
  const {
    expenses, income, budgets,
    loading, error,
    addExpense, editExpense, deleteExpense, deleteManyExpenses,
    addIncome,  editIncome,  deleteIncome,
  } = useStorage(userId)

  const [tab, setTab]                   = useState('overview')
  const [showEF, setShowEF]             = useState(false)
  const [showIF, setShowIF]             = useState(false)
  const [editExpTarget, setEditExpTarget] = useState(null)
  const [editIncTarget, setEditIncTarget] = useState(null)
  const [delTarget, setDelTarget]       = useState(null) // { id, type, many: bool, ids: [] }
  const [bulkMode, setBulkMode]         = useState(false)
  const [selectedIds, setSelectedIds]   = useState({})

  // ── Filters — expenses ───────────────────────────────
  const [expSearch,   setExpSearch]   = useState('')
  const [expMonth,    setExpMonth]    = useState('')
  const [expPayment,  setExpPayment]  = useState('All')
  const [expCurrency, setExpCurrency] = useState('All')
  const dExpSearch = useDebounce(expSearch)

  // ── Filters — income ─────────────────────────────────
  const [incSearch,   setIncSearch]   = useState('')
  const [incMonth,    setIncMonth]    = useState('')
  const [incSource,   setIncSource]   = useState('All')
  const dIncSearch = useDebounce(incSearch)

  // ── Keyboard shortcuts ───────────────────────────────
  useEffect(() => {
    const TABS = ['overview', 'income']
    const h = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      const n = parseInt(e.key)
      if (n >= 1 && n <= TABS.length) setTab(TABS[n - 1])
      if (e.key === 'n' || e.key === 'N') setShowEF(true)
      if (e.key === 'i' || e.key === 'I') setShowIF(true)
      if (e.key === 'Escape') {
        setShowEF(false); setShowIF(false)
        setDelTarget(null); setEditExpTarget(null); setEditIncTarget(null)
        setBulkMode(false); setSelectedIds({})
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Filtered lists ───────────────────────────────────
  const filteredExp = useMemo(() => expenses.filter(e => {
    if (!matchesSearch(e, dExpSearch)) return false
    if (expPayment  !== 'All' && (e.paymentMethod || 'Cash') !== expPayment)  return false
    if (expCurrency !== 'All' && (e.currency       || 'INR') !== expCurrency) return false
    if (expMonth && !(e.date || '').startsWith(expMonth)) return false
    return true
  }), [expenses, dExpSearch, expPayment, expCurrency, expMonth])

  const filteredInc = useMemo(() => income.filter(i => {
    if (!matchesSearch(i, dIncSearch)) return false
    if (incSource   !== 'All' && (i.source   || 'Other') !== incSource)   return false
    if (incMonth && !(i.date || '').startsWith(incMonth)) return false
    return true
  }), [income, dIncSearch, incSource, incMonth])

  // ── Totals ───────────────────────────────────────────
  const totalExp    = useMemo(() => filteredExp.reduce((s, e) => s + toINR(e), 0), [filteredExp])
  const totalInc    = useMemo(() => filteredInc.reduce((s, i) => s + toINR(i), 0), [filteredInc])
  const allExpINR   = useMemo(() => expenses.reduce((s, e) => s + toINR(e), 0), [expenses])
  const allIncINR   = useMemo(() => income.reduce((s, i)   => s + toINR(i), 0), [income])
  const netSavings  = allIncINR - allExpINR

  // ── Chart data ───────────────────────────────────────
  const catData = useMemo(() => {
    const c = {}
    filteredExp.forEach(e => { c[e.category] = (c[e.category] || 0) + toINR(e) })
    return Object.entries(c).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [filteredExp])

  const payData = useMemo(() => {
    const p = {}
    filteredExp.forEach(e => { const k = e.paymentMethod || 'Cash'; p[k] = (p[k] || 0) + toINR(e) })
    return Object.entries(p).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [filteredExp])

  const incSrcData = useMemo(() => {
    const s = {}
    filteredInc.forEach(i => { const k = i.source || 'Other'; s[k] = (s[k] || 0) + toINR(i) })
    return Object.entries(s).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [filteredInc])

  const monthlyIncData = useMemo(() => {
    const m = {}
    income.forEach(i => { const k = (i.date || '').substring(0, 7); if (k) m[k] = (m[k] || 0) + toINR(i) })
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
      .map(([k, v]) => ({ label: k.substring(5), value: v }))
  }, [income])

  // ── Grouped lists ────────────────────────────────────
  const grouped    = useMemo(() => byDate(filteredExp), [filteredExp])
  const groupedInc = useMemo(() => byDate(filteredInc), [filteredInc])

  // ── Budget spend ─────────────────────────────────────
  const todayStr  = new Date().toISOString().split('T')[0]
  const monthStr  = todayStr.substring(0, 7)
  const spentMonth = useMemo(() => expenses.filter(e => (e.date || '').startsWith(monthStr))
    .reduce((s, e) => s + toINR(e), 0), [expenses, monthStr])

  // ── Bulk select helpers ──────────────────────────────
  const toggleSelect   = useCallback(id => setSelectedIds(prev => {
    const next = { ...prev }; if (next[id]) delete next[id]; else next[id] = true; return next
  }), [])
  const selectAll      = useCallback(() => {
    setSelectedIds(Object.fromEntries(filteredExp.map(e => [e.id, true])))
  }, [filteredExp])
  const deselectAll    = useCallback(() => setSelectedIds({}), [])
  const exitBulk       = useCallback(() => { setBulkMode(false); setSelectedIds({}) }, [])
  const selectedCount  = Object.keys(selectedIds).length

  // ── CRUD handlers ────────────────────────────────────
  const handleAddExpense = (formData) => {
    const entry = makeExpense(formData, 'manual')
    const ctx   = makeDedupContext(expenses)
    if (ctx.isDuplicate(entry)) return
    addExpense(entry)
  }

  const handleEditExpense = (formData) => {
    editExpense({ ...editExpTarget, ...formData })
    setEditExpTarget(null)
  }

  const handleAddIncome = (formData) => {
    const entry = makeIncome(formData, 'manual')
    addIncome(entry)
  }

  const handleEditIncome = (formData) => {
    editIncome({ ...editIncTarget, ...formData })
    setEditIncTarget(null)
  }

  const handleDelete = () => {
    if (!delTarget) return
    if (delTarget.many) {
      deleteManyExpenses(Object.keys(delTarget.ids))
      exitBulk()
    } else if (delTarget.type === 'expense') {
      deleteExpense(delTarget.id)
    } else {
      deleteIncome(delTarget.id)
    }
    setDelTarget(null)
  }

  const hasExpFilters = expSearch || expMonth || expPayment !== 'All' || expCurrency !== 'All'
  const usedExpCurrs  = useMemo(() => [...new Set(expenses.map(e => e.currency || 'INR'))], [expenses])
  const usedIncSources = useMemo(() => [...new Set(income.map(i => i.source || 'Other'))], [income])

  if (loading) {
    return (
      <div className="tracker-loading">
        <div className="spinner" />
        <p>Loading your data…</p>
      </div>
    )
  }

  return (
    <div className="tracker">
      {error && (
        <div className="error-banner">⚠️ {error} <button onClick={() => window.location.reload()}>Retry</button></div>
      )}

      {/* ── Header ── */}
      <div className="tracker-header">
        <div className="tracker-header-left">
          <span className="tracker-title">💸 Expense Tracker</span>
          <span className="tracker-stats">{expenses.length} expenses · {income.length} income</span>
        </div>
        <div className="tracker-header-right">
          <button className="btn-primary btn-sm" onClick={() => setShowEF(true)} title="N">➕ Expense</button>
          <button className="btn-income  btn-sm" onClick={() => setShowIF(true)} title="I">💵 Income</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <nav className="tabs" role="tablist">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'income',   label: '💵 Income' },
        ].map((t, i) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)} title={`Key ${i + 1}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ══════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════ */}
      {tab === 'overview' && (
        <main>
          {/* Summary cards */}
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Expenses{hasExpFilters ? ' (filtered)' : ''}</div>
              <div className="summary-amount" style={{ color: '#ef4444' }}>{fmtINR(totalExp)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Income</div>
              <div className="summary-amount" style={{ color: '#10b981' }}>{fmtINR(allIncINR)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Net Savings</div>
              <div className="summary-amount" style={{ color: netSavings >= 0 ? '#f59e0b' : '#ef4444' }}>
                {netSavings >= 0 ? '+' : ''}{fmtINR(netSavings)}
              </div>
            </div>
            {budgets.monthly > 0 && (
              <div className="summary-card">
                <div className="summary-label">Monthly Budget</div>
                <div className="summary-amount"
                  style={{ color: spentMonth > budgets.monthly ? '#ef4444' : '#10b981' }}>
                  {fmtINR(spentMonth)} / {fmtINR(budgets.monthly)}
                </div>
              </div>
            )}
            <div className="summary-card">
              <div className="summary-label">Showing</div>
              <div className="summary-amount">{filteredExp.length} / {expenses.length}</div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="filter-bar">
            <input className="search-input" placeholder="🔍 Search expenses…"
              value={expSearch} onChange={e => setExpSearch(e.target.value)} />
            <input type="month" className="month-picker" value={expMonth}
              onChange={e => setExpMonth(e.target.value)} title="Filter by month" />
            <select value={expPayment} onChange={e => setExpPayment(e.target.value)}>
              <option value="All">All payments</option>
              {PAY_METHODS.map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={expCurrency} onChange={e => setExpCurrency(e.target.value)}>
              <option value="All">All currencies</option>
              {usedExpCurrs.map(c => <option key={c}>{c}</option>)}
            </select>
            {hasExpFilters && (
              <button className="btn-ghost" onClick={() => {
                setExpSearch(''); setExpMonth(''); setExpPayment('All'); setExpCurrency('All')
              }}>✕ Clear</button>
            )}
            {filteredExp.length > 0 && (
              <button className="btn-ghost"
                onClick={() => { if (bulkMode) exitBulk(); else setBulkMode(true) }}>
                {bulkMode ? '✕ Exit bulk' : '☑ Bulk'}
              </button>
            )}
          </div>

          {hasExpFilters && filteredExp.length > 0 && (
            <div className="results-info">
              Showing {filteredExp.length} of {expenses.length} · {fmtINR(totalExp)} total
            </div>
          )}

          {/* Bulk action bar */}
          {bulkMode && (
            <div className="bulk-bar">
              <span>{selectedCount > 0 ? `${selectedCount} selected` : 'None selected'}</span>
              <button className="btn-ghost btn-sm" onClick={selectAll}>Select all ({filteredExp.length})</button>
              {selectedCount > 0 && <button className="btn-ghost btn-sm" onClick={deselectAll}>Deselect all</button>}
              {selectedCount > 0 && (
                <button className="btn-danger btn-sm"
                  onClick={() => setDelTarget({ many: true, ids: selectedIds })}>
                  🗑️ Delete {selectedCount}
                </button>
              )}
            </div>
          )}

          {/* Charts */}
          {filteredExp.length > 0 && !bulkMode && (
            <div className="chart-row">
              <div className="chart-card">
                <div className="chart-title">By Category</div>
                <PieChart data={catData} />
              </div>
              <div className="chart-card">
                <div className="chart-title">By Payment Method</div>
                <PieChart data={payData} />
              </div>
            </div>
          )}

          {/* Expense list */}
          {grouped.length === 0 ? (
            expenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💸</div>
                <h3>No expenses yet</h3>
                <p>Press <kbd>N</kbd> to add your first expense</p>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <p>No expenses match your filters.</p>
                <button className="btn-primary btn-sm" onClick={() => {
                  setExpSearch(''); setExpMonth(''); setExpPayment('All'); setExpCurrency('All')
                }}>Clear filters</button>
              </div>
            )
          ) : grouped.map(([date, items]) => (
            <div key={date} className="date-group">
              <div className="date-group-header">
                <span>{new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                })}</span>
                <span>{fmtINR(items.reduce((s, e) => s + toINR(e), 0))}</span>
              </div>
              {items.map(e => (
                <ExpItem key={e.id} item={e}
                  onDelete={id => setDelTarget({ id, type: 'expense' })}
                  onEdit={e => { setEditExpTarget(e); setShowEF(true) }}
                  bulkMode={bulkMode}
                  isSelected={!!selectedIds[e.id]}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          ))}
        </main>
      )}

      {/* ══════════════════════════════════════
          INCOME TAB
      ══════════════════════════════════════ */}
      {tab === 'income' && (
        <main>
          {/* Summary cards */}
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Total Income</div>
              <div className="summary-amount" style={{ color: '#10b981' }}>{fmtINR(allIncINR)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Expenses</div>
              <div className="summary-amount" style={{ color: '#ef4444' }}>{fmtINR(allExpINR)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Net Savings</div>
              <div className="summary-amount" style={{ color: netSavings >= 0 ? '#f59e0b' : '#ef4444' }}>
                {netSavings >= 0 ? '+' : ''}{fmtINR(netSavings)}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Showing</div>
              <div className="summary-amount">{filteredInc.length} / {income.length}</div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="filter-bar">
            <input className="search-input" placeholder="🔍 Search income…"
              value={incSearch} onChange={e => setIncSearch(e.target.value)} />
            <input type="month" className="month-picker" value={incMonth}
              onChange={e => setIncMonth(e.target.value)} title="Filter by month" />
            <select value={incSource} onChange={e => setIncSource(e.target.value)}>
              <option value="All">All sources</option>
              {usedIncSources.map(s => <option key={s}>{s}</option>)}
            </select>
            {(incSearch || incMonth || incSource !== 'All') && (
              <button className="btn-ghost" onClick={() => {
                setIncSearch(''); setIncMonth(''); setIncSource('All')
              }}>✕ Clear</button>
            )}
            <button className="btn-income btn-sm" onClick={() => setShowIF(true)}>💵 Add Income</button>
          </div>

          {/* Charts */}
          {income.length > 0 && (
            <div className="chart-row">
              <div className="chart-card">
                <div className="chart-title">Income by Source</div>
                <PieChart data={incSrcData} />
              </div>
              {monthlyIncData.length >= 2 && (
                <div className="chart-card">
                  <div className="chart-title">Monthly Trend (12m)</div>
                  <LineChart data={monthlyIncData} />
                </div>
              )}
            </div>
          )}

          {/* Income list */}
          {groupedInc.length === 0 ? (
            income.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💵</div>
                <h3>No income recorded yet</h3>
                <p>Press <kbd>I</kbd> or click "Add Income" to track earnings</p>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <p>No income matches your filters.</p>
                <button className="btn-primary btn-sm" onClick={() => {
                  setIncSearch(''); setIncMonth(''); setIncSource('All')
                }}>Clear filters</button>
              </div>
            )
          ) : groupedInc.map(([date, items]) => (
            <div key={date} className="date-group">
              <div className="date-group-header">
                <span>{new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                })}</span>
                <span style={{ color: '#10b981' }}>+{fmtINR(items.reduce((s, i) => s + toINR(i), 0))}</span>
              </div>
              {items.map(i => (
                <IncItem key={i.id} item={i}
                  onDelete={id => setDelTarget({ id, type: 'income' })}
                  onEdit={i => { setEditIncTarget(i); setShowIF(true) }}
                />
              ))}
            </div>
          ))}
        </main>
      )}

      {/* ── Modals ── */}
      {showEF && (
        <ExpenseForm
          initialData={editExpTarget}
          onSubmit={editExpTarget ? handleEditExpense : handleAddExpense}
          onClose={() => { setShowEF(false); setEditExpTarget(null) }}
        />
      )}
      {showIF && (
        <IncomeForm
          initialData={editIncTarget}
          onSubmit={editIncTarget ? handleEditIncome : handleAddIncome}
          onClose={() => { setShowIF(false); setEditIncTarget(null) }}
        />
      )}
      {delTarget && (
        <ConfirmDialog
          message={
            delTarget.many
              ? `Permanently delete ${Object.keys(delTarget.ids).length} expenses? This cannot be undone.`
              : `Delete this ${delTarget.type}? This cannot be undone.`
          }
          onConfirm={handleDelete}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </div>
  )
}
