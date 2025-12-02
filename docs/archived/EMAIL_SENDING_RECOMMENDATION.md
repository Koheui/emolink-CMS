# メール送信方式 - LP側でメール送信（確定方針）

## 📋 概要

**確定方針**: LP側でメール送信する方式で実装を進めます。

この方針は、**Gmail認証情報の管理**や**セキュリティ**の観点から決定されました。

## 🎯 推奨方式: LP側でメール送信

### 理由

1. **認証情報の管理**
   - CMS側でGmail認証情報（`GMAIL_USER`, `GMAIL_APP_PASSWORD`）を管理する必要がない
   - LP側で既にメール送信機能があるため、認証情報を一元管理できる

2. **セキュリティ**
   - メール送信の認証情報をCMS側に持たないことで、セキュリティリスクを低減
   - LP側でメール送信を一元管理できる

3. **運用面**
   - LP側で既にメール送信機能があるため、追加の設定が不要
   - メール内容のカスタマイズもLP側で自由に行える

4. **柔軟性**
   - LP側でメール送信のタイミングや内容を自由に制御できる
   - テナントごとのメール内容のカスタマイズも容易

## 🔄 推奨フロー

```
1. LPから認証リンク → /claim
2. パスワード設定/ログイン
   ↓
3. createPublicPageAndUpdateClaimRequest実行（CMS側）
   - 公開ページ作成（memoryId: ''）
   - Functions API `/api/claim/{requestId}/set-urls`呼び出し
   - claimRequestにURL設定
   ↓
4. LP側でURLを取得（ポーリング）
   - GET /api/claim/{requestId}/urls を定期的に呼び出し
   - URLが取得できたらメール送信
   ↓
5. LP側でメール送信
   - 公開ページURL
   - ログインURL
   ↓
6. 完了
```

## 📝 実装が必要な項目

### 1. CMS側: `/api/claim/{requestId}/urls` APIの実装

現在、このAPIは`output: export`のため削除されていますが、**Firebase Functionsとして実装**する必要があります。

**実装場所**: Firebase Functions側（`apiV2`プロジェクト）

**エンドポイント**:
```
GET https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/{requestId}/urls
```

**レスポンス例**:
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

### 2. LP側: ポーリング実装

認証リンク送信後、定期的にAPIを呼び出してURLを取得します。

**実装例**:
```typescript
async function pollForUrls(requestId: string, maxAttempts: number = 30): Promise<UrlsResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/${requestId}/urls`
    );
    const data = await response.json();
    
    if (data.ok) {
      return data; // URL取得成功
    }
    
    if (response.status === 202) {
      // まだURLが生成されていない場合、5秒待って再試行
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    
    throw new Error(data.error || 'Failed to get URLs');
  }
  
  throw new Error('Timeout: URLs not generated within expected time');
}

// メール送信
async function sendWelcomeEmail(email: string, requestId: string) {
  const urls = await pollForUrls(requestId);
  
  await sendEmail({
    to: email,
    subject: 'アカウント作成完了',
    body: `
      アカウントが作成されました。
      
      【公開ページURL（NFCタグ用）】
      ${urls.publicPageUrl}
      
      【次回ログイン用URL】
      ${urls.loginUrl}
    `
  });
}
```

### 3. CMS側: メール送信の無効化

Firebase Functions側の自動メール送信を無効化するか、`urlsEmailSent`フラグを設定しないようにします。

## 🔄 現在の実装からの変更点

### 変更前（Firebase Functions側で自動メール送信）

```
CMS側 → set-urls API呼び出し
  ↓
Firebase Functions側 → claimRequest更新
  ↓
Firestoreトリガー発火 → メール送信（自動）
```

### 変更後（LP側でメール送信）

```
CMS側 → set-urls API呼び出し
  ↓
Firebase Functions側 → claimRequest更新
  ↓
LP側 → URL取得（ポーリング）
  ↓
LP側 → メール送信
```

## ✅ メリット

1. **認証情報の管理が不要**
   - CMS側でGmail認証情報を管理する必要がない

2. **セキュリティ向上**
   - メール送信の認証情報をCMS側に持たない

3. **運用の簡素化**
   - LP側で既にメール送信機能があるため、追加の設定が不要

4. **柔軟性**
   - LP側でメール内容を自由にカスタマイズできる

## ⚠️ 注意事項

1. **APIエンドポイントの実装**
   - `/api/claim/{requestId}/urls` APIをFirebase Functionsとして実装する必要がある
   - 現在は削除されているため、再実装が必要

2. **ポーリングの実装**
   - LP側でポーリング処理を実装する必要がある
   - タイムアウト処理やエラーハンドリングが必要

3. **メール送信のタイミング**
   - 認証成功後、数秒以内にURLが利用可能になる
   - ポーリング間隔は5秒を推奨（最大30回 = 約2.5分）

## 📊 比較表

| 項目 | Firebase Functions側送信 | LP側送信（推奨） |
|------|-------------------------|-----------------|
| **認証情報の管理** | CMS側でGmail認証情報が必要 | LP側で一元管理 |
| **セキュリティ** | CMS側に認証情報を持つ | 認証情報をCMS側に持たない |
| **運用の複雑さ** | 環境変数の設定が必要 | LP側で既存機能を利用 |
| **メール内容のカスタマイズ** | Functions側で制御 | LP側で自由にカスタマイズ可能 |
| **追加の実装** | Firestoreトリガー | ポーリング処理 |

## 🎯 結論

**LP側でメール送信する方式を推奨します。**

理由：
- Gmail認証情報の管理が不要
- セキュリティ面でのリスク低減
- LP側で既にメール送信機能がある
- メール内容のカスタマイズが容易

**実装が必要な項目**:
1. `/api/claim/{requestId}/urls` APIをFirebase Functionsとして実装
2. LP側でポーリング処理を実装
3. LP側でメール送信処理を実装

---

**最終更新日**: 2025-01-XX  
**バージョン**: 1.0

