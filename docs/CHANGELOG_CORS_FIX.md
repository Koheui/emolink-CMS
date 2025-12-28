# CORSエラー修正レポート

## 📋 修正日時
2025-01-26

## 問題の概要
初期設定画面で`claimSetUrls` Firebase Functionを呼び出す際に、CORSエラーが発生していました。

## エラーメッセージ

```
Access to fetch at 'https://asia-northeast1-memorylink-cms.cloudfunctions.net/claimSetUrls?requestId=...' 
from origin 'https://emolink-cms.web.app' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 問題の原因

1. **OPTIONSリクエスト（preflight）の処理が不十分**
   - ブラウザがPOSTリクエストの前にOPTIONSリクエストを送信
   - OPTIONSリクエストに対するCORSヘッダーが正しく返されていない可能性

2. **CORSヘッダーの設定タイミング**
   - すべてのレスポンスにCORSヘッダーを設定する必要がある
   - エラーレスポンスにもCORSヘッダーが必要

## 修正内容

### 1. CORSヘッダーの設定を改善

**変更ファイル**: `functions/src/claim-set-urls.ts`

**修正内容**:
- OPTIONSリクエスト（preflight）を最初に処理
- すべてのレスポンスにCORSヘッダーを設定
- `Access-Control-Max-Age`ヘッダーを追加（preflightリクエストのキャッシュ）

**修正後のコード**:
```typescript
export const claimSetUrls = functions.region('asia-northeast1').https.onRequest(async (req: functions.Request, res: functions.Response) => {
  // CORS対応: OPTIONSリクエスト（preflight）を最初に処理
  const setCorsHeaders = () => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
  };

  // OPTIONSリクエスト（preflight）を処理
  if (req.method === 'OPTIONS') {
    setCorsHeaders();
    res.status(204).send('');
    return;
  }

  // すべてのレスポンスにCORSヘッダーを設定
  setCorsHeaders();
  
  // ... 以降の処理
});
```

### 2. エラーレスポンスにもCORSヘッダーを設定

すべてのエラーレスポンス（400, 404, 500等）にもCORSヘッダーが設定されるようにしました。

## 確認事項

1. **OPTIONSリクエストの処理**
   - ✅ OPTIONSリクエストを最初に処理
   - ✅ 204ステータスでレスポンスを返す
   - ✅ CORSヘッダーを設定

2. **すべてのレスポンスにCORSヘッダー**
   - ✅ 成功レスポンス（200）
   - ✅ エラーレスポンス（400, 404, 500）
   - ✅ OPTIONSレスポンス（204）

3. **CORSヘッダーの内容**
   - ✅ `Access-Control-Allow-Origin: *`
   - ✅ `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   - ✅ `Access-Control-Allow-Headers: Content-Type, Authorization`
   - ✅ `Access-Control-Max-Age: 3600`

## デプロイ

修正をデプロイしました：
```bash
firebase deploy --only functions:claimSetUrls
```

## 次のステップ

1. 初期設定画面で再度テスト
2. ブラウザの開発者ツールでネットワークリクエストを確認
3. CORSエラーが解消されたか確認

## 参考資料

- [Firebase Functions CORS](https://firebase.google.com/docs/functions/http-events#using_cors)
- [MDN CORS](https://developer.mozilla.org/ja/docs/Web/HTTP/CORS)

---

**作成日**: 2025-01-26  
**バージョン**: 1.0















