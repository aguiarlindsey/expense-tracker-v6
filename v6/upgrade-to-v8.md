# Combined To-Do List — V8 Upgrade (Personalization + Household/Multi-User + Financial Planning)

**Status**: all three epics fully scoped, none started. Epic A approved earlier. Epic B's schema/RLS design has been pressure-tested by a Plan agent and spot-verified against the actual codebase (see verification notes at the top of Epic B). Epic C scoped directly against existing code (`cashFlowForecast`, EMI/loan fields, OCR `ocr_corrections` precedent) with the user picking the lean version of all three sub-features. Ready for implementation to begin whenever the user gives the go-ahead.

**Now starting: Epic A, Phase 0 + Phase 1 (Vehicles)** — user go-ahead given 2026-09-17. Phases 0-4 (shared infra, Vehicles, Credit Cards, Houses, Other Assets) done as of 2026-09-19. Epic A is now fully shipped; Epic B or C is next whenever the user picks one.

**Testing environment — no staging/beta, live app only.** All verification happens against the real deployed app (expense-tracker-v6.vercel.app) and the real production Supabase project — there is no separate test instance. This raises the bar on the manual-SQL-migration step in particular (already flagged per-epic as "no migration runner"): before pasting any `supabase/add_*.sql` into the SQL editor, take a fresh export (Settings → Export Data → Download JSON, or a Supabase dashboard backup) first, since a bad RLS policy or migration has no staging environment to catch it before it touches real data. Epic B's "test with two real accounts" means two real production accounts (e.g. the user's own + a family member's, or two of the user's own emails) — not throwaway sandbox users.

---

# Epic A — Personalization ("your things" tracking)

## Context

The user wants a dedicated personalization area where they register the actual things in their life that expenses relate to — cars/bikes, credit cards, maybe more than one house, phones — "as detailed as we can make it." Today the app has no concept of any of this: fuel/maintenance fields exist on expenses but aren't tied to a specific vehicle, and there's no personal-asset registry at all.

This lives as **one new section inside the existing Settings page** (Settings is a single long scroll of `.settings-section` blocks today — App Update, Appearance, Base Currency, Data stats, Safe-to-Spend, Exchange rates, Notifications, Export, Import, V5 Migration, About, all in `src/components/Tracker.jsx` inside `tab === 'settings'`). No new tab, no modal — a new "🏠 Personalize" block joins that same stack, with pills inside it to switch between asset types (Vehicles / Credit Cards / Houses / Phones / …).

**Architecture decision**: this codebase's convention is one dedicated Supabase table per feature (trips, goals, budgets each have their own typed table — no generic entity/EAV table exists anywhere). Keep that convention: each asset type gets its own table with real typed columns, built one phase at a time, using Vehicles as the template to clone for the rest. But to avoid bolting a new `_id` column onto `expenses` every time a new asset type ships, expenses link to *any* asset through one generic pair of columns: `asset_type text` + `asset_id text` (e.g. `('vehicle', 'v_abc123')`), set once now, reused by every future phase — no further `expenses` schema changes needed as new asset types are added. **Epic B reuses this exact lightweight-tagging technique** (a nullable `household_id` column) for linking expenses to a household, so the pattern pays off twice.

A second shared building block: a generic `.ics` calendar-reminder download helper (Blob-download, same pattern as existing JSON/CSV export) — needed for PUC renewal (vehicles), card due-date (credit cards), rent due (houses), and warranty expiry (phones), so it's written once, generically, now.

## Shared infrastructure (build once, used by every phase)

1. **`expenses` gets two generic columns**: `alter table expenses add column if not exists asset_type text, add column if not exists asset_id text;` — no FK constraint (matches the no-FK precedent already used for trips-to-expenses date matching). App schema: `asset_type`/`assetId` added to `makeExpense()` (`src/utils/dataHelpers.js`) and `expenseToDb`/`expenseFromDb` (`src/hooks/useStorage.js` lines 14-99).
2. **Generic `.ics` reminder helper** in `Tracker.jsx`, near the existing Blob-download handlers (`handleExportJSON`/`handleExportCSV`, lines 2117-2154):
   ```js
   const downloadIcsReminder = ({ uid, date, summary, description, alarmDaysBefore = 3 }) => {
     const dt = (date || '').replace(/-/g, '')
     if (!dt) return
     const ics = [
       'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ExpenseTracker//Reminder//EN',
       'BEGIN:VEVENT', `UID:${uid}@expense-tracker`,
       `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
       `DTSTART;VALUE=DATE:${dt}`, `DTEND;VALUE=DATE:${dt}`,
       `SUMMARY:${summary}`, `DESCRIPTION:${description}`,
       'BEGIN:VALARM', `TRIGGER:-P${alarmDaysBefore}D`, 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, 'END:VALARM',
       'END:VEVENT', 'END:VCALENDAR',
     ].join('\r\n')
     const blob = new Blob([ics], { type: 'text/calendar' })
     const url  = URL.createObjectURL(blob)
     const a = document.createElement('a'); a.href = url; a.download = `${uid}.ics`; a.click()
     URL.revokeObjectURL(url)
   }
   ```
   `\r\n` + `VALUE=DATE` per RFC 5545 — Outlook/Apple Calendar are strict about CRLF. No library needed. Called by each phase with its own `uid`/`date`/`summary`.
3. **"Personalize" modal shell, revised from an inline settings-section**: Settings has just a launcher row ("Open Personalize" button); clicking it opens a `PersonalizeModal` component reusing the exact same `.modal-overlay`/`.modal`/`.modal-header` pattern already used by `ExpenseForm`/`NewGoalModal` — not a new bespoke popup mechanism. Inside the modal, the pill/tab row (Vehicles | Credit Cards | Houses | Phones) switches which asset-type's card-list + form renders below. Rationale: Settings is a scroll of lightweight toggles; Personalize will get heavy (forms, card grids, metrics per asset type) once fully built, so it earns its own focused surface rather than living inline. Each phase below adds its own pill + table + CRUD; the shell itself doesn't hardcode a specific type. (Implemented in Phase 0 as a simple modal without drag-to-dismiss, matching `NewGoalModal`'s lighter pattern rather than `ExpenseForm`'s `useBottomSheet` — revisit if Vehicles' eventual form content needs the fuller sheet treatment on mobile.)

## To-do list

### Phase 0 — shared infrastructure ✅ done 2026-09-18
- [x] `supabase/add_personalize.sql`: `alter table expenses add column if not exists asset_type text, add column if not exists asset_id text;`
- [x] `asset_type`/`assetId` in `makeExpense()` (`dataHelpers.js`) and `expenseToDb`/`expenseFromDb` (`useStorage.js`)
- [x] `downloadIcsReminder()` generic helper — module-level function in `Tracker.jsx` (not settings-section-scoped, since `PersonalizeModal` needs it too)
- [x] "🏠 Personalize" launcher — implemented as a modal (see revised shared-infrastructure note above), not an inline settings-section

### Phase 1 — Vehicles ✅ done 2026-09-18 (fully scoped, build first)
- [x] `vehicles` table (`supabase/add_vehicles.sql`, cloned from `add_trips.sql` shape): `id, user_id, name, type [car|bike|scooter], fuel_type [petrol|diesel|cng|electric|hydrogen], reg_number, purchase_date, next_puc_date, notes, row_version, updated_at, created_at` + RLS + realtime + row-version trigger (reuses existing `bump_row_version()`) — **not yet run against production, user needs to paste into Supabase SQL editor**
- [x] `expenses.service_parts jsonb` column — structured `[{part, dueKm}]` list on Vehicle Maintenance expenses, same precedent as existing `tax_breakdown jsonb`
- [x] `useStorage.js`: `vehicleToDb`/`vehicleFromDb` mappers, `vehicles` state, initial load, realtime subscribe, `addVehicle`/`editVehicle`/`deleteVehicle` (modeled on `addExpense`/`editExpense`/`deleteExpense` with offline-queue support), conflict resolution, `factoryReset` cleanup, return object
- [x] `ExpenseForm`: vehicle picker in Fuel Details and Vehicle Maintenance sections, only shown if `vehicles.length > 0`; picking a vehicle auto-sets `fuelType` and switches unit labels via `FUEL_UNIT`/`FUEL_ICON` lookup; repeatable parts-due list editor (`form.serviceParts`)
- [x] Submit handler: `assetType`/`assetId`/`serviceParts` wired into the `onSubmit` payload
- [x] List-item badges: unit-aware fuel display (icon/unit driven by `item.fuelType`), parts-tracked count on maintenance badge
- [x] `vehiclesWithData` memo (inside `PersonalizeModal`, not the main Tracker component — matches expenses via `e.assetType==='vehicle' && e.assetId===veh.id`): avg mileage/efficiency, total fuel spend, cost/km, next service due, vehicle age, PUC days-until
- [x] `unassignedVehicleExps` memo (inside `PersonalizeModal`): Fuel/Vehicle-Maintenance expenses with `!assetId`, for manual after-the-fact assignment
- [x] Vehicles tab content inside `PersonalizeModal`: add/edit form, vehicle cards (metrics, Edit/Delete — no confirm dialog, matches existing `deleteTrip` precedent), "Download PUC reminder (.ics)" button, "Unassigned expenses" panel with inline per-row vehicle assign dropdown
- [ ] *(stretch, optional)* `receiptParser.js` vehicleReg/vehicleModel → auto-match against saved vehicles to auto-fill `vehicleId` on OCR scan

### Phase 2 — Credit Cards ✅ done 2026-09-18
**Design correction made when this phase started (2026-09-18)**: credit cards do NOT reuse `asset_type`/`asset_id`. That pair is for "this expense is about vehicle/house/phone X" (single-select, one tag). A credit card is orthogonal to that — a fuel expense might need to be tagged to a vehicle (mileage) AND tagged to a credit card (spend/utilization) simultaneously, which the single generic pair can't hold. Credit Cards gets its own dedicated nullable `card_id` column on `expenses` instead, so it composes cleanly with any other asset tag.

- [x] `supabase/add_credit_cards.sql`: `credit_cards` table (`id text pk`, `user_id`, `name`, `bank`, `last4`, `credit_limit`, `billing_cycle_day` [1-28], `due_day` [1-28], `notes`, `row_version`, `updated_at`, `created_at`) + RLS + realtime + row-version trigger, same shape as `vehicles`; plus `alter table expenses add column if not exists card_id text` (no FK, matches existing convention)
- [x] `useStorage.js`: `cardToDb`/`cardFromDb`, `creditCards` state/CRUD (`addCreditCard`/`editCreditCard`/`deleteCreditCard`, offline-queue + conflict resolution), `card_id`/`cardId` mapped in `expenseToDb`/`expenseFromDb`, wired into initial load/realtime/factoryReset/return
- [x] `ExpenseForm`: card picker shown whenever `form.paymentMethod === 'Credit Card'` (not gated by category/subcategory like the vehicle picker — a card can pay for anything)
- [x] Metrics (`creditCardsWithData` memo in `PersonalizeModal`): current billing-cycle spend (expenses with `cardId` matching, dated within the cycle window derived from `billing_cycle_day`), utilization % (`cycle spend / credit_limit`), days to next due date (derived from `due_day`), "Download due-date reminder (.ics)"
- [x] Credit Cards tab content in `PersonalizeModal`, cloned from the Vehicles card-list shape, plus its own "Unassigned card expenses" panel (`paymentMethod === 'Credit Card' && !cardId`)
- [ ] *(explicitly deferred)* auto-suggesting a card from `paymentMethod`/last4 matching — manual picking only for v1

### Phase 3 — Houses ✅ done 2026-09-18
**Design correction #1 (2026-09-18, at phase start)**: the table needs a `rent_due_day` column (day-of-month, 1-28, same shape as credit cards' `due_day`) — the plan's original field list (`rent_amount` only) had no date to drive the "Download rent-due reminder" bullet below, so it was added alongside `rent_amount`.

**Design correction #2 (2026-09-18, user-requested expansion before first SQL run)**: `ownership` widened from a 2-way `owned|rented` to a 3-way `owned|rented|leased_out` — user currently owns all their houses outright but wants to model both "I move out and rent somewhere" (`rented`, I pay) and "I own a house and rent it out" (`leased_out`, I collect) as distinct future states on the same record shape. Also added `electricity_due_day` and `maintenance_due_day` (same 1-28 day-of-month shape as `rent_due_day`), independent of ownership — owned houses still have electricity/society-maintenance bills. Since the SQL had not yet been run against production, the table definition was edited in place rather than shipped as a follow-up `alter table`.

- [x] `houses` table (`supabase/add_houses.sql`, cloned from `add_vehicles.sql` shape): `id, user_id, name, address, ownership [owned|rented|leased_out], move_in_date, rent_amount, rent_due_day, electricity_due_day, maintenance_due_day, notes, row_version, updated_at, created_at` + RLS + realtime + row-version trigger — **not yet run against production, user needs to paste into Supabase SQL editor**
- [x] No new `expenses` columns — reuses `asset_type='house'` / `asset_id` from Phase 0
- [x] `useStorage.js`: `houseToDb`/`houseFromDb` mappers, `houses` state, initial load, realtime subscribe, `addHouse`/`editHouse`/`deleteHouse` (offline-queue + conflict resolution, cloned from `addVehicle`/`editVehicle`/`deleteVehicle`), conflict resolution, `factoryReset` cleanup, return object
- [x] `ExpenseForm`: house picker shown whenever `form.category === 'Housing' || form.category === 'Utilities'` (not sub-gated like the vehicle Fuel/Maintenance split — houses don't need per-subcategory detail fields)
- [x] `housesWithData` memo (inside `PersonalizeModal`, matches `e.assetType==='house' && e.assetId===house.id`): total tagged spend, three independent countdowns (rent when `ownership!=='owned'`, electricity, maintenance — all via `nextDueDateFor()`, reused from credit cards), card's top status badge shows whichever of the three is soonest
- [x] `unassignedHouseExps` memo (inside `PersonalizeModal`): Housing/Utilities-category expenses with `!assetId`, for manual after-the-fact assignment
- [x] Houses tab content inside `PersonalizeModal`: add/edit form (ownership dropdown drives whether rent fields show; electricity/maintenance due-day fields always shown), house cards (spend, rent, Edit/Delete — no confirm dialog, matches Vehicles/Cards precedent), up to three independent "Download reminder (.ics)" buttons (rent — label adapts to "due" vs "collect" by ownership, electricity, maintenance), "Unassigned expenses" panel with inline per-row house assign dropdown

### Phase 4 — Other Assets ✅ done 2026-09-19
**Design correction (2026-09-19, user-requested before build started)**: the phase was originally scoped as a rigid "Phones" table (carrier, model, warranty, EMI). The user asked for it to be an open-ended personal-items registry instead — a laptop, a boat, jewelry, an aircraft, "whatever he likes" — not a fixed device type. After presenting naming options (Other Assets / Belongings / Valuables), the user picked **"Other Assets."** This is a deliberate, one-time departure from the "one typed table per feature" convention used by Vehicles/Cards/Houses: this bucket's entire point is that its `category` varies per row with no shared type-specific fields worth normalizing into separate tables. Confirmed via research: no generic/EAV table existed anywhere else in the codebase, no `<datalist>`/free-text-with-suggestions UI pattern existed yet (the chip-prefill interaction is new — reuses the `tag-btn` CSS class for visual consistency only, not the Grocery-Tags multiselect-toggle logic), and no `Phone` device-tracking logic existed outside the placeholder tab (the only pre-existing "Phone" reference is an expense *subcategory* under Utilities, for phone bills, unrelated to this feature).

- [x] `other_assets` table (`supabase/add_other_assets.sql`, cloned from `add_houses.sql` shape): `id, user_id, name, category` (free text, default `'Other'` — chip row of suggestions: Laptop/Tablet/Camera/Watch/Appliance/Furniture/Jewelry/Instrument/Boat/Aircraft/Other — prefills the text input, user can still type anything), `purchase_date, purchase_price, reminder_label, reminder_date` (one-time reminder, modeled on Vehicles' `next_puc_date` — NOT a recurring day-of-month), `emi_amount, emi_due_day` (recurring monthly EMI reminder, modeled on Houses'/Credit Cards' due-day pattern), `notes` (catch-all for serials/registration/policy numbers), `row_version, updated_at, created_at` + RLS + realtime + row-version trigger — **not yet run against production, user needs to paste into Supabase SQL editor**
- [x] No new `expenses` columns — reuses `asset_type='other'` / `asset_id` from Phase 0
- [x] `useStorage.js`: `otherAssetToDb`/`otherAssetFromDb` mappers, `otherAssets` state, initial load, realtime subscribe, `addOtherAsset`/`editOtherAsset`/`deleteOtherAsset` (offline-queue + conflict resolution, cloned from `addHouse`/`editHouse`/`deleteHouse`), conflict resolution, `factoryReset` cleanup, return object
- [x] `ExpenseForm`: generic "Tag to an item" picker shown whenever `otherAssets.length > 0` — **not** gated by category/subcategory (unlike vehicle/house pickers), since items are open-ended by nature and any expense in any category might belong to one
- [x] `otherAssetsWithData` memo (inside `PersonalizeModal`, matches `e.assetType==='other' && e.assetId===item.id`): total tagged spend, one-time reminder countdown (direct date math, same as Vehicles' PUC pattern), recurring EMI countdown (via `nextDueDateFor(emiDueDay)`), card's top status badge shows whichever is soonest
- [x] No `unassignedOtherExps` memo (deliberate, unlike the other three phases) — there's no cheap category/subcategory/payment-method predicate to scope candidate expenses for a fully generic bucket; tagging happens via the `ExpenseForm` picker at creation/edit time instead
- [x] Other Assets tab content inside `PersonalizeModal`: add/edit form (Name, Category text input + suggestion chips, Purchase Date/Price, Reminder Label/Date, EMI Amount/Due Day, Notes), item cards (spend, EMI/mo badge, up to two independent "Download reminder (.ics)" buttons, Edit/Delete — no confirm dialog, matches precedent)
- [x] In-scope cleanup: two stale "Phones" copy references in `Tracker.jsx` (the "pick a category" intro line and the Settings launcher subtitle) updated to say "Other Assets" / "other items"

## Known risks (Epic A)

1. **Manual SQL step every phase** — this repo has no migration runner; each phase's `supabase/add_*.sql` must be pasted into the Supabase SQL editor by the user before that phase's code path works.
2. **No FK on `asset_id`** — intentional, matches the existing no-FK precedent (trips↔expenses); a deleted asset just leaves its id dangling on old expenses, which the UI treats the same as unassigned.
3. **Scope discipline** — all phases (0-4) are now built; this line is kept for historical context on how the plan was staged (each phase's forms/UI were left unbuilt until that phase actually started, avoiding speculative UI no one had confirmed the fields for).
4. **`vehicleCurrentKm`/`vehicleNextServiceKm` pre-existing gap** — already missing from `makeExpense()` today (unrelated bug, not introduced by this work); flagging so it isn't mistaken for a regression later.
5. **CSV export** won't gain asset columns in Phase 1; JSON export already includes them for free (dumps whole expense objects). Add to CSV only if requested.

## Verification (Epic A Phase 1, repeat pattern for later phases)

- `npm run dev`, sign in, open Settings → confirm "Personalize" section renders with a Vehicles pill and empty state.
- Paste `add_personalize.sql` into Supabase SQL editor first, or vehicle creation fails with a Postgres "relation/column does not exist" error surfaced via `setError`.
- Add 2 vehicles with different fuel types (e.g. Petrol car, Electric scooter); confirm cards render, edit/delete work, and a second browser tab picks up realtime changes.
- Add a Fuel expense tagged to a vehicle; confirm fuel-type auto-fills and unit label matches (km/L vs km/kWh). Add a second fill-up; confirm the vehicle card's mileage/cost-per-km updates.
- Add a Vehicle Maintenance expense with 2 parts-due rows tagged to a vehicle; confirm the card shows next-service-due + parts list.
- Set a vehicle's PUC date, click "Download reminder (.ics)", open the file and confirm `\r\n` line endings, `BEGIN:VEVENT`/`END:VEVENT`, valid `DTSTART;VALUE=DATE:YYYYMMDD` — then confirm the OS calendar app imports it as an all-day event.
- Add an untagged Fuel expense; confirm it shows in "Unassigned expenses" and that assigning it via the dropdown moves it into that vehicle's numbers.
- Go offline (devtools), add a vehicle, confirm it queues and syncs once back online.

---

# Epic B — Household & Multi-User Support

## Context

The app is currently strictly single-user: every table's RLS policy is `auth.uid() = user_id` with zero sharing mechanism anywhere, signup is self-serve magic-link with no invite/allowlist, and the existing `splitWith`/`splitParts` fields are pure free-text memo labels with no connection to a real account. The user wants to eventually hand this app to their wife and family members, track personal (private) expenses alongside household/family combined expenses, and split costs with people — some of whom are close family (a formal "household" with a combined dashboard) and some of whom are just individually-invited friends (for one-off splits, not part of any household), with real running-balance settlement for anyone who has an account, same as today's free-text fallback for anyone who doesn't.

**Decisions locked in with the user:**
- **Invites**: one generic invite-code system for everything. Owner generates/shares a code; recipient signs up via the existing magic-link flow and redeems the code once. Redeeming creates a **connection** between the two users — NOT automatic household membership. Adding a connection to a household, or just keeping them as a split-only "friend," is an explicit second step taken after the connection exists.
- **Households**: named group, owner + co-owner roles (ownership transferable, multiple co-owners allowed), at least one owner must always remain. Only existing connections of a current member can be added — no adding strangers directly.
- **Sharing model**: private by default. An expense/income row can be explicitly tagged to a household (nullable `household_id`, reusing the exact lightweight-tagging pattern from Epic A's `asset_type`/`asset_id`), making it visible (read-only) to that household's members for a combined view. Row ownership/edit rights never change — only extra SELECT visibility.
- **Splits**: generalize today's free-text `splitWith` into real participants — each one is either a connected real app user (household member or friend connection) or a free-text external name (today's behavior, kept as the no-account fallback). Real connected-user splits get full running-balance tracking and settle-up (Splitwise-style, not just a static share calculation); free-text participants stay informational-only (no counterpart account to settle with).

This is a large, security-sensitive change (RLS rewrite touching most tables), now fully designed and verified against the actual codebase (spot-checked: `expenseFromDb` in `useStorage.js:57-99` really is missing a `userId` mapping needed for Phase 3's balance calc; split UI confirmed at `Tracker.jsx:1310-1317`; biometric lock confirmed single-account via singular `localStorage` keys in `useBiometric.js:5-9`).

## Cross-cutting decisions (apply to every phase below)

- **New prerequisite: `profiles` table (built in Phase 0).** `auth.users.user_metadata` is JSONB that client-side RLS-joined queries can't reach — connections/households/splits all need to resolve a `user_id` into a display name for UI ("X owes Y") and need RLS policies that join across users. A `public.profiles` table (`id uuid pk → auth.users`, `display_name`, `email`), populated by an `auth.users` insert trigger, is the standard Supabase pattern and a hard requirement, not optional polish.
- **RLS recursion avoidance, general rule**: never let table A's policy subquery table B if B's policy subqueries A back. `households`/`household_members` mutual visibility uses `security definer` helper functions (`is_household_member`, `is_household_owner`) instead of nested policy subqueries — the function reads with RLS bypassed internally, so the policy itself never recurses. `expense_splits` → `expenses` stays one-directional (expenses' own policies never reference `expense_splits`), so no cycle there either.
- **Biometric lock's single-account-per-browser assumption is a known, unfixed gap.** If two household members share one physical device, the second person's biometric enrollment overwrites the first's `localStorage` keys, silently locking the first out of biometric unlock (falls back to magic-link, not broken, just degraded). Out of scope for this epic — revisit only if shared-device usage actually gets reported.
- **No new onboarding-wizard step for invites.** Redeeming a code is a post-onboarding action: support an optional `?invite=CODE` URL param that `Auth.jsx` stashes in `sessionStorage` before the magic-link redirect, then auto-prompt to redeem once onboarding completes; plus an always-available manual redeem field in Settings. Matches the existing wizard's own skip-everything bias — most signups are organic, not invited.
- **ID column convention, corrected**: every new table's primary key is `id text primary key`, client-generated the same way `addExpense`/`createHousehold` already do (`Date.now().toString(36) + Math.random().toString(36).slice(2)`) — matches every existing table (`expenses`, `trips`, `goals`, `vehicles`) and is *required* for this codebase's optimistic-UI pattern, since the client must know the row's id before the insert response comes back to show it immediately with `_pending: true`. The one deliberate exception is `profiles.id`, which is `uuid` because it must equal `auth.users.id` (always uuid) — that's not an inconsistency, it's a hard requirement. `invites`, `connections`, and `expense_splits` below are corrected from an earlier `uuid default gen_random_uuid()` draft to `text`, client-generated, to match.

## To-do list

### Phase 0 — Connections + Invites (+ `profiles` table)
- [ ] `supabase/add_profiles.sql`: `profiles` table (`id uuid primary key references auth.users(id)` — the one deliberate exception to the text-id convention, since this id must equal the Supabase-assigned `auth.users.id` — `display_name`, `email`, `created_at`) + RLS (`select` for any authenticated user, `update`/`insert` self-only) + `handle_new_user()` trigger on `auth.users` insert (auto-creates the profile row) + one-time backfill insert for existing users
- [ ] One-line addition to `OnboardingWizard.jsx`'s `handleFinish` (~line 43): after `supabase.auth.updateUser(...)`, also `supabase.from('profiles').update({ display_name })` so the profile stays in sync — `user_metadata` doesn't auto-propagate there
- [ ] `supabase/add_connections.sql`: `invites` table (`id text primary key` — client-generated, per the ID convention above — `code`, `created_by`, `status` [pending/redeemed/revoked], `redeemed_by`, `redeemed_at`, `expires_at` default +14 days) + RLS (creator sees/manages own invites only); `connections` table (`id text primary key`, `user_a`, `user_b` — stored once per pair with `user_a < user_b` enforced via CHECK, unique constraint) + RLS (visible to either party, references only its own two columns — no recursion risk)
- [ ] `redeem_invite(p_code)` **security definer** Postgres function — required because the redeemer isn't `created_by` so a plain client-side UPDATE can't pass RLS; the function validates status/expiry/self-redeem, flips the invite to redeemed, and inserts the `connections` row (generating its `text` id the same way the client-side helpers do, e.g. `substr(md5(random()::text), 1, 20)`, since this insert happens server-side inside the function, not from the client)
- [ ] `useStorage.js`: `createInvite`/`redeemInvite` (the latter calls `.rpc('redeem_invite', ...)`, not a table update) — clone `addExpense`'s optimistic+enqueue shape; realtime on `connections` must subscribe unfiltered and filter client-side by `user_a === userId || user_b === userId` (Supabase realtime filters only support single-column equality, and there's no single `user_id` column here)
- [ ] Settings UI: "Generate invite code" + native Share/clipboard button, "Redeem a code" input, list of current connections (via `profiles.display_name`)
- [ ] `Auth.jsx`: capture `?invite=CODE` into `sessionStorage` before `signInWithOtp`; post-onboarding, check for it once and prompt to redeem

### Phase 1 — Households
- [ ] `supabase/add_households.sql`: `households` (`id text primary key`, `name`, `created_by`) + `household_members` (`household_id text`, `user_id`, `role` [owner|member], composite PK — no separate `id` column needed, the pair is already unique)
- [ ] `is_household_member()` / `is_household_owner()` **security definer** helper functions — the recursion-breaking mechanism referenced above; all household/household_members RLS policies call these instead of subquerying each other directly
- [ ] RLS: members SELECT their households + member lists; only owners INSERT/UPDATE members or change roles; DELETE allowed for owners (removing anyone) or self (leaving)
- [ ] `check_household_member_change()` BEFORE trigger on `household_members` (INSERT/UPDATE/DELETE) enforcing two invariants RLS can't express declaratively: (1) a new member must already be a `connections` row of the inserting owner, (2) the last remaining owner can never be removed or demoted — chosen as a DB trigger over an app-level check specifically because app-level checks race under concurrent requests (two tabs removing two different owners at once could both pass a stale client-side count)
- [ ] `useStorage.js`: `createHousehold` (two sequential inserts — household row, then owner member row, not `Promise.all`, since the member insert's policy depends on the household existing), `addHouseholdMember` (from existing connections only), `setMemberRole`, `removeMember` — same unfiltered-then-client-filter realtime approach as Phase 0
- [ ] Settings UI: households list (name + role badge), create household, per-household member management (add from connections dropdown, promote/demote, leave/remove)

### Phase 2 — Shared Expense Visibility
- [ ] `supabase/add_household_expense_link.sql`: nullable `household_id` on `expenses` and `income` (references `households(id) on delete set null`, indexed) — same lightweight-tagging shape as Epic A's `asset_type`/`asset_id`
- [ ] RLS: DROP + CREATE the existing SELECT policies on `expenses`/`income` to add `or (household_id is not null and is_household_member(household_id, auth.uid()))` — reuses the Phase 1 helper function, so no new recursion surface. Write policies (insert/update/delete) stay untouched, owner-only — sharing is read-only for everyone except the row's creator
- [ ] `expenseToDb`/`expenseFromDb` (and income equivalents) in `useStorage.js`: add `household_id`/`householdId` mapping (one line each, same spot as the existing `budget_category`/`budgetCategory` mapping)
- [ ] **Known gap, accepted for v1**: the existing realtime channel filters `expenses`/`income` subscriptions by `user_id=eq.${userId}`, so a household member won't get a *live* push when someone else adds a household-shared expense — the combined view will be correct on refetch/tab-switch but not instantly realtime. Fixing this needs a second unfiltered subscription merged with the first; deferred unless staleness is actually reported as an issue
- [ ] Expense/income form: household picker (`<select>`: "Private (just me)" default + household names), shown only if `households.length > 0` — mirrors the existing conditional-field pattern already used for `splitWith`
- [ ] Combined household view: **not a new tab** — a household selector added to the existing Overview tab, filtering the already-fetched `expenses`/`income` arrays client-side by `householdId === selected.id` (RLS already widens what the client receives server-side; no new query needed). Justified by direct analogy to the existing `tripsWithData` `useMemo` pattern (~line 3013) — a household view is structurally the same "filter + aggregate via useMemo" idea, just a different filter predicate

### Phase 3 — Real Splits + Settlement
- [ ] `supabase/add_expense_splits.sql`: `expense_splits` table (`id text primary key`, client-generated per the ID convention) — one row per non-payer participant (`expense_id text references expenses(id)`, `participant_user_id` nullable, `participant_name` nullable, CHECK constraint enforcing exactly one of the two is set, `share_amount`, `status` [open|settled], `settled_at`)
- [ ] RLS SELECT: visible to the expense's payer (subquery on `expenses.user_id`) or the participant directly — safe from recursion since `expenses`' own policies never reference `expense_splits` (one-directional)
- [ ] RLS INSERT/UPDATE/DELETE: payer manages splits on their own expenses; a **second, overlapping UPDATE policy** lets the participant flip their own split to settled (Postgres RLS ORs multiple permissive policies together) — narrowed by a `restrict_participant_split_update()` trigger so a non-payer participant can only change `status`/`settled_at`, never `share_amount` (RLS alone can't do column-level restriction)
- [ ] **Migration decision: leave `split_with`/`split_parts` as-is, no backfill.** Free-text names have no way to resolve to a real account, so backfilling would just re-store the same non-actionable text in a new shape for no behavioral gain. Old field keeps working in the existing Insights "Split Expenses" card unchanged; new expenses use the new structured picker going forward (either/or per expense, not a dual-entry UI)
- [ ] `expenseFromDb` needs a new `userId: row.user_id` mapping (currently absent — confirmed by reading `useStorage.js:57-99` — RLS made it redundant when a user only ever saw their own rows; now needed so the balance calc below can tell who owns which expense)
- [ ] `useStorage.js`: `saveExpenseSplits` (replace-all-on-edit: delete existing rows for the expense, insert the new set), `settleSplit` (optimistic update + `status: 'settled'`) — realtime same unfiltered-then-client-filter approach
- [ ] Balance computation: **client-side `useMemo`, not a Postgres view** — matches the codebase's existing convention (`tripsWithData`, insights), and a view would still need the same client-side "who's payer vs participant" interpretation per row, so it buys little for the cost of another manual-SQL-paste migration. ~15 lines: net a running `{otherUserId: amount}` map from open `expense_splits`, positive = they owe you
- [ ] UI: expense form split section becomes a toggle between "External name" (today's free-text) and "App user" (picker from `connections`, can mix both kinds of participant in one split); new "Settle Up" view listing net balances per person, expandable to underlying open splits, with a "Mark settled" button; Insights "Split Expenses" card extended to sum both old and new data sources in one place

## Known risks (Epic B)

1. **Largest single change in this app's history** — touches auth, RLS on nearly every table, and adds 4-5 new tables. Build and verify one phase at a time; do not attempt all four phases in one sitting.
2. **RLS correctness is a security boundary, not a UI nicety** — a mistake here means one household member's private expenses leaking to another, or worse, cross-account data exposure. Every new/modified policy needs explicit manual testing with two real accounts before considering a phase done, not just a single-account smoke test. **Elevated risk given no staging environment**: Phase 2's `DROP POLICY` + `CREATE POLICY` on the live `expenses`/`income` tables' SELECT rules runs directly against production — export a backup first, and consider testing the new policy's exact SQL logic by hand (e.g. via the Supabase SQL editor's own query runner) before applying it as the live policy, rather than only finding out it's wrong via the app UI.
3. **Manual SQL step every phase** — same as Epic A, this repo has no migration runner.
4. **Biometric/OTP lock interaction with shared devices** — unresolved, see cross-cutting decisions above. Falls back to magic-link, doesn't break login entirely.

## Verification approach (Epic B, all phases)

Every phase needs testing with **two separate real Supabase auth accounts** (not just one), since the entire point is cross-account behavior:
- Confirm a private (untagged) expense on Account A is never visible to Account B, with or without a connection/household between them.
- Confirm invite codes expire/can't be reused after redemption (Phase 0).
- Confirm a non-owner household member cannot remove other members or delete the household (Phase 1).
- Confirm removing a household's only owner is blocked (Phase 1).
- Confirm a household-tagged expense from Account A appears read-only in Account B's combined view, and that Account B cannot edit/delete it (Phase 2).
- Confirm a real-user split correctly shows on both accounts' balances, and that settling it from one side reflects on the other (Phase 3).

## Critical files (Epic B)
- `supabase/add_profiles.sql`, `add_connections.sql`, `add_households.sql`, `add_household_expense_link.sql`, `add_expense_splits.sql` (new migrations, one per phase, self-contained/re-runnable per this repo's convention)
- `src/hooks/useStorage.js` — all new CRUD/mappers/realtime land here, cloning `addExpense`/`editExpense`/`deleteExpense` (lines 527-572)
- `src/components/Tracker.jsx` — all new UI inside the existing `settings` tab block (~line 5425), split form (~1310-1317), `tripsWithData` pattern (~3013-3026) to mirror for the balance/household memos
- `src/components/Auth.jsx` — `?invite=` capture before the magic-link redirect
- `src/components/OnboardingWizard.jsx` — one-line profile-sync addition in `handleFinish` (~line 43), no new step

---

# Epic C — Financial Planning (Long-Term Forecast, Debt Payoff, Smart Rules)

## Context

Three separate feature requests, each scoped down from a "full product" version to the leanest one that still delivers the real value, per the user's picks:
- **Long-term forecast**: extend the existing 30/60/90-day Cash Flow Forecast rather than build a new retirement-modeling subsystem.
- **Debt payoff**: single-debt amortization + interest-saved calculator, matching Vehicles' dedicated-table shape from Epic A — not a multi-debt avalanche/snowball optimizer.
- **Smart rules**: auto-categorization only (IF description/amount/payment-method THEN set category/subcategory/tags) — not full IFTTT-style multi-action automation.

All three are pure client-side computation (no external APIs, no ML) — consistent with this app's existing "self-built" philosophy already proven in the Epic 9 OCR pipeline and the `ocr_corrections` learning table.

These three sub-features are independent of each other and of Epics A/B — can be built in any order, or interleaved.

## C1 — Long-Term Forecast (extends existing Cash Flow Forecast)

**Reuses**: `cashFlowForecast` useMemo (`Tracker.jsx:3386-3448`), which already computes `netDailyRate` (income − expenses, blending recurring + variable rates). No new Supabase table needed — this is a pure projection over existing data plus one new user-set assumption.

- [ ] Add `assumedAnnualReturn` setting (simple number input, e.g. defaults to 0% — "just show where my current savings rate leads," user can raise it to model investment growth) — persist alongside other simple settings (`localStorage` or `user_metadata`, matching how `baseCurrency`/`display_name` are stored today)
- [ ] New `longRangeForecast` useMemo, sibling to `cashFlowForecast`: `netAnnualRate = netDailyRate * 365.25`, then compound year-by-year: `balance = balance * (1 + assumedAnnualReturn/100) + netAnnualRate` for 1/5/10/20/30-year horizons (or a retirement-age-driven horizon if the user has a birthdate — skip birthdate collection for v1, just offer fixed horizons)
- [ ] Overlay existing Goals (`targetDate`/`target`) as markers on the same projection chart — reuses the already-fetched `goals` array, no new query
- [ ] UI: new "Long-Term" view inside the existing Forecast sub-tab (Analytics tab) — a horizon selector (1/5/10/20/30yr) + line chart (reuse the existing chart component pattern, e.g. `LineChart`) + the assumed-return input
- [ ] Copy note in the UI: "Projection assumes your current income/spending pattern continues — not a guarantee" (avoid the classic financial-calculator overconfidence trap)

## C2 — Debt Payoff Planner

**New table**, same shape/conventions as Vehicles (Epic A Phase 1): row-versioned, RLS, realtime.

- [ ] `supabase/add_debts.sql`: `debts` table (`id text primary key` — client-generated, same convention as every other table including Epic B's — `user_id`, `name`, `principal`, `interest_rate` [annual %], `term_months`, `minimum_payment`, `start_date`, `notes`, `row_version`, `updated_at`, `created_at`) + RLS (`auth.uid() = user_id`, same 4-policy shape as every other user-owned table) + realtime + `bump_row_version()` trigger (reuses the existing trigger function from `add_row_versioning.sql`)
- [ ] `useStorage.js`: `debtToDb`/`debtFromDb` mappers, `debts` state, initial load, realtime subscribe, `addDebt`/`editDebt`/`deleteDebt` (clone `addExpense`/`editExpense`/`deleteExpense` shape, not `addTrip`'s queue-less one), `factoryReset` cleanup, return object
- [ ] Pure JS amortization helper (`src/utils/debtHelpers.js` — small, reusable math, earns its own file unlike the single-use household memos): standard formula `M = P·r(1+r)^n / ((1+r)^n − 1)` where `r` = monthly rate, `n` = term months; generate the full month-by-month schedule (balance, interest, principal paid) from it
- [ ] "Extra payment" simulator: same schedule generator called with `minimum_payment + extraAmount`, diffed against the baseline schedule → months saved + total interest saved
- [ ] Settings launcher button opening its own modal (mirrors Epic A's Personalize modal pattern if Epic A ships first, otherwise its own `PersonalizeModal`-style component): add/edit/delete debt cards, each showing payoff date, total interest, monthly amortization chart, an "extra payment" input with live interest-saved/months-saved preview
- [ ] List-item integration: expenses with `paymentMethod === 'EMI'` or category `Finance/Loan Payment` get an optional debt-picker (same lightweight-tagging idea as Epic A's `asset_type`/`asset_id` — reuse those exact columns with `asset_type='debt'` if Epic A ships first, otherwise a dedicated nullable `debt_id` column) so actual EMI payments can be checked against the planned schedule — **stretch, not required for v1**, the standalone calculator works without any expense linkage

## C3 — Smart Rules (Auto-Categorization)

**New table** + a pure rule-evaluation function, applied at the points where a category gets set today.

- [ ] `supabase/add_categorization_rules.sql`: `categorization_rules` table (`id text primary key` — client-generated, same convention — `user_id`, `field` [description|amount|paymentMethod], `operator` [contains|equals|gt|lt], `value`, `set_category`, `set_subcategory`, `set_tags text[]`, `priority int default 0`, `enabled boolean default true`, `row_version`, `updated_at`, `created_at`) + RLS + realtime + row-version trigger, same shape as every other user-owned table
- [ ] `useStorage.js`: `ruleToDb`/`ruleFromDb`, `rules` state/CRUD, same clone-of-`addExpense` pattern
- [ ] Pure `applyRules(expense, rules)` function (`src/utils/ruleHelpers.js`): evaluates enabled rules in `priority` order against `description`/`amount`/`paymentMethod`, returns the first match's category/subcategory/tags (first-match-wins, not layered — simplest mental model for the user)
- [ ] Hook into `ExpenseForm`: call `applyRules` on description/amount/paymentMethod change, and only **suggest** (pre-fill category/subcategory as if selected, with a small "auto-applied by rule ✨" hint) rather than silently overriding — if the user then manually changes the category, their choice wins, matching how OCR pre-fill already defers to manual edits today
- [ ] Also apply at OCR-scan-apply time (`applyOcr`, since that's the other existing "auto-fill category" entry point) — rules run *after* the existing merchant-keyword OCR categorization, only overriding if a rule matches (rules are the more specific, user-authored signal; OCR's keyword map is the generic fallback)
- [ ] Settings UI: "Rules" section — list existing rules in priority order (drag-to-reorder is a stretch; a plain numeric priority input is enough for v1), add/edit/delete, a simple builder (field dropdown → operator dropdown → value input → category/subcategory/tags to set)
- [ ] *(Explicitly out of scope per the user's "auto-categorization only" pick)*: no notification/alert-triggering rules, no frequency-based auto-learning beyond what already exists in `ocr_corrections` — if that's wanted later, it's a distinct follow-up scoped the same way `ocr_corrections` was for Epic 9

## Known risks (Epic C)

1. **C1 projections are only as good as the assumption inputs** — a 30-year compound projection off a 30-day spending sample is inherently rough; the UI disclaimer matters, not just the math.
2. **C2 amortization math must be tested against a known reference** (e.g. a public loan calculator) before trusting the "interest saved" numbers — a formula transcription bug here gives the user wrong financial advice, worth one careful cross-check.
3. **C3 rule ordering matters** — first-match-wins means rule priority order directly changes behavior; needs clear UI feedback about which rule fired on a given expense (the "✨ auto-applied by rule" hint should say *which* rule, not just that one fired).
4. **No shared infrastructure between C1/C2/C3** — unlike Epic A's `asset_type`/`asset_id` reuse, these three are independent; fine to build in any order or skip one without blocking the others.

## Verification (Epic C)

- **C1**: set `assumedAnnualReturn` to 0%, confirm the 1-year projection is approximately `netDailyRate x 365`; set it to a nonzero value, confirm later years compound (not just linear).
- **C2**: create a test debt (e.g. principal ₹100,000, 12% annual, 24 months), confirm the calculated monthly payment and total interest match a known external amortization calculator; add an extra payment, confirm months-saved/interest-saved move in the right direction.
- **C3**: create a rule ("description contains 'Starbucks' → Food/Beverages"), add a new expense with that description, confirm the category auto-suggests with the rule hint; manually override the category, confirm the rule doesn't fight the manual choice.

## Critical files (Epic C)
- `supabase/add_debts.sql`, `add_categorization_rules.sql` (new migrations)
- `src/utils/debtHelpers.js`, `src/utils/ruleHelpers.js` (new, small, pure-function files — earn their own file since they're reusable math/logic, unlike the single-use household memos)
- `src/hooks/useStorage.js` — CRUD/mappers, cloning `addExpense`/`editExpense`/`deleteExpense`
- `src/components/Tracker.jsx` — `cashFlowForecast` (~3386) sibling memo for C1, Forecast sub-tab UI, `ExpenseForm` (~769) hook-in for C3, Settings sections for C2/C3
