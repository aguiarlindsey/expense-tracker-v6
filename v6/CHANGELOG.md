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
| **Total** | | | **~54.0 h** |

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
