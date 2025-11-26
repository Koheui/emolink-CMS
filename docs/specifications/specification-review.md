# Specification精査結果

**作成日**: 2025年1月  
**目的**: specification（仕様書）と実装状況の整合性を確認

---

## 📋 Specificationバージョン一覧

### 最新版
- **v3.3** (2025-08-30): NFC書き込み・印刷・出荷をCMSから分離、専用アプリに委譲
- **v3.2**: 管理者仕様とFirebaseコンソール設定
- **v3.1**: メール発行型クレーム方式
- **v3.0**: 秘密鍵（claim key）方式
- **v2.6**: 詳細版

---

## ✅ Specification v3.3との整合性確認

### 1. 廃止・停止すべき機能の実装状況

#### ❌ 問題: 注文ステータスのフロント更新機能が実装されている

**Specification v3.3の要求**:
> 書き込み・印刷・出荷の **工程更新は Functions API 経由のみ**（CMSフロント直更新は禁止）。

**実装状況**:
- `src/app/orders/page.tsx` に `updateOrderStatus()` 関数が実装されている
- フロントから直接 `updateOrder()` を呼び出している
- `orderStatus` をフロントから更新可能

**対応が必要**:
- `updateOrderStatus()` 関数を削除または無効化
- 注文ステータス更新は Functions API 経由のみに変更
- UIからは削除（参照のみ表示）

#### ✅ 良好: NFC書き込みUIは実装されていない

**Specification v3.3の要求**:
> NFC書き込みボタン／書き込みウィザードを削除

**実装状況**:
- NFC書き込みボタンは実装されていない
- NFC URL表示モーダルのみ実装（参照用、問題なし）

#### ✅ 良好: 印刷・梱包・出荷のフロント更新UIは実装されていない

**Specification v3.3の要求**:
> `print.qrPrinted` 等の工程トグルをフロントから切り替える操作を削除

**実装状況**:
- `print.qrPrinted` のフロント更新UIは実装されていない
- 型定義には存在するが、UI操作はなし

#### ✅ 良好: Firestore Rulesは正しく設定されている

**Specification v3.3の要求**:
> `orders/*` の **write を全面禁止（クライアント）**

**実装状況**:
- `firestore.rules` で `orders/*` の `write: if false` が設定済み
- クライアントからの書き込みは既に禁止されている

**注意**: ただし、`updateOrder()` 関数が `src/lib/firestore.ts` に実装されているため、この関数を削除または無効化する必要がある

---

## 📊 Specification v3.1との整合性確認

### ✅ 実装済み機能

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

---

## 📊 Specification v3.2との整合性確認

### ⚠️ 部分実装

#### 管理者権限システム
- ✅ 権限ロールの概念は実装済み（`secret-key-auth-context.tsx`）
- ⚠️ Custom Claims の実装状況を確認が必要
- ⚠️ `superAdmin`, `tenantAdmin`, `fulfillmentOperator` の完全な実装を確認が必要

#### Firebase コンソール設定
- ✅ Firestore Rules は実装済み
- ⚠️ Firebase Auth の設定（Emailリンク、continueUrl）は確認が必要
- ⚠️ Storage Rules の詳細設定を確認が必要

---

## 🔧 修正が必要な項目

### 高優先度

1. **注文ステータス更新機能の削除**
   - `src/app/orders/page.tsx` の `updateOrderStatus()` 関数を削除
   - 注文ステータス更新のUIボタンを削除
   - 注文ステータスは参照のみ表示

2. **`updateOrder()` 関数の無効化**
   - `src/lib/firestore.ts` の `updateOrder()` 関数を削除または無効化
   - または、Functions API 経由でのみ更新できるように変更

### 中優先度

1. **Custom Claims の実装確認**
   - `superAdmin`, `tenantAdmin`, `fulfillmentOperator` の完全な実装
   - Custom Claims の設定方法の確認

2. **Firebase コンソール設定の確認**
   - Emailリンク認証の設定
   - continueUrl の設定
   - Storage Rules の詳細確認

---

## 📝 仕様変更の記録

### v3.3で変更された仕様

1. **NFC書き込み・印刷・出荷の分離**
   - 変更前: CMS内でNFC書き込み・印刷・出荷を管理
   - 変更後: 専用のNFC Writerアプリに委譲
   - 影響: CMSから該当機能を削除

2. **注文更新の制限**
   - 変更前: CMSフロントから注文ステータスを更新可能
   - 変更後: Functions API 経由のみ更新可能
   - 影響: `updateOrder()` 関数とUIの削除が必要

---

## 🎯 次のアクション

1. **✅ 完了した対応**:
   - [x] `src/app/orders/page.tsx` から `updateOrderStatus()` 関数を削除
   - [x] 注文ステータス更新のUIボタンを削除（参照のみ表示に変更）
   - [x] `src/lib/firestore.ts` の `updateOrder()` 関数をコメントアウト（無効化）

2. **確認が必要**:
   - [ ] Custom Claims の実装状況
   - [ ] Firebase コンソール設定の確認
   - [ ] Storage Rules の詳細確認

3. **ドキュメント更新**:
   - [x] `specification-review.md` に精査結果を記録
   - [ ] `TODO-CMS.md` に仕様変更を反映

---

## ✅ 修正完了（2025年1月）

### 実施した修正

1. **注文ステータス更新機能の削除**
   - `updateOrderStatus()` 関数を削除
   - 注文ステータス更新のUIボタンを削除
   - 注文ステータスは参照のみ表示（説明文を追加）

2. **`updateOrder()` 関数の無効化**
   - `src/lib/firestore.ts` の `updateOrder()` 関数をコメントアウト
   - 仕様に準拠したコメントを追加

3. **写真アップロード後の自動ステータス更新を削除**
   - 写真アップロード後の自動ステータス更新を削除
   - コメントで仕様に準拠していることを明記

---

**注意**: デザインは変更しない前提で、機能の削除・無効化のみ実施

