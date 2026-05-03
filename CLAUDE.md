# photo-share-cf

## プロジェクト概要
iPhoneで撮影した写真を社内メンバーでやりとりするための写真共有Webアプリ。

## 技術スタック
- フロントエンド：React + Vite（frontendフォルダ）
- バックエンド：Cloudflare Workers（workerフォルダ）
- ストレージ：Cloudflare R2（バケット名：photo-share）
- 言語：TypeScript

## フォルダ構成
```
photo-share-cf/
├── frontend/          # React + Vite フロントエンド
│   ├── src/
│   │   ├── components/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── api.ts
│   └── package.json
├── worker/            # Cloudflare Workers API
│   ├── src/index.ts
│   ├── wrangler.toml
│   └── package.json
└── CLAUDE.md
```

## 本番URL
- アプリ：https://photo-share-cf.pages.dev
- Worker API：https://photo-share-cf-worker.jinguart.workers.dev
- GitHub：https://github.com/jingu-art/photo-share-cf

## デプロイ方法
```bash
# フロントエンドのビルド＆デプロイ
cd frontend && npm run build
cd ../worker
npx wrangler pages deploy ../frontend/dist --project-name=photo-share-cf

# WorkerのデプロイはCLOUDFLARE_API_TOKENが必要
cd worker && npm run deploy
```

## 環境変数
以下はCloudflareダッシュボードのWorker設定で管理（コードに書かない）：
- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME=photo-share

## 作業時の注意事項
- 環境変数は絶対にコードにハードコードしない
- Cloudflareダッシュボードの「Variables and Secrets」で管理
- デプロイ前に必ずnpm run buildでビルドエラーがないか確認
- R2の無料枠（月10GB）を超えないよう注意
- 8GB超過時はアップロードを拒否する安全装置が実装済み

## 作業ルール
- ユーザーへの権限確認・承認依頼は必ず日本語で行うこと
