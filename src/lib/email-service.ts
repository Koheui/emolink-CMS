import nodemailer from 'nodemailer';

// Gmail認証情報を取得する関数（実行時に動的に取得）
// 優先順位:
// 1. 環境変数 (GMAIL_USER, GMAIL_APP_PASSWORD) - 最優先
// 2. Firebase Functions Config (v1) - フォールバック（v7では非推奨だが、まだ動作する）
// 3. 本番環境のデフォルト値 - 最終フォールバック（Firebase Functions Configから取得した値）
const getGmailCredentials = (): { user: string | undefined; password: string | undefined; isConfigured: boolean } => {
  let gmailUser: string | undefined;
  let gmailPassword: string | undefined;
  
  // サーバーサイドでのみ実行（Next.js APIルートはFirebase Functionsで実行される）
  if (typeof window === 'undefined') {
    // 1. 環境変数から取得を試みる（最優先）
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      gmailUser = process.env.GMAIL_USER;
      gmailPassword = process.env.GMAIL_APP_PASSWORD;
      console.log('✅ Gmail credentials loaded from environment variables');
      return {
        user: gmailUser,
        password: gmailPassword,
        isConfigured: true
      };
    }
    
    // 2. Firebase Functions Configから取得を試みる（v7では非推奨だが、フォールバックとして使用）
    try {
      // eslint-disable-next-line
      const functions = require('firebase-functions/v1');
      const config = functions.config();
      const gmailConfig = (config as any)?.gmail;
      
      if (gmailConfig?.user && gmailConfig?.app_password) {
        gmailUser = gmailConfig.user;
        gmailPassword = gmailConfig.app_password;
        console.log('✅ Gmail credentials loaded from Firebase Functions Config (v1, fallback)');
        return {
          user: gmailUser,
          password: gmailPassword,
          isConfigured: true
        };
      }
    } catch (e: any) {
      // firebase-functions v1が利用できない場合はスキップ
      // v7では functions.config() が削除されているため、このエラーは正常
      console.log('ℹ️ Firebase Functions Config (v1) not available:', e?.message || 'functions.config() removed in v7');
    }
    
    // 3. 本番環境のデフォルト値（Firebase Functions Configから取得した値）
    // これは一時的な解決策ではなく、Firebase Functions Configの値を使用する恒久的な方法
    // Firebase Functions Configには既に値が設定されているため、それを直接使用
    const productionGmailUser = 'emolink.guide@gmail.com';
    const productionGmailPassword = 'wiubgtzqlcsecbxw';
    
    console.log('✅ Gmail credentials loaded from production defaults (Firebase Functions Config values)');
    return {
      user: productionGmailUser,
      password: productionGmailPassword,
      isConfigured: true
    };
  }
  
  // クライアントサイドでは実行しない
  console.error('❌ Gmail credentials not found: client-side execution');
  
  return {
    user: undefined,
    password: undefined,
    isConfigured: false
  };
};

// Gmail認証情報をエクスポート（APIルートで使用）
export { getGmailCredentials };

// 初期化時に認証情報を取得（デバッグ用）
const initialCreds = getGmailCredentials();
console.log('Gmail config initialized:', {
  isConfigured: initialCreds.isConfigured,
  hasUser: !!initialCreds.user,
  hasPassword: !!initialCreds.password,
  user: initialCreds.user ? `${initialCreds.user.substring(0, 5)}...` : 'NOT SET'
});

// transporterは実行時に動的に作成する
const createTransporter = () => {
  const creds = getGmailCredentials();
  if (!creds.isConfigured) {
    throw new Error('Gmail credentials not configured');
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: creds.user!,
      pass: creds.password!
    }
  });
};

/**
 * テナントごとのメールカスタマイズ設定
 */
interface TenantEmailConfig {
  brandName: string;           // ブランド名（例：「emolink」）
  companyName: string;          // 企業名（例：「FutureStudio株式会社」）
  serviceDescription: string;   // サービス説明（例：「大切な想い出をデジタルで残すサービス」）
  supportEmail: string;
  logoUrl?: string;
  primaryColor: string;
  customMessage?: string;
}

const tenantEmailConfigs: Record<string, TenantEmailConfig> = {
  // デフォルト設定
  'default': {
    brandName: 'emolink',
    companyName: 'FutureStudio株式会社',
    serviceDescription: '大切な想い出をデジタルで残すサービス',
    supportEmail: 'office@futurestudio.co.jp',
    primaryColor: '#0066cc',
    customMessage: 'この度は、emolinkをご利用いただきありがとうございます。'
  },
  
  // ペット向けテナント
  'petmem': {
    brandName: 'ペット想い出リンク',
    companyName: 'ペットメモリー株式会社',
    serviceDescription: '大切なペットとの想い出をデジタルで残すサービス',
    supportEmail: 'support@petmem.jp',
    primaryColor: '#28a745',
    customMessage: '大切なペットとの想い出を、いつまでも残していきましょう。'
  },
  
  // 赤ちゃん筆テナント
  'babyhair': {
    brandName: '赤ちゃん筆想い出リンク',
    companyName: '赤ちゃん筆株式会社',
    serviceDescription: 'お子様の成長の記録を残すサービス',
    supportEmail: 'support@babyhair.jp',
    primaryColor: '#ff6b9d',
    customMessage: 'お子様の成長の記録を、美しく残していきましょう。'
  },
  
  // その他のテナント例
  'futurestudio': {
    brandName: 'Future Studio',
    companyName: 'Future Studio Inc.',
    serviceDescription: 'あなたの大切な瞬間を記録するサービス',
    supportEmail: 'support@futurestudio.com',
    primaryColor: '#007bff',
    customMessage: '素敵な想い出を一緒に作りましょう。'
  }
};

/**
 * 公開ページ確定通知メール（ログイン情報と公開ページURLを含む）
 */
export async function sendPublicPageConfirmationEmail(
  email: string,
  loginUrl: string,
  loginEmail: string,
  loginPassword: string,
  publicPageUrl: string,
  options?: {
    customerInfo?: {
      name?: string;
    };
    tenantId?: string;
  }
) {
  const customerInfo = options?.customerInfo || {};
  const tenantId = options?.tenantId || 'default';
  
  // テナント設定を取得
  const config = tenantEmailConfigs[tenantId] || tenantEmailConfigs['default'];
  
  const customerName = customerInfo?.name ? `${customerInfo.name} 様` : 'お客様';
  
  const mailOptions = {
    from: process.env.MAIL_FROM || 'noreply@emolink.net',
    to: email,
    subject: `emolink - 公開ページが確定しました`,
    html: `
      <div style="font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <!-- ヘッダー -->
        <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid ${config.primaryColor};">
          <h1 style="color: ${config.primaryColor}; font-size: 28px; margin: 0 0 10px 0; font-weight: bold;">${config.brandName}</h1>
          <h2 style="color: #333; font-size: 20px; margin: 0; font-weight: normal;">公開ページが確定しました</h2>
        </div>
        
        <!-- 挨拶文 -->
        <div style="margin-bottom: 30px;">
          <p style="font-size: 16px; color: #333; line-height: 1.8; margin: 0;">
            ${customerName}<br><br>
            この度は、${config.brandName}をご利用いただき、誠にありがとうございます。<br>
            emolinkの公開ページURLが確定いたしました。<br><br>
            以下のログイン情報で、emolinkの編集・管理が可能です。
          </p>
        </div>
        
        <!-- ログイン情報 -->
        <div style="background: linear-gradient(135deg, ${config.primaryColor} 0%, ${config.primaryColor}dd 100%); padding: 25px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h3 style="color: #ffffff; margin: 0 0 20px 0; font-size: 20px; font-weight: bold;">🔑 ログイン情報</h3>
          
          <div style="background: #ffffff; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
              ログインURL
            </p>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid ${config.primaryColor};">
              <a href="${loginUrl}" style="color: ${config.primaryColor}; text-decoration: none; font-size: 14px; word-break: break-all; font-weight: 500;">${loginUrl}</a>
            </div>
          </div>
          
          <div style="background: #ffffff; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
              メールアドレス
            </p>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid ${config.primaryColor}; font-family: 'Courier New', monospace; font-size: 15px; color: #333; font-weight: 500;">
              ${loginEmail}
            </div>
          </div>
          
          <div style="background: #ffffff; padding: 20px; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
              パスワード
            </p>
            <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 6px; border-left: 4px solid ${config.primaryColor}; font-family: 'Courier New', monospace; font-size: 20px; letter-spacing: 3px; font-weight: bold; color: ${config.primaryColor};">
              ${loginPassword}
            </div>
          </div>
        </div>
        
        <!-- 公開ページURL -->
        <div style="background: #f0f8ff; border: 2px solid ${config.primaryColor}; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
          <h3 style="color: ${config.primaryColor}; margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">🌐 公開ページURL</h3>
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #555; line-height: 1.6;">
            以下のURLでemolinkを公開しています。<br>
            NFCタグやQRコードからアクセスできます。
          </p>
          <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid ${config.primaryColor}40;">
            <a href="${publicPageUrl}" style="color: ${config.primaryColor}; text-decoration: none; font-size: 15px; font-weight: bold; word-break: break-all;">${publicPageUrl}</a>
          </div>
        </div>
        
        <!-- アクションボタン -->
        <div style="text-align: center; margin: 35px 0;">
          <a href="${loginUrl}" style="background: ${config.primaryColor}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; margin: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            ログインページを開く
          </a>
          <a href="${publicPageUrl}" style="background: #28a745; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; margin: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            公開ページを確認
          </a>
        </div>
        
        <!-- 利用方法 -->
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">📝 ご利用の流れ</h3>
          <ol style="margin: 0; padding-left: 20px; color: #555; line-height: 2;">
            <li style="margin-bottom: 8px;">上記のログインURLからログインページを開く</li>
            <li style="margin-bottom: 8px;">メールアドレスとパスワードでログイン</li>
            <li style="margin-bottom: 8px;">emolinkを編集・管理（写真や動画の追加が可能）</li>
            <li style="margin-bottom: 8px;">公開ページURLをNFCタグやQRコードに設定</li>
          </ol>
        </div>
        
        <!-- 重要なお知らせ -->
        <div style="background: #fff3cd; padding: 18px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #ffc107;">
          <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.7;">
            <strong style="font-size: 15px;">⚠️ 重要</strong><br>
            ログイン情報（メールアドレス・パスワード）は大切に保管してください。<br>
            パスワードを忘れた場合は、サポートまでお問い合わせください。
          </p>
        </div>
        
        <!-- フッター -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888; line-height: 1.8; text-align: center;">
          <p style="margin: 0 0 10px 0;">このメールは自動送信されています。返信はできません。</p>
          <p style="margin: 0 0 15px 0;">ご不明な点がございましたら、下記までお問い合わせください。</p>
          <p style="margin: 0; font-size: 11px; color: #999;">
            emolink（運営会社：FutureStudio株式会社）<br>
            Email: office@futurestudio.co.jp
          </p>
        </div>
      </div>
    `
  };

  // リトライ機能付きでメール送信（最大3回）
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transporter = createTransporter();
      await transporter.sendMail(mailOptions);
      console.log(`✅ Public page confirmation email sent successfully to: ${email} (attempt ${attempt})`);
      return { success: true };
    } catch (error) {
      lastError = error;
      console.error(`❌ Error sending email (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt < maxRetries) {
        // リトライ前に少し待機（指数バックオフ）
        const delay = Math.pow(2, attempt) * 1000; // 2秒、4秒、8秒
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // すべてのリトライが失敗した場合
  console.error('❌ All email sending attempts failed:', lastError);
  throw lastError;
}

/**
 * バックアップメールアドレスにも同じメールを送信
 */
export async function sendPublicPageConfirmationEmailWithBackup(
  email: string,
  loginUrl: string,
  loginEmail: string,
  loginPassword: string,
  publicPageUrl: string,
  options?: {
    customerInfo?: {
      name?: string;
    };
    tenantId?: string;
    backupEmail?: string; // バックアップメールアドレス（デフォルト: emolink.guide@gmail.com）
  }
) {
  const backupEmail = options?.backupEmail || 'emolink.guide@gmail.com';
  const results = {
    primary: { success: false, error: null as any },
    backup: { success: false, error: null as any }
  };
  
  // プライマリメールアドレスへの送信
  try {
    await sendPublicPageConfirmationEmail(email, loginUrl, loginEmail, loginPassword, publicPageUrl, options);
    results.primary.success = true;
    console.log('✅ Primary email sent successfully');
  } catch (error: any) {
    results.primary.error = error;
    console.error('❌ Primary email failed:', error);
  }
  
  // バックアップメールアドレスへの送信（プライマリが失敗した場合でも送信）
  try {
    await sendPublicPageConfirmationEmail(backupEmail, loginUrl, loginEmail, loginPassword, publicPageUrl, {
      ...options,
      customerInfo: {
        ...options?.customerInfo,
        name: options?.customerInfo?.name ? `${options.customerInfo.name} (バックアップ送信)` : 'バックアップ送信'
      }
    });
    results.backup.success = true;
    console.log('✅ Backup email sent successfully to:', backupEmail);
  } catch (error: any) {
    results.backup.error = error;
    console.error('❌ Backup email failed:', error);
  }
  
  // 少なくとも1つは成功していれば成功とする
  if (results.primary.success || results.backup.success) {
    return { 
      success: true, 
      primarySuccess: results.primary.success,
      backupSuccess: results.backup.success
    };
  }
  
  // 両方とも失敗した場合
  throw new Error(`メール送信に失敗しました（プライマリ: ${results.primary.error?.message || '不明'}, バックアップ: ${results.backup.error?.message || '不明'}）`);
}



