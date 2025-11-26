# TODO-CMS-v2.2.md


## 📋 LP側の仕様まとめ（v2.2）


### 🎯 **概要**
このドキュメントは、LP（ランディングページ）側の実装完了を受けて、CMS（コンテンツ管理システム）側の開発に必要な仕様をまとめたものです。


**v2.2の主な変更点**:
- 動的テナント対応システムの実装
- 環境変数による完全な設定管理
- プロダクトタイプの環境変数対応


---


## 🏗️ **システム構成**


### **1. アーキテクチャ**
```
LP (emolink-lp.web.app) → Firebase Functions → CMS (emolink.net)
```


### **2. デプロイ状況**
- **LP**: https://emolink-lp.web.app ✅ 完了
- **Functions**: https://asia-northeast1-memorylink-cms.cloudfunctions.net ✅ 完了
- **CMS**: https://emolink.net/claim ⏳ 開発中


---


## 📧 **メール送信システム**


### **1. メール送信フロー**
1. **LPフォーム送信** → **Functions API** → **Firebase DB** → **メール送信**
2. **2つのメールが送信される**:
  - 確認メール（フォーム送信者向け）
  - 想い出ページ作成リンク（フォーム送信者向け）


### **2. メール内容（動的対応）**
- **ブランド名**: テナントに応じて動的に生成
- **プロダクト名**: プロダクトタイプに応じて動的に生成
- **確認メール件名**: "{ブランド名} - お申し込み確認"
- **リンクメール件名**: "{ブランド名} - {プロダクト名}のご案内"


### **3. メールリンクの形式**
```
https://emolink.net/claim?rid={requestId}&tenant={tenant}&lpId={lpId}&k={claimToken}
```


---


## 🔗 **CMS側で必要な実装**


### **1. クレームページ (`/claim`)**
- **URL**: `https://emolink.net/claim`
- **パラメータ**:
 - `rid`: リクエストID
 - `tenant`: テナントID
 - `lpId`: LP ID
 - `k`: JWTトークン（認証用）


### **2. 必要な機能**
1. **JWTトークン検証**: `k` パラメータの検証
2. **リクエスト検証**: `rid` でFirebase DBからリクエスト取得
3. **ステータス更新**: リクエストを "claimed" に更新
4. **想い出ページ作成フォーム**: ユーザーが想い出ページを作成
5. **テナント・プロダクトタイプ対応**: 動的に設定を適用


### **3. データベース連携**
- **Firebase Firestore**: `claimRequests` コレクション
- **ドキュメントID**: `rid`（リクエストID）
- **フィールド**:
 ```typescript
 {
   email: string,
   tenant: string,
   lpId: string,
   productType: string, // 新規追加
   source: "lp-form",
   status: "pending" | "sent" | "claimed" | "expired",
   emailHash: string,
   createdAt: Timestamp,
   updatedAt: Timestamp,
   sentAt?: Timestamp,
   claimedAt?: Timestamp
 }
 ```


---


## 🔧 **技術仕様**


### **1. Functions API**
- **エンドポイント**: `https://asia-northeast1-memorylink-cms.cloudfunctions.net/lpForm`
- **メソッド**: POST
- **Content-Type**: application/json
- **リクエスト形式**:
 ```json
 {
   "email": "user@example.com",
   "tenant": "futurestudio",
   "lpId": "emolink.cloud",
   "productType": "acrylic",
   "recaptchaToken": "token"
 }
 ```


### **2. 環境変数（v2.2で追加）**


**LP側（src/lp/.env）**:
```bash
VITE_TENANT_ID=futurestudio
VITE_LP_ID=emolink.cloud
VITE_PRODUCT_TYPE=acrylic
```


**Functions側**:
```bash
DEFAULT_TENANT=futurestudio
DEFAULT_LP_ID=emolink.cloud
TENANT_CONFIG_JSON={"petmem":{"allowedLpIds":["direct","partner1","partner2"],"enabledProductTypes":["acrylic","digital","premium"],"maxClaimRequestsPerHour":10},"futurestudio":{"allowedLpIds":["emolink.cloud","direct"],"enabledProductTypes":["acrylic","digital"],"maxClaimRequestsPerHour":15}}
```


### **3. 動的テナント対応（v2.2で実装）**


**サポートされるテナント**:
- `petmem`: PetMemory
- `futurestudio`: Future Studio
- `newcompany`: New Company
- その他: 自動的にテナント名をブランド名として使用


**サポートされるプロダクトタイプ**:
- `acrylic`: NFCタグ付きアクリルスタンド
- `digital`: デジタル想い出ページ
- `premium`: プレミアム想い出サービス
- `standard`: スタンダード想い出サービス


### **4. セキュリティ**
- **reCAPTCHA v3**: フォーム送信時の検証
- **JWTトークン**: メールリンクの認証
- **レート制限**: メールアドレス・IP別の制限
- **重複チェック**: 同一メールアドレスの重複送信防止


---


## 📊 **データフロー**


### **1. フォーム送信時**
```
LP → Functions → Firebase DB (status: "pending") → メール送信 → Firebase DB (status: "sent")
```


### **2. リンククリック時**
```
メールリンク → CMS → JWT検証 → リクエスト取得 → 想い出ページ作成 → Firebase DB (status: "claimed")
```


---


## 🎨 **UI/UX要件**


### **1. クレームページ**
- **レスポンシブデザイン**: モバイル・デスクトップ対応
- **ブランド統一**: テナントに応じたブランドカラー
- **ユーザビリティ**: 直感的な想い出ページ作成フォーム
- **プロダクトタイプ対応**: 選択されたプロダクトに応じたUI


### **2. エラーハンドリング**
- **無効なリンク**: 適切なエラーメッセージ表示
- **期限切れ**: 72時間の有効期限管理
- **重複使用**: 一度使用済みのリンクの処理


---


## 🔄 **運用・保守**


### **1. 監視**
- **Functions ログ**: Firebase Console で確認
- **メール送信状況**: Gmail SMTP の配信状況
- **エラー監視**: 自動エラー通知の設定


### **2. 拡張性（v2.2で改善）**
- **新しいテナント**: 環境変数 `TENANT_CONFIG_JSON` に追加
- **新しいLP**: LP側の環境変数で管理
- **新しい商品タイプ**: 環境変数に追加（コード変更不要）


---


## 📝 **開発チェックリスト**


### **CMS側で実装が必要な項目**
- [ ] JWTトークン検証機能
- [ ] Firebase Firestore 連携
- [ ] クレームページ (`/claim`) の実装
- [ ] 想い出ページ作成フォーム
- [ ] テナント・プロダクトタイプ対応
- [ ] エラーハンドリング
- [ ] レスポンシブデザイン
- [ ] 動的ブランド対応


### **テスト項目**
- [ ] メールリンクからの正常な遷移
- [ ] JWTトークンの検証
- [ ] 無効なリンクの処理
- [ ] 期限切れリンクの処理
- [ ] 重複使用の防止
- [ ] 想い出ページ作成の完了
- [ ] テナント別の設定適用
- [ ] プロダクトタイプ別の機能提供


---


## 📞 **連絡先・サポート**


### **技術的な質問**
- LP・Functions側: 現在の開発チーム
- CMS側: CMS開発チーム


### **緊急時対応**
- Functions の障害: Firebase Console でログ確認
- メール送信障害: Gmail SMTP の設定確認
- CMS側の障害: CMS開発チームに連絡


---


## 📅 **スケジュール**


### **完了済み**
- ✅ LP側の実装
- ✅ Functions側の実装
- ✅ メール送信システム
- ✅ Firebase Hosting へのデプロイ
- ✅ 動的テナント対応（v2.2）
- ✅ 環境変数による設定管理（v2.2）


### **進行中**
- ⏳ CMS側の開発
- ⏳ クレームページの実装
- ⏳ 想い出ページ作成フォーム


### **今後の予定**
- 📅 CMS側のテスト
- 📅 統合テスト
- 📅 本番リリース


---


## 🔄 **v2.1からの変更点**


### **新規追加**
1. **動的テナント対応**: 新しいテナントを自動的にサポート
2. **プロダクトタイプ対応**: 環境変数でプロダクトタイプを管理
3. **環境変数による設定管理**: コード変更なしで設定変更可能
4. **動的メール内容**: テナント・プロダクトタイプに応じたメール内容


### **改善点**
1. **拡張性の向上**: 新しいテナント・LPID・プロダクトタイプを簡単に追加
2. **保守性の向上**: 環境変数による一元管理
3. **柔軟性の向上**: 動的なブランド・プロダクト対応


---


**作成日**: 2025年9月4日 
**バージョン**: v2.2 
**作成者**: LP開発チーム





