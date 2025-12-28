# Firebase Admin SDK導入ガイド

## 📋 概要

LPフォームAPI（`/api/lp-form`）でFirebase Admin SDKを使用するように修正しました。これにより、Firestoreルールの制約を受けずにデータベースへの書き込みが可能になります。

## ✅ 実施した修正

### 1. パッケージの追加

`package.json`に`firebase-admin`を追加しました。

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

### 2. Firebase Admin SDKの初期化

`src/lib/firebase-admin.ts`を新規作成しました。

**機能**:
- Vercel環境での自動認証情報取得に対応
- 環境変数からの認証情報取得に対応
- 既に初期化されている場合は再初期化しない

### 3. APIルートの修正

`src/app/api/lp-form/route.ts`を修正しました。

**変更内容**:
- クライアントSDK（`firebase/firestore`）からAdmin SDK（`firebase-admin`）に変更
- `addDoc` → `adminDb.collection().add()`に変更
- `serverTimestamp()` → `FieldValue.serverTimestamp()`に変更

## 🔧 環境変数の設定（Vercel）

Vercelダッシュボードで以下の環境変数を設定してください。

### 方法1: 環境変数から認証情報を設定（推奨）

以下の環境変数をVercelダッシュボードで設定：

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**注意**: `FIREBASE_PRIVATE_KEY`は改行文字（`\n`）を含むため、Vercelダッシュボードで設定する際は、実際の改行を含めて設定してください。

### 方法2: サービスアカウントキーファイルのパスを設定

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

ただし、Vercel環境ではファイルシステムへのアクセスが制限されているため、この方法は推奨しません。

### 方法3: デフォルトの認証情報を使用（Vercel環境）

Vercel環境では、`admin.credential.applicationDefault()`が自動的に認証情報を取得します。追加の設定は不要です。

## 📝 サービスアカウントキーの取得方法

### 1. Firebase Consoleにアクセス

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクトを選択

### 2. サービスアカウントキーを生成

1. プロジェクト設定（⚙️）を開く
2. 「サービスアカウント」タブを開く
3. 「新しい秘密鍵の生成」をクリック
4. JSONファイルがダウンロードされます

### 3. 環境変数に設定

ダウンロードしたJSONファイルから以下の値を取得：

```json
{
  "project_id": "your-project-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
}
```

これらをVercelダッシュボードの環境変数に設定してください。

## 🧪 動作確認

### ローカル環境でのテスト

1. **パッケージをインストール**
   ```bash
   npm install
   ```

2. **環境変数を設定（.env.local）**
   ```bash
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   ```

3. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

4. **テストスクリプトを実行**
   ```bash
   node scripts/test-lp-form-api.js
   ```

### Vercel環境でのテスト

1. **環境変数を設定**
   - Vercelダッシュボードで環境変数を設定

2. **デプロイ**
   - コードをプッシュしてデプロイ

3. **APIをテスト**
   - ブラウザの開発者ツールからAPIを呼び出す
   - Vercelダッシュボードでログを確認

## ✅ 修正後の動作

### 修正前の問題

- Firestoreルールの制約により、書き込みが失敗する可能性
- `claimRequests`の作成: `allow create: if isAuthenticated();` → 認証が必要
- `orders`の作成: `allow create: if false;` → 完全に拒否

### 修正後の動作

- Firebase Admin SDKを使用することで、Firestoreルールをバイパス
- 認証なしでデータベースへの書き込みが可能
- LP側からのリクエストが正常に処理される

## 🔒 セキュリティに関する注意

### Firebase Admin SDKの権限

Firebase Admin SDKは、Firestoreルールをバイパスしてデータベースにアクセスできます。そのため、以下の点に注意してください：

1. **環境変数の管理**
   - サービスアカウントキーは機密情報です
   - VercelダッシュボードでSecretとして設定してください
   - リポジトリにコミットしないでください

2. **アクセス制御**
   - APIルートで適切なバリデーションを実施
   - Originベースの検証を継続
   - reCAPTCHA検証を継続

3. **監査ログ**
   - すべての書き込み操作を監査ログに記録
   - 異常なアクセスを検出できるようにする

## 📊 変更ファイル一覧

1. `package.json` - `firebase-admin`を追加
2. `src/lib/firebase-admin.ts` - 新規作成
3. `src/app/api/lp-form/route.ts` - Admin SDKを使用するように修正

## 🎯 次のステップ

1. **パッケージをインストール**
   ```bash
   npm install
   ```

2. **環境変数を設定**
   - Vercelダッシュボードで環境変数を設定

3. **デプロイ**
   - コードをプッシュしてデプロイ

4. **動作確認**
   - LP側からリクエストを送信
   - Firestoreコンソールでデータが作成されているか確認
   - Vercelダッシュボードでログを確認

---

*作成日時: 2025年1月*

