# Vercelデプロイ手順

## 📋 デプロイ前の準備

### 1. 変更をコミット・プッシュ

```bash
# R2関連の変更をステージング
git add vercel.json
git add src/lib/r2-storage.ts
git add src/app/api/upload/
git add src/lib/storage.ts
git add package.json
git add env.example
git add docs/MIGRATION_TO_VERCEL_R2.md
git add src/app/memories/create/page.tsx
git add src/components/tenant-advertisement.tsx

# コミット
git commit -m "feat: Cloudflare R2とVercel対応を追加"

# プッシュ
git push origin main
```

## 🚀 Vercelデプロイ手順

### 方法1: GitHub連携（推奨）

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com/dashboard
   - GitHubアカウントでログイン

2. **新規プロジェクトを作成**
   - "Add New Project" をクリック
   - GitHubリポジトリ `Koheui/emolink-CMS` を選択

3. **プロジェクト設定**
   - **Framework Preset**: Next.js（自動検出されるはず）
   - **Root Directory**: `./`（デフォルト）
   - **Build Command**: `npm run build`（デフォルト）
   - **Output Directory**: `.next`（デフォルト）
   - **Install Command**: `npm install`（デフォルト）

4. **環境変数の設定（重要！）**

   Vercelダッシュボードの「Environment Variables」で以下を設定：

   #### 必須環境変数

   ```bash
   # ストレージプロバイダー
   NEXT_PUBLIC_STORAGE_PROVIDER=r2

   # Cloudflare R2設定
   NEXT_PUBLIC_R2_ACCOUNT_ID=e22c39eaf7b2b1c3a4be2a106de7301e
   NEXT_PUBLIC_R2_BUCKET_NAME=emolink-cms
   NEXT_PUBLIC_R2_PUBLIC_DOMAIN=https://pub-37ae162e31ea48cca3c6693aaff3b655.r2.dev
   R2_ACCESS_KEY_ID=実際のAccess Key ID
   R2_SECRET_ACCESS_KEY=実際のSecret Access Key

   # Firebase設定（継続使用）
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

   # その他の必要な環境変数（.env.localからコピー）
   ```

   **重要**: 
   - `R2_ACCESS_KEY_ID` と `R2_SECRET_ACCESS_KEY` は**Secret**として設定
   - Production, Preview, Development すべての環境に設定

5. **デプロイ**
   - "Deploy" をクリック
   - ビルドが完了するまで待つ（数分）

### 方法2: Vercel CLI

```bash
# Vercel CLIをインストール（未インストールの場合）
npm i -g vercel

# プロジェクトにログイン
vercel login

# 初回デプロイ（プレビュー環境）
vercel

# 本番環境にデプロイ
vercel --prod
```

## ✅ デプロイ後の確認

1. **ビルドログを確認**
   - Vercelダッシュボードでビルドログを確認
   - エラーがないか確認

2. **動作確認**
   - デプロイされたURLにアクセス
   - ファイルアップロードをテスト
   - R2にファイルが保存されることを確認

3. **CORS設定の確認**
   - Cloudflare R2のCORSポリシーに、Vercelのドメインを追加
   - 例: `https://your-project.vercel.app`

## 🔧 トラブルシューティング

### ビルドエラーが発生する場合

- Node.jsバージョンを確認（20以上が必要）
- 環境変数が正しく設定されているか確認
- ビルドログを確認してエラー内容を特定

### アップロードが失敗する場合

- R2の環境変数が正しく設定されているか確認
- CORS設定を確認
- ブラウザのコンソールでエラーを確認

### 環境変数が反映されない場合

- 環境変数を設定後、再デプロイが必要
- Production/Preview/Developmentでそれぞれ設定が必要

## 📝 参考

- [Vercel Documentation](https://vercel.com/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)

