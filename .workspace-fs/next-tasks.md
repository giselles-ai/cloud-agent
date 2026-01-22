### これから人間がやるタスク（チェックリスト）

#### 0. 環境変数/ローカルセットアップ
- [ ] `.env.local` を用意（最低限）
  - [ ] `TURSO_DATABASE_URL`
  - [ ] `TURSO_AUTH_TOKEN`
- [ ] Vercel Sandbox認証（ローカル開発）
  - [ ] `vercel link`
  - [ ] `vercel env pull`（`VERCEL_OIDC_TOKEN` が入る想定）
- [ ] 依存関係をインストール（`package.json` 更新済みなので `bun install` 等）

#### 1. DBマイグレーションを確立（最優先）
目的: **BetterAuthのテーブル** と **アプリ用テーブル** をTursoに作る。

- [ ] Drizzleのマイグレーション方針を決める
  - [ ] `drizzle.config.ts` を追加（Turso/libsql向け）
  - [ ] `migrations/` ディレクトリ運用を決める
- [ ] BetterAuthのスキーマ生成/適用手順を整備
  - [ ] BetterAuth CLIで必要テーブルを生成する（`better-auth` docs: drizzle adapter + CLI）
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
現状は「入力= `bash -lc` 実行」なので、必ず絞る。
- [ ] 実行できるコマンド/ツールをホワイトリスト化
- [ ] コマンド実行ログ（監査ログ）をDBに保存（messages.metadata だけで足りるか見直し）
- [ ] リソース/時間制限のポリシー（timeout, vCPU, 禁止コマンド等）

#### 5. 片付け/整理（任意）
- [ ] `app/api/chats/[id]/messages/` など未使用の空ディレクトリを整理
- [ ] APIレスポンス型を共通化（zod等導入するか検討）

