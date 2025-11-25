// メール送信テスト用スクリプト
// 使い方: node test-send-email.js

// 環境変数を読み込む（.envファイルがあれば）
require('dotenv').config();

// 環境変数を直接設定
process.env.GMAIL_USER = process.env.GMAIL_USER || 'cafegolazo@gmail.com';
process.env.GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || 'lwyfjxczlhkdmix';
process.env.MAIL_FROM = process.env.MAIL_FROM || 'noreply@emolink.net';

// nodemailerとemail-service を直接インポート
const nodemailer = require('nodemailer');

// メール送信関数を定義
async function sendCustomerLoginEmail(email, secretKey, loginUrl, customerInfo) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const customerName = customerInfo?.name ? `${customerInfo.name} 様` : 'お客様';
  
  const mailOptions = {
    from: process.env.MAIL_FROM,
    to: email,
    subject: '想い出ページへようこそ - ログイン情報',
    html: `
      <div style="font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">想い出ページへようこそ</h1>
        <p>${customerName}</p>
        <p>この度は、想い出リンクをご利用いただきありがとうございます。</p>
        <div style="background: #f5f5f5; padding: 15px; margin: 20px 0;">
          <p><strong>ログインURL:</strong> ${loginUrl}</p>
          <p><strong>秘密鍵:</strong> <code style="font-size: 18px; letter-spacing: 2px;">${secretKey}</code></p>
        </div>
        <p><a href="${loginUrl}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">ログインページを開く</a></p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  return { success: true };
}

// テスト実行
async function main() {
  console.log('📧 メール送信テストを開始します...\n');
  
  try {
    // ここに自分のメールアドレスを入力してください
    const testEmail = 'cafegolazo@gmail.com'; // テスト用メールアドレス
    
    // テストデータ（テナントIDを指定）
    const testData = {
      email: testEmail,
      secretKey: 'TEST123ABC456',
      loginUrl: 'https://emolink.net/login',
      name: 'テスト太郎',
      tenantId: 'petmem' // ペット向けテナントでテスト
    };
    
    console.log('送信先:', testData.email);
    console.log('秘密鍵:', testData.secretKey);
    console.log('ログインURL:', testData.loginUrl);
    console.log('テナントID:', testData.tenantId);
    console.log('---');
    
    // メール送信（テナントIDを指定）
    await sendCustomerLoginEmail(
      testData.email,
      testData.secretKey,
      testData.loginUrl,
      {
        customerInfo: { name: testData.name },
        tenantId: testData.tenantId
      }
    );
    
    console.log('✅ メール送信成功！');
    console.log('📬 メールを確認してください。');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:');
    console.error(error.message);
    
    if (error.message.includes('auth')) {
      console.log('\n💡 考えられる原因:');
      console.log('1. GMAIL_USER 環境変数が設定されていない');
      console.log('2. GMAIL_APP_PASSWORD が間違っている');
      console.log('3. Gmail の App Password を作成してください');
    }
  }
  
  process.exit(0);
}

main();
