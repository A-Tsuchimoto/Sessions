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

### Cloudflare ダッシュボードで Git 連携する場合

1. このリポジトリを Cloudflare Pages に接続。
2. Build settings:
   - Framework preset: `None`
   - Build command: 空欄
   - Build output directory: `public`
3. Settings → Functions → KV namespace bindings で `RECORDS` を実 KV ネームスペースに紐付ける。

### CLI から直接デプロイする場合

```bash
npm run deploy
```

## API

| Method | Path | 説明 |
| --- | --- | --- |
| GET | `/api/records/:date` | 指定日の `{ session1: { task, achieved }, ... }` を返す |
| PUT | `/api/records/:date` | body `{ session: 1–6, task?: string, achieved?: boolean }` で部分更新 |

`:date` は `YYYY-MM-DD` 形式。データはクライアントのローカル日付で保存されるため、タイムゾーンの異なる端末からアクセスする場合は注意。

## 注意

- 認証はなし。同じURLにアクセスする全員が同じデータを共有する個人用ツールを想定している。多人数で使う場合はBasic認証や Cloudflare Access を上に重ねる前提。
