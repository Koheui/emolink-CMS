# 環境変数の設定とデプロイ手順

## 概要

Firebase HostingのFrameworks Backend（Cloud Run）では、`firebase.json`の`frameworksBackend.environmentVariables`が正しく反映されない場合があります。そのため、Cloud Runの環境変数を直接設定するスクリプトを作成しました。

## デプロイ手順

### 方法1: 自動スクリプトを使用（推奨）

```bash
npm run deploy:full
```

このコマンドは以下を実行します：
1. Firebase Functions ConfigからGmail認証情報を取得
2. Cloud Runの環境変数として設定
3. アプリケーションをビルド
4. Firebaseにデプロイ

### 方法2: 手動で環境変数を設定

```bash
# 1. 環境変数を設定
npm run set-env-vars

# 2. アプリケーションをビルドしてデプロイ
npm run build
firebase deploy --only hosting
```

### 方法3: gcloud CLIを直接使用

```bash
# GMAIL_USERを設定
gcloud run services update ssremolinkcms \
  --region=asia-northeast1 \
  --set-env-vars GMAIL_USER=emolink.guide@gmail.com \
  --project=memorylink-cms

# GMAIL_APP_PASSWORDを設定
gcloud run services update ssremolinkcms \
  --region=asia-northeast1 \
  --update-env-vars GMAIL_APP_PASSWORD=wiubgtzqlcsecbxw \
  --project=memorylink-cms
```

## 前提条件

- `gcloud` CLIがインストールされていること
- `gcloud` CLIで認証されていること
- Firebase Functions ConfigにGmail認証情報が設定されていること

## 確認方法

デプロイ後、Firebase Functionsのログで以下を確認してください：

```
✅ Gmail credentials loaded from environment variables
```

または

```
✅ Gmail credentials loaded from Firebase Functions Config (v1, fallback)
```

## トラブルシューティング

### gcloud CLIがインストールされていない場合

```bash
# macOS
brew install google-cloud-sdk

# 認証
gcloud auth login
gcloud config set project memorylink-cms
```

### 環境変数が設定されない場合

1. Cloud Run Consoleで直接確認：
   - [Cloud Run Console](https://console.cloud.google.com/run/detail/asia-northeast1/ssremolinkcms?project=memorylink-cms)
   - 「編集とデプロイ」→「変数とシークレット」タブ

2. スクリプトを手動で実行：
   ```bash
   node scripts/set-env-vars.js
   ```

## 注意事項

- 環境変数を設定した後、新しいリビジョンがデプロイされるまで数分かかる場合があります
- 環境変数の変更は、新しいリビジョンのデプロイ時にのみ反映されます



