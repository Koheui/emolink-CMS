# CORSエラーについて - LP側とCMS側の責任

## 📋 結論

**CORSエラーはCMS側（サーバー側）の問題です。LP側の問題ではありません。**

## 🔍 CORSエラーの仕組み

### ブラウザのセキュリティポリシー

ブラウザは、異なるオリジン（ドメイン）からのリクエストをセキュリティ上の理由で制限しています。

```
LP側（https://emolink-tenant-form.web.app）
  ↓ リクエスト送信
CMS側（https://your-project.vercel.app/api/lp-form）
  ↓ レスポンス（CORSヘッダーがない）
ブラウザがブロック ❌
```

### なぜCMS側の問題なのか？

1. **ブラウザのセキュリティポリシー**
   - ブラウザは、異なるオリジンからのリクエストを自動的にブロックします
   - これはブラウザの標準的な動作です

2. **サーバー側で許可する必要がある**
   - サーバー側（CMS側）でCORSヘッダーを返す必要があります
   - `Access-Control-Allow-Origin` ヘッダーがないと、ブラウザがリクエストをブロックします

3. **LP側は正しく動作している**
   - LP側は正しくリクエストを送信しています
   - 問題は、CMS側がCORSヘッダーを返していないことです

## ✅ 修正内容

### CMS側で修正が必要な項目

1. **CORSヘッダーの設定**
   ```typescript
   response.headers.set('Access-Control-Allow-Origin', '*');
   response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
   response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Origin, Referer');
   ```

2. **OPTIONSリクエスト（preflight）の処理**
   ```typescript
   export async function OPTIONS(request: NextRequest) {
     const response = new NextResponse(null, { status: 204 });
     return setCorsHeaders(response);
   }
   ```

### LP側で必要な項目

LP側は以下のように正しく実装されていれば問題ありません：

```javascript
fetch('https://your-project.vercel.app/api/lp-form', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://emolink.cloud'
  },
  body: JSON.stringify({...})
})
```

## 📊 責任の分担

| 項目 | LP側 | CMS側 |
|------|------|-------|
| リクエストの送信 | ✅ 実装済み | - |
| CORSヘッダーの設定 | ❌ 不要 | ✅ **必要（修正済み）** |
| OPTIONSリクエストの処理 | ❌ 不要 | ✅ **必要（修正済み）** |
| データのバリデーション | ❌ 不要 | ✅ 実装済み |
| エラーハンドリング | ✅ 実装済み | ✅ 実装済み |

## 🎯 まとめ

- **CORSエラーはCMS側（サーバー側）の問題です**
- LP側は正しくリクエストを送信しています
- CMS側でCORSヘッダーを設定する必要があります（既に修正済み）
- 修正後、LP側からのリクエストが正常に処理されるようになります

## 📝 参考

- [MDN: CORS](https://developer.mozilla.org/ja/docs/Web/HTTP/CORS)
- [Next.js: API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

*作成日時: 2025年1月*

