# ログを生成する方法

## 📋 概要

このドキュメントでは、LPフォームAPI（`/api/lp-form`）のログを生成するために、実際にどのような操作をすればよいかを説明します。

## 🎯 ログを生成する方法

### 方法1: LP側からフォームを送信（本番環境）

実際のLP（ランディングページ）からフォームを送信すると、自動的にログが生成されます。

#### 手順

1. **LP側のフォームにアクセス**
   - 実際のLPのURLにアクセス
   - 例: `https://emolink.cloud` など

2. **フォームに情報を入力**
   - メールアドレスを入力
   - その他の必要な情報を入力

3. **フォームを送信**
   - 「送信」ボタンをクリック
   - これにより、`/api/lp-form`エンドポイントが呼び出されます

4. **ログを確認**
   - Vercelダッシュボードでログを確認
   - 数秒〜数分後にログが表示されます

### 方法2: ブラウザの開発者ツールから直接送信（テスト用）

ブラウザの開発者ツールから直接APIを呼び出すことで、ログを生成できます。

#### 手順

1. **ブラウザの開発者ツールを開く**
   - Chrome/Edge: `F12` または `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Firefox: `F12` または `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)

2. **Consoleタブを開く**

3. **以下のコードを実行**
   ```javascript
   fetch('https://your-project.vercel.app/api/lp-form', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Origin': 'https://emolink.cloud'
     },
     body: JSON.stringify({
       email: 'test@example.com',
       tenant: 'dev',
       lpId: 'local',
       productType: 'acrylic',
       recaptchaToken: 'dev-token',
       link: 'https://emolink-cms.web.app/claim?k=test-jwt-token',
       secretKey: 'test-secret-key-12345'
     })
   })
   .then(response => response.json())
   .then(data => console.log('Response:', data))
   .catch(error => console.error('Error:', error));
   ```

4. **ログを確認**
   - Vercelダッシュボードでログを確認
   - 数秒後にログが表示されます

### 方法3: curlコマンドから送信（コマンドライン）

ターミナルからcurlコマンドを使用してAPIを呼び出すこともできます。

#### 手順

1. **ターミナルを開く**

2. **以下のコマンドを実行**
   ```bash
   curl -X POST https://your-project.vercel.app/api/lp-form \
     -H "Content-Type: application/json" \
     -H "Origin: https://emolink.cloud" \
     -d '{
       "email": "test@example.com",
       "tenant": "dev",
       "lpId": "local",
       "productType": "acrylic",
       "recaptchaToken": "dev-token",
       "link": "https://emolink-cms.web.app/claim?k=test-jwt-token",
       "secretKey": "test-secret-key-12345"
     }'
   ```

3. **ログを確認**
   - Vercelダッシュボードでログを確認
   - 数秒後にログが表示されます

### 方法4: ローカル環境でテスト（開発用）

ローカル環境で開発サーバーを起動してテストすることもできます。

#### 手順

1. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

2. **別のターミナルでテストスクリプトを実行**
   ```bash
   node scripts/test-lp-form-api.js
   ```

3. **ログを確認**
   - ターミナルに直接ログが表示されます
   - または、Vercelダッシュボードでログを確認（本番環境の場合）

## 📊 ログが生成されるタイミング

### 正常な場合

1. **リクエスト受信時**
   - APIエンドポイントがリクエストを受信した時点
   - ログ: `POST /api/lp-form`

2. **バリデーション時**
   - リクエストのバリデーションが実行された時点
   - エラーの場合: `Missing required fields` などのエラーログ

3. **reCAPTCHA検証時**
   - reCAPTCHA検証が実行された時点
   - エラーの場合: `reCAPTCHA verification failed` などのエラーログ

4. **Firestore書き込み時**
   - Firestoreへの書き込みが実行された時点
   - エラーの場合: `LP form error: [エラー内容]` などのエラーログ

5. **レスポンス送信時**
   - レスポンスが送信された時点
   - ログ: `200 OK` またはエラーステータスコード

### エラーが発生した場合

以下のようなエラーログが生成されます：

```
LP form error: Error: Missing or insufficient permissions
LP form error: Error: PERMISSION_DENIED
reCAPTCHA verification error: [エラー内容]
```

## 🔍 ログを確認する場所

### Vercelダッシュボード

1. **プロジェクトページを開く**
   - https://vercel.com/dashboard
   - プロジェクトを選択

2. **「Logs」タブを開く**
   - 上部メニューから「Logs」を選択

3. **フィルタリング**
   - 検索バーに「`api/lp-form`」と入力

4. **ログを確認**
   - リアルタイムでログが表示されます

### ローカル環境

開発サーバーを起動しているターミナルに直接ログが表示されます。

## ⚠️ 注意事項

### 本番環境でのテスト

- 本番環境でテストする場合は、実際のデータが作成される可能性があります
- テスト用のメールアドレスを使用することを推奨します
- テスト後は、必要に応じてテストデータを削除してください

### 開発環境でのテスト

- 開発環境（`NODE_ENV=development`）では、reCAPTCHA検証がスキップされます
- `recaptchaToken: 'dev-token'` を使用できます

### エラーログの確認

- エラーが発生した場合、ログに詳細なエラーメッセージが表示されます
- エラーメッセージをコピーして、問題の特定に役立ててください

## 📝 テスト用のサンプルデータ

### 正常なリクエスト

```json
{
  "email": "test@example.com",
  "tenant": "dev",
  "lpId": "local",
  "productType": "acrylic",
  "recaptchaToken": "dev-token",
  "link": "https://emolink-cms.web.app/claim?k=test-jwt-token",
  "secretKey": "test-secret-key-12345"
}
```

### エラーを発生させるリクエスト（テスト用）

```json
{
  "email": "test@example.com"
  // 必須フィールドが不足しているため、エラーが発生します
}
```

## 🎯 次のステップ

1. **ログを生成**
   - 上記のいずれかの方法でログを生成

2. **ログを確認**
   - Vercelダッシュボードでログを確認

3. **エラーを特定**
   - エラーメッセージを確認
   - エラーの原因を特定

4. **問題を修正**
   - エラーの原因に応じて修正を実施

---

*作成日時: 2025年1月*


