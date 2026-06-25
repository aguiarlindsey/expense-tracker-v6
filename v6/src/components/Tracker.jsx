import { useState, useMemo, useCallback, useEffect, useRef, memo, Fragment } from 'react'
import { Zap, LayoutDashboard, DollarSign, TrendingUp, ClipboardList, RefreshCw, Settings, Home, Menu, Plane, ArrowLeftRight, Euro, PoundSterling, JapaneseYen, IndianRupee, RussianRuble, SwissFranc, PhilippinePeso, Bitcoin, Lightbulb, Store, Calendar, Wallet, Target, PlusCircle, Sun, Moon, EyeOff, Eye, Command, Search, FileDown, Mail } from 'lucide-react'
import { useStorage } from '../hooks/useStorage'
import { useDebounce } from '../hooks/useDebounce'
import { CATS, CM, CG, PAY_METHODS, UPI_APPS, WALLET_APPS, INC_SOURCES, EXP_TYPES, CURRENCIES, RECURRING_PERIODS, CC, DINING_APPS, GROCERY_TAGS, FALLBACK_RATES, IncomePhIcon } from '../utils/constants'
import GlowingEffect from './GlowingEffect'
import AirplaneIcon from './AirplaneIcon'
import ZapIcon from './ZapIcon'
import SparklesIcon from './SparklesIcon'
import { makeExpense, makeIncome, makeDedupContext, matchesSearch, stableId, detectAnomaly } from '../utils/dataHelpers'
import { saveCorrection } from '../utils/ocrCorrections'
import { migrateV5Data, validateV5File } from '../utils/migrateV5'
import { useNotifications } from '../hooks/useNotifications'
import { useInsightViews } from '../hooks/useInsightViews'
import { useBiometric } from '../hooks/useBiometric'
import ConflictModal from './ConflictModal'
import ReceiptScanner from './ReceiptScanner'
import { generateMonthlyPDF } from '../utils/generatePDF'
import { parseNLQuery } from '../utils/parseNLQuery'

// ─── Currency icon map ───────────────────────────────────
const CURRENCY_ICON_MAP = {
  USD: DollarSign, AUD: DollarSign, CAD: DollarSign, SGD: DollarSign,
  HKD: DollarSign, NZD: DollarSign, MXN: DollarSign, TWD: DollarSign,
  EUR: Euro,
  GBP: PoundSterling,
  JPY: JapaneseYen, CNY: JapaneseYen,
  INR: IndianRupee, NPR: IndianRupee, LKR: IndianRupee, BDT: IndianRupee, PKR: IndianRupee,
  RUB: RussianRuble,
  CHF: SwissFranc,
  PHP: PhilippinePeso,
  BTC: Bitcoin, ETH: Bitcoin,
}

// ─── Helpers ─────────────────────────────────────────────

// South-Asian currencies use the lakh/crore grouping (1,00,000); everything else uses standard (100,000)
const _SA = new Set(['INR','NPR','LKR','BDT','PKR'])
function _localeFor(code) { return _SA.has(code) ? 'en-IN' : 'en-US' }
// Mutable — updated by Tracker when baseCurrency changes so sub-components inherit the right locale
let _appCurrency = 'INR'

function _fmtINR(n) {
  if (isNaN(n) || n == null) n = 0
  const c = CM[_appCurrency] || CM['INR']
  return c.symbol + parseFloat(n).toLocaleString(_localeFor(_appCurrency), { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
// Module-level alias — sub-components use this; Tracker shadows it with incognito-aware version
const fmtINR = _fmtINR
// Number-only formatter for budget inputs — no symbol, 2 decimal places, locale-aware grouping
function fmtBudgetDisplay(val) {
  const n = parseFloat(val)
  if (!n || isNaN(n)) return ''
  return n.toLocaleString(_localeFor(_appCurrency), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
// Display dates as DD-MM-YYYY everywhere; stored/input format stays YYYY-MM-DD
function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}-${m}-${y}` : iso
}
function toINR(e) {
  if (!e) return 0
  if (!e.currency || e.currency === 'INR') return parseFloat(e.amount || 0)
  return parseFloat(e.amountINR || e.amount || 0)
}
function monthlyEquiv(amountINR, period) {
  switch (period) {
    case 'daily':     return amountINR * 30.44
    case 'weekly':    return amountINR * 4.33
    case 'monthly':   return amountINR
    case 'quarterly': return amountINR / 3
    case 'yearly':    return amountINR / 12
    default:          return amountINR
  }
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

// ─── Anomaly Panel ────────────────────────────────────────

function AnomalyPanel(expenses, anomalyHistory, fmtINR) {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const recentExp = (expenses || []).filter(e => new Date(e.date + 'T12:00:00') >= threeMonthsAgo)
  const monitoredCats = [...new Set(recentExp.map(e => e.category))]
    .filter(cat => recentExp.filter(e => e.category === cat).length >= 2)

  return (
    <div className="chart-card anomaly-panel">
      <div className="chart-title">
        ⚠️ Anomaly Detection
        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
          — flags new expenses 30%+ above your 3-month category average
        </span>
      </div>
      <div className="anomaly-status" style={{ marginTop: 8 }}>
        {monitoredCats.length === 0
          ? <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Add at least 2 expenses in the same category to enable monitoring.</span>
          : <span style={{ color: 'var(--color-inc)', fontSize: '0.88rem' }}>🟢 Monitoring {monitoredCats.length} categor{monitoredCats.length === 1 ? 'y' : 'ies'}: <strong>{monitoredCats.join(', ')}</strong></span>
        }
      </div>
      {anomalyHistory.length === 0
        ? <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: 8 }}>No anomalies flagged yet.</div>
        : (
          <div className="anomaly-list" style={{ marginTop: 10 }}>
            {anomalyHistory.slice(0, 5).map((a, i) => (
              <div key={i} className="anomaly-row">
                <span className="anomaly-date">{fmtDate(a.date)}</span>
                <span className="anomaly-desc">{a.description}</span>
                <span className="anomaly-cat">{a.category}</span>
                <span className="anomaly-deviation">+{a.deviationPct}%</span>
                <span className="anomaly-amt">{fmtINR(a.thisAmount)} <span className="anomaly-avg">avg {fmtINR(a.avgAmount)}</span></span>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

// ─── Biometric Settings ───────────────────────────────────

const BACKUP_EMAIL_KEY = 'et_v6_backup_email'

function BiometricSettings({ session }) {
  const { enroll, removeEnrollment, enrolling, error, isEnrolled, setError } = useBiometric()
  const [enrolled, setEnrolled]       = useState(isEnrolled())
  const [deviceName, setDeviceName]   = useState('')
  const [backupEmail, setBackupEmail] = useState(() => localStorage.getItem(BACKUP_EMAIL_KEY) || '')
  const [msg, setMsg]                 = useState(null)

  async function handleEnroll() {
    setMsg(null); setError(null)
    if (backupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupEmail)) {
      setError('Please enter a valid backup email address.'); return
    }
    const result = await enroll(session, deviceName || 'My Device', backupEmail)
    if (result.success) {
      if (backupEmail) localStorage.setItem(BACKUP_EMAIL_KEY, backupEmail)
      else localStorage.removeItem(BACKUP_EMAIL_KEY)
      setEnrolled(true)
      setMsg('Biometric lock enabled. You will be prompted to verify on next sign-in.')
    }
  }

  async function handleRemove() {
    setMsg(null)
    await removeEnrollment(session)
    setEnrolled(false)
    setMsg('Biometric lock removed.')
  }

  async function handleUpdateBackupEmail() {
    setMsg(null); setError(null)
    if (backupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupEmail)) {
      setError('Please enter a valid backup email address.'); return
    }
    if (backupEmail) localStorage.setItem(BACKUP_EMAIL_KEY, backupEmail)
    else localStorage.removeItem(BACKUP_EMAIL_KEY)
    setMsg('Backup email updated.')
  }

  return (
    <div className="settings-section">
      <h3><span aria-hidden="true">🔐</span> Security</h3>
      {msg && <div className="settings-msg">{msg}</div>}
      {error && <div className="settings-msg settings-msg-err">{error}</div>}
      {enrolled ? (
        <>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Biometric Lock</strong>
              <span>🟢 Enabled — app requires biometric / device PIN on every sign-in.</span>
            </div>
            <button className="btn-danger-sm" onClick={handleRemove}>Remove</button>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Backup OTP Email</strong>
              <span>If biometrics fail, the one-time code goes here instead of your login email.</span>
            </div>
          </div>
          <div className="settings-row">
            <input className="input-sm" type="email" placeholder="backup@example.com"
              aria-label="Backup OTP email address"
              value={backupEmail} onChange={e => setBackupEmail(e.target.value)}
              style={{ flex: 1 }} />
            <button className="btn-primary-sm" onClick={handleUpdateBackupEmail}>Save</button>
          </div>
        </>
      ) : (
        <>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Biometric Lock</strong>
              <span>Protect the app with your device fingerprint, face, or PIN. Locks on every sign-in.</span>
            </div>
          </div>
          <div className="settings-row">
            <input className="input-sm" placeholder="Device name (optional)"
              aria-label="Device name for this biometric credential"
              value={deviceName}
              onChange={e => setDeviceName(e.target.value)} style={{ maxWidth: 180 }} />
            <button className="btn-primary-sm" onClick={handleEnroll} disabled={enrolling}>
              {enrolling ? 'Setting up…' : 'Enable Biometric Lock'}
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Backup OTP Email</strong>
              <span>OTP fallback will go here instead of your login email. Leave blank to use login email.</span>
            </div>
          </div>
          <div className="settings-row">
            <input className="input-sm" type="email" placeholder="backup@example.com (optional)"
              aria-label="Backup OTP email address (optional)"
              value={backupEmail} onChange={e => setBackupEmail(e.target.value)}
              style={{ flex: 1 }} />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Toast System ─────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  const polite  = toasts.filter(t => t.kind !== 'danger')
  const urgent  = toasts.filter(t => t.kind === 'danger')
  function renderToast(t) {
    return (
      <div key={t.id} className={`toast toast-${t.kind || 'info'} ${t.exiting ? 'toast-exit' : ''}`}
        onClick={() => onDismiss(t.id)}>
        <span className="toast-icon">{t.icon || '💡'}</span>
        <div className="toast-body">
          <div className="toast-title">{t.title}</div>
          <div className="toast-msg">{t.msg}</div>
        </div>
        <button className="toast-close" aria-label="Dismiss" onClick={e => { e.stopPropagation(); onDismiss(t.id) }}>✕</button>
      </div>
    )
  }
  return (
    <div className="toast-stack">
      {polite.length > 0 && (
        <div role="status" aria-live="polite" aria-atomic="false">
          {polite.map(renderToast)}
        </div>
      )}
      {urgent.length > 0 && (
        <div role="alert" aria-live="assertive" aria-atomic="false">
          {urgent.map(renderToast)}
        </div>
      )}
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
    const midRad = r(start + deg / 2)
    const tx = (4.5 * Math.cos(midRad)).toFixed(2)
    const ty = (4.5 * Math.sin(midRad)).toFixed(2)
    return { ...it, x1, y1, x2, y2, deg, pct, tx, ty, color: CATS[it.label]?.color || `hsl(${i * 37},65%,55%)` }
  })
  return (
    <div className="pie-wrap">
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
        {slices.map((sl, i) => sl.deg < 360 ? (
          <path key={i}
            d={`M50,50 L${sl.x1},${sl.y1} A40,40 0 ${sl.deg > 180 ? 1 : 0},1 ${sl.x2},${sl.y2} Z`}
            fill={sl.color}
            opacity={hovered === null || hovered === i ? 1 : 0.45}
            style={{
              transform: hovered === i ? `translate(${sl.tx}px, ${sl.ty}px)` : 'translate(0,0)',
              transition: 'transform 0.22s cubic-bezier(0.16,1,0.3,1), opacity 0.15s',
              cursor: 'pointer',
              filter: hovered === i ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' : 'none',
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(i)}
            onTouchEnd={() => setTimeout(() => setHovered(null), 600)}
          />
        ) : (
          <circle key={i} cx="50" cy="50" r="40" fill={sl.color} />
        ))}
      </svg>
      <div className="pie-legend">
        {slices.map((sl, i) => (
          <div key={i} className={'pie-legend-row' + (hovered === i ? ' pie-legend-row-active' : '')}
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

function LineChart({ data, incognito = false }) {
  const [hovered, setHovered] = useState(null)
  if (!data || data.length < 2) return <div className="chart-empty">Not enough data</div>
  const fmt = n => incognito ? '••••' : _fmtINR(n)
  const vals = data.map(d => d.value)
  const maxV = Math.max(...vals, 1), minV = Math.min(...vals, 0), rng = maxV - minV || 1
  const W = 500, H = 150, pl = 10, pr = 10, pt = 18, pb = 28
  const gW = W - pl - pr, gH = H - pt - pb
  const pts = data.map((d, i) => ({
    x: pl + (i / (data.length - 1)) * gW,
    y: pt + gH - ((d.value - minV) / rng) * gH, ...d
  }))
  const pathD = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  const TW = 96, TH = 36

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', cursor: 'crosshair' }}
      onMouseLeave={() => setHovered(null)}>
      {/* area fill */}
      <defs>
        <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L${pts[pts.length-1].x},${pt+gH} L${pts[0].x},${pt+gH} Z`}
        fill="url(#lc-fill)" />
      <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2" />

      {/* vertical hover indicator */}
      {hovered !== null && (
        <line x1={pts[hovered].x} y1={pt} x2={pts[hovered].x} y2={pt + gH}
          stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
      )}

      {/* invisible hit columns — full height, span between midpoints */}
      {pts.map((p, i) => {
        const left  = i === 0 ? 0 : (pts[i-1].x + p.x) / 2
        const right = i === pts.length - 1 ? W : (p.x + pts[i+1].x) / 2
        return (
          <rect key={i} x={left} width={right - left} y={0} height={H - pb}
            fill="transparent" onMouseEnter={() => setHovered(i)} />
        )
      })}

      {/* dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y}
          r={hovered === i ? 5 : 3}
          fill="var(--primary)"
          stroke={hovered === i ? 'var(--surface)' : 'none'}
          strokeWidth="2"
          style={{ transition: 'r 0.12s, stroke 0.12s' }}
        />
      ))}

      {/* month labels */}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="9"
          fill={hovered === i ? 'var(--primary)' : 'var(--text-muted)'}
          fontWeight={hovered === i ? '700' : '400'}>
          {p.label}
        </text>
      ))}

      {/* tooltip box */}
      {hovered !== null && (() => {
        const p = pts[hovered]
        const tx = Math.max(0, Math.min(p.x - TW / 2, W - TW))
        const ty = Math.max(2, p.y - TH - 8)
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={tx} y={ty} width={TW} height={TH} rx="6"
              fill="var(--surface)" stroke="var(--border)" strokeWidth="1"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
            <text x={tx + TW / 2} y={ty + 13} textAnchor="middle"
              fontSize="9" fontWeight="600" fill="var(--text-muted)">{p.label}</text>
            <text x={tx + TW / 2} y={ty + 28} textAnchor="middle"
              fontSize="12" fontWeight="700" fill="var(--primary)">{fmt(p.value)}</text>
          </g>
        )
      })()}
    </svg>
  )
}

function BarChart({ data, incognito = false }) {
  if (!data || !data.length) return <div className="chart-empty">No data</div>
  const fmt = n => incognito ? '••••' : _fmtINR(n)
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
              <div className="bar-fill" style={{ '--fill': pct / 100, background: color, animationDelay: `${i * 55}ms` }} />
            </div>
            <div className="bar-val">{fmt(d.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Grouped Bar Chart (exp + income per month) ───────────

const GBC_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function GroupedBarChart({ data, budget = 0, incognito = false }) {
  if (!data || data.length < 2) return <div className="chart-empty">Not enough data</div>
  const fmt = n => incognito ? '••••' : _fmtINR(n)
  const slice = data.slice(-6)
  const maxVal = Math.max(...slice.flatMap(d => [d.exp, d.inc]), budget, 1)
  const W = 560, H = 140, PAD_L = 4, PAD_B = 4, PAD_T = 4
  const chartW = W - PAD_L, chartH = H - PAD_B - PAD_T
  const groupW = chartW / slice.length
  const barW = Math.min(groupW * 0.32, 22)
  const gap  = barW * 0.35
  const yScale = v => PAD_T + chartH * (1 - v / maxVal)
  const GRID = 4
  return (
    <div className="gbc-wrap">
      {/* Y-axis scale as HTML — never affected by SVG scaling */}
      <div className="gbc-scale">
        {Array.from({ length: GRID }, (_, i) => (
          <div key={i} className="gbc-scale-val">
            {incognito ? '••' : _fmtINR(maxVal * (1 - i / GRID))}
          </div>
        ))}
      </div>
      <div className="gbc-chart-col">
        <svg viewBox={`0 0 ${W} ${H}`} className="grouped-bar-svg">
          {/* Grid lines only — no text in SVG */}
          {Array.from({ length: GRID + 1 }, (_, i) => {
            const y = PAD_T + (chartH / GRID) * i
            return <line key={i} x1={0} x2={W} y1={y} y2={y} stroke="var(--border)" strokeWidth="0.5" />
          })}
          {/* Budget line */}
          {budget > 0 && (() => {
            const by = yScale(budget)
            return <line x1={0} x2={W} y1={by} y2={by} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" />
          })()}
          {/* Bars */}
          {slice.map((d, i) => {
            const cx = PAD_L + groupW * i + groupW / 2
            const expX = cx - gap / 2 - barW
            const incX = cx + gap / 2
            const expY = yScale(d.exp), incY = yScale(d.inc)
            const expH = Math.max(H - PAD_B - expY, 1), incH = Math.max(H - PAD_B - incY, 1)
            return (
              <g key={i}>
                <rect x={expX} y={expY} width={barW} height={expH} fill="var(--color-exp)" rx="2" opacity="0.85"
                  style={{ animationDelay: `${i * 70}ms` }}>
                  <title>{GBC_MON[parseInt(d.label)-1]}: {fmt(d.exp)} spent</title>
                </rect>
                {d.inc > 0 && <rect x={incX} y={incY} width={barW} height={incH} fill="var(--color-inc)" rx="2" opacity="0.85"
                  style={{ animationDelay: `${i * 70 + 35}ms` }}>
                  <title>{GBC_MON[parseInt(d.label)-1]}: {fmt(d.inc)} income</title>
                </rect>}
              </g>
            )
          })}
        </svg>
        {/* Month labels as HTML — immune to SVG scaling */}
        <div className="gbc-months">
          {slice.map((d, i) => (
            <div key={i} className="gbc-month-label">
              {GBC_MON[parseInt(d.label) - 1] || d.label}
            </div>
          ))}
        </div>
      </div>
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
        days[e.date].topColor = (e.customColor && e.customColor.startsWith('#')) ? e.customColor : (CATS[e.category]?.color || 'var(--color-brand)')
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
          const base = d.topColor || 'var(--color-brand)'
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
      <div className="heatmap-grid" role="img" aria-label="Spending heatmap calendar — each cell represents one day">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => (
          <div key={i} className="heatmap-dow" aria-hidden="true">{l}</div>
        ))}
        {weeks.map((week, wi) =>
          week.map((d, di) => (
            <div key={`${wi}-${di}`}
              className="heatmap-cell"
              style={{ background: d ? cellMap.get(d.date) : 'transparent', border: d ? undefined : 'none' }}
              title={d ? tipMap.get(d.date) : undefined}
              aria-label={d ? tipMap.get(d.date) : undefined}
              aria-hidden={d ? undefined : 'true'}
            />
          ))
        )}
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const a = (0.15 + t * 0.85).toFixed(2)
          return <div key={i} className="heatmap-cell" style={{ background: `rgba(99,102,241,${a})` }} />
        })}
        <span>More</span>
      </div>
    </div>
  )
}

// ─── Financial Health Score Card ─────────────────────────

const RING_R = 54, RING_C = 2 * Math.PI * RING_R  // 339.29

function HealthScoreCard({ score, breakdown, incognito }) {
  const [anim, setAnim] = useState(0)
  useEffect(() => { const t = setTimeout(() => setAnim(score), 80); return () => clearTimeout(t) }, [score])

  const color = score >= 80 ? '#10b981' : score >= 60 ? 'var(--color-warning)' : score >= 40 ? '#f97316' : '#ef4444'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work'
  const offset = RING_C * (1 - anim / 100)

  return (
    <div className="hs-card">
      <div className="hs-header">Financial Health Score</div>
      <div className="hs-body">
        {/* Ring */}
        <div className="hs-ring-wrap">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={RING_R} fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="64" cy="64" r={RING_R} fill="none"
              stroke={color} strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={offset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '64px 64px', transition: 'stroke-dashoffset 1.1s ease' }}
            />
          </svg>
          <div className="hs-ring-center">
            <div className="hs-score" style={{ color }}>{incognito ? '—' : score}</div>
            <div className="hs-label" style={{ color }}>{label}</div>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="hs-subs">
          {breakdown.map(s => (
            <div key={s.key} className="hs-sub">
              <div className="hs-sub-top">
                <span className="hs-sub-icon">{s.icon}</span>
                <span className="hs-sub-name">{s.name}</span>
                <span className="hs-sub-pts" style={{ color: s.pts >= 20 ? 'var(--color-inc)' : s.pts >= 12 ? 'var(--color-warning)' : 'var(--color-exp)' }}>
                  {s.pts}<span className="hs-sub-max">/25</span>
                </span>
              </div>
              <div className="hs-sub-bar">
                <div className="hs-sub-fill" style={{ '--fill': s.pts / 25, background: s.pts >= 20 ? 'var(--color-inc)' : s.pts >= 12 ? 'var(--color-warning)' : 'var(--color-exp)' }} />
              </div>
              <div className="hs-sub-note">{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom insight */}
      {breakdown.length > 0 && (() => {
        const weakest = [...breakdown].sort((a, b) => a.pts - b.pts)[0]
        return weakest.pts < 18
          ? <div className="hs-tip">💡 <strong>Quick win:</strong> {weakest.tip}</div>
          : <div className="hs-tip">✅ <strong>Looking great!</strong> {weakest.tip}</div>
      })()}
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
      <div className="bbar-track"><div className={`bbar-fill bbar-fill-${level}`} style={{ '--fill': pct / 100 }} /></div>
      {over && <div className="bbar-over">⚠️ Over by {fmtINR(spent - budget)}</div>}
    </div>
  )
})

// ─── Bottom-sheet drag-to-dismiss hook ────────────────────

function useBottomSheet(onClose) {
  const startY      = useRef(null)
  const deltaRef    = useRef(0)
  const [dragY, setDragY] = useState(0)

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY
    deltaRef.current = 0
  }
  const onTouchMove = (e) => {
    if (startY.current === null) return
    const d = Math.max(0, e.touches[0].clientY - startY.current)
    deltaRef.current = d
    setDragY(d)
  }
  const onTouchEnd = () => {
    const d = deltaRef.current
    startY.current = null; deltaRef.current = 0
    setDragY(0)
    if (d > 100) onClose()
  }

  const sheetStyle = dragY > 0
    ? { transform: `translateY(${dragY}px)`, transition: 'none', willChange: 'transform' }
    : {}

  return { sheetStyle, onTouchStart, onTouchMove, onTouchEnd }
}

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
    taxAmount: 0, taxBreakdown: {},
    fuelRate: '', fuelQuantity: '', fuelType: '', odoReading: '', tripA: '', tripB: '', tripSelected: '',
    vehicleCurrentKm: '', vehicleNextServiceKm: '',
    useCatAlloc: false, categoryAllocations: {},
  })
  const [showPalette, setShowPalette] = useState(false)
  const [rateFetching, setRateFetching] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showTax, setShowTax] = useState(!!(initialData?.taxAmount > 0))
  const [formError, setFormError] = useState('')
  const [templates, setTemplates] = useState(() => { try { return JSON.parse(localStorage.getItem('et_v6_templates')) || [] } catch { return [] } })
  const [savingTpl, setSavingTpl] = useState(false)
  const [tplName, setTplName] = useState('')
  const [receiptImageB64, setReceiptImageB64] = useState(null)
  const [emailReceipt, setEmailReceipt] = useState(
    () => localStorage.getItem('et_v6_email_receipt_pref') === '1'
  )
  const { sheetStyle, onTouchStart, onTouchMove, onTouchEnd } = useBottomSheet(onClose)
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))
  useEffect(() => {
    localStorage.setItem('et_v6_email_receipt_pref', emailReceipt ? '1' : '0')
  }, [emailReceipt])

  function applyTemplate(t) {
    setForm(p => ({ ...p,
      description: t.desc, amount: t.amount ? String(t.amount) : '',
      currency: t.currency || 'INR', category: t.category || 'Food',
      subcategory: t.subcategory || '', paymentMethod: t.paymentMethod || 'UPI/QR',
      expenseType: t.expenseType || 'variable', tags: t.tags || [],
      notes: t.notes || '', isRecurring: t.isRecurring || false,
      recurringPeriod: t.recurringPeriod || 'monthly',
    }))
  }
  function saveTemplate() {
    const name = tplName.trim() || form.description.trim() || `Template ${templates.length + 1}`
    const t = {
      id: String(Date.now()), name,
      desc: form.description, amount: parseFloat(form.amount) || 0,
      currency: form.currency, category: form.category,
      subcategory: form.subcategory, paymentMethod: form.paymentMethod,
      expenseType: form.expenseType, tags: form.tags,
      notes: form.notes, isRecurring: form.isRecurring,
      recurringPeriod: form.recurringPeriod,
    }
    const updated = [...templates, t].slice(-10)
    setTemplates(updated)
    localStorage.setItem('et_v6_templates', JSON.stringify(updated))
    setSavingTpl(false); setTplName('')
  }
  function deleteTpl(id) {
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    localStorage.setItem('et_v6_templates', JSON.stringify(updated))
  }

  const applyOcr = (parsed) => {
    lastOcrRef.current = parsed // store so handleAddExpense can detect user corrections
    if (parsed._receiptImageB64) setReceiptImageB64(parsed._receiptImageB64)
    if (parsed.amount)      s('amount', parsed.amount)
    if (parsed.date)        s('date', parsed.date)
    // Use merchant name, or fall back to subcategory/category so description is never blank
    const desc = parsed.description || parsed.subcategory || parsed.category || ''
    if (desc) s('description', desc)
    if (parsed.category && CATS[parsed.category]) {
      s('category', parsed.category)
      if (parsed.subcategory) s('subcategory', parsed.subcategory)
    }
    if (parsed.paymentMethod && PAY_METHODS.includes(parsed.paymentMethod)) {
      s('paymentMethod', parsed.paymentMethod)
      if (parsed.paymentDescription) s('paymentDescription', parsed.paymentDescription)
    }
    if (parsed.diningApp) s('diningApp', parsed.diningApp)
    if (parsed.taxAmount > 0) {
      s('taxAmount', parsed.taxAmount)
      s('taxBreakdown', parsed.taxBreakdown)
      setShowTax(true)
    }
    if (parsed.fuelRate)     s('fuelRate', String(parsed.fuelRate))
    if (parsed.fuelQuantity) s('fuelQuantity', String(parsed.fuelQuantity))
    if (parsed.fuelType)     s('fuelType', parsed.fuelType)
    // Vehicle service fields
    if (parsed.nextServiceDate) {
      s('nextDueDate', parsed.nextServiceDate)
      s('isRecurring', true)
    }
    if (parsed.currentKm)       s('vehicleCurrentKm', String(parsed.currentKm))
    if (parsed.nextServiceKm)   s('vehicleNextServiceKm', String(parsed.nextServiceKm))
    if (parsed.vehicleModel || parsed.vehicleReg || parsed.serviceType) {
      const parts = []
      if (parsed.vehicleModel)    parts.push(parsed.vehicleModel)
      if (parsed.vehicleReg)      parts.push(`Reg: ${parsed.vehicleReg}`)
      if (parsed.serviceType)     parts.push(parsed.serviceType)
      if (parsed.nextServiceType) parts.push(`Next: ${parsed.nextServiceType}`)
      s('notes', parts.join(' | '))
    }
  }

  // ── Historical rate sync ───────────────────────────────
  useEffect(() => {
    if (form.currency === 'INR') return
    if (!form.date || form.date >= today) return          // today/future → use live rates
    const CACHE_KEY = `et_hist_${form.date}_${form.currency}`
    const CACHE_TTL = 6 * 3600 * 1000
    const cached = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null } })()
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      s('conversionRate', cached.rate)
      return
    }
    const ctrl = new AbortController()
    setRateFetching(true)
    fetch(`https://api.frankfurter.dev/v2/${form.date}?base=${form.currency}&symbols=INR`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => {
        const rate = j?.rates?.INR
        if (rate) {
          const r6 = parseFloat(rate.toFixed(6))
          s('conversionRate', r6)
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: r6, ts: Date.now() })) } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setRateFetching(false))
    return () => ctrl.abort()
  }, [form.date, form.currency])

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
    // rateData.rates is now "INR per 1 foreign" — use directly
    if (rate) s('conversionRate', parseFloat(rate.toFixed(6)))
  }

  const sub = async e => {
    e.preventDefault()
    if (!form.description.trim()) { setFormError('Description is required — type the merchant name'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setFormError('Enter a valid amount greater than 0'); return }
    setFormError('')
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
      vehicleCurrentKm:    form.vehicleCurrentKm    ? parseInt(form.vehicleCurrentKm, 10)    || null : null,
      vehicleNextServiceKm: form.vehicleNextServiceKm ? parseInt(form.vehicleNextServiceKm, 10) || null : null,
      odoReading:   form.odoReading ? parseFloat(form.odoReading) || null : null,
      tripA:        form.tripA    ? parseFloat(form.tripA)    || null : null,
      tripB:        form.tripB    ? parseFloat(form.tripB)    || null : null,
      tripSelected: form.tripSelected || null,
    })
    if (!initialData && emailReceipt && receiptImageB64) {
      try {
        const { data: { session: sess } } = await supabase.auth.getSession()
        if (sess?.access_token) {
          const desc = form.description.trim() || 'Expense'
          fetch('/api/email-share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sess.access_token}` },
            body: JSON.stringify({
              type: 'receipt',
              subject: `Receipt — ${desc}${form.date ? ' · ' + form.date : ''}`,
              attachment: receiptImageB64,
              filename: `receipt-${form.date || 'unknown'}.png`,
              mimeType: 'image/png',
            }),
          }).catch(() => {})
        }
      } catch (_) {}
    }
    onClose()
  }

  const toggleTag = tag => s('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag])
  const catSubs   = CATS[form.category]?.subs || []
  const isForeign = form.currency !== 'INR'
  const inrPreview = isForeign && form.amount ? parseFloat(form.amount) * (parseFloat(form.conversionRate) || 1) : null

  return (
    <>
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={sheetStyle}>
        <div className="sheet-handle-wrap"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="sheet-handle-pill" />
        </div>
        <div className="modal-header">
          <h2>{initialData ? '✏️ Edit Expense' : '➕ Add Expense'}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {!initialData && (
              <button type="button" className="btn-primary-sm" onClick={() => setShowScanner(true)}>📷 Scan</button>
            )}
            <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <form onSubmit={sub} className="form">
          {!initialData && templates.length > 0 && (
            <div className="template-row">
              <span className="template-row-label">Quick add</span>
              <div className="template-chips">
                {templates.map(t => (
                  <div key={t.id} className="template-chip">
                    <button type="button" className="template-chip-apply" onClick={() => applyTemplate(t)}>
                      {CATS[t.category]?.icon || '📦'} {t.name}
                    </button>
                    <button type="button" className="template-chip-del" onClick={() => deleteTpl(t.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ef-date">Date *</label>
              <input id="ef-date" type="date" value={form.date} onChange={e => s('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="ef-amount">Amount *</label>
              <input id="ef-amount" type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => s('amount', e.target.value)} required placeholder="0.00" autoFocus={!initialData} />
            </div>
            <div className="form-group">
              <label htmlFor="ef-currency">Currency</label>
              <select id="ef-currency" value={form.currency} onChange={e => onCurrencyChange(e.target.value)}>
                {Object.entries(CG).map(([group, list]) => (
                  <optgroup key={group} label={group}>
                    {list.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          {isForeign && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ef-rate">
                  Rate: 1 {form.currency} = ? INR
                  {rateFetching && <span style={{ marginLeft: 6, fontSize: '0.78em', color: 'var(--primary)' }}>⏳ Fetching historical rate…</span>}
                  {!rateFetching && form.date < today && <span style={{ marginLeft: 6, fontSize: '0.78em', color: 'var(--text-muted)' }}>📅 {fmtDate(form.date)}</span>}
                </label>
                <input id="ef-rate" type="number" step="0.000001" min="0" value={form.conversionRate}
                  onChange={e => s('conversionRate', parseFloat(e.target.value) || 0)}
                  disabled={rateFetching} />
              </div>
              {inrPreview !== null && (
                <div className="form-group">
                  <label>INR Equivalent</label>
                  <div className="currency-preview">{rateFetching ? '⏳' : fmtINR(inrPreview)}</div>
                </div>
              )}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="ef-desc">Description *</label>
            <input id="ef-desc" value={form.description} onChange={e => s('description', e.target.value)} required placeholder="What did you spend on?" />
          </div>
          <div className="form-group">
            <label>Category</label>
            <div className="cat-icon-grid" role="radiogroup" aria-label="Category">
              {Object.keys(CATS).map(c => {
                const CatPh  = CATS[c].PhIcon
                const active = form.category === c
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`cat-icon-btn${active ? ' active' : ''}`}
                    style={active ? { borderColor: CATS[c].color, background: `color-mix(in srgb, ${CATS[c].color} 14%, var(--surface))` } : {}}
                    onClick={() => { s('category', c); s('subcategory', ''); s('diningApp', '') }}
                    title={c}
                  >
                    <span className="cat-icon-btn-ico" style={{ background: `color-mix(in srgb, ${CATS[c].color} 16%, transparent)` }}>
                      {CatPh ? <CatPh size={16} weight="duotone" color={active ? CATS[c].color : 'var(--text-muted)'} /> : CATS[c].icon}
                    </span>
                    <span className="cat-icon-btn-lbl">{c}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="ef-subcat">Subcategory</label>
            <select id="ef-subcat" value={form.subcategory} onChange={e => s('subcategory', e.target.value)}>
              <option value="">—</option>
              {catSubs.map(sub => <option key={sub}>{sub}</option>)}
            </select>
          </div>
          {/* Fuel details — only for Transport / Fuel */}
          {form.category === 'Transport' && form.subcategory === 'Fuel' && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⛽ Fuel Details</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rate per Litre (₹/L)</label>
                  <input type="number" min="0" step="0.01" placeholder="e.g. 103.50"
                    value={form.fuelRate || ''}
                    onChange={e => s('fuelRate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Quantity (Litres)</label>
                  <input type="number" min="0" step="0.001" placeholder="e.g. 19.401"
                    value={form.fuelQuantity || ''}
                    onChange={e => s('fuelQuantity', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Fuel Type</label>
                  <select value={form.fuelType || ''} onChange={e => s('fuelType', e.target.value)}>
                    <option value="">—</option>
                    {['Petrol','Diesel','CNG','LPG','Premium','Speed','Power'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>ODO Reading (km)</label>
                  <input type="number" min="0" step="0.1" placeholder="e.g. 45230.5"
                    value={form.odoReading || ''}
                    onChange={e => s('odoReading', e.target.value)} />
                </div>
                {['A','B'].map(t => {
                  const key  = t === 'A' ? 'tripA' : 'tripB'
                  const sel  = form.tripSelected === t
                  const other = t === 'A' ? 'B' : 'A'
                  const hasVal = !!form[key]
                  return (
                    <div key={t} className="form-group"
                      onClick={() => { if (hasVal) s('tripSelected', t) }}
                      style={{
                        cursor: hasVal ? 'pointer' : 'default',
                        outline: sel ? '2px solid var(--primary)' : '2px solid transparent',
                        outlineOffset: 2,
                        borderRadius: 8,
                        transition: 'outline 0.15s',
                      }}>
                      <label style={{
                        color: sel ? 'var(--primary)' : undefined,
                        cursor: hasVal ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        Trip {t} (km)
                        {sel && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: '#fff', borderRadius: 99, padding: '1px 6px', fontWeight: 700 }}>efficiency</span>}
                      </label>
                      <input type="number" min="0" step="0.1"
                        placeholder={t === 'A' ? 'e.g. 320.5' : 'e.g. 1240.2'}
                        value={form[key] || ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          s(key, e.target.value)
                          // Auto-select this trip if nothing selected yet, or other trip is empty
                          if (!form.tripSelected || !form[t === 'A' ? 'tripB' : 'tripA'])
                            s('tripSelected', e.target.value ? t : form.tripSelected === t ? other : form.tripSelected)
                        }} />
                    </div>
                  )
                })}
                {(() => {
                  const selKey = form.tripSelected === 'B' ? 'tripB' : 'tripA'
                  const trip   = parseFloat(form[selKey] || form.tripA || form.tripB)
                  const qty    = parseFloat(form.fuelQuantity)
                  const label  = form.tripSelected || (form.tripA ? 'A' : 'B')
                  if (!trip || !qty || qty <= 0) return null
                  return (
                    <div className="form-group">
                      <label>km/L (Trip {label})</label>
                      <div style={{ padding: '0.5rem 0.75rem', background: 'var(--surface-alt)', border: '2px solid var(--primary)', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {(trip / qty).toFixed(2)} km/L
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
          {/* Vehicle maintenance details — only for Transport / Vehicle Maintenance */}
          {form.category === 'Transport' && form.subcategory === 'Vehicle Maintenance' && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔧 Service Details</div>
              <div className="form-row">
                <div className="form-group">
                  <label>KMs at Service</label>
                  <input type="number" min="0" step="1" placeholder="e.g. 12500"
                    value={form.vehicleCurrentKm || ''}
                    onChange={e => s('vehicleCurrentKm', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Next Service at KMs</label>
                  <input type="number" min="0" step="1" placeholder="e.g. 15000"
                    value={form.vehicleNextServiceKm || ''}
                    onChange={e => s('vehicleNextServiceKm', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Next Service Date <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— sets a reminder</span></label>
                <input type="date"
                  value={form.nextDueDate || ''}
                  onChange={e => {
                    s('nextDueDate', e.target.value)
                    s('isRecurring', !!e.target.value)
                  }} />
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ef-payment">Payment</label>
              <select id="ef-payment" value={form.paymentMethod} onChange={e => s('paymentMethod', e.target.value)}>
                {PAY_METHODS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ef-type">Type</label>
              <select id="ef-type" value={form.expenseType} onChange={e => s('expenseType', e.target.value)}>
                {EXP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {form.paymentMethod === 'UPI/QR' && (
            <div className="form-group">
              <label htmlFor="ef-upi">UPI App</label>
              <select id="ef-upi" value={form.paymentDescription || ''} onChange={e => s('paymentDescription', e.target.value)}>
                {UPI_APPS.map(a => <option key={a} value={a}>{a || '— Select app —'}</option>)}
              </select>
            </div>
          )}
          {form.paymentMethod === 'Wallet' && (
            <div className="form-group">
              <label htmlFor="ef-wallet">Wallet</label>
              <select id="ef-wallet" value={form.paymentDescription || ''} onChange={e => s('paymentDescription', e.target.value)}>
                {WALLET_APPS.map(a => <option key={a} value={a}>{a || '— Select wallet —'}</option>)}
              </select>
            </div>
          )}
          {form.paymentMethod !== 'Cash' && form.paymentMethod !== 'UPI/QR' && form.paymentMethod !== 'Wallet' && (
            <div className="form-group">
              <label htmlFor="ef-payref">Payment Reference</label>
              <input id="ef-payref" value={form.paymentDescription || ''} onChange={e => s('paymentDescription', e.target.value)}
                placeholder="Card last 4 digits, txn ID…" />
            </div>
          )}
          {form.category === 'Food' && (
            <div className="form-group">
              <label htmlFor="ef-dining">Dining App</label>
              <select id="ef-dining" value={form.diningApp || ''} onChange={e => s('diningApp', e.target.value)}>
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
              <label htmlFor="ef-receipt">Receipt / Order ID</label>
              <input id="ef-receipt" value={form.receiptRef || ''} onChange={e => s('receiptRef', e.target.value)} placeholder="Order #, receipt number…" />
            </div>
            <div className="form-group">
              <label htmlFor="ef-notes">Notes</label>
              <input id="ef-notes" value={form.notes} onChange={e => s('notes', e.target.value)} placeholder="Optional note" />
            </div>
          </div>
          {/* Tax Breakdown */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Tax / GST Breakdown{form.taxAmount > 0 ? <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>— Total ₹{Number(form.taxAmount).toFixed(2)}</span> : ''}</span>
              <button type="button" onClick={() => setShowTax(v => !v)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>
                {showTax ? '▲ Hide' : '▼ Add'}
              </button>
            </label>
            {showTax && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.4rem' }}>
                {[['sgst','SGST'],['cgst','CGST'],['igst','IGST'],['vat','VAT'],['serviceCharge','Service Charge'],['cess','Cess']].map(([key, label]) => (
                  <div className="form-group" key={key}>
                    <label style={{ fontSize: '0.72rem' }}>{label}</label>
                    <input type="number" min="0" step="0.01" placeholder="0.00"
                      value={form.taxBreakdown?.[key] || ''}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        const nb = { ...(form.taxBreakdown || {}), [key]: v }
                        s('taxBreakdown', nb)
                        s('taxAmount', parseFloat(Object.values(nb).reduce((a, b) => a + b, 0).toFixed(2)))
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ef-splitwith">Split With</label>
              <input id="ef-splitwith" value={form.splitWith || ''} onChange={e => s('splitWith', e.target.value)} placeholder="Alice, Bob… (leave blank if no split)" />
            </div>
            {form.splitWith && (
              <div className="form-group">
                <label htmlFor="ef-splitparts">Total Parts (your share = 1/{form.splitParts || 2})</label>
                <input id="ef-splitparts" type="number" min="2" max="20" value={form.splitParts || 2} onChange={e => s('splitParts', parseInt(e.target.value) || 2)} />
                {form.amount && <div className="currency-preview">Your share: {fmtINR(parseFloat(form.amount) / (parseInt(form.splitParts) || 2))}</div>}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Item Colour</label>
            <div className="color-picker-trigger" onClick={() => setShowPalette(p => !p)}>
              <span className="color-swatch-preview" style={{ background: form.customColor || CATS[form.category]?.color || 'var(--color-brand)' }} />
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
              <label htmlFor="ef-nextdue">Next Due Date</label>
              <input id="ef-nextdue" type="date" value={form.nextDueDate || calcNextDue(form.date, form.recurringPeriod)}
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
                    const CatPh = CATS[cat].PhIcon
                    return (
                      <div key={cat} className={`cat-alloc-row${v ? ' has-value' : ''}`}>
                        <span className="cat-alloc-icon">
                          {CatPh ? <CatPh size={14} weight="duotone" color={CATS[cat].color} /> : CATS[cat].icon}
                        </span>
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
          {formError && <div className="form-error-msg">⚠️ {formError}</div>}
          {!initialData && (
            <div className="template-save-row">
              {savingTpl ? (
                <div className="template-save-input">
                  <input type="text" placeholder={form.description || 'Template name…'} value={tplName}
                    onChange={e => setTplName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveTemplate() } if (e.key === 'Escape') setSavingTpl(false) }}
                    autoFocus />
                  <button type="button" className="btn-primary-sm" onClick={saveTemplate}>Save</button>
                  <button type="button" className="btn-secondary-sm" onClick={() => setSavingTpl(false)}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="template-save-btn"
                  onClick={() => { setSavingTpl(true); setTplName(form.description || '') }}
                  disabled={templates.length >= 10}
                  title={templates.length >= 10 ? 'Max 10 templates' : 'Save current form as a reusable template'}>
                  ☆ Save as template{templates.length >= 10 ? ' (max 10)' : ''}
                </button>
              )}
            </div>
          )}
          {receiptImageB64 && !initialData && (
            <div className="form-check" style={{ marginTop: 8, marginBottom: 4 }}>
              <input type="checkbox" id="email-receipt" checked={emailReceipt}
                onChange={e => setEmailReceipt(e.target.checked)} />
              <label htmlFor="email-receipt" style={{ fontSize: '0.85rem' }}>
                📧 Email a digital copy of this receipt to me
              </label>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{initialData ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </form>
      </div>
    </div>
    {showScanner && <ReceiptScanner onResult={applyOcr} onClose={() => setShowScanner(false)} />}
    </>
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
  const [rateFetching, setRateFetching] = useState(false)
  const { sheetStyle: incSheetStyle, onTouchStart: incTS, onTouchMove: incTM, onTouchEnd: incTE } = useBottomSheet(onClose)
  const s = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // ── Historical rate sync ───────────────────────────────
  useEffect(() => {
    if (form.currency === 'INR') return
    if (!form.date || form.date >= today) return
    const CACHE_KEY = `et_hist_${form.date}_${form.currency}`
    const CACHE_TTL = 6 * 3600 * 1000
    const cached = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null } })()
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      s('conversionRate', cached.rate)
      return
    }
    const ctrl = new AbortController()
    setRateFetching(true)
    fetch(`https://api.frankfurter.dev/v2/${form.date}?base=${form.currency}&symbols=INR`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => {
        const rate = j?.rates?.INR
        if (rate) {
          const r6 = parseFloat(rate.toFixed(6))
          s('conversionRate', r6)
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: r6, ts: Date.now() })) } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setRateFetching(false))
    return () => ctrl.abort()
  }, [form.date, form.currency])

  const onCurrencyChange = code => {
    s('currency', code)
    if (code === 'INR') { s('conversionRate', 1); return }
    const rate = rateData?.rates?.[code]
    // rateData.rates is now "INR per 1 foreign" — use directly
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
      <div className="modal" style={incSheetStyle}>
        <div className="sheet-handle-wrap"
          onTouchStart={incTS} onTouchMove={incTM} onTouchEnd={incTE}>
          <div className="sheet-handle-pill" />
        </div>
        <div className="modal-header">
          <h2>{initialData ? '✏️ Edit Income' : '💵 Add Income'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={sub} className="form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="if-date">Date *</label>
              <input id="if-date" type="date" value={form.date} onChange={e => s('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="if-amount">Amount *</label>
              <input id="if-amount" type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => s('amount', e.target.value)} required placeholder="0.00" autoFocus={!initialData} />
            </div>
            <div className="form-group">
              <label htmlFor="if-currency">Currency</label>
              <select id="if-currency" value={form.currency} onChange={e => onCurrencyChange(e.target.value)}>
                {Object.entries(CG).map(([group, list]) => (
                  <optgroup key={group} label={group}>
                    {list.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          {isForeign && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="if-rate">
                  Rate: 1 {form.currency} = ? INR
                  {rateFetching && <span style={{ marginLeft: 6, fontSize: '0.78em', color: 'var(--primary)' }}>⏳ Fetching historical rate…</span>}
                  {!rateFetching && form.date < today && <span style={{ marginLeft: 6, fontSize: '0.78em', color: 'var(--text-muted)' }}>📅 {fmtDate(form.date)}</span>}
                </label>
                <input id="if-rate" type="number" step="0.000001" min="0" value={form.conversionRate}
                  onChange={e => s('conversionRate', parseFloat(e.target.value) || 0)}
                  disabled={rateFetching} />
              </div>
              {inrPreview !== null && (
                <div className="form-group">
                  <label>INR Equivalent</label>
                  <div className="currency-preview">{rateFetching ? '⏳' : fmtINR(inrPreview)}</div>
                </div>
              )}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="if-desc">Description *</label>
            <input id="if-desc" value={form.description} onChange={e => s('description', e.target.value)} required placeholder="e.g. Monthly salary" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="if-source">Source</label>
              <select id="if-source" value={form.source} onChange={e => s('source', e.target.value)}>
                {INC_SOURCES.map(src => <option key={src}>{src}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="if-payment">Payment Method</label>
              <select id="if-payment" value={form.paymentMethod} onChange={e => s('paymentMethod', e.target.value)}>
                {PAY_METHODS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="if-notes">Notes</label>
            <input id="if-notes" value={form.notes} onChange={e => s('notes', e.target.value)} placeholder="Optional note" />
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
const GOAL_MILESTONES = [{ pct: 25, icon: '🥉' }, { pct: 50, icon: '🥈' }, { pct: 75, icon: '🥇' }, { pct: 100, icon: '🏆' }]

function GoalRing({ pct, color, size = 76 }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const filled = Math.min(pct / 100, 1) * circ
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

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
        <div className="modal-header"><h2>🎯 New Goal</h2><button className="modal-close" onClick={onClose} aria-label="Close">✕</button></div>
        <form onSubmit={submit} className="form">
          <div className="form-group">
            <label htmlFor="gf-name">Goal Name *</label>
            <input id="gf-name" value={form.name} onChange={e => s('name', e.target.value)} required placeholder="e.g. Emergency Fund" autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gf-target">Target Amount (₹) *</label>
              <input id="gf-target" type="number" min="1" step="1" value={form.target} onChange={e => s('target', e.target.value)} required placeholder="50000" />
            </div>
            <div className="form-group">
              <label htmlFor="gf-date">Target Date</label>
              <input id="gf-date" type="date" value={form.targetDate} onChange={e => s('targetDate', e.target.value)} />
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
            <label htmlFor="gf-note">Note</label>
            <input id="gf-note" value={form.note} onChange={e => s('note', e.target.value)} placeholder="Optional note" />
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
    if (remaining > 0 && amt > remaining) {
      if (!window.confirm(`This contribution (${_fmtINR(amt)}) exceeds the remaining goal balance of ${_fmtINR(remaining)}. Continue?`)) return
    }
    onSave({ id: stableId({}), date: form.date, amount: amt, note: form.note.trim() })
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2>{goal.icon} Add Contribution</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={submit} className="form">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Saved: <strong>{fmtINR(contributed)}</strong> of {fmtINR(goal.target)} · Remaining: <strong>{fmtINR(remaining)}</strong>
          </p>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cf-date">Date</label>
              <input id="cf-date" type="date" value={form.date} onChange={e => s('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="cf-amount">Amount (₹) *</label>
              <input id="cf-amount" type="number" min="1" step="1" value={form.amount} onChange={e => s('amount', e.target.value)} required placeholder="1000" autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="cf-note">Note</label>
            <input id="cf-note" value={form.note} onChange={e => s('note', e.target.value)} placeholder="Optional" />
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
  const cat    = CATS[item.category] || CATS['Other']
  const icon   = (cat.subIcons && item.subcategory && cat.subIcons[item.subcategory]) || cat.icon
  const PhIcon = (cat.subPhIcons && item.subcategory && cat.subPhIcons[item.subcategory]) || cat.PhIcon

  const REVEAL = 55, CONFIRM = 160
  const [swipeX, setSwipeX] = useState(0)
  const airRef      = useRef(null)
  const zapRef      = useRef(null)
  const sparkRef    = useRef(null)
  const startRef    = useRef(null)
  const swipeRef  = useRef(0)
  const vibRef    = useRef(false)

  const handleTS = (e) => {
    if (bulkMode) return
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    vibRef.current = false
  }
  const handleTM = (e) => {
    if (!startRef.current) return
    const dx = startRef.current.x - e.touches[0].clientX  // +left / −right
    const dy = Math.abs(startRef.current.y - e.touches[0].clientY)
    if (dy > Math.abs(dx) * 1.4) { startRef.current = null; return }
    const lim = CONFIRM + 30
    const v = dx > 0 ? Math.min(dx, lim) : Math.max(dx, -lim)
    swipeRef.current = v; setSwipeX(v)
    if (Math.abs(dx) > REVEAL && !vibRef.current) { navigator.vibrate?.(8); vibRef.current = true }
  }
  const handleTE = () => {
    const d = swipeRef.current
    swipeRef.current = 0; startRef.current = null; setSwipeX(0)
    if (d > CONFIRM)        { navigator.vibrate?.(40); onDelete(item.id) }
    else if (d < -CONFIRM)  { navigator.vibrate?.(40); onEdit(item) }
  }

  const sliding    = swipeX !== 0
  const leftSwipe  = swipeX > 0
  const rightSwipe = swipeX < 0
  const delConfirm = swipeX >= CONFIRM
  const editConfirm = swipeX <= -CONFIRM

  return (
    <div className="swipe-row" style={{ touchAction: 'pan-y' }}>
      {/* Edit — left background, revealed by right swipe */}
      <div className="swipe-bg swipe-bg-edit" style={{
        opacity: rightSwipe ? Math.min(-swipeX / REVEAL, 1) : 0,
        background: editConfirm ? '#4338ca' : '#4f46e5',
      }}>
        <span>✏️</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{editConfirm ? 'Release' : 'Edit'}</span>
      </div>
      {/* Delete — right background, revealed by left swipe */}
      <div className="swipe-bg swipe-bg-delete" style={{
        opacity: leftSwipe ? Math.min(swipeX / REVEAL, 1) : 0,
        background: delConfirm ? '#dc2626' : '#ef4444',
      }}>
        <span>🗑️</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{delConfirm ? 'Release' : 'Delete'}</span>
      </div>
    <div className={`item${isSelected ? ' item-selected' : ''}`}
      style={{
        background: `color-mix(in srgb, ${item.customColor || cat.color} 7%, var(--surface))`,
        transform: sliding ? `translateX(${-swipeX}px)` : undefined,
        transition: sliding ? 'none' : 'transform 0.2s ease',
        position: 'relative', zIndex: 1,
      }}
      onTouchStart={handleTS} onTouchMove={handleTM} onTouchEnd={handleTE}
      onMouseEnter={() => { airRef.current?.startAnimation(); zapRef.current?.startAnimation(); sparkRef.current?.startAnimation() }}
      onMouseLeave={() => { airRef.current?.stopAnimation(); zapRef.current?.stopAnimation(); sparkRef.current?.stopAnimation() }}>
      {bulkMode && <input type="checkbox" className="item-checkbox" checked={isSelected} onChange={() => onToggleSelect(item.id)} />}
      <div className="item-icon" data-cat={item.category} style={{ background: `color-mix(in srgb, ${cat.color} 16%, transparent)` }}>
        {item.category === 'Travel'
          ? <AirplaneIcon ref={airRef} size={17} color={cat.color} />
          : item.category === 'Utilities'
          ? <ZapIcon ref={zapRef} size={17} color={cat.color} />
          : item.category === 'Personal'
          ? <SparklesIcon ref={sparkRef} size={17} color={cat.color} />
          : PhIcon ? <PhIcon size={17} weight="duotone" color={cat.color} /> : icon}
      </div>
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
        {item.subcategory === 'Fuel' && (item.fuelRate || item.odoReading || item.tripA || item.tripB) && (
          <div className="item-notes">
            {item.fuelRate ? `⛽ ₹${Number(item.fuelRate).toFixed(2)}/L` : '⛽'}
            {item.fuelQuantity ? ` · ${Number(item.fuelQuantity).toFixed(3)} L` : ''}
            {item.fuelType    ? ` · ${item.fuelType}` : ''}
            {item.odoReading  ? ` · ODO ${Number(item.odoReading).toLocaleString(_localeFor(_appCurrency), { minimumFractionDigits: 0, maximumFractionDigits: 1 })} km` : ''}
            {item.tripA ? ` · A ${Number(item.tripA).toFixed(1)} km` : ''}
            {item.tripB ? ` · B ${Number(item.tripB).toFixed(1)} km` : ''}
            {(() => {
              const trip = item.tripSelected === 'B' ? item.tripB
                         : item.tripSelected === 'A' ? item.tripA
                         : (item.tripA || item.tripB)
              if (!trip || !item.fuelQuantity) return ''
              return ` · ${(Number(trip) / Number(item.fuelQuantity)).toFixed(2)} km/L`
            })()}
          </div>
        )}
        {item.subcategory === 'Vehicle Maintenance' && item.vehicleCurrentKm && (
          <div className="item-notes">
            🔧 {Number(item.vehicleCurrentKm).toLocaleString(_localeFor(_appCurrency))} km at service
            {item.vehicleNextServiceKm ? ` · Next at ${Number(item.vehicleNextServiceKm).toLocaleString(_localeFor(_appCurrency))} km` : ''}
            {item.nextDueDate ? ` · Due ${fmtDate(item.nextDueDate)}` : ''}
          </div>
        )}
      </div>
      <div className="item-right">
        <div className="item-amount">
          {item._pending && <span className="item-pending" title="Pending sync">⏳</span>}
          {fmtINR(toINR(item))}
        </div>
        {item.currency !== 'INR' && <div className="item-foreign">{CM[item.currency]?.symbol || item.currency}{item.amount}</div>}
        {!bulkMode && (
          <div className="item-actions">
            <button className="item-btn" onClick={() => onEdit(item)} aria-label="Edit expense">✏️</button>
            <button className="item-btn item-btn-del" onClick={() => onDelete(item.id)} aria-label="Delete expense">🗑️</button>
          </div>
        )}
      </div>
    </div>
    </div>
  )
})

const IncItem = memo(function IncItem({ item, onDelete, onEdit }) {
  return (
    <div className="item" style={{ background: 'color-mix(in srgb, var(--color-inc) 5%, var(--surface))' }}>
      <div className="item-icon" style={{ background: 'color-mix(in srgb, var(--color-inc) 16%, transparent)' }}>
        <IncomePhIcon size={17} weight="duotone" color="var(--color-inc)" />
      </div>
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
          <button className="item-btn" onClick={() => onEdit(item)} aria-label="Edit income">✏️</button>
          <button className="item-btn item-btn-del" onClick={() => onDelete(item.id)} aria-label="Delete income">🗑️</button>
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

// ─── Command Palette ──────────────────────────────────────

function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery]     = useState('')
  const [activeIdx, setActive] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.keywords || []).some(k => k.includes(q))
    )
  }, [query, commands])

  useEffect(() => { setActive(0) }, [filtered])

  const run = (cmd) => { cmd.action(); onClose() }

  useEffect(() => {
    if (!open) return
    const h = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, filtered.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIdx]) run(filtered[activeIdx]) }
      else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, filtered, activeIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const groups = {}
  filtered.forEach(c => { if (!groups[c.group]) groups[c.group] = []; groups[c.group].push(c) })

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="cmd-modal" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="cmd-search-wrap">
          <span className="cmd-search-icon"><Search size={15} /></span>
          <input ref={inputRef} className="cmd-search" autoComplete="off" spellCheck={false}
            placeholder="Jump to tab, search actions…"
            value={query} onChange={e => setQuery(e.target.value)} />
          <kbd className="cmd-kbd-hint">esc</kbd>
        </div>
        <div className="cmd-list">
          {filtered.length === 0 && (
            <div className="cmd-empty">No results for "{query}"</div>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="cmd-group">
              <div className="cmd-group-label">{group}</div>
              {items.map(cmd => {
                const gi = filtered.indexOf(cmd)
                return (
                  <button key={cmd.id}
                    className={'cmd-item' + (gi === activeIdx ? ' active' : '')}
                    onMouseEnter={() => setActive(gi)}
                    onClick={() => run(cmd)}>
                    <span className="cmd-item-icon">{cmd.icon}</span>
                    <span className="cmd-item-label">{cmd.label}</span>
                    {cmd.hint && <span className="cmd-item-hint">{cmd.hint}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="cmd-footer">
          <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Tracker ─────────────────────────────────────────

export default function Tracker({ session }) {
  const userId = session.user.id
  const {
    expenses, income, budgets, goals, contributions, trips,
    loading, error,
    pendingCount, syncing, online, realtimeStatus,
    conflicts, resolveConflict, dismissConflict,
    addExpense, editExpense, deleteExpense, deleteManyExpenses,
    addIncome,  editIncome,  deleteIncome,
    saveBudgets,
    addGoal, deleteGoal, addContribution, deleteContribution,
    addTrip, editTrip, deleteTrip,
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

  const { monthlyExp: viewMonthlyExp, monthlyInc: viewMonthlyInc, yearlyExp: viewYearlyExp } = useInsightViews(userId, expenses.length + income.length)

  // ── UI state ─────────────────────────────────────────
  const [tab, setTab]                     = useState(() => {
    const p = new URLSearchParams(window.location.search).get('tab')
    const remap = { trends: 'analytics', insights: 'analytics', budgets: 'planning', goals: 'planning' }
    const valid = ['overview','income','analytics','planning','recurring','trips','exchange','settings']
    return valid.includes(p) ? p : remap[p] || 'overview'
  })
  const [analyticsTab, setAnalyticsTab]   = useState(() => {
    const p = new URLSearchParams(window.location.search).get('tab')
    return p === 'trends' ? 'trends' : p === 'merchants' ? 'merchants' : p === 'forecast' ? 'forecast' : 'insights'
  })
  const [selectedMerchant, setSelectedMerchant] = useState(null)
  const [planningTab, setPlanningTab]     = useState(() => {
    const p = new URLSearchParams(window.location.search).get('ptab')
    return p === 'goals' ? 'goals' : 'budgets'
  })
  const [budgetDraft, setBudgetDraft]     = useState(null)
  const [focusedBudget, setFocusedBudget] = useState(null)
  const [dark, setDark]                   = useState(() => { const s = localStorage.getItem('et_v6_dark'); return s !== null ? s === '1' : window.matchMedia('(prefers-color-scheme: dark)').matches })
  const [themeMode, setThemeMode]         = useState(() => { const s = localStorage.getItem('et_v6_dark'); return s === null ? 'system' : s === '1' ? 'dark' : 'light' })
  const darkRef                           = useRef(null)
  const [colorblind, setColorblind]       = useState(() => localStorage.getItem('et_v6_cb') === '1')
  const [incognito, setIncognito]         = useState(() => localStorage.getItem('et_v6_incognito') === '1')
  // Shadow module-level fmtINR — all JSX in this component uses this version
  // eslint-disable-next-line no-shadow
  const fmtINR = n => incognito ? '••••••' : _fmtINR(n)
  const [showEF, setShowEF]               = useState(false)
  const [showIF, setShowIF]               = useState(false)
  const [showMore, setShowMore]           = useState(false)
  const [closingSheet, setClosingSheet]   = useState(false)
  const [showCmd,  setShowCmd]            = useState(false)
  const [editExpTarget, setEditExpTarget] = useState(null)
  const [editIncTarget, setEditIncTarget] = useState(null)
  const [delTarget, setDelTarget]         = useState(null)
  const [bulkMode, setBulkMode]           = useState(false)
  const [selectedIds, setSelectedIds]     = useState({})
  const [bulkEditField, setBulkEditField] = useState(null)
  const [bulkEditValue, setBulkEditValue] = useState('')
  const [showGoalForm, setShowGoalForm]         = useState(false)
  const [contribGoal, setContribGoal]           = useState(null)
  const [upcomingRecurring, setUpcomingRecurring] = useState([])

  // ── Export / Import / Danger zone ─────────────────────
  const [confirmAction, setConfirmAction] = useState(null)
  const [importReport,  setImportReport]  = useState(null)
  const [importing,     setImporting]     = useState(false)
  const [v5Report,      setV5Report]      = useState(null)
  const [v5Importing,   setV5Importing]   = useState(false)
  const [anomalyHistory, setAnomalyHistory] = useState([])
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const checkedAnomalyIds = useRef(new Set(
    JSON.parse(localStorage.getItem('et_v6_anomaly_checked') || '[]')
  ))

  // ── Safe-to-Spend ─────────────────────────────────────
  const [savingsGoal, setSavingsGoal] = useState(() => parseFloat(localStorage.getItem('et_v6_sts_goal') || '0') || 0)
  useEffect(() => { try { localStorage.setItem('et_v6_sts_goal', String(savingsGoal)) } catch {} }, [savingsGoal])

  const handleExportPDF = async (ms = monthStr) => {
    await generateMonthlyPDF({
      monthStr: ms,
      expenses,
      income,
      baseCurrency,
      toBase: toINR,
      CATS,
      userName:  session.user.user_metadata?.display_name || '',
      userEmail: session.user.email,
    })
  }

  const handleEmailPDF = async (ms = monthStr) => {
    const b64 = await generateMonthlyPDF({
      monthStr: ms, expenses, income, baseCurrency,
      toBase: toINR, CATS,
      userName:  session.user.user_metadata?.display_name || '',
      userEmail: session.user.email,
      returnBase64: true,
    })
    const [y, m] = ms.split('-')
    const monthLabel = new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    try {
      const { data: { session: sess } } = await supabase.auth.getSession()
      if (!sess?.access_token) { addToast({ title: 'Not signed in', type: 'danger' }); return }
      await fetch('/api/email-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sess.access_token}` },
        body: JSON.stringify({
          type: 'pdf',
          subject: `Expense Report — ${monthLabel}`,
          attachment: b64,
          filename: `expense-report-${ms}.pdf`,
          mimeType: 'application/pdf',
        }),
      })
      addToast({ title: 'Report sent!', message: `Delivered to ${session.user.email}`, type: 'success' })
    } catch (_) {
      addToast({ title: 'Email failed', message: 'Could not send the report. Try again.', type: 'danger' })
    }
  }

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
    const headers = ['Date','Description','Amount','Currency','INR Amount','Category','Subcategory','Expense Type','Payment Method','Tags','Notes','Category Allocations','Is Recurring','Recurring Period']
    const rows = expenses.map(e => [
      e.date,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.amount, e.currency,
      (e.amountINR || e.amount).toFixed(2),
      e.category, e.subcategory || '', e.expenseType || '',
      e.paymentMethod || '',
      `"${(e.tags || []).join(';')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      e.categoryAllocations ? `"${JSON.stringify(e.categoryAllocations).replace(/"/g, '""')}"` : '',
      e.isRecurring ? 'Yes' : 'No',
      e.recurringPeriod || '',
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

      // Validate date formats — reject records with invalid dates to prevent downstream crashes
      const dateRe = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
      const invalidDates = [...transformed, ...transformedInc].filter(r => r.date && !dateRe.test(r.date))
      if (invalidDates.length > 0) {
        setV5Report({ error: true, details: `❌ ${invalidDates.length} record(s) have invalid date formats (expected YYYY-MM-DD). Fix and re-import.` })
        setTimeout(() => setV5Report(null), 8000)
        setV5Importing(false)
        return
      }

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
      setDark(false); setThemeMode('light'); localStorage.setItem('et_v6_dark', '0')
      setColorblind(false)
      setBaseCurrency('INR')
      _firedToasts.current.clear()
    }
    setConfirmAction(null)
    setTab('overview')
  }

  // ── Exchange rates ────────────────────────────────────
  const [baseCurrency, setBaseCurrency] = useState(() => {
    const stored = localStorage.getItem('et_v6_base') || 'INR'
    // Validate against known list to prevent XSS via tampered localStorage
    const valid = CURRENCIES.some(c => c.code === stored) ? stored : 'INR'
    _appCurrency = valid  // sync module-level on init
    return valid
  })
  const [rateData,     setRateData]     = useState(null)
  const [rateFetching, setRateFetching] = useState(false)
  const [fxConvAmount, setFxConvAmount] = useState('100')
  const [fxConvFrom,   setFxConvFrom]   = useState('USD')
  const [fxSearch,     setFxSearch]     = useState('')
  const [cryptoRates,  setCryptoRates]  = useState({}) // { btcInr, ethInr }

  useEffect(() => {
    const KEY = 'et_v6_crypto', TTL = 10 * 60 * 1000
    const cached = (() => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } })()
    if (cached && (Date.now() - cached.ts) < TTL) { setCryptoRates(cached); return }
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 10000)
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=inr', { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => {
        const d = { btcInr: j.bitcoin?.inr || 0, ethInr: j.ethereum?.inr || 0, ts: Date.now() }
        try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
        setCryptoRates(d)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { localStorage.setItem('et_v6_base', baseCurrency); _appCurrency = baseCurrency }, [baseCurrency])
  // Clear budget draft when leaving the budgets sub-tab so inputs re-sync from Supabase on return
  useEffect(() => {
    if (!(tab === 'planning' && planningTab === 'budgets')) setBudgetDraft(null)
  }, [tab, planningTab])
  useEffect(() => {
    const RATE_KEY = 'et_v6_rates2', TTL = 6 * 3600 * 1000
    const load = () => { try { return JSON.parse(localStorage.getItem(RATE_KEY)) } catch { return null } }
    const save = d  => { try { localStorage.setItem(RATE_KEY, JSON.stringify(d)) } catch {} }
    const cached = load(), fresh = cached && (Date.now() - cached.ts) < TTL
    if (fresh) { setRateData(cached); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => {
        // Normalise to "INR per 1 unit of foreign currency" for consistent use everywhere
        const rates = {}
        if (baseCurrency === 'INR') {
          // API returns "1 INR = X foreign" → invert to "INR per 1 foreign"
          Object.keys(j.rates).forEach(k => { rates[k] = j.rates[k] ? 1 / j.rates[k] : 0 })
        } else {
          // API returns "1 base = X foreign"; j.rates['INR'] is base→INR
          // "INR per 1 foreign" = j.rates['INR'] / j.rates[k]
          Object.keys(j.rates).forEach(k => { rates[k] = j.rates['INR'] && j.rates[k] ? j.rates['INR'] / j.rates[k] : 0 })
        }
        const d = { rates, ts: Date.now(), source: 'live' }
        save(d); setRateData(d)
      })
      .catch(() => {
        clearTimeout(t)
        if (cached) {
          setRateData({ ...cached, source: 'cached' })
          addToast('warn', '💱', 'Exchange Rates', 'Using cached rates — API unavailable')
        } else {
          // FALLBACK_RATES is "1 INR = X foreign" → invert to "INR per 1 foreign"
          const rates = {}
          Object.keys(FALLBACK_RATES).forEach(k => { rates[k] = k === 'INR' ? 1 : (FALLBACK_RATES[k] ? 1 / FALLBACK_RATES[k] : 0) })
          const d = { rates, ts: Date.now(), source: 'fallback' }
          setRateData(d)
          addToast('warn', '💱', 'Exchange Rates', 'Using built-in fallback rates — API unavailable')
        }
      })
      .finally(() => clearTimeout(t))
  }, [baseCurrency]) // addToast omitted — useCallback([]); stable ref, not in TDZ-safe position

  const refreshRates = async () => {
    setRateFetching(true)
    try {
      const r = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`)
      const j = await r.json()
      const rates = {}
      if (baseCurrency === 'INR') {
        Object.keys(j.rates).forEach(k => { rates[k] = j.rates[k] ? 1 / j.rates[k] : 0 })
      } else {
        Object.keys(j.rates).forEach(k => { rates[k] = j.rates['INR'] && j.rates[k] ? j.rates['INR'] / j.rates[k] : 0 })
      }
      const d = { rates, ts: Date.now(), source: 'live' }
      try { localStorage.setItem('et_v6_rates2', JSON.stringify(d)) } catch {}
      setRateData(d)
    } catch {
      const RATE_KEY = 'et_v6_rates2'
      const cached = (() => { try { return JSON.parse(localStorage.getItem(RATE_KEY)) } catch { return null } })()
      if (cached) {
        setRateData({ ...cached, source: 'cached' })
        addToast('warn', '💱', 'Exchange Rates', 'Using cached rates — API unavailable')
      } else {
        const rates = {}
        Object.keys(FALLBACK_RATES).forEach(k => { rates[k] = k === 'INR' ? 1 : (FALLBACK_RATES[k] ? 1 / FALLBACK_RATES[k] : 0) })
        const d = { rates, ts: Date.now(), source: 'fallback' }
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
  // ── Surface storage errors as toasts ─────────────────────
  useEffect(() => {
    if (error) addToast('danger', '❌', 'Save failed', error, 10000)
  }, [error]) // addToast intentionally omitted — stable ref

  // ── Anomaly detection — after addToast is defined ────────
  useEffect(() => {
    if (expenses.length < 2) return
    expenses.forEach(newExp => {
      if (checkedAnomalyIds.current.has(newExp.id)) return
      checkedAnomalyIds.current.add(newExp.id)
      try { localStorage.setItem('et_v6_anomaly_checked', JSON.stringify([...checkedAnomalyIds.current].slice(-500))) } catch {}
      const anomaly = detectAnomaly(newExp, expenses.filter(e => e.id !== newExp.id))
      if (anomaly) {
        setAnomalyHistory(prev => [{ ...anomaly, id: newExp.id }, ...prev].slice(0, 20))
        const desc = anomaly.description?.length > 40 ? anomaly.description.slice(0, 40) + '…' : anomaly.description
        addToast('warn', '⚠️', `${anomaly.category} unusually high`,
          `${desc ? desc + ' — ' : ''}${fmtINR(anomaly.thisAmount)} vs avg ${fmtINR(anomaly.avgAmount)} (${anomaly.deviationPct}% above average)`, 8000)
      }
    })
  }, [expenses]) // addToast/fmtINR intentionally omitted — both are stable refs

  const dismissToast = useCallback(id => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 220)
  }, [])

  // ── Theme effects ─────────────────────────────────────
  useEffect(() => { darkRef.current = dark }, [dark])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  const setTheme = useCallback((mode) => {
    setThemeMode(mode)
    if (mode === 'system') {
      localStorage.removeItem('et_v6_dark')
      setDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    } else {
      const isDark = mode === 'dark'
      localStorage.setItem('et_v6_dark', isDark ? '1' : '0')
      setDark(isDark)
    }
  }, [])
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [themeMode])
  useEffect(() => {
    document.documentElement.classList.toggle('colorblind', colorblind)
    localStorage.setItem('et_v6_cb', colorblind ? '1' : '0')
  }, [colorblind])
  useEffect(() => {
    document.documentElement.classList.toggle('incognito', incognito)
    localStorage.setItem('et_v6_incognito', incognito ? '1' : '0')
  }, [incognito])

  // ── Income icon (derived from baseCurrency) ──────────
  const _curSym2 = (CM[baseCurrency] || CM['INR']).symbol
  const IncomeIcon = CURRENCY_ICON_MAP[baseCurrency] ||
    // eslint-disable-next-line react/display-name
    (({ size, style }) => <span style={{ fontSize: (size||13)*0.9, fontWeight: 700, lineHeight: 1, ...style }}>{_curSym2}</span>)

  // ── Command palette commands ──────────────────────────
  const cmdCommands = useMemo(() => [
    { id: 'nav-overview',   group: 'Go to',   icon: <LayoutDashboard size={15} />, label: 'Overview',              keywords: ['home','dashboard','bento','spend'],       action: () => setTab('overview') },
    { id: 'nav-income',     group: 'Go to',   icon: <IncomeIcon size={15} />,      label: 'Income',                keywords: ['salary','earnings','revenue'],            action: () => setTab('income') },
    { id: 'nav-insights',   group: 'Go to',   icon: <Lightbulb size={15} />,       label: 'Analytics — Insights',  keywords: ['analytics','charts','stats','anomaly'],   action: () => { setTab('analytics'); setAnalyticsTab('insights') } },
    { id: 'nav-trends',     group: 'Go to',   icon: <TrendingUp size={15} />,      label: 'Analytics — Trends',    keywords: ['analytics','monthly','comparison','mom'],  action: () => { setTab('analytics'); setAnalyticsTab('trends') } },
    { id: 'nav-merchants',  group: 'Go to',   icon: <Store size={15} />,           label: 'Analytics — Merchants', keywords: ['merchants','top spend','vendor','shop','order'], action: () => { setTab('analytics'); setAnalyticsTab('merchants'); setSelectedMerchant(null) } },
    { id: 'nav-forecast',   group: 'Go to',   icon: <Calendar size={15} />,        label: 'Analytics — Forecast',  keywords: ['forecast','cashflow','cash flow','projection','runway','30 day','60 day','90 day'], action: () => { setTab('analytics'); setAnalyticsTab('forecast') } },
    { id: 'nav-budgets',    group: 'Go to',   icon: <Wallet size={15} />,          label: 'Planning — Budgets',    keywords: ['planning','budget','limit','category'],   action: () => { setTab('planning'); setPlanningTab('budgets') } },
    { id: 'nav-goals',      group: 'Go to',   icon: <Target size={15} />,          label: 'Planning — Goals',      keywords: ['planning','savings','targets','milestone'],action: () => { setTab('planning'); setPlanningTab('goals') } },
    { id: 'nav-recurring',  group: 'Go to',   icon: <RefreshCw size={15} />,       label: 'Recurring',             keywords: ['subscriptions','repeat','monthly','emi'],  action: () => setTab('recurring') },
    { id: 'nav-trips',      group: 'Go to',   icon: <Plane size={15} />,           label: 'Trips',                 keywords: ['travel','journey','vacation'],            action: () => setTab('trips') },
    { id: 'nav-exchange',   group: 'Go to',   icon: <ArrowLeftRight size={15} />,  label: 'Exchange (FX)',         keywords: ['currency','rates','forex','usd','btc'],   action: () => setTab('exchange') },
    { id: 'nav-settings',   group: 'Go to',   icon: <Settings size={15} />,        label: 'Settings',              keywords: ['preferences','account','export','import'],action: () => setTab('settings') },
    { id: 'act-add-exp',    group: 'Actions', icon: <PlusCircle size={15} />,      label: 'Add Expense',           keywords: ['new','spend','record','create'],          action: () => setShowEF(true), hint: 'N' },
    { id: 'act-add-inc',    group: 'Actions', icon: <PlusCircle size={15} />,      label: 'Add Income',            keywords: ['new','salary','earn','create'],           action: () => setShowIF(true), hint: 'I' },
    { id: 'act-theme',      group: 'Actions', icon: dark ? <Sun size={15} /> : <Moon size={15} />, label: dark ? 'Switch to Light Mode' : 'Switch to Dark Mode', keywords: ['theme','appearance','dark','light'], action: () => setTheme(dark ? 'light' : 'dark'), hint: 'D' },
    { id: 'act-incognito',  group: 'Actions', icon: incognito ? <Eye size={15} /> : <EyeOff size={15} />, label: incognito ? 'Show Amounts' : 'Hide Amounts', keywords: ['privacy','blur','incognito','hide'], action: () => setIncognito(m => !m), hint: 'H' },
  ], [dark, incognito, IncomeIcon]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const [activePreset, setActivePreset] = useState('')
  const dExpSearch = useDebounce(expSearch)
  const nlQuery    = useMemo(
    () => parseNLQuery(dExpSearch, { catNames: Object.keys(CATS), payMethods: PAY_METHODS }),
    [dExpSearch]
  )

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

  // ── Trip form state ───────────────────────────────────
  const [showTripForm,    setShowTripForm]    = useState(false)
  const [tripFormName,    setTripFormName]    = useState('')
  const [tripFormStart,   setTripFormStart]   = useState('')
  const [tripFormEnd,     setTripFormEnd]     = useState('')
  const [tripFormCur,     setTripFormCur]     = useState('USD')
  const [tripFormNotes,   setTripFormNotes]   = useState('')
  const [editingTrip,     setEditingTrip]     = useState(null)
  const [expandedTripId,  setExpandedTripId]  = useState(null)

  // ── Storage quota warning ────────────────────────────
  useEffect(() => {
    const h = () => addToast('warn', '⚠️', 'Storage almost full',
      'Offline sync queue could not be saved. Clear browser storage or export data to avoid losing offline changes.')
    window.addEventListener('et-storage-quota-exceeded', h)
    return () => window.removeEventListener('et-storage-quota-exceeded', h)
  }, [])

  // ── Bottom sheet exit animation ──────────────────────
  function closeSheet() {
    setClosingSheet(true)
    setTimeout(() => { setShowMore(false); setClosingSheet(false) }, 180)
  }

  // ── Keyboard shortcuts ───────────────────────────────
  useEffect(() => {
    const TABS = ['overview', 'income', 'analytics', 'planning', 'recurring', 'trips', 'exchange', 'settings']
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowCmd(m => !m); return }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      const n = parseInt(e.key); if (n >= 1 && n <= TABS.length) setTab(TABS[n - 1])
      if (e.key === 'n' || e.key === 'N') setShowEF(true)
      if (e.key === 'i' || e.key === 'I') setShowIF(true)
      if (e.key === 'h' || e.key === 'H') setIncognito(m => !m)
      if (e.key === 'd' || e.key === 'D') {
        const next = !darkRef.current
        setDark(next); setThemeMode(next ? 'dark' : 'light')
        localStorage.setItem('et_v6_dark', next ? '1' : '0')
      }
      if (e.key === 'Escape') {
        setShowEF(false); setShowIF(false); setDelTarget(null)
        setEditExpTarget(null); setEditIncTarget(null)
        setBulkMode(false); setSelectedIds({})
        setShowGoalForm(false); setContribGoal(null)
        closeSheet(); setShowCmd(false)
        setShowMonthPicker(false)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (!showMonthPicker) return
    const h = (e) => { if (!e.target.closest('.month-strip')) setShowMonthPicker(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMonthPicker])

  // ── Filtered lists ───────────────────────────────────
  const filteredExp = useMemo(() => {
    // Merge NL-parsed filters with explicit filter UI (UI wins when both set)
    const effCats     = [...new Set([...expCategories, ...nlQuery.categories])]
    const effPay      = expPayment !== 'All' ? expPayment : (nlQuery.payment || 'All')
    const effDateFrom = expDateFrom || nlQuery.dateFrom
    const effDateTo   = expDateTo   || nlQuery.dateTo
    const effAmtMin   = expAmtMin !== '' ? expAmtMin : nlQuery.amtMin
    const effAmtMax   = expAmtMax !== '' ? expAmtMax : nlQuery.amtMax

    return expenses.filter(e => {
      if (!matchesSearch(e, nlQuery.text)) return false
      if (effCats.length && !effCats.includes(e.category)) return false
      if (effPay  !== 'All' && (e.paymentMethod || 'Cash') !== effPay)  return false
      if (expCurrency !== 'All' && (e.currency   || 'INR') !== expCurrency) return false
      if (expMonth && !(e.date || '').startsWith(expMonth)) return false
      if (effDateFrom && (e.date || '') < effDateFrom) return false
      if (effDateTo   && (e.date || '') > effDateTo)   return false
      const amt = toINR(e)
      if (effAmtMin !== '' && amt < parseFloat(effAmtMin)) return false
      if (effAmtMax !== '' && amt > parseFloat(effAmtMax)) return false
      return true
    })
  }, [expenses, nlQuery, expCategories, expPayment, expCurrency, expMonth, expDateFrom, expDateTo, expAmtMin, expAmtMax])

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

  // ── Month comparison table data — from SQL views ──────
  const allMonthlyExp = viewMonthlyExp.map(r => ({ label: r.month.substring(5), fullLabel: r.month, value: parseFloat(r.total) }))
  const allMonthlyInc = Object.fromEntries(viewMonthlyInc.map(r => [r.month, parseFloat(r.total)]))

  const todayStr   = new Date().toISOString().split('T')[0]
  const [monthStr, setMonthStr] = useState(() => todayStr.substring(0, 7))
  const weekStart  = (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0] })()

  const spentToday = useMemo(() => expenses.filter(e => e.date === todayStr).reduce((s, e) => s + toINR(e), 0), [expenses, todayStr])
  const spentWeek  = useMemo(() => expenses.filter(e => e.date >= weekStart && e.date <= todayStr).reduce((s, e) => s + toINR(e), 0), [expenses, weekStart, todayStr])
  const spentMonth = useMemo(() => expenses.filter(e => (e.date || '').startsWith(monthStr)).reduce((s, e) => s + toINR(e), 0), [expenses, monthStr])

  const spentByCatMonth = useMemo(() => {
    const c = {}
    expenses.filter(e => (e.date || '').startsWith(monthStr)).forEach(e => { c[e.category] = (c[e.category] || 0) + toINR(e) })
    return c
  }, [expenses, monthStr])

  const prevMonthStr = useMemo(() => {
    const [y, m] = monthStr.split('-').map(Number)
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  }, [monthStr])

  // ── Gamification data ─────────────────────────────────
  const gamificationData = useMemo(() => {
    const dayOfMonth = parseInt(todayStr.split('-')[2], 10)
    const spendByDay = {}
    expenses.forEach(e => { if (e.date) spendByDay[e.date] = (spendByDay[e.date] || 0) + toINR(e) })

    // No-spend days this month: days 1..today with zero expenses
    let noSpendThisMonth = 0
    for (let i = 1; i <= dayOfMonth; i++) {
      if (!(monthStr + '-' + String(i).padStart(2, '0') in spendByDay)) noSpendThisMonth++
    }

    // Consecutive no-spend streak going back from today
    let noSpendStreak = 0
    const nsDt = new Date(todayStr + 'T12:00:00')
    for (let i = 0; i < 365; i++) {
      if (nsDt.toISOString().split('T')[0] in spendByDay) break
      noSpendStreak++
      nsDt.setDate(nsDt.getDate() - 1)
    }

    // Under-budget streak (only when daily budget is set)
    let underBudgetStreak = 0, underBudgetBest = 0
    if (budgets.daily > 0 && expenses.length) {
      const firstDate = expenses.reduce((m, e) => (e.date && e.date < m ? e.date : m), todayStr)

      // Current streak: go back from today until a day over budget
      const ubDt = new Date(todayStr + 'T12:00:00')
      for (let i = 0; i < 730; i++) {
        const ds = ubDt.toISOString().split('T')[0]
        if (ds < firstDate) break
        if ((spendByDay[ds] || 0) > budgets.daily) break
        underBudgetStreak++
        ubDt.setDate(ubDt.getDate() - 1)
      }

      // Best streak: walk forward from firstDate to today
      const fwdDt = new Date(firstDate + 'T12:00:00')
      const endDt = new Date(todayStr + 'T12:00:00')
      let run = 0
      while (fwdDt <= endDt) {
        const ds = fwdDt.toISOString().split('T')[0]
        if ((spendByDay[ds] || 0) <= budgets.daily) {
          run++
          if (run > underBudgetBest) underBudgetBest = run
        } else { run = 0 }
        fwdDt.setDate(fwdDt.getDate() + 1)
      }
    }

    return { noSpendThisMonth, noSpendStreak, underBudgetStreak, underBudgetBest }
  }, [expenses, monthStr, todayStr, budgets.daily])

  const spentByCatPrevMonth = useMemo(() => {
    const c = {}
    expenses.filter(e => (e.date || '').startsWith(prevMonthStr)).forEach(e => { c[e.category] = (c[e.category] || 0) + toINR(e) })
    return c
  }, [expenses, prevMonthStr])

  const rolloverAmounts = useMemo(() => {
    const map = {}
    Object.keys(budgets.categories || {}).forEach(cat => {
      if (!budgets.rolloverEnabled?.[cat]) return
      const prevBgt  = budgets.categories[cat] || 0
      const prevSpent = spentByCatPrevMonth[cat] || 0
      const rollover = prevBgt > 0 ? Math.max(0, prevBgt - prevSpent) : 0
      if (rollover > 0) map[cat] = rollover
    })
    return map
  }, [budgets, spentByCatPrevMonth])

  const sparkDays = useMemo(() => {
    const today = new Date()
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push({ date: d.toISOString().split('T')[0], total: 0 })
    }
    const byDate = {}
    days.forEach(d => { byDate[d.date] = d })
    expenses.forEach(e => { if (byDate[e.date]) byDate[e.date].total += toINR(e) })
    return days
  }, [expenses])
  const [sparkHover, setSparkHover] = useState(null)

  // ── Budget toast alerts ───────────────────────────────
  useEffect(() => {
    if (loading) return
    const d = todayStr.substring(0, 10) // daily keys include date so they reset each day
    const w = weekStart                  // weekly keys include week start
    const checks = [
      { key: `daily-50-${d}`,  spent: spentToday, budget: budgets.daily,   pct: 50,  kind: 'warn',   icon: '⚡', label: 'Daily' },
      { key: `daily-80-${d}`,  spent: spentToday, budget: budgets.daily,   pct: 80,  kind: 'warn',   icon: '🔔', label: 'Daily' },
      { key: `daily-100-${d}`, spent: spentToday, budget: budgets.daily,   pct: 100, kind: 'danger', icon: '🚨', label: 'Daily' },
      { key: `week-50-${w}`,   spent: spentWeek,  budget: budgets.weekly,  pct: 50,  kind: 'warn',   icon: '⚡', label: 'Weekly' },
      { key: `week-80-${w}`,   spent: spentWeek,  budget: budgets.weekly,  pct: 80,  kind: 'warn',   icon: '🔔', label: 'Weekly' },
      { key: `week-100-${w}`,  spent: spentWeek,  budget: budgets.weekly,  pct: 100, kind: 'danger', icon: '🚨', label: 'Weekly' },
      { key: `month-50-${monthStr}`,  spent: spentMonth, budget: budgets.monthly, pct: 50,  kind: 'warn',   icon: '⚡', label: 'Monthly' },
      { key: `month-80-${monthStr}`,  spent: spentMonth, budget: budgets.monthly, pct: 80,  kind: 'warn',   icon: '🔔', label: 'Monthly' },
      { key: `month-100-${monthStr}`, spent: spentMonth, budget: budgets.monthly, pct: 100, kind: 'danger', icon: '🚨', label: 'Monthly' },
    ]
    Object.entries(budgets.categories || {}).forEach(([cat, bgt]) => {
      if (!bgt) return
      const spent = spentByCatMonth[cat] || 0
      ;[['50','warn','⚡'], ['80','warn','🔔'], ['100','danger','🚨']].forEach(([p, kind, icon]) => {
        checks.push({ key: `cat-${cat}-${p}-${monthStr}`, spent, budget: bgt, pct: parseInt(p), kind, icon, label: cat })
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

  // ── Gamification milestone toasts ────────────────────
  useEffect(() => {
    if (loading) return
    const { noSpendThisMonth, underBudgetStreak } = gamificationData
    const NS_MILESTONES = [5, 10, 15, 20, 25]
    const UB_MILESTONES = [3, 7, 14, 30]
    NS_MILESTONES.forEach(m => {
      if (noSpendThisMonth === m) {
        const key = `gamif-nospend-${monthStr}-${m}`
        if (!_firedToasts.current.has(key)) {
          _firedToasts.current.add(key)
          addToast('success', '💤', `${m} No-Spend Days This Month!`, `You've had ${m} days with zero spending in ${monthStr}.`, 7000)
        }
      }
    })
    UB_MILESTONES.forEach(m => {
      if (underBudgetStreak === m) {
        const key = `gamif-streak-${todayStr}-${m}`
        if (!_firedToasts.current.has(key)) {
          _firedToasts.current.add(key)
          addToast('success', '🔥', `${m}-Day Under-Budget Streak!`, `${m} consecutive days within your daily budget. Keep it up!`, 8000)
        }
      }
    })
  }, [gamificationData, monthStr, todayStr, loading])

  // ── Service reminders (from receipt scanner) ─────────
  useEffect(() => {
    if (loading) return
    try {
      const reminders = JSON.parse(localStorage.getItem('et_svc_reminders') || '[]')
      const today = new Date(todayStr + 'T12:00:00')
      reminders.forEach(r => {
        if (!r.date) return
        const due = new Date(r.date + 'T12:00:00')
        const daysUntil = Math.ceil((due - today) / 864e5)
        if (daysUntil < 0 || daysUntil > 30) return
        const key = `svc-remind-${r.key}-${r.date}`
        if (_firedToasts.current.has(key)) return
        _firedToasts.current.add(key)
        const urgency = daysUntil === 0 ? 'due today' : daysUntil === 1 ? 'due tomorrow' : `due in ${daysUntil} days`
        addToast(daysUntil <= 3 ? 'warn' : 'info', '🔧',
          `Service reminder: ${r.label}`,
          `${urgency}${r.reg ? ` · ${r.reg}` : ''}`,
          daysUntil <= 3 ? 10000 : 7000)
      })
    } catch (_) {}
  }, [loading, todayStr])

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

  const monthlyExpData = viewMonthlyExp.slice(-12).map(r => ({ label: r.month.substring(5), fullLabel: r.month, value: parseFloat(r.total) }))
  const monthlyIncData = viewMonthlyInc.slice(-12).map(r => ({ label: r.month.substring(5), fullLabel: r.month, value: parseFloat(r.total) }))
  const yearlyData     = viewYearlyExp.map(r => ({ label: r.year, value: parseFloat(r.total) }))

  // Grouped bar data — last 6 months exp + inc merged
  const groupedMonthlyData = useMemo(() => {
    const incMap = Object.fromEntries(viewMonthlyInc.map(r => [r.month, parseFloat(r.total)]))
    return viewMonthlyExp.slice(-6).map(r => ({
      label: r.month.substring(5),
      fullLabel: r.month,
      exp: parseFloat(r.total),
      inc: incMap[r.month] || 0,
    }))
  }, [viewMonthlyExp, viewMonthlyInc])

  // Category trends — top 5 categories × last 6 months
  const catTrend6 = useMemo(() => {
    // All months from Jan 2026 to current month
    const months = []
    const now = new Date(todayStr + 'T12:00:00')
    let y = 2026, m = 1
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
      m++; if (m > 12) { m = 1; y++ }
    }
    const totals = {}
    expenses.forEach(e => { const c = e.category || 'Other'; totals[c] = (totals[c] || 0) + toINR(e) })
    const top5 = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)
    return top5.map(cat => {
      const vals = months.map(mo => expenses.filter(e => (e.date || '').startsWith(mo) && e.category === cat).reduce((s, e) => s + toINR(e), 0))
      const maxV = Math.max(...vals, 1)
      return { cat, icon: CATS[cat]?.icon || '📦', color: CATS[cat]?.color || 'var(--color-brand)', vals, months, maxV }
    })
  }, [expenses, todayStr])

  // Merchant analytics — top 20 by total spend, with monthly breakdown + category
  const merchantData = useMemo(() => {
    const map = {}
    expenses.forEach(e => {
      const key = (e.description || '').trim()
      if (!key) return
      if (!map[key]) map[key] = { name: key, total: 0, count: 0, first: '', last: '', months: {}, cats: {} }
      const amtINR = toINR(e)
      map[key].total += amtINR
      map[key].count++
      if (!map[key].last || e.date > map[key].last) map[key].last = e.date
      if (!map[key].first || e.date < map[key].first) map[key].first = e.date
      const mo = (e.date || '').substring(0, 7)
      if (mo) map[key].months[mo] = (map[key].months[mo] || 0) + amtINR
      if (e.category) map[key].cats[e.category] = (map[key].cats[e.category] || 0) + 1
    })
    return Object.values(map)
      .map(m => ({
        ...m,
        avg: m.total / m.count,
        topCat: Object.entries(m.cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
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

  // ── Burn-Rate Forecasting ─────────────────────────────
  const burnRate = useMemo(() => {
    const empty = { last7Total: 0, prev7Total: 0, last7Rate: 0, prev7Rate: 0, acceleration: null, runwayDays: null, runwayDate: null, willExceedBudget: false, topCatRates: [], spentSoFar: 0, dailyRate: 0, projected: 0 }
    if (!expenses.length) return empty
    const today = new Date(todayStr + 'T12:00:00')
    const y = today.getFullYear(), mo = today.getMonth()
    const daysInMonth = new Date(y, mo + 1, 0).getDate()
    const dayOfMonth  = Math.max(today.getDate(), 1) // guard against edge case
    const d7  = new Date(today); d7.setDate(d7.getDate() - 7);  const d7str  = d7.toISOString().split('T')[0]
    const d14 = new Date(today); d14.setDate(d14.getDate() - 14); const d14str = d14.toISOString().split('T')[0]
    const last7Total = expenses.filter(e => e.date > d7str  && e.date <= todayStr).reduce((s, e) => s + toINR(e), 0)
    const prev7Total = expenses.filter(e => e.date > d14str && e.date <= d7str).reduce((s, e) => s + toINR(e), 0)
    const last7Rate  = last7Total / 7
    const prev7Rate  = prev7Total / 7
    const acceleration = prev7Total > 0 ? ((last7Rate - prev7Rate) / prev7Rate * 100) : null
    const spentSoFar   = expenses.filter(e => (e.date || '').startsWith(monthStr)).reduce((s, e) => s + toINR(e), 0)
    const dailyRate    = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0
    const projected    = dailyRate * daysInMonth
    let runwayDays = null, runwayDate = null, willExceedBudget = false
    if (budgets.monthly > 0 && dailyRate > 0) {
      willExceedBudget = projected > budgets.monthly
      const remaining = budgets.monthly - spentSoFar
      if (remaining <= 0) {
        runwayDays = 0; runwayDate = todayStr
      } else {
        runwayDays = Math.floor(remaining / dailyRate)
        const rd = new Date(today); rd.setDate(rd.getDate() + runwayDays)
        runwayDate = rd.toISOString().split('T')[0]
      }
    }
    const catTotals = {}
    expenses.filter(e => (e.date || '').startsWith(monthStr)).forEach(e => { const c = e.category || 'Other'; catTotals[c] = (catTotals[c] || 0) + toINR(e) })
    const topCatRates = Object.entries(catTotals).map(([cat, total]) => ({ cat, total, rate: dayOfMonth > 0 ? total / dayOfMonth : 0 })).sort((a, b) => b.total - a.total).slice(0, 3)
    return { last7Total, prev7Total, last7Rate, prev7Rate, acceleration, runwayDays, runwayDate, willExceedBudget, topCatRates, spentSoFar, dailyRate, projected }
  }, [expenses, todayStr, monthStr, budgets])

  // ── Trips computed ───────────────────────────────────
  const tripsWithData = useMemo(() => {
    return trips.map(trip => {
      const matched = expenses.filter(e => e.date >= trip.startDate && e.date <= trip.endDate && (e.currency || 'INR') === (trip.currency || 'INR'))
      const totalOriginal = matched.reduce((s, e) => s + e.amount, 0)
      const totalINR      = matched.reduce((s, e) => s + toINR(e), 0)
      const catTotals = {}
      matched.forEach(e => { const c = e.category || 'Other'; catTotals[c] = (catTotals[c] || 0) + e.amount })
      const topCats = Object.entries(catTotals)
        .map(([cat, amt]) => ({ cat, amt, pct: totalOriginal > 0 ? Math.round(amt / totalOriginal * 100) : 0 }))
        .sort((a, b) => b.amt - a.amt).slice(0, 3)
      const status = todayStr < trip.startDate ? 'upcoming' : todayStr > trip.endDate ? 'completed' : 'active'
      return { ...trip, matched, totalOriginal, totalINR, topCats, status }
    }).sort((a, b) => b.startDate.localeCompare(a.startDate))
  }, [trips, expenses, todayStr])

  const submitTripForm = async () => {
    if (!tripFormName.trim() || !tripFormStart || !tripFormEnd || tripFormStart > tripFormEnd) return
    const trip = {
      id:        editingTrip ? editingTrip.id : (Date.now().toString(36) + Math.random().toString(36).slice(2)),
      name:      tripFormName.trim(),
      startDate: tripFormStart,
      endDate:   tripFormEnd,
      currency:  tripFormCur,
      notes:     tripFormNotes.trim(),
    }
    const overlaps = trips.filter(t => t.id !== trip.id && trip.startDate <= t.endDate && trip.endDate >= t.startDate)
    if (overlaps.length) addToast('warn', '⚠️', 'Overlapping Trip', `"${trip.name}" overlaps with "${overlaps[0].name}". Saved anyway.`)
    if (editingTrip) await editTrip(trip); else await addTrip(trip)
    setShowTripForm(false); setEditingTrip(null)
    setTripFormName(''); setTripFormStart(''); setTripFormEnd(''); setTripFormCur('USD'); setTripFormNotes('')
  }

  const openEditTrip = t => {
    setEditingTrip(t); setTripFormName(t.name); setTripFormStart(t.startDate)
    setTripFormEnd(t.endDate); setTripFormCur(t.currency); setTripFormNotes(t.notes || '')
    setShowTripForm(true)
  }

  // ── Insights ─────────────────────────────────────────
  const insights = useMemo(() => {
    const res = []
    if (!expenses.length) return res

    // 1. Top category
    if (catData.length) res.push({ title: '🏆 Top Category', text: `${catData[0].label} leads at ${fmtINR(catData[0].value)} (${(catData[0].value / allExpINR * 100).toFixed(0)}% of all spending).` })

    // 2. Savings rate
    if (allIncINR > 0) {
      const r = ((allExpINR / allIncINR) * 100).toFixed(0), sv = allIncINR - allExpINR
      res.push({ title: '📊 Savings Rate', text: `${r}% of income was spent. ${sv >= 0 ? 'Saved ' + fmtINR(sv) + '! 🎉' : 'Overspent by ' + fmtINR(Math.abs(sv)) + ' ⚠️'}` })
    }

    // 3. Peak day of week
    const dow = Array(7).fill(0)
    expenses.forEach(e => { const d = new Date(e.date + 'T12:00:00'); if (!isNaN(d)) dow[d.getDay()] += toINR(e) })
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], pk = dow.indexOf(Math.max(...dow))
    if (dow[pk] > 0) res.push({ title: '📅 Peak Spend Day', text: `Spending is highest on ${DAYS[pk]}s (${fmtINR(dow[pk])} total, ${(dow[pk] / allExpINR * 100).toFixed(0)}% of spend).` })

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
      if (mult > 2) res.push({ title: '🚨 Largest Transaction', text: `"${big.description}" on ${fmtDate(big.date)} — ${fmtINR(toINR(big))}, which is ${mult}× your average expense.` })
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
      res.push({ title: '👥 Split Expenses', text: `${splits.length} split expense${splits.length > 1 ? 's' : ''}. Total share: ${fmtINR(shareTotal)} (full amount: ${fmtINR(splits.reduce((s, e) => s + toINR(e), 0))}).` })
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
      res.push({ title: '🗓️ Weekend vs Weekday', text: `Spending is ${ratio}× higher on ${heavier}. Weekend avg: ${fmtINR(wkndAvg)}/day, weekday avg: ${fmtINR(wkdyAvg)}/day.` })
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
      if (maxStreak >= 3) res.push({ title: '🔥 Longest Spending Streak', text: `${maxStreak} consecutive days ending ${streakEnd}. Expenses were logged every single day during this streak.` })
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
      res.push({ title: '💵 Income Consistency', text: `Monthly income is ${consistency} (CV: ${cv}%). Average: ${fmtINR(avgInc)}/month across ${incVals.length} months.` })
    }

    // 17. Burn rate acceleration
    if (burnRate.acceleration !== null && burnRate.last7Total > 0 && Math.abs(burnRate.acceleration) >= 10) {
      const accel = burnRate.acceleration > 0
      const pct = Math.min(Math.abs(burnRate.acceleration), 999).toFixed(0)
      res.push({ title: accel ? '🔴 Burn Rate Accelerating' : '🟢 Burn Rate Slowing', text: `Daily spend ${accel ? 'up' : 'down'} ${pct}% this week (${fmtINR(burnRate.last7Rate)}/d) vs last week (${fmtINR(burnRate.prev7Rate)}/d).` })
    }

    // 18. Budget runway
    if (burnRate.runwayDays !== null) {
      if (burnRate.runwayDays <= 0) {
        res.push({ title: '🚨 Budget Exhausted', text: `Monthly budget of ${fmtINR(budgets.monthly)} already exceeded. Spent ${fmtINR(burnRate.spentSoFar)} this month.` })
      } else if (burnRate.willExceedBudget) {
        res.push({ title: '⚠️ Budget Runway', text: `At current pace (${fmtINR(burnRate.dailyRate)}/d), the ${fmtINR(budgets.monthly)} budget runs out in ${burnRate.runwayDays} days (${burnRate.runwayDate}).` })
      } else {
        res.push({ title: '✅ Budget on Track', text: `Projected month-end spend: ${fmtINR(burnRate.projected)}. That's ${fmtINR(budgets.monthly - burnRate.projected)} under the ${fmtINR(budgets.monthly)} monthly budget.` })
      }
    }

    return res
  }, [catData, expenses, monthlyExpData, viewMonthlyExp, viewMonthlyInc, allIncINR, allExpINR, burnRate, budgets])

  // ── Goals computed ────────────────────────────────────
  // Attach contributions to goals
  const goalsWithContribs = useMemo(() => goals.map(g => ({
    ...g,
    contributions: contributions.filter(c => c.goalId === g.id)
  })), [goals, contributions])

  // ── Financial Health Score ────────────────────────────
  const healthScore = useMemo(() => {
    // 1. Savings Rate — last 3 months avg
    const last3 = [0, 1, 2].map(i => {
      const d = new Date(todayStr + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() - i)
      return d.toISOString().substring(0, 7)
    })
    const mExp = last3.map(m => expenses.filter(e => (e.date || '').startsWith(m)).reduce((s, e) => s + toINR(e), 0))
    const mInc = last3.map(m => income.filter(i  => (i.date || '').startsWith(m)).reduce((s, i) => s + toINR(i), 0))
    const avgInc = mInc.reduce((s, v) => s + v, 0) / 3
    const avgExp = mExp.reduce((s, v) => s + v, 0) / 3
    const savingsRate = avgInc > 0 ? (avgInc - avgExp) / avgInc * 100 : null
    let savingsPts = 12
    let savingsNote = 'No income data yet'
    let savingsTip  = 'Log your income to track savings rate'
    if (savingsRate !== null) {
      if (savingsRate >= 20) { savingsPts = 25; savingsNote = `${savingsRate.toFixed(0)}% savings rate — excellent`; savingsTip = 'Keep maintaining this savings discipline' }
      else if (savingsRate >= 10) { savingsPts = 18; savingsNote = `${savingsRate.toFixed(0)}% savings rate — good`; savingsTip = 'Aim for 20%+ savings rate to hit top score' }
      else if (savingsRate >= 5)  { savingsPts = 12; savingsNote = `${savingsRate.toFixed(0)}% savings rate — fair`; savingsTip = 'Try reducing one recurring expense this month' }
      else if (savingsRate >= 0)  { savingsPts = 6;  savingsNote = `${savingsRate.toFixed(0)}% savings rate — low`; savingsTip = 'Review your top spending categories for cuts' }
      else { savingsPts = 0; savingsNote = 'Spending exceeds income'; savingsTip = 'Urgent: expenses are higher than income this period' }
    }

    // 2. Budget Adherence — current month
    const pctUsed = budgets.monthly > 0 ? spentMonth / budgets.monthly * 100 : null
    let budgetPts = 12
    let budgetNote = 'No monthly budget set'
    let budgetTip  = 'Set a monthly budget in Planning → Budgets'
    if (pctUsed !== null) {
      if (pctUsed <= 70)       { budgetPts = 25; budgetNote = `${pctUsed.toFixed(0)}% of budget used — on track`; budgetTip = 'Excellent budget discipline this month' }
      else if (pctUsed <= 90)  { budgetPts = 18; budgetNote = `${pctUsed.toFixed(0)}% of budget used — watch it`; budgetTip = 'You have some room left — stay cautious' }
      else if (pctUsed <= 100) { budgetPts = 10; budgetNote = `${pctUsed.toFixed(0)}% of budget used — close`; budgetTip = 'Nearly at limit — avoid non-essential spending' }
      else { budgetPts = 0; budgetNote = `${pctUsed.toFixed(0)}% — over budget`; budgetTip = 'Review what pushed you over and adjust next month' }
    }

    // 3. Spending Consistency — last 30 days
    const d30 = new Date(todayStr + 'T12:00:00'); d30.setDate(d30.getDate() - 30)
    const d30Str = d30.toISOString().split('T')[0]
    const dailyMap = {}
    expenses.filter(e => e.date >= d30Str && e.date <= todayStr).forEach(e => {
      dailyMap[e.date] = (dailyMap[e.date] || 0) + toINR(e)
    })
    const dailyVals = Object.values(dailyMap)
    let consistencyPts = 12
    let consistencyNote = 'Not enough data yet'
    let consistencyTip  = 'Keep logging daily to build a consistency score'
    if (dailyVals.length >= 7) {
      const mean = dailyVals.reduce((s, v) => s + v, 0) / dailyVals.length
      const stddev = Math.sqrt(dailyVals.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyVals.length)
      const cv = mean > 0 ? stddev / mean : 0
      if (cv < 0.5)       { consistencyPts = 25; consistencyNote = 'Very consistent spending'; consistencyTip = 'Steady daily habits are the key to long-term saving' }
      else if (cv < 1.0)  { consistencyPts = 18; consistencyNote = 'Mostly consistent'; consistencyTip = 'A few high-spend days pull the score down — watch weekends' }
      else if (cv < 2.0)  { consistencyPts = 10; consistencyNote = 'Some irregular spikes'; consistencyTip = 'Try spreading large purchases across multiple days' }
      else                { consistencyPts = 5;  consistencyNote = 'Highly variable spending'; consistencyTip = 'Big swings in daily spend — review your largest outlier days' }
    }

    // 4. Goals Progress — active goals with contribution in last 30 days
    const activeGoals = goalsWithContribs.filter(g => g.contributions.reduce((s, c) => s + c.amount, 0) < g.target)
    let goalsPts = 12
    let goalsNote = 'No active goals'
    let goalsTip  = 'Create a savings goal in Planning → Goals'
    if (activeGoals.length > 0) {
      const recent = activeGoals.filter(g => g.contributions.some(c => (c.date || '') >= d30Str))
      const ratio = recent.length / activeGoals.length
      goalsPts = Math.round(5 + ratio * 20)
      if (ratio === 1)     { goalsNote = `All ${activeGoals.length} goal${activeGoals.length > 1 ? 's' : ''} progressing`; goalsTip = 'Keep contributing regularly to maintain momentum' }
      else if (ratio > 0)  { goalsNote = `${recent.length} of ${activeGoals.length} goals active`; goalsTip = 'Add a contribution to your stalled goals this week' }
      else                 { goalsNote = 'No recent contributions'; goalsTip = 'Log a contribution to any goal to improve this score' }
    }

    const total = savingsPts + budgetPts + consistencyPts + goalsPts
    return {
      score: total,
      breakdown: [
        { key: 'savings',     icon: '💰', name: 'Savings Rate',   pts: savingsPts,     note: savingsNote,     tip: savingsTip },
        { key: 'budget',      icon: '📅', name: 'Budget',         pts: budgetPts,      note: budgetNote,      tip: budgetTip },
        { key: 'consistency', icon: '📊', name: 'Consistency',    pts: consistencyPts, note: consistencyNote, tip: consistencyTip },
        { key: 'goals',       icon: '🎯', name: 'Goals',          pts: goalsPts,       note: goalsNote,       tip: goalsTip },
      ]
    }
  }, [expenses, income, budgets, spentMonth, goalsWithContribs, todayStr])

  // ── Grouped lists ─────────────────────────────────────
  const grouped    = useMemo(() => byDate(filteredExp), [filteredExp])
  const groupedInc = useMemo(() => byDate(filteredInc), [filteredInc])

  // ── Bulk select ───────────────────────────────────────
  const toggleSelect  = useCallback(id => setSelectedIds(prev => { const n = { ...prev }; if (n[id]) delete n[id]; else n[id] = true; return n }), [])
  const selectAll     = useCallback(() => setSelectedIds(Object.fromEntries(filteredExp.map(e => [e.id, true]))), [filteredExp])
  const deselectAll   = useCallback(() => setSelectedIds({}), [])
  const exitBulk      = useCallback(() => { setBulkMode(false); setSelectedIds({}); setBulkEditField(null); setBulkEditValue('') }, [])
  const applyBulkEdit = useCallback(async (field, value) => {
    if (!field || !value) return
    const toEdit = expenses.filter(e => selectedIds[e.id])
    await Promise.all(toEdit.map(e => editExpense({
      ...e,
      [field]: value,
      ...(field === 'category' ? { subcategory: '' } : {}),
    })))
    setBulkEditField(null); setBulkEditValue(''); exitBulk()
  }, [expenses, selectedIds, editExpense, exitBulk])
  const selectedCount = Object.keys(selectedIds).length

  // ── CRUD handlers ─────────────────────────────────────
  const lastOcrRef = useRef(null) // stores OCR result so corrections can be saved on submit

  const handleAddExpense = f => {
    // Save corrections for any fields the user changed from OCR values
    if (lastOcrRef.current) {
      const ocr = lastOcrRef.current
      const fields = ['description', 'amount', 'category', 'paymentMethod']
      fields.forEach(field => {
        const ocrVal = String(ocr[field] || '')
        const userVal = String(f[field] || '')
        if (ocrVal !== userVal && userVal) {
          saveCorrection({ field, ocrValue: ocrVal, correctValue: userVal, ocrText: ocr._rawText })
        }
      })
      lastOcrRef.current = null
    }
    const e = makeExpense(f, 'manual')
    if (makeDedupContext(expenses).isDuplicate(e)) return
    addExpense(e)
  }
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
  const clearExpFilters = () => { setExpSearch(''); setExpMonth(''); setExpPayment('All'); setExpCurrency('All'); setExpCategories([]); setExpDateFrom(''); setExpDateTo(''); setExpAmtMin(''); setExpAmtMax(''); setActivePreset('') }
  const hasIncFilters = incSearch || incMonth || incSource !== 'All' || incDateFrom || incDateTo || incAmtMin !== '' || incAmtMax !== ''
  const clearIncFilters = () => { setIncSearch(''); setIncMonth(''); setIncSource('All'); setIncDateFrom(''); setIncDateTo(''); setIncAmtMin(''); setIncAmtMax('') }
  const usedExpCurrs   = useMemo(() => [...new Set(expenses.map(e => e.currency || 'INR'))], [expenses])
  const usedIncSources = useMemo(() => [...new Set(income.map(i => i.source || 'Other'))], [income])

  // ── Safe-to-Spend computed ────────────────────────────
  const currentMonthInc   = useMemo(() => income.filter(i => (i.date || '').startsWith(monthStr)).reduce((s, i) => s + toINR(i), 0), [income, monthStr])
  const currentMonthFixed = useMemo(() => expenses.filter(e =>
    (e.date || '').startsWith(monthStr) && (e.expenseType === 'fixed' || e.isRecurring)
  ).reduce((s, e) => s + toINR(e), 0), [expenses, monthStr])
  const { dailyAllowance, daysRemaining } = useMemo(() => calculateSafeToSpend(currentMonthInc, currentMonthFixed, savingsGoal, todayStr), [currentMonthInc, currentMonthFixed, savingsGoal, todayStr])
  const stsRatio = dailyAllowance > 0 ? spentToday / dailyAllowance : 0
  const stsStatus = stsRatio >= 1 ? 'danger' : stsRatio >= 0.8 ? 'warn' : 'ok'
  const stsColor  = stsStatus === 'danger' ? 'var(--color-exp)' : stsStatus === 'warn' ? 'var(--color-warning)' : 'var(--color-inc)'

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
    return { spentSoFar, dailyRate, projected, prevTotal, trend, projectedInc, projectedSavings, daysInMonth, dayOfMonth, prevMonthStr }
  }, [expenses, income, monthStr, todayStr])

  // ── Cash Flow Forecast (Phase 7.6) ──────────────────
  const cashFlowForecast = useMemo(() => {
    const today = new Date(todayStr + 'T12:00:00')

    // Variable expense daily rate — last 30 days, non-recurring
    const d30ago = new Date(today); d30ago.setDate(d30ago.getDate() - 30)
    const d30str = d30ago.toISOString().split('T')[0]
    const varExpTotal = expenses
      .filter(e => e.date && e.date > d30str && e.date <= todayStr && !e.isRecurring)
      .reduce((s, e) => s + toINR(e), 0)
    const varDailyRate = varExpTotal / 30

    // Recurring expense monthly equiv → daily rate
    const recExpMonthly = expenses.filter(e => e.isRecurring)
      .reduce((s, e) => s + monthlyEquiv(toINR(e), e.recurringPeriod || 'monthly'), 0)
    const recDailyRate = recExpMonthly / 30.44

    const totalDailyRate = varDailyRate + recDailyRate

    // Income: recurring monthly + variable last 90d avg → daily rate
    const recIncMonthly = income.filter(i => i.isRecurring)
      .reduce((s, i) => s + monthlyEquiv(toINR(i), i.recurringPeriod || 'monthly'), 0)
    const d90ago = new Date(today); d90ago.setDate(d90ago.getDate() - 90)
    const d90str = d90ago.toISOString().split('T')[0]
    const varIncTotal = income
      .filter(i => i.date && i.date > d90str && i.date <= todayStr && !i.isRecurring)
      .reduce((s, i) => s + toINR(i), 0)
    const incDailyRate = recIncMonthly / 30.44 + varIncTotal / 90

    const netDailyRate = incDailyRate - totalDailyRate

    // 30 / 60 / 90-day projections
    const proj = [30, 60, 90].map(days => ({
      days,
      exp: totalDailyRate * days,
      inc: incDailyRate   * days,
      net: netDailyRate   * days,
    }))

    // Upcoming recurring charges in next 90 days
    const upcoming = []
    expenses.filter(e => e.isRecurring && e.nextDueDate && e.nextDueDate > todayStr).forEach(e => {
      const daysUntil = Math.round((new Date(e.nextDueDate + 'T12:00:00') - today) / 864e5)
      if (daysUntil <= 90) {
        upcoming.push({ desc: e.description || 'Recurring', amount: toINR(e), due: e.nextDueDate, daysUntil, category: e.category, period: e.recurringPeriod || 'monthly' })
      }
    })
    upcoming.sort((a, b) => a.due.localeCompare(b.due))

    // Past 30 days daily actuals for chart
    const pastData = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const dayExp = expenses.filter(e => e.date === ds).reduce((s, e) => s + toINR(e), 0)
      pastData.push({ date: ds, exp: dayExp })
    }

    return {
      varDailyRate, recDailyRate, recExpMonthly, totalDailyRate,
      incDailyRate, recIncMonthly, netDailyRate,
      proj, upcoming: upcoming.slice(0, 15), pastData,
    }
  }, [expenses, income, todayStr])

  // ── Subscription zombie detection ────────────────────
  const SUB_SUBS = new Set(['OTT/Streaming', 'Streaming', 'Subscriptions', 'Software', 'Gaming', 'Cable'])
  const subZombieData = useMemo(() => {
    if (!expenses.length) return { subs: [], zombies: [], creep: [] }
    // Normalize: lowercase + remove common billing suffixes so "Netflix" == "Netflix Premium" == "NETFLIX"
    const normalize = s => (s || '').trim().toLowerCase()
      .replace(/\s*(premium|basic|standard|monthly|annual|yearly|subscription|plan|plus|pro)\s*$/i, '')
      .replace(/\s+/g, ' ').trim()
    const byDesc = {}
    expenses.forEach(e => {
      const key = normalize(e.description)
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
    { id: 'overview',   label: 'Overview',  Icon: LayoutDashboard },
    { id: 'income',     label: 'Income',    Icon: IncomeIcon },
    { id: 'analytics',  label: 'Analytics', Icon: TrendingUp },
    { id: 'planning',   label: 'Planning',  Icon: ClipboardList },
    { id: 'recurring',  label: 'Subs',      Icon: RefreshCw },
    { id: 'trips',      label: 'Trips',     Icon: Plane },
    { id: 'exchange',   label: 'FX',        Icon: ArrowLeftRight },
    { id: 'settings',   label: 'Settings',  Icon: Settings },
  ]

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
          <span className="tracker-title" style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}><Zap size={18} color="var(--primary)" />Expense Tracker</span>
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
          {conflicts.length > 0 && (
            <span className="conflict-badge" title={`${conflicts.length} sync conflict${conflicts.length !== 1 ? 's' : ''} need attention`}>
              ⚠️ {conflicts.length}
            </span>
          )}
          {(() => {
            const { noSpendStreak, underBudgetStreak, underBudgetBest, noSpendThisMonth } = gamificationData
            const hasBudget = budgets.daily > 0
            const streak = hasBudget ? underBudgetStreak : noSpendStreak
            const icon = streak >= 7 ? '🔥' : streak >= 3 ? '✨' : '💡'
            const UB_BADGES = [{ d: 30, i: '🏆' }, { d: 14, i: '🥇' }, { d: 7, i: '🥈' }, { d: 3, i: '🥉' }]
            const NS_BADGES = [{ d: 20, i: '🏆' }, { d: 15, i: '🥇' }, { d: 10, i: '🥈' }, { d: 5, i: '🥉' }]
            const badges = hasBudget ? UB_BADGES : NS_BADGES
            const earnedVal = hasBudget ? underBudgetBest : noSpendThisMonth
            const topBadge = badges.find(b => earnedVal >= b.d)
            const tip = hasBudget
              ? `${streak}d under-budget streak${underBudgetBest > streak ? ' · best ' + underBudgetBest + 'd' : ''}`
              : `${streak}d no-spend streak · ${noSpendThisMonth} no-spend days this month`
            return (
              <button
                className="streak-chip"
                title={tip}
                onClick={() => setTab('overview')}
              >
                <span className="streak-chip-icon">{icon}</span>
                <span className="streak-chip-num">{streak}</span>
                {topBadge && <span className="streak-chip-badge">{topBadge.i}</span>}
              </button>
            )
          })()}
          <button className="cmd-pill" title="Command palette (⌘K)" onClick={() => setShowCmd(true)}>
            <span>⌘K</span>
          </button>
          <button className="btn-ghost btn-sm" title="Toggle theme (D)" onClick={() => setTheme(dark ? 'light' : 'dark')}>
            {themeMode === 'system' ? '🖥️' : dark ? '🌙' : '☀️'}
          </button>
          <button className="btn-ghost btn-sm" title="Colorblind mode" onClick={() => setColorblind(m => !m)} style={{ opacity: colorblind ? 1 : 0.5 }}>👁️</button>
          <button className="btn-ghost btn-sm" title={incognito ? 'Show amounts' : 'Hide amounts'} onClick={() => setIncognito(m => !m)} style={{ opacity: incognito ? 1 : 0.5 }}>🙈</button>
          <button className="btn-primary btn-sm" onClick={() => setShowEF(true)} title="N">➕ Expense</button>
          <button className="btn-income  btn-sm" onClick={() => setShowIF(true)} title="I">💵 Income</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="glass-shell">
        <nav className="tabs" role="tablist">
          {TABS.map((t, i) => (
            <button key={t.id} id={`tab-btn-${t.id}`} role="tab" aria-selected={tab === t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)} title={`Key ${i + 1}`}>
              <t.Icon size={13} style={{marginRight:'0.3rem',verticalAlign:'middle',flexShrink:0}} />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ══════════ OVERVIEW ══════════ */}
      {tab === 'overview' && (
        <section role="tabpanel" className="tab-content-active">
          {expenses.length === 0 && (
            <div className="empty-overview">
              <div className="empty-overview-icon"><Zap size={56} color="var(--primary)" strokeWidth={1.5} /></div>
              <h2>Welcome to Expense Tracker</h2>
              <p className="empty-overview-sub">
                {session?.user?.user_metadata?.display_name
                  ? `Hi ${session.user.user_metadata.display_name}! `
                  : ''}
                Add your first expense to get started. Your dashboard will fill in as you track.
              </p>
              <div className="empty-overview-features">
                <div className="empty-overview-feat">📊 Spending overview</div>
                <div className="empty-overview-feat">💰 Budget tracking</div>
                <div className="empty-overview-feat">📈 Trends & insights</div>
                <div className="empty-overview-feat">🎯 Savings goals</div>
              </div>
              <div className="empty-overview-actions">
                <button className="btn-primary" onClick={() => setShowEF(true)}>➕ Add Expense</button>
                <button className="btn-income"  onClick={() => setShowIF(true)}>💵 Add Income</button>
              </div>
            </div>
          )}
          {/* ── Month Strip ── */}
          {(() => {
            const d           = monthForecast
            const hasBudget   = budgets.monthly > 0
            const pct         = hasBudget ? Math.min(spentMonth / budgets.monthly * 100, 100) : 0
            const barColor    = spentMonth > budgets.monthly ? 'var(--color-exp)' : pct > 80 ? 'var(--color-warning)' : 'var(--color-inc)'
            const currentMonth = todayStr.substring(0, 7)
            const daysLeft    = monthStr === currentMonth
              ? Math.max(0, d.daysInMonth - d.dayOfMonth)
              : 0
            const remaining   = hasBudget ? budgets.monthly - spentMonth : null
            const dailyRemain = remaining !== null && daysLeft > 0 ? remaining / daysLeft : null
            const daysPassed  = monthStr === currentMonth ? d.dayOfMonth : (() => {
              const [yr, mo] = monthStr.split('-').map(Number)
              return new Date(yr, mo, 0).getDate()
            })()
            const dailyAvg    = daysPassed > 0 ? spentMonth / daysPassed : null
            const [yr, mo]    = monthStr.split('-')
            const monthLabel  = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

            // Build selectable month list: union of months with data + last 12 months
            const monthsWithData = new Set(expenses.map(e => (e.date || '').substring(0, 7)).filter(Boolean))
            const pickerMonths = []
            for (let i = 0; i < 12; i++) {
              const d2 = new Date()
              d2.setDate(1)
              d2.setMonth(d2.getMonth() - i)
              pickerMonths.push(d2.toISOString().substring(0, 7))
            }
            expenses.forEach(e => {
              const m = (e.date || '').substring(0, 7)
              if (m && !pickerMonths.includes(m)) pickerMonths.push(m)
            })
            pickerMonths.sort((a, b) => b.localeCompare(a))

            return (
              <div className="month-strip" style={{ position: 'relative', zIndex: showMonthPicker ? 200 : undefined }}>
                <div className="strip-top">
                  <button
                    className="strip-month-btn"
                    onClick={() => setShowMonthPicker(v => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={showMonthPicker}
                  >
                    {monthLabel} <span className="strip-chevron" style={{ display: 'inline-block', transition: 'transform 0.15s', transform: showMonthPicker ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </button>
                  {hasBudget && (
                    <span className="strip-pct" style={{ color: pct >= 100 ? 'var(--color-exp)' : pct > 80 ? 'var(--color-warning)' : 'var(--color-inc)' }}>
                      {pct.toFixed(0)}%
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                    <button className="strip-pdf-btn" style={{ marginLeft: 0 }} onClick={() => handleExportPDF(monthStr)} title={`Download PDF report for ${monthLabel}`}>
                      <FileDown size={14} />
                    </button>
                    <button className="strip-pdf-btn" style={{ marginLeft: 0 }} onClick={() => handleEmailPDF(monthStr)} title={`Email PDF report for ${monthLabel} to ${session.user.email}`}>
                      <Mail size={14} />
                    </button>
                  </div>
                </div>
                {showMonthPicker && (
                  <div className="strip-month-dropdown" role="listbox">
                    {pickerMonths.map(m => {
                      const [my, mm] = m.split('-')
                      const label = new Date(parseInt(my), parseInt(mm) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
                      const hasData = monthsWithData.has(m)
                      return (
                        <button
                          key={m}
                          role="option"
                          aria-selected={m === monthStr}
                          className={'strip-month-option' + (m === monthStr ? ' active' : '') + (m === currentMonth ? ' current' : '')}
                          onClick={() => { setMonthStr(m); setShowMonthPicker(false) }}
                        >
                          <span>{label}</span>
                          {m === currentMonth && <span className="strip-month-tag">Current</span>}
                          {!hasData && m !== currentMonth && <span className="strip-month-tag muted">No data</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                {hasBudget && (
                  <div className="strip-track">
                    <div className="strip-fill" style={{ '--fill': pct / 100, background: barColor }} />
                  </div>
                )}
                <div className="strip-meta">
                  <span>
                    {incognito ? '••••••' : fmtINR(spentMonth)}
                    {hasBudget && <span className="strip-muted"> of {incognito ? '••••' : fmtINR(budgets.monthly)}</span>}
                  </span>
                  {monthStr === currentMonth && <>
                    <span className="strip-dot">·</span>
                    <span><strong>{daysLeft}</strong> days left</span>
                  </>}
                  {hasBudget && dailyRemain !== null && monthStr === currentMonth && <>
                    <span className="strip-dot">·</span>
                    <span><strong>{incognito ? '•••' : fmtINR(Math.round(dailyRemain))}/day</strong> remaining</span>
                  </>}
                  {!hasBudget && dailyAvg !== null && <>
                    <span className="strip-dot">·</span>
                    <span><strong>{incognito ? '•••' : fmtINR(Math.round(dailyAvg))}/day</strong> avg</span>
                  </>}
                </div>
              </div>
            )
          })()}

          {/* ── Bento Grid ── */}
          <div className="bento-grid">

            {/* Hero — Expenses this month */}
            {(() => {
              const pct       = budgets.monthly > 0 ? Math.min(spentMonth / budgets.monthly * 100, 100) : 0
              const barColor  = spentMonth > budgets.monthly ? 'var(--color-exp)' : pct > 80 ? 'var(--color-warning)' : 'var(--color-inc)'
              const txnCount  = expenses.filter(e => (e.date || '').startsWith(monthStr)).length
              const today     = new Date(todayStr + 'T12:00:00')
              const dayLabel  = `${today.getDate()} ${today.toLocaleString('default', { month: 'short' })}`
              const trendVal  = monthForecast.trend !== null ? parseInt(monthForecast.trend) : null
              return (
                <div className="bento-tile bento-hero">
                  <GlowingEffect />
                  <div className="bento-label">Total Spent — {monthStr}</div>
                  <div className="bento-amount bento-exp">{incognito ? '••••••' : fmtINR(spentMonth)}</div>
                  {expenses.length > 0 && (
                    <div className="bento-sub">
                      Day {monthForecast.dayOfMonth} of {monthForecast.daysInMonth}
                      {monthForecast.dailyRate > 0 && <> · {incognito ? '•••' : fmtINR(monthForecast.dailyRate)}/day avg</>}
                    </div>
                  )}
                  {budgets.monthly > 0 && (
                    <div className="bento-progress-wrap">
                      <div className="bento-progress-3pt">
                        <span>₹0</span>
                        <span className="bento-progress-3pt-mid">{incognito ? '••••' : fmtINR(spentMonth)}</span>
                        <span>{incognito ? '••••' : fmtINR(budgets.monthly)}</span>
                      </div>
                      <div className="bento-progress-track">
                        <div className="bento-progress-bar" style={{ '--fill': pct / 100, background: barColor }} />
                      </div>
                    </div>
                  )}
                  <div className="bento-badges">
                    {budgets.monthly > 0 && <span className={`bb ${pct > 80 ? 'bb-red' : 'bb-amber'}`}>⚡ {pct.toFixed(0)}% used</span>}
                    {txnCount > 0 && <span className="bb bb-blue">{txnCount} transactions</span>}
                    <span className="bb bb-purple">{dayLabel}</span>
                    {trendVal !== null && (
                      <span className={`bb ${trendVal > 5 ? 'bb-red' : trendVal < -5 ? 'bb-green' : 'bb-blue'}`}>
                        {trendVal > 5 ? `↑${trendVal}%` : trendVal < -5 ? `↓${Math.abs(trendVal)}%` : '~flat'} vs last month
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Income this month */}
            {(() => {
              const prevInc = allMonthlyInc[monthForecast.prevMonthStr] || 0
              const incDiff = currentMonthInc > 0 && prevInc > 0 ? currentMonthInc - prevInc : null
              return (
                <div className="bento-tile bento-income">
                  <GlowingEffect />
                  <div className="bento-label">Income</div>
                  <div className="bento-amount bento-inc">{incognito ? '••••••' : fmtINR(currentMonthInc > 0 ? currentMonthInc : allIncINR)}</div>
                  <div className="bento-sub">{currentMonthInc > 0 ? 'this month' : allIncINR > 0 ? 'all time' : 'none recorded'}</div>
                  {incDiff !== null && (
                    <div className="bento-badges">
                      <span className={`bb ${incDiff >= 0 ? 'bb-green' : 'bb-red'}`}>
                        {incDiff >= 0 ? '↑' : '↓'} {incognito ? '•••' : fmtINR(Math.abs(incDiff))} vs last month
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Net Savings */}
            {(() => {
              const savRate = allIncINR > 0 ? Math.round((netSavings / allIncINR) * 100) : null
              return (
                <div className="bento-tile bento-savings" style={{ '--savings-border': netSavings >= 0 ? 'var(--color-inc)' : 'var(--color-exp)' }}>
                  <GlowingEffect />
                  <div className="bento-label">Net Savings</div>
                  <div className="bento-amount" style={{ color: netSavings >= 0 ? 'var(--color-inc)' : 'var(--color-exp)' }}>
                    {incognito ? '••••••' : (netSavings >= 0 ? '+' : '') + fmtINR(netSavings)}
                  </div>
                  <div className="bento-sub">Income − Spent</div>
                  {savRate !== null && (
                    <div className="bento-badges">
                      <span className={`bb ${savRate >= 20 ? 'bb-green' : savRate >= 0 ? 'bb-blue' : 'bb-red'}`}>{savRate}% rate</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Safe to Spend */}
            <div className="bento-tile bento-safe">
              <GlowingEffect />
              {budgets.monthly > 0 ? (
                <>
                  <div className="bento-label">Safe to Spend</div>
                  <div className="bento-amount" style={{ color: stsColor }}>
                    {incognito ? '••••••' : fmtINR(Math.max(dailyAllowance, 0))}<span className="bento-unit">/day</span>
                  </div>
                  <div className="bento-sub">Budget left today</div>
                  <div className="bento-badges">
                    <span className="bb bb-blue">{daysRemaining}d left</span>
                    <span className={`bb ${stsStatus === 'danger' ? 'bb-red' : stsStatus === 'warn' ? 'bb-amber' : 'bb-green'}`}>
                      {incognito ? '••••' : fmtINR(Math.max(budgets.monthly - spentMonth, 0))} remaining
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="bento-label">Monthly Budget</div>
                  <div className="bento-amount" style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: 4 }}>Not set</div>
                  <div className="bento-sub" style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => { setTab('planning'); setPlanningTab('budgets') }}>Set a budget →</div>
                </>
              )}
            </div>

            {/* Burn Rate */}
            {(() => {
              const accel = burnRate.acceleration
              const badgeColor = accel === null ? 'bb-blue' : accel > 10 ? 'bb-red' : accel < -10 ? 'bb-green' : 'bb-blue'
              const badgeText = accel === null ? '7-day avg'
                : accel > 10 ? `↑ ${Math.min(Math.abs(accel), 999).toFixed(0)}% vs last week`
                : accel < -10 ? `↓ ${Math.min(Math.abs(accel), 999).toFixed(0)}% vs last week`
                : '~flat vs last week'
              return (
                <div className="bento-tile bento-burn">
                  <GlowingEffect />
                  <div className="bento-label">Burn Rate</div>
                  <div className="bento-amount">
                    {incognito ? '••••••' : fmtINR(burnRate.last7Rate)}<span className="bento-unit">/day</span>
                  </div>
                  <div className="bento-sub">
                    {budgets.monthly > 0 && burnRate.runwayDays !== null
                      ? (burnRate.runwayDays <= 0 ? 'Budget exceeded' : `${burnRate.runwayDays}d runway left`)
                      : 'per day this month'}
                  </div>
                  <div className="bento-badges">
                    <span className={`bb ${badgeColor}`}>{badgeText}</span>
                  </div>
                  {burnRate.topCatRates[0] && (
                    <div className="bento-top-cat">
                      {CATS[burnRate.topCatRates[0].cat]?.icon || '📦'} {burnRate.topCatRates[0].cat} · {incognito ? '•••' : fmtINR(burnRate.topCatRates[0].rate)}/d
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Sparkline — 30-day spend trend */}
            {sparkDays.some(d => d.total > 0) && (() => {
              const W = 400, H = 56, PAD = 4
              const maxAmt = Math.max.apply(null, sparkDays.map(d => d.total).concat([1]))
              const pts = sparkDays.map((d, i) => [
                Math.round((i / 29) * W),
                Math.round(H - PAD - (d.total / maxAmt) * (H - PAD * 2))
              ])
              const polyPts = pts.map(p => p.join(',')).join(' ')
              const fillD = 'M' + pts[0].join(',') + ' ' + pts.slice(1).map(p => 'L' + p.join(',')).join(' ') + ' L' + W + ',' + H + ' L0,' + H + ' Z'
              const peakIdx = sparkDays.reduce((mi, d, i) => d.total > sparkDays[mi].total ? i : mi, 0)
              const fmtDay = iso => { const d = new Date(iso + 'T12:00:00'); return d.getDate() + ' ' + d.toLocaleString('default', { month: 'short' }) }
              const onPointer = (e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const cx = e.touches ? e.touches[0].clientX : e.clientX
                setSparkHover(Math.max(0, Math.min(29, Math.round(((cx - rect.left) / rect.width) * 29))))
              }
              const ttAlign = sparkHover !== null
                ? (sparkHover <= 3 ? 'translateX(0%)' : sparkHover >= 26 ? 'translateX(-100%)' : 'translateX(-50%)')
                : 'translateX(-50%)'
              return (
                <div className="bento-tile bento-spark">
                  <GlowingEffect />
                  <div className="spark-header">
                    <div className="bento-label">30-Day Spend Trend</div>
                    {sparkHover !== null ? (
                      <div className="spark-peak">
                        {incognito ? '••••' : sparkDays[sparkHover].total > 0 ? fmtINR(sparkDays[sparkHover].total) : '—'}
                        <span className="spark-peak-label">{fmtDay(sparkDays[sparkHover].date)}</span>
                      </div>
                    ) : sparkDays[peakIdx].total > 0 ? (
                      <div className="spark-peak">
                        <span className="spark-peak-dot" />
                        {incognito ? '••••' : fmtINR(sparkDays[peakIdx].total)}
                        <span className="spark-peak-label">peak · {fmtDay(sparkDays[peakIdx].date)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="spark-container"
                    onMouseLeave={() => setSparkHover(null)}
                    onTouchEnd={() => setSparkHover(null)}>
                    {sparkHover !== null && (
                      <div className="spark-tt" style={{
                        left: ((sparkHover / 29) * 100) + '%',
                        transform: ttAlign,
                      }}>
                        <strong>{incognito ? '••••' : sparkDays[sparkHover].total > 0 ? fmtINR(sparkDays[sparkHover].total) : '—'}</strong>
                        <span className="spark-tt-date">{fmtDay(sparkDays[sparkHover].date)}</span>
                      </div>
                    )}
                    <svg className="spark-svg" viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none"
                      style={{ cursor: 'crosshair', touchAction: 'none', display: 'block' }}
                      onMouseMove={onPointer}
                      onTouchStart={onPointer}
                      onTouchMove={onPointer}>
                      <defs>
                        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={fillD} fill="url(#spark-grad)" />
                      <polyline points={polyPts} fill="none" stroke="#4f46e5" strokeWidth="2"
                        strokeLinejoin="round" strokeLinecap="round" />
                      {sparkDays[peakIdx].total > 0 && sparkHover !== peakIdx && (
                        <circle cx={pts[peakIdx][0]} cy={pts[peakIdx][1]} r="3.5" fill="#7c3aed" />
                      )}
                      <circle cx={pts[29][0]} cy={pts[29][1]} r="3.5" fill="#4f46e5" />
                      {sparkHover !== null && (
                        <>
                          <line x1={pts[sparkHover][0]} y1={0} x2={pts[sparkHover][0]} y2={H}
                            stroke="#4f46e5" strokeWidth="1" strokeDasharray="3 2" opacity="0.45" />
                          <circle cx={pts[sparkHover][0]} cy={pts[sparkHover][1]} r="5"
                            fill="#4f46e5" stroke="var(--surface)" strokeWidth="2" />
                        </>
                      )}
                    </svg>
                  </div>
                  <div className="spark-axis">
                    <span>{fmtDay(sparkDays[0].date)}</span>
                    <span>{fmtDay(sparkDays[9].date)}</span>
                    <span>{fmtDay(sparkDays[19].date)}</span>
                    <span>Today</span>
                  </div>
                </div>
              )
            })()}

          </div>

          {/* Category tiles */}
          {Object.keys(spentByCatMonth).length > 0 && (
            <>
              <div className="cat-sec">Spending by Category</div>
              <div className="cat-grid">
                {Object.entries(spentByCatMonth)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, spent]) => {
                    const catInfo = CATS[cat] || { icon: '📦', color: 'var(--text-muted)' }
                    const catBgt  = (budgets.categories && budgets.categories[cat]) || 0
                    const pct     = catBgt > 0 ? Math.min((spent / catBgt) * 100, 100) : 0
                    const barColor = catBgt > 0
                      ? (pct >= 100 ? '#ef4444' : pct >= 80 ? 'var(--color-warning)' : catInfo.color)
                      : catInfo.color
                    const fillPct  = catBgt > 0 ? pct : Math.min((spent / Math.max(spentMonth, 1)) * 100, 100)
                    const leftAmt  = catBgt > 0 ? catBgt - spent : null
                    return (
                      <div key={cat} className="bento-tile cat-tile">
                        <GlowingEffect />
                        <div className="cat-top">
                          <div className="cat-ico" style={{ background: `color-mix(in srgb, ${catInfo.color} 16%, transparent)` }}>
                            {catInfo.PhIcon ? <catInfo.PhIcon size={15} weight="duotone" color={catInfo.color} /> : catInfo.icon}
                          </div>
                          <div className="cat-name">{cat}</div>
                        </div>
                        <div className="cat-amt">{incognito ? '••••' : fmtINR(spent)}</div>
                        <div className="cat-bar">
                          <div className="cat-fill" style={{ background: barColor, '--fill': fillPct / 100 }} />
                        </div>
                        <div className="cat-meta">
                          <span>{catBgt > 0 ? pct.toFixed(0) + '% of budget' : ((spent / Math.max(spentMonth, 1)) * 100).toFixed(0) + '% of total'}</span>
                          {catBgt > 0 && (
                            <span style={{ color: leftAmt <= 0 ? '#ef4444' : leftAmt < catBgt * 0.2 ? 'var(--color-warning)' : catInfo.color }}>
                              {leftAmt <= 0 ? 'At limit' : incognito ? '••••' : fmtINR(leftAmt) + ' left'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </>
          )}

          {/* Recurring reminders banner */}
          {upcomingRecurring.length > 0 && (
            <div className="recurring-banner" role="region" aria-label="Upcoming recurring expenses">
              <div className="recurring-banner-body">
                <div className="recurring-banner-title">📅 Upcoming Recurring ({upcomingRecurring.length})</div>
                <div className="recurring-chips">
                  {upcomingRecurring.map(r => {
                    const color = r.daysUntil <= 1 ? 'var(--color-exp)' : r.daysUntil <= 3 ? 'var(--color-warning)' : 'var(--color-brand)'
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
            <div className="esp-poda">
              <div className="esp-glow" />
              <div className="esp-dark" />
              <div className="esp-white" />
              <div className="esp-border" />
              <div className="esp-main">
                <input className="esp-input" placeholder="Search or try: food last week, over 500, credit card…"
                  value={expSearch} onChange={e => setExpSearch(e.target.value)} />
                <div className="esp-input-mask" />
                <div className="esp-pink-mask" />
                <Search size={15} className="esp-search-icon" />
              </div>
            </div>
            <input type="month" className="month-picker" value={expMonth} onChange={e => { setExpMonth(e.target.value); setExpDateFrom(''); setExpDateTo(''); setActivePreset('') }} />
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

          {/* NL parsed chips */}
          {nlQuery.tokens.length > 0 && (
            <div className="nl-chips">
              <span className="nl-chips-label">Parsed</span>
              {nlQuery.tokens.map((t, i) => (
                <span key={i} className="nl-chip">{t.label}</span>
              ))}
              {nlQuery.text && <span className="nl-chip nl-chip-text">"{nlQuery.text}"</span>}
            </div>
          )}

          {showAdvExp && (
            <div className="adv-filters">
              {/* Date presets */}
              <div className="adv-row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                {(() => {
                  const now = new Date()
                  const pad = n => String(n).padStart(2, '0')
                  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
                  const presets = [
                    { label: 'This month', from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),     to: today },
                    { label: 'Last month', from: fmt(new Date(now.getFullYear(), now.getMonth()-1, 1)),   to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)) },
                    { label: 'Last 3m',    from: fmt(new Date(now.getFullYear(), now.getMonth()-2, 1)),   to: today },
                    { label: 'Last 6m',    from: fmt(new Date(now.getFullYear(), now.getMonth()-5, 1)),   to: today },
                    { label: 'This year',  from: `${now.getFullYear()}-01-01`,                            to: today },
                    { label: 'Last year',  from: `${now.getFullYear()-1}-01-01`,                          to: `${now.getFullYear()-1}-12-31` },
                  ]
                  return presets.map(p => (
                    <button key={p.label}
                      className={`date-preset-chip${activePreset === p.label ? ' active' : ''}`}
                      onClick={() => {
                        if (activePreset === p.label) {
                          setExpDateFrom(''); setExpDateTo(''); setActivePreset('')
                        } else {
                          setExpDateFrom(p.from); setExpDateTo(p.to)
                          setExpMonth(''); setActivePreset(p.label)
                        }
                      }}>
                      {p.label}
                    </button>
                  ))
                })()}
              </div>
              {/* Custom date range */}
              <div className="adv-row">
                <label>Date from</label><input type="date" value={expDateFrom} onChange={e => { setExpDateFrom(e.target.value); setExpMonth(''); setActivePreset('') }} />
                <label>to</label><input type="date" value={expDateTo} onChange={e => { setExpDateTo(e.target.value); setExpMonth(''); setActivePreset('') }} />
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
              <div className="bulk-bar-top">
                <span>{selectedCount > 0 ? `${selectedCount} selected` : 'None selected'}</span>
                <button className="btn-ghost btn-sm" onClick={selectAll}>Select all ({filteredExp.length})</button>
                {selectedCount > 0 && <button className="btn-ghost btn-sm" onClick={deselectAll}>Deselect all</button>}
                {selectedCount > 0 && <>
                  <div className="bulk-sep" />
                  {[['category','📁 Category'],['paymentMethod','💳 Payment'],['date','📅 Date']].map(([f, lbl]) => (
                    <button key={f} className={`btn-ghost btn-sm${bulkEditField === f ? ' active' : ''}`}
                      onClick={() => { setBulkEditField(bulkEditField === f ? null : f); setBulkEditValue('') }}>
                      {lbl}
                    </button>
                  ))}
                  <div className="bulk-sep" />
                  <button className="btn-danger btn-sm" onClick={() => setDelTarget({ many: true, ids: selectedIds })}>🗑️ Delete {selectedCount}</button>
                </>}
              </div>
              {bulkEditField && selectedCount > 0 && (
                <div className="bulk-edit-row">
                  <span className="bulk-edit-label">
                    {bulkEditField === 'category' ? 'Set category' : bulkEditField === 'paymentMethod' ? 'Set payment' : 'Set date'}
                  </span>
                  {bulkEditField === 'category' && (
                    <select className="bulk-edit-select" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} autoFocus>
                      <option value="">— choose —</option>
                      {Object.keys(CATS).map(c => <option key={c} value={c}>{CATS[c].icon} {c}</option>)}
                    </select>
                  )}
                  {bulkEditField === 'paymentMethod' && (
                    <select className="bulk-edit-select" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} autoFocus>
                      <option value="">— choose —</option>
                      {PAY_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  )}
                  {bulkEditField === 'date' && (
                    <input type="date" className="bulk-edit-date" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} autoFocus />
                  )}
                  <button className="btn-primary-sm" onClick={() => applyBulkEdit(bulkEditField, bulkEditValue)} disabled={!bulkEditValue}>
                    Apply to {selectedCount}
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => { setBulkEditField(null); setBulkEditValue('') }}>✕</button>
                </div>
              )}
            </div>
          )}

          {grouped.length === 0 ? (
            expenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Zap size={48} color="var(--primary)" strokeWidth={1.5} /></div>
                <h3>No expenses yet</h3>
                <p>Start tracking where your money goes. Every entry helps build your financial picture.</p>
                <div className="empty-actions">
                  <button className="btn-primary" onClick={() => setShowEF(true)}>➕ Add Expense</button>
                </div>
              </div>
            ) : (
              <div className="empty-state-sm">
                <p>🔍 No expenses match your filters.</p>
                <button className="btn-secondary btn-sm" onClick={clearExpFilters}>Clear filters</button>
              </div>
            )
          ) : grouped.map(([date, items]) => (
            <div key={date} className="date-group">
              <div className="date-group-header">
                <span>{fmtDate(date)}</span>
                <span>{fmtINR(items.reduce((s, e) => s + toINR(e), 0))}</span>
              </div>
              {items.map(e => <ExpItem key={e.id} item={e}
                onDelete={id => setDelTarget({ id, type: 'expense' })}
                onEdit={e => { setEditExpTarget(e); setShowEF(true) }}
                bulkMode={bulkMode} isSelected={!!selectedIds[e.id]} onToggleSelect={toggleSelect} />)}
            </div>
          ))}
        </section>
      )}

      {/* ══════════ INCOME ══════════ */}
      {tab === 'income' && (
        <section role="tabpanel" className="tab-content-active">
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
              {monthlyIncData.length >= 2 && <div className="chart-card"><div className="chart-title">Monthly Trend</div><LineChart data={monthlyIncData} incognito={incognito} /></div>}
            </div>
          )}

          {groupedInc.length === 0 ? (
            income.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💵</div>
                <h3>No income yet</h3>
                <p>Log your salary, freelance, or any other earnings to track your net savings rate.</p>
                <div className="empty-actions">
                  <button className="btn-income" onClick={() => setShowIF(true)}>💵 Add Income</button>
                </div>
              </div>
            ) : (
              <div className="empty-state-sm">
                <p>🔍 No income matches your filters.</p>
                <button className="btn-secondary btn-sm" onClick={clearIncFilters}>Clear filters</button>
              </div>
            )
          ) : groupedInc.map(([date, items]) => (
            <div key={date} className="date-group">
              <div className="date-group-header">
                <span>{fmtDate(date)}</span>
                <span style={{ color: 'var(--color-inc)' }}>+{fmtINR(items.reduce((s, i) => s + toINR(i), 0))}</span>
              </div>
              {items.map(i => <IncItem key={i.id} item={i}
                onDelete={id => setDelTarget({ id, type: 'income' })}
                onEdit={i => { setEditIncTarget(i); setShowIF(true) }} />)}
            </div>
          ))}
        </section>
      )}

      {/* ══════════ ANALYTICS sub-nav ══════════ */}
      {tab === 'analytics' && (
        <div className="sub-nav-wrap">
          <div className="sub-nav" role="tablist">
            <button role="tab" aria-selected={analyticsTab === 'insights'}
              className={'sub-nav-btn' + (analyticsTab === 'insights' ? ' active' : '')}
              onClick={() => setAnalyticsTab('insights')}>💡 Insights</button>
            <button role="tab" aria-selected={analyticsTab === 'trends'}
              className={'sub-nav-btn' + (analyticsTab === 'trends' ? ' active' : '')}
              onClick={() => setAnalyticsTab('trends')}>📈 Trends</button>
            <button role="tab" aria-selected={analyticsTab === 'merchants'}
              className={'sub-nav-btn' + (analyticsTab === 'merchants' ? ' active' : '')}
              onClick={() => { setAnalyticsTab('merchants'); setSelectedMerchant(null) }}>🏪 Merchants</button>
            <button role="tab" aria-selected={analyticsTab === 'forecast'}
              className={'sub-nav-btn' + (analyticsTab === 'forecast' ? ' active' : '')}
              onClick={() => setAnalyticsTab('forecast')}>📅 Forecast</button>
          </div>
        </div>
      )}

      {/* ══════════ TRENDS ══════════ */}
      {tab === 'analytics' && analyticsTab === 'trends' && (
        <section role="tabpanel" className="tab-content-active">
          {/* ── Grouped Monthly Bar Chart ── */}
          <div className="chart-card" style={{ marginBottom: '1rem' }}>
            <div className="chart-title-row">
              <span className="chart-title">📅 Last 6 Months — Expenses vs Income</span>
              <div className="chart-legend">
                <span className="chart-legend-dot" style={{ background: 'var(--color-exp)' }} />Expenses
                <span className="chart-legend-dot" style={{ background: 'var(--color-inc)', marginLeft: '0.75rem' }} />Income
                {budgets.monthly > 0 && <><span className="chart-legend-dash" />Budget</>}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <GroupedBarChart data={groupedMonthlyData} budget={budgets.monthly} incognito={incognito} />
            </div>
          </div>

          {/* ── Category Trends ── */}
          {catTrend6.length > 0 && (
            <div className="chart-card" style={{ marginBottom: '1rem', overflowX: 'auto' }}>
              <div className="chart-title">📊 Category Trends — Last 6 Months</div>
              <div className="cat-trend-grid">
                {catTrend6.map(({ cat, icon, color, vals, months, maxV }) => {
                  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  const compact = n => {
                    if (n === 0) return ''
                    if (n >= 1e7) return (n/1e7).toFixed(1).replace(/\.0$/,'')+'Cr'
                    if (n >= 1e5) return (n/1e5).toFixed(1).replace(/\.0$/,'')+'L'
                    if (n >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'')+'K'
                    return Math.round(n).toString()
                  }
                  return (
                    <div key={cat} className="cat-trend-row">
                      <div className="cat-trend-label">
                        <span>{icon}</span>
                        <span className="cat-trend-name">{cat}</span>
                        <span className="cat-trend-total">{incognito ? '••••' : fmtINR(vals.reduce((s, v) => s + v, 0))}</span>
                      </div>
                      <div className="cat-trend-bars">
                        {vals.map((v, i) => {
                          const mo = months[i] // 'YYYY-MM'
                          const moName = MON[parseInt(mo.split('-')[1]) - 1]
                          const isMax = v === maxV && v > 0
                          const pct = maxV > 0 ? (v / maxV) * 100 : 0
                          return (
                            <div key={i} className="cat-trend-bar-wrap" title={`${moName} ${mo.split('-')[0]}: ${fmtINR(v)}`}>
                              <div className="cat-trend-bar-amt" style={{ color: isMax ? color : 'var(--text-faint)' }}>
                                {incognito ? (v > 0 ? '•' : '') : compact(v)}
                              </div>
                              <div className="cat-trend-bar-track">
                                <div className="cat-trend-bar-fill" style={{ '--fill': pct / 100, background: color, opacity: isMax ? 1 : 0.55, animationDelay: `${i * 65}ms` }} />
                              </div>
                              <div className="cat-trend-bar-month">{moName}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}


          {catData.length > 0 && (
            <div className="chart-card" style={{ marginBottom: '1rem' }}>
              <div className="chart-title">Category Bars</div>
              <BarChart data={catData} incognito={incognito} />
            </div>
          )}
          <div className="chart-card" style={{ marginBottom: '1rem' }}>
            <div className="chart-title">🗓️ 90-Day Activity Heatmap</div>
            <HeatmapCalendar expenses={expenses} income={income} />
          </div>
          <div className="chart-card" style={{ marginBottom: '1rem', overflowX: 'auto' }}>
            <div className="chart-title">Month-by-Month Comparison</div>
            <table className="comp-table">
              <thead><tr><th>Month</th><th>Expenses</th><th>MoM</th><th>Income</th><th>Saved</th><th>Rate</th><th>Txns</th></tr></thead>
              <tbody>{allMonthlyExp.slice().reverse().map(({ fullLabel, value }, i, arr) => {
                const prevVal = arr[i + 1]?.value
                const inc = allMonthlyInc[fullLabel] || 0
                const saved = inc - value
                const rate = inc > 0 ? ((saved / inc) * 100).toFixed(0) : null
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
                    <td style={{ color: 'var(--color-exp)', fontWeight: 600 }}>{incognito ? '••••' : fmtINR(value)}</td>
                    <td>{delta || <span className="delta-flat">—</span>}</td>
                    <td style={{ color: 'var(--color-inc)', fontWeight: 600 }}>{inc ? (incognito ? '••••' : fmtINR(inc)) : '—'}</td>
                    <td style={{ color: saved >= 0 ? 'var(--color-inc)' : 'var(--color-exp)', fontWeight: 600 }}>{inc ? (incognito ? '••••' : (saved >= 0 ? '+' : '') + fmtINR(saved)) : '—'}</td>
                    <td style={{ color: rate !== null ? (parseInt(rate) >= 20 ? 'var(--color-inc)' : parseInt(rate) >= 0 ? 'var(--color-warning)' : 'var(--color-exp)') : 'var(--text-faint)', fontWeight: 600 }}>
                      {rate !== null ? `${rate}%` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{cnt}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
          {yearlyData.length > 0 && (
            <div className="chart-card" style={{ marginBottom: '1rem' }}>
              <div className="chart-title">📆 Year-over-Year</div>
              <LineChart data={yearlyData} incognito={incognito} />
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
        </section>
      )}

      {/* ══════════ MERCHANTS ══════════ */}
      {tab === 'analytics' && analyticsTab === 'merchants' && (() => {
        // Last 6 months for mini trend bars
        const last6 = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(todayStr + 'T12:00:00')
          d.setDate(1); d.setMonth(d.getMonth() - i)
          last6.push(d.toISOString().substring(0, 7))
        }

        function MiniBar({ months, maxVal }) {
          return (
            <div className="mch-mini-bars">
              {last6.map(mo => {
                const amt = months[mo] || 0
                const fill = maxVal > 0 ? (amt / maxVal) : 0
                return (
                  <div key={mo} className="mch-mini-bar-wrap" title={mo + ': ' + (amt > 0 ? fmtINR(amt) : 'no spend')}>
                    <div className="mch-mini-bar" style={{ '--fill': fill }} />
                  </div>
                )
              })}
            </div>
          )
        }

        const globalMax = merchantData[0]?.total || 1

        return (
          <section role="tabpanel" className="tab-content-active">
            {merchantData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏪</div>
                <h3>No merchant data yet</h3>
                <p>Add a few expenses and merchants will appear here with spend totals, frequency, and monthly trends.</p>
                <button className="btn-primary btn-sm" onClick={() => setShowEF(true)}>➕ Add Expense</button>
              </div>
            ) : (
              <>
                {/* Summary strip */}
                <div className="mch-summary-strip">
                  <div className="mch-summary-item">
                    <span className="mch-summary-val">{merchantData.length}</span>
                    <span className="mch-summary-lbl">merchants</span>
                  </div>
                  <div className="mch-summary-item">
                    <span className="mch-summary-val">{incognito ? '••••' : fmtINR(merchantData[0]?.total || 0)}</span>
                    <span className="mch-summary-lbl">top spend</span>
                  </div>
                  <div className="mch-summary-item">
                    <span className="mch-summary-val">{merchantData.reduce((s, m) => s + m.count, 0)}</span>
                    <span className="mch-summary-lbl">total txns</span>
                  </div>
                </div>

                {/* Merchant card list — detail panel expands inline below selected card */}
                <div className="mch-list">
                  {merchantData.map((m, i) => {
                    const pct = allExpINR > 0 ? (m.total / allExpINR * 100).toFixed(1) : 0
                    const barW = globalMax > 0 ? (m.total / globalMax * 100) : 0
                    const isSelected = selectedMerchant === m.name
                    const moMax = Math.max(...Object.values(m.months), 1)
                    const maxMoAmt = Math.max(...Object.values(m.months), 1)
                    return (
                      <Fragment key={m.name}>
                        <div
                          className={'mch-card' + (isSelected ? ' mch-card-selected' : '')}
                          onClick={() => setSelectedMerchant(isSelected ? null : m.name)}
                          role="button" tabIndex={0}
                          onKeyDown={ev => ev.key === 'Enter' && setSelectedMerchant(isSelected ? null : m.name)}
                        >
                          <div className="mch-card-rank">#{i + 1}</div>
                          <div className="mch-card-body">
                            <div className="mch-card-top">
                              <span className="mch-card-icon">{CATS[m.topCat]?.icon || '🏪'}</span>
                              <span className="mch-card-name">{m.name}</span>
                              <span className="mch-card-cat">{m.topCat}</span>
                            </div>
                            <div className="mch-card-bar-track">
                              <div className="mch-card-bar-fill" style={{ width: barW + '%' }} />
                            </div>
                            <div className="mch-card-stats">
                              <span className="mch-stat">{m.count} txns</span>
                              <span className="mch-stat">avg {incognito ? '••' : fmtINR(Math.round(m.avg))}</span>
                              <span className="mch-stat">last {m.last}</span>
                            </div>
                          </div>
                          <div className="mch-card-right">
                            <div className="mch-card-total">{incognito ? '••••' : fmtINR(m.total)}</div>
                            <div className="mch-card-pct">{pct}%</div>
                            <MiniBar months={m.months} maxVal={moMax} />
                          </div>
                          <span className="mch-card-chevron">{isSelected ? '▲' : '▼'}</span>
                        </div>

                        {/* Inline accordion detail */}
                        {isSelected && (
                          <div className="mch-detail-panel mch-detail-inline">
                            <div className="mch-detail-stats">
                              <div className="mch-detail-stat">
                                <span className="mch-detail-val">{incognito ? '••••' : fmtINR(m.total)}</span>
                                <span className="mch-detail-lbl">total</span>
                              </div>
                              <div className="mch-detail-stat">
                                <span className="mch-detail-val">{m.count}</span>
                                <span className="mch-detail-lbl">orders</span>
                              </div>
                              <div className="mch-detail-stat">
                                <span className="mch-detail-val">{incognito ? '••' : fmtINR(Math.round(m.avg))}</span>
                                <span className="mch-detail-lbl">avg/order</span>
                              </div>
                            </div>
                            <div className="mch-detail-meta">
                              <span>📅 {m.first} → {m.last}</span>
                              <span>🏷️ {m.topCat}</span>
                            </div>
                            <div className="mch-detail-trend-label">Monthly trend — last 6 months</div>
                            <div className="mch-detail-bars">
                              {last6.map(mo => {
                                const amt = m.months[mo] || 0
                                const fill = maxMoAmt > 0 ? (amt / maxMoAmt) : 0
                                const label = new Date(mo + '-01T12:00:00').toLocaleString('default', { month: 'short' })
                                return (
                                  <div key={mo} className="mch-detail-bar-col">
                                    <div className="mch-detail-bar-amt">{amt > 0 ? (incognito ? '••' : fmtINR(amt)) : ''}</div>
                                    <div className="mch-detail-bar-track">
                                      <div className="mch-detail-bar-fill" style={{ '--fill': fill }} />
                                    </div>
                                    <div className="mch-detail-bar-lbl">{label}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </Fragment>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )
      })()}

      {/* ══════════ FORECAST ══════════ */}
      {tab === 'analytics' && analyticsTab === 'forecast' && (() => {
        const { varDailyRate, recDailyRate, recExpMonthly, totalDailyRate,
                incDailyRate, netDailyRate, proj, upcoming, pastData } = cashFlowForecast
        const today = new Date(todayStr + 'T12:00:00')

        // Chart geometry
        const W = 600, H = 120, PL = 4, PR = 4, PT = 10, PB = 22
        const chartW = W - PL - PR, chartH = H - PT - PB
        const nCols = 60, colW = chartW / nCols, barW = Math.max(colW - 1, 1)
        const maxY = Math.max(...pastData.map(d => d.exp), totalDailyRate, 1) * 1.15
        const sy = v => PT + chartH * (1 - Math.min(v / maxY, 1))
        const projY = sy(totalDailyRate)

        return (
          <section role="tabpanel" className="tab-content-active">
            {/* 30 / 60 / 90-day projection tiles */}
            <div className="fcst-tiles">
              {proj.map(p => (
                <div key={p.days} className="fcst-tile">
                  <div className="fcst-tile-days">{p.days}d</div>
                  <div className="fcst-tile-exp">{incognito ? '••••' : fmtINR(Math.round(p.exp))}</div>
                  <div className="fcst-tile-sub">projected spend</div>
                  {incDailyRate > 0 && (
                    <div className={'fcst-tile-net' + (p.net >= 0 ? ' pos' : ' neg')}>
                      {p.net >= 0 ? '+' : '−'}{incognito ? '••••' : fmtINR(Math.round(Math.abs(p.net)))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Daily rate breakdown */}
            <div className="chart-card fcst-rate-card">
              <div className="chart-title">📊 Daily Rate Breakdown</div>
              <div className="fcst-rates">
                <div className="fcst-rate-row">
                  <span className="fcst-rate-lbl">Variable (30d avg)</span>
                  <div className="fcst-rate-bar-track">
                    <div className="fcst-rate-bar-fill exp" style={{ '--fill': totalDailyRate > 0 ? varDailyRate / totalDailyRate : 0.5 }} />
                  </div>
                  <span className="fcst-rate-val">{incognito ? '••' : fmtINR(Math.round(varDailyRate))}/d</span>
                </div>
                {recDailyRate > 0 && (
                  <div className="fcst-rate-row">
                    <span className="fcst-rate-lbl">Recurring ({incognito ? '••' : fmtINR(Math.round(recExpMonthly))}/mo)</span>
                    <div className="fcst-rate-bar-track">
                      <div className="fcst-rate-bar-fill rec" style={{ '--fill': totalDailyRate > 0 ? recDailyRate / totalDailyRate : 0.5 }} />
                    </div>
                    <span className="fcst-rate-val">{incognito ? '••' : fmtINR(Math.round(recDailyRate))}/d</span>
                  </div>
                )}
                <div className="fcst-rates-divider" />
                <div className="fcst-rate-row fcst-rate-total-row">
                  <span className="fcst-rate-lbl">Total outflow</span>
                  <span />
                  <span className="fcst-rate-val" style={{ color: 'var(--color-exp)' }}>{incognito ? '••' : fmtINR(Math.round(totalDailyRate))}/d</span>
                </div>
                {incDailyRate > 0 && <>
                  <div className="fcst-rate-row">
                    <span className="fcst-rate-lbl">Income</span>
                    <span />
                    <span className="fcst-rate-val" style={{ color: 'var(--color-inc)' }}>+{incognito ? '••' : fmtINR(Math.round(incDailyRate))}/d</span>
                  </div>
                  <div className="fcst-rate-row fcst-rate-total-row">
                    <span className="fcst-rate-lbl">Net daily</span>
                    <span />
                    <span className="fcst-rate-val" style={{ color: netDailyRate >= 0 ? 'var(--color-inc)' : 'var(--color-exp)' }}>
                      {netDailyRate >= 0 ? '+' : '−'}{incognito ? '••' : fmtINR(Math.round(Math.abs(netDailyRate)))}/d
                    </span>
                  </div>
                </>}
              </div>
              {netDailyRate < 0 && incDailyRate > 0 && (
                <div className="fcst-deficit-banner">
                  ⚠️ Spending exceeds income by {incognito ? '••' : fmtINR(Math.round(Math.abs(netDailyRate)))}/day · {incognito ? '••' : fmtINR(Math.round(Math.abs(netDailyRate * 30)))}/mo deficit
                </div>
              )}
              {netDailyRate >= 0 && incDailyRate > 0 && (
                <div className="fcst-surplus-banner">
                  ✅ Saving ~{incognito ? '••' : fmtINR(Math.round(netDailyRate * 30))}/month at current pace
                </div>
              )}
            </div>

            {/* Spend trajectory SVG: past 30d actual + next 30d projected */}
            <div className="chart-card" style={{ marginBottom: '1rem' }}>
              <div className="chart-title-row">
                <span className="chart-title">📉 Spend Trajectory — Past 30d + Next 30d</span>
                <div className="chart-legend">
                  <span className="chart-legend-dot" style={{ background: 'var(--color-exp)' }} />Actual
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>···</span>
                  <span style={{ marginLeft: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Projected</span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: '320px', display: 'block' }}>
                  {[0.25, 0.5, 0.75, 1].map(f => (
                    <line key={f} x1={PL} x2={W - PR} y1={sy(maxY * f)} y2={sy(maxY * f)}
                      stroke="var(--border)" strokeWidth="0.5" />
                  ))}
                  {/* Past 30d actual bars */}
                  {pastData.map((d, i) => {
                    const x = PL + i * colW
                    const y = sy(d.exp)
                    const h = Math.max((H - PB) - y, d.exp > 0 ? 1 : 0)
                    return d.exp > 0 ? (
                      <rect key={i} x={x} y={y} width={barW} height={h}
                        fill="var(--color-exp)" rx="1" opacity="0.85">
                        <title>{d.date}: {fmtINR(d.exp)}</title>
                      </rect>
                    ) : null
                  })}
                  {/* TODAY divider */}
                  <line x1={PL + 30 * colW} x2={PL + 30 * colW} y1={PT - 4} y2={H - PB}
                    stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 2" />
                  <text x={PL + 30 * colW + 2} y={PT + 6} fontSize="7" fill="var(--primary)" fontWeight="600">TODAY</text>
                  {/* Future 30d projected bars (ghosted) */}
                  {totalDailyRate > 0 && Array.from({ length: 30 }, (_, i) => {
                    const x = PL + (30 + i) * colW
                    const y = sy(totalDailyRate)
                    const h = Math.max((H - PB) - y, 1)
                    return (
                      <rect key={i} x={x} y={y} width={barW} height={h}
                        fill="var(--color-exp)" rx="1" opacity="0.22">
                        <title>Projected: {fmtINR(Math.round(totalDailyRate))}/day</title>
                      </rect>
                    )
                  })}
                  {/* Projected level dashed line */}
                  {totalDailyRate > 0 && (
                    <line x1={PL + 30 * colW} x2={W - PR} y1={projY} y2={projY}
                      stroke="var(--color-exp)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.65" />
                  )}
                  {/* X-axis labels */}
                  {[-20, -10, 10, 20].map(off => {
                    const x = PL + (30 + off) * colW + colW / 2
                    const lbl = (off > 0 ? '+' : '') + off + 'd'
                    return <text key={off} x={x} y={H - 5} textAnchor="middle" fontSize="7.5" fill="var(--text-muted)">{lbl}</text>
                  })}
                </svg>
              </div>
            </div>

            {/* Upcoming recurring charges */}
            {upcoming.length > 0 && (
              <div className="chart-card" style={{ marginBottom: '1rem' }}>
                <div className="chart-title">📋 Upcoming Recurring — Next 90 Days</div>
                <div className="fcst-upcoming">
                  {upcoming.map((u, i) => (
                    <div key={i} className="fcst-upcoming-row">
                      <span className="fcst-upcoming-icon">{CATS[u.category]?.icon || '🔄'}</span>
                      <div className="fcst-upcoming-info">
                        <span className="fcst-upcoming-desc">{u.desc}</span>
                        <span className="fcst-upcoming-period">{u.period}</span>
                      </div>
                      <span className="fcst-upcoming-date">{fmtDate(u.due)}</span>
                      <span className={'fcst-upcoming-badge' + (u.daysUntil <= 7 ? ' urgent' : u.daysUntil <= 14 ? ' soon' : '')}>
                        {u.daysUntil === 0 ? 'Today' : u.daysUntil === 1 ? 'Tomorrow' : `in ${u.daysUntil}d`}
                      </span>
                      <span className="fcst-upcoming-amt">{incognito ? '••••' : fmtINR(u.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expenses.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>No forecast data yet</h3>
                <p>Add some expenses and recurring subscriptions to see your 30/60/90-day cash flow projection.</p>
                <button className="btn-primary btn-sm" onClick={() => setShowEF(true)}>➕ Add Expense</button>
              </div>
            )}
          </section>
        )
      })()}

      {/* ══════════ PLANNING sub-nav ══════════ */}
      {tab === 'planning' && (
        <div className="sub-nav-wrap">
          <div className="sub-nav" role="tablist">
            <button role="tab" aria-selected={planningTab === 'budgets'}
              className={'sub-nav-btn' + (planningTab === 'budgets' ? ' active' : '')}
              onClick={() => setPlanningTab('budgets')}>💰 Budgets</button>
            <button role="tab" aria-selected={planningTab === 'goals'}
              className={'sub-nav-btn' + (planningTab === 'goals' ? ' active' : '')}
              onClick={() => setPlanningTab('goals')}>🎯 Goals</button>
          </div>
        </div>
      )}

      {/* ══════════ BUDGETS ══════════ */}
      {tab === 'planning' && planningTab === 'budgets' && (
        <section role="tabpanel" className="tab-content-active">
          <div className="summary-grid">
            {[
              { val: fmtINR(spentToday), lbl: 'Today', color: budgets.daily > 0 ? (spentToday / budgets.daily >= 1 ? 'var(--color-exp)' : spentToday / budgets.daily >= 0.5 ? 'var(--color-warning)' : 'var(--color-inc)') : 'var(--text)' },
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
                  <input type="text" inputMode="decimal" placeholder="0 = off" className="budget-number-input"
                    value={focusedBudget === key
                      ? String((budgetDraft ?? budgets)[key] || '')
                      : fmtBudgetDisplay((budgetDraft ?? budgets)[key])}
                    onFocus={() => { setFocusedBudget(key); if (!budgetDraft) setBudgetDraft({ ...budgets, categories: { ...(budgets.categories || {}) } }) }}
                    onChange={e => setBudgetDraft(prev => ({ ...(prev ?? budgets), [key]: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 }))}
                    onBlur={() => { setFocusedBudget(null); if (budgetDraft) saveBudgets(budgetDraft) }} />
                </div>
              ))}
              <p className="budget-hint">Set to 0 to disable. Saves automatically.</p>
            </div>
            {(budgets.daily > 0 || budgets.weekly > 0 || budgets.monthly > 0) ? (
              <div className="chart-card">
                <div className="chart-title">📊 Budget vs Actual</div>
                <BudgetBar icon="📅" label="Daily"   spent={spentToday} budget={budgets.daily}    incognito={incognito} />
                <BudgetBar icon="🗓️" label="Weekly"  spent={spentWeek}  budget={budgets.weekly}  incognito={incognito} />
                <BudgetBar icon="📆" label="Monthly" spent={spentMonth} budget={budgets.monthly} incognito={incognito} />
              </div>
            ) : (
              <div className="chart-card">
                <div className="chart-title">📊 Budget vs Actual</div>
                <div className="empty-state-sm">
                  <p>Set a daily, weekly, or monthly limit on the left to track your progress here.</p>
                </div>
              </div>
            )}
          </div>

          <div className="chart-card">
            <div className="chart-title">📁 Per-Category Budgets — {new Date(monthStr + '-15T12:00:00').toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
            <div className="cat-budget-grid">
              {Object.keys(CATS).map(cat => {
                const catBgt         = budgets.categories?.[cat] || 0
                const catSpent       = spentByCatMonth[cat] || 0
                const rolloverOn     = budgets.rolloverEnabled?.[cat] || false
                const rolloverAmt    = rolloverAmounts[cat] || 0
                const effectiveBgt   = catBgt + (rolloverOn ? rolloverAmt : 0)
                return (
                  <div key={cat}>
                    <div className="budget-input-row">
                      <div className="budget-input-label-row">
                        <span className="budget-input-label">{CATS[cat].icon} {cat}</span>
                        <div className="rollover-controls">
                          {rolloverOn && rolloverAmt > 0 && (
                            <span className="rollover-badge">↻ +{fmtINR(rolloverAmt)}</span>
                          )}
                          <button
                            className={`rollover-toggle${rolloverOn ? ' active' : ''}`}
                            title={rolloverOn ? 'Rollover on — click to disable' : 'Enable rollover: unused budget carries to next month'}
                            onClick={() => {
                              const base = budgetDraft ?? budgets
                              const nb = { ...base, rolloverEnabled: { ...(base.rolloverEnabled || {}), [cat]: !rolloverOn } }
                              saveBudgets(nb)
                              if (budgetDraft) setBudgetDraft(nb)
                            }}
                          >↻</button>
                        </div>
                      </div>
                      <input type="text" inputMode="decimal" placeholder="0 = off" className="budget-number-input"
                        value={focusedBudget === `cat_${cat}`
                          ? String((budgetDraft ?? budgets).categories?.[cat] || '')
                          : fmtBudgetDisplay((budgetDraft ?? budgets).categories?.[cat])}
                        onFocus={() => { setFocusedBudget(`cat_${cat}`); if (!budgetDraft) setBudgetDraft({ ...budgets, categories: { ...(budgets.categories || {}) } }) }}
                        onChange={e => setBudgetDraft(prev => { const base = prev ?? budgets; return { ...base, categories: { ...(base.categories || {}), [cat]: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 } } })}
                        onBlur={() => { setFocusedBudget(null); if (budgetDraft) saveBudgets(budgetDraft) }} />
                    </div>
                    {(effectiveBgt > 0 || catSpent > 0) && (
                      <div style={{ paddingLeft: '1.5rem' }}>
                        <BudgetBar label={`${fmtINR(catSpent)} spent`} spent={catSpent} budget={effectiveBgt} incognito={incognito} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {!Object.values(budgets.categories || {}).some(v => v > 0) && (
              <p className="budget-hint" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                Enter an amount next to any category above to set a monthly limit for it.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ══════════ GOALS ══════════ */}
      {tab === 'planning' && planningTab === 'goals' && (() => {
        const totalTarget      = goalsWithContribs.reduce((s, g) => s + g.target, 0)
        const totalContributed = goalsWithContribs.reduce((s, g) => s + g.contributions.reduce((a, c) => a + c.amount, 0), 0)
        const overallPct       = totalTarget > 0 ? Math.min((totalContributed / totalTarget) * 100, 100) : 0
        const completedGoals   = goalsWithContribs.filter(g => g.contributions.reduce((s, c) => s + c.amount, 0) >= g.target).length
        return (
          <section role="tabpanel" className="tab-content-active">
            <div className="summary-grid">
              {[
                { val: goalsWithContribs.length, lbl: 'Total Goals', color: 'var(--color-brand)' },
                { val: completedGoals, lbl: 'Completed', color: 'var(--color-inc)' },
                { val: fmtINR(totalTarget), lbl: 'Total Target', color: 'var(--text)' },
                { val: fmtINR(totalContributed), lbl: 'Total Saved', color: 'var(--color-inc)' },
                { val: overallPct.toFixed(0) + '%', lbl: 'Overall', color: overallPct >= 100 ? 'var(--color-inc)' : overallPct >= 50 ? 'var(--color-warning)' : 'var(--color-brand)' },
              ].map(s => <div key={s.lbl} className="summary-card"><div className="summary-label">{s.lbl}</div><div className="summary-amount" style={{ color: s.color }}>{s.val}</div></div>)}
            </div>

            <div className="goals-grid">
              {goalsWithContribs.map(goal => {
                const contributed = goal.contributions.reduce((s, c) => s + c.amount, 0)
                const pct         = goal.target > 0 ? Math.min((contributed / goal.target) * 100, 100) : 0
                const done        = contributed >= goal.target
                const barColor    = done ? 'var(--color-inc)' : pct >= 75 ? 'var(--color-warning)' : 'var(--color-brand)'
                const daysLeft    = goal.targetDate ? Math.ceil((new Date(goal.targetDate + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 864e5) : null
                return (
                  <div key={goal.id} className={done ? 'goal-card goal-card-complete' : 'goal-card'}>
                    {/* ── Ring + meta ── */}
                    <div className="goal-card-top">
                      <div className="goal-ring-wrap">
                        <GoalRing pct={pct} color={barColor} />
                        <div className="goal-ring-pct" style={{ color: barColor }}>
                          {done ? '🏆' : `${pct.toFixed(0)}%`}
                        </div>
                      </div>
                      <div className="goal-meta">
                        <div className="goal-meta-top">
                          <div className="goal-name">{goal.icon || '🎯'} {goal.name}</div>
                          <div className="goal-card-actions">
                            {!done && <button className="goal-btn" onClick={() => setContribGoal(goal)}>+ Add</button>}
                            <button className="goal-btn goal-btn-del" onClick={() => deleteGoal(goal.id)}>✕</button>
                          </div>
                        </div>
                        <div className="goal-milestones">
                          {GOAL_MILESTONES.map(m => (
                            <span key={m.pct} className={`goal-milestone${pct >= m.pct ? ' earned' : ''}`}>
                              {m.icon} {m.pct}%
                            </span>
                          ))}
                        </div>
                        {!done && (
                          <div className="goal-countdown" style={{
                            color: daysLeft === null ? 'var(--text-muted)' : daysLeft < 0 ? 'var(--color-exp)' : daysLeft <= 7 ? 'var(--color-warning)' : 'var(--text-muted)'
                          }}>
                            {daysLeft === null
                              ? (goal.createdAt ? `Started ${goal.createdAt}` : 'No due date')
                              : daysLeft < 0 ? `⚠️ Overdue by ${Math.abs(daysLeft)}d`
                              : daysLeft === 0 ? '🔔 Due today!'
                              : daysLeft <= 7 ? `⏰ Only ${daysLeft}d left!`
                              : `📅 ${daysLeft} days left`}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* ── Amounts ── */}
                    <div className="goal-amounts-row">
                      <span className="goal-saved">{incognito ? '••••' : fmtINR(contributed)}</span>
                      <span className="goal-sep"> saved of </span>
                      <span className="goal-target-amt">{incognito ? '••••' : fmtINR(goal.target)}</span>
                    </div>
                    {!done && (
                      <div className="goal-remaining">
                        {incognito ? '••••' : fmtINR(goal.target - contributed)} to go
                        {daysLeft > 0 && !incognito && ` · ≈ ${fmtINR((goal.target - contributed) / daysLeft)}/day`}
                      </div>
                    )}
                    {/* ── Contribution timeline ── */}
                    {goal.contributions.length > 0 && (
                      <div className="goal-timeline">
                        <div className="goal-tl-header">Contributions ({goal.contributions.length})</div>
                        {[...goal.contributions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(c => (
                          <div key={c.id} className="goal-tl-item">
                            <div className="goal-tl-dot" style={{ background: barColor }} />
                            <div className="goal-tl-body">
                              <span className="contrib-date">{fmtDate(c.date)}</span>
                              <span className="contrib-amount">+{incognito ? '••••' : fmtINR(c.amount)}</span>
                              {c.note && <span className="contrib-note">{c.note}</span>}
                            </div>
                            <button className="contrib-del" onClick={() => deleteContribution(c.id)} aria-label="Remove contribution">✕</button>
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
              <div className="empty-state">
                <div className="empty-icon">🎯</div>
                <h3>No goals yet</h3>
                <p>Set a target — holiday fund, emergency buffer, new gadget. Progress toasts fire at 25%, 50%, 75%, and 100%.</p>
                <div className="empty-actions">
                  <button className="btn-primary" onClick={() => setShowGoalForm(true)}>+ New Goal</button>
                </div>
              </div>
            )}
          </section>
        )
      })()}

      {/* ══════════ INSIGHTS ══════════ */}
      {tab === 'analytics' && analyticsTab === 'insights' && (
        <section role="tabpanel" className="tab-content-active">
          {/* Financial Health Score */}
          <HealthScoreCard score={healthScore.score} breakdown={healthScore.breakdown} incognito={incognito} />

          {/* Anomaly Detection */}
          {AnomalyPanel(expenses, anomalyHistory, fmtINR)}

          {/* Spend breakdown charts */}
          {catData.length > 0 && (
            <div className="chart-row" style={{ marginBottom: '1rem' }}>
              <div className="chart-card"><div className="chart-title">By Category</div><PieChart data={catData} incognito={incognito} /></div>
              <div className="chart-card"><div className="chart-title">By Payment</div><PieChart data={payData} incognito={incognito} /></div>
            </div>
          )}

          {expenses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💡</div>
              <h3>No data yet</h3>
              <p>Add a few expenses and insights will appear here — anomalies, top categories, spending patterns, and more.</p>
              <div className="empty-actions">
                <button className="btn-primary" onClick={() => setShowEF(true)}>➕ Add Expense</button>
              </div>
            </div>
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
                  <BarChart incognito={incognito} data={expTypeData.map((d, i) => ({ ...d, _color: ['var(--color-brand)','var(--color-inc)','var(--color-exp)','var(--color-warning)','#8b5cf6','#ec4899'][i % 6] }))} />
                </div>
              )}

              {/* Dining App Breakdown */}
              {diningData.length > 0 && (
                <div className="chart-card" style={{ marginTop: 16 }}>
                  <div className="chart-title">🍔 Dining App Breakdown</div>
                  <BarChart incognito={incognito} data={diningData.map((d, i) => ({ ...d, _color: CC[(i * 7) % CC.length] }))} />
                </div>
              )}

              {/* Tags Breakdown */}
              {tagsData.length > 0 && (
                <div className="chart-card" style={{ marginTop: 16 }}>
                  <div className="chart-title">🏷️ Tags Breakdown</div>
                  <BarChart incognito={incognito} data={tagsData.map((d, i) => ({ ...d, _color: CC[(i * 11) % CC.length] }))} />
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
        </section>
      )}

      {/* ── Trips tab ── */}
      {tab === 'trips' && (
        <section role="tabpanel" className="tab-content-active">
          {/* Header row */}
          <div className="trips-header">
            <div>
              <h2 className="trips-heading">✈️ Trips</h2>
              <p className="trips-subheading">Auto-links expenses by date range + currency — no manual tagging needed.</p>
            </div>
            <button className="btn-primary" onClick={() => { setEditingTrip(null); setTripFormName(''); setTripFormStart(''); setTripFormEnd(''); setTripFormCur('USD'); setTripFormNotes(''); setShowTripForm(true) }}>+ New Trip</button>
          </div>

          {/* Add / Edit form */}
          {showTripForm && (
            <div className="card trip-form-card">
              <div className="card-title">{editingTrip ? '✏️ Edit Trip' : '✈️ New Trip'}</div>
              <div className="trip-form-grid">
                <label className="form-label">Trip name
                  <input className="form-input" placeholder="e.g. Melbourne Apr 2026" value={tripFormName} onChange={e => setTripFormName(e.target.value)} />
                </label>
                <label className="form-label">Currency
                  <select className="form-input" value={tripFormCur} onChange={e => setTripFormCur(e.target.value)}>
                    {Object.entries(CG).map(([group, list]) => (
                      <optgroup key={group} label={group}>
                        {list.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="form-label">Start date
                  <input type="date" className="form-input" value={tripFormStart} onChange={e => setTripFormStart(e.target.value)} />
                </label>
                <label className="form-label">End date
                  <input type="date" className="form-input" value={tripFormEnd} onChange={e => setTripFormEnd(e.target.value)} />
                </label>
                <label className="form-label trip-notes-label">Notes (optional)
                  <input className="form-input" placeholder="Hotel name, purpose…" value={tripFormNotes} onChange={e => setTripFormNotes(e.target.value)} />
                </label>
              </div>
              {tripFormStart && tripFormEnd && tripFormStart > tripFormEnd && (
                <div className="trip-form-error">End date must be on or after start date.</div>
              )}
              <div className="trip-form-actions">
                <button className="btn-primary" onClick={submitTripForm} disabled={!tripFormName.trim() || !tripFormStart || !tripFormEnd || tripFormStart > tripFormEnd}>
                  {editingTrip ? 'Save changes' : 'Create trip'}
                </button>
                <button className="btn-ghost" onClick={() => { setShowTripForm(false); setEditingTrip(null) }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Trip cards */}
          {tripsWithData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✈️</div>
              <h3>No trips yet</h3>
              <p>Create a trip and all expenses matching the dates + currency are tallied automatically.</p>
              <button className="btn-primary" onClick={() => setShowTripForm(true)}>+ New Trip</button>
            </div>
          ) : (
            <div className="trips-grid">
              {tripsWithData.map(trip => {
                const isExpanded = expandedTripId === trip.id
                const cur        = CM[trip.currency] || { flag: '🌍', symbol: trip.currency, code: trip.currency }
                // YYYY-MM-DD string comparison is safe — lexicographic order matches chronological order
                const fmtAmt     = n => incognito ? '••••' : (cur.symbol + parseFloat(n).toLocaleString(_localeFor(cur.code || 'INR'), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                const statusCl   = trip.status === 'active' ? 'trip-badge-active' : trip.status === 'upcoming' ? 'trip-badge-upcoming' : 'trip-badge-done'
                const statusTx   = trip.status === 'active' ? '● Active' : trip.status === 'upcoming' ? '◷ Upcoming' : '✓ Completed'
                const nights     = Math.round((new Date(trip.endDate + 'T12:00:00') - new Date(trip.startDate + 'T12:00:00')) / 864e5) + 1
                const sortedExps = [...trip.matched].sort((a, b) => b.date.localeCompare(a.date))
                return (
                  <div key={trip.id} className={`trip-card${trip._pending ? ' trip-card-pending' : ''}${isExpanded ? ' trip-card-expanded' : ''}`}>

                    {/* Clickable header — toggles expense list */}
                    <div className="trip-card-top trip-card-top-clickable" role="button" tabIndex={0}
                      onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpandedTripId(isExpanded ? null : trip.id)}>
                      <div className="trip-card-title-row">
                        <span className="trip-card-name">{trip.name}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className={`trip-status-badge ${statusCl}`}>{statusTx}</span>
                          <span className="trip-chevron">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      <div className="trip-card-meta">
                        <span>{trip.startDate} → {trip.endDate}</span>
                        <span className="trip-meta-dot">·</span>
                        <span>{nights} day{nights !== 1 ? 's' : ''}</span>
                        <span className="trip-meta-dot">·</span>
                        <span>{cur.flag} {cur.code}</span>
                      </div>
                    </div>

                    {/* Summary body — always visible */}
                    <div className="trip-card-body">
                      {trip.totalOriginal > 0 ? (
                        <>
                          <div className="trip-total">{fmtAmt(trip.totalOriginal)}</div>
                          <div className="trip-total-sub">
                            {trip.currency !== 'INR' && <span>≈ {fmtINR(trip.totalINR)}</span>}
                            <span className="trip-meta-dot">·</span>
                            <span>{trip.matched.length} expense{trip.matched.length !== 1 ? 's' : ''}</span>
                            <span className="trip-meta-dot">·</span>
                            <span style={{ color: 'var(--color-exp)' }}>{fmtAmt(trip.totalOriginal / Math.max(nights, 1))}/day</span>
                          </div>
                          {trip.topCats.length > 0 && (
                            <div className="trip-cats">
                              {trip.topCats.map(c => (
                                <span key={c.cat} className="trip-cat-chip">
                                  {CATS[c.cat]?.icon || '📦'} {c.cat} <span className="trip-cat-pct">{c.pct}%</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="trip-empty-body">
                          <span className="trip-empty-icon">🔍</span>
                          <span>No {cur.code} expenses found for these dates yet</span>
                        </div>
                      )}
                      {trip.notes && <div className="trip-notes">{trip.notes}</div>}
                    </div>

                    {/* Expanded expense list — auto-updates when expenses state changes */}
                    {isExpanded && (
                      <div className="trip-expense-list">
                        {sortedExps.length > 0 ? (
                          <>
                            <div className="trip-exp-header">
                              <span>Date</span>
                              <span>Category</span>
                              <span>Description</span>
                              <span className="trip-exp-right">Amount</span>
                            </div>
                            {sortedExps.map(e => (
                              <div key={e.id} className="trip-exp-row">
                                <span className="trip-exp-date">{fmtDate(e.date)}</span>
                                <span className="trip-exp-cat">{CATS[e.category]?.icon || '📦'} {e.category || 'Other'}</span>
                                <span className="trip-exp-desc" title={e.description}>{e.description}</span>
                                <span className="trip-exp-amt trip-exp-right">{fmtAmt(e.amount)}</span>
                              </div>
                            ))}
                            <div className="trip-exp-total">
                              <span style={{ gridColumn: '1 / 3' }}>Total · {sortedExps.length} expense{sortedExps.length !== 1 ? 's' : ''}</span>
                              <span></span>
                              <span className="trip-exp-right">{fmtAmt(trip.totalOriginal)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="trip-exp-none">No {cur.code} expenses in this date range yet. Add expenses and they'll appear here automatically.</div>
                        )}
                      </div>
                    )}

                    <div className="trip-card-actions">
                      <button className="btn-ghost btn-sm" onClick={() => openEditTrip(trip)}>✏️ Edit</button>
                      <button className="btn-ghost btn-sm" onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}>
                        {isExpanded ? '▲ Collapse' : '▼ Show expenses'}
                      </button>
                      <button className="btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => deleteTrip(trip.id)}>🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Exchange tab ── */}
      {tab === 'exchange' && (
        <section role="tabpanel" className="tab-content-active">

          {/* ── Base currency info ── */}
          <div className="fx-info-tile">
            <div>
              <div className="bento-label">Base Currency</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)', marginTop: 4 }}>
                {(CM[baseCurrency] || CM['INR']).flag} {baseCurrency} — {(CM[baseCurrency] || CM['INR']).name}
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {rateData && <span className="rate-badge" style={{ marginRight: 6 }}>{rsLabel}</span>}
                {rateData?.ts ? `Updated ${new Date(rateData.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Not loaded'}
                {rateData?.source === 'fallback' && <span style={{ color: 'var(--color-exp)', marginLeft: 6 }}>⚠️ Fallback rates</span>}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>{CURRENCIES.length} currencies · {Object.keys(CG).length} regions</div>
              <button className="btn-primary btn-sm" onClick={refreshRates} disabled={rateFetching}>
                {rateFetching ? '⏳ Fetching…' : '🔄 Refresh'}
              </button>
            </div>
          </div>

          {/* ── Quick Converter ── */}
          <div className="fx-converter">
            <div className="chart-title" style={{ marginBottom: '1rem' }}>Quick Converter</div>
            <div className="fx-conv-grid">
              <div>
                <div className="fx-conv-label">Amount</div>
                <input type="number" className="fx-conv-input" value={fxConvAmount} min="0" onChange={e => setFxConvAmount(e.target.value)} />
                <select className="fx-conv-select" value={fxConvFrom} onChange={e => setFxConvFrom(e.target.value)}>
                  {Object.entries(CG).map(([grp, curs]) => (
                    <optgroup key={grp} label={grp}>
                      {curs.filter(c => c.code !== baseCurrency).map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="fx-conv-arrow">⇄</div>
              <div>
                <div className="fx-conv-label">Converts to</div>
                {rateData?.rates?.[fxConvFrom] ? (
                  <>
                    <div className="fx-conv-result">
                      {(CM[baseCurrency] || CM['INR']).symbol} {(parseFloat(fxConvAmount || 0) * rateData.rates[fxConvFrom]).toLocaleString(_localeFor(baseCurrency), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6 }}>
                      1 {fxConvFrom} = {(CM[baseCurrency] || CM['INR']).symbol}{rateData.rates[fxConvFrom].toLocaleString(_localeFor(baseCurrency), { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      &nbsp;·&nbsp;
                      1 {baseCurrency} = {(1 / rateData.rates[fxConvFrom]).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 5 })} {fxConvFrom}
                    </div>
                  </>
                ) : (
                  <div className="fx-conv-result" style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>— loading —</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Search ── */}
          <input
            className="fx-search-bar"
            placeholder="🔍 Search by currency name or code…"
            value={fxSearch}
            onChange={e => setFxSearch(e.target.value)}
          />

          {/* ── Currency table ── */}
          <div className="fx-tbl-outer">
            <div className="fx-tbl-scroll">
              <div className="fx-tbl-hdr">
                <div>Code</div>
                <div>Currency</div>
                <div style={{ textAlign: 'right' }}>1 Foreign → {baseCurrency}</div>
                <div style={{ textAlign: 'right' }}>1 {baseCurrency} → Foreign</div>
              </div>
              {rateData?.rates ? (
                Object.entries(CG).map(([grp, curs]) => {
                  const filtered = curs.filter(c => {
                    if (c.code === baseCurrency) return false
                    if (!fxSearch) return true
                    const q = fxSearch.toLowerCase()
                    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
                  })
                  if (filtered.length === 0) return null
                  return (
                    <div key={grp}>
                      <div className="fx-grp-hdr">{grp} ({filtered.length})</div>
                      {filtered.map(c => {
                        const inrFactor = baseCurrency === 'INR' ? 1 : (rateData.rates['INR'] || 0)
                        const cryptoInr = c.code === 'BTC' ? cryptoRates.btcInr : c.code === 'ETH' ? cryptoRates.ethInr : 0
                        const rate = (c.code === 'BTC' || c.code === 'ETH')
                          ? (cryptoInr && inrFactor ? cryptoInr * inrFactor : 0)
                          : rateData.rates[c.code]
                        const inv = rate ? 1 / rate : 0
                        const fmtInv = inv < 0.00001
                          ? inv.toExponential(4)
                          : inv.toLocaleString(undefined, { minimumFractionDigits: inv < 0.01 ? 8 : 4, maximumFractionDigits: inv < 0.01 ? 8 : 5 })
                        return (
                          <div key={c.code} className="fx-row-item">
                            <div className="fx-code-wrap"><span className="fx-flag-ico">{c.flag}</span><span className="fx-code-lbl">{c.code}</span></div>
                            <div className="fx-cur-name">{c.name}</div>
                            <div style={{ textAlign: 'right', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)' }}>
                              {rate ? `${(CM[baseCurrency] || CM['INR']).symbol}${rate.toLocaleString(_localeFor(baseCurrency), { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : ''}
                            </div>
                            <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                              {rate ? fmtInv : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              ) : (
                <div className="empty-state"><div className="empty-icon">🔄</div><h3>Loading rates…</h3></div>
              )}
            </div>
          </div>

        </section>
      )}

      {/* ── Settings tab ── */}
      {tab === 'settings' && (
        <section role="tabpanel" className="tab-content-active">
          {/* Security */}
          <BiometricSettings session={session} />

          {/* App Update */}
          <div className="settings-section">
            <h3><span aria-hidden="true">🔄</span> App Update</h3>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Force Update</strong>
                <span>Clears the app cache and reloads to get the latest version. Use this if the update banner doesn't appear.</span>
              </div>
              <button className="btn-primary" onClick={() => window.__forceAppUpdate && window.__forceAppUpdate()}>Update Now</button>
            </div>
          </div>

          {/* Appearance */}
          <div className="settings-section">
            <h3><span aria-hidden="true">🎨</span> Appearance</h3>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Theme</strong>
                <span>Light, dark, or follow your system setting. Shortcut: D key.</span>
              </div>
              <div className="theme-seg">
                {[['light','☀️ Light'],['system','🖥️ System'],['dark','🌙 Dark']].map(([m,label]) => (
                  <button key={m} className={'theme-seg-btn' + (themeMode === m ? ' active' : '')}
                    onClick={() => setTheme(m)}>{label}</button>
                ))}
              </div>
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
            <h3><span aria-hidden="true">💱</span> Base Currency</h3>
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
            <h3><span aria-hidden="true">📊</span> Data Summary</h3>
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
            <h3><span aria-hidden="true">💡</span> Safe-to-Spend</h3>
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
            <h3><span aria-hidden="true">🔄</span> Exchange Rates</h3>
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
            <h3><span aria-hidden="true">🔔</span> Recurring Reminders</h3>
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
            <h3><span aria-hidden="true">📤</span> Export Data</h3>
            <p className="settings-desc">Download a copy of all your data. JSON is a full backup; CSV is for spreadsheets (expenses only).</p>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Monthly PDF Report</strong>
                <span>Formatted report for {(() => { const [y,m] = monthStr.split('-'); return new Date(+y,+m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'}) })()} — cover, category breakdown, all transactions.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-primary btn-sm" onClick={() => handleExportPDF(monthStr)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileDown size={14} />Download
                </button>
                <button className="btn-secondary btn-sm" onClick={() => handleEmailPDF(monthStr)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={14} />Email to me
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">
                <strong>Export as JSON</strong>
                <span>Full backup — {expenses.length} expenses + {income.length} income. Re-importable.</span>
              </div>
              <button className="btn-ghost btn-sm" onClick={handleExportJSON}>Download JSON</button>
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
            <h3><span aria-hidden="true">📥</span> Import Data</h3>
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
            <h3><span aria-hidden="true">🔀</span> Migrate from V5</h3>
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
            <h3><span aria-hidden="true">🚨</span> Danger Zone</h3>
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
              <div className="about-title" style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}><Zap size={18} color="var(--primary)" />Expense Tracker V7</div>
              <div className="about-meta">
                <span className="about-badge">v7.33.0</span>
                <span className="about-badge">32 Phases Complete</span>
                <span className="about-badge">Glass UI</span>
                <span className="about-badge">Bento Dashboard</span>
                <span className="about-badge">⌘K Palette</span>
                <span className="about-badge">Bottom Nav</span>
                <span className="about-badge">122 Currencies</span>
                <span className="about-badge">BTC · ETH Live</span>
                <span className="about-badge">Cloud + Supabase</span>
                <span className="about-badge">PWA</span>
                <span className="about-badge">Health Score</span>
                <span className="about-badge">Onboarding</span>
                <span className="about-badge">Budget Rollover</span>
                <span className="about-badge">Goal Rings</span>
                <span className="about-badge">Templates</span>
                <span className="about-badge">Bulk Edit</span>
                <span className="about-badge">Subscription Tracker</span>
                <span className="about-badge">Spend Streak</span>
                <span className="about-badge">Merchant Analytics</span>
                <span className="about-badge">Cash Flow Forecast</span>
                <span className="about-badge">PDF Reports</span>
                <span className="about-badge">NL Search</span>
                <span className="about-badge">Email Share</span>
              </div>
              <div className="about-row"><span>Architecture</span><span>Vite + React 18 + Supabase · deployed on Vercel</span></div>
              <div className="about-row"><span>Auth</span><span>Magic-link email · WebAuthn biometric lock · Email OTP fallback</span></div>
              <div className="about-row"><span>Database</span><span>Supabase Postgres + RLS · SQL views for aggregations · dependency-ordered offline sync</span></div>
              <div className="about-row"><span>Security</span><span>Server-enforced biometric lock · alphanumeric OTP · rate limiting · RLS on all tables · HTTP security headers</span></div>
              <div className="about-row"><span>UI</span><span>Glassmorphism shell · Bento grid dashboard · 30-day sparkline · category tiles · month picker · system / light / dark theme · FOUC prevention · locale-aware number formatting</span></div>
              <div className="about-row"><span>Navigation</span><span>8 tabs · Analytics sub-nav (Insights | Trends | Merchants | Forecast) · Planning sub-nav (Budgets | Goals) · ⌘K command palette · keyboard shortcuts 1–8</span></div>
              <div className="about-row"><span>Mobile</span><span>Bottom nav + FAB · More sheet · slide-up drawers · swipe to delete/edit · haptic feedback · safe-area insets · iOS zoom fix · touch targets · overscroll containment</span></div>
              <div className="about-row"><span>Analytics</span><span>Financial Health Score (0–100 animated ring, 4 sub-scores) · grouped bar chart · category trends · MoM savings rate · anomaly detection · Merchant Analytics · Cash Flow Forecast (30/60/90d)</span></div>
              <div className="about-row"><span>Planning</span><span>Budget rollover (unused carries to next month, per-category toggle) · goal progress rings · milestone badges (🥉🥈🥇🏆) · contribution timeline · colour-coded countdown</span></div>
              <div className="about-row"><span>Onboarding</span><span>5-step wizard (name · currency · budget · notifications · done) · first-run empty states with CTAs · user_metadata persisted to Supabase</span></div>
              <div className="about-row"><span>Exchange</span><span>122 currencies in 8 regions · live FX rates · quick converter · BTC + ETH via CoinGecko · search filter</span></div>
              <div className="about-row"><span>Features</span><span>Expense templates · bulk edit · subscription tracker · spend streak + gamification · receipt OCR · PDF monthly reports · natural language search · email share (PDF + receipt) · trip tracking · fuel tracking · incognito mode · 259-colour palette</span></div>
              <div className="about-row"><span>Performance</span><span>Initial JS 214 kB gzip · jsPDF + pdfjs deferred · vendor chunks cached separately · 53% bundle reduction vs v7.32</span></div>
              <div className="about-row"><span>PWA</span><span>Installable · offline-capable · auto-update with force-reload banner · iOS Safari compatible</span></div>
              <div className="about-row"><span>Last updated</span><span>2026-06-03 · Session 48 · v7.33.0 · All 32 phases complete</span></div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════ RECURRING ══════════ */}
      {tab === 'recurring' && (() => {
        const SUB_CATS = new Set(['OTT/Streaming', 'Streaming', 'Subscriptions', 'Software', 'Gaming', 'Cable', 'Music', 'Cloud Storage', 'News', 'Fitness'])
        const SUB_CAT_GROUPS = new Set(['Entertainment', 'Technology'])
        const recurExp = expenses.filter(e => e.isRecurring)
        const recurInc = income.filter(i => i.isRecurring)

        function isSubType(e) {
          if (SUB_CATS.has(e.subcategory)) return true
          if (SUB_CAT_GROUPS.has(e.category) && (e.recurringPeriod === 'monthly' || e.recurringPeriod === 'yearly')) return true
          return false
        }
        const subExp   = recurExp.filter(e => isSubType(e))
        const otherExp = recurExp.filter(e => !isSubType(e))

        const subMonthlyTotal  = subExp.reduce((s, e)   => s + monthlyEquiv(toINR(e), e.recurringPeriod), 0)
        const otherMonthlyTotal = otherExp.reduce((s, e) => s + monthlyEquiv(toINR(e), e.recurringPeriod), 0)
        const totalMonthly     = subMonthlyTotal + otherMonthlyTotal

        // Cancel-risk = recurring but no charge in 45+ days (reuse zombie data)
        const zombieSet = new Set(subZombieData.zombies.map(z => z.desc.toLowerCase().trim()))
        const creepMap  = {}
        subZombieData.creep.forEach(c => { creepMap[c.desc.toLowerCase().trim()] = c.pct })

        function daysUntil(d) {
          if (!d) return null
          return Math.round((new Date(d + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000)
        }
        function dueBadge(d) {
          const n = daysUntil(d)
          if (n === null) return { label: 'No due date', cls: 'due-muted' }
          if (n < 0)  return { label: `${Math.abs(n)}d overdue`, cls: 'due-overdue' }
          if (n === 0) return { label: 'Due today',   cls: 'due-urgent' }
          if (n <= 3)  return { label: `In ${n}d`,    cls: 'due-urgent' }
          if (n <= 7)  return { label: `In ${n}d`,    cls: 'due-soon' }
          return { label: `In ${n}d`, cls: 'due-muted' }
        }

        function renderSubCard(e) {
          const amtINR   = toINR(e)
          const moAmt    = monthlyEquiv(amtINR, e.recurringPeriod)
          const due      = dueBadge(e.nextDueDate)
          const key      = (e.description || '').toLowerCase().trim()
          const isZombie = zombieSet.has(key)
          const creepPct = creepMap[key]
          return (
            <div key={e.id} className={'sub-card' + (isZombie ? ' sub-card-zombie' : '')}>
              <div className="sub-card-left">
                <div className="sub-card-name">
                  {e.description}
                  {isZombie && <span className="sub-risk-badge">⚠️ Cancel risk</span>}
                  {creepPct && <span className="sub-creep-badge">+{creepPct}%</span>}
                </div>
                <div className="sub-card-meta">
                  <span>{CATS[e.category]?.icon || '📦'} {e.subcategory || e.category || 'Other'}</span>
                  <span className="rec-period-badge">{e.recurringPeriod || 'monthly'}</span>
                </div>
              </div>
              <div className="sub-card-right">
                <div className="sub-card-amount">{fmtINR(amtINR)}</div>
                {e.recurringPeriod !== 'monthly' && (
                  <div className="sub-card-monthly">{fmtINR(moAmt)}/mo</div>
                )}
                <div className={'sub-card-due ' + due.cls}>{due.label}</div>
              </div>
            </div>
          )
        }

        function renderRecRow(e) {
          const due = dueBadge(e.nextDueDate)
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
                <div className={'rec-due ' + due.cls}>{due.label}</div>
              </div>
            </div>
          )
        }

        const cancelRisks = subZombieData.zombies

        return (
          <section role="tabpanel" className="tab-content-active">
            {recurExp.length === 0 && recurInc.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No recurring items yet</h3>
                <p>Tick "Recurring" when adding an expense or income — rent, salary, subscriptions. They'll appear here with due dates and cancel-risk detection.</p>
                <div className="empty-actions">
                  <button className="btn-primary btn-sm" onClick={() => setShowEF(true)}>➕ Add Expense</button>
                  <button className="btn-income btn-sm"  onClick={() => setShowIF(true)}>💵 Add Income</button>
                </div>
              </div>
            ) : (
              <>
                {/* Summary tiles */}
                <div className="sub-summary-row">
                  <div className="sub-summary-tile">
                    <div className="sub-summary-val">{fmtINR(totalMonthly)}</div>
                    <div className="sub-summary-lbl">per month</div>
                  </div>
                  <div className="sub-summary-tile">
                    <div className="sub-summary-val">{recurExp.length}</div>
                    <div className="sub-summary-lbl">active</div>
                  </div>
                  <div className="sub-summary-tile">
                    <div className="sub-summary-val">{fmtINR(totalMonthly * 12)}</div>
                    <div className="sub-summary-lbl">per year</div>
                  </div>
                  {cancelRisks.length > 0 && (
                    <div className="sub-summary-tile sub-summary-tile-risk">
                      <div className="sub-summary-val">{cancelRisks.length}</div>
                      <div className="sub-summary-lbl">cancel risk</div>
                    </div>
                  )}
                </div>

                {/* Cancel-risk alert */}
                {cancelRisks.length > 0 && (
                  <div className="sub-zombie-banner">
                    <div className="sub-zombie-title">⚠️ {cancelRisks.length} Cancel Risk{cancelRisks.length !== 1 ? 's' : ''} — marked recurring but no charge in 45+ days</div>
                    <div className="sub-zombie-list">
                      {cancelRisks.map((z, i) => (
                        <div key={i} className="sub-zombie-row">
                          <span className="sub-zombie-desc">{z.desc}</span>
                          <span className="sub-zombie-meta">{fmtINR(z.avgAmt)}/charge · last {z.daysSinceLast}d ago</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subscriptions */}
                {subExp.length > 0 && (
                  <div className="rec-section">
                    <div className="rec-section-title">Subscriptions ({subExp.length}) · {fmtINR(subMonthlyTotal)}/mo</div>
                    {subExp.map(e => renderSubCard(e))}
                  </div>
                )}

                {/* Other recurring expenses */}
                {otherExp.length > 0 && (
                  <div className="rec-section" style={{ marginTop: subExp.length ? 12 : 0 }}>
                    <div className="rec-section-title">Other Recurring ({otherExp.length}) · {fmtINR(otherMonthlyTotal)}/mo</div>
                    {otherExp.map(e => renderRecRow(e))}
                  </div>
                )}

                {/* Recurring income */}
                {recurInc.length > 0 && (
                  <div className="rec-section" style={{ marginTop: 12 }}>
                    <div className="rec-section-title">Recurring Income ({recurInc.length}) · +{fmtINR(recurInc.reduce((s, i) => s + monthlyEquiv(toINR(i), i.recurringPeriod), 0))}/mo</div>
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
                  </div>
                )}
              </>
            )}
          </section>
        )
      })()}

      {/* ── Modals ── */}
      <CommandPalette open={showCmd} onClose={() => setShowCmd(false)} commands={cmdCommands} />
      {showEF && <ExpenseForm initialData={editExpTarget} onSubmit={editExpTarget ? handleEditExpense : handleAddExpense} onClose={() => { setShowEF(false); setEditExpTarget(null) }} rateData={rateData} />}
      {showIF && <IncomeForm  initialData={editIncTarget} onSubmit={editIncTarget ? handleEditIncome  : handleAddIncome}  onClose={() => { setShowIF(false); setEditIncTarget(null) }} rateData={rateData} />}
      {delTarget && <ConfirmDialog message={delTarget.many ? `Permanently delete ${Object.keys(delTarget.ids).length} expenses?` : `Delete this ${delTarget.type}? Cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDelTarget(null)} />}
      {confirmAction && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmAction(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2>{confirmAction.type === 'factory-reset' ? '🏭' : '🗑️'} {confirmAction.label}</h2>
              <button className="modal-close" onClick={() => setConfirmAction(null)} aria-label="Close">✕</button>
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

      {conflicts.length > 0 && (
        <ConflictModal
          conflicts={conflicts}
          onResolve={resolveConflict}
          onDismiss={dismissConflict}
        />
      )}

      {/* ── Bottom nav — mobile only ── */}
      <nav className="bnav" aria-label="Bottom navigation">
        {[
          { id: 'overview', Icon: Home,        label: 'Home' },
          { id: 'income',   Icon: IncomeIcon,  label: 'Income' },
        ].map(t => (
          <button key={t.id} className={'bnav-btn' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}>
            <span className="bnav-icon"><t.Icon size={20} /></span>
            <span className="bnav-label">{t.label}</span>
          </button>
        ))}
        <button className="bnav-fab" onClick={() => setShowEF(true)} aria-label="Add expense">＋</button>
        <button className={'bnav-btn' + (tab === 'analytics' ? ' active' : '')}
          onClick={() => setTab('analytics')}>
          <span className="bnav-icon"><TrendingUp size={20} /></span>
          <span className="bnav-label">Analytics</span>
        </button>
        <button className={'bnav-btn' + (['planning','recurring','trips','exchange','settings'].includes(tab) ? ' active' : '')}
          onClick={() => setShowMore(true)}>
          <span className="bnav-icon"><Menu size={20} /></span>
          <span className="bnav-label">More</span>
        </button>
      </nav>

      {/* ── More bottom sheet ── */}
      {(showMore || closingSheet) && (
        <>
          <div className={'bsheet-overlay' + (closingSheet ? ' exiting' : '')} onClick={closeSheet} />
          <div className={'bsheet' + (closingSheet ? ' exiting' : '')} role="dialog" aria-label="More navigation">
            <div className="bsheet-handle" />
            <div className="bsheet-grid">
              {[
                { id: 'planning',  Icon: ClipboardList,  label: 'Planning' },
                { id: 'recurring', Icon: RefreshCw,      label: 'Recurring' },
                { id: 'trips',     Icon: Plane,          label: 'Trips' },
                { id: 'exchange',  Icon: ArrowLeftRight, label: 'FX' },
                { id: 'settings',  Icon: Settings,       label: 'Settings' },
              ].map(({ id, Icon, label }) => (
                <button key={id} className={'bsheet-btn' + (tab === id ? ' active' : '')}
                  onClick={() => { setTab(id); closeSheet() }}>
                  <span className="bsheet-icon"><Icon size={22} /></span>
                  <span className="bsheet-label">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
