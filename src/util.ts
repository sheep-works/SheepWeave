import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function getExtention(filepath: string): string {
    return filepath.split('.').pop() || '';
}

/**
 * 指定されたファイルパスから上向きに探索し、'Working' ディレクトリまたは 'project.json' が含まれる「プロジェクトルート」を特定します。
 */
export function findProjectRoot(currentPath: string): string | undefined {
    let dir = currentPath;
    
    // パスがファイルなら親ディレクトリから開始
    if (fs.existsSync(dir) && fs.statSync(dir).isFile()) {
        dir = path.dirname(dir);
    }

    while (true) {
        const workingPath = path.join(dir, 'Working');
        const projectJsonPath = path.join(dir, 'project.json');
        if (
            (fs.existsSync(workingPath) && fs.statSync(workingPath).isDirectory()) ||
            (fs.existsSync(projectJsonPath) && fs.statSync(projectJsonPath).isFile())
        ) {
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

/**
 * 現在アクティブなエディタ、表示中のエディタ、またはワークスペースフォルダから適切なプロジェクトルートを特定します。
 */
export function resolveWorkspaceRoot(): string | undefined {
    // 1. アクティブなエディタから探索
    if (vscode.window.activeTextEditor) {
        const root = findProjectRoot(vscode.window.activeTextEditor.document.uri.fsPath);
        if (root) return root;
    }
    // 2. 表示中のすべてのエディタから探索
    for (const editor of vscode.window.visibleTextEditors) {
        const root = findProjectRoot(editor.document.uri.fsPath);
        if (root) return root;
    }
    // 3. ワークスペースフォルダから探索
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        for (const folder of folders) {
            const fsPath = folder.uri.fsPath;
            const root = findProjectRoot(fsPath);
            if (root) return root;
            if (
                fs.existsSync(path.join(fsPath, 'project.json')) ||
                fs.existsSync(path.join(fsPath, 'Working'))
            ) {
                return fsPath;
            }
        }
        return folders[0].uri.fsPath;
    }
    return undefined;
}
