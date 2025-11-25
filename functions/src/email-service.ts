import nodemailer from 'nodemailer';

// メール送信設定
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * テナントごとのメールカスタマイズ設定
 */
interface TenantEmailConfig {
  brandName: string;           // ブランド名（例：「ペット想い出リンク」）
  companyName: string;          // 企業名（例：「ペットメモリー株式会社」）
  productName: string;          // 商品名（例：「NFCタグ付きアクリルスタンド」）
  serviceDescription: string;   // サービス説明（例：「大切なペットとの想い出をデジタルで残すサービス」）
  supportEmail: string;
  logoUrl?: string;
  primaryColor: string;
  customMessage?: string;
}

const tenantEmailConfigs: Record<string, TenantEmailConfig> = {
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
export async function sendSecretKeyEmail(
  email: string, 
  secretKey: string, 
  labels: {
    tenantId: string;
    lpId: string;
    productType: string;
    product?: string;  // 新規：商品名を直接入力
    orderId: string;
  }
) {
  const productTypeNames = {
    'acrylic': 'NFCタグ付きアクリルスタンド',
    'digital': 'デジタル想い出ページ',
    'premium': 'プレミアム想い出サービス',
    'standard': 'スタンダード想い出サービス'
  };

  // 商品名を決定（product があれば product、なければ productType から変換）
  const productName = labels.product || productTypeNames[labels.productType as keyof typeof productTypeNames] || labels.productType;

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
          <p><strong>商品名:</strong> ${productName}</p>
          <p><strong>テナント:</strong> ${labels.tenantId}</p>
          <p><strong>LP:</strong> ${labels.lpId}</p>
          <p><strong>注文ID:</strong> ${labels.orderId}</p>
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
  } catch (error) {
    console.error('Error sending secret key email:', error);
    throw error;
  }
}

/**
 * 注文完了通知メール
 */
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

/**
 * 顧客向け：ログインURLと秘密鍵をメールで送信
 */
export async function sendCustomerLoginEmail(
  email: string,
  secretKey: string,
  loginUrl: string,
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
            この度は、${config.productName}をご注文いただき、誠にありがとうございます。<br>
            こちらの情報でログインして、思い出を編集・公開していただけます。
          </p>
        </div>
        
        <div style="background: #f0f8ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid ${config.primaryColor};">
          <p style="margin: 0; font-size: 14px; color: #333;">
            <strong>商品名:</strong> ${config.productName}<br>
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
            <li>思い出を編集・公開</li>
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
  } catch (error) {
    console.error('Error sending customer login email:', error);
    throw error;
  }
}
