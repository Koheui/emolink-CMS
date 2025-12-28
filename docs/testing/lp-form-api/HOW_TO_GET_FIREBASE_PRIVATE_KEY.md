# FIREBASE_PRIVATE_KEYの取得方法

## 📋 概要

Firebase Admin SDKを使用するために必要な`FIREBASE_PRIVATE_KEY`の取得方法を説明します。

## 🔍 取得手順

### ステップ1: Firebase Consoleにアクセス

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. ログイン（必要に応じて）
3. 対象のプロジェクトを選択

### ステップ2: プロジェクト設定を開く

1. プロジェクトの左上にある**⚙️（歯車アイコン）**をクリック
2. 「**プロジェクトの設定**」を選択

### ステップ3: サービスアカウントタブを開く

1. 設定ページの上部メニューから「**サービスアカウント**」タブをクリック
2. または、左サイドバーから「**サービスアカウント**」を選択

### ステップ4: サービスアカウントキーを生成

1. 「**新しい秘密鍵の生成**」ボタンをクリック
2. 確認ダイアログが表示されるので、「**キーを生成**」をクリック
3. JSONファイルが自動的にダウンロードされます

**ファイル名の例**: `your-project-firebase-adminsdk-xxxxx-xxxxxxxxxx.json`

### ステップ5: JSONファイルから値を取得

ダウンロードしたJSONファイルを開くと、以下のような内容が含まれています：

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com"
}
```

### ステップ6: 環境変数に設定

JSONファイルから以下の3つの値を取得して、Vercelダッシュボードの環境変数に設定します：

#### 1. FIREBASE_PROJECT_ID
```json
"project_id": "your-project-id"
```
→ `FIREBASE_PROJECT_ID=your-project-id`

#### 2. FIREBASE_PRIVATE_KEY
```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```
→ `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"`

**重要**: 
- 値全体を**ダブルクォート（`"`）で囲む**必要があります
- `\n`は改行文字として扱われます（そのまま`\n`と入力してください）

#### 3. FIREBASE_CLIENT_EMAIL
```json
"client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
```
→ `FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`

## 📸 スクリーンショット付きの手順

### Firebase Consoleでの操作

1. **プロジェクト設定を開く**
   ```
   Firebase Console → プロジェクト選択 → ⚙️ → プロジェクトの設定
   ```

2. **サービスアカウントタブを開く**
   ```
   設定ページ → サービスアカウントタブ
   ```

3. **新しい秘密鍵を生成**
   ```
   「新しい秘密鍵の生成」ボタンをクリック → 「キーを生成」をクリック
   ```

## 🔒 セキュリティに関する注意

### ⚠️ 重要な注意事項

1. **JSONファイルは機密情報です**
   - リポジトリにコミットしないでください
   - `.gitignore`に追加されていることを確認してください
   - 他人と共有しないでください

2. **Vercelでの設定**
   - Vercelダッシュボードで「**Secret**」として設定してください
   - これにより、ログに表示されなくなります

3. **定期的なローテーション**
   - 定期的にサービスアカウントキーを再生成することを推奨します
   - 古いキーは削除してください

## 🧪 動作確認

### 環境変数が正しく設定されているか確認

Vercelダッシュボードで：
1. プロジェクトを選択
2. 「Settings」→「Environment Variables」を開く
3. 以下の3つの環境変数が設定されているか確認：
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`（Secretとして設定）
   - `FIREBASE_CLIENT_EMAIL`

### ローカル環境での確認

`.env.local`ファイルに設定して、ローカルで動作確認することもできます：

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

## 📝 トラブルシューティング

### 問題1: 環境変数が読み込まれない

**原因**: Vercel環境では、環境変数を設定した後、再デプロイが必要です。

**対処**:
1. 環境変数を設定
2. プロジェクトを再デプロイ
3. ログを確認

### 問題2: 認証エラーが発生する

**原因**: `FIREBASE_PRIVATE_KEY`の値が正しく設定されていない可能性があります。

**対処**:
1. JSONファイルから`private_key`の値を正確にコピー
2. ダブルクォートで囲む
3. `\n`が正しく含まれているか確認

### 問題3: 改行文字が正しく処理されない

**原因**: Vercelダッシュボードで改行文字（`\n`）が正しく設定されていない可能性があります。

**対処**:
1. JSONファイルから`private_key`の値をコピー
2. そのままVercelダッシュボードに貼り付け
3. ダブルクォートで囲む

## 🔗 関連リンク

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Admin SDK ドキュメント](https://firebase.google.com/docs/admin/setup)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## 📋 チェックリスト

- [ ] Firebase Consoleにアクセス
- [ ] プロジェクト設定を開く
- [ ] サービスアカウントタブを開く
- [ ] 新しい秘密鍵を生成
- [ ] JSONファイルをダウンロード
- [ ] `FIREBASE_PROJECT_ID`を取得
- [ ] `FIREBASE_PRIVATE_KEY`を取得
- [ ] `FIREBASE_CLIENT_EMAIL`を取得
- [ ] Vercelダッシュボードで環境変数を設定
- [ ] 再デプロイ
- [ ] 動作確認

---

*作成日時: 2025年1月*

