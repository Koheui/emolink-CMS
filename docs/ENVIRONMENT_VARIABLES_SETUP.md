# 環境変数の設定方法

## 問題
`firebase.json`の`frameworksBackend.environmentVariables`がCloud Runに正しく反映されていない可能性があります。

## 確認方法

### 1. Firebase Consoleから確認
1. [Firebase Console](https://console.firebase.google.com/project/memorylink-cms/functions) → Functions
2. `ssremolinkcms` 関数を選択
3. 「環境変数」タブで以下が設定されているか確認：
   - `GMAIL_USER`: `emolink.guide@gmail.com`
   - `GMAIL_APP_PASSWORD`: `wiubgtzqlcsecbxw`

### 2. Cloud Run Consoleから確認・設定
1. [Cloud Run Console](https://console.cloud.google.com/run/detail/asia-northeast1/ssremolinkcms?project=memorylink-cms)
2. 「編集とデプロイ」をクリック
3. 「変数とシークレット」タブを開く
4. 以下の環境変数を追加：
   - `GMAIL_USER` = `emolink.guide@gmail.com`
   - `GMAIL_APP_PASSWORD` = `wiubgtzqlcsecbxw`
5. 「デプロイ」をクリック

### 3. ログで確認
Firebase Functionsのログで以下を確認：
- `🔍 Environment variables check:` のログで `hasGmailUser` と `hasGmailAppPassword` が `true` になっているか
- `allEnvKeys` に `GMAIL_USER` や `GMAIL_APP_PASSWORD` が含まれているか

## 現在の設定
- `firebase.json`の`frameworksBackend.environmentVariables`に設定済み
- Firebase Functions Configにも設定済み（v7では非推奨）

## 推奨される解決方法
Cloud Run Consoleから直接環境変数を設定することを推奨します。













