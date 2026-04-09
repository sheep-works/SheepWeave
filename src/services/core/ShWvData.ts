import { ShWvBody, ShWvMeta, ShWvUnit } from "../../types/datatype";
import { getExtention } from "../../util";
import { shwv2xlf, parseTranslationFiles } from "../converter";
import { readFileSync, writeFileSync } from "fs";
import { DirHelper } from "./DirHelper";
import { ShWvDiffer } from "./ShWvDiffer";
import * as path from 'path';
import * as fs from 'fs';

export class ShWvData {
    public ver!: number;
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

        // Delegate search and analysis to ShWvDiffer
        await ShWvDiffer.analyze(units, memories, termbase);
    }

    public async saveXlf(filepath: string, originalXlfPath: string, slicedUnits: ShWvUnit[]): Promise<void> {
        const newXlf = await shwv2xlf(readFileSync(originalXlfPath, 'utf-8'), slicedUnits);
        writeFileSync(filepath, newXlf);
    }
}