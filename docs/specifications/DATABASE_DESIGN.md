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
  
  createdAt: Date;
  updatedAt: Date;
}
```

**テナント分離**: `tenant`フィールドで必ず分離（必須）

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

**テナント分離**: `tenant`フィールドで必ず分離（必須）

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

3. **データ作成時は必ず`tenant`フィールドを設定**
   ```typescript
   // ✅ 正しい例
   await addDoc(collection(db, 'memories'), {
     ...memoryData,
     tenant: tenantId, // 必須
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

## 📚 関連ドキュメント

- [CRM_DATABASE_STRUCTURE.md](./CRM_DATABASE_STRUCTURE.md) - CRM構築用データベース構造
- [USER_COLLECTION_SEPARATION_PLAN.md](./USER_COLLECTION_SEPARATION_PLAN.md) - ユーザーコレクション分離計画
- [USERS_COLLECTION_DESIGN.md](./USERS_COLLECTION_DESIGN.md) - ユーザーコレクション設計

---

## 🔄 更新履歴

- 2024-01-XX: 初版作成
- 2024-01-XX: `users`と`staff`コレクションを分離
- 2024-01-XX: テナント分離の原則を明確化

---

**このドキュメントは、すべてのアプリケーション開発者が参照し、一貫したデータ構造を維持するために作成されました。変更時は必ず全関係者に通知してください。**

