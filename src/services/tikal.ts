import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// https://docs.oasis-open.org/xliff/xliff-core/v2.1/os/xliff-core-v2.1-os.html#file-formats
// tikal で変換できる拡張子が分かればここに追加する
export const supportedExtensions: string[] = [
  '.docx', '.pptx', '.xlsx',
  '.html', '.xhtml',
  '.xml',
  '.json', '.yaml', '.yml',
  '.properties', '.po',
  '.csv', '.tsv',
  '.xlf', '.xliff', '.mqxliff', '.mxliff', '.sdlxliff'
];

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

export function groupFilesByFilter(dir: string): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  if (!fs.existsSync(dir)) return groups;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!supportedExtensions.includes(ext)) continue; // Unsupported files are ignored

    const fc = 'auto'; // Default Tikal auto-detect
    groups[fc] ??= [];
    groups[fc].push(path.join(dir, entry.name));
  }

  return groups;
}

export function runTikal(
  tikalPath: string,
  filter: string,
  file: string, // Changed from files: string[] to file: string
  mode: 'extract' | 'merge',
  sourceLang?: string,
  targetLang?: string
): Promise<void> {
  return new Promise((resolve, reject) => {

    const args: string[] = [];

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
      args.push('-x');
    } else {
      args.push('-m');
    }

    // Node.js will automatically quote if needed when shell: false, 
    // but with shell: true on Windows, we should explicitly double-quote paths with spaces.
    args.push(`"${file}"`);

    console.log(`Running Tikal: ${tikalPath} ${args.join(' ')}`);

    let stdout = '';
    let stderr = '';

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
        // Provide the captured stderr (or stdout as fallback) to the reject reason
        const errorDetail = stderr.trim() || stdout.trim();
        const errorMessage = `Tikal exited with code ${code} for file "${file}".\n${errorDetail}`;
        reject(new Error(errorMessage));
      }
    });

    p.on('error', err => {
      reject(err);
    });
  });
}
