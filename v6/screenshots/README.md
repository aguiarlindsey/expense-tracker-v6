# Screenshots — Visual Development History

This folder tracks how the app looked at each major version milestone.
Take screenshots from `https://expense-tracker-v6.vercel.app` and save into the relevant folder.

---

## Folder Structure

```
screenshots/
├── v7-current/        ← Capture NOW before V8 UI work begins (v7.11.1)
└── v8-launch/         ← Capture when V8 UI overhaul is complete
```

---

## v7-current — Capture Checklist (v7.11.1)

> Take these BEFORE any V8 UI changes are made. Desktop + Mobile for each.

### Desktop (1440px wide browser window)

| # | Screen | Filename |
|---|--------|----------|
| 1 | Overview tab — light mode | `desktop-overview-light.png` |
| 2 | Overview tab — dark mode | `desktop-overview-dark.png` |
| 3 | Add Expense modal open | `desktop-add-expense.png` |
| 4 | Trends tab | `desktop-trends.png` |
| 5 | Budgets tab | `desktop-budgets.png` |
| 6 | Goals tab | `desktop-goals.png` |
| 7 | Insights tab | `desktop-insights.png` |
| 8 | Recurring tab | `desktop-recurring.png` |
| 9 | Trips tab | `desktop-trips.png` |
| 10 | Exchange tab | `desktop-exchange.png` |
| 11 | Settings tab — About panel | `desktop-settings-about.png` |
| 12 | Receipt Scanner modal open | `desktop-scanner.png` |
| 13 | OCR results screen | `desktop-scanner-results.png` |

### Mobile (375px — iPhone size, use DevTools responsive mode)

| # | Screen | Filename |
|---|--------|----------|
| 1 | Overview tab — dark mode | `mobile-overview-dark.png` |
| 2 | Overview tab — light mode | `mobile-overview-light.png` |
| 3 | Add Expense form | `mobile-add-expense.png` |
| 4 | Expense list (Overview scrolled) | `mobile-expense-list.png` |
| 5 | Tab bar visible | `mobile-tabs.png` |

### How to take them quickly
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M) for mobile shots
3. Use Windows Snipping Tool (Win+Shift+S) or browser screenshot extension
4. Save files into `screenshots/v7-current/` with the exact filenames above

---

## v8-launch — Capture Checklist

> Take these once the V8 UI overhaul is complete (estimated v7.24.0)

Same screens as v7-current — same filenames — saved into `screenshots/v8-launch/`.
This gives a direct side-by-side comparison of before and after.

---

## Version History

| Version | Date | Folder | Notes |
|---------|------|--------|-------|
| v7.11.1 | 12-05-2026 | `v7-current/` | Pre-V8 UI overhaul baseline |
| v7.24.0 | TBD | `v8-launch/` | Post-V8 UI overhaul |
