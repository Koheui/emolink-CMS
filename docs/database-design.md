# データベース設計書

**作成日**: 2025-01-19  
**バージョン**: 1.0  
**システム**: 想い出リンクCMS

---

## 📌 データベース概要

**使用技術**: Firestore (NoSQL ドキュメントデータベース)  
**プロジェクト**: memorylink-cms  
**リージョン**: asia-northeast1

---

## 📊 コレクション一覧

### 主要コレクション

1. **users** - ユーザー情報
2. **memories** - 想い出ページ情報
3. **assets** - メディアファイル情報
4. **publicPages** - 公開ページ情報
5. **orders** - 注文情報
6. **claimRequests** - クレームリクエスト情報
7. **tenants** - テナント情報
8. **auditLogs** - 監査ログ

### サブコレクション

- **publicPages/{pageId}/blocks** - 公開ページのブロック
- **auditLogs/{yyyyMMdd}/items** - 日付別の監査ログアイテム

---

## 📋 詳細設計

### 1. users コレクション

**説明**: ユーザーの基本情報を保存

```typescript
interface User {
  uid: string;                    // Firebase Auth UID
  email: string;                   // メールアドレス
  displayName?: string;            // 表示名
  tenant?: string;                 // テナントID
  createdAt: Date;                 // 作成日時
  updatedAt: Date;                 // 更新日時
}
```

**セキュリティルール**:
- 読み取り/書き込み: 本人のみ（ownerUid と auth.uid が一致）

---

### 2. memories コレクション

**説明**: 想い出ページの本体情報

```typescript
interface Memory {
  id: string;                      // メモリID
  ownerUid: string;                // 所有者UID
  tenant: string;                  // テナントID
  title: string;                   // タイトル
  type: 'personal' | 'family' | 'business';
  status: 'draft' | 'published';
  publicPageId?: string;           // 公開ページID
  coverAssetId?: string;           // カバー画像ID
  profileAssetId?: string;         // プロフィール画像ID
  description?: string;            // 説明
  design: {
    theme: string;
    layout: string;
    colors: {
      primary: string;
      secondary: string;
      background: string;
    };
  };
  blocks: Block[];                 // ブロック配列
  metadata?: {
    petName?: string;
    petType?: string;
    source?: string;
    lpId?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**セキュリティルール**:
- 読み取り: 全て許可（開発環境）
- 書き込み: 本人のみ（ownerUid と auth.uid が一致）かつ同じテナント

**インデックス**:
- `ownerUid` (ASC) + `tenant` (ASC) + `updatedAt` (DESC)

---

### 3. assets コレクション

**説明**: アップロードされたメディアファイルの情報

```typescript
interface Asset {
  id: string;
  memoryId: string;
  ownerUid: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  storagePath: string;             // Storage パス
  url: string;                     // 公開URL
  thumbnailUrl?: string;           // サムネイルURL
  size: number;                    // ファイルサイズ（バイト）
  duration?: number;               // 動画・音声の長さ（秒）
  resolution?: string;             // 解像度（例: "1920x1080"）
  createdAt: Date;
  updatedAt: Date;
}
```

**セキュリティルール**:
- 読み取り/書き込み: 本人のみ（ownerUid と auth.uid が一致）

---

### 4. publicPages コレクション

**説明**: 公開済みのページ情報

```typescript
interface PublicPage {
  id: string;
  tenant: string;
  memoryId: string;
  title: string;
  about?: string;
  design: {
    theme: string;
    layout: string;
    colors: {
      primary: string;
      secondary: string;
      background: string;
    };
  };
  media: {
    cover?: string;
    profile?: string;
  };
  ordering: string[];              // ブロック順序
  publish: {
    status: 'draft' | 'published';
    version: number;
    publishedAt?: Date;
  };
  access: {
    public: boolean;
    password?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**セキュリティルール**:
- 読み取り: 全て許可（公開ページ）
- 書き込み: 本人または同じテナントのユーザー

---

### 5. orders コレクション

**説明**: 注文情報と進捗管理

```typescript
interface Order {
  id: string;
  tenant: string;
  emailHash: string;
  memoryId: string;
  productType: string;  // 後方互換性のため保持（廃止予定）
  product?: string;     // 新規：商品名を直接入力
  status: 'draft' | 'paid' | 'nfcReady' | 'shipped' | 'delivered';
  
  // Stripe決済情報
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentCompletedAt?: Date;
  
  // 注文ステータス管理
  orderStatus?: 'payment_completed' | 'photo_upload_pending' | 'production_started' | 'production_completed' | 'shipped' | 'delivered';
  
  // 秘密鍵情報
  secretKey?: string;
  secretKeyExpiresAt?: Date;
  
  // アクリルスタンド制作情報
  acrylicStand?: {
    size?: '6cm' | '10cm' | '14cm';
    photoUploaded: boolean;
    photoUrl?: string;
    photoUploadedAt?: Date;
    productionStarted: boolean;
    productionStartedAt?: Date;
    productionCompleted: boolean;
    productionCompletedAt?: Date;
  };
  
  // 住所情報
  shippingAddress?: {
    postalCode: string;
    prefecture: string;
    city: string;
    address1: string;
    address2?: string;
    name: string;
    phone: string;
  };
  
  print: {
    qrPrinted: boolean;
    printedAt?: Date;
  };
  nfc: {
    written: boolean;
    device?: string;
    operator?: string;
    writtenAt?: Date;
    prevUrl?: string;
  };
  shipping: {
    packed: boolean;
    packedAt?: Date;
    shipped: boolean;
    shippedAt?: Date;
    trackingNo?: string;
    deliveredAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  audit: {
    createdBy?: string;
    lastUpdatedBy?: string;
  };
}
```

**セキュリティルール**:
- 読み取り: 本人または同じテナントのユーザー
- 書き込み: Functions のみ許可（クライアントからの書き込みは禁止）

**インデックス**:
- `tenant` (ASC) + `status` (ASC) + `createdAt` (DESC)

---

### 6. claimRequests コレクション

**説明**: LP経由でのクレームリクエスト情報

```typescript
interface ClaimRequest {
  id: string;
  email: string;
  tenant: string;
  lpId: string;
  productType?: string;  // 後方互換性のため保持（廃止予定）
  product?: string;      // 新規：商品名を直接入力
  origin: string;
  ip: string;
  ua: string;
  recaptchaScore: number;
  status: 'pending' | 'sent' | 'claimed' | 'expired';
  sentAt?: Date;
  claimedAt?: Date;
  claimedByUid?: string;
  memoryId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**セキュリティルール**:
- 読み取り: 全て許可（開発環境）
- 書き込み: 本人または同じテナントのユーザー

**インデックス**:
- `tenant` (ASC) + `status` (ASC) + `createdAt` (DESC)

---

### 7. tenants コレクション

**説明**: テナント（企業）情報

```typescript
interface Tenant {
  id: string;
  name: string;
  description?: string;
  allowedLpIds: string[];
  enabledProductTypes: string[];
  settings: {
    maxClaimRequestsPerHour?: number;
    emailTemplate?: string;
    branding?: {
      logo?: string;
      colors?: string[];
      theme?: string;
    };
    fulfillmentMode?: 'tenantDirect' | 'vendorDirect';
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}
```

**セキュリティルール**:
- 読み取り: 本人または同じテナントのユーザー
- 書き込み: 管理者のみ（現在は Functions のみ）

---

### 8. auditLogs コレクション

**説明**: 監査ログ（アクションの記録）

```typescript
interface AuditLog {
  id: string;
  actorUid?: string;              // 実行者UID
  action: string;                  // アクション名
  target: string;                  // ターゲット
  payload: any;                    // 追加データ
  ts: Date;                        // タイムスタンプ
  tenant?: string;                 // テナントID
}
```

**セキュリティルール**:
- 読み取り: 認証済みユーザー
- 書き込み: Functions のみ許可

---

## 🔒 セキュリティ設計

### テナント分離

全てのコレクションでテナント単位でのデータ分離を実現：

1. **データフィルタリング**: クエリで必ず `tenant` フィールドでフィルタリング
2. **ルール検証**: `isSameTenant()` 関数で検証
3. **Origin ベース検証**: API リクエストで Origin からテナントを判定

### アクセス制御

- **本人のみ**: users, assets
- **本人または管理者**: memories, publicPages
- **読み取り専用（クライアント）**: orders, auditLogs
- **Functions のみ**: orders の書き込み、auditLogs の書き込み

---

## 📈 インデックス設計

### 必須インデックス

1. **memories**
   - `ownerUid` + `tenant` + `updatedAt` (DESC)

2. **claimRequests**
   - `tenant` + `status` + `createdAt` (DESC)

3. **orders**
   - `tenant` + `status` + `createdAt` (DESC)

### 追加推奨インデックス

- `orders`: `tenant` + `productType` + `status`
- `publicPages`: `tenant` + `publish.status`
- `auditLogs`: `tenant` + `action` + `ts` (DESC)

---

## 🔄 データフロー

### 1. ユーザー登録フロー

```
LP フォーム送信
  ↓
claimRequests に保存
  ↓
JWT 生成
  ↓
メール送信
  ↓
ユーザーがリンクをクリック
  ↓
users に保存
  ↓
memories に自動作成
```

### 2. 注文フロー

```
注文作成
  ↓
orders に保存（status: 'draft'）
  ↓
決済完了
  ↓
orders 更新（status: 'paid'）
  ↓
秘密鍵生成・メール送信
  ↓
顧客がログイン
  ↓
メモリ編集・公開
  ↓
制作開始
  ↓
orders 更新（status: 'shipped'）
  ↓
配送完了
  ↓
orders 更新（status: 'delivered'）
```

---

## 🎯 ベストプラクティス

### 1. 常にテナントでフィルタリング

```typescript
// ❌ 悪い例
const memories = await getDocs(memoriesCollection);

// ✅ 良い例
const memories = await getDocs(
  query(
    memoriesCollection,
    where('tenant', '==', currentTenant)
  )
);
```

### 2. タイムスタンプの自動設定

```typescript
const newMemory = {
  ...memoryData,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
};
```

### 3. 監査ログの記録

重要な操作は必ず auditLogs に記録：

```typescript
await addDoc(collection(db, 'auditLogs'), {
  actorUid: currentUser.uid,
  action: 'memory.created',
  target: memoryId,
  payload: { title, tenant },
  ts: serverTimestamp()
});
```

---

## 📊 データ量の見積もり

### 想定規模

- **テナント数**: 10社
- **ユーザー数**: 10,000人/月
- **メモリ数**: 50,000件/月
- **アセット数**: 500,000件/月（1メモリ = 10アセット）

### ストレージ見積もり

- **Firestore**: 約 50GB/月
- **Storage**: 約 500GB/月（画像・動画）

---

## 🔧 今後の改善点

1. **複合インデックスの追加** - クエリパフォーマンス向上
2. **キャッシュ戦略** - Cloud CDN の活用
3. **データアーカイブ** - 古いデータの長期保存
4. **バックアップ** - 自動バックアップの設定

---

**最終更新**: 2025-01-19  
**次回レビュー**: 2025-04-19
