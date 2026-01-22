### Decisions (2026-01-22)

#### Goals (tobe)
- Log in, create agents, and communicate in an interactive UI.
- Agents run on **Vercel Sandbox** and can execute code/file operations while preserving the sandbox FS (minimal first).

#### Tech choices
- **App**: Next.js (App Router)
- **Auth**: BetterAuth
- **DB**: Turso (libSQL/SQLite)
- **ORM**: Drizzle
- **Sandbox**: `@vercel/sandbox` (Vercel Sandbox SDK)

#### Drizzle migration policy (Turso/libsql)
- **Correct**: `drizzle-kit generate` -> `drizzle-kit migrate`
- **Forbidden (prod/shared)**: `drizzle-kit push` (local experimentation only)
- **migrations directory**: `db/migrations/`
  - Commit: `db/migrations/*.sql` and `db/migrations/meta/**`
  - Avoid manual edits (fix schema and regenerate)

#### better-auth schema import
- Use `@better-auth/cli generate` to create Drizzle schema, bring it into the repo, and include it in Drizzle Kit migrations.
  - The CLI is fragile with import aliases, so use the CLI-only config (`scripts/better-auth.config.ts`).

#### Sign-up email domain restriction
- Use `SIGNUP_ALLOWED_EMAIL_DOMAINS` (comma-separated) to allowlist sign-up email domains.
- Exact-match only; unset/empty means no restriction.
- Enforce at user creation via Better Auth `databaseHooks.user.create.before` to cover all sign-up paths.

#### Sandbox lifecycle policy (MVP)
- **Active**: keep sandbox alive during conversation (store `sandboxId` in DB, reconnect via `Sandbox.get()`). Call `extendTimeout()` as needed.
- **Archived**: conversations whose sandbox stopped are treated as archived.
  - MVP: only chat history is viewable (no sandbox FS persistence).
  - Therefore, FS loss after sandbox stop is acceptable.

#### Chat transport (AI SDK UI)
- Use AI SDK UI `useChat` on the client.
- Server uses `ToolLoopAgent` + `createAgentUIStreamResponse` for SSE UI message streams.
- Message persistence stores full `UIMessage` JSON in `messages.metadata` as `{ uiMessage: ... }`.
- AI Gateway via `@ai-sdk/openai-compatible` with defaults:
  - Base URL: `https://ai-gateway.vercel.sh/v1`
  - Model: `anthropic/claude-sonnet-4.5`

#### Security/constraints (MVP compromise)
- MVP is the shortest path: "LLM can call bash tool in sandbox."
  - Powerful but risky; future additions required: allowed tools/commands only, audit logs, resource limits.

#### Language policy (repo)
- Keep all UI and documentation text in English.

