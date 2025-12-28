# LPフォームAPI動作確認結果

## 📋 確認項目

### 1. コード実装の確認

#### ✅ 確認済み項目
- [x] `/api/lp-form`エンドポイントが存在する
- [x] リクエストバリデーションが実装されている
- [x] Originベースのテナント検証が実装されている
- [x] reCAPTCHA検証が実装されている
- [x] `claimRequests`コレクションへの書き込み処理が実装されている
- [x] `orders`コレクションへの書き込み処理が実装されている
- [x] `auditLogs`コレクションへの書き込み処理が実装されている

#### ⚠️ 潜在的な問題点

##### 問題1: クライアントSDKの使用
**場所**: `src/app/api/lp-form/route.ts:2`
```typescript
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
```

**問題**:
- Next.js APIルート（サーバーサイド）でクライアントSDKを使用している
- Firestoreルールの制約を受ける可能性がある
- 認証されていないリクエストでは書き込みが失敗する可能性

**影響**:
- `claimRequests`の作成ルール: `allow create: if isAuthenticated();`
- `orders`の作成ルール: `allow create: if false; // Functionsのみ`
- これらのルールにより、LP側からの書き込みが失敗する可能性が高い

##### 問題2: Firestoreルールとの不整合

**`claimRequests`コレクション**:
```firestore
allow create: if isAuthenticated();
```
- LP側からのリクエストは認証されていないため、このルールでは書き込めない

**`orders`コレクション**:
```firestore
allow create: if false; // Functionsのみ
```
- このルールでは、APIルートからの書き込みは完全に拒否される

**`auditLogs`コレクション**:
```firestore
allow write: if false; // Functionsのみ
```
- このルールでは、APIルートからの書き込みは完全に拒否される

### 2. 動作確認方法

#### 方法1: ローカル環境でのテスト
```bash
# 開発サーバーを起動
npm run dev

# 別のターミナルでテストスクリプトを実行
node scripts/test-lp-form-api.js
```

#### 方法2: Vercel環境でのテスト
1. Vercelにデプロイ
2. ブラウザの開発者ツールでNetworkタブを開く
3. LP側からフォームを送信
4. エラーレスポンスを確認

#### 方法3: Firestoreコンソールでの確認
1. Firebase Consoleにアクセス
2. Firestore Databaseを開く
3. `claimRequests`コレクションを確認
4. 新しいドキュメントが作成されているか確認

### 3. 推奨される修正

#### 修正1: Firebase Admin SDKの使用（推奨）

`src/lib/firebase-admin.ts`を作成:
```typescript
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // または環境変数から設定
  });
}

export const adminDb = admin.firestore();
```

`src/app/api/lp-form/route.ts`を修正:
```typescript
import { adminDb } from '@/lib/firebase-admin';

// addDocの代わりにadminDb.collection().add()を使用
await adminDb.collection('claimRequests').add(claimRequestWithLink);
```

#### 修正2: Firestoreルールの見直し（非推奨）

セキュリティリスクがあるため、推奨しません。

### 4. 確認が必要な環境変数

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` (Admin SDK使用時)
- `RECAPTCHA_SECRET` (本番環境)

### 5. 次のステップ

1. **即座に確認**: 実際のエラーログを確認
2. **修正実装**: Firebase Admin SDKを使用するように修正
3. **再テスト**: 修正後に再度動作確認

---

*作成日時: 2025年1月*

