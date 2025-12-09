# 動画サムネイルのデバッグ方法

## 開発者ツールでの確認手順

### 1. 開発者ツールを開く
- **Chrome/Edge**: `F12` または `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- **Safari**: `Cmd+Option+I` (開発者メニューを有効にする必要があります)

### 2. Elements（要素）タブで動画要素を確認

#### 手順：
1. 開発者ツールの左上にある「要素を選択」アイコン（または `Ctrl+Shift+C` / `Cmd+Shift+C`）をクリック
2. 動画が表示されている場所をクリック
3. `<video>`要素が選択されます

#### 確認項目：

**a) `poster`属性の確認**
```html
<video poster="data:image/jpeg;base64,..." src="...">
```
- `poster`属性が存在するか
- `poster`属性の値が`data:image/jpeg;base64,`で始まっているか

**b) スタイルの確認**
右側の「Styles」パネルで以下を確認：
- `display`: `block` または `inline-block` であること（`none`ではない）
- `opacity`: `1` であること（`0`ではない）
- `visibility`: `visible` であること（`hidden`ではない）
- `z-index`: 適切な値が設定されているか
- `background-color`: `transparent` または設定されていないこと

**c) 計算されたスタイルの確認**
「Computed」タブで以下を確認：
- `display`: 実際に適用されている表示方法
- `opacity`: 実際の透明度
- `visibility`: 実際の可視性

### 3. Console（コンソール）タブでログを確認

#### 確認するログ：
- `Generating video thumbnail:` - サムネイル生成の開始
- `Attempting to capture frame:` - フレームキャプチャの試行
- `Frame captured successfully, thumbnail size:` - フレームキャプチャの成功
- `Thumbnail set as poster attribute` - poster属性への設定完了

#### エラーログ：
- `Canvas context not available` - Canvasが使用できない
- `Error drawing video to canvas:` - フレーム描画エラー
- `Failed to generate thumbnail:` - サムネイル生成失敗

### 4. Network（ネットワーク）タブでリソースを確認

1. 「Network」タブを開く
2. ページをリロード（`F5` または `Cmd+R`）
3. フィルターで「Media」または「Img」を選択
4. 動画ファイル（`.mp4`, `.webm`など）が読み込まれているか確認

### 5. 動画要素のプロパティを直接確認

Consoleタブで以下のコマンドを実行：

```javascript
// すべての動画要素を取得
const videos = document.querySelectorAll('video');

// 各動画要素の情報を表示
videos.forEach((video, index) => {
  console.log(`Video ${index}:`, {
    src: video.src,
    poster: video.poster,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    readyState: video.readyState,
    display: window.getComputedStyle(video).display,
    opacity: window.getComputedStyle(video).opacity,
    visibility: window.getComputedStyle(video).visibility,
    zIndex: window.getComputedStyle(video).zIndex,
  });
});
```

### 6. サムネイル画像の確認

```javascript
// poster属性が設定されている動画要素を確認
const videosWithPoster = document.querySelectorAll('video[poster]');
videosWithPoster.forEach((video, index) => {
  console.log(`Video ${index} poster:`, {
    poster: video.poster.substring(0, 50) + '...',
    posterLength: video.poster.length,
  });
  
  // poster画像が読み込まれているか確認
  const img = new Image();
  img.onload = () => console.log(`Poster ${index} loaded successfully`);
  img.onerror = () => console.error(`Poster ${index} failed to load`);
  img.src = video.poster;
});
```

## よくある問題と解決方法

### 問題1: `poster`属性が設定されていない
- **原因**: サムネイル生成が失敗している
- **確認**: Consoleタブでエラーログを確認
- **解決**: 動画のメタデータが読み込まれるまで待つ

### 問題2: `poster`属性は設定されているが表示されない
- **原因**: 動画要素が非表示になっている、または他の要素に隠れている
- **確認**: Elementsタブでスタイルを確認
- **解決**: `display`, `opacity`, `visibility`を確認

### 問題3: 動画が再生されている
- **原因**: 動画が再生中の場合、`poster`は表示されない
- **確認**: 動画が再生されていないか確認
- **解決**: 動画を停止する

### 問題4: ブラウザの互換性
- **原因**: 一部のブラウザでは`poster`属性のDataURLが正しく表示されない場合がある
- **確認**: 別のブラウザで確認
- **解決**: 別のアプローチ（img要素を重ねる）を使用




