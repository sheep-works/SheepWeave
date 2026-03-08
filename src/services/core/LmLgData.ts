import { LmLgBody, LmLgMeta, LmLgUnit } from "../../types/datatype";
import { getExtention } from "../../util";
import { lmlg2xlf } from "../converter/xlf/lmlg2xlf";
import { readFileSync, writeFileSync } from "fs";
import { DirHelper } from "./DirHelper";
import { LmLgDiffer } from "./LmLgDiffer";
import { parseTranslationFiles } from "../converter/TransPairParser";
import * as path from 'path';
import * as fs from 'fs';

export class LmLgData {
    public meta!: LmLgMeta;
    public body!: LmLgBody;

    constructor() {
        this.clear();
    }

    public clear(): void {
        this.meta = {
            bilingualPath: "",
            files: [],
            sourceLang: "",
            targetLang: ""
        };
        this.body = {
            units: []
        };
    }

    public async parse(filepath: string): Promise<void> {
        const { fileinfo, units } = await parseTranslationFiles([filepath]);
        if (fileinfo && fileinfo.length > 0) {
            this.meta.files.push(...fileinfo);
        }
        if (units && units.length > 0) {
            this.body.units.push(...units.map(u => new LmLgUnit(u)));
        }
    }
    // xlfファイルを読み込む
    // ファイル名をmeta.filesに格納する
    // body.unitsにtrans-unitの内容を追加していく

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
                throw new Error('mode is not source or target or respect or both-horizontal or both-vertical');
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


    public async writeLmlg(root: string): Promise<void> {
        const scrs = this.extract("source");
        const tgt = this.extract("target");

        const lmlgsPathFull = DirHelper.getLmlgsPath(root);
        const lmlgtPathFull = DirHelper.getLmlgtPath(root);

        writeFileSync(lmlgsPathFull, scrs.join('\n'));
        writeFileSync(lmlgtPathFull, tgt.join('\n'));
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

            // Synchronize tgt to all the units that quoted this sentence as TM
            for (const [quotedIdx, ratio] of targetUnit.ref.quoted) {
                const referencingUnit = this.body.units.find(u => u.idx === quotedIdx);
                if (referencingUnit) {
                    const tmRef = referencingUnit.ref.tms.find(tm => tm.idx === targetUnit.idx);
                    if (tmRef) {
                        tmRef.tgt = text;
                    }
                }
            }
        }
    }

    public save(root: string): void {
        const storagePathFull = DirHelper.getStoragePath(root);
        writeFileSync(storagePathFull, JSON.stringify({ meta: this.meta, body: this.body }, null, 2));
        // body.unitsをjsonファイルに出力する
    }

    public async analyze(root: string): Promise<void> {
        const units = this.body.units;

        // Load TM files
        const tmDir = path.join(root, 'Working', '01_REF', 'TM');
        let memories: any[] = [];
        if (fs.existsSync(tmDir)) {
            const tmFiles = fs.readdirSync(tmDir).map(f => path.join(tmDir, f));
            const parsedTm = await parseTranslationFiles(tmFiles);
            memories = parsedTm.units.map(u => ({ idx: -1, src: u.src, tgt: u.tgt, freeze: true }));
        }

        // Load TB files
        const tbDir = path.join(root, 'Working', '01_REF', 'TB');
        let termbase: LmLgUnit[] = [];
        if (fs.existsSync(tbDir)) {
            const tbFiles = fs.readdirSync(tbDir).map(f => path.join(tbDir, f));
            const parsedTb = await parseTranslationFiles(tbFiles);
            termbase = parsedTb.units.map(u => new LmLgUnit(u));
        }

        for (let i = 0; i < units.length; i++) {
            const currentUnit = units[i];

            // TM Matching
            const previousUnits = units.slice(0, i).map(u => ({ idx: u.idx, src: u.src, tgt: u.tgt || "" }));
            const memMatches = LmLgDiffer.batchCompare(memories, currentUnit.src, 0.6, 5);
            const prevMatches = LmLgDiffer.batchCompare(previousUnits, currentUnit.src, 0.6, 5);

            // Combine, sort, and slice to top 5
            const combinedTms = [...memMatches, ...prevMatches].sort((a, b) => b.ratio - a.ratio).slice(0, 5);
            currentUnit.ref.tms = combinedTms;

            // TB Matching
            for (const tb of termbase) {
                if (currentUnit.src.includes(tb.src)) {
                    let existingTb = currentUnit.ref.tb.find(t => t.terms.some(entry => entry.src === tb.src));
                    if (existingTb) {
                        const entry = existingTb.terms.find(e => e.src === tb.src);
                        if (entry && !entry.tgts.includes(tb.tgt)) {
                            entry.tgts.push(tb.tgt);
                        }
                    } else {
                        currentUnit.ref.tb.push({
                            terms: [{
                                src: tb.src,
                                tgts: [tb.tgt]
                            }]
                        });
                    }
                }
            }
        }

        for (let i = units.length - 1; i >= 0; i--) {
            const currentUnit = units[i];
            for (const tm of currentUnit.ref.tms) {
                if (tm.idx !== -1) { // Skip external memory refs which have idx -1
                    const referencedUnit = units.find(u => u.idx === tm.idx);
                    if (referencedUnit) {
                        referencedUnit.ref.quoted.push([currentUnit.idx, tm.ratio]);
                    }
                }
            }
        }
    }

    public async saveXlf(filepath: string): Promise<void> {
        const newXlf = await lmlg2xlf(readFileSync(this.meta.bilingualPath, 'utf-8'), this.body.units);
        writeFileSync(filepath, newXlf);
    }
}