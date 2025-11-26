自社用LP 仕様書 v1.0（ペット向け直販サービス）
0. 概要

目的：
ペットとの想い出を残すための「NFCタグ付きアクリルスタンド」と「想い出ページ」を提供。
ユーザーは LP からメールを送信 → パスワードレス認証でサインアップ → 想い出ページを作成 → 制作・発送。

技術：

フロント：静的HTML/CSS/JS（スマホ最適、Firebase Hosting）

バックエンド：Firebase Functions（CORS＋reCAPTCHA＋メールリンク発行）

認証：Firebase Auth（Emailリンク / パスワードレス）

配信：Firebase Hosting（CDN強キャッシュ）、Firestore/Storage/Functions

ドメイン：lp.example.com（自社用LP）

1. UI構成（スマホ中心）

メニュー（固定ナビゲーション）

ヒーローセクション（背景固定・キャッチコピー・CTAボタン）

サービス紹介セクション（想い出ページ・アクリルスタンド・QR同梱）

オーダーフロー（ステップ表示）

プライスセクション（料金表示、買い切り強調）

申し込みフォーム（Email入力＋hiddenフィールド）

フッター（会社情報・著作権）

デザイン要件

背景写真は固定、中央部のみスクロール。

カード風デザイン（丸み・シャドウ）、シンプル＆信頼感。

CTAボタンはブランドカラー（例：青系）で統一。

2. 申し込みフォーム仕様

項目：

email（必須）

hidden: tenant=petmem, lpId=direct, productType=acrylic

バリデーション：HTML5 + reCAPTCHA v3

アクション：Functions /api/gate/lp-form に JSON POST

成功：

「送信しました。メールをご確認ください。」表示

フォームリセット

失敗：

エラーメッセージ表示（CORS/reCAPTCHA/メール送信失敗など）

3. バックエンド仕様（Functions）
3.1 APIエンドポイント /api/gate/lp-form

入力：

{
  "email": "user@example.com",
  "tenant": "petmem",
  "lpId": "direct",
  "productType": "acrylic",
  "recaptchaToken": "..."
}


処理フロー：

reCAPTCHA v3 検証（Google API + secret）

Firestore claimRequests/{requestId} に保存

email, tenant, lpId, productType, status="pending"

JWT生成（72h有効、sub=requestId, email）

Firebase Auth の Emailリンクを生成

continueUrl=https://app.example.com/claim?k=<jwt>

Send（Authメールテンプレートを使用）

Firestore更新：status="sent"、sentAt

出力：

{ "ok": true, "message": "Mail sent" }

3.2 セキュリティ

CORS：https://lp.example.com のみ許可

reCAPTCHA：v3スコア 0.5未満は拒否

レート制限：同一emailへの新規発行は1時間に1回まで

4. Firebase コンソール設定

Auth：

サインイン方法：Emailリンク有効化

承認済みドメイン：app.example.com

continueUrl：https://app.example.com/claim

Functions 環境変数：

RECAPTCHA_SECRET

APP_CLAIM_CONTINUE_URL=https://app.example.com/claim

CORS_ALLOWED_ORIGINS=https://lp.example.com

Hosting：

lp-example-com サイトを作成

public: lp_dist

App Check：不要（LPは Functions 直POST のみ）

5. ユーザーフロー（BtoC）

ユーザーが LP のフォームにメールを入力して送信

Functionsが reCAPTCHA検証→Firestoreに保存→メールリンク送信

ユーザーがメールのボタンをクリック→/claimへ遷移

Firebase Authでサインアップ→memory自動発行

ユーザーは想い出ページを編集・公開

運営がアクリルスタンドを制作→NFC/QR同梱→発送

6. 同梱物（必須）

NFCタグ付きアクリルスタンド

QRコード＋短縮URLを印刷した用紙
→ NFC不調時もアクセス可能にするため

7. 運用・拡張

監査ログ：auditLogs/{yyyyMMdd}/items/{id} に lpForm.sent を記録

将来拡張：Stripe決済フローを追加（決済完了後に claimRequests 生成）

テナントLP派生：lpId パラメータで差別化、同じ API を共用