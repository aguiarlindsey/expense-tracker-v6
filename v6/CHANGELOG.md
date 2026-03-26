# Expense Tracker V6 Changelog

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
