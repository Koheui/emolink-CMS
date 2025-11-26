# 想い出ページ・公開ページ デザイン仕様書（AI生成用）

このドキュメントは、**想い出ページ作成画面**と**公開ページ**のデザインを改善するために、デザイン生成AIに提供する情報です。

## 0. AI生成デザインの参照

以下のデザインがAIによって生成されました。このデザインを実装するための詳細仕様を以下に記載します。

### 0.1 編集モードのデザイン特徴
- **背景**: ダークテーマ（濃いグレー/黒）
- **アクセントカラー**: 鮮やかな緑（#00FF00相当）
- **編集バナー**: 上部に「You are now editing this memory page」の通知
- **プロフィール画像**: 円形、ベージュのボーダー、緑のアップロードボタン
- **アルバムセクション**: 緑のボーダーで強調表示
- **ボタン**: 鮮やかな緑背景、白文字

### 0.2 公開ページのデザイン特徴
- **背景**: ダークテーマ（濃いブルー/黒）
- **アクセントカラー**: 鮮やかな緑（名前、プレイボタン、タグのボーダー）
- **メモリアルヘッダー**: 「In Loving Memory of」+ 緑で強調された名前
- **カードデザイン**: ダークカード、白文字、角丸
- **ビデオプレーヤー**: 緑のプレイボタン
- **タグ**: 緑のボーダー、白文字

## 1. 対象ページ

### 1.1 想い出ページ作成画面（`/memories/create`）
- エンドユーザーが想い出ページを作成・編集する画面
- NFC/QRコードでアクセスされる公開ページの編集画面

### 1.2 公開ページ（`/public/[pageId]`）
- NFC/QRコードからアクセスされる公開表示ページ
- スマートフォン最適化された閲覧専用ページ

## 2. デザインシステム

### 2.1 カラーパレット

#### AI生成デザインのカラースキーム
- **ダーク背景**: 濃いグレー/黒（`#1a1a1a` または `#0f0f0f`相当）
- **アクセントカラー（緑）**: 鮮やかな緑（`#00ff00` または `#10b981`相当）
- **テキスト**: 白（`#ffffff`）
- **カード背景**: ダークグレー（`#2a2a2a` または `#1f1f1f`相当）

#### 既存のカラースキーム（参考）
- **グラデーション背景**: `bg-gradient-to-br from-blue-600 to-cyan-600`
  - 開始: `#2563eb` (blue-600)
  - 終了: `#0891b2` (cyan-600)

#### テキストカラー
- **白文字**: `text-white` - グラデーション背景上で使用
- **テキストシャドウ**: `text-shadow: 2px 2px 4px rgba(0,0,0,0.5)` - 視認性向上

#### カード・背景
- **白背景カード**: `bg-white` - メディアブロック用
- **半透明背景**: `bg-white/10 backdrop-blur-sm` - 通知バナー用

#### アクセントカラー
- **プライマリ**: `#2563eb` (blue-600)
- **シアン**: `#0891b2` (cyan-600)
- **紫（アルバム用）**: `#a855f7` (purple-500)

### 2.2 タイポグラフィ

#### フォント
- **基本フォント**: Inter（Google Fonts）
- **フォントサイズ**:
  - タイトル: `text-2xl` (24px) - プロフィール横のタイトル
  - Bio: `text-sm` (14px) - タイトル下の説明文
  - ブロックタイトル: `text-base` (16px) または `text-lg` (18px)
  - 説明文: `text-sm` (14px)

#### フォントウェイト
- **Bold**: `font-bold` (700) - タイトル
- **Medium**: `font-medium` (500) - ラベル
- **Regular**: `font-normal` (400) - 本文

### 2.3 スペーシング

#### コンテナ
- **最大幅**: `max-w-2xl` (672px) - 中央配置
- **パディング**: `p-4` (16px) - 外側の余白

#### 要素間のスペース
- **セクション間**: `mb-6` (24px)
- **ブロック間**: `space-y-4` (16px)
- **アイテム間**: `gap-4` (16px)
- **プロフィールとタイトル間**: `gap-4` (16px)

### 2.4 ボーダー・シャドウ

#### ボーダー半径
- **カード**: `rounded-2xl` (16px)
- **画像**: `rounded-xl` (12px)
- **プロフィール画像**: `rounded-full` (完全な円)
- **ボタン**: `rounded-full` または `rounded-xl`

#### シャドウ
- **カード**: `shadow-lg` - メディアブロック
- **プロフィール画像**: `shadow-lg` - 白ボーダーと組み合わせ
- **保存ボタン**: `shadow-lg` - 固定ボタン

#### ボーダー
- **プロフィール画像**: `border-4 border-white` - 白い太いボーダー
- **ダッシュボーダー**: `border-2 border-dashed` - 追加ボタン用

## 3. 主要なUI要素

### 3.1 プロフィール画像

```tsx
// 構造
<div className="relative flex-shrink-0">
  {/* 画像またはプレースホルダー */}
  <div className="w-20 h-20 rounded-full border-4 border-white object-cover shadow-lg">
    <img src={profileImage} alt="Profile" />
  </div>
  
  {/* アップロードボタン */}
  <label className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1.5 cursor-pointer shadow-lg hover:bg-blue-700 transition">
    <Camera className="w-4 h-4 text-white" />
  </label>
</div>

// スタイル特徴
- サイズ: 20x20 (80px)
- 円形: rounded-full
- 白ボーダー: border-4 border-white
- シャドウ: shadow-lg
- アップロードボタン: 右下に配置、青背景
```

### 3.2 タイトルとBio

```tsx
// 構造
<div className="flex-1 min-w-0">
  {/* タイトル */}
  <h1 className="text-2xl font-bold text-white cursor-pointer hover:opacity-90">
    タイトル
  </h1>
  
  {/* Bio */}
  <p className="mt-2 text-sm text-white/90 cursor-pointer hover:opacity-90 whitespace-pre-wrap">
    説明文
  </p>
</div>

// スタイル特徴
- タイトル: 白文字、太字、クリックで編集
- Bio: 半透明白、複数行対応
- ホバー: opacity-90
```

### 3.3 メディアブロック

```tsx
// 構造
<div className="bg-white rounded-2xl p-4 shadow-lg">
  {/* メディア表示 */}
  <div className="aspect-video relative rounded-xl overflow-hidden mb-3">
    <img src={url} alt="Media" className="w-full h-full object-cover" />
  </div>
  
  {/* タイトルと説明 */}
  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
  <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
</div>

// スタイル特徴
- 白背景: bg-white
- 角丸: rounded-2xl
- シャドウ: shadow-lg
- パディング: p-4
- 画像: aspect-video、rounded-xl
```

### 3.4 アルバムブロック

```tsx
// 構造
<div className="bg-white rounded-2xl p-4 shadow-lg">
  <div className="space-y-3">
    {/* アルバムアイテム */}
    <div className="aspect-video relative rounded-xl overflow-hidden">
      <img src={item.url} className="w-full h-full object-cover" />
    </div>
    
    {/* 追加ボタン */}
    <button className="w-full py-6 border-2 border-dashed border-purple-300 rounded-xl hover:border-purple-500 hover:bg-purple-50">
      <Plus className="w-5 h-5 text-purple-500" />
      <span className="text-sm font-medium text-purple-600">写真を追加</span>
    </button>
  </div>
</div>

// スタイル特徴
- 紫のアクセント: border-purple-300、text-purple-500
- ダッシュボーダー: border-dashed
- ホバー: ボーダーと背景色が変わる
```

### 3.5 アップロードメニュー

```tsx
// 構造
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
    <div className="grid grid-cols-2 gap-3">
      {/* 写真 */}
      <button className="flex flex-col items-center p-4 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50">
        <Camera className="w-10 h-10 text-blue-600" />
        <span className="text-sm font-medium text-gray-900">写真</span>
      </button>
      
      {/* アルバム（紫） */}
      <button className="flex flex-col items-center p-4 border-2 border-purple-200 rounded-xl hover:border-purple-500 hover:bg-purple-50">
        <ImageIcon className="w-10 h-10 text-purple-600" />
        <span className="text-sm font-medium text-gray-900">アルバム</span>
      </button>
    </div>
  </div>
</div>

// スタイル特徴
- モーダル: 半透明黒背景、中央配置
- 2×2グリッド: grid-cols-2
- アルバムは紫で区別
- ホバー: ボーダーと背景色が変わる
```

### 3.6 保存ボタン

```tsx
// 構造
<div className="sticky bottom-4">
  <button className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6 rounded-full shadow-lg">
    保存
  </button>
</div>

// スタイル特徴
- 固定位置: sticky bottom-4
- フル幅: w-full
- 青背景: bg-blue-600
- 角丸: rounded-full
- 大きなパディング: py-6
- シャドウ: shadow-lg
```

## 4. レイアウト構造

### 4.1 想い出ページ作成画面の全体構造

```
┌─────────────────────────────────────┐
│ グラデーション背景 (青→シアン)        │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 既存ページ通知バナー          │   │ (条件付き)
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ プロフィール画像 │ タイトル   │   │
│  │                │ Bio       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ メディアブロック1            │   │
│  │ [画像/動画/音声/アルバム]    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ メディアブロック2            │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [+ 要素を追加]               │   │
│  └─────────────────────────────┘   │
│                                     │
│        [保存ボタン] (固定)          │
└─────────────────────────────────────┘
```

### 4.2 メディアブロックの詳細構造

```
┌─────────────────────────────────┐
│ アイコン タイプ 削除ボタン        │
├─────────────────────────────────┤
│                                 │
│      [画像/動画/音声]           │
│      aspect-video               │
│                                 │
├─────────────────────────────────┤
│ [タイトル入力]                   │
│ [説明入力]                       │
│ 👁️ 公開/非公開トグル             │
└─────────────────────────────────┘
```

### 4.3 アルバムブロックの詳細構造

```
┌─────────────────────────────────┐
│ 📚 アルバム 削除ボタン            │
├─────────────────────────────────┤
│ [写真1] [タイトル] [説明]        │
│ [写真2] [タイトル] [説明]        │
│ [写真3] [タイトル] [説明]        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [+ 写真を追加] (紫)         │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## 5. インタラクション

### 5.1 編集モード
- **タイトル**: クリックで編集モード、Input表示
- **Bio**: クリックで編集モード、Textarea表示
- **ブロックタイトル/説明**: 常時編集可能なInput/Textarea

### 5.2 ホバー効果
- **カード**: `hover:shadow-lg` - シャドウが大きくなる
- **ボタン**: `hover:bg-*` - 背景色が変わる
- **テキスト**: `hover:opacity-90` - 透明度が変わる

### 5.3 トランジション
- **カラー**: `transition-colors` - スムーズな色変化
- **シャドウ**: `transition-shadow` - スムーズなシャドウ変化
- **全般**: `transition-all` - すべてのプロパティ

## 6. レスポンシブデザイン

### 6.1 ブレークポイント
- **モバイル**: デフォルト（< 768px）
- **タブレット**: `md:` (≥ 768px)
- **デスクトップ**: `lg:` (≥ 1024px)

### 6.2 モバイル最適化
- **パディング**: `p-4` - 小さな画面でも適切な余白
- **フォントサイズ**: モバイルでも読みやすいサイズ
- **タッチ操作**: ボタンは十分なサイズ（最小44x44px）

## 7. 現在の実装コード

### 7.1 想い出ページ作成画面の完全な構造

```tsx
// ファイル: src/app/memories/create/page.tsx

// メインコンテナ
<div className="min-h-screen bg-gradient-to-br from-blue-600 to-cyan-600 p-4">
  
  {/* 既存ページ通知バナー */}
  {existingMemories.length > 0 && (
    <div className="max-w-2xl mx-auto mb-4">
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-white" />
          <div>
            <p className="text-white font-medium">
              既存の想い出ページが {existingMemories.length} 件あります
            </p>
            <p className="text-white/80 text-sm">
              別のLPから作成したページも表示されます
            </p>
          </div>
        </div>
        <button className="bg-white/20 border-white/30 text-white hover:bg-white/30">
          一覧を見る
        </button>
      </div>
    </div>
  )}
  
  {/* プロフィール画像とタイトル */}
  <div className="max-w-2xl mx-auto mb-6">
    <div className="flex items-start gap-4">
      {/* プロフィール画像 */}
      <div className="relative flex-shrink-0">
        <div className="w-20 h-20 rounded-full border-4 border-white object-cover shadow-lg">
          <img src={profileImage} alt="Profile" />
        </div>
        <label className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1.5 cursor-pointer shadow-lg hover:bg-blue-700 transition">
          <Camera className="w-4 h-4 text-white" />
        </label>
      </div>
      
      {/* タイトルとBio */}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-white cursor-pointer hover:opacity-90">
          {title}
        </h1>
        <p className="mt-2 text-sm text-white/90 cursor-pointer hover:opacity-90 whitespace-pre-wrap">
          {bio}
        </p>
      </div>
    </div>
  </div>
  
  {/* メディアブロック */}
  <div className="max-w-2xl mx-auto px-4">
    <div className="space-y-4 mb-6">
      {mediaBlocks.map(block => (
        <div key={block.id} className="bg-white rounded-2xl p-4 shadow-lg">
          {/* メディア表示 */}
          <div className="aspect-video relative rounded-xl overflow-hidden mb-3">
            {block.type === 'image' && (
              <img src={block.url} alt="Media" className="w-full h-full object-cover" />
            )}
            {block.type === 'video' && (
              <video src={block.url} controls className="w-full h-full object-cover" />
            )}
            {block.type === 'audio' && (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <Music className="w-16 h-16 text-gray-400" />
              </div>
            )}
          </div>
          
          {/* タイトルと説明 */}
          <input
            type="text"
            placeholder="タイトルを入力"
            value={block.title || ''}
            className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="説明を入力"
            value={block.description || ''}
            className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          
          {/* フッター */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">
              {block.type === 'image' ? '📷 写真' : block.type === 'video' ? '🎥 動画' : '🎵 音声'}
            </span>
            <button className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600 rounded">
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      ))}
      
      {/* 追加ボタン */}
      <button className="w-full bg-white rounded-2xl p-8 border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all">
        <div className="text-center">
          <Plus className="w-12 h-12 text-blue-400 mx-auto mb-2" />
          <p className="text-blue-600 font-medium text-sm">要素を追加</p>
        </div>
      </button>
    </div>
    
    {/* 保存ボタン */}
    <div className="sticky bottom-4">
      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-6 rounded-full shadow-lg">
        保存
      </button>
    </div>
  </div>
  
  {/* アップロードメニュー（モーダル） */}
  {showUploadMenu && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <h2 className="text-xl font-bold text-gray-900 mb-4">コンテンツを追加</h2>
        <div className="grid grid-cols-2 gap-3">
          <button className="flex flex-col items-center p-4 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50">
            <Camera className="w-10 h-10 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">写真</span>
          </button>
          <button className="flex flex-col items-center p-4 border-2 border-purple-200 rounded-xl hover:border-purple-500 hover:bg-purple-50">
            <ImageIcon className="w-10 h-10 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">アルバム</span>
          </button>
          <button className="flex flex-col items-center p-4 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50">
            <VideoIcon className="w-10 h-10 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">動画</span>
          </button>
          <button className="flex flex-col items-center p-4 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50">
            <Music className="w-10 h-10 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">音声</span>
          </button>
        </div>
      </div>
    </div>
  )}
</div>
```

### 7.2 既存ページ選択画面

```tsx
// 既存ページがある場合の選択画面
<div className="min-h-screen bg-gradient-to-br from-blue-600 to-cyan-600 p-4">
  <div className="max-w-4xl mx-auto">
    <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">既存の想い出ページ</h2>
      <p className="text-gray-600 mb-6">
        既に作成した想い出ページがあります。編集するか、新しいページを作成してください。
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {existingMemories.map(memory => (
          <div className="border rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="w-5 h-5" />
              <h3 className="font-medium">{memory.title || '無題'}</h3>
            </div>
            <p className="text-sm text-gray-500">
              {memory.status === 'published' ? '公開中' : '下書き'} • {formatDate(memory.updatedAt)}
            </p>
            <button className="w-full mt-3 border rounded-lg p-2 hover:bg-gray-50">
              編集する
            </button>
          </div>
        ))}
      </div>
      
      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg">
        <Plus className="w-5 h-5 inline mr-2" />
        新しい想い出ページを作成
      </button>
    </div>
  </div>
</div>
```

## 8. 改善したいポイント

### 8.1 視覚的な改善
- より洗練されたグラデーション
- より美しいカードデザイン
- より滑らかなアニメーション
- より魅力的なホバー効果

### 8.2 公開ページのデザイン
- 想い出ページ作成画面と統一感のあるデザイン
- スマートフォン最適化
- スムーズなスクロール体験
- メディアの美しい表示

### 8.3 ユーザビリティ
- より直感的な編集操作
- より明確な視覚的階層
- より快適な読みやすさ

## 8. 公開ページのデザイン（AI生成デザインに基づく）

### 8.1 公開ページの要件
- ダークテーマで統一
- 編集機能は非表示（閲覧専用）
- スマートフォン最適化
- スムーズなスクロール体験
- メディアの美しい表示
- 緑のアクセントカラーで強調

### 8.2 公開ページの構造（AI生成デザインに基づく）

```tsx
// ファイル: src/app/public/[pageId]/page.tsx

<div className="min-h-screen bg-[#0f0f0f] text-white">
  {/* メモリアルヘッダー（オプション） */}
  {isMemorial && (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 mb-4">
      <p className="text-center text-white/80 mb-2">In Loving Memory of</p>
      <h1 className="text-center text-3xl font-bold text-[#00ff00] mb-2">{name}</h1>
      <p className="text-center text-white/60">{birthYear} - {passingYear}</p>
      <p className="text-center text-white/80 mt-2">{memorialMessage}</p>
    </div>
  )}
  
  {/* メイン画像 */}
  <div className="w-full mb-4">
    <img src={mainImage} alt={title} className="w-full object-cover" />
  </div>
  
  {/* トリップサマリー */}
  <div className="bg-[#1a1a1a] rounded-2xl p-6 mb-4">
    <h2 className="text-xl font-bold mb-2">{title}</h2>
    <p className="text-white/60 mb-2">{date}</p>
    <p className="text-white/80">{description}</p>
  </div>
  
  {/* アドベンチャー説明 */}
  <div className="bg-[#1a1a1a] rounded-2xl p-6 mb-4">
    <h2 className="text-xl font-bold mb-3">Our Adventure</h2>
    <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{adventureText}</p>
  </div>
  
  {/* ビデオプレーヤー */}
  {videoUrl && (
    <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden mb-4">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button className="text-white">←</button>
        <h3 className="text-white font-medium">{videoTitle}</h3>
        <button className="text-white">↗</button>
      </div>
      <div className="relative aspect-video">
        <img src={videoThumbnail} alt={videoTitle} className="w-full h-full object-cover" />
        <button className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-[#00ff00] rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-black ml-1" />
          </div>
        </button>
      </div>
    </div>
  )}
  
  {/* フォトアルバム */}
  {albumImages.length > 0 && (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 mb-4">
      <h2 className="text-xl font-bold mb-4">Photo Album</h2>
      <div className="grid grid-cols-2 gap-3">
        {albumImages.map((img, index) => (
          <div key={index} className="aspect-square rounded-lg overflow-hidden">
            <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
          </div>
        ))}
        {albumImages.length > 4 && (
          <div className="aspect-square rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white">+{albumImages.length - 4} more</span>
          </div>
        )}
      </div>
    </div>
  )}
  
  {/* タグ */}
  {tags.length > 0 && (
    <div className="bg-[#1a1a1a] rounded-2xl p-6">
      <h2 className="text-xl font-bold mb-3">Tags</h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="px-4 py-2 border-2 border-[#00ff00] rounded-full text-white text-sm"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )}
</div>
```

### 8.3 編集モードのデザイン（AI生成デザインに基づく）

```tsx
// ファイル: src/app/memories/create/page.tsx（編集モード）

<div className="min-h-screen bg-[#0f0f0f] text-white">
  {/* 編集バナー */}
  <div className="bg-[#1a1a1a] border-b border-white/10 p-4 flex items-center justify-between">
    <p className="text-white">You are now editing this memory page.</p>
    <button className="text-white hover:text-white/80">×</button>
  </div>
  
  {/* プロフィール画像とタイトル */}
  <div className="max-w-2xl mx-auto pt-8 pb-6 px-4">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-24 h-24 rounded-full border-4 border-[#d4a574] overflow-hidden">
          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#00ff00] rounded-full flex items-center justify-center">
          <ArrowUp className="w-4 h-4 text-black" />
        </button>
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-white/80">{bio}</p>
      </div>
    </div>
  </div>
  
  {/* メインコンテンツブロック */}
  <div className="max-w-2xl mx-auto px-4 pb-8">
    <div className="space-y-4 mb-6">
      {/* 画像ブロック */}
      <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="aspect-video">
          <img src={imageUrl} alt={imageTitle} className="w-full h-full object-cover" />
        </div>
        <div className="p-4">
          <p className="text-white">{imageCaption}</p>
        </div>
      </div>
      
      {/* アルバムブロック（緑のボーダーで強調） */}
      <div className="bg-[#1a1a1a] border-4 border-[#00ff00] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Photo Album: {albumTitle}</h2>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Edit className="w-4 h-4 text-white" />
            </button>
            <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {albumItems.map((item, index) => (
            <div key={index} className="aspect-square rounded-lg overflow-hidden">
              <img src={item.url} alt={item.alt} className="w-full h-full object-cover" />
            </div>
          ))}
          <div className="aspect-square rounded-lg border-2 border-dashed border-white/30 flex flex-col items-center justify-center">
            <Mountain className="w-8 h-8 text-white/50 mb-2" />
            <span className="text-white/70 text-sm">Add Photos</span>
          </div>
        </div>
      </div>
    </div>
    
    {/* アクションボタン */}
    <div className="space-y-3 pb-8">
      <button className="w-full bg-[#00ff00] text-black font-semibold py-4 rounded-2xl flex items-center justify-center gap-2">
        <Plus className="w-5 h-5" />
        Add Element
      </button>
      <button className="w-full bg-[#00ff00] text-black font-semibold py-4 rounded-2xl">
        Save Page
      </button>
    </div>
  </div>
</div>
```

## 9. 重要なデザイン要素の詳細

### 9.1 グラデーション背景
```css
/* 現在の実装 */
background: linear-gradient(to bottom right, #2563eb, #0891b2);

/* 改善のポイント */
- より滑らかなグラデーション
- 複数のストップポイント
- より美しい色の組み合わせ
```

### 9.2 カードデザイン
```css
/* 現在の実装 */
background: white;
border-radius: 16px;
padding: 16px;
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

/* 改善のポイント */
- より柔らかいシャドウ
- より美しいボーダー（オプション）
- ホバー時のエレベーション効果
```

### 9.3 メディア表示
```css
/* 画像・動画 */
aspect-ratio: 16/9;
border-radius: 12px;
object-fit: cover;

/* 改善のポイント */
- より美しい角丸
- ローディング状態の表示
- ズーム効果（オプション）
```

### 9.4 ボタンとインタラクション
```css
/* 保存ボタン */
background: #2563eb;
border-radius: 9999px;
padding: 24px;
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

/* 改善のポイント */
- より洗練されたホバー効果
- クリック時のフィードバック
- より美しいシャドウ
```

## 9. AI生成デザインの実装詳細

### 9.1 カラーパレット（AI生成デザイン）

```css
/* ダークテーマ */
--bg-primary: #0f0f0f;      /* メイン背景 */
--bg-secondary: #1a1a1a;    /* カード背景 */
--bg-tertiary: #2a2a2a;     /* ホバー時の背景 */

/* アクセントカラー（緑） */
--accent-primary: #00ff00;  /* 鮮やかな緑 */
--accent-secondary: #10b981; /* より柔らかい緑 */

/* テキスト */
--text-primary: #ffffff;     /* 白 */
--text-secondary: rgba(255, 255, 255, 0.8); /* 80%不透明度 */
--text-tertiary: rgba(255, 255, 255, 0.6);  /* 60%不透明度 */

/* ボーダー */
--border-primary: rgba(255, 255, 255, 0.1); /* 10%不透明度 */
--border-accent: #00ff00;   /* 緑のボーダー */
--border-beige: #d4a574;    /* ベージュ（プロフィール画像用） */
```

### 9.2 タイポグラフィ（AI生成デザイン）

```css
/* 見出し */
h1: 3xl (30px), bold
h2: xl (20px), bold
h3: lg (18px), semibold

/* 本文 */
body: base (16px), regular
small: sm (14px), regular
caption: xs (12px), regular

/* 行間 */
leading-relaxed: 1.625
leading-normal: 1.5
```

### 9.3 スペーシング（AI生成デザイン）

```css
/* セクション間 */
section-gap: 1rem (16px)

/* カード内パディング */
card-padding: 1.5rem (24px)

/* 要素間 */
element-gap: 0.75rem (12px)
```

### 9.4 ボーダー・シャドウ（AI生成デザイン）

```css
/* 角丸 */
rounded-sm: 0.25rem (4px)
rounded-md: 0.5rem (8px)
rounded-lg: 0.75rem (12px)
rounded-xl: 1rem (16px)
rounded-2xl: 1.5rem (24px)
rounded-full: 9999px

/* ボーダー */
border-thin: 1px
border-medium: 2px
border-thick: 4px

/* シャドウ */
shadow-none: なし（ダークテーマではシャドウを控えめに）
```

### 9.5 インタラクション（AI生成デザイン）

```css
/* ホバー効果 */
hover-opacity: 0.8
hover-bg: rgba(255, 255, 255, 0.1)

/* トランジション */
transition-duration: 200ms
transition-timing: ease-in-out

/* フォーカス */
focus-ring: 2px solid #00ff00
focus-ring-offset: 2px
```

## 10. AIへの指示例

### 10.1 基本的な指示

「上記のデザインシステムに基づいて、想い出ページ作成画面と公開ページのデザインを改善してください：

1. **グラデーション背景**: より洗練された青からシアンへのグラデーション
2. **カードデザイン**: より美しい白背景カード、シャドウ、ボーダー
3. **メディア表示**: より魅力的な画像・動画・音声の表示
4. **インタラクション**: より滑らかなアニメーションとトランジション
5. **公開ページ**: 閲覧専用の美しい表示デザイン

現在のTailwind CSSクラス構造を維持しつつ、視覚的な魅力を大幅に向上させてください。」

### 10.2 具体的な改善指示

「以下の要素を特に改善してください：

1. **グラデーション**:
   - より滑らかで美しいグラデーション
   - 複数のストップポイント
   - より洗練された色の組み合わせ

2. **カード**:
   - より柔らかいシャドウ
   - ホバー時のエレベーション効果
   - より美しいボーダー（必要に応じて）

3. **メディアブロック**:
   - より魅力的な画像表示
   - 動画プレーヤーのスタイル改善
   - 音声プレーヤーのデザイン

4. **ボタン**:
   - より洗練されたホバー効果
   - クリック時のフィードバック
   - より美しいシャドウとグラデーション

5. **アニメーション**:
   - フェードイン/アウト
   - スライドイン
   - ホバー時のスケール効果
   - トランジションの最適化

6. **レスポンシブ**:
   - モバイル体験の最適化
   - タッチ操作の改善
   - 読みやすさの向上」

### 10.3 出力形式

AIには以下の形式で出力を依頼：
- Tailwind CSSクラス形式
- 既存のコンポーネント構造を維持
- レスポンシブ対応（`md:`, `lg:`プレフィックス）
- アニメーションとトランジションを含む

