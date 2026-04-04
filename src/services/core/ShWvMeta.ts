import { ShWvFileInfo } from './ShWvFileInfo';

export class ShWvMeta {
    bilingualPath: string;
    files: ShWvFileInfo[];
    sourceLang: string;
    targetLang: string;

    constructor(bilingualPath: string, files: ShWvFileInfo[], sourceLang: string, targetLang: string) {
        this.bilingualPath = bilingualPath;
        this.files = files;
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
    }
}
