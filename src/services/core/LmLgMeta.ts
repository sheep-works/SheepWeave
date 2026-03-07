import { LmLgFileInfo } from './LmLgFileInfo';

export class LmLgMeta {
    bilingualPath: string;
    files: LmLgFileInfo[];
    sourceLang: string;
    targetLang: string;

    constructor(bilingualPath: string, files: LmLgFileInfo[], sourceLang: string, targetLang: string) {
        this.bilingualPath = bilingualPath;
        this.files = files;
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
    }
}
