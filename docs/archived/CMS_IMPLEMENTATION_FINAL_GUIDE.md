# CMS側実装ガイド - 最終版

## 📋 概要

このドキュメントは、CMS側で実装が必要な機能をまとめたものです。

**実装方針**: CMS側でメール送信を行い、LP側からメール本文をカスタマイズ可能にする

**最終更新**: 2025年1月  
**バージョン**: 1.0

---

## 🎯 実装が必要な機能

### 1. 認証成功時にURLを設定するAPIの呼び出し

認証成功時に、Functions APIを呼び出して`publicPageUrl`と`loginUrl`を設定してください。

### 2. メール送信は自動化済み

メール送信は既に実装済みです。URLを設定すると自動的にメールが送信されます。

---

## 📝 実装内容

### ステップ1: 認証成功時の処理

認証成功時に以下の処理を実装してください：

```typescript
// 1. 公開ページIDを生成（既存のロジックを使用）
const publicPageId = generatePublicPageId(); // または既存の生成ロジック

// 2. URLを生成
const publicPageUrl = `https://emolink-cms.web.app/public/${publicPageId}?tenant=${tenant}`;
const loginUrl = `https://emolink-cms.web.app/memories/create`;

// 3. Functions APIを呼び出してURLを設定
const response = await fetch(
  `https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/${requestId}/set-urls`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publicPageId: publicPageId,
      publicPageUrl: publicPageUrl,
      loginUrl: loginUrl,
      claimedByUid: user.uid // 認証したユーザーのUID
    })
  }
);

const result = await response.json();

if (!result.ok) {
  console.error('Failed to set URLs:', result.error);
  // エラーハンドリング
} else {
  console.log('URLs set successfully:', {
    publicPageUrl: result.publicPageUrl,
    loginUrl: result.loginUrl
  });
  // メール送信は自動的にトリガーされます
}
```

### ステップ2: エラーハンドリング

```typescript
try {
  const response = await fetch(/* ... */);
  const result = await response.json();
  
  if (!result.ok) {
    // エラーログを記録
    console.error('Failed to set URLs:', {
      requestId,
      error: result.error,
      details: result.details
    });
    // 必要に応じてユーザーに通知
  } else {
    console.log('URLs set successfully:', {
      requestId,
      publicPageUrl: result.publicPageUrl,
      loginUrl: result.loginUrl
    });
    // メール送信は自動的にトリガーされます
  }
} catch (error) {
  console.error('Error calling set-urls API:', error);
  // エラーハンドリング
}
```

---

## 🔌 APIエンドポイント詳細

### POST /api/claim/{requestId}/set-urls

**目的**: 認証成功時に`publicPageUrl`と`loginUrl`を設定

**ベースURL**: `https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2`

**リクエスト**:
- **Method**: `POST`
- **Path Parameter**: `requestId` (JWTトークンから取得したrequestId)
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "publicPageId": "string (オプション)",
    "publicPageUrl": "string (必須)",
    "loginUrl": "string (必須)",
    "claimedByUid": "string (オプション)"
  }
  ```

**レスポンス（成功時）**:
```json
{
  "ok": true,
  "message": "URLs set successfully",
  "requestId": "abc123...",
  "publicPageUrl": "https://emolink-cms.web.app/public/xyz789?tenant=petmem",
  "loginUrl": "https://emolink-cms.web.app/memories/create"
}
```

**レスポンス（エラー時）**:
```json
{
  "ok": false,
  "error": "error message",
  "details": "error details"
}
```

**HTTPステータスコード**:
- `200`: 成功
- `400`: リクエストエラー（必須パラメータ不足など）
- `404`: `claimRequest`が見つからない
- `500`: サーバーエラー

---

## 📧 メール送信について

### 自動メール送信

URLを設定すると、以下の処理が自動的に実行されます：

1. **Firestoreトリガー発火**: `onClaimRequestUpdated`
   - `publicPageUrl`と`loginUrl`が設定されたことを検知
   - メール送信済みフラグ（`urlsEmailSent`）を確認

2. **メール送信**: `sendUrlsEmail`関数が自動実行
   - 公開ページURL（NFCタグ用）
   - ログインURL（次回ログイン用）
   - LP側から送信されたメール本文情報を使用

3. **送信済みフラグ設定**: `urlsEmailSent: true`を設定
   - 重複送信を防止

### メール本文のカスタマイズ

メール本文は、LP側から送信された情報を使用します：

- `emailHeaderTitle`: ヘッダータイトル
- `emailHeaderSubtitle`: ヘッダーサブタイトル
- `emailMainMessage`: 本文メッセージ
- `emailFooterMessage`: フッターメッセージ

これらの情報は`claimRequest`に保存されており、URL通知メール送信時に自動的に使用されます。

---

## 🔍 実装チェックリスト

### CMS側で実装が必要な項目

- [ ] 認証成功時に`publicPageId`を生成
- [ ] `publicPageUrl`を生成（`https://emolink-cms.web.app/public/{publicPageId}?tenant={tenant}`）
- [ ] `loginUrl`を生成（`https://emolink-cms.web.app/memories/create`）
- [ ] `POST /api/claim/{requestId}/set-urls` APIを呼び出す
- [ ] エラーハンドリングを実装
- [ ] ログ出力を実装

### 確認ポイント

- [ ] `requestId`が正しく取得できているか
- [ ] URLが正しい形式で生成されているか
- [ ] API呼び出しが成功しているか
- [ ] メールが自動送信されているか（Firebase Consoleのログで確認）

---

## 🐛 トラブルシューティング

### メールが送信されない場合

1. **Firebase Consoleのログを確認**
   - Functions → `onClaimRequestUpdated` のログを確認
   - エラーメッセージを確認

2. **`claimRequest`の状態を確認**
   - Firestoreで`claimRequests/{requestId}`を確認
   - `publicPageUrl`と`loginUrl`が設定されているか
   - `urlsEmailSent`が`true`になっているか

3. **API呼び出しを確認**
   - `set-urls` APIが正常に呼び出されているか
   - レスポンスが`ok: true`になっているか

### よくあるエラー

#### エラー1: "Claim request not found"
- **原因**: `requestId`が間違っている、または`claimRequest`が存在しない
- **対処**: `requestId`を確認し、JWTトークンから正しく取得できているか確認

#### エラー2: "publicPageUrl and loginUrl are required"
- **原因**: リクエストボディに必須パラメータが不足
- **対処**: `publicPageUrl`と`loginUrl`が正しく設定されているか確認

#### エラー3: "URLs already set"
- **原因**: 既にURLが設定されている（重複呼び出し）
- **対処**: 問題なし。既存のURLが返される

---

## 📊 データフロー

```
認証成功
  ↓
公開ページ作成（CMS側）
  ↓
URL生成（CMS側）
  ↓
POST /api/claim/{requestId}/set-urls（CMS側 → Functions）
  ↓
claimRequest更新（Functions側）
  ↓
Firestoreトリガー発火（自動）
  ↓
メール送信（自動・Gmail SMTP）
  ↓
完了
```

---

## 🔐 セキュリティ考慮事項

1. **認証**: `set-urls` APIは認証済みユーザーのみが呼び出せるようにしてください
2. **バリデーション**: `requestId`が認証したユーザーに関連付けられているか確認
3. **エラーハンドリング**: エラー情報をユーザーに直接表示しない（ログに記録）

---

## 📝 完全な実装例

```typescript
/**
 * 認証成功時の処理
 * @param requestId - JWTトークンから取得したrequestId
 * @param tenant - テナントID
 * @param userUid - 認証したユーザーのUID
 */
async function handleClaimSuccess(
  requestId: string,
  tenant: string,
  userUid: string
) {
  try {
    // 1. 公開ページIDを生成
    const publicPageId = await generatePublicPageId();
    
    // 2. URLを生成
    const publicPageUrl = `https://emolink-cms.web.app/public/${publicPageId}?tenant=${tenant}`;
    const loginUrl = `https://emolink-cms.web.app/memories/create`;
    
    // 3. Functions APIを呼び出し
    const apiUrl = `https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/${requestId}/set-urls`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicPageId,
        publicPageUrl,
        loginUrl,
        claimedByUid: userUid
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      console.error('Failed to set URLs:', {
        requestId,
        error: result.error,
        details: result.details
      });
      throw new Error(`Failed to set URLs: ${result.error}`);
    }
    
    console.log('URLs set successfully:', {
      requestId,
      publicPageUrl: result.publicPageUrl,
      loginUrl: result.loginUrl
    });
    
    // メール送信は自動的にトリガーされます
    // 追加の処理は不要です
    
    return {
      success: true,
      publicPageUrl: result.publicPageUrl,
      loginUrl: result.loginUrl
    };
    
  } catch (error) {
    console.error('Error in handleClaimSuccess:', error);
    throw error;
  }
}
```

---

## ✅ まとめ

### 実装が必要な項目

1. **認証成功時にURLを設定するAPIを呼び出す**
   - `POST /api/claim/{requestId}/set-urls`
   - これだけでメール送信が自動化されます

### 実装が不要な項目

1. **メール送信機能** - 既に実装済み（自動送信）
2. **URL取得機能** - 既に実装済み（必要に応じて使用可能）
3. **メール本文のカスタマイズ** - 既に実装済み（LP側から送信された情報を使用）

### 重要なポイント

1. ✅ **URLを設定するだけでメール送信が自動化**されます
2. ✅ **メール本文はLP側から送信された情報を使用**します
3. ✅ **追加の実装は不要**です（URL設定APIの呼び出しのみ）

---

## 📚 関連ドキュメント

- **クイックリファレンス**: `CMS_IMPLEMENTATION_QUICK_REFERENCE.md`
- **詳細ガイド**: `CMS_URL_SETUP_AND_EMAIL_SENDING.md`
- **現在の実装**: `CURRENT_EMAIL_IMPLEMENTATION.md`
- **メール送信比較**: `EMAIL_SENDING_COMPARISON.md`

---

**最終更新日**: 2025-01-XX  
**バージョン**: 1.0

