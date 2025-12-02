# URL生成の問題点と修正案

## 🚨 問題点

### 現在の実装

1. **公開ページURLの生成** (`password-setup-form.tsx`)
   ```typescript
   const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app';
   const publicPageUrl = generatePublicPageUrl(publicPageId, tenant, baseUrl);
   const loginUrl = `${baseUrl}/memories/create`;
   ```

2. **問題**:
   - `window.location.origin`を使用しているため、**ユーザーがアクセスしたドメインに依存**する
   - 例: `localhost:3000`からアクセスした場合、URLが`http://localhost:3000/...`になる
   - NFCタグに入力するURLは**固定である必要がある**

### 影響範囲

- **公開ページURL**: NFCタグに入力するURLが、アクセスしたドメインによって異なる
- **ログインURL**: メールに記載するURLが、アクセスしたドメインによって異なる
- **一貫性**: 同じアカウントでも、異なるドメインからアクセスすると異なるURLが生成される

---

## ✅ 修正案

### 1. 環境変数の設定

`env.example`と`env.production.example`に以下を追加：

```env
# アプリケーションのベースURL（固定ドメイン）
NEXT_PUBLIC_APP_URL=https://emolink-cms.web.app
```

### 2. URL生成の修正

`password-setup-form.tsx`を修正：

```typescript
// 修正前
const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app';

// 修正後
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app');
```

### 3. `generatePublicPageUrl`関数の確認

`src/lib/utils.ts`の`generatePublicPageUrl`関数は既に`process.env.NEXT_PUBLIC_APP_URL`を使用しているが、デフォルト値が`'https://emolink.cloud'`になっている。これを修正：

```typescript
// 修正前
const url = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://emolink.cloud';

// 修正後
const url = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://emolink-cms.web.app';
```

---

## 📝 実装手順

1. **環境変数の追加**
   - `env.example`に`NEXT_PUBLIC_APP_URL`を追加
   - 本番環境の`.env.local`またはFirebase Hostingの環境変数に設定

2. **コードの修正**
   - `password-setup-form.tsx`の`baseUrl`生成ロジックを修正
   - `src/lib/utils.ts`のデフォルト値を修正

3. **テスト**
   - 異なるドメインからアクセスして、URLが固定されていることを確認
   - NFCタグに入力するURLが正しいことを確認

---

## ⚠️ 注意事項

1. **環境変数の設定**
   - 開発環境: `http://localhost:3000`（開発用）
   - 本番環境: `https://emolink-cms.web.app`（固定）

2. **フォールバック**
   - 環境変数が設定されていない場合、`window.location.origin`を使用（開発環境用）

3. **カスタムドメイン**
   - カスタムドメインを使用する場合は、`NEXT_PUBLIC_APP_URL`をカスタムドメインに設定

---

**最終更新日**: 2025年1月  
**バージョン**: 1.0

