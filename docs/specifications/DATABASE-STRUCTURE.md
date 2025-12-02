# データベース構造 - Firestoreコレクション一覧

## 📋 概要

このドキュメントは、公開ページと編集ページの情報がFirestoreのどこに保存されているかを説明します。

## 🗂️ 主要コレクション

### 1. `memories` コレクション（編集ページ情報）

**用途**: ユーザーが編集する想い出ページの情報を保存

**パス**: `memories/{memoryId}`

**主要フィールド**:
```typescript
{
  id: string;                    // メモリID
  ownerUid: string;              // 所有者のUID
  tenant: string;                // テナント名
  title: string;                 // タイトル
  description?: string;          // 説明文
  bio?: string;                  // プロフィール文
  status: 'draft' | 'published'; // ステータス
  publicPageId?: string;         // 公開ページID（公開時に設定）
  
  // 画像情報
  coverImage?: string;           // カバー画像URL
  coverImagePosition?: string;   // カバー画像の位置
  coverImageScale?: number;      // カバー画像のスケール
  profileImage?: string;         // プロフィール画像URL
  profileImagePosition?: string; // プロフィール画像の位置
  profileImageScale?: number;   // プロフィール画像のスケール
  
  // デザイン設定
  colors?: {
    accent: string;
    text: string;
    background: string;
  };
  fontSizes?: {
    title?: number;
    body?: number;
  };
  topicsTitle?: string;          // Topicsセクションのタイトル
  
  // コンテンツ
  blocks: MediaBlock[];          // メディアブロック（画像、動画、テキストなど）
  
  // ストレージ
  storageUsed?: number;          // ストレージ使用量（バイト）
  
  // メタデータ
  metadata?: {
    petName?: string;
    petType?: string;
    source?: string;
    lpId?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

**確認方法**:
- Firestoreコンソール: `memories`コレクションを開く
- ドキュメントIDが`memoryId`
- `ownerUid`でフィルタリング可能
- `tenant`でフィルタリング可能（管理者向け）

---

### 2. `publicPages` コレクション（公開ページ情報）

**用途**: 公開されている想い出ページの情報を保存

**パス**: `publicPages/{pageId}`

**主要フィールド**:
```typescript
{
  id: string;                    // 公開ページID（URLの`/public/{pageId}`部分）
  tenant: string;                // テナント名
  memoryId: string;              // 関連するメモリID（`memories`コレクションへの参照）
  title: string;                 // タイトル
  about?: string;                // 説明文
  
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
  coverImagePosition?: string;   // カバー画像の位置
  
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
  
  createdAt: Date;
  updatedAt: Date;
}
```

**確認方法**:
- Firestoreコンソール: `publicPages`コレクションを開く
- ドキュメントIDが`publicPageId`（URLの`/public/{pageId}`部分）
- `memoryId`で関連するメモリを検索可能
- `tenant`でフィルタリング可能

**URLとの関係**:
- 公開ページURL: `https://emolink-cms.web.app/public/{pageId}?tenant={tenant}`
- `pageId` = `publicPages`コレクションのドキュメントID

---

### 3. `claimRequests` コレクション（認証・URL情報）

**用途**: 認証リクエストと公開ページURL・ログインURLを保存

**パス**: `claimRequests/{requestId}`

**主要フィールド**:
```typescript
{
  id: string;                    // リクエストID
  email: string;                 // ユーザーのメールアドレス
  tenant: string;                // テナント名
  lpId: string;                  // LP ID
  status: 'pending' | 'sent' | 'claimed' | 'expired';
  
  // 認証情報
  link?: string;                 // 認証リンク（LP側で生成）
  secretKey?: string;            // 秘密鍵（LP側で生成）
  jwtToken?: string;             // JWTトークン
  
  // 公開ページ・ログイン情報（認証成功時に設定）
  publicPageId?: string;         // 公開ページID
  publicPageUrl?: string;        // 公開ページURL（NFCタグ用）
  loginUrl?: string;             // ログインページURL
  
  // 関連情報
  claimedByUid?: string;         // 認証したユーザーのUID
  memoryId?: string;             // 関連するメモリID
  claimedAt?: Date;              // 認証完了日時
  
  createdAt: Date;
  updatedAt: Date;
}
```

**確認方法**:
- Firestoreコンソール: `claimRequests`コレクションを開く
- `email`で検索可能
- `tenant`でフィルタリング可能
- `status: 'claimed'`で認証完了済みを検索可能

**URL取得方法**:
- APIエンドポイント: `GET /api/claim/{requestId}/urls`
- レスポンスに`publicPageUrl`と`loginUrl`が含まれる

---

## 🔗 コレクション間の関係

```
claimRequests (認証情報)
    ↓ (認証成功時)
    ├─→ memories (編集ページ) [memoryId]
    └─→ publicPages (公開ページ) [publicPageId]
            ↑
            └─→ memories.memoryId で関連付け
```

### データフロー

1. **認証成功時**:
   - `claimRequests`に`publicPageId`、`publicPageUrl`、`loginUrl`を保存
   - 空の`publicPages`ドキュメントを作成

2. **メモリ作成時**:
   - `memories`ドキュメントを作成
   - `publicPageId`はまだ設定されていない（空の公開ページが既に存在）

3. **メモリ保存時**:
   - `memories`ドキュメントを更新
   - `publicPages`ドキュメントを更新（`memoryId`で関連付け）

4. **公開時**:
   - `memories.status`を`'published'`に更新
   - `memories.publicPageId`を設定
   - `publicPages.publish.status`を`'published'`に更新

---

## 📊 確認方法（Firestoreコンソール）

### 編集ページ情報を確認する場合

1. **特定のユーザーのメモリを確認**:
   ```
   コレクション: memories
   フィルタ: ownerUid == "{ユーザーUID}"
   ソート: updatedAt (降順)
   ```

2. **特定のメモリIDで確認**:
   ```
   コレクション: memories
   ドキュメントID: {memoryId}
   ```

3. **公開済みメモリを確認**:
   ```
   コレクション: memories
   フィルタ: status == "published"
   ```

### 公開ページ情報を確認する場合

1. **特定の公開ページIDで確認**:
   ```
   コレクション: publicPages
   ドキュメントID: {publicPageId}
   ```
   ※ `publicPageId`はURLの`/public/{pageId}`部分

2. **特定のメモリに関連する公開ページを確認**:
   ```
   コレクション: publicPages
   フィルタ: memoryId == "{memoryId}"
   ```

3. **公開済みページを確認**:
   ```
   コレクション: publicPages
   フィルタ: publish.status == "published"
   ```

### 認証・URL情報を確認する場合

1. **特定のリクエストIDで確認**:
   ```
   コレクション: claimRequests
   ドキュメントID: {requestId}
   ```

2. **特定のメールアドレスで検索**:
   ```
   コレクション: claimRequests
   フィルタ: email == "{メールアドレス}"
   ```

3. **認証完了済みを確認**:
   ```
   コレクション: claimRequests
   フィルタ: status == "claimed"
   ```

4. **URLが生成済みのリクエストを確認**:
   ```
   コレクション: claimRequests
   フィルタ: publicPageUrl != null
   ```

---

## 🔍 よくある確認シナリオ

### シナリオ1: ユーザーが「編集ページが見つからない」と言っている場合

1. `claimRequests`でメールアドレスを検索
2. `claimedByUid`を確認
3. `memories`で`ownerUid == {claimedByUid}`で検索
4. メモリが存在するか確認

### シナリオ2: 公開ページが表示されない場合

1. `memories`で`publicPageId`を確認
2. `publicPages`で`publicPageId`のドキュメントを確認
3. `publish.status`が`'published'`か確認
4. `memoryId`が正しく関連付けられているか確認

### シナリオ3: NFCタグ用のURLを確認したい場合

1. `claimRequests`でメールアドレスまたは`requestId`を検索
2. `publicPageUrl`フィールドを確認
3. または、APIエンドポイント `GET /api/claim/{requestId}/urls` を呼び出し

### シナリオ4: ログインURLを確認したい場合

1. `claimRequests`でメールアドレスまたは`requestId`を検索
2. `loginUrl`フィールドを確認
3. または、APIエンドポイント `GET /api/claim/{requestId}/urls` を呼び出し

---

## 📝 注意事項

1. **テナント分離**: すべてのコレクションで`tenant`フィールドによる分離が行われています
2. **セキュリティ**: Firestore Rulesでテナント検証が行われています
3. **データ整合性**: `publicPages.memoryId`と`memories.id`が一致している必要があります
4. **URL生成**: `publicPageUrl`は認証成功時に自動生成されます

---

## 🔗 関連ドキュメント

- `PUBLIC-PAGE-URL-GENERATION.md` - 公開ページURL生成機能の詳細
- `ACCOUNT-CREATION-FLOW.md` - アカウント作成フローの詳細
- `MULTI-TENANT-ACCOUNT-MANAGEMENT.md` - マルチテナントアカウント管理の詳細

---

**最終更新日**: 2025-01-XX
**バージョン**: 1.0

