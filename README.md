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

## デプロイ — ダッシュボードだけで完結する手順

ターミナルや `wrangler` を使わず、Cloudflare のダッシュボード（ブラウザ）だけでデプロイする手順。**この章だけで本番運用に到達できる。** ローカル動作確認をしたい場合のみ次章「ローカル開発」を読む。

### 事前に揃えておくもの

- Cloudflare アカウント（無料プランで可）— https://dash.cloudflare.com/sign-up
- このリポジトリが GitHub にある状態（このプロジェクトはすでに GitHub に push 済み）

### 手順 1: KV ネームスペースを作る（ブラウザ）

KV は Cloudflare のキー・バリュー型ストレージ。ここに記録データが入る。

1. ブラウザで https://dash.cloudflare.com を開いてログイン。
2. 左サイドバーの **Workers & Pages** をクリック。
3. ページ上部のタブのうち **KV** をクリック。
   - もし左サイドバーに直接 **Storage & Databases** → **KV** がある UI バージョンならそちらでも同じ。
4. 右上の **Create a namespace**（または **Create namespace**）をクリック。
5. 入力欄に `RECORDS` と入れて **Add** をクリック。
6. 一覧に `RECORDS` という行が追加される。これで KV 作成は完了。ID は後の手順では使わないので覚えなくて良い（次の手順で名前から選ぶ）。

### 手順 2: GitHub リポジトリを Pages に接続する

1. 左サイドバー **Workers & Pages** に戻る。
2. **Create application** をクリック → **Pages** タブを選択 → **Connect to Git** をクリック。
3. **GitHub** を選び、Cloudflare に GitHub アクセスを許可する画面で承認。リポジトリ単位で許可可能。
4. リポジトリ一覧から `Sessions`（このリポジトリ）を選び **Begin setup** をクリック。
5. **Set up builds and deployments** 画面で次のように入力:

   | 項目 | 値 |
   | --- | --- |
   | Project name | 任意（例: `time-blocked-todo`）。これがサブドメインになる。 |
   | Production branch | デプロイしたいブランチ名。`claude/time-blocked-todo-app-0orim` を本番にするならそれ、`main` にマージしてからにするなら `main`。 |
   | Framework preset | **None** |
   | Build command | **空欄のまま** |
   | Build output directory | `public` |
   | Root directory (advanced) | 空欄のまま |

6. 一番下の **Save and Deploy** をクリック。
7. ビルドログが流れて 1 分程度で「Success!」と表示される。`https://<project-name>.pages.dev` という URL がもらえる。
   - **この時点ではまだ KV をつないでいないので、UI は表示されるが API が 500 になる。** 続けて手順 3 で繋ぐ。

### 手順 3: KV を Pages プロジェクトにバインドする

「Pages Functions の中で `env.RECORDS` という名前で KV を使えるようにする」設定。

1. 左サイドバー **Workers & Pages** → 一覧から作ったプロジェクト（例 `time-blocked-todo`）をクリック。
2. 上部タブの **Settings** をクリック。
3. 左カラムから **Functions** を選択。
4. 下にスクロールして **KV namespace bindings** セクションを探す → **Add binding** をクリック。
5. 入力:
   - **Variable name**: `RECORDS`（**この文字列のまま。コードがこの名前で参照している**）
   - **KV namespace**: ドロップダウンから手順 1 で作った `RECORDS` を選ぶ
6. **Save** をクリック。
7. 同じ画面の上のほうにある環境切替（**Production / Preview**）が **Preview** 側にも切り替えて、4〜6 を同じ内容でもう一度実施する。
   - こうすると PR ごとの preview deployment でも KV が読める。

### 手順 4: 再デプロイして反映

KV バインディングは「**次のデプロイから**」有効になるため、いま動いているデプロイにはまだ効いていない。再デプロイする。

**ダッシュボードでやる場合:**

1. プロジェクトページ → **Deployments** タブ。
2. 最新デプロイ行の右端 **⋯ (More actions)** → **Retry deployment** をクリック。

**ローカルから空コミットを push する場合:**

```bash
git commit --allow-empty -m "Apply KV binding"
git push
```

push を契機に自動で再デプロイが走る。

### 手順 5: 動作確認

- ブラウザで `https://<project-name>.pages.dev` を開く。
- セッションタブの「取り組む内容」に何か書いて textarea からフォーカスを外す → 数秒待って **ページをリロード**しても入力が残っていれば KV 保存成功。
- 別の端末（スマホなど）から同じ URL を開き、同じ内容が見えれば同期 OK。
- うまく行かない場合は DevTools (F12) → Network タブで `/api/records/YYYY-MM-DD` のレスポンスを確認:
  - **500 + `KV binding "RECORDS" is not configured.`** → 手順 3 の Variable name が `RECORDS` になっていない、または手順 4 の再デプロイをしていない。
  - **200 だが `{}`** → 正常。データ未入力なだけ。

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

3. **使う KV ネームスペースの ID を確認**

   ダッシュボードでもう作っているなら、それを再利用する。新規に CLI から作る場合は次の節を参照。

   - ブラウザ: **Workers & Pages** → **KV** → `RECORDS` 行の **ID** カラムに 32 文字の 16 進文字列がある。これをコピー。

4. **`wrangler.toml` を編集**

   テキストエディタで `wrangler.toml` を開き、`[[kv_namespaces]]` セクションを次のように書き換える:

   ```toml
   [[kv_namespaces]]
   binding = "RECORDS"
   id = "ここに手順3でコピーしたIDを貼る"
   preview_id = "ここにも同じIDを貼ってOK"
   ```

   - `id` はリモートのリソース識別子であって秘密情報ではないので、コミットしても問題ない。
   - `preview_id` はローカルの `wrangler pages dev` で使われる。本番と分けたければ別の KV を作って ID を入れる。

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

> **重要:** CLI から deploy しても、**本番 Functions が読む KV バインディングは「ダッシュボード側の Pages プロジェクト設定」**。`wrangler.toml` のバインディングはローカルの `wrangler pages dev` 用にしか効かない。CLI デプロイの場合も上の「ダッシュボードだけで完結する手順」の **手順 3（KV を Pages プロジェクトにバインド）** は必要。

### よくあるハマりどころ

| 症状 | 原因 / 対処 |
| --- | --- |
| 本番 `/api/records/...` が 500 で `KV binding "RECORDS" is not configured.` | ダッシュボード手順 3 の KV バインディングが未設定、または 4 の再デプロイをしていない。Variable name が `RECORDS`（大文字）になっているか確認。 |
| ローカル `npm run dev` 起動時に KV エラー | `wrangler.toml` の `id` / `preview_id` が `REPLACE_WITH_...` のまま。実 ID に貼り替える。 |
| `npx wrangler login` でブラウザが開かない | SSH 経由などで GUI が無い環境。表示される URL を手元 PC のブラウザで開く。 |
| `wrangler pages deploy` が「project not found」 | `--project-name <name>` を指定するか、初回対話で新規作成する。 |
| 別端末から見たら違う日のデータ | アプリは「クライアント端末のローカル日付」をキーにする。深夜帯やタイムゾーン違いで日付がズレる可能性あり。 |
| Build output directory を間違えた | プロジェクトページ → **Settings** → **Builds & deployments** → **Build configurations** → **Edit** から `public` に修正して再デプロイ。 |

## API

| Method | Path | 説明 |
| --- | --- | --- |
| GET | `/api/records/:date` | 指定日の `{ session1: { task, achieved }, ... }` を返す |
| PUT | `/api/records/:date` | body `{ session: 1–6, task?: string, achieved?: boolean }` で部分更新 |

`:date` は `YYYY-MM-DD` 形式。データはクライアントのローカル日付で保存されるため、タイムゾーンの異なる端末からアクセスする場合は注意。

## 注意

- 認証はなし。同じURLにアクセスする全員が同じデータを共有する個人用ツールを想定している。多人数で使う場合はBasic認証や Cloudflare Access を上に重ねる前提。
