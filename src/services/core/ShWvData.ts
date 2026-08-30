import type { ShWvBody, ShWvMeta, ShWvUnit, ShWvRef, TranslationPair, ProjectInfo } from "../../types/datatype";
import { getExtention } from "../../util";
import { shwv2xlfLike } from "../converter";
import { readFileSync, writeFileSync } from "fs";
import { DirHelper } from "./DirHelper";
import * as path from 'path';
import * as fs from 'fs';
// --- Local adapter for analysis (avoids pulling in SheepComb's full dependency graph) ---
import { ShuttleAnalyzer } from './ShuttleAdapter';

// Helper to read text files with encoding detection (UTF-8 / UTF-16LE)
function readTextFile(p: string): string {
    const buf = fs.readFileSync(p);
    if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
        return buf.toString('utf16le');
    }
    return buf.toString('utf8');
}

// ============================================================================
// Factory functions (replacing class constructors)
// ============================================================================

export function createShWvUnit(pair: TranslationPair): ShWvUnit {
    return {
        idx: pair.idx,
        src: pair.src,
        pre: pair.tgt || '',
        tgt: '',
        note: pair.note,
        isSub: pair.isSub,
        status: (pair as any).status || 0,
        ref: createShWvRef(),
        placeholders: pair.placeholders,
    };
}

export function createShWvRef(): ShWvRef {
    return { tms: [], tb: [], quoted: [], quoted100: [] };
}

export function createEmptyBody(): ShWvBody {
    return { units: [], terms: [] };
}

export function createEmptyMeta(): ShWvMeta {
    return {
        bilingualPath: '',
        files: [],
        sourceLang: '',
        targetLang: '',
        tmFiles: [],
        tbFiles: [],
    };
}

// ============================================================================
// ShWvData class — data container + file I/O + VS Code extension operations
// ============================================================================

export class ShWvData {
    public ver!: number;
    public meta!: ShWvMeta;
    public body!: ShWvBody;
    public projectInfo?: ProjectInfo;

    constructor() {
        this.clear();
    }

    public clear(): void {
        this.meta = createEmptyMeta();
        this.body = createEmptyBody();
    }

    public async parse(filepaths: string[]): Promise<void> {
        // Provide DOMParser shim
        if (!(globalThis as any).DOMParser) {
            (globalThis as any).DOMParser = require('@xmldom/xmldom').DOMParser;
        }
        
        const { SheepShuttle } = require('../../../modules/SheepComb/packages/core/src/shuttle/sheepShuttle');
        const shuttle = new SheepShuttle();
        
        const files = filepaths.map(p => {
            const ext = p.split('.').pop()?.toLowerCase() || '';
            const isBinary = ['xlsx', 'docx'].includes(ext);
            return {
                name: path.basename(p),
                content: isBinary ? fs.readFileSync(p) : readTextFile(p)
            };
        });

        try {
            const segmentation = this.meta.workflow?.segmentation || 'line';
            const splitByNewline = segmentation !== 'raw';
            await shuttle.parse(files, undefined, splitByNewline);
            shuttle.process();
            shuttle.convert();

            const parsedData = shuttle.data;
            if (parsedData) {
                const startOffset = this.body.units.length;
                if (parsedData.meta.files && parsedData.meta.files.length > 0) {
                    parsedData.meta.files.forEach((f: any) => {
                        f.start += startOffset;
                        f.end += startOffset;
                    });
                    this.meta.files.push(...parsedData.meta.files);
                }
                if (parsedData.body.units && parsedData.body.units.length > 0) {
                    parsedData.body.units.forEach((u: any, idx: number) => {
                        u.idx = startOffset + idx;
                        // If pre-translated (src !== tgt), keep tgt intact.
                        // If exact source copy (src === tgt), move to pre (draft/ref) and leave tgt empty for human translation.
                        if (u.tgt && u.src !== u.tgt) {
                            // Keep existing translation in tgt
                        } else if (u.tgt && u.src === u.tgt) {
                            if (!u.pre) u.pre = u.tgt;
                            u.tgt = '';
                        }
                    });
                    this.body.units.push(...parsedData.body.units);
                } else {
                    console.error('[SheepWeave] shuttle.data.body.units is empty after parsing!');
                    require('vscode').window.showWarningMessage('Warning: No units parsed from file.');
                }
            } else {
                console.error('[SheepWeave] shuttle.data is null after convert!');
            }
        } catch (e: any) {
            console.error('[SheepWeave] Error during shuttle parsing:', e);
            require('vscode').window.showErrorMessage('Parse Error: ' + e.message);
        }
    }

    public extract(mode: "source" | "target" | "both-horizontal" | "both-vertical"): string[] {
        switch (mode) {
            case "source":
                return this.extractSource();
            case "target":
                return this.extractTarget();
            case "both-horizontal":
                return this.extractBothHorizontal();
            case "both-vertical":
                return this.extractBothVertical();
            default:
                throw new Error('mode is not source or target or both-horizontal or both-vertical');
        }
    }

    private extractSource(): string[] {
        return this.body.units.map(unit => unit.src);
    }

    private extractTarget(): string[] {
        return this.body.units.map(unit => unit.tgt ? unit.tgt : (unit.pre ? unit.pre : unit.src));
    }

    private extractBothHorizontal(): string[] {
        return this.body.units.map(unit => unit.src + '\t' + (unit.tgt ? unit.tgt : (unit.pre ? unit.pre : unit.src)));
    }

    private extractBothVertical(): string[] {
        return this.body.units.map(unit => unit.src + '\n' + (unit.tgt ? unit.tgt : (unit.pre ? unit.pre : unit.src)));
    }


    public async writeShwv(root: string): Promise<void> {
        const scrs = this.extract("source");
        const tgt = this.extract("target");

        const shwvsPathFull = DirHelper.getShwvsPath(root);
        const shwvtPathFull = DirHelper.getShwvtPath(root);

        writeFileSync(shwvsPathFull, scrs.join('\n'));
        writeFileSync(shwvtPathFull, tgt.join('\n'));
    }

    public update(filepath: string): void {
        const content = readFileSync(filepath, 'utf-8');
        const lines = content.split('\n');

        let targetIdx = 0;
        for (let i = 0; i < this.body.units.length; i++) {
            if (targetIdx < lines.length) {
                this.body.units[i].tgt = lines[targetIdx];
                targetIdx++;
            }
        }
    }

    public updateUnitTarget(index: number, text: string): void {
        const targetUnit = this.body.units[index];
        if (targetUnit) {
            targetUnit.tgt = text;
        }
    }

    public updateUnits(updatedUnits: ShWvUnit[]): number[] {
        const affected = new Set<number>();
        for (const newUnit of updatedUnits) {
            if (newUnit.idx < 0) continue;
            const targetUnit = this.body.units[newUnit.idx];
            if (targetUnit) {
                targetUnit.tgt = newUnit.tgt;
                targetUnit.status = newUnit.status;
                affected.add(newUnit.idx);
            }
        }
        return Array.from(affected);
    }

    /**
     * Propagates a single unit's target translation to all units referencing it as TM (quoted / quoted100).
     * Returns an array of affected unit indices.
     */
    public propagateSingleUnit(targetIdx: number): number[] {
        const unit = (this.body.units[targetIdx] && this.body.units[targetIdx].idx === targetIdx)
            ? this.body.units[targetIdx]
            : this.body.units.find(u => u.idx === targetIdx);

        if (!unit || !unit.tgt) return [];

        const affectedIdxs: number[] = [];

        // Collect all referencing unit indices from quoted (fuzzy) and quoted100 (100%)
        const referencingIndices: number[] = [];
        if (unit.ref?.quoted) {
            for (const [quotedIdx] of unit.ref.quoted) {
                referencingIndices.push(quotedIdx);
            }
        }
        if (unit.ref?.quoted100) {
            for (const quotedIdx of unit.ref.quoted100) {
                referencingIndices.push(quotedIdx);
            }
        }

        for (const refIdx of referencingIndices) {
            const referencingUnit = (this.body.units[refIdx] && this.body.units[refIdx].idx === refIdx)
                ? this.body.units[refIdx]
                : this.body.units.find(u => u.idx === refIdx);

            if (!referencingUnit || !referencingUnit.ref?.tms) continue;

            const tmRef = referencingUnit.ref.tms.find(tm => tm.idx === targetIdx);
            if (tmRef && tmRef.tgt !== unit.tgt) {
                tmRef.tgt = unit.tgt;
                affectedIdxs.push(refIdx);
            }
        }

        return affectedIdxs;
    }

    /**
     * Propagates a translation to all units that have quoted this unit as a TM match.
     * Handles both fuzzy matches (quoted) and 100% matches (quoted100).
     */
    public propagateAllTranslations(): void {
        for (const unit of this.body.units) {
            if (unit && unit.tgt) {
                this.propagateSingleUnit(unit.idx);
            }
        }
    }

    /**
     * Advances the workflow step:
     * 1. Preserves current target (tgt) into pre (if tgt exists).
     * 2. Clears tgt and resets status to 0 for all units.
     * 3. Increments workflow.index by 1.
     * @returns previous workflow index
     */
    public advanceWorkflowStep(): number {
        const currentIdx = this.meta.workflow?.index ?? 1;

        for (const unit of this.body.units) {
            if (unit.tgt && unit.tgt.trim() !== '') {
                unit.pre = unit.tgt;
            }
            unit.tgt = '';
            unit.status = 0;
        }

        if (!this.meta.workflow) {
            this.meta.workflow = {
                index: 1,
                role: 'Translation',
                name: 'Sheep',
                segmentation: 'line'
            };
        }
        this.meta.workflow.index = currentIdx + 1;

        return currentIdx;
    }

    public loadWorkflowIni(root: string): void {
        const workflowPath = path.join(root, 'workflow.ini');
        if (fs.existsSync(workflowPath)) {
            try {
                const iniContent = fs.readFileSync(workflowPath, 'utf-8');
                const workflow: any = {};
                iniContent.split('\n').forEach(line => {
                    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
                    if (match) {
                        const key = match[1];
                        const val = match[2];
                        if (key === 'index') workflow[key] = parseInt(val, 10);
                        else workflow[key] = val;
                    }
                });
                if (workflow.index !== undefined) {
                    // Normalize segmentation fallback logic
                    let segOption = workflow.segmentation?.toLowerCase() || 'line';
                    if (!['seg', 'line', 'raw'].includes(segOption)) {
                        segOption = 'line';
                    }

                    this.meta.workflow = {
                        index: workflow.index,
                        role: workflow.role || '',
                        name: workflow.name || '',
                        segmentation: segOption
                    };
                }
            } catch (e) {
                console.error("Failed to load workflow.ini", e);
            }
        } else {
            try {
                const defaultIniContent = "index=1\nrole=Translation\nname=Sheep\nsegmentation=line\n";
                fs.writeFileSync(workflowPath, defaultIniContent, 'utf-8');
                this.meta.workflow = {
                    index: 1,
                    role: 'Translation',
                    name: 'Sheep',
                    segmentation: 'line'
                };
            } catch (e) {
                console.error("Failed to create default workflow.ini", e);
            }
        }
    }

    public load(root: string): void {
        const storagePathFull = DirHelper.getStoragePath(root);
        if (fs.existsSync(storagePathFull)) {
            try {
                const content = fs.readFileSync(storagePathFull, 'utf-8');
                const parsed = JSON.parse(content);
                if (parsed.projectInfo) {
                    this.projectInfo = parsed.projectInfo;
                }
                this.meta = {
                    bilingualPath: parsed.meta?.bilingualPath || '',
                    files: parsed.meta?.files || [],
                    sourceLang: parsed.meta?.sourceLang || parsed.projectInfo?.sourceLanguage || '',
                    targetLang: parsed.meta?.targetLang || parsed.projectInfo?.targetLanguage || '',
                    projectName: parsed.meta?.projectName || parsed.projectInfo?.projectName || '',
                    tmFiles: parsed.meta?.tmFiles || [],
                    tbFiles: parsed.meta?.tbFiles || [],
                } as any;
                this.body = {
                    units: parsed.body?.units || [],
                    terms: parsed.body?.terms || [],
                };

                this.loadWorkflowIni(root);

                // If unified project.json is loaded, and Working folders/files are missing, automatically restore them.
                if (['1.1', '1.2', '1.3'].includes(parsed.define?.version) && this.body.units.length > 0) {
                    const shwvsPath = DirHelper.getShwvsPath(root);
                    const shwvtPath = DirHelper.getShwvtPath(root);
                    if (!fs.existsSync(shwvsPath) || !fs.existsSync(shwvtPath)) {
                        // 1. Recreate required working folders
                        const dirs = [
                            'Working',
                            'Working/01_REF',
                            'Working/01_REF/TM',
                            'Working/01_REF/TB',
                            'Working/02_SOURCE',
                            'Working/03_XLF_JSON',
                            'Working/04_SHWV',
                            'Working/05_COMPLETED',
                            'Working/06_PACKAGE'
                        ];
                        for (const d of dirs) {
                            const p = path.join(root, d);
                            if (!fs.existsSync(p)) {
                                fs.mkdirSync(p, { recursive: true });
                            }
                        }

                        const phrasePath = path.join(root, 'Working', '01_REF', 'phrase.jsonl');
                        if (!fs.existsSync(phrasePath)) {
                            fs.writeFileSync(phrasePath, '{"input": "@", "phrase": "{@x}"}\n', 'utf-8');
                        }

                        // 2. Extract and write Source.shwvs and Target.shwvt files
                        const scrs = this.extract("source");
                        const tgt = this.extract("target");
                        fs.writeFileSync(shwvsPath, scrs.join('\n'), 'utf-8');
                        fs.writeFileSync(shwvtPath, tgt.join('\n'), 'utf-8');
                        console.log(`Automatically restored Working directory folders and translation files in Working/04_SHWV`);
                    }
                }
            } catch (e) {
                console.error("Failed to load ShWvData from", storagePathFull, e);
            }
        }
    }

    public save(root: string): void {
        this.propagateAllTranslations();
        const storagePathFull = DirHelper.getStoragePath(root);
        
        // If projectInfo in memory is missing, try to read it from disk
        if (!this.projectInfo && fs.existsSync(storagePathFull)) {
            try {
                const content = fs.readFileSync(storagePathFull, 'utf-8');
                const parsed = JSON.parse(content);
                if (parsed && parsed.projectInfo) {
                    this.projectInfo = parsed.projectInfo;
                }
            } catch (e) {
                // ignore
            }
        }

        // Synchronize meta and projectInfo
        if (this.projectInfo) {
            if (!this.meta.projectName && this.projectInfo.projectName) this.meta.projectName = this.projectInfo.projectName;
            if (!this.meta.sourceLang && this.projectInfo.sourceLanguage) this.meta.sourceLang = this.projectInfo.sourceLanguage;
            if (!this.meta.targetLang && this.projectInfo.targetLanguage) this.meta.targetLang = this.projectInfo.targetLanguage;
        } else if (this.meta.projectName || this.meta.sourceLang || this.meta.targetLang) {
            this.projectInfo = {
                version: 2,
                projectName: this.meta.projectName || 'SheepWeaveProject',
                sourceLanguage: this.meta.sourceLang || 'en-US',
                targetLanguage: this.meta.targetLang || 'ja-JP',
                sourceFiles: [],
                okapi: []
            };
        }

        writeFileSync(storagePathFull, JSON.stringify({
            define: { name: 'SHWV_DATA', version: '1.3' },
            meta: this.meta,
            body: this.body,
            projectInfo: this.projectInfo
        }, null, 2), 'utf-8');
    }

    public async analyze(root: string, legacy: boolean = false): Promise<void> {
        const units = this.body.units;

        // Load TM files
        const tmDir = path.join(root, 'Working', '01_REF', 'TM');
        let memories: any[] = [];
        
        let tmFileList: string[] = [];
        if (this.meta.tmFiles && this.meta.tmFiles.length > 0) {
            tmFileList = this.meta.tmFiles;
        } else if (fs.existsSync(tmDir)) {
            tmFileList = fs.readdirSync(tmDir).filter(f => fs.statSync(path.join(tmDir, f)).isFile());
            this.meta.tmFiles = tmFileList; // Populate meta if empty
        }

        // Provide DOMParser shim
        if (!(globalThis as any).DOMParser) {
            (globalThis as any).DOMParser = require('@xmldom/xmldom').DOMParser;
        }
        const { SheepShuttle } = require('../../../modules/SheepComb/packages/core/src/shuttle/sheepShuttle');

        if (tmFileList.length > 0) {
            const tmFilesFull = tmFileList.map(f => path.join(tmDir, f));
            const shuttleTm = new SheepShuttle();
            const tmFiles = tmFilesFull.map(p => {
                const ext = p.split('.').pop()?.toLowerCase() || '';
                const isBinary = ['xlsx', 'docx'].includes(ext);
                return { name: path.basename(p), content: isBinary ? fs.readFileSync(p) : readTextFile(p) };
            });
            await shuttleTm.parse(tmFiles);
            shuttleTm.process();
            shuttleTm.convert();
            const parsedTm = shuttleTm.data;

            memories = parsedTm.body.units.map((u: any, i: number) => {
                const info = parsedTm.meta.files.find((f: any) => i >= f.start && i <= f.end);
                return { idx: -1, src: u.src, tgt: u.tgt, freeze: true, file: info?.name };
            });
        }

        // Load TB files
        const tbDir = path.join(root, 'Working', '01_REF', 'TB');
        let termbase: any[] = [];
        
        let tbFileList: string[] = [];
        if (this.meta.tbFiles && this.meta.tbFiles.length > 0) {
            tbFileList = this.meta.tbFiles;
        } else if (fs.existsSync(tbDir)) {
            tbFileList = fs.readdirSync(tbDir).filter(f => fs.statSync(path.join(tbDir, f)).isFile());
            this.meta.tbFiles = tbFileList; // Populate meta if empty
        }

        if (tbFileList.length > 0) {
            // 1. Direct JSONL parsing (.jsonl files)
            const jsonlFiles = tbFileList.filter(f => f.toLowerCase().endsWith('.jsonl'));
            for (const f of jsonlFiles) {
                try {
                    const p = path.join(tbDir, f);
                    const lines = fs.readFileSync(p, 'utf-8').split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const item = JSON.parse(line);
                            const src = item.src || item.input;
                            const tgt = item.tgt || item.phrase;
                            if (src && tgt) {
                                termbase.push({
                                    idx: -1,
                                    src: src,
                                    tgts: Array.isArray(tgt) ? tgt : [tgt],
                                    file: f
                                });
                            }
                        } catch (e) {}
                    }
                } catch (e) {
                    console.error("Failed to parse JSONL TB file:", f, e);
                }
            }

            // 2. Parse non-JSONL files via SheepShuttle
            const otherTbFiles = tbFileList.filter(f => !f.toLowerCase().endsWith('.jsonl'));
            if (otherTbFiles.length > 0) {
                const tbFilesFull = otherTbFiles.map(f => path.join(tbDir, f));
                const shuttleTb = new SheepShuttle();
                const tbFiles = tbFilesFull.map(p => {
                    const ext = p.split('.').pop()?.toLowerCase() || '';
                    const isBinary = ['xlsx', 'docx'].includes(ext);
                    return { name: path.basename(p), content: isBinary ? fs.readFileSync(p) : readTextFile(p) };
                });
                await shuttleTb.parse(tbFiles);
                shuttleTb.process();
                shuttleTb.convert();
                const parsedTb = shuttleTb.data;

                termbase.push(...parsedTb.body.units.map((u: any, i: number) => {
                    const info = parsedTb.meta.files.find((f: any) => i >= f.start && i <= f.end);
                    return { ...u, file: info?.name };
                }));
            }
        }

        // Direct support: Auto-load active auto_replace_log.jsonl from Working/01_REF if present
        const defaultLogPath = path.join(root, 'Working', '01_REF', 'auto_replace_log.jsonl');
        if (fs.existsSync(defaultLogPath)) {
            try {
                const lines = fs.readFileSync(defaultLogPath, 'utf-8').split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const item = JSON.parse(line);
                        const src = item.src || item.input;
                        const tgt = item.tgt || item.phrase;
                        if (src && tgt) {
                            termbase.push({
                                idx: -1,
                                src: src,
                                tgts: Array.isArray(tgt) ? tgt : [tgt],
                                file: 'auto_replace_log.jsonl'
                            });
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }

        // Include internal terms
        if (this.body.terms && this.body.terms.length > 0) {
            termbase.push(...this.body.terms.map(t => ({ ...t, file: "Internal" })));
        }

        // Load ShWvData projects from Ref root
        const refDir = path.join(root, 'Working', '01_REF');
        if (fs.existsSync(refDir)) {
            const refFiles = fs.readdirSync(refDir).filter(f => f.endsWith('.json') && fs.statSync(path.join(refDir, f)).isFile());
            for (const file of refFiles) {
                if (file.toLowerCase().startsWith('phrase.')) continue;

                try {
                    const p = path.join(refDir, file);
                    const content = fs.readFileSync(p, 'utf-8');
                    const parsed = JSON.parse(content);
                    if (parsed?.define?.name === 'SHWV_DATA') {
                        if (parsed.body?.units) {
                            parsed.body.units.forEach((u: any) => {
                                if (u.tgt) {
                                    memories.push({ idx: -1, src: u.src, tgt: u.tgt, freeze: true, file: file });
                                }
                            });
                        }
                        if (parsed.body?.terms) {
                            parsed.body.terms.forEach((t: any) => {
                                if (t.src && t.tgt) {
                                    termbase.push({ ...t, file: file });
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse ref project:", file, e);
                }
            }
        }

        // Delegate search and analysis to SheepComb's ShuttleAnalyzer
        const { analyze_all } = require('sheep-spindle');
        const analyzer = new ShuttleAnalyzer();
        const shwvData = {
            define: { name: 'SHWV_DATA' as const, version: '1.3' as const },
            meta: this.meta,
            body: this.body,
        };
        await analyzer.analyze(shwvData, memories, termbase, analyze_all, legacy);
    }

    /**
     * Adds a term to body.terms and updates all units that contain the source text.
     * Returns the list of units that were updated.
     */
    public addTerm(src: string, tgt: string): ShWvUnit[] {
        const updatedUnits: ShWvUnit[] = [];
        // 重複チェック（サイレントに無視）
        const exists = this.body.terms.some(t => t.src === src && t.tgt === tgt);
        if (!exists) {
            this.body.terms.push({ src, tgt });
        }
        // 全ユニットの原文を走査し、該当するユニットの ref.tb に追加
        for (const unit of this.body.units) {
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
        return updatedUnits;
    }

    public async saveXlf(filepath: string, originalXlfPath: string, slicedUnits: ShWvUnit[]): Promise<void> {
        const newXlf = await shwv2xlfLike(originalXlfPath, readFileSync(originalXlfPath, 'utf-8'), slicedUnits);
        writeFileSync(filepath, newXlf);
    }
}