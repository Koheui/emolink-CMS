# ストレージ移行・統合実装プラン

## 概要

現在のFirebase Storageから、以下の移行・統合を段階的に実装する計画です：
- **画像・ファイル**: Google Driveへの移行
- **動画**: Vimeoへの統合
- **既存機能への影響を最小化**しながら実装

## 実装方針

### 基本原則
1. **既存コードへの影響を最小化**
2. **段階的な実装とテスト**
3. **Gitブランチでの開発**
4. **抽象化レイヤーの導入**

## 実装フェーズ

### フェーズ1: 準備・抽象化レイヤーの構築

#### 1.1 ブランチ作成
```bash
git checkout -b feature/storage-abstraction
```

#### 1.2 ストレージサービスインターフェースの定義
- **ファイル**: `src/lib/storage/storage-service.ts`
- **内容**:
  ```typescript
  interface StorageService {
    upload(file: File, path: string, metadata?: any): Promise<string>;
    getUrl(fileId: string): Promise<string>;
    delete(fileId: string): Promise<void>;
    getFileSize(fileId: string): Promise<number>;
  }
  ```

#### 1.3 既存のFirebase Storage実装をラップ
- **ファイル**: `src/lib/storage/firebase-storage-service.ts`
- **内容**: 既存のFirebase Storageコードを`StorageService`インターフェースに適合
- **注意**: 既存コードは変更せず、ラッパーとして実装

#### 1.4 ストレージマネージャーの実装
- **ファイル**: `src/lib/storage/storage-manager.ts`
- **機能**:
  - 設定に基づいて使用するストレージサービスを選択
  - 環境変数で切り替え可能
  - デフォルトはFirebase Storage（既存動作を維持）

### フェーズ2: Google Drive統合

#### 2.1 Google Drive API設定
- **必要な設定**:
  - Google Cloud ConsoleでAPI有効化
  - サービスアカウントの作成
  - 認証情報の取得
  - 環境変数への設定

#### 2.2 Google Driveサービス実装
- **ファイル**: `src/lib/storage/google-drive-service.ts`
- **実装内容**:
  - Google Drive API v3の統合
  - ファイルアップロード機能
  - ファイルURL取得機能
  - ファイル削除機能
  - ファイルサイズ取得機能

#### 2.3 データベーススキーマの拡張
- **Firestoreコレクション**: `memories`, `mediaBlocks`
- **追加フィールド**:
  - `storageType: 'firebase' | 'drive'` (デフォルト: 'firebase')
  - `driveFileId?: string` (Google DriveファイルID)
  - `storagePath?: string` (ストレージ内のパス)

#### 2.4 アップロード処理の更新
- **ファイル**: `src/components/file-upload.tsx`, `src/components/content-upload-modal.tsx`
- **変更内容**:
  - `StorageManager`を使用するように変更
  - 設定に基づいてFirebase StorageまたはGoogle Driveを使用
  - 既存のFirebase Storageコードはフォールバックとして残す

#### 2.5 読み込み処理の更新
- **ファイル**: 各種コンポーネント（`memory-editor.tsx`, `public-page-client.tsx`など）
- **変更内容**:
  - `storageType`に基づいて適切なストレージから読み込み
  - 既存のFirebase Storage読み込みコードは維持

### フェーズ3: Vimeo統合

#### 3.1 Vimeo API設定
- **必要な設定**:
  - Vimeo Developerアカウントの作成
  - APIトークンの取得
  - 環境変数への設定
  - プライバシー設定の決定（非公開/パスワード保護など）

#### 3.2 Vimeoサービス実装
- **ファイル**: `src/lib/storage/vimeo-service.ts`
- **実装内容**:
  - Vimeo API v3の統合
  - 動画アップロード機能（チャンクアップロード対応）
  - アップロード進捗の取得
  - 動画URL取得機能
  - 動画削除機能
  - プライバシー設定（非公開設定）

#### 3.3 データベーススキーマの拡張
- **Firestoreコレクション**: `mediaBlocks` (type: 'video')
- **追加フィールド**:
  - `vimeoVideoId?: string` (Vimeo動画ID)
  - `vimeoEmbedUrl?: string` (Vimeo埋め込みURL)
  - `videoStorageType: 'firebase' | 'vimeo'` (デフォルト: 'vimeo')

#### 3.4 動画アップロード処理の実装
- **ファイル**: `src/components/video-upload.tsx` (新規作成)
- **実装内容**:
  - 動画ファイル選択UI
  - Vimeoへのアップロード処理
  - アップロード進捗表示
  - エラーハンドリング

#### 3.5 動画再生処理の更新
- **ファイル**: `src/components/public-page-client.tsx`, `src/components/memory-editor.tsx`
- **変更内容**:
  - Vimeo動画IDがある場合はVimeoプレーヤーを使用
  - 既存のFirebase Storage動画は従来通り再生
  - Vimeo埋め込みプレーヤーの統合

#### 3.6 Firebase Functionsでのバックグラウンド処理
- **ファイル**: `functions/src/vimeo-upload.ts` (新規作成)
- **実装内容**:
  - 大きな動画ファイルのアップロード処理
  - アップロード進捗の管理
  - エラー時のリトライ処理

### フェーズ4: 段階的移行機能（オプション）

#### 4.1 移行ツールの実装
- **ファイル**: `src/lib/storage/migration-tool.ts`
- **機能**:
  - Firebase StorageからGoogle Driveへの移行
  - バッチ処理での移行
  - 移行進捗の管理
  - エラーハンドリング

#### 4.2 管理画面での移行機能
- **ファイル**: `src/app/admin/storage-migration/page.tsx` (新規作成)
- **機能**:
  - 移行対象の選択
  - 移行実行
  - 移行進捗の表示
  - ロールバック機能

## ファイル構成

```
src/
├── lib/
│   └── storage/
│       ├── storage-service.ts          # インターフェース定義
│       ├── storage-manager.ts          # ストレージマネージャー
│       ├── firebase-storage-service.ts # Firebase Storage実装（既存コードのラップ）
│       ├── google-drive-service.ts     # Google Drive実装（新規）
│       ├── vimeo-service.ts            # Vimeo実装（新規）
│       └── migration-tool.ts           # 移行ツール（オプション）
├── components/
│   ├── file-upload.tsx                 # 更新（StorageManager使用）
│   ├── video-upload.tsx                # 新規作成（Vimeo統合）
│   └── ...
└── app/
    └── admin/
        └── storage-migration/          # 新規（移行管理画面）

functions/
└── src/
    └── vimeo-upload.ts                 # 新規（Vimeoアップロード処理）
```

## 環境変数

### 追加が必要な環境変数

```env
# Google Drive
GOOGLE_DRIVE_CLIENT_EMAIL=
GOOGLE_DRIVE_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=

# Vimeo
VIMEO_ACCESS_TOKEN=
VIMEO_CLIENT_ID=
VIMEO_CLIENT_SECRET=

# ストレージ設定
STORAGE_TYPE=firebase|drive  # デフォルト: firebase
VIDEO_STORAGE_TYPE=firebase|vimeo  # デフォルト: vimeo
```

## 実装順序

1. **フェーズ1**: 抽象化レイヤーの構築（既存コードへの影響なし）
2. **フェーズ2**: Google Drive統合（新規実装、既存コードは維持）
3. **フェーズ3**: Vimeo統合（新規実装、既存コードは維持）
4. **フェーズ4**: 段階的移行機能（オプション、必要に応じて）

## テスト計画

### 単体テスト
- 各ストレージサービスのテスト
- ストレージマネージャーのテスト
- エラーハンドリングのテスト

### 統合テスト
- アップロード処理のテスト
- 読み込み処理のテスト
- 既存機能が正常に動作することを確認

### 移行テスト
- Firebase StorageからGoogle Driveへの移行テスト
- データの整合性確認
- ロールバックテスト

## リスク管理

### リスク1: 既存機能への影響
- **対策**: 抽象化レイヤーで既存コードをラップ、デフォルトはFirebase Storage
- **検証**: 既存機能の動作確認を徹底

### リスク2: API制限・エラー
- **対策**: エラーハンドリングとリトライ処理の実装
- **検証**: 各種エラーケースのテスト

### リスク3: 移行中のデータ不整合
- **対策**: 移行ツールでの整合性チェック、ロールバック機能
- **検証**: 移行テストの実施

## デプロイ計画

### ステージング環境でのテスト
1. フェーズ1のデプロイとテスト
2. フェーズ2のデプロイとテスト
3. フェーズ3のデプロイとテスト
4. 本番環境へのデプロイ

### 本番環境へのデプロイ
1. フェーズ1をデプロイ（既存機能への影響なし）
2. フェーズ2をデプロイ（新機能追加、既存機能は維持）
3. フェーズ3をデプロイ（新機能追加、既存機能は維持）
4. 必要に応じてフェーズ4をデプロイ

## ロールバック計画

各フェーズで問題が発生した場合：
1. 該当ブランチのマージを取り消し
2. 既存のFirebase Storageコードに戻す
3. 問題の原因を調査
4. 修正後に再デプロイ

## 今後の拡張

- ストレージ使用量の監視
- 自動移行機能（使用量が一定を超えた場合）
- 複数ストレージプロバイダーのサポート
- CDN統合（画像の最適化配信）

## 参考資料

- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [Vimeo API Documentation](https://developer.vimeo.com/api)
- [Firebase Storage Documentation](https://firebase.google.com/docs/storage)

