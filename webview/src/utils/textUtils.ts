/**
 * スマート改行連結ユーティリティ
 * CJK文字（日本語・中国語・韓国語）と欧文を判定し、自然な連結を行います。
 */
export type NewlineJoinMode = 'auto' | 'escape' | 'smart' | 'nospace' | 'space' | 'custom';

export function smartJoinLines(
  text: string,
  mode: NewlineJoinMode = 'auto',
  customDelimiter = '',
  hasSourceNewlines = false
): string {
  if (!text || !text.includes('\n')) return text || '';

  // 1. エスケープ (\n 記号に変換)
  if (mode === 'escape' || (mode === 'auto' && hasSourceNewlines)) {
    return text.replace(/\r?\n/g, '\\n');
  }

  // 2. カスタム区切り文字
  if (mode === 'custom') {
    return text.replace(/\r?\n/g, customDelimiter);
  }

  // 3. 空白なし連結
  if (mode === 'nospace') {
    return text.replace(/\r?\n/g, '');
  }

  // 4. 半角スペース連結
  if (mode === 'space') {
    return text.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  // 5. スマート自動連結 (CJK判定)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0];

  const cjkRegex = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

  let result = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const nextLine = lines[i];
    const prevChar = result.slice(-1);
    const nextChar = nextLine.charAt(0);

    // 前の末尾または次の先頭がCJK文字ならスペースなしで連結
    if (cjkRegex.test(prevChar) || cjkRegex.test(nextChar)) {
      result += nextLine;
    } else {
      // 欧文・英数字同士の場合は半角スペースを挟んで連結
      result += ' ' + nextLine;
    }
  }
  return result;
}
