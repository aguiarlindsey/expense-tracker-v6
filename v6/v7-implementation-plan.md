# V7 Implementation Plan — Detailed Step-by-Step

**Based on:** `expensetrackerv6upgrade03APR265.md`
**Started:** v6.7.0 | **Current:** v7.3.0 | **Last session:** Session 26b (2026-04-25)
**Working dir:** `D:\CLAUDE\EXPENSE_TRACKER\v6`

---

## Progress Summary

| Status | Count |
|--------|-------|
| ✅ Complete | 4 |
| ⏭️ Next up | 1 |
| 🔲 Remaining | 9 |

---

## Recommended Build Order (updated)

| Order | Item | Version | Effort | Status |
|-------|------|---------|--------|--------|
| 1 | Incognito Mode Toggle | v7.0.0 | 2–3h | ✅ Done — Session 22 |
| 2 | Emergency Rate Fallbacks | v7.1.0 | 1–2h | ✅ Done — Session 22 |
| 3 | Burn-Rate Forecasting | v7.2.0 | 3–4h | ✅ Done — Session 25 |
| 4 | Trip Summary | v7.3.0 | 2h | ✅ Done — Session 26/26b |
| 5 | **DB Maintenance Cron** | v7.4.0b | 1–2h | ⏭️ **NEXT** |
| 6 | Anomaly Detection | v7.4.0 | 4–5h | 🔲 |
| 7 | SQL Views for Insights | v7.5.0 | 3–4h | 🔲 |
| 8 | WebAuthn Biometric Lock | v7.6.0 | 5–6h | 🔲 |
| 9 | Database Versioning + Conflict UI | v7.7.0 | 6–8h | 🔲 |
| 10 | Sync Optimization | v7.8.0 | 4–5h | 🔲 |
| 11 | Tesseract.js OCR | v7.9.0 | 6–8h | 🔲 |
| 12 | Middleware Protection | v7.10.0 | 4–5h | 🔲 |
| 13 | HttpOnly Cookie Migration | v7.11.0 | 8–10h | 🔲 |

**Total remaining: ~44–55h across 9 features**

---

---

# PHASE 1 — Security & Advanced Privacy

---

## Step 1.1 — Incognito Mode Toggle ✅ DONE (v7.0.0, Session 22)
**Effort:** 2–3h | **Version:** v7.0.0 | **Risk:** Low

### What it does
A toggle in the header that instantly blurs all money amounts and balances. Useful on public transport, at work, in meetings.

### Files to change
- `src/styles/index.css` — add blur CSS
- `src/components/Tracker.jsx` — add toggle state + button + apply class

### Implementation steps

**Step A — Add CSS to `src/styles/index.css`**

Add at the bottom of the file:
```css
/* Incognito mode */
.incognito-blur {
  filter: blur(6px);
  user-select: none;
  transition: filter 0.2s ease;
}
.incognito-blur:hover {
  filter: blur(0px);  /* reveal on hover for desktop */
}
```

**Step B — Add state in `Tracker.jsx`**

Near the top where other useState hooks are declared:
```js
const [incognito, setIncognito] = useState(() =>
  localStorage.getItem('et_v6_incognito') === 'true'
);
```

**Step C — Persist on toggle**

```js
const toggleIncognito = useCallback(() => {
  setIncognito(v => {
    const next = !v;
    localStorage.setItem('et_v6_incognito', next);
    return next;
  });
}, []);
```

**Step D — Add button to header**

In the header JSX, next to the dark mode / realtime dot:
```jsx
<button onClick={toggleIncognito} title={incognito ? 'Show amounts' : 'Hide amounts'}
  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
  {incognito ? '👁️' : '🙈'}
</button>
```

**Step E — Apply blur class to every monetary value**

Wrap every `₹` amount with:
```jsx
<span className={incognito ? 'incognito-blur' : ''}>
  {fmtINR(amount)}
</span>
```

Target elements: Overview total cards, income total, budget bars amounts, goal amounts, all transaction list amounts, chart values.

**Step F — Test checklist**
- [x] Toggle persists across page refresh
- [x] All amounts blurred (Overview, Income, Budgets, Goals, transactions)
- [x] Hover reveals on desktop
- [x] Charts/labels also blurred (check SVG text elements)

---

## Step 1.2 — WebAuthn Biometric Lock 🔲 (v7.6.0)
**Effort:** 5–6h | **Version:** v7.6.0 | **Risk:** Medium

### What it does
After login, the app shows a "Unlock with biometrics" screen. Uses the device's FaceID/fingerprint via the WebAuthn API. Falls back to a PIN if biometrics unavailable.

### Files to change / create
- `src/hooks/useBiometric.js` — new hook
- `src/components/LockScreen.jsx` — new component
- `src/components/Tracker.jsx` — wrap with lock check
- `src/styles/index.css` — lock screen styles

### Implementation steps

**Step A — Create `src/hooks/useBiometric.js`**

```js
import { useState, useEffect, useCallback } from 'react'

const CRED_KEY = 'et_v6_biometric_cred'

export function useBiometric() {
  const [supported, setSupported] = useState(false)
  const [enrolled, setEnrolled] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const ok = window.PublicKeyCredential !== undefined
      && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    setSupported(ok)
    setEnrolled(!!localStorage.getItem(CRED_KEY))
    // Auto-unlock if not enrolled (biometrics optional)
    if (!localStorage.getItem(CRED_KEY)) setUnlocked(true)
  }, [])

  // Enroll: register a new credential
  const enroll = useCallback(async () => {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Expense Tracker V6', id: window.location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'user@lbav6',
          displayName: 'LBAv6 User',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      }
    })
    localStorage.setItem(CRED_KEY, cred.id)
    setEnrolled(true)
    setUnlocked(true)
  }, [])

  // Authenticate: verify existing credential
  const authenticate = useCallback(async () => {
    setError(null)
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{
            type: 'public-key',
            id: Uint8Array.from(atob(localStorage.getItem(CRED_KEY)
              .replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          }],
          userVerification: 'required',
          timeout: 60000,
        }
      })
      setUnlocked(true)
    } catch (e) {
      setError('Biometric check failed. Try again.')
    }
  }, [])

  const lock = useCallback(() => setUnlocked(false), [])
  const removeEnrollment = useCallback(() => {
    localStorage.removeItem(CRED_KEY)
    setEnrolled(false)
  }, [])

  return { supported, enrolled, unlocked, error, enroll, authenticate, lock, removeEnrollment }
}
```

**Step B — Create `src/components/LockScreen.jsx`**

Simple centered card with "Unlock with Biometrics" button, app logo, and error display. Falls through if biometrics not enrolled.

**Step C — Wrap `Tracker.jsx`**

```jsx
const { unlocked, authenticate, enrolled, supported } = useBiometric()
if (!unlocked) return <LockScreen onUnlock={authenticate} supported={supported} enrolled={enrolled} />
```

**Step D — Settings integration**

Add "Security" section in Settings tab:
- "Enable biometric lock" toggle → calls `enroll()`
- "Remove biometric enrollment" button → calls `removeEnrollment()`
- Shows status: enrolled / not enrolled

**Step E — Test checklist**
- [ ] First visit with no enrollment → app opens normally
- [ ] Enable in Settings → next app open shows lock screen
- [ ] Biometric success → app unlocks
- [ ] Biometric fail → error message shown
- [ ] Works on Chrome Android (fingerprint), Safari iOS (FaceID), Windows Hello
- [ ] Falls back gracefully on Firefox (unsupported)

---

## Step 1.3 — Middleware Protection (Move queries to API routes) 🔲 (v7.10.0)
**Effort:** 4–5h | **Version:** v7.10.0 | **Risk:** Medium

### What it does
Sensitive aggregation queries (totals, category summaries) run through Vercel API routes using the Supabase service key rather than exposing the anon key in the frontend bundle.

### Files to create
- `api/insights.js` — aggregation endpoint
- `api/export.js` — full data export endpoint

### Implementation steps

**Step A — Create `api/insights.js`**

```js
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  // Run query using user's JWT — RLS still applies
  const { data, error } = await supabase.rpc('get_monthly_summary')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}
```

**Step B — Add `SUPABASE_SERVICE_KEY` to Vercel env vars**
(Never expose in frontend — server-side only)

**Step C — Update frontend fetch calls**

Pass Supabase session token in Authorization header when calling `/api/insights`.

---

## Step 1.4 — HttpOnly Cookie Migration 🔲 (v7.11.0)
**Effort:** 8–10h | **Version:** v7.11.0 | **Risk:** High

### What it does
Move Supabase auth tokens from localStorage to HttpOnly cookies via a Vercel API proxy. Eliminates XSS token theft risk.

### Why this is last
Supabase's JS client defaults to localStorage. Overriding this breaks realtime subscriptions unless you pass the token manually. This is a significant architecture change — do after everything else is stable.

### Key approach
1. Create a Vercel middleware that sets/reads HttpOnly session cookies
2. Override Supabase client's `storage` option with a custom adapter that calls the cookie API instead of localStorage
3. Realtime channel: pass session token from cookie via a `/api/session-token` endpoint

### Files to change / create
- `api/auth-cookie.js` — set/get/clear cookie endpoint
- `src/utils/supabase.js` — override storage adapter
- `src/hooks/useAuth.js` — update sign-in/out to call cookie endpoint

### Note
This step requires thorough testing on mobile (cookie SameSite policies behave differently on iOS Safari). Do not implement until all other phases are done.

---

---

# PHASE 2 — Data Integrity & Multi-Device Sync

---

## Step 2.1 — Database Versioning 🔲 (v7.7.0 part A)
**Effort:** 2–3h | **Version:** v7.7.0 part A | **Risk:** Low

### What it does
Adds a `version` integer to each row. On every UPDATE the version increments. If two devices edit the same record offline, the one with the lower version "loses" and triggers the conflict UI.

### Files to change
- `schema.sql` — add columns
- Supabase SQL Editor — run migration
- `src/hooks/useStorage.js` — include version in reads/writes

### Implementation steps

**Step A — Run in Supabase SQL Editor**

```sql
-- Add version column to expenses, income, goals
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE income ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- Auto-increment version on every update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_version_trigger
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER income_version_trigger
  BEFORE UPDATE ON income
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER goals_version_trigger
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION increment_version();
```

**Step B — Update `expenseToDb()` in `useStorage.js`**

Include `version` when reading from DB. When writing an UPDATE, include `version` in the WHERE clause (optimistic locking):

```js
// Optimistic lock update — only succeeds if version matches
const { data, error } = await supabase
  .from('expenses')
  .update({ ...fields, version: currentVersion + 1 })
  .eq('id', id)
  .eq('version', currentVersion)  // ← this is the lock
  .select()
```

If `data` is empty (0 rows updated), a conflict occurred — trigger the conflict UI.

**Step C — Store version in app state**

Each expense/income/goal object in React state should carry its `version` field through the `dbToExpense()` mapping.

---

## Step 2.2 — Conflict Resolution UI 🔲 (v7.7.0 part B)
**Effort:** 4–5h | **Version:** v7.7.0 part B | **Risk:** Medium

### What it does
When an update fails due to version mismatch, a modal shows the user's local version vs. the server version side-by-side and lets them choose which to keep (or merge fields manually).

### Files to create / change
- `src/components/ConflictModal.jsx` — new component
- `src/hooks/useStorage.js` — detect conflict, emit event
- `src/components/Tracker.jsx` — render ConflictModal

### Implementation steps

**Step A — Conflict detection in `useStorage.js`**

When an optimistic-lock UPDATE returns 0 rows:
```js
// Fetch the current server version
const { data: serverRecord } = await supabase
  .from('expenses').select('*').eq('id', id).single()
// Emit conflict event
setConflicts(prev => [...prev, { local: localRecord, server: serverRecord }])
```

**Step B — Create `src/components/ConflictModal.jsx`**

Layout: two-column card
- Left column: "Your version" (local) — fields with values
- Right column: "Server version" — fields with values
- Highlight rows where values differ (yellow background)
- Buttons: "Keep Mine" | "Keep Server" | "Cancel"

**Step C — "Keep Mine" action**

Force-write local version to server (overwrite version counter):
```js
await supabase.from('expenses').update({ ...localRecord }).eq('id', id)
```

**Step D — "Keep Server" action**

Discard local changes, update React state with server version.

---

## Step 2.3 — Sync Optimization (Dependency-Ordered Queue) 🔲 (v7.8.0)
**Effort:** 4–5h | **Version:** v7.8.0 | **Risk:** Medium

### What it does
Currently the offline retry queue processes items in order. This step adds dependency awareness — e.g., if a budget was created offline and expenses reference it, the budget INSERT must succeed before the expense INSERTs.

### Files to change
- `src/hooks/useRetryQueue.js` — add priority/dependency fields
- `src/hooks/useStorage.js` — tag operations with dependencies when queuing

### Implementation steps

**Step A — Add `dependsOn` field to queue items**

```js
// Current queue item shape:
{ id, operation, table, payload, retries }

// New shape:
{ id, operation, table, payload, retries, dependsOn: null | queueItemId }
```

**Step B — Topological sort before processing**

When draining the queue on reconnect:
```js
function topoSort(items) {
  // Items with no dependsOn come first
  // Items whose dependsOn ID has been processed come next
  // Circular deps → break cycle, flag error
}
```

**Step C — Mark parent IDs when queuing**

When creating a budget offline then immediately adding an expense against it:
```js
const budgetQueueId = queueItem({ table: 'budgets', ... })
queueItem({ table: 'expenses', ..., dependsOn: budgetQueueId })
```

**Step D — Test checklist**
- [ ] Create budget offline
- [ ] Add expense against that budget offline
- [ ] Go online → budget inserts first, expense second
- [ ] No foreign key constraint errors

---

---

# PHASE 3 — Financial Co-Pilot

---

## Step 3.1 — Burn-Rate Forecasting ✅ DONE (v7.2.0, Session 25)
**Effort:** 3–4h | **Version:** v7.2.0 | **Risk:** Low

### What it does
Calculates daily average spend for the current month and projects the "budget exhaustion date" — the day the monthly budget will run out at current velocity. Also includes 7-day velocity + acceleration tracking and 2 new insight cards (#17 burn rate, #18 budget runway).

### Files changed
- `src/components/Tracker.jsx` — `burnRate` useMemo, forecast panel, 2 new insights

### Test checklist
- [x] No expenses → shows ₹0 / no exhaustion date
- [x] No budget set → shows projected total only, no exhaustion date
- [x] Budget will be exceeded → shows red warning + exhaustion date
- [x] Mid-month calculation accurate

---

## Step 3.2 — Trip Summary ✅ DONE (v7.3.0, Session 26/26b)
**Effort:** 2h | **Version:** v7.3.0 | **Risk:** Low

> **Note:** Originally this slot was planned for Anomaly Detection (v7.3.0). Trip Summary was built instead and Anomaly Detection shifted to v7.4.0.

### What it does
Full CRUD trip management with a dedicated ✈️ Trips tab (kbd=8). TripCards expand/collapse to show inline expense list (Date · Category · Description · Amount). Auto-links expenses by date range + currency via useMemo — no DB join needed.

### Files changed / created
- `supabase/add_trips.sql` — trips table (run 2026-04-25, confirmed live)
- `src/hooks/useStorage.js` — trips CRUD
- `src/components/Tracker.jsx` — Trips tab + TripCard component

### Test checklist
- [x] Create/edit/delete trips
- [x] Expand/collapse inline expense list
- [x] Expenses auto-linked by date range + currency

---

## Step 3.3 — Smart Anomaly Detection 🔲 (v7.4.0)
**Effort:** 4–5h | **Version:** v7.4.0 | **Risk:** Low-Medium

### What it does
When a new expense is saved, compare its amount to the 3-month average for that category. If it's >30% above average (with a minimum of 3 past transactions), show a toast warning.

### Two options
- **Option A (Frontend):** Calculate entirely in JS from existing `expenses` state. Zero infrastructure.
- **Option B (SQL Trigger):** Postgres function fires on INSERT, writes to an `anomalies` table, realtime pushes to client.

**Recommend Option A first** — simpler, no DB changes needed. Upgrade to Option B later.

### Files to change
- `src/utils/dataHelpers.js` — add `detectAnomaly()` function
- `src/components/Tracker.jsx` — call on expense save, show toast

### Implementation steps

**Step A — Add `detectAnomaly()` to `src/utils/dataHelpers.js`**

```js
export function detectAnomaly(newExpense, allExpenses, thresholdPct = 0.30, minSamples = 3) {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const similar = allExpenses.filter(e =>
    e.category === newExpense.category
    && new Date(e.date) >= threeMonthsAgo
    && e.id !== newExpense.id
  )

  if (similar.length < minSamples) return null  // not enough data

  const avg = similar.reduce((s, e) => s + (e.amount_inr || e.amount), 0) / similar.length
  const deviation = ((newExpense.amount_inr || newExpense.amount) - avg) / avg

  if (deviation > thresholdPct) {
    return {
      category: newExpense.category,
      avgAmount: avg,
      thisAmount: newExpense.amount_inr || newExpense.amount,
      deviationPct: Math.round(deviation * 100),
    }
  }
  return null
}
```

**Step B — Call after successful expense save in `Tracker.jsx`**

```js
const anomaly = detectAnomaly(newExpense, expenses)
if (anomaly) {
  showToast(
    `⚠️ ${anomaly.category} unusually high — ₹${fmtINR(anomaly.thisAmount)} vs avg ₹${fmtINR(anomaly.avgAmount)} (${anomaly.deviationPct}% above)`,
    'warn',
    8000  // longer display
  )
}
```

**Step C — Add anomaly history to Insights tab**

Show last 5 flagged anomalies with date, category, amount, deviation %.

**Step D — Test checklist**
- [ ] New category with < 3 transactions → no alert
- [ ] 5% above average → no alert (below 30% threshold)
- [ ] 50% above average with 5+ past transactions → toast shows
- [ ] Toast dismisses after 8s
- [ ] Anomaly list in Insights shows history

---

## Step 3.4 — Tesseract.js OCR (Receipt Scanning) 🔲 (v7.9.0)
**Effort:** 6–8h | **Version:** v7.9.0 | **Risk:** Medium-High

### What it does
User taps "Scan Receipt" in the Add Expense form, picks an image from camera/gallery, Tesseract.js extracts text client-side, and the app tries to auto-fill amount, date, and merchant.

### Important caveat
OCR accuracy varies. Receipt scanning will work well on clean printed receipts and fail on handwritten or crumpled ones. This should be a "helper" that pre-fills fields — user always reviews and confirms.

### Files to create / change
- `src/utils/ocrParser.js` — new file, parse Tesseract output
- `src/components/Tracker.jsx` — add scan button + loading state to expense form

### Implementation steps

**Step A — Install Tesseract.js**

```bash
npm install tesseract.js
```

**Step B — Create `src/utils/ocrParser.js`**

```js
import { createWorker } from 'tesseract.js'

let worker = null

async function getWorker() {
  if (!worker) {
    worker = await createWorker('eng')
  }
  return worker
}

export async function scanReceipt(imageFile) {
  const w = await getWorker()
  const { data: { text } } = await w.recognize(imageFile)
  return parseReceiptText(text)
}

function parseReceiptText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result = { amount: null, date: null, merchant: null, rawText: text }

  // Amount: look for largest currency-like number (TOTAL, AMOUNT DUE, etc.)
  const amountPatterns = [
    /(?:total|amount|due|grand total)[^\d]*(\d[\d,]*\.?\d{0,2})/i,
    /(\d[\d,]*\.\d{2})/,
  ]
  for (const pat of amountPatterns) {
    const match = text.match(pat)
    if (match) { result.amount = parseFloat(match[1].replace(',', '')); break }
  }

  // Date: look for DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
  if (dateMatch) result.date = dateMatch[1]

  // Merchant: usually first non-blank line
  result.merchant = lines[0] || null

  return result
}
```

**Step C — Add scan button to expense form in `Tracker.jsx`**

```jsx
<input type="file" accept="image/*" capture="environment"
  id="receipt-scan" style={{display:'none'}}
  onChange={async e => {
    const file = e.target.files[0]
    if (!file) return
    setOcrLoading(true)
    try {
      const parsed = await scanReceipt(file)
      if (parsed.amount) setForm(f => ({ ...f, amount: parsed.amount }))
      if (parsed.merchant) setForm(f => ({ ...f, desc: parsed.merchant }))
      showToast('Receipt scanned — please review pre-filled values', 'info')
    } catch {
      showToast('Could not read receipt — fill in manually', 'warn')
    } finally { setOcrLoading(false) }
  }}
/>
<label htmlFor="receipt-scan" className="btn-secondary">
  {ocrLoading ? '⏳ Scanning...' : '📷 Scan Receipt'}
</label>
```

**Step D — Lazy-load Tesseract**

Only import when user actually clicks scan (dynamic import) to avoid loading 5MB on every page load:
```js
const { scanReceipt } = await import('../utils/ocrParser.js')
```

**Step E — Test checklist**
- [ ] Library loads only when scan button is clicked (check Network tab)
- [ ] Clear printed receipt → amount and merchant extracted
- [ ] OCR loading indicator shown during processing
- [ ] Pre-filled values editable before saving
- [ ] Graceful error message on unreadable receipt

---

---

# PHASE 4 — Performance & System Reliability

---

## Step 4.1 — Emergency Rate Fallbacks ✅ DONE (v7.1.0, Session 22)
**Effort:** 1–2h | **Version:** v7.1.0 | **Risk:** Very Low

### What it does
If the exchange rate API is down or times out, use hardcoded 2026 rates instead of showing ₹0 or crashing.

### Files changed
- `src/utils/constants.js` — `FALLBACK_RATES` object added
- Rate fetch logic — fallback applied on error with toast notification

### Test checklist
- [x] Disable internet → app still converts currencies
- [x] Toast shown when fallback used
- [x] Cached rates preferred over hardcoded fallback

---

## Step 4.2 — SQL Views for Insight Calculations 🔲 (v7.5.0)
**Effort:** 3–4h | **Version:** v7.5.0 | **Risk:** Low

### What it does
Move the Insight card calculations from JS `useMemo` chains into Postgres views. Benefits: faster, runs on the DB server, testable with SQL, offloads CPU from the client browser.

### Files to change / create
- Supabase SQL Editor — create views
- `src/hooks/useStorage.js` — fetch from views instead of computing in JS
- `src/components/Tracker.jsx` — remove/simplify useMemo insight calculations

### Implementation steps

**Step A — Identify all Insight calculations in Tracker.jsx**

Look for `useMemo` blocks that compute things like:
- Top spending category
- Subscription detective (recurring fixed-amount expenses)
- Weekend vs weekday spend ratio
- Average transaction size
- Largest single expense
- Most used payment method
- Category MoM change

**Step B — Create views in Supabase SQL Editor**

Example for monthly category totals:
```sql
CREATE OR REPLACE VIEW monthly_category_totals AS
SELECT
  user_id,
  DATE_TRUNC('month', date) AS month,
  category,
  SUM(amount_inr) AS total_inr,
  COUNT(*) AS transaction_count,
  AVG(amount_inr) AS avg_amount
FROM expenses
GROUP BY user_id, DATE_TRUNC('month', date), category;
```

Example for subscription detective:
```sql
CREATE OR REPLACE VIEW recurring_patterns AS
SELECT
  user_id,
  description,
  category,
  ROUND(AVG(amount_inr)::numeric, 2) AS avg_amount,
  COUNT(*) AS occurrences,
  MAX(date) AS last_seen
FROM expenses
WHERE is_recurring = true OR expense_type = 'subscription'
GROUP BY user_id, description, category
HAVING COUNT(*) >= 2;
```

**Step C — Add RLS to views**

```sql
ALTER VIEW monthly_category_totals OWNER TO authenticated;
```
(Supabase automatically applies the underlying table's RLS to views)

**Step D — Fetch in `useStorage.js`**

```js
const { data: categoryTotals } = await supabase
  .from('monthly_category_totals')
  .select('*')
  .eq('user_id', userId)
  .gte('month', threeMonthsAgo)
```

**Step E — Test checklist**
- [ ] View returns data only for logged-in user
- [ ] Insight cards show same values as before
- [ ] Page load time measurably faster with large datasets
- [ ] View still works after adding new expenses

---

## Step 4.3 — Database Maintenance Cron ⏭️ NEXT (v7.4.0b)
**Effort:** 1–2h | **Version:** v7.4.0b | **Risk:** Very Low

### What it does
A weekly cleanup job that:
1. Deletes push_subscriptions older than 90 days with no activity
2. Removes orphaned retry queue entries
3. Optionally: archives expenses older than 3 years to a cold storage table

### Files to change
- `vercel.json` — add second cron entry
- `api/maintenance.js` — new file

### Implementation steps

**Step A — Create `api/maintenance.js`**

```js
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Vercel cron security check
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end()
  }
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
  // Remove stale push subscriptions (>90 days old, not updated)
  const { count } = await supabase
    .from('push_subscriptions')
    .delete()
    .lt('updated_at', new Date(Date.now() - 90 * 86400000).toISOString())
  res.json({ cleaned: count })
}
```

**Step B — Add to `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/send-reminders", "schedule": "30 1 * * *" },
    { "path": "/api/maintenance", "schedule": "0 2 * * 0" }
  ]
}
```
(Runs Sundays at 02:00 UTC)

**Step C — Add `CRON_SECRET` to Vercel env vars**

Generate a random secret, set it in Vercel dashboard under Environment Variables, reference in the cron handler.

**Step D — Test checklist**
- [ ] Endpoint returns 401 without correct auth header
- [ ] Dry run manually with curl → returns `{ cleaned: N }`
- [ ] Cron appears in Vercel dashboard → Deployments → Cron Jobs

---

---

# Session Changelog (actual vs. planned)

| Session | Planned | Actual | Version |
|---------|---------|--------|---------|
| Session 22 | Incognito Mode + Rate Fallbacks | ✅ Incognito Mode + Rate Fallbacks | v7.0.0 + v7.1.0 |
| Session 23 | Burn-Rate Forecasting | — | — |
| Session 24 | Anomaly Detection | — | — |
| Session 25 | SQL Views + DB Maintenance | ✅ Burn-Rate Forecasting | v7.2.0 |
| Session 26 | WebAuthn Biometric Lock | ✅ Trip Summary (tab + CRUD) | v7.3.0 |
| Session 26b | — | ✅ Trip expand/collapse + inline expense list | v7.3.0 |
| Session 27 | DB Versioning + Conflict Modal | ⏭️ DB Maintenance Cron → then Anomaly Detection | v7.4.0b + v7.4.0 |
| Session 28 | Sync Queue Optimization | SQL Views for Insights | v7.5.0 |
| Session 29 | Tesseract.js OCR | WebAuthn Biometric Lock | v7.6.0 |
| Session 30 | Middleware Protection | DB Versioning + Conflict Modal | v7.7.0 |
| Session 31 | HttpOnly Cookie Migration | Sync Queue Optimization | v7.8.0 |
| Session 32 | — | Tesseract OCR | v7.9.0 |
| Session 33 | — | Middleware Protection | v7.10.0 |
| Session 34 | — | HttpOnly Cookie Migration | v7.11.0 |

---

*Generated: 2026-04-03 | Last updated: 2026-04-26 | Current: v7.3.0*
