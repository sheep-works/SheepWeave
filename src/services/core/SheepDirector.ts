import { ShWvData, createShWvRef } from './ShWvData';
import type { ShWvUnit } from '../../types/datatype';
import * as path from 'path';
import * as fs from 'fs';

import { ShuttleSearch } from './ShuttleSearch';

export class SheepDirector {
    public state: ShWvData;
    public lastLine: number = -1;
    public confirmedLines: Set<number> = new Set();
    public proofedLines: Set<number> = new Set();
    public phrases: { input: string, phrase: string }[] = [];

    public concordance: ShuttleSearch;
    public tmData: any[] = [];
    public tbData: { src: string, tgt: string, file: string }[] = [];

    constructor() {
        this.state = new ShWvData();
        this.concordance = new ShuttleSearch();
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

    public async loadRefData(rootPath: string) {
        this.tmData = [];
        this.tbData = [];
        this.concordance.clear();

        // Provide DOMParser shim
        if (!(globalThis as any).DOMParser) {
            (globalThis as any).DOMParser = require('@xmldom/xmldom').DOMParser;
        }
        console.log("[SheepDirector] Loading SheepShuttle for TM...");
        const { SheepShuttle } = require('../../../modules/SheepComb/logic/shuttle/sheepShuttle');

        const tmDir = path.join(rootPath, 'Working', '01_REF', 'TM');
        if (fs.existsSync(tmDir)) {
            const files = fs.readdirSync(tmDir).filter(f => fs.statSync(path.join(tmDir, f)).isFile());
            if (files.length > 0) {
                console.log("[SheepDirector] Instantiating SheepShuttle for TM...");
                const shuttleTm = new SheepShuttle();
                const tmFilesInfo = files.map(f => {
                    const p = path.join(tmDir, f);
                    const ext = p.split('.').pop()?.toLowerCase() || '';
                    const isBinary = ['xlsx', 'docx'].includes(ext);
                    return { name: path.basename(p), content: isBinary ? fs.readFileSync(p) : fs.readFileSync(p, 'utf-8') };
                });
                await shuttleTm.parse(tmFilesInfo);
                shuttleTm.process();
                shuttleTm.convert();
                const parsedTm = shuttleTm.data;

                if (parsedTm) {
                    this.concordance.indexUnits(parsedTm.body.units);
                    parsedTm.body.units.forEach((u: any, i: number) => {
                        const info = parsedTm.meta.files.find((f: any) => i >= f.start && i <= f.end);
                        const tmEntry = { id: i, src: u.src, tgt: u.tgt || "", file: info?.name || 'TM' };
                        this.tmData.push(tmEntry);
                    });
                }
            }
        }

        const tbDir = path.join(rootPath, 'Working', '01_REF', 'TB');
        if (fs.existsSync(tbDir)) {
            const files = fs.readdirSync(tbDir).filter(f => fs.statSync(path.join(tbDir, f)).isFile());
            if (files.length > 0) {
                const shuttleTb = new SheepShuttle();
                const tbFilesInfo = files.map(f => {
                    const p = path.join(tbDir, f);
                    const ext = p.split('.').pop()?.toLowerCase() || '';
                    const isBinary = ['xlsx', 'docx'].includes(ext);
                    return { name: path.basename(p), content: isBinary ? fs.readFileSync(p) : fs.readFileSync(p, 'utf-8') };
                });
                await shuttleTb.parse(tbFilesInfo);
                shuttleTb.process();
                shuttleTb.convert();
                const parsedTb = shuttleTb.data;

                if (parsedTb) {
                    parsedTb.body.units.forEach((u: any, i: number) => {
                        const info = parsedTb.meta.files.find((f: any) => i >= f.start && i <= f.end);
                        this.tbData.push({ src: u.src, tgt: u.tgt || "", file: info?.name || 'TB' });
                    });
                }
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
