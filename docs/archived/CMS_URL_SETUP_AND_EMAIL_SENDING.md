# CMS側実装ガイド - URL設定（LP側でメール送信）

## 📋 概要

このドキュメントは、CMS側で認証成功時にURLを設定し、**LP側でメール送信**するための実装ガイドです。

## 🎯 目的

- 認証成功時に`publicPageUrl`と`loginUrl`を`claimRequest`に設定
- LP側がURLを取得できるAPIエンドポイントを提供
- **メール送信はLP側で実行**（CMS側ではメール送信しない）

## 🔄 完全フロー

```
[ユーザー] → [認証リンククリック] → [CMS: 認証処理]
                                           ↓
[CMS: 公開ページ作成 & URL生成] → [Functions API: URL設定]
                                           ↓
[LP側: URL取得（ポーリング）] → [LP側: メール送信] → [完了]
```

**注意**: メール送信はLP側で実行されます。CMS側ではメール送信しません。

## 📝 CMS側で実装が必要な処理

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

## 🔌 APIエンドポイント詳細

### POST /api/claim/{requestId}/set-urls

**目的**: 認証成功時に`publicPageUrl`と`loginUrl`を設定

**リクエスト**:
- **Method**: `POST`
- **Path Parameter**: `requestId` (JWTトークンから取得したrequestId)
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

## 📧 LP側でのメール送信

### メール送信の流れ

`set-urls` APIを呼び出すと、以下の流れでLP側がメール送信します：

1. **URL設定**: `set-urls` APIが`claimRequest`に`publicPageUrl`と`loginUrl`を設定

2. **LP側でURL取得**: LP側が`/api/claim/{requestId}/urls` APIをポーリングしてURLを取得

3. **LP側でメール送信**: 取得したURLを使用して、LP側でメール送信

**注意**: CMS側（Firebase Functions）ではメール送信しません。メール送信はLP側で実行されます。

### LP側で送信するメール内容

メールには以下の情報が含まれます（LP側でカスタマイズ可能）：

- **公開ページURL**: NFCタグに入力するURL
  - 説明: "この公開URLは、製品に入力してお送り致しますので、ご到着をお待ちください。"
- **ログインURL**: 次回ログイン時に使用するURL
  - 説明: "次回ログイン時はこのURLをご利用ください。こちらも出力したものを製品と一緒にお送り致します。"

詳細は `PUBLIC-PAGE-URL-GENERATION.md` を参照してください。

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
メール送信（自動）
  ↓
完了
```

## 🔐 セキュリティ考慮事項

1. **認証**: `set-urls` APIは認証済みユーザーのみが呼び出せるようにしてください
2. **バリデーション**: `requestId`が認証したユーザーに関連付けられているか確認
3. **エラーハンドリング**: エラー情報をユーザーに直接表示しない（ログに記録）

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. Firebase ConsoleのFunctionsログ
2. Firestoreの`claimRequests`コレクション
3. メール送信設定（Gmail SMTP設定）

## 📝 実装例（完全版）

```typescript
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

## ✅ まとめ

1. **認証成功時に`set-urls` APIを呼び出すだけ**で、メール送信が自動化されます
2. **Firestoreトリガー**が自動的にメールを送信するため、CMS側で追加の処理は不要です
3. **エラーハンドリング**を適切に実装してください
4. **ログ出力**を実装して、問題発生時に原因を特定しやすくしてください

---

**最終更新日**: 2025-01-XX  
**バージョン**: 1.0

