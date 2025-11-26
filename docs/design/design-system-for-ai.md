# デザインシステム仕様書（AI生成用）

このドキュメントは、デザイン生成AIがCSSを生成するために必要な情報をまとめています。

## 1. デザインシステム概要

### 1.1 カラーパレット

#### プライマリカラー
- **Primary**: `hsl(221.2, 83.2%, 53.3%)` - 青（#3B82F6相当）
- **Primary Foreground**: `hsl(210, 40%, 98%)` - ほぼ白

#### セカンダリカラー
- **Secondary**: `hsl(210, 40%, 96%)` - 薄いグレー
- **Secondary Foreground**: `hsl(222.2, 84%, 4.9%)` - ほぼ黒

#### 背景色
- **Background**: `hsl(0, 0%, 100%)` - 白
- **Foreground**: `hsl(222.2, 84%, 4.9%)` - ほぼ黒
- **Card**: `hsl(0, 0%, 100%)` - 白
- **Card Foreground**: `hsl(222.2, 84%, 4.9%)` - ほぼ黒

#### アクセントカラー
- **Muted**: `hsl(210, 40%, 96%)` - 薄いグレー
- **Muted Foreground**: `hsl(215.4, 16.3%, 46.9%)` - グレー
- **Accent**: `hsl(210, 40%, 96%)` - 薄いグレー
- **Accent Foreground**: `hsl(222.2, 84%, 4.9%)` - ほぼ黒

#### エラーカラー
- **Destructive**: `hsl(0, 84.2%, 60.2%)` - 赤
- **Destructive Foreground**: `hsl(210, 40%, 98%)` - ほぼ白

#### ボーダー・入力
- **Border**: `hsl(214.3, 31.8%, 91.4%)` - 薄いグレー
- **Input**: `hsl(214.3, 31.8%, 91.4%)` - 薄いグレー
- **Ring**: `hsl(221.2, 83.2%, 53.3%)` - 青（フォーカス時）

#### グラデーション
- **メイングラデーション**: `from-blue-600 to-cyan-600` - 青からシアンへ
- **ロゴグラデーション**: `from-blue-600 to-cyan-600` - 青からシアンへ
- **ユーザーアバター**: `from-blue-500 to-cyan-500` - 青からシアンへ

### 1.2 タイポグラフィ

#### フォント
- **基本フォント**: Inter（Google Fonts）
- **フォントサイズ**:
  - タイトル: 24px-120px（可変、デフォルト48px）
  - サブタイトル: 12px-32px（可変、デフォルト18px）
  - 見出し（h1）: `text-3xl` (30px)
  - 見出し（h2）: `text-2xl` (24px)
  - 見出し（h3）: `text-xl` (20px)
  - 本文: `text-sm` (14px) / `text-base` (16px)
  - 小さいテキスト: `text-xs` (12px)

#### フォントウェイト
- **Bold**: `font-bold` (700)
- **Semibold**: `font-semibold` (600)
- **Medium**: `font-medium` (500)
- **Regular**: `font-normal` (400)

### 1.3 スペーシング

#### パディング
- **Card Header**: `p-6` (24px)
- **Card Content**: `p-6 pt-0` (24px padding, 0 top)
- **Button Default**: `px-4 py-2` (16px horizontal, 8px vertical)
- **Button Small**: `px-3` (12px horizontal)
- **Button Large**: `px-8` (32px horizontal)

#### マージン
- **Section Gap**: `gap-6` (24px)
- **Grid Gap**: `gap-4` (16px)
- **Space Between**: `space-y-4` (16px vertical)
- **Space X**: `space-x-2` (8px horizontal)

#### ボーダー半径
- **Default**: `rounded-md` (6px)
- **Large**: `rounded-lg` (8px)
- **XL**: `rounded-xl` (12px)
- **2XL**: `rounded-2xl` (16px)
- **Full**: `rounded-full` (完全な円)

### 1.4 シャドウ

- **Card Shadow**: `shadow-sm` - 小さなシャドウ
- **Hover Shadow**: `shadow-lg` - 大きなシャドウ
- **Text Shadow**: `text-shadow: 2px 2px 4px rgba(0,0,0,0.5)` - テキスト用

## 2. UIコンポーネント

### 2.1 Button（ボタン）

```tsx
// バリアント
- default: 青背景、白文字
- outline: 白背景、青ボーダー
- secondary: グレー背景
- destructive: 赤背景
- ghost: 背景なし、ホバーでグレー
- link: テキストリンク

// サイズ
- default: h-10 px-4 py-2
- sm: h-9 px-3
- lg: h-11 px-8
- icon: h-10 w-10

// スタイル特徴
- rounded-md
- font-medium
- transition-colors
- focus-visible:ring-2（フォーカス時リング）
```

### 2.2 Card（カード）

```tsx
// 構造
- Card: 白背景、rounded-lg、border、shadow-sm
- CardHeader: p-6、flex flex-col space-y-1.5
- CardTitle: text-2xl font-semibold
- CardDescription: text-sm text-muted-foreground
- CardContent: p-6 pt-0
- CardFooter: p-6 pt-0、flex items-center
```

### 2.3 Input（入力フィールド）

```tsx
// スタイル
- h-10
- rounded-md
- border border-input
- bg-background
- px-3 py-2
- text-sm
- focus-visible:ring-2（フォーカス時リング）
- placeholder:text-muted-foreground
```

### 2.4 Badge（バッジ）

```tsx
// バリアント
- default: 青背景
- secondary: グレー背景
- destructive: 赤背景
- outline: ボーダーのみ

// スタイル
- rounded-full
- px-2.5 py-0.5
- text-xs
- font-semibold
```

### 2.5 Table（テーブル）

```tsx
// 構造
- Table: w-full、border
- TableHeader: bg-gray-50、border-b
- TableRow: border-b、hover:bg-gray-50
- TableHead: h-12 px-4、text-left、font-medium
- TableCell: p-4
```

## 3. ページレイアウト

### 3.1 トップページ（`/`）

```tsx
// 特徴
- 全画面背景画像
- グラデーション背景: bg-gradient-to-br from-blue-600 to-cyan-600
- 中央配置のテキスト
- 白文字にtext-shadow
- ドラッグ&ドロップ可能なテキスト位置
- フォントサイズ調整スライダー

// 要素
- タイトル: 白文字、大きなフォントサイズ、ドラッグ可能
- サブタイトル: 白文字、中サイズ、ドラッグ可能
- Goボタン: 矢印アイコンのみ、ドラッグ可能
```

### 3.2 想い出ページ作成（`/memories/create`）

```tsx
// 特徴
- グラデーション背景: bg-gradient-to-br from-blue-600 to-cyan-600
- 最大幅: max-w-2xl、中央配置
- 白背景のカード

// 要素
- プロフィール画像: 円形、20x20、白ボーダー、シャドウ
- タイトル・bio: クリックで編集可能
- メディアブロック: 白背景カード、角丸、シャドウ
- アップロードメニュー: 2×2グリッド、紫でアルバムを区別
```

### 3.3 管理画面（`/dashboard`, `/admin/*`）

```tsx
// 特徴
- 背景: bg-gray-50
- サイドバー: 固定、白背景、w-64
- メインコンテンツ: lg:pl-64（サイドバー分の余白）

// サイドバー
- ロゴ: グラデーション背景のアイコン
- ユーザー情報: アバター、メール、テナント表示
- ナビゲーション: アイコン付きボタン、アクティブ状態
- ログアウトボタン: フッター

// カード
- 白背景
- rounded-lg
- border
- shadow-sm
- 統計カード: 3カラムグリッド
```

### 3.4 認証ページ（`/auth`）

```tsx
// 特徴
- 背景: bg-gray-50
- 中央配置のカード
- 最大幅: max-w-md

// 要素
- カード: 白背景、rounded-lg、shadow
- 入力フィールド: 標準スタイル
- ボタン: フル幅
```

## 4. デザインの特徴

### 4.1 全体的なスタイル
- **モダンでクリーン**: ミニマルなデザイン
- **グラデーション活用**: 青からシアンへのグラデーションを多用
- **カードベース**: 情報はカードで整理
- **レスポンシブ**: モバイル、タブレット、デスクトップ対応

### 4.2 インタラクション
- **ホバー効果**: transition-colors、hover:bg-*、hover:shadow-lg
- **フォーカスリング**: focus-visible:ring-2
- **トランジション**: duration-300 ease-in-out

### 4.3 特別な要素
- **バックドロップ**: backdrop-blur-sm（半透明背景）
- **グラデーション背景**: from-blue-600 to-cyan-600
- **テキストシャドウ**: 白文字の視認性向上
- **ドラッグ&ドロップ**: トップページのテキスト位置調整

## 5. 主要なCSSクラスパターン

### 5.1 レイアウト
```css
/* 中央配置 */
.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }

/* グリッド */
.grid { display: grid; }
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

/* フレックス */
.flex { display: flex; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.space-x-2 { gap: 0.5rem; }
.space-y-4 { gap: 1rem; }
```

### 5.2 カラー
```css
/* 背景 */
.bg-white { background-color: white; }
.bg-gray-50 { background-color: #f9fafb; }
.bg-blue-600 { background-color: #2563eb; }
.bg-cyan-600 { background-color: #0891b2; }

/* テキスト */
.text-white { color: white; }
.text-gray-900 { color: #111827; }
.text-gray-600 { color: #4b5563; }
.text-blue-600 { color: #2563eb; }
```

### 5.3 スペーシング
```css
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-8 { margin-bottom: 2rem; }
```

### 5.4 ボーダー・シャドウ
```css
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }
.rounded-2xl { border-radius: 1rem; }
.rounded-full { border-radius: 9999px; }
.border { border-width: 1px; }
.border-gray-200 { border-color: #e5e7eb; }
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
```

## 6. 現在の実装ファイル

### 6.1 グローバルスタイル
- `src/app/globals.css` - CSS変数とベーススタイル

### 6.2 Tailwind設定
- `tailwind.config.ts` - テーマ設定とカスタム値

### 6.3 UIコンポーネント
- `src/components/ui/button.tsx` - ボタン
- `src/components/ui/card.tsx` - カード
- `src/components/ui/input.tsx` - 入力フィールド
- `src/components/ui/badge.tsx` - バッジ
- `src/components/ui/label.tsx` - ラベル
- `src/components/ui/textarea.tsx` - テキストエリア
- `src/components/ui/table.tsx` - テーブル

### 6.4 レイアウトコンポーネント
- `src/components/admin-layout.tsx` - 管理画面レイアウト

### 6.5 主要ページ
- `src/app/page.tsx` - トップページ
- `src/app/memories/create/page.tsx` - 想い出ページ作成
- `src/app/dashboard/page.tsx` - ダッシュボード
- `src/app/auth/page.tsx` - 認証ページ
- `src/app/admin/users/page.tsx` - ユーザー管理
- `src/app/admin/tenants/page.tsx` - テナント管理

## 7. 改善したいポイント

### 7.1 視覚的な改善
- より洗練されたカラーパレット
- 統一感のあるスペーシング
- より美しいシャドウとボーダー
- アニメーションとトランジションの強化

### 7.2 UX改善
- より明確な視覚的階層
- 読みやすいタイポグラフィ
- アクセシビリティの向上
- モバイル体験の最適化

## 8. 主要コンポーネントのコード例

### 8.1 トップページの主要要素

```tsx
// 背景とコンテナ
<div className="min-h-screen bg-gradient-to-br from-blue-600 to-cyan-600">
  <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
    {/* タイトル */}
    <h1 className="font-bold text-white drop-shadow-lg cursor-move" 
        style={{ fontSize: `${titleFontSize}px`, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
      大切な想い出をいつまでも
    </h1>
    
    {/* サブタイトル */}
    <p className="text-white" style={{ fontSize: `${subtitleFontSize}px`, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
      一度きりの想い出を残してください
    </p>
    
    {/* Goボタン */}
    <button className="mt-8 w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition">
      <ArrowRight className="w-8 h-8 text-white" />
    </button>
  </div>
</div>
```

### 8.2 想い出ページ作成の主要要素

```tsx
// コンテナ
<div className="min-h-screen bg-gradient-to-br from-blue-600 to-cyan-600 p-4">
  <div className="max-w-2xl mx-auto">
    {/* プロフィール画像 */}
    <div className="w-20 h-20 rounded-full border-4 border-white object-cover shadow-lg">
      <img src={profileImage} alt="Profile" />
    </div>
    
    {/* タイトルとbio */}
    <h1 className="text-2xl font-bold text-white">{title}</h1>
    <p className="text-sm text-white/90">{bio}</p>
    
    {/* メディアブロック */}
    <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
      <div className="aspect-video relative rounded-xl overflow-hidden">
        <img src={block.url} alt="Media" className="w-full h-full object-cover" />
      </div>
    </div>
  </div>
</div>
```

### 8.3 管理画面の主要要素

```tsx
// サイドバー
<aside className="fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200">
  {/* ロゴ */}
  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
    <Shield className="w-5 h-5 text-white" />
  </div>
  
  {/* ナビゲーション */}
  <nav className="space-y-1">
    <button className="w-full justify-start bg-blue-50 text-blue-700">
      <LayoutDashboard className="w-5 h-5" />
      ダッシュボード
    </button>
  </nav>
</aside>

// メインコンテンツ
<div className="lg:pl-64 p-6 lg:p-8">
  <div className="max-w-7xl mx-auto">
    {/* 統計カード */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div className="text-2xl font-bold">10</div>
        <p className="text-xs text-muted-foreground">総想い出数</p>
      </div>
    </div>
  </div>
</div>
```

### 8.4 認証ページの主要要素

```tsx
<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-sm">
    <div className="flex flex-col space-y-1.5 p-6">
      <h3 className="text-2xl font-semibold">ログイン</h3>
      <p className="text-sm text-muted-foreground">秘密鍵またはメールアドレスで認証</p>
    </div>
    <div className="p-6 pt-0">
      <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2" />
      <button className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground w-full mt-4">
        ログイン
      </button>
    </div>
  </div>
</div>
```

## 9. AIへの指示例

### 9.1 基本的な指示

「上記のデザインシステムに基づいて、以下の改善を行ってください：
1. カラーパレットをより洗練されたものに更新
2. ボタンとカードのスタイルをよりモダンに
3. グラデーションとシャドウをより美しく
4. アニメーションとトランジションを追加
5. レスポンシブデザインを最適化

現在のTailwind CSSクラスを維持しつつ、視覚的な魅力を向上させてください。」

### 9.2 具体的な改善指示

「以下の要素を改善してください：

1. **ボタン**:
   - より洗練されたホバー効果
   - グラデーション背景のオプション
   - より美しいシャドウ

2. **カード**:
   - より柔らかいシャドウ
   - ホバー時のエレベーション効果
   - より美しいボーダー

3. **入力フィールド**:
   - より明確なフォーカス状態
   - より美しいプレースホルダー
   - エラー状態のスタイル

4. **グラデーション**:
   - より滑らかなグラデーション
   - 複数のグラデーションパターン

5. **アニメーション**:
   - フェードイン/アウト
   - スライドイン
   - ホバー時のスケール効果」

### 9.3 ファイル構造

AIに提供すべきファイル：
1. `src/app/globals.css` - CSS変数とベーススタイル
2. `tailwind.config.ts` - Tailwind設定
3. `src/components/ui/*.tsx` - UIコンポーネント
4. 主要なページコンポーネント（上記参照）

### 9.4 出力形式

AIには以下の形式で出力を依頼：
- Tailwind CSSクラス形式
- 既存のコンポーネント構造を維持
- CSS変数（`--primary`など）を使用
- レスポンシブ対応（`md:`, `lg:`プレフィックス）

