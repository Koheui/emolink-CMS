# 公開ページURL生成機能 - LP側実装ガイド

## 📋 概要

アカウント作成時（認証時）に公開ページURLを確定し、NFCタグに入力するために必要なURLを取得する機能です。

**重要**: URL確定のタイミングとフローの詳細は `URL_GENERATION_TIMING.md` を参照してください。

## 🎯 目的

- **公開ページURL**: NFCタグに入力するURL（アカウント作成時に確定）
- **ログインURL**: 次回ログイン時に使用するURL（メールに記載）

## 🔄 フロー

### 1. ユーザーがLPフォームを送信
LP側で既存の`/api/lp-form`エンドポイントに以下を送信：
```json
{
  "email": "user@example.com",
  "tenant": "petmem",
  "lpId": "direct",
  "productType": "acrylic",
  "recaptchaToken": "03AGdBq27...",
  "link": "https://emolink-cms.web.app/claim?k={JWTトークン}",
  "secretKey": "abc123def456ghi789"
}
```

### 2. CMS側でclaimRequestを作成
CMS側で`claimRequest`が作成され、`requestId`が返されます。

### 3. ユーザーが認証リンクをクリック
ユーザーがメール内の認証リンク（`link`）をクリックし、パスワード設定画面で認証を完了します。

### 4. CMS側で公開ページURLを生成
認証成功時に、CMS側で以下が自動的に実行されます：
- 空の公開ページを作成（`publicPageId`を確定）
- `publicPageUrl`と`loginUrl`を生成
- `claimRequest`に保存

### 5. LP側でURLを取得
LP側は、認証成功後に以下のAPIエンドポイントを呼び出してURLを取得します：

```
GET https://emolink-cms.web.app/api/claim/{requestId}/urls
```

**レスポンス例（成功時）:**
```json
{
  "ok": true,
  "requestId": "abc123...",
  "publicPageId": "xyz789...",
  "publicPageUrl": "https://emolink-cms.web.app/public/xyz789?tenant=petmem",
  "loginUrl": "https://emolink-cms.web.app/memories/create",
  "status": "claimed"
}
```

**レスポンス例（URL未生成時 - 認証待ち）:**
```json
{
  "ok": false,
  "error": "URLs not yet generated. Please wait for user authentication.",
  "status": "sent"
}
```
この場合は、HTTPステータスコード`202 (Accepted)`が返されます。

### 6. LP側でメール送信
取得したURLを使用して、ユーザーにメールを送信します。

## 📝 LP側実装要件

### APIエンドポイント

**重要**: このAPIはFirebase Functionsとして実装する必要があります（`output: export`のため、Next.js API Routeでは実装できません）。

```
GET https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/{requestId}/urls
```

**開発環境**:
```
GET http://localhost:5001/memorylink-cms/asia-northeast1/apiV2/api/claim/{requestId}/urls
```

### リクエスト
- **Method**: `GET`
- **Path Parameter**: `requestId` (LPフォーム送信時にCMSから返された`requestId`)

### レスポンス

#### 成功時（HTTP 200）
```json
{
  "ok": true,
  "requestId": "string",
  "publicPageId": "string",
  "publicPageUrl": "string",
  "loginUrl": "string",
  "status": "claimed"
}
```

#### URL未生成時（HTTP 202）
```json
{
  "ok": false,
  "error": "URLs not yet generated. Please wait for user authentication.",
  "status": "sent" | "pending"
}
```

#### エラー時（HTTP 400/403/404/500）
```json
{
  "ok": false,
  "error": "string",
  "details": "string" // オプション
}
```

### 実装パターン

#### パターン1: ポーリング方式（推奨）
認証リンク送信後、定期的にAPIを呼び出してURLを取得します。

```typescript
async function pollForUrls(requestId: string, maxAttempts: number = 30): Promise<UrlsResponse> {
  const apiUrl = process.env.NODE_ENV === 'production'
    ? `https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/${requestId}/urls`
    : `http://localhost:5001/memorylink-cms/asia-northeast1/apiV2/api/claim/${requestId}/urls`;
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.ok) {
      return data; // URL取得成功
    }
    
    if (response.status === 202) {
      // まだURLが生成されていない場合、5秒待って再試行
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    
    // その他のエラー
    throw new Error(data.error || 'Failed to get URLs');
  }
  
  throw new Error('Timeout: URLs not generated within expected time');
}
```

#### パターン2: Webhook方式（将来実装予定）
CMS側からLP側にWebhookを送信する方式（現在は未実装）。

### メール送信例

```typescript
async function sendWelcomeEmail(email: string, requestId: string) {
  // URLを取得
  const urls = await pollForUrls(requestId);
  
  // メール送信
  await sendEmail({
    to: email,
    subject: 'アカウント作成完了',
    body: `
      アカウントが作成されました。
      
      【公開ページURL（NFCタグ用）】
      ${urls.publicPageUrl}
      
      【次回ログイン用URL】
      ${urls.loginUrl}
      
      このURLをNFCタグに入力してください。
    `
  });
}
```

## ⚠️ 重要な注意事項

### 1. タイミング
- **公開ページURL**: 認証成功時に自動生成されます
- **取得タイミング**: 認証成功後、数秒以内にURLが利用可能になります
- **ポーリング間隔**: 5秒間隔でのポーリングを推奨します

### 2. エラーハンドリング
- HTTP 202（URL未生成）: ポーリングを継続
- HTTP 403（テナント不一致）: リクエストを再確認
- HTTP 404（requestId未找到）: リクエストIDを確認
- HTTP 500（サーバーエラー）: ログを確認して再試行

### 3. タイムアウト
- 最大ポーリング回数: 30回（約2.5分）
- タイムアウト後は、ユーザーに手動で確認を依頼することを推奨

### 4. セキュリティ
- `requestId`は機密情報ではありませんが、公開しないでください
- テナント検証が自動的に行われます

## 🔍 トラブルシューティング

### URLが取得できない場合
1. `requestId`が正しいか確認
2. 認証が完了しているか確認（`status`が`claimed`になっているか）
3. テナント情報が正しいか確認
4. CMS側のログを確認

### 認証が完了していない場合
- ユーザーが認証リンクをクリックしていない可能性があります
- メール送信を再試行するか、ユーザーに確認してください

## 📞 サポート

問題が発生した場合は、CMS開発チームに連絡してください。

