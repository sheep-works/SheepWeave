import { ShWvFileInfo } from './ShWvFileInfo';

export class ShWvMeta {
    bilingualPath: string;
    files: ShWvFileInfo[];
    sourceLang: string;
    targetLang: string;
    tmFiles: string[];
    tbFiles: string[];

    constructor(bilingualPath: string, files: ShWvFileInfo[], sourceLang: string, targetLang: string, tmFiles: string[] = [], tbFiles: string[] = []) {
        this.bilingualPath = bilingualPath;
        this.files = files;
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
        this.tmFiles = tmFiles;
        this.tbFiles = tbFiles;
    }
}
