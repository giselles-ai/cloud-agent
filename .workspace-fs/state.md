## Project State（単一ソース）

このファイルだけ見れば「目的 / 意思決定 / 実装状況 / 次にやること」が分かるようにまとめています。

### 目的（tobe）
- ログイン→エージェント作成→対話UIでコミュニケーション
- エージェントは **Vercel Sandbox** 上で動き、Sandbox内でコード実行/ファイル操作できる（まずは最小）

### 意思決定（MVP）
- **App**: Next.js（App Router）
- **Auth**: BetterAuth（Email+Password）
- **DB**: Turso（libSQL/SQLite）
- **ORM**: Drizzle
- **Sandbox**: `@vercel/sandbox`
- **Sandboxライフサイクル**
  - Active: 会話中は `sandboxId` を保持し、必要なら `extendTimeout()`
  - Archived: Sandbox停止した会話はArchivedとして扱う
  - MVPでは Archived は **チャット履歴のみ**（Sandbox FS永続化はしない）

### 実装状況（現時点）
- **入口**
  - 未ログイン: `/` → `/sign-in` or `/sign-up`
  - ログイン後: `/app`
- **Auth**
  - `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-utils.ts`
  - `app/api/auth/[...all]/route.ts`
- **DB**
  - `lib/db.ts`
  - 環境変数（現状の実装）: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`
- **App tables（schema）**
  - `lib/schema/*`（agents / conversations / messages / sandbox_instances）
- **Sandbox**
  - `lib/sandbox/manager.ts`
- **API**
  - Agents: `GET/POST /api/agents`, `GET /api/agents/:id`
  - Conversations: `GET/POST /api/conversations`, `GET /api/conversations/:id`
  - Messages: `GET/POST /api/conversations/:id/messages`
  - Archive: `POST /api/conversations/:id/archive`
- **UI**
  - `app/(auth)/*`（sign-in/sign-up）
  - `app/(app)/layout.tsx`, `app/(app)/app/page.tsx`（/app）

### 未解決 / ブロッカー
- **DBマイグレーション未整備**（BetterAuthテーブル + appテーブル作成）
- **セキュリティ**: 現状は「入力= `bash -lc` 実行」の最短実装（今後ホワイトリスト/ツール化/制限が必須）

### 次に人間がやるタスク（チェックリスト）

#### 0. 環境変数/ローカルセットアップ
- [ ] `.env.local` を用意（最低限）
  - [ ] `DATABASE_URL`
  - [ ] `DATABASE_AUTH_TOKEN`
- [ ] Vercel Sandbox認証（ローカル開発）
  - [ ] `vercel link`
  - [ ] `vercel env pull`（`VERCEL_OIDC_TOKEN` が入る想定）
- [ ] 依存関係をインストール（`bun install` 等）

#### 1. DBマイグレーションを確立（最優先）
目的: **BetterAuthのテーブル** と **アプリ用テーブル** をTursoに作る。

- [ ] Drizzleのマイグレーション方針を決める
  - [ ] `drizzle.config.ts` を追加（Turso/libsql向け）
  - [ ] `migrations/` ディレクトリ運用を決める
- [ ] BetterAuthのスキーマ生成/適用手順を整備
  - [ ] BetterAuth CLIで必要テーブルを生成する
  - [ ] Drizzle側のマイグレーションとしてTursoへ適用する
- [ ] Appスキーマ（`lib/schema/*`）をDBに反映
  - [ ] `agents`, `conversations`, `messages`, `sandbox_instances` を作成
- [ ] ローカルからAPI叩いて動作確認（サインアップ→エージェント作成→会話開始）

#### 2. 認証/ルーティングの体験を整える
- [ ] `/app` 直アクセス時の導線確認（未ログイン→sign-inへ）
- [ ] サインイン/アップ後の遷移確認
- [ ] エラーメッセージ整備（401/409/500など）

#### 3. 会話のArchived体験を整える
- [ ] Sandbox停止/失敗/timeout時の状態遷移をUIで分かりやすくする
  - [ ] `active/archived/failed` の表示とフィルタ
  - [ ] Archivedは送信不可＋履歴閲覧のみ（現状OK）
- [ ] 「Archivedな会話を再開」要件を決める
  - [ ] MVP案: 「再開=新規会話開始（新Sandbox）」でOK

#### 4. セキュリティ（MVPの次に必須）
- [ ] 実行できるコマンド/ツールをホワイトリスト化
- [ ] コマンド実行ログ（監査ログ）をDBに保存（messages.metadata だけで足りるか見直し）
- [ ] リソース/時間制限のポリシー（timeout, vCPU, 禁止コマンド等）

#### 5. 片付け/整理（任意）
- [ ] `app/api/chats/[id]/messages/` など未使用の空ディレクトリを整理
- [ ] APIレスポンス型を共通化（zod等導入するか検討）

### 参考（必要なら読む）
- `.workspace-fs/decisions.md`（詳細な意思決定メモ）
- `.workspace-fs/worklog-2026-01-22.md`（実装ログ）
- `.workspace-fs/AGENTS.md`（次のAgent向けの入口/主要ファイル）
