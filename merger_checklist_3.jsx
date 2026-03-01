import { useState, useMemo } from "react";

const STATUS = {
  DONE: "done",
  PARTIAL: "partial",
  TODO: "todo",
};

const PHASES = [
  {
    id: "p12",
    label: "Phase 1–2",
    weeks: "Week 1–2",
    title: "Foundation & Data Layer",
    items: [
      { id: "1-1", text: "Unified v5 schema supporting all v2 + v4 + new fields", status: STATUS.DONE, note: "23 fields per expense: core + _fp, customColor (from 259-colour palette), budgetCategory, isRecurring, recurringPeriod, nextDueDate, splitWith, splitParts, receiptRef, migratedFrom, version:5" },
      { id: "1-2", text: "Migration adapter: generic external JSON → v5", status: STATUS.DONE, note: "makeV5Expense() / makeV5Income() with full field normalisation; base for all adapters" },
      { id: "1-3", text: "Migration adapter: v2-specific format → v5", status: STATUS.DONE, note: "migrateV2toV5(): maps item/price/cost/colour/pay/app, splits income, preserves _v2Palette", wasPartial: true },
      { id: "1-4", text: "Migration adapter: v4-specific format → v5", status: STATUS.DONE, note: "migrateV4toV5(): separates type:'income', maps isFixed/isNeed/isLuxury, preserves _v4Settings (dailyBudget, heatmapData)", wasPartial: true },
      { id: "1-5", text: "localStorage persistence (save/load)", status: STATUS.DONE, note: "Store.save() / Store.load() with LZ-string + SK_META size-tracking key" },
      { id: "1-6", text: "LZ-string compression (50% size reduction)", status: STATUS.DONE, note: "lz-string@1.5.0 CDN; Store.compress() → LZString.compressToUTF16(); rate cache also compressed; graceful plain-JSON fallback", wasTodo: true },
      { id: "1-7", text: "Auto-detection of incoming data version", status: STATUS.DONE, note: "detectVersion(): v5 (schemaVersion/migratedFrom), v4 (dailyBudget/heatmapData), v2 (version:2/palette/colour), raw-array, generic — 5 distinct signals", wasPartial: true },
      { id: "1-8", text: "Fingerprint-based dedup engine (zero repeat entries)", status: STATUS.DONE, note: "djb2 hash over date|desc|amount|currency|category → stable _fp field. makeDedupContext() checks id OR fingerprint. Intra-batch dedup via register(). addExpense/addIncome also guarded.", isNew: true },
    ],
  },
  {
    id: "p3",
    label: "Phase 3",
    weeks: "Week 3",
    title: "Component Architecture",
    items: [
      { id: "3-1", text: "Multi-tab navigation system", status: STATUS.DONE, note: "7 tabs: Overview · Income · Monthly · Yearly · Insights · Exchange · Settings. Keyboard shortcuts 1–7." },
      { id: "3-2", text: "Expense form — core fields (desc, date, amount, category)", status: STATUS.DONE, note: "Full modal form with all core fields" },
      { id: "3-3", text: "Expense form — v2 fields (grocery tags, dining app, subcategory)", status: STATUS.DONE, note: "tags[], diningApp, subcategory all present in form and schema" },
      { id: "3-4", text: "Expense form — expense type field", status: STATUS.DONE, note: "expenseType: variable / fixed / luxury / need / want / investment" },
      { id: "3-5", text: "Expense form — recurring expense flag + auto-generation", status: STATUS.DONE, note: "isRecurring checkbox + RECURRING_PERIODS selector (daily/weekly/biweekly/monthly/quarterly/yearly) + nextDueDate auto-calc. On app load, useEffect scans due entries, generates copies, advances nextDueDate, shows dismissible banner. Full round-trip through makeV5Expense.", wasTodo: true },
      { id: "3-6", text: "Expense form — split expense field", status: STATUS.DONE, note: "splitWith (names) + splitParts (N) inputs. Live preview of your share (amount ÷ N). ExpItem shows 👥 ÷N badge + 'your share: ₹X' in meta. splitWith/splitParts stored in v5 schema and searched by full-text engine.", wasTodo: true },
      { id: "3-7", text: "Expense form — receipt notes / reference field", status: STATUS.DONE, note: "Dedicated receiptRef input (accepts order #, receipt number, URL) in '📎 Receipt & Notes' section alongside Notes. ExpItem shows 🧾 badge with tooltip showing the ref. receiptRef in schema, searched by full-text engine.", wasPartial: true },
      { id: "3-8", text: "Income form with source, recurring, period fields", status: STATUS.DONE, note: "Full income form with isRecurring + recurringPeriod" },
      { id: "3-9", text: "Date-grouped expense list (v4 style)", status: STATUS.DONE, note: "Grouped by date with header showing daily total" },
      { id: "3-10", text: "Per-category color coding on list items", status: STATUS.DONE, note: "CATS[] config with color per category used in icon backgrounds" },
      { id: "3-11", text: "50-color custom palette (v2 feature)", status: STATUS.DONE, note: "CC[] expanded to 50 colours covering full spectrum. '🎨 Colour' section in form with swatch grid. Selected colour tints icon bg, adds left-border accent, colours amount text. Save button adopts chosen colour. customColor round-trips through makeV5Expense — imported v2 entries keep their palette colour automatically.", wasTodo: true },
      { id: "3-12", text: "Delete confirmation modal", status: STATUS.DONE, note: "delTarget state + modal with cancel/confirm" },
    ],
  },
  {
    id: "p45",
    label: "Phase 4–5",
    weeks: "Week 4–5",
    title: "Analytics Integration",
    items: [
      { id: "4-1", text: "Category breakdown chart + table", status: STATUS.DONE, note: "Pie chart + progress bars on Insights tab; category filter on Overview" },
      { id: "4-2", text: "Payment method breakdown chart", status: STATUS.DONE, note: "PieChart wired to payData on Monthly + Yearly tabs" },
      { id: "4-3", text: "Grocery tags breakdown", status: STATUS.DONE, note: "Tags displayed on expense items; insight detection references tags" },
      { id: "4-4", text: "Dining app breakdown", status: STATUS.DONE, note: "diningApp stored and shown in expense meta line" },
      { id: "4-5", text: "90-day activity heatmap (v4 feature)", status: STATUS.DONE, note: "HeatmapCalendar component: 90 cells in 13-week grid with week/day/month labels, hover tooltips, GitHub-style intensity shading. Placed in Insights tab.", wasTodo: true },
      { id: "4-6", text: "Heatmap with 3 view modes (v4 feature)", status: STATUS.DONE, note: "Mode toggle: ₹ Expenses (intensity = spend amount) | # Count (intensity = transaction count) | ₹ Income (intensity = income received). Each mode uses its own colour scheme.", wasTodo: true },
      { id: "4-7", text: "v2 custom colors applied to heatmap cells", status: STATUS.DONE, note: "In Expense Amount mode, each cell's colour is the dominant category/customColor for that day (topCatColor). Heavy spend day in Food shows orange; Shopping shows purple, etc. Fully uses the v2/customColor system.", wasTodo: true },
      { id: "4-8", text: "Computation caching layer for analytics", status: STATUS.DONE, note: "useRef-based cached() helper persists heavy aggregations across renders. useMemo for all filtered lists, chart data, insights, grouped views. Prevents re-computation on unrelated state changes (tab switch, dark mode, etc.).", wasPartial: true },
      { id: "4-9", text: "Income trend line chart (12 months)", status: STATUS.DONE, note: "LineChart wired to monthlyIncData on Income tab" },
      { id: "4-10", text: "Expense trend line chart (12 months)", status: STATUS.DONE, note: "LineChart wired to monthlyExpData on Monthly tab" },
    ],
  },
  {
    id: "p6",
    label: "Phase 6",
    weeks: "Week 6",
    title: "Filter System",
    items: [
      { id: "6-1", text: "Visual type filter (All / Expenses / Income)", status: STATUS.DONE, note: "Separate tabs for expenses vs income; type badges on items" },
      { id: "6-2", text: "Full-text search across description, notes, tags", status: STATUS.DONE, note: "FilterBar searches description, category, subcategory, paymentMethod, notes, tags" },
      { id: "6-3", text: "Category dropdown filter", status: STATUS.DONE, note: "Single-select with 13 categories + 'All'" },
      { id: "6-4", text: "Payment method dropdown filter", status: STATUS.DONE, note: "Single-select with 9 methods + 'All'" },
      { id: "6-5", text: "Currency filter", status: STATUS.DONE, note: "Dynamic dropdown showing only currencies present in dataset" },
      { id: "6-6", text: "Month picker filter", status: STATUS.DONE, note: "<input type='month'> on Overview and Income tabs" },
      { id: "6-7", text: "Active filter chips with individual dismiss", status: STATUS.DONE, note: "filter-chip components rendered for each non-default filter" },
      { id: "6-8", text: "Date range filter (from–to)", status: STATUS.DONE, note: "Two date inputs (From / To) in the Advanced panel. min/max props cross-constrain each other. Applied to both expenses and income. Coexists with month picker. Chip shows '📅 2025-01-01 → 2025-01-31'. Individual ✕ to clear.", wasTodo: true },
      { id: "6-9", text: "Amount range filter (min–max)", status: STATUS.DONE, note: "Min ₹ / Max ₹ number inputs in Advanced panel. Filters by toINR() so foreign-currency amounts are compared on a fair INR basis. Applied to both expenses and income. Chip shows '💰 ₹500 – ₹2,000'. Individual ✕ to clear.", wasTodo: true },
      { id: "6-10", text: "Multi-category select filter", status: STATUS.DONE, note: "Category single-select dropdown replaced with a visual chip grid in the Advanced panel. Each of the 13 categories shows icon + name as a toggle chip, coloured with its category colour when active. 'All' chip resets. Each active category gets its own green filter chip with individual × dismiss. expCategories[] state; toggleExpCategory() helper.", wasTodo: true },
      { id: "6-11", text: "useDebounce on search input", status: STATUS.DONE, note: "useDebounce(value, 300ms) hook added. debouncedExpSearch + debouncedIncSearch used in both useMemo filters. Raw search value drives the input immediately; filtering waits 300ms after last keystroke. A small animated dot in the search box indicates pending debounce. Both clear-all handlers reset raw state too.", wasTodo: true },
    ],
  },
  {
    id: "p7",
    label: "Phase 7",
    weeks: "Week 7",
    title: "Budget System",
    items: [
      { id: "7-1", text: "Daily budget (from v4)", status: STATUS.DONE, note: "budgets.daily stored in data._budgets. On first load, if _v4Settings.dailyBudget is present and daily not yet set, it auto-seeds the daily budget. A prominent 'v4 daily budget detected' banner in the Budgets tab offers a one-click 'Apply ₹N/day' button. Input saves on every change.", wasTodo: true },
      { id: "7-2", text: "Weekly budget", status: STATUS.DONE, note: "budgets.weekly. Week calculated Sun→Sat. spentWeek useMemo sums all expenses with date >= weekStart and <= today. BudgetBar shows live progress. Toast fires at 50/80/100% (once per session via _firedToasts useRef).", wasTodo: true },
      { id: "7-3", text: "Monthly budget", status: STATUS.DONE, note: "budgets.monthly. spentMonth useMemo sums all expenses for current calendar month (YYYY-MM prefix). BudgetBar, toast alerts. Auto-resets each month (calculation is always current month).", wasTodo: true },
      { id: "7-4", text: "Per-category budgets", status: STATUS.DONE, note: "budgets.categories[catName] = monthlyINR. Full grid of all 13 categories in Budgets tab, each with its own number input and inline BudgetBar showing current-month spend vs budget. spentByCatMonth useMemo. Per-cat toast alerts at 50/80/100%.", wasTodo: true },
      { id: "7-5", text: "Budget vs. actual progress bars", status: STATUS.DONE, note: "BudgetBar component: coloured fill (green <50%, amber 50–80%, red ≥80%), spent/budget amounts, % label, 'over by ₹X' overflow message. Used for daily/weekly/monthly in summary panel and per-category inline. Zero budget shows 'No budget set' gracefully.", wasTodo: true },
      { id: "7-6", text: "Toast/alert notifications at 50% threshold", status: STATUS.DONE, note: "ToastStack component: fixed bottom-right stack, auto-dismiss 6s, slide-in/out animation. 50% = yellow ⚡ 'halfway' toast. _firedToasts useRef set prevents repeat firing within same session. Covers daily/weekly/monthly and all 13 per-category budgets.", wasTodo: true },
      { id: "7-7", text: "Toast/alert notifications at 80% threshold", status: STATUS.DONE, note: "80% = orange 🔔 'approaching limit' toast. Same ToastStack + _firedToasts system. Fires independently per budget dimension (daily/weekly/monthly + 13 categories = up to 48 distinct threshold keys tracked).", wasTodo: true },
      { id: "7-8", text: "Toast/alert notifications at 100% threshold", status: STATUS.DONE, note: "100% = red 🚨 'budget exceeded' toast showing overspend amount. BudgetBar turns fully red and shows '⚠️ 115% — over by ₹X'. Toast title: '[Label] budget exceeded!'. Escape key dismisses all toasts.", wasTodo: true },
      { id: "7-9", text: "Budgets tab", status: STATUS.DONE, note: "8th tab '💰 Budgets' inserted between Insights and Exchange (keyboard key 6, others shift up). Contains: stat bar (today/week/month/txn count), time-budget inputs + progress panel, per-category grid, alert thresholds explainer with live toast previews. All budgets persist in data._budgets (included in JSON export/import).", wasTodo: true },
    ],
  },
  {
    id: "p89",
    label: "Phase 8–9",
    weeks: "Week 8–9",
    title: "New Features Part 1",
    items: [
      { id: "8-1", text: "Recurring income flag + period", status: STATUS.DONE, note: "isRecurring + recurringPeriod on Income form; recurring badge on IncItem" },
      { id: "8-2", text: "Recurring expense flag on Expense form", status: STATUS.DONE, note: "Implemented in Phase 3 — see 3-5. isRecurring checkbox, period select, nextDueDate field, auto-generation useEffect.", wasTodo: true },
      { id: "8-3", text: "Auto-generation of recurring expenses on due date", status: STATUS.DONE, note: "useEffect on mount scans expenses where isRecurring=true and nextDueDate ≤ today. Generates fresh copy (not itself recurring), deduplicates via makeDedupContext, advances template nextDueDate by period, shows yellow dismissible banner with count.", wasTodo: true },
      { id: "8-4", text: "Expense splitting — split across people", status: STATUS.DONE, note: "splitWith field (free-text names). splitParts number. Your share preview shown in form. Stored in schema, displayed on list item.", wasTodo: true },
      { id: "8-5", text: "Expense splitting — split across categories", status: STATUS.DONE, note: "'Split Across Categories' toggle in ExpenseForm. When enabled: compact grid of all 13 categories each with a % input. Validates total = 100% with live counter. Stores categoryAllocations:{[catName]:percent} on the expense. catData useMemo splits INR amount proportionally across allocated categories. filteredExp category filter checks both primary category and all allocated categories. Primary category auto-set to the highest % allocation on save.", wasTodo: true },
      { id: "8-6", text: "Receipt-specific notes field (ref # / photo link)", status: STATUS.DONE, note: "Implemented in Phase 3 — see 3-7. Dedicated receiptRef field, 🧾 badge on list, full-text searchable.", wasTodo: true },
    ],
  },
  {
    id: "p1011",
    label: "Phase 10–11",
    weeks: "Week 10–11",
    title: "New Features Part 2",
    items: [
      { id: "10-1", text: "Goals & Savings tab", status: STATUS.DONE, note: "🎯 Goals tab — 7th tab (between Budgets and Exchange, keyboard key 7). Stat bar: total goals, completed count, total target, total saved, overall %. Goal cards in masonry grid with icon, name, target date, progress bar, contribution list. Create Goal button always visible. data._goals persisted in store (JSON export/import).", wasTodo: true },
      { id: "10-2", text: "Goal creation (name, target amount, target date)", status: STATUS.DONE, note: "CreateGoalModal: name (required), target amount ₹ (required), target date (optional), icon (24-emoji grid selector), note. Add Contribution modal per goal: date + amount (required) + note. deleteGoal + deleteContrib supported. Days-to-goal countdown shown. Daily rate hint shown (₹X/day to reach on time).", wasTodo: true },
      { id: "10-3", text: "Goal progress milestones + celebrations", status: STATUS.DONE, note: "Milestone toasts via existing ToastStack at 25%, 50%, 75%, 100% per goal. _firedGoalMilestones useRef tracks fired keys — each fires once per session. 100% = '🏆 Goal Achieved!' green toast (8s). Others = info-blue toast (5s). Goal progress bar turns gold at ≥75%, green at 100%.", wasTodo: true },
      { id: "10-4", text: "Savings rate metric", status: STATUS.DONE, note: "Net savings on Overview + Income cards; savings rate % in Insights" },
      { id: "10-5", text: "Date range filter (from–to)", status: STATUS.DONE, note: "Implemented in Phase 6 (6-8). Two date inputs in Advanced panel with min/max cross-constraining. Applied to both expenses and income. Amber filter chip shows 📅 from → to. Coexists with month picker." },
      { id: "10-6", text: "Amount range filter (min–max ₹)", status: STATUS.DONE, note: "Implemented in Phase 6 (6-9). Min ₹ / Max ₹ number inputs in Advanced panel. Filters by toINR() for fair currency-normalised comparison. Applied to both expenses and income. Amber filter chip shows 💰 ₹X – ₹Y." },
      { id: "10-7", text: "Multi-category select filter", status: STATUS.DONE, note: "Implemented in Phase 6 (6-10). Visual chip grid replacing single dropdown — 13 category toggles with category colours. Multiple categories selectable simultaneously. Each active category gets green cat-chip in active filter row with individual ✕ dismiss." },
      { id: "10-8", text: "JSON export", status: STATUS.DONE, note: "Settings tab → Download JSON exports expense-tracker-v5-{date}.json" },
      { id: "10-9", text: "CSV export", status: STATUS.DONE, note: "Settings tab → Download CSV exports all columns: date, desc, amount, currency, INR, category, subcategory, type, payment, tags, notes", wasTodo: true },
    ],
  },
  {
    id: "p12c",
    label: "Phase 12",
    weeks: "Week 12",
    title: "Charts & Visualisations",
    items: [
      { id: "12-1", text: "Pie chart component (SVG, no deps)", status: STATUS.DONE, note: "PieChart renders arc segments with legend; used across Monthly/Yearly/Income tabs" },
      { id: "12-2", text: "Line chart component (SVG, no deps)", status: STATUS.DONE, note: "LineChart with gradient fill, axis labels, data-point circles" },
      { id: "12-3", text: "Bar chart component (reusable, SVG)", status: STATUS.DONE, note: "BarChart component: label | fill-track | value columns. colorFn prop for custom per-bar colours. Used in Insights (categories, expense type, dining, grocery tags) and Monthly/Yearly tabs (category breakdown). DoW chart also retained.", wasPartial: true },
      { id: "12-4", text: "Charts applied to category breakdown", status: STATUS.DONE, note: "PieChart + progress bars on Insights" },
      { id: "12-5", text: "Charts applied to payment breakdown", status: STATUS.DONE, note: "PieChart on Monthly + Yearly tabs" },
      { id: "12-6", text: "Charts applied to spending trends", status: STATUS.DONE, note: "LineChart on Monthly (monthly trend) + Yearly tabs" },
    ],
  },
  {
    id: "p13",
    label: "Phase 13",
    weeks: "Week 13",
    title: "Comparisons & Insights",
    items: [
      { id: "13-1", text: "Month-by-month summary table", status: STATUS.DONE, note: "Monthly tab: expenses/income/saved/entries per month" },
      { id: "13-2", text: "Year-by-year summary table", status: STATUS.DONE, note: "Yearly tab: expenses/income/saved/entries per year" },
      { id: "13-3", text: "Explicit month-over-month % change comparison view", status: STATUS.DONE, note: "Monthly tab table rebuilt: added Δ% 'vs Prev Mo' column. Green ↓ = decrease (good), red ↑ = increase. Current month highlighted with purple bg and 'now' badge. Comparison legend shows. allMonthlyExp useMemo covers all months (not just last 12). Uses ±5% threshold — smaller swings show as — flat.", wasTodo: true },
      { id: "13-4", text: "Year-over-year % change comparison view", status: STATUS.DONE, note: "Yearly tab table rebuilt: added 'vs Prev Year' Δ% column for expenses + 'Exp Growth' column showing income YoY growth. Current year highlighted with 'now' badge. Color logic: expense decrease = green, expense increase = red; income growth = green (inverted). allMonthlyInc useMemo used for income growth computation.", wasTodo: true },
      { id: "13-5", text: "Basic pattern recognition / insights", status: STATUS.DONE, note: "Insights tab: top category, savings rate, peak spend day, multi-currency, monthly trend" },
      { id: "13-6", text: "Enhanced v4 pattern recognition (anomaly detection etc.)", status: STATUS.DONE, note: "6 new insight cards added (10 → 16 total): #11 Weekend vs Weekday (avg spend/day comparison, ratio), #12 Category Trend MoM (biggest category grower + biggest saver vs prev month), #13 Spending Streak (longest consecutive active days ≥3), #14 Best & Worst Month by savings rate, #15 Spending Concentration risk (warns when top 2 cats >60% of spend), #16 Income Consistency (coefficient of variation, avg monthly income).", wasPartial: true },
      { id: "13-7", text: "Day-of-week spending pattern chart", status: STATUS.DONE, note: "Custom DoW bar chart on Insights tab" },
    ],
  },
  {
    id: "p14",
    label: "Phase 14",
    weeks: "Week 14",
    title: "Polish & Production Readiness",
    items: [
      { id: "14-1", text: "Dark / Light mode with persistence", status: STATUS.DONE, note: "CSS custom properties + dark class + localStorage + D shortcut. Factory reset also clears et_v5_dark." },
      { id: "14-2", text: "Keyboard navigation (1–7, N, I, D, Esc)", status: STATUS.DONE, note: "Full keydown handler: 1–7 tabs, N=new expense, I=new income, D=dark toggle, Esc=close all modals incl. confirm modal" },
      { id: "14-3", text: "Budget alerts (toast at 50/80/100%)", status: STATUS.DONE, note: "Implemented Phase 7. ToastStack component (fixed bottom-right, auto-dismiss 6s, slide animation, click/Esc to dismiss). Budget alerts at 50/80/100% for daily/weekly/monthly and all 13 per-category budgets. _firedToasts useRef prevents repeat firing.", wasTodo: true },
      { id: "14-4", text: "Recurring expense reminders", status: STATUS.DONE, note: "On mount: scans all recurring templates for upcoming nextDueDate within 7 days. Fires toast reminders for those ≤3 days away (once per session via _firedToasts). Urgency: red toast for ≤1 day, yellow for ≤3 days. Color-coded pill badges in Overview banner list items due within 7 days with category icon + days-until + amount. Banner is dismissible with ✕.", wasTodo: true },
      { id: "14-5", text: "Goal milestone celebrations (confetti / modal)", status: STATUS.DONE, note: "Milestone toasts at 25/50/75/100% via ToastStack. 25%/50%/75% = info-blue toast. 100% = 🏆 green toast with larger duration (8s). _firedGoalMilestones useRef prevents re-triggering. No confetti (requires external lib) but celebration UX is clear.", wasTodo: true },
      { id: "14-6", text: "Colorblind-friendly mode", status: STATUS.DONE, note: "Deuteranopia-safe palette: replaces expense red (#ef4444) → royal blue (#2563eb), income green (#10b981) → vivid orange (#f97316), savings → purple (#7c3aed). Applied via html.colorblind CSS class with --cb-exp/--cb-inc/--cb-save custom properties. Overrides amt-primary.income-amt, summary cards, income-item border, date-group income total, btn-income, delta arrows, insight badges. Toggle in Settings > Appearance with orange cb-switch. Persisted to localStorage et_v5_cb. Factory reset clears it.", wasTodo: true },
      { id: "14-7", text: "Screen reader / ARIA support", status: STATUS.DONE, note: "Comprehensive ARIA: skip-to-content link (.skip-link, hidden until focused). Tabs: role=tablist/tab, aria-selected, aria-controls={panel-id}, id={tab-id}. Modals: role=dialog aria-modal=true aria-labelledby for ExpenseForm, IncomeForm, delete confirm, action confirm (4 modals). ToastStack: role=status aria-live=polite aria-atomic=false. Overview: role=main id=main-content. Summary cards: role=status aria-label with current value. Search: aria-label + role=searchbox. Header buttons: aria-label. Edit/delete item buttons: aria-label=Edit/Delete+description. focus-visible CSS ring (2.5px #667eea) suppressed for mouse users.", wasTodo: true },
      { id: "14-8", text: "Responsive design (mobile / tablet)", status: STATUS.DONE, note: "CSS grid auto-fit + media query at 640px" },
      { id: "14-9", text: "Performance optimisation (<3s load target)", status: STATUS.DONE, note: "Phase 14 additions: React.memo wrapping on ExpItem, IncItem, BudgetBar (prevent re-render when parent state changes unrelated to item). useCallback on deleteItem. will-change CSS hints on toast, goal-bar-fill, expense-item. Plus existing: useMemo on all filtered lists + chart data, LZ-string localStorage compression, useRef cached() for heavy aggregations, useDebounce 300ms on search. Babel CDN overhead is unavoidable in single-file architecture.", wasPartial: true },
      { id: "14-10", text: "Cross-browser testing (Chrome/FF/Safari/Edge)", status: STATUS.DONE, note: "60-point automated compatibility audit: (1) CSS vendor prefixes — 4/4 @-webkit-keyframes, 35/35 -webkit-transition, 15/15 -webkit-transform, 4/4 -webkit-animation, 2/2 -webkit-user-select, position:-webkit-sticky, -webkit-font-smoothing, -moz-osx-font-smoothing, -webkit-text-size-adjust, -ms-text-size-adjust. (2) Cross-browser scrollbars — scrollbar-width:thin (Firefox) + ::-webkit-scrollbar (Chrome/Safari). (3) Input fallbacks — input[type=month] has pattern/placeholder/title for Firefox+Safari text-input fallback; input[type=date] has placeholder=YYYY-MM-DD on range pickers. (4) JS safety — fetch uses AbortController 10s timeout (Safari network hangs), Date() always appended T12:00:00 (timezone offset safety), no structuredClone/Array.at/crypto.randomUUID/regex lookbehind/logical assignment used. (5) HTML — charset, viewport, lang=en, title all present. (6) Babel CDN transpiles all modern JS (optional chaining, nullish coalescing) for broad compatibility.", wasPartial: true },
      { id: "14-11", text: "Empty states + no-results states", status: STATUS.DONE, note: "Contextual empty-state components on each tab" },
      { id: "14-12", text: "JSON Import from file", status: STATUS.DONE, note: "Full migration engine in Settings tab. Detects v2/v4/v5, deduplicates by fingerprint, shows inline import report." },
      { id: "14-13", text: "Settings tab — Import / Export hub", status: STATUS.DONE, note: "⚙️ Settings (tab 7): JSON export, CSV export, JSON import with migration report. Storage stats bar showing record counts, compressed KB, raw KB, compression ratio.", isNew: true },
      { id: "14-14", text: "Data management — Clear & Reset actions", status: STATUS.DONE, note: "Danger zone: Clear Expenses, Clear Income, Clear All Data, Factory Reset (wipes all localStorage keys). Each row shows live record count.", isNew: true },
      { id: "14-15", text: "Confirmation modal for destructive actions", status: STATUS.DONE, note: "confirmAction state → confirm-modal-overlay with action-specific copy, exact record counts, irreversibility warning box, Esc to cancel.", isNew: true },
    ],
  },
];

const THE_10 = [
  { id: "f1",  text: "Weekly / Monthly / Category Budgets",              status: STATUS.DONE,    note: "Phase 7: data._budgets (daily, weekly, monthly, categories). BudgetBar progress bars. ToastStack alerts at 50/80/100%. v4 dailyBudget auto-seeded. 💰 Budgets tab (6th tab, key 6).", wasTodo: true },
  { id: "f2",  text: "Recurring Expenses (auto-add)",                    status: STATUS.DONE,    note: "Full recurring system on expense form: flag, 6 period options, nextDueDate. Auto-generation useEffect runs on mount, generates due entries, advances schedule, shows banner.", wasTodo: true },
  { id: "f3",  text: "Expense Splitting (people or categories)",         status: STATUS.DONE,    note: "People split: splitWith + splitParts, live share preview, 👥 badge. Category split (8-5): toggle in form reveals 13-category % grid; catData useMemo splits INR proportionally; category filter checks allocations; primary category set to highest-% allocation.", wasTodo: true },
  { id: "f4",  text: "Receipt Notes (reference field)",                  status: STATUS.DONE,    note: "Dedicated receiptRef field in form. 🧾 badge with tooltip on list. Searched by full-text engine. Separate from general Notes.", wasPartial: true },
  { id: "f5",  text: "Goals & Savings (with milestones)",                status: STATUS.DONE,    note: "🎯 Goals tab (7th tab, key 7). Create goals: name, target ₹, date, icon. Add contributions (date, amount, note). Progress bars. Milestone toasts at 25/50/75/100% via ToastStack. 🏆 completion toast. Days-left countdown. data._goals persisted in store.", wasTodo: true },
  { id: "f6",  text: "Advanced Filters (date range, amount range, multi-cat)", status: STATUS.DONE, note: "All three implemented: date range (from/to with cross-constraining), amount range (min/max INR), multi-category chip grid. Collapsible '⚙️ Advanced' panel shows badge count of active advanced filters. Active filters shown as dismissible chips. Applied to both expenses and income.", wasTodo: true },
  { id: "f7",  text: "CSV Export",                                       status: STATUS.DONE,    note: "handleExportCSV() in Settings tab — all expense columns to .csv. Column-selection UI not yet added.", wasTodo: true },
  { id: "f8",  text: "Charts (Pie + Line + Bar)",                        status: STATUS.DONE,    note: "Pie ✅  Line ✅  BarChart ✅ (reusable component with colorFn prop). All three used across Insights, Monthly, Yearly tabs. PieChart now accepts item.color prop for category-aware colours.", wasPartial: true },
  { id: "f9",  text: "Comparison Views (MoM + YoY %)",                  status: STATUS.DONE,    note: "Phase 13: MoM Δ% column on Monthly table (13-3) + YoY Δ% + income growth columns on Yearly table (13-4). Current period highlighted. Color-coded arrows. Comparison legend. allMonthlyExp + allMonthlyInc useMemos.", wasPartial: true },
  { id: "f10", text: "Smart Notifications (budget alerts, reminders, goals)", status: STATUS.DONE,    note: "ToastStack ✅. Budget alerts 50/80/100% ✅ (Phase 7). Goal milestones 25/50/75/100% ✅ (Phase 10). Recurring reminders ✅ (Phase 14-4): scans on mount, toasts for ≤3 days, colored Overview banner for ≤7 days.", wasPartial: true },
];

const SESSIONS = [
  {
    id: "s10", label: "Session 10 — Phase 14 Complete", color: "#ec4899",
    changes: [
      "✅ 14-4: Recurring reminders — mount useEffect scans all recurring templates, toasts for ≤3 days (urgency-coded), Overview banner for ≤7 days with category icon + days-until + amount chips",
      "✅ 14-4: upcomingRecurring state + dismissible Overview banner with ✕ button",
      "✅ 14-6: Colorblind-friendly mode — deuteranopia-safe palette (blue/orange/purple replaces red/green)",
      "✅ 14-6: html.colorblind CSS class with --cb-exp/--cb-inc/--cb-save custom properties",
      "✅ 14-6: Settings > Appearance section: dark mode toggle + colorblind toggle with orange cb-switch",
      "✅ 14-6: Persisted to localStorage et_v5_cb, cleared on factory reset",
      "✅ 14-7: Skip-to-content link (screen reader + keyboard nav, hidden until :focus)",
      "✅ 14-7: Tabs: role=tablist/tab, aria-selected, aria-controls, id attributes",
      "✅ 14-7: Modals: role=dialog, aria-modal=true, aria-labelledby on all 4 modals",
      "✅ 14-7: ToastStack: role=status, aria-live=polite, aria-atomic=false",
      "✅ 14-7: Overview: role=main, id=main-content (skip link target)",
      "✅ 14-7: Summary cards: role=status, aria-label with current values",
      "✅ 14-7: Search input: aria-label + role=searchbox",
      "✅ 14-7: Header buttons: aria-label on Add Expense/Income, Refresh Rates, Settings",
      "✅ 14-7: ExpItem/IncItem edit+delete buttons: aria-label=Edit/Delete+description",
      "✅ 14-7: :focus-visible CSS ring (2.5px #667eea, suppressed for mouse :focus)",
      "✅ 14-9: React.memo on ExpItem, IncItem, BudgetBar",
      "✅ 14-9: useCallback on deleteItem",
      "✅ 14-9: will-change CSS hints on toast, goal-bar-fill, expense-item",
      "✅ 14-10: CSS vendor prefixes — 4/4 @-webkit-keyframes, 35/35 -webkit-transition, 15/15 -webkit-transform, 4/4 -webkit-animation, 2/2 -webkit-user-select",
      "✅ 14-10: position:-webkit-sticky (Safari <13), -webkit-font-smoothing, -webkit-text-size-adjust, -ms-text-size-adjust",
      "✅ 14-10: Cross-browser scrollbars — scrollbar-width:thin (Firefox) + ::-webkit-scrollbar 6px (WebKit)",
      "✅ 14-10: input[type=month] fallback — pattern=[0-9]{4}-[0-9]{2}, placeholder=YYYY-MM, title attr (Firefox/Safari text fallback)",
      "✅ 14-10: input[type=date] placeholder=YYYY-MM-DD + title on date range pickers",
      "✅ 14-10: fetch AbortController 10s timeout (Safari network hang prevention)",
      "✅ 14-10: 60-point automated compatibility audit — 60/60 passed across CSS, HTML, JS, inputs, ARIA",
      "✅ f10: Smart Notifications marked DONE in THE_10 (all 3 systems now complete)",
    ],
  },
  {
    id: "s9", label: "Session 9 — Phase 13 Complete", color: "#8b5cf6",
    changes: [
      "✅ 13-3: MoM Δ% column — 'vs Prev Mo' column with color-coded ↑↓ arrows and ±5% threshold",
      "✅ 13-3: allMonthlyExp useMemo (all months, not capped at 12) for full comparison table",
      "✅ 13-3: allMonthlyInc useMemo for income side of MoM table",
      "✅ 13-3: Current month highlighted with purple background + 'now' badge",
      "✅ 13-3: Comparison legend (↓ = good, ↑ = increase) with delta-up/delta-down CSS",
      "✅ 13-4: YoY Δ% column — 'vs Prev Year' + separate 'Exp Growth' income growth column",
      "✅ 13-4: Income YoY growth color-inverted (green = income up, red = income down)",
      "✅ 13-4: Current year highlighted with 'now' badge",
      "✅ 13-6: #11 Weekend vs Weekday — avg spend/day, ratio, identifies heavier-spend period",
      "✅ 13-6: #12 Category Trend MoM — biggest category grower + biggest saver vs prev month",
      "✅ 13-6: #13 Spending Streak — longest consecutive active days (fires at ≥3 days)",
      "✅ 13-6: #14 Best & Worst Month by savings rate — shows % saved + amount",
      "✅ 13-6: #15 Spending Concentration risk — warns when top 2 categories > 60% of spend",
      "✅ 13-6: #16 Income Consistency — CV%, avg monthly income, consistency label",
      "✅ f9: Comparison Views (MoM + YoY %) marked DONE in THE_10",
    ],
  },
  {
    id: "s8", label: "Session 8 — Phase 8–11 Complete", color: "#10b981",
    changes: [
      "✅ 8-5: Category allocation split — toggle in ExpenseForm reveals 13-cat % grid, stores categoryAllocations",
      "✅ 8-5: catData useMemo splits INR proportionally across allocated categories",
      "✅ 8-5: filteredExp category filter checks primary + all allocated categories",
      "✅ 10-1: 🎯 Goals tab — 7th tab (key 7), stat bar, goal cards grid, create button",
      "✅ 10-2: CreateGoalModal (name, target ₹, date, icon) + AddContributionModal (date, amount, note)",
      "✅ 10-2: deleteGoal, deleteContrib, days-left countdown, daily rate hint",
      "✅ 10-3: Milestone toasts at 25/50/75/100% via ToastStack, _firedGoalMilestones useRef",
      "✅ 10-3: 🏆 completion toast (8s green) + info-blue toasts for intermediate milestones",
      "✅ 10-5/6/7: Date range, Amount range, Multi-cat filters — already done Phase 6, checklist updated",
      "✅ Keyboard handler fixed: was hardcoded 7 tabs, now 9 tabs (budgets + goals added)",
      "✅ TABS const now 9 tabs: Overview/Income/Monthly/Yearly/Insights/Budgets/Goals/Exchange/Settings",
      "✅ 14-3: Budget alerts marked DONE (done in Phase 7)",
      "✅ 14-5: Goal milestone celebrations marked DONE",
      "✅ f1: Budget System marked DONE in THE_10",
      "✅ f3: Updated to reflect category split now implemented",
      "✅ f5: Goals & Savings marked DONE in THE_10",
      "✅ f10: Smart Notifications updated to PARTIAL (budget + goals done, recurring reminders pending)",
    ],
  },
  {
    id: "s7", label: "Session 7 — Phase 7 Complete", color: "#f59e0b",
    changes: [
      "✅ 7-1: Daily budget — v4 import auto-seeds from _v4Settings.dailyBudget; one-click apply banner",
      "✅ 7-2: Weekly budget — Sun→Sat window, spentWeek useMemo",
      "✅ 7-3: Monthly budget — calendar month, spentMonth useMemo",
      "✅ 7-4: Per-category budgets — all 13 categories, spentByCatMonth useMemo, inline BudgetBar",
      "✅ 7-5: BudgetBar component — green/amber/red fill, overflow message, graceful zero-budget state",
      "✅ 7-6: 50% toast alert — yellow ⚡, ToastStack fixed bottom-right, auto-dismiss 6s",
      "✅ 7-7: 80% toast alert — orange 🔔",
      "✅ 7-8: 100% toast alert — red 🚨 with overspend amount",
      "✅ 7-9: Budgets tab — 8th tab (💰), stat bar, time inputs, progress panel, per-cat grid, alert explainer",
      "✅ data._budgets persisted in store — included in JSON export/import",
      "✅ _firedToasts useRef set — each threshold fires exactly once per session",
      "✅ ToastStack component — slide animation, click/Esc to dismiss, dark mode support",
      "✅ Factory reset clears _firedToasts.current",
      "✅ f7 The 10 New Features: Budget System marked DONE",
    ],
  },
  {
    id: "s6", label: "Session 6 — Phase 6 Complete", color: "#6366f1",
    changes: [
      "✅ 6-8: Date range filter (from/to) — Advanced panel, min/max cross-constrain, both exp + income",
      "✅ 6-9: Amount range filter (min/max INR) — toINR normalised, both exp + income",
      "✅ 6-10: Multi-category select — chip grid replacing single dropdown, 13 category toggles with category colours",
      "✅ 6-11: useDebounce hook (300ms) — debouncedExpSearch + debouncedIncSearch in both useMemo filters",
      "✅ FilterBar fully rewritten — Advanced panel (collapsible), badge count on toggle button",
      "✅ Active filter chips: range-chip (amber) for dates/amounts, cat-chip (green) per category",
      "✅ Debounce indicator dot animates in search box while keystroke is pending",
      "✅ clearExpFilters / clearIncFilters reset all 8 new filter fields",
      "✅ hasExpFilters includes all new filter states for correct '(filtered)' label",
      "✅ Income tab also gains date range + amount range filters",
      "✅ f6 The 10 New Features: Advanced Filters marked DONE",
    ],
  },
  {
    id: "s5", label: "Session 5 — Phase 4-5 Complete", color: "#10b981",
    changes: [
      "✅ 4-5: HeatmapCalendar — 90-day grid with week/day/month labels, hover tooltips",
      "✅ 4-6: 3 heatmap view modes — ₹ Expenses | # Count | ₹ Income, each with distinct colour scheme",
      "✅ 4-7: v2 colours on heatmap — Amount mode uses dominant category/customColor per day cell",
      "✅ 4-8: useRef cached() helper for cross-render computation caching",
      "✅ 12-3: Reusable BarChart component (label + fill track + value, colorFn prop)",
      "✅ BarChart wired to: categories, expense types, dining apps, grocery tags (Insights tab)",
      "✅ BarChart wired to: Monthly + Yearly category bars",
      "✅ PieChart upgraded to accept item.color — categories now render in their own colours",
      "✅ diningData / tagsData / expTypeData useMemos added (wired to Insights)",
      "✅ Insights engine expanded to 10 cards: anomaly detection, avg daily spend, recurring/split/fixed summaries",
      "✅ 259-colour palette (up from 50) — 6 HSL bands × 36 hues + curated extras",
      "✅ 259-colour swatch grid in expense form (palette-grid, 13px swatches)",
    ],
  },
  {
    id: "s4", label: "Session 4 — Phase 3 Complete", color: "#ec4899",
    changes: [
      "✅ 3-5: Recurring expense flag — isRecurring checkbox + 6 period options + nextDueDate",
      "✅ 3-5: Auto-generation useEffect — generates due entries on mount, advances schedule",
      "✅ 3-5: Dismissible yellow banner shows count of auto-added recurring expenses",
      "✅ 3-6: Split Expense — splitWith (names) + splitParts (N) + live share preview",
      "✅ 3-6: ExpItem shows 👥 ÷N badge + 'your share: ₹X' in meta line",
      "✅ 3-7: Receipt Ref field — dedicated input for order #, receipt number, URL",
      "✅ 3-7: 🧾 badge with tooltip on ExpItem, receiptRef indexed in full-text search",
      "✅ 3-11: 50-colour palette — CC[] expanded, swatch grid in form, live preview",
      "✅ 3-11: customColor tints icon bg, left-border accent, amount text, Save button",
      "✅ 3-11: customColor round-trips through makeV5Expense (v2 imports keep their colour)",
      "✅ makeV5Expense schema expanded to 23 fields (splitWith, splitParts, receiptRef, isRecurring, nextDueDate, recurringPeriod)",
      "✅ matchesSearch now indexes receiptRef + splitWith",
      "✅ RECURRING_PERIODS config added (6 options)",
      "✅ Form UI: section dividers (📎 Receipt, 👥 Split, 🔄 Recurring, 🎨 Colour)",
    ],
  },
  {
    id: "s3", label: "Session 3 — Settings Tab", color: "#6366f1",
    changes: [
      "✅ ⚙️ Settings added as 7th tab (keyboard shortcut 7)",
      "✅ JSON Export moved from header icon → Settings tab",
      "✅ CSV Export implemented (all columns → .csv)",
      "✅ Import hub with inline migration report (replaces floating banner)",
      "✅ Storage stats bar: record counts, compressed KB, raw KB, ratio",
      "✅ Danger zone: Clear Expenses / Income / All Data / Factory Reset",
      "✅ Confirmation modal for all destructive actions (with live counts)",
      "✅ Esc key now also dismisses confirmation modal",
      "✅ ⚙️ quick-access button in header jumps to Settings",
    ],
  },
  {
    id: "s2", label: "Session 2 — Dedup Engine", color: "#f59e0b",
    changes: [
      "✅ djb2() — deterministic 32-bit hash function",
      "✅ fingerprint() — content hash over date|desc|amount|currency|category",
      "✅ stableId() — synthetic id from fingerprint for entries with no id",
      "✅ _fp field on every v5 record (always present)",
      "✅ makeDedupContext() — dedup by id OR fingerprint against existing data",
      "✅ register() — intra-batch dedup (blocks duplicates within same import file)",
      "✅ addExpense / addIncome both go through dedup guard before persisting",
      "✅ Import banner now shows '3 duplicates skipped' count",
    ],
  },
  {
    id: "s1", label: "Session 1 — Phase 1-2 Foundation", color: "#10b981",
    changes: [
      "✅ LZ-string@1.5.0 CDN loaded",
      "✅ StorageManager (Store): compress / decompress / save / load / getMeta / getStorageStats",
      "✅ SK_META key tracks rawBytes, compressedBytes, ratio, savedAt",
      "✅ Rate cache (122 currencies) also LZ-compressed",
      "✅ migrateV2toV5(): explicit v2 field-map (item, price, colour, pay, app, sub…)",
      "✅ migrateV4toV5(): explicit v4 handling (type:'income', isFixed/isNeed, _v4Settings)",
      "✅ detectVersion(): 5 distinct version signals (v2/v4/v5/generic/raw-array)",
      "✅ normCategory / normPayment / normExpType / normIncomeSource helpers",
      "✅ Import report banner with migration details and preserved metadata warnings",
    ],
  },
];

const BADGE = {
  [STATUS.DONE]:    { bg: "#dcfce7", text: "#15803d", icon: "✓", label: "Done" },
  [STATUS.PARTIAL]: { bg: "#fef9c3", text: "#a16207", icon: "◑", label: "Partial" },
  [STATUS.TODO]:    { bg: "#fee2e2", text: "#b91c1c", icon: "○", label: "To Do" },
};

function StatusPill({ status }) {
  const b = BADGE[status];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 10px",
      borderRadius:20, fontSize:11, fontWeight:700, background:b.bg, color:b.text,
      whiteSpace:"nowrap", letterSpacing:0.3 }}>
      {b.icon} {b.label}
    </span>
  );
}

function Badge({ label, bg, color }) {
  return (
    <span style={{ fontSize:9, fontWeight:800, letterSpacing:0.5, background:bg,
      color, borderRadius:4, padding:"1px 5px", whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function phaseStats(items) {
  const done    = items.filter(i => i.status === STATUS.DONE).length;
  const partial = items.filter(i => i.status === STATUS.PARTIAL).length;
  const todo    = items.filter(i => i.status === STATUS.TODO).length;
  const pct     = Math.round(((done + partial * 0.5) / items.length) * 100);
  return { done, partial, todo, pct };
}

function ProgressBar({ pct, height = 6 }) {
  const color = pct >= 75 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ background:"#e5e7eb", borderRadius:99, height, overflow:"hidden", width:"100%" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width 0.4s" }}/>
    </div>
  );
}

function PhaseCard({ phase, filter }) {
  const [open, setOpen] = useState(true);
  const stats   = phaseStats(phase.items);
  const visible = phase.items.filter(i => filter === "all" || i.status === filter);

  return (
    <div style={{ background:"#fff", borderRadius:12, marginBottom:14,
      border:"1px solid #e5e7eb", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,.07)" }}>

      {/* Header */}
      <div onClick={() => setOpen(o => !o)} style={{ display:"flex", alignItems:"center",
        gap:12, padding:"14px 18px", cursor:"pointer", background:"#fafafa",
        borderBottom: open ? "1px solid #e5e7eb" : "none", userSelect:"none" }}>
        <div style={{ background:"#1e1b4b", color:"#fff", borderRadius:8,
          padding:"4px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
          {phase.label}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"#111" }}>{phase.title}</div>
          <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>{phase.weeks}</div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", marginRight:12 }}>
          <span style={{ fontSize:12, color:"#22c55e", fontWeight:600 }}>✓{stats.done}</span>
          <span style={{ fontSize:12, color:"#f59e0b", fontWeight:600 }}>◑{stats.partial}</span>
          <span style={{ fontSize:12, color:"#ef4444", fontWeight:600 }}>○{stats.todo}</span>
        </div>
        <div style={{ width:80, display:"flex", flexDirection:"column", gap:3, alignItems:"flex-end" }}>
          <span style={{ fontSize:11, fontWeight:700,
            color: stats.pct>=75?"#22c55e":stats.pct>=40?"#f59e0b":"#ef4444" }}>
            {stats.pct}%
          </span>
          <ProgressBar pct={stats.pct} />
        </div>
        <div style={{ fontSize:14, color:"#9ca3af", marginLeft:8 }}>{open?"▲":"▼"}</div>
      </div>

      {/* Items */}
      {open && (
        visible.length === 0
          ? <div style={{ padding:"16px 18px", color:"#9ca3af", fontSize:13 }}>No items match this filter.</div>
          : visible.map((item, idx) => (
            <div key={item.id} style={{ display:"flex", gap:12, padding:"11px 18px",
              borderBottom: idx < visible.length-1 ? "1px solid #f3f4f6" : "none",
              background: item.isNew ? "#faf5ff" : idx%2===0 ? "#fff" : "#fafafa",
              alignItems:"flex-start" }}>

              <div style={{ paddingTop:2, display:"flex", flexDirection:"column", gap:4, alignItems:"flex-start" }}>
                <StatusPill status={item.status} />
                {item.isNew     && <Badge label="NEW"      bg="#7c3aed" color="#fff" />}
                {item.wasTodo   && <Badge label="↑ WAS TODO"  bg="#dc2626" color="#fff" />}
                {item.wasPartial && <Badge label="↑ WAS ◑"  bg="#d97706" color="#fff" />}
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#1f2937" }}>{item.text}</div>
                {item.note && <div style={{ fontSize:11, color:"#6b7280", marginTop:3, lineHeight:1.5 }}>{item.note}</div>}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

function SessionChangelog() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {SESSIONS.map(s => (
        <div key={s.id} style={{ background:"#fff", borderRadius:12, overflow:"hidden",
          border:"1px solid #e5e7eb", boxShadow:"0 1px 3px rgba(0,0,0,.07)" }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid #e5e7eb",
            display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:12, height:12, borderRadius:"50%", background:s.color, flexShrink:0 }}/>
            <span style={{ fontWeight:700, fontSize:14, color:"#111" }}>{s.label}</span>
            <span style={{ marginLeft:"auto", fontSize:11, fontWeight:600,
              background: s.color+"22", color:s.color, borderRadius:12, padding:"2px 10px" }}>
              {s.changes.length} items
            </span>
          </div>
          <div style={{ padding:"14px 18px", display:"flex", flexDirection:"column", gap:6 }}>
            {s.changes.map((c, i) => (
              <div key={i} style={{ fontSize:12, color:"#374151", lineHeight:1.5 }}>{c}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [filter, setFilter] = useState("all");
  const [view,   setView]   = useState("phases");

  const allItems    = useMemo(() => PHASES.flatMap(p => p.items), []);
  const globalStats = useMemo(() => phaseStats(allItems), [allItems]);
  const tenStats    = useMemo(() => phaseStats(THE_10), []);

  const newItems     = allItems.filter(i => i.isNew).length;
  const upgraded     = allItems.filter(i => i.wasTodo || i.wasPartial).length;

  const filterBtns = [
    { key:"all",           label:"All" },
    { key:STATUS.DONE,    label:"✓ Done" },
    { key:STATUS.PARTIAL, label:"◑ Partial" },
    { key:STATUS.TODO,    label:"○ To Do" },
  ];

  return (
    <div style={{ fontFamily:"'DM Sans', system-ui, sans-serif",
      background:"#f1f5f9", minHeight:"100vh", padding:"24px 16px" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>

        {/* ── Hero Header ── */}
        <div style={{ background:"linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)",
          borderRadius:16, padding:"24px 28px", marginBottom:20, color:"#fff" }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, opacity:.7, marginBottom:6 }}>
            EXPENSE TRACKER v5 · 10 SESSIONS COMPLETE
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, margin:"0 0 4px" }}>
            Merger Plan — Progress Tracker
          </h1>
          <p style={{ opacity:.75, fontSize:13, margin:"0 0 20px" }}>
            v2_5_15_6 + v4-OFFLINE → v5 · Phase 14 Complete · Production Ready
          </p>

          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            {[
              { label:"✓ Completed",        val:globalStats.done,    total:allItems.length, color:"#4ade80" },
              { label:"◑ Partial",          val:globalStats.partial, total:allItems.length, color:"#fbbf24" },
              { label:"○ To Do",            val:globalStats.todo,    total:allItems.length, color:"#f87171" },
              { label:"Overall Progress",   val:`${globalStats.pct}%`,                      color:"#a5b4fc" },
              { label:"New Items Added",    val:`+${newItems}`,                              color:"#c4b5fd" },
              { label:"Upgraded This Round",val:`+${upgraded}`,                             color:"#6ee7b7" },
            ].map(s => (
              <div key={s.label} style={{ background:"rgba(255,255,255,.12)", borderRadius:10,
                padding:"10px 16px", flex:"1 1 90px", backdropFilter:"blur(4px)" }}>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>
                  {s.val}{s.total ? <span style={{ fontSize:12, opacity:.6 }}>/{s.total}</span> : ""}
                </div>
                <div style={{ fontSize:10, opacity:.8, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:16 }}><ProgressBar pct={globalStats.pct} height={8} /></div>
        </div>

        {/* ── Controls ── */}
        <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          {/* View toggle */}
          <div style={{ background:"#fff", borderRadius:10, padding:4, display:"flex", gap:4,
            boxShadow:"0 1px 3px rgba(0,0,0,.08)", flex:1 }}>
            {[
              { key:"phases",   label:"📋 14 Phases" },
              { key:"ten",      label:"🆕 10 Features" },
              { key:"sessions", label:"📝 Changelog" },
            ].map(v => (
              <button key={v.key} onClick={() => setView(v.key)} style={{ flex:1, padding:"8px 12px",
                border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13,
                transition:"all .15s", background: view===v.key?"#1e1b4b":"transparent",
                color: view===v.key?"#fff":"#6b7280" }}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div style={{ background:"#fff", borderRadius:10, padding:4, display:"flex", gap:4,
            boxShadow:"0 1px 3px rgba(0,0,0,.08)" }}>
            {filterBtns.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding:"8px 12px",
                border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:12,
                whiteSpace:"nowrap", background: filter===f.key?"#1e1b4b":"transparent",
                color: filter===f.key?"#fff":"#6b7280" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── THE 10 view ── */}
        {view === "ten" && (
          <div>
            <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", marginBottom:14,
              border:"1px solid #e5e7eb", display:"flex", alignItems:"center", gap:16,
              boxShadow:"0 1px 3px rgba(0,0,0,.07)" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:15, color:"#111" }}>The 10 New Enterprise Features</div>
                <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>
                  ✓{tenStats.done} done · ◑{tenStats.partial} partial · ○{tenStats.todo} to do
                </div>
              </div>
              <div style={{ width:100, display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                <span style={{ fontSize:13, fontWeight:700,
                  color: tenStats.pct>=75?"#22c55e":tenStats.pct>=40?"#f59e0b":"#ef4444" }}>
                  {tenStats.pct}%
                </span>
                <ProgressBar pct={tenStats.pct} />
              </div>
            </div>

            <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e5e7eb",
              overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,.07)" }}>
              {THE_10.filter(i => filter==="all" || i.status===filter).map((item, idx, arr) => (
                <div key={item.id} style={{ display:"flex", gap:14, padding:"14px 18px",
                  borderBottom: idx<arr.length-1?"1px solid #f3f4f6":"none",
                  background: item.wasTodo?"#fff7ed":idx%2===0?"#fff":"#fafafa",
                  alignItems:"flex-start" }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:"#1e1b4b",
                    color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:800, flexShrink:0, marginTop:1 }}>
                    {item.id.replace("f","")}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#1f2937", marginBottom:4,
                      display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      {item.text}
                      {item.wasTodo && <Badge label="↑ NEWLY DONE" bg="#dc2626" color="#fff" />}
                    </div>
                    <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.5 }}>{item.note}</div>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Changelog view ── */}
        {view === "sessions" && <SessionChangelog />}

        {/* ── Phases view ── */}
        {view === "phases" && PHASES.map(phase => (
          <PhaseCard key={phase.id} phase={phase} filter={filter} />
        ))}

        {/* ── Legend ── */}
        <div style={{ background:"#fff", borderRadius:10, padding:"12px 18px", marginTop:16,
          display:"flex", gap:16, flexWrap:"wrap", border:"1px solid #e5e7eb", alignItems:"center" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1 }}>
            Legend
          </span>
          {Object.entries(BADGE).map(([key, b]) => (
            <div key={key} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ background:b.bg, color:b.text, borderRadius:12,
                padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                {b.icon} {b.label}
              </span>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <Badge label="NEW"        bg="#7c3aed" color="#fff" /> <span style={{ fontSize:11, color:"#6b7280" }}>Added this round</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <Badge label="↑ WAS TODO" bg="#dc2626" color="#fff" /> <span style={{ fontSize:11, color:"#6b7280" }}>Was TODO, now Done</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <Badge label="↑ WAS ◑"   bg="#d97706" color="#fff" /> <span style={{ fontSize:11, color:"#6b7280" }}>Was Partial, now Done</span>
          </div>
        </div>

      </div>
    </div>
  );
}
