import { ShWvBody, ShWvMeta, ShWvUnit } from "../../types/datatype";
import { getExtention } from "../../util";
import { shwv2xlf, parseTranslationFiles } from "../converter";
import { readFileSync, writeFileSync } from "fs";
import { DirHelper } from "./DirHelper";
import { ShWvDiffer } from "./ShWvDiffer";
import * as path from 'path';
import * as fs from 'fs';

export class ShWvData {
    public meta!: ShWvMeta;
    public body!: ShWvBody;

    constructor() {
        this.clear();
    }

    public clear(): void {
        this.meta = {
            bilingualPath: "",
            files: [],
            sourceLang: "",
            targetLang: "",
            tmFiles: [],
            tbFiles: []
        };
        this.body = {
            units: []
        };
    }

    public async parse(filepaths: string[]): Promise<void> {
        const { fileinfo, units } = await parseTranslationFiles(filepaths);
        if (fileinfo && fileinfo.length > 0) {
            this.meta.files.push(...fileinfo);
        }
        if (units && units.length > 0) {
            this.body.units.push(...units.map(u => new ShWvUnit(u)));
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

    public load(root: string): void {
        const storagePathFull = DirHelper.getStoragePath(root);
        if (fs.existsSync(storagePathFull)) {
            const content = fs.readFileSync(storagePathFull, 'utf-8');
            const parsed = JSON.parse(content);
            this.meta = new ShWvMeta(
                parsed.meta.bilingualPath,
                parsed.meta.files,
                parsed.meta.sourceLang,
                parsed.meta.targetLang,
                parsed.meta.tmFiles || [],
                parsed.meta.tbFiles || []
            );
            this.body = parsed.body;
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
        const tmFiles = this.meta.tmFiles && this.meta.tmFiles.length > 0
            ? this.meta.tmFiles.map(f => path.join(tmDir, f))
            : (fs.existsSync(tmDir) ? fs.readdirSync(tmDir).map(f => path.join(tmDir, f)) : []);

        if (tmFiles.length > 0) {
            const parsedTm = await parseTranslationFiles(tmFiles);
            memories = parsedTm.units.map(u => ({ idx: -1, src: u.src, tgt: u.tgt, freeze: true }));
        }

        // Load TB files
        const tbDir = path.join(root, 'Working', '01_REF', 'TB');
        let termbase: ShWvUnit[] = [];
        const tbFiles = this.meta.tbFiles && this.meta.tbFiles.length > 0
            ? this.meta.tbFiles.map(f => path.join(tbDir, f))
            : (fs.existsSync(tbDir) ? fs.readdirSync(tbDir).map(f => path.join(tbDir, f)) : []);

        if (tbFiles.length > 0) {
            const parsedTb = await parseTranslationFiles(tbFiles);
            termbase = parsedTb.units.map(u => new ShWvUnit(u));
        }

        for (let i = 0; i < units.length; i++) {
            const currentUnit = units[i];

            // TM Matching
            const previousUnits = units.slice(0, i).map(u => ({ idx: u.idx, src: u.src, tgt: u.tgt || "" }));
            const memMatches = ShWvDiffer.batchCompare(memories, currentUnit.src, 0.6, 5);
            const prevMatches = ShWvDiffer.batchCompare(previousUnits, currentUnit.src, 0.6, 5);

            // Combine and sort
            const allTms = [...memMatches, ...prevMatches].sort((a, b) => b.ratio - a.ratio);

            // Deduplicate by src + tgt
            const uniqueTms: typeof allTms = [];
            const seenTm = new Set<string>();
            for (const tm of allTms) {
                const key = tm.src + '|||' + tm.tgt;
                if (!seenTm.has(key)) {
                    seenTm.add(key);
                    uniqueTms.push(tm);
                }
            }

            // Slice to top 5
            currentUnit.ref.tms = uniqueTms.slice(0, 5);

            // TB Matching
            for (const tb of termbase) {
                if (currentUnit.src.includes(tb.src)) {
                    const tbTarget = tb.tgt || tb.pre;
                    let existingTb = currentUnit.ref.tb.find(t => t.src === tb.src);
                    if (existingTb) {
                        if (!existingTb.tgts.includes(tbTarget)) {
                            existingTb.tgts.push(tbTarget);
                        }
                    } else {
                        currentUnit.ref.tb.push({
                            src: tb.src,
                            tgts: [tbTarget]
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

    public async saveXlf(filepath: string, originalXlfPath: string, slicedUnits: ShWvUnit[]): Promise<void> {
        const newXlf = await shwv2xlf(readFileSync(originalXlfPath, 'utf-8'), slicedUnits);
        writeFileSync(filepath, newXlf);
    }
}