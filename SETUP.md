# photo-share-cf セットアップ手順

## 構成

```
photo-share-cf/
├── worker/        Cloudflare Workers（API・自動削除）
└── frontend/      React + Vite（Cloudflare Pages にデプロイ）
```

---

## 1. 前提条件

- Node.js 18以上
- npm または pnpm
- Cloudflare アカウント（無料プランでOK）
- GitHub アカウント

---

## 2. Cloudflare R2 バケット作成

1. Cloudflare ダッシュボード → **R2** → **バケットを作成**
2. バケット名：`photo-share`（wrangler.tomlと一致させる）
3. リージョン：自動（APAC推奨）

### R2 CORS 設定

バケット → **設定** → **CORS ポリシー** に以下を設定：

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

> **注意**: 本番環境では `AllowedOrigins` を実際のドメインに制限することを推奨します。

---

## 3. R2 APIトークン取得

1. Cloudflare ダッシュボード → **R2** → **APIトークンを管理**
2. **APIトークンを作成**
   - アクセス権：`オブジェクトの読み取りと書き込み`
   - バケット指定：`photo-share`
3. 以下の値を控える：
   - `アカウント ID`（ダッシュボードの右サイドバーにも表示）
   - `アクセスキー ID`
   - `シークレットアクセスキー`

---

## 4. Workers デプロイ

```bash
cd worker
npm install

# ローカル開発用（R2は実際のバケットに接続）
# .dev.vars ファイルを作成：
cat > .dev.vars << EOF
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=photo-share
EOF

npm run dev
# → http://localhost:8787 で起動

# 本番デプロイ
npx wrangler login
npm run deploy
```

### Workers 環境変数の設定（本番）

デプロイ後、Cloudflare ダッシュボード → **Workers & Pages** → `photo-share-cf-worker` → **設定** → **変数** で以下を追加：

| 変数名 | 値 |
|--------|-----|
| `R2_ACCOUNT_ID` | Cloudflare アカウント ID |
| `R2_ACCESS_KEY_ID` | R2 APIキー ID |
| `R2_SECRET_ACCESS_KEY` | R2 シークレットキー |
| `R2_BUCKET_NAME` | `photo-share` |

> シークレットとして登録する場合：`npx wrangler secret put R2_SECRET_ACCESS_KEY`

---

## 5. Cloudflare Pages（フロントエンド）デプロイ

### GitHub 経由でデプロイ

1. `photo-share-cf` リポジトリを GitHub にプッシュ
2. Cloudflare ダッシュボード → **Workers & Pages** → **Pages を作成** → **Git に接続**
3. リポジトリ `photo-share-cf` を選択
4. ビルド設定：

| 項目 | 値 |
|------|-----|
| フレームワークプリセット | Vite |
| ビルドコマンド | `cd frontend && npm install && npm run build` |
| ビルド出力ディレクトリ | `frontend/dist` |
| ルートディレクトリ | `/`（デフォルト）|

5. 環境変数（本番）を追加：

| 変数名 | 値 |
|--------|-----|
| `VITE_API_URL` | Workers の URL（例：`https://photo-share-cf-worker.your-name.workers.dev`） |

6. **保存してデプロイ**

---

## 6. Cron Triggers（自動削除）設定の確認

`wrangler.toml` にすでに設定済み：

```toml
[triggers]
crons = ["0 18 * * *"]  # UTC 18:00 = JST 03:00
```

デプロイ後、Cloudflare ダッシュボード → Workers → `photo-share-cf-worker` → **トリガー** タブで確認できます。

手動テスト：
```bash
npx wrangler dev --test-scheduled
# 別ターミナルで：
curl "http://localhost:8787/__scheduled?cron=0+18+*+*+*"
```

---

## 7. ローカル開発（フロントエンド + Workers 同時起動）

```bash
# ターミナル1：Worker 起動
cd worker
npm install
npm run dev
# → http://localhost:8787

# ターミナル2：フロントエンド起動
cd frontend
npm install
npm run dev
# → http://localhost:5173
# /api/* は自動的に localhost:8787 にプロキシされます
```

---

## 8. GitHub リポジトリ作成とプッシュ

```bash
# プロジェクトルートで
git init
git add .
git commit -m "initial commit"

# GitHub で photo-share-cf リポジトリを新規作成後：
git remote add origin https://github.com/jingu-art/photo-share-cf.git
git branch -M main
git push -u origin main
```

---

## 9. Cloudflare 請求アラートの設定（推奨）

1. Cloudflare ダッシュボード → **通知** → **通知を追加**
2. 種類：**Billing Usage Alert**
3. 閾値：月間 $1 など任意の金額
4. メールアドレスを設定して保存

R2 無料枠：
- ストレージ：10 GB/月
- 書き込み操作：1,000,000 回/月
- 読み取り操作：10,000,000 回/月

本アプリは **8GBを超えたらアップロードを拒否**する安全装置を実装済みです。

---

## 安全装置チェックリスト

- ✅ アップロード前に R2 使用量をチェックし 8GB 超過時はアップロードを拒否
- ✅ 7日経過フォルダの自動削除（Cron Triggers、毎日 JST 3:00）
- ✅ 1ファイルあたり最大 20MB 制限（クライアント側バリデーション）
- ✅ アップロード前にブラウザ側で 1MB 以下に圧縮（Canvas API）
- ✅ サムネイルはアップロード時に 1 回だけ生成（再生成しない）
- ✅ localStorage の stale-while-revalidate キャッシュ（5分 TTL）
- ✅ 無料枠超過時のエラーメッセージ表示・処理停止
- ✅ 請求アラート設定手順（本ドキュメント記載）
