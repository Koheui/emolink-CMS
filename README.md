# CMS v4.2

NFC/QRコードで閲覧できる想い出ページを管理するCMSシステムです。

## 機能

- **メールリンク認証**: パスワードレスで安全なログイン
- **想い出ページ作成**: 画像、動画、テキストを含むリッチなコンテンツ作成
- **公開管理**: 静的ページとして公開、CDN配信
- **NFC/QR対応**: NFCタグ書き込みとQRコード生成
- **管理機能**: 注文管理、監査ログ、エクスポート

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router)
- **認証**: Firebase Authentication
- **データベース**: Firestore
- **ストレージ**: Firebase Storage
- **状態管理**: React Query
- **UI**: Tailwind CSS + shadcn/ui
- **型安全性**: TypeScript

## セットアップ

### 0. Node.jsのバージョン確認

このプロジェクトはNode.js 20以上が必要です。

**nvmを使用している場合：**
```bash
nvm use
# または
nvm install 20
nvm use 20
```

**nvmを使用していない場合：**
```bash
node --version  # v20.0.0以上であることを確認
```

Node.js 20がインストールされていない場合は、[Node.js公式サイト](https://nodejs.org/)からインストールしてください。

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`env.example`をコピーして`.env.local`を作成し、Firebase設定を入力してください：

```bash
cp env.example .env.local
```

必要な環境変数：
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_CLAIM_CONTINUE_URL`

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## プロジェクト構造

```
src/
├── app/                    # Next.js App Router
│   ├── login/             # ログインページ
│   ├── claim/             # メールリンク認証
│   ├── dashboard/         # ダッシュボード
│   └── memories/          # 想い出編集
├── components/            # 再利用可能なコンポーネント
│   └── ui/               # shadcn/uiコンポーネント
├── contexts/             # React Context
├── lib/                  # ユーティリティ関数
├── providers/            # プロバイダーコンポーネント
└── types/                # TypeScript型定義
```

## 主要なユースフロー

### 1. ユーザー登録・ログイン
1. LPでメールアドレス入力
2. メールリンクでCMSにアクセス
3. 初回は想い出ページが自動作成

### 2. 想い出ページ作成
1. ダッシュボードで新規作成
2. 画像・動画・テキストを追加
3. デザインをカスタマイズ
4. 公開設定

### 3. 公開・配信
1. 静的ページとして生成
2. CDNで配信
3. NFC/QRコードでアクセス可能

## 開発

### コマンド

```bash
# 開発サーバー
npm run dev

# ビルド
npm run build

# 本番サーバー
npm run start

# リント
npm run lint
```

### Firebase設定

1. Firebase Consoleでプロジェクトを作成
2. Authentication、Firestore、Storageを有効化
3. Webアプリを追加
4. 設定値を環境変数に設定

## ライセンス

MIT License
