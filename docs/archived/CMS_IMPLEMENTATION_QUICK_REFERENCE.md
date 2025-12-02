# CMS側実装クイックリファレンス

**最終版**: CMS側開発者向けの実装ガイド

## 🚀 実装のポイント（3ステップ）

### 1. 認証成功時にURLを生成

```typescript
const publicPageId = generatePublicPageId();
const publicPageUrl = `https://emolink-cms.web.app/public/${publicPageId}?tenant=${tenant}`;
const loginUrl = `https://emolink-cms.web.app/memories/create`;
```

### 2. Functions APIを呼び出す

```typescript
await fetch(
  `https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/${requestId}/set-urls`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicPageId,
      publicPageUrl,
      loginUrl,
      claimedByUid: user.uid
    })
  }
);
```

### 3. 完了！

**メール送信について**:
- ✅ **既存のGmail SMTP実装を活用**（推奨）
- ✅ **CMS側で自動的にメール送信**（既に実装済み・動作中）
- ✅ **追加の実装は不要**

**実装状況**:
- 認証リンクメール: ✅ 実装済み（`handleLpForm`）
- URL通知メール: ✅ 実装済み（Firestoreトリガー）
- Gmail SMTP: ✅ 設定済み・動作中

詳細は `CURRENT_EMAIL_IMPLEMENTATION.md` と `EMAIL_SENDING_IMPLEMENTATION_GUIDE.md` を参照してください。

---

## 📋 必須パラメータ

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `publicPageUrl` | ✅ | 公開ページURL（NFCタグ用） |
| `loginUrl` | ✅ | ログインURL（次回ログイン用） |
| `publicPageId` | ❌ | 公開ページID（オプション） |
| `claimedByUid` | ❌ | 認証したユーザーのUID（オプション） |

---

## 🔍 確認方法

### メール送信の確認

1. Firebase Console → Functions → `onClaimRequestUpdated` のログを確認
2. 以下のログが表示されれば成功：
   ```
   📧 Sending URLs email for requestId: ...
   ✅ URLs email sent successfully for requestId: ...
   ```

### Firestoreの確認

`claimRequests/{requestId}` ドキュメントで以下を確認：
- `publicPageUrl`: 設定されているか
- `loginUrl`: 設定されているか
- `urlsEmailSent`: `true`になっているか

---

## ⚠️ 注意事項

1. **`requestId`はJWTトークンから取得**してください
2. **URLは正しい形式**で生成してください
3. **エラーハンドリング**を実装してください
4. **ログ出力**を実装してください

---

## 🐛 よくある問題

### メールが送信されない

- Firestoreトリガーのログを確認
- `publicPageUrl`と`loginUrl`が設定されているか確認
- `urlsEmailSent`が`false`のままか確認

### API呼び出しが失敗する

- `requestId`が正しいか確認
- 必須パラメータがすべて含まれているか確認
- ネットワークエラーがないか確認

---

詳細は `CMS_URL_SETUP_AND_EMAIL_SENDING.md` を参照してください。

