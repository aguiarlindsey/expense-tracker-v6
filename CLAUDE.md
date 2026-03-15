# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step, no package manager. Open `ExpenseTracker-v5-Phase14.html` directly in a browser. All dependencies are loaded from CDN at runtime:
- React 18 (`unpkg.com/react@18/umd/react.development.js`)
- Babel Standalone (`unpkg.com/@babel/standalone/babel.min.js`)
- LZ-string 1.5.0 (`cdn.jsdelivr.net/npm/lz-string@1.5.0`)

The JSX in the HTML is transpiled in-browser by Babel at load time.

## Architecture: ExpenseTracker-v5-Phase14.html

Single-file React app with all CSS, JS, and HTML in one file. Structure (top-to-bottom):
1. **`<style>` block** — all CSS including CSS custom properties for theming (`--bg`, `--surface`, `--text`, etc.) and `.dark` class overrides
2. **Babel `<script type="text/babel">`** — entire React app as one monolithic component

### Key patterns inside the script block
- **`Store`** — static object with `save()` / `load()` using `LZString.compressToUTF16` for localStorage. Keys: `et_v5_data`, `et_v5_dark`, `et_v5_cb`, `et_v5_rates`
- **Migration adapters** — `makeV5Expense()`, `makeV5Income()`, `migrateV2toV5()`, `migrateV4toV5()`, `detectVersion()` handle importing old data formats
- **Fingerprint dedup** — `djb2` hash over `date|desc|amount|currency|category` → `_fp` field; `makeDedupContext()` prevents duplicate imports
- **`useRef` cache** — `cached(key, fn)` helper persists heavy aggregation results across renders to avoid recomputation on unrelated state changes
- **`useDebounce`** — custom hook (300ms) wrapping search inputs; debounced values used in `useMemo` filter chains
- **SVG charts** — `PieChart`, `LineChart`, `BarChart` are hand-rolled SVG components with no charting library

### v5 Expense schema (23 fields)
`id`, `desc`, `date`, `amount`, `currency`, `category`, `subcategory`, `paymentMethod`, `expenseType`, `tags[]`, `notes`, `isRecurring`, `recurringPeriod`, `nextDueDate`, `splitWith`, `splitParts`, `categoryAllocations`, `receiptRef`, `customColor`, `budgetCategory`, `migratedFrom`, `version`, `_fp`

### 9 tabs (keyboard 1–9)
Overview · Income · Monthly · Yearly · Insights · Budgets · Goals · Exchange · Settings

### Theming
- Dark mode: toggle `dark` class on `<html>`, persisted to `et_v5_dark`
- Colorblind mode: toggle `colorblind` class on `<html>`, persisted to `et_v5_cb`; replaces red/green with blue/orange palette via `--cb-exp` / `--cb-inc` CSS variables

### Performance
- `React.memo` on `ExpItem`, `IncItem`, `BudgetBar`
- `useCallback` on delete handlers
- `useMemo` on all filtered lists, chart data, and insight computations
- LZ-string cuts localStorage size ~50%

### Important implementation details
- All `Date()` construction appends `T12:00:00` to avoid timezone-offset day shifts
- `fetch()` for exchange rates uses `AbortController` with 10s timeout (Safari compatibility)
- No `structuredClone`, `Array.at()`, `crypto.randomUUID()`, regex lookbehind, or logical assignment operators — kept for broad browser compatibility
- `input[type=month]` has `pattern`/`placeholder`/`title` fallbacks for Firefox/Safari

## Git Commit Style

Commit messages must follow the changelog format used in `merger_checklist_3.jsx` `SESSIONS[]`. Each commit should have:

- **Subject line:** `Session N — [Phase X] Complete` (or a descriptive equivalent for partial work)
- **Body:** one bullet per logical change, using the `✅ [phase-item-id]: short summary — implementation detail` pattern

Example (from Session 7):
```
Session 7 — Phase 7 Complete

✅ 7-1: Daily budget — v4 import auto-seeds from _v4Settings.dailyBudget; one-click apply banner
✅ 7-5: BudgetBar component — green/amber/red fill, overflow message, graceful zero-budget state
✅ 7-6: 50% toast alert — yellow ⚡, ToastStack fixed bottom-right, auto-dismiss 6s
✅ data._budgets persisted in store — included in JSON export/import
```

For changes that don't map to a phase item, omit the `[id]:` prefix and just write the summary after `✅`.

## merger_checklist_3.jsx

Standalone React component (`export default function App()`). Import only `useState` and `useMemo` from React. No router, no other dependencies. Renders three views of the 14-phase build history: phases, key features, and changelog. All 14 phases are 100% DONE — this file is reference/documentation only and is not part of the expense tracker runtime.
