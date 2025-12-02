# メール送信フロー - LP側とCMS側の連携

## 📋 概要

このドキュメントは、アカウント作成時のメール送信について、LP側とCMS側のどちらが送信するかを明確にします。

## 🔄 現在の実装フロー

### フロー1: CMS側（Functions）で自動メール送信（現在の実装）

```
1. LPから認証リンク → /claim
2. パスワード設定/ログイン
   ↓
3. createPublicPageAndUpdateClaimRequest実行
   - 公開ページ作成（memoryId: ''）
   - Functions API `/api/claim/{requestId}/set-urls`呼び出し
   - claimRequestにURL設定
   ↓
4. Firestoreトリガー発火（自動）
   - onClaimRequestUpdated関数が実行
   - sendUrlsEmail関数が自動実行
   - メール送信（Functions側）
   - urlsEmailSent: true を設定
   ↓
5. 完了
```

**特徴**:
- ✅ LP側で追加の処理は不要
- ✅ メール送信は自動的に実行される
- ✅ 重複送信防止（`urlsEmailSent`フラグ）

**メール送信タイミング**:
- 認証成功後、数秒以内に自動送信

---

### フロー2: LP側でメール送信（代替案）

```
1. LPから認証リンク → /claim
2. パスワード設定/ログイン
   ↓
3. createPublicPageAndUpdateClaimRequest実行
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

**特徴**:
- ⚠️ LP側でポーリング処理が必要
- ⚠️ `/api/claim/{requestId}/urls` APIが必要（現在は削除済み）
- ✅ LP側でメール内容をカスタマイズ可能

**注意事項**:
- 現在、`/api/claim/{requestId}/urls` APIは`output: export`のため削除されています
- LP側でメール送信する場合は、Firebase Functionsとして再実装する必要があります

---

## ✅ 現在の実装での回答

**質問**: 「CMSからメールを送信するということでまちがいありませんか？」

**回答**: 
- **はい、正確には「Firebase Functions側からメールを送信」します**
- CMS側（Next.jsアプリ）から直接メールを送信するのではなく、**Firebase Functions側でメール送信**が実行されます
- LP側で追加の処理は不要です

### 現在のフローでの動作

1. **認証成功時（CMS側 - Next.jsアプリ）**:
   - `createPublicPageAndUpdateClaimRequest`が実行される
   - Functions API `https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/{requestId}/set-urls`を呼び出す
   - このAPIは**Firebase Functions側**で実装されている

2. **URL設定（Firebase Functions側）**:
   - `set-urls` APIが`claimRequest`に`publicPageUrl`と`loginUrl`を設定する
   - Firestoreトリガー`onClaimRequestUpdated`が自動発火（予定）

3. **自動メール送信（Firebase Functions側）**:
   - Firestoreトリガー`onClaimRequestUpdated`が自動発火
   - `sendUrlsEmail`関数が自動実行される
   - メールが送信される（**Firebase Functions側**）
   - `urlsEmailSent: true`が設定される

4. **LP側の処理**:
   - **追加の処理は不要**
   - メール送信は自動的に実行される

### ⚠️ 重要な注意事項

**「CMSからメールを送信」という表現について**:
- **正確には**: Firebase Functions側（バックエンド）からメールを送信します
- **CMS側（Next.jsアプリ）**: Functions APIを呼び出すだけ（メール送信は実行しない）
- **Firebase Functions側**: 実際にメール送信を実行する

**実装の場所**:
- メール送信関数: `functions/src/email-service.ts`（実装済み）
- `set-urls` API: Firebase Functions側で実装（`apiV2`プロジェクト）
- Firestoreトリガー: Firebase Functions側で実装（`apiV2`プロジェクト）

---

## 🔄 LP側でメール送信したい場合

LP側でメールを送信したい場合は、以下の実装が必要です：

### 1. APIエンドポイントの再実装

`/api/claim/{requestId}/urls` APIをFirebase Functionsとして実装する必要があります（現在は削除済み）。

### 2. LP側でのポーリング実装

```typescript
async function pollForUrls(requestId: string): Promise<UrlsResponse> {
  for (let i = 0; i < 30; i++) {
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
  
  throw new Error('Timeout: URLs not generated');
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

### 3. CMS側の修正

- `set-urls` APIで`urlsEmailSent`を設定しない（LP側で送信するため）
- または、LP側で送信する場合は、Functions側の自動送信を無効化

---

## 📊 比較表

| 項目 | CMS側自動送信（現在） | LP側送信（代替案） |
|------|---------------------|-------------------|
| **実装の複雑さ** | 低（自動） | 中（ポーリング必要） |
| **メール送信タイミング** | 認証成功後、数秒以内 | ポーリング成功後 |
| **メール内容のカスタマイズ** | Functions側で制御 | LP側で自由にカスタマイズ可能 |
| **追加のAPI** | 不要 | `/api/claim/{requestId}/urls`が必要 |
| **重複送信防止** | `urlsEmailSent`フラグで自動 | LP側で実装が必要 |

---

## 🎯 推奨事項

### ⭐ LP側でメール送信する方式を推奨（変更）

**理由**:
1. **認証情報の管理が不要**: CMS側でGmail認証情報（`GMAIL_USER`, `GMAIL_APP_PASSWORD`）を管理する必要がない
2. **セキュリティ向上**: メール送信の認証情報をCMS側に持たないことで、セキュリティリスクを低減
3. **運用の簡素化**: LP側で既にメール送信機能があるため、追加の設定が不要
4. **柔軟性**: LP側でメール内容を自由にカスタマイズできる

**実装が必要な項目**:
- `/api/claim/{requestId}/urls` APIをFirebase Functionsとして実装
- LP側でポーリング処理を実装
- LP側でメール送信処理を実装

詳細は `EMAIL_SENDING_RECOMMENDATION.md` を参照してください。

### 現在の実装（Firebase Functions側自動送信）

**注意**: この方式は、Gmail認証情報の管理が必要です。

**理由**:
1. **シンプル**: LP側で追加の処理が不要
2. **確実**: Firestoreトリガーで自動実行されるため、確実にメールが送信される
3. **重複防止**: `urlsEmailSent`フラグで自動的に重複送信を防止
4. **メンテナンス性**: メール送信ロジックが一箇所に集約される

**必要な設定**:
- `GMAIL_USER`環境変数の設定
- `GMAIL_APP_PASSWORD`環境変数の設定
- Firebase Functions側での環境変数設定

---

## 🔍 確認方法

### CMS側自動送信が正常に動作しているか確認

1. **Firebase Console → Functions → ログ**を確認
   - `onClaimRequestUpdated`のログを確認
   - `sendUrlsEmail`のログを確認

2. **Firestoreで確認**:
   - `claimRequests/{requestId}`を確認
   - `publicPageUrl`と`loginUrl`が設定されているか
   - `urlsEmailSent: true`になっているか

3. **メール受信確認**:
   - ユーザーのメールボックスを確認
   - 公開ページURLとログインURLが含まれているか

---

## 📝 まとめ

### 現在の実装での回答

**「CMSからメールを送信するということでまちがいありませんか？」**

→ **はい、正確には「Firebase Functions側からメールを送信」します。CMS側（Next.jsアプリ）から直接メールを送信するのではなく、Firebase Functions側（バックエンド）でメール送信が実行されます。**

### フロー

```
1. LPから認証リンク → /claim
2. パスワード設定/ログイン
   ↓
3. createPublicPageAndUpdateClaimRequest実行（CMS側 - Next.js）
   - 公開ページ作成（memoryId: ''）
   - Functions API呼び出し
   ↓
4. set-urls API実行（Firebase Functions側）
   - claimRequestにURL設定
   ↓
5. Firestoreトリガー発火（自動）
   - onClaimRequestUpdated関数が実行
   - sendUrlsEmail関数が自動実行
   - メール送信（Firebase Functions側）
   ↓
6. 完了
```

**役割分担**:
- **CMS側（Next.jsアプリ）**: Functions APIを呼び出すだけ
- **Firebase Functions側**: 実際にメール送信を実行
- **LP側**: 追加の処理は不要

---

**最終更新日**: 2025-01-XX  
**バージョン**: 1.0

