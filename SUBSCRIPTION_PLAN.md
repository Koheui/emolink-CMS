# 利用期限・ストレージ拡張機能実装プラン

## 概要

emolinkページの利用期限管理とストレージ制限の個別拡張機能を実装します。
- **利用期限**: デフォルト20年、10年延長オプション（Stripe課金は後日実装）
- **ストレージ制限**: デフォルト120MB、拡張オプション（サブスク月額200円、Stripe課金は後日実装）

## 実装方針

### 基本原則
1. **既存機能への影響を最小化**
2. **Stripe課金は後日統合可能な設計**
3. **段階的な実装とテスト**
4. **データ整合性の確保**

## 実装フェーズ

### フェーズ1: データモデルの拡張

#### 1.1 Memoryインターフェースの拡張
- **ファイル**: `src/types/index.ts`
- **追加フィールド**:
  ```typescript
  export interface Memory {
    // ... 既存フィールド
    
    // 利用期限関連
    expiresAt?: Date;              // 有効期限（デフォルト: createdAt + 20年）
    extensionCount?: number;        // 延長回数（デフォルト: 0）
    lastExtendedAt?: Date;          // 最後に延長した日時
    
    // ストレージ関連
    storageLimit?: number;          // ストレージ制限（バイト単位、デフォルト: 120MB）
    storageSubscriptionId?: string; // ストレージ拡張サブスクリプションID（Stripe用、後日）
    storageSubscriptionStatus?: 'active' | 'canceled' | 'past_due'; // サブスクリプションステータス
  }
  ```

#### 1.2 ユーザー/テナントレベルのストレージ設定（オプション）
- **ファイル**: `src/types/index.ts`
- **新規インターフェース**:
  ```typescript
  export interface StorageSubscription {
    id: string;
    userId: string;
    tenant: string;
    memoryId?: string;              // 特定のemolinkページ用（nullの場合はテナント全体）
    storageLimit: number;            // ストレージ制限（バイト単位）
    monthlyPrice: number;            // 月額料金（円）
    stripeSubscriptionId?: string;   // StripeサブスクリプションID（後日）
    status: 'active' | 'canceled' | 'past_due';
    createdAt: Date;
    updatedAt: Date;
    canceledAt?: Date;
  }
  ```

### フェーズ2: 利用期限機能の実装

#### 2.1 利用期限チェック機能
- **ファイル**: `src/lib/expiration.ts` (新規作成)
- **実装内容**:
  ```typescript
  // 利用期限の計算
  export function calculateExpirationDate(createdAt: Date, extensionCount: number = 0): Date {
    const baseYears = 20;
    const extensionYears = 10;
    const totalYears = baseYears + (extensionCount * extensionYears);
    const expirationDate = new Date(createdAt);
    expirationDate.setFullYear(expirationDate.getFullYear() + totalYears);
    return expirationDate;
  }
  
  // 利用期限チェック
  export function isExpired(memory: Memory): boolean {
    if (!memory.expiresAt) {
      // 既存データの互換性: expiresAtがない場合は計算
      const expiresAt = calculateExpirationDate(memory.createdAt, memory.extensionCount || 0);
      return expiresAt < new Date();
    }
    return memory.expiresAt < new Date();
  }
  
  // 残り日数の計算
  export function getDaysUntilExpiration(memory: Memory): number {
    const expiresAt = memory.expiresAt || calculateExpirationDate(memory.createdAt, memory.extensionCount || 0);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  ```

#### 2.2 利用期限チェックの統合
- **ファイル**: `src/app/memories/create/page.tsx`
- **変更内容**:
  - ページ読み込み時に利用期限をチェック
  - 期限切れの場合は編集不可メッセージを表示
  - 公開ページアクセス時も期限チェック

- **ファイル**: `src/components/public-page-client.tsx`
- **変更内容**:
  - 公開ページアクセス時に利用期限をチェック
  - 期限切れの場合はアクセス不可メッセージを表示

#### 2.3 延長機能の実装（課金なし版）
- **ファイル**: `src/lib/memory-extension.ts` (新規作成)
- **実装内容**:
  ```typescript
  // 延長処理（Stripe統合前は手動延長）
  export async function extendMemoryExpiration(
    memoryId: string,
    userId: string
  ): Promise<void> {
    // TODO: Stripe決済処理を追加（後日実装）
    
    // 現在の延長回数を取得
    const memory = await getMemory(memoryId);
    const currentExtensionCount = memory.extensionCount || 0;
    const newExtensionCount = currentExtensionCount + 1;
    
    // 新しい有効期限を計算
    const newExpiresAt = calculateExpirationDate(memory.createdAt, newExtensionCount);
    
    // Firestoreを更新
    await updateMemory(memoryId, {
      extensionCount: newExtensionCount,
      expiresAt: newExpiresAt,
      lastExtendedAt: new Date(),
    });
  }
  ```

#### 2.4 延長UIの実装
- **ファイル**: `src/components/memory-expiration-banner.tsx` (新規作成)
- **実装内容**:
  - 利用期限の表示
  - 残り日数の表示
  - 延長ボタン（Stripe統合前は手動延長）
  - 期限切れ警告メッセージ

### フェーズ3: ストレージ制限機能の実装

#### 3.1 ストレージ制限チェック機能
- **ファイル**: `src/lib/storage-limit.ts` (新規作成)
- **実装内容**:
  ```typescript
  // デフォルトストレージ制限（120MB）
  export const DEFAULT_STORAGE_LIMIT = 120 * 1024 * 1024; // 120MB in bytes
  
  // ストレージ制限の取得
  export function getStorageLimit(memory: Memory): number {
    return memory.storageLimit || DEFAULT_STORAGE_LIMIT;
  }
  
  // ストレージ使用量の計算
  export async function calculateStorageUsed(memoryId: string): Promise<number> {
    // Firebase Storageから該当メモリの全ファイルサイズを合計
    // または memory.storageUsed を使用（既に実装済みの可能性）
  }
  
  // ストレージ制限チェック
  export async function checkStorageLimit(
    memory: Memory,
    additionalSize: number
  ): Promise<{ allowed: boolean; currentUsed: number; limit: number; remaining: number }> {
    const limit = getStorageLimit(memory);
    const currentUsed = memory.storageUsed || 0;
    const newTotal = currentUsed + additionalSize;
    
    return {
      allowed: newTotal <= limit,
      currentUsed,
      limit,
      remaining: limit - currentUsed,
    };
  }
  ```

#### 3.2 アップロード時のストレージチェック
- **ファイル**: `src/components/file-upload.tsx`, `src/components/content-upload-modal.tsx`
- **変更内容**:
  - アップロード前にストレージ制限をチェック
  - 制限超過の場合はエラーメッセージを表示
  - ストレージ拡張への誘導

#### 3.3 ストレージ拡張機能の実装（課金なし版）
- **ファイル**: `src/lib/storage-subscription.ts` (新規作成)
- **実装内容**:
  ```typescript
  // ストレージ拡張プラン
  export const STORAGE_PLANS = {
    default: { limit: 120 * 1024 * 1024, price: 0 },      // 120MB（無料）
    extended: { limit: 200 * 1024 * 1024, price: 200 },   // 200MB（月額200円）
    // 将来的に追加可能
  };
  
  // ストレージ拡張の作成（Stripe統合前は手動）
  export async function createStorageSubscription(
    memoryId: string,
    userId: string,
    plan: 'extended'
  ): Promise<void> {
    // TODO: Stripeサブスクリプション作成処理を追加（後日実装）
    
    const selectedPlan = STORAGE_PLANS[plan];
    
    // Firestoreを更新
    await updateMemory(memoryId, {
      storageLimit: selectedPlan.limit,
      storageSubscriptionStatus: 'active',
    });
  }
  ```

#### 3.4 ストレージ拡張UIの実装
- **ファイル**: `src/components/storage-limit-banner.tsx` (新規作成)
- **実装内容**:
  - 現在のストレージ使用量の表示
  - ストレージ制限の表示
  - 使用率のプログレスバー
  - ストレージ拡張ボタン（Stripe統合前は手動拡張）
  - 制限超過警告メッセージ

### フェーズ4: UI統合

#### 4.1 編集ページへの統合
- **ファイル**: `src/app/memories/create/page.tsx`
- **変更内容**:
  - `MemoryExpirationBanner`コンポーネントの追加
  - `StorageLimitBanner`コンポーネントの追加
  - ヘッダーまたはサイドバーに表示

#### 4.2 管理画面の追加（オプション）
- **ファイル**: `src/app/admin/subscriptions/page.tsx` (新規作成)
- **実装内容**:
  - 利用期限一覧
  - ストレージ拡張一覧
  - 手動延長・拡張機能（Stripe統合前）

### フェーズ5: 既存データの移行

#### 5.1 既存Memoryデータの更新
- **ファイル**: `src/lib/migration/update-existing-memories.ts` (新規作成)
- **実装内容**:
  ```typescript
  // 既存のMemoryデータにexpiresAtとstorageLimitを設定
  export async function migrateExistingMemories(): Promise<void> {
    const memories = await getAllMemories();
    
    for (const memory of memories) {
      const updates: Partial<Memory> = {};
      
      // expiresAtが未設定の場合は計算
      if (!memory.expiresAt) {
        updates.expiresAt = calculateExpirationDate(
          memory.createdAt,
          memory.extensionCount || 0
        );
      }
      
      // storageLimitが未設定の場合はデフォルト値
      if (!memory.storageLimit) {
        updates.storageLimit = DEFAULT_STORAGE_LIMIT;
      }
      
      if (Object.keys(updates).length > 0) {
        await updateMemory(memory.id, updates);
      }
    }
  }
  ```

## ファイル構成

```
src/
├── types/
│   └── index.ts                    # Memoryインターフェース拡張
├── lib/
│   ├── expiration.ts               # 利用期限関連機能（新規）
│   ├── memory-extension.ts         # 延長機能（新規）
│   ├── storage-limit.ts            # ストレージ制限機能（新規）
│   ├── storage-subscription.ts     # ストレージ拡張機能（新規）
│   └── migration/
│       └── update-existing-memories.ts  # 既存データ移行（新規）
├── components/
│   ├── memory-expiration-banner.tsx     # 利用期限バナー（新規）
│   └── storage-limit-banner.tsx         # ストレージ制限バナー（新規）
└── app/
    ├── memories/
    │   └── create/
    │       └── page.tsx            # 編集ページ（更新）
    └── admin/
        └── subscriptions/         # 管理画面（新規、オプション）
            └── page.tsx
```

## データベーススキーマ変更

### `memories`コレクションの追加フィールド

```typescript
{
  // 既存フィールド...
  
  // 利用期限関連
  expiresAt?: Timestamp;           // 有効期限
  extensionCount?: number;          // 延長回数（デフォルト: 0）
  lastExtendedAt?: Timestamp;       // 最後に延長した日時
  
  // ストレージ関連
  storageLimit?: number;           // ストレージ制限（バイト単位、デフォルト: 120MB）
  storageSubscriptionId?: string;   // StripeサブスクリプションID（後日）
  storageSubscriptionStatus?: 'active' | 'canceled' | 'past_due';
}
```

### 新規コレクション（オプション）: `storageSubscriptions`

```typescript
{
  id: string;
  userId: string;
  tenant: string;
  memoryId?: string;               // 特定のemolinkページ用
  storageLimit: number;            // ストレージ制限（バイト単位）
  monthlyPrice: number;            // 月額料金（円）
  stripeSubscriptionId?: string;   // StripeサブスクリプションID
  status: 'active' | 'canceled' | 'past_due';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  canceledAt?: Timestamp;
}
```

## 実装順序

1. **フェーズ1**: データモデルの拡張
2. **フェーズ2**: 利用期限機能の実装
3. **フェーズ3**: ストレージ制限機能の実装
4. **フェーズ4**: UI統合
5. **フェーズ5**: 既存データの移行

## Stripe統合の準備（後日実装）

### 実装予定の機能

#### 利用期限延長
- Stripe Checkoutで10年延長の決済
- 決済完了後に自動で延長処理

#### ストレージ拡張
- Stripe Subscriptionで月額200円のサブスクリプション作成
- サブスクリプション状態の管理
- キャンセル処理

### 統合ポイント

1. **`extendMemoryExpiration`関数**
   - Stripe Checkoutセッション作成
   - 決済完了後のWebhook処理

2. **`createStorageSubscription`関数**
   - Stripe Subscription作成
   - サブスクリプション状態の同期

3. **Webhook処理**
   - `functions/src/stripe-webhook.ts` (新規作成)
   - 決済完了時の処理
   - サブスクリプション更新・キャンセル時の処理

## テスト計画

### 単体テスト
- 利用期限計算のテスト
- ストレージ制限チェックのテスト
- 延長・拡張処理のテスト

### 統合テスト
- アップロード時のストレージチェック
- 期限切れ時のアクセス制限
- 既存機能が正常に動作することを確認

### 移行テスト
- 既存データの移行処理
- データ整合性の確認

## リスク管理

### リスク1: 既存機能への影響
- **対策**: デフォルト値の設定、既存データの互換性維持
- **検証**: 既存機能の動作確認を徹底

### リスク2: データ不整合
- **対策**: 移行スクリプトでの整合性チェック
- **検証**: 移行テストの実施

### リスク3: パフォーマンス
- **対策**: ストレージ使用量の計算を最適化
- **検証**: パフォーマンステストの実施

## デプロイ計画

### ステージング環境でのテスト
1. フェーズ1のデプロイとテスト
2. フェーズ2のデプロイとテスト
3. フェーズ3のデプロイとテスト
4. フェーズ4のデプロイとテスト
5. フェーズ5の実行（既存データ移行）
6. 本番環境へのデプロイ

### 本番環境へのデプロイ
1. フェーズ1-4をデプロイ
2. 既存データの移行を実行
3. 動作確認
4. Stripe統合（後日）

## 今後の拡張

- Stripe統合（決済処理）
- 複数のストレージ拡張プラン
- 利用期限の自動通知（メール）
- ストレージ使用量の詳細分析
- 自動バックアップ機能

