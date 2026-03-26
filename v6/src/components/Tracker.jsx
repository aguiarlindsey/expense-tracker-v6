import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useDebounce } from '../hooks/useDebounce'
import { CATS, CM, PAY_METHODS, INC_SOURCES, EXP_TYPES, CURRENCIES, RECURRING_PERIODS } from '../utils/constants'
import { makeExpense, makeIncome, makeDedupContext, matchesSearch, stableId } from '../utils/dataHelpers'

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
  list.forEach(e => { const d = e.date || 'Unknown';(g[d] || (g[d] = [])).push(e) })
  return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]))
}

// ─── Toast System ─────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.kind || 'info'} ${t.exiting ? 'toast-exit' : ''}`}
          onClick={() => onDismiss(t.id)}>
          <span className="toast-icon">{t.icon || '💡'}</span>
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            <div className="toast-msg">{t.msg}</div>
          </div>
          <button className="toast-close" onClick={e => { e.stopPropagation(); onDismiss(t.id) }}>✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Charts ───────────────────────────────────────────────

function PieChart({ data, size = 190 }) {
  const [hovered, setHovered] = useState(null)
  const total = (data || []).reduce((s, d) => s + d.value, 0)
  if (!total) return <div className="chart-empty">No data</div>
  let angle = -90
  const slices = data.map((it, i) => {
    const pct = it.value / total, deg = pct * 360
    const start = angle; angle += deg
    const r = d => (d * Math.PI) / 180
    const x1 = 50 + 40 * Math.cos(r(start)), y1 = 50 + 40 * Math.sin(r(start))
    const x2 = 50 + 40 * Math.cos(r(start + deg)), y2 = 50 + 40 * Math.sin(r(start + deg))
    return { ...it, x1, y1, x2, y2, deg, pct, color: CATS[it.label]?.color || `hsl(${i * 37},65%,55%)` }
  })
  return (
    <div className="pie-wrap">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {slices.map((sl, i) => sl.deg < 360 ? (
          <path key={i}
            d={`M50,50 L${sl.x1},${sl.y1} A40,40 0 ${sl.deg > 180 ? 1 : 0},1 ${sl.x2},${sl.y2} Z`}
            fill={sl.color} opacity={hovered === null || hovered === i ? 1 : 0.4}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ) : (
          <circle key={i} cx="50" cy="50" r="40" fill={sl.color} />
        ))}
      </svg>
      <div className="pie-legend">
        {slices.map((sl, i) => (
          <div key={i} className="pie-legend-row"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
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
  const W = 500, H = 140, pl = 10, pr = 10, pt = 10, pb = 28
  const gW = W - pl - pr, gH = H - pt - pb
  const pts = data.map((d, i) => ({
    x: pl + (i / (data.length - 1)) * gW,
    y: pt + gH - ((d.value - minV) / rng) * gH, ...d
  }))
  const pathD = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
      <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="var(--primary)" />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

function BarChart({ data }) {
  if (!data || !data.length) return <div className="chart-empty">No data</div>
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="bar-chart">
      {data.slice(0, 10).map((d, i) => {
        const pct = (d.value / max) * 100
        const color = CATS[d.label]?.color || `hsl(${i * 37},65%,55%)`
        return (
          <div key={i} className="bar-row">
            <div className="bar-label">{CATS[d.label]?.icon || ''} {d.label}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: pct + '%', background: color }} />
            </div>
            <div className="bar-val">{fmtINR(d.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Heatmap ──────────────────────────────────────────────

function HeatmapCalendar({ expenses, income }) {
  const [mode, setMode] = useState('amount')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dayData = useMemo(() => {
    const days = {}
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      days[key] = { date: key, amount: 0, count: 0, income: 0, topColor: null, _topVal: 0 }
    }
    expenses.forEach(e => {
      if (!days[e.date]) return
      const v = toINR(e); days[e.date].amount += v; days[e.date].count++
      if (v > days[e.date]._topVal) { days[e.date]._topVal = v; days[e.date].topColor = e.customColor || CATS[e.category]?.color || '#667eea' }
    })
    income.forEach(i => { if (days[i.date]) days[i.date].income += toINR(i) })
    return Object.values(days)
  }, [expenses, income])

  const maxA = Math.max(...dayData.map(d => d.amount), 1)
  const maxC = Math.max(...dayData.map(d => d.count), 1)
  const maxI = Math.max(...dayData.map(d => d.income), 1)

  const getCellBg = d => {
    const t = mode === 'amount' ? d.amount / maxA : mode === 'count' ? d.count / maxC : d.income / maxI
    if (t === 0) return 'var(--border)'
    const a = (0.15 + t * 0.85).toFixed(2)
    if (mode === 'amount') {
      const base = d.topColor || '#667eea'
      const r = parseInt(base.slice(1, 3), 16), g = parseInt(base.slice(3, 5), 16), b = parseInt(base.slice(5, 7), 16)
      return `rgba(${r},${g},${b},${a})`
    }
    if (mode === 'count') return `rgba(99,102,241,${a})`
    return `rgba(16,185,129,${a})`
  }

  const startDow = new Date(dayData[0].date + 'T12:00:00').getDay()
  const padded = [...Array(startDow).fill(null), ...dayData]
  const weeks = []; for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

  return (
    <div>
      <div className="heatmap-modes">
        {[['amount', '₹ Expenses'], ['count', '# Count'], ['income', '₹ Income']].map(([k, label]) => (
          <button key={k} className={`heatmap-btn${mode === k ? ' active' : ''}`} onClick={() => setMode(k)}>{label}</button>
        ))}
      </div>
      <div className="heatmap-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => (
          <div key={i} className="heatmap-dow">{l}</div>
        ))}
        {weeks.map((week, wi) =>
          week.map((d, di) => (
            <div key={`${wi}-${di}`}
              className="heatmap-cell"
              style={{ background: d ? getCellBg(d) : 'transparent' }}
              title={d ? `${d.date}: ${mode === 'amount' ? fmtINR(d.amount) + ' spent' : mode === 'count' ? d.count + ' txns' : fmtINR(d.income) + ' income'}` : ''}
            />
          ))
        )}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const a = (0.15 + t * 0.85).toFixed(2)
          return <div key={i} className="heatmap-cell" style={{ background: `rgba(102,126,234,${a})` }} />
        })}
        <span>More</span>
      </div>
    </div>
  )
}

// ─── Budget Bar ───────────────────────────────────────────

const BudgetBar = memo(function BudgetBar({ icon, label, spent, budget }) {
  if (!budget || budget <= 0) return (
    <div className="bbar-wrap">
      <div className="bbar-header">
        <span>{icon && <span>{icon} </span>}{label}</span>
        <span className="bbar-no-budget">No budget set</span>
      </div>
    </div>
  )
  const pct = Math.min((spent / budget) * 100, 100)
  const over = spent > budget
  const level = over || pct >= 100 ? 'danger' : pct >= 80 ? 'danger' : pct >= 50 ? 'warn' : 'ok'
  return (
    <div className="bbar-wrap">
      <div className="bbar-header">
        <span>{icon && <span>{icon} </span>}{label}</span>
        <span className={`bbar-amounts bbar-${level}`}>{fmtINR(spent)} / {fmtINR(budget)}</span>
      </div>
      <div className="bbar-track"><div className={`bbar-fill bbar-fill-${level}`} style={{ width: pct + '%' }} /></div>
      {over && <div className="bbar-over">⚠️ Over by {fmtINR(spent - budget)}</div>}
    </div>
  )
})

// ─── Expense Form ─────────────────────────────────────────

function ExpenseForm({ onSubmit, onClose, initialData }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState(initialData ? { ...initialData } : {
    date: today, description: '', amount: '', currency: 'INR',
    category: 'Food', subcategory: '', expenseType: 'variable',
    paymentMethod: 'UPI/QR', notes: '', tags: [],
    isRecurring: false, recurringPeriod: 'monthly', splitWith: '', splitParts: 1,
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
                onChange={e => s('amount', e.target.value)} required placeholder="0.00" autoFocus={!initialData} />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={e => s('currency', e.target.value)}>
                {CURRENCIES.slice(0, 12).map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description *</label>
            <input value={form.description} onChange={e => s('description', e.target.value)} required placeholder="What did you spend on?" />
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
                {catSubs.map(sub => <option key={sub}>{sub}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Payment</label>
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
            <input type="checkbox" id="recurring" checked={form.isRecurring} onChange={e => s('isRecurring', e.target.checked)} />
            <label htmlFor="recurring">Recurring</label>
            {form.isRecurring && (
              <select value={form.recurringPeriod} onChange={e => s('recurringPeriod', e.target.value)} style={{ marginLeft: 8 }}>
                {RECURRING_PERIODS.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{initialData ? 'Save Changes' : 'Add Expense'}</button>
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
    source: 'Salary', paymentMethod: 'Net Banking', notes: '',
    isRecurring: false, recurringPeriod: 'monthly',
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
                onChange={e => s('amount', e.target.value)} required placeholder="0.00" autoFocus={!initialData} />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={e => s('currency', e.target.value)}>
                {CURRENCIES.slice(0, 12).map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description *</label>
            <input value={form.description} onChange={e => s('description', e.target.value)} required placeholder="e.g. Monthly salary" />
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
            <input type="checkbox" id="inc-rec" checked={form.isRecurring} onChange={e => s('isRecurring', e.target.checked)} />
            <label htmlFor="inc-rec">Recurring</label>
            {form.isRecurring && (
              <select value={form.recurringPeriod} onChange={e => s('recurringPeriod', e.target.value)} style={{ marginLeft: 8 }}>
                {RECURRING_PERIODS.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{initialData ? 'Save Changes' : 'Add Income'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Goal Modals ──────────────────────────────────────────

const GOAL_EMOJIS = ['🎯','💰','🏠','🚗','✈️','🎓','💍','🛍️','💻','🎸','🏋️','🌱','📚','🏖️','🎁']

function CreateGoalModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', target: '', targetDate: '', icon: '🎯', note: '' })
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = e => {
    e.preventDefault()
    const tgt = parseFloat(form.target)
    if (!form.name.trim() || !tgt || tgt <= 0) return
    onSave({ id: stableId({}), name: form.name.trim(), target: tgt, targetDate: form.targetDate, icon: form.icon, note: form.note.trim(), createdAt: new Date().toISOString().split('T')[0] })
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2>🎯 New Goal</h2><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={submit} className="form">
          <div className="form-group">
            <label>Goal Name *</label>
            <input value={form.name} onChange={e => s('name', e.target.value)} required placeholder="e.g. Emergency Fund" autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Target Amount (₹) *</label>
              <input type="number" min="1" step="1" value={form.target} onChange={e => s('target', e.target.value)} required placeholder="50000" />
            </div>
            <div className="form-group">
              <label>Target Date</label>
              <input type="date" value={form.targetDate} onChange={e => s('targetDate', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Icon</label>
            <div className="emoji-grid">
              {GOAL_EMOJIS.map(em => (
                <button key={em} type="button" className={`emoji-btn${form.icon === em ? ' active' : ''}`} onClick={() => s('icon', em)}>{em}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Note</label>
            <input value={form.note} onChange={e => s('note', e.target.value)} placeholder="Optional note" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create Goal</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddContributionModal({ goal, goalContribs, onSave, onClose }) {
  const contributed = goalContribs.reduce((s, c) => s + c.amount, 0)
  const remaining = Math.max(goal.target - contributed, 0)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', note: '' })
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = e => {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) return
    onSave({ id: stableId({}), date: form.date, amount: amt, note: form.note.trim() })
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2>{goal.icon} Add Contribution</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="form">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Saved: <strong>{fmtINR(contributed)}</strong> of {fmtINR(goal.target)} · Remaining: <strong>{fmtINR(remaining)}</strong>
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => s('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Amount (₹) *</label>
              <input type="number" min="1" step="1" value={form.amount} onChange={e => s('amount', e.target.value)} required placeholder="1000" autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label>Note</label>
            <input value={form.note} onChange={e => s('note', e.target.value)} placeholder="Optional" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Expense / Income Items ───────────────────────────────

const ExpItem = memo(function ExpItem({ item, onDelete, onEdit, bulkMode, isSelected, onToggleSelect }) {
  const cat = CATS[item.category] || CATS['Other']
  return (
    <div className={`item${isSelected ? ' item-selected' : ''}`} style={{ borderLeft: `3px solid ${item.customColor || cat.color}` }}>
      {bulkMode && <input type="checkbox" className="item-checkbox" checked={isSelected} onChange={() => onToggleSelect(item.id)} />}
      <div className="item-icon">{cat.icon}</div>
      <div className="item-body">
        <div className="item-desc">{item.description}</div>
        <div className="item-meta">
          <span className="item-tag">{item.category}</span>
          {item.subcategory && <span className="item-tag">{item.subcategory}</span>}
          <span className="item-tag">{item.paymentMethod}</span>
          {item.isRecurring && <span className="item-tag item-tag-rec">🔄 {item.recurringPeriod}</span>}
          {(item.tags || []).map(t => <span key={t} className="item-tag">{t}</span>)}
        </div>
        {item.notes && <div className="item-notes">{item.notes}</div>}
      </div>
      <div className="item-right">
        <div className="item-amount">{fmtINR(toINR(item))}</div>
        {item.currency !== 'INR' && <div className="item-foreign">{CM[item.currency]?.symbol || item.currency}{item.amount}</div>}
        {!bulkMode && (
          <div className="item-actions">
            <button className="item-btn" onClick={() => onEdit(item)}>✏️</button>
            <button className="item-btn item-btn-del" onClick={() => onDelete(item.id)}>🗑️</button>
          </div>
        )}
      </div>
    </div>
  )
})

const IncItem = memo(function IncItem({ item, onDelete, onEdit }) {
  return (
    <div className="item" style={{ borderLeft: '3px solid #10b981' }}>
      <div className="item-icon">💵</div>
      <div className="item-body">
        <div className="item-desc">{item.description}</div>
        <div className="item-meta">
          <span className="item-tag">{item.source}</span>
          <span className="item-tag">{item.paymentMethod}</span>
          {item.isRecurring && <span className="item-tag item-tag-rec">🔄 {item.recurringPeriod}</span>}
        </div>
        {item.notes && <div className="item-notes">{item.notes}</div>}
      </div>
      <div className="item-right">
        <div className="item-amount" style={{ color: '#10b981' }}>+{fmtINR(toINR(item))}</div>
        {item.currency !== 'INR' && <div className="item-foreign">{CM[item.currency]?.symbol || item.currency}{item.amount}</div>}
        <div className="item-actions">
          <button className="item-btn" onClick={() => onEdit(item)}>✏️</button>
          <button className="item-btn item-btn-del" onClick={() => onDelete(item.id)}>🗑️</button>
        </div>
      </div>
    </div>
  )
})

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-sm">
        <div className="modal-header"><h2>Confirm Delete</h2></div>
        <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{message}</p>
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
    expenses, income, budgets, goals, contributions,
    loading, error,
    addExpense, editExpense, deleteExpense, deleteManyExpenses,
    addIncome,  editIncome,  deleteIncome,
    saveBudgets,
    addGoal, deleteGoal, addContribution, deleteContribution,
  } = useStorage(userId)

  // ── UI state ─────────────────────────────────────────
  const [tab, setTab]                     = useState('overview')
  const [dark, setDark]                   = useState(() => localStorage.getItem('et_v6_dark') === '1')
  const [colorblind, setColorblind]       = useState(() => localStorage.getItem('et_v6_cb') === '1')
  const [showEF, setShowEF]               = useState(false)
  const [showIF, setShowIF]               = useState(false)
  const [editExpTarget, setEditExpTarget] = useState(null)
  const [editIncTarget, setEditIncTarget] = useState(null)
  const [delTarget, setDelTarget]         = useState(null)
  const [bulkMode, setBulkMode]           = useState(false)
  const [selectedIds, setSelectedIds]     = useState({})
  const [showGoalForm, setShowGoalForm]   = useState(false)
  const [contribGoal, setContribGoal]     = useState(null)

  // ── Toast ─────────────────────────────────────────────
  const [toasts, setToasts] = useState([])
  const _firedToasts = useRef(new Set())
  const addToast = useCallback((kind, icon, title, msg, duration = 6000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, kind, icon, title, msg }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 220)
    }, duration)
  }, [])
  const dismissToast = useCallback(id => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 220)
  }, [])

  // ── Theme effects ─────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('et_v6_dark', dark ? '1' : '0')
  }, [dark])
  useEffect(() => {
    document.documentElement.classList.toggle('colorblind', colorblind)
    localStorage.setItem('et_v6_cb', colorblind ? '1' : '0')
  }, [colorblind])

  // ── Filters — expenses ───────────────────────────────
  const [expSearch,    setExpSearch]    = useState('')
  const [expMonth,     setExpMonth]     = useState('')
  const [expPayment,   setExpPayment]   = useState('All')
  const [expCurrency,  setExpCurrency]  = useState('All')
  const [expCategories,setExpCategories]= useState([])
  const [expDateFrom,  setExpDateFrom]  = useState('')
  const [expDateTo,    setExpDateTo]    = useState('')
  const [expAmtMin,    setExpAmtMin]    = useState('')
  const [expAmtMax,    setExpAmtMax]    = useState('')
  const [showAdvExp,   setShowAdvExp]   = useState(false)
  const dExpSearch = useDebounce(expSearch)

  // ── Filters — income ─────────────────────────────────
  const [incSearch,   setIncSearch]   = useState('')
  const [incMonth,    setIncMonth]    = useState('')
  const [incSource,   setIncSource]   = useState('All')
  const [incDateFrom, setIncDateFrom] = useState('')
  const [incDateTo,   setIncDateTo]   = useState('')
  const [incAmtMin,   setIncAmtMin]   = useState('')
  const [incAmtMax,   setIncAmtMax]   = useState('')
  const [showAdvInc,  setShowAdvInc]  = useState(false)
  const dIncSearch = useDebounce(incSearch)

  // ── Keyboard shortcuts ───────────────────────────────
  useEffect(() => {
    const TABS = ['overview', 'income', 'trends', 'budgets', 'goals', 'insights']
    const h = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      const n = parseInt(e.key); if (n >= 1 && n <= TABS.length) setTab(TABS[n - 1])
      if (e.key === 'n' || e.key === 'N') setShowEF(true)
      if (e.key === 'i' || e.key === 'I') setShowIF(true)
      if (e.key === 'd' || e.key === 'D') setDark(m => !m)
      if (e.key === 'Escape') {
        setShowEF(false); setShowIF(false); setDelTarget(null)
        setEditExpTarget(null); setEditIncTarget(null)
        setBulkMode(false); setSelectedIds({})
        setShowGoalForm(false); setContribGoal(null)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Filtered lists ───────────────────────────────────
  const filteredExp = useMemo(() => expenses.filter(e => {
    if (!matchesSearch(e, dExpSearch)) return false
    if (expCategories.length && !expCategories.includes(e.category)) return false
    if (expPayment  !== 'All' && (e.paymentMethod || 'Cash') !== expPayment)  return false
    if (expCurrency !== 'All' && (e.currency       || 'INR') !== expCurrency) return false
    if (expMonth && !(e.date || '').startsWith(expMonth)) return false
    if (expDateFrom && (e.date || '') < expDateFrom) return false
    if (expDateTo   && (e.date || '') > expDateTo)   return false
    const amt = toINR(e)
    if (expAmtMin !== '' && amt < parseFloat(expAmtMin)) return false
    if (expAmtMax !== '' && amt > parseFloat(expAmtMax)) return false
    return true
  }), [expenses, dExpSearch, expCategories, expPayment, expCurrency, expMonth, expDateFrom, expDateTo, expAmtMin, expAmtMax])

  const filteredInc = useMemo(() => income.filter(i => {
    if (!matchesSearch(i, dIncSearch)) return false
    if (incSource !== 'All' && (i.source || 'Other') !== incSource) return false
    if (incMonth && !(i.date || '').startsWith(incMonth)) return false
    if (incDateFrom && (i.date || '') < incDateFrom) return false
    if (incDateTo   && (i.date || '') > incDateTo)   return false
    const amt = toINR(i)
    if (incAmtMin !== '' && amt < parseFloat(incAmtMin)) return false
    if (incAmtMax !== '' && amt > parseFloat(incAmtMax)) return false
    return true
  }), [income, dIncSearch, incSource, incMonth, incDateFrom, incDateTo, incAmtMin, incAmtMax])

  // ── Totals ───────────────────────────────────────────
  const totalExp   = useMemo(() => filteredExp.reduce((s, e) => s + toINR(e), 0), [filteredExp])
  const totalInc   = useMemo(() => filteredInc.reduce((s, i) => s + toINR(i), 0), [filteredInc])
  const allExpINR  = useMemo(() => expenses.reduce((s, e) => s + toINR(e), 0), [expenses])
  const allIncINR  = useMemo(() => income.reduce((s, i)   => s + toINR(i), 0), [income])
  const netSavings = allIncINR - allExpINR

  const todayStr   = new Date().toISOString().split('T')[0]
  const monthStr   = todayStr.substring(0, 7)
  const weekStart  = (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0] })()

  const spentToday = useMemo(() => expenses.filter(e => e.date === todayStr).reduce((s, e) => s + toINR(e), 0), [expenses, todayStr])
  const spentWeek  = useMemo(() => expenses.filter(e => e.date >= weekStart && e.date <= todayStr).reduce((s, e) => s + toINR(e), 0), [expenses, weekStart, todayStr])
  const spentMonth = useMemo(() => expenses.filter(e => (e.date || '').startsWith(monthStr)).reduce((s, e) => s + toINR(e), 0), [expenses, monthStr])

  const spentByCatMonth = useMemo(() => {
    const c = {}
    expenses.filter(e => (e.date || '').startsWith(monthStr)).forEach(e => { c[e.category] = (c[e.category] || 0) + toINR(e) })
    return c
  }, [expenses, monthStr])

  // ── Budget toast alerts ───────────────────────────────
  useEffect(() => {
    if (loading) return
    const checks = [
      { key: 'daily-50',  spent: spentToday, budget: budgets.daily,   pct: 50,  kind: 'warn',   icon: '⚡', label: 'Daily' },
      { key: 'daily-80',  spent: spentToday, budget: budgets.daily,   pct: 80,  kind: 'warn',   icon: '🔔', label: 'Daily' },
      { key: 'daily-100', spent: spentToday, budget: budgets.daily,   pct: 100, kind: 'danger', icon: '🚨', label: 'Daily' },
      { key: 'week-50',   spent: spentWeek,  budget: budgets.weekly,  pct: 50,  kind: 'warn',   icon: '⚡', label: 'Weekly' },
      { key: 'week-80',   spent: spentWeek,  budget: budgets.weekly,  pct: 80,  kind: 'warn',   icon: '🔔', label: 'Weekly' },
      { key: 'week-100',  spent: spentWeek,  budget: budgets.weekly,  pct: 100, kind: 'danger', icon: '🚨', label: 'Weekly' },
      { key: 'month-50',  spent: spentMonth, budget: budgets.monthly, pct: 50,  kind: 'warn',   icon: '⚡', label: 'Monthly' },
      { key: 'month-80',  spent: spentMonth, budget: budgets.monthly, pct: 80,  kind: 'warn',   icon: '🔔', label: 'Monthly' },
      { key: 'month-100', spent: spentMonth, budget: budgets.monthly, pct: 100, kind: 'danger', icon: '🚨', label: 'Monthly' },
    ]
    Object.entries(budgets.categories || {}).forEach(([cat, bgt]) => {
      if (!bgt) return
      const spent = spentByCatMonth[cat] || 0
      ;[['50','warn','⚡'], ['80','warn','🔔'], ['100','danger','🚨']].forEach(([p, kind, icon]) => {
        checks.push({ key: `cat-${cat}-${p}`, spent, budget: bgt, pct: parseInt(p), kind, icon, label: cat })
      })
    })
    checks.forEach(({ key, spent, budget, pct, kind, icon, label }) => {
      if (!budget || budget <= 0) return
      if ((spent / budget) * 100 >= pct && !_firedToasts.current.has(key)) {
        _firedToasts.current.add(key)
        const over = (spent / budget) * 100 >= 100
        addToast(kind, icon,
          over ? `${label} budget exceeded!` : `${label} budget ${pct}% reached`,
          over ? `Spent ${fmtINR(spent)} of ${fmtINR(budget)}` : `${fmtINR(spent)} spent — ${fmtINR(budget - spent)} remaining`
        )
      }
    })
  }, [spentToday, spentWeek, spentMonth, spentByCatMonth, budgets, loading])

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

  const monthlyExpData = useMemo(() => {
    const m = {}
    expenses.forEach(e => { const k = (e.date || '').substring(0, 7); if (k) m[k] = (m[k] || 0) + toINR(e) })
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({ label: k.substring(5), fullLabel: k, value: v }))
  }, [expenses])

  const monthlyIncData = useMemo(() => {
    const m = {}
    income.forEach(i => { const k = (i.date || '').substring(0, 7); if (k) m[k] = (m[k] || 0) + toINR(i) })
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({ label: k.substring(5), fullLabel: k, value: v }))
  }, [income])

  const yearlyData = useMemo(() => {
    const y = {}
    expenses.forEach(e => { const k = (e.date || '').substring(0, 4); if (k) y[k] = (y[k] || 0) + toINR(e) })
    return Object.entries(y).sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }))
  }, [expenses])

  // ── Insights ─────────────────────────────────────────
  const insights = useMemo(() => {
    const res = []
    if (!expenses.length) return res
    if (catData.length) res.push({ title: '🏆 Top Category', text: `${catData[0].label} leads at ${fmtINR(catData[0].value)} (${(catData[0].value / allExpINR * 100).toFixed(0)}% of all spending).` })
    if (allIncINR > 0) {
      const r = ((allExpINR / allIncINR) * 100).toFixed(0), sv = allIncINR - allExpINR
      res.push({ title: '📊 Savings Rate', text: `You spent ${r}% of income. ${sv >= 0 ? 'Saved ' + fmtINR(sv) + '! 🎉' : 'Overspent by ' + fmtINR(Math.abs(sv)) + ' ⚠️'}` })
    }
    if (monthlyExpData.length >= 2) {
      const last = monthlyExpData[monthlyExpData.length - 1], prev = monthlyExpData[monthlyExpData.length - 2]
      const pct = prev.value > 0 ? Math.abs((last.value - prev.value) / prev.value * 100).toFixed(0) : 0
      res.push({ title: '📈 Monthly Trend', text: last.value > prev.value ? `Spending up ${pct}% vs last month.` : `Spending down ${pct}% vs last month. Saved ${fmtINR(prev.value - last.value)}! 🎉` })
    }
    if (expenses.length >= 5) {
      const dates = [...new Set(expenses.map(e => e.date))]
      const avgDay = allExpINR / Math.max(dates.length, 1)
      res.push({ title: '📉 Daily Average', text: `${fmtINR(avgDay)}/day across ${dates.length} active days. Monthly run-rate: ~${fmtINR(avgDay * 30)}.` })
    }
    if (expenses.length >= 3) {
      const sorted = [...expenses].sort((a, b) => toINR(b) - toINR(a)), big = sorted[0]
      const avg = allExpINR / expenses.length, mult = (toINR(big) / avg).toFixed(1)
      if (mult > 2) res.push({ title: '🚨 Largest Transaction', text: `"${big.description}" on ${big.date} — ${fmtINR(toINR(big))}, which is ${mult}× your average.` })
    }
    const fixed = expenses.filter(e => e.expenseType === 'fixed')
    const fixedTotal = fixed.reduce((s, e) => s + toINR(e), 0)
    if (fixed.length && allExpINR > 0) res.push({ title: '📌 Fixed vs Variable', text: `${fixed.length} fixed expenses (${(fixedTotal / allExpINR * 100).toFixed(0)}% = ${fmtINR(fixedTotal)}). Rest is variable.` })
    const recur = expenses.filter(e => e.isRecurring)
    if (recur.length) res.push({ title: '🔄 Recurring', text: `${recur.length} active recurring template${recur.length > 1 ? 's' : ''}. Combined: ${fmtINR(recur.reduce((s, e) => s + toINR(e), 0))}.` })
    return res
  }, [catData, expenses, monthlyExpData, allIncINR, allExpINR])

  // ── Goals computed ────────────────────────────────────
  // Attach contributions to goals
  const goalsWithContribs = useMemo(() => goals.map(g => ({
    ...g,
    contributions: contributions.filter(c => c.goalId === g.id)
  })), [goals, contributions])

  // ── Grouped lists ─────────────────────────────────────
  const grouped    = useMemo(() => byDate(filteredExp), [filteredExp])
  const groupedInc = useMemo(() => byDate(filteredInc), [filteredInc])

  // ── Bulk select ───────────────────────────────────────
  const toggleSelect  = useCallback(id => setSelectedIds(prev => { const n = { ...prev }; if (n[id]) delete n[id]; else n[id] = true; return n }), [])
  const selectAll     = useCallback(() => setSelectedIds(Object.fromEntries(filteredExp.map(e => [e.id, true]))), [filteredExp])
  const deselectAll   = useCallback(() => setSelectedIds({}), [])
  const exitBulk      = useCallback(() => { setBulkMode(false); setSelectedIds({}) }, [])
  const selectedCount = Object.keys(selectedIds).length

  // ── CRUD handlers ─────────────────────────────────────
  const handleAddExpense  = f => { const e = makeExpense(f, 'manual'); if (!makeDedupContext(expenses).isDuplicate(e)) addExpense(e) }
  const handleEditExpense = f => { editExpense({ ...editExpTarget, ...f }); setEditExpTarget(null) }
  const handleAddIncome   = f => addIncome(makeIncome(f, 'manual'))
  const handleEditIncome  = f => { editIncome({ ...editIncTarget, ...f }); setEditIncTarget(null) }
  const handleDelete = () => {
    if (!delTarget) return
    if (delTarget.many) { deleteManyExpenses(Object.keys(delTarget.ids)); exitBulk() }
    else if (delTarget.type === 'expense') deleteExpense(delTarget.id)
    else deleteIncome(delTarget.id)
    setDelTarget(null)
  }

  // ── Filter helpers ────────────────────────────────────
  const hasExpFilters = expSearch || expMonth || expPayment !== 'All' || expCurrency !== 'All' || expCategories.length || expDateFrom || expDateTo || expAmtMin !== '' || expAmtMax !== ''
  const clearExpFilters = () => { setExpSearch(''); setExpMonth(''); setExpPayment('All'); setExpCurrency('All'); setExpCategories([]); setExpDateFrom(''); setExpDateTo(''); setExpAmtMin(''); setExpAmtMax('') }
  const hasIncFilters = incSearch || incMonth || incSource !== 'All' || incDateFrom || incDateTo || incAmtMin !== '' || incAmtMax !== ''
  const clearIncFilters = () => { setIncSearch(''); setIncMonth(''); setIncSource('All'); setIncDateFrom(''); setIncDateTo(''); setIncAmtMin(''); setIncAmtMax('') }
  const usedExpCurrs   = useMemo(() => [...new Set(expenses.map(e => e.currency || 'INR'))], [expenses])
  const usedIncSources = useMemo(() => [...new Set(income.map(i => i.source || 'Other'))], [income])

  // ── Month comparison table data ───────────────────────
  const allMonthlyExp = useMemo(() => {
    const m = {}
    expenses.forEach(e => { const k = (e.date || '').substring(0, 7); if (k) m[k] = (m[k] || 0) + toINR(e) })
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k.substring(5), fullLabel: k, value: v }))
  }, [expenses])

  const allMonthlyInc = useMemo(() => {
    const m = {}
    income.forEach(i => { const k = (i.date || '').substring(0, 7); if (k) m[k] = (m[k] || 0) + toINR(i) })
    return m
  }, [income])

  if (loading) return <div className="tracker-loading"><div className="spinner" /><p>Loading your data…</p></div>

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'income',   label: '💵 Income' },
    { id: 'trends',   label: '📈 Trends' },
    { id: 'budgets',  label: '💰 Budgets' },
    { id: 'goals',    label: '🎯 Goals' },
    { id: 'insights', label: '💡 Insights' },
  ]

  return (
    <div className="tracker">
      {error && <div className="error-banner">⚠️ {error} <button onClick={() => window.location.reload()}>Retry</button></div>}

      {/* ── Header ── */}
      <div className="tracker-header">
        <div className="tracker-header-left">
          <span className="tracker-title">💸 Expense Tracker</span>
          <span className="tracker-stats">{expenses.length} expenses · {income.length} income</span>
        </div>
        <div className="tracker-header-right">
          <button className="btn-ghost btn-sm" title="D" onClick={() => setDark(m => !m)}>{dark ? '🌙' : '☀️'}</button>
          <button className="btn-ghost btn-sm" title="Colorblind mode" onClick={() => setColorblind(m => !m)} style={{ opacity: colorblind ? 1 : 0.5 }}>👁️</button>
          <button className="btn-primary btn-sm" onClick={() => setShowEF(true)} title="N">➕ Expense</button>
          <button className="btn-income  btn-sm" onClick={() => setShowIF(true)} title="I">💵 Income</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <nav className="tabs" role="tablist">
        {TABS.map((t, i) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)} title={`Key ${i + 1}`}>{t.label}</button>
        ))}
      </nav>

      {/* ══════════ OVERVIEW ══════════ */}
      {tab === 'overview' && (
        <main>
          <div className="summary-grid">
            <div className="summary-card"><div className="summary-label">Expenses{hasExpFilters ? ' (filtered)' : ''}</div><div className="summary-amount" style={{ color: '#ef4444' }}>{fmtINR(totalExp)}</div></div>
            <div className="summary-card"><div className="summary-label">Income</div><div className="summary-amount" style={{ color: '#10b981' }}>{fmtINR(allIncINR)}</div></div>
            <div className="summary-card"><div className="summary-label">Net Savings</div><div className="summary-amount" style={{ color: netSavings >= 0 ? '#f59e0b' : '#ef4444' }}>{netSavings >= 0 ? '+' : ''}{fmtINR(netSavings)}</div></div>
            {budgets.monthly > 0 && <div className="summary-card"><div className="summary-label">Monthly Budget</div><div className="summary-amount" style={{ color: spentMonth > budgets.monthly ? '#ef4444' : '#10b981' }}>{fmtINR(spentMonth)} / {fmtINR(budgets.monthly)}</div></div>}
            <div className="summary-card"><div className="summary-label">Showing</div><div className="summary-amount">{filteredExp.length} / {expenses.length}</div></div>
          </div>

          {/* Filter bar */}
          <div className="filter-bar">
            <input className="search-input" placeholder="🔍 Search… or amount:>500 category:food date:2026-03"
              value={expSearch} onChange={e => setExpSearch(e.target.value)} />
            <input type="month" className="month-picker" value={expMonth} onChange={e => setExpMonth(e.target.value)} />
            <select value={expPayment} onChange={e => setExpPayment(e.target.value)}>
              <option value="All">All payments</option>{PAY_METHODS.map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={expCurrency} onChange={e => setExpCurrency(e.target.value)}>
              <option value="All">All currencies</option>{usedExpCurrs.map(c => <option key={c}>{c}</option>)}
            </select>
            <button className={`btn-ghost btn-sm${showAdvExp ? ' active' : ''}`} onClick={() => setShowAdvExp(v => !v)}>⚙ Advanced</button>
            {hasExpFilters && <button className="btn-ghost btn-sm" onClick={clearExpFilters}>✕ Clear</button>}
            {filteredExp.length > 0 && <button className="btn-ghost btn-sm" onClick={() => { if (bulkMode) exitBulk(); else setBulkMode(true) }}>{bulkMode ? '✕ Exit bulk' : '☑ Bulk'}</button>}
          </div>

          {showAdvExp && (
            <div className="adv-filters">
              <div className="adv-row">
                <label>Date from</label><input type="date" value={expDateFrom} onChange={e => setExpDateFrom(e.target.value)} />
                <label>to</label><input type="date" value={expDateTo} onChange={e => setExpDateTo(e.target.value)} />
                <label>Amount ≥</label><input type="number" placeholder="Min" value={expAmtMin} onChange={e => setExpAmtMin(e.target.value)} style={{ width: 80 }} />
                <label>≤</label><input type="number" placeholder="Max" value={expAmtMax} onChange={e => setExpAmtMax(e.target.value)} style={{ width: 80 }} />
              </div>
              <div className="cat-chips">
                {Object.keys(CATS).map(cat => (
                  <button key={cat} className={`cat-chip${expCategories.includes(cat) ? ' active' : ''}`}
                    onClick={() => setExpCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>
                    {CATS[cat].icon} {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasExpFilters && filteredExp.length > 0 && <div className="results-info">Showing {filteredExp.length} of {expenses.length} · {fmtINR(totalExp)} total</div>}

          {bulkMode && (
            <div className="bulk-bar">
              <span>{selectedCount > 0 ? `${selectedCount} selected` : 'None selected'}</span>
              <button className="btn-ghost btn-sm" onClick={selectAll}>Select all ({filteredExp.length})</button>
              {selectedCount > 0 && <button className="btn-ghost btn-sm" onClick={deselectAll}>Deselect all</button>}
              {selectedCount > 0 && <button className="btn-danger btn-sm" onClick={() => setDelTarget({ many: true, ids: selectedIds })}>🗑️ Delete {selectedCount}</button>}
            </div>
          )}

          {filteredExp.length > 0 && !bulkMode && (
            <div className="chart-row">
              <div className="chart-card"><div className="chart-title">By Category</div><PieChart data={catData} /></div>
              <div className="chart-card"><div className="chart-title">By Payment</div><PieChart data={payData} /></div>
            </div>
          )}

          {grouped.length === 0 ? (
            expenses.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">💸</div><h3>No expenses yet</h3><p>Press <kbd>N</kbd> to add your first expense</p></div>
            ) : (
              <div className="empty-state"><div className="empty-icon">🔍</div><p>No expenses match filters.</p><button className="btn-primary btn-sm" onClick={clearExpFilters}>Clear filters</button></div>
            )
          ) : grouped.map(([date, items]) => (
            <div key={date} className="date-group">
              <div className="date-group-header">
                <span>{new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span>{fmtINR(items.reduce((s, e) => s + toINR(e), 0))}</span>
              </div>
              {items.map(e => <ExpItem key={e.id} item={e}
                onDelete={id => setDelTarget({ id, type: 'expense' })}
                onEdit={e => { setEditExpTarget(e); setShowEF(true) }}
                bulkMode={bulkMode} isSelected={!!selectedIds[e.id]} onToggleSelect={toggleSelect} />)}
            </div>
          ))}
        </main>
      )}

      {/* ══════════ INCOME ══════════ */}
      {tab === 'income' && (
        <main>
          <div className="summary-grid">
            <div className="summary-card"><div className="summary-label">Total Income</div><div className="summary-amount" style={{ color: '#10b981' }}>{fmtINR(allIncINR)}</div></div>
            <div className="summary-card"><div className="summary-label">Total Expenses</div><div className="summary-amount" style={{ color: '#ef4444' }}>{fmtINR(allExpINR)}</div></div>
            <div className="summary-card"><div className="summary-label">Net Savings</div><div className="summary-amount" style={{ color: netSavings >= 0 ? '#f59e0b' : '#ef4444' }}>{netSavings >= 0 ? '+' : ''}{fmtINR(netSavings)}</div></div>
            <div className="summary-card"><div className="summary-label">Showing</div><div className="summary-amount">{filteredInc.length} / {income.length}</div></div>
          </div>

          <div className="filter-bar">
            <input className="search-input" placeholder="🔍 Search income…" value={incSearch} onChange={e => setIncSearch(e.target.value)} />
            <input type="month" className="month-picker" value={incMonth} onChange={e => setIncMonth(e.target.value)} />
            <select value={incSource} onChange={e => setIncSource(e.target.value)}>
              <option value="All">All sources</option>{usedIncSources.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className={`btn-ghost btn-sm${showAdvInc ? ' active' : ''}`} onClick={() => setShowAdvInc(v => !v)}>⚙ Advanced</button>
            {hasIncFilters && <button className="btn-ghost btn-sm" onClick={clearIncFilters}>✕ Clear</button>}
            <button className="btn-income btn-sm" onClick={() => setShowIF(true)}>💵 Add Income</button>
          </div>

          {showAdvInc && (
            <div className="adv-filters">
              <div className="adv-row">
                <label>Date from</label><input type="date" value={incDateFrom} onChange={e => setIncDateFrom(e.target.value)} />
                <label>to</label><input type="date" value={incDateTo} onChange={e => setIncDateTo(e.target.value)} />
                <label>Amount ≥</label><input type="number" placeholder="Min" value={incAmtMin} onChange={e => setIncAmtMin(e.target.value)} style={{ width: 80 }} />
                <label>≤</label><input type="number" placeholder="Max" value={incAmtMax} onChange={e => setIncAmtMax(e.target.value)} style={{ width: 80 }} />
              </div>
            </div>
          )}

          {income.length > 0 && (
            <div className="chart-row">
              <div className="chart-card"><div className="chart-title">By Source</div><PieChart data={incSrcData} /></div>
              {monthlyIncData.length >= 2 && <div className="chart-card"><div className="chart-title">Monthly Trend</div><LineChart data={monthlyIncData} /></div>}
            </div>
          )}

          {groupedInc.length === 0 ? (
            income.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">💵</div><h3>No income yet</h3><p>Press <kbd>I</kbd> to add income</p></div>
            ) : (
              <div className="empty-state"><div className="empty-icon">🔍</div><p>No income matches filters.</p><button className="btn-primary btn-sm" onClick={clearIncFilters}>Clear filters</button></div>
            )
          ) : groupedInc.map(([date, items]) => (
            <div key={date} className="date-group">
              <div className="date-group-header">
                <span>{new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span style={{ color: '#10b981' }}>+{fmtINR(items.reduce((s, i) => s + toINR(i), 0))}</span>
              </div>
              {items.map(i => <IncItem key={i.id} item={i}
                onDelete={id => setDelTarget({ id, type: 'income' })}
                onEdit={i => { setEditIncTarget(i); setShowIF(true) }} />)}
            </div>
          ))}
        </main>
      )}

      {/* ══════════ TRENDS ══════════ */}
      {tab === 'trends' && (
        <main>
          <div className="chart-row">
            <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
              <div className="chart-title">📅 Monthly Spending Trend (last 12 months)</div>
              <LineChart data={monthlyExpData} />
            </div>
          </div>
          <div className="chart-row">
            <div className="chart-card"><div className="chart-title">Category Breakdown</div><PieChart data={catData} /></div>
            <div className="chart-card"><div className="chart-title">Payment Breakdown</div><PieChart data={payData} /></div>
          </div>
          {catData.length > 0 && (
            <div className="chart-card" style={{ marginBottom: '1rem' }}>
              <div className="chart-title">Category Bars</div>
              <BarChart data={catData} />
            </div>
          )}
          <div className="chart-card" style={{ marginBottom: '1rem' }}>
            <div className="chart-title">🗓️ 90-Day Activity Heatmap</div>
            <HeatmapCalendar expenses={expenses} income={income} />
          </div>
          <div className="chart-card" style={{ marginBottom: '1rem', overflowX: 'auto' }}>
            <div className="chart-title">Month-by-Month Comparison</div>
            <table className="comp-table">
              <thead><tr><th>Month</th><th>Expenses</th><th>vs Prev</th><th>Income</th><th>Saved</th><th>Txns</th></tr></thead>
              <tbody>{allMonthlyExp.slice().reverse().map(({ fullLabel, value }, i, arr) => {
                const prevVal = arr[i + 1]?.value
                const inc = allMonthlyInc[fullLabel] || 0
                const saved = inc - value
                const cnt = expenses.filter(e => e.date?.startsWith(fullLabel)).length
                const isNow = fullLabel === monthStr
                let delta = null
                if (prevVal != null && prevVal > 0) {
                  const pct = ((value - prevVal) / prevVal * 100)
                  delta = <span className={pct > 5 ? 'delta-up' : pct < -5 ? 'delta-dn' : 'delta-flat'}>{pct > 5 ? '↑' : pct < -5 ? '↓' : '–'}{Math.abs(pct).toFixed(0)}%</span>
                }
                return (
                  <tr key={i} className={isNow ? 'row-now' : ''}>
                    <td style={{ fontWeight: isNow ? 700 : 400 }}>{fullLabel}{isNow && <span className="badge-now">now</span>}</td>
                    <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmtINR(value)}</td>
                    <td>{delta || <span className="delta-flat">—</span>}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{inc ? fmtINR(inc) : '—'}</td>
                    <td style={{ color: saved >= 0 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>{inc ? (saved >= 0 ? '+' : '') + fmtINR(saved) : '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{cnt}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
          {yearlyData.length > 0 && (
            <div className="chart-card" style={{ marginBottom: '1rem' }}>
              <div className="chart-title">📆 Year-over-Year</div>
              <LineChart data={yearlyData} />
            </div>
          )}
        </main>
      )}

      {/* ══════════ BUDGETS ══════════ */}
      {tab === 'budgets' && (
        <main>
          <div className="summary-grid">
            {[
              { val: fmtINR(spentToday), lbl: 'Today', color: budgets.daily > 0 ? (spentToday / budgets.daily >= 1 ? '#ef4444' : spentToday / budgets.daily >= 0.5 ? '#f59e0b' : '#10b981') : 'var(--text)' },
              { val: fmtINR(spentWeek),  lbl: 'This Week', color: budgets.weekly > 0 ? (spentWeek / budgets.weekly >= 1 ? '#ef4444' : '#10b981') : 'var(--text)' },
              { val: fmtINR(spentMonth), lbl: 'This Month', color: budgets.monthly > 0 ? (spentMonth / budgets.monthly >= 1 ? '#ef4444' : '#10b981') : 'var(--text)' },
              { val: expenses.filter(e => (e.date || '').startsWith(monthStr)).length, lbl: 'Txns This Month', color: 'var(--text)' },
            ].map(s => (
              <div key={s.lbl} className="summary-card"><div className="summary-label">{s.lbl}</div><div className="summary-amount" style={{ color: s.color }}>{s.val}</div></div>
            ))}
          </div>

          <div className="budget-grid">
            <div className="chart-card">
              <div className="chart-title">⏱️ Time-Based Budgets</div>
              {[['daily', '📅 Daily', 'per day'], ['weekly', '🗓️ Weekly', 'Sun–Sat'], ['monthly', '📆 Monthly', 'calendar month']].map(([key, label, sub]) => (
                <div key={key} className="budget-input-row">
                  <div className="budget-input-label">{label}<span className="budget-sub">{sub}</span></div>
                  <input type="number" min="0" placeholder="0 = off" className="budget-number-input"
                    value={budgets[key] || ''}
                    onChange={e => saveBudgets({ ...budgets, [key]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
              <p className="budget-hint">Set to 0 to disable. Saves automatically.</p>
            </div>
            <div className="chart-card">
              <div className="chart-title">📊 Budget vs Actual</div>
              <BudgetBar icon="📅" label="Daily"   spent={spentToday} budget={budgets.daily} />
              <BudgetBar icon="🗓️" label="Weekly"  spent={spentWeek}  budget={budgets.weekly} />
              <BudgetBar icon="📆" label="Monthly" spent={spentMonth} budget={budgets.monthly} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-title">📁 Per-Category Budgets ({monthStr})</div>
            <div className="cat-budget-grid">
              {Object.keys(CATS).map(cat => {
                const catBgt = budgets.categories?.[cat] || 0
                const catSpent = spentByCatMonth[cat] || 0
                return (
                  <div key={cat}>
                    <div className="budget-input-row">
                      <span className="budget-input-label">{CATS[cat].icon} {cat}</span>
                      <input type="number" min="0" placeholder="0 = off" className="budget-number-input"
                        value={catBgt || ''}
                        onChange={e => saveBudgets({ ...budgets, categories: { ...(budgets.categories || {}), [cat]: parseFloat(e.target.value) || 0 } })} />
                    </div>
                    {(catBgt > 0 || catSpent > 0) && <div style={{ paddingLeft: '1.5rem' }}><BudgetBar label={`${fmtINR(catSpent)} spent`} spent={catSpent} budget={catBgt} /></div>}
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      )}

      {/* ══════════ GOALS ══════════ */}
      {tab === 'goals' && (() => {
        const totalTarget      = goalsWithContribs.reduce((s, g) => s + g.target, 0)
        const totalContributed = goalsWithContribs.reduce((s, g) => s + g.contributions.reduce((a, c) => a + c.amount, 0), 0)
        const overallPct       = totalTarget > 0 ? Math.min((totalContributed / totalTarget) * 100, 100) : 0
        const completedGoals   = goalsWithContribs.filter(g => g.contributions.reduce((s, c) => s + c.amount, 0) >= g.target).length
        return (
          <main>
            <div className="summary-grid">
              {[
                { val: goalsWithContribs.length, lbl: 'Total Goals', color: '#667eea' },
                { val: completedGoals, lbl: 'Completed', color: '#10b981' },
                { val: fmtINR(totalTarget), lbl: 'Total Target', color: 'var(--text)' },
                { val: fmtINR(totalContributed), lbl: 'Total Saved', color: '#10b981' },
                { val: overallPct.toFixed(0) + '%', lbl: 'Overall', color: overallPct >= 100 ? '#10b981' : overallPct >= 50 ? '#f59e0b' : '#667eea' },
              ].map(s => <div key={s.lbl} className="summary-card"><div className="summary-label">{s.lbl}</div><div className="summary-amount" style={{ color: s.color }}>{s.val}</div></div>)}
            </div>

            <div className="goals-grid">
              {goalsWithContribs.map(goal => {
                const contributed = goal.contributions.reduce((s, c) => s + c.amount, 0)
                const pct         = goal.target > 0 ? Math.min((contributed / goal.target) * 100, 100) : 0
                const done        = contributed >= goal.target
                const barColor    = done ? '#10b981' : pct >= 75 ? '#f59e0b' : '#667eea'
                const daysLeft    = goal.targetDate ? Math.ceil((new Date(goal.targetDate + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 864e5) : null
                return (
                  <div key={goal.id} className="goal-card" style={{ '--goal-accent': barColor }}>
                    <div className="goal-card-header">
                      <div className="goal-icon">{goal.icon || '🎯'}</div>
                      <div className="goal-meta">
                        <div className="goal-name">{goal.name}</div>
                        <div className="goal-date">
                          {goal.targetDate
                            ? daysLeft < 0 ? '⚠️ Overdue' : daysLeft === 0 ? '🔔 Due today' : `📅 ${daysLeft}d left`
                            : `Created ${goal.createdAt}`}
                        </div>
                      </div>
                      <div className="goal-card-actions">
                        {!done && <button className="goal-btn" onClick={() => setContribGoal(goal)}>+ Add</button>}
                        <button className="goal-btn goal-btn-del" onClick={() => deleteGoal(goal.id)}>✕</button>
                      </div>
                    </div>
                    <div className="goal-progress-row">
                      <span className="goal-pct" style={{ color: barColor }}>{done ? '🏆 Complete!' : pct.toFixed(0) + '%'}</span>
                      <span className="goal-amounts">{fmtINR(contributed)} / {fmtINR(goal.target)}</span>
                    </div>
                    <div className="goal-bar-track"><div className="goal-bar-fill" style={{ width: pct + '%', background: barColor }} /></div>
                    {!done && <div className="goal-remaining">{fmtINR(goal.target - contributed)} remaining{daysLeft > 0 && ` · ≈ ${fmtINR((goal.target - contributed) / daysLeft)}/day`}</div>}
                    {goal.contributions.length > 0 && (
                      <div className="goal-contribs">
                        <div className="goal-contribs-title">Contributions ({goal.contributions.length})</div>
                        {[...goal.contributions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(c => (
                          <div key={c.id} className="contrib-row">
                            <span className="contrib-date">{c.date}</span>
                            <span className="contrib-amount">+{fmtINR(c.amount)}</span>
                            {c.note && <span className="contrib-note">{c.note}</span>}
                            <button className="contrib-del" onClick={() => deleteContribution(c.id)}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <button className="goal-create-btn" onClick={() => setShowGoalForm(true)}>＋ New Goal</button>
            </div>
            {goalsWithContribs.length === 0 && (
              <div className="empty-state"><div className="empty-icon">🎯</div><h3>No goals yet</h3><p>Set a savings goal and track progress. Toasts fire at 25%, 50%, 75%, 100%!</p></div>
            )}
          </main>
        )
      })()}

      {/* ══════════ INSIGHTS ══════════ */}
      {tab === 'insights' && (
        <main>
          {expenses.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">💡</div><h3>No data yet</h3><p>Add some expenses to see insights.</p></div>
          ) : (
            <div className="insights-grid">
              {insights.map((ins, i) => (
                <div key={i} className="insight-card">
                  <div className="insight-title">{ins.title}</div>
                  <div className="insight-text">{ins.text}</div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── Modals ── */}
      {showEF && <ExpenseForm initialData={editExpTarget} onSubmit={editExpTarget ? handleEditExpense : handleAddExpense} onClose={() => { setShowEF(false); setEditExpTarget(null) }} />}
      {showIF && <IncomeForm  initialData={editIncTarget} onSubmit={editIncTarget ? handleEditIncome  : handleAddIncome}  onClose={() => { setShowIF(false); setEditIncTarget(null) }} />}
      {delTarget && <ConfirmDialog message={delTarget.many ? `Permanently delete ${Object.keys(delTarget.ids).length} expenses?` : `Delete this ${delTarget.type}? Cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDelTarget(null)} />}
      {showGoalForm && <CreateGoalModal onSave={addGoal} onClose={() => setShowGoalForm(false)} />}
      {contribGoal && <AddContributionModal goal={contribGoal} goalContribs={contributions.filter(c => c.goalId === contribGoal.id)} onSave={c => addContribution(contribGoal.id, c)} onClose={() => setContribGoal(null)} />}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
