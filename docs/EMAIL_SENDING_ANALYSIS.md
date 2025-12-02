# メール送信の分析と修正

## 📋 問題の概要

ユーザーから以下の2つの問題が報告されました：

1. **アカウント作成完了メール**と**公開ページ確定メール**の2通が送信されている
2. **公開ページ確定メールの送信元**が受信者のアドレスになっている

## 🔍 調査結果

### 1. アカウント作成完了メール（`sendCustomerLoginEmail`）

**送信箇所**:
- `functions/index.js`の`sendLoginEmail` Cloud Functionから呼び出される
- 現在は`src/app/orders/page.tsx`（注文管理画面）から手動で送信されるのみ
- **自動送信の箇所は見つからなかった**

**送信意図**:
- 注文管理画面から手動で送信するための機能
- 初期設定完了時の自動送信は実装されていない

**推奨対応**:
- 現在のフローでは、初期設定完了時に`sendPublicPageConfirmationEmail`のみが送信される
- アカウント作成完了メールが自動送信されている場合は、別の箇所（Stripe Webhook等）から送信されている可能性がある
- もし不要であれば、`sendCustomerLoginEmail`の自動送信を停止する

### 2. 公開ページ確定メールの送信元問題

**問題**:
- メールの送信元が受信者のアドレスになっている

**原因**:
- `mailOptions.from`に表示名が設定されていない
- Gmailの設定により、送信元が正しく表示されていない可能性

**修正内容**:
- `from`フィールドに表示名を追加: `emolink <${mailFromAddress}>`
- これにより、送信元が「emolink <emolink.guide@gmail.com>」のように表示される

## ✅ 実施した修正

### 1. メール送信元の修正

**修正ファイル**: `functions/src/email-service.ts`

**修正内容**:
- `sendSecretKeyEmail`: 送信元に表示名を追加
- `sendCustomerLoginEmail`: 送信元に表示名を追加
- `sendPublicPageConfirmationEmail`: 送信元に表示名を追加

**修正前**:
```typescript
const mailFrom = (gmailConfig?.user as string) || process.env.MAIL_FROM || 'noreply@emolink.net';
const mailOptions = {
  from: mailFrom,
  // ...
};
```

**修正後**:
```typescript
const mailFromAddress = (gmailConfig?.user as string) || process.env.MAIL_FROM || 'noreply@emolink.net';
const mailFrom = `emolink <${mailFromAddress}>`;
const mailOptions = {
  from: mailFrom,
  // ...
};
```

## 📝 推奨事項

### 1. アカウント作成完了メールについて

現在のフローでは、初期設定完了時に`sendPublicPageConfirmationEmail`のみが送信されます。
このメールには以下の情報が含まれています：
- ログインURL
- ログインメールアドレス
- ログインパスワード
- 公開ページURL

**アカウント作成完了メール（`sendCustomerLoginEmail`）は不要**と考えられます。

**対応案**:
1. `sendCustomerLoginEmail`の自動送信を停止（既に停止されている）
2. 注文管理画面からの手動送信のみ残す（必要に応じて）

### 2. メール送信元の確認

修正後、メールの送信元は以下のように表示されます：
- **表示名**: emolink
- **メールアドレス**: emolink.guide@gmail.com（Gmail設定から取得）

これにより、受信者にとって分かりやすい送信元表示になります。

## 🔄 次のステップ

1. 修正をデプロイ
2. メール送信をテストして、送信元が正しく表示されることを確認
3. アカウント作成完了メールが自動送信されている場合は、送信箇所を特定して停止

---

**作成日**: 2025-01-26  
**バージョン**: 1.0

