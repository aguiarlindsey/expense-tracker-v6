import { useState } from 'react'
import {
  Zap, User, ArrowLeftRight, Calendar, Bell, BellOff, CheckCircle2,
  BarChart2, Wallet, Target, Plane, Mail, AlertTriangle, SkipForward,
} from 'lucide-react'
import { supabase } from '../utils/supabase'
import { CURRENCIES } from '../utils/constants'
import { useNotifications } from '../hooks/useNotifications'

const _SA = new Set(['INR','NPR','LKR','BDT','PKR'])
function _localeFor(code) { return _SA.has(code) ? 'en-IN' : 'en-US' }

const STEPS = 5  // 0=welcome, 1=name, 2=currency, 3=budget, 4=notifications, 5=done

export default function OnboardingWizard({ session, onComplete }) {
  const [step, setStep]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm]   = useState({
    displayName:   '',
    baseCurrency:  'INR',
    monthlyBudget: '',
  })
  const [notifStatus, setNotifStatus] = useState(null) // null | 'granted' | 'denied' | 'skipped'
  const { requestAndSubscribe, loading: notifLoading } = useNotifications(session.user.id)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function next() { setStep(s => s + 1) }
  function back() { setStep(s => s - 1) }

  async function handleEnableNotifications() {
    await requestAndSubscribe()
    const result = typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    setNotifStatus(result === 'granted' ? 'granted' : 'denied')
    next()
  }

  async function handleFinish() {
    setSaving(true)

    const meta = { onboarded: true }
    if (form.displayName.trim()) meta.display_name = form.displayName.trim()
    meta.base_currency = form.baseCurrency
    await supabase.auth.updateUser({ data: meta })

    localStorage.setItem('et_v6_base', form.baseCurrency)

    const budget = parseFloat(form.monthlyBudget)
    if (budget > 0) {
      await supabase.from('budgets').upsert({
        user_id:    session.user.id,
        daily:      0,
        weekly:     0,
        monthly:    budget,
        categories: {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }

    setSaving(false)
    onComplete()
  }

  const currencyObj = CURRENCIES.find(c => c.code === form.baseCurrency) || CURRENCIES[0]
  const progressPct = step === 0 ? 0 : step >= STEPS ? 100 : Math.round(((step) / (STEPS - 1)) * 100)

  function notifStatusDisplay() {
    if (notifStatus === 'granted')  return <><BellOff size={14} style={{display:'inline',verticalAlign:'middle',marginRight:4}} />Enabled</>
    if (notifStatus === 'denied')   return <><BellOff size={14} style={{display:'inline',verticalAlign:'middle',marginRight:4}} />Blocked by browser</>
    return <><SkipForward size={14} style={{display:'inline',verticalAlign:'middle',marginRight:4}} />Skipped</>
  }

  return (
    <div className="onb-shell">
      <div className="onb-card">

        {step > 0 && step < STEPS && (
          <div className="onb-progress">
            <div className="onb-progress-fill" style={{ '--fill': progressPct / 100 }} />
          </div>
        )}

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className="onb-step">
            <div className="onb-logo"><Zap size={48} strokeWidth={1.5} /></div>
            <h1 className="onb-title">Welcome to Expense Tracker</h1>
            <p className="onb-sub">
              Hi <strong>{session.user.email.split('@')[0]}</strong> — let's get you set up in under 2 minutes.
            </p>
            <div className="onb-feature-list">
              <div className="onb-feature">
                <BarChart2 size={16} className="onb-feature-icon" />
                Track every expense with smart categories
              </div>
              <div className="onb-feature">
                <Wallet size={16} className="onb-feature-icon" />
                Set budgets and get alerted before you overspend
              </div>
              <div className="onb-feature">
                <Target size={16} className="onb-feature-icon" />
                Create savings goals and track progress
              </div>
              <div className="onb-feature">
                <Plane size={16} className="onb-feature-icon" />
                Organise expenses by trips
              </div>
            </div>
            <button className="onb-btn-primary" onClick={next}>Get Started →</button>
            <button className="onb-btn-skip" onClick={onComplete}>Skip setup, take me to the app</button>
          </div>
        )}

        {/* ── Step 1: Name ── */}
        {step === 1 && (
          <div className="onb-step">
            <div className="onb-step-icon"><User size={36} strokeWidth={1.5} /></div>
            <h2 className="onb-step-title">What should we call you?</h2>
            <p className="onb-step-sub">Used for your personal greeting. Optional.</p>
            <input
              className="onb-input"
              type="text"
              placeholder="Your name"
              value={form.displayName}
              onChange={e => set('displayName', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && next()}
              autoFocus
              maxLength={40}
            />
            <button className="onb-btn-primary" onClick={next}>
              {form.displayName.trim() ? 'Continue →' : 'Skip →'}
            </button>
            <button className="onb-btn-back" onClick={back}>← Back</button>
          </div>
        )}

        {/* ── Step 2: Base Currency ── */}
        {step === 2 && (
          <div className="onb-step">
            <div className="onb-step-icon"><ArrowLeftRight size={36} strokeWidth={1.5} /></div>
            <h2 className="onb-step-title">Your primary currency</h2>
            <p className="onb-step-sub">All amounts will be displayed in this currency.</p>
            <select
              className="onb-select"
              value={form.baseCurrency}
              onChange={e => set('baseCurrency', e.target.value)}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </select>
            <div className="onb-currency-preview">
              {currencyObj.flag} You'll see amounts like <strong>{currencyObj.symbol}1,250</strong>
            </div>
            <button className="onb-btn-primary" onClick={next}>Continue →</button>
            <button className="onb-btn-back" onClick={back}>← Back</button>
          </div>
        )}

        {/* ── Step 3: Monthly Budget ── */}
        {step === 3 && (
          <div className="onb-step">
            <div className="onb-step-icon"><Calendar size={36} strokeWidth={1.5} /></div>
            <h2 className="onb-step-title">Set a monthly budget</h2>
            <p className="onb-step-sub">We'll alert you at 50%, 80%, and 100% of your limit.</p>
            <div className="onb-amount-wrap">
              <span className="onb-currency-sym">{currencyObj.symbol}</span>
              <input
                className="onb-input onb-input-amount"
                type="number"
                placeholder="e.g. 50000"
                value={form.monthlyBudget}
                onChange={e => set('monthlyBudget', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && next()}
                min="0"
                autoFocus
              />
            </div>
            <button className="onb-btn-primary" onClick={next}>
              {form.monthlyBudget ? 'Set Budget →' : 'Skip for now →'}
            </button>
            <button className="onb-btn-back" onClick={back}>← Back</button>
          </div>
        )}

        {/* ── Step 4: Notifications ── */}
        {step === 4 && (
          <div className="onb-step">
            <div className="onb-step-icon"><Bell size={36} strokeWidth={1.5} /></div>
            <h2 className="onb-step-title">Stay on top of your spending</h2>
            <p className="onb-step-sub">Get a daily summary at 7 AM and budget alerts when you're close to your limit.</p>
            <div className="onb-notif-features">
              <div className="onb-feature">
                <Mail size={16} className="onb-feature-icon" />
                Daily spending summary
              </div>
              <div className="onb-feature">
                <AlertTriangle size={16} className="onb-feature-icon" />
                Budget alert at 50% + 80%
              </div>
              <div className="onb-feature">
                <Bell size={16} className="onb-feature-icon" />
                Over-budget warning
              </div>
            </div>
            <button
              className="onb-btn-primary"
              onClick={handleEnableNotifications}
              disabled={notifLoading}
            >
              {notifLoading ? 'Requesting…' : 'Enable Notifications'}
            </button>
            <button className="onb-btn-secondary" onClick={() => { setNotifStatus('skipped'); next() }}>
              Maybe later
            </button>
            <button className="onb-btn-back" onClick={back}>← Back</button>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === STEPS && (
          <div className="onb-step onb-done">
            <div className="onb-done-icon"><CheckCircle2 size={48} strokeWidth={1.5} /></div>
            <h2 className="onb-step-title">You're all set!</h2>
            <p className="onb-step-sub">Here's what we configured for you:</p>
            <div className="onb-summary">
              {form.displayName.trim() && (
                <div className="onb-summary-row">
                  <span className="onb-summary-label">Name</span>
                  <span className="onb-summary-value">{form.displayName.trim()}</span>
                </div>
              )}
              <div className="onb-summary-row">
                <span className="onb-summary-label">Currency</span>
                <span className="onb-summary-value">{currencyObj.flag} {currencyObj.code} — {currencyObj.name}</span>
              </div>
              <div className="onb-summary-row">
                <span className="onb-summary-label">Monthly budget</span>
                <span className="onb-summary-value">
                  {parseFloat(form.monthlyBudget) > 0
                    ? `${currencyObj.symbol}${parseFloat(form.monthlyBudget).toLocaleString(_localeFor(form.baseCurrency))}`
                    : <span className="onb-summary-na">Not set</span>}
                </span>
              </div>
              <div className="onb-summary-row">
                <span className="onb-summary-label">Notifications</span>
                <span className="onb-summary-value">{notifStatusDisplay()}</span>
              </div>
            </div>
            <button className="onb-btn-primary" onClick={handleFinish} disabled={saving}>
              {saving ? 'Saving…' : 'Enter the App →'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
