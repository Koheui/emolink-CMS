# LP側とCMS側のAPI連携仕様書

**最終更新**: 2025年1月  
**バージョン**: v1.0

---

## 📋 概要

このドキュメントは、LP（ランディングページ）側からCMS側のAPIに送信する際の仕様を定義します。

LP側で認証リンクと秘密鍵を生成し、CMS側のAPIエンドポイントに送信することで、ユーザーの認証情報と注文情報を管理します。

---

## 🔗 APIエンドポイント

### エンドポイントURL

```
POST /api/lp-form
```

### ベースURL

- **開発環境**: `http://localhost:3000`
- **本番環境**: `https://emolink.net` (または設定されたCMSドメイン)

---

## 📤 リクエスト仕様

### リクエストヘッダー

```http
Content-Type: application/json
Origin: https://your-lp-domain.com  (本番環境では必須)
```

### リクエストボディ

```json
{
  "email": "user@example.com",
  "tenant": "petmem",
  "lpId": "direct",
  "productType": "acrylic",
  "recaptchaToken": "03AGdBq27...",
  "link": "https://emolink.net/claim?k=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "secretKey": "abc123def456ghi789"
}
```

### 必須フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `email` | string | ユーザーのメールアドレス |
| `tenant` | string | テナントID（例: "petmem"） |
| `lpId` | string | LP識別子（例: "direct"） |
| `productType` | string | 商品タイプ（例: "acrylic"） |
| `recaptchaToken` | string | reCAPTCHA v3トークン |
| `link` | string | **LP側で生成した認証リンク**（必須） |
| `secretKey` | string | **LP側で生成した秘密鍵**（必須） |

### フィールド詳細

#### `link` (認証リンク)

LP側で生成する認証リンクの形式：

```
https://emolink.net/claim?k={JWTトークン}
```

⚠️ **重要**: `sk`パラメータ（秘密鍵）を使ったリンク（`/claim?sk=...`）は使用しないでください。JWT方式（`/claim?k={JWT}`）を必ず使用してください。

**JWTトークンの内容**:
- `sub`: requestId（claimRequestのID）
- `email`: ユーザーのメールアドレス
- `tenant`: テナントID
- `lpId`: LP識別子
- `iat`: 発行時刻（Unix timestamp）
- `exp`: 有効期限（Unix timestamp、72時間後）

**例**:
```
https://emolink.net/claim?k=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZXFfYWJjMTIzIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwidGVuYW50IjoicGV0bWVtIiwibHBJZCI6ImRpcmVjdCIsImlhdCI6MTczNzEzMjA1NywibGV4cCI6MTczNzM5MTI1N30.signature
```

**JWT方式を推奨する理由**:
1. **セキュリティ**: JWTに署名があり、改ざん検知が容易
2. **効率**: Firestoreクエリが不要（JWTに必要な情報が全て含まれる）
3. **標準的**: 一般的な認証方式
4. **有効期限**: JWT内で管理可能

#### `secretKey` (秘密鍵)

LP側で生成する16桁の英数字文字列。

**生成ルール**:
- 16文字の英数字（大文字・小文字・数字）
- ランダム生成
- 30日間有効

**例**:
```
abc123def456ghi789
```

---

## 📥 レスポンス仕様

### 成功レスポンス (200 OK)

```json
{
  "ok": true,
  "message": "Claim request received and saved",
  "requestId": "req_abc123def456",
  "link": "https://emolink.net/claim?k=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### エラーレスポンス

すべてのエラーレスポンスには`ok: false`フィールドが含まれます。

#### 400 Bad Request - 必須フィールド不足

```json
{
  "ok": false,
  "error": "Missing required fields"
}
```

#### 400 Bad Request - リンクまたは秘密鍵が不足

```json
{
  "ok": false,
  "error": "Missing link or secretKey from LP"
}
```

#### 400 Bad Request - reCAPTCHA検証失敗

```json
{
  "ok": false,
  "error": "reCAPTCHA verification failed",
  "details": ["invalid-input-response"]
}
```

#### 403 Forbidden - Origin検証失敗

```json
{
  "ok": false,
  "error": "Invalid origin"
}
```

#### 500 Internal Server Error

```json
{
  "ok": false,
  "error": "Internal server error"
}
```

---

## 🔐 セキュリティ要件

### 1. Origin検証

本番環境では、リクエストの`Origin`ヘッダーまたは`Referer`ヘッダーからテナント情報を検証します。

**許可されるOrigin**:
- テナントごとに設定されたLPドメイン
- 開発環境では任意のOriginを許可

### 2. reCAPTCHA v3検証

- reCAPTCHA v3トークンを必須とする
- スコアが0.5未満の場合は拒否
- 開発環境では`dev-token`を許可

### 3. テナント検証

リクエストの`tenant`と`lpId`は、Originから自動的に検証されます。不一致の場合は403エラーを返します。

---

## 📝 実装例

### JavaScript (Fetch API)

```javascript
async function submitLPForm(formData) {
  // reCAPTCHAトークンを取得
  const recaptchaToken = await grecaptcha.execute('YOUR_SITE_KEY', {
    action: 'submit'
  });

  // 認証リンクと秘密鍵を生成（LP側で実装）
  const jwtToken = generateJWT(formData);
  const link = `https://emolink.net/claim?k=${jwtToken}`;
  const secretKey = generateSecretKey(); // 16桁の英数字

  // APIリクエスト
  const response = await fetch('https://emolink.net/api/lp-form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: formData.email,
      tenant: 'petmem',
      lpId: 'direct',
      productType: 'acrylic',
      recaptchaToken: recaptchaToken,
      link: link,
      secretKey: secretKey,
    }),
  });

  const result = await response.json();

  if (result.ok) {
    console.log('Success:', result.requestId);
    // メール送信処理（LP側で実装）
    await sendEmail(formData.email, link);
  } else {
    console.error('Error:', result.error);
  }
}
```

### JWT生成例（LP側で実装）

```javascript
function generateJWT(formData) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    sub: generateRequestId(), // 一意のrequestId
    email: formData.email,
    tenant: 'petmem',
    lpId: 'direct',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (72 * 60 * 60) // 72時間
  };

  // JWT署名（LP側で実装）
  const token = signJWT(header, payload, JWT_SECRET);
  return token;
}
```

### 秘密鍵生成例（LP側で実装）

```javascript
function generateSecretKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

---

## 🔄 処理フロー

1. **LP側**: ユーザーがフォームを送信
2. **LP側**: reCAPTCHA v3トークンを取得
3. **LP側**: JWTトークンを生成（72時間有効）
4. **LP側**: 認証リンクを生成（`/claim?k={JWT}`）
5. **LP側**: 秘密鍵を生成（16桁の英数字）
6. **LP側**: CMS APIに送信（`link`と`secretKey`を含む）
7. **CMS側**: リクエストを受け取り、`claimRequests`と`orders`に保存
8. **LP側**: メール送信（認証リンクを含む）

---

## 📌 重要な注意事項

### ✅ LP側で実装すべきこと

1. **JWTトークンの生成**
   - 72時間有効なJWTトークンを生成
   - `sub`（requestId）、`email`、`tenant`、`lpId`を含む
   - 署名はLP側で管理する秘密鍵で行う

2. **認証リンクの生成**
   - 形式: `https://emolink.net/claim?k={JWTトークン}`
   - このリンクをメールでユーザーに送信

3. **秘密鍵の生成**
   - 16桁の英数字文字列
   - ランダム生成
   - 30日間有効として扱う

4. **メール送信**
   - CMS側ではメール送信を行わない
   - LP側で認証リンクを含むメールを送信

### ❌ CMS側で行うこと

- `claimRequests`への保存
- `orders`への保存
- データの検証と監査ログの記録

---

## 🧪 テスト方法

### 開発環境でのテスト

開発環境では、以下のようにテストできます：

```javascript
const response = await fetch('http://localhost:3000/api/lp-form', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test@example.com',
    tenant: 'petmem',
    lpId: 'direct',
    productType: 'acrylic',
    recaptchaToken: 'dev-token', // 開発環境ではdev-tokenを使用
    link: 'https://emolink.net/claim?k=test-jwt-token',
    secretKey: 'test123456789012',
  }),
});
```

### 本番環境でのテスト

本番環境では、実際のreCAPTCHAトークンとJWT署名が必要です。

---

## 📞 サポート

実装に関する質問や問題がある場合は、CMS開発チームまでお問い合わせください。

---

## 📚 関連ドキュメント

- [LP仕様書](./LP-spec-v1.0.md)
- [CMS仕様書](./SPECIFICATION.md)
- [システムアーキテクチャ](../system-architecture.v4.2.md)

