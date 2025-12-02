# 🚀 CMS連携実装計画

## 📋 現状分析

### ✅ 完了済み機能
- **店舗エントリー機能**: 完全実装・本番稼働中
- **権限ベース認証**: 管理者・店長・スタッフの3段階権限
- **顧客情報入力**: 店舗選択・確認モーダル・API連携
- **注文成功後のUI**: TOPに戻るボタン・続けて入力ボタン

### 🔧 既存CMSシステム
- **CMS URL**: `https://memorylink-cms.web.app`
- **認証方式**: 秘密鍵認証（JWTトークン）
- **API エンドポイント**: `/api/gate/lp-form`
- **テスト用claimリンク生成**: `scripts/generate-test-claim-link.js`

## 🎯 CMS連携の実装計画

### Phase 1: メール送信機能の有効化
**目標**: 顧客情報入力後にCMS用のclaimリンクを送信

#### 1.1 メール送信機能の修正
```typescript
// functions/src/api/admin.ts
export async function handleManualEntry(req: Request, res: Response): Promise<void> {
  // 現在: メール送信エラーを無視
  // 修正: 実際にメール送信を実行
}
```

#### 1.2 環境変数の設定
```bash
# Gmail SMTP設定
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
JWT_SECRET=your-jwt-secret
APP_CLAIM_CONTINUE_URL=https://memorylink-cms.web.app/claim
```

#### 1.3 メール送信のテスト
- テスト用claimリンク生成スクリプトの活用
- 実際のメール送信の動作確認

### Phase 2: CMS連携の完全実装
**目標**: 店舗エントリー → CMS認証 → 想い出ページ作成の完全フロー

#### 2.1 データフロー設計
```
店舗スタッフ（PC）
  ↓ 顧客情報入力
  ↓
/apiV2/api/admin/manual-entry
  ↓
Functions: 注文作成 + 秘密鍵生成 + メール送信
  ↓
顧客のメールボックスに届く
  ↓
顧客が秘密鍵でCMSにログイン
  ↓
CMS: 想い出ページ作成
```

#### 2.2 API連携の実装
```typescript
// 店舗エントリー → CMS連携
const cmsData = {
  email: customerEmail,
  tenant: companyId,
  lpId: `${companyId}-main`,
  productType: 'emolink',
  customerInfo: {
    name: customerName
  }
};

// CMS API呼び出し
const cmsResponse = await fetch('https://memorylink-cms.cloudfunctions.net/api/gate/lp-form', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cmsData)
});
```

#### 2.3 エラーハンドリング
- メール送信失敗時の処理
- CMS API連携失敗時の処理
- ユーザーフレンドリーなエラーメッセージ

### Phase 3: 運用改善
**目標**: 本格運用に向けた改善

#### 3.1 監査ログ
- 顧客情報入力のログ記録
- メール送信のログ記録
- CMS連携のログ記録

#### 3.2 管理機能
- 送信履歴の確認
- エラー状況の監視
- 統計情報の表示

#### 3.3 セキュリティ強化
- CORS設定の最適化
- レート制限の実装
- 入力値の検証強化

## 🔧 実装手順

### Step 1: メール送信機能の修正
1. `functions/src/api/admin.ts`のメール送信部分を修正
2. 環境変数の設定
3. テスト用claimリンクでの動作確認

### Step 2: CMS API連携の実装
1. CMS APIエンドポイントの確認
2. データ形式の統一
3. エラーハンドリングの実装

### Step 3: 統合テスト
1. 店舗エントリー → メール送信 → CMS認証のフロー
2. エラーケースのテスト
3. パフォーマンステスト

### Step 4: 本番デプロイ
1. 環境変数の本番設定
2. 段階的デプロイ
3. 監視・ログ設定

## 📊 成功指標

### 技術指標
- **メール送信成功率**: >95%
- **CMS連携成功率**: >95%
- **API応答時間**: <2秒
- **エラー率**: <5%

### 運用指標
- **顧客満足度**: メール受信からCMSアクセスまで<5分
- **スタッフ効率**: 顧客情報入力時間<2分
- **システム安定性**: ダウンタイム<1%

## 🚨 リスクと対策

### リスク1: メール送信失敗
**対策**: 
- 複数のメール送信方法の準備
- 失敗時の再送機能
- 手動送信のフォールバック

### リスク2: CMS API連携失敗
**対策**:
- API呼び出しのリトライ機能
- エラー時の詳細ログ
- 手動でのCMS連携機能

### リスク3: セキュリティ問題
**対策**:
- 入力値の厳密な検証
- CORS設定の最適化
- レート制限の実装

## 📅 スケジュール

### Week 1: メール送信機能の修正
- 環境変数設定
- メール送信機能の修正
- テスト用claimリンクでの動作確認

### Week 2: CMS API連携の実装
- CMS APIエンドポイントの確認
- データ形式の統一
- エラーハンドリングの実装

### Week 3: 統合テスト
- エンドツーエンドテスト
- エラーケースのテスト
- パフォーマンステスト

### Week 4: 本番デプロイ
- 本番環境でのテスト
- 段階的デプロイ
- 監視・ログ設定

## 🔗 関連ファイル

### 既存ファイル
- `functions/src/api/admin.ts`: 店舗エントリーAPI
- `functions/src/services/order-service.ts`: 注文サービス
- `functions/src/utils/email.ts`: メール送信
- `scripts/generate-test-claim-link.js`: テスト用claimリンク生成

### 新規作成予定
- `functions/src/api/cms-integration.ts`: CMS連携API
- `functions/src/utils/cms-client.ts`: CMS クライアント
- `docs/CMS_INTEGRATION_TEST_REPORT.md`: テストレポート

## 📝 次のアクション

1. **メール送信機能の修正** (最優先)
2. **環境変数の設定**
3. **テスト用claimリンクでの動作確認**
4. **CMS API連携の実装**

---

**作成日**: 2025-10-25  
**更新日**: 2025-10-25  
**ステータス**: 📋 計画完了
