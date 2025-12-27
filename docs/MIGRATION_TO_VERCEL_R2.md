# Vercel + Cloudflare R2 + Firebase 移行ガイド

## 📋 概要

このドキュメントは、コスト削減のためにFirebase HostingからVercel、Firebase StorageからCloudflare R2への移行手順を説明します。

## 🎯 移行後の構成

```
┌─────────────────┐
│   Next.js App   │
│   (Vercel)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│Firebase│ │Cloudflare│
│Firestore│ │   R2     │
│Functions│ │(Storage) │
└────────┘ └──────────┘
```

### サービス分担

- **Vercel**: Next.jsアプリのホスティング（無料プランあり）
- **Cloudflare R2**: ファイルストレージ（Firebase Storageより大幅に安価）
- **Firebase Firestore**: データベース（継続使用）
- **Firebase Functions**: バックエンド処理（継続使用）

## 📦 必要なパッケージ

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**注意**: パッケージは既に`package.json`に追加済みです。以下のコマンドでインストールしてください：

```bash
npm install
```

## 🔧 セットアップ手順

### 1. Cloudflare R2のセットアップ

1. **Cloudflareダッシュボードにログイン**
   - https://dash.cloudflare.com/

2. **R2ストレージを作成**
   - R2 → Create bucket
   - バケット名を設定（例: `emolink-cms-storage`）

3. **APIトークンの作成**
   - R2 → Manage R2 API Tokens → Create API Token
   - 以下の権限を付与:
     - Object Read & Write
   - Access Key ID と Secret Access Key をメモ

4. **パブリックドメインの設定（オプション）**
   - R2 → バケット選択 → Settings → Public Access
   - Custom Domain を設定（例: `https://pub-xxxxx.r2.dev`）
   - または、Cloudflare Workersでカスタムドメインを設定

### 2. 環境変数の設定

#### ローカル開発環境（`.env.local`）

```bash
# ストレージプロバイダーをR2に設定
NEXT_PUBLIC_STORAGE_PROVIDER=r2

# Cloudflare R2設定
NEXT_PUBLIC_R2_ACCOUNT_ID=your-r2-account-id
NEXT_PUBLIC_R2_BUCKET_NAME=emolink-cms-storage
NEXT_PUBLIC_R2_PUBLIC_DOMAIN=https://pub-xxxxx.r2.dev
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key

# Firebase設定（継続使用）
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
# ... その他のFirebase設定
```

#### Vercel環境変数

1. **Vercelダッシュボードにログイン**
   - https://vercel.com/dashboard

2. **プロジェクト設定 → Environment Variables**
   - 上記の環境変数を全て追加
   - **重要**: `R2_ACCESS_KEY_ID` と `R2_SECRET_ACCESS_KEY` は**Secret**として設定

3. **環境ごとに設定**
   - Production, Preview, Development それぞれに設定

### 3. パッケージのインストール

```bash
npm install
```

これにより、`@aws-sdk/client-s3`と`@aws-sdk/s3-request-presigner`がインストールされます。

### 4. Vercelへのデプロイ

#### 初回デプロイ

```bash
# Vercel CLIをインストール（未インストールの場合）
npm i -g vercel

# プロジェクトにログイン
vercel login

# デプロイ
vercel

# 本番環境にデプロイ
vercel --prod
```

#### GitHub連携（推奨）

1. Vercelダッシュボード → Add New Project
2. GitHubリポジトリを選択
3. ビルド設定を確認:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. 環境変数を設定
5. Deploy

### 5. Firebase Functionsの継続使用

Firebase Functionsは引き続き使用します。以下の機能はFirebase Functionsで動作します:

- Stripe Webhook
- メール送信（sendLoginEmail）
- クレーム処理（claimSetUrls）

Firebase Functionsのデプロイ:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

## 🔧 実装の詳細

### APIルート経由のアップロード

R2へのアップロードはセキュリティ上の理由から、クライアントサイドから直接行うことはできません。そのため、`/api/upload` APIルート経由でアップロードします。

- **アップロード**: `/api/upload` (実装済み)
- **削除**: `/api/upload/delete` (TODO: 実装が必要)
- **一覧取得**: `/api/upload/list` (TODO: 実装が必要)
- **サイズ取得**: `/api/upload/size` (TODO: 実装が必要)

現在、アップロード機能は実装済みですが、削除・一覧取得・サイズ取得のAPIルートは今後実装が必要です。

## 🔄 ストレージプロバイダーの切り替え

環境変数 `NEXT_PUBLIC_STORAGE_PROVIDER` で切り替え可能:

- `firebase`: Firebase Storageを使用（デフォルト）
- `r2`: Cloudflare R2を使用

```bash
# R2を使用
NEXT_PUBLIC_STORAGE_PROVIDER=r2

# Firebase Storageを使用（フォールバック）
NEXT_PUBLIC_STORAGE_PROVIDER=firebase
```

## 📊 コスト比較

### Firebase Storage（従量課金）
- ストレージ: $0.026/GB/月
- ダウンロード: $0.12/GB
- アップロード: 無料

### Cloudflare R2
- ストレージ: $0.015/GB/月（約42%削減）
- ダウンロード: **無料**（大幅削減）
- アップロード: 無料

### Vercel（無料プラン）
- 帯域幅: 100GB/月
- ビルド: 6000分/月
- 関数実行: 100GB時間/月

## ⚠️ 注意事項

### 1. R2のパブリックアクセス

R2はデフォルトでプライベートです。パブリックアクセスを有効にするには:

- カスタムドメインを設定
- または、Cloudflare Workersでプロキシを設定

### 2. CORS設定

R2バケットでCORSを設定する必要があります:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 3. 既存ファイルの移行

既存のFirebase StorageのファイルをR2に移行する場合:

1. Firebase Storageからファイルをダウンロード
2. R2にアップロード
3. Firestoreの`storagePath`を更新

（移行スクリプトは別途作成が必要）

## 🧪 テスト手順

1. **ローカル環境でテスト**
   ```bash
   npm run dev
   ```
   - ファイルアップロードが正常に動作するか確認
   - R2にファイルが保存されるか確認

2. **Vercelプレビュー環境でテスト**
   - GitHubにpushして自動デプロイ
   - プレビューURLで動作確認

3. **本番環境でテスト**
   - 小規模なファイルでテスト
   - 問題なければ本番切り替え

## 🔍 トラブルシューティング

### R2へのアップロードが失敗する

- 環境変数が正しく設定されているか確認
- R2 APIトークンの権限を確認
- CORS設定を確認

### ファイルURLが取得できない

- `NEXT_PUBLIC_R2_PUBLIC_DOMAIN` が正しく設定されているか確認
- R2バケットのパブリックアクセス設定を確認

### Vercelデプロイが失敗する

- ビルドログを確認
- 環境変数が全て設定されているか確認
- Node.jsバージョンを確認（20以上）

## 📝 チェックリスト

- [ ] Cloudflare R2バケット作成
- [ ] R2 APIトークン作成
- [ ] 環境変数設定（ローカル）
- [ ] 環境変数設定（Vercel）
- [ ] パッケージインストール
- [ ] ローカル環境でテスト
- [ ] Vercelにデプロイ
- [ ] 本番環境でテスト
- [ ] 既存ファイルの移行（必要に応じて）

## 🔗 参考リンク

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Vercel Documentation](https://vercel.com/docs)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)

---

**最終更新日**: 2025-01-XX  
**バージョン**: 1.0

