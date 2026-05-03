import type { ShWvBody, ShWvMeta, ShWvUnit, ShWvRef, TranslationPair } from "../../types/datatype";
import { getExtention } from "../../util";
import { shwv2xlfLike, parseTranslationFiles } from "../converter";
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

    constructor() {
        this.clear();
    }

    public clear(): void {
        this.meta = createEmptyMeta();
        this.body = createEmptyBody();
    }

    public async parse(filepaths: string[]): Promise<void> {
        const { fileinfo, units } = await parseTranslationFiles(filepaths);
        if (fileinfo && fileinfo.length > 0) {
            this.meta.files.push(...fileinfo);
        }
        if (units && units.length > 0) {
            this.body.units.push(...units.map(u => createShWvUnit(u)));
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
            const content = fs.readFileSync(storagePathFull, 'utf-8');
            const parsed = JSON.parse(content);
            this.meta = {
                bilingualPath: parsed.meta.bilingualPath || '',
                files: parsed.meta.files || [],
                sourceLang: parsed.meta.sourceLang || '',
                targetLang: parsed.meta.targetLang || '',
                tmFiles: parsed.meta.tmFiles || [],
                tbFiles: parsed.meta.tbFiles || [],
            };
            this.body = {
                units: parsed.body.units || [],
                terms: parsed.body.terms || [],
            };
        }
    }

    public save(root: string): void {
        this.propagateAllTranslations();
        const storagePathFull = DirHelper.getStoragePath(root);
        writeFileSync(storagePathFull, JSON.stringify({ meta: this.meta, body: this.body }, null, 2));
        // body.unitsをjsonファイルに出力する
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

        if (tmFileList.length > 0) {
            const tmFilesFull = tmFileList.map(f => path.join(tmDir, f));
            const parsedTm = await parseTranslationFiles(tmFilesFull);
            memories = parsedTm.units.map((u, i) => {
                const info = parsedTm.fileinfo.find(f => i >= f.start && i <= f.end);
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
            const parsedTb = await parseTranslationFiles(tbFilesFull);
            termbase = parsedTb.units.map((u, i) => {
                const info = parsedTb.fileinfo.find(f => i >= f.start && i <= f.end);
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
            define: { name: 'SHWV_DATA' as const, version: '1.0' as const },
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