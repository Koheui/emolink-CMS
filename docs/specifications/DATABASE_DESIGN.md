# データベース設計書

## 📋 概要

このドキュメントは、EmoLink CMSシステム全体で使用するFirestoreデータベースの設計書です。**すべてのアプリケーション（CMS、LP、CRM、Functions等）で共有**し、一貫したデータ構造を維持するために作成されました。

## 🏢 階層構造

```
企業（Company）
  └─ 店舗（Tenant）
      ├─ スタッフ（Staff）
      ├─ 顧客（User）
      ├─ 想い出ページ（Memory）
      ├─ 注文（Order）
      └─ その他のデータ
```

**重要**: すべてのデータは必ず**テナント（店舗）で分離**され、異なる企業・店舗のデータが混在しないように設計されています。

## 🏢 企業ID（companyId）と店舗ID（tenantId）の分離

### 基本方針

**企業ID（companyId）と店舗ID（tenantId）は必ず分離します。**

同じ企業でも販売店が違う場合は、異なる`tenantId`を使用します。

### 階層構造

```
企業（Company）
  └─ 店舗1（Tenant 1）
  └─ 店舗2（Tenant 2）
  └─ 店舗3（Tenant 3）
```

### データ分離

すべてのデータは**店舗ID（tenantId）で分離**されます：

- `memories`: `tenant`フィールドに`tenantId`を保存
- `orders`: `tenant`フィールドに`tenantId`を保存
- `claimRequests`: `tenant`フィールドに`tenantId`を保存
- `users`: `tenant`フィールドに`tenantId`を保存

### APIパラメータ

#### 推奨（新規実装）

```typescript
// 店舗ID（tenantId）を使用
GET /api/admin/customers?tenantId=store-001
DELETE /api/admin/customers/:customerId?tenantId=store-001
```

#### 後方互換性（既存実装）

```typescript
// companyIdも受け付けるが、非推奨
GET /api/admin/customers?companyId=company-001  // ⚠️ 非推奨
```

**注意**: `companyId`パラメータは後方互換性のため受け付けますが、内部的には`tenantId`として扱われます。

### パラメータの優先順位

APIでは以下の優先順位で処理されます：

1. `tenantId`（推奨）
2. `companyId`（非推奨、後方互換性のため）

```typescript
const finalTenantId = (tenantId as string) || (companyId as string);
```

### マルチテナント安全性

異なる`tenantId`のデータは削除されません：

- 同じ企業（`companyId`）でも、異なる店舗（`tenantId`）のデータは保護される
- 削除処理では、削除対象の`tenantId`のデータのみを削除

---

## 🗂️ コレクション一覧

### 1. `companies` コレクション（企業/会社情報）

**用途**: 企業（会社）レベルの基本情報を管理

**パス**: `companies/{companyId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 企業ID（ドキュメントID）
  name: string;                  // 企業名
  legalName?: string;            // 正式名称
  description?: string;          // 説明
  contact: {
    email?: string;              // 連絡先メールアドレス
    phone?: string;              // 電話番号
    address?: string;             // 住所
  };
  settings: {
    maxTenants?: number;          // 最大店舗数
    billingEnabled: boolean;      // 課金有効化
    features: string[];           // 有効な機能リスト
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: 企業レベルでは分離不要（企業ごとに別プロジェクトを推奨）

**クエリ例**:
```typescript
// 企業一覧取得
const companiesRef = collection(db, 'companies');
const snapshot = await getDocs(companiesRef);
```

---

### 2. `tenants` コレクション（店舗情報）

**用途**: 店舗（テナント）の基本情報と設定を管理

**パス**: `tenants/{tenantId}`

**主要フィールド**:
```typescript
{
  id: string;                    // テナントID（ドキュメントID）
  companyId?: string;            // 所属企業ID（オプショナル）
  name: string;                  // 店舗名
  description?: string;          // 説明
  allowedLpIds: string[];        // 許可されたLP ID
  enabledProductTypes: string[]; // 有効な商品タイプ
  settings: {
    maxClaimRequestsPerHour?: number;  // 最大リクエスト数/時
    emailTemplate?: string;             // メールテンプレート
    branding: {
      logo?: string;                   // ロゴURL
      colors?: string[];               // ブランドカラー
      theme?: string;                  // テーマ
    };
    fulfillmentMode?: 'tenantDirect' | 'vendorDirect'; // フルフィルメントモード
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: テナントID自体が分離キー

**重要**: `tenants`コレクションには、`id`フィールド（識別可能なID、例: `emolink-direct-01`）とFirestoreドキュメントID（例: `store-1765044610296`）の両方が存在します。データ分離には`id`フィールドを使用します。

**クエリ例**:
```typescript
// 特定のテナント取得
const tenantRef = doc(db, 'tenants', tenantId);
const tenantSnap = await getDoc(tenantRef);

// 企業に所属するテナント一覧
const q = query(
  collection(db, 'tenants'),
  where('companyId', '==', companyId),
  where('status', '==', 'active')
);
```

---

### 3. `users` コレクション（エンドユーザー/顧客）

**用途**: 想い出ページを作成・管理する顧客（エンドユーザー）の基本情報

**パス**: `users/{uid}`

**主要フィールド**:
```typescript
{
  uid: string;                   // Firebase Auth UID（ドキュメントID）
  email: string;                 // メールアドレス
  displayName?: string;           // 表示名
  tenant: string;                 // テナントID（必須：データ分離のキー）
                                  // 注意: tenantsコレクションのidフィールド（識別可能なID、例: emolink-direct-01）を使用
                                  // FirestoreドキュメントID（例: store-1765044610296）は使用しない
  tenants?: string[];            // 複数テナント対応（配列）
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: `tenant`フィールドで必ず分離（必須）

**重要**: 
- `role`フィールドは削除（エンドユーザーのみのため不要）
- 管理者情報は`staff`コレクションに分離

**クエリ例**:
```typescript
// 特定のテナントの顧客一覧
const q = query(
  collection(db, 'users'),
  where('tenant', '==', tenantId),
  orderBy('createdAt', 'desc')
);

// 複数テナント対応（tenants配列に含まれる）
const q2 = query(
  collection(db, 'users'),
  where('tenants', 'array-contains', tenantId)
);
```

---

### 4. `staff` コレクション（店舗スタッフ/管理者）

**用途**: 店舗スタッフ（管理者、オペレーター）の基本情報

**パス**: `staff/{uid}`

**主要フィールド**:
```typescript
{
  uid: string;                   // Firebase Auth UID（ドキュメントID）
  email: string;                 // メールアドレス
  displayName?: string;           // 表示名
  role: 'tenantAdmin' | 'superAdmin' | 'fulfillmentOperator';
  adminTenant: string;            // 管理するテナントID（必須：データ分離のキー）
  permissions?: {
    canManageUsers?: boolean;     // ユーザー管理権限
    canManageOrders?: boolean;    // 注文管理権限
    canManageTenants?: boolean;   // テナント管理権限（superAdminのみ）
    canWriteNfc?: boolean;         // NFC書き込み権限
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: `adminTenant`フィールドで必ず分離（必須）

**重要**: 
- エンドユーザーと管理者を明確に分離
- `users`コレクションには管理者情報を保存しない

**クエリ例**:
```typescript
// 特定のテナントのスタッフ一覧
const q = query(
  collection(db, 'staff'),
  where('adminTenant', '==', tenantId),
  orderBy('createdAt', 'desc')
);
```

---

### 5. `memories` コレクション（想い出ページ）

**用途**: 顧客が作成する想い出ページの情報

**パス**: `memories/{memoryId}`

**主要フィールド**:
```typescript
{
  id: string;                    // メモリID（ドキュメントID）
  ownerUid: string;              // 所有者UID（usersコレクションのUID）
  tenant: string;                 // テナントID（必須：データ分離のキー）
                                  // 注意: tenantsコレクションのidフィールド（識別可能なID、例: emolink-direct-01）を使用
                                  // FirestoreドキュメントID（例: store-1765044610296）は使用しない
  title: string;                  // タイトル
  type: 'personal' | 'family' | 'business';
  status: 'draft' | 'published';
  publicPageId?: string;          // 公開ページID
  coverAssetId?: string;          // カバー画像アセットID
  profileAssetId?: string;        // プロフィール画像アセットID
  coverImage?: string;            // カバー画像URL
  coverImagePosition?: string;    // カバー画像位置
  coverImageScale?: number;       // カバー画像スケール
  profileImage?: string;          // プロフィール画像URL
  profileImagePosition?: string;  // プロフィール画像位置
  profileImageScale?: number;     // プロフィール画像スケール
  description?: string;           // 説明文
  bio?: string;                   // プロフィール文
  topicsTitle?: string;           // Topicsセクションのタイトル
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
    cardBackground?: string;
  };
  fontSizes?: {
    title?: number;
    body?: number;
  };
  blocks: Block[];                // コンテンツブロック
  metadata?: {
    petName?: string;
    petType?: string;
    source?: string;
    lpId?: string;
    [key: string]: any;
  };
  storageUsed?: number;          // ストレージ使用量（バイト単位、200MB制限）
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: `tenant`フィールドで必ず分離（必須）

**重要**: `tenant`フィールドには、`tenants`コレクションの`id`フィールド（識別可能なID、例: `emolink-direct-01`）を使用します。FirestoreドキュメントID（例: `store-1765044610296`）は使用しません。これにより、店舗スタッフが識別可能なIDでデータを管理できます。

**クエリ例**:
```typescript
// 特定のテナントの想い出ページ一覧
const q = query(
  collection(db, 'memories'),
  where('tenant', '==', tenantId),
  where('status', '==', 'published'),
  orderBy('createdAt', 'desc')
);

// 特定ユーザーの想い出ページ一覧
const q2 = query(
  collection(db, 'memories'),
  where('ownerUid', '==', uid),
  where('tenant', '==', tenantId),
  orderBy('createdAt', 'desc')
);
```

---

### 6. `publicPages` コレクション（公開ページ）

**用途**: 公開される想い出ページの情報

**パス**: `publicPages/{pageId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 公開ページID（ドキュメントID）
  tenant: string;                 // テナントID（必須：データ分離のキー）
                                  // 注意: tenantsコレクションのidフィールド（識別可能なID、例: emolink-direct-01）を使用
                                  // FirestoreドキュメントID（例: store-1765044610296）は使用しない
  ownerUid?: string;              // 所有者UID（エンドユーザーが更新可能にするため）
  memoryId: string;               // 関連するメモリID
  title: string;                  // タイトル
  about?: string;                 // 説明
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
    cardBackground?: string;
  };
  media: {
    cover?: string;
    profile?: string;
  };
  coverImagePosition?: string;
  coverImageScale?: number;
  profileImagePosition?: string;
  profileImageScale?: number;
  bio?: string;                   // プロフィール文
  fontSizes?: {
    title?: number;
    body?: number;
  };
  ordering: string[];              // コンテンツの順序
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

**テナント分離**: `tenant`フィールドで必ず分離（必須）

**クエリ例**:
```typescript
// 特定のテナントの公開ページ一覧
const q = query(
  collection(db, 'publicPages'),
  where('tenant', '==', tenantId),
  where('publish.status', '==', 'published'),
  orderBy('publish.publishedAt', 'desc')
);
```

---

### 7. `assets` コレクション（メディアアセット）

**用途**: アップロードされたメディアファイル（画像、動画、音声）の情報

**パス**: `assets/{assetId}`

**主要フィールド**:
```typescript
{
  id: string;                    // アセットID（ドキュメントID）
  memoryId: string;             // 関連するメモリID
  ownerUid: string;             // 所有者UID
  name: string;                 // ファイル名
  type: 'image' | 'video' | 'audio';
  storagePath: string;          // Firebase Storageパス
  url: string;                 // ダウンロードURL
  thumbnailUrl?: string;        // サムネイルURL
  size: number;                // ファイルサイズ（バイト）
  duration?: number;           // 動画・音声の長さ（秒）
  resolution?: string;         // 動画の解像度（例: "1920x1080"）
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: `memoryId`経由で`memories`コレクションの`tenant`で分離

**クエリ例**:
```typescript
// 特定のメモリのアセット一覧
const q = query(
  collection(db, 'assets'),
  where('memoryId', '==', memoryId),
  orderBy('createdAt', 'asc')
);
```

---

### 8. `claimRequests` コレクション（認証・購入リクエスト）

**用途**: LPからの購入リクエストと認証情報を管理

**パス**: `claimRequests/{requestId}`

**主要フィールド**:
```typescript
{
  id: string;                    // リクエストID（ドキュメントID）
  email: string;                 // 顧客のメールアドレス
  tenant: string;                 // テナントID（必須：データ分離のキー）
                                  // 注意: tenantsコレクションのidフィールド（識別可能なID、例: emolink-direct-01）を使用
                                  // FirestoreドキュメントID（例: store-1765044610296）は使用しない
  lpId: string;                  // LP ID（どのLPから来たか）
  productType?: string;          // 商品タイプ（後方互換性）
  product?: string;              // 商品名
  origin: string;                // リクエスト元（LP URLなど）
  ip: string;                    // IPアドレス
  ua: string;                    // User Agent
  recaptchaScore: number;        // reCAPTCHAスコア
  status: 'pending' | 'sent' | 'claimed' | 'expired';
  
  // 認証情報（LP側で生成）
  link?: string;                 // 認証リンク（JWT含む）
  secretKey?: string;           // 秘密鍵
  jwtToken?: string;            // JWTトークン
  
  // 公開ページ・ログイン情報（認証成功時に設定）
  publicPageId?: string;         // 公開ページID
  publicPageUrl?: string;       // 公開ページURL（NFCタグ用）
  loginUrl?: string;            // ログインページURL
  
  // 関連情報
  claimedByUid?: string;        // 認証したユーザーのUID
  memoryId?: string;            // 関連するメモリID
  sentAt?: Date;                // 認証メール送信日時
  claimedAt?: Date;             // 認証完了日時
  
  // メール本文カスタマイズ情報（LP側から送信）
  emailHeaderTitle?: string;     // メールヘッダータイトル
  emailHeaderSubtitle?: string; // メールヘッダーサブタイトル
  emailMainMessage?: string;    // メール本文メッセージ
  emailFooterMessage?: string;  // メールフッターメッセージ
  
  // 販売店管理用情報
  notes?: string;                // 備考（お客様番号など、販売店ごとの管理用）
  
  // 顧客情報（新規顧客登録時に入力）
  customerInfo?: {
    name?: string;               // 顧客名（お名前）
    phone?: string;              // 電話番号
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: `tenant`フィールドで必ず分離（必須）

**顧客情報の取得優先順位**:
1. `claimRequests.customerInfo`（優先）
2. `orders.customerInfo`（フォールバック）

`customerInfo`は新規顧客登録時に店舗スタッフが入力した「お名前」と「電話番号」を保存します。CRMで顧客を識別するために使用されます。

**クエリ例**:
```typescript
// 特定のテナントのリクエスト一覧
const q = query(
  collection(db, 'claimRequests'),
  where('tenant', '==', tenantId),
  where('status', '==', 'pending'),
  orderBy('createdAt', 'desc')
);
```

---

### 9. `orders` コレクション（注文情報）

**用途**: 注文情報と決済・配送管理

**パス**: `orders/{orderId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 注文ID（ドキュメントID）
  tenant: string;                 // テナントID（必須：データ分離のキー）
                                  // 注意: tenantsコレクションのidフィールド（識別可能なID、例: emolink-direct-01）を使用
                                  // FirestoreドキュメントID（例: store-1765044610296）は使用しない
  emailHash: string;             // メールアドレスのハッシュ
  email?: string;                // メールアドレス（オプショナル）
  memoryId: string;              // 関連するメモリID
  productType: string;           // 商品タイプ（後方互換性）
  product?: string;              // 商品名
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
  
  // 顧客情報（新規顧客登録時に入力）
  customerInfo?: {
    name?: string;               // 顧客名（お名前）
    phone?: string;              // 電話番号
  };
  
  // 住所情報（配送先）
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

**テナント分離**: `tenant`フィールドで必ず分離（必須）

**顧客情報の取得優先順位**:
1. `claimRequests.customerInfo`（優先）
2. `orders.customerInfo`（フォールバック）

`customerInfo`は新規顧客登録時に店舗スタッフが入力した「お名前」と「電話番号」を保存します。CRMで顧客を識別するために使用されます。

**クエリ例**:
```typescript
// 特定のテナントの注文一覧
const q = query(
  collection(db, 'orders'),
  where('tenant', '==', tenantId),
  where('status', '==', 'paid'),
  orderBy('createdAt', 'desc')
);
```

---

### 10. `acrylicPhotos` コレクション（アクリルスタンド用写真）

**用途**: アクリルスタンド制作用にアップロードされた写真の情報

**パス**: `acrylicPhotos/{photoId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 写真ID（ドキュメントID）
  orderId: string;               // 関連する注文ID
  fileName: string;              // ファイル名
  fileSize: number;              // ファイルサイズ（バイト）
  mimeType: string;              // MIMEタイプ
  storagePath: string;           // Firebase Storageパス
  url: string;                   // ダウンロードURL
  thumbnailUrl?: string;         // サムネイルURL
  size: '6cm' | '10cm' | '14cm'; // サイズ
  description?: string;           // 説明
  status: 'uploaded' | 'approved' | 'rejected' | 'in_production';
  uploadedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  metadata?: {
    width: number;
    height: number;
    resolution: string;
    quality: 'high' | 'medium' | 'low';
  };
}
```

**テナント分離**: `orderId`経由で`orders`コレクションの`tenant`で分離

**クエリ例**:
```typescript
// 特定の注文の写真一覧
const q = query(
  collection(db, 'acrylicPhotos'),
  where('orderId', '==', orderId),
  orderBy('uploadedAt', 'desc')
);
```

---

### 11. `shippingInfo` コレクション（配送情報）

**用途**: 配送情報とトラッキング管理

**パス**: `shippingInfo/{shippingId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 配送情報ID（ドキュメントID）
  orderId: string;               // 関連する注文ID
  trackingNumber?: string;       // 追跡番号
  status: 'pending' | 'shipped' | 'delivered' | 'returned';
  shippedAt?: Date;              // 発送日時
  deliveredAt?: Date;            // 配達日時
  returnedAt?: Date;             // 返送日時
  carrier?: string;              // 配送業者
  estimatedDelivery?: Date;      // 予定配達日
  notes?: string;                // 備考
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: `orderId`経由で`orders`コレクションの`tenant`で分離

**クエリ例**:
```typescript
// 特定の注文の配送情報
const q = query(
  collection(db, 'shippingInfo'),
  where('orderId', '==', orderId),
  limit(1)
);
```

---

### 12. `auditLogs` コレクション（監査ログ）

**用途**: システム操作の監査ログ

**パス**: `auditLogs/{date}/{logId}`

**主要フィールド**:
```typescript
{
  id: string;                    // ログID（ドキュメントID）
  actorUid?: string;            // 実行者のUID
  action: string;                // アクション名
  target: string;                // ターゲット（コレクション名）
  payload: any;                  // ペイロード（詳細情報）
  ts: Date;                     // タイムスタンプ
}
```

**テナント分離**: 日付でサブコレクション化（必要に応じて`tenant`フィールドを追加）

**クエリ例**:
```typescript
// 特定の日付のログ一覧
const dateStr = '2024-01-01';
const q = query(
  collection(db, 'auditLogs', dateStr, 'logs'),
  orderBy('ts', 'desc')
);
```

---

## 🔒 テナント分離の原則

### 必須ルール

1. **すべてのコレクションでテナント分離を実装**
   - 直接分離: `tenant`フィールドを持つコレクション（`users`, `memories`, `orders`, `claimRequests`等）
   - 間接分離: 親コレクションの`tenant`で分離（`assets`, `acrylicPhotos`, `shippingInfo`等）

2. **クエリ時は必ずテナントフィルタを適用**
   ```typescript
   // ✅ 正しい例
   const q = query(
     collection(db, 'memories'),
     where('tenant', '==', tenantId),
     orderBy('createdAt', 'desc')
   );
   
   // ❌ 間違った例（テナントフィルタなし）
   const q = query(
     collection(db, 'memories'),
     orderBy('createdAt', 'desc')
   );
   ```

3. **データ作成時は必ず`tenant`フィールドを設定（識別可能なIDを使用）**
   ```typescript
   // ✅ 正しい例（識別可能なIDを使用）
   const tenantDoc = await db.collection('tenants').doc(firestoreDocId).get();
   const storeId = tenantDoc.data()?.id || firestoreDocId; // 識別可能なIDを取得
   
   await addDoc(collection(db, 'memories'), {
     ...memoryData,
     tenant: storeId, // 必須：識別可能なID（tenants.idフィールド）
     ownerUid: uid,
   });
   
   // ❌ 間違った例（FirestoreドキュメントIDを使用）
   await addDoc(collection(db, 'memories'), {
     ...memoryData,
     tenant: 'store-1765044610296', // 識別不可能なIDは使用しない
     ownerUid: uid,
   });
   ```

4. **Firestoreルールでテナント検証を実装**
   ```javascript
   // firestore.rules
   function isSameTenant(tenant) {
     return request.auth.token.tenant == tenant;
   }
   
   match /memories/{memoryId} {
     allow read: if isAuthenticated() && 
       isSameTenant(resource.data.tenant);
   }
   ```

---

## 📊 データ関係図

```
companies
  └─ tenants (companyId)
      ├─ staff (adminTenant)
      ├─ users (tenant)
      ├─ memories (tenant)
      │   └─ assets (memoryId)
      ├─ publicPages (tenant, memoryId)
      ├─ claimRequests (tenant)
      ├─ orders (tenant, memoryId)
      │   ├─ acrylicPhotos (orderId)
      │   └─ shippingInfo (orderId)
      └─ auditLogs (date, tenant)
```

---

## 🔍 クエリパターン

### 1. テナント別データ取得

```typescript
// テナントの顧客一覧
async function getUsersByTenant(tenantId: string): Promise<User[]> {
  const q = query(
    collection(db, 'users'),
    where('tenant', '==', tenantId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
}
```

### 2. ユーザー別データ取得（テナント考慮）

```typescript
// ユーザーの想い出ページ一覧
async function getMemoriesByUser(uid: string, tenantId: string): Promise<Memory[]> {
  const q = query(
    collection(db, 'memories'),
    where('ownerUid', '==', uid),
    where('tenant', '==', tenantId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memory));
}
```

### 3. 関連データ取得（間接分離）

```typescript
// 注文に関連する写真一覧
async function getPhotosByOrder(orderId: string): Promise<AcrylicPhoto[]> {
  // まず注文を取得してテナントを確認
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error('Order not found');
  
  const orderData = orderSnap.data();
  const tenantId = orderData.tenant;
  
  // テナント検証（セキュリティ）
  if (orderData.tenant !== currentTenant) {
    throw new Error('Access denied: Tenant mismatch');
  }
  
  // 写真を取得
  const q = query(
    collection(db, 'acrylicPhotos'),
    where('orderId', '==', orderId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcrylicPhoto));
}
```

---

## 🛡️ セキュリティルール

### 基本原則

1. **認証チェック**: すべての操作で認証を必須
2. **テナント検証**: データアクセス時にテナントを検証
3. **所有者チェック**: ユーザーは自分のデータのみ操作可能
4. **管理者権限**: 管理者は同じテナントのデータを操作可能

### ルール例

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ヘルパー関数
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isSameTenant(tenant) {
      return request.auth.token.tenant == tenant;
    }
    
    function isOwner(ownerUid) {
      return request.auth.uid == ownerUid;
    }
    
    // メモリコレクション
    match /memories/{memoryId} {
      allow read: if isAuthenticated() && 
        isSameTenant(resource.data.tenant);
      allow create: if isAuthenticated() && 
        request.resource.data.ownerUid == request.auth.uid &&
        request.resource.data.tenant != null;
      allow update, delete: if isAuthenticated() && 
        isSameTenant(resource.data.tenant) &&
        (isOwner(resource.data.ownerUid) || isAdmin());
    }
  }
}
```

---

## 📝 インデックス要件

### 必須インデックス

以下のクエリパターンでインデックスが必要です：

1. **テナント + 作成日時**
   ```typescript
   // users, memories, orders, claimRequests等
   where('tenant', '==', tenantId)
   orderBy('createdAt', 'desc')
   ```

2. **所有者 + テナント + 作成日時**
   ```typescript
   // memories
   where('ownerUid', '==', uid)
   where('tenant', '==', tenantId)
   orderBy('createdAt', 'desc')
   ```

3. **テナント + ステータス + 作成日時**
   ```typescript
   // orders, claimRequests
   where('tenant', '==', tenantId)
   where('status', '==', 'paid')
   orderBy('createdAt', 'desc')
   ```

### インデックス定義例

```json
{
  "indexes": [
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenant", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerUid", "order": "ASCENDING" },
        { "fieldPath": "tenant", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 🚨 重要な注意事項

### 1. データ分離の徹底

- **異なる企業・店舗のデータが混在しないようにする**
- すべてのクエリでテナントフィルタを必須とする
- Firestoreルールでテナント検証を実装

### 2. コレクション設計の一貫性

- 新しいコレクションを追加する際は、必ずテナント分離を考慮
- 既存のコレクション構造を変更する際は、すべてのアプリで同期

### 3. 型定義の共有

- `src/types/index.ts`の型定義をすべてのアプリで共有
- 型定義を変更する際は、すべてのアプリで同期

### 4. マイグレーション

- データ構造を変更する際は、マイグレーションスクリプトを作成
- 既存データの整合性を確認

---

## 🗑️ 顧客削除ポリシー（本番環境）

### 基本方針

**異なる企業ID（tenant）から購入されたユーザーのデータは削除してはいけません。**

### 削除ルール

#### 1. マルチテナント安全性チェック

削除処理の前に、以下のチェックを実行します：

1. **他のtenantにmemoriesがあるか確認**
   - `memories`コレクションで`ownerUid`を検索
   - 異なる`tenant`のmemoriesが存在する場合は削除を拒否

2. **他のtenantにordersがあるか確認**
   - `orders`コレクションで`email`を検索
   - 異なる`tenant`のordersが存在する場合は削除を拒否

3. **他のtenantにclaimRequestsがあるか確認**
   - `claimRequests`コレクションで`email`を検索
   - 異なる`tenant`のclaimRequestsが存在する場合は削除を拒否

4. **他のtenantにusersがあるか確認**
   - `users`コレクションで`uid`を検索
   - `tenants`配列に他のtenantが含まれている場合は削除を拒否

#### 2. 削除可能なケース

以下の条件を**すべて**満たす場合のみ削除可能：

- ✅ 削除対象のtenantにのみデータが存在する
- ✅ 他のtenantにデータが存在しない
- ✅ 削除対象のclaimRequestに関連するデータのみを削除

#### 3. 削除できないケース

以下のいずれかに該当する場合は削除を拒否：

- ❌ 他のtenantにmemoriesが存在する
- ❌ 他のtenantにordersが存在する
- ❌ 他のtenantにclaimRequestsが存在する
- ❌ `users`コレクションの`tenants`配列に他のtenantが含まれている

### 削除処理のフロー

```
1. マルチテナント安全性チェック
   ├─ 他のtenantにmemoriesがあるか？
   ├─ 他のtenantにordersがあるか？
   ├─ 他のtenantにclaimRequestsがあるか？
   └─ 他のtenantにusersがあるか？
   
2. チェック結果
   ├─ 他のtenantにデータがある → 削除を拒否（403エラー）
   └─ 他のtenantにデータがない → 削除処理を続行
   
3. 削除処理
   ├─ 削除対象のclaimRequestに関連するデータのみを削除
   ├─ memories: claimRequestData.memoryId と orders の memoryId のみ
   ├─ publicPages: 関連するpublicPageIdのみ
   ├─ assets: 関連するmemoryIdのassetsのみ
   └─ users: tenants配列から該当tenantを削除（複数tenantの場合）
```

### usersコレクションの処理

#### ケース1: 複数のtenantに属している場合
```typescript
// tenants配列から該当tenantを削除
{
  tenants: ['tenant1', 'tenant2', 'tenant3']  // tenant2を削除
  → tenants: ['tenant1', 'tenant3']
}
```

#### ケース2: 単一tenantの場合
```typescript
// usersコレクションを完全削除
users/{uid} → 削除
```

### エラーレスポンス

他のtenantにデータが存在する場合、以下のエラーを返します：

```json
{
  "success": false,
  "error": "このユーザーは他の企業（テナント）からもサービスを購入しているため、削除できません",
  "details": {
    "message": "異なる企業ID（tenant）から購入されたユーザーのデータは削除できません。",
    "otherTenants": ["tenant2", "tenant3"],
    "otherTenantDataCounts": {
      "memories": 5,
      "orders": 3,
      "claimRequests": 2,
      "users": 1
    },
    "suggestion": "このテナントに関連するデータのみを削除する場合は、個別の思い出ページを削除してください。"
  }
}
```

### 個別の思い出ページの削除

複数のページを所有しているユーザーの場合、個別の思い出ページのみを削除できます：

```
DELETE /api/admin/customers/:customerId?tenantId=xxx&memoryId=yyy
```

この場合：
- ✅ 指定された`memoryId`のみが削除される
- ✅ 他のmemoriesは削除されない
- ✅ 他のtenantのデータは影響を受けない

### セキュリティ考慮事項

1. **テナント分離の徹底**
   - 削除処理は必ず`tenant`フィールドでフィルタリング
   - 他のtenantのデータにアクセスしない

2. **削除前の確認**
   - 削除前に必ずマルチテナントチェックを実行
   - チェック結果をログに記録

3. **監査ログ**
   - 削除処理の実行を監査ログに記録
   - 削除されたデータの詳細を記録

---

## 🔄 データ復旧ガイド

### 緊急: 誤って削除されたデータの復旧方法

#### 復旧に必要な情報

以下の情報を確認してください：

1. **削除されたユーザーの情報**
   - Emailアドレス
   - `claimedByUid` (ownerUid)
   - テナントID

2. **削除されたデータの種類**
   - `memories` コレクション
   - `publicPages` コレクション
   - `assets` コレクション
   - `orders` コレクション
   - `claimRequests` コレクション

#### 復旧方法

##### 方法1: バックアップから復元（推奨）

1. **最新のバックアップを確認**
   ```bash
   ls -la backups/
   ```

2. **特定のコレクションを復元**
   ```bash
   node scripts/restore-firestore.js --backup=backup-YYYY-MM-DD --collections=memories,publicPages,assets
   ```

3. **ドライランで確認（推奨）**
   ```bash
   node scripts/restore-firestore.js --backup=backup-YYYY-MM-DD --collections=memories --dry-run
   ```

##### 方法2: Firebase Storageから復元

Firebase Storageのファイルが残っている場合、そこから情報を復元できます。

1. **Storageのパスを確認**
   - `users/{uid}/memories/{memoryId}/uploads/`
   - `deliver/publicPages/{pageId}/`

2. **Storageからファイルを取得**
   ```bash
   gsutil -m cp -r gs://your-bucket/users/{uid}/memories/ ./recovered-memories/
   ```

##### 方法3: Audit Logsから情報を取得

削除処理のauditLogsに削除されたデータの情報が残っている可能性があります。

1. **Audit Logsを確認**
   - Firebase Console または Functions のログから削除処理のログを確認

2. **削除されたmemoryIdを特定**
   - ログに `📋 削除対象memoryId:` が記録されている

#### 重要な注意事項

1. **復元前に現在の状態をバックアップ**
   ```bash
   node scripts/backup-firestore.js --output=backup-before-recovery
   ```

2. **部分的な復元を推奨**
   - 全てのデータを一度に復元せず、必要なコレクションのみを復元
   - `memories` → `publicPages` → `assets` の順で復元

3. **データの整合性を確認**
   - 復元後、関連するデータの整合性を確認
   - `memories` と `publicPages` の関連性
   - `assets` と `memories` の関連性

#### 復旧に必要な最小限のデータ

- **必須（復旧が必要）**
  1. `memories` - 想い出ページの基本情報
  2. `publicPages` - 公開ページの情報
  3. `assets` - 画像・動画などのアセット情報

- **重要（可能であれば復旧）**
  4. `orders` - 注文情報（必要に応じて）
  5. `users` - ユーザー情報（UID、emailなど）

- **オプショナル（復旧不要）**
  - `claimRequests` - リクエスト情報
  - `auditLogs` - 監査ログ
  - `mail` - メール送信履歴

---

## 📚 関連ドキュメント

- [CRM_DATABASE_STRUCTURE.md](./CRM_DATABASE_STRUCTURE.md) - CRM構築用データベース構造
- [USER_COLLECTION_SEPARATION_PLAN.md](./USER_COLLECTION_SEPARATION_PLAN.md) - ユーザーコレクション分離計画
- [USERS_COLLECTION_DESIGN.md](./USERS_COLLECTION_DESIGN.md) - ユーザーコレクション設計

---

## 🔄 更新履歴

- 2024-01-XX: 初版作成
- 2024-01-XX: `users`と`staff`コレクションを分離
- 2024-01-XX: テナント分離の原則を明確化
- 2024-12-XX: 企業ID（companyId）と店舗ID（tenantId）の分離を明確化
- 2024-12-XX: 顧客削除ポリシーとデータ復旧ガイドを追加

---

## 🏢 テナント・企業削除時のユーザーデータ保持ポリシー

### 基本方針

**企業や店舗が廃止（削除）されても、ユーザーの情報は保持され、継続して閲覧可能です。**

### データ保持の原則

1. **ユーザーデータは削除されない**
   - `users`コレクションのデータは保持される
   - `memories`コレクションのデータは保持される
   - `publicPages`コレクションのデータは保持される
   - `assets`コレクションのデータは保持される
   - `orders`コレクションのデータは保持される

2. **テナントの削除ではなく、ステータス変更を推奨**
   - テナントを物理的に削除するのではなく、`status`を`'inactive'`または`'suspended'`に変更
   - これにより、データへのアクセス制御を柔軟に行える

### テナントステータスの意味

```typescript
{
  status: 'active' | 'inactive' | 'suspended';
}
```

- **`active`**: 通常運用中
- **`inactive`**: 一時停止（データは保持、新規登録は不可）
- **`suspended`**: 停止（データは保持、アクセス制限あり）

### ユーザーデータへのアクセス

#### 1. ユーザー自身によるアクセス

Firestoreルールにより、ユーザーは自分のデータを常に閲覧可能：

```javascript
// firestore.rules
match /memories/{memoryId} {
  allow read: if isOwner(resource.data.ownerUid) || 
               isSuperAdmin() || 
               isTenantAdmin(resource.data.tenant);
}
```

- ✅ ユーザーは自分の`memories`を閲覧可能
- ✅ ユーザーは自分の`publicPages`を閲覧可能
- ✅ ユーザーは自分の`assets`を閲覧可能
- ✅ テナントが削除されても、`isOwner`チェックによりアクセス可能

#### 2. 公開ページへのアクセス

公開ページは誰でも閲覧可能：

```javascript
match /publicPages/{pageId} {
  allow read: if true; // 誰でも読み取り可能
}
```

- ✅ 公開ページのURLが分かれば、誰でも閲覧可能
- ✅ テナントが削除されても、公開ページは閲覧可能

### 実装推奨事項

#### 1. テナント削除時の処理

```typescript
// ❌ 推奨しない: テナントを物理的に削除
await db.collection('tenants').doc(tenantId).delete();

// ✅ 推奨: ステータスを変更
await db.collection('tenants').doc(tenantId).update({
  status: 'inactive',
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
});
```

#### 2. ユーザーデータの保持確認

テナント削除前に、関連するユーザーデータを確認：

```typescript
// テナントに関連するユーザーデータの確認
const memoriesCount = await db.collection('memories')
  .where('tenant', '==', tenantId)
  .count()
  .get();

const usersCount = await db.collection('users')
  .where('tenant', '==', tenantId)
  .count()
  .get();

console.log(`テナント ${tenantId} に関連するデータ:`, {
  memories: memoriesCount.data().count,
  users: usersCount.data().count
});
```

#### 3. データ移行（オプション）

必要に応じて、ユーザーデータを別のテナントに移行：

```typescript
// ユーザーデータを別のテナントに移行
const batch = db.batch();
const memoriesSnapshot = await db.collection('memories')
  .where('tenant', '==', oldTenantId)
  .get();

memoriesSnapshot.docs.forEach(doc => {
  batch.update(doc.ref, {
    tenant: newTenantId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});

await batch.commit();
```

### セキュリティ考慮事項

1. **データアクセス制御**
   - テナントが`inactive`または`suspended`の場合、新規登録を制限
   - 既存ユーザーのデータアクセスは許可（`isOwner`チェック）

2. **公開ページの継続性**
   - 公開ページのURLは変更されない
   - テナントが削除されても、公開ページは閲覧可能

3. **データの整合性**
   - テナント削除時は、関連データの整合性を確認
   - 必要に応じて、データ移行を検討

### まとめ

- ✅ **ユーザーデータは保持される**: テナントが削除されても、ユーザーのデータは削除されない
- ✅ **継続して閲覧可能**: ユーザーは自分のデータを常に閲覧可能
- ✅ **公開ページは継続**: 公開ページのURLが分かれば、誰でも閲覧可能
- ⚠️ **テナント削除は非推奨**: テナントを物理的に削除するのではなく、`status`を変更することを推奨

**重要**: 企業や店舗が廃止されても、ユーザーの想い出ページは保護され、継続して閲覧可能です。

---

**このドキュメントは、すべてのアプリケーション開発者が参照し、一貫したデータ構造を維持するために作成されました。変更時は必ず全関係者に通知してください。**

