# Specification統合版（最新）

**最終更新**: 2025年1月  
**最新バージョン**: v3.3 (2025-08-30)

このドキュメントは、すべてのspecificationファイルを統合した最新版です。

---

## 📋 バージョン履歴

- **v3.3** (2025-08-30): NFC書き込み・印刷・出荷をCMSから分離、専用アプリに委譲
- **v3.2**: 管理者仕様とFirebaseコンソール設定
- **v3.1**: メール発行型クレーム方式（JWT方式）
- **v3.0**: 秘密鍵（claim key）方式
- **v2.6**: 詳細版

---

## 🎯 現在の認証方式（v3.1以降）

### メール発行型クレーム方式

**フロー**:
1. LPフォーム送信 → Functions API → `claimRequests` 作成
2. FunctionsがJWT（72h有効、1回限り）を生成しメール送信
3. ユーザーがリンクを開きログイン → memory新規発行
4. `ownerUid=currentUser.uid` を割当
5. エディタに遷移 → 公開 → 静的ページ生成

**URL形式**:
```
https://app.example.com/claim?k=<JWT>
```

**データモデル**:
- `claimRequests/{requestId}`: 申込管理
- JWTトークン: 72時間有効、1回限り使用

---

## 📊 実装状況と仕様の整合性

### ✅ 実装済み（v3.1準拠）

#### メール発行型クレーム方式
- ✅ `claimRequests` コレクションの実装
- ✅ JWT検証機能（`/claim` ページ）
- ✅ メモリー自動作成機能
- ✅ `auditLogs` への記録

#### データモデル
- ✅ `claimRequests/{requestId}` の実装
- ✅ `memories/{memoryId}` の実装
- ✅ `publicPages/{pageId}` の実装
- ✅ `auditLogs/{date}/{logId}` の実装

#### セキュリティ
- ✅ `claimRequests` は Functions のみ書込可能
- ✅ `memories`, `assets` は owner/admin のみ
- ✅ `publicPages` は read-only（Functionsのみ書込）
- ✅ Originベースのテナント検証
- ✅ テナント間のデータ分離
- ✅ reCAPTCHA検証

---

## 🚫 v3.3で廃止・停止された機能

### CMSから撤去された機能

1. **NFC関連 UI/処理**
   - NFC書き込みボタン／書き込みウィザード（実装されていない ✅）
   - タグ読取・書込・再検証のフロント実装（実装されていない ✅）
   - ブラウザWebNFCの実験的コード（実装されていない ✅）

2. **印刷・梱包・出荷の UI/処理**
   - QR台紙 一括PDF 生成ボタン（実装されていない ✅）
   - `print.qrPrinted` 等の工程トグル（実装されていない ✅）
   - 出荷/梱包のフロント更新（削除済み ✅）

3. **注文ステータス更新**
   - フロントからの注文ステータス更新（削除済み ✅）
   - `updateOrder()` 関数（無効化済み ✅）

> **備考**: 参照用の一覧表示（読み取りのみ）は残してOK。編集系の操作要素は削除。

---

## 🔄 仕様変更の記録

### v3.1での変更（秘密鍵方式 → メール発行型クレーム方式）

**変更前（v3.0, v2.6）**:
- 秘密鍵（claim key）方式
- 16桁の英数字文字列
- 決済完了後に秘密鍵を生成・メール送信

**変更後（v3.1以降）**:
- メール発行型クレーム方式（JWT方式）
- JWTトークン（72h有効、1回限り）
- LPフォーム送信後にJWT生成・メール送信

**理由**: セキュリティ向上と運用の簡素化

### v3.3での変更（NFC書き込み・印刷・出荷の分離）

**変更前（v3.2）**:
- CMS内でNFC書き込み・印刷・出荷を管理
- フロントから注文ステータスを更新可能

**変更後（v3.3）**:
- 専用のNFC Writerアプリに委譲
- Functions API 経由のみ更新可能

**理由**: 現場オペレーションの分離とCMSの簡素化

---

## 📝 現在の実装状況

### 認証システム

#### 実装済み
- ✅ 秘密鍵ベース認証（開発用・管理用）
- ✅ 開発用パスワード認証
- ✅ メール発行型クレーム方式（JWT方式）

#### 使用状況
- **開発環境**: 秘密鍵認証 + 開発用パスワード認証
- **本番環境**: メール発行型クレーム方式（JWT方式）

### データモデル

#### Firestore コレクション
- ✅ `claimRequests/{requestId}`: 申込管理
- ✅ `memories/{memoryId}`: 想い出ページ
- ✅ `assets/{assetId}`: メディアファイル
- ✅ `publicPages/{pageId}`: 公開ページ
- ✅ `orders/{orderId}`: 注文管理（参照専用）
- ✅ `secretKeys/{secretKeyId}`: 秘密鍵管理（開発用）

---

## 🔧 Firestore Rules（v3.3準拠）

### 重要なルール

```javascript
// orders/* の write を全面禁止（クライアント）
match /orders/{orderId} {
  allow read: if isAuthenticated() && isSameTenant(resource.data.tenant);
  allow write: if false; // ← CMSフロントからの工程更新を禁止
}

// claimRequests/* は Functions のみ書込可能
match /claimRequests/{requestId} {
  allow read: if true; // 開発環境では誰でも読み取り可能
  allow write: if isAuthenticated() && isSameTenant(resource.data.tenant);
}

// memories/*, assets/* は owner/admin のみ
match /memories/{memoryId} {
  allow read: if true; // 開発環境では誰でも読み取り可能
  allow create: if isAuthenticated() && 
    request.resource.data.ownerUid == request.auth.uid &&
    request.resource.data.tenant != null;
  allow update, delete: if isAuthenticated() && 
    isOwner(resource.data.ownerUid) && 
    isSameTenant(resource.data.tenant);
}

// publicPages/* は read-only（Functionsのみ書込）
match /publicPages/{pageId} {
  allow read: if true; // 公開ページは誰でも読み取り可能
  allow write: if isAuthenticated() && 
    isSameTenant(resource.data.tenant);
}
```

---

## 📚 関連ドキュメント

### 統合済み（このドキュメントに統合）
- `specification-v3.3.md` → 最新版として統合
- `specification-v3.2.md` → 管理者仕様として統合
- `specification-v3.1.md` → メール発行型クレーム方式として統合
- `specification-v3.0.md` → 秘密鍵方式として記録
- `specification-v2.6.md` → 詳細版として記録
- `secret-key-v1.0.md` → 古い仕様として記録（参照用）

### 参照用（保持）
- `system-architecture.v4.2.md`: システムアーキテクチャ
- `LP-spec-v1.0.md`: LP側の仕様
- `TODO-CMS.md`: 実装状況と今後のタスク
- `specification-review.md`: 仕様書と実装の整合性確認

---

## 📖 詳細仕様（v3.1, v3.2, v3.3）

### v3.1: メール発行型クレーム方式

#### ユーザーフロー
1. Stripe決済／店舗受付／LPフォーム → `claimRequests` に記録
2. FunctionsがJWT（72h有効、1回限り）を生成しメール送信
3. URL例：`https://app.example.com/claim?k=<JWT>`
4. ユーザーがリンクを開きログイン → memory新規発行
5. `ownerUid=currentUser.uid` を割当
6. `publicPageId` 払い出し
7. エディタに遷移 → 公開 → 静的ページ生成

#### データモデル（Firestore）
- `claimRequests/{requestId}`: email, tenant, lpId, productType, status, source, sentAt?, claimedAt?, claimedByUid?, memoryId?
- `memories/{memoryId}`: ownerUid, title, type, status, publicPageId, design, blocks[], tenant, lpId
- `auditLogs/{date}/{logId}`: event, actor, tenant, lpId, requestId?, memoryId?, emailHash, timestamp

#### Storage構造
- 編集中：`users/{uid}/memories/{memoryId}/uploads/`
- 処理済：`proc/...`（リサイズ/サムネイル）
- 公開：`deliver/publicPages/{pageId}/...`（immutableキャッシュ）

### v3.2: 管理者仕様とFirebaseコンソール設定

#### 管理者権限ロール
- **superAdmin**: 全テナントの参照・操作可、tenant昇格、NFC初期化など特権操作
- **tenantAdmin**: 自テナントのみ操作可（印刷/NFC書込/出荷）、Custom Claimsに `adminTenant: "<tenantId>"` を必須付与
- **fulfillmentOperator**（任意）: 出荷系操作専用（印刷/NFC/梱包/発送のみ）

#### Custom Claims 設定例
```json
{
  "role": "tenantAdmin",
  "adminTenant": "babyhair"
}
```

#### Firebase コンソール設定
- **Auth**: Emailリンク（パスワードレス）を有効化、continueUrl: `https://app.example.com/claim`
- **Firestore**: インデックス `(tenant, status, updatedAt desc)`, `(tenant, lpId, status, updatedAt desc)`, `(tenant, updatedAt desc)`
- **Storage**: `/deliver/**` → read: true, write: false（Functionsのみ）、`/users/**` → ownerのみ書込可
- **Hosting**: マルチサイト構成、`mem` の `/deliver/**` は immutable, max-age=31536000
- **Functions環境変数**: `FIREBASE_WEB_API_KEY`, `RECAPTCHA_SECRET`, `APP_CLAIM_CONTINUE_URL`, `CORS_ALLOWED_ORIGINS`

### v3.3: NFC書き込み・印刷・出荷の分離

#### 目的
NFC書き込み・印刷・出荷などの"現場オペ"をCMSから分離し、専用のNFC Writerアプリに委譲。CMSは「申込→認証→編集→公開（静的配信）」に集中。

#### 廃止・停止する機能（CMSから撤去）
1. **NFC関連 UI/処理**: NFC書き込みボタン／書き込みウィザード、タグ読取・書込・再検証のフロント実装、ブラウザWebNFCの実験的コード
2. **印刷・梱包・出荷の UI/処理**: QR台紙 一括PDF 生成ボタン、`print.qrPrinted` 等の工程トグルをフロントから切り替える操作、出荷/梱包のフロント更新
3. **顧客一括管理の"現場向け"機能**: 大量行向けの一括操作（CSV一括・一括遷移）、発送番号入力・伝票操作UI

> **備考**: 参照用の一覧表示（読み取りのみ）は残してOK。ただし編集系の操作要素は削除。

#### Firestore / ルール調整
- `orders/*` の **write を全面禁止（クライアント）**。工程更新は Functions のみ。
- `claimRequests/*` は引き続き **クライアント書込不可**（Functionsのみ）。
- `memories/*`, `assets/*` は v3.1 どおり（owner/admin のみ）。
- `auditLogs/*` は Functions のみ作成。

---

## ⚠️ 重要な注意事項

1. **最新仕様は v3.3**（2025-08-30更新）
2. **認証方式は v3.1以降のメール発行型クレーム方式**を使用
3. **秘密鍵方式（v3.0, v2.6）は古い仕様**（参照用のみ）
4. **デザインは変更しない**（完了している前提）
5. **注文ステータス更新は Functions API 経由のみ**（v3.3準拠）

---

**最終更新**: 2025年1月  
**統合元**: specification-v3.3.md, v3.2.md, v3.1.md, v3.0.md, v2.6.md, secret-key-v1.0.md

