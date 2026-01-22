## .workspace-fs/AGENTS.md

This folder contains working notes so the next agent/human can continue without getting lost.

### Goals (tobe)
- See `.workspace-fs/tobe.md`.
- Summary: **Login -> create agent -> chat UI -> execute in Vercel Sandbox**. Conversations whose sandbox stopped are **Archived** and viewable as history only.

### Recent decisions
- See `.workspace-fs/decisions.md`.
- Important: In the MVP, **keep sandboxId while active**; after it stops, treat the conversation as **Archived (history only)**. FS persistence is not done yet.

### What is implemented now
- See `.workspace-fs/worklog-2026-01-22.md` (deps / APIs / screens).
- Entry:
  - Logged out: `/` -> `/sign-in` or `/sign-up`
  - Logged in: `/app`

### Key files (frequently touched)
- **Auth**
  - `lib/auth.ts` (BetterAuth core)
  - `lib/auth-client.ts` (client)
  - `app/api/auth/[...all]/route.ts` (Next.js handler)
- **DB**
  - `lib/db.ts` (Turso/libsql connection)
  - `lib/schema/*` (app table definitions)
- **Sandbox**
  - `lib/sandbox/manager.ts`
- **API**
  - `app/api/agents/*`
  - `app/api/conversations/*`
- **UI**
  - `app/(auth)/*`
  - `app/(app)/layout.tsx`
  - `app/(app)/app/page.tsx`

### First thing to do (top priority for next agent)
- In `.workspace-fs/state.md`, complete "1. Establish DB migrations" under "Next human tasks (checklist)".
  - Currently the **table creation procedure is not set up**, which is the main blocker for real use/testing.

### Required environment variables
- DB:
  - `DATABASE_URL`
  - `DATABASE_AUTH_TOKEN`
- Vercel Sandbox:
  - For local dev, run `vercel link` + `vercel env pull` to obtain `VERCEL_OIDC_TOKEN`.

### Caution (MVP risk point)
- `POST /api/conversations/:id/messages` is a minimal implementation that executes input via `bash -lc`.
  - Later we must add whitelisting/tooling/audit logging/limits (see `.workspace-fs/state.md`).

