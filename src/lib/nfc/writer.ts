/**
 * NFC書き込み機能
 * Web NFC APIを使用してNFCタグにURLを書き込む
 */

export interface NFCWriteOptions {
  url: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export async function writeNFCUrl(options: NFCWriteOptions): Promise<void> {
  const { url, onSuccess, onError } = options;
  
  // ブラウザサポートチェック
  if (!('NDEFWriter' in window)) {
    const error = new Error('このブラウザはNFC書き込みに対応していません。Chrome 89以降をご使用ください。');
    onError?.(error);
    throw error;
  }
  
  // HTTPSチェック
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    const error = new Error('NFC書き込みにはHTTPS環境が必要です。');
    onError?.(error);
    throw error;
  }
  
  try {
    const writer = new (window as any).NDEFWriter();
    
    // NDEFメッセージを作成
    const message = {
      records: [
        {
          recordType: 'url',
          data: url
        }
      ]
    };
    
    // 書き込み実行
    await writer.write(message);
    
    console.log('NFC書き込み成功:', url);
    onSuccess?.();
  } catch (error: any) {
    console.error('NFC書き込みエラー:', error);
    
    // エラーメッセージの整形
    let errorMessage = 'NFC書き込みに失敗しました。';
    if (error.name === 'NotAllowedError') {
      errorMessage = 'NFC書き込みの許可が必要です。ブラウザの設定を確認してください。';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'このデバイスはNFC書き込みに対応していません。';
    } else if (error.name === 'AbortError') {
      errorMessage = 'NFC書き込みがキャンセルされました。';
    }
    
    const formattedError = new Error(errorMessage);
    onError?.(formattedError);
    throw formattedError;
  }
}




