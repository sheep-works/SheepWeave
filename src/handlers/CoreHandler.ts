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
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(rootPath));
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
                        globalDirector.loadPhrasesFromRoot(rootPath);
                        await globalDirector.loadRefData(rootPath);
                        panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: shwvData.meta, units: shwvData.body.units, phrases: globalDirector.phrases } });
                    }
                    vscode.window.showInformationMessage('Preprocessing Started (Data loaded to Webview)');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'load':
                globalShWvData.load(rootPath);
                globalDirector.initializeFromState();
                globalDirector.loadPhrasesFromRoot(rootPath);
                await globalDirector.loadRefData(rootPath);
                if (globalShWvData.meta && globalShWvData.body?.units?.length > 0) {
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases } });
                    vscode.window.showInformationMessage('Data Loaded and Synchronized');
                }
                break;
            case 'reanalyze':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await syncRefDir(rootPath);
                    await globalShWvData.analyze(rootPath);
                    globalDirector.initializeFromState();
                    globalDirector.loadRefData(rootPath); // Refresh TM/TB
                    globalShWvData.save(rootPath);
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases } });
                    vscode.window.showInformationMessage('Re-analysis completed and data updated');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'legacy-analyze':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await globalShWvData.analyze(rootPath, true);
                    globalDirector.initializeFromState();
                    globalShWvData.save(rootPath);
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases } });
                    vscode.window.showInformationMessage('Legacy Re-analysis completed and results updated');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'export-xliff':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await CoreHandler.ensureSavedAndSynced(globalShWvData, rootPath);
                    await postprocessor(rootPath);
                    vscode.window.showInformationMessage('Postprocessing Finished (XLIFF exported)');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'merge-to-final':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await CoreHandler.ensureSavedAndSynced(globalShWvData, rootPath);
                    await runPackage(rootPath);
                    vscode.window.showInformationMessage('Native Files Packaged (Merged)');
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'save-and-propagate':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await CoreHandler.ensureSavedAndSynced(globalShWvData, rootPath);
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases } });
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'manual-concordance':
                try {
                    const query = message.payload.query;
                    const mode = message.payload.mode;
                    if (!query) break;

                    const resultsBuffer = await globalDirector.tmIndex.searchAsync(query, 10);
                    const matchingIds = new Set<number>();
                    if (resultsBuffer && resultsBuffer.length > 0) {
                        for (const resultObj of resultsBuffer) {
                            if (resultObj && resultObj.result) {
                                for (const r of resultObj.result) {
                                    matchingIds.add(r as number);
                                }
                            }
                        }
                    }

                    const tmMatches = [];
                    for (const id of matchingIds) {
                        const entry = globalDirector.tmData[id];
                        if (entry) tmMatches.push(entry);
                    }

                    const tbMatches = [];
                    const qLowerCase = query.toLowerCase();
                    for (const entry of globalDirector.tbData) {
                        if (mode === 'source' && entry.src.toLowerCase().includes(qLowerCase)) {
                            tbMatches.push(entry);
                        } else if (mode === 'target' && entry.tgt.toLowerCase().includes(qLowerCase)) {
                            tbMatches.push(entry);
                        }
                    }

                    const currentDocumentMatches = [];
                    for (const unit of globalShWvData.body.units) {
                        if (mode === 'source' && unit.src.toLowerCase().includes(qLowerCase)) {
                            currentDocumentMatches.push(unit);
                        } else if (mode === 'target' && (unit.tgt || unit.pre || '').toLowerCase().includes(qLowerCase)) {
                            currentDocumentMatches.push(unit);
                        }
                    }

                    panel.webview.postMessage({
                        type: 'CONCORDANCE_SEARCH_RES', // Standardized to match ConcordanceTab expectation
                        data: {
                            query,
                            mode: mode === 'source' ? 'source' : 'target',
                            tmMatches,
                            tbMatches,
                            currentDocumentMatches
                        }
                    });
                } catch (e) {
                    console.error("Manual concordance error:", e);
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
                        data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases }
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
            case 'propagate-quoted':
                try {
                    const { idx, tgt } = message.payload;
                    const affectedIdxs = globalDirector.propagateQuoted100(idx, tgt);
                    
                    if (affectedIdxs.length > 0) {
                        const shwvtPath = DirHelper.getShwvtPath(rootPath);
                        const shwvtUri = vscode.Uri.file(shwvtPath);
                        const doc = await vscode.workspace.openTextDocument(shwvtUri);

                        const edit = new vscode.WorkspaceEdit();
                        for (const targetIdx of affectedIdxs) {
                            const unit = globalShWvData.body.units[targetIdx];
                            if (unit && targetIdx < doc.lineCount) {
                                edit.replace(shwvtUri, doc.lineAt(targetIdx).range, unit.tgt);
                            }
                        }
                        await vscode.workspace.applyEdit(edit);

                        // Sync extensions state
                        globalDirector.initializeFromState();
                        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath === shwvtPath) {
                            const { renderConfirmedDecorations } = require('../features/decorators');
                            renderConfirmedDecorations(vscode.window.activeTextEditor);
                        }

                        // Notify Webview
                        const affectedUnits = affectedIdxs.map(idx => globalShWvData.body.units[idx]).filter(u => !!u);
                        panel.webview.postMessage({
                            type: 'UNITS_UPDATED',
                            data: { units: affectedUnits, meta: globalShWvData.meta }
                        });
                        vscode.window.showInformationMessage(`Propagated to ${affectedIdxs.length} identical segments.`);
                    } else {
                        vscode.window.showInformationMessage('No identical segments found to propagate.');
                    }
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to propagate: ${err}`);
                }
                break;
            case 'update-phrases':
                const phrasesPayload = message.payload || [];
                globalDirector.phrases = phrasesPayload;
                // phrase.json に保存
                const phrasePath = path.join(rootPath, DirHelper.rootToPhrases);
                fs.writeFileSync(phrasePath, JSON.stringify(phrasesPayload, null, 2));
                vscode.window.showInformationMessage('phrase.json updated successfully.');
                break;
            default:
                break;
        }
    }

    /**
     * エディタの未保存内容を保存し、データモデル (globalShWvData) を実ファイルの内容と同期させた上で、
     * data.json への書き出しを強制的に行います。
     */
    private static async ensureSavedAndSynced(globalShWvData: ShWvData, rootPath: string) {
        const shwvtPath = DirHelper.getShwvtPath(rootPath);
        
        // 1. エディタがDirty（未保存）なら保存する
        const docs = vscode.workspace.textDocuments;
        const targetDoc = docs.find(doc => doc.fileName === shwvtPath);
        if (targetDoc && targetDoc.isDirty) {
            await targetDoc.save();
        }

        // 2. 実ファイルの内容をメモリ(globalShWvData)にロード
        globalShWvData.update(shwvtPath);

        // 3. JSONファイル(data.json)に保存
        globalShWvData.save(rootPath);
    }
}
