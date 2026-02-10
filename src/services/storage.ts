/**
 * ストレージ操作。
 * project.jsonファイルの読み書きを行い、プロジェクトの状態を管理します。
 */
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectStats {
    segments: number;
    untranslated: number;
    qaWarnings: number;
    termsMatched: number;
}

export interface ProjectData {
    name?: string;
    lastPreparedAt?: string;
    sourceLang?: string;
    targetLang?: string;
    stats?: ProjectStats;
    [key: string]: any;
}

export async function readProjectJson(root: string): Promise<ProjectData> {
    const p = path.join(root, 'project.json');
    if (!fs.existsSync(p)) return {};
    try {
        const content = fs.readFileSync(p, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        console.error('Failed to read project.json', e);
        return {};
    }
}

export async function writeProjectJson(root: string, data: ProjectData) {
    const p = path.join(root, 'project.json');
    const current = await readProjectJson(root);
    const merged = { ...current, ...data };
    fs.writeFileSync(p, JSON.stringify(merged, null, 2), 'utf8');
}
