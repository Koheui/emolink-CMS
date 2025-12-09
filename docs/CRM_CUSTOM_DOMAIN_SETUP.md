# CRM別ドメイン運用設定ガイド

## 概要

CRMを別のドメインで運用するための設定手順です。現在のシステムはマルチテナント対応しており、複数のドメインから同じFirebaseプロジェクトにアクセスできます。

## 設定手順

### 1. ドメインの準備

CRM用のドメインを準備してください（例：`crm.example.com`）。

### 2. Firebase Hostingでカスタムドメインを追加

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/
   - `memorylink-cms`プロジェクトを選択

2. **Hostingセクションに移動**
   - 左側のメニューから「Hosting」をクリック

3. **カスタムドメインを追加**
   - 「カスタムドメイン」タブをクリック
   - 「ドメインを追加」をクリック
   - CRM用のドメインを入力（例：`crm.example.com`）

4. **DNS設定の確認**
   - Firebaseが提供するDNSレコードを確認
   - ドメイン管理画面でDNSレコードを設定

### 3. テナントマッピングの設定

`src/lib/security/tenant-validation.ts`の`ORIGIN_TENANT_MAP`に新しいドメインを追加します。

```typescript
export const ORIGIN_TENANT_MAP: { [origin: string]: { tenant: string; lpId: string } } = {
  // 既存の設定...
  
  // CRM用ドメイン（例）
  'https://crm.example.com': { tenant: 'crm-tenant', lpId: 'crm' },
  'https://www.crm.example.com': { tenant: 'crm-tenant', lpId: 'crm' },
  
  // 開発環境
  'http://localhost:3002': { tenant: 'crm-dev', lpId: 'crm-local' },
};
```

### 4. 環境変数の設定

`.env.production`または環境変数に以下を追加：

```bash
# CRM用ドメイン設定
NEXT_PUBLIC_CRM_DOMAIN=crm.example.com
NEXT_PUBLIC_APP_URL=https://crm.example.com
```

### 5. CORS設定の更新（必要に応じて）

Firebase FunctionsのCORS設定を更新する場合：

```bash
firebase functions:config:set cors.allowed_origins="https://emolink-cms.web.app,https://crm.example.com,https://emolink.net"
```

### 6. デプロイ

```bash
npm run build
firebase deploy --only hosting
```

## データ分離

### テナント分離の仕組み

- 各ドメインは`ORIGIN_TENANT_MAP`でテナントIDにマッピングされます
- データは`tenant`フィールドで分離されます
- 異なるテナントのデータは混在しません

### テナントIDの設定

CRM用のテナントIDを設定する場合：

1. Firestoreの`tenants`コレクションに新しいテナントを追加
2. `ORIGIN_TENANT_MAP`でドメインとテナントIDをマッピング

## 注意事項

### 1. 同一Firebaseプロジェクトの使用

- 複数のドメインから同じFirebaseプロジェクトにアクセス可能
- データはテナントIDで分離されるため、セキュリティが保たれます

### 2. SSL証明書

- Firebaseが自動的にSSL証明書を発行
- 設定完了まで数分〜数時間かかる場合があります

### 3. 認証の共有

- Firebase Authenticationは同一プロジェクト内で共有されます
- 異なるドメインからでも同じアカウントでログイン可能
- テナント情報は`tenant`フィールドで管理されます

## 確認方法

### 1. ドメインアクセスの確認

```bash
# CRMドメインでアクセス
curl https://crm.example.com

# レスポンスが返ってくることを確認
```

### 2. テナントマッピングの確認

ブラウザのコンソールで以下を確認：

```javascript
// 現在のテナント情報を確認
console.log('Current tenant:', getCurrentTenant());
```

### 3. データ分離の確認

Firestoreで以下を確認：

- `memories`コレクションの`tenant`フィールド
- `users`コレクションの`tenant`フィールド
- 異なるテナントのデータが混在していないこと

## トラブルシューティング

### ドメインが認識されない場合

1. `ORIGIN_TENANT_MAP`にドメインが追加されているか確認
2. プロトコル（`https://`）が正しく設定されているか確認
3. デプロイが完了しているか確認

### CORSエラーが発生する場合

1. Firebase FunctionsのCORS設定を確認
2. `cors.allowed_origins`に新しいドメインが含まれているか確認

### テナント情報が取得できない場合

1. `getCurrentTenant()`関数の動作を確認
2. `localStorage`や`sessionStorage`にテナント情報が保存されているか確認
3. Originベースのテナント取得が動作しているか確認



