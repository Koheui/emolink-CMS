# CRM Phase1 実装完了レポート

## 📋 実装日時
2025-01-26

## ✅ 実装内容

### 1. Staff型の更新

**変更内容**:
- `role`フィールドに`editor`と`viewer`を追加
- `fulfillmentOperator`を`editor`に変更（後方互換性のため、既存データは移行が必要）
- `permissions`フィールドを更新：
  - `canViewCRM`: CRM閲覧権限
  - `canEditOrders`: 注文編集権限
  - `canEditCustomers`: 顧客編集権限
  - `canManageStaff`: スタッフ管理権限
  - `canWriteNfc`: NFC書き込み権限
  - `canManageTenants`: テナント管理権限

**変更ファイル**:
- `src/types/index.ts`

### 2. 権限チェック関数の実装

**新規作成ファイル**:
- `src/lib/security/role-check.ts`

**実装した関数**:
- `canAccessCRM()`: CRM閲覧権限（閲覧者以上）
- `canEditOrders()`: 注文編集権限（編集者以上）
- `canEditCustomers()`: 顧客編集権限（編集者以上）
- `canWriteNFC()`: NFC書き込み権限（編集者以上）
- `canManageStaff()`: スタッフ管理権限（管理者のみ）
- `canManageTenants()`: テナント管理権限（スーパー管理者のみ）
- `getStaffPermissions()`: スタッフの権限を取得
- `getRolePriority()`: ロールの優先順位を取得
- `hasRoleOrHigher()`: ロールの比較

### 3. 認証コンテキストの拡張

**変更内容**:
- `useSecretKeyAuth`フックに権限チェック関数を追加
- 以下のプロパティを追加：
  - `canAccessCRM`: CRM閲覧権限
  - `canEditOrders`: 注文編集権限
  - `canEditCustomers`: 顧客編集権限
  - `canWriteNFC`: NFC書き込み権限
  - `canManageStaff`: スタッフ管理権限
  - `canManageTenants`: テナント管理権限
  - `staffPermissions`: スタッフの権限情報

**変更ファイル**:
- `src/contexts/secret-key-auth-context.tsx`

### 4. Firestore Rulesの更新

**変更内容**:
- `staff`コレクション: 管理者（tenantAdmin/superAdmin）のみが他のスタッフ情報を読み取り・書き込み可能
- `orders`コレクション: 
  - 閲覧者以上が読み取り可能
  - 編集者以上が更新可能
  - 作成・削除はFunctionsまたは管理者のみ
- `users`コレクション: 
  - エンドユーザーは自分の情報を読み取り・書き込み可能
  - 閲覧者以上が同じテナントの顧客情報を読み取り可能（CRM用）
- `claimRequests`コレクション: 
  - 閲覧者以上が同じテナントのリクエストを読み取り可能（CRM用）

**変更ファイル**:
- `firestore.rules`

## 🔒 権限体系

### ロール定義

1. **管理者（tenantAdmin / superAdmin）**
   - すべての権限
   - スタッフの追加・削除・権限変更
   - 顧客・注文の閲覧・編集・削除
   - NFC書き込み
   - テナント設定の管理（superAdminのみ）

2. **編集者（editor）**
   - 顧客・注文の閲覧
   - 注文ステータスの更新
   - 配送情報の更新
   - NFC書き込み
   - ソーティング・フィルタリング

3. **閲覧者（viewer）**
   - 顧客・注文の閲覧のみ
   - ソーティング・フィルタリング
   - 編集・削除・NFC書き込みは不可

## ⚠️ 重要な注意事項

### 1. 権限体系の分離

**CRMの権限体系は弊社スタッフ専用で、LPの権限とは異なります。**

- CRMの権限: `staff`コレクションで管理（tenantAdmin, superAdmin, editor, viewer）
- LPの権限: `users`コレクションで管理（エンドユーザー）

### 2. 後方互換性

- `fulfillmentOperator`ロールは`editor`に変更されました
- 既存の`fulfillmentOperator`ロールのデータは、マイグレーションが必要です

### 3. テナント分離

- すべてのCRM機能でテナント分離を実施
- `adminTenant`フィールドでスタッフのテナントを管理
- Firestore Rulesでテナント検証を実施

## 📝 次のステップ

Phase1が完了したので、次のPhase2（顧客管理機能）の実装に進みます。

---

**作成日**: 2025-01-26  
**バージョン**: 1.0

