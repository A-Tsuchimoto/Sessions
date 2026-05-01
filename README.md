# Time-Blocked Todo

朝8時から夜8時までを2時間ごとに区切った6セッションで日々のTodoに集中して取り組むためのWebアプリ。Cloudflare Pages + KV にデプロイすると、どの端末からでも同じデータが参照できる。

## 機能

- **セッションタブ** — 8:00–20:00 を2時間ごとに区切ってSession 1〜6を自動表示。現在のセッション名・残り分数・残り時間バーが何の操作もなく表示される。取り組む内容の記入と達成ボタンの押下が可能。
- **記録タブ** — 直近7日間 × 6セッションのグリッドで達成状況を可視化。日付/セッションをタップして内容と達成判定を編集できる。

## ディレクトリ構成

```
public/                 静的アセット (Cloudflare Pages の出力ディレクトリ)
  index.html
  app.js
  styles.css
functions/api/records/  Pages Functions
  [date].js             GET/PUT /api/records/:date
wrangler.toml           Pages + KV のバインディング設定
package.json            wrangler スクリプト
```

## ローカル開発

1. 依存をインストール

   ```bash
   npm install
   ```

2. KV ネームスペースを作成

   ```bash
   npx wrangler kv namespace create RECORDS
   npx wrangler kv namespace create RECORDS --preview
   ```

   出力された `id` と `preview_id` を `wrangler.toml` に貼り付ける。

3. ローカルで起動

   ```bash
   npm run dev
   ```

   http://localhost:8788 にアクセス。

## デプロイ

デプロイ方法は2通り。**A. ダッシュボードで Git 連携**（推奨。push するだけで自動デプロイ）と、**B. Wrangler CLI で直接 publish** のいずれか。どちらの場合も先に「事前準備」と「KV ネームスペース作成」を済ませておく。

### 事前準備

- Cloudflare アカウント（無料プランで可）。
- Node.js 18 以上。
- このリポジトリを GitHub / GitLab に push 済みであること（A を選ぶ場合）。
- ローカルから wrangler を使う場合は一度ログイン:

  ```bash
  npx wrangler login
  ```

  ブラウザが開くので承認する。

### KV ネームスペース作成（A・B 共通）

本番用とプレビュー用（Pages の preview deployment で使う）を作成する:

```bash
npx wrangler kv namespace create RECORDS
npx wrangler kv namespace create RECORDS --preview
```

それぞれ次のような出力が出る:

```
🌀 Creating namespace with title "time-blocked-todo-RECORDS"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "RECORDS", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

`id` と `preview_id` を `wrangler.toml` の該当箇所に貼り付ける:

```toml
[[kv_namespaces]]
binding = "RECORDS"
id = "<本番 KV の ID>"
preview_id = "<プレビュー KV の ID>"
```

> **メモ:** `wrangler.toml` の `id` 値はシークレットではなく Cloudflare 内のリソース識別子なので、リポジトリにコミットして問題ない。

### A. Cloudflare ダッシュボードで Git 連携（推奨）

1. https://dash.cloudflare.com にログインし、左メニュー **Workers & Pages** を開く。
2. **Create application** → **Pages** タブ → **Connect to Git** を選択。
3. GitHub/GitLab を認可し、このリポジトリを選択。
4. **Set up builds and deployments** で次のように設定:
   - **Production branch**: 本番に当てたいブランチ（例: `main`）。
   - **Framework preset**: `None`
   - **Build command**: 空欄のまま
   - **Build output directory**: `public`
   - **Root directory**: 空欄のまま
5. **Save and Deploy** を押す。1回目のデプロイが走り、`https://<project>.pages.dev` で公開される。
6. デプロイが終わったら **Settings → Functions → KV namespace bindings** に移動:
   - **Variable name**: `RECORDS`
   - **KV namespace**: 上で作成した本番 KV を選択
   - **Add binding** を押す。
   - 同じ画面の "Preview" 用にも `RECORDS` バインディングを追加し、preview 用の KV を選択する。
7. バインディングは **次回以降のデプロイ**で有効になる。**Deployments** タブから最新デプロイの右の `…` → **Retry deployment** を押すか、空コミットを push して再デプロイする:

   ```bash
   git commit --allow-empty -m "Trigger redeploy with KV binding"
   git push
   ```

8. デプロイ後、ブラウザで `https://<project>.pages.dev` にアクセス。セッションタブで一言入力 → 達成ボタンを押し、別の端末で同じ URL を開いて同じ状態が見えれば KV 同期成功。

### B. Wrangler CLI から直接デプロイ

ダッシュボード連携を使わず、ローカルから直接 publish したい場合。

1. KV を作成し `wrangler.toml` に ID を反映済みであること（前述の手順）。
2. 初回デプロイ:

   ```bash
   npx wrangler pages deploy public --project-name time-blocked-todo
   ```

   - 同名の Pages プロジェクトがなければ新規作成され、本番ブランチを尋ねられる（`main` 等を指定）。
   - 以降は `npm run deploy`（`wrangler pages deploy public` のエイリアス）で同じプロジェクトに上書きデプロイされる。

3. CLI でデプロイした場合も Functions の KV バインディングは **Pages プロジェクト側の設定** が読まれる。`wrangler.toml` に書いたバインディングは `wrangler pages dev`（ローカル）に適用される一方、リモートの Pages Functions では使われないため、A の手順 6〜7 と同じく **ダッシュボード上で `RECORDS` バインディングを設定**する必要がある。

### カスタムドメインを当てる（任意）

1. ダッシュボードの該当 Pages プロジェクト → **Custom domains** → **Set up a custom domain**。
2. 使いたいドメイン（例: `todo.example.com`）を入力。同一 Cloudflare アカウントで管理されているドメインなら自動で CNAME が追加される。

### デプロイ確認チェックリスト

- [ ] `https://<project>.pages.dev` にアクセスして UI が表示される。
- [ ] セッションタブで内容を入力 → ページをリロードしても残る（= KV に保存されている）。
- [ ] 別の端末/ブラウザから同じ URL にアクセスして同じデータが見える。
- [ ] 記録タブの「直近7日間」グリッドが表示され、セルをタップすると詳細編集が開く。
- [ ] DevTools の Network タブで `/api/records/YYYY-MM-DD` が **200** を返している（500 の場合は KV バインディング未設定の可能性が高い）。

### よくあるハマりどころ

| 症状 | 原因 / 対処 |
| --- | --- |
| `/api/records/...` が 500 で `KV binding "RECORDS" is not configured.` | ダッシュボードで KV バインディングを追加していない、または追加後に再デプロイしていない。 |
| ローカルで `npm run dev` が KV エラーを出す | `wrangler.toml` の `preview_id` が空のまま。`wrangler kv namespace create RECORDS --preview` で作成して貼り付ける。 |
| 別端末から見たら違うデータに見える | 端末ごとにローカル日付が違う日にまたがっている可能性（深夜帯など）。本アプリは「クライアントのローカル日付」をキーにする設計。 |
| ダッシュボードで Build output directory を間違えた | **Settings → Builds & deployments → Build configurations** から `public` に修正後、再デプロイ。 |

## API

| Method | Path | 説明 |
| --- | --- | --- |
| GET | `/api/records/:date` | 指定日の `{ session1: { task, achieved }, ... }` を返す |
| PUT | `/api/records/:date` | body `{ session: 1–6, task?: string, achieved?: boolean }` で部分更新 |

`:date` は `YYYY-MM-DD` 形式。データはクライアントのローカル日付で保存されるため、タイムゾーンの異なる端末からアクセスする場合は注意。

## 注意

- 認証はなし。同じURLにアクセスする全員が同じデータを共有する個人用ツールを想定している。多人数で使う場合はBasic認証や Cloudflare Access を上に重ねる前提。
