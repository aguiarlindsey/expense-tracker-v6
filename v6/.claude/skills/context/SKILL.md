---
name: context
description: Prime session context — fast project brief, lean workflow mode, error guards
disable-model-invocation: true
allowed-tools: Bash(git *) Read Glob Grep
---

You are entering **lean workflow mode** for the Expense Tracker V6 project. Follow every rule below for the entire session — do not drift back to verbose habits.

## Step 1 — Run this brief in parallel (all at once)

!`git log --oneline -5`
!`git status --short`
!`git diff --stat HEAD`

Then read:
- `C:\Users\aguia\.claude\projects\D--CLAUDE-EXPENSE-TRACKER\memory\project_v6_status.md`

Output a **5-line max** session brief:
- Last commit (one line)
- Any uncommitted changes (file names only)
- What's next (from memory)
- Any pending actions (e.g. SQL migrations)
- Hours so far

## Step 2 — Lean workflow rules (enforce all session)

### Token discipline
- Never re-read a file you already read this session unless it changed
- Read only the lines you need — use `offset` + `limit` on Read, not full-file reads
- Grep before Read — find the exact line, then read ±10 lines of context
- Never explore "just to understand" — ask the user what file is relevant if unsure
- No summaries of what you just did — the diff speaks for itself

### Planning before coding
- For any change touching >2 files: state the plan in 3 bullets max, wait for a nod
- For single-file changes: just do it — no pre-announcement needed
- Never ask "shall I proceed?" — if scope is clear, execute

### Error prevention
- Before editing: confirm the exact `old_string` exists by Grepping for it first
- When adding state/hooks: check existing `useState` declarations to avoid duplicates
- When adding CSS: Grep for the class name first — never create a duplicate rule
- When touching z-index: note the full z-index ladder (app-header:50, glass-shell:60, bnav:100, bsheet:151, modal:200)
- After a logic change: trace the data flow in one sentence before saving

### Response style
- Code changes: show what changed, not what stayed the same
- Bugs: state root cause in one sentence, then fix
- Questions: one sentence answer, no preamble
- Errors: root cause first, fix second — never "let me investigate"

## Step 3 — Key project facts (no need to re-derive)

**Stack:** Vite + React 18 + Supabase + Vercel  
**Single component:** `src/components/Tracker.jsx` (~4300 lines) — all UI lives here  
**Styles:** `src/styles/index.css` — single file, no CSS modules  
**Storage hook:** `src/hooks/useStorage.js` — all Supabase CRUD  
**Z-index ladder:** app-header:50 → glass-shell:60 → bnav:100 → bsheet:151 → modal:200  
**monthStr** is `useState` (as of v7.21.0) — not a derived const  
**budgets.monthly** comes from Supabase `budgets` table — 0 if no row exists for user  
**Tab layout (8 tabs):** Overview · Expenses · Analytics (Insights|Trends) · Planning (Budgets|Goals) · Recurring · Trips · FX · Settings  
**Mobile nav:** bottom bar replaces glass-shell at ≤768px  
**Pending SQL:** `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS odo_reading numeric` (+ trip_a, trip_b, trip_selected)  

## Step 4 — Anti-patterns (never do these)

- ❌ `git add -A` or `git add .` — always name specific files
- ❌ Reading all of Tracker.jsx — it's 4300 lines, always Grep first
- ❌ Creating new files when editing an existing one works
- ❌ Adding comments that describe what the code does
- ❌ Wrapping simple fixes in error handling that can't happen
- ❌ Installing packages for something already achievable with existing deps
- ❌ Pushing without the user asking for it
