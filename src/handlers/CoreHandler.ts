import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShWvData } from '../services/core/ShWvData';
import { ProjectManager } from '../services/core/ProjectManager';
import { DirHelper } from '../services/core/DirHelper';
import { initDirs, prepareWorking, syncRefDir, preprocessor, postprocessor, runTikalExtraction, runPackage } from '../services/fileOps';
import { globalDirector } from '../store';
import { renderConfirmedDecorations } from '../features/decorators';

export class CoreHandler {
    public static async handle(message: any, globalShWvData: ShWvData, rootPath: string, panel: vscode.WebviewPanel) {
        switch (message.type) {
            case 'open-current':
                vscode.env.openExternal(vscode.Uri.file(rootPath));
                break;
            case 'archive-previous':
                await initDirs(rootPath);
                vscode.window.showInformationMessage('Project Initialized (Current Working Archived)');
                break;
            case 'extract-source':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const payload = message.payload || {};
                    await prepareWorking(rootPath);
                    
                    let sourceFiles: string[] = [];
                    const sourceDir = path.join(rootPath, 'Working', '02_SOURCE');
                    if (fs.existsSync(sourceDir)) {
                        sourceFiles = fs.readdirSync(sourceDir).filter((f: string) => fs.statSync(path.join(sourceDir, f)).isFile());
                    }

                    const projectManager = new ProjectManager(rootPath);
                    projectManager.initialize(
                        payload.projectName || 'SheepWeaveProject',
                        payload.sourceLang || 'en-US',
                        payload.targetLang || 'ja-JP',
                        sourceFiles
                    );
                    projectManager.save();

                    await runTikalExtraction(rootPath, projectManager.data.sourceLanguage, projectManager.data.targetLanguage);
                    vscode.window.showInformationMessage('Project Prepared, project.json created, and Tikal Extraction completed');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'convert-to-shwv':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const shwvData = await preprocessor(rootPath);
                    if (shwvData) {
                        globalDirector.initializeFromState();
                        panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: shwvData.meta, units: shwvData.body.units } });
                    }
                    vscode.window.showInformationMessage('Preprocessing Started (Data loaded to Webview)');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'load':
                globalShWvData.load(rootPath);
                globalDirector.initializeFromState();
                if (globalShWvData.meta && globalShWvData.body?.units?.length > 0) {
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units } });
                    vscode.window.showInformationMessage('Data Loaded and Synchronized');
                }
                break;
            case 'reanalyze':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await syncRefDir(rootPath);
                    await globalShWvData.analyze(rootPath);
                    globalDirector.initializeFromState();
                    globalShWvData.save(rootPath);
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units } });
                    vscode.window.showInformationMessage('Re-analysis completed and data updated');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'export-xliff':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await postprocessor(rootPath);
                    vscode.window.showInformationMessage('Postprocessing Finished (XLIFF exported)');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'merge-to-final':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await runPackage(rootPath);
                    vscode.window.showInformationMessage('Native Files Packaged (Merged)');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'alert':
                vscode.window.showErrorMessage(message.text);
                break;
            case 'READY':
                const config = vscode.workspace.getConfiguration('sheepWeave');
                panel.webview.postMessage({
                    type: 'CONFIG_LOADED',
                    data: {
                        sourceLang: config.get<string>('sourceLang') || 'en-US',
                        targetLang: config.get<string>('targetLang') || 'ja-JP',
                        fontSize: config.get<number>('translateTab.fontSize') || 14
                    }
                });

                if (globalShWvData.meta && globalShWvData.body.units.length > 0) {
                    panel.webview.postMessage({
                        type: 'SHWV_DATA_LOADED',
                        data: { meta: globalShWvData.meta, units: globalShWvData.body.units }
                    });
                }
                break;
            case 'update-units':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const units = message.payload || [];
                    const affectedIdxs = globalShWvData.updateUnits(units);

                    if (affectedIdxs.length > 0) {
                        // --- 1. エディタ (.shwvt) への差分同期 ---
                        const shwvtPath = DirHelper.getShwvtPath(rootPath);
                        const shwvtUri = vscode.Uri.file(shwvtPath);
                        const doc = await vscode.workspace.openTextDocument(shwvtUri);

                        const edit = new vscode.WorkspaceEdit();
                        for (const idx of affectedIdxs) {
                            const unit = globalShWvData.body.units[idx];
                            if (unit && idx < doc.lineCount) {
                                const lineRange = doc.lineAt(idx).range;
                                edit.replace(shwvtUri, lineRange, unit.tgt);
                            }
                        }
                        await vscode.workspace.applyEdit(edit);

                        // --- 2. 内部状態とデコレーションの同期 ---
                        globalDirector.initializeFromState();
                        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath === shwvtPath) {
                            renderConfirmedDecorations(vscode.window.activeTextEditor);
                        }

                        // Webviewへの通知（同期）
                        const affectedUnits = affectedIdxs.map(idx => globalShWvData.body.units[idx]).filter(u => !!u);
                        panel.webview.postMessage({
                            type: 'UNITS_UPDATED',
                            data: { units: affectedUnits, meta: globalShWvData.meta }
                        });
                        vscode.window.showInformationMessage(`Successfully applied ${units.length} changes (Modified ${affectedIdxs.length} total segments including propagation).`);
                    }
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to update units: ${err}`);
                    console.error('[CoreHandler] update-units error:', err);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'update-config':
                const updatePayload = message.payload || {};
                const workspaceConfig = vscode.workspace.getConfiguration('sheepWeave');
                if (updatePayload.fontSize !== undefined) {
                    await workspaceConfig.update('translateTab.fontSize', updatePayload.fontSize, vscode.ConfigurationTarget.Global);
                }
                break;
            default:
                break;
        }
    }
}
