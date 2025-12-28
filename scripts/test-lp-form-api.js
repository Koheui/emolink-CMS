/**
 * LPフォームAPIの動作確認スクリプト
 * 
 * 使用方法:
 * node scripts/test-lp-form-api.js
 */

const BASE_URL = process.env.CMS_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/lp-form`;

async function testLpFormAPI() {
  console.log('=== LPフォームAPI動作確認 ===\n');
  console.log(`エンドポイント: ${API_ENDPOINT}\n`);

  // テストデータ
  const testData = {
    email: `test-${Date.now()}@example.com`,
    tenant: 'dev',
    lpId: 'local',
    productType: 'acrylic',
    recaptchaToken: 'dev-token',
    link: 'https://emolink-cms.web.app/claim?k=test-jwt-token',
    secretKey: 'test-secret-key-12345',
  };

  console.log('送信データ:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('\n---\n');

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify(testData),
    });

    const responseData = await response.json();

    console.log('レスポンスステータス:', response.status);
    console.log('レスポンスデータ:');
    console.log(JSON.stringify(responseData, null, 2));

    if (response.ok && responseData.ok) {
      console.log('\n✅ 成功: データが正常に保存されました');
      console.log(`Request ID: ${responseData.requestId}`);
      return true;
    } else {
      console.log('\n❌ 失敗: エラーが発生しました');
      console.log('エラー内容:', responseData.error || responseData);
      return false;
    }
  } catch (error) {
    console.error('\n❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
    return false;
  }
}

// 実行
if (require.main === module) {
  testLpFormAPI()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('予期しないエラー:', error);
      process.exit(1);
    });
}

module.exports = { testLpFormAPI };


