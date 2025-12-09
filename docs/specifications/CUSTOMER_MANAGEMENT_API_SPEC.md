# 顧客管理API仕様書

## 概要

LPの顧客管理画面で使用されるAPIの仕様です。

---

## 1. 顧客一覧取得API

### エンドポイント
```
GET /api/admin/customers
```

### クエリパラメータ
- `tenantId` (推奨): 店舗ID（識別可能なID、例: `emolink-direct-01`）
- `companyId` (後方互換性): 企業ID（非推奨、`tenantId`を使用）
- `lpId` (任意): LP IDでフィルタリング
- `limit` (デフォルト: 50): 取得件数
- `offset` (デフォルト: 0): オフセット
- `search` (任意): メールアドレスまたは備考欄で検索

### 認証
- `Authorization: Bearer {idToken}` ヘッダーが必要

### データ取得ロジック

#### 1. テナント情報の解決
1. `tenantId`が指定されている場合、そのまま使用
2. `companyId`が指定されている場合：
   - `staff`コレクションから`adminTenant`を取得
   - `tenants`コレクションから`companyId`に一致する全てのテナントを取得
   - 識別可能なID（`tenants.id`フィールド）とFirestoreドキュメントIDの両方を取得

#### 2. claimRequestsコレクションからの取得
- `claimRequests`コレクションから、以下の条件でデータを取得：
  - `tenant`フィールドが、識別可能なIDまたはFirestoreドキュメントIDのいずれかに一致
  - 複数の`tenantId`で検索し、結果を結合（重複は`email`で除外）
  - `createdAt`で降順ソート

#### 3. 顧客情報の補完
各顧客について、以下の順序で情報を取得：

1. **customerInfo（顧客名・電話番号）**:
   - 優先: `claimRequests.customerInfo`
   - フォールバック: `orders.customerInfo`（`tenant`の両方の形式を試行）

2. **想い出ページ情報**:
   - `memories`コレクションから、`ownerUid`と`tenant`で検索
   - `tenant`の両方の形式（識別可能なIDとFirestoreドキュメントID）を試行
   - 最初の1件のタイトルと総件数を取得

### レスポンス形式

```typescript
{
  success: true,
  data: {
    customers: [
      {
        customerId: string,           // claimRequestsのドキュメントID
        email: string,                // メールアドレス
        customerName: string,         // 顧客名（お名前）
        phone: string,                // 電話番号
        product: string,              // 商品名
        notes: string,                // 備考欄
        status: string,               // ステータス（'pending' | 'sent' | 'claimed' | 'expired'）
        publicPageUrl: string | null, // 公開ページURL
        loginUrl: string | null,      // ログインURL
        memoryTitle: string | null,   // 想い出ページのタイトル（最初の1件）
        memoryCount: number,          // 想い出ページの件数
        createdAt: string,            // 作成日時（ISO形式）
        updatedAt: string,            // 更新日時（ISO形式）
        claimedAt: string | null      // 認証完了日時（ISO形式）
      }
    ],
    total: number,                    // 総件数（検索条件適用後）
    limit: number,                    // 取得件数
    offset: number                    // オフセット
  }
}
```

### 重要なポイント

1. **データソース**: `claimRequests`コレクションが主なデータソースです
2. **テナントIDの扱い**: 識別可能なID（`tenants.id`）とFirestoreドキュメントIDの両方を試行して検索します
3. **重複排除**: 同じ`email`のデータは1件として扱われます（最新の`createdAt`が優先）
4. **顧客名の取得**: `claimRequests.customerInfo.name`を優先し、存在しない場合は`orders.customerInfo.name`から取得します

---

## 2. 顧客詳細情報取得API

### エンドポイント
```
GET /api/admin/customers/:customerId
```

### クエリパラメータ
- `tenantId` (推奨): 店舗ID
- `companyId` (後方互換性): 企業ID

### レスポンス形式

```typescript
{
  success: true,
  data: {
    customerId: string,
    email: string,
    customerName: string,         // 顧客名（お名前）
    phone: string,                // 電話番号
    product: string,
    notes: string,                // 備考欄
    status: string,
    publicPageId: string | null,
    publicPageUrl: string | null,
    loginUrl: string | null,
    memoryId: string | null,
    memoryTitle: string | null,
    memories: [                    // 想い出ページ一覧
      {
        id: string,
        title: string,
        status: string,
        publicPageId: string | null,
        createdAt: string,
        updatedAt: string
      }
    ],
    createdAt: string,
    updatedAt: string,
    claimedAt: string | null
  }
}
```

---

## 3. データ取得の流れ

```
1. 認証チェック
   ↓
2. テナント情報の解決
   - tenantIdまたはcompanyIdから、識別可能なIDとFirestoreドキュメントIDを取得
   ↓
3. claimRequestsコレクションから取得
   - tenantフィールドで検索（両方の形式を試行）
   - 結果を結合して重複を除外
   ↓
4. 各顧客について補完情報を取得
   - customerInfo（claimRequests → orders）
   - memories（想い出ページ情報）
   ↓
5. レスポンスを返す
```

---

## 4. 注意事項

### データが表示されない場合の確認ポイント

1. **claimRequestsコレクションにデータが存在するか**
   - 新規顧客登録時に`claimRequests`にデータが保存されているか確認

2. **tenantフィールドの値が正しいか**
   - `claimRequests.tenant`が識別可能なID（例: `emolink-direct-01`）またはFirestoreドキュメントID（例: `store-1765044610296`）のいずれかに一致しているか確認

3. **認証トークンの権限**
   - スタッフの`adminTenant`または`companyId`が、取得しようとする`tenantId`と一致しているか確認

4. **customerInfoの保存**
   - 新規顧客登録時に`customerInfo.name`が正しく保存されているか確認
   - `claimRequests.customerInfo`または`orders.customerInfo`にデータが存在するか確認

---

## 5. デバッグログ

以下のログが出力されます：

- `✅ claimRequestsからcustomerInfo取得`: `claimRequests`から顧客情報を取得した場合
- `⚠️ claimRequestsにcustomerInfoがありません`: `claimRequests`に顧客情報がない場合
- `✅ ordersからcustomerInfo.name取得`: `orders`から顧客名を取得した場合
- `✅ tenantId="xxx"で 3件のデータを取得しました`: 取得件数のログ

Firebase Functionsのログでこれらのログを確認することで、データ取得の流れを追跡できます。

