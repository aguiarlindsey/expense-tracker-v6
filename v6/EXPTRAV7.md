# EXPTRAV7 — Full Feature Reference

**Expense Tracker V7** · `https://expense-tracker-v6.vercel.app`  
**Version:** v7.11.1 · **Built:** Vite + React 19 + Supabase · **Deployed:** Vercel  
**Last updated:** 12-05-2026

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Overview Tab](#2-overview-tab)
3. [Income Tab](#3-income-tab)
4. [Trends Tab](#4-trends-tab)
5. [Budgets Tab](#5-budgets-tab)
6. [Goals Tab](#6-goals-tab)
7. [Insights Tab](#7-insights-tab)
8. [Recurring Tab](#8-recurring-tab)
9. [Trips Tab](#9-trips-tab)
10. [Exchange Tab](#10-exchange-tab)
11. [Settings Tab](#11-settings-tab)
12. [Keyboard Shortcuts](#12-keyboard-shortcuts)
13. [Adding Expenses — Full Field Guide](#13-adding-expenses--full-field-guide)
14. [Receipt Scanner (OCR)](#14-receipt-scanner-ocr)
15. [Adding Income — Full Field Guide](#15-adding-income--full-field-guide)
16. [Multi-Currency Support](#16-multi-currency-support)
17. [Incognito Mode](#17-incognito-mode)
18. [Biometric Lock & OTP Fallback](#18-biometric-lock--otp-fallback)
19. [Anomaly Detection](#19-anomaly-detection)
20. [Conflict Resolution](#20-conflict-resolution)
21. [Offline Mode](#21-offline-mode)
22. [Real-Time Sync](#22-real-time-sync)
23. [Push Notifications](#23-push-notifications)
24. [PWA — Install on Device](#24-pwa--install-on-device)
25. [Data Migration from V5](#25-data-migration-from-v5)
26. [Export & Import](#26-export--import)
27. [Danger Zone](#27-danger-zone)
28. [Technical Reference](#28-technical-reference)

---

## 1. Getting Started

### Login
- Go to `https://expense-tracker-v6.vercel.app`
- Enter your email and click **Send Magic Link**
- Open the email, click the link — you are logged in automatically
- No password required; the magic link expires after 1 use

### First-time setup (recommended)
1. **Settings** → set your **Base Currency** (default: INR ₹)
2. **Settings** → **Budgets** → set monthly/daily/weekly spending limits
3. **Settings** → **Security** → enrol biometric (fingerprint/Face ID) for a faster lock screen
4. **Settings** → **Recurring Reminders** → Enable push notifications
5. If migrating from V5 → **Settings** → **Migrate from V5**

---

## 2. Overview Tab

The main dashboard. Snapshot of your financial health for the current month.

### Summary Cards
| Card | What it shows |
|------|--------------|
| **This Month** | Total expenses in the current calendar month |
| **Income** | Total income recorded this month |
| **Balance** | Income minus expenses |
| **Daily Avg** | Average daily spend this month |
| **Daily Allowance** | Safe-to-spend daily budget |

### Pie Chart
- Spending split by category for the current month
- Tap a slice to see category name and amount

### Recent Expenses List
- Most recent expenses, sorted by date
- Shows: date (DD-MM-YYYY), description, amount, category, payment method, tags
- **🔄** = recurring template · **⏳** = pending sync · **⚠️** = anomaly flag
- Tap ✏️ to edit · 🗑️ to delete

### Upcoming Recurring Banner
- Appears when recurring expenses are due within 7 days
- Red = due today/tomorrow · Amber = 2–3 days · Blue = 4–7 days

### Burn-Rate Forecasting Panel
- Projects your total spend by end of month based on current daily velocity
- Shows: projected total, daily burn rate, acceleration (↑ faster / ↓ slowing), runway (days until budget exhausted)
- Updates live with every new expense

### Month-End Forecast
- Simple projection: current daily average × remaining days in month
- Shows trend vs previous month (↑ ↓)

### Safe-to-Spend
- Formula: `(this month's income − fixed expenses − savings goal) ÷ remaining days`
- Green = healthy · Amber = tight · Red = over budget
- Configure savings goal in **Settings → Safe-to-Spend**

---

## 3. Income Tab

### Adding Income
Click **+ Income** (or press **I**). Fields:
- Date, Description, Amount, Currency, Conversion Rate
- Source: Salary / Freelance / Business / Rental / Dividends / Interest / Bonus / Gift / Refund / Side Income / Other
- Payment Method, Notes, Recurring toggle + period

### Income List
- Sorted by date descending, grouped by date (DD-MM-YYYY headers)
- Edit or delete any entry
- Recurring income marked with 🔄

### Income Summary Cards
- Total income (all time) · This month · Monthly average · Top source

---

## 4. Trends Tab

### Heatmap Calendar
- 90-day grid showing daily spend intensity
- Darker = higher spend · tap a cell for the day's total

### Monthly Bar Chart
- 12-month spending history, colour-coded by category

### Month-over-Month Comparison
- Side-by-side: this month / last month / same month last year
- Columns: Expenses · vs Prev · Income · Saved · Transactions

### Yearly Comparison
- Year-by-year: total expenses, income, saved, transaction count

---

## 5. Budgets Tab

### Budget Types
| Type | Reset |
|------|-------|
| **Daily** | Midnight every day |
| **Weekly** | Every Monday |
| **Monthly** | 1st of each month |
| **Per Category** | Monthly (e.g. Food: ₹8,000/month) |

### Budget Bars
- Green = under 50% · Amber = 50–80% · Red = 80–100% · Dark red = over limit

### Toast Alerts
- **50%** — yellow ⚡ toast
- **80%** — orange ⚠️ toast
- **100%** — red 🚨 toast · auto-dismiss after 6 seconds

---

## 6. Goals Tab

### Creating a Goal
Click **+ New Goal** → Name, Target Amount, Target Date (optional), Icon emoji, Note.

### Contributions
- Click **+ Add** on any goal card → enter date, amount, optional note
- Contributions accumulate toward the goal total

### Goal Progress
- Progress bar: amount saved / target
- Milestone toasts at 25%, 50%, 75%, 100%
- 🎉 confetti animation at 100%

---

## 7. Insights Tab

16 analytical cards covering spending behaviour.

| # | Card | What it shows |
|---|------|--------------|
| 1 | **Top Category** | Your biggest spending category this month |
| 2 | **Biggest Transaction** | Largest single expense this month |
| 3 | **Payment Methods** | Frequency breakdown by method |
| 4 | **Average Transaction** | Mean expense amount |
| 5 | **Weekend vs Weekday** | Spend pattern comparison |
| 6 | **Expense Types** | Variable / Fixed / Luxury / Need / Want / Investment split |
| 7 | **Day of Week** | Bar chart: which day you spend most |
| 8 | **Recurring Summary** | Count + total value of recurring templates |
| 9 | **Split Expenses** | Expenses shared with others |
| 10 | **MoM Delta** | % change vs last month |
| 11 | **Dining App Breakdown** | Swiggy / Zomato / other food delivery |
| 12 | **Tags Analysis** | Grocery/food tag breakdown |
| 13 | **Category Trend** | Growing vs shrinking categories |
| 14 | **Income vs Expense Ratio** | Savings rate this month |
| 15 | **Subscription Detective** | Detects recurring charges (same description, regular interval) |
| 16 | **Zombie Subscriptions** | Subscriptions not used in 45+ days |

### Anomaly Panel (top of Insights)
- Flags unusual expenses: transactions that are significantly above your historical average for that category
- Shows: description, category, amount, % deviation from average
- Dismissed individually · max 5 shown · history of last 20 anomalies

---

## 8. Recurring Tab

### What is Recurring?
A template for a repeating expense or income (e.g. rent, Netflix, salary). Stored once with a **next due date**. Not automatically duplicated — you add it manually when it's due.

### Lists
- **Recurring Expenses** and **Recurring Income** shown separately
- Each entry: description, amount, category, period, next due date
- Due badge: Green = upcoming · Amber = due ≤3 days · Red = overdue

### Creating a Recurring Entry
When adding any expense or income, tick **Recurring** and:
- Select period: Daily / Weekly / Bi-weekly / Monthly / Quarterly / Yearly
- Next due date is auto-calculated · override manually if needed

---

## 9. Trips Tab

Track expenses by travel trip — auto-links expenses to a trip based on date range and currency.

### Creating a Trip
Click **+ New Trip** → Name, Start Date, End Date, Currency (the currency you spent in).

### Trip Cards
Each trip shows:
- Name, date range (DD-MM-YYYY to DD-MM-YYYY), currency flag
- Total spent · number of expenses · daily average spend
- Per-day rate (total ÷ number of days)

### Linked Expenses
- Expand a trip card to see all expenses that fall within the date range AND match the trip currency
- Each row: Date · Category · Description · Amount
- Linking is automatic — no manual assignment needed

### Editing / Deleting
- Edit trip dates or name with the ✏️ button
- Delete removes the trip record only (expenses are not deleted)

---

## 10. Exchange Tab

Live currency rates and conversion reference.

### Rate Table
- All supported currencies relative to your base currency
- Columns: flag, code, name, rate (1 base = X foreign), rate (1 foreign = X base)
- Rates fetched live and cached for 6 hours

### Currencies Supported (122 total)
Includes all major world currencies plus cryptocurrency (BTC, ETH). Full list available in the Exchange tab.

**Key currencies:** INR, USD, EUR, GBP, JPY, CHF, CAD, AUD, SGD, AED, SAR, THB, CNY, HKD, MYR, KRW, ZAR, BRL, TRY, SEK, NOK, DKK, PLN, RUB, MXN, QAR, and 96 more.

### Refreshing Rates
- Click **Refresh Rates** for fresh data
- Falls back to cached rates → then built-in fallback rates if the API is unreachable
- Last-updated timestamp shown

---

## 11. Settings Tab

### Appearance
- **Dark Mode** — toggle light/dark theme (persisted)
- **Colorblind Mode** — replaces red/green with blue/orange throughout the UI

### Base Currency
- Select your primary display currency (default: INR ₹)
- All amounts across the app convert and display in this currency instantly

### Security
- **Biometric Lock** — enrol fingerprint or Face ID for a lock screen on app open
  - See [Section 18](#18-biometric-lock--otp-fallback) for full details
- **OTP Fallback** — set a backup email for OTP unlock when biometrics fail

### Incognito Mode
- Toggle the **🙈** button in the header to blur all amounts (hover/tap to reveal individually)
- See [Section 17](#17-incognito-mode)

### Safe-to-Spend
- Set monthly savings goal · Overview tab uses it to calculate daily allowance

### Exchange Rates
- Current rate status (live / cached / fallback) · manual refresh

### Recurring Reminders (Push Notifications)
- **Enable** — subscribes this device to daily 07:00 IST reminders
- **Disable** — unsubscribes this device
- See [Section 23](#23-push-notifications) for full details

### Export Data
- **Download JSON** — full backup: expenses, income, budgets, goals, contributions
- **Download CSV** — expenses only, spreadsheet-compatible

### Import Data
- Upload a V6/V7 JSON backup · duplicates skipped by fingerprint

### Migrate from V5
- Upload a V5 JSON export · all fields mapped to V6/V7 format · no duplicate risk

### Danger Zone
| Action | Deletes |
|--------|---------|
| Clear Expenses | All expense records |
| Clear Income | All income records |
| Clear All Data | Expenses + income |
| Factory Reset | Everything: expenses, income, budgets, goals, contributions, settings |

Each action requires a confirmation click.

---

## 12. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Overview tab |
| `2` | Income tab |
| `3` | Trends tab |
| `4` | Budgets tab |
| `5` | Goals tab |
| `6` | Insights tab |
| `7` | Recurring tab |
| `8` | Trips tab |
| `9` | Exchange tab |
| `N` | Open Add Expense form |
| `I` | Open Add Income form |
| `D` | Toggle Dark Mode |
| `Esc` | Close any open modal/form |

*Settings tab has no keyboard shortcut.*

---

## 13. Adding Expenses — Full Field Guide

Click **+ Expense** or press **N**. Use **📷 Scan** to pre-fill fields from a receipt photo.

### All Fields

| Field | Description | Options / Notes |
|-------|-------------|-----------------|
| **Date** | Transaction date (DD-MM-YYYY display) | Defaults to today |
| **Amount** | How much was spent | Numeric |
| **Currency** | Currency of the transaction | 122 currencies |
| **Conversion Rate** | Auto-filled from live rates | Editable; shown only for non-base currencies |
| **INR Preview** | Converted amount in base currency | Read-only |
| **Description** | What you spent on | Free text, required |
| **Category** | Spending category | 14 categories (see below) |
| **Subcategory** | Sub-type within category | 4–8 per category |
| **Expense Type** | Classification | Variable / Fixed / Luxury / Need / Want / Investment |
| **Payment Method** | How you paid | Cash / Credit Card / Debit Card / Forex Card / UPI/QR / Net Banking / Wallet / Cheque / EMI / Other |
| **UPI App** | Shown when UPI/QR selected | GPay / PhonePe / Paytm / PayZapp / BHIM / Amazon Pay / WhatsApp Pay / Cred / Slice / Other |
| **Wallet App** | Shown when Wallet selected | Amazon Pay / Paytm / PhonePe / Mobikwik / Freecharge / Ola Money / Jio Money / Other |
| **Payment Reference** | UPI transaction ID, reference number | Free text |
| **Dining App** | Shown for Food category | Swiggy / Zomato / Keta / Dineout / Grab / Blinkit / Zepto / Direct |
| **Grocery Tags** | Shown for Food category | Multi-select: Food, Dairy, Produce, Meat/Fish, Snacks, etc. |
| **Receipt / Order ID** | Reference number from receipt | Free text |
| **Notes** | Additional details | Free text |
| **Tax / GST Breakdown** | Individual tax amounts | SGST / CGST / IGST / VAT / Service Charge / Cess · collapsed by default · auto-expanded when OCR detects taxes |
| **Fuel Details** | Shown when category = Transport / Fuel | Rate per Litre (₹/L) · Quantity (Litres) · Fuel Type (Petrol/Diesel/CNG/LPG/Premium) |
| **Service Details** | Shown when category = Transport / Vehicle Maintenance (or auto-detected via scan) | **KMs at Service** — odometer reading at time of service · **Next Service at KMs** — odometer target for next service · **Next Service Date** — sets a recurring reminder (appears in Recurring tab and triggers a toast when due) |
| **Custom Color** | Override the category dot colour | 259-colour palette |
| **Budget Category** | Link to a per-category budget | Dropdown |
| **Split With** | Person you split the bill with | Free text |
| **Split Parts** | Number of ways to split | Number |
| **Recurring** | Mark as recurring template | Checkbox |
| **Period** | How often it repeats | Daily / Weekly / Bi-weekly / Monthly / Quarterly / Yearly |
| **Next Due Date** | Auto-calculated, editable | Date |

### 14 Expense Categories

| Category | Icon | Subcategories |
|----------|------|--------------|
| Food | 🍽️ | Groceries, Restaurants, Snacks, Beverages, Sweets, Takeaway |
| Transport | 🚗 | Fuel, Auto/Cab, Bus/Train, Flight, Parking, Vehicle Maintenance |
| Shopping | 🛍️ | Clothes, Electronics, Furniture, Books, Accessories, Appliances |
| Health | 💊 | Medicine, Doctor, Lab Tests, Hospital, Wellness, Dental |
| Entertainment | 🎬 | Movies, OTT/Streaming, Gaming, Events, Hobbies, Sports |
| Utilities | 💡 | Electricity, Water, Gas, Internet, Phone, Cable |
| Housing | 🏠 | Rent, EMI, Maintenance, Repairs, Housekeeping, House Maid, Pest Control, Security, Interior |
| Education | 📚 | Fees, Books, Courses, Stationery, Coaching, Exams |
| Personal | 💆 | Haircut, Skincare, Gym, Spa, Personal Care, Laundry, Dry Cleaning, Ironing, Fashion |
| Travel | ✈️ | Hotel, Sightseeing, Visa, Insurance, Souvenirs, Transport |
| Finance | 💰 | Insurance, Tax, Loan Payment, Investment, Bank Fees, Savings |
| Social | 🎉 | Gifts, Parties, Donations, Subscriptions, Events, Dining Out |
| Administrative | 🗂️ | License Renewal, Passport Renewal, Government Fees, Notary/Legal, Other Govt Fees |
| Other | 📌 | Miscellaneous, Uncategorized, Refund, Transfer |

---

## 14. Receipt Scanner (OCR)

Scan a receipt photo and automatically pre-fill the expense form. Powered by **Tesseract.js** running entirely in the browser — no image is ever uploaded to a server.

### Opening the Scanner
In the Add Expense form, tap the **📷 Scan** button in the top-right of the form header. (Not shown when editing an existing expense.)

### Single-Photo Scan
1. Tap **1 Photo**
2. **📷 Take Photo** (mobile) or **📁 Upload Receipt Image** (desktop/gallery)
3. **Crop** the image — drag the 8 handles (corners + edges) to frame the receipt
   - **Scan Selected Area** — scans only inside the crop box
   - **Scan Full Image** — skips cropping and scans the whole photo
4. Progress bar shows 0–100% while Tesseract reads the text
5. **Results screen** — review what was extracted before applying
6. Tap **Apply to Form** — fields are pre-filled; review and edit anything before saving

### Multi-Part Scan (Long Receipts)
For receipts that are too tall to photograph clearly in one shot:

1. Tap **Multi-Part** to switch mode
2. Photograph the **top section** → crop it → tap **Add Another Part →** (the image is saved with a numbered thumbnail)
3. Photograph the **bottom section** → crop it → tap **Add Another Part →** again if there are more sections
4. Tap **Scan N Parts** (on the crop screen) or **Scan N Collected Parts Now** (on the pick screen) to start OCR
5. OCR runs on each part in sequence; progress bar divides evenly across all parts
6. All text is combined in order and parsed as a single document

**Tips for multi-part:**
- Start part 2 slightly above where part 1 ended — a small overlap is better than a gap
- Each collected part shows as a numbered thumbnail; tap **✕** to remove and reshoot a bad frame
- No hard limit on the number of parts — 3, 4, or 5 photos all work

### What the Scanner Extracts

| Field | How it's detected |
|-------|------------------|
| **Amount** | Looks near "Total", "Bill Total", "Grand Total", "Sale Amount" keywords first; then any ₹/Rs/¥/€/£ symbol |
| **Date** | 8 date format patterns (DD/MM/YYYY, DD-MM-YY, ISO, "12 May 2026", "May 12, 2026", etc.) |
| **Merchant / Description** | All-caps lines in the top 4 lines (skipping company registration suffixes like PVT LTD); falls back to highest-scoring line |
| **Category + Subcategory** | 80+ merchant keyword map (Swiggy → Food/Takeaway, HP Service → Transport/Fuel, etc.); then content detection (food keywords, fuel keywords) |
| **Payment Method** | Keywords: Cash, UPI, GPay, PhonePe, Paytm, VISA, MasterCard, RuPay, Debit Card, MOP CARD, Net Banking |
| **SGST / CGST / IGST / VAT / Service Charge / Cess** | Line-by-line regex for each tax type |
| **Fuel Rate per Litre** | "Rate Per Litre 103 80" — space-as-decimal normalised to 103.80, rounded to 2dp |
| **Fuel Quantity** | "Sale Quantity 19 36" — normalised to 19.36, rounded to 2dp |
| **Fuel Type** | "Product Name Petrol / Diesel / CNG / LPG" |
| **KMs at Service** | Odometer / KMs / Odo keywords followed by 3–7 digit number |
| **Next Service at KMs** | "Next Service at 15000 km" or similar patterns |
| **Next Service Date** | "Next Due" / "Next Service Date" followed by a date — sets recurring reminder |

### Results Screen
- Each extracted field shows a **✓** (found with confidence) or **?** (not found / uncertain)
- **Tax chip row** — individual chips for each tax type + amounts
- **Fuel chip row** — rate, litres, fuel type
- **Show raw OCR text ▼** — reveals the full text Tesseract extracted for debugging
- **Re-scan** — go back and try again
- **Apply to Form** — pre-fills all matching fields; tax section auto-expands; fuel section appears if Transport/Fuel; service details section appears if Transport/Vehicle Maintenance

### Important Notes
- **First scan** downloads Tesseract's English language model (~10 MB from CDN); cached in browser IndexedDB after that — subsequent scans are fast
- Works best with **sharp, well-lit photos** where text is clearly readable
- Handwritten text is not supported — printed receipts only
- All processing is client-side; receipt images never leave your device

---

## 15. Adding Income — Full Field Guide

Click **+ Income** or press **I**.

| Field | Options |
|-------|---------|
| Date | Defaults to today |
| Description | Free text |
| Amount + Currency | 122 currencies |
| Conversion Rate | Auto-filled, editable |
| Source | Salary / Freelance / Business / Rental / Dividends / Interest / Bonus / Gift / Refund / Side Income / Other |
| Payment Method | All methods supported |
| Notes | Free text |
| Recurring | Checkbox + period |

---

## 16. Multi-Currency Support

- Every expense and income can be in any of **122 currencies**
- The app stores the **base-currency equivalent** alongside the original amount
- All totals, charts, and summaries show in your chosen base currency
- Conversion rate is auto-filled from cached live rates; manually editable
- **Historical rates** — for past-dated expenses, the rate on that exact date is fetched from the Frankfurter API and cached
- Exchange rates cached 6 hours; manual refresh in Exchange tab or Settings
- **Fallback chain:** live API → cached rates → built-in static rates (never shows a blank)

---

## 17. Incognito Mode

Blurs all monetary amounts throughout the app so sensitive figures aren't visible to bystanders.

### Toggling
- Tap the **🙈** button in the top-right header area
- All amounts immediately blur across all tabs and lists
- Tap 🙈 again to reveal all

### Revealing Individual Amounts
- While in incognito mode, hover (desktop) or tap (mobile) any blurred amount to reveal just that value temporarily

### Persistence
- Incognito state is saved to `localStorage` — stays on until you toggle it off, even across page reloads

---

## 18. Biometric Lock & OTP Fallback

Protects the app with fingerprint / Face ID verification on every open.

### Enrolment
1. **Settings → Security → Set Up Biometric**
2. Enter your **backup email** (for OTP recovery — must be different from your login email)
3. Follow the browser prompt to register your fingerprint or Face ID
4. A confirmation screen shows enrolment is active

### How the Lock Screen Works
- Every time you open the app (or return after a period away), the lock screen appears
- Tap **Verify with Biometrics** → authenticate with your device's fingerprint/Face ID
- On success, the app unlocks instantly

### OTP Fallback
If biometrics fail or aren't available:
1. Tap **Use Email Code**
2. A 6-digit OTP is sent to your backup email
3. Enter the code within 15 minutes
4. After 3 incorrect OTP attempts, the account locks for 15 minutes

### Per-Device Independence
- Each device enrols separately
- One device's biometric credential does not affect other devices
- Removing biometrics on one device only removes it from that device

### Removing Biometrics
**Settings → Security → Remove** — removes credential from this device only.

---

## 19. Anomaly Detection

Automatically flags expenses that are unusually high for their category.

### How It Works
- When a new expense is saved, it is compared to all your past expenses in the same category
- If the new amount is significantly above your historical average (based on deviation), it is flagged
- The anomaly panel appears at the top of the Insights tab

### Anomaly Panel
- Shows up to 5 most recent anomalies
- Each row: date, description, category, % above average
- Dismiss individually with the ✕ button
- History of last 20 anomalies retained

### Persistence
- Checked anomaly IDs stored in `localStorage` (max 500) — dismissed anomalies don't reappear

---

## 20. Conflict Resolution

When the same expense is edited on two devices simultaneously (optimistic locking), a conflict is detected.

### What triggers a conflict
- You edit expense A on your phone while it is also edited on your desktop
- The second save detects that the database version has changed since you loaded the record

### Conflict Modal
- Appears automatically when a conflict is detected
- Shows a **side-by-side diff** of your local version vs the server version
- Three resolution modes:
  - **Keep Mine** — your local changes win
  - **Keep Theirs** — the server version wins
  - **Merge** — per-field radio buttons; choose which version of each field to keep
- A conflict badge appears in the header when unresolved conflicts exist

### Conflict Badge
- Header shows a count of pending conflicts
- Tap to open the conflict resolution modal for the next conflict in the queue

---

## 21. Offline Mode

The app works fully offline. No data is lost when connectivity drops.

- **Reading** — last-loaded data is available; charts and lists work normally
- **Writing** — changes go to a local retry queue and appear in the UI immediately (optimistic update)
- **Reconnection** — queued changes sync to Supabase automatically in dependency order
- **Offline banner** — amber banner: "You're offline · N changes queued"
- **Syncing banner** — blue banner while queue drains after reconnection
- **⏳ badge** — on items pending cloud confirmation
- **Max retries** — items failing 5 times are dropped to prevent loops

---

## 22. Real-Time Sync

Changes on one device appear on all other open devices within ~1 second.

### Sync Status Indicator
| Indicator | Meaning |
|-----------|---------|
| 🟢 Pulsing green | Live connection active |
| 🟡 Spinning amber | Connecting / reconnecting |
| 🔴 Red | Sync error (data still saves locally) |
| ⚫ Gray | Offline |

### What syncs in real time
Expenses · Income · Budgets · Goals · Goal contributions · Trips

---

## 23. Push Notifications

Daily reminders for recurring expenses due within 3 days.

### Enabling
1. **Settings → Recurring Reminders → Enable**
2. Approve the browser permission prompt

### How It Works
- Fire at **07:00 AM IST** daily (01:30 UTC cron job on Vercel)
- Shows: description, amount, days until due
- Tapping opens the app to the Recurring tab
- Works when the browser/app is closed

### Browser Compatibility
| Browser | Notes |
|---------|-------|
| Chrome (Android/PC) | Works out of the box |
| Brave | Enable "Use Google services for push messaging" in `brave://settings/privacy` |
| Firefox (desktop) | Works |
| Safari / iOS | Requires iOS 16.4+ · app must be installed as PWA (Add to Home Screen) |

---

## 24. PWA — Install on Device

### Android (Chrome / Brave)
Tap three-dot menu → **Add to Home Screen** or **Install App**

### iPhone / iPad (Safari only)
Share button → **Add to Home Screen** · Requires iOS 16.4+ for push notifications

### Windows / Mac (Chrome / Edge)
Install icon in the address bar → **Install**

### PWA Features
- Works offline (service worker caches the app shell)
- Auto-updates on new deployment
- Full screen, no browser chrome
- Push notifications (when enabled)
- Installable icon on home screen / taskbar

---

## 25. Data Migration from V5

### Steps
1. Open the old V5 HTML file in a browser
2. **Settings → Export Data → Download JSON**
3. In V7: **Settings → Migrate from V5 → Choose V5 File**
4. Select the JSON file — migration runs automatically

### What migrates
- All expenses (categories, tags, notes, recurring flags, amounts, dates)
- All income records
- Fingerprints preserved — re-running the migration is safe (no duplicates)

### What does NOT migrate
- Budgets · Goals · App settings (re-set these in V7)

---

## 26. Export & Import

### Export JSON
- Full backup: expenses, income, budgets, goals, contributions
- Use for: archiving, moving to another device, backup before changes

### Export CSV
- Expenses only, spreadsheet-compatible (Excel / Google Sheets)
- Columns: date, description, amount, currency, category, subcategory, payment method, tags, notes

### Import JSON (V7 backup)
- Upload a previously exported V7 JSON file
- Duplicates detected by fingerprint hash and skipped automatically

---

## 27. Danger Zone

All Danger Zone actions are **permanent and cannot be undone**. Each requires a confirmation click.

| Action | What is deleted |
|--------|----------------|
| Clear Expenses | All expense records |
| Clear Income | All income records |
| Clear All Data | All expenses + income |
| Factory Reset | Everything: expenses, income, budgets, goals, contributions, local settings |

---

## 28. Technical Reference

### Architecture
| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 19 (SPA, no SSR) |
| Database | Supabase Postgres with Row-Level Security |
| Auth | Magic-link email via Supabase Auth (no passwords) |
| Session | HttpOnly cookie (`sb_session`) — no auth tokens in localStorage |
| Hosting | Vercel CDN (global edge) |
| Offline | Service worker (Workbox) + localStorage retry queue |
| Real-time | Supabase Realtime (WebSocket, `postgres_changes`) |
| Push | Web Push API + VAPID + Vercel serverless cron |
| OCR | Tesseract.js v7 (client-side WASM, English model) |
| Biometrics | WebAuthn (`@simplewebauthn/browser` + `@simplewebauthn/server` v13) |

### Date Format
All dates are displayed as **DD-MM-YYYY** throughout the app. Dates are stored in ISO `YYYY-MM-DD` format in the database for correct sorting and filtering.

### Expense Schema (all fields stored per expense)

`id` · `date` · `description` · `amount` · `currency` · `conversionRate` · `amountINR` · `category` · `subcategory` · `expenseType` · `paymentMethod` · `paymentDescription` · `diningApp` · `tags[]` · `notes` · `customColor` · `budgetCategory` · `isRecurring` · `recurringPeriod` · `nextDueDate` · `splitWith` · `splitParts` · `receiptRef` · `taxAmount` · `taxBreakdown{}` · `fuelRate` · `fuelQuantity` · `fuelType` · `_fp` (fingerprint) · `migratedFrom` · `importedFrom` · `version` · `row_version`

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `expenses` | All expense records |
| `income` | All income records |
| `budgets` | One row per user — daily/weekly/monthly/category limits |
| `goals` | Savings goals |
| `goal_contributions` | Individual contributions toward goals |
| `trips` | Travel trip records |
| `biometric_credentials` | WebAuthn credential metadata per user/device |
| `registration_challenges` | Temporary WebAuthn registration challenge storage |
| `push_subscriptions` | Device push subscription endpoints |

### Security Headers (Vercel)
- `Content-Security-Policy` — restricts scripts to self + jsDelivr (Tesseract); blocks framing
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self)` — camera allowed only for receipt scanning

### Cron Jobs (Vercel)
| Job | Schedule | What it does |
|-----|----------|-------------|
| `send-reminders` | 01:30 UTC daily | Sends push notifications for recurring expenses due within 3 days |
| `maintenance` | 02:00 UTC Sundays | Cleans up expired challenge records and stale data |

### localStorage Keys
| Key | Stores |
|-----|--------|
| `et_v6_dark` | Dark mode state |
| `et_v6_cb` | Colorblind mode state |
| `et_v6_rates` | Cached exchange rates (6h TTL) |
| `et_v6_base` | Base currency selection |
| `et_v6_retry_queue` | Offline operation queue |
| `et_v6_anomaly_checked` | IDs of dismissed anomalies (max 500) |
| `et_v6_credential_id` | This device's WebAuthn credential ID |
| `et_v6_backup_email` | Backup email for OTP unlock |

### Production URLs
- **App:** `https://expense-tracker-v6.vercel.app`
- **GitHub:** `https://github.com/aguiarlindsey/expense-tracker-v6`
- **Supabase:** `https://tcqwjpirlmjssrowknlm.supabase.co`
