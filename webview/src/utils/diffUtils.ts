import { SequenceMatcher } from 'difflib-ts';

export interface DiffResult {
  lineNo: number;
  s: string;
  t: string;
  d: string;
  ratio: number;
  hasDiff: boolean;
}

export class DiffUtils {
  private static matcher = new SequenceMatcher(null, '', '');

  /**
   * 2つの文字列の差分を HTML で返します
   */
  static getDiffHtml(oldStr: string, newStr: string): string {
    const s1 = this.cleanString(oldStr);
    const s2 = this.cleanString(newStr);

    if (s1 === s2) return s2;

    this.matcher.setSeqs(s1, s2);
    const opcodes = this.matcher.getOpcodes() as [string, number, number, number, number][];

    let result = '';
    for (const [tag, i1, i2, j1, j2] of opcodes) {
      if (tag === 'equal') {
        result += s2.substring(j1, j2);
      } else if (tag === 'replace') {
        result += `<del>${s1.substring(i1, i2)}</del><ins>${s2.substring(j1, j2)}</ins>`;
      } else if (tag === 'delete') {
        result += `<del>${s1.substring(i1, i2)}</del>`;
      } else if (tag === 'insert') {
        result += `<ins>${s2.substring(j1, j2)}</ins>`;
      }
    }
    return result;
  }

  /**
   * 2つの文字列の類似度 (0 ~ 100 %) を計算します
   */
  static getRatio(oldStr: string, newStr: string): number {
    const s1 = oldStr || '';
    const s2 = newStr || '';
    if (!s1 && !s2) return 100;
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 100;

    this.matcher.setSeqs(s1, s2);
    return Math.round(this.matcher.ratio() * 100);
  }

  private static cleanString(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
