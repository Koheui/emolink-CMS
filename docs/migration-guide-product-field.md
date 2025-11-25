# 商品名フィールドの移行ガイド

**作成日**: 2025-01-19  
**バージョン**: 1.0  
**対象**: 想い出リンクCMS

---

## 📌 概要

既存のデータベースとの互換性を保ちながら、商品名を入力できるようにします。

### 変更内容
- 新しいフィールド `product` を追加
- 既存の `productType` は後方互換性のため保持
- データベース構造は変更せず、型定義のみ拡張

---

## 🔄 移行方針

### 1. 後方互換性の維持

既存のコードはそのまま動作します：
- `productType` フィールドは維持
- 新しいコードは `product` フィールドを優先的に使用
- `product` がない場合は `productType` から自動的に変換

### 2. 段階的な移行

```typescript
// 旧方式（後方互換性あり）
const order = {
  productType: 'acrylic'
};

// 新方式（推奨）
const order = {
  productType: 'acrylic',  // 互換性のため保持
  product: 'NFCタグ付きペットアクリルスタンド'  // 任意で指定
};
```

### 3. 自動フォールバック

商品名を取得する際は、以下の優先順位で取得：

1. `product` フィールド（あれば優先）
2. `productType` からデフォルト名を生成
3. どちらもない場合は "商品名未設定"

---

## 📋 実装詳細

### 型定義の変更

```typescript
// src/types/index.ts

interface Order {
  productType: string;  // 後方互換性のため保持（廃止予定）
  product?: string;     // 新規：商品名を直接入力
  // ...
}

interface ClaimRequest {
  productType?: string;  // 後方互換性のため保持
  product?: string;      // 新規：商品名を直接入力
  // ...
}
```

### ヘルパー関数の追加

```typescript
// src/types/index.ts

export function getProductName(order: { 
  product?: string; 
  productType?: string 
}): string {
  if (order.product) {
    return order.product;
  }
  if (order.productType) {
    return PRODUCT_TYPE_NAMES[order.productType as ProductType] || order.productType;
  }
  return '商品名未設定';
}
```

### 使用例

```typescript
import { getProductName } from '@/types';

// 商品名を取得
const productName = getProductName(order);
console.log(productName); // "NFCタグ付きアクリルスタンド" or "カスタム商品名"

// メール送信で使用
await sendCustomerLoginEmail(
  email,
  secretKey,
  loginUrl,
  {
    customerInfo: { name },
    product: productName  // 商品名を指定
  }
);
```

---

## 🔧 メール送信での使用

### 旧方式（後方互換性あり）

```typescript
await sendSecretKeyEmail(email, secretKey, {
  tenantId: 'petmem',
  lpId: 'default',
  productType: 'acrylic',  // タイプのみ指定
  orderId: '123'
});
// メールに表示: "NFCタグ付きアクリルスタンド"
```

### 新方式（推奨）

```typescript
await sendSecretKeyEmail(email, secretKey, {
  tenantId: 'petmem',
  lpId: 'default',
  productType: 'acrylic',  // 互換性のため保持
  product: 'NFCタグ付きペットアクリルスタンド（6cm）',  // 商品名を指定
  orderId: '123'
});
// メールに表示: "NFCタグ付きペットアクリルスタンド（6cm）"
```

---

## 📊 データベース影響

### ✅ 変更なし（安全）

- 既存のデータはそのまま動作
- Firestore のスキーマ変更不要
- インデックスの変更不要
- セキュリティルールの変更不要

### 新しいデータの保存

```typescript
// Firestore に保存
const orderRef = await addDoc(collection(db, 'orders'), {
  tenant: 'petmem',
  productType: 'acrylic',  // 互換性のため保持
  product: 'NFCタグ付きペットアクリルスタンド（6cm）',  // 新規フィールド
  // ...
});
```

---

## 🎯 移行チェックリスト

### Phase 1: 準備（完了）

- [x] 型定義に `product` フィールドを追加
- [x] ヘルパー関数 `getProductName()` を作成
- [x] メール送信関数を更新
- [x] データベース設計書を更新

### Phase 2: 新機能での使用（今後の実装）

- [ ] 店舗エントリー機能で `product` フィールドを使用
- [ ] 注文管理画面で `product` フィールドを表示
- [ ] メール送信で `product` フィールドを優先的に使用

### Phase 3: 既存データの移行（必要に応じて）

- [ ] 既存の `productType` データを確認
- [ ] `product` フィールドにデフォルト値を設定（Cloud Functionsで一括更新）

---

## ⚠️ 注意事項

### 共有データベースへの配慮

1. **既存データは変更しない**: 既存の `productType` データはそのまま保持
2. **新規データのみ追加**: 新しい注文には `product` フィールドを追加
3. **段階的な移行**: 既存機能は影響を受けない

### コードレビューのポイント

- [ ] 既存の `productType` を使用している箇所を確認
- [ ] 新しいコードは `getProductName()` を使用しているか
- [ ] 後方互換性が保たれているか

---

## 📝 使用例

### 例1: 注文作成

```typescript
// 店舗エントリー機能で注文を作成
const newOrder = {
  tenant: 'petmem',
  email: 'customer@example.com',
  productType: 'acrylic',  // 互換性のため保持
  product: 'NFCタグ付きペットアクリルスタンド（6cm）',  // カスタム商品名
  status: 'completed',
  // ...
};

await addDoc(collection(db, 'orders'), newOrder);
```

### 例2: 商品名の表示

```typescript
// 注文一覧で商品名を表示
orders.map(order => {
  const productName = getProductName(order);
  return (
    <div key={order.id}>
      {productName}
    </div>
  );
});
```

### 例3: メール送信

```typescript
// 顧客にメール送信
await sendCustomerLoginEmail(
  order.email,
  secretKey,
  loginUrl,
  {
    customerInfo: { name: order.customerInfo?.name },
    product: order.product || getProductName(order),  // product があれば使用
    tenantId: order.tenant
  }
);
```

---

## 🔄 将来の計画

### 長期的な移行（未定）

将来的には `productType` を廃止し、`product` のみを使用：

1. 全ての機能が `product` フィールドを使用するように移行
2. 既存データを `product` フィールドに移行
3. `productType` フィールドを削除

**実施時期**: 未定（全ての機能が `product` を使用するようになってから）

---

## 📞 サポート

ご質問がございましたら、開発チームまでお問い合わせください。

---

**最終更新**: 2025-01-19
