import { SequenceMatcher } from 'difflib-ts';
import { ShWvRefTm } from './ShWvRefTm';

export class ShWvDiffer {
    private static matcher = new SequenceMatcher(null, "", "");

    static applyOpcodes(src1: string, src2: string, opcodes: [string, number, number, number, number][]): string {
        let result = "";
        for (const [tag, i1, i2, j1, j2] of opcodes) {
            if (tag === 'equal') {
                result += src2.substring(j1, j2);
            } else if (tag === 'replace') {
                result += `<del>${src1.substring(i1, i2)}</del><ins>${src2.substring(j1, j2)}</ins>`;
            } else if (tag === 'delete') {
                result += `<del>${src1.substring(i1, i2)}</del>`;
            } else if (tag === 'insert') {
                result += `<ins>${src2.substring(j1, j2)}</ins>`;
            }
        }
        return result;
    }

    static batchCompare(srcs: { idx: number, src: string, tgt: string }[], crtSrc: string, minRatio = 0.6, counts = 5): ShWvRefTm[] {
        let goodMatches: { tm: ShWvRefTm; opcodes: [string, number, number, number, number][] }[] = [];
        let tempMinRatio = minRatio;

        this.matcher.setSeq2(crtSrc);

        for (const s of srcs) {
            this.matcher.setSeq1(s.src);
            const ratio = this.matcher.ratio();

            if (ratio >= tempMinRatio) {
                const opcodes = this.matcher.getOpcodes() as [string, number, number, number, number][];

                const tm = new ShWvRefTm();
                tm.idx = s.idx;
                tm.src = s.src;
                tm.tgt = s.tgt;
                tm.ratio = ratio;

                const matchEntry = { tm, opcodes };

                if (goodMatches.length < counts) {
                    goodMatches.push(matchEntry);
                } else if (ratio > tempMinRatio) {
                    goodMatches[goodMatches.length - 1] = matchEntry;
                }

                goodMatches.sort((a, b) => b.tm.ratio - a.tm.ratio);

                if (goodMatches.length === counts) {
                    tempMinRatio = goodMatches[goodMatches.length - 1].tm.ratio;
                }
            }
        }

        // 次の処理のために空白にしておく
        this.matcher.setSeqs("", "");

        // Apply opcodes to generate diff text for the final collection
        return goodMatches.map(match => {
            if (match.tm.ratio !== 1) {
                match.tm.diff = this.applyOpcodes(match.tm.src, crtSrc, match.opcodes);
            }
            return match.tm;
        });
    }
}
