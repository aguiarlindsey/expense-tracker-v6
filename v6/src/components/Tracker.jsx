import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useDebounce } from '../hooks/useDebounce'
import { CATS, CM, PAY_METHODS, UPI_APPS, WALLET_APPS, INC_SOURCES, EXP_TYPES, CURRENCIES, RECURRING_PERIODS, CC, DINING_APPS, GROCERY_TAGS, FALLBACK_RATES } from '../utils/constants'
import { makeExpense, makeIncome, makeDedupContext, matchesSearch, stableId } from '../utils/dataHelpers'
import { migrateV5Data, validateV5File } from '../utils/migrateV5'
import { useNotifications } from '../hooks/useNotifications'

// ─── Helpers ─────────────────────────────────────────────

function _fmtINR(n) {
  if (isNaN(n) || n == null) return '₹0'
  return '₹' + parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
// Module-level alias — sub-components use this; Tracker shadows it with incognito-aware version
const fmtINR = _fmtINR
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

function calculateSafeToSpend(monthIncINR, fixedExpINR, savingsGoalINR, todayStr) {
  const parts = todayStr.split('-')
  const y = parseInt(parts[0]), m = parseInt(parts[1])
  const daysInMonth = new Date(y, m, 0).getDate()
  const discretionary = monthIncINR - fixedExpINR - savingsGoalINR
  const dailyAllowance = discretionary > 0 ? discretionary / daysInMonth : 0
  const daysRemaining = daysInMonth - parseInt(parts[2]) + 1
  return { dailyAllowance, daysRemaining, discretionary }
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

function PieChart({ data, size = 190, incognito = false }) {
  const fmtINR = n => incognito ? '••••••' : _fmtINR(n)
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
        const color = d._color || CATS[d.label]?.color || `hsl(${i * 37},65%,55%)`
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

  const dayData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const days = {}
    for (let i = 89; i >= 0; i--) {
      const d = new Date(todayStr + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - i)
      const key = d.toISOString().split('T')[0]
      days[key] = { date: key, amount: 0, count: 0, income: 0, incomeCount: 0, topColor: null, topCat: null, topDesc: null, _topVal: 0 }
    }
    expenses.forEach(e => {
      if (!days[e.date]) return
      const v = toINR(e)
      days[e.date].amount += v
      days[e.date].count++
      if (v > days[e.date]._topVal) {
        days[e.date]._topVal = v
        days[e.date].topColor = (e.customColor && e.customColor.startsWith('#')) ? e.customColor : (CATS[e.category]?.color || '#667eea')
        days[e.date].topCat  = e.category || 'Other'
        days[e.date].topDesc = e.description || ''
      }
    })
    income.forEach(inc => {
      if (!days[inc.date]) return
      days[inc.date].income += toINR(inc)
      days[inc.date].incomeCount++
    })
    return Object.values(days)
  }, [expenses, income])

  // Recompute every time mode OR dayData changes — explicit deps prevent stale colours
  const { cellMap, tipMap } = useMemo(() => {
    const maxA = Math.max(...dayData.map(d => d.amount), 1)
    const maxC = Math.max(...dayData.map(d => d.count),  1)
    const maxI = Math.max(...dayData.map(d => d.income), 1)

    const cellMap = new Map()
    const tipMap  = new Map()

    dayData.forEach(d => {
      // ── background colour ──────────────────────────────
      let bg
      if (mode === 'amount') {
        const t = d.amount / maxA
        if (t > 0) {
          const a    = (0.15 + t * 0.85).toFixed(2)
          const base = d.topColor || '#667eea'
          const r    = parseInt(base.slice(1, 3), 16)
          const g    = parseInt(base.slice(3, 5), 16)
          const b    = parseInt(base.slice(5, 7), 16)
          bg = isNaN(r) ? `rgba(102,126,234,${a})` : `rgba(${r},${g},${b},${a})`
        }
      } else if (mode === 'count') {
        const t = d.count / maxC
        if (t > 0) bg = `rgba(99,102,241,${(0.15 + t * 0.85).toFixed(2)})`
      } else {
        const t = d.income / maxI
        if (t > 0) bg = `rgba(16,185,129,${(0.15 + t * 0.85).toFixed(2)})`
      }
      cellMap.set(d.date, bg) // undefined = no activity → CSS default

      // ── tooltip ────────────────────────────────────────
      let tip = d.date
      if (mode === 'income') {
        tip += d.income > 0
          ? `\n+${fmtINR(d.income)} income · ${d.incomeCount} entr${d.incomeCount > 1 ? 'ies' : 'y'}`
          : '\nNo income recorded'
      } else if (mode === 'count') {
        tip += d.count > 0
          ? `\n${d.count} txn${d.count > 1 ? 's' : ''} · ${fmtINR(d.amount)} total`
          : '\nNo expenses'
      } else {
        if (d.count > 0) {
          const icon = CATS[d.topCat]?.icon || ''
          tip += `\n${icon} ${d.topCat}: ${fmtINR(d._topVal)}`
          if (d.topDesc) tip += `\n"${d.topDesc}"`
          tip += `\n${d.count} txn${d.count > 1 ? 's' : ''} · Total ${fmtINR(d.amount)}`
        } else {
          tip += '\nNo expenses'
        }
      }
      tipMap.set(d.date, tip)
    })

    return { cellMap, tipMap }
  }, [dayData, mode])

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
              style={{ background: d ? cellMap.get(d.date) : 'transparent', border: d ? undefined : 'none' }}
              title={d ? tipMap.get(d.date) : ''}
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

const BudgetBar = memo(function BudgetBar({ icon, label, spent, budget, incognito = false }) {
  const fmtINR = n => incognito ? '••••••' : _fmtINR(n)
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
  const level = over || pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : pct >= 50 ? 'warn' : 'ok'
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

function ExpenseForm({ onSubmit, onClose, initialData, rateData }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState(initialData ? {
    useCatAlloc: !!(initialData.categoryAllocations && Object.keys(initialData.categoryAllocations || {}).length),
    categoryAllocations: initialData.categoryAllocations || {},
    ...initialData,
  } : {
    date: today, description: '', amount: '', currency: 'INR',
    conversionRate: 1, category: 'Food', subcategory: '',
    expenseType: 'variable', paymentMethod: 'UPI/QR',
    paymentDescription: '', diningApp: '', notes: '',
    tags: [], customColor: null, isRecurring: false,
    recurringPeriod: 'monthly', nextDueDate: '',
    splitWith: '', splitParts: 1, receiptRef: '',
    useCatAlloc: false, categoryAllocations: {},
  })
  const [showPalette, setShowPalette] = useState(false)
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const calcNextDue = (fromDate, period) => {
    const d = new Date((fromDate || today) + 'T12:00:00')
    const origDay = d.getDate()
    if (period === 'daily')      d.setDate(origDay + 1)
    else if (period === 'weekly')    d.setDate(origDay + 7)
    else if (period === 'biweekly')  d.setDate(origDay + 14)
    else if (period === 'monthly') {
      const nm = d.getMonth() + 1, ny = d.getFullYear() + (nm > 11 ? 1 : 0)
      d.setFullYear(ny, nm % 12, Math.min(origDay, new Date(ny, nm % 12 + 1, 0).getDate()))
    } else if (period === 'quarterly') {
      const nm = d.getMonth() + 3, ny = d.getFullYear() + Math.floor((d.getMonth() + 3) / 12)
      d.setFullYear(ny, nm % 12, Math.min(origDay, new Date(ny, nm % 12 + 1, 0).getDate()))
    } else if (period === 'yearly') d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  }

  const onCurrencyChange = code => {
    s('currency', code)
    if (code === 'INR') { s('conversionRate', 1); return }
    const rate = rateData?.rates?.[code]
    if (rate) s('conversionRate', parseFloat(rate.toFixed(6)))
  }

  const sub = e => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0) return
    const amt  = parseFloat(form.amount)
    const rate = parseFloat(form.conversionRate) || 1
    const catAlloc = form.useCatAlloc && form.categoryAllocations && Object.keys(form.categoryAllocations).length
      ? form.categoryAllocations : null
    let primaryCat = form.category
    if (catAlloc) {
      const dom = Object.entries(catAlloc).sort((a, b) => b[1] - a[1])[0]
      if (dom) primaryCat = dom[0]
    }
    onSubmit({
      ...form, amount: amt, splitParts: parseInt(form.splitParts) || 1,
      conversionRate: rate,
      amountINR: form.currency === 'INR' ? amt : amt * rate,
      nextDueDate: form.isRecurring ? (form.nextDueDate || calcNextDue(form.date, form.recurringPeriod)) : '',
      category: primaryCat,
      categoryAllocations: catAlloc,
    })
    onClose()
  }

  const toggleTag = tag => s('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag])
  const catSubs   = CATS[form.category]?.subs || []
  const isForeign = form.currency !== 'INR'
  const inrPreview = isForeign && form.amount ? parseFloat(form.amount) * (parseFloat(form.conversionRate) || 1) : null

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
              <select value={form.currency} onChange={e => onCurrencyChange(e.target.value)}>
                {CURRENCIES.slice(0, 12).map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </div>
          </div>
          {isForeign && (
            <div className="form-row">
              <div className="form-group">
                <label>Rate: 1 {form.currency} = ? INR</label>
                <input type="number" step="0.000001" min="0" value={form.conversionRate}
                  onChange={e => s('conversionRate', parseFloat(e.target.value) || 0)} />
              </div>
              {inrPreview !== null && (
                <div className="form-group">
                  <label>INR Equivalent</label>
                  <div className="currency-preview">{fmtINR(inrPreview)}</div>
                </div>
              )}
            </div>
          )}
          <div className="form-group">
            <label>Description *</label>
            <input value={form.description} onChange={e => s('description', e.target.value)} required placeholder="What did you spend on?" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => { s('category', e.target.value); s('subcategory', ''); s('diningApp', '') }}>
                {Object.keys(CATS).map(c => <option key={c} value={c}>{CATS[c].icon} {c}</option>)}
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
          {form.paymentMethod === 'UPI/QR' && (
            <div className="form-group">
              <label>UPI App</label>
              <select value={form.paymentDescription || ''} onChange={e => s('paymentDescription', e.target.value)}>
                {UPI_APPS.map(a => <option key={a} value={a}>{a || '— Select app —'}</option>)}
              </select>
            </div>
          )}
          {form.paymentMethod === 'Wallet' && (
            <div className="form-group">
              <label>Wallet</label>
              <select value={form.paymentDescription || ''} onChange={e => s('paymentDescription', e.target.value)}>
                {WALLET_APPS.map(a => <option key={a} value={a}>{a || '— Select wallet —'}</option>)}
              </select>
            </div>
          )}
          {form.paymentMethod !== 'Cash' && form.paymentMethod !== 'UPI/QR' && form.paymentMethod !== 'Wallet' && (
            <div className="form-group">
              <label>Payment Reference</label>
              <input value={form.paymentDescription || ''} onChange={e => s('paymentDescription', e.target.value)}
                placeholder="Card last 4 digits, txn ID…" />
            </div>
          )}
          {form.category === 'Food' && (
            <div className="form-group">
              <label>Dining App</label>
              <select value={form.diningApp || ''} onChange={e => s('diningApp', e.target.value)}>
                {DINING_APPS.map(a => <option key={a} value={a}>{a || '— None —'}</option>)}
              </select>
            </div>
          )}
          {form.category === 'Food' && (
            <div className="form-group">
              <label>Grocery Tags</label>
              <div className="tags-container">
                {GROCERY_TAGS.map(tag => (
                  <button type="button" key={tag}
                    className={`tag-btn${form.tags.includes(tag) ? ' selected' : ''}`}
                    onClick={() => toggleTag(tag)}>{tag}</button>
                ))}
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Receipt / Order ID</label>
              <input value={form.receiptRef || ''} onChange={e => s('receiptRef', e.target.value)} placeholder="Order #, receipt number…" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input value={form.notes} onChange={e => s('notes', e.target.value)} placeholder="Optional note" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Split With</label>
              <input value={form.splitWith || ''} onChange={e => s('splitWith', e.target.value)} placeholder="Alice, Bob… (leave blank if no split)" />
            </div>
            {form.splitWith && (
              <div className="form-group">
                <label>Total Parts (your share = 1/{form.splitParts || 2})</label>
                <input type="number" min="2" max="20" value={form.splitParts || 2} onChange={e => s('splitParts', parseInt(e.target.value) || 2)} />
                {form.amount && <div className="currency-preview">Your share: {fmtINR(parseFloat(form.amount) / (parseInt(form.splitParts) || 2))}</div>}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Item Colour</label>
            <div className="color-picker-trigger" onClick={() => setShowPalette(p => !p)}>
              <span className="color-swatch-preview" style={{ background: form.customColor || CATS[form.category]?.color || '#667eea' }} />
              <span>{form.customColor ? form.customColor : 'Category default'}</span>
              {form.customColor && (
                <button type="button" className="color-clear-btn" onClick={e => { e.stopPropagation(); s('customColor', null) }}>✕</button>
              )}
            </div>
            {showPalette && (
              <div className="color-palette">
                {CC.map(hex => (
                  <button key={hex} type="button" className={`color-dot${form.customColor === hex ? ' selected' : ''}`}
                    style={{ background: hex }} title={hex}
                    onClick={() => { s('customColor', hex); setShowPalette(false) }} />
                ))}
              </div>
            )}
          </div>
          <div className="form-check">
            <input type="checkbox" id="exp-recurring" checked={form.isRecurring} onChange={e => s('isRecurring', e.target.checked)} />
            <label htmlFor="exp-recurring">Recurring</label>
            {form.isRecurring && (
              <select value={form.recurringPeriod}
                onChange={e => { s('recurringPeriod', e.target.value); s('nextDueDate', calcNextDue(form.date, e.target.value)) }}
                style={{ marginLeft: 8 }}>
                {RECURRING_PERIODS.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
            )}
          </div>
          {form.isRecurring && (
            <div className="form-group" style={{ marginTop: 8 }}>
              <label>Next Due Date</label>
              <input type="date" value={form.nextDueDate || calcNextDue(form.date, form.recurringPeriod)}
                onChange={e => s('nextDueDate', e.target.value)} />
            </div>
          )}
          <div className="form-check" style={{ marginTop: 12 }}>
            <input type="checkbox" id="use-cat-alloc" checked={form.useCatAlloc || false}
              onChange={e => s('useCatAlloc', e.target.checked)} />
            <label htmlFor="use-cat-alloc">Split across categories</label>
          </div>
          {form.useCatAlloc && (() => {
            const allocs = form.categoryAllocations || {}
            const total  = Object.values(allocs).reduce((s, v) => s + (parseFloat(v) || 0), 0)
            const tcls   = total === 100 ? 'ok' : total > 100 ? 'over' : 'under'
            const updateAlloc = (cat, val) => {
              const next = { ...allocs }
              const n = parseFloat(val) || 0
              if (n === 0) delete next[cat]; else next[cat] = n
              s('categoryAllocations', next)
            }
            return (
              <>
                <p className="settings-desc" style={{ margin: '6px 0 8px' }}>Enter % for each category — must total 100%. Analytics will split the amount proportionally.</p>
                <div className="cat-alloc-grid">
                  {Object.keys(CATS).map(cat => {
                    const v = allocs[cat] || ''
                    return (
                      <div key={cat} className={`cat-alloc-row${v ? ' has-value' : ''}`}>
                        <span className="cat-alloc-icon">{CATS[cat].icon}</span>
                        <span className="cat-alloc-name">{cat}</span>
                        <input type="number" min="0" max="100" step="1" className="pct-input"
                          value={v} onChange={e => updateAlloc(cat, e.target.value)} placeholder="0" />
                        <span className="pct-sym">%</span>
                      </div>
                    )
                  })}
                </div>
                <div className={`cat-alloc-total cat-alloc-${tcls}`}>
                  Total: {total.toFixed(0)}%
                  {tcls === 'ok' && ' ✓'}
                  {tcls === 'over' && ` — over by ${(total - 100).toFixed(0)}%`}
                  {tcls === 'under' && total > 0 && ` — ${(100 - total).toFixed(0)}% remaining`}
                </div>
              </>
            )
          })()}
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

function IncomeForm({ onSubmit, onClose, initialData, rateData }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState(initialData ? { ...initialData } : {
    date: today, description: '', amount: '', currency: 'INR',
    conversionRate: 1, source: 'Salary', paymentMethod: 'Net Banking', notes: '',
    isRecurring: false, recurringPeriod: 'monthly',
  })
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const onCurrencyChange = code => {
    s('currency', code)
    if (code === 'INR') { s('conversionRate', 1); return }
    const rate = rateData?.rates?.[code]
    if (rate) s('conversionRate', parseFloat(rate.toFixed(6)))
  }

  const sub = e => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0) return
    const amt  = parseFloat(form.amount)
    const rate = parseFloat(form.conversionRate) || 1
    onSubmit({
      ...form, amount: amt,
      conversionRate: rate,
      amountINR: form.currency === 'INR' ? amt : amt * rate,
    })
    onClose()
  }

  const isForeign  = form.currency !== 'INR'
  const inrPreview = isForeign && form.amount ? parseFloat(form.amount) * (parseFloat(form.conversionRate) || 1) : null

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
              <select value={form.currency} onChange={e => onCurrencyChange(e.target.value)}>
                {CURRENCIES.slice(0, 12).map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </div>
          </div>
          {isForeign && (
            <div className="form-row">
              <div className="form-group">
                <label>Rate: 1 {form.currency} = ? INR</label>
                <input type="number" step="0.000001" min="0" value={form.conversionRate}
                  onChange={e => s('conversionRate', parseFloat(e.target.value) || 0)} />
              </div>
              {inrPreview !== null && (
                <div className="form-group">
                  <label>INR Equivalent</label>
                  <div className="currency-preview">{fmtINR(inrPreview)}</div>
                </div>
              )}
            </div>
          )}
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
        <div className="item-amount">
          {item._pending && <span className="item-pending" title="Pending sync">⏳</span>}
          {fmtINR(toINR(item))}
        </div>
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
    <div className="item" style={{ borderLeft: '3px solid var(--color-inc)' }}>
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
        <div className="item-amount" style={{ color: 'var(--color-inc)' }}>
          {item._pending && <span className="item-pending" title="Pending sync">⏳</span>}
          +{fmtINR(toINR(item))}
        </div>
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
    pendingCount, syncing, online, realtimeStatus,
    addExpense, editExpense, deleteExpense, deleteManyExpenses,
    addIncome,  editIncome,  deleteIncome,
    saveBudgets,
    addGoal, deleteGoal, addContribution, deleteContribution,
    bulkAddExpenses, bulkAddIncome,
    clearExpenses, clearIncome, clearAll, factoryReset,
  } = useStorage(userId)

  const {
    permission:          notifPermission,
    subscribed:          notifSubscribed,
    loading:             notifLoading,
    error:               notifError,
    requestAndSubscribe: notifEnable,
    unsubscribe:         notifDisable,
  } = useNotifications(userId)

  // ── UI state ─────────────────────────────────────────
  const [tab, setTab]                     = useState(() => {
    const p = new URLSearchParams(window.location.search).get('tab')
    const valid = ['overview','income','trends','budgets','goals','insights','recurring','exchange','settings']
    return valid.includes(p) ? p : 'overview'
  })
  const [dark, setDark]                   = useState(() => { const s = localStorage.getItem('et_v6_dark'); return s !== null ? s === '1' : window.matchMedia('(prefers-color-scheme: dark)').matches })
  const [colorblind, setColorblind]       = useState(() => localStorage.getItem('et_v6_cb') === '1')
  const [incognito, setIncognito]         = useState(() => localStorage.getItem('et_v6_incognito') === '1')
  // Shadow module-level fmtINR — all JSX in this component uses this version
  // eslint-disable-next-line no-shadow
  const fmtINR = n => incognito ? '••••••' : _fmtINR(n)
  const [showEF, setShowEF]               = useState(false)
  const [showIF, setShowIF]               = useState(false)
  const [editExpTarget, setEditExpTarget] = useState(null)
  const [editIncTarget, setEditIncTarget] = useState(null)
  const [delTarget, setDelTarget]         = useState(null)
  const [bulkMode, setBulkMode]           = useState(false)
  const [selectedIds, setSelectedIds]     = useState({})
  const [showGoalForm, setShowGoalForm]         = useState(false)
  const [contribGoal, setContribGoal]           = useState(null)
  const [upcomingRecurring, setUpcomingRecurring] = useState([])

  // ── Export / Import / Danger zone ─────────────────────
  const [confirmAction, setConfirmAction] = useState(null)
  const [importReport,  setImportReport]  = useState(null)
  const [importing,     setImporting]     = useState(false)
  const [v5Report,      setV5Report]      = useState(null)
  const [v5Importing,   setV5Importing]   = useState(false)

  // ── Safe-to-Spend ─────────────────────────────────────
  const [savingsGoal, setSavingsGoal] = useState(() => parseFloat(localStorage.getItem('et_v6_sts_goal') || '0') || 0)
  useEffect(() => { try { localStorage.setItem('et_v6_sts_goal', String(savingsGoal)) } catch {} }, [savingsGoal])

  const handleExportJSON = () => {
    const payload = {
      version: 6, exportedAt: new Date().toISOString(),
      expenses, income,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `expense-tracker-v6-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    const headers = ['Date','Description','Amount','Currency','INR Amount','Category','Subcategory','Expense Type','Payment Method','Tags','Notes']
    const rows = expenses.map(e => [
      e.date,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.amount, e.currency,
      (e.amountINR || e.amount).toFixed(2),
      e.category, e.subcategory || '', e.expenseType || '',
      e.paymentMethod || '',
      `"${(e.tags || []).join(';')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ])
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await file.text()
      const raw  = JSON.parse(text)
      const rawExps = Array.isArray(raw.expenses) ? raw.expenses : []
      const rawIncs = Array.isArray(raw.income)   ? raw.income   : []

      if (!rawExps.length && !rawIncs.length) {
        setImportReport({ error: true, details: '❌ No expenses or income found in this file.' })
        setImporting(false)
        setTimeout(() => setImportReport(null), 7000)
        return
      }

      const expDedup = makeDedupContext(expenses)
      const incDedup = makeDedupContext(income)

      const toAddExp = [], skippedExp = []
      rawExps.forEach(r => {
        const e = makeExpense(r, 'import')
        if (expDedup.isDuplicate(e)) { skippedExp.push(e); return }
        expDedup.register(e)
        toAddExp.push(e)
      })

      const toAddInc = [], skippedInc = []
      rawIncs.forEach(r => {
        const i = makeIncome(r, 'import')
        if (incDedup.isDuplicate(i)) { skippedInc.push(i); return }
        incDedup.register(i)
        toAddInc.push(i)
      })

      const [expResult, incResult] = await Promise.all([
        bulkAddExpenses(toAddExp),
        bulkAddIncome(toAddInc),
      ])

      const added   = (expResult?.added || 0) + (incResult?.added || 0)
      const skipped = skippedExp.length + skippedInc.length
      const lines   = []
      if (expResult?.added) lines.push(`  • ${expResult.added} expense${expResult.added !== 1 ? 's' : ''} added`)
      if (incResult?.added) lines.push(`  • ${incResult.added} income record${incResult.added !== 1 ? 's' : ''} added`)
      if (skipped)          lines.push(`  • ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped`)
      setImportReport({ count: added, skipped, error: false, details: lines.join('\n') })
      setTimeout(() => setImportReport(null), 8000)
    } catch (err) {
      setImportReport({ error: true, details: `❌ Failed to parse file: ${err.message}` })
      setTimeout(() => setImportReport(null), 7000)
    }
    setImporting(false)
  }

  const handleV5Import = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setV5Importing(true)
    try {
      const text = await file.text()
      let raw
      try { raw = JSON.parse(text) } catch {
        setV5Report({ error: true, details: '❌ Could not parse file. Make sure you exported JSON from V5 Settings → Export Data.' })
        setTimeout(() => setV5Report(null), 8000)
        setV5Importing(false)
        return
      }

      const { valid, reason } = validateV5File(raw)
      if (!valid) {
        setV5Report({ error: true, details: `❌ ${reason}` })
        setTimeout(() => setV5Report(null), 8000)
        setV5Importing(false)
        return
      }

      const { expenses: transformed, income: transformedInc, warnings } = migrateV5Data(raw)

      const expDedup = makeDedupContext(expenses)
      const incDedup = makeDedupContext(income)

      const toAddExp = [], skippedExp = []
      transformed.forEach(exp => {
        if (expDedup.isDuplicate(exp)) { skippedExp.push(exp); return }
        expDedup.register(exp)
        toAddExp.push(exp)
      })

      const toAddInc = [], skippedInc = []
      transformedInc.forEach(inc => {
        if (incDedup.isDuplicate(inc)) { skippedInc.push(inc); return }
        incDedup.register(inc)
        toAddInc.push(inc)
      })

      // Chunk into batches of 500 to stay within Supabase insert limits
      const chunkSize = 500
      let expAdded = 0, expErrors = 0
      for (let i = 0; i < toAddExp.length; i += chunkSize) {
        const res = await bulkAddExpenses(toAddExp.slice(i, i + chunkSize))
        expAdded  += res?.added  || 0
        expErrors += res?.errors || 0
      }

      let incAdded = 0, incErrors = 0
      for (let i = 0; i < toAddInc.length; i += chunkSize) {
        const res = await bulkAddIncome(toAddInc.slice(i, i + chunkSize))
        incAdded  += res?.added  || 0
        incErrors += res?.errors || 0
      }

      const totalAdded   = expAdded + incAdded
      const totalSkipped = skippedExp.length + skippedInc.length
      const lines = []
      if (expAdded)        lines.push(`  • ${expAdded} expense${expAdded !== 1 ? 's' : ''} migrated`)
      if (incAdded)        lines.push(`  • ${incAdded} income record${incAdded !== 1 ? 's' : ''} migrated`)
      if (totalSkipped)    lines.push(`  • ${totalSkipped} duplicate${totalSkipped !== 1 ? 's' : ''} skipped`)
      if (expErrors + incErrors) lines.push(`  • ${expErrors + incErrors} record${expErrors + incErrors !== 1 ? 's' : ''} failed to save`)
      if (warnings.length) lines.push('', '  Warnings:', ...warnings.slice(0, 5).map(w => `  ⚠ ${w}`))
      if (warnings.length > 5) lines.push(`  … and ${warnings.length - 5} more warnings`)

      setV5Report({ count: totalAdded, skipped: totalSkipped, error: false, details: lines.join('\n') })
      setTimeout(() => setV5Report(null), 12000)
    } catch (err) {
      setV5Report({ error: true, details: `❌ Migration failed: ${err.message}` })
      setTimeout(() => setV5Report(null), 8000)
    }
    setV5Importing(false)
  }

  const executeConfirmedAction = async () => {
    if (!confirmAction) return
    if (confirmAction.type === 'clear-expenses') await clearExpenses()
    else if (confirmAction.type === 'clear-income')   await clearIncome()
    else if (confirmAction.type === 'clear-all')      await clearAll()
    else if (confirmAction.type === 'factory-reset') {
      await factoryReset()
      setDark(false)
      setColorblind(false)
      setBaseCurrency('INR')
      _firedToasts.current.clear()
    }
    setConfirmAction(null)
    setTab('overview')
  }

  // ── Exchange rates ────────────────────────────────────
  const [baseCurrency, setBaseCurrency] = useState(() => localStorage.getItem('et_v6_base') || 'INR')
  const [rateData,     setRateData]     = useState(null)
  const [rateFetching, setRateFetching] = useState(false)

  useEffect(() => { localStorage.setItem('et_v6_base', baseCurrency) }, [baseCurrency])
  useEffect(() => {
    const RATE_KEY = 'et_v6_rates', TTL = 6 * 3600 * 1000
    const load = () => { try { return JSON.parse(localStorage.getItem(RATE_KEY)) } catch { return null } }
    const save = d  => { try { localStorage.setItem(RATE_KEY, JSON.stringify(d)) } catch {} }
    const cached = load(), fresh = cached && (Date.now() - cached.ts) < TTL
    if (fresh) { setRateData(cached); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => {
        const rates = {}
        Object.keys(j.rates).forEach(k => { rates[k] = j.rates['INR'] ? j.rates[k] / j.rates['INR'] : j.rates[k] })
        if (baseCurrency === 'INR') Object.keys(j.rates).forEach(k => { rates[k] = j.rates[k] })
        const d = { rates, ts: Date.now(), source: 'live' }
        save(d); setRateData(d)
      })
      .catch(() => {
        clearTimeout(t)
        if (cached) {
          setRateData({ ...cached, source: 'cached' })
          addToast('warn', '💱', 'Exchange Rates', 'Using cached rates — API unavailable')
        } else {
          const d = { rates: { ...FALLBACK_RATES }, ts: Date.now(), source: 'fallback' }
          setRateData(d)
          addToast('warn', '💱', 'Exchange Rates', 'Using built-in fallback rates — API unavailable')
        }
      })
      .finally(() => clearTimeout(t))
  }, [baseCurrency, addToast])

  const refreshRates = async () => {
    setRateFetching(true)
    try {
      const r = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`)
      const j = await r.json()
      const rates = {}
      Object.keys(j.rates).forEach(k => { rates[k] = baseCurrency === 'INR' ? j.rates[k] : j.rates[k] / (j.rates['INR'] || 1) })
      const d = { rates, ts: Date.now(), source: 'live' }
      try { localStorage.setItem('et_v6_rates', JSON.stringify(d)) } catch {}
      setRateData(d)
    } catch {
      const RATE_KEY = 'et_v6_rates'
      const cached = (() => { try { return JSON.parse(localStorage.getItem(RATE_KEY)) } catch { return null } })()
      if (cached) {
        setRateData({ ...cached, source: 'cached' })
        addToast('warn', '💱', 'Exchange Rates', 'Using cached rates — API unavailable')
      } else {
        const d = { rates: { ...FALLBACK_RATES }, ts: Date.now(), source: 'fallback' }
        setRateData(d)
        addToast('warn', '💱', 'Exchange Rates', 'Using built-in fallback rates — API unavailable')
      }
    }
    setRateFetching(false)
  }

  const rsLabel = !rateData ? '⚪ No rates'
    : rateData.source === 'live'     ? '🟢 Live'
    : rateData.source === 'cached'   ? '🔵 Cached'
    : rateData.source === 'fallback' ? '🟠 Fallback'
    : '🔴 Offline'

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
  useEffect(() => {
    document.documentElement.classList.toggle('incognito', incognito)
    localStorage.setItem('et_v6_incognito', incognito ? '1' : '0')
  }, [incognito])

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
    const TABS = ['overview', 'income', 'trends', 'budgets', 'goals', 'insights', 'recurring', 'exchange', 'settings']
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

  // ── Month comparison table data (declared early to avoid Rollup TDZ) ──
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

  // ── Recurring reminders ───────────────────────────────
  useEffect(() => {
    if (loading) return
    const templates = expenses.filter(e => e.isRecurring && e.nextDueDate)
    const upcoming = []
    templates.forEach(tmpl => {
      const daysUntil = Math.ceil((new Date(tmpl.nextDueDate + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 864e5)
      if (daysUntil <= 0) return
      if (daysUntil <= 7) upcoming.push({ ...tmpl, daysUntil })
      if (daysUntil <= 3) {
        const key = `recurring-remind-${tmpl.id}-${tmpl.nextDueDate}`
        if (!_firedToasts.current.has(key)) {
          _firedToasts.current.add(key)
          const cat = CATS[tmpl.category] || CATS['Other']
          const urgency = daysUntil === 1 ? 'due tomorrow' : `due in ${daysUntil} days`
          addToast(daysUntil <= 1 ? 'warn' : 'info', cat.icon || '🔄',
            `🔄 Recurring: ${tmpl.description}`,
            `${fmtINR(toINR(tmpl))} — ${urgency} (${tmpl.nextDueDate})`,
            daysUntil <= 1 ? 8000 : 6000)
        }
      }
    })
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil)
    setUpcomingRecurring(upcoming.slice(0, 5))
  }, [expenses, loading, todayStr])

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

  const expTypeData = useMemo(() => {
    const t = {}
    filteredExp.forEach(e => { const k = e.expenseType || 'variable'; t[k] = (t[k] || 0) + toINR(e) })
    return Object.entries(t).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [filteredExp])

  const diningData = useMemo(() => {
    const d = {}
    filteredExp.filter(e => e.diningApp && e.category === 'Food').forEach(e => { d[e.diningApp] = (d[e.diningApp] || 0) + toINR(e) })
    return Object.entries(d).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [filteredExp])

  const tagsData = useMemo(() => {
    const t = {}
    filteredExp.filter(e => e.tags && e.tags.length).forEach(e => { e.tags.forEach(tag => { t[tag] = (t[tag] || 0) + toINR(e) }) })
    return Object.entries(t).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [filteredExp])


  // ── Insights ─────────────────────────────────────────
  const insights = useMemo(() => {
    const res = []
    if (!expenses.length) return res

    // 1. Top category
    if (catData.length) res.push({ title: '🏆 Top Category', text: `${catData[0].label} leads at ${fmtINR(catData[0].value)} (${(catData[0].value / allExpINR * 100).toFixed(0)}% of all spending).` })

    // 2. Savings rate
    if (allIncINR > 0) {
      const r = ((allExpINR / allIncINR) * 100).toFixed(0), sv = allIncINR - allExpINR
      res.push({ title: '📊 Savings Rate', text: `You spent ${r}% of income. ${sv >= 0 ? 'Saved ' + fmtINR(sv) + '! 🎉' : 'Overspent by ' + fmtINR(Math.abs(sv)) + ' ⚠️'}` })
    }

    // 3. Peak day of week
    const dow = Array(7).fill(0)
    expenses.forEach(e => { const d = new Date(e.date + 'T12:00:00'); if (!isNaN(d)) dow[d.getDay()] += toINR(e) })
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], pk = dow.indexOf(Math.max(...dow))
    if (dow[pk] > 0) res.push({ title: '📅 Peak Spend Day', text: `You spend most on ${DAYS[pk]}s (${fmtINR(dow[pk])} total, ${(dow[pk] / allExpINR * 100).toFixed(0)}% of spend).` })

    // 4. Monthly trend
    if (monthlyExpData.length >= 2) {
      const last = monthlyExpData[monthlyExpData.length - 1], prev = monthlyExpData[monthlyExpData.length - 2]
      const pct = prev.value > 0 ? Math.abs((last.value - prev.value) / prev.value * 100).toFixed(0) : 0
      res.push({ title: '📈 Monthly Trend', text: last.value > prev.value ? `Spending up ${pct}% vs last month.` : `Spending down ${pct}% vs last month. Saved ${fmtINR(prev.value - last.value)}! 🎉` })
    }

    // 5. Largest transaction
    if (expenses.length >= 3) {
      const sorted = [...expenses].sort((a, b) => toINR(b) - toINR(a)), big = sorted[0]
      const avg = allExpINR / expenses.length, mult = (toINR(big) / avg).toFixed(1)
      if (mult > 2) res.push({ title: '🚨 Largest Transaction', text: `"${big.description}" on ${big.date} — ${fmtINR(toINR(big))}, which is ${mult}× your average expense.` })
    }

    // 6. Average daily spend
    if (expenses.length >= 5) {
      const dates = [...new Set(expenses.map(e => e.date))]
      const avgDay = allExpINR / Math.max(dates.length, 1)
      res.push({ title: '📉 Average Daily Spend', text: `${fmtINR(avgDay)}/day across ${dates.length} active days. Monthly run-rate: ~${fmtINR(avgDay * 30)}.` })
    }

    // 7. Multi-currency
    const foreign = expenses.filter(e => e.currency && e.currency !== 'INR')
    if (foreign.length) {
      const curs = [...new Set(foreign.map(e => e.currency))]
      res.push({ title: '💱 Multi-Currency', text: `${foreign.length} foreign expense${foreign.length > 1 ? 's' : ''} in: ${curs.map(c => (CM[c]?.flag || '') + ' ' + c).join(', ')}.` })
    }

    // 8. Recurring expenses summary
    const recur = expenses.filter(e => e.isRecurring)
    if (recur.length) res.push({ title: '🔄 Recurring Expenses', text: `${recur.length} active recurring template${recur.length > 1 ? 's' : ''}. Combined value: ${fmtINR(recur.reduce((s, e) => s + toINR(e), 0))}.` })

    // 9. Split expenses summary
    const splits = expenses.filter(e => e.splitWith && e.splitParts > 1)
    if (splits.length) {
      const shareTotal = splits.reduce((s, e) => s + toINR(e) / e.splitParts, 0)
      res.push({ title: '👥 Split Expenses', text: `${splits.length} split expense${splits.length > 1 ? 's' : ''}. Your total share: ${fmtINR(shareTotal)} (full amount: ${fmtINR(splits.reduce((s, e) => s + toINR(e), 0))}).` })
    }

    // 10. Fixed vs variable
    const fixed = expenses.filter(e => e.expenseType === 'fixed')
    const fixedTotal = fixed.reduce((s, e) => s + toINR(e), 0)
    if (fixed.length && allExpINR > 0) res.push({ title: '📌 Fixed vs Variable', text: `${fixed.length} fixed expenses (${(fixedTotal / allExpINR * 100).toFixed(0)}% of total = ${fmtINR(fixedTotal)}). The rest is variable spending.` })

    // 11. Weekend vs weekday
    if (expenses.length >= 10) {
      const weekend = expenses.filter(e => { const d = new Date(e.date + 'T12:00:00').getDay(); return d === 0 || d === 6 })
      const weekday = expenses.filter(e => { const d = new Date(e.date + 'T12:00:00').getDay(); return d >= 1 && d <= 5 })
      const wkndTotal = weekend.reduce((s, e) => s + toINR(e), 0)
      const wkdyTotal = weekday.reduce((s, e) => s + toINR(e), 0)
      const wkndDays = new Set(weekend.map(e => e.date)).size || 1
      const wkdyDays = new Set(weekday.map(e => e.date)).size || 1
      const wkndAvg = wkndTotal / wkndDays, wkdyAvg = wkdyTotal / wkdyDays
      const heavier = wkndAvg > wkdyAvg ? 'weekends' : 'weekdays'
      const ratio = (Math.max(wkndAvg, wkdyAvg) / (Math.min(wkndAvg, wkdyAvg) || 1)).toFixed(1)
      res.push({ title: '🗓️ Weekend vs Weekday', text: `You spend ${ratio}× more on ${heavier}. Weekend avg: ${fmtINR(wkndAvg)}/day, weekday avg: ${fmtINR(wkdyAvg)}/day.` })
    }

    // 12. Category month-over-month trend
    if (allMonthlyExp.length >= 2) {
      const lastMo = allMonthlyExp[allMonthlyExp.length - 1].fullLabel
      const prevMo = allMonthlyExp[allMonthlyExp.length - 2].fullLabel
      const catLast = {}, catPrev = {}
      expenses.filter(e => (e.date || '').startsWith(lastMo)).forEach(e => { catLast[e.category] = (catLast[e.category] || 0) + toINR(e) })
      expenses.filter(e => (e.date || '').startsWith(prevMo)).forEach(e => { catPrev[e.category] = (catPrev[e.category] || 0) + toINR(e) })
      const allCats = [...new Set([...Object.keys(catLast), ...Object.keys(catPrev)])]
      const deltas = allCats.map(c => ({ cat: c, delta: (catLast[c] || 0) - (catPrev[c] || 0) })).sort((a, b) => b.delta - a.delta)
      const parts = []
      if (deltas[0]?.delta > 100) parts.push(`📈 ${deltas[0].cat} up ${fmtINR(deltas[0].delta)}`)
      if (deltas[deltas.length - 1]?.delta < -100) parts.push(`📉 ${deltas[deltas.length - 1].cat} down ${fmtINR(Math.abs(deltas[deltas.length - 1].delta))}`)
      if (parts.length) res.push({ title: '🔀 Category Trend (MoM)', text: `Comparing ${prevMo} → ${lastMo}: ${parts.join(' · ')}.` })
    }

    // 13. Longest spending streak
    if (expenses.length >= 5) {
      const dateset = new Set(expenses.map(e => e.date))
      const sortedDates = [...dateset].sort()
      let maxStreak = 1, cur = 1, streakEnd = sortedDates[0]
      for (let i = 1; i < sortedDates.length; i++) {
        const diff = Math.round((new Date(sortedDates[i] + 'T12:00:00') - new Date(sortedDates[i - 1] + 'T12:00:00')) / 864e5)
        if (diff === 1) { cur++; if (cur > maxStreak) { maxStreak = cur; streakEnd = sortedDates[i] } } else cur = 1
      }
      if (maxStreak >= 3) res.push({ title: '🔥 Longest Spending Streak', text: `${maxStreak} consecutive days ending ${streakEnd}. You logged expenses every single day during this streak.` })
    }

    // 14. Best & worst month by savings rate
    if (allMonthlyExp.length >= 3) {
      const monthStats = allMonthlyExp.map(m => {
        const inc = allMonthlyInc[m.fullLabel] || 0
        const savingsRate = inc > 0 ? ((inc - m.value) / inc * 100) : null
        return { ...m, inc, savingsRate }
      }).filter(m => m.savingsRate !== null)
      if (monthStats.length >= 2) {
        monthStats.sort((a, b) => b.savingsRate - a.savingsRate)
        const best = monthStats[0], worst = monthStats[monthStats.length - 1]
        res.push({ title: '🏅 Best & Worst Month', text: `Best: ${best.fullLabel} with ${best.savingsRate.toFixed(0)}% saved (${fmtINR(best.inc - best.value)}). Worst: ${worst.fullLabel} with ${worst.savingsRate.toFixed(0)}% saved.` })
      }
    }

    // 15. Spending concentration risk
    if (catData.length >= 3 && allExpINR > 0) {
      const top2pct = (catData[0].value + catData[1].value) / allExpINR * 100
      if (top2pct > 60) res.push({ title: '⚠️ Spending Concentration', text: `${top2pct.toFixed(0)}% of all spending is in just 2 categories (${catData[0].label} + ${catData[1].label}). Consider reviewing if this is intentional.` })
    }

    // 16. Income consistency
    const incVals = Object.values(allMonthlyInc)
    if (incVals.length >= 3) {
      const avgInc = incVals.reduce((s, v) => s + v, 0) / incVals.length
      const variance = incVals.reduce((s, v) => s + Math.pow(v - avgInc, 2), 0) / incVals.length
      const cv = (Math.sqrt(variance) / avgInc * 100).toFixed(0)
      const consistency = cv < 20 ? 'very consistent' : cv < 40 ? 'moderately consistent' : 'variable'
      res.push({ title: '💵 Income Consistency', text: `Your monthly income is ${consistency} (CV: ${cv}%). Average: ${fmtINR(avgInc)}/month across ${incVals.length} months.` })
    }

    return res
  }, [catData, expenses, monthlyExpData, allMonthlyExp, allMonthlyInc, allIncINR, allExpINR])

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

  // ── Safe-to-Spend computed ────────────────────────────
  const currentMonthInc   = useMemo(() => income.filter(i => (i.date || '').startsWith(monthStr)).reduce((s, i) => s + toINR(i), 0), [income, monthStr])
  const currentMonthFixed = useMemo(() => expenses.filter(e => (e.date || '').startsWith(monthStr) && e.expenseType === 'fixed').reduce((s, e) => s + toINR(e), 0), [expenses, monthStr])
  const { dailyAllowance, daysRemaining } = useMemo(() => calculateSafeToSpend(currentMonthInc, currentMonthFixed, savingsGoal, todayStr), [currentMonthInc, currentMonthFixed, savingsGoal, todayStr])
  const stsRatio = dailyAllowance > 0 ? spentToday / dailyAllowance : 0
  const stsStatus = stsRatio >= 1 ? 'danger' : stsRatio >= 0.8 ? 'warn' : 'ok'
  const stsColor  = stsStatus === 'danger' ? 'var(--color-exp)' : stsStatus === 'warn' ? '#f59e0b' : 'var(--color-inc)'

  // ── Month-End Forecast ────────────────────────────────
  const monthForecast = useMemo(() => {
    const today = new Date(todayStr + 'T12:00:00')
    const y = today.getFullYear(), m = today.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const dayOfMonth  = today.getDate()
    const monthExps   = expenses.filter(e => (e.date || '').startsWith(monthStr))
    const spentSoFar  = monthExps.reduce((s, e) => s + toINR(e), 0)
    const dailyRate   = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0
    const projected   = dailyRate * daysInMonth
    const prevMonthStr = m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`
    const prevTotal   = expenses.filter(e => (e.date || '').startsWith(prevMonthStr)).reduce((s, e) => s + toINR(e), 0)
    const projectedInc = income.filter(i => (i.date || '').startsWith(monthStr)).reduce((s, i) => s + toINR(i), 0)
    const projectedSavings = projectedInc - projected
    const trend = prevTotal > 0 ? ((projected - prevTotal) / prevTotal * 100).toFixed(0) : null
    return { spentSoFar, dailyRate, projected, prevTotal, trend, projectedInc, projectedSavings, daysInMonth, dayOfMonth }
  }, [expenses, income, monthStr, todayStr])

  // ── Subscription zombie detection ────────────────────
  const SUB_SUBS = new Set(['OTT/Streaming', 'Streaming', 'Subscriptions', 'Software', 'Gaming', 'Cable'])
  const subZombieData = useMemo(() => {
    if (!expenses.length) return { subs: [], zombies: [], creep: [] }
    const byDesc = {}
    expenses.forEach(e => {
      const key = (e.description || '').trim().toLowerCase()
      if (!key) return
      if (!byDesc[key]) byDesc[key] = { desc: e.description, items: [] }
      byDesc[key].items.push(e)
    })
    const subs = [], zombies = [], creep = []
    Object.values(byDesc).forEach(({ desc, items }) => {
      const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
      const months = new Set(sorted.map(e => (e.date || '').substring(0, 7)))
      const isRec  = sorted.some(e => e.isRecurring)
      const hasSub = sorted.some(e => SUB_SUBS.has(e.subcategory))
      if (!isRec && !hasSub && months.size < 3) return
      const last = sorted[sorted.length - 1]
      const daysSinceLast = Math.floor((new Date(todayStr + 'T12:00:00') - new Date(last.date + 'T12:00:00')) / 864e5)
      const avgAmt = sorted.reduce((s, e) => s + toINR(e), 0) / sorted.length
      subs.push({ desc, count: sorted.length, months: months.size, avgAmt, lastDate: last.date, isRec })
      if (isRec && daysSinceLast >= 45) zombies.push({ desc, lastDate: last.date, daysSinceLast, avgAmt })
      if (sorted.length >= 2) {
        const firstAmt = toINR(sorted[0]), lastAmt = toINR(last)
        if (lastAmt > firstAmt * 1.1) {
          const pct = ((lastAmt - firstAmt) / firstAmt * 100).toFixed(0)
          creep.push({ desc, firstAmt, lastAmt, pct })
        }
      }
    })
    return {
      subs:    subs.sort((a, b) => b.avgAmt - a.avgAmt),
      zombies: zombies.sort((a, b) => b.daysSinceLast - a.daysSinceLast),
      creep:   creep.sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct)),
    }
  }, [expenses, todayStr])

  if (loading) return <div className="tracker-loading"><div className="spinner" /><p>Loading your data…</p></div>

  const TABS = [
    { id: 'overview',   label: '📊 Overview' },
    { id: 'income',     label: '💵 Income' },
    { id: 'trends',     label: '📈 Trends' },
    { id: 'budgets',    label: '💰 Budgets' },
    { id: 'goals',      label: '🎯 Goals' },
    { id: 'insights',   label: '💡 Insights' },
    { id: 'recurring',  label: '🔄 Recurring' },
    { id: 'exchange',   label: '💱 Exchange' },
    { id: 'settings',   label: '⚙️ Settings' },
  ]

  // ── Currency grouping for Exchange tab ────────────────
  const CG = CURRENCIES.reduce((acc, c) => {
    if (!acc[c.group]) acc[c.group] = []
    acc[c.group].push(c)
    return acc
  }, {})

  return (
    <div className="tracker">
      {!online && (
        <div className="offline-banner">
          <span>📡 You're offline{pendingCount > 0 ? ` · ${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued` : ''}</span>
          <span className="offline-banner-sub">Changes will sync automatically when reconnected</span>
        </div>
      )}
      {online && syncing && (
        <div className="syncing-banner">
          <span className="syncing-spinner" /> Syncing {pendingCount} change{pendingCount !== 1 ? 's' : ''}…
        </div>
      )}
      {error && <div className="error-banner">⚠️ {error} <button onClick={() => window.location.reload()}>Retry</button></div>}

      {/* ── Header ── */}
      <div className="tracker-header">
        <div className="tracker-header-left">
          <span className="tracker-title">💸 Expense Tracker</span>
          <span className="tracker-stats">{expenses.length} expenses · {income.length} income</span>
        </div>
        <div className="tracker-header-right">
          <span
            className={`realtime-dot realtime-${realtimeStatus}`}
            title={
              realtimeStatus === 'live'       ? 'Live sync active' :
              realtimeStatus === 'connecting' ? 'Connecting to live sync…' :
              realtimeStatus === 'error'      ? 'Live sync error — changes may be delayed' :
              'Live sync offline'
            }
          />
          <button className="btn-ghost btn-sm" title="D" onClick={() => setDark(m => !m)}>{dark ? '🌙' : '☀️'}</button>
          <button className="btn-ghost btn-sm" title="Colorblind mode" onClick={() => setColorblind(m => !m)} style={{ opacity: colorblind ? 1 : 0.5 }}>👁️</button>
          <button className="btn-ghost btn-sm" title={incognito ? 'Show amounts' : 'Hide amounts'} onClick={() => setIncognito(m => !m)} style={{ opacity: incognito ? 1 : 0.5 }}>🙈</button>
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
            <div className="summary-card"><div className="summary-label">Expenses{hasExpFilters ? ' (filtered)' : ''}</div><div className="summary-amount" style={{ color: 'var(--color-exp)' }}>{fmtINR(totalExp)}</div></div>
            <div className="summary-card"><div className="summary-label">Income</div><div className="summary-amount" style={{ color: 'var(--color-inc)' }}>{fmtINR(allIncINR)}</div></div>
            <div className="summary-card"><div className="summary-label">Net Savings</div><div className="summary-amount" style={{ color: netSavings >= 0 ? 'var(--color-inc)' : 'var(--color-exp)' }}>{netSavings >= 0 ? '+' : ''}{fmtINR(netSavings)}</div></div>
            {budgets.monthly > 0 && <div className="summary-card"><div className="summary-label">Monthly Budget</div><div className="summary-amount" style={{ color: spentMonth > budgets.monthly ? 'var(--color-exp)' : 'var(--color-inc)' }}>{fmtINR(spentMonth)} / {fmtINR(budgets.monthly)}</div></div>}
            {dailyAllowance > 0 && (
              <div className="summary-card" title={`Spent today: ${fmtINR(spentToday)} · Allowance: ${fmtINR(dailyAllowance)}/day · ${daysRemaining}d left`}>
                <div className="summary-label">Daily Allowance</div>
                <div className="summary-amount" style={{ color: stsColor }}>{fmtINR(dailyAllowance)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>spent today: {fmtINR(spentToday)}</div>
              </div>
            )}
            <div className="summary-card"><div className="summary-label">Showing</div><div className="summary-amount">{filteredExp.length} / {expenses.length}</div></div>
          </div>

          {/* Month-End Forecast */}
          {expenses.length > 0 && (
            <div className="forecast-panel">
              <div className="forecast-title">📅 Month-End Forecast — {monthStr}</div>
              <div className="forecast-grid">
                <div className="forecast-item">
                  <div className="forecast-label">Spent so far</div>
                  <div className="forecast-val" style={{ color: 'var(--color-exp)' }}>{fmtINR(monthForecast.spentSoFar)}</div>
                  <div className="forecast-sub">day {monthForecast.dayOfMonth} of {monthForecast.daysInMonth}</div>
                </div>
                <div className="forecast-item">
                  <div className="forecast-label">Daily rate</div>
                  <div className="forecast-val">{fmtINR(monthForecast.dailyRate)}/d</div>
                  <div className="forecast-sub">running average</div>
                </div>
                <div className="forecast-item">
                  <div className="forecast-label">Projected total</div>
                  <div className="forecast-val" style={{ color: monthForecast.projected > (budgets.monthly || Infinity) ? 'var(--color-exp)' : 'var(--text)' }}>{fmtINR(monthForecast.projected)}</div>
                  <div className="forecast-sub">
                    {monthForecast.trend !== null
                      ? (parseInt(monthForecast.trend) > 5 ? `↑${monthForecast.trend}% vs last month` : parseInt(monthForecast.trend) < -5 ? `↓${Math.abs(monthForecast.trend)}% vs last month` : `~flat vs last month`)
                      : 'vs last month: —'}
                  </div>
                </div>
                {monthForecast.projectedInc > 0 && (
                  <div className="forecast-item">
                    <div className="forecast-label">Projected savings</div>
                    <div className="forecast-val" style={{ color: monthForecast.projectedSavings >= 0 ? 'var(--color-inc)' : 'var(--color-exp)' }}>
                      {monthForecast.projectedSavings >= 0 ? '+' : ''}{fmtINR(monthForecast.projectedSavings)}
                    </div>
                    <div className="forecast-sub">income this month: {fmtINR(monthForecast.projectedInc)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recurring reminders banner */}
          {upcomingRecurring.length > 0 && (
            <div className="recurring-banner" role="region" aria-label="Upcoming recurring expenses">
              <div className="recurring-banner-body">
                <div className="recurring-banner-title">📅 Upcoming Recurring ({upcomingRecurring.length})</div>
                <div className="recurring-chips">
                  {upcomingRecurring.map(r => {
                    const color = r.daysUntil <= 1 ? 'var(--color-exp)' : r.daysUntil <= 3 ? '#f59e0b' : '#667eea'
                    const urgency = r.daysUntil === 1 ? 'tomorrow' : `in ${r.daysUntil}d`
                    return (
                      <span key={r.id} className="recurring-chip" style={{ background: color + '18', color, border: `1px solid ${color}40` }}>
                        {CATS[r.category]?.icon || '🔄'} {r.description}
                        <span className="recurring-chip-meta">· {urgency} · {fmtINR(toINR(r))}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
              <button className="recurring-banner-dismiss" onClick={() => setUpcomingRecurring([])} aria-label="Dismiss">✕</button>
            </div>
          )}

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
              <div className="chart-card"><div className="chart-title">By Category</div><PieChart data={catData} incognito={incognito} /></div>
              <div className="chart-card"><div className="chart-title">By Payment</div><PieChart data={payData} incognito={incognito} /></div>
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
            <div className="summary-card"><div className="summary-label">Total Income</div><div className="summary-amount" style={{ color: 'var(--color-inc)' }}>{fmtINR(allIncINR)}</div></div>
            <div className="summary-card"><div className="summary-label">Total Expenses</div><div className="summary-amount" style={{ color: 'var(--color-exp)' }}>{fmtINR(allExpINR)}</div></div>
            <div className="summary-card"><div className="summary-label">Net Savings</div><div className="summary-amount" style={{ color: netSavings >= 0 ? 'var(--color-inc)' : 'var(--color-exp)' }}>{netSavings >= 0 ? '+' : ''}{fmtINR(netSavings)}</div></div>
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
              <div className="chart-card"><div className="chart-title">By Source</div><PieChart data={incSrcData} incognito={incognito} /></div>
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
                <span style={{ color: 'var(--color-inc)' }}>+{fmtINR(items.reduce((s, i) => s + toINR(i), 0))}</span>
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
            <div className="chart-card"><div className="chart-title">Category Breakdown</div><PieChart data={catData} incognito={incognito} /></div>
            <div className="chart-card"><div className="chart-title">Payment Breakdown</div><PieChart data={payData} incognito={incognito} /></div>
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
                  <tr key={fullLabel} className={isNow ? 'row-now' : ''}>
                    <td style={{ fontWeight: isNow ? 700 : 400 }}>{fullLabel}{isNow && <span className="badge-now">now</span>}</td>
                    <td style={{ color: 'var(--color-exp)', fontWeight: 600 }}>{fmtINR(value)}</td>
                    <td>{delta || <span className="delta-flat">—</span>}</td>
                    <td style={{ color: 'var(--color-inc)', fontWeight: 600 }}>{inc ? fmtINR(inc) : '—'}</td>
                    <td style={{ color: saved >= 0 ? 'var(--color-inc)' : 'var(--color-exp)', fontWeight: 600 }}>{inc ? (saved >= 0 ? '+' : '') + fmtINR(saved) : '—'}</td>
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
          {yearlyData.length > 0 && (
            <div className="chart-card" style={{ marginBottom: '1rem', overflowX: 'auto' }}>
              <div className="chart-title">📆 Yearly Comparison</div>
              <table className="comp-table">
                <thead><tr><th>Year</th><th>Expenses</th><th>vs Prev</th><th>Income</th><th>Saved</th><th>Txns</th></tr></thead>
                <tbody>{yearlyData.slice().reverse().map(({ label, value }, i, arr) => {
                  const prevVal = arr[i + 1]?.value
                  const yearInc = income.filter(inc => (inc.date || '').startsWith(label)).reduce((s, inc) => s + toINR(inc), 0)
                  const saved   = yearInc - value
                  const cnt     = expenses.filter(e => (e.date || '').startsWith(label)).length
                  let delta = null
                  if (prevVal != null && prevVal > 0) {
                    const pct = ((value - prevVal) / prevVal * 100)
                    delta = <span className={pct > 5 ? 'delta-up' : pct < -5 ? 'delta-dn' : 'delta-flat'}>{pct > 5 ? '↑' : pct < -5 ? '↓' : '–'}{Math.abs(pct).toFixed(0)}%</span>
                  }
                  return (
                    <tr key={label}>
                      <td style={{ fontWeight: 600 }}>{label}</td>
                      <td style={{ color: 'var(--color-exp)', fontWeight: 600 }}>{fmtINR(value)}</td>
                      <td>{delta || <span className="delta-flat">—</span>}</td>
                      <td style={{ color: 'var(--color-inc)', fontWeight: 600 }}>{yearInc ? fmtINR(yearInc) : '—'}</td>
                      <td style={{ color: saved >= 0 ? 'var(--color-inc)' : 'var(--color-exp)', fontWeight: 600 }}>{yearInc ? (saved >= 0 ? '+' : '') + fmtINR(saved) : '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{cnt}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </main>
      )}

      {/* ══════════ BUDGETS ══════════ */}
      {tab === 'budgets' && (
        <main>
          <div className="summary-grid">
            {[
              { val: fmtINR(spentToday), lbl: 'Today', color: budgets.daily > 0 ? (spentToday / budgets.daily >= 1 ? 'var(--color-exp)' : spentToday / budgets.daily >= 0.5 ? '#f59e0b' : 'var(--color-inc)') : 'var(--text)' },
              { val: fmtINR(spentWeek),  lbl: 'This Week', color: budgets.weekly > 0 ? (spentWeek / budgets.weekly >= 1 ? 'var(--color-exp)' : 'var(--color-inc)') : 'var(--text)' },
              { val: fmtINR(spentMonth), lbl: 'This Month', color: budgets.monthly > 0 ? (spentMonth / budgets.monthly >= 1 ? 'var(--color-exp)' : 'var(--color-inc)') : 'var(--text)' },
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
              <BudgetBar icon="📅" label="Daily"   spent={spentToday} budget={budgets.daily}    incognito={incognito} />
              <BudgetBar icon="🗓️" label="Weekly"  spent={spentWeek}  budget={budgets.weekly}  incognito={incognito} />
              <BudgetBar icon="📆" label="Monthly" spent={spentMonth} budget={budgets.monthly} incognito={incognito} />
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
                    {(catBgt > 0 || catSpent > 0) && <div style={{ paddingLeft: '1.5rem' }}><BudgetBar label={`${fmtINR(catSpent)} spent`} spent={catSpent} budget={catBgt} incognito={incognito} /></div>}
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
                { val: completedGoals, lbl: 'Completed', color: 'var(--color-inc)' },
                { val: fmtINR(totalTarget), lbl: 'Total Target', color: 'var(--text)' },
                { val: fmtINR(totalContributed), lbl: 'Total Saved', color: 'var(--color-inc)' },
                { val: overallPct.toFixed(0) + '%', lbl: 'Overall', color: overallPct >= 100 ? 'var(--color-inc)' : overallPct >= 50 ? '#f59e0b' : '#667eea' },
              ].map(s => <div key={s.lbl} className="summary-card"><div className="summary-label">{s.lbl}</div><div className="summary-amount" style={{ color: s.color }}>{s.val}</div></div>)}
            </div>

            <div className="goals-grid">
              {goalsWithContribs.map(goal => {
                const contributed = goal.contributions.reduce((s, c) => s + c.amount, 0)
                const pct         = goal.target > 0 ? Math.min((contributed / goal.target) * 100, 100) : 0
                const done        = contributed >= goal.target
                const barColor    = done ? 'var(--color-inc)' : pct >= 75 ? '#f59e0b' : '#667eea'
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
                            : `Created ${goal.createdAt || 'unknown'}`}
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
            <>
              <div className="insights-grid">
                {insights.map((ins, i) => (
                  <div key={i} className="insight-card">
                    <div className="insight-title">{ins.title}</div>
                    <div className="insight-text">{ins.text}</div>
                  </div>
                ))}
              </div>

              {/* Expense Type Breakdown */}
              {expTypeData.length > 0 && (
                <div className="chart-card" style={{ marginTop: 16 }}>
                  <div className="chart-title">🏷️ Expense Type Breakdown</div>
                  <BarChart data={expTypeData.map((d, i) => ({ ...d, _color: ['#667eea','var(--color-inc)','var(--color-exp)','#f59e0b','#8b5cf6','#ec4899'][i % 6] }))} />
                </div>
              )}

              {/* Dining App Breakdown */}
              {diningData.length > 0 && (
                <div className="chart-card" style={{ marginTop: 16 }}>
                  <div className="chart-title">🍔 Dining App Breakdown</div>
                  <BarChart data={diningData.map((d, i) => ({ ...d, _color: CC[(i * 7) % CC.length] }))} />
                </div>
              )}

              {/* Tags Breakdown */}
              {tagsData.length > 0 && (
                <div className="chart-card" style={{ marginTop: 16 }}>
                  <div className="chart-title">🏷️ Tags Breakdown</div>
                  <BarChart data={tagsData.map((d, i) => ({ ...d, _color: CC[(i * 11) % CC.length] }))} />
                </div>
              )}

              {/* Day of Week */}
              {expenses.length > 0 && (() => {
                const dow = Array(7).fill(0)
                expenses.forEach(e => { const d = new Date(e.date + 'T12:00:00'); if (!isNaN(d)) dow[d.getDay()] += toINR(e) })
                const mx = Math.max(...dow, 1)
                const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                return (
                  <div className="chart-card" style={{ marginTop: 16 }}>
                    <div className="chart-title">📅 Spending by Day of Week</div>
                    <div className="dow-grid">
                      {days.map((d, i) => (
                        <div key={d} className="dow-cell">
                          <div className="dow-bar" style={{ height: Math.max(20, 80 * (dow[i] / mx)), background: `rgba(102,126,234,${0.1 + 0.9 * (dow[i] / mx)})` }}>
                            {dow[i] > 0 && <span className="dow-amt">{fmtINR(dow[i]).replace('₹','')}</span>}
                          </div>
                          <div className="dow-label">{d}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Subscription Detective */}
              {subZombieData.subs.length > 0 && (
                <div className="chart-card" style={{ marginTop: 16 }}>
                  <div className="chart-title">🔍 Subscription Detective</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Recurring charges detected — {subZombieData.subs.length} subscription{subZombieData.subs.length !== 1 ? 's' : ''} tracked.
                  </p>

                  {subZombieData.zombies.length > 0 && (
                    <div className="sub-section">
                      <div className="sub-section-title">🧟 Zombie Subscriptions ({subZombieData.zombies.length})</div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>Marked recurring but no charge in 45+ days — might be cancelled or forgotten.</p>
                      {subZombieData.zombies.map((z, i) => (
                        <div key={i} className="sub-row sub-zombie">
                          <div className="sub-desc">{z.desc}</div>
                          <div className="sub-meta">{fmtINR(z.avgAmt)}/charge · last: {z.lastDate} · {z.daysSinceLast}d ago</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {subZombieData.creep.length > 0 && (
                    <div className="sub-section">
                      <div className="sub-section-title">📈 Price Creep ({subZombieData.creep.length})</div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>Price increased by more than 10% since first charge.</p>
                      {subZombieData.creep.map((c, i) => (
                        <div key={i} className="sub-row sub-creep">
                          <div className="sub-desc">{c.desc}</div>
                          <div className="sub-meta">{fmtINR(c.firstAmt)} → {fmtINR(c.lastAmt)} <span style={{ color: 'var(--color-exp)' }}>+{c.pct}%</span></div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="sub-section">
                    <div className="sub-section-title">📋 All Detected Subscriptions</div>
                    <table className="sub-table">
                      <thead><tr><th>Name</th><th>Avg/charge</th><th>Charges</th><th>Months</th><th>Last charge</th></tr></thead>
                      <tbody>{subZombieData.subs.map((s, i) => (
                        <tr key={i}>
                          <td>{s.desc}{s.isRec && <span className="item-tag item-tag-rec" style={{ marginLeft: 4 }}>🔄</span>}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-exp)' }}>{fmtINR(s.avgAmt)}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{s.count}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{s.months}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{s.lastDate}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* ── Exchange tab ── */}
      {tab === 'exchange' && (
        <main>
          <div className="card">
            <div className="card-header-row">
              <strong>Live Exchange Rates</strong>
              {rateData && <span className="rate-badge">{rsLabel}</span>}
              <button className="btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={refreshRates} disabled={rateFetching}>
                {rateFetching ? 'Fetching…' : '🔄 Refresh'}
              </button>
            </div>
            <p className="exchange-desc">Rates from <strong>exchangerate-api.com</strong> — fetched with {baseCurrency} base. Cached 6 h. Falls back to cached → built-in rates if API is unavailable.</p>
            {rateData?.rates ? (
              <div className="exchange-table-wrap">
                <table className="exchange-table">
                  <thead><tr><th>Currency</th><th style={{ textAlign: 'right' }}>1 Unit → INR</th><th style={{ textAlign: 'right' }}>1 INR → Units</th></tr></thead>
                  <tbody>
                    {CURRENCIES.filter(c => c.code !== 'INR').map(c => {
                      const rate = rateData.rates[c.code]
                      if (!rate) return <tr key={c.code}><td colSpan="3" className="rate-unavail">{c.flag} {c.code} — unavailable</td></tr>
                      return (
                        <tr key={c.code}>
                          <td><span style={{ marginRight: 6 }}>{c.flag}</span><strong>{c.code}</strong><span className="cur-name">{c.name}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{(1 / rate).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} {c.code}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-icon">🔄</div><h3>Loading rates…</h3></div>
            )}
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>All {CURRENCIES.length} Supported Currencies</div>
            {Object.entries(CG).map(([grp, curs]) => (
              <div key={grp} style={{ marginBottom: 14 }}>
                <div className="cur-group-label">{grp} ({curs.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {curs.map(c => <span key={c.code} title={`${c.name} (${c.symbol})`} className="cur-chip">{c.flag} {c.code}</span>)}
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ── Settings tab ── */}
      {tab === 'settings' && (
        <main>
          {/* Appearance */}
          <div className="settings-section">
            <h3>🎨 Appearance</h3>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Dark Mode</strong>
                <span>Toggle dark/light theme. Shortcut: D key.</span>
              </div>
              <button className={`toggle-btn${dark ? ' on' : ''}`} onClick={() => setDark(m => !m)}>
                {dark ? '🌙 Dark' : '☀️ Light'}
              </button>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Colorblind-Friendly Mode</strong>
                <span>Replaces red/green with blue/orange — optimised for deuteranopia.</span>
              </div>
              <button className={`toggle-btn${colorblind ? ' on' : ''}`} onClick={() => setColorblind(m => !m)}>
                {colorblind ? '👁️ On' : '👁️ Off'}
              </button>
            </div>
          </div>

          {/* Base Currency */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>💱 Base Currency</h3>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Display Currency</strong>
                <span>All totals, charts, and summaries are shown in this currency.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{(CM[baseCurrency] || CM['INR']).flag}</span>
                <select
                  value={baseCurrency}
                  onChange={e => {
                    setBaseCurrency(e.target.value)
                    try { localStorage.removeItem('et_v6_rates') } catch {}
                  }}
                  className="filter-input" style={{ width: 'auto', minWidth: 200 }}
                >
                  {Object.entries(CG).map(([group, list]) => (
                    <optgroup key={group} label={group}>
                      {list.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            {baseCurrency !== 'INR' && (
              <div className="settings-note">
                ℹ️ Stored data uses INR as the internal reference. Totals are converted using live exchange rates.
              </div>
            )}
          </div>

          {/* Data stats */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>📊 Data Summary</h3>
            <div className="settings-stat-bar">
              {[
                { val: expenses.length, lbl: 'Expenses' },
                { val: income.length,   lbl: 'Income' },
                { val: goals.length,    lbl: 'Goals' },
                { val: contributions.length, lbl: 'Contributions' },
              ].map(s => (
                <div key={s.lbl} className="settings-stat">
                  <div className="val">{s.val}</div>
                  <div className="lbl">{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Safe-to-Spend */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>💡 Safe-to-Spend</h3>
            <p className="settings-desc">
              Calculates a daily spending allowance: <em>(this month's income − fixed expenses − savings goal) ÷ days in month</em>.
              Shows on the Overview Daily Allowance card.
            </p>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Monthly Savings Goal (₹)</strong>
                <span>Amount to ring-fence before calculating discretionary budget.</span>
              </div>
              <input type="number" min="0" step="100" placeholder="0"
                value={savingsGoal || ''}
                onChange={e => setSavingsGoal(parseFloat(e.target.value) || 0)}
                style={{ width: 130, textAlign: 'right' }} />
            </div>
            {dailyAllowance > 0 && (
              <div className="sts-summary">
                <span>Income this month: <strong>{fmtINR(currentMonthInc)}</strong></span>
                <span>Fixed expenses: <strong>{fmtINR(currentMonthFixed)}</strong></span>
                <span>Savings goal: <strong>{fmtINR(savingsGoal)}</strong></span>
                <span>→ Daily allowance: <strong style={{ color: stsColor }}>{fmtINR(dailyAllowance)}</strong> ({daysRemaining}d remaining)</span>
              </div>
            )}
          </div>

          {/* Exchange rate status */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>🔄 Exchange Rates</h3>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Rate Status</strong>
                <span>{rsLabel}{rateData?.ts ? ` — fetched ${new Date(rateData.ts).toLocaleString()}` : ''}</span>
              </div>
              <button className="btn-primary btn-sm" onClick={refreshRates} disabled={rateFetching}>
                {rateFetching ? 'Fetching…' : '🔄 Refresh Rates'}
              </button>
            </div>
          </div>

          {/* Push Notifications */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>🔔 Recurring Reminders</h3>
            <p className="settings-desc">
              Get a daily push notification when a recurring expense is due within 3 days. Works even when the app is closed.
            </p>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Push Notifications</strong>
                <span>
                  {notifPermission === 'denied'
                    ? 'Blocked — enable in browser site settings, then reload.'
                    : notifPermission === 'unsupported'
                    ? 'Not supported in this browser.'
                    : notifSubscribed
                    ? 'Active — you will receive daily reminders.'
                    : 'Not enabled.'}
                </span>
              </div>
              {notifPermission !== 'denied' && notifPermission !== 'unsupported' && (
                notifSubscribed ? (
                  <button className="btn-ghost btn-sm" onClick={notifDisable} disabled={notifLoading}>
                    {notifLoading ? 'Disabling…' : '🔕 Disable'}
                  </button>
                ) : (
                  <button className="btn-primary btn-sm" onClick={notifEnable} disabled={notifLoading}>
                    {notifLoading ? 'Enabling…' : '🔔 Enable'}
                  </button>
                )
              )}
            </div>
            {notifError && <div className="settings-note" style={{ color: 'var(--color-exp)', marginTop: 8 }}>⚠ {notifError}</div>}
          </div>

          {/* Export */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>📤 Export Data</h3>
            <p className="settings-desc">Download a copy of all your data. JSON is a full backup; CSV is for spreadsheets (expenses only).</p>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Export as JSON</strong>
                <span>Full backup — {expenses.length} expenses + {income.length} income. Re-importable.</span>
              </div>
              <button className="btn-primary btn-sm" onClick={handleExportJSON}>Download JSON</button>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Export as CSV</strong>
                <span>Expenses only — open in Excel, Google Sheets, etc.</span>
              </div>
              <button className="btn-ghost btn-sm" onClick={handleExportCSV}>Download CSV</button>
            </div>
          </div>

          {/* Import */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>📥 Import Data</h3>
            <p className="settings-desc">Import from a V6 JSON backup. Duplicates are detected by content fingerprint and skipped automatically.</p>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Import JSON File</strong>
                <span>Merges with existing data. Zero data loss.</span>
              </div>
              <label className={`btn-ghost btn-sm${importing ? ' disabled' : ''}`} style={{ cursor: 'pointer' }}>
                {importing ? 'Importing…' : 'Choose File'}
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} disabled={importing} />
              </label>
            </div>
            {importReport && (
              <div className={`import-report${importReport.error ? ' error' : ' success'}`}>
                <div className="import-report-title">
                  {importReport.error ? '❌ Import Failed' : `✅ ${importReport.count} record${importReport.count !== 1 ? 's' : ''} added${importReport.skipped ? `, ${importReport.skipped} skipped` : ''}`}
                </div>
                <pre className="import-report-detail">{importReport.details}</pre>
              </div>
            )}
          </div>

          {/* V5 Migration */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>🔀 Migrate from V5</h3>
            <p className="settings-desc">Import your historical data from the old single-file app. Export your data from V5 Settings → Export Data → Download JSON, then upload it here. Duplicates are detected by fingerprint and skipped automatically — safe to run multiple times.</p>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Upload V5 Export File</strong>
                <span>Accepts the JSON file exported from V5 Settings.</span>
              </div>
              <label className={`btn-ghost btn-sm${v5Importing ? ' disabled' : ''}`} style={{ cursor: 'pointer' }}>
                {v5Importing ? 'Migrating…' : 'Choose V5 File'}
                <input type="file" accept=".json" onChange={handleV5Import} style={{ display: 'none' }} disabled={v5Importing} />
              </label>
            </div>
            {v5Report && (
              <div className={`import-report${v5Report.error ? ' error' : ' success'}`}>
                <div className="import-report-title">
                  {v5Report.error
                    ? '❌ Migration Failed'
                    : `✅ ${v5Report.count} record${v5Report.count !== 1 ? 's' : ''} migrated${v5Report.skipped ? `, ${v5Report.skipped} skipped` : ''}`}
                </div>
                <pre className="import-report-detail">{v5Report.details}</pre>
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="danger-zone" style={{ marginTop: 16 }}>
            <h3>🚨 Danger Zone</h3>
            <p className="settings-desc">These actions are permanent and cannot be undone. Each requires a confirmation step.</p>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Clear All Expenses</strong>
                <span>Removes all {expenses.length} expense records. Income and settings kept.</span>
              </div>
              <button className="btn-danger btn-sm" onClick={() => setConfirmAction({ type: 'clear-expenses', label: 'Clear All Expenses', detail: `Permanently delete all ${expenses.length} expense records? Your ${income.length} income entries and settings will not be affected.` })}>
                Clear Expenses
              </button>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Clear All Income</strong>
                <span>Removes all {income.length} income records. Expenses and settings kept.</span>
              </div>
              <button className="btn-danger btn-sm" onClick={() => setConfirmAction({ type: 'clear-income', label: 'Clear All Income', detail: `Permanently delete all ${income.length} income records? Your ${expenses.length} expense entries and settings will not be affected.` })}>
                Clear Income
              </button>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Clear All Data</strong>
                <span>Wipes all {expenses.length + income.length} records. Dark mode preference kept.</span>
              </div>
              <button className="btn-danger btn-sm" onClick={() => setConfirmAction({ type: 'clear-all', label: 'Clear All Data', detail: `Permanently delete all ${expenses.length} expenses and ${income.length} income records (${expenses.length + income.length} total)? Dark mode preference will be kept.` })}>
                Clear All Data
              </button>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Factory Reset</strong>
                <span>Deletes everything — all data, goals, budgets, rate cache, and settings. Fresh start.</span>
              </div>
              <button className="btn-danger-solid btn-sm" onClick={() => setConfirmAction({ type: 'factory-reset', label: 'Factory Reset', detail: `Delete ALL data: ${expenses.length} expenses, ${income.length} income, all goals and budgets, rate cache, and all settings. The app will return to its initial state.` })}>
                Factory Reset
              </button>
            </div>
          </div>

          {/* About */}
          <div className="settings-section" style={{ marginTop: 16 }}>
            <h3>ℹ️ About</h3>
            <div className="about-card">
              <div className="about-title">💸 Expense Tracker V6</div>
              <div className="about-meta">
                <span className="about-badge">v7.1.0</span>
                <span className="about-badge">Incognito Mode</span>
                <span className="about-badge">Rate Fallbacks</span>
                <span className="about-badge">Cloud + Supabase</span>
                <span className="about-badge">PWA</span>
              </div>
              <div className="about-row"><span>Architecture</span><span>Vite + React + Supabase</span></div>
              <div className="about-row"><span>Auth</span><span>Magic-link email (Supabase Auth)</span></div>
              <div className="about-row"><span>Database</span><span>Supabase Postgres + RLS</span></div>
              <div className="about-row"><span>Deployment</span><span>Vercel CDN · auto-deploy on push</span></div>
              <div className="about-row"><span>Offline</span><span>Retry queue — changes sync automatically on reconnect</span></div>
              <div className="about-row"><span>PWA</span><span>Installable · service worker · auto-updates</span></div>
              <div className="about-row"><span>Features</span><span>9 tabs · 16 insights · 259-color palette · live FX rates</span></div>
              <div className="about-row"><span>Mobile</span><span>Fully responsive · UPI/Wallet selectors · horizontal tab scroll</span></div>
              <div className="about-row"><span>V5 parity</span><span>100% — all V5 features ported + Goals/Budgets/Offline added</span></div>
              <div className="about-row"><span>Last updated</span><span>2026-04-10</span></div>
            </div>
          </div>
        </main>
      )}

      {/* ══════════ RECURRING ══════════ */}
      {tab === 'recurring' && (() => {
        const recurExp = expenses.filter(e => e.isRecurring)
        const recurInc = income.filter(i => i.isRecurring)
        function daysUntil(d) {
          if (!d) return null
          return Math.round((new Date(d + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000)
        }
        function dueBadge(d) {
          const n = daysUntil(d)
          if (n === null) return { label: 'No due date', color: 'var(--text-muted)' }
          if (n < 0)  return { label: `${Math.abs(n)}d overdue`, color: 'var(--color-exp)' }
          if (n === 0) return { label: 'Due today',   color: '#f59e0b' }
          if (n <= 3)  return { label: `Due in ${n}d`, color: '#f59e0b' }
          return { label: `Due in ${n}d`, color: 'var(--text-muted)' }
        }
        return (
          <main>
            {recurExp.length === 0 && recurInc.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🔄</div>
                <div className="empty-title">No recurring items yet</div>
                <div className="empty-text">Mark an expense or income entry as recurring when adding it.</div>
              </div>
            )}
            {recurExp.length > 0 && (
              <div className="rec-section">
                <div className="rec-section-title">Recurring Expenses ({recurExp.length})</div>
                {recurExp.map(e => {
                  const badge = dueBadge(e.nextDueDate)
                  return (
                    <div key={e.id} className="rec-item">
                      <div className="rec-item-left">
                        <div className="rec-desc">{e.description}</div>
                        <div className="rec-meta">
                          {CATS[e.category]?.icon || ''} {e.category || 'Other'}
                          {e.subcategory && <span>· {e.subcategory}</span>}
                          {e.recurringPeriod && <span className="rec-period-badge">{e.recurringPeriod}</span>}
                        </div>
                      </div>
                      <div className="rec-item-right">
                        <div className="rec-amount" style={{ color: 'var(--color-exp)' }}>{fmtINR(toINR(e))}</div>
                        <div className="rec-due" style={{ color: badge.color }}>{badge.label}</div>
                      </div>
                    </div>
                  )
                })}
                <div className="rec-total">
                  Monthly recurring spend: <strong style={{ color: 'var(--color-exp)' }}>{fmtINR(recurExp.reduce((s, e) => s + toINR(e), 0))}</strong>
                </div>
              </div>
            )}
            {recurInc.length > 0 && (
              <div className="rec-section" style={{ marginTop: 16 }}>
                <div className="rec-section-title">Recurring Income ({recurInc.length})</div>
                {recurInc.map(i => (
                  <div key={i.id} className="rec-item">
                    <div className="rec-item-left">
                      <div className="rec-desc">{i.description}</div>
                      <div className="rec-meta">
                        {i.source || 'Other'}
                        {i.recurringPeriod && <span className="rec-period-badge">{i.recurringPeriod}</span>}
                      </div>
                    </div>
                    <div className="rec-item-right">
                      <div className="rec-amount" style={{ color: 'var(--color-inc)' }}>+{fmtINR(toINR(i))}</div>
                    </div>
                  </div>
                ))}
                <div className="rec-total">
                  Monthly recurring income: <strong style={{ color: 'var(--color-inc)' }}>{fmtINR(recurInc.reduce((s, i) => s + toINR(i), 0))}</strong>
                </div>
              </div>
            )}
          </main>
        )
      })()}

      {/* ── Modals ── */}
      {showEF && <ExpenseForm initialData={editExpTarget} onSubmit={editExpTarget ? handleEditExpense : handleAddExpense} onClose={() => { setShowEF(false); setEditExpTarget(null) }} rateData={rateData} />}
      {showIF && <IncomeForm  initialData={editIncTarget} onSubmit={editIncTarget ? handleEditIncome  : handleAddIncome}  onClose={() => { setShowIF(false); setEditIncTarget(null) }} rateData={rateData} />}
      {delTarget && <ConfirmDialog message={delTarget.many ? `Permanently delete ${Object.keys(delTarget.ids).length} expenses?` : `Delete this ${delTarget.type}? Cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDelTarget(null)} />}
      {confirmAction && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmAction(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2>{confirmAction.type === 'factory-reset' ? '🏭' : '🗑️'} {confirmAction.label}</h2>
              <button className="modal-close" onClick={() => setConfirmAction(null)}>✕</button>
            </div>
            <p style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>{confirmAction.detail}</p>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className={confirmAction.type === 'factory-reset' ? 'btn-danger-solid' : 'btn-danger'} onClick={executeConfirmedAction}>
                {confirmAction.type === 'factory-reset' ? 'Reset Everything' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showGoalForm && <CreateGoalModal onSave={addGoal} onClose={() => setShowGoalForm(false)} />}
      {contribGoal && <AddContributionModal goal={contribGoal} goalContribs={contributions.filter(c => c.goalId === contribGoal.id)} onSave={c => addContribution(contribGoal.id, c)} onClose={() => setContribGoal(null)} />}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
