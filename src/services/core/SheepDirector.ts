import { ShWvData, createShWvRef } from './ShWvData';
import type { ShWvUnit } from '../../types/datatype';
import * as path from 'path';
import * as fs from 'fs';

import { ShuttleSearch } from './ShuttleSearch';

// Helper to read text files with encoding detection (UTF-8 / UTF-16LE)
function readTextFile(p: string): string {
    const buf = fs.readFileSync(p);
    if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
        return buf.toString('utf16le');
    }
    return buf.toString('utf8');
}

export class SheepDirector {
    public state: ShWvData;
    public lastLine: number = -1;
    public confirmedLines: Set<number> = new Set();
    public lineToIdxMap: number[] = [];
    public idxToLineMap: Map<number, number> = new Map();
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
        const currentWorkflowIndex = this.state.meta.workflow?.index ?? 1;
        for (const unit of this.state.body.units) {
            if (unit.status !== undefined && unit.status >= currentWorkflowIndex) {
                this.confirmedLines.add(unit.idx);
            }
        }

        // Initialize Virtual Scope mappings
        const scopedUnits = this.state.getScopedUnits();
        this.lineToIdxMap = scopedUnits.map(u => u.idx);
        this.idxToLineMap.clear();
        this.lineToIdxMap.forEach((idx, line) => {
            this.idxToLineMap.set(idx, line);
        });

        this.loadPhrases();
    }

    /**
     * Resolves editor 0-based line to 0-based/1-based unit.idx.
     */
    public getIdxByLine(line: number): number {
        if (line >= 0 && line < this.lineToIdxMap.length) {
            return this.lineToIdxMap[line];
        }
        return line;
    }

    /**
     * Resolves unit.idx to editor 0-based line, or undefined if outside current scope.
     */
    public getLineByIdx(idx: number): number | undefined {
        return this.idxToLineMap.get(idx);
    }

    /**
     * Gets a unit by its unique idx.
     */
    public getUnitByIdx(idx: number): ShWvUnit | undefined {
        return (this.state.body.units[idx] && this.state.body.units[idx].idx === idx)
            ? this.state.body.units[idx]
            : this.state.body.units.find(u => u.idx === idx);
    }

    /**
     * Gets a unit by editor 0-based line number.
     */
    public getUnitByLine(line: number): ShWvUnit | undefined {
        const idx = this.getIdxByLine(line);
        return this.getUnitByIdx(idx);
    }

    /**
     * Returns scoped units for the current workflow.
     */
    public getScopedUnits(): ShWvUnit[] {
        return this.state.getScopedUnits();
    }

    /**
     * Updates the target text of a unit without confirming it.
     * Use this during typing/cursor movements. Does NOT propagate to quoting segments.
     * @param idx unit.idx
     */
    public updateTargetOnly(idx: number, text: string) {
        const unit = this.getUnitByIdx(idx);
        if (unit) {
            unit.tgt = text;
        }
    }

    /**
     * Explicitly confirms a unit by idx.
     * Updates target, sets status to current workflow index, and propagates to referring segments.
     * @param idx unit.idx
     */
    public confirmLine(idx: number, text: string) {
        const unit = this.getUnitByIdx(idx);
        if (!unit) return;

        const currentWorkflowIndex = this.state.meta.workflow?.index ?? 1;
        if ((unit.status || 0) < currentWorkflowIndex) {
            unit.status = currentWorkflowIndex;
        }
        this.confirmedLines.add(idx);

        // This method intrinsically updates the unit and propagates to ref.quoted / ref.tms
        this.state.updateUnitTarget(idx, text);
        this.state.propagateSingleUnit(idx);
    }

    /**
     * Confirms multiple units in a single batch operation.
     * Prevents excessive individual notification cycles and O(N*M) propagation loops.
     * @param items Array of unit indices or { idx, text } objects
     */
    public confirmLines(items: (number | { idx: number; text?: string })[]): number[] {
        const currentWorkflowIndex = this.state.meta.workflow?.index ?? 1;
        const confirmedIdxs: number[] = [];

        for (const item of items) {
            const idx = typeof item === 'number' ? item : item.idx;
            const text = typeof item === 'object' ? item.text : undefined;

            const unit = this.getUnitByIdx(idx);
            if (!unit) continue;

            if ((unit.status || 0) < currentWorkflowIndex) {
                unit.status = currentWorkflowIndex;
            }
            this.confirmedLines.add(idx);

            if (text !== undefined && unit.tgt !== text) {
                unit.tgt = text;
                this.state.updateUnitTarget(idx, text);
            }
            confirmedIdxs.push(idx);
        }

        return confirmedIdxs;
    }

    /**
     * Unconfirms a unit by idx.
     * Usually called when a confirmed line is edited.
     * @param idx unit.idx
     */
    public unconfirmLine(idx: number) {
        const unit = this.getUnitByIdx(idx);
        if (!unit) return;

        const currentWorkflowIndex = this.state.meta.workflow?.index ?? 1;
        if ((unit.status || 0) >= currentWorkflowIndex) {
            unit.status = currentWorkflowIndex - 1;
        }
        this.confirmedLines.delete(idx);
    }

    /**
     * Propagates a translation to all segments marked as 100% matched (identical) 
     * in the current unit's ref.quoted100.
     * @param idx unit.idx
     */
    public propagateQuoted100(idx: number, text: string): number[] {
        const unit = this.getUnitByIdx(idx);
        if (!unit || !unit.ref.quoted100 || unit.ref.quoted100.length === 0) return [];

        const currentWorkflowIndex = this.state.meta.workflow?.index ?? 1;

        const affectedIdxs: number[] = [];
        for (const targetIdx of unit.ref.quoted100) {
            const targetUnit = this.getUnitByIdx(targetIdx);
            if (targetUnit) {
                targetUnit.tgt = text;
                targetUnit.status = currentWorkflowIndex; // Auto confirm identical segments with current role
                affectedIdxs.push(targetIdx);
            }
        }
        return affectedIdxs;
    }

    /**
     * コンコーダンス検索（FlexSearch）用に参考ファイルを再度読み込む処理。
     * ShWvData 側での事前解析（マッチ率計算）とは独立して、UI側のインデックス構築のために実行されます。
     */
    public async loadRefData(rootPath: string) {
        this.tmData = [];
        this.tbData = [];
        this.concordance.clear();

        // Provide DOMParser shim
        if (!(globalThis as any).DOMParser) {
            (globalThis as any).DOMParser = require('@xmldom/xmldom').DOMParser;
        }
        const { SheepShuttle } = require('../../../modules/SheepComb/packages/core/src/shuttle/sheepShuttle');

        const tmDir = path.join(rootPath, 'Working', '01_REF', 'TM');
        if (fs.existsSync(tmDir)) {
            const files = fs.readdirSync(tmDir).filter(f => fs.statSync(path.join(tmDir, f)).isFile());
            if (files.length > 0) {
                const shuttleTm = new SheepShuttle();
                const tmFilesInfo = files.map(f => {
                    const p = path.join(tmDir, f);
                    const ext = p.split('.').pop()?.toLowerCase() || '';
                    const isBinary = ['xlsx', 'docx'].includes(ext);
                    return { name: path.basename(p), content: isBinary ? fs.readFileSync(p) : readTextFile(p) };
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
                    return { name: path.basename(p), content: isBinary ? fs.readFileSync(p) : readTextFile(p) };
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

        // Load ShWvData projects from Ref root
        const refDir = path.join(rootPath, 'Working', '01_REF');
        if (fs.existsSync(refDir)) {
            const refFiles = fs.readdirSync(refDir).filter(f => f.endsWith('.json') && fs.statSync(path.join(refDir, f)).isFile());
            for (const file of refFiles) {
                if (file.toLowerCase() === 'phrase.json') continue;

                try {
                    const p = path.join(refDir, file);
                    const content = fs.readFileSync(p, 'utf-8');
                    const parsed = JSON.parse(content);
                    if (parsed?.define?.name === 'SHWV_DATA') {
                        if (parsed.body?.units) {
                            this.concordance.indexUnits(parsed.body.units);
                            parsed.body.units.forEach((u: any, i: number) => {
                                if (u.tgt) {
                                    this.tmData.push({ id: i, src: u.src, tgt: u.tgt, file: file });
                                }
                            });
                        }
                        if (parsed.body?.terms) {
                            parsed.body.terms.forEach((t: any) => {
                                if (t.src && t.tgt) {
                                    this.tbData.push({ src: t.src, tgt: t.tgt, file: file });
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse ref project:", file, e);
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
     * Supports phrase.jsonl (primary) and legacy phrase.json (fallback).
     */
    public loadPhrasesFromRoot(root: string): void {
        const jsonlPath = path.join(root, DirHelper.rootToPhrasesJsonl);
        const jsonPath = path.join(root, DirHelper.rootToPhrases);

        if (fs.existsSync(jsonlPath)) {
            try {
                const content = fs.readFileSync(jsonlPath, 'utf-8');
                const lines = content.split('\n');
                const phrases: any[] = [];
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const item = JSON.parse(line);
                        if (item && item.input && item.phrase) {
                            phrases.push(item);
                        }
                    } catch (e) {}
                }
                this.phrases = phrases;
            } catch (e) {
                console.error('Failed to load phrase.jsonl:', e);
                this.phrases = [];
            }
        } else if (fs.existsSync(jsonPath)) {
            try {
                const content = fs.readFileSync(jsonPath, 'utf-8');
                this.phrases = JSON.parse(content);
            } catch (e) {
                console.error('Failed to load phrase.json:', e);
                this.phrases = [];
            }
        } else {
            this.phrases = [];
        }
    }
}

// Re-export DirHelper for convenience
import { DirHelper } from './DirHelper';
