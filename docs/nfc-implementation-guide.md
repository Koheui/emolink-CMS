# NFC書き込み実装ガイド

## 現在の実装状況

現在の実装は**Web NFC API**を使用しており、これはブラウザベースのAPIです。

## Sony RC-S300（PaSoRi）について

### デバイスの特徴
- **PC用USB接続NFCリーダー/ライター**
- PC/SC 2.0準拠
- FeliCa、ISO/IEC 14443 Type A/B、ISO/IEC 15693対応
- SDK for NFC Liteを使用してWindows/macOSアプリケーション開発が可能

### Web NFC APIとの互換性

**❌ 互換性なし**

理由：
1. **Web NFC API**はブラウザのAPIで、デバイスのハードウェアNFCチップに直接アクセスします
2. 主に**Androidデバイス（Chrome 89以降）**でサポートされています
3. PC用のUSB NFCリーダー（RC-S300など）とは直接互換性がありません
4. PCのブラウザからUSBデバイスにアクセスするには、Web Serial APIやWebUSB APIが必要ですが、Web NFC APIはこれらを使用しません

## 実装オプション

### オプション1: Electronアプリケーション（RC-S300を使用可能）

**メリット：**
- 既存のRC-S300をそのまま使用可能
- PCで動作するネイティブアプリケーション
- SDK for NFC Liteを使用して実装可能

**デメリット：**
- Electronアプリの開発・メンテナンスが必要
- デスクトップアプリの配布・更新が必要
- Webアプリとは別のコードベースが必要

**実装方法：**
1. Electronアプリを作成
2. SDK for NFC Liteを統合
3. RC-S300と通信するネイティブモジュールを実装
4. CRMからElectronアプリを起動する仕組みを構築

### オプション2: Androidタブレット/スマートフォン（推奨）

**メリット：**
- 現在のWeb NFC API実装をそのまま使用可能
- 追加の開発が不要
- モバイルデバイスで動作するため、現場での使用に適している
- ブラウザベースなので、アップデートが容易

**デメリット：**
- 新しいデバイスの購入が必要
- Androidデバイスが必要（Chrome 89以降）

**推奨デバイス：**
- Androidタブレット（10インチ以上推奨）
- Chromeブラウザがインストール可能なデバイス
- NFC機能搭載デバイス

**価格目安：**
- 中古Androidタブレット: 10,000円〜30,000円
- 新品Androidタブレット: 20,000円〜50,000円

### オプション3: ハイブリッドアプローチ

**実装方法：**
1. Web NFC APIをメイン実装として使用（Androidデバイス）
2. RC-S300用のElectronアプリを補助的に提供（PC環境が必要な場合）

## 推奨案

**オプション2（Androidタブレット）を推奨**

理由：
1. **開発コストが低い**: 既存のWeb NFC API実装をそのまま使用可能
2. **メンテナンスが容易**: Webアプリの一部として管理可能
3. **現場での使用に適している**: モバイルデバイスで動作
4. **コストパフォーマンス**: デバイス購入コストは低め

## 実装チェックリスト

### Web NFC API実装（現在の実装）
- [x] Web NFC APIの基本実装
- [x] エラーハンドリング
- [x] ブラウザサポートチェック
- [x] HTTPS環境チェック
- [x] CRM統合

### RC-S300用実装（必要な場合）
- [ ] Electronアプリケーションのセットアップ
- [ ] SDK for NFC Liteの統合
- [ ] RC-S300との通信実装
- [ ] CRM連携機能
- [ ] デスクトップアプリの配布

## 次のステップ

1. **Androidタブレットを購入**（推奨）
   - NFC機能搭載のAndroidタブレットを購入
   - Chromeブラウザをインストール
   - CRMページでNFC書き込み機能をテスト

2. **RC-S300用Electronアプリを開発**（必要な場合）
   - Electronプロジェクトのセットアップ
   - SDK for NFC Liteの統合
   - CRMとの連携機能の実装

## 参考資料

- [Web NFC API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API)
- [Sony SDK for NFC Lite](https://felica-biz.sony.co.jp/sdk/lite)
- [RC-S300 仕様書](https://www.sony.co.jp/Products/felica/business/data/RC-S300_J.pdf)

