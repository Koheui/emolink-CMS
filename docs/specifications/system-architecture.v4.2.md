# 想い出リンク - 全体設計 仕様書 v4.2 (Next.js/Electron版)
更新日: 2025-08-31

## 0. 目的 / ゴール
- NFC/QRから閲覧できる「想い出ページ」を、**買い切り・低ランニング**で提供する。
- BtoB(テナントLP) / BtoC(自社LP) を**安全に**CMSへ連携。
- 現場オペ（QR印刷・NFC書込・出荷）は**専用アプリ**に集約し、誤紐付けゼロを徹底。

---

## 1. 構成の全体像

[LP-Project(s) 静的] ----POST(HTTPS+reCAPTCHA+CORS)---> [CMS-Project Functions(API)]
│ │
│ ├── Firestore: claimRequests, orders, memories...
│ ├── Storage: deliver/ (公開ファイル)
│ └── Auth: メールリンク/Claims

[CMS Web App (Next.js)] --- Auth/Firestore/Storage/Web API ---> [CMS-Project]
- 編集/公開UI
- 管理(参照専用)

[NFC Writer (Electron)] --- Auth(ID Token) + API ---> [CMS-Project Functions(API)]
- QR一括PDF、NFC書込、梱包/出荷、監査

markdown
コードをコピーする

### 1.1 ドメイン
- LP群: `lp.example.com`, `lp.tenant-a.co.jp`（Firebase Hosting: LP専用プロジェクト）
- CMS編集: `https://app.example.com`（Next.js/CSR or SSR）
- 公開（静的）: `https://mem.example.com/p/{pageId}`
- Functions(API): `https://<region>-<cms-project>.cloudfunctions.net`

### 1.2 役割分担
- **LP**: 申込フォームのみ（静的/SDK不要）→ CMS API へPOST
- **CMS Web App (Next.js)**: サインイン/編集/公開、参照専用の軽管理
- **NFC Writer (Electron)**: QR発行、NFC書込、梱包/出荷の**実務専用**

---

## 2. 主要ユースフロー

### 2.1 LP → 申込 → メールリンク → 初回クレーム
1. ユーザーがLPでメール送信（reCAPTCHA v3）
2. **LP→CMS Functions** `/api/gate/lp-form`（CORS/Origin検証）
3. CMS: `claimRequests/{requestId}` 作成 → **Authメールリンク送信**（72h有効）
4. ユーザーがメールリンクで `app.example.com/claim` へ → ログイン完了
5. **owner割当 & memory新規作成** → 編集開始可能

### 2.2 編集 → 公開（静的化）
1. Next.js編集UIで assets/blocks を作成
2. 「公開」→ `/api/publish-page`  
   - 画像/動画を最適化して `deliver/publicPages/{pageId}/**` にコピー  
   - `manifest.json` 生成、`publicPages/{pageId}` 更新
3. `mem.example.com/p/{pageId}` をNFC/QRのリンク先に使用（CDN強キャッシュ）

### 2.3 現場オペ（NFC Writer）
1. Electronログイン（tenantAdmin / fulfillmentOperator）
2. `/api/admin/orders/list` で対象抽出
3. **QR一括PDF**（Storage生成→DL/印刷）
4. **NFC書込**：読取→視認→書込→再読取検証→`/api/admin/nfc/write-log`
5. 梱包/出荷 → `/api/admin/ship/pack|ship` で更新
6. すべての操作は `auditLogs` に記録

---

## 3. セキュリティ設計（多層防御）

### 3.1 LPの防御（BtoBの外部制作にも耐える）
- **Origin許可リスト**：Functionsは事前登録ドメインのみ許可
- **テナント解決はOriginで**：client送信の `tenantId/lpId/productType` は**無視**（サーバで強制）
- **厳格CORS**：`Allow-Origin`=単一ドメイン、`POST`のみ
- **reCAPTCHA v3** + **レート制限**（IP+Origin+Email）
- **監査**：`claimRequests` に `origin/ip/ua/score` を保存

### 3.2 Auth / Claims
- ロール: `superAdmin` / `tenantAdmin` / `fulfillmentOperator` / `user`
- `tenantAdmin` と `fulfillmentOperator` は **adminTenant** でテナント固定
- **メールリンク**（パスワードレス）を既定のサインイン

### 3.3 Firestore/Storage ルール（要旨）
- `orders/*`：**write禁止（クライアント）**、Functionsのみ更新
- `claimRequests/*`：管理者・Functionsのみ
- `memories/*`, `assets/*`：owner or admin のみ編集
- `deliver/*`：読み取り全許可、書き込みはFunctionsのみ
- App Check（本番）を Auth/Firestore/Storage/Functions に適用

---

## 4. データモデル（要約）

users/{uid}
email, displayName?, createdAt, updatedAt

invitations/{memoryId}
email, claimedByUid?, createdAt, updatedAt

memories/{memoryId}
ownerUid, title, type, status, publicPageId, coverAssetId?, profileAssetId?
description?, design{...}, blocks[...], createdAt, updatedAt

assets/{assetId}
memoryId, ownerUid, name, type(image|video|audio), storagePath, url, thumbnailUrl?, size, createdAt, updatedAt

publicPages/{pageId}
memoryId, title, about?, design{...}, media{...}, ordering, publish{status,version,publishedAt?}, access?, createdAt, updatedAt
publicPages/{pageId}/blocks/{blockId}
type, order, visibility, ... (album/video/audio/text)

orders/{orderId}
tenant, emailHash, memoryId, productType
status(draft|paid|nfcReady|shipped|delivered)
print{qrPrinted, printedAt?}
nfc{written, device?, operator?, writtenAt?, prevUrl?}
shipping{packed, packedAt?, shipped, shippedAt?, trackingNo?}
createdAt, updatedAt, audit{createdBy?, lastUpdatedBy?}

claimRequests/{requestId}
email, tenantId, lpId, origin, ip, ua, recaptchaScore, status(pending|sent|claimed|expired), createdAt, updatedAt

auditLogs/{yyyyMMdd}/{autoId}
actorUid?, action, target, payload, ts

markdown
コードをコピーする

---

## 5. API（Functions HTTPS）契約

### 5.1 公開系
- `POST /api/gate/lp-form`
  - 入: `{ email, recaptchaToken }`（tenant/lpはOriginから解決）
  - 出: `{ ok: true }`
- `POST /api/publish-page`（認可: owner/admin）

### 5.2 管理・現場系（NFC Writer専用）
- `GET /api/admin/orders/list?tenant=&status=&lpId=&from=&to=&limit=`
- `POST /api/admin/print/qr-batch`  
  - 入: `{ orderIds: string[] }` → 出: `{ ok, pdfPath }`
- `POST /api/admin/nfc/write-log`  
  - 入: `{ orderId, pageUrl, device, operator, verify:{before,after} }`
- `POST /api/admin/ship/pack` / `POST /api/admin/ship/ship`
  - 入: `{ orderId, trackingNo? }`

**共通**  
- 認証: `Authorization: Bearer <ID_TOKEN>`  
- 認可: `role` と `adminTenant` を検証  
- CORS: 許可ドメインのみ

---

## 6. Next.js CMS アプリ（実装指針）

### 6.1 技術
- Next.js 14 App Router
- Firebase Web SDK (Auth/Firestore/Storage)
- 状態管理: React Query or SWR
- 画像処理は Functions（sharp）

### 6.2 画面
- `/login`（メールリンク）
- `/dashboard`（自分の memories 一覧）
- `/memories/{id}`（ビジュアルエディタ）
- `/_admin`（参照専用：orders一覧/監査ログ）

### 6.3 環境変数（CMSフロント）
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_CLAIM_CONTINUE_URL=https://app.example.com/claim

yaml
コードをコピーする

---

## 7. LP（静的）仕様（抜粋 v1.1適用）
- SDK不要。フォーム→`/api/gate/lp-form` にPOST
- 環境変数（LP側）
VITE_CMS_API_BASE=https://<region>-<cms-project>.cloudfunctions.net
VITE_RECAPTCHA_SITE_KEY=...

markdown
コードをコピーする
- **Originでテナント判定**、client送信の `tenantId` は無視

---

## 8. NFC Writer（Electron）仕様（抜粋 v1.0適用）
- Electron + React / `nfc-pcsc`（ACR122U）
- 主要機能：注文一覧、QR一括PDF、NFC書込（再読取検証）、梱包/出荷
- 権限：`tenantAdmin` / `fulfillmentOperator`
- 監査：全操作を `auditLogs` に記録

---

## 9. コスト最適化
- 公開は**静的配信**＋CDN長期キャッシュ（画像/動画はimmutable）
- 画像1600px/サムネ400px、動画は720p推奨
- **原本は30日で削除**（Cloud Scheduler）
- 長尺動画は Vimeo など外部CDNにオフロード（削除は慎重、ローカルHDDにバックアップポリシー）

---

## 10. 運用 / 監査 / エクスポート
- App Check 本番有効化
- `auditLogs` に主要イベント（gate.accepted/claim.sent/publish/nfc.write/ship.shipped）
- **Google Sheets連携（CRON）**：未投稿ユーザーや注文ダイジェストを自動出力
- 公開 `deliver/` の ZIP化ワンクリDL（エクスポート）

---

## 11. デプロイ / 設定チェックリスト

### CMS-Project
- [ ] Auth: Emailリンク有効、承認ドメインに `app.example.com`
- [ ] Functions: CORS許可に**LPの本番ドメイン**を登録（stgはweb.app）
- [ ] 環境変数: `RECAPTCHA_SECRET`, `CORS_ALLOWED_ORIGINS`, `APP_CLAIM_CONTINUE_URL`, `MAIL_*`
- [ ] Hosting: `app.example.com`, `mem.example.com`（ヘッダでキャッシュ制御）
- [ ] Rules: `orders/*` クライアントwrite禁止、deliver書込はFunctionsのみ
- [ ] App Check: 本番有効

### LP-Project(s)
- [ ] Hosting有効（デフォルトドメイン→独自に切替）
- [ ] `.env` に `VITE_CMS_API_BASE`, `VITE_RECAPTCHA_SITE_KEY`
- [ ] フォームから CMS `/api/gate/lp-form` 疎通
- [ ] reCAPTCHA 動作確認

### NFC Writer
- [ ] Electron ビルド（Win/Mac）
- [ ] ログイン→IDトークンで API 呼び出し成功
- [ ] ACR122U 認識・読取/書込/再読取検証OK
- [ ] 監査ログが記録される

---

## 12. リスクと対策
- **外部LPの改ざん**：Origin判定＋CORS＋reCAPTCHA＋レート制限＋監査で防御
- **NFC誤書込**：上書き禁止（異URL検出時は拒否/二段承認）、再読取検証必須
- **動画CDN仕様変更**：外部CDNに依存しすぎない運用、ローカルHDDバックアップ
- **AIコーディング暴走**：Gitブランチ戦略＋PRレビュー＋タグでバージョン固定

---

## 付録A. ブランチ/タグ運用（簡易）
- ブランチ: `feat/nfc-writer`, `fix/auth-link`, `chore/deploy`
- リリースタグ: `cms-v3.3.0`, `nfc-writer-v1.0.0`, `lp-v1.1.0`
- デプロイはタグ基準（CIで `--only hosting,functions`）