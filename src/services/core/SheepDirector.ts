import { ShWvData } from './ShWvData';
import flexsearch from 'flexsearch';
import * as path from 'path';
import * as fs from 'fs';
import { parseTranslationFiles } from '../converter';

export class SheepDirector {
    public state: ShWvData;
    public lastLine: number = -1;
    public confirmedLines: Set<number> = new Set();
    public proofedLines: Set<number> = new Set();

    public tmIndex: any = null;
    public tmData: any[] = [];
    public tbData: { src: string, tgt: string, file: string }[] = [];

    constructor() {
        this.state = new ShWvData();
    }

    /**
     * Re-initializes state based on loaded units. Should be called after parsing/loading data.
     */
    public initializeFromState() {
        this.confirmedLines.clear();
        this.proofedLines.clear();
        for (const unit of this.state.body.units) {
            if (unit.status === 1) {
                this.confirmedLines.add(unit.idx);
            } else if (unit.status === 2) {
                this.proofedLines.add(unit.idx);
            }
        }
    }

    /**
     * Updates the target text of a line without confirming it.
     * Use this during typing/cursor movements. Does NOT propagate to quoting segments.
     */
    public updateTargetOnly(lineIdx: number, text: string) {
        // 高速パス: インデックスが一致するか確認
        const unit = (this.state.body.units[lineIdx] && this.state.body.units[lineIdx].idx === lineIdx)
            ? this.state.body.units[lineIdx]
            : this.state.body.units.find(u => u.idx === lineIdx);

        if (unit) {
            unit.tgt = text;
        }
    }

    /**
     * Explicitly confirms a line.
     * Updates target, sets status to 1, and propagates the translation to referring memory segments.
     */
    public confirmLine(lineIdx: number, text: string) {
        const unit = (this.state.body.units[lineIdx] && this.state.body.units[lineIdx].idx === lineIdx)
            ? this.state.body.units[lineIdx]
            : this.state.body.units.find(u => u.idx === lineIdx);

        if (!unit) return;

        unit.status = 1;
        this.confirmedLines.add(lineIdx);

        // This method intrinsically updates the unit and propagates to ref.quoted
        this.state.updateUnitTarget(lineIdx, text);
    }

    /**
     * Unconfirms a line.
     * Usually called when a confirmed line is edited.
     */
    public unconfirmLine(lineIdx: number) {
        const unit = (this.state.body.units[lineIdx] && this.state.body.units[lineIdx].idx === lineIdx)
            ? this.state.body.units[lineIdx]
            : this.state.body.units.find(u => u.idx === lineIdx);

        if (!unit) return;

        unit.status = 0;
        this.confirmedLines.delete(lineIdx);
        // Note: We do NOT rollback `tgt` or update ref.quoted here,
        // it just loses its confirmed status.
    }

    /**
     * Loads TM and TB data directly into memory and indexes them for Concordance Search
     */
    public async loadRefData(rootPath: string) {
        this.tmData = [];
        this.tbData = [];

        // Initialize FlexSearch Document with full tokenization for better substring matching support
        // We use string splitting for CJK tokenization support if needed, but 'full' is a good start.
        this.tmIndex = new flexsearch.Document({
            document: {
                id: "id",
                index: ["src", "tgt"],
                store: true
            },
            tokenize: "full",
            encode: (str: string) => str.split('') // Character-level indexing for robust CJK substring matches
        });

        const tmDir = path.join(rootPath, 'Working', '01_REF', 'TM');
        if (fs.existsSync(tmDir)) {
            const files = fs.readdirSync(tmDir).filter(f => fs.statSync(path.join(tmDir, f)).isFile());
            if (files.length > 0) {
                const parsedTm = await parseTranslationFiles(files.map(f => path.join(tmDir, f)));
                parsedTm.units.forEach((u, i) => {
                    const info = parsedTm.fileinfo.find(f => i >= f.start && i <= f.end);
                    const tmEntry = { id: i, src: u.src, tgt: u.tgt || "", file: info?.name || 'TM' };
                    this.tmData.push(tmEntry);
                    // Async addition 
                    this.tmIndex.add(tmEntry);
                });
            }
        }

        const tbDir = path.join(rootPath, 'Working', '01_REF', 'TB');
        if (fs.existsSync(tbDir)) {
            const files = fs.readdirSync(tbDir).filter(f => fs.statSync(path.join(tbDir, f)).isFile());
            if (files.length > 0) {
                const parsedTb = await parseTranslationFiles(files.map(f => path.join(tbDir, f)));
                parsedTb.units.forEach((u, i) => {
                    const info = parsedTb.fileinfo.find(f => i >= f.start && i <= f.end);
                    this.tbData.push({ src: u.src, tgt: u.tgt || "", file: info?.name || 'TB' });
                });
            }
        }
    }
}
