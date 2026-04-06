import * as path from 'path';
import { ProjectManager } from './ProjectManager';

export class DirHelper {
    static readonly rootToShwvs = 'Working/04_SHWV/Source.shwvs';
    static readonly rootToShwvt = 'Working/04_SHWV/Target.shwvt';

    static getShwvsPath(root: string): string {
        return path.join(root, this.rootToShwvs);
    }

    static getShwvtPath(root: string): string {
        return path.join(root, this.rootToShwvt);
    }

    static getStoragePath(root: string): string {
        const projectManager = new ProjectManager(root);
        const projectName = projectManager.data.projectName || 'data';
        return path.join(root, 'Working', '03_XLF_JSON', `${projectName}.json`);
    }
}