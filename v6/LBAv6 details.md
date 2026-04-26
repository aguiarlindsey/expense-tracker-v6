# LBAv6 — Full Feature Reference

**Expense Tracker V6** · `https://expense-tracker-v6.vercel.app`  
**Version:** v6.7.0 · **Built:** Vite + React + Supabase · **Deployed:** Vercel

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
9. [Exchange Tab](#9-exchange-tab)
10. [Settings Tab](#10-settings-tab)
11. [Keyboard Shortcuts](#11-keyboard-shortcuts)
12. [Adding Expenses — Full Field Guide](#12-adding-expenses--full-field-guide)
13. [Adding Income — Full Field Guide](#13-adding-income--full-field-guide)
14. [Multi-Currency Support](#14-multi-currency-support)
15. [Offline Mode](#15-offline-mode)
16. [Real-Time Sync](#16-real-time-sync)
17. [Push Notifications](#17-push-notifications)
18. [PWA — Install on Device](#18-pwa--install-on-device)
19. [Data Migration from V5](#19-data-migration-from-v5)
20. [Export & Import](#20-export--import)
21. [Danger Zone](#21-danger-zone)
22. [Technical Reference](#22-technical-reference)

---

## 1. Getting Started

### Login
- Go to `https://expense-tracker-v6.vercel.app`
- Enter your email address and click **Send Magic Link**
- Open the email and click the link — you are logged in automatically
- No password required; the magic link expires after 1 use

### First-time setup (recommended)
1. Go to **Settings** → set your **Base Currency** (default: INR)
2. Go to **Settings** → **Budgets** → set monthly/daily/weekly spending limits
3. Go to **Settings** → **Recurring Reminders** → click **Enable** to turn on push notifications
4. If migrating from the old V5 app → **Settings** → **Migrate from V5**

---

## 2. Overview Tab

The main dashboard. Shows a snapshot of your financial health for the current month.

### Summary Cards (top row)
| Card | What it shows |
|------|--------------|
| **This Month** | Total expenses in the current calendar month (in base currency) |
| **Income** | Total income recorded this month |
| **Balance** | Income minus expenses this month |
| **Daily Avg** | Average daily spend this month |
| **Daily Allowance** | Safe-to-spend daily budget (see Safe-to-Spend below) |

### Pie Chart
- Shows spending split by category for the current month
- Hover/tap a slice to see the category name and amount
- Updates live as you add or delete expenses

### Recent Expenses List
- Shows your most recent expenses
- Each item shows: date, description, amount, category icon, payment method, tags
- **🔄 badge** = recurring expense
- **⏳ badge** = pending sync (offline change not yet confirmed to cloud)
- Tap the **trash icon** to delete
- Tap the **pencil icon** to edit

### Upcoming Recurring Banner
- Appears at the top when you have recurring expenses due within 7 days
- Shows each item as a chip with days-until-due
- Color: red = due today/tomorrow, amber = due in 2–3 days, blue = due in 4–7 days
- Dismiss with the ✕ button

### Month-End Forecast Panel
- Projects your total spend by end of month based on current daily rate
- Shows: projected total, daily rate, trend vs previous month (↑ or ↓)
- Updates every time an expense is added or deleted

### Safe-to-Spend
- Formula: `(this month's income − fixed expenses − savings goal) ÷ remaining days`
- Colour coded: green = healthy, amber = tight, red = over budget
- Configure the savings goal amount in **Settings → Safe-to-Spend**

---

## 3. Income Tab

Records all income sources.

### Adding Income
Click the **+ Income** button (or press **I**). Fields:
- **Date** — defaults to today
- **Description** — e.g. "Salary", "Freelance Project"
- **Amount + Currency** — supports all 27 currencies
- **Source** — Salary / Freelance / Business / Rental / Dividends / Interest / Bonus / Gift / Refund / Side Income / Other
- **Payment Method** — how the money was received
- **Notes** — optional free text
- **Recurring** — tick to mark as recurring income (e.g. monthly salary); set period

### Income List
- Sorted by date descending
- Each entry shows description, amount in base currency, source, payment method
- Edit (pencil) or delete (trash) any entry
- Recurring income marked with 🔄 badge

### Income Summary Cards
- Total income (all time)
- This month's income
- Average monthly income
- Top income source

---

## 4. Trends Tab

Historical analysis of spending patterns.

### Heatmap Calendar
- 90-day grid showing daily spend intensity
- Darker green = higher spend day
- Hover/tap a cell to see the exact amount for that day

### Monthly Bar Chart
- Shows total expenses per month for the last 12 months
- Bars colored by category breakdown

### Month-over-Month Comparison Table
- Side-by-side: this month vs last month vs same month last year
- Columns: Month / Expenses / vs Prev / Income / Saved / Transactions

### Yearly Comparison Table
- Year-by-year breakdown: total expenses, income, amount saved, transaction count

---

## 5. Budgets Tab

Set spending limits and track progress in real time.

### Budget Types
| Type | How it works |
|------|-------------|
| **Daily** | Resets every day at midnight |
| **Weekly** | Resets every Monday |
| **Monthly** | Resets on the 1st of each month |
| **Per Category** | Set a limit for any individual category (e.g. Food: ₹8,000/month) |

### Budget Bars
- Each bar shows: spent / limit with percentage fill
- Green = under 50%, Amber = 50–80%, Red = 80–100%, Dark red = over limit

### Toast Alerts
- **50% alert** — yellow ⚡ toast when you hit half your budget
- **80% alert** — orange ⚠ toast when approaching the limit
- **100% alert** — red 🚨 toast when budget is exceeded
- Toasts auto-dismiss after 6 seconds

### Setting Budgets
- Enter amounts directly in the budget input fields
- Changes save to Supabase instantly
- Visible across all your devices in real time

---

## 6. Goals Tab

Track savings goals and contributions toward them.

### Creating a Goal
Click **+ New Goal**. Fields:
- **Name** — e.g. "Emergency Fund", "Vacation"
- **Target Amount** — the total you want to save
- **Target Date** — optional deadline
- **Icon** — emoji icon for the goal (default 🎯)
- **Note** — optional description

### Adding Contributions
- Click **+ Add** on any goal card
- Enter the date, amount, and an optional note
- Contributions accumulate toward the goal total

### Goal Progress Bar
- Shows amount saved / target with percentage
- Milestone toasts fire at 25%, 50%, 75%, and 100% completion
- 🎉 confetti animation on reaching 100%

### Deleting a Goal
- Click the trash icon on the goal card
- Deletes the goal and all its contributions

---

## 7. Insights Tab

16 analytical insight cards to understand your spending behaviour.

### Insight Cards
1. **Top Spending Category** — your biggest category this month
2. **Biggest Single Expense** — largest transaction this month
3. **Most Used Payment Method** — frequency breakdown
4. **Average Transaction Size** — mean expense amount
5. **Weekend vs Weekday Spend** — comparison of spending patterns
6. **Expense Type Breakdown** — variable / fixed / luxury / need / want / investment
7. **Day-of-Week Chart** — vertical bar chart showing which day you spend most
8. **Recurring Expenses Summary** — count and combined value of recurring templates
9. **Split Expenses** — expenses shared with others
10. **Month-over-Month Delta** — % change in spending vs last month
11. **Dining App Breakdown** — Swiggy / Zomato / other food delivery spend
12. **Tags Analysis** — breakdown by grocery/food tags
13. **Category Trend** — which categories are growing vs shrinking
14. **Income vs Expense Ratio** — savings rate this month
15. **Subscription Detective** — detects recurring charges that look like subscriptions
16. **Zombie Subscriptions** — subscriptions not used in 45+ days

### Subscription Detective
- Automatically detects payments that appear monthly/regularly (same description, similar amount)
- Flags **zombies**: subscriptions with no recent transaction (45+ days)
- Flags **price creep**: subscriptions where the amount has increased >10%

---

## 8. Recurring Tab

Manage all recurring expenses and income templates.

### What is a Recurring Entry?
- A template that represents a repeating expense/income (e.g. rent, Netflix, salary)
- Stored once with a **next due date** — not automatically duplicated
- When a recurring expense comes due, you add it manually as a new transaction

### Recurring Expense List
- Shows all expenses marked as recurring
- Each entry shows: description, amount, category, period (daily/weekly/monthly etc.), next due date
- **Due badge**: green = upcoming, amber = due in ≤3 days, red = overdue

### Recurring Income List
- Same layout for recurring income sources

### How to Create a Recurring Entry
When adding an expense or income, tick the **Recurring** checkbox and:
- Select the **period** (daily / weekly / bi-weekly / monthly / quarterly / yearly)
- The **next due date** is auto-calculated from the entry date and period
- You can override the next due date manually

---

## 9. Exchange Tab

Live currency exchange rates and conversion reference.

### Rate Table
- Shows exchange rates for all 27 supported currencies relative to your base currency
- Rates are fetched live from an external API and cached for 6 hours
- Each row: flag, currency code, currency name, rate (1 base unit = X foreign), rate (1 foreign = X base)

### Refreshing Rates
- Click **Refresh Rates** to fetch new rates immediately
- Last updated timestamp shown next to the refresh button

### Currencies Supported (27 total)
**Major:** INR, USD, EUR, GBP, JPY, CHF, CAD, AUD  
**Asia-Pacific:** SGD, MYR, THB, CNY, HKD, KRW  
**Middle East:** AED, SAR, QAR, TRY  
**Europe:** SEK, NOK, DKK, PLN, RUB  
**Americas:** BRL, MXN  
**Africa:** ZAR  
**Alternative Assets:** BTC, ETH

---

## 10. Settings Tab

### Appearance
- **Dark Mode** — toggle between light and dark theme (persisted)
- **Colorblind Mode** — replaces red/green with blue/orange throughout the entire UI

### Base Currency
- Select your primary display currency (default: INR ₹)
- All amounts across the app are converted and displayed in this currency
- Changing it takes effect immediately everywhere

### Data Summary
- Live count of: expenses, income records, goals, contributions stored in your account

### Safe-to-Spend
- Set your monthly **savings goal** amount
- The Overview tab uses this to calculate your daily allowance

### Exchange Rates
- Shows current rate status (live / cached / stale)
- Manual refresh button

### Recurring Reminders (Push Notifications)
- **Enable** — subscribes this browser/device to daily push notifications
- **Disable** — unsubscribes this device
- Notifications fire at 07:00 IST daily when a recurring expense is due within 3 days
- Works even when the app is closed (requires browser permission)

### Export Data
- **Download JSON** — full backup of all expenses, income, budgets, goals, contributions
- **Download CSV** — expenses only, spreadsheet-compatible

### Import Data
- Upload a V6 JSON backup file
- Duplicates detected by content fingerprint and skipped automatically
- Safe to run multiple times

### Migrate from V5
- Upload a JSON export from the old single-file V5 app
- Maps all V5 fields to V6 format automatically
- Preserves original fingerprints — safe to run multiple times, no duplicates created
- **How to export from V5:** Open the old HTML file → Settings → Export Data → Download JSON

### Danger Zone
| Action | What it does |
|--------|-------------|
| **Clear Expenses** | Deletes all expense records permanently |
| **Clear Income** | Deletes all income records permanently |
| **Clear All Data** | Deletes all expenses and income |
| **Factory Reset** | Deletes everything: expenses, income, budgets, goals, contributions, and all app settings |

Each action requires a confirmation click before executing.

---

## 11. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Go to Overview tab |
| `2` | Go to Income tab |
| `3` | Go to Trends tab |
| `4` | Go to Budgets tab |
| `5` | Go to Goals tab |
| `6` | Go to Insights tab |
| `7` | Go to Recurring tab |
| `8` | Go to Exchange tab |
| `9` | Go to Settings tab |
| `N` | Open Add Expense form |
| `I` | Open Add Income form |
| `D` | Toggle Dark Mode |
| `Esc` | Close any open modal/form |

---

## 12. Adding Expenses — Full Field Guide

Click **+ Expense** (or press **N**) to open the expense form.

| Field | Description | Options |
|-------|-------------|---------|
| **Date** | Transaction date | Defaults to today |
| **Description** | What you spent on | Free text |
| **Amount** | How much | Numeric |
| **Currency** | Currency of the transaction | 27 currencies |
| **Conversion Rate** | Auto-filled from live rates when currency ≠ base | Editable |
| **INR Preview** | Shows converted amount in base currency | Read-only |
| **Category** | Spending category | 14 categories (see below) |
| **Subcategory** | Sub-type within category | 4–6 per category |
| **Expense Type** | Classification | Variable / Fixed / Luxury / Need / Want / Investment |
| **Payment Method** | How you paid | Cash / Credit Card / Debit Card / UPI/QR / Net Banking / Wallet / Cheque / EMI / Other |
| **UPI App** | (if UPI/QR selected) | GPay / PhonePe / Paytm / PayZapp / BHIM / Amazon Pay / WhatsApp Pay / Cred / Slice / Other |
| **Wallet App** | (if Wallet selected) | Amazon Pay / Paytm / PhonePe / Mobikwik / Freecharge / Ola Money / Jio Money / Other |
| **Payment Reference** | UPI transaction ID or reference number | Free text |
| **Dining App** | (if Food category) | Swiggy / Zomato / Keta / Dineout / EatSure / Blinkit / Zepto / Direct |
| **Grocery Tags** | (if Food category) | Multi-select: Food, Dairy, Produce, Meat/Fish, Snacks, etc. |
| **Tags** | Custom free labels | Multi-select chips |
| **Notes** | Additional details | Free text |
| **Custom Color** | Override the category color | 259-colour palette |
| **Budget Category** | Link to a per-category budget | Dropdown |
| **Split With** | Person you split the bill with | Free text |
| **Split Parts** | Number of ways to split | Number |
| **Receipt / Order ID** | Reference number | Free text |
| **Recurring** | Mark as a recurring template | Checkbox |
| **Recurring Period** | How often it repeats | Daily / Weekly / Bi-weekly / Monthly / Quarterly / Yearly |
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
| Housing | 🏠 | Rent, EMI, Maintenance, Repairs, Security, Interior |
| Education | 📚 | Fees, Books, Courses, Stationery, Coaching, Exams |
| Personal | 💆 | Haircut, Skincare, Gym, Spa, Personal Care, Fashion |
| Travel | ✈️ | Hotel, Sightseeing, Visa, Insurance, Souvenirs, Transport |
| Finance | 💰 | Insurance, Tax, Loan Payment, Investment, Bank Fees, Savings |
| Social | 🎉 | Gifts, Parties, Donations, Subscriptions, Events, Dining Out |
| Administrative | 🗂️ | License Renewal, Passport Renewal, Government Fees, Notary/Legal |
| Other | 📌 | Miscellaneous, Uncategorized, Refund, Transfer |

---

## 13. Adding Income — Full Field Guide

Click **+ Income** (or press **I**).

| Field | Description | Options |
|-------|-------------|---------|
| **Date** | When the income was received | Defaults to today |
| **Description** | What the income is for | Free text |
| **Amount** | How much | Numeric |
| **Currency** | Currency received | 27 currencies |
| **Conversion Rate** | Auto-filled from live rates | Editable |
| **Source** | Where it came from | Salary / Freelance / Business / Rental / Dividends / Interest / Bonus / Gift / Refund / Side Income / Other |
| **Payment Method** | How it was received | Net Banking / UPI/QR / Cash / Cheque / etc. |
| **Notes** | Optional details | Free text |
| **Recurring** | Mark as recurring | Checkbox |
| **Recurring Period** | How often | Daily / Weekly / Bi-weekly / Monthly / Quarterly / Yearly |

---

## 14. Multi-Currency Support

- Every expense and income entry can be in any of 27 currencies
- The app always stores the **INR equivalent** (`amountINR`) alongside the original amount
- All totals, charts, and summaries display in your chosen **base currency**
- When you select a non-base currency, the conversion rate is auto-filled from cached live rates
- You can manually override the conversion rate if needed
- Exchange rates are cached for 6 hours; refresh manually in the Exchange tab or Settings

---

## 15. Offline Mode

The app works fully offline. Here's what happens:

- **Reading data** — all data loaded at last session is available; no new data loads until reconnection
- **Adding/editing/deleting** — changes are saved to a local **retry queue** and applied optimistically to the UI immediately
- **Reconnection** — queued changes sync to Supabase automatically the moment you come back online
- **Offline banner** — amber banner at the top shows "You're offline · N changes queued"
- **Syncing banner** — blue banner shows while the queue is draining after reconnection
- **Pending indicator** — ⏳ icon on items that haven't been confirmed to the cloud yet
- **Max retries** — items that fail 5 times are dropped from the queue to prevent infinite loops

---

## 16. Real-Time Sync

Changes made on one device appear on all other open devices within ~1 second.

- A small **pulsing green dot** in the top-right header shows the live sync status
  - 🟢 Pulsing green = live and connected
  - 🟡 Spinning amber = connecting
  - 🔴 Red = sync error (changes still save locally)
  - ⚫ Gray = offline
- Works across browser tabs, phone, desktop PWA simultaneously
- No page refresh needed — data updates appear automatically

### What syncs in real time
- Expenses (add, edit, delete)
- Income (add, edit, delete)
- Budgets (any change)
- Goals (add, delete)
- Goal contributions (add, delete)

---

## 17. Push Notifications

Daily reminders for recurring expenses due within 3 days.

### Enabling
1. **Settings → Recurring Reminders → Enable**
2. Allow the browser permission prompt
3. Status changes to "Active — you will receive daily reminders"

### How it works
- Notifications fire at **07:00 AM IST** every day
- If you have a recurring expense due within 3 days, you receive a push notification
- Notification shows: description, amount, how many days until due
- Tapping the notification opens the app directly to the **Recurring tab**
- Works even when the browser/app is closed

### Per-device subscriptions
- Each device/browser subscribes independently
- Enable on phone + desktop separately to get notifications on both
- Disable per-device from Settings

### Browser compatibility
- **Chrome** (PC and Android): works out of the box
- **Brave**: enable "Use Google services for push messaging" in Brave settings (`brave://settings/privacy`)
- **Firefox**: works on desktop
- **Safari/iOS**: requires iOS 16.4+ and app must be installed as PWA (added to Home Screen)

---

## 18. PWA — Install on Device

The app can be installed like a native app on any device.

### Android (Chrome or Brave)
1. Open the app in browser
2. Tap the three-dot menu → **Add to Home Screen** (or **Install App**)
3. The app opens in standalone mode (no browser chrome)

### iPhone/iPad (Safari only)
1. Open the app in Safari
2. Tap the **Share** button → **Add to Home Screen**
3. Requires iOS 16.4+ for push notification support

### Windows/Mac (Chrome or Edge)
1. Look for the install icon in the browser address bar (monitor icon)
2. Click it → **Install**

### PWA Features
- Works offline (service worker caches the app shell)
- Auto-updates when a new version is deployed (no manual refresh needed)
- Full screen, no browser chrome
- Installable icon on home screen / taskbar
- Push notifications (when enabled)

---

## 19. Data Migration from V5

If you used the old single-file HTML version of the app, you can import all your history into V6.

### Steps
1. Open the old V5 HTML file in a browser
2. Go to **Settings → Export Data → Download JSON**
3. In V6, go to **Settings → Migrate from V5 → Choose V5 File**
4. Select the JSON file you downloaded
5. The migration runs automatically

### What gets migrated
- All expenses (with categories, tags, notes, recurring flags, etc.)
- All income records
- Fingerprints are preserved — re-running the migration won't create duplicates

### What does NOT migrate
- Budgets (re-set these in V6 Budgets tab)
- Goals (re-create these in V6 Goals tab)
- App settings (dark mode, base currency — re-set in Settings)

---

## 20. Export & Import

### Export JSON
- Full backup of all your data: expenses, income, budgets, goals, contributions
- Use for: backup, moving to another device, archiving

### Export CSV
- Expenses only, in spreadsheet format
- Compatible with Excel, Google Sheets
- Columns: date, description, amount, currency, category, subcategory, payment method, tags, notes

### Import JSON (V6 backup)
- Upload a previously exported V6 JSON file
- Duplicates are detected by content fingerprint and automatically skipped
- Use for: restoring a backup, merging data from another account

---

## 21. Danger Zone

All actions in the Danger Zone are **permanent and cannot be undone**. Each requires a confirmation click.

| Action | What is deleted |
|--------|----------------|
| Clear Expenses | All expense records |
| Clear Income | All income records |
| Clear All Data | All expenses + income |
| Factory Reset | Everything: expenses, income, budgets, goals, contributions, local settings |

---

## 22. Technical Reference

### Architecture
- **Frontend:** Vite + React 18 (single-page app, no SSR)
- **Database:** Supabase Postgres with Row-Level Security (each user sees only their own data)
- **Auth:** Magic-link email via Supabase Auth (no passwords)
- **Hosting:** Vercel CDN (global edge network)
- **Offline:** Service worker (Workbox) + localStorage retry queue
- **Real-time:** Supabase Realtime (WebSocket, `postgres_changes` subscription)
- **Push:** Web Push API + VAPID + Vercel serverless cron function

### Data Storage
- All data stored in Supabase Postgres — your data is in the cloud, not just your device
- Settings (dark mode, base currency, colorblind mode) stored in browser `localStorage`
- Exchange rates cached in `localStorage` for 6 hours (`et_v6_rates`)
- Offline retry queue stored in `localStorage` (`et_v6_retry_queue`)

### Security
- Row-Level Security on all 5 tables — database enforces that users can only read/write their own data
- Auth tokens managed by Supabase JS client, stored in `localStorage`
- No passwords stored anywhere
- `.env` file (containing Supabase keys) is gitignored and never committed

### Expense Schema (all fields stored per expense)
`id` · `date` · `description` · `amount` · `currency` · `conversionRate` · `amountINR` · `category` · `subcategory` · `expenseType` · `paymentMethod` · `paymentDescription` · `diningApp` · `tags[]` · `notes` · `customColor` · `budgetCategory` · `isRecurring` · `recurringPeriod` · `nextDueDate` · `splitWith` · `splitParts` · `receiptRef` · `_fp` (fingerprint) · `migratedFrom` · `importedFrom` · `version`

### Supabase Tables
| Table | Purpose |
|-------|---------|
| `expenses` | All expense records |
| `income` | All income records |
| `budgets` | One row per user — daily/weekly/monthly/category budgets |
| `goals` | Savings goals |
| `goal_contributions` | Individual contributions toward goals |
| `push_subscriptions` | Device push subscription endpoints |

### Production URLs
- **App:** `https://expense-tracker-v6.vercel.app`
- **GitHub:** `https://github.com/aguiarlindsey/expense-tracker-v6`
- **Supabase:** `https://tcqwjpirlmjssrowknlm.supabase.co`
