# 🚀 次にやること：店舗エントリー機能の実装

**作成日**: 2025-10-15  
**ステータス**: 実装準備完了、コーディング開始前  
**所要時間**: 約2時間で完成予定

---

## 📌 現在の状況まとめ

### ✅ 完了していること
- CMSフロントエンド（Next.js）の基本構造は80%完成
- 認証システム（秘密鍵ベース）実装済み
- Firestore CRUD操作実装済み
- メール送信機能（Gmail SMTP）実装済み
- 型定義（TypeScript）完全実装済み

### ⚠️ 動いていないこと
- **Stripe Webhook → 秘密鍵メール送信** （TypeScriptビルド未完了、パス間違い）
- **店舗エントリーフォーム** （未実装）
- **Functions API全般** （ほぼ未実装）

---

## 🎯 今回実装すること：店舗エントリー機能

### 背景・要件
- **利用シーン**: 販売店の店舗で、スタッフが店頭で決済済みの顧客情報を入力
- **期待動作**: メールアドレスを入力 → 顧客に秘密鍵メールが届く → 顧客がログインして想い出編集

### システムフロー
```
店舗スタッフ（PC）
  ↓ 秘密鍵でCMSにログイン
  ↓
/admin/manual-entry で顧客情報入力
  ↓
Functions: 秘密鍵生成 + 注文作成 + メール送信
  ↓
顧客のメールボックスに届く
  ↓
顧客が秘密鍵でログイン
```

---

## 📋 実装タスク一覧（チェックリスト）

### **Phase 1: Functions 共通処理（30分）**

#### ファイル1: `functions/src/utils/secret-key-generator.ts`
```typescript
// secret-key-utils.ts を Functions 内にコピー
// 秘密鍵生成関数を実装
```
- [ ] ファイル作成
- [ ] `generateSecretKey()` 関数実装
- [ ] `validateSecretKeyFormat()` 関数実装

#### ファイル2: `functions/src/services/order-service.ts`
```typescript
// 注文作成 + 秘密鍵生成 + メール送信の共通処理
export async function createOrderAndSendSecretKey(data: {
  email: string;
  tenant: string;
  lpId: string;
  productType: string;
  source: 'stripe' | 'manual_entry';
  customerInfo?: {
    name?: string;
    phone?: string;
  };
  createdBy?: string; // 店舗スタッフのUID
})
```
- [ ] ファイル作成
- [ ] 秘密鍵生成
- [ ] Firestore `secretKeys` コレクションに保存
- [ ] Firestore `orders` コレクションに保存
- [ ] メール送信（既存の `sendSecretKeyEmail` 利用）
- [ ] 監査ログ記録

---

### **Phase 2: 店舗エントリーAPI（30分）**

#### ファイル3: `src/app/api/admin/manual-entry/route.ts`
```typescript
// POST /api/admin/manual-entry
// 店舗スタッフが顧客情報を登録するAPI
```
- [ ] ファイル作成
- [ ] 認証チェック（秘密鍵ベース）
- [ ] テナント検証（店舗スタッフのテナントを取得）
- [ ] lpId取得（スタッフの秘密鍵から自動取得）
- [ ] バリデーション（メールアドレス必須）
- [ ] Functions の `createOrderAndSendSecretKey` を呼び出し
- [ ] レスポンス返却

**注意点:**
- 現在の `secretKeys` コレクションには `lpId` フィールドがない
- 秘密鍵データ構造を拡張する必要あり

---

### **Phase 3: 店舗スタッフUI（45分）**

#### ファイル4: `src/app/admin/manual-entry/page.tsx`
```tsx
// 店舗エントリーフォーム画面
```
- [ ] ファイル作成
- [ ] 認証チェック（未ログインは `/` にリダイレクト）
- [ ] フォームUI実装（shadcn/ui）
  - [ ] メールアドレス入力
  - [ ] お名前入力（任意）
  - [ ] 電話番号入力（任意）
  - [ ] 商品タイプ選択（ドロップダウン）
- [ ] 現在の店舗情報表示（lpId、テナント名）
- [ ] 送信処理実装
- [ ] 成功・エラー表示
- [ ] ローディング状態

**画面イメージ:**
```
┌───────────────────────────────────┐
│ 店舗エントリーフォーム             │
│ 店舗: 渋谷店 (futurestudio-shibuya)│
├───────────────────────────────────┤
│ 顧客メールアドレス *               │
│ [___________________________]      │
│                                   │
│ お名前（任意）                    │
│ [___________________________]      │
│                                   │
│ 電話番号（任意）                  │
│ [___________________________]      │
│                                   │
│ 商品タイプ *                      │
│ [▼ アクリルスタンド              ]│
│                                   │
│ [登録してメール送信]               │
└───────────────────────────────────┘
```

---

### **Phase 4: テストデータ準備（15分）**

#### テスト用テナント秘密鍵の作成
Firebase Console または スクリプトで Firestore に直接書き込み：

```javascript
// collection: secretKeys
// document ID: TESTSTORE1234ABC

{
  secretKey: "TESTSTORE1234ABC",
  email: "staff-test@futurestudio.com",
  tenant: "futurestudio",
  lpId: "futurestudio-shibuya",
  storeName: "渋谷店（テスト）",
  role: "store_staff",
  status: "active",
  expiresAt: Timestamp(2026-12-31),
  createdAt: serverTimestamp()
}
```

- [ ] Firebase Console でテスト秘密鍵作成
- [ ] 秘密鍵でログインテスト
- [ ] ダッシュボード表示確認

---

### **Phase 5: 動作確認（15分）**

#### エンドツーエンドテスト
1. [ ] テスト秘密鍵 `TESTSTORE1234ABC` でログイン
2. [ ] `/admin/manual-entry` にアクセス
3. [ ] テストメールアドレスを入力（自分のメールなど）
4. [ ] 送信
5. [ ] メール受信確認
6. [ ] 顧客用秘密鍵でログイン
7. [ ] ダッシュボード表示確認

---

## 🔧 必要な修正・注意点

### 1. 秘密鍵データ構造の拡張
現在の `secretKeys` コレクションに以下を追加：
```typescript
{
  lpId: string,           // 店舗ID
  storeName?: string,     // 店舗名（表示用）
  role?: 'customer' | 'store_staff' | 'admin',
  customerInfo?: {        // 顧客情報（店舗スタッフ用秘密鍵には不要）
    name?: string,
    phone?: string
  }
}
```

### 2. Functions のビルド設定確認
```bash
cd functions
npm install
npm run build
```
- TypeScript → JavaScript コンパイルが必要
- `tsconfig.json` の設定確認

### 3. 環境変数の確認
```bash
# .env.local に必要な設定
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
```

---

## 📂 ファイル構成

```
emolink-cms/
├── functions/
│   └── src/
│       ├── utils/
│       │   └── secret-key-generator.ts  ← 新規作成
│       └── services/
│           └── order-service.ts         ← 新規作成
│
└── src/
    └── app/
        ├── api/
        │   └── admin/
        │       └── manual-entry/
        │           └── route.ts          ← 新規作成
        └── admin/
            └── manual-entry/
                └── page.tsx              ← 新規作成
```

---

## 🚀 開始コマンド

```bash
# 開発サーバー起動
npm run dev

# 別ターミナルで Functions エミュレーター
cd functions
npm run serve

# Firestore エミュレーター（必要に応じて）
firebase emulators:start --only firestore
```

---

## 💡 次回セッション開始時にやること

1. ✅ この TODO ファイルを開く
2. ✅ Phase 1 から順番に実装開始
3. ✅ チェックリストを埋めながら進める
4. ✅ 完了したら動作確認
5. ✅ 成功したらこのファイルを更新（完了日時を記録）

---

## 📞 困ったときの確認事項

- **Firestore 接続エラー** → `.env.local` の Firebase 設定を確認
- **メール送信失敗** → Gmail App Password の設定確認
- **型エラー** → `src/types/index.ts` で型定義を確認
- **認証エラー** → `secretKeys` コレクションのデータ構造を確認

---

**がんばってください！約2時間で完成します！** 🎉

