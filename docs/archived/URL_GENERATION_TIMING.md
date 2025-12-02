# URL生成のタイミングと確定フロー

## 📋 概要

このドキュメントは、公開ページURLとログインURLが**いつ確定するか**、**LP側がいつ取得できるか**を明確にします。

---

## 🔄 URL確定の完全フロー

### ステップ1: LPフォーム送信
**タイミング**: ユーザーがLPフォームを送信した時点

**処理**:
- LP側でJWTトークンと秘密鍵を生成
- CMS API (`/api/lp-form`) に送信
- `claimRequest`が作成される（`status: 'pending'`）

**この時点でのURL**: ❌ **未生成**

---

### ステップ2: 認証リンク送信
**タイミング**: ステップ1の直後

**処理**:
- LP側で認証リンクを含むメールを送信
- 認証リンク: `https://emolink-cms.web.app/claim?k={JWTトークン}`

**この時点でのURL**: ❌ **未生成**

---

### ステップ3: ユーザーが認証リンクをクリック
**タイミング**: ユーザーがメール内の認証リンクをクリックした時点

**処理**:
- CMS側でJWTトークンを検証
- パスワード設定画面を表示

**この時点でのURL**: ❌ **未生成**

---

### ステップ4: パスワード設定/ログイン完了 ⭐ **URL確定のタイミング**
**タイミング**: ユーザーがパスワードを設定（新規）またはログイン（既存）した時点

**処理**:
1. Firebase Authで認証完了
2. **`createPublicPageAndUpdateClaimRequest`関数が自動実行**:
   - 空の公開ページを作成（`publicPageId`を確定）
   - `publicPageUrl`を生成: `https://emolink-cms.web.app/public/{publicPageId}?tenant={tenant}`
   - `loginUrl`を生成: `https://emolink-cms.web.app/memories/create`
   - Functions API (`/api/claim/{requestId}/set-urls`) を呼び出し
   - `claimRequest`を更新:
     - `publicPageId`: 公開ページID
     - `publicPageUrl`: 公開ページURL
     - `loginUrl`: ログインURL
     - `status`: `'claimed'`
     - `claimedByUid`: ユーザーUID
     - `claimedAt`: 現在時刻

**この時点でのURL**: ✅ **確定完了**

**確定タイミング**: パスワード設定/ログイン完了後、**数秒以内**（通常1-3秒）

---

### ステップ5: LP側でURL取得（ポーリング）
**タイミング**: ステップ2の後、定期的にポーリング開始

**処理**:
1. 以下のAPIを定期的に呼び出し（5秒間隔、最大30回）:
   ```
   GET https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/{requestId}/urls
   ```

2. **レスポンス確認**:
   - **URL未生成時**（HTTP 202）:
     ```json
     {
       "ok": false,
       "error": "URLs not yet generated. Please wait for user authentication.",
       "status": "sent" | "pending"
     }
     ```
     → ポーリング継続

   - **URL取得成功時**（HTTP 200）:
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
     → ポーリング停止、ステップ6へ

**この時点でのURL**: ✅ **取得完了**

---

### ステップ6: LP側でメール送信
**タイミング**: ステップ5でURL取得成功時

**処理**:
1. 取得したURLを使用してメール送信
2. メール内容:
   - 公開ページURL（NFCタグ用）
   - ログインURL（次回ログイン用）

**この時点でのURL**: ✅ **メール送信完了**

---

## ⏱️ タイミングの詳細

### URL確定までの時間

| ステップ | タイミング | URL状態 |
|---------|-----------|---------|
| LPフォーム送信 | 0秒 | ❌ 未生成 |
| 認証リンク送信 | 1-2秒後 | ❌ 未生成 |
| ユーザーが認証リンクをクリック | ユーザー次第 | ❌ 未生成 |
| **パスワード設定/ログイン完了** | **認証リンククリック後** | ✅ **確定（1-3秒以内）** |
| LP側でURL取得 | 認証リンク送信後、ポーリング開始 | ✅ 取得可能 |

### ポーリングの推奨設定

- **開始タイミング**: 認証リンク送信後、即座に開始
- **ポーリング間隔**: 5秒
- **最大試行回数**: 30回（約2.5分）
- **タイムアウト**: 2.5分経過後、エラーハンドリング

### URL確定の確認方法

LP側で以下の条件を確認：

1. **`status`が`'claimed'`になっている**
   - `status: 'pending'` または `'sent'` → URL未生成
   - `status: 'claimed'` → URL確定済み

2. **`publicPageUrl`と`loginUrl`が存在する**
   - 両方のフィールドが存在し、空でない → URL確定済み

---

## 🔍 エラーハンドリング

### ケース1: URL未生成（HTTP 202）

**原因**: ユーザーがまだ認証リンクをクリックしていない、または認証が完了していない

**対応**:
- ポーリングを継続（最大30回）
- タイムアウト後は、ユーザーに確認を依頼

### ケース2: タイムアウト

**原因**: ユーザーが認証リンクをクリックしていない、または認証が完了していない

**対応**:
- ユーザーに認証リンクを再送信
- 手動で確認（CRMでステータスを確認）

### ケース3: APIエラー（HTTP 400/403/404/500）

**原因**: APIエラー、テナント不一致、requestIdが見つからない

**対応**:
- エラーログを記録
- 管理者に通知
- 必要に応じて再試行

---

## ✅ 確定の定義

### URLが「確定」したと判断する条件

1. ✅ `claimRequest.status`が`'claimed'`になっている
2. ✅ `claimRequest.publicPageUrl`が存在し、空でない
3. ✅ `claimRequest.loginUrl`が存在し、空でない
4. ✅ `claimRequest.publicPageId`が存在し、空でない

### URL確定後の動作

- ✅ LP側でメール送信可能
- ✅ NFCタグに入力可能
- ✅ ユーザーがログインURLにアクセス可能

---

## 📝 LP側実装の推奨フロー

```typescript
async function sendWelcomeEmail(email: string, requestId: string) {
  // 1. ポーリング開始（認証リンク送信後）
  const urls = await pollForUrls(requestId, {
    maxAttempts: 30,
    interval: 5000, // 5秒間隔
    timeout: 150000 // 2.5分
  });

  // 2. URL確定の確認
  if (!urls.ok || !urls.publicPageUrl || !urls.loginUrl) {
    throw new Error('URLs not generated');
  }

  // 3. メール送信
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

---

## 🎯 まとめ

### URL確定のタイミング

**確定タイミング**: ユーザーがパスワード設定/ログイン完了した時点（**認証リンククリック後、数秒以内**）

### LP側の対応

1. **認証リンク送信後、即座にポーリング開始**
2. **5秒間隔で最大30回ポーリング**
3. **URL取得成功後、即座にメール送信**

### 重要なポイント

- ✅ URLは**パスワード設定/ログイン完了時に確定**する
- ✅ 確定後、**数秒以内に取得可能**になる
- ✅ LP側は**ポーリングでURLを取得**する
- ✅ URL確定後、**即座にメール送信**可能

---

**最終更新日**: 2025年1月  
**バージョン**: 1.0

