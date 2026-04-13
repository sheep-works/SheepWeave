import { ShWvUnit } from './ShWvUnit';

export interface ShWvTerm {
    src: string;
    tgt: string;
}

export class ShWvBody {
    units: ShWvUnit[];
    terms: ShWvTerm[];

    constructor(units: ShWvUnit[] = [], terms: ShWvTerm[] = []) {
        this.units = units;
        this.terms = terms;
    }

    addTerm(src: string, tgt: string): ShWvUnit[] {
        const updatedUnits: ShWvUnit[] = [];
        // 重複チェック（サイレントに無視）
        const exists = this.terms.some(t => t.src === src && t.tgt === tgt);
        if (!exists) {
            this.terms.push({ src, tgt });
        }
        // 全ユニットの原文を走査し、該当するユニットの ref.tb に追加
        this.checkForNewTerm(src, tgt, updatedUnits);
        return updatedUnits;
    }

    private checkForNewTerm(src: string, tgt: string, updatedUnits: ShWvUnit[]): void {
        for (const unit of this.units) {
            if (unit.src.includes(src)) {
                // 既に同じ src の tb エントリがあれば tgt を追加、なければ新規作成
                const existing = unit.ref.tb.find(tb => tb.src === src);
                if (existing) {
                    if (!existing.tgts.includes(tgt)) {
                        existing.tgts.push(tgt);
                        updatedUnits.push(unit);
                    }
                } else {
                    unit.ref.tb.push({ src, tgts: [tgt] });
                    updatedUnits.push(unit);
                }
            }
        }
    }
}
