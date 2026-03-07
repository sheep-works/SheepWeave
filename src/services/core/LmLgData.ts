import { LmLgBody, LmLgMeta, LmLgUnit } from "../../types/datatype";
import { getExtention } from "../../util";
import { xlf2lmlg } from "../converter/xlf/xlf2lmlg";
import { lmlg2xlf } from "../converter/xlf/lmlg2xlf";
import { readFileSync, writeFileSync } from "fs";
import { DirHelper } from "./DirHelper";

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
        const ext = getExtention(filepath);
        switch (ext) {
            case 'xlf':
            case 'xliff': {
                const { fileinfo, units } = await xlf2lmlg(readFileSync(filepath, 'utf-8'));
                this.meta.files.push(...fileinfo);
                this.body.units.push(...units.map(u => new LmLgUnit(u)));
                break;
            }

            case 'mxliff':
                console.log("under construction");
                break;

            case 'json':
                console.log("under construction");
                break;

            default:
                throw new Error('File is not xlf or json: ' + filepath + ' ext: ' + ext);
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
        if (this.body.units[index]) {
            this.body.units[index].tgt = text;
        }
    }

    public save(root: string): void {
        const storagePathFull = DirHelper.getStoragePath(root);
        writeFileSync(storagePathFull, JSON.stringify({ meta: this.meta, body: this.body }, null, 2));
        // body.unitsをjsonファイルに出力する
    }

    public analyze(): void {
        // Dummy method for batch analyzing LmLgUnit[] to create Ref
        // TODO: Implement using difflib.sequenceMatcher logic
        console.log("analyze() dummy method called");
    }

    public async saveXlf(filepath: string): Promise<void> {
        const newXlf = await lmlg2xlf(readFileSync(this.meta.bilingualPath, 'utf-8'), this.body.units);
        writeFileSync(filepath, newXlf);
    }
}