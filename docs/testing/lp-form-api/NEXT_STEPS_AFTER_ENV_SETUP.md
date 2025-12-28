# 環境変数設定後の次のステップ

## ✅ 完了した作業

Vercelダッシュボードで以下の環境変数が設定されました：

- ✅ `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- ✅ `FIREBASE_CLIENT_EMAIL`
- ✅ `FIREBASE_PRIVATE_KEY`
- ✅ その他のR2関連の環境変数

## 🚀 次のステップ

### ステップ1: パッケージをインストール（ローカル環境）

ローカル環境で開発する場合：

```bash
npm install
```

これにより、`firebase-admin`パッケージがインストールされます。

### ステップ2: コードをデプロイ

Vercelは通常、GitHubにプッシュすると自動的にデプロイされます。

#### 方法1: GitHubにプッシュ（推奨）

```bash
git add .
git commit -m "feat: Firebase Admin SDKを導入してLPフォームAPIを修正"
git push
```

Vercelが自動的にデプロイを開始します。

#### 方法2: Vercel CLIからデプロイ

```bash
vercel --prod
```

### ステップ3: デプロイの確認

1. **Vercelダッシュボードで確認**
   - https://vercel.com/dashboard
   - プロジェクトを選択
   - 「Deployments」タブで最新のデプロイメントを確認
   - ステータスが「Ready」になるまで待つ

2. **ビルドログを確認**
   - デプロイメントをクリック
   - 「Build Logs」を確認
   - エラーがないか確認

### ステップ4: 動作確認

#### 方法1: ブラウザの開発者ツールからテスト

1. ブラウザの開発者ツールを開く（F12）
2. Consoleタブを開く
3. 以下のコードを実行（実際のVercel URLに置き換えてください）：

```javascript
fetch('https://your-actual-vercel-url.vercel.app/api/lp-form', {
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
.then(data => console.log('✅ 成功:', data))
.catch(error => console.error('❌ エラー:', error));
```

#### 方法2: Firestoreコンソールで確認

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクトを選択
3. 「Firestore Database」を開く
4. `claimRequests`コレクションを確認
5. 新しいドキュメントが作成されているか確認

#### 方法3: Vercelログで確認

1. Vercelダッシュボードでプロジェクトを選択
2. 「Logs」タブを開く
3. `api/lp-form`でフィルタリング
4. エラーログがないか確認

## 🔍 確認すべきポイント

### ✅ 正常な動作

以下のようなレスポンスが返ってくれば成功です：

```json
{
  "ok": true,
  "message": "Claim request received and saved",
  "requestId": "xxxxxxxxxxxxxxxxxxxx",
  "link": "https://emolink-cms.web.app/claim?k=test-jwt-token"
}
```

### ❌ エラーが発生した場合

#### エラー1: Firebase Admin SDKの初期化エラー

**エラーメッセージ**:
```
Firebase Admin SDK initialization error: ...
```

**対処**:
1. 環境変数が正しく設定されているか確認
2. `FIREBASE_PRIVATE_KEY`の値が正しいか確認（ダブルクォートで囲まれているか）
3. 再デプロイを実行

#### エラー2: 認証エラー

**エラーメッセージ**:
```
Error: Could not load the default credentials
```

**対処**:
1. 環境変数が正しく設定されているか確認
2. `FIREBASE_PROJECT_ID`、`FIREBASE_PRIVATE_KEY`、`FIREBASE_CLIENT_EMAIL`がすべて設定されているか確認
3. 再デプロイを実行

#### エラー3: CORSエラー

**エラーメッセージ**:
```
Access to fetch at '...' has been blocked by CORS policy
```

**対処**:
- 既にCORSヘッダーは設定済みです
- 再デプロイを実行して最新のコードが反映されているか確認

## 📊 チェックリスト

- [ ] パッケージをインストール（`npm install`）
- [ ] コードをコミット・プッシュ
- [ ] Vercelでデプロイが完了するまで待つ
- [ ] ビルドログでエラーがないか確認
- [ ] ブラウザの開発者ツールからAPIをテスト
- [ ] Firestoreコンソールでデータが作成されているか確認
- [ ] Vercelログでエラーがないか確認

## 🎯 成功の確認

以下のすべてが確認できれば成功です：

1. ✅ APIリクエストが成功（200 OK）
2. ✅ `claimRequests`コレクションに新しいドキュメントが作成される
3. ✅ `orders`コレクションに新しいドキュメントが作成される
4. ✅ `auditLogs`コレクションに新しいログが記録される
5. ✅ Vercelログにエラーがない

## 📝 トラブルシューティング

### 問題が発生した場合

1. **Vercelログを確認**
   - エラーメッセージを確認
   - スタックトレースを確認

2. **環境変数を再確認**
   - Vercelダッシュボードで環境変数が正しく設定されているか確認
   - 値が正しいか確認（特に`FIREBASE_PRIVATE_KEY`）

3. **再デプロイ**
   - 環境変数を設定した後は、再デプロイが必要です

4. **Firebase Consoleで確認**
   - サービスアカウントキーが正しく生成されているか確認
   - プロジェクトIDが正しいか確認

## 🔗 関連ドキュメント

- [Firebase Admin SDK導入ガイド](./FIREBASE_ADMIN_SDK_SETUP.md)
- [FIREBASE_PRIVATE_KEYの取得方法](./HOW_TO_GET_FIREBASE_PRIVATE_KEY.md)
- [Vercelログ確認ガイド](./VERCEL_LOG_CHECK_GUIDE.md)
- [ログを生成する方法](./HOW_TO_GENERATE_LOGS.md)

---

*作成日時: 2025年1月*

