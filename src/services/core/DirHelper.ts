import * as path from 'path';

export class DirHelper {
    static readonly rootToShwvs = 'Working/04_SHWV/Source.shwvs';
    static readonly rootToShwvt = 'Working/04_SHWV/Target.shwvt';
    static readonly rootToStorage = 'Working/03_XLF_JSON/data.json';

    static getShwvsPath(root: string): string {
        return path.join(root, this.rootToShwvs);
    }

    static getShwvtPath(root: string): string {
        return path.join(root, this.rootToShwvt);
    }

    static getStoragePath(root: string): string {
        return path.join(root, this.rootToStorage);
    }
}