# メール送信エラーの確認方法

## 問題
Cloud Runの環境変数を設定したにもかかわらず、メールが送信されない。

## 確認手順

### 1. Firebase Functionsのログを確認

#### 方法A: Firebase Consoleから確認
1. [Firebase Console](https://console.firebase.google.com/project/memorylink-cms/functions/logs) → Functions → ログ
2. 最新のログを確認し、以下を探す：
   - `🔍 Direct environment variable check in API route:`
   - `🔍 Environment variables check:`
   - `Gmail credentials check:`
   - `❌ Gmail credentials not found:`

#### 方法B: Cloud Run Consoleから確認
1. [Cloud Run Console](https://console.cloud.google.com/run/detail/asia-northeast1/ssremolinkcms/logs?project=memorylink-cms) → ログ
2. 最新のログを確認し、以下を探す：
   - `🔍 Direct environment variable check in API route:`
   - `🔍 Environment variables check:`
   - `Gmail credentials check:`

### 2. 確認すべきポイント

#### 環境変数が読み込まれている場合
ログに以下のように表示されるはずです：
```
🔍 Direct environment variable check in API route: {
  GMAIL_USER: 'emoli...',
  GMAIL_APP_PASSWORD: 'SET (hidden)',
  hasGmailUser: true,
  hasGmailAppPassword: true,
  allEnvKeysWithGmail: 'GMAIL_USER, GMAIL_APP_PASSWORD'
}
```

#### 環境変数が読み込まれていない場合
ログに以下のように表示されます：
```
🔍 Direct environment variable check in API route: {
  GMAIL_USER: 'NOT SET',
  GMAIL_APP_PASSWORD: 'NOT SET',
  hasGmailUser: false,
  hasGmailAppPassword: false,
  allEnvKeysWithGmail: 'NONE'
}
```

### 3. Cloud Runの環境変数設定を再確認

1. [Cloud Run Console](https://console.cloud.google.com/run/detail/asia-northeast1/ssremolinkcms?project=memorylink-cms)
2. 「編集とデプロイ」をクリック
3. 「変数とシークレット」タブを開く
4. 以下の環境変数が設定されているか確認：
   - `GMAIL_USER` = `emolink.guide@gmail.com`
   - `GMAIL_APP_PASSWORD` = `wiubgtzqlcsecbxw`
5. 設定されていない場合は追加し、「デプロイ」をクリック

### 4. 環境変数が設定されているのに読み込まれない場合

Cloud Runの環境変数は、新しいリビジョンがデプロイされたときにのみ反映されます。
- 環境変数を追加/変更した後、必ず「デプロイ」をクリックしてください
- デプロイが完了するまで数分かかる場合があります

### 5. デバッグログの確認

最新のデプロイでは、以下の詳細なログが出力されます：
- `🔍 Direct environment variable check in API route:` - APIルート内での直接的な環境変数チェック
- `🔍 Environment variables check:` - `getGmailCredentials()`関数内での環境変数チェック
- `Gmail credentials check:` - 最終的な認証情報の状態

これらのログを確認することで、環境変数がどの段階で読み込まれていないかを特定できます。



