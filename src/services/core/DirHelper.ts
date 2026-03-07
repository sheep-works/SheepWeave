import * as path from 'path';

export class DirHelper {
    static readonly rootToLmlgs = 'Working/04_LMLG/Source.lmlgs';
    static readonly rootToLmlgt = 'Working/04_LMLG/Target.lmlgt';
    static readonly rootToStorage = 'Working/03_XLF_JSON/data.json';

    static getLmlgsPath(root: string): string {
        return path.join(root, this.rootToLmlgs);
    }

    static getLmlgtPath(root: string): string {
        return path.join(root, this.rootToLmlgt);
    }

    static getStoragePath(root: string): string {
        return path.join(root, this.rootToStorage);
    }
}