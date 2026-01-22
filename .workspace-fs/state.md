## Project State (Single Source of Truth)

This file alone summarizes goals, decisions, implementation status, and next tasks.

### Goals (tobe)
- Login -> create agent -> communicate via chat UI
- Agents run on **Vercel Sandbox** and can execute code / file operations inside the sandbox (minimal first)

### Decisions (MVP)
- **App**: Next.js (App Router)
- **Auth**: BetterAuth (Email+Password)
- **DB**: Turso (libSQL/SQLite)
- **ORM**: Drizzle
- **Sandbox**: `@vercel/sandbox`
- **Sandbox lifecycle**
  - Active: keep `sandboxId` during a conversation and call `extendTimeout()` as needed
  - Archived: treat conversations whose sandbox stopped as archived
  - MVP: Archived is **chat history only** (no Sandbox FS persistence)

### Current implementation
- **Entry**
  - Logged out: `/` -> `/sign-in` or `/sign-up`
  - Logged in: `/app`
- **Auth**
  - `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-utils.ts`
  - `app/api/auth/[...all]/route.ts`
- **DB**
  - `lib/db.ts`
  - Env vars (current implementation): `DATABASE_URL`, `DATABASE_AUTH_TOKEN`
- **App tables (schema)**
  - `lib/schema/*` (agents / conversations / messages / sandbox_instances)
- **Sandbox**
  - `lib/sandbox/manager.ts`
- **API**
  - Agents: `GET/POST /api/agents`, `GET /api/agents/:id`
  - Conversations: `GET/POST /api/conversations`, `GET /api/conversations/:id`
  - Messages: `GET/POST /api/conversations/:id/messages`
  - Archive: `POST /api/conversations/:id/archive`
- **UI**
  - `app/(auth)/*` (sign-in/sign-up)
  - `app/(app)/layout.tsx`, `app/(app)/app/page.tsx` (/app)

### Open issues / blockers
- **DB migrations not set up** (BetterAuth tables + app tables)
- **Security**: current implementation executes input via `bash -lc` (future whitelisting/tooling/limits are required)

### Next human tasks (checklist)

#### 0. Env/local setup
- [ ] Prepare `.env.local` (minimum)
  - [ ] `DATABASE_URL`
  - [ ] `DATABASE_AUTH_TOKEN`
- [ ] Vercel Sandbox auth (local dev)
  - [ ] `vercel link`
  - [ ] `vercel env pull` (expect `VERCEL_OIDC_TOKEN`)
- [ ] Install dependencies (`bun install`, etc.)

#### 1. Establish DB migrations (highest priority)
Goal: create **BetterAuth tables** and **app tables** in Turso.

- [ ] Decide Drizzle migration policy
  - [ ] Add `drizzle.config.ts` (for Turso/libsql)
  - [ ] Decide `migrations/` directory workflow
- [ ] Set up BetterAuth schema generation/apply
  - [ ] Generate required tables with BetterAuth CLI
  - [ ] Apply as Drizzle migrations to Turso
- [ ] Apply app schema (`lib/schema/*`) to DB
  - [ ] Create `agents`, `conversations`, `messages`, `sandbox_instances`
- [ ] Verify locally by calling APIs (sign up -> create agent -> start conversation)

#### 2. Improve auth/routing UX
- [ ] Confirm `/app` direct access flow (logged out -> sign-in)
- [ ] Confirm redirects after sign-in/up
- [ ] Improve error messages (401/409/500, etc.)

#### 3. Improve Archived experience
- [ ] Make status transitions clearer in UI
  - [ ] Show `active/archived/failed` labels and filters
  - [ ] Archived is read-only + history only (current OK)
- [ ] Decide "resume archived conversation" requirement
  - [ ] MVP idea: resume = start new conversation (new sandbox)

#### 4. Security (required after MVP)
- [ ] Whitelist allowed commands/tools
- [ ] Store command execution logs in DB (revisit messages.metadata)
- [ ] Define resource/time limits (timeout, vCPU, blocked cmds)

#### 5. Cleanup / organization (optional)
- [ ] Remove unused empty directories like `app/api/chats/[id]/messages/`
- [ ] Consider shared API response types (zod, etc.)

### References (read if needed)
- `.workspace-fs/decisions.md` (decision memo)
- `.workspace-fs/worklog-2026-01-22.md` (implementation log)
- `.workspace-fs/AGENTS.md` (entry point for the next agent)
