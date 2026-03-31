# Expense Tracker V6 Changelog

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
