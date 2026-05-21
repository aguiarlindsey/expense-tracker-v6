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
| 26b | 2026-04-25 | v7.3.0: Trips expand/collapse — inline expense list (Date·Cat·Desc·Amt), per-day rate, full-width expanded card | 1.5 |
| 27 | 2026-04-27 | v7.4.0b: DB Maintenance Cron (api/maintenance.js + vercel.json); v7.4.0: Anomaly Detection (detectAnomaly, AnomalyPanel, localStorage persistence); v7.5.0: SQL Views for Insights (3 Postgres views, useInsightViews hook, 5 useMemo replaced); v7.6.0: Sync Queue Optimization (topoSort, dependsOn field, 8 enqueue callsites) | 6.0 |
| 28 | 2026-04-27 | v7.7.0: WebAuthn Biometric Lock — server-enforced (4 API routes, useBiometric hook, LockScreen, 45-issue break-test audit fixed); OTP email fallback with backup email, server-side validation, rate limiting, alphanumeric OTP, 15-min lockout; v7.7.1: 45 break-test issues fixed (6 critical, 6 high, 6 medium, 3 medium-low, 3 low) | 9.0 |
| 29 | 2026-05-02 | v7.8.0: Database Versioning + Conflict UI — row_version column + BEFORE UPDATE trigger on 4 tables; optimistic locking in editExpense/editIncome/editTrip + executeOp replay; ConflictModal with side-by-side diff, Keep Mine / Keep Theirs / Merge mode (per-field radio picker); conflict badge in header | 3.5 |
| 30 | 2026-05-02 | Security debug + fixes: OTP backup always accessible after biometric lockout; OTP resend limit (1+2); cross-device Bluetooth auth blocked; per-credential counter/failed_attempts isolation; v7.8.0 conflict UI tested; Supabase Gmail SMTP; v7.10.0 marked complete; HTTP security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy); Supabase Auth hardening (secure email change, OTP expiry 600s, min password 8, rate limit 10/5min); v7.11.0 HttpOnly Cookie Migration — api/auth-cookie.js (key-aware JSON map, HttpOnly/Secure/SameSite=Lax), cookieStorage.js async adapter, Web Locks bypass, et_v6_unlocking race condition fix; verified: sb_session HttpOnly cookie, no auth token in localStorage, session persists on reload | 9.0 |
| 31 | 2026-05-02 | v7.11.0 debug: double-decode fix in GET handler; key-aware removeItem to prevent session wipe; Web Locks bypass for async storage lock contention; et_v6_unlocking flag for biometric/OTP race condition in App.jsx | 1.5 |
| 32 | 2026-05-02 | Deep audit (30 issues, 7 real): await OTP attempts update (brute-force protection fix); 30s timeout on et_v6_unlocking flag; email format validation in backup-otp-send; assertion format validation in biometric-verify; cookieStorage JSON parse safety; isMounted guard on initial data load; conflict array auto-expiry after 1 hour; CSP cdn.jsdelivr.net removed; deleted-record error messages; backup email validation hardened | 2.0 |
| 33 | 2026-05-07 | Lock screen race condition fix (requestAnimationFrame); mobile overflow (overflow-x hidden, max-width 100vw); categories (Laundry, Dry Cleaning, Ironing, Housekeeping, House Maid, Pest Control); Forex Card; Grab dining app; device-independent biometrics (et_v6_credential_id); OTP backup fixes; security audit (4 bugs); session creation revert to generateLink+verifyOtp | 6.0 |
| 34 | 2026-05-07 | v7.9.0: Tesseract.js OCR receipt scanner — receiptParser.js (amount/date/merchant/category/payment parsers, 60+ merchant map), ReceiptScanner.jsx (camera/upload modal, progress bar, confidence indicators, raw text toggle), Tracker.jsx 📷 Scan button + applyOcr pre-fill, vite.config optimizeDeps exclude | 6.0 |
| 35 | 2026-05-07 | v7.9.0 OCR refinements: CSP fixes (cdn.jsdelivr.net in script-src, wasm-unsafe-eval, camera permission); local Tesseract worker (no CDN); manual crop tool replacing broken auto-detect; objectFit letterbox coordinate fix; TORII parser fix (company suffix skipping, cleanName noise strip); food keyword expansion (salmon, steak, lobster, truffle, beer brands); petrol parser (¥/€/£ ₹ misread symbols, HP service variants, hasFuelContent fallback); fuel rate/quantity/type extraction + DB columns + form fields + list display; tax/GST/SGST/CGST/VAT/Service Charge extraction + DB columns; silent save error surfaced as toast; DD-MM-YYYY date format everywhere; unlimited multi-part scan (pages[] array, sequential OCR, progress scales per page); EXPTRAV7 reference doc | 8.0 |
| 36 | 2026-05-12 | Vehicle maintenance KM fields in Add Expense form: KMs at Service + Next Service at KMs inputs; Next Service Date sets nextDueDate + isRecurring reminder; applyOcr populates new fields directly (no longer embeds in notes); ExpItem shows 🔧 KM summary line; useStorage vehicleCurrentKm ↔ vehicle_km_at_service + vehicleNextServiceKm ↔ vehicle_next_service_km; Supabase migration (add_vehicle_km.sql) | 0.5 |
| 37 | 2026-05-12 | v7.12.0 CSS Design System: glass tokens, shadow/radius/spacing/typography scales, dark mode fully expanded; v7.12.0 Glassmorphism Shell: frosted-glass app-header + sticky glass tab bar (top:59px), blue-purple shimmer stripe, glass sheen overlay (::after gradient), body gradient background (light: blue-indigo wash, dark: deep navy), card elevation with shadow-sm + radius-lg, tab active tint; icon updates (Personal 🪞, Utilities ⚡, Finance 💳, Social 🤝, Administrative 🏛️, Other 📦); Theatre sub-category; Luggage & Bags sub-category; app title/version corrected to V7 / v7.11.1; ROADMAP.md created (32 phases, 8 epics, v7.12.0→v7.24.0 version map); preview-phase1.html + preview-mobile.html created | 4.0 |
| 38 | 2026-05-12 | v7.13.0 Bento Grid Dashboard: 5-tile CSS Grid (hero expenses with 3-point progress bar + badge chips, income, net savings, safe-to-spend, burn rate), responsive 3→2→1 col, hover lift, incognito masking, colored tile top-borders; badge chips on all tiles (⚡ % used, txn count, date, trend, income delta, savings rate, runway, acceleration); pie charts moved from Overview → Insights; v7.14.0 Exchange Tab Redesign: base currency info tile, quick converter (3-col grid with big result), 122-currency scrollable table in 8 regional groups with search filter, BTC + ETH live rates via CoinGecko free API (cached 10min, CSP updated), blank cells for unavailable rates, mobile horizontal scroll without hidden columns; tab labels shortened (Recur, FX) to fit all 10 tabs; About section updated to v7.14.0 | 5.0 |
| 39 | 2026-05-21 | v7.15.0 Sparkline + Category Tiles (Phase 2.3): sparkDays useMemo (30-day O(n) aggregation), SVG sparkline tile (gradient fill + polyline, peak day purple marker + amount label, today blue dot, 4-label axis, full-width bento row 3), responsive (col 1/3 tablet, stacked mobile); category tiles section (auto-fill grid, icon + name + amount + 3px progress bar, green/amber/red vs budget or % of total if no budget, incognito masking); v7.15.1 Phase 2.4 Dark/Light Polish: FOUC prevention inline script in index.html; themeMode state ('light'\|'system'\|'dark'); setTheme() helper (handles localStorage + setDark atomically); matchMedia runtime listener (OS auto-switch in system mode); darkRef for keyboard-handler closure safety; 3-way segmented control in Settings (☀️ Light / 🖥️ System / 🌙 Dark); header button shows 🖥️ in system mode; D key cycles light↔dark; prefers-reduced-motion CSS block | 3.5 |
| 40 | 2026-05-21 | v7.16.0 Phase 3.1 Tab Restructure: 10→8 tabs, Analytics tab (Insights\|Trends pill sub-nav), Planning tab (Budgets\|Goals pill sub-nav), URL backwards compat remap, keyboard 1–8 updated; v7.17.0 Phase 3.2 Bottom Navigation: fixed 5-icon bottom bar (mobile ≤768px), ☰ More bottom sheet (Planning/Recurring/Trips/FX/Settings), FAB opens Add Expense, glass bg + safe-area padding, glass-shell hidden on mobile; v7.18.0 Phase 3.3 ⌘K Command Palette: spotlight modal, 14 commands in Go to + Actions groups, fuzzy search, ↑↓↵ keyboard nav, Cmd+K shortcut, ⌘K pill in header, mobile bottom-sheet variant; H key toggles incognito + hint badge; Phase 3.4 Dynamic Drawers: useBottomSheet hook (drag-to-dismiss >100px), drag handle pill on Add Expense + Add Income sheets, touch-action:none; v7.20.0 Phase 3.5 Swipe to delete + haptic: left swipe → red bg + auto-delete at 160px + vibrate(8)/vibrate(40), right swipe → blue bg + open edit, direction guard, disabled in bulk mode; PWA: visible update banner replacing silent reload, controllerchange listener, Force Update button in Settings (synchronous hardReload for iOS Safari), Dynamic Island safe-area padding; Sparkline interactive tooltip: onMouseMove/onTouchMove crosshair + floating pill showing date + amount; OCR fuel fixes: plain-integer /100 correction + math-based quantity derivation (amount÷rate), round3 (3dp precision); Form save fixes: modal-overlay z-index 100→200, visible formError banner, applyOcr description fallback; ODO + Trip A/B fuel tracking: odoReading, tripA, tripB, tripSelected fields; click/tap to select which trip drives efficiency, live km/L preview, DB columns odo_reading + trip_a_reading + trip_b_reading + trip_selected | 12.0 |
| 41 | 2026-05-21 | v7.21.0 Month Strip fixes: strip-track height 3px→6px + box-shadow on fill for visibility; monthStr promoted from derived const to useState; "days left" + daily avg always visible (no budget required); strip-month ▾ wired as real dropdown — last 12 months + all months with data, "Current" tag, "No data" tag, active highlight, chevron rotation, Esc/click-outside to close; z-index fixes: month-strip zIndex:200 when picker open, glass-shell 40→60 | 1.5 |
| 42 | 2026-05-22 | /context skill: lean workflow mode, session brief, token discipline rules, error guards, anti-pattern blacklist; v7.21.1 Phase 4.1 First-Login Detection: isOnboarded check on user_metadata, completedOnboarding local state, OnboardingWizard shell; v7.22.0 Phase 4.2 Full Onboarding Wizard: 5-step (Welcome→Name→Currency→Budget→Notifications→Done), progress bar, CURRENCIES dropdown with live symbol preview, requestAndSubscribe integration, supabase.auth.updateUser + budgets upsert + et_v6_base localStorage on finish; v7.22.1 Phase 4.3 Empty State Redesign: Overview first-run card (personalised greeting, 4 feature chips, CTAs), Expenses/Income/Goals/Insights/Recurring all updated with descriptive copy + action buttons, compact .empty-state-sm for no-results; Locale-aware number formatting: _localeFor() (South Asian en-IN vs en-US), _appCurrency module var synced on baseCurrency change, _fmtINR uses dynamic locale, FX tab + trips + ODO km all fixed | 7.5 |
| 43 | 2026-05-22 | v7.23.0 Phase 5.2 Financial Health Score: 0–100 animated SVG ring (strokeDashoffset 1.1s ease), 4 sub-scores (savings rate last 3 months, budget adherence current month, spending consistency CV of daily 30-day, goals active contributions), per-score bands + notes + personalised tip for weakest sub-score, neutral 12/25 when data missing, responsive side-by-side→stacked; v7.24.0 Phase 5.3 Enhanced Charts: GroupedBarChart SVG exp+inc side-by-side per month with budget dashed line, category trends Jan 2026→present (all months, not last 6), merchant top-10 table with inline bar + avg + %, MoM table Rate column (savings rate colour-coded); Bug fixes: category trends month labels '01'→'Jan' bug fixed (was passing stripped strings); grouped bar chart month labels moved from SVG text to HTML (SVG fontSize=9 scaled to 5px on mobile); Y-axis labels also moved to HTML column (same issue); mobile bottom nav covering content fixed (padding:0.75rem reset padding-bottom:84px — now calc(84px + safe-area-inset)); month/Y label colour matched to var(--text-muted); About section updated to v7.24.0 | 9.0 |
| **Total** | | | **~162 h** |

---

## [Session 36] — Vehicle Maintenance KM Tracking
_2026-05-12_

**Vehicle maintenance fields in Add Expense form (`src/components/Tracker.jsx`)**
- New **🔧 Service Details** section appears when category = Transport / subcategory = Vehicle Maintenance (manual selection or OCR auto-detect)
- **KMs at Service** — integer input; stored in `vehicle_km_at_service` DB column
- **Next Service at KMs** — integer input; stored in `vehicle_next_service_km` DB column
- **Next Service Date** — date input; sets `nextDueDate` + `isRecurring = true` to trigger the recurring reminder system

**OCR integration (`applyOcr`)**
- `currentKm` and `nextServiceKm` from parser now populate the new form fields directly instead of being embedded in the notes string
- Notes field is now cleaner (only vehicle model, reg, service type, next service type)

**Expense list display (`ExpItem`)**
- Vehicle Maintenance items show a `🔧 12,500 km at service · Next at 15,000 km · Due 15-11-2026` summary line (only when `vehicleCurrentKm` is set)

**Storage layer (`src/hooks/useStorage.js`)**
- `expenseToDb`: maps `vehicleCurrentKm` → `vehicle_km_at_service`, `vehicleNextServiceKm` → `vehicle_next_service_km`
- `expenseFromDb`: reads both columns back and maps to camelCase fields

**DB migration (`supabase/add_vehicle_km.sql`)**
- `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vehicle_km_at_service integer DEFAULT NULL`
- `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vehicle_next_service_km integer DEFAULT NULL`

---

## [Session 38] — v7.13.0 + v7.14.0 UI Overhaul
_2026-05-12_

**v7.13.0 — Bento Grid Dashboard (`src/components/Tracker.jsx`, `src/styles/index.css`)**
- Replaced `summary-grid` + `forecast-panel` on Overview tab with a 5-tile CSS Grid bento layout
- **Hero tile** — spans 2/3 width; 3-point progress bar (₹0 · current · budget); badge chips (⚡ % used, txn count, date label, trend vs last month); colored top border (red)
- **Income tile** — this-month income; badge showing delta vs previous month (green/red)
- **Net Savings tile** — all-time net; savings rate % badge
- **Safe-to-Spend tile** — daily allowance with days-left + remaining-budget badges; "Set a budget →" link if unset
- **Burn Rate tile** — 7-day avg rate; acceleration badge (↑↓~flat); top burn category
- Responsive: 3-col desktop → 2-col tablet → 1-col mobile; hover lift + shadow transition
- Incognito masking on all bento amounts
- Pie charts (By Category, By Payment) moved from Overview → Insights tab
- Duplicate pie charts removed from Trends tab

**v7.14.0 — Exchange Tab Redesign**
- **Base currency info tile** — flag, name, live/cached status, last updated time, currency + region count, Refresh button
- **Quick Converter** — 3-column grid: amount input + currency dropdown (grouped by region) → ⇄ → big green result + both-direction rate text
- **Search bar** — instant filter by currency name or code across all 122 currencies
- **Styled table** — 4 columns: Code (flag + bold) | Name | 1 Foreign → Base | 1 Base → Foreign; region group headers (8 groups); `min-width: 480px` + horizontal scroll on mobile; no maxHeight on mobile (full list visible)
- **BTC + ETH live rates** — fetched from CoinGecko free API (`/api/v3/simple/price`), cached 10 minutes in localStorage; converted to base currency via INR factor; blank cells if unavailable (no "unavailable" text)
- CSP updated: `api.coingecko.com` added to `connect-src` in `vercel.json`
- Old `exchange-table` HTML table + chip-group card replaced entirely

**v7.12.0 — CSS Design System + Glassmorphism Shell (Session 37)**
- Glass tokens: `--glass-bg` (38% opacity), `--glass-border` (blue-tinted), `--glass-blur` (blur 32px saturate 200%), `--glass-inset` (2px white top highlight + sheen gradient)
- Shadow scale, radius scale, spacing scale, typography scale added to `:root`
- Dark mode tokens fully expanded in `.dark {}`
- App-header glass: `backdrop-filter`, sticky top:0, z-index 50; blue-purple shimmer stripe (`::before` animation); glass sheen overlay (`::after` gradient)
- Glass tab shell (`.glass-shell`): sticky top:59px, glass bg/border/shadow, punches through tracker padding
- Body gradient: `linear-gradient(160deg, #dde6ff, #eef1f7, #e6eeff)` light; deep navy dark
- Card elevation: `shadow-sm` + `radius-lg` on summary-card + chart-card
- Tab labels shortened: "🔄 Recur" and "💱 FX" so all 10 fit without overflow

**About section updated** — v7.14.0; new feature badges (Glass UI, Bento Dashboard, BTC/ETH Live)

---

## [Session 30 Fixes] — Biometric Security Hardening
_2026-05-02_

**Fix: Per-credential counter and failed_attempts isolation (`api/biometric-verify.js`)**
- Root cause: both success and failure update paths used `.eq('user_id', userId)` → updated ALL enrolled device credentials, not just the authenticating one
- PC unlocking many times inflated DB counter on phone credential → phone's real counter < DB counter → phone rejected
- PC failing 3 times locked phone credential too
- Fix: both paths now use `.eq('id', cred.id)` — each device's counter and lockout state fully isolated

**Fix: Cross-device Bluetooth auth blocked**
- `biometric-register.js`: transports stored as `['internal']` always — strips `hybrid`/`ble`/`usb` from synced passkeys (Google Account / iCloud Keychain)
- `biometric-auth-options.js`: `allowCredentials` restored with `transports: ['internal']` forced on every entry — browser never offers Bluetooth cross-device auth

**Fix: OTP backup always accessible after biometric lockout (`api/biometric-verify.js`)**
- When biometric locks after 3 failures, also resets `otp_locked_until = null` and `otp_attempts = 0`
- Guarantees OTP backup email path is always open when biometrics fail

**Fix: OTP resend limit (`src/components/LockScreen.jsx`)**
- `otpSendCount` state tracks total sends (initial + resends)
- Max 3 total sends (1 initial + 2 resends); resend button shows remaining count
- After 3rd send: button replaced with "Maximum resends reached" message

**v7.8.0 Conflict UI — fully tested**
- Keep Mine, Keep Theirs, Merge (per-field picker) all verified working
- DB trigger confirmed firing for app-initiated saves (row_version=6 on PC credential after 5 unlocks)
- Cross-device conflict correctly detected and resolved

---

## [v7.8.0] — Database Versioning + Conflict UI
_2026-05-02_

**New: `supabase/add_row_versioning.sql`**
- `row_version INTEGER NOT NULL DEFAULT 1` + `updated_at TIMESTAMPTZ` added to `expenses`, `income`, `trips`, `goals`
- `bump_row_version()` Postgres function: `NEW.row_version = OLD.row_version + 1; NEW.updated_at = now()`
- `BEFORE UPDATE` trigger installed on all 4 tables — increment is server-enforced, not client-controlled

**`src/hooks/useStorage.js`**
- `expenseFromDb`, `incomeFromDb`, `tripFromDb` now map `_rowVersion: row.row_version || 1` into app state
- `editExpense`, `editIncome`, `editTrip`: `.eq('row_version', rowVersion)` added to UPDATE query; 0-row result = conflict detected
- On conflict: fetch current DB row, call `addConflict(table, local, remote)` to push to `conflicts[]` state
- `executeOp` cases `editExpense` + `editIncome` also updated with version check + conflict detection for queued replays
- `conflicts` state (`useState([])`), `addConflict` helper (dedup by table+id), `resolveConflict(id, resolution, mergedData)`, `dismissConflict(id)`
- `resolveConflict 'theirs'`: apply remote record to local state, no DB write; `'mine'`/`'merge'`: re-call editXxx with `_rowVersion` set to remote's version (bypass conflict on second attempt)
- All new state/callbacks exported from hook

**New: `src/components/ConflictModal.jsx`**
- `FIELD_META` map: defines which fields to diff per table (13 expense fields, 8 income fields, 5 trip fields) with labels and formatters
- `diffFields(table, local, remote)`: returns only fields that differ (array-aware via JSON.stringify)
- **Choose mode**: side-by-side table (Your Version in blue | Other Device in purple), timestamp, Dismiss / Keep Theirs / Merge… / Keep Mine buttons
- **Merge mode**: per-field radio buttons with `mine`/`theirs` tags; "Apply Merge" builds merged object from choices
- Multi-conflict pager: ‹ N/total › navigation, resets mode on navigate
- Handles zero visible diffs (re-save without changes)

**`src/components/Tracker.jsx`**
- `import ConflictModal from './ConflictModal'`
- Destructures `conflicts`, `resolveConflict`, `dismissConflict` from `useStorage`
- Conflict badge in header: amber pill `⚠️ N` with count, only shown when `conflicts.length > 0`
- `<ConflictModal>` rendered at end of component tree, above `<ToastStack>`

**`src/styles/index.css`**
- `.conflict-badge` — amber pill, dark mode override
- `.conflict-overlay`, `.conflict-modal`, `.conflict-header`, `.conflict-table` — modal layout
- `.col-local` (blue) / `.col-remote` (purple) — column colour coding, dark-mode-aware
- `.merge-field`, `.merge-option`, `.merge-side-tag.mine/.theirs` — per-field radio UI

---

## [v7.3.0b] — Trips: Expand/Collapse + Inline Expense List
_2026-04-25_

**Tracker.jsx**
- `expandedTripId` state — one card expanded at a time; click header or "▼ Show expenses" button to toggle
- Trip card header (`trip-card-top`) is now a keyboard-accessible button (Enter/Space toggles)
- Expanded view shows full expense table: Date · Category · Description · Amount (trip currency)
- Expenses sorted newest-first (`b.date.localeCompare(a.date)`)
- Total row at bottom: expense count + grand total
- Per-day spend rate added to summary sub-row (`totalOriginal / nights`)
- Empty expanded state: "No AUD expenses in this date range yet — add expenses and they'll appear automatically"
- Chevron indicator (▼/▲) in card header title row
- Date comparison note: YYYY-MM-DD lexicographic order = chronological order; timezone-safe

**CSS**
- `.trip-card-expanded` — `grid-column: 1 / -1` (full width when open)
- `.trip-exp-header / row / total` — 4-column CSS grid (110px · 160px · 1fr · 120px)
- `.trip-exp-row:hover` background highlight
- Mobile (≤640px): category column hidden; grid collapses to 3 columns

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
