/**
 * ファイル操作ユーティリティ。
 * ディレクトリの作成、アーカイブ（移動）、データのコピー処理を提供します。
 */
import * as fs from 'fs';
import * as path from 'path';

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

export async function archiveWorking(root: string) {
    const working = path.join(root, 'working');
    if (!fs.existsSync(working)) return;

    const archives = path.join(root, 'archives');
    ensureDir(archives);

    const now = new Date();
    const stamp = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + 'T' +
        String(now.getHours()).padStart(2, '0') + '-' +
        String(now.getMinutes()).padStart(2, '0') + '-' +
        String(now.getSeconds()).padStart(2, '0');

    const dest = path.join(archives, stamp);

    // If dest already exists (unlikely with seconds), append random
    if (fs.existsSync(dest)) {
        // should not happen practically
    }

    // Rename is fast, but might fail across devices. 
    // For MVP we assume same device.
    try {
        fs.renameSync(working, dest);
    } catch (e) {
        console.error('Rename failed, trying copy-delete', e);
        // Fallback could be implemented here
        throw e;
    }

    // Recreate working
    ensureDir(working);
}

export async function copyDataToWorking(root: string) {
    const data = path.join(root, 'data');
    const working = path.join(root, 'working');
    ensureDir(working);

    if (!fs.existsSync(data)) {
        console.warn('Data directory not found:', data);
        return;
    }

    const copyRecursive = (src: string, dst: string) => {
        if (fs.existsSync(dst) && fs.statSync(dst).isDirectory()) {
            // Destination exists, we merge into it
        } else {
            ensureDir(dst);
        }

        for (const name of fs.readdirSync(src)) {
            const s = path.join(src, name);
            const d = path.join(dst, name);
            const stat = fs.statSync(s);
            if (stat.isDirectory()) {
                copyRecursive(s, d);
            } else {
                fs.copyFileSync(s, d);
            }
        }
    };

    copyRecursive(data, working);
}
