# LPフォームAPI動作確認 - アクションアイテム

## 🔍 確認結果サマリー

### ✅ 正常に実装されている項目
1. APIエンドポイントの存在 (`/api/lp-form`)
2. リクエストバリデーション
3. Originベースのテナント検証
4. reCAPTCHA検証
5. エラーハンドリング

### ⚠️ 潜在的な問題点

#### 問題1: Firestoreルールとの不整合（重要度: 高）

**現状**:
- `src/app/api/lp-form/route.ts`はクライアントSDK（`firebase/firestore`）を使用
- Firestoreルールの制約を受ける

**影響を受けるコレクション**:

1. **`claimRequests`**
   - ルール: `allow create: if isAuthenticated();`
   - 問題: LP側からのリクエストは認証されていないため、書き込みが失敗する可能性

2. **`orders`**
   - ルール: `allow create: if false; // Functionsのみ`
   - 問題: APIルートからの書き込みは完全に拒否される

3. **`auditLogs`**
   - ルール: `allow write: if false; // Functionsのみ`
   - 問題: APIルートからの書き込みは完全に拒否される

## 📋 確認が必要な項目

### 1. 実際の動作確認

#### 方法A: Vercelログの確認
1. Vercelダッシュボードにアクセス
2. プロジェクトを選択
3. 「Functions」タブを開く
4. `/api/lp-form`のログを確認
5. エラーメッセージを確認

#### 方法B: Firestoreコンソールでの確認
1. Firebase Consoleにアクセス
2. Firestore Databaseを開く
3. `claimRequests`コレクションを確認
4. 新しいドキュメントが作成されているか確認
5. エラーが発生している場合は、エラーメッセージを確認

#### 方法C: ブラウザの開発者ツール
1. LP側のフォームを送信
2. ブラウザの開発者ツールでNetworkタブを開く
3. `/api/lp-form`へのリクエストを確認
4. レスポンスのステータスコードとエラーメッセージを確認

### 2. エラーパターンの確認

以下のエラーが発生している可能性があります：

#### パターン1: 認証エラー
```
Error: Missing or insufficient permissions
```
- **原因**: Firestoreルールで認証が必要だが、リクエストが認証されていない
- **対処**: Firebase Admin SDKを使用する

#### パターン2: 権限エラー
```
Error: PERMISSION_DENIED
```
- **原因**: Firestoreルールで書き込みが拒否されている
- **対処**: Firebase Admin SDKを使用する、またはルールを修正

#### パターン3: ネットワークエラー
```
Error: fetch failed
```
- **原因**: ネットワーク接続の問題
- **対処**: ネットワーク設定を確認

## 🔧 推奨される修正

### 修正1: Firebase Admin SDKの導入（推奨）

#### ステップ1: パッケージのインストール
```bash
npm install firebase-admin
```

#### ステップ2: `src/lib/firebase-admin.ts`を作成
```typescript
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // Vercel環境では環境変数から自動的に認証情報を取得
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export const adminDb = admin.firestore();
```

#### ステップ3: `src/app/api/lp-form/route.ts`を修正
```typescript
// 修正前
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 修正後
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// 使用例
await adminDb.collection('claimRequests').add({
  ...claimRequestWithLink,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
```

### 修正2: 環境変数の設定（Vercel）

Vercelダッシュボードで以下の環境変数を設定：

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
# または
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

## 📊 確認チェックリスト

### 即座に確認すべき項目
- [ ] Vercelログでエラーメッセージを確認
- [ ] Firestoreコンソールで`claimRequests`コレクションを確認
- [ ] ブラウザの開発者ツールでNetworkタブを確認
- [ ] 実際のエラーメッセージを記録

### 修正後の確認項目
- [ ] Firebase Admin SDKが正しく初期化されているか
- [ ] 環境変数が正しく設定されているか
- [ ] `claimRequests`コレクションへの書き込みが成功するか
- [ ] `orders`コレクションへの書き込みが成功するか
- [ ] `auditLogs`コレクションへの書き込みが成功するか

## 🎯 次のステップ

1. **即座に実行**: 実際のエラーログを確認
2. **問題が確認された場合**: Firebase Admin SDKを導入
3. **修正後**: 再度動作確認を実施

---

*作成日時: 2025年1月*

