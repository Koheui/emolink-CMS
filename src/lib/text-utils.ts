import React from 'react';

/**
 * テキスト内のURLを自動的にリンクに変換する
 * @param text 変換するテキスト
 * @returns React要素の配列（テキストとリンクが混在）
 */
export function linkifyText(text: string): (string | React.ReactElement)[] {
  if (!text) return [];
  
  // URLを検出する正規表現
  // http://, https://, www. で始まるURLを検出
  // より正確なURL検出のため、改行や空白で区切られるまでを検出
  const urlRegex = /(https?:\/\/[^\s\n]+|www\.[^\s\n]+)/gi;
  
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  
  // 正規表現のグローバルフラグを使用するため、新しい正規表現を作成
  const regex = new RegExp(urlRegex.source, urlRegex.flags);
  
  while ((match = regex.exec(text)) !== null) {
    // URLの前のテキストを追加
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      if (beforeText) {
        parts.push(beforeText);
      }
    }
    
    // URLをリンクに変換
    let url = match[0];
    let href = url;
    
    // www.で始まる場合はhttps://を追加
    if (url.toLowerCase().startsWith('www.')) {
      href = `https://${url}`;
    }
    
    // リンク要素を作成
    parts.push(
      React.createElement(
        'a',
        {
          key: key++,
          href: href,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-blue-400 hover:text-blue-300 underline break-all',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
        url
      )
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // 残りのテキストを追加
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push(remainingText);
    }
  }
  
  // URLが見つからなかった場合は元のテキストをそのまま返す
  if (parts.length === 0) {
    return [text];
  }
  
  return parts;
}

/**
 * テキスト内のURLを自動的にリンクに変換（HTML文字列として返す）
 * @param text 変換するテキスト
 * @returns HTML文字列
 */
export function linkifyTextAsHtml(text: string): string {
  if (!text) return '';
  
  // URLを検出する正規表現
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  
  return text.replace(urlRegex, (url) => {
    let href = url;
    
    // www.で始まる場合はhttps://を追加
    if (url.startsWith('www.')) {
      href = `https://${url}`;
    }
    
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline break-all">${url}</a>`;
  });
}

