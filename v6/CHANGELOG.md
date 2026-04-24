# Expense Tracker V6 Changelog

---

## Hours Log

> All times are estimates. Sessions tracked from 2026-04-02 onward are logged precisely at session end.
> Sessions 1–17 are retrospective estimates based on scope and complexity.

| Session | Date | Description | Est. Hours |
|---------|------|-------------|------------|
| 1 | ~2026-02 | v5 Phase 1–2: Foundation, storage, migration adapters | 3.0 |
| 2 | ~2026-02 | v5 Dedup engine (djb2, fingerprint, makeDedupContext) | 2.5 |
| 3 | ~2026-02 | v5 Settings tab, CSV export, import hub, danger zone | 2.5 |
| 4 | ~2026-02 | v5 Phase 3: Recurring, split expense, receipt ref, 50-colour palette | 3.0 |
| 5 | ~2026-02 | v5 Phase 4–5: Heatmap, BarChart, 259-colour palette, Insights | 3.0 |
| 6 | ~2026-02 | v5 Phase 6: Advanced filters, date/amount range, multi-category chips | 2.5 |
| 7 | ~2026-02 | v5 Phase 7: Budget system (daily/weekly/monthly/per-cat), toast alerts | 3.0 |
| 8 | ~2026-02 | v5 Phase 8–11: Goals tab, contributions, category allocation split | 3.0 |
| 9 | ~2026-03 | v5 Phase 13: MoM/YoY comparison tables, 6 new insight cards | 2.5 |
| 10 | ~2026-03 | v5 Phase 14: Recurring reminders, colorblind mode, ARIA, perf | 3.0 |
| 11 | ~2026-03 | v5 Local base currency, useCurrency hook, full display refactor | 3.0 |
| 12 | 2026-03-14 | v5 Gamification: streaks, confetti, safe-to-spend, no-spend weekend | 2.5 |
| 13 | 2026-03-15 | v6 Baseline: Supabase planning, schema design, V6 roadmap | 1.5 |
| 14 | 2026-03-26 | v6 Phase 1: Vite scaffold, Auth gate, supabase.js, useAuth | 2.0 |
| 15 | 2026-03-27 | v6 Phase 2: DB schema, RLS, useStorage CRUD, core 2-tab UI | 3.0 |
| 16 | 2026-03-27 | v6 Phase 3 initial: 6-tab UI, goals, dark/colorblind, toasts, heatmap | 3.5 |
| 17 | 2026-03-31 | v6 Phase 3 parity: 9 tabs, exchange, settings, export/import, forecast, subs | 4.0 |
| 18 | 2026-04-02 | v6 Phase 3 close: audit, heatmap fixes, bug fixes (5 items), hours log | 2.0 |
| 19 | 2026-04-02 | v6 Phase 4: GitHub + Vercel deploy, TDZ fixes, Chrome Auto Dark Mode fix, PWA | 3.5 |
| 20 | 2026-04-02 | v6 Phase 4 audit + bug fixes (subcategory, UPI/Wallet), responsive CSS, PWA auto-reload, Phase 5 offline resilience | 4.0 |
| 21 | 2026-04-03 | v6 Phase 6: v5→v6 migration; Phase 7: real-time sync; Phase 8: push notifications | 5.5 |
| 22 | 2026-04-03 | v7.0.0: Incognito mode toggle — blur all amounts, hover-to-reveal, persisted | 1.5 |
| 23 | 2026-04-10 | v7.1.0: Emergency rate fallbacks — cached → built-in rates when API unavailable | 1.0 |
| 24 | 2026-04-10 | v7.1.1: 122-currency expansion + historical rate sync (Frankfurter API) | 2.0 |
| 25 | 2026-04-24 | v7.2.0: Burn-Rate Forecasting — 7-day velocity, acceleration, runway, category burn | 1.5 |
| 26 | 2026-04-24 | v7.3.0: Trip Summary — trips table, CRUD, auto-link by date+currency, trip cards | 2.0 |
| **Total** | | | **~71.5 h** |

---

## [v7.3.0] — Trip Summary
_2026-04-24_

**New: `trips` table (`supabase/add_trips.sql`)**
- Schema: `id, user_id, name, start_date, end_date, currency, notes, created_at`
- RLS: 4 policies (SELECT / INSERT / UPDATE / DELETE) scoped to `auth.uid()`
- `REPLICA IDENTITY FULL` + added to `supabase_realtime` publication

**`useStorage.js`**
- `tripFromDb` / `tripToDb` field mappers
- `trips` state; loaded in goals/contributions Promise.all
- `handleTripEvent` for INSERT / UPDATE / DELETE realtime events
- `addTrip`, `editTrip`, `deleteTrip` CRUD callbacks
- `factoryReset` now deletes trips table too

**Tracker.jsx — Trips tab (✈️, position 8)**
- `tripsWithData` useMemo: filters expenses by `date ∈ [start, end]` AND `currency === trip.currency`; computes `totalOriginal`, `totalINR`, top-3 category breakdown, status badge
- `submitTripForm` / `openEditTrip` handlers with overlap detection (toast warning, not blocking)
- New Trip form: name, currency (grouped dropdown), start date, end date, notes; inline validation
- TripCard: status badge (Active / Upcoming / Completed), total in trip currency, INR equivalent, category chips, edit/delete actions
- Empty state with CTA; incognito-aware amount masking
- Keyboard shortcut: key 8 = Trips (Exchange → 9; Settings unshortcutted)

**CSS** — `.trips-header`, `.trip-form-grid`, `.trips-grid`, `.trip-card`, `.trip-status-badge`, `.trip-cats`, `.trip-empty-body` — responsive at 640px

---

## [v7.2.0] — Burn-Rate Forecasting
_2026-04-24_

**New: `burnRate` useMemo (Tracker.jsx)**
- Computes 7-day and previous-7-day daily spend rates for week-over-week velocity
- Acceleration metric: % change in daily rate vs prior week; guarded against division-by-zero
- Budget runway: days until monthly budget depleted at current daily rate, with exact depletion date
- Top-3 category burn rates for current month (total + daily rate)

**Overview tab — expanded forecast panel**
- New `forecast-burn-row` section below the existing 4-cell forecast grid
- "7-day avg rate" cell with colored acceleration indicator (↑/↓/~flat vs prev week)
- "Budget runway" cell (only shown when monthly budget is set): green/amber/red with depletion date
- "Top burn category" cell: icon, name, daily rate, and month-to-date total

**Insights tab — 2 new insights (total: 18)**
- #17 Burn Rate Accelerating/Slowing: fires when acceleration ≥ 10%, shows both weekly rates
- #18 Budget Runway/Exhausted/On Track: fires when monthly budget is set; three states

**CSS**
- `.forecast-burn-row` — grid row matching forecast-grid layout, separated by `var(--border)` divider

---

## [v7.1.1] — 122 Currencies + Historical Rate Sync
_2026-04-10_

**Currency expansion (29 → 122)**
- `CURRENCIES` array expanded from 29 to 122 entries across 8 groups: Major, Asia-Pacific, Middle East, Europe, Africa (30), Americas (21), Central Asia, Alternative Assets
- `CG` (grouped currency map) exported from `constants.js` and imported at module scope so all form components can access it — fixes previous `CG is not defined` scope bug
- `FALLBACK_RATES` expanded to cover all 120 fiat currencies (April 2026 INR-relative rates)
- Add Expense, Add Income, and Settings base-currency selectors now render all 122 currencies in grouped `<optgroup>` dropdowns with flag + code + full name

**Historical Rate Sync**
- `ExpenseForm` and `IncomeForm`: when a past date + non-INR currency is selected, automatically fetches the closing rate for that day from `api.frankfurter.dev/v2/[DATE]?base=[CURRENCY]&symbols=INR`
- 6-hour `localStorage` cache keyed `et_hist_[DATE]_[CURRENCY]` — shared between both forms, so the same date/currency pair never hits the network twice
- `AbortController` cancels in-flight requests on re-trigger or unmount
- Rate input disabled while fetching; label shows `⏳ Fetching historical rate…`
- After fetch: label shows `📅 [DATE]` to confirm historical source; user can still manually override
- Today/future dates continue using live `rateData` unchanged

---

## [v7.1.0] — Emergency Rate Fallbacks
_2026-04-10_

- Added `FALLBACK_RATES` to `src/utils/constants.js` — hardcoded April 2026 INR-relative rates for 26 currencies
- Auto-fetch on mount: if API fails, uses cached rates first (with toast), then built-in fallback (with toast)
- Manual refresh (`refreshRates`): same cached → fallback ladder on error
- `rsLabel` now shows `🟠 Fallback` when built-in rates are active
- Exchange tab description updated to reflect three-tier fallback chain
- About section bumped to v7.1.0

---

## [v7.0.0] — Incognito Mode
_2026-04-03_

- 🙈 button added to header (between colorblind toggle and ➕ Expense)
- CSS blur on 11 amount classes via `html.incognito` selector: `summary-amount`, `forecast-val`, `forecast-sub`, `pie-val`, `item-amount`, `bbar-amounts`, `bbar-over`, `goal-amounts`, `rec-amount`, `date-group-header span`, `recurring-chip-meta`
- Hover-to-reveal on any blurred element (desktop)
- State persisted to `localStorage` (`et_v6_incognito`); survives page refresh
- Follows same pattern as dark/colorblind mode — `useEffect` + `documentElement.classList.toggle`
- About section updated to v7.0.0

---

## [v6.7.0] — Phase 8: Push Notifications for Recurring Reminders
_2026-04-03_

- `public/sw-push.js` — service worker push event handler: displays custom notification (title, body, tag collapse, actions); `notificationclick` handler focuses existing window or opens new tab to `/?tab=recurring`
- `vite.config.js` — `workbox.importScripts: ['/sw-push.js']` injects push handler into generated service worker
- `src/hooks/useNotifications.js` — new hook: `requestAndSubscribe` (permission prompt → `pushManager.subscribe` with VAPID key → upsert to `push_subscriptions` table), `unsubscribe` (browser unsubscribe + DB delete), `permission`/`subscribed`/`loading`/`error` state
- `src/components/Tracker.jsx` — Settings tab: new "🔔 Recurring Reminders" section with Enable/Disable button and permission state feedback; tab deep-link via `URLSearchParams` on init (`?tab=recurring` from notification opens correct tab)
- `api/send-reminders.js` — Vercel Node.js serverless function: queries recurring expenses due ≤3 days, groups by user, sends web-push via `web-push` npm package, cleans up 410/404 stale subscriptions
- `vercel.json` — cron schedule `30 1 * * *` (07:00 IST daily) triggers `/api/send-reminders`
- `supabase/functions/send-recurring-reminders/index.ts` — Supabase Edge Function (kept as backup; active sender is Vercel route due to Deno/web-push Buffer incompatibility)
- **Supabase** — `push_subscriptions` table created with RLS; `supabase_realtime` publication enabled on all 5 tables; `REPLICA IDENTITY FULL` set on all tables for DELETE event propagation
- `web-push` added to `package.json` dependencies

---

## [v6.6.0] — Phase 7: Real-Time Multi-Tab/Device Sync
_2026-04-03_

- `src/hooks/useStorage.js` — single Supabase Realtime channel (`user-data-${userId}`) with 9 `postgres_changes` listeners across all 5 tables (expenses, income, budgets, goals, goal_contributions); INSERT dedup via `_pending` flag prevents double-apply from optimistic updates; UPDATE/DELETE handlers for all tables; `realtimeStatus` state (`connecting`→`live`/`error`/`offline`); channel cleanup on unmount via `supabase.removeChannel()`
- `src/components/Tracker.jsx` — pulsing green dot in header shows live sync status (amber spinning = connecting, red = error, gray = offline); tooltip on hover
- `src/styles/index.css` — `.realtime-dot`, `.realtime-live` (pulse animation), `.realtime-connecting`, `.realtime-error`, `.realtime-offline` styles

---

## [v6.5.0] — Phase 6: v5 → v6 Data Migration
_2026-04-03_

- `src/utils/migrateV5.js` — new file: `transformV5Expense` / `transformV5Income` (maps `desc`→`description`, normalises dates via `split('T')[0]`, handles `splitParts` as object or int, preserves original `_fp` fingerprint for dedup, computes `amountINR` if missing); `validateV5File` (rejects arrays, empty files, v6 backups with redirect message); `migrateV5Data` (per-record error capture — bad records warn, don't abort)
- `src/components/Tracker.jsx` — Settings tab: new "🔀 Migrate from V5" section between Import and Danger Zone; `handleV5Import` handler with chunked 500/batch inserts, client-side dedup via `makeDedupContext`, per-record warnings, 12s auto-dismiss report banner

---

## [v6.4.0] — Phase 5: Offline Resilience + Bug Fixes + Responsive
_2026-04-02_

- `src/hooks/useRetryQueue.js` — new hook: persists mutation queue to `localStorage` (`et_v6_retry_queue`), tracks `online`/`offline` via `window` events, exposes `enqueue` / `remove` / `bumpAttempts` / `dropExhausted`
- `src/hooks/useStorage.js` — integrated retry queue into all 11 CRUD operations; every mutation now applies optimistically to local state with `_pending: true` then confirms to Supabase; `isNetworkError()` distinguishes network failures from real errors (only network errors are queued); `executeOp()` maps op name → Supabase call for replay; auto-drains queue on reconnect and on mount; max 5 attempts per item then drops
- `src/components/Tracker.jsx` — offline amber banner ("You're offline · N changes queued"), blue syncing banner during queue replay, ⏳ pending indicator on unconfirmed expense/income items
- `src/styles/index.css` — `.offline-banner`, `.syncing-banner`, `.syncing-spinner`, `.item-pending` styles added
- **Bug fix** — category dropdown `<option>` missing `value` attr caused subcategories to always be blank when any non-Food category was selected; added `value={c}` to fix
- **Bug fix** — no UPI app / wallet selector in expense form; added `UPI_APPS` and `WALLET_APPS` arrays to `constants.js`; UPI/QR → dropdown (GPay, PhonePe, PayZapp, etc.), Wallet → dropdown (Amazon Pay, Paytm, etc.)
- **Responsive CSS** — full mobile + tablet breakpoints: tabs scroll horizontally (9 tabs no longer overflow), modal slides up from bottom, filter bar stacks vertically, form rows go single-column, app header truncates/hides email, tables get horizontal scroll, heatmap cells shrink
- **PWA auto-reload** — `useRegisterSW` in `main.jsx` with `onNeedRefresh → window.location.reload()` and 60s polling; new deploys activate automatically without manual hard-refresh
- **Phase 4 audit fixes** — page title corrected "v6" → "Expense Tracker"; `<meta name="theme-color">` added to `index.html`

---

## [v6.3.0] — Phase 4: Deployment + PWA (Launch)
_2026-04-02_

**Production URL:** `https://expense-tracker-v6.vercel.app`

Every request hits Vercel's CDN edge → serves the Vite-built static bundle → React boots → `useAuth` checks Supabase session → if authed, `useStorage` fetches live data from Supabase Postgres via RLS-enforced queries. No server-side rendering. Auth is magic-link email via Supabase Auth; session persisted in `localStorage` by the Supabase JS client.

**Final audit results (all pass):**
- ✅ All source files committed to GitHub (`aguiarlindsey/expense-tracker-v6`)
- ✅ `.env` blocked by `.gitignore` — confirmed not tracked; secrets live only in Vercel environment variables
- ✅ `supabase.js` uses `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — no hardcoded keys
- ✅ `manifest.webmanifest` injected into built `index.html` by vite-plugin-pwa
- ✅ `registerSW.js` service worker registration injected at build time
- ✅ `theme_color: #863bff` set in PWA manifest
- ✅ `<meta name="theme-color" content="#863bff">` added to `index.html` for status bar before manifest parses
- ✅ Page title corrected from "v6" → "Expense Tracker"
- ✅ `useStorage` hook is pure Supabase — no hardcoded test/seed data anywhere in src/
- ✅ Supabase redirect URLs: Site URL `https://expense-tracker-v6.vercel.app`, dev `http://localhost:5173`

**GitHub → Vercel pipeline live.** App deployed at `https://expense-tracker-v6.vercel.app`. Supabase auth redirect URLs configured.

- Created GitHub repo `aguiarlindsey/expense-tracker-v6`, pushed v6 subfolder as root via `git subtree`
- Vercel project configured: Root Directory `v6`, env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Fixed Vite 8 / Rolldown TDZ crash — downgraded to Vite 6.4.1 + @vitejs/plugin-react@4.5.0 (Rolldown is still experimental; Rollup is stable)
- Fixed Rollup TDZ error (`Cannot access 'allMonthlyExp' before initialization`) — moved `allMonthlyExp` / `allMonthlyInc` useMemos earlier in `Tracker.jsx` to before the `insights` useMemo that captures them
- Added `ErrorBoundary` class component to `main.jsx` — surfaces runtime crashes that previously showed as a blank black page
- Fixed Chrome Auto Dark Mode — added `color-scheme: light` to `:root` and `color-scheme: dark` to `.dark {}` in `index.css`; without this Chrome applies its own dark filter when the OS is in dark mode, mangling CSS custom property colors to white
- Configured Supabase auth redirect URLs: Site URL `https://expense-tracker-v6.vercel.app`, additional `http://localhost:5173`
- PWA setup: installed `vite-plugin-pwa` v1.2.0, configured `manifest.webmanifest` (standalone display, theme `#863bff`), added `pwa-192.svg` + `pwa-512.svg` brand icons, Workbox service worker with autoUpdate + precache

---

## [v6.2.0] — Phase 3 Complete
_2026-04-02_

**Tab layout (final):** 9 tabs — Overview · Income · Trends · Budgets · Goals · Insights · Recurring · Exchange · Settings.
Heatmap lives inside Trends; Category Split lives inside Insights. This is the canonical V6 layout.

- `src/components/Tracker.jsx` — Added 🔄 Recurring tab (9th tab): lists all recurring expenses + income with next-due-date badges and overdue warnings; keyboard shortcut `7` (Exchange→`8`, Settings→`9`)
- `src/styles/index.css` — Removed `@media (prefers-color-scheme: dark)` (was overriding toggle); added `--color-exp` / `--color-inc` CSS vars to `:root`; `.colorblind` now overrides both vars (blue/orange); `.colorblind` overrides added for budget bars, goal bars, toasts, delta indicators; added `.rec-section`, `.rec-item`, `.rec-period-badge` and related Recurring tab styles
- `src/components/Tracker.jsx` — Dark mode: initialiser now falls back to `window.matchMedia` on first visit; toggle is now the sole controller. Colorblind: all 20+ hardcoded `#ef4444`/`#10b981` inline styles replaced with `var(--color-exp)`/`var(--color-inc)` so `.colorblind` overrides can reach them

---

## Phase 3 — Integrity Patch (Form Fields + Analytics Charts)
_2026-03-31_

- `src/utils/constants.js` — Added `DINING_APPS` (8 apps: Swiggy, Zomato, etc.) and `GROCERY_TAGS` (16 grocery tag labels) exports
- `src/components/Tracker.jsx` — `ExpenseForm`: added `conversionRate`, `paymentDescription`, `diningApp`, `nextDueDate`, `receiptRef` to state; `calcNextDue` helper; `onCurrencyChange` handler (auto-fills rate from `rateData`); conditional conversion rate row + INR preview when currency ≠ INR; conditional Dining App select (Food category); conditional Grocery Tags chip grid (Food category); conditional Payment Reference input (non-Cash); Receipt/Order ID field; Next Due Date field (recurring); `IncomeForm`: same conversion rate + INR preview pattern; `rateData` prop passed to both forms from Tracker; `expTypeData`, `diningData`, `tagsData` useMemos added; `BarChart` updated to support `_color` override; Insights tab: Expense Type BarChart, Dining App BarChart, Tags BarChart, Day-of-Week vertical bar chart
- `src/styles/index.css` — Added `.tags-container`, `.tag-btn`, `.tag-btn.selected`, `.currency-preview`, `.dow-grid`, `.dow-cell`, `.dow-bar`, `.dow-amt`, `.dow-label`

## Phase 3 — Integrity Patch (Forecast, STS, Yearly Table, Sub-Zombies)
_2026-03-31_

- `src/components/Tracker.jsx` — Added `calculateSafeToSpend` helper; `savingsGoal` state (localStorage `et_v6_sts_goal`); `currentMonthInc`, `currentMonthFixed`, `dailyAllowance`, `daysRemaining`, `stsRatio`, `stsStatus`, `stsColor` computed values; `monthForecast` useMemo (projects month-end spend, daily rate, trend vs prev month, savings); `subZombieData` useMemo (detects subscriptions via isRecurring/SUB_SUBS/3+-month pattern, flags zombies ≥45d + price creep >10%); Daily Allowance card in Overview summary-grid; Month-End Forecast panel in Overview; Yearly comparison table in Trends tab (Year/Expenses/vs Prev/Income/Saved/Txns); Safe-to-Spend settings section (savings goal input + live summary); Subscription Detective section in Insights tab (zombies, price creep, full sub table)
- `src/styles/index.css` — Added `.forecast-panel`, `.forecast-grid`, `.forecast-item`, `.forecast-label`, `.forecast-val`, `.forecast-sub`, `.sts-summary`, `.sub-section`, `.sub-section-title`, `.sub-row`, `.sub-zombie`, `.sub-creep`, `.sub-desc`, `.sub-meta`, `.sub-table`

## Phase 3 — Integrity Patch (Export / Import / Danger Zone)
_2026-03-31_

- `src/hooks/useStorage.js` — Added `bulkAddExpenses`, `bulkAddIncome` (Supabase batch INSERT); `clearExpenses`, `clearIncome`, `clearAll`, `factoryReset` (Supabase DELETE per table + localStorage cleanup)
- `src/components/Tracker.jsx` — Added `confirmAction`, `importReport`, `importing` state; `handleExportJSON` (full JSON blob download), `handleExportCSV` (CSV blob, expenses only), `handleImport` (FileReader → parse → dedup via `makeDedupContext` → `bulkAdd*`), `executeConfirmedAction` (dispatches to correct clear/reset function); Settings tab: Export section (JSON + CSV), Import section (file input + report banner), Danger Zone (Clear Expenses / Clear Income / Clear All / Factory Reset); confirmAction modal with destructive confirmation step
- `src/styles/index.css` — Added `.danger-zone`, `.btn-danger`, `.btn-danger-solid`, `.import-report`, `.settings-desc`

## Phase 3 — Integrity Patch (Exchange + Settings tabs)
_2026-03-31_

- `src/components/Tracker.jsx` — Added `exchange` and `settings` to TABS array (now 8 tabs, keyboard 1–8); exchange rate state (`baseCurrency`, `rateData`, `rateFetching`) with 6 h localStorage cache + `refreshRates()`; Exchange tab renders live rate table (INR ↔ unit) + full currency list grouped by region; Settings tab: dark/colorblind toggles, base currency selector, data stats (expenses/income/goals/contributions count), rate status + refresh button; `CG` (currency group map) derived at render time from `CURRENCIES`
- `src/styles/index.css` — Added `.card`, exchange table styles (`.exchange-table`, `.cur-chip`, `.cur-group-label`), settings styles (`.settings-section`, `.settings-row`, `.toggle-btn`, `.settings-stat-bar`)

## Phase 3 — Integrity Patch (259-Colour Palette)
_2026-03-31_

- `src/utils/constants.js` — Added `CC`: 259-colour custom palette array, ported directly from v5 `ExpenseTracker-v5-Phase15.html` (`const CC=[...]`, lines 1353–1387)
- `src/components/Tracker.jsx` — `ExpenseForm`: added `customColor: null` to initial state; toggle-able swatch grid renders all 259 colours; selecting a colour closes the palette; clear button resets to category default; `CC` imported from constants
- `src/styles/index.css` — Added `.color-picker-trigger`, `.color-swatch-preview`, `.color-clear-btn`, `.color-palette`, `.color-dot`, `.color-dot.selected` styles; palette scrollable at max-height 180px

## Phase 3 — Full Feature Integration
_2026-03-27_

- `src/hooks/useStorage.js` — Goals + contributions CRUD (addGoal, deleteGoal, addContribution, deleteContribution); flat contributions state merged with goals in UI
- `src/components/Tracker.jsx` — Full rewrite: 6 tabs (Overview, Income, Trends, Budgets, Goals, Insights); dark/colorblind mode with localStorage persistence; ToastStack with budget alerts at 50/80/100%; advanced filter panel (date range, amount range, multi-category chips); HeatmapCalendar (90-day); BarChart; month comparison table; CreateGoalModal + AddContributionModal; 6 insight cards; keyboard shortcuts 1–6 + N/I/D/Esc
- `src/styles/index.css` — Phase 3 additions: dark mode variables, colorblind overrides, toasts, advanced filters, budget bars, goals grid, insights grid, bar chart, comparison table, heatmap, emoji picker

---

## Phase 2 — Database & Security
_2026-03-27_

- `schema.sql` — 5 tables (expenses, income, budgets, goals, goal_contributions) with full RLS
- `src/hooks/useStorage.js` — Supabase CRUD replacing localStorage; DB↔app field mapping
- `src/hooks/useDebounce.js` — 300ms debounce hook
- `src/utils/constants.js` — CATS, CURRENCIES, PAY_METHODS, INC_SOURCES, EXP_TYPES
- `src/utils/dataHelpers.js` — makeExpense, makeIncome, fingerprint, dedup, matchesSearch
- `src/components/Tracker.jsx` — 2-tab UI (Overview + Income): summary cards, filter bar, expense/income lists, pie/line charts, add/edit/delete forms, bulk select
- `src/App.jsx` — wires `<Tracker session={session} />` when authenticated
- `src/styles/index.css` — tracker, form, modal, item, chart CSS added

---

## Phase 1 — Vite Scaffold + Auth Gate
_2026-03-26_

- Scaffolded Vite + React project in `/v6`
- Installed `@supabase/supabase-js`
- `src/utils/supabase.js` — Supabase client wired to env vars
- `src/hooks/useAuth.js` — `useAuth()` hook with session loading state
- `src/components/Auth.jsx` — magic-link email auth gate
- `src/styles/index.css` — base CSS with dark mode, auth, app shell
- `.env` / `.env.example` — credentials template
- `.gitignore` updated to exclude `.env`
