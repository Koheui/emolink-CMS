# Firebase Hosting から Vercel への移行記録

**作成日**: 2025-01-XX  
**移行完了日**: 2025-01-XX  
**バージョン**: 1.0

## 📋 移行概要

このドキュメントは、emolink CMSをFirebase HostingからVercelへ移行した際の記録です。LP（ランディングページ）から新規顧客登録時にVercelのCMSへ案内するため、移行内容を記録しています。

## 🎯 移行の目的

1. **コスト削減**: Vercel無料プラン + Cloudflare R2で運用コストを削減
2. **パフォーマンス向上**: VercelのCDNによる高速な配信
3. **開発体験の向上**: GitHub連携による自動デプロイ

## 🔄 移行前後の構成

### 移行前（Firebase Hosting）
```
┌─────────────┐
│  Next.js    │
│  (Firebase  │
│  Hosting)   │
└──────┬──────┘
       │
       ├── Firebase Storage（ファイル保存）
       ├── Firestore（データベース）
       └── Firebase Functions（バックエンド）
```

**URL**: `https://emolink-cms.web.app` または `https://emolink-cms.firebaseapp.com`

### 移行後（Vercel + R2 + Firebase）
```
┌─────────────┐
│  Next.js    │
│  (Vercel)   │
└──────┬──────┘
       │
    ┌──┴──┐
    │     │
    ▼     ▼
┌────────┐ ┌──────────┐
│Firebase│ │Cloudflare│
│Firestore│ │   R2     │
│Functions│ │(Storage) │
└────────┘ └──────────┘
```

**URL**: `https://emolink-cms-git-main-future-studios-projects.vercel.app`  
**本番URL**: （カスタムドメインを設定する場合）

## 🎯 サービス別の使い分け

### 1. **Vercel** - Next.jsアプリのホスティング

**役割**:
- Next.jsアプリケーションのホスティングとCDN配信
- APIルート（`/api/*`）の実行環境
- 自動ビルドとデプロイ（GitHub連携）

**使用箇所**:
- Next.jsアプリ全体のホスティング
- `/api/upload` など、Next.js APIルート
- 静的ファイルの配信

**メリット**:
- 無料プランで開始可能（帯域幅100GB/月、ビルド6000分/月）
- GitHub連携による自動デプロイ
- グローバルCDNによる高速配信
- プレビューデプロイ機能

**設定方法**:
- `vercel.json`で設定
- 環境変数はVercelダッシュボードで管理

---

### 2. **Cloudflare R2** - ファイルストレージ

**役割**:
- 画像、動画、音声ファイルなどの静的アセットの保存
- 公開ファイルの配信（パブリックURL経由）

**使用箇所**:
- ユーザーがアップロードするメディアファイル（画像、動画、音声）
- 公開ページで表示されるコンテンツ
- アクリルスタンド用の写真

**メリット**:
- **コスト削減**: ストレージ $0.015/GB/月（Firebase Storageの$0.026/GB/月より約42%安価）
- **ダウンロード無料**: データ転送が無料（Firebase Storageは$0.12/GB）
- S3互換APIによる高い互換性
- グローバルCDN統合（カスタムドメイン設定時）

**設定方法**:
- 環境変数で設定:
  ```bash
  NEXT_PUBLIC_STORAGE_PROVIDER=r2
  NEXT_PUBLIC_R2_ACCOUNT_ID=...
  NEXT_PUBLIC_R2_BUCKET_NAME=...
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
  ```
- `src/lib/r2-storage.ts`で実装
- `src/app/api/upload/route.ts`でAPIルート経由でアップロード

**切り替え方法**:
- 環境変数 `NEXT_PUBLIC_STORAGE_PROVIDER` で `firebase` と `r2` を切り替え可能

---

### 3. **Firebase Firestore** - データベース

**役割**:
- アプリケーションのデータベース
- ユーザー情報、メモリデータ、注文情報などの保存

**使用箇所**:
- `memories`コレクション（想い出ページデータ）
- `claimRequests`コレクション（認証リクエスト）
- `orders`コレクション（注文情報）
- `users`コレクション（ユーザー情報）
- `publicPages`コレクション（公開ページ情報）

**メリット**:
- リアルタイム同期機能
- スケーラブルなNoSQLデータベース
- Firebase Authとの統合が容易
- セキュリティルールによるアクセス制御

**継続使用の理由**:
- 既存のデータ構造と整合性
- Firebase Authとの統合
- リアルタイム更新機能
- セキュリティルールによる細かいアクセス制御

---

### 4. **Firebase Functions** - バックエンド処理

**役割**:
- サーバーサイドの処理実行
- メール送信
- Stripe決済のWebhook処理

**使用箇所**:
- **Stripe Webhook**: `stripeWebhook`関数
  - Stripeからの決済通知を受け取り、注文状態を更新
- **メール送信**: `sendLoginEmail`関数
  - ユーザーへのログインリンクメール送信
- **クレーム処理**: `claimSetUrls`関数
  - 認証成功時に公開ページURLを設定

**継続使用の理由**:
- 既存の実装が動作している
- メール送信など、サーバーサイド処理に適している
- Firebase Auth、Firestoreとの統合が容易
- セキュアな処理実行環境

**デプロイ方法**:
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

---

### 5. **Firebase Auth** - ユーザー認証

**役割**:
- ユーザーの認証・認可
- メールリンク認証
- セッション管理

**使用箇所**:
- ユーザーログイン・ログアウト
- メールリンク認証（`/claim`ページ）
- セッション管理

**継続使用の理由**:
- 既存の実装が動作している
- Firestoreとの統合
- セキュアな認証機能

---

## 📊 サービス選択の基準

### どのサービスを使うべきか？

| 用途 | 使用サービス | 理由 |
|------|------------|------|
| **Next.jsアプリのホスティング** | **Vercel** | 無料プラン、自動デプロイ、高速CDN |
| **メディアファイル（画像・動画・音声）の保存** | **Cloudflare R2** | コスト削減（約42%）、ダウンロード無料 |
| **データベース（ユーザー、メモリ、注文など）** | **Firebase Firestore** | 既存実装、リアルタイム同期、Auth統合 |
| **バックエンド処理（メール送信、Webhook）** | **Firebase Functions** | 既存実装、Firebase統合、セキュアな処理 |
| **ユーザー認証** | **Firebase Auth** | 既存実装、Firestore統合、セキュア |

### データフロー例

#### ファイルアップロードの流れ
```
[ユーザー] → [Next.js (Vercel)] → [/api/upload] → [Cloudflare R2] → [公開URL]
                                                     ↓
                                            [Firestore] (メタデータ保存)
```

#### 認証フロー
```
[ユーザー] → [Next.js (Vercel)] → [Firebase Auth] → [Firestore] (ユーザー情報)
                                           ↓
                                    [Firebase Functions] (メール送信)
```

#### 決済フロー
```
[Stripe] → [Firebase Functions (Webhook)] → [Firestore] (注文状態更新)
```

---

## 💰 コスト比較

### ストレージ（ファイル保存）

| サービス | ストレージ料金 | ダウンロード料金 | 月額見積もり（100GB使用、10GBダウンロード） |
|---------|--------------|----------------|-------------------------------------------|
| **Firebase Storage** | $0.026/GB | $0.12/GB | $2.60 + $1.20 = **$3.80/月** |
| **Cloudflare R2** | $0.015/GB | **無料** | $1.50 + $0 = **$1.50/月** |

**削減額**: 約60%削減（$3.80 → $1.50）

### ホスティング

| サービス | 無料プラン | 従量課金 |
|---------|-----------|---------|
| **Firebase Hosting** | 10GB/日 | $0.026/GB超過分 |
| **Vercel** | 100GB/月、6000分ビルド/月 | 超過分は有料 |

---

## 🔄 移行戦略

### 段階的な移行

1. **Phase 1: ホスティング移行** ✅ 完了
   - Firebase Hosting → Vercel
   - 既存のFirebase Storage、Firestore、Functionsは継続使用

2. **Phase 2: ストレージ移行** ✅ 完了
   - Firebase Storage → Cloudflare R2
   - 新規アップロードのみR2に保存
   - 既存ファイルはFirebase StorageのURLで継続利用可能

3. **Phase 3: 完全移行（将来）**
   - 既存ファイルをR2に移行（必要に応じて）
   - Firebase Storageの完全廃止

### 切り替え可能な設計

環境変数 `NEXT_PUBLIC_STORAGE_PROVIDER` で、Firebase StorageとR2を切り替え可能：

```bash
# R2を使用（現在）
NEXT_PUBLIC_STORAGE_PROVIDER=r2

# Firebase Storageを使用（フォールバック）
NEXT_PUBLIC_STORAGE_PROVIDER=firebase
```

これにより、問題が発生した場合でも迅速にFirebase Storageに戻すことができます。

## 📝 主な変更内容

### 1. ホスティングプロバイダーの変更

- **変更前**: Firebase Hosting
- **変更後**: Vercel
- **リポジトリ**: `https://github.com/Koheui/emolink-CMS`

### 2. ストレージプロバイダーの変更

- **変更前**: Firebase Storage
- **変更後**: Cloudflare R2
- **切り替え方法**: 環境変数 `NEXT_PUBLIC_STORAGE_PROVIDER=r2`

### 3. 設定ファイルの追加・変更

#### 追加されたファイル
- `vercel.json`: Vercelの設定ファイル
- `src/lib/r2-storage.ts`: Cloudflare R2用のストレージライブラリ
- `src/app/api/upload/route.ts`: R2へのアップロード用APIルート

#### 変更されたファイル
- `src/lib/storage.ts`: R2とFirebase Storageの切り替え機能を追加
- `tsconfig.json`: `functions`ディレクトリを除外
- `next.config.mjs`: webpack設定で`functions`ディレクトリを無視
- `package.json`: `@aws-sdk/client-s3`と`@aws-sdk/s3-request-presigner`を追加

### 4. 環境変数の変更

#### 追加された環境変数
```bash
# ストレージプロバイダー選択
NEXT_PUBLIC_STORAGE_PROVIDER=r2

# Cloudflare R2設定
NEXT_PUBLIC_R2_ACCOUNT_ID=e22c39eaf7b2b1c3a4be2a106de7301e
NEXT_PUBLIC_R2_BUCKET_NAME=emolink-cms
NEXT_PUBLIC_R2_PUBLIC_DOMAIN=https://pub-37ae162e31ea48cca3c6693aaff3b655.r2.dev
R2_ACCESS_KEY_ID=<実際のAccess Key ID>
R2_SECRET_ACCESS_KEY=<実際のSecret Access Key>
```

#### 継続使用される環境変数
```bash
# Firebase設定（Firestore、Auth、Functions用）
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
# ... その他のFirebase設定
```

## 🔗 URL変更

### LP側で更新が必要なURL

#### 認証成功後のリダイレクトURL

**変更前**:
```
https://emolink-cms.web.app/claim
```

**変更後**:
```
https://emolink-cms-git-main-future-studios-projects.vercel.app/claim
```

または、カスタムドメインを設定した場合:
```
https://<カスタムドメイン>/claim
```

#### CMS管理画面URL

**変更前**:
```
https://emolink-cms.web.app/dashboard
```

**変更後**:
```
https://emolink-cms-git-main-future-studios-projects.vercel.app/dashboard
```

## 🔧 環境変数の設定方法

### Vercelダッシュボードでの設定

1. Vercelダッシュボードにアクセス
2. プロジェクト選択 → Settings → Environment Variables
3. 以下の環境変数を追加：

#### 必須環境変数（Production, Preview, Developmentすべてに設定）

```bash
# ストレージプロバイダー
NEXT_PUBLIC_STORAGE_PROVIDER=r2

# Cloudflare R2設定
NEXT_PUBLIC_R2_ACCOUNT_ID=e22c39eaf7b2b1c3a4be2a106de7301e
NEXT_PUBLIC_R2_BUCKET_NAME=emolink-cms
NEXT_PUBLIC_R2_PUBLIC_DOMAIN=https://pub-37ae162e31ea48cca3c6693aaff3b655.r2.dev
R2_ACCESS_KEY_ID=<実際のAccess Key ID>  # Secretとして設定
R2_SECRET_ACCESS_KEY=<実際のSecret Access Key>  # Secretとして設定

# Firebase設定（継続使用）
NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase API Key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<Firebase Auth Domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<Firebase Project ID>
# ... その他のFirebase設定
```

**重要**: 
- `R2_ACCESS_KEY_ID` と `R2_SECRET_ACCESS_KEY` は**Secret**として設定
- Production, Preview, Developmentすべての環境に設定

## 🚀 デプロイ手順

### 初回デプロイ（GitHub連携）

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com/dashboard
   - GitHubアカウントでログイン

2. **新規プロジェクトを作成**
   - "Add New Project" をクリック
   - GitHubリポジトリ `Koheui/emolink-CMS` を選択

3. **プロジェクト設定**
   - Framework Preset: Next.js（自動検出）
   - Root Directory: `./`（デフォルト）
   - Build Command: `npm run build`（デフォルト）
   - Output Directory: `.next`（デフォルト）

4. **環境変数を設定**
   - Settings → Environment Variables
   - 上記の環境変数を全て追加

5. **デプロイ**
   - "Deploy" をクリック
   - ビルドが完了するまで待つ（数分）

### 今後のデプロイ

GitHubの`main`ブランチにpushすると、自動的にデプロイされます：

```bash
git add .
git commit -m "変更内容"
git push origin main
```

## 🔄 LP側での対応が必要な変更

### 1. リダイレクトURLの更新

LP側のコードで、認証成功後のリダイレクトURLを更新する必要があります。

#### 変更前のURL
```
https://emolink-cms.web.app/claim
```
または
```
https://emolink-cms.firebaseapp.com/claim
```

#### 変更後のURL（Vercel）
```
https://emolink-cms-git-main-future-studios-projects.vercel.app/claim
```

#### 実装例

**環境変数を使用する場合（推奨）**:
```javascript
// .env（開発環境）
VITE_CMS_CLAIM_URL=https://emolink-cms-git-main-future-studios-projects.vercel.app/claim
VITE_CMS_DASHBOARD_URL=https://emolink-cms-git-main-future-studios-projects.vercel.app/dashboard

// LP側のコード
const CMS_CLAIM_URL = import.meta.env.VITE_CMS_CLAIM_URL || 'https://emolink-cms-git-main-future-studios-projects.vercel.app/claim';
const CMS_DASHBOARD_URL = import.meta.env.VITE_CMS_DASHBOARD_URL || 'https://emolink-cms-git-main-future-studios-projects.vercel.app/dashboard';
```

**直接指定する場合**:
```javascript
// 変更前
const CMS_CLAIM_URL = 'https://emolink-cms.web.app/claim';

// 変更後
const CMS_CLAIM_URL = 'https://emolink-cms-git-main-future-studios-projects.vercel.app/claim';
```

#### 更新が必要な箇所

1. **認証リンクの生成**
   ```javascript
   // 変更前
   const claimLink = `https://emolink-cms.web.app/claim?k=${jwtToken}`;
   
   // 変更後
   const claimLink = `${CMS_CLAIM_URL}?k=${jwtToken}`;
   ```

2. **CMS APIエンドポイント**
   ```javascript
   // 変更前
   const apiUrl = 'https://emolink-cms.web.app/api/lp-form';
   
   // 変更後
   const apiUrl = `${CMS_CLAIM_URL.replace('/claim', '/api/lp-form')}`;
   // または
   const apiUrl = 'https://emolink-cms-git-main-future-studios-projects.vercel.app/api/lp-form';
   ```

### 2. CORS設定の確認

LP側からVercelのCMS APIにアクセスする場合、CORS設定を確認：

- VercelのAPIルートは自動的にCORSを処理します
- 必要に応じて、APIルートでCORSヘッダーを明示的に設定
- LP側のオリジンがCORS許可リストに含まれているか確認

#### 現在のCORS設定（APIルート側）

`src/app/api/lp-form/route.ts`で、以下のようにオリジンをチェックしています：

```typescript
// 許可されるオリジンのリスト（環境変数から取得）
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [];

// LP側のオリジンが許可リストに含まれているかチェック
const origin = request.headers.get('origin');
if (origin && !allowedOrigins.includes(origin)) {
  return NextResponse.json({ error: 'CORS policy violation' }, { status: 403 });
}
```

**LP側のオリジンを環境変数に追加する必要がある場合**:

Vercelの環境変数に以下を追加：
```bash
CORS_ALLOWED_ORIGINS=https://lp-domain1.com,https://lp-domain2.com,http://localhost:3000
```

### 3. カスタムドメインの設定（推奨）

本番環境では、カスタムドメインを設定することを推奨します：

1. Vercelダッシュボード → Settings → Domains
2. カスタムドメインを追加（例: `cms.emolink.jp`）
3. DNS設定を更新

カスタムドメインを設定した場合、LP側のURLも更新が必要です。

## ⚠️ 注意事項

### 1. Firebase Functionsの継続使用

Firebase Functions（Stripe Webhook、メール送信など）は引き続き使用しています。Firebase Functionsのデプロイは別途必要です：

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### 2. 既存ファイルの移行

- Firebase Storageにある既存ファイルは、そのままFirebase StorageのURLで参照されます
- 新規アップロードはR2に保存されます
- 既存ファイルをR2に移行する場合は、別途移行スクリプトが必要です

### 3. CORS設定（Cloudflare R2）

R2バケットのCORS設定に、Vercelのドメインを追加する必要があります：

Cloudflare R2ダッシュボード → emolink-cms → 設定 → CORS ポリシー

```json
[
  {
    "AllowedOrigins": [
      "https://emolink-cms-git-main-future-studios-projects.vercel.app",
      "https://<カスタムドメイン>"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3000
  }
]
```

### 4. 環境変数の管理

- 機密情報（`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`など）はVercelの環境変数として設定
- `.env.local`は開発環境のみで使用
- 本番環境の環境変数はVercelダッシュボードで管理

## 📊 コスト削減の効果

### 移行前（Firebase中心）
- Firebase Hosting: 従量課金
- Firebase Storage: $0.026/GB/月 + $0.12/GBダウンロード

### 移行後（Vercel + R2）
- Vercel: 無料プラン（帯域幅100GB/月、ビルド6000分/月）
- Cloudflare R2: $0.015/GB/月（約42%削減）、ダウンロード無料
- Firebase Firestore: 継続使用（データベース）
- Firebase Functions: 継続使用（バックエンド処理）

### 期待される削減効果
- **ストレージ**: 約42%削減
- **ダウンロード**: 100%削減
- **ホスティング**: 無料プランで開始可能

## 🔍 トラブルシューティング

### ビルドエラーが発生する場合

- Vercelダッシュボードのビルドログを確認
- 環境変数が全て設定されているか確認
- Node.jsバージョンが20以上であることを確認

### ファイルアップロードが失敗する場合

- R2の環境変数が正しく設定されているか確認
- R2 APIトークンの権限を確認
- CORS設定を確認

### URLが正しくリダイレクトされない場合

- LP側のリダイレクトURLが正しく更新されているか確認
- VercelのデプロイURLを確認
- カスタムドメインを設定している場合は、DNS設定を確認

## 📚 関連ドキュメント

- [Vercel + Cloudflare R2 + Firebase 移行ガイド](./MIGRATION_TO_VERCEL_R2.md)
- [環境変数設定ガイド](../ENVIRONMENT_VARIABLES_SETUP.md)
- [Vercelデプロイ手順](../../VERCEL_DEPLOYMENT.md)

## 🔗 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Firebase Documentation](https://firebase.google.com/docs)

---

**最終更新日**: 2025-01-XX  
**移行担当者**: -  
**レビュー者**: -

