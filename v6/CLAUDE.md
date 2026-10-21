# CLAUDE.md — Expense Tracker v6 / v7

This file governs how Claude Code operates in this project. Read it at the start of every session.

---

## WAT Framework

You operate inside the **WAT framework** (Workflows, Agents, Tools). This separates concerns so probabilistic AI handles reasoning while deterministic code handles execution.

### Layer 1 — Workflows (`workflows/`)
Markdown SOPs. Each workflow defines objective, required inputs, which tools to use, expected outputs, and edge-case handling. Written in plain language like briefing a teammate.

### Layer 2 — Agent (you)
Your role: intelligent coordination. Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, ask clarifying questions when needed. Connect intent to execution without doing everything directly.
- If you need to pull data from a website: read `workflows/scrape_website.md`, gather required inputs, then execute `tools/scrape_single_site.py`

### Layer 3 — Tools (`tools/`)
Python scripts that do the actual work: API calls, data transforms, file operations, DB queries. Credentials live in `.env`. These are consistent, testable, and fast.

**Why it matters:** When AI handles every step directly, accuracy compounds down fast (90%^5 = 59%). Offloading execution to deterministic scripts keeps you focused on orchestration where you excel.

### How to operate

1. **Check `tools/` before building anything new.** Only create scripts when nothing exists for the task.

2. **Learn and adapt on failure:**
   - Read the full error trace
   - Fix the script, retest (if it uses paid API calls, check with me before re-running)
   - Document what you learned in the workflow (rate limits, quirks, unexpected behavior)

3. **Keep workflows current.** Update when you find better methods or hit recurring issues. Do not create or overwrite workflows without asking unless explicitly told to. These are persistent instructions, not disposable notes.

### Self-improvement loop
1. Identify what broke → 2. Fix the tool → 3. Verify the fix → 4. Update the workflow → 5. Move on with a stronger system

---

## Directory Layout

```
workflows/           # Markdown SOPs — what to do and how
tools/               # Python scripts for deterministic execution
.tmp/                # Temporary/intermediate files (regenerable, disposable, gitignored)
src/                 # React app source (Vite + TypeScript)
api/                 # Vercel serverless functions
supabase/            # DB migrations and SQL patches
public/              # Static assets (icons, service worker, PDF worker, Tesseract)
docs/
  archive/           # Completed planning docs (historical reference only)
  reference/         # Living feature reference (EXPTRAV7.md, LBAv6-details.html)
  previews/          # Old HTML prototypes (EXPTRAV7.html, preview-*.html)
screenshots/         # App screenshots and PDFs
.env                 # API keys and secrets (NEVER store secrets elsewhere)
```

**Core principle:** Local files are for processing. Anything the user needs to see lives in cloud services (Vercel, Supabase). Everything in `.tmp/` is disposable.

---

## Project: Expense Tracker v6/v7

**Stack:** Vite + React 18 + TypeScript + Supabase + Vercel  
**Live:** expense-tracker-v6.vercel.app  
**Status:** v7.33.0, all 32 phases complete

### Running locally
```bash
cd v6
npm run dev      # Vite dev server
```

### Key directories
- [src/](src/) — React components, hooks, utils
- [api/](api/) — Vercel serverless API routes
- [supabase/](supabase/) — migrations, schema

### Auth & data
- Supabase auth (email/password). User email: `aguiar.lindsey@gmail.com`
- Supabase tables: expenses, income, budgets, goals, settings
- Exchange rates fetched server-side via `/api/rates`

### Supabase migrations — every new table needs explicit GRANTs
Supabase ended automatic Data API grants for new `public`-schema tables on existing projects, effective 2026-10-30. Any table created in `public` from then on needs explicit grants or every `supabase-js`/PostgREST/GraphQL call to it fails with "permission denied" — even with correct RLS, since GRANT is a separate privilege layer underneath RLS. Existing tables (everything created before this rule was added) are unaffected regardless of the date.

**Already neutralized project-wide**: `supabase/add_default_grants.sql` (run once) sets `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public` so any table created from now on — by any future migration, with or without its own explicit grants — automatically gets the Data API access it needs. This makes the Oct 30 deadline permanently irrelevant to this project; nothing will silently break even if a future migration forgets the explicit grants below.

**Still do this in every new `supabase/add_*.sql` migration that creates a table, right after enabling RLS, as belt-and-suspenders** (makes the migration file self-contained and portable to a fresh project, not just reliant on this project's own default-privileges setup):
```sql
grant select on public.your_table to anon;
grant select, insert, update, delete on public.your_table to authenticated;
grant select, insert, update, delete on public.your_table to service_role;
```

**Do NOT extend the default-privileges safety net to functions.** RPC functions have always required explicit, per-function `grant execute` — that was never affected by the Oct 30 change. This project's security-definer functions are deliberately authenticated-only; a blanket default execute grant to `anon` would be a real security regression, not a convenience. Grant function execute by hand, one at a time, same as always.

---

## Git Commit Style

Subject: descriptive summary of what changed  
Body: one bullet per logical change

```
feat: add WAT framework folder structure and CLAUDE.md

✅ Created workflows/, tools/, .tmp/ directories
✅ Added CLAUDE.md with WAT framework instructions
```

Use conventional commit prefixes: `feat`, `fix`, `docs`, `refactor`, `chore`.
