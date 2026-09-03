import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DirHelper } from './DirHelper';
import { ShWvData } from './ShWvData';
import { globalDirector } from '../../store';
import { renderConfirmedDecorations } from '../../features/decorators';

export interface BackupItem {
    name: string;
    folderName: string;
    createdAt: string;
    hasTarget: boolean;
    hasSource: boolean;
    hasProjectJson: boolean;
}

export class BackupOps {
    public static getBackupDir(rootPath: string): string {
        return path.join(rootPath, 'Working', '04_SHWV', 'Backup');
    }

    public static async createBackup(rootPath: string, globalShWvData: ShWvData, tag?: string): Promise<string> {
        const backupDir = this.getBackupDir(rootPath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // 1. Ensure any open dirty .shwvt editor is saved & project.json is saved to disk
        const shwvtPath = DirHelper.getShwvtPath(rootPath);
        const docs = vscode.workspace.textDocuments;
        const targetDoc = docs.find(doc => doc.fileName === shwvtPath);
        if (targetDoc && targetDoc.isDirty) {
            await targetDoc.save();
        }
        globalShWvData.save(rootPath);

        // 2. Build folder name: Backup_YYYYMMDD_HHMMSS[_TAG]
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const timeStamp = `${y}${m}${d}_${hh}${mm}${ss}`;
        const folderName = tag ? `Backup_${timeStamp}_${tag}` : `Backup_${timeStamp}`;
        const targetFolder = path.join(backupDir, folderName);

        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        // 3. Copy files: Target.shwvt -> Target.txt, Source.shwvs -> Source.txt, project.json -> project.json
        const shwvsPath = DirHelper.getShwvsPath(rootPath);
        const projectJsonPath = DirHelper.getStoragePath(rootPath);

        if (fs.existsSync(shwvtPath)) {
            fs.copyFileSync(shwvtPath, path.join(targetFolder, 'Target.txt'));
        }
        if (fs.existsSync(shwvsPath)) {
            fs.copyFileSync(shwvsPath, path.join(targetFolder, 'Source.txt'));
        }
        if (fs.existsSync(projectJsonPath)) {
            fs.copyFileSync(projectJsonPath, path.join(targetFolder, 'project.json'));
        }

        return folderName;
    }

    public static listBackups(rootPath: string): BackupItem[] {
        const backupDir = this.getBackupDir(rootPath);
        if (!fs.existsSync(backupDir)) {
            return [];
        }

        const entries = fs.readdirSync(backupDir, { withFileTypes: true });
        const list: BackupItem[] = [];

        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith('Backup_')) {
                const folderPath = path.join(backupDir, entry.name);
                const hasTarget = fs.existsSync(path.join(folderPath, 'Target.txt'));
                const hasSource = fs.existsSync(path.join(folderPath, 'Source.txt'));
                const hasProjectJson = fs.existsSync(path.join(folderPath, 'project.json'));
                const stat = fs.statSync(folderPath);

                list.push({
                    name: entry.name,
                    folderName: entry.name,
                    createdAt: stat.mtime.toISOString(),
                    hasTarget,
                    hasSource,
                    hasProjectJson
                });
            }
        }

        // Sort descending (newest first)
        list.sort((a, b) => b.name.localeCompare(a.name));
        return list;
    }

    public static async restoreBackup(rootPath: string, folderName: string, globalShWvData: ShWvData, panel: vscode.WebviewPanel): Promise<void> {
        const backupDir = this.getBackupDir(rootPath);
        const sourceFolder = path.join(backupDir, folderName);
        if (!fs.existsSync(sourceFolder)) {
            throw new Error(`Backup folder does not exist: ${folderName}`);
        }

        const backupTargetTxt = path.join(sourceFolder, 'Target.txt');
        const backupProjectJson = path.join(sourceFolder, 'project.json');
        const backupSourceTxt = path.join(sourceFolder, 'Source.txt');

        const shwvtPath = DirHelper.getShwvtPath(rootPath);
        const projectJsonPath = DirHelper.getStoragePath(rootPath);
        const shwvsPath = DirHelper.getShwvsPath(rootPath);

        // 1. Restore files on disk
        if (fs.existsSync(backupProjectJson)) {
            fs.copyFileSync(backupProjectJson, projectJsonPath);
        }
        if (fs.existsSync(backupTargetTxt)) {
            fs.copyFileSync(backupTargetTxt, shwvtPath);
        }
        if (fs.existsSync(backupSourceTxt)) {
            fs.copyFileSync(backupSourceTxt, shwvsPath);
        }

        // 2. Reload into memory
        globalShWvData.load(rootPath);
        globalDirector.initializeFromState();

        // 3. Sync open VS Code editors for Target.shwvt
        const shwvtUri = vscode.Uri.file(shwvtPath);
        const docs = vscode.workspace.textDocuments;
        const openDoc = docs.find(d => d.fileName === shwvtPath);
        if (openDoc && fs.existsSync(shwvtPath)) {
            const restoredText = fs.readFileSync(shwvtPath, 'utf-8');
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                openDoc.positionAt(0),
                openDoc.positionAt(openDoc.getText().length)
            );
            edit.replace(shwvtUri, fullRange, restoredText);
            await vscode.workspace.applyEdit(edit);
            await openDoc.save();
        }

        // 4. Update decorations
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName === shwvtPath) {
            renderConfirmedDecorations(vscode.window.activeTextEditor);
        }

        // 5. Notify Webview
        panel.webview.postMessage({
            type: 'SHWV_DATA_LOADED',
            data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo }
        });
        panel.webview.postMessage({
            type: 'BACKUP_LIST_UPDATED',
            data: { backups: this.listBackups(rootPath) }
        });
    }
}
