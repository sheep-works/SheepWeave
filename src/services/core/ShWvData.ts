import type { ShWvBody, ShWvMeta, ShWvUnit, ShWvRef, TranslationPair, ProjectInfo } from "../../types/datatype";
import { getExtention } from "../../util";
import { shwv2xlfLike } from "../converter";
import { readFileSync, writeFileSync } from "fs";
import { DirHelper } from "./DirHelper";
import * as path from 'path';
import * as fs from 'fs';
// --- Local adapter for analysis (avoids pulling in SheepComb's full dependency graph) ---
import { ShuttleAnalyzer } from './ShuttleAdapter';

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
        
        const { SheepShuttle } = require('../../../modules/SheepComb/logic/shuttle/sheepShuttle');
        const shuttle = new SheepShuttle();
        
        const files = filepaths.map(p => {
            const ext = p.split('.').pop()?.toLowerCase() || '';
            const isBinary = ['xlsx', 'docx'].includes(ext);
            return {
                name: path.basename(p),
                content: isBinary ? fs.readFileSync(p) : fs.readFileSync(p, 'utf-8')
            };
        });

        try {
            await shuttle.parse(files);
            shuttle.process();
            shuttle.convert();

            const parsedData = shuttle.data;
            if (parsedData) {
                if (parsedData.meta.files && parsedData.meta.files.length > 0) {
                    this.meta.files.push(...parsedData.meta.files);
                }
                if (parsedData.body.units && parsedData.body.units.length > 0) {
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
     * Propagates a translation to all units that have quoted this unit as a TM match.
     * Handles both fuzzy matches (quoted) and 100% matches (quoted100).
     */
    public propagateAllTranslations(): void {
        for (const unit of this.body.units) {
            if (!unit.tgt) continue;

            // Synchronize tgt to all the units that quoted this sentence as TM (Fuzzy)
            for (const [quotedIdx, ratio] of unit.ref.quoted) {
                const referencingUnit = this.body.units[quotedIdx];
                if (!referencingUnit || referencingUnit.idx !== quotedIdx) continue;

                const tmRef = referencingUnit.ref.tms.find(tm => tm.idx === unit.idx);
                if (tmRef) {
                    tmRef.tgt = unit.tgt;
                }
            }

            // Synchronize tgt to all the units that quoted this sentence as TM (100%)
            for (const quotedIdx of unit.ref.quoted100) {
                const referencingUnit = this.body.units[quotedIdx];
                if (!referencingUnit || referencingUnit.idx !== quotedIdx) continue;

                const tmRef = referencingUnit.ref.tms.find(tm => tm.idx === unit.idx);
                if (tmRef) {
                    tmRef.tgt = unit.tgt;
                }
            }
        }
    }

    public load(root: string): void {
        const storagePathFull = DirHelper.getStoragePath(root);
        if (fs.existsSync(storagePathFull)) {
            try {
                const content = fs.readFileSync(storagePathFull, 'utf-8');
                const parsed = JSON.parse(content);
                this.meta = {
                    bilingualPath: parsed.meta?.bilingualPath || '',
                    files: parsed.meta?.files || [],
                    sourceLang: parsed.meta?.sourceLang || '',
                    targetLang: parsed.meta?.targetLang || '',
                    tmFiles: parsed.meta?.tmFiles || [],
                    tbFiles: parsed.meta?.tbFiles || [],
                };
                this.body = {
                    units: parsed.body?.units || [],
                    terms: parsed.body?.terms || [],
                };
                if (parsed.projectInfo || parsed.define?.version === '1.1') {
                    this.projectInfo = parsed.projectInfo;
                }

                // If unified project.json (Ver 1.1) is loaded, and Working folders/files are missing, automatically restore them.
                if (parsed.define?.version === '1.1' && this.body.units.length > 0) {
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

        writeFileSync(storagePathFull, JSON.stringify({
            define: { name: 'SHWV_DATA', version: '1.1' },
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
        const { SheepShuttle } = require('../../../modules/SheepComb/logic/shuttle/sheepShuttle');

        if (tmFileList.length > 0) {
            const tmFilesFull = tmFileList.map(f => path.join(tmDir, f));
            const shuttleTm = new SheepShuttle();
            const tmFiles = tmFilesFull.map(p => {
                const ext = p.split('.').pop()?.toLowerCase() || '';
                const isBinary = ['xlsx', 'docx'].includes(ext);
                return { name: path.basename(p), content: isBinary ? fs.readFileSync(p) : fs.readFileSync(p, 'utf-8') };
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
            const tbFilesFull = tbFileList.map(f => path.join(tbDir, f));
            const shuttleTb = new SheepShuttle();
            const tbFiles = tbFilesFull.map(p => {
                const ext = p.split('.').pop()?.toLowerCase() || '';
                const isBinary = ['xlsx', 'docx'].includes(ext);
                return { name: path.basename(p), content: isBinary ? fs.readFileSync(p) : fs.readFileSync(p, 'utf-8') };
            });
            await shuttleTb.parse(tbFiles);
            shuttleTb.process();
            shuttleTb.convert();
            const parsedTb = shuttleTb.data;

            termbase = parsedTb.body.units.map((u: any, i: number) => {
                const info = parsedTb.meta.files.find((f: any) => i >= f.start && i <= f.end);
                return { ...u, file: info?.name };
            });
        }

        // Include internal terms
        if (this.body.terms && this.body.terms.length > 0) {
            termbase.push(...this.body.terms.map(t => ({ ...t, file: "Internal" })));
        }

        // Delegate search and analysis to SheepComb's ShuttleAnalyzer
        const { analyze_all } = require('sheep-spindle');
        const analyzer = new ShuttleAnalyzer();
        const shwvData = {
            define: { name: 'SHWV_DATA' as const, version: '1.1' as const },
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