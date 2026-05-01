# Time-Blocked Todo

朝8時から夜8時までを2時間ごとに区切った6セッションで日々のTodoに集中して取り組むためのWebアプリ。Cloudflare Pages + KV にデプロイすると、どの端末からでも同じデータが参照できる。

## 機能

- **セッションタブ** — 8:00–20:00 を2時間ごとに区切ってSession 1〜6を自動表示。現在のセッション名・残り分数・残り時間バーが何の操作もなく表示される。取り組む内容の記入、**達成**ボタン、**オフ**ボタン（移動・予定外の用事・休息などで集中作業ができなかったセッションを記録する用途）が押せる。両ボタンとも「もう一度押すと解除」のトグル式。
- **記録タブ** — 三段構成:
  1. **直近7日間グリッド** — 7日 × 6セッションのカラーグリッド。緑=達成 / 青=オフ / グレー=記入のみ / 暗=未記入。
  2. **カレンダービュー** — 月単位で過去をさかのぼれる。前月/翌月の矢印 + 「今月」ボタンで移動。各日のセルに 6 セッション分のミニバーが並ぶ。
  3. **詳細エディタ** — 選択された日付の 6 セッションを編集（内容の修正、達成/オフの切替）。
- **CSVエクスポート** — 記録タブ右上のボタンから全記録を CSV ダウンロード。Excel/Google Sheets でそのまま開ける UTF-8 BOM 付き。空のセッションは行に含めずコンパクトに出力。

## ディレクトリ構成

```
public/                 静的アセット (Cloudflare Pages の出力ディレクトリ)
  index.html
  app.js
  styles.css
functions/api/records/  Pages Functions
  [date].js             GET/PUT /api/records/:date
  index.js              GET /api/records (range / 全件)
  _helpers.js           normalize / json レスポンスの共通モジュール
wrangler.toml           Pages + KV のバインディング設定
package.json            wrangler スクリプト
```

## デプロイ

### 前提知識: バインディング管理は wrangler.toml が握っている

このリポジトリには `wrangler.toml` が含まれているため、Cloudflare Pages はこのプロジェクトを **「wrangler.toml-managed bindings」モード** で扱う。具体的には:

- **本番のバインディング設定の唯一の source of truth は `wrangler.toml`。**
- ダッシュボードの **Settings → Bindings** 画面は read-only になり、`Bindings for this project are being managed through wrangler.toml` と表示される（ここから追加しようとしてもできない）。
- したがって KV を有効にする手順は「ダッシュボードでバインドを追加する」ではなく **「`wrangler.toml` に KV namespace ID を書いて push する」** になる。

### 事前に揃えておくもの

- Cloudflare アカウント（無料プランで可）— https://dash.cloudflare.com/sign-up
- このリポジトリが GitHub にある状態（このプロジェクトはすでに GitHub に push 済み）

### 手順 1: KV ネームスペースを作る（ブラウザ）

KV は Cloudflare のキー・バリュー型ストレージ。ここに記録データが入る。

1. ブラウザで https://dash.cloudflare.com を開いてログイン。
2. 左サイドバーの **Workers & Pages** をクリック。
3. ページ上部のタブのうち **KV** をクリック。
   - 左サイドバーに直接 **Storage & Databases → KV** がある UI バージョンならそちらでも同じ。
4. 右上の **Create a namespace**（または **Create namespace**）をクリック。
5. 入力欄に `RECORDS` と入れて **Add** をクリック。
6. 一覧に `RECORDS` 行が追加される。**ID** カラムの 32 文字の 16 進文字列をコピーする（これを次の手順で使う）。

### 手順 2: `wrangler.toml` に KV ID を書いて push する

1. ローカルのテキストエディタで `wrangler.toml` を開く。
2. 末尾の `[[kv_namespaces]]` ブロックの `<PASTE_KV_NAMESPACE_ID_HERE>` を、手順 1 でコピーした ID に置換する:

   ```toml
   [[kv_namespaces]]
   binding = "RECORDS"
   id = "1a2b3c4d5e6f7890abcdef1234567890"        # 例
   preview_id = "1a2b3c4d5e6f7890abcdef1234567890" # 同じ ID で OK
   ```

   > **メモ:** KV namespace ID は秘密情報ではない（リソース識別子であって認証情報ではない）。Cloudflare アカウント認証なしには読み書きできないため、公開リポジトリにコミットして問題ない。preview deployment 用に分けたければ、もう一つ KV を作ってその ID を `preview_id` に入れる。
3. commit して push する:

   ```bash
   git add wrangler.toml
   git commit -m "Set RECORDS KV namespace ID"
   git push
   ```

   この push を契機に Pages が自動で再デプロイする（Pages にまだリポジトリを繋いでいない場合は次の手順 3 で繋ぐ。手順 2 と 3 は順序入れ替え可能）。

### 手順 3: GitHub リポジトリを Pages に接続する（初回のみ）

すでに Pages に接続済みなら飛ばして手順 4 へ。

1. 左サイドバー **Workers & Pages** に戻る。
2. **Create application** をクリック → **Pages** タブを選択 → **Connect to Git** をクリック。
3. **GitHub** を選び、Cloudflare に GitHub アクセスを許可する画面で承認。リポジトリ単位で許可可能。
4. リポジトリ一覧から `Sessions`（このリポジトリ）を選び **Begin setup** をクリック。
5. **Set up builds and deployments** 画面で次のように入力:

   | 項目 | 値 |
   | --- | --- |
   | Project name | 任意（例 `time-blocked-todo`）。これがサブドメインになる。 |
   | Production branch | デプロイしたいブランチ名。`claude/time-blocked-todo-app-0orim` を本番にするならそれ、`main` にマージしてからにするなら `main`。 |
   | Framework preset | **None** |
   | Build command | **空欄のまま** |
   | Build output directory | `public` |
   | Root directory (advanced) | 空欄のまま |

6. 一番下の **Save and Deploy** をクリック → ビルドが走り、1 分程度で `https://<project-name>.pages.dev` が公開される。

### 手順 4: 動作確認

- ブラウザで `https://<project-name>.pages.dev` を開く。
- セッションタブの「取り組む内容」に何か書いて textarea からフォーカスを外す → 数秒待って **ページをリロード**しても入力が残っていれば KV 保存成功。
- 別の端末（スマホなど）から同じ URL を開き、同じ内容が見えれば同期 OK。
- うまくいかない場合は DevTools (F12) → Network タブで `/api/records/YYYY-MM-DD` のレスポンスを確認:
  - **500 + `KV binding "RECORDS" is not configured.`** → `wrangler.toml` の `binding` が `RECORDS` になっていない、または push が反映されていない（**Deployments** タブで最新デプロイの状態を確認）。
  - **デプロイログに `Error 8000022: Invalid KV namespace ID`** → `wrangler.toml` の `id` がプレースホルダのまま、または不正な文字列。実 KV ID（32 文字の hex）に置換して push し直す。
  - **200 だが `{}`** → 正常。データ未入力なだけ。

### （任意）独自ドメインを当てる

1. プロジェクトページ → **Custom domains** タブ → **Set up a custom domain**。
2. 使いたいドメイン（例 `todo.example.com`）を入力 → **Continue** → **Activate domain**。
3. 同一 Cloudflare アカウントで DNS を管理しているドメインなら CNAME が自動で追加される。

### （任意）独自ドメインを当てる

1. プロジェクトページ → **Custom domains** タブ → **Set up a custom domain**。
2. 使いたいドメイン（例 `todo.example.com`）を入力 → **Continue** → **Activate domain**。
3. 同一 Cloudflare アカウントで DNS を管理しているドメインなら CNAME が自動で追加される。

---

## ローカル開発（任意。ブラウザで先にデプロイしたなら不要）

ローカルマシンで動作確認しながら開発したい場合のみ必要。`wrangler` という Cloudflare 公式の CLI ツールを使う。

### `wrangler` とは

- Cloudflare が配布している Node.js 製のコマンドラインツール。
- このプロジェクトの `package.json` に開発依存として書かれているので **個別にインストール不要**。`npx wrangler ...` または `npm run ...` で実行できる。
- 実行は **このリポジトリのルートディレクトリ**（`wrangler.toml` がある階層）で行う。

### セットアップ

ターミナルを開き、このリポジトリのルートディレクトリに移動した上で:

1. **依存をインストール**

   ```bash
   npm install
   ```

   `node_modules/` ができて `wrangler` 含む依存がダウンロードされる。

2. **Cloudflare にログイン**

   ```bash
   npx wrangler login
   ```

   - 自動でブラウザが開き、Cloudflare のログイン画面 → 「Allow（許可）」ボタンが表示される。許可するとターミナルに戻り `Successfully logged in.` と出る。
   - SSH 越し等でブラウザが開けない環境では URL が表示されるので、別マシンのブラウザにコピペして開く。

3. **`wrangler.toml` の KV ID 確認**

   本番デプロイ時にすでに実 KV ID を `wrangler.toml` に書いてあれば、ローカル開発もその ID をそのまま使うので **追加の編集は不要**。`wrangler pages dev` がデフォルトでは「ローカル KV エミュレータ」を使う（`.wrangler/` 配下にローカル保存され、本番 KV には書き込まない）。本番 KV を直接読み書きしたい場合は次節「ローカル起動」の `--remote` オプションを使う。

### CLI から KV を新規作成する場合（手順 3 の代替）

ダッシュボードを使わず CLI で作りたい場合:

```bash
npx wrangler kv namespace create RECORDS
```

実行すると次のような出力が出る:

```
🌀 Creating namespace with title "time-blocked-todo-RECORDS"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "RECORDS", id = "1a2b3c4d5e6f7890abcdef1234567890" }
```

ここに出てきた `id` 値（クォートの中の 32 文字）を `wrangler.toml` の `id` に貼る。preview 用に分けたい場合は:

```bash
npx wrangler kv namespace create RECORDS --preview
```

をもう一度実行し、出てきた ID を `preview_id` に貼る。

### ローカル起動

```bash
npm run dev
```

これは内部的に `npx wrangler pages dev public` を実行している。

- 起動するとターミナルに `[wrangler] Ready on http://localhost:8788` と出る。ブラウザでそのアドレスを開く。
- Ctrl+C で停止。
- KV はローカルファイル（`.wrangler/` 配下）に保存され、リモートの本番 KV には書き込まれない。**本番 KV を直接読み書きしたい場合**は:

  ```bash
  npx wrangler pages dev public --remote
  ```

  で起動する。

### CLI から直接デプロイする（任意）

ダッシュボード連携を使わず、ローカルから手で publish したい場合:

```bash
npm run deploy
```

これは `npx wrangler pages deploy public` のエイリアス。初回は対話で:

- **Project name**: 任意の名前（例 `time-blocked-todo`）
- **Production branch**: 本番扱いするブランチ名

を聞かれる。2回目以降は同じプロジェクトに上書きデプロイされる。

> **メモ:** CLI から deploy する場合も、本番 Functions が読む KV バインディングは `wrangler.toml` の `[[kv_namespaces]]` がそのまま使われる（このプロジェクトは wrangler.toml-managed bindings モードのため）。事前に実 KV ID を入れておくこと。

### よくあるハマりどころ

| 症状 | 原因 / 対処 |
| --- | --- |
| デプロイログに `Error 8000022: Invalid KV namespace ID` | `wrangler.toml` の `id` が `<PASTE_KV_NAMESPACE_ID_HERE>` のまま、または不正な文字列。実 KV ID（32 文字 hex）に置換して push し直す。 |
| ダッシュボードに `Bindings for this project are being managed through wrangler.toml` と出てバインディングを追加できない | これは仕様。`wrangler.toml` がリポジトリにある以上、バインディングは `wrangler.toml` で管理する。`wrangler.toml` の `[[kv_namespaces]]` を編集して push する。 |
| 本番 `/api/records/...` が 500 で `KV binding "RECORDS" is not configured.` | `wrangler.toml` の `binding` が `RECORDS`（大文字）になっていない、または push が反映されていない。**Deployments** タブで最新デプロイの状態を確認。 |
| `npx wrangler login` でブラウザが開かない | SSH 経由などで GUI が無い環境。表示される URL を手元 PC のブラウザで開く。 |
| `wrangler pages deploy` が「project not found」 | `--project-name <name>` を指定するか、初回対話で新規作成する。 |
| 別端末から見たら違う日のデータ | アプリは「クライアント端末のローカル日付」をキーにする。深夜帯やタイムゾーン違いで日付がズレる可能性あり。 |
| Build output directory を間違えた | プロジェクトページ → **Settings** → **Builds & deployments** → **Build configurations** → **Edit** から `public` に修正して再デプロイ。 |

## API

| Method | Path | 説明 |
| --- | --- | --- |
| GET | `/api/records/:date` | 指定日の `{ session1: { task, status }, ... }` を返す。`status` は `"achieved"`, `"off"`, `null` のいずれか。 |
| PUT | `/api/records/:date` | body `{ session: 1–6, task?: string, status?: "achieved"\|"off"\|null }` で部分更新。互換用に `achieved: boolean` も受け付ける。 |
| GET | `/api/records` | 全記録を `{ "YYYY-MM-DD": { session1: {...}, ... }, ... }` 形式で返す（CSV エクスポート用）。 |
| GET | `/api/records?start=YYYY-MM-DD&end=YYYY-MM-DD` | 指定範囲（両端含む）のみを返す（カレンダービュー用）。 |

`:date` は `YYYY-MM-DD` 形式。データはクライアントのローカル日付で保存されるため、タイムゾーンの異なる端末からアクセスする場合は注意。

### CSV フォーマット

`time-blocked-todo-YYYY-MM-DD.csv` というファイル名でダウンロード。UTF-8 BOM 付き。

```
date,session,start,end,task,status
2026-05-01,1,08:00,10:00,"原稿のたたき作成",achieved
2026-05-01,3,12:00,14:00,"打ち合わせ移動",off
```

`status` カラムは `achieved` / `off` / 空文字（記入のみ未判定）。記入も状態もない空セッションは行に含まれない。

## 注意

- 認証はなし。同じURLにアクセスする全員が同じデータを共有する個人用ツールを想定している。多人数で使う場合はBasic認証や Cloudflare Access を上に重ねる前提。
