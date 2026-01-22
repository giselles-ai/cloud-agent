### 意思決定（2026-01-22）

#### 目的（tobe）
- ログインして、エージェントを作成し、対話的UIでコミュニケーションできる。
- エージェントは **Vercel Sandbox** 上で動き、Sandbox内のFSを保持しつつコード実行/ファイル操作できる（まずは最小）。

#### 技術選定
- **App**: Next.js（App Router）
- **Auth**: BetterAuth
- **DB**: Turso（libSQL/SQLite）
- **ORM**: Drizzle
- **Sandbox**: `@vercel/sandbox`（Vercel Sandbox SDK）

#### Sandboxライフサイクル方針（MVP）
- **Active**: 会話中はSandboxを生かす（DBに `sandboxId` を保存し、再接続は `Sandbox.get()`）。必要に応じて `extendTimeout()`。
- **Archived**: Sandboxが停止した会話はArchivedとして扱う。
  - MVPでは **チャット履歴のみ** を閲覧対象にする（Sandbox FSの永続化はしない）。
  - そのため、Sandbox停止後にFSが消えるのは許容。

#### セキュリティ/制約（MVPの割り切り）
- MVPでは「チャット入力 = Sandboxで実行するシェルコマンド」という最短実装になっている。
  - これは強力だが危険になり得るため、今後は「許可されたツール/コマンドのみ」「LLM経由の計画→実行」「監査ログ」「リソース制限」の追加が前提。

