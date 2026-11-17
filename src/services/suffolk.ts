/**
 * Suffolk 関連のユーティリティ機能。
 * Suffolk WASM (suffolk-wasm) を使用して、各種ファイル形式の抽出（Extract）とマージ（Merge）を行います。
 * ネイティブ実行環境（suffolk.exe）や Java 実行環境（JRE）が不要で、全プラットフォームで高速かつタグ最小化された XLIFF 抽出が可能です。
 * 必要に応じて従来の CLI 実行（suffolk.exe）へのフォールバックにも対応しています。
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Suffolk WASM モジュールの動的ロード用キャッシュ
 */
let suffolkWasmModule: any = null;

function getSuffolkWasm(): any {
    if (!suffolkWasmModule) {
        try {
            suffolkWasmModule = require('suffolk-wasm');
        } catch (e) {
            console.warn('[Suffolk] Failed to load suffolk-wasm directly, trying relative fallback...', e);
            try {
                suffolkWasmModule = require(path.resolve(__dirname, '..', 'modules', 'Suffolk', 'pkg', 'node', 'suffolk_wasm.js'));
            } catch (err2) {
                console.error('[Suffolk] Could not load suffolk-wasm module:', err2);
                throw new Error('Suffolk WASM engine could not be loaded.');
            }
        }
    }
    return suffolkWasmModule;
}

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
 * 指定されたファイルが Suffolk でサポートされているか判定します。
 */
export function isSuffolkSupported(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    return suffolkSupportedExtensions.includes(ext);
}

/**
 * Suffolk のバージョンを取得します。
 */
export function getSuffolkVersion(): string {
    try {
        const wasm = getSuffolkWasm();
        return wasm.suffolk_version ? wasm.suffolk_version() : '0.0.3 (WASM)';
    } catch {
        return 'unknown';
    }
}

/**
 * Suffolk の実行ファイル（CLI版フォールバック用）のパスを解決します。
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
 * Suffolk を使用して原本ファイルから XLIFF 1.2 を抽出します。
 * 原則として高速な WASM コールで実行し、失敗時または明示設定時に CLI にフォールバックします。
 */
export async function runSuffolkFilter(
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
    try {
        console.log(`[Suffolk:WASM] Extracting XLIFF from: ${file}`);
        const wasm = getSuffolkWasm();
        const fileBytes = fs.readFileSync(file);
        const fileName = path.basename(file);

        const extractOptions = {
            to: 'xliff',
            srcLang: options.sourceLang || 'en',
            trgLang: options.targetLang || 'ja',
            seg: options.segmentation === 'seg'
        };

        const result = wasm.suffolk_vscode_extract
            ? wasm.suffolk_vscode_extract(fileBytes, fileName, extractOptions)
            : wasm.extract(fileBytes, fileName, extractOptions);

        if (result && typeof result.content === 'string') {
            const outDir = path.dirname(outputXlf);
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            fs.writeFileSync(outputXlf, result.content, 'utf8');
            console.log(`[Suffolk:WASM] Successfully generated XLIFF -> ${outputXlf}`);
            return;
        }
        throw new Error('Suffolk WASM extract did not return expected XLIFF content');
    } catch (wasmError: any) {
        console.warn(`[Suffolk:WASM] WASM extract failed, falling back to CLI (${wasmError.message}). File: ${file}`);
        return runSuffolkFilterCli(suffolkPath, file, outputXlf, options);
    }
}

/**
 * [フォールバック用] CLI ツール (suffolk.exe) を用いた XLIFF 抽出
 */
export function runSuffolkFilterCli(
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

        console.log(`[Suffolk:CLI] Running filter: ${suffolkPath} ${args.join(' ')}`);

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
                reject(new Error(`Suffolk CLI filter failed (code ${code}) for file "${file}":\n${errorDetail}`));
            }
        });

        p.on('error', err => {
            reject(err);
        });
    });
}

/**
 * Suffolk を使用して翻訳済み XLIFF と原本文書（スケルトン）をマージし、完成文書を出力します。
 * 原則として高速な WASM コールで実行し、失敗時に CLI にフォールバックします。
 */
export async function runSuffolkMerge(
    suffolkPath: string,
    xlfPath: string,
    skeletonFile: string,
    outputPath: string,
    rootDir?: string
): Promise<void> {
    try {
        console.log(`[Suffolk:WASM] Merging ${xlfPath} into skeleton ${skeletonFile}`);
        const wasm = getSuffolkWasm();
        const skeletonBytes = fs.readFileSync(skeletonFile);
        const fileName = path.basename(skeletonFile);
        const xlfContent = fs.readFileSync(xlfPath, 'utf8');

        const mergeFn = wasm.suffolk_vscode_merge || wasm.merge;
        const mergedBytes: Uint8Array = mergeFn(skeletonBytes, fileName, xlfContent, {});

        if (mergedBytes && mergedBytes.length > 0) {
            const outDir = path.dirname(outputPath);
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            fs.writeFileSync(outputPath, Buffer.from(mergedBytes));
            console.log(`[Suffolk:WASM] Successfully merged document -> ${outputPath}`);
            return;
        }
        throw new Error('Suffolk WASM merge produced 0 bytes output');
    } catch (wasmError: any) {
        console.warn(`[Suffolk:WASM] WASM merge failed, falling back to CLI (${wasmError.message}). Skeleton: ${skeletonFile}`);
        return runSuffolkMergeCli(suffolkPath, xlfPath, skeletonFile, outputPath, rootDir);
    }
}

/**
 * [フォールバック用] CLI ツール (suffolk.exe) を用いた文書マージ
 */
export function runSuffolkMergeCli(
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

        console.log(`[Suffolk:CLI] Running merge: ${suffolkPath} ${args.join(' ')}`);

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
                reject(new Error(`Suffolk CLI merge failed (code ${code}) for file "${skeletonFile}":\n${errorDetail}`));
            }
        });

        p.on('error', err => {
            reject(err);
        });
    });
}

/**
 * Suffolk WASM を使用した文分割（エディタ上のリアルタイム分割プレビュー用）
 */
export function suffolkSegmentText(text: string): string[] {
    try {
        const wasm = getSuffolkWasm();
        if (wasm.suffolk_vscode_segment_text) {
            return wasm.suffolk_vscode_segment_text(text);
        }
    } catch (e) {
        console.error('[Suffolk] Segment text error:', e);
    }
    return [text];
}

/**
 * Suffolk WASM を使用した原文・訳文タグ検証
 */
export function suffolkValidateTags(source: string, target: string): { valid: boolean; missing: string[]; extra: string[] } {
    try {
        const wasm = getSuffolkWasm();
        if (wasm.suffolk_vscode_validate_tags) {
            return wasm.suffolk_vscode_validate_tags(source, target);
        }
    } catch (e) {
        console.error('[Suffolk] Validate tags error:', e);
    }
    return { valid: true, missing: [], extra: [] };
}
