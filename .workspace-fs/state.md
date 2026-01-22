### Task

- [x] tobeを実現するためのTaskを作る（計画→MVP実装まで完了）
- [x] 人間が次に進めるためのタスクリストを整備する（`.workspace-fs/next-tasks.md`）

### Design Decisions

- Auth: BetterAuth（Email+Password）
- ORM: Drizzle
- DB: Turso（libSQL/SQLite）
- App: Next.js（App Router）
- Sandbox runtime: Vercel Sandbox（会話中は `sandboxId` で保持、停止後は Archived）
- Archived: **チャット履歴のみ**閲覧（Sandbox FSの永続化はMVPではしない）

### Current State（実装状況）

- Docs
  - `.workspace-fs/decisions.md`
  - `.workspace-fs/worklog-2026-01-22.md`
  - `.workspace-fs/next-tasks.md`
  - `.workspace-fs/AGENTS.md`
- Auth
  - Handler: `app/api/auth/[...all]/route.ts`
  - Client: `lib/auth-client.ts`
- DB
  - Connection: `lib/db.ts`
  - env: `TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN`
    - 注意: ドキュメントや過去メモで `TURSO_DATABASE_URL` 表記が混在しているため、どちらかに統一が必要
- App tables（schema）
  - `lib/schema/*`（agents / conversations / messages / sandbox_instances）
- API
  - Agents: `GET/POST /api/agents`, `GET /api/agents/:id`
  - Conversations: `GET/POST /api/conversations`, `GET /api/conversations/:id`
  - Messages: `GET/POST /api/conversations/:id/messages`
  - Archive: `POST /api/conversations/:id/archive`
- UI
  - `/`（未ログイン→sign-in/up、ログイン済み→/app）
  - `/sign-in`, `/sign-up`, `/app`

### Blockers / Next（最優先）

- DBマイグレーションを確立（BetterAuthテーブル + appテーブル作成）
- Turso接続env名の統一（`TURSO_CONNECTION_URL` vs `TURSO_DATABASE_URL`）
- セキュリティ: 現状は「入力= `bash -lc` 実行」のため、ホワイトリスト化/ツール化が必須
