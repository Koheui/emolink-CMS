"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOgp = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
/**
 * URLからOGP情報を取得する
 * @param url 取得するURL
 * @returns OGP情報
 */
async function fetchOGP(url) {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; emolink-cms/1.0; +https://emolink.net)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                },
                timeout: 30000, // 30秒のタイムアウト
            }, (res) => {
                let html = '';
                // リダイレクト処理
                if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                    const location = res.headers.location;
                    if (location) {
                        // 相対URLの場合は絶対URLに変換
                        const redirectUrl = location.startsWith('http')
                            ? location
                            : new URL(location, url).toString();
                        console.log(`Redirecting to: ${redirectUrl}`);
                        req.destroy(); // 現在のリクエストを破棄
                        fetchOGP(redirectUrl).then(resolve).catch(reject);
                        return;
                    }
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    html += chunk;
                    // メモリ節約のため、最初の100KBのみを読み込む
                    if (html.length > 100000) {
                        res.destroy();
                    }
                });
                res.on('end', () => {
                    try {
                        const ogp = parseOGP(html, url);
                        resolve(ogp);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
                res.on('error', (error) => {
                    reject(error);
                });
            });
            req.on('error', (error) => {
                reject(error);
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.setTimeout(30000);
        }
        catch (error) {
            reject(error);
        }
    });
}
/**
 * HTMLからOGP情報を抽出
 * @param html HTML文字列
 * @param baseUrl ベースURL（相対URLを絶対URLに変換するため）
 * @returns OGP情報
 */
function parseOGP(html, baseUrl) {
    const ogp = {};
    // 正規表現でメタタグを抽出
    const metaTagRegex = /<meta\s+([^>]*?)>/gi;
    let match;
    while ((match = metaTagRegex.exec(html)) !== null) {
        const attributes = match[1];
        // property属性を抽出
        const propertyMatch = attributes.match(/property=["']([^"']+)["']/i);
        const contentMatch = attributes.match(/content=["']([^"']+)["']/i);
        if (propertyMatch && contentMatch) {
            const property = propertyMatch[1].toLowerCase();
            let content = contentMatch[1];
            // 相対URLを絶対URLに変換
            if (property.includes('image') && content && !content.startsWith('http')) {
                try {
                    content = new URL(content, baseUrl).toString();
                }
                catch (e) {
                    // URL変換に失敗した場合はスキップ
                    continue;
                }
            }
            if (property === 'og:title') {
                ogp.title = content;
            }
            else if (property === 'og:description') {
                ogp.description = content;
            }
            else if (property === 'og:image') {
                ogp.image = content;
            }
            else if (property === 'og:url') {
                ogp.url = content;
            }
        }
        // name属性もチェック（Twitter Cardsなど）
        const nameMatch = attributes.match(/name=["']([^"']+)["']/i);
        if (nameMatch && contentMatch) {
            const name = nameMatch[1].toLowerCase();
            let content = contentMatch[1];
            if (name === 'twitter:image' && !ogp.image) {
                if (content && !content.startsWith('http')) {
                    try {
                        content = new URL(content, baseUrl).toString();
                    }
                    catch (e) {
                        continue;
                    }
                }
                ogp.image = content;
            }
        }
    }
    // OGPが見つからない場合、titleタグを取得
    if (!ogp.title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            ogp.title = titleMatch[1].trim();
        }
    }
    return ogp;
}
/**
 * OGP取得API
 * GET /getOgp?url={url}
 */
exports.getOgp = functions
    .region('asia-northeast1')
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
})
    .https.onRequest(async (req, res) => {
    // CORS対応
    const setCorsHeaders = () => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
    if (req.method !== 'GET') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }
    try {
        const url = req.query.url;
        if (!url) {
            res.status(400).json({ ok: false, error: 'URL parameter is required' });
            return;
        }
        // URLのバリデーション
        try {
            new URL(url);
        }
        catch (error) {
            res.status(400).json({ ok: false, error: 'Invalid URL format' });
            return;
        }
        console.log(`[getOgp] Fetching OGP for URL: ${url}`);
        // OGP情報を取得（タイムアウト付き）
        const ogpPromise = fetchOGP(url);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout after 50 seconds')), 50000);
        });
        const ogp = await Promise.race([ogpPromise, timeoutPromise]);
        console.log(`[getOgp] OGP fetched successfully:`, ogp);
        res.status(200).json({
            ok: true,
            data: ogp,
        });
    }
    catch (error) {
        console.error('[getOgp] Error fetching OGP:', error);
        console.error('[getOgp] Error stack:', error === null || error === void 0 ? void 0 : error.stack);
        res.status(500).json({
            ok: false,
            error: error.message || 'Failed to fetch OGP',
        });
    }
});
//# sourceMappingURL=get-ogp.js.map