# CRM・CMS データベース設計レビュー結果

## 📋 レビュー日時
2024-12-08

## ✅ 修正完了項目

### 1. Tenant型に`contact`フィールドを追加
- **問題**: 設計書では`tenants`コレクションに`contact`フィールドが定義されていなかったが、実装（印刷ページ）では`tenantData?.contact?.postalCode`や`tenantData?.contact?.address`を参照していた
- **修正**: 
  - `src/types/index.ts`の`Tenant`型に`contact`フィールドを追加
  - `docs/specifications/DATABASE_DESIGN.md`の`tenants`コレクション定義に`contact`フィールドを追加
- **状態**: ✅ 完了

## ⚠️ 確認が必要な項目

### 2. `tenant`フィールドの値が識別可能なIDを使用しているか
- **設計書の要件**: 
  - `memories`、`orders`、`users`、`claimRequests`などの`tenant`フィールドには、`tenants`コレクションの`id`フィールド（識別可能なID、例: `emolink-direct-01`）を使用すべき
  - FirestoreドキュメントID（例: `store-1765044610296`）は使用しない
- **現在の実装**:
  - `getCurrentTenant()`は`ORIGIN_TENANT_MAP`から`tenant`を取得しており、`'store-1764868335259'`のようなFirestoreドキュメントIDを返している可能性がある
  - `createMemory()`や`processClaimRequest()`では、`getCurrentTenant()`の戻り値をそのまま`tenant`フィールドに設定している
- **影響範囲**:
  - 既存データがFirestoreドキュメントIDで保存されている場合、クエリ時に問題が発生する可能性がある
  - 新規データ作成時に識別可能なIDを使用するように修正が必要
- **推奨対応**:
  1. `getCurrentTenant()`を修正し、FirestoreドキュメントIDから`tenants.id`フィールドを取得して返すようにする
  2. 既存データのマイグレーションを検討する（必要に応じて）
  3. 新規データ作成時に`tenants.id`フィールドを使用することを確認する

### 3. CRMとCMSの実装が設計書の要件を満たしているか
- **確認項目**:
  - ✅ `Tenant`型に`contact`フィールドが追加された
  - ⚠️ `tenant`フィールドの値が識別可能なIDを使用しているか（要確認）
  - ✅ テナント分離が正しく実装されているか（`where('tenant', '==', tenantId)`が使用されている）
  - ✅ `companies`コレクションへのアクセスが正しく実装されているか
  - ✅ `orders`コレクションの`customerInfo`フィールドが正しく使用されているか
  - ✅ `orders`コレクションの`lpId`フィールドが正しく使用されているか

## 📝 実装状況の詳細

### CRM実装
- ✅ `/crm/orders` - 注文一覧ページ: テナントフィルタリングが実装されている
- ✅ `/crm/orders/[id]` - 注文詳細ページ: 企業名・店舗名の取得が実装されている
- ✅ `/crm/orders/[id]/print` - 印刷ページ: `tenant.contact`フィールドを参照している（修正済み）
- ✅ `/crm/customers` - 顧客一覧ページ: テナントフィルタリングが実装されている
- ✅ `/crm/customers/[id]` - 顧客詳細ページ: 顧客情報の取得が実装されている

### CMS実装
- ✅ `/memories/create` - メモリ作成ページ: `getCurrentTenant()`を使用してテナントを設定
- ✅ `/memories/initial-setup` - 初期設定ページ: `getCurrentTenant()`を使用してテナントを設定
- ✅ `createMemory()` - メモリ作成関数: `getCurrentTenant()`を使用してテナントを設定
- ✅ `processClaimRequest()` - クレーム処理: `claimRequest.tenant`を使用してテナントを設定

## 🔍 設計書との整合性チェック

### コレクション構造
- ✅ `companies` - 設計書通り
- ✅ `tenants` - `contact`フィールドを追加（設計書を更新）
- ✅ `users` - 設計書通り
- ✅ `staff` - 設計書通り
- ✅ `memories` - 設計書通り
- ✅ `publicPages` - 設計書通り
- ✅ `orders` - 設計書通り（`customerInfo`、`lpId`フィールドが追加されている）
- ✅ `claimRequests` - 設計書通り

### テナント分離
- ✅ すべてのコレクションで`tenant`フィールドによる分離が実装されている
- ⚠️ `tenant`フィールドの値が識別可能なIDを使用しているか（要確認）

## 🚨 注意事項

1. **既存データとの互換性**: 既存データがFirestoreドキュメントIDで保存されている場合、クエリ時に問題が発生する可能性があります。必要に応じてマイグレーションを検討してください。

2. **テナントIDの取得方法**: `getCurrentTenant()`がFirestoreドキュメントIDを返している場合、`tenants`コレクションから`id`フィールドを取得して使用するように修正する必要があります。

3. **設計書の更新**: `tenants`コレクションに`contact`フィールドを追加したため、設計書を更新しました。他のアプリケーション（LP等）でも同様の更新が必要になる可能性があります。

## 📌 次のステップ

1. ⚠️ `getCurrentTenant()`の実装を確認し、識別可能なIDを返すように修正する
2. ⚠️ 既存データの`tenant`フィールドが識別可能なIDを使用しているか確認する
3. ⚠️ 必要に応じてマイグレーションスクリプトを作成する
4. ✅ 設計書の更新を完了（`contact`フィールドの追加）

