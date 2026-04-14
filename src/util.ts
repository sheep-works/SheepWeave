import * as fs from 'fs';
import * as path from 'path';

export function getExtention(filepath: string): string {
    return filepath.split('.').pop() || '';
}

/**
 * 指定されたファイルパスから上向きに探索し、'Working' ディレクトリが含まれる「プロジェクトルート」を特定します。
 */
export function findProjectRoot(currentPath: string): string | undefined {
    let dir = currentPath;
    
    // パスがファイルなら親ディレクトリから開始
    if (fs.existsSync(dir) && fs.statSync(dir).isFile()) {
        dir = path.dirname(dir);
    }

    while (true) {
        const workingPath = path.join(dir, 'Working');
        if (fs.existsSync(workingPath) && fs.statSync(workingPath).isDirectory()) {
            return dir;
        }

        const parent = path.dirname(dir);
        if (parent === dir) {
            break; // ルートに到達
        }
        dir = parent;
    }

    return undefined;
}