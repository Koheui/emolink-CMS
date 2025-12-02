# CRM構築実装計画 v2.0

## 📋 概要

社内スタッフ（アルバイト含む）向けのCRM（顧客関係管理）システムとNFC書き込み機能を構築します。

## 🎯 実装目標

1. **顧客管理機能**: 顧客情報の一覧表示・検索・詳細表示
2. **注文管理機能**: 注文の一覧表示・ステータス管理・進捗確認
3. **権限管理機能**: 管理者、編集者、閲覧者の3段階の権限管理
4. **NFC書き込み機能**: ソニー PaSoRi RC-S300を使用したNFCタグへの書き込み

## 👥 権限体系

### ロール定義

#### 1. **管理者（tenantAdmin / superAdmin）**
- すべての権限
- スタッフの追加・削除・権限変更
- 顧客・注文の閲覧・編集・削除
- NFC書き込み
- テナント設定の管理（superAdminのみ）

#### 2. **編集者（editor）** - 新規追加
- 顧客・注文の閲覧
- 注文ステータスの更新
- 配送情報の更新
- NFC書き込み
- ソーティング・フィルタリング

#### 3. **閲覧者（viewer）** - 新規追加
- 顧客・注文の閲覧のみ
- ソーティング・フィルタリング
- 編集・削除・NFC書き込みは不可

### 権限チェック関数

```typescript
// src/lib/security/role-check.ts
export type StaffRole = 'tenantAdmin' | 'superAdmin' | 'editor' | 'viewer';

export interface StaffPermissions {
  canViewCRM?: boolean;        // CRM閲覧権限
  canEditOrders?: boolean;      // 注文編集権限
  canEditCustomers?: boolean;   // 顧客編集権限
  canManageStaff?: boolean;     // スタッフ管理権限（管理者のみ）
  canWriteNfc?: boolean;        // NFC書き込み権限
  canManageTenants?: boolean;   // テナント管理権限（superAdminのみ）
}

export function canAccessCRM(staff: Staff): boolean {
  return staff.role === 'tenantAdmin' || 
         staff.role === 'superAdmin' || 
         staff.role === 'editor' || 
         staff.role === 'viewer';
}

export function canEditOrders(staff: Staff): boolean {
  return staff.role === 'tenantAdmin' || 
         staff.role === 'superAdmin' || 
         staff.role === 'editor';
}

export function canWriteNFC(staff: Staff): boolean {
  return staff.role === 'tenantAdmin' || 
         staff.role === 'superAdmin' || 
         staff.role === 'editor';
}

export function canManageStaff(staff: Staff): boolean {
  return staff.role === 'tenantAdmin' || 
         staff.role === 'superAdmin';
}
```

## 📁 ディレクトリ構造

```
src/app/admin/crm/
├── customers/
│   ├── page.tsx              # 顧客一覧ページ
│   └── [customerId]/
│       └── page.tsx          # 顧客詳細ページ（NFC書き込み含む）
├── orders/
│   ├── page.tsx              # 注文一覧ページ
│   └── [orderId]/
│       └── page.tsx          # 注文詳細ページ
└── staff/
    ├── page.tsx              # スタッフ管理ページ（管理者のみ）
    └── [staffId]/
        └── page.tsx          # スタッフ詳細・権限設定ページ
```

## 🔧 技術実装詳細

### 1. 権限管理の実装

#### Staff型の更新

```typescript
// src/types/index.ts
export interface Staff {
  uid: string;
  email: string;
  displayName?: string;
  role: 'tenantAdmin' | 'superAdmin' | 'editor' | 'viewer'; // 'fulfillmentOperator'を'editor'に変更
  adminTenant: string;
  permissions?: {
    canViewCRM?: boolean;
    canEditOrders?: boolean;
    canEditCustomers?: boolean;
    canManageStaff?: boolean;
    canWriteNfc?: boolean;
    canManageTenants?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### 権限チェック関数の実装

```typescript
// src/lib/security/role-check.ts
import { Staff } from '@/types';

export function canAccessCRM(staff: Staff): boolean {
  return ['tenantAdmin', 'superAdmin', 'editor', 'viewer'].includes(staff.role);
}

export function canEditOrders(staff: Staff): boolean {
  return ['tenantAdmin', 'superAdmin', 'editor'].includes(staff.role);
}

export function canEditCustomers(staff: Staff): boolean {
  return ['tenantAdmin', 'superAdmin', 'editor'].includes(staff.role);
}

export function canWriteNFC(staff: Staff): boolean {
  return ['tenantAdmin', 'superAdmin', 'editor'].includes(staff.role);
}

export function canManageStaff(staff: Staff): boolean {
  return ['tenantAdmin', 'superAdmin'].includes(staff.role);
}

export function canManageTenants(staff: Staff): boolean {
  return staff.role === 'superAdmin';
}
```

### 2. NFC書き込み機能（PaSoRi RC-S300対応）

#### 重要: PaSoRi RC-S300の技術的制約

**PaSoRi RC-S300はUSB接続のNFCリーダー/ライター**のため、Web NFC APIは使用できません。

#### 実装方針

##### オプション1: デスクトップアプリケーション（推奨）

1. **Electronアプリケーションを作成**
   - Next.jsアプリとは別のElectronアプリとして実装
   - PaSoRi RC-S300のSDKを使用
   - ブラウザからElectronアプリにURLを送信して書き込み

2. **実装フロー**
   ```
   CRM画面（ブラウザ）
     ↓ 「NFC書き込み」ボタンクリック
   Electronアプリ起動（URLを受け取る）
     ↓ PaSoRi RC-S300 SDKを使用
   NFCタグに書き込み
     ↓ 結果をFirestoreに記録
   CRM画面に結果を表示
   ```

##### オプション2: ローカルサーバー + ブラウザ連携

1. **Node.jsローカルサーバーを作成**
   - PaSoRi RC-S300のSDKを使用
   - HTTP APIで書き込みリクエストを受け付ける
   - ブラウザからfetch APIでローカルサーバーにリクエスト

2. **実装フロー**
   ```
   CRM画面（ブラウザ）
     ↓ 「NFC書き込み」ボタンクリック
   fetch('http://localhost:3001/nfc/write', { url: '...' })
     ↓ Node.jsサーバーがPaSoRi SDKを使用
   NFCタグに書き込み
     ↓ 結果を返す
   CRM画面に結果を表示
   ```

##### オプション3: Chrome Extension（将来的な拡張）

1. **Chrome Extensionを作成**
   - Native Messaging APIを使用
   - ネイティブアプリ（PaSoRi SDK使用）と通信

#### 推奨実装: オプション2（ローカルサーバー）

**理由**:
- 実装が比較的簡単
- ブラウザとの連携が容易
- デプロイが不要（ローカル環境のみ）

**実装例**:

```typescript
// nfc-server/index.js（新規作成）
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// PaSoRi RC-S300 SDKのインポート（実際のSDKに合わせて調整）
// const pasori = require('pasori-sdk'); // 仮のSDK名

app.post('/nfc/write', async (req, res) => {
  const { url } = req.body;
  
  try {
    // PaSoRi RC-S300でNFCタグに書き込み
    // const result = await pasori.write(url);
    
    // 実際の実装はPaSoRi SDKのドキュメントを参照
    res.json({ success: true, message: 'NFC書き込みが完了しました' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3001, () => {
  console.log('NFC Server running on http://localhost:3001');
});
```

```typescript
// src/lib/nfc/pasori-writer.ts
export async function writeNFCUrl(url: string): Promise<void> {
  try {
    const response = await fetch('http://localhost:3001/nfc/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'NFC書き込みに失敗しました');
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'NFC書き込みに失敗しました');
    }
  } catch (error: any) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('NFCサーバーに接続できません。ローカルサーバーが起動しているか確認してください。');
    }
    throw error;
  }
}
```

### 3. 顧客管理機能

#### 顧客一覧ページ

```typescript
// src/app/admin/crm/customers/page.tsx
- 顧客一覧の表示（users コレクション）
- 検索機能（メールアドレス、表示名）
- フィルタ機能（テナント、作成日）
- ソート機能（作成日、更新日、名前）
- ページネーション（50件/ページ）
- 権限チェック（閲覧者以上）
```

#### 顧客詳細ページ

```typescript
// src/app/admin/crm/customers/[customerId]/page.tsx
- 顧客基本情報の表示
- 注文履歴の表示（orders コレクション）
- 想い出ページ一覧（memories コレクション）
- 購入リクエスト履歴（claimRequests コレクション）
- NFC書き込みボタン（編集者以上、公開ページURLがある場合）
```

### 4. 注文管理機能

#### 注文一覧ページ

```typescript
// src/app/admin/crm/orders/page.tsx
- 注文一覧の表示（orders コレクション）
- ステータスフィルタ（決済完了、制作中、配送待ち、配送済み）
- 検索機能（メールアドレス、注文ID）
- ソート機能（作成日、決済日、ステータス）
- ページネーション（50件/ページ）
- 権限チェック（閲覧者以上）
```

#### 注文詳細ページ

```typescript
// src/app/admin/crm/orders/[orderId]/page.tsx
- 注文情報の表示
- 決済情報の確認
- 制作進捗の確認（acrylicPhotos コレクション）
- 配送情報の表示・更新（shippingInfo コレクション）
- ステータス更新機能（編集者以上）
- NFC書き込みボタン（編集者以上、公開ページURLがある場合）
```

### 5. スタッフ管理機能（管理者のみ）

#### スタッフ一覧ページ

```typescript
// src/app/admin/crm/staff/page.tsx
- スタッフ一覧の表示（staff コレクション）
- 検索機能（メールアドレス、表示名）
- フィルタ機能（ロール、テナント）
- 権限チェック（管理者のみ）
```

#### スタッフ詳細・権限設定ページ

```typescript
// src/app/admin/crm/staff/[staffId]/page.tsx
- スタッフ基本情報の表示
- ロール変更（管理者、編集者、閲覧者）
- 権限の個別設定
- 権限チェック（管理者のみ）
```

## 🔒 Firestore Rulesの更新

```javascript
// firestore.rules
match /staff/{staffId} {
  // 自分自身の情報は読み取り可能
  allow read: if isAuthenticated() && isOwner(staffId);
  // 管理者は他のスタッフ情報も読み取り可能
  allow read: if isAuthenticated() && 
    (request.auth.token.role == 'tenantAdmin' || 
     request.auth.token.role == 'superAdmin');
  // 書き込みは管理者のみ
  allow write: if isAuthenticated() && 
    (request.auth.token.role == 'tenantAdmin' || 
     request.auth.token.role == 'superAdmin');
}

match /orders/{orderId} {
  // 閲覧者以上は読み取り可能
  allow read: if isAuthenticated() && 
    (request.auth.token.role == 'tenantAdmin' || 
     request.auth.token.role == 'superAdmin' || 
     request.auth.token.role == 'editor' || 
     request.auth.token.role == 'viewer');
  // 編集者以上は更新可能
  allow update: if isAuthenticated() && 
    (request.auth.token.role == 'tenantAdmin' || 
     request.auth.token.role == 'superAdmin' || 
     request.auth.token.role == 'editor');
}
```

## 📊 実装フェーズ

### Phase 1: 権限管理の強化（優先度: 高）

1. **Staff型の更新**
   - `role`に`editor`と`viewer`を追加
   - `permissions`を更新

2. **権限チェック関数の実装**
   - `src/lib/security/role-check.ts`を作成
   - 各権限チェック関数を実装

3. **認証コンテキストの拡張**
   - `useSecretKeyAuth`に権限チェックを追加
   - CRMアクセス権限の確認

4. **Firestore Rulesの更新**
   - 新しいロールのアクセス権限を追加

### Phase 2: 顧客管理機能（優先度: 高）

1. **顧客一覧ページ** (`/admin/crm/customers`)
2. **顧客詳細ページ** (`/admin/crm/customers/[customerId]`)

### Phase 3: 注文管理機能（優先度: 高）

1. **注文一覧ページ** (`/admin/crm/orders`)
2. **注文詳細ページ** (`/admin/crm/orders/[orderId]`)

### Phase 4: スタッフ管理機能（優先度: 中）

1. **スタッフ一覧ページ** (`/admin/crm/staff`)
2. **スタッフ詳細・権限設定ページ** (`/admin/crm/staff/[staffId]`)

### Phase 5: NFC書き込み機能（優先度: 高）

1. **ローカルNFCサーバーの実装**
   - PaSoRi RC-S300 SDKの統合
   - HTTP APIの実装

2. **NFC書き込みUIコンポーネント**
   - `src/components/nfc-writer-button.tsx`を作成
   - ローカルサーバーとの連携

3. **顧客・注文詳細ページへの統合**
   - NFC書き込みボタンの追加
   - 書き込み履歴の記録

## 🛠️ PaSoRi RC-S300 SDKの調査

### 必要な情報

1. **SDKの入手方法**
   - ソニー公式サイトからSDKをダウンロード
   - ドキュメントを確認

2. **対応プラットフォーム**
   - Windows / macOS / Linux
   - Node.js対応の有無

3. **API仕様**
   - NFC書き込みのAPI
   - エラーハンドリング

### 実装前の確認事項

- [ ] PaSoRi RC-S300 SDKの入手
- [ ] SDKのドキュメント確認
- [ ] 開発環境のセットアップ
- [ ] テスト用NFCタグの準備

## 📝 データフロー

### 顧客詳細ページでのNFC書き込みフロー

1. 顧客詳細ページを開く
2. 顧客の注文履歴から公開ページURLを取得
3. 「NFC書き込み」ボタンをクリック
4. ローカルNFCサーバーにリクエスト送信
5. PaSoRi RC-S300でNFCタグに書き込み
6. 成功時: `orders.nfc.written = true` を更新
7. 成功アナウンスを表示

## 🔒 セキュリティ考慮事項

1. **権限チェック**: すべてのCRMページで権限チェックを実施
2. **テナント分離**: テナントごとにデータを分離
3. **監査ログ**: NFC書き込み操作を記録
4. **データ保護**: 顧客情報の適切な保護
5. **ローカルサーバーのセキュリティ**: NFCサーバーはlocalhostのみでリッスン

## 📅 実装スケジュール（推奨）

1. **Week 1**: Phase 1（権限管理の強化）+ PaSoRi SDK調査
2. **Week 2**: Phase 2（顧客管理機能）
3. **Week 3**: Phase 3（注文管理機能）
4. **Week 4**: Phase 4（スタッフ管理機能）
5. **Week 5**: Phase 5（NFC書き込み機能）

## 🧪 テスト項目

1. **権限テスト**: 各ロールでのアクセス権限確認
2. **データ表示テスト**: 顧客・注文情報の正確な表示
3. **NFC書き込みテスト**: 実際のNFCタグでの書き込み確認
4. **エラーハンドリングテスト**: 各種エラーケースの確認
5. **ローカルサーバーテスト**: NFCサーバーの動作確認

## ⚠️ 重要な注意事項

### 1. PaSoRi RC-S300の制約

- **Web NFC APIは使用不可**: PaSoRi RC-S300はUSB接続のため、Web NFC APIは使用できません
- **ローカル環境が必要**: NFC書き込みにはローカルサーバーが必要です
- **プラットフォーム依存**: SDKが対応しているプラットフォームでのみ動作します

### 2. 権限管理

- **ロールの明確化**: 管理者、編集者、閲覧者の役割を明確に定義
- **権限の継承**: 上位ロールは下位ロールの権限をすべて持つ

### 3. テナント分離

- すべてのCRM機能でテナント分離を実施
- `getCurrentTenant()`を使用してテナントを取得
- Firestoreクエリに必ずテナントフィルタを追加

---

**作成日**: 2025-01-26  
**最終更新日**: 2025-01-26  
**バージョン**: 2.0

