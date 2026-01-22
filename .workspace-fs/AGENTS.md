## .workspace-fs/AGENTS.md

このフォルダは「次のAgent/人間が迷わず開発を続ける」ための作業メモ置き場です。

### 目的（tobe）
- `.workspace-fs/tobe.md` を参照。
- 要約: **ログイン→エージェント作成→対話UI→Vercel Sandboxで実行**。Sandbox停止した会話は **Archived** として履歴のみ閲覧。

### 直近の意思決定
- `.workspace-fs/decisions.md` を参照。
- 重要: MVPでは **Active中は sandboxId を保持**、停止後は **Archived（履歴のみ）**、FS永続化はまだしない。

### いま何ができているか（実装済み）
- `.workspace-fs/worklog-2026-01-22.md` を参照（依存/追加API/画面）。
- 入口:
  - 未ログイン: `/` → `/sign-in` or `/sign-up`
  - ログイン後: `/app`

### 重要ファイル（触る頻度が高い）
- **Auth**
  - `lib/auth.ts`（BetterAuth本体）
  - `lib/auth-client.ts`（クライアント）
  - `app/api/auth/[...all]/route.ts`（Next.js handler）
- **DB**
  - `lib/db.ts`（Turso/libsql接続）
  - `lib/schema/*`（アプリ用テーブル定義）
- **Sandbox**
  - `lib/sandbox/manager.ts`
- **API**
  - `app/api/agents/*`
  - `app/api/conversations/*`
- **UI**
  - `app/(auth)/*`
  - `app/(app)/layout.tsx`
  - `app/(app)/app/page.tsx`

### まず最初にやること（次のAgentの最優先）
- `.workspace-fs/state.md` の「次に人間がやるタスク（チェックリスト）」の「1. DBマイグレーションを確立」を実施。
  - 現状は **テーブル作成手順が未整備**で、実運用/動作確認の最大のブロッカー。

### 実行に必要な環境変数
- DB:
  - `DATABASE_URL`
  - `DATABASE_AUTH_TOKEN`
- Vercel Sandbox:
  - ローカルは `vercel link` + `vercel env pull` で `VERCEL_OIDC_TOKEN` を取得する想定

### 注意（MVPの危険ポイント）
- `POST /api/conversations/:id/messages` は入力を `bash -lc` で実行する最短実装。
  - 今後はホワイトリスト/ツール化/監査ログ/制限を必ず入れる（`.workspace-fs/state.md` 参照）。

