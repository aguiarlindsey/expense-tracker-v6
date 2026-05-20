# Expense Tracker V7 — UI Overhaul Roadmap

> **Started:** 12-05-2026 · **Target:** v7.12.0 → v7.24.0+  
> **Stack:** Vite + React + Supabase (unchanged) · **Deployed:** Vercel

---

## Overall Progress

```
███████░░░░░░░░░░░░░░░░░░░░░░░░░  22%   7 / 32 phases complete
```

| | Count | Hours |
|---|---|---|
| ✅ Complete | 7 phases | ~23.5h |
| 🔨 In Progress | 0 phases | — |
| 📋 Planned | 25 phases | ~116.5h est. |
| **Total** | **32 phases** | **~140h · ~37 days** |

---

## Epic Overview

| Epic | Focus | Progress | Phases | Est. Hours |
|------|-------|----------|--------|-----------|
| [1 — Foundation](#epic-1--foundation) | CSS system | `██████████` 100% | 2/2 | ~7h |
| [2 — Visual Redesign](#epic-2--visual-redesign) | Glass UI, Bento Grid | `██████████` 100% | 4/4 | ~12h |
| [3 — Navigation & UX](#epic-3--navigation--ux) | Tabs, ⌘K, drawers | `░░░░░░░░░░` 0% | 0/5 | ~25h |
| [4 — Onboarding](#epic-4--onboarding) | First-run wizard | `░░░░░░░░░░` 0% | 0/3 | ~11h |
| [5 — Analytics Tab](#epic-5--analytics-tab) | Insights + Trends merged | `░░░░░░░░░░` 0% | 0/3 | ~18h |
| [6 — Planning Tab](#epic-6--planning-tab) | Budgets + Goals merged | `░░░░░░░░░░` 0% | 0/3 | ~18h |
| [7 — New Features](#epic-7--new-features) | Templates, forecast, PDF | `░░░░░░░░░░` 0% | 0/8 | ~40h |
| [8 — Launch](#epic-8--launch--polish) | Mobile polish, docs | `░░░░░░░░░░` 0% | 0/4 | ~9h |

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
░░░░░░░░░░  0%   0 / 5 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| 📋 | **3.1 — Tab Restructure** | 10 tabs → 8 tabs · Analytics sub-nav (Insights \| Trends) · Planning sub-nav (Budgets \| Goals) · keyboard shortcuts update | Medium | 5–7h |
| 📋 | **3.2 — Bottom Navigation (Mobile)** | 5-icon bottom bar · Home, Expenses, ＋ FAB, Analytics, More · More bottom sheet for remaining tabs | Medium | 4–5h |
| 📋 | **3.3 — ⌘K Command Center** | Spotlight-style palette · jump to any tab or action · keyboard navigation · `cmdk` library | Medium | 5–7h |
| 📋 | **3.4 — Dynamic Drawers** | Add Expense + Add Income as slide-up sheets on mobile · CSS-native · no Shadcn needed | Medium | 5–6h |
| 📋 | **3.5 — Swipe to Delete + Haptic** | Swipe left on expense row → reveal delete/edit · `navigator.vibrate()` on mobile | Low | 2–3h |

---

## Epic 4 — Onboarding

> First impression for new users — guided setup in under 2 minutes.

```
░░░░░░░░░░  0%   0 / 3 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| 📋 | **4.1 — First-Login Detection** | Check `user_metadata.onboarded` on login · route new users to wizard · returning users go straight to app | Low | 1h |
| 📋 | **4.2 — Onboarding Wizard** | 5 steps: Welcome → Name/Country → Base Currency → Monthly Budget → Notifications → Done 🎉 · stored in Supabase user_metadata · each step skippable | Medium | 7–8h |
| 📋 | **4.3 — Empty State Redesign** | First-time empty states with helpful prompts · "Add your first expense" CTA · no blank screens | Low | 2h |

---

## Epic 5 — Analytics Tab

> Insights and Trends unified under one intelligent tab.

```
░░░░░░░░░░  0%   0 / 3 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| 📋 | **5.1 — Analytics Tab Shell** | New Analytics tab · pill sub-nav (Insights \| Trends) · smooth switching · active state styling | Medium | 3–4h |
| 📋 | **5.2 — Financial Health Score** | 0–100 score hero · sub-scores (savings rate, budget use, consistency, goals) · animated ring · prominent on Analytics | High | 6–8h |
| 📋 | **5.3 — Enhanced Charts** | 6-month bar chart polish · category trend lines · MoM table update · merchant analytics card · payment method split | Medium | 5–6h |

---

## Epic 6 — Planning Tab

> Budgets and Goals unified into one forward-looking tab.

```
░░░░░░░░░░  0%   0 / 3 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| 📋 | **6.1 — Planning Tab Shell** | New Planning tab · pill sub-nav (Budgets \| Goals) · smooth switching | Medium | 3–4h |
| 📋 | **6.2 — Budget Rollover** | Unused budget carries to next month · configurable per category · new Supabase column · visual indicator | Medium | 4–5h |
| 📋 | **6.3 — Goal Improvements** | Contribution history timeline · milestone badges · target date countdown · progress ring animations | Medium | 4–6h |

---

## Epic 7 — New Features

> Meaningful additions that make daily use more powerful.

```
░░░░░░░░░░  0%   0 / 8 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| 📋 | **7.1 — Expense Templates** | Save frequent expenses as one-tap quick-add templates · stored in localStorage · accessible from FAB | Medium | 4–5h |
| 📋 | **7.2 — Bulk Edit** | Select multiple expenses · change category / payment method / date in one action | Medium | 3–4h |
| 📋 | **7.3 — Subscription Tracker** | Dedicated view of all recurring expenses · monthly cost total · next due dates · cancel-risk flag for unused subs | Medium | 4–5h |
| 📋 | **7.4 — Spend Streak + Gamification** | 🔥 consecutive under-budget days · no-spend day badges · monthly milestone toasts | Medium | 4–5h |
| 📋 | **7.5 — Merchant Analytics** | Top merchants by spend · order count · per-merchant trend · lives inside Analytics tab | Medium | 3–4h |
| 📋 | **7.6 — Cash Flow Forecast** | Project next 30/60/90 days from recurring + variable spend average · runway indicator | High | 6–8h |
| 📋 | **7.7 — PDF Monthly Report** | Formatted monthly export via `jsPDF` (free) · cover page, category breakdown, top expenses | Medium | 5–7h |
| 📋 | **7.8 — Natural Language Search** | Parse "food last week over 500" → auto-apply filters · falls back to current search if parse fails | High | 6–8h |

---

## Epic 8 — Launch & Polish

> Cross-device testing, performance, and documentation.

```
░░░░░░░░░░  0%   0 / 4 phases
```

| Status | Phase | Description | Complexity | Est. |
|--------|-------|-------------|-----------|------|
| 📋 | **8.1 — Mobile Layout Audit** | Full review on iPhone, Android · touch targets · scroll behaviour · iOS Safari edge cases | Low | 2–3h |
| 📋 | **8.2 — Share Sheet** | Share receipt image from camera roll directly into OCR scanner · Web Share API (browser native) | Medium | 3–4h |
| 📋 | **8.3 — Performance Audit** | Bundle size check · render count review · memo/useMemo audit · Lighthouse score | Low | 2h |
| 📋 | **8.4 — V7 Overhaul Docs** | CHANGELOG sessions 37–50+ logged · EXPTRAV7 updated for all new features · version bumped to final · ROADMAP marked complete | Low | 2h |

---

## Version Map

| Version | Feature | Status |
|---------|---------|--------|
| v7.11.1 | Vehicle maintenance KM fields | ✅ |
| v7.12.0 | CSS Design System + Glass Shell | ✅ |
| v7.13.0 | Bento Grid Dashboard + badges + 3-pt progress | ✅ |
| v7.14.0 | Exchange tab redesign · BTC/ETH rates · pie charts → Insights | ✅ |
| v7.15.0 | Sparkline + Category tiles (Phase 2.3) | ✅ |
| v7.15.1 | Dark/Light polish · system theme · FOUC fix · reduced-motion (Phase 2.4) | ✅ Current |
| v7.16.0 | Tab Restructure (Analytics + Planning) | 📋 |
| v7.15.0 | ⌘K Command Center | 📋 |
| v7.16.0 | Dynamic Drawers + Bottom Nav | 📋 |
| v7.17.0 | Onboarding Wizard | 📋 |
| v7.18.0 | Financial Health Score | 📋 |
| v7.19.0 | Budget Rollover + Goal improvements | 📋 |
| v7.20.0 | Expense Templates + Bulk Edit | 📋 |
| v7.21.0 | Subscription Tracker + Spend Streak | 📋 |
| v7.22.0 | Cash Flow Forecast | 📋 |
| v7.23.0 | PDF Report + Natural Language Search | 📋 |
| v7.24.0 | Share Sheet + Full Polish + Launch | 📋 |

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

*Last updated: 21-05-2026 · Session 39 · v7.15.1 shipped*
