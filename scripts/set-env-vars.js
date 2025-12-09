#!/usr/bin/env node

/**
 * Firebase Functions Configの値をCloud Runの環境変数として設定するスクリプト
 * 
 * 使用方法:
 * node scripts/set-env-vars.js
 */

const { execSync } = require('child_process');

const PROJECT_ID = 'memorylink-cms';
const SERVICE_NAME = 'ssremolinkcms';
const REGION = 'asia-northeast1';

// Firebase Functions Configから値を取得
function getFirebaseConfig() {
  try {
    const configOutput = execSync('firebase functions:config:get gmail', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    const config = JSON.parse(configOutput);
    return {
      user: config.user,
      app_password: config.app_password
    };
  } catch (error) {
    console.error('❌ Failed to get Firebase Functions Config:', error.message);
    process.exit(1);
  }
}

// Cloud Runの環境変数を設定
function setCloudRunEnvVars(gmailConfig) {
  try {
    console.log('🔧 Setting Cloud Run environment variables...');
    
    // GMAIL_USERを設定
    execSync(
      `gcloud run services update ${SERVICE_NAME} ` +
      `--region=${REGION} ` +
      `--set-env-vars GMAIL_USER=${gmailConfig.user} ` +
      `--project=${PROJECT_ID}`,
      { stdio: 'inherit' }
    );
    
    // GMAIL_APP_PASSWORDを設定
    execSync(
      `gcloud run services update ${SERVICE_NAME} ` +
      `--region=${REGION} ` +
      `--update-env-vars GMAIL_APP_PASSWORD=${gmailConfig.app_password} ` +
      `--project=${PROJECT_ID}`,
      { stdio: 'inherit' }
    );
    
    console.log('✅ Environment variables set successfully');
  } catch (error) {
    console.error('❌ Failed to set Cloud Run environment variables:', error.message);
    console.error('💡 Make sure gcloud CLI is installed and you are authenticated');
    process.exit(1);
  }
}

// メイン処理
function main() {
  console.log('📋 Getting Firebase Functions Config...');
  const gmailConfig = getFirebaseConfig();
  
  console.log('✅ Firebase Functions Config retrieved:', {
    user: `${gmailConfig.user.substring(0, 5)}...`,
    hasAppPassword: !!gmailConfig.app_password
  });
  
  setCloudRunEnvVars(gmailConfig);
  
  console.log('✅ Done! Environment variables have been set in Cloud Run.');
  console.log('💡 Note: It may take a few minutes for the changes to take effect.');
}

main();



