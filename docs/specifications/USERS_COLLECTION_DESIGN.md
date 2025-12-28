# usersコレクションの設計について

## 現状の問題点

現在、`users`コレクションには以下の2種類のユーザーが混在しています：

1. **エンドユーザー（顧客）**: `role: 'user'` - 想い出ページを作成・管理する顧客
2. **管理者（店舗スタッフ）**: 
   - `role: 'tenantAdmin'` - テナント管理者
   - `role: 'superAdmin'` - スーパー管理者
   - `role: 'fulfillmentOperator'` - フルフィルメントオペレーター

## 設計の選択肢

### 選択肢1: 現在の設計を維持（推奨）

**メリット**:
- 実装がシンプル（1つのコレクションで管理）
- Firebase AuthのUIDを直接ドキュメントIDとして使用可能
- `role`フィールドで明確に区別可能
- クエリでフィルタリング可能

**デメリット**:
- エンドユーザーと管理者が同じコレクションに混在
- ドキュメントの説明と実装が不一致

**実装方法**:
```typescript
// エンドユーザーのみ取得
const q = query(
  usersCollection,
  where('role', '==', 'user'),
  where('tenant', '==', tenant)
);

// 管理者のみ取得
const q = query(
  usersCollection,
  where('role', 'in', ['tenantAdmin', 'superAdmin', 'fulfillmentOperator']),
  where('adminTenant', '==', tenant)
);
```

### 選択肢2: コレクションを分離

**メリット**:
- データの役割が明確
- セキュリティルールがシンプル
- クエリが高速（インデックスが効率的）

**デメリット**:
- 実装が複雑（2つのコレクションを管理）
- マイグレーションが必要
- Firebase AuthのUIDを直接使用できない可能性

**実装方法**:
```typescript
// エンドユーザー: users/{uid}
users/{uid}: {
  uid: string;
  email: string;
  displayName?: string;
  tenant: string;
  createdAt: Date;
  updatedAt: Date;
}

// 管理者: admins/{uid}
admins/{uid}: {
  uid: string;
  email: string;
  displayName?: string;
  role: 'tenantAdmin' | 'superAdmin' | 'fulfillmentOperator';
  adminTenant: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 推奨事項

**現在の設計（選択肢1）を維持することを推奨します。**

理由：
1. 既存の実装が動作している
2. `role`フィールドで明確に区別可能
3. クエリで適切にフィルタリング可能
4. マイグレーションのコストが高い

ただし、以下の改善を推奨します：

1. **ドキュメントの更新**: `CRM_DATABASE_STRUCTURE.md`の説明を実装に合わせて更新
2. **クエリの明確化**: エンドユーザーと管理者を取得する際は、必ず`role`フィールドでフィルタリング
3. **セキュリティルールの強化**: `role`に基づいた適切なアクセス制御

## クエリのベストプラクティス

### エンドユーザー（顧客）を取得する場合
```typescript
// ✅ 推奨: roleでフィルタリング
const q = query(
  usersCollection,
  where('role', '==', 'user'), // または where('role', '==', undefined)
  where('tenant', '==', tenant),
  orderBy('createdAt', 'desc')
);
```

### 管理者を取得する場合
```typescript
// ✅ 推奨: roleでフィルタリング
const q = query(
  usersCollection,
  where('role', 'in', ['tenantAdmin', 'superAdmin', 'fulfillmentOperator']),
  where('adminTenant', '==', tenant),
  orderBy('createdAt', 'desc')
);
```

### 全ユーザーを取得する場合（管理者画面など）
```typescript
// ⚠️ 注意: 用途に応じてフィルタリング
const q = query(
  usersCollection,
  where('tenant', '==', tenant), // または adminTenant
  orderBy('createdAt', 'desc')
);
```

## セキュリティ上の注意

1. **エンドユーザー一覧**: `role: 'user'`でフィルタリングして表示
2. **管理者一覧**: `role`が管理者のもののみ表示
3. **アクセス制御**: `role`に基づいた適切な権限チェックを実装
















