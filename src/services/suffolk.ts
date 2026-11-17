/**
 * Suffolk 関連のユーティリティ機能。
 * Pure Rust で実装された Suffolk CLI ツールを使用して、各種ファイル形式の抽出（Extract）とマージ（Merge）を行います。
 * Java 実行環境（JRE）が不要で、高速かつタグ最小化された XLIFF 抽出が可能です。
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Suffolk がネイティブサポートするファイル拡張子のリスト。
 */
export const suffolkSupportedExtensions: string[] = [
    '.docx',
    '.xlsx',
    '.pptx',
    '.idml',
    '.html',
    '.htm',
    '.md',
    '.txt',
];

/**
 * Suffolk の実行ファイルのパスを解決します。
 * 1. 設定 `sheepWeave.suffolkPath`
 * 2. 拡張機能同梱バイナリ (`bin/win32/suffolk.exe`)
 * 3. ワークスペースの `bin/win32/suffolk.exe`
 * 4. 開発環境フォールバック (`../Suffolk/target/release/suffolk.exe`)
 */
export function resolveSuffolkPath(rootDir?: string): string {
    const configPath = vscode.workspace
        .getConfiguration('sheepWeave')
        .get<string>('suffolkPath');

    if (configPath && fs.existsSync(configPath)) {
        return configPath;
    }

    // 1. Check bundled binary in extension directory
    const ext = vscode.extensions.getExtension('mimi-h.sheepweave');
    if (ext) {
        const bundledPath = path.join(ext.extensionPath, 'bin', 'win32', 'suffolk.exe');
        if (fs.existsSync(bundledPath)) {
            return bundledPath;
        }
    }

    // Fallback: check relative to __dirname (handles webpack output)
    const directBundled = path.resolve(__dirname, '..', 'bin', 'win32', 'suffolk.exe');
    if (fs.existsSync(directBundled)) {
        return directBundled;
    }

    const directBundledSameDir = path.resolve(__dirname, 'bin', 'win32', 'suffolk.exe');
    if (fs.existsSync(directBundledSameDir)) {
        return directBundledSameDir;
    }

    // 2. Check workspace root
    const workspace = rootDir || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspace) {
        const workspaceBin = path.join(workspace, 'bin', 'win32', 'suffolk.exe');
        if (fs.existsSync(workspaceBin)) {
            return workspaceBin;
        }

        // 3. Check development sibling repository (../Suffolk)
        const siblingSuffolk = path.resolve(workspace, '..', 'Suffolk', 'target', 'release', 'suffolk.exe');
        if (fs.existsSync(siblingSuffolk)) {
            return siblingSuffolk;
        }
    }

    // 4. Default to binary name if found in PATH
    return 'suffolk.exe';
}

/**
 * 指定されたファイルが Suffolk でサポートされているか判定します。
 */
export function isSuffolkSupported(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    return suffolkSupportedExtensions.includes(ext);
}

/**
 * Suffolk を使用して原本ファイルから XLIFF 1.2 を抽出します。
 */
export function runSuffolkFilter(
    suffolkPath: string,
    file: string,
    outputXlf: string,
    options: {
        sourceLang?: string;
        targetLang?: string;
        segmentation?: string;
        rootDir?: string;
    } = {}
): Promise<void> {
    return new Promise((resolve, reject) => {
        const args: string[] = ['filter', `"${file}"`, '--to', 'xliff', '-o', `"${outputXlf}"`];

        if (options.sourceLang) {
            args.push('-s', options.sourceLang);
        }
        if (options.targetLang) {
            args.push('-t', options.targetLang);
        }
        if (options.segmentation === 'seg') {
            args.push('-g');
        }

        console.log(`[Suffolk] Running filter: ${suffolkPath} ${args.join(' ')}`);

        let stdout = '';
        let stderr = '';

        const spawnOptions: { shell: boolean; cwd?: string } = { shell: true };
        if (options.rootDir && fs.existsSync(options.rootDir)) {
            spawnOptions.cwd = options.rootDir;
        }

        const p = spawn(suffolkPath, args, spawnOptions);

        p.stdout.on('data', d => {
            const content = d.toString();
            stdout += content;
            console.log(`[suffolk:filter] ${content}`);
        });

        p.stderr.on('data', d => {
            const content = d.toString();
            stderr += content;
            console.error(`[suffolk:filter:error] ${content}`);
        });

        p.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                const errorDetail = stderr.trim() || stdout.trim();
                reject(new Error(`Suffolk filter failed (code ${code}) for file "${file}":\n${errorDetail}`));
            }
        });

        p.on('error', err => {
            reject(err);
        });
    });
}

/**
 * Suffolk を使用して翻訳済み XLIFF と原本文書（スケルトン）をマージし、完成文書を出力します。
 */
export function runSuffolkMerge(
    suffolkPath: string,
    xlfPath: string,
    skeletonFile: string,
    outputPath: string,
    rootDir?: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        const args: string[] = [
            'merge',
            `"${xlfPath}"`,
            '-s',
            `"${skeletonFile}"`,
            '-o',
            `"${outputPath}"`
        ];

        console.log(`[Suffolk] Running merge: ${suffolkPath} ${args.join(' ')}`);

        let stdout = '';
        let stderr = '';

        const spawnOptions: { shell: boolean; cwd?: string } = { shell: true };
        if (rootDir && fs.existsSync(rootDir)) {
            spawnOptions.cwd = rootDir;
        }

        const p = spawn(suffolkPath, args, spawnOptions);

        p.stdout.on('data', d => {
            const content = d.toString();
            stdout += content;
            console.log(`[suffolk:merge] ${content}`);
        });

        p.stderr.on('data', d => {
            const content = d.toString();
            stderr += content;
            console.error(`[suffolk:merge:error] ${content}`);
        });

        p.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                const errorDetail = stderr.trim() || stdout.trim();
                reject(new Error(`Suffolk merge failed (code ${code}) for file "${skeletonFile}":\n${errorDetail}`));
            }
        });

        p.on('error', err => {
            reject(err);
        });
    });
}
