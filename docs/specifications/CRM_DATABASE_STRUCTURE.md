# CRM構築用データベース構造ガイド

## 📋 概要

このドキュメントは、CRM（顧客関係管理）システムを構築するために必要なFirestoreコレクションとデータ構造をまとめたものです。

## 🗂️ Firestoreコレクション一覧

### 1. `users` コレクション（顧客情報）

**用途**: 顧客（エンドユーザー）の基本情報を管理

**パス**: `users/{uid}`

**主要フィールド**:
```typescript
{
  uid: string;                    // Firebase Auth UID（ドキュメントID）
  email: string;                  // メールアドレス
  displayName?: string;            // 表示名
  tenant?: string;                // テナント名（後方互換性のため保持）
  tenants?: string[];             // 複数テナント対応（配列）
  role?: 'user' | 'tenantAdmin' | 'superAdmin' | 'fulfillmentOperator';
  adminTenant?: string;           // 管理者の場合のテナント
  createdAt: Date;                // アカウント作成日時
  updatedAt: Date;                // 最終更新日時
}
```

**CRMでの活用**:
- 顧客一覧表示
- 顧客検索（メールアドレス、表示名）
- 顧客のテナント別アクセス権限管理
- アカウント作成日時による新規顧客分析

**クエリ例**:
```typescript
// 特定のメールアドレスで検索
where('email', '==', 'customer@example.com')

// 特定のテナントの顧客を取得（tenants配列に含まれる）
where('tenants', 'array-contains', 'petmem')

// 作成日時でソート
orderBy('createdAt', 'desc')
```

---

### 2. `claimRequests` コレクション（認証・購入リクエスト）

**用途**: LPからの購入リクエストと認証情報を管理

**パス**: `claimRequests/{requestId}`

**主要フィールド**:
```typescript
{
  id: string;                    // リクエストID（ドキュメントID）
  email: string;                  // 顧客のメールアドレス
  tenant: string;                 // テナント名
  lpId: string;                  // LP ID（どのLPから来たか）
  productType?: string;           // 商品タイプ（後方互換性）
  product?: string;               // 商品名
  origin: string;                 // リクエスト元（LP URLなど）
  ip: string;                     // IPアドレス
  ua: string;                     // User Agent
  recaptchaScore: number;         // reCAPTCHAスコア
  status: 'pending' | 'sent' | 'claimed' | 'expired';
  
  // 認証情報（LP側で生成）
  link?: string;                  // 認証リンク（JWT含む）
  secretKey?: string;            // 秘密鍵
  jwtToken?: string;             // JWTトークン
  
  // 公開ページ・ログイン情報（認証成功時に設定）
  publicPageId?: string;         // 公開ページID
  publicPageUrl?: string;         // 公開ページURL（NFCタグ用）
  loginUrl?: string;             // ログインページURL
  
  // 関連情報
  claimedByUid?: string;         // 認証したユーザーのUID
  memoryId?: string;             // 関連するメモリID
  sentAt?: Date;                 // 認証メール送信日時
  claimedAt?: Date;              // 認証完了日時
  
  createdAt: Date;                // リクエスト作成日時
  updatedAt: Date;                // 最終更新日時
}
```

**CRMでの活用**:
- 購入リクエスト一覧表示
- 購入リクエストのステータス管理
- 認証完了率の分析
- LP別の購入リクエスト分析
- 商品別の購入リクエスト分析
- 顧客の購入履歴（emailで紐付け）

**クエリ例**:
```typescript
// 特定のテナントのリクエストを取得
where('tenant', '==', 'petmem')
orderBy('createdAt', 'desc')

// 認証完了済みを取得
where('status', '==', 'claimed')

// 特定のメールアドレスのリクエストを取得
where('email', '==', 'customer@example.com')

// 特定のLPからのリクエストを取得
where('lpId', '==', 'lp001')
```

---

### 3. `orders` コレクション（注文情報）

**用途**: 注文情報と制作・配送ステータスを管理

**パス**: `orders/{orderId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 注文ID（ドキュメントID）
  tenant: string;                 // テナント名
  emailHash: string;              // メールアドレスのハッシュ
  email?: string;                // メールアドレス（オプショナル）
  memoryId: string;              // 関連するメモリID
  productType?: string;          // 商品タイプ（後方互換性）
  product?: string;              // 商品名
  status: 'draft' | 'paid' | 'nfcReady' | 'shipped' | 'delivered';
  
  // Stripe決済情報
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentCompletedAt?: Date;
  
  // 注文ステータス管理
  orderStatus?: 'payment_completed' | 'photo_upload_pending' | 
                'production_started' | 'production_completed' | 
                'shipped' | 'delivered';
  
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
  
  // 印刷・NFC情報
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
  
  // 配送情報
  shipping: {
    packed: boolean;
    packedAt?: Date;
    shipped: boolean;
    shippedAt?: Date;
    trackingNo?: string;
    deliveredAt?: Date;
  };
  
  createdAt: Date;                // 注文作成日時
  updatedAt: Date;                // 最終更新日時
  audit: {
    createdBy?: string;
    lastUpdatedBy?: string;
  };
}
```

**CRMでの活用**:
- 注文一覧表示
- 注文ステータス管理
- 決済状況の確認
- 制作進捗管理
- 配送状況管理
- 顧客の注文履歴
- 売上分析（商品別、期間別）
- 配送先住所管理

**クエリ例**:
```typescript
// 特定のテナントの注文を取得
where('tenant', '==', 'petmem')
orderBy('createdAt', 'desc')

// 決済完了済みを取得
where('paymentStatus', '==', 'completed')

// 配送待ちを取得
where('shipping.shipped', '==', false)
where('paymentStatus', '==', 'completed')

// 特定のメールアドレスの注文を取得
where('email', '==', 'customer@example.com')
```

---

### 4. `memories` コレクション（想い出ページ情報）

**用途**: 顧客が作成・編集する想い出ページの情報を管理

**パス**: `memories/{memoryId}`

**主要フィールド**:
```typescript
{
  id: string;                    // メモリID（ドキュメントID）
  ownerUid: string;               // 所有者のUID（users.uidと紐付け）
  tenant: string;                 // テナント名
  title: string;                  // タイトル
  description?: string;           // 説明文
  bio?: string;                   // プロフィール文
  type: 'personal' | 'family' | 'business';
  status: 'draft' | 'published';
  publicPageId?: string;          // 公開ページID
  
  // 画像情報
  coverImage?: string;            // カバー画像URL
  coverImagePosition?: string;
  coverImageScale?: number;
  profileImage?: string;          // プロフィール画像URL
  profileImagePosition?: string;
  profileImageScale?: number;
  
  // デザイン設定
  design: {
    theme: string;
    layout: string;
    colors: {
      primary: string;
      secondary: string;
      background: string;
    };
  };
  colors?: {
    accent: string;
    text: string;
    background: string;
  };
  fontSizes?: {
    title?: number;
    body?: number;
  };
  topicsTitle?: string;           // Topicsセクションのタイトル
  
  // コンテンツ
  blocks: MediaBlock[];          // メディアブロック（画像、動画、テキストなど）
  
  // ストレージ
  storageUsed?: number;           // ストレージ使用量（バイト、200MB制限）
  
  // メタデータ
  metadata?: {
    petName?: string;
    petType?: string;
    source?: string;
    lpId?: string;
    [key: string]: any;
  };
  
  createdAt: Date;                // 作成日時
  updatedAt: Date;                // 最終更新日時
}
```

**CRMでの活用**:
- 顧客の想い出ページ一覧表示
- 公開済みページの確認
- ストレージ使用量の監視
- コンテンツ作成状況の確認
- 顧客のエンゲージメント分析

**クエリ例**:
```typescript
// 特定のユーザーのメモリを取得
where('ownerUid', '==', '{uid}')
orderBy('updatedAt', 'desc')

// 公開済みメモリを取得
where('status', '==', 'published')

// 特定のテナントのメモリを取得
where('tenant', '==', 'petmem')
```

---

### 5. `publicPages` コレクション（公開ページ情報）

**用途**: 公開されている想い出ページの情報を管理

**パス**: `publicPages/{pageId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 公開ページID（URLの`/public/{pageId}`部分）
  tenant: string;                 // テナント名
  memoryId: string;              // 関連するメモリID（memories.idと紐付け）
  title: string;                  // タイトル
  about?: string;                 // 説明文
  
  // デザイン設定
  design: {
    theme: string;
    layout: string;
    colors: {
      primary: string;
      secondary: string;
      background: string;
    };
  };
  colors?: {
    accent: string;
    text: string;
    background: string;
  };
  fontSizes?: {
    title?: number;
    body?: number;
  };
  
  // メディア
  media: {
    cover?: string;              // カバー画像URL
    profile?: string;            // プロフィール画像URL
  };
  coverImagePosition?: string;
  
  // 公開設定
  publish: {
    status: 'draft' | 'published';
    version: number;
    publishedAt?: Date;
  };
  access: {
    public: boolean;
    password?: string;
  };
  
  ordering: string[];            // ブロックの表示順序
  
  createdAt: Date;                // 作成日時
  updatedAt: Date;                // 最終更新日時
}
```

**CRMでの活用**:
- 公開ページの一覧表示
- 公開ページのアクセス状況確認
- 公開ページのURL管理

**クエリ例**:
```typescript
// 特定のメモリに関連する公開ページを取得
where('memoryId', '==', '{memoryId}')

// 公開済みページを取得
where('publish.status', '==', 'published')

// 特定のテナントの公開ページを取得
where('tenant', '==', 'petmem')
```

---

### 6. `tenants` コレクション（テナント情報）

**用途**: テナント（店舗・ブランド）の設定情報を管理

**パス**: `tenants/{tenantId}`

**主要フィールド**:
```typescript
{
  id: string;                    // テナントID（ドキュメントID）
  name: string;                  // テナント名
  description?: string;          // 説明
  allowedLpIds: string[];        // 許可されたLP IDのリスト
  enabledProductTypes: string[]; // 有効な商品タイプのリスト
  settings: {
    maxClaimRequestsPerHour?: number;  // 時間あたりの最大リクエスト数
    emailTemplate?: string;           // メールテンプレート
    branding?: {
      logo?: string;                  // ロゴURL
      colors?: string[];              // ブランドカラー
      theme?: string;                 // テーマ
    };
    fulfillmentMode?: 'tenantDirect' | 'vendorDirect';  // フルフィルメントモード
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;                // 作成日時
  updatedAt: Date;                // 最終更新日時
}
```

**CRMでの活用**:
- テナント一覧表示
- テナント別の売上分析
- テナント別の顧客管理
- テナント設定の管理

**クエリ例**:
```typescript
// アクティブなテナントを取得
where('status', '==', 'active')

// 特定のテナントを取得
doc('tenants/{tenantId}')
```

---

### 7. `acrylicPhotos` コレクション（アクリル写真情報）

**用途**: アクリルスタンド用にアップロードされた写真を管理

**パス**: `acrylicPhotos/{photoId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 写真ID（ドキュメントID）
  orderId: string;               // 関連する注文ID（orders.idと紐付け）
  fileName: string;              // ファイル名
  fileSize: number;              // ファイルサイズ（バイト）
  mimeType: string;              // MIMEタイプ
  storagePath: string;           // Storageパス
  url: string;                   // 画像URL
  thumbnailUrl?: string;        // サムネイルURL
  size: '6cm' | '10cm' | '14cm'; // サイズ
  description?: string;          // 説明
  status: 'uploaded' | 'approved' | 'rejected' | 'in_production';
  uploadedAt: Date;               // アップロード日時
  approvedAt?: Date;             // 承認日時
  rejectedAt?: Date;             // 却下日時
  rejectionReason?: string;      // 却下理由
  metadata?: {
    width: number;               // 幅（ピクセル）
    height: number;              // 高さ（ピクセル）
    resolution: string;          // 解像度
    quality: 'high' | 'medium' | 'low';
  };
}
```

**CRMでの活用**:
- アップロードされた写真の一覧表示
- 写真の承認・却下管理
- 制作進捗の確認

**クエリ例**:
```typescript
// 特定の注文の写真を取得
where('orderId', '==', '{orderId}')
orderBy('uploadedAt', 'desc')

// 承認待ちの写真を取得
where('status', '==', 'uploaded')
```

---

### 8. `shippingInfo` コレクション（配送情報）

**用途**: 注文の配送情報を管理

**パス**: `shippingInfo/{shippingId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 配送情報ID（ドキュメントID）
  orderId: string;               // 関連する注文ID（orders.idと紐付け）
  trackingNumber?: string;       // 追跡番号
  status: 'pending' | 'shipped' | 'delivered' | 'returned';
  shippedAt?: Date;              // 発送日時
  deliveredAt?: Date;            // 配送完了日時
  returnedAt?: Date;             // 返品日時
  carrier?: string;              // 配送業者
  estimatedDelivery?: Date;      // 予定配送日
  notes?: string;                // 備考
  createdAt: Date;               // 作成日時
  updatedAt: Date;               // 最終更新日時
}
```

**CRMでの活用**:
- 配送状況の一覧表示
- 配送状況の更新
- 追跡番号の管理
- 配送完了率の分析

**クエリ例**:
```typescript
// 特定の注文の配送情報を取得
where('orderId', '==', '{orderId}')

// 配送待ちを取得
where('status', '==', 'pending')

// 配送済みを取得
where('status', '==', 'shipped')
```

---

## 🔗 コレクション間の関係図

```
users (顧客情報)
  ↑
  ├─→ claimRequests.claimedByUid
  ├─→ memories.ownerUid
  └─→ orders.email (emailで紐付け)

claimRequests (認証・購入リクエスト)
  ↓ (認証成功時)
  ├─→ users.uid (claimedByUid)
  ├─→ memories.id (memoryId)
  └─→ publicPages.id (publicPageId)

orders (注文情報)
  ├─→ memories.id (memoryId)
  ├─→ users.email (emailで紐付け)
  ├─→ acrylicPhotos.orderId
  └─→ shippingInfo.orderId

memories (想い出ページ)
  ├─→ users.uid (ownerUid)
  └─→ publicPages.memoryId

publicPages (公開ページ)
  └─→ memories.id (memoryId)

tenants (テナント情報)
  ├─→ users.tenant / users.tenants
  ├─→ claimRequests.tenant
  ├─→ orders.tenant
  └─→ memories.tenant
```

---

## 📊 CRM構築で重要なクエリパターン

### 1. 顧客情報の取得

```typescript
// 顧客の基本情報
const user = await getDoc(doc(db, 'users', uid));

// 顧客の注文履歴
const orders = await getDocs(
  query(
    collection(db, 'orders'),
    where('email', '==', userEmail),
    orderBy('createdAt', 'desc')
  )
);

// 顧客の想い出ページ
const memories = await getDocs(
  query(
    collection(db, 'memories'),
    where('ownerUid', '==', uid),
    orderBy('updatedAt', 'desc')
  )
);

// 顧客の購入リクエスト履歴
const claimRequests = await getDocs(
  query(
    collection(db, 'claimRequests'),
    where('email', '==', userEmail),
    orderBy('createdAt', 'desc')
  )
);
```

### 2. 注文管理

```typescript
// 特定のテナントの全注文
const orders = await getDocs(
  query(
    collection(db, 'orders'),
    where('tenant', '==', tenantId),
    orderBy('createdAt', 'desc')
  )
);

// 決済完了済み注文
const paidOrders = await getDocs(
  query(
    collection(db, 'orders'),
    where('tenant', '==', tenantId),
    where('paymentStatus', '==', 'completed'),
    orderBy('paymentCompletedAt', 'desc')
  )
);

// 配送待ち注文
const pendingShipping = await getDocs(
  query(
    collection(db, 'orders'),
    where('tenant', '==', tenantId),
    where('paymentStatus', '==', 'completed'),
    where('shipping.shipped', '==', false),
    orderBy('paymentCompletedAt', 'asc')
  )
);
```

### 3. 売上分析

```typescript
// 期間別売上（注文数）
const orders = await getDocs(
  query(
    collection(db, 'orders'),
    where('tenant', '==', tenantId),
    where('paymentStatus', '==', 'completed'),
    where('paymentCompletedAt', '>=', startDate),
    where('paymentCompletedAt', '<=', endDate)
  )
);

// 商品別売上
// orders.product で集計

// LP別売上
// claimRequests.lpId と orders を結合して集計
```

### 4. 顧客分析

```typescript
// 新規顧客数（期間別）
const newUsers = await getDocs(
  query(
    collection(db, 'users'),
    where('createdAt', '>=', startDate),
    where('createdAt', '<=', endDate)
  )
);

// リピート顧客（複数の注文がある顧客）
// orders.email でグループ化して集計

// アクティブ顧客（最近更新した想い出ページがある顧客）
const activeMemories = await getDocs(
  query(
    collection(db, 'memories'),
    where('tenant', '==', tenantId),
    where('updatedAt', '>=', thirtyDaysAgo),
    orderBy('updatedAt', 'desc')
  )
);
```

---

## 🔍 よくあるCRMシナリオ

### シナリオ1: 顧客の購入履歴を表示

1. `users`で顧客情報を取得
2. `orders`で`email`で検索して注文履歴を取得
3. 各注文の`memoryId`から`memories`を取得
4. 各注文の`orderId`から`acrylicPhotos`と`shippingInfo`を取得

### シナリオ2: 注文の制作進捗を確認

1. `orders`で注文を取得
2. `orderStatus`で現在のステータスを確認
3. `acrylicPhotos`で写真のアップロード状況を確認
4. `shippingInfo`で配送状況を確認

### シナリオ3: 顧客のエンゲージメント分析

1. `memories`で顧客の想い出ページを取得
2. `status`で公開済みか確認
3. `updatedAt`で最終更新日時を確認
4. `storageUsed`でストレージ使用量を確認

### シナリオ4: LP別のコンバージョン分析

1. `claimRequests`でLP別のリクエスト数を集計
2. `status: 'claimed'`で認証完了数を集計
3. `orders`で実際の注文数を集計
4. コンバージョン率を計算

---

## 📝 注意事項

1. **テナント分離**: すべてのコレクションで`tenant`フィールドによる分離が行われています。CRMでもテナントごとにデータを分離する必要があります。

2. **セキュリティ**: Firestore Rulesでテナント検証が行われています。CRMでも適切な権限管理が必要です。

3. **データ整合性**: 
   - `orders.memoryId`と`memories.id`が一致している必要があります
   - `publicPages.memoryId`と`memories.id`が一致している必要があります
   - `acrylicPhotos.orderId`と`orders.id`が一致している必要があります

4. **インデックス**: 複合クエリを使用する場合は、`firestore.indexes.json`にインデックスを追加する必要があります。

5. **パフォーマンス**: 
   - 大量のデータを取得する場合は、ページネーションを実装してください
   - 集計処理は可能な限りクライアント側で行うか、Cloud Functionsで実装してください

---

## 🔗 関連ドキュメント

- `DATABASE-STRUCTURE.md` - 公開ページと編集ページの詳細
- `MULTI-TENANT-ACCOUNT-MANAGEMENT.md` - マルチテナントアカウント管理
- `LP-API-integration.md` - LP-CMS連携API仕様

---

**最終更新日**: 2025-01-XX  
**バージョン**: 1.0

