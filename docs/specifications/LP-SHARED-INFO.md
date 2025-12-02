# LP側への共有情報

**作成日**: 2025年1月  
**最終更新**: 2025年1月

---

## 📋 概要

このドキュメントは、LP側の実装に必要な最新情報をまとめたものです。

**詳細な仕様書**: `LP-API-integration.md` を参照してください。

---

## ✅ 実装完了事項（CMS側）

以下の機能はCMS側で実装済みです：

1. ✅ **reCAPTCHA v3検証**
   - スコア0.5未満は拒否
   - 開発環境では`dev-token`を許可

2. ✅ **Origin検証**
   - 本番環境では`Origin`ヘッダーからテナント情報を検証
   - 開発環境では任意のOriginを許可

3. ✅ **レスポンス形式の統一**
   - 成功レスポンス: `{ ok: true, ... }`
   - エラーレスポンス: `{ ok: false, error: "..." }`

4. ✅ **監査ログの記録**
   - `auditLogs`コレクションに記録

---

## 🔄 重要な変更点

### エラーレスポンス形式の統一

**変更前**:
```json
{
  "error": "Missing required fields"
}
```

**変更後**:
```json
{
  "ok": false,
  "error": "Missing required fields"
}
```

**対応**: LP側のエラーハンドリングで`result.ok === false`をチェックしてください。

---

## 📝 実装チェックリスト（LP側）

### 既存機能（既に実装済みの可能性）
- [ ] JWTトークンの生成（72時間有効）
- [ ] 認証リンクの生成（`https://emolink.net/claim?k={JWT}`）
  - ⚠️ **重要**: `sk`パラメータ（秘密鍵）を使ったリンク（`/claim?sk=...`）は使用しないでください。JWT方式（`/claim?k={JWT}`）を必ず使用してください。
- [ ] 秘密鍵の生成（16桁の英数字、注文管理用、認証リンクには使用しない）
- [ ] reCAPTCHA v3トークンの取得
- [ ] CMS APIへのリクエスト送信
- [ ] レスポンスの`ok`フィールドで成功/失敗を判定
- [ ] メール送信（認証リンクを含む）

### 新規実装が必要な機能 ⭐
- [ ] **URL取得のポーリング処理**
  - `GET /api/claim/{requestId}/urls` APIを定期的に呼び出す
  - 最大30回、5秒間隔でポーリング
  - 詳細は `PUBLIC-PAGE-URL-GENERATION.md` を参照
- [ ] **URL通知メールの送信**
  - 取得した`publicPageUrl`と`loginUrl`を含むメールを送信
  - メール内容はLP側でカスタマイズ可能

---

## 🔗 APIエンドポイント

### 開発環境
```
POST http://localhost:3000/api/lp-form
```

### 本番環境
```
POST https://emolink.net/api/lp-form
```

---

## 📤 リクエスト例

```javascript
const response = await fetch('https://emolink.net/api/lp-form', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    tenant: 'petmem',
    lpId: 'direct',
    productType: 'acrylic',
    recaptchaToken: '03AGdBq27...', // 本番環境では実際のトークン
    link: 'https://emolink.net/claim?k=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    secretKey: 'abc123def456ghi789',
  }),
});

const result = await response.json();

if (result.ok) {
  // 成功: メール送信処理
  console.log('Request ID:', result.requestId);
  await sendEmail(email, result.link);
} else {
  // エラー処理
  console.error('Error:', result.error);
}
```

---

## 📥 レスポンス例

### 成功時
```json
{
  "ok": true,
  "message": "Claim request received and saved",
  "requestId": "req_abc123def456",
  "link": "https://emolink.net/claim?k=..."
}
```

### エラー時
```json
{
  "ok": false,
  "error": "Missing required fields"
}
```

---

## ⚠️ 注意事項

1. **JWT_SECRETの管理**
   - JWTトークンの署名に使用する秘密鍵は、LP側で安全に管理してください
   - フロントエンドにハードコードしないでください

2. **reCAPTCHAトークン**
   - 開発環境では`dev-token`を使用可能
   - 本番環境では実際のreCAPTCHA v3トークンが必要

3. **Originヘッダー**
   - 本番環境では、リクエストに`Origin`ヘッダーを含めてください
   - CMS側でテナント情報を検証するために使用されます

4. **エラーハンドリング**
   - レスポンスの`ok`フィールドで成功/失敗を判定してください
   - `ok === false`の場合は`error`フィールドにエラーメッセージが含まれます

---

## 📚 関連ドキュメント

### 必須資料
- **URL取得とメール送信**: `PUBLIC-PAGE-URL-GENERATION.md` ⭐ **新規実装必須**
- **詳細仕様書**: `LP-API-integration.md`
- **完全なフロー**: `ACCOUNT-CREATION-FLOW.md`（参考用）

### 参考資料
- **相違点まとめ**: `CMS_SPEC_DIFFERENCES.md`（参考用）
- **共有資料一覧**: `LP_SHARED_DOCUMENTS.md`

---

## 📞 サポート

実装に関する質問や問題がある場合は、CMS開発チームまでお問い合わせください。

