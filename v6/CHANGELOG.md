# Expense Tracker V6 Changelog

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
