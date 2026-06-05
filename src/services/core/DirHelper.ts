import * as path from 'path';

export class DirHelper {
    static readonly rootToShwvs = 'Working/04_SHWV/Source.shwvs';
    static readonly rootToShwvt = 'Working/04_SHWV/Target.shwvt';
    static readonly rootToPhrases = 'Working/01_REF/phrase.json';
    static readonly rootToManage = 'Working/99_MANAGE';

    static getShwvsPath(root: string): string {
        return path.join(root, this.rootToShwvs);
    }

    static getShwvtPath(root: string): string {
        return path.join(root, this.rootToShwvt);
    }

    static getManagePath(root: string): string {
        return path.join(root, this.rootToManage);
    }

    static getStoragePath(root: string): string {
        return path.join(root, 'project.json');
    }
}