/**
 * Tikal関連のユーティリティ機能。
 * Okapi FrameworkのTikalコマンドラインツールを使用して、各種ファイル形式の抽出（Extract）とマージ（Merge）を行います。
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// https://docs.oasis-open.org/xliff/xliff-core/v2.1/os/xliff-core-v2.1-os.html#file-formats
/**
 * Tikalが公式にサポートするファイル拡張子のリスト。
 * .xlf, .xliff, .mxliff, .mqxliff, .sdlxliff も含まれますが、
 * SheepWeave ではこれらを自前のパーサーで処理するため、Tikal の Extract/Merge 処理からは除外されます。
 */
export const supportedExtensions: string[] = [
  '.docx', '.pptx', '.xlsx',
  '.html', '.xhtml',
  '.xml',
  '.json', '.yaml', '.yml',
  '.properties', '.po',
  '.csv', '.tsv',
  '.xlf', '.xliff', '.mqxliff', '.mxliff', '.sdlxliff'
];

/**
 * Tikalの実行ファイルのパスを解決します。
 * 設定 `sheepWeave.tikalPath` を優先し、なければワークスペースの `okapi` フォルダ内を探します。
 */
export function resolveTikalPath(): string {
  const configPath = vscode.workspace
    .getConfiguration('sheepWeave')
    .get<string>('tikalPath');

  if (configPath && fs.existsSync(configPath)) {
    return configPath;
  }

  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    throw new Error('No workspace folder found');
  }

  const base = path.join(workspace.uri.fsPath, 'okapi');
  const tikal = process.platform === 'win32'
    ? path.join(base, 'tikal.bat')
    : path.join(base, 'tikal.sh');

  if (!fs.existsSync(tikal)) {
    throw new Error(`Tikal not found at: ${tikal}. Please download Okapi and place it in the workspace "okapi" folder, or set the "sheepWeave.tikalPath" configuration.`);
  }

  return tikal;
}

/**
 * 指定されたディレクトリ内のファイルをTikalのフィルタIDごとにグループ化します。
 * 現状は `supportedExtensions` に合致するものをすべて `auto`（Tikalによる自動判定）グループに分類します。
 * サポート外の拡張子は無視されます。
 * 
 * @param dir スキャン対象のディレクトリ
 * @returns フィルタID（現状は 'auto' のみ）をキーとした、絶対パスの配列
 */
export function groupFilesByFilter(dir: string): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  if (!fs.existsSync(dir)) return groups;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    // サポート対象外のファイルは、フィルタをかけず、抽出対象からも外します（無視）
    if (!supportedExtensions.includes(ext)) continue;

    const fc = 'auto'; // デフォルトではTikalの自動判定（Filter Configuration = auto）を使用
    groups[fc] ??= [];
    groups[fc].push(path.join(dir, entry.name));
  }

  return groups;
}

/**
 * Tikalコマンドを実行して、ファイルの抽出（Extract）またはマージ（Merge）を行います。
 * 
 * @param tikalPath Tikal実行ファイルのパス
 * @param filter フィルタ構成ID（'auto' または特定のID。'-fc' オプションに使用）
 * @param file 処理対象の単一ファイルパス
 * @param mode 'extract'（原文からXLIFFを抽出）または 'merge'（翻訳済みXLIFFを原文形式に復元）
 * @param sourceLang ソース言語コード（例: 'en'）
 * @param targetLang ターゲット言語コード（例: 'ja'）
 */
export function runTikal(
  tikalPath: string,
  filter: string,
  file: string, // Files配列から単一のFileパスに変更されました
  mode: 'extract' | 'merge',
  sourceLang?: string,
  targetLang?: string
): Promise<void> {
  return new Promise((resolve, reject) => {

    const args: string[] = [];

    // 特定のフィルタが指定されている場合は -fc オプションを追加
    if (filter && filter !== 'auto') {
      args.push('-fc', filter);
    }

    if (sourceLang) {
      args.push('-sl', sourceLang);
    }
    if (targetLang) {
      args.push('-tl', targetLang);
    }

    if (mode === 'extract') {
      args.push('-x'); // 抽出モード
    } else {
      args.push('-m'); // マージモード
    }

    // パスにスペースが含まれる場合を考慮して、引用符で囲んで追加
    args.push(`"${file}"`);

    console.log(`Running Tikal: ${tikalPath} ${args.join(' ')}`);

    let stdout = '';
    let stderr = '';

    // Windows環境での実行を考慮し、shell: true で spawn を実行
    const p = spawn(tikalPath, args, { shell: true });

    p.stdout.on('data', d => {
      const content = d.toString();
      stdout += content;
      console.log(`[tikal] ${content}`);
    });
    p.stderr.on('data', d => {
      const content = d.toString();
      stderr += content;
      console.error(`[tikal:error] ${content}`);
    });

    p.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        // エラー発生時はstderr、またはstdoutの内容をエラーメッセージとして返却
        const errorDetail = stderr.trim() || stdout.trim();

        // ファイル名の文字コード問題（Javaの内部エンコーディング制限）によるエラーを補足
        if (errorDetail.includes('Illegal char')) {
          const errorMessage = `Tikal failed because of file name encoding: "${file}".\n${errorDetail}`;
          reject(new Error(errorMessage));
          return;
        }

        const errorMessage = `Tikal exited with code ${code} for file "${file}".\n${errorDetail}`;
        reject(new Error(errorMessage));
      }
    });

    p.on('error', err => {
      reject(err);
    });
  });
}
