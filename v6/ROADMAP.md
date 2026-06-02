# Expense Tracker V7 — UI Overhaul Roadmap

> **Started:** 12-05-2026 · **Target:** v7.12.0 → v7.24.0+  
> **Stack:** Vite + React + Supabase (unchanged) · **Deployed:** Vercel

---

## Overall Progress

```
████████████████████████████████  100%   32 / 32 phases complete
```

| | Count | Hours |
|---|---|---|
| ✅ Complete | 32 phases | ~200h |
| 🔨 In Progress | 0 phases | — |
| 📋 Planned | 0 phases | — |
| **Total** | **32 phases** | **~200h · ~52 days** |

---

## Epic Overview

| Epic | Focus | Progress | Phases | Est. Hours |
|------|-------|----------|--------|-----------|
| [1 — Foundation](#epic-1--foundation) | CSS system | `██████████` 100% | 2/2 | ~7h |
| [2 — Visual Redesign](#epic-2--visual-redesign) | Glass UI, Bento Grid | `██████████` 100% | 5/5 | ~14h |
| [3 — Navigation & UX](#epic-3--navigation--ux) | Tabs, ⌘K, drawers | `██████████` 100% | 5/5 | ~25h |
| [4 — Onboarding](#epic-4--onboarding) | First-run wizard | `██████████` 100% | 3/3 | ~11h |
| [5 — Analytics Tab](#epic-5--analytics-tab) | Insights + Trends merged | `██████████` 100% | 3/3 | ~18h |
| [6 — Planning Tab](#epic-6--planning-tab) | Budgets + Goals merged | `██████████` 100% | 3/3 | ~18h |
| [7 — New Features](#epic-7--new-features) | Templates, forecast, PDF | `██████████` 100% | 8/8 | ~40h |
| [8 — Launch](#epic-8--launch--polish) | Mobile polish, docs | `██████████` 100% | 4/4 | ~9h |

---

## Epic 1 — Foundation

> Sets the design language and CSS architecture everything else is built on.

```
██████████  100%   2 / 2 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| ✅ | **1.1 — CSS Design System** | Glass tokens, shadow scale, radius scale, spacing scale, typography tokens, dark mode fully expanded | Low | 3–4h |
| ✅ | **1.2 — Preview Approval** | Desktop + mobile preview HTML files built and approved; design locked | Low | 2–3h |

---

## Epic 2 — Visual Redesign

> The new look and feel — glass, depth, hierarchy.

```
██████████  100%   4 / 4 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| ✅ | **2.1 — Glassmorphism Shell** | Frosted-glass header + tab bar · `backdrop-filter` · sticky tab bar · body gradient · shimmer stripe · glass sheen overlay · dark mode variants | Low | 2–3h |
| ✅ | **2.2 — Bento Grid Dashboard** | 5-tile CSS Grid — hero (3-pt progress bar + badge chips + trend), income, net savings, safe-to-spend, burn rate · responsive 3→2→1 col · hover lift · incognito masking | Low | 4–5h |
| ✅ | **2.3a — Exchange Tab Redesign** | Base currency tile · quick converter · 122-currency scrollable table in 8 regional groups · search filter · BTC/ETH via CoinGecko · mobile horizontal scroll | Low | 2h |
| ✅ | **2.3 — Sparkline + Category Tiles** | 30-day SVG sparkline · category tiles with budget progress bars · replaces pie chart | Low | 3–4h |
| ✅ | **2.4 — Dark / Light Polish** | Glass effect tuned per mode · auto system-preference detection · FOUC prevention · prefers-reduced-motion | Low | 1–2h |

---

## Epic 3 — Navigation & UX

> How users move through the app — restructured, faster, more intuitive.

```
██████████  100%   5 / 5 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| ✅ | **3.1 — Tab Restructure** | 10 tabs → 8 tabs · Analytics sub-nav (Insights \| Trends) · Planning sub-nav (Budgets \| Goals) · keyboard shortcuts update | Medium | 5–7h |
| ✅ | **3.2 — Bottom Navigation (Mobile)** | 5-icon bottom bar · Home, Expenses, ＋ FAB, Analytics, More · More bottom sheet for remaining tabs | Medium | 4–5h |
| ✅ | **3.3 — ⌘K Command Center** | Spotlight-style palette · jump to any tab or action · keyboard navigation · `cmdk` library | Medium | 5–7h |
| ✅ | **3.4 — Dynamic Drawers** | Add Expense + Add Income as slide-up sheets on mobile · CSS-native · no Shadcn needed | Medium | 5–6h |
| ✅ | **3.5 — Swipe to Delete + Haptic** | Swipe left on expense row → reveal delete/edit · swipe right → edit · `navigator.vibrate()` on mobile | Low | 2–3h |

---

## Epic 4 — Onboarding

> First impression for new users — guided setup in under 2 minutes.

```
██████████  100%   3 / 3 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| ✅ | **4.1 — First-Login Detection** | Check `user_metadata.onboarded` on login · route new users to wizard · returning users go straight to app | Low | 1h |
| ✅ | **4.2 — Onboarding Wizard** | 5 steps: Welcome → Name → Currency → Budget → Notifications → Done 🎉 · supabase.auth.updateUser · budgets upsert · et_v6_base localStorage | Medium | 7–8h |
| ✅ | **4.3 — Empty State Redesign** | First-run Overview card · Expenses/Income/Goals/Insights/Recurring all with CTAs · compact no-results variant | Low | 2h |

---

## Epic 5 — Analytics Tab

> Insights and Trends unified under one intelligent tab.

```
██████████  100%   3 / 3 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| ✅ | **5.1 — Analytics Tab Shell** | Analytics tab · pill sub-nav (Insights \| Trends) · smooth switching — shipped as part of Phase 3.1 | Medium | 3–4h |
| ✅ | **5.2 — Financial Health Score** | 0–100 animated SVG ring · 4 sub-scores (savings rate, budget, consistency, goals) · bottom tip · responsive layout | High | 6–8h |
| ✅ | **5.3 — Enhanced Charts** | Grouped bar chart (exp+inc+budget line) · category trends Jan 2026→now · merchant top-10 table · MoM Rate column | Medium | 5–6h |

---

## Epic 6 — Planning Tab

> Budgets and Goals unified into one forward-looking tab.

```
██████████  100%   3 / 3 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| ✅ | **6.1 — Planning Tab Shell** | New Planning tab · pill sub-nav (Budgets \| Goals) · smooth switching | Medium | 3–4h |
| ✅ | **6.2 — Budget Rollover** | Unused budget carries to next month · configurable per category · new Supabase column · visual indicator | Medium | 4–5h |
| ✅ | **6.3 — Goal Improvements** | Contribution history timeline · milestone badges · target date countdown · progress ring animations | Medium | 4–6h |

---

## Epic 7 — New Features

> Meaningful additions that make daily use more powerful.

```
██████████  100%   8 / 8 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| ✅ | **7.1 — Expense Templates** | Save frequent expenses as one-tap quick-add templates · stored in localStorage · accessible from FAB | Medium | 4–5h |
| ✅ | **7.2 — Bulk Edit** | Select multiple expenses · change category / payment method / date in one action | Medium | 3–4h |
| ✅ | **7.3 — Subscription Tracker** | Dedicated view of all recurring expenses · monthly cost total · next due dates · cancel-risk flag for unused subs | Medium | 4–5h |
| ✅ | **7.4 — Spend Streak + Gamification** | 🔥 consecutive under-budget days · no-spend day badges · monthly milestone toasts | Medium | 4–5h |
| ✅ | **7.5 — Merchant Analytics** | Top merchants by spend · order count · per-merchant trend · lives inside Analytics tab | Medium | 3–4h |
| ✅ | **7.6 — Cash Flow Forecast** | 30/60/90-day projection tiles · variable + recurring daily rates · spend trajectory SVG · upcoming recurring charges list · deficit/surplus runway banner · 📅 Forecast sub-tab in Analytics | High | 6–8h |
| ✅ | **7.7 — PDF Monthly Report** | jsPDF + jspdf-autotable · 3-page export (cover, expenses, income) · WinAnsi-safe currency formatter · category colour bars · user name/email on cover | Medium | 5–7h |
| ✅ | **7.8 — Natural Language Search** | Parse "food last week over 500" → auto-apply filters · payment aliases · date ranges · NL chips UI · falls back to plain search | High | 6–8h |

---

## Epic 8 — Launch & Polish

> Cross-device testing, performance, and documentation.

```
██████████  100%   4 / 4 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| ✅ | **8.1 — Mobile Layout Audit** | viewport-fit=cover; iOS input zoom fix (16px min); touch targets; toast above bnav; 100dvh; -webkit-tap-highlight-color; overscroll-behavior; @media(hover:none) active states | Low | 2–3h |
| ✅ | **8.2 — Email Share** | Monthly PDF + receipt image emailed to logged-in user; api/email-share.js (Supabase JWT, Gmail SMTP); receipt checkbox in expense form with persisted preference | Medium | 3–4h |
| ✅ | **8.3 — Performance Audit** | motion removed (-160 kB); jsPDF dynamic import (defers 421 kB); manualChunks vendor split; initial JS 53% smaller (1600→747 kB) | Low | 2h |
| ✅ | **8.4 — V7 Overhaul Docs** | CHANGELOG session 48 · ROADMAP 100% · v7.33.0 final | Low | 2h |

---

## Optional / Future

> Not scheduled — add to a future Epic if demand warrants it.

| Feature | Description | Est. |
|---------|-------------|------|
| **i18n — Multi-Language Support** | Language switcher in Settings · extract all UI strings into translation dictionary · provide translations · `useTranslation()` throughout · browser locale detection as default | ~20–40h |

---

## Version Map

| Version | Feature | Status |
|---------|---------|--------|
| v7.11.1 | Vehicle maintenance KM fields | ✅ |
| v7.12.0 | CSS Design System + Glass Shell | ✅ |
| v7.13.0 | Bento Grid Dashboard + badges + 3-pt progress | ✅ |
| v7.14.0 | Exchange tab redesign · BTC/ETH rates · pie charts → Insights | ✅ |
| v7.15.0 | Sparkline + Category tiles (Phase 2.3) | ✅ |
| v7.15.1 | Dark/Light polish · system theme · FOUC fix · reduced-motion (Phase 2.4) | ✅ |
| v7.16.0 | Tab Restructure 10→8 · Analytics + Planning sub-navs (Phase 3.1) | ✅ |
| v7.17.0 | Bottom Navigation · FAB · More sheet (Phase 3.2) | ✅ |
| v7.18.0 | ⌘K Command Centre · keyboard navigation (Phase 3.3) | ✅ |
| v7.19.0 | Dynamic Drawers · drag-to-dismiss sheets (Phase 3.4) | ✅ |
| v7.20.0 | Swipe delete/edit · haptic · ODO/Trip A/B tracking (Phase 3.5) | ✅ |
| v7.20.1 | PWA force-update fix · sparkline tooltip · fuel OCR quantity fix | ✅ |
| v7.21.0 | Month strip fixes · monthStr useState · month picker dropdown | ✅ |
| v7.21.1 | First-login detection (user_metadata.onboarded) | ✅ |
| v7.22.0 | Onboarding Wizard (5-step) | ✅ |
| v7.22.1 | Empty state redesign (8 screens) | ✅ |
| v7.23.0 | Financial Health Score (animated SVG ring, 4 sub-scores) | ✅ |
| v7.24.0 | Enhanced Charts (grouped bar, category trends, MoM rate) | ✅ |
| v7.25.0 | Epic 6: Planning Tab · Budget Rollover · Goal Improvements | ✅ |
| v7.26.0 | Phase 7.1 — Expense Templates | ✅ |
| v7.27.0 | Phase 7.2 — Bulk Edit | ✅ |
| v7.28.0 | Phase 7.3 — Subscription Tracker | ✅ |
| v7.29.0 | Phase 7.4 — Spend Streak + Gamification | ✅ |
| v7.30.0 | Phase 7.5 — Merchant Analytics | ✅ |
| v7.31.0 | Phase 7.6 — Cash Flow Forecast | ✅ |
| v7.32.0 | Phase 7.7 — PDF Monthly Report + Phase 7.8 — Natural Language Search | ✅ |
| v7.33.0 | Epic 8 — Mobile Audit · Email Share · Performance · Docs — ALL 32 phases complete | ✅ Current |

---

## Progress Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete — shipped to production |
| 🔨 | In Progress — currently being built |
| 📋 | Planned — not started |
| ⏸️ | On Hold — deferred |
| ❌ | Cancelled — removed from scope |

---

*Last updated: 03-06-2026 · Session 48 · v7.33.0 shipped · ALL 32 phases complete 🎉*
