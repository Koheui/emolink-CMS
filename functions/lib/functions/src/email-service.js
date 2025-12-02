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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSecretKeyEmail = sendSecretKeyEmail;
exports.sendCustomerLoginEmail = sendCustomerLoginEmail;
exports.sendPublicPageConfirmationEmail = sendPublicPageConfirmationEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const functions = __importStar(require("firebase-functions/v1"));
// メール送信設定
// Firebase Functions Configから取得、なければ環境変数から取得
const getGmailConfig = () => {
    try {
        // @ts-ignore - functions.config()の型定義の問題を回避
        const config = functions.config();
        return config === null || config === void 0 ? void 0 : config.gmail;
    }
    catch (e) {
        return null;
    }
};
const gmailConfig = getGmailConfig();
const gmailUser = (gmailConfig === null || gmailConfig === void 0 ? void 0 : gmailConfig.user) || process.env.GMAIL_USER;
const gmailPassword = (gmailConfig === null || gmailConfig === void 0 ? void 0 : gmailConfig.app_password) || process.env.GMAIL_APP_PASSWORD;
// デバッグログ（本番環境では削除推奨）
console.log('Gmail config loaded:', {
    hasConfig: !!gmailConfig,
    user: gmailUser ? `${gmailUser.substring(0, 5)}...` : 'NOT SET',
    password: gmailPassword ? 'SET' : 'NOT SET'
});
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: gmailUser,
        pass: gmailPassword
    }
});
const tenantEmailConfigs = {
    // デフォルト設定
    'default': {
        brandName: '想い出リンク',
        companyName: '想い出リンク株式会社',
        productName: 'NFCタグ付きアクリルスタンド',
        serviceDescription: '大切な想い出をデジタルで残すサービス',
        supportEmail: 'support@emolink.net',
        primaryColor: '#0066cc',
        customMessage: 'この度は、想い出リンクをご利用いただきありがとうございます。'
    },
    // ペット向けテナント
    'petmem': {
        brandName: 'ペット想い出リンク',
        companyName: 'ペットメモリー株式会社',
        productName: 'NFCタグ付きペットアクリルスタンド',
        serviceDescription: '大切なペットとの想い出をデジタルで残すサービス',
        supportEmail: 'support@petmem.jp',
        primaryColor: '#28a745',
        customMessage: '大切なペットとの想い出を、いつまでも残していきましょう。'
    },
    // 赤ちゃん筆テナント
    'babyhair': {
        brandName: '赤ちゃん筆想い出リンク',
        companyName: '赤ちゃん筆株式会社',
        productName: '赤ちゃんの初めての髪の毛をおさめるNFCタグ付きスタンド',
        serviceDescription: 'お子様の成長の記録を残すサービス',
        supportEmail: 'support@babyhair.jp',
        primaryColor: '#ff6b9d',
        customMessage: 'お子様の成長の記録を、美しく残していきましょう。'
    },
    // その他のテナント例
    'futurestudio': {
        brandName: 'Future Studio',
        companyName: 'Future Studio Inc.',
        productName: 'NFCタグ付きメモリースタンド',
        serviceDescription: 'あなたの大切な瞬間を記録するサービス',
        supportEmail: 'support@futurestudio.com',
        primaryColor: '#007bff',
        customMessage: '素敵な想い出を一緒に作りましょう。'
    }
};
/**
 * 秘密鍵をメールで送信
 */
async function sendSecretKeyEmail(email, secretKey, labels) {
    // 商品名はデータベースに記載されているため、メール本文には表示しない
    // 店舗側の識別のため、テナントIDと注文IDを表示
    const mailOptions = {
        from: 'noreply@emolink.net',
        to: email,
        subject: 'CMS - 秘密鍵のお知らせ',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">CMS - 秘密鍵</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 16px; color: #555;">
            決済が完了しました。以下の秘密鍵でCMSにログインしてください。
          </p>
        </div>
        
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-family: monospace; font-size: 18px; letter-spacing: 2px; border-radius: 8px; margin: 20px 0;">
          <strong style="color: #0066cc;">${secretKey}</strong>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #f0f8ff; border-left: 4px solid #0066cc; border-radius: 4px;">
          <h3 style="color: #0066cc; margin-top: 0;">注文詳細</h3>
          <p><strong>注文ID:</strong> ${labels.orderId}</p>
          <p><strong>テナント:</strong> ${labels.tenantId}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://emolink.net" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            CMSにアクセス
          </a>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>重要:</strong> この秘密鍵は30日間有効です。一度使用すると無効になります。
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
          <p>このメールは自動送信されています。返信はできません。</p>
          <p>ご質問がございましたら、サポートまでお問い合わせください。</p>
        </div>
      </div>
    `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('Secret key email sent successfully to:', email);
    }
    catch (error) {
        console.error('Error sending secret key email:', error);
        throw error;
    }
}
/**
 * 注文完了通知メール
 * 【未使用】現在は使用されていません。将来の使用に備えてコメントアウトしています。
 */
/*
export async function sendOrderCompletionEmail(
  email: string,
  orderId: string,
  shippingInfo: {
    trackingNumber?: string;
    estimatedDelivery?: string;
  }
) {
  const mailOptions = {
    from: 'noreply@emolink.net',
    to: email,
    subject: 'CMS - 注文完了のお知らせ',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">注文完了のお知らせ</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 16px; color: #555;">
            ご注文いただいた商品の制作が完了し、配送を開始いたしました。
          </p>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #f0f8ff; border-left: 4px solid #0066cc; border-radius: 4px;">
          <h3 style="color: #0066cc; margin-top: 0;">配送情報</h3>
          <p><strong>注文ID:</strong> ${orderId}</p>
          ${shippingInfo.trackingNumber ? `<p><strong>追跡番号:</strong> ${shippingInfo.trackingNumber}</p>` : ''}
          ${shippingInfo.estimatedDelivery ? `<p><strong>お届け予定:</strong> ${shippingInfo.estimatedDelivery}</p>` : ''}
        </div>
        
        <div style="background: #d4edda; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #155724; font-size: 14px;">
            <strong>ご注意:</strong> 商品到着後、CMSで想い出ページの編集が可能になります。
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
          <p>このメールは自動送信されています。返信はできません。</p>
          <p>ご質問がございましたら、サポートまでお問い合わせください。</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Order completion email sent successfully to:', email);
  } catch (error) {
    console.error('Error sending order completion email:', error);
    throw error;
  }
}
*/
/**
 * 顧客向け：ログインURLと秘密鍵をメールで送信
 */
async function sendCustomerLoginEmail(email, secretKey, loginUrl, options) {
    const customerInfo = (options === null || options === void 0 ? void 0 : options.customerInfo) || {};
    const tenantId = (options === null || options === void 0 ? void 0 : options.tenantId) || 'default';
    // テナント設定を取得
    const config = tenantEmailConfigs[tenantId] || tenantEmailConfigs['default'];
    const customerName = (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.name) ? `${customerInfo.name} 様` : 'お客様';
    const mailFrom = (gmailConfig === null || gmailConfig === void 0 ? void 0 : gmailConfig.user) || process.env.MAIL_FROM || 'noreply@emolink.net';
    const mailOptions = {
        from: mailFrom,
        to: email,
        subject: `${config.brandName}へようこそ - ログイン情報`,
        html: `
      <div style="font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; font-size: 24px; margin: 0;">${config.brandName}へようこそ</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="font-size: 16px; color: #555; margin: 0;">
            ${customerName}<br>
            ${config.customMessage}<br>
            この度は、${config.brandName}をご利用いただき、誠にありがとうございます。<br>
            こちらの情報でログインして、emolinkを編集・公開していただけます。
          </p>
        </div>
        
        <div style="background: #f0f8ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid ${config.primaryColor};">
          <p style="margin: 0; font-size: 14px; color: #333;">
            <strong>サービス:</strong> ${config.serviceDescription}<br>
            <strong>提供元:</strong> ${config.companyName}
          </p>
        </div>
        
        <div style="background: #fff; border: 2px solid ${config.primaryColor}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: ${config.primaryColor}; margin-top: 0; font-size: 18px;">🔑 ログイン情報</h3>
          <p style="margin: 10px 0; font-size: 14px; color: #666;">
            <strong>ログインURL:</strong>
          </p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 15px; word-break: break-all;">
            <a href="${loginUrl}" style="color: ${config.primaryColor}; text-decoration: none; font-size: 14px;">${loginUrl}</a>
          </div>
          
          <p style="margin: 10px 0; font-size: 14px; color: #666;">
            <strong>秘密鍵:</strong>
          </p>
          <div style="background: #f5f5f5; padding: 15px; text-align: center; font-family: monospace; font-size: 18px; letter-spacing: 2px; border-radius: 4px; font-weight: bold; color: ${config.primaryColor};">
            ${secretKey}
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background: ${config.primaryColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
            ログインページを開く
          </a>
        </div>
        
        <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #004085; margin-top: 0; font-size: 16px;">📝 利用方法</h3>
          <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
            <li>上のボタンからログインページを開く</li>
            <li>秘密鍵を入力してログイン</li>
            <li>写真や動画をアップロード</li>
            <li>emolinkを編集・公開</li>
          </ol>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
            <strong>⚠️ 重要:</strong> この秘密鍵は一度だけ使用できます。ログイン後は自動的に保存されますので、メモを取る必要はありません。
          </p>
        </div>
        
        <div style="background: #d4edda; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #28a745;">
          <p style="margin: 0; color: #155724; font-size: 14px; line-height: 1.6;">
            <strong>💡 ヒント:</strong> ログイン後は、何度でも編集できます。思い出は後から追加・変更できますので、まずは気軽にはじめてみてください。
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; line-height: 1.6;">
          <p style="margin: 0 0 10px 0;">このメールは自動送信されています。返信はできません。</p>
          <p style="margin: 0;">ご不明な点がございましたら、サポートまでお問い合わせください。</p>
          <p style="margin: 10px 0 0 0; font-size: 11px; color: #999;">
            ${config.companyName} (${config.brandName})<br>
            Email: ${config.supportEmail}
          </p>
        </div>
      </div>
    `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('Customer login email sent successfully to:', email);
        return { success: true };
    }
    catch (error) {
        console.error('Error sending customer login email:', error);
        throw error;
    }
}
/**
 * 公開ページ確定通知メール（ログイン情報と公開ページURLを含む）
 */
async function sendPublicPageConfirmationEmail(email, loginUrl, loginEmail, loginPassword, publicPageUrl, options) {
    const customerInfo = (options === null || options === void 0 ? void 0 : options.customerInfo) || {};
    const tenantId = (options === null || options === void 0 ? void 0 : options.tenantId) || 'default';
    const productName = options === null || options === void 0 ? void 0 : options.productName; // 商品名を取得
    // テナント設定を取得
    const config = tenantEmailConfigs[tenantId] || tenantEmailConfigs['default'];
    const customerName = (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.name) ? `${customerInfo.name} 様` : 'お客様';
    const mailFrom = (gmailConfig === null || gmailConfig === void 0 ? void 0 : gmailConfig.user) || process.env.MAIL_FROM || 'noreply@emolink.net';
    // メールタイトル: 商品名があれば商品名、なければブランド名を使用
    const emailSubject = productName
        ? `${productName} - 公開ページが確定しました`
        : `${config.brandName} - 公開ページが確定しました`;
    const mailOptions = {
        from: mailFrom,
        to: email,
        subject: emailSubject,
        html: `
      <div style="font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; font-size: 24px; margin: 0;">公開ページが確定しました</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="font-size: 16px; color: #555; margin: 0;">
            ${customerName}<br>
            ${config.brandName}の公開ページURLが確定いたしました。<br>
            以下の情報でログインして、emolinkを編集・管理していただけます。
          </p>
        </div>
        
        <div style="background: #fff; border: 2px solid ${config.primaryColor}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: ${config.primaryColor}; margin-top: 0; font-size: 18px;">🔑 ログイン情報</h3>
          
          <div style="margin-bottom: 20px;">
            <p style="margin: 10px 0; font-size: 14px; color: #666; font-weight: bold;">
              ログイン用URL:
            </p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 15px; word-break: break-all;">
              <a href="${loginUrl}" style="color: ${config.primaryColor}; text-decoration: none; font-size: 14px;">${loginUrl}</a>
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p style="margin: 10px 0; font-size: 14px; color: #666; font-weight: bold;">
              ログインメールアドレス:
            </p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 15px; font-family: monospace; font-size: 14px; color: #333;">
              ${loginEmail}
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p style="margin: 10px 0; font-size: 14px; color: #666; font-weight: bold;">
              ログインパスワード:
            </p>
            <div style="background: #f5f5f5; padding: 15px; text-align: center; font-family: monospace; font-size: 18px; letter-spacing: 2px; border-radius: 4px; font-weight: bold; color: ${config.primaryColor};">
              ${loginPassword}
            </div>
          </div>
        </div>
        
        <div style="background: #e7f3ff; border: 2px solid ${config.primaryColor}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: ${config.primaryColor}; margin-top: 0; font-size: 18px;">🌐 公開ページURL</h3>
          <p style="margin: 10px 0; font-size: 14px; color: #666;">
            以下のURLでemolinkを公開しています。
          </p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 15px; word-break: break-all;">
            <a href="${publicPageUrl}" style="color: ${config.primaryColor}; text-decoration: none; font-size: 14px; font-weight: bold;">${publicPageUrl}</a>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background: ${config.primaryColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; margin-right: 10px;">
            ログインページを開く
          </a>
          <a href="${publicPageUrl}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
            公開ページを確認
          </a>
        </div>
        
        <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #004085; margin-top: 0; font-size: 16px;">📝 利用方法</h3>
          <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
            <li>ログイン用URLからログインページを開く</li>
            <li>メールアドレスとパスワードでログイン</li>
            <li>想い出ページを編集・管理</li>
            <li>公開ページURLをお届けのemolinkからアクセス</li>
          </ol>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
            <strong>⚠️ 重要:</strong> ログイン情報は大切に保管してください。パスワードを忘れた場合は、サポートまでお問い合わせください。
          </p>
        </div>
        
        <div style="background: #d4edda; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #28a745;">
          <p style="margin: 0; color: #155724; font-size: 14px; line-height: 1.6;">
            <strong>💡 ヒント:</strong> 公開ページURLはお届けのemolinkから、スマートフォンで簡単にアクセスできます。
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; line-height: 1.6;">
          <p style="margin: 0 0 10px 0;">このメールは自動送信されています。返信はできません。</p>
          <p style="margin: 0;">ご不明な点がございましたら、サポートまでお問い合わせください。</p>
          <p style="margin: 10px 0 0 0; font-size: 11px; color: #999;">
            ${config.companyName} (${config.brandName})<br>
            Email: ${config.supportEmail}
          </p>
        </div>
      </div>
    `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('Public page confirmation email sent successfully to:', email);
        return { success: true };
    }
    catch (error) {
        console.error('Error sending public page confirmation email:', error);
        throw error;
    }
}
//# sourceMappingURL=email-service.js.map