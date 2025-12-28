# CORSエラー修正

## 📋 問題

LPフォームAPI（`/api/lp-form`）にブラウザからアクセスした際、CORSエラーが発生していました。

```
Access to fetch at 'https://your-project.vercel.app/api/lp-form' from origin 'https://emolink-tenant-form.web.app' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 🔧 修正内容

### 1. CORSヘッダー設定関数の追加

`src/app/api/lp-form/route.ts`にCORSヘッダーを設定する関数を追加しました。

```typescript
// CORSヘッダーを設定する関数
function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Origin, Referer');
  response.headers.set('Access-Control-Max-Age', '3600');
  return response;
}
```

### 2. OPTIONSメソッドハンドラーの追加

preflightリクエスト（OPTIONS）を処理するハンドラーを追加しました。

```typescript
// OPTIONSリクエスト（preflight）を処理
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}
```

### 3. すべてのレスポンスにCORSヘッダーを設定

すべてのレスポンス（成功・エラー問わず）にCORSヘッダーを設定するように修正しました。

```typescript
// 修正前
return NextResponse.json({ ok: true, ... });

// 修正後
const response = NextResponse.json({ ok: true, ... });
return setCorsHeaders(response);
```

## ✅ 修正後の動作

- ブラウザからのリクエストが正常に処理される
- preflightリクエスト（OPTIONS）が正しく処理される
- すべてのレスポンスにCORSヘッダーが含まれる

## 🧪 テスト方法

### ブラウザの開発者ツールからテスト

1. ブラウザの開発者ツールを開く（F12）
2. Consoleタブを開く
3. 以下のコードを実行（実際のVercel URLに置き換えてください）

```javascript
fetch('https://your-actual-vercel-url.vercel.app/api/lp-form', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://emolink.cloud'
  },
  body: JSON.stringify({
    email: 'test@example.com',
    tenant: 'dev',
    lpId: 'local',
    productType: 'acrylic',
    recaptchaToken: 'dev-token',
    link: 'https://emolink-cms.web.app/claim?k=test-jwt-token',
    secretKey: 'test-secret-key-12345'
  })
})
.then(response => response.json())
.then(data => console.log('Response:', data))
.catch(error => console.error('Error:', error));
```

### 注意事項

- `https://your-project.vercel.app` を実際のVercelのURLに置き換えてください
- 本番環境では、`Access-Control-Allow-Origin: *` を特定のドメインに制限することを推奨します

## 📝 セキュリティに関する注意

現在の実装では、`Access-Control-Allow-Origin: *` を使用しています。これは開発環境やテスト環境では問題ありませんが、本番環境では以下のように特定のドメインに制限することを推奨します。

```typescript
function setCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const allowedOrigins = [
    'https://emolink.cloud',
    'https://emolink-tenant-form.web.app',
    // その他の許可されたドメイン
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Origin, Referer');
  response.headers.set('Access-Control-Max-Age', '3600');
  return response;
}
```

---

*作成日時: 2025年1月*


