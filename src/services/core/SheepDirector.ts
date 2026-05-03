import { ShWvData, createShWvRef } from './ShWvData';
import type { ShWvUnit } from '../../types/datatype';
import flexsearch from 'flexsearch';
import * as path from 'path';
import * as fs from 'fs';
import { parseTranslationFiles } from '../converter';

export class SheepDirector {
    public state: ShWvData;
    public lastLine: number = -1;
    public confirmedLines: Set<number> = new Set();
    public proofedLines: Set<number> = new Set();
    public phrases: { input: string, phrase: string }[] = [];

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

        this.loadPhrases();
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
     * Propagates a translation to all segments marked as 100% matched (identical) 
     * in the current unit's ref.quoted100.
     */
    public propagateQuoted100(lineIdx: number, text: string): number[] {
        const unit = (this.state.body.units[lineIdx] && this.state.body.units[lineIdx].idx === lineIdx)
            ? this.state.body.units[lineIdx]
            : this.state.body.units.find(u => u.idx === lineIdx);

        if (!unit || !unit.ref.quoted100 || unit.ref.quoted100.length === 0) return [];

        const affectedIdxs: number[] = [];
        for (const targetIdx of unit.ref.quoted100) {
            const targetUnit = (this.state.body.units[targetIdx] && this.state.body.units[targetIdx].idx === targetIdx)
                ? this.state.body.units[targetIdx]
                : this.state.body.units.find(u => u.idx === targetIdx);

            if (targetUnit) {
                targetUnit.tgt = text;
                targetUnit.status = 1; // Auto confirm identical segments
                affectedIdxs.push(targetIdx);
            }
        }
        return affectedIdxs;
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

        // --- Logging for verification V0.0.11 ---
        try {
            const debugDir = path.join(rootPath, 'debug');
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
            const logPath = path.join(debugDir, 'flexsearch_index.log');
            const logContent = {
                timestamp: new Date().toISOString(),
                stats: {
                    tmTotal: this.tmData.length,
                    tbTotal: this.tbData.length
                },
                tm: this.tmData,
                tb: this.tbData
            };
            fs.writeFileSync(logPath, JSON.stringify(logContent, null, 2), 'utf-8');
            console.log(`[SheepDirector] Flexsearch index logged to: ${logPath}`);
        } catch (err) {
            console.error("[SheepDirector] Failed to write Flexsearch log:", err);
        }
    }

    /**
     * Load phrase.json from the project root.
     * Phrases are SheepWeave-specific (not part of ShWvData).
     */
    private loadPhrases(): void {
        // Use the rootPath from meta.bilingualPath or fall back
        // Phrases are loaded via the project root which we can infer from state
    }

    /**
     * Load phrases from a specific root path.
     */
    public loadPhrasesFromRoot(root: string): void {
        const phrasePathFull = path.join(root, DirHelper.rootToPhrases);
        if (fs.existsSync(phrasePathFull)) {
            try {
                const content = fs.readFileSync(phrasePathFull, 'utf-8');
                this.phrases = JSON.parse(content);
            } catch (e) {
                console.error('Failed to load phrases:', e);
                this.phrases = [];
            }
        }
    }
}

// Re-export DirHelper for convenience
import { DirHelper } from './DirHelper';
