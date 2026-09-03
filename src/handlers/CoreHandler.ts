import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShWvData } from '../services/core/ShWvData';
import { ProjectManager } from '../services/core/ProjectManager';
import { DirHelper } from '../services/core/DirHelper';
import { initDirs, prepareWorking, syncRefDir, preprocessor, postprocessor, runTikalExtraction, runPackage, saveAndCloseShwvEditors, incrementalAddSource, advanceWorkflow } from '../services/fileOps';
import { globalDirector } from '../store';
import { renderConfirmedDecorations } from '../features/decorators';
import { BackupOps } from '../services/core/backupOps';

let isLlmBatchCancelled = false;

export class CoreHandler {
    public static async handle(message: any, globalShWvData: ShWvData, rootPath: string, panel: vscode.WebviewPanel) {
        switch (message.type) {
            case 'open-current':
                try {
                    if (fs.existsSync(rootPath)) {
                        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(rootPath));
                    } else {
                        vscode.window.showErrorMessage(`フォルダが存在しません: ${rootPath}`);
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`エクスプローラーを開けませんでした: ${err.message || err}`);
                }
                break;
            case 'open-workflow-ini': {
                const workflowPath = path.join(rootPath, 'workflow.ini');
                if (!fs.existsSync(workflowPath)) {
                    const defaultIniContent = "index=1\nrole=Translation\nname=Sheep\nsegmentation=line\n";
                    fs.writeFileSync(workflowPath, defaultIniContent, 'utf-8');
                }
                vscode.workspace.openTextDocument(workflowPath).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
                break;
            }
            case 'archive-previous':
                await initDirs(rootPath);
                vscode.window.showInformationMessage('Project Initialized (Current Working Archived)');
                break;
            case 'extract-source':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const payload = message.payload || {};
                    let customFilter: string | undefined = undefined;

                    if (payload.useFprmFilter) {
                        if (payload.selectedFilterFile) {
                            const targetPath = path.join(rootPath, payload.selectedFilterFile);
                            if (!fs.existsSync(targetPath)) {
                                vscode.window.showErrorMessage(`指定されたフィルタファイルが見つかりません: ${payload.selectedFilterFile}`);
                                return;
                            }
                            customFilter = payload.selectedFilterFile;
                        } else {
                            vscode.window.showWarningMessage('フィルタファイルが選択されていません。');
                            return;
                        }
                    }

                    await prepareWorking(rootPath);
                    
                    let sourceFiles: string[] = [];
                    const sourceDir = path.join(rootPath, 'Working', '02_SOURCE');
                    if (fs.existsSync(sourceDir)) {
                        sourceFiles = fs.readdirSync(sourceDir).filter((f: string) => !f.startsWith('~$') && fs.statSync(path.join(sourceDir, f)).isFile());
                    }

                    const projectManager = new ProjectManager(rootPath);
                    projectManager.initialize(
                        payload.projectName || 'SheepWeaveProject',
                        payload.sourceLang || 'en-US',
                        payload.targetLang || 'ja-JP',
                        sourceFiles
                    );
                    projectManager.save();

                    await runTikalExtraction(rootPath, projectManager.data.sourceLanguage, projectManager.data.targetLanguage, customFilter);
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
                        panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: shwvData.meta, units: shwvData.body.units, phrases: globalDirector.phrases, projectInfo: shwvData.projectInfo } });
                    }
                    vscode.window.showInformationMessage('Preprocessing Started (Data loaded to Webview)');
                } catch (err: any) {
                    console.error("[CoreHandler] Error during convert-to-shwv:", err);
                    vscode.window.showErrorMessage(`Error executing convert-to-shwv: ${err.message || err}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'advance-workflow':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const result = await advanceWorkflow(rootPath);
                    globalDirector.initializeFromState();
                    vscode.window.visibleTextEditors.forEach(editor => {
                        renderConfirmedDecorations(editor);
                    });
                    panel.webview.postMessage({
                        type: 'SHWV_DATA_LOADED',
                        data: {
                            meta: result.data.meta,
                            units: result.data.body.units,
                            phrases: globalDirector.phrases,
                            projectInfo: result.data.projectInfo
                        }
                    });
                    vscode.window.showInformationMessage(`Workflow advanced to Step ${result.newIndex}. Exported: Workflow-${result.previousIndex}.txt`);
                } catch (err: any) {
                    console.error("[CoreHandler] Error during advance-workflow:", err);
                    vscode.window.showErrorMessage(`Error executing advance-workflow: ${err.message || err}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'generate-sample':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await initDirs(rootPath);
                    const targetPath = path.join(rootPath, 'project.json');
                    
                    const filesInRoot = fs.readdirSync(rootPath);
                    const projectJsonFile = filesInRoot.find(f => f.startsWith('project_') && f.endsWith('.json'));
                    
                    if (!projectJsonFile) {
                        vscode.window.showErrorMessage('No sample file (project_xxxx.json) found in the root directory.');
                        break;
                    }

                    const samplePath = path.join(rootPath, projectJsonFile);
                    const sampleContent = fs.readFileSync(samplePath, 'utf-8');
                    const sample = JSON.parse(sampleContent);

                    // Modify sample data paths to be absolute based on rootPath
                    if (sample.meta && sample.meta.files && sample.meta.files.length > 0) {
                        const xlfName = sample.meta.files[0].name;
                        // Attempt to guess the source file name (usually minus .xlf)
                        const sourceName = xlfName.replace(/\.xlf$/i, '').replace(/\.xliff$/i, '');
                        
                        sample.meta.bilingualPath = path.join(rootPath, 'Working', '03_XLF_JSON', xlfName);
                        if (sample.projectInfo && sample.projectInfo.okapi && sample.projectInfo.okapi[0] && sample.projectInfo.okapi[0].files[0]) {
                            sample.projectInfo.okapi[0].files[0].source = path.join(rootPath, 'Working', '02_SOURCE', sourceName);
                            sample.projectInfo.okapi[0].files[0].xliff = sample.meta.bilingualPath;
                        }
                    }

                    fs.writeFileSync(targetPath, JSON.stringify(sample, null, 2), 'utf-8');
                    globalShWvData.load(rootPath);
                    globalDirector.initializeFromState();
                    globalDirector.loadPhrasesFromRoot(rootPath);
                    await globalDirector.loadRefData(rootPath);
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo } });
                    vscode.window.showInformationMessage(`Sample Project Generated from ${projectJsonFile}!`);
                } catch (e: any) {
                    vscode.window.showErrorMessage(`Failed to generate sample: ${e.message || e}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'load':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await saveAndCloseShwvEditors(rootPath);
                    globalShWvData.load(rootPath);
                    await globalShWvData.writeShwv(rootPath);
                    globalDirector.initializeFromState();
                    globalDirector.loadPhrasesFromRoot(rootPath);
                    await globalDirector.loadRefData(rootPath);
                    if (globalShWvData.meta && globalShWvData.body?.units?.length > 0) {
                        panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo } });
                        vscode.window.showInformationMessage('Data Loaded and Synchronized');
                    }
                } catch (e: any) {
                    vscode.window.showErrorMessage(`Failed to load data: ${e.message || e}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'add-files':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    await saveAndCloseShwvEditors(rootPath);
                    const updatedData = await incrementalAddSource(rootPath);
                    if (updatedData) {
                        globalDirector.initializeFromState();
                        globalDirector.loadPhrasesFromRoot(rootPath);
                        await globalDirector.loadRefData(rootPath);
                        panel.webview.postMessage({ 
                            type: 'SHWV_DATA_LOADED', 
                            data: { 
                                meta: updatedData.meta, 
                                units: updatedData.body.units, 
                                phrases: globalDirector.phrases,
                                projectInfo: updatedData.projectInfo
                            } 
                        });
                    }
                } catch (e: any) {
                    vscode.window.showErrorMessage(`Failed to add files: ${e.message || e}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
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
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo } });
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
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo } });
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
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo } });
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'manual-concordance':
                try {
                    const query = message.payload.query;
                    const mode = (message.payload.mode === 'source' ? 'source' : 'target') as 'source' | 'target';
                    if (!query) break;

                    const tmMatches = globalDirector.concordance.search(query, mode, 50);

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
                let versionLogs = '';
                try {
                    const candidatePaths: string[] = [
                        path.join(__dirname, 'VersionLogs.md'),
                        path.join(__dirname, '..', 'VersionLogs.md'),
                        path.join(__dirname, '..', '..', 'VersionLogs.md'),
                        path.join(rootPath, 'VersionLogs.md'),
                        path.join(rootPath, '..', 'VersionLogs.md')
                    ];
                    const ext = vscode.extensions.getExtension('LambuageLLC.sheep-weave') || vscode.extensions.all.find(e => e.id.toLowerCase().includes('sheepweave') || e.id.toLowerCase().includes('sheep-weave'));
                    if (ext) {
                        candidatePaths.unshift(path.join(ext.extensionPath, 'VersionLogs.md'));
                    }
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        candidatePaths.push(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'VersionLogs.md'));
                    }
                    for (const p of candidatePaths) {
                        if (fs.existsSync(p)) {
                            versionLogs = fs.readFileSync(p, 'utf-8');
                            break;
                        }
                    }
                } catch (e) {
                    console.error('Failed to read VersionLogs.md:', e);
                }
                panel.webview.postMessage({
                    type: 'CONFIG_LOADED',
                    data: {
                        sourceLang: config.get<string>('sourceLang') || 'en-US',
                        targetLang: config.get<string>('targetLang') || 'ja-JP',
                        fontSize: config.get<number>('translateTab.fontSize') || 14,
                        bobbinApiKey: config.get<string>('bobbinApiKey') || '',
                        autoReflectLlmToTm: config.get<boolean>('autoReflectLlmToTm') ?? true,
                        versionLogs
                    }
                });

                if (globalShWvData.meta && globalShWvData.body.units.length > 0) {
                    panel.webview.postMessage({
                        type: 'SHWV_DATA_LOADED',
                        data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo }
                    });
                }

                try {
                    panel.webview.postMessage({
                        type: 'BACKUP_LIST_UPDATED',
                        data: { backups: BackupOps.listBackups(rootPath) }
                    });
                } catch (e) {
                    console.error('Failed to list backups on READY:', e);
                }
                break;
            case 'update-units':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const units = message.payload || [];
                    const affectedIdxs = globalShWvData.updateUnits(units);

                    // Propagate updated target to units that reference these units as TM (ref.tms)
                    const tmRefPropagatedSet = new Set<number>();
                    for (const idx of affectedIdxs) {
                        const propagated = globalShWvData.propagateSingleUnit(idx);
                        propagated.forEach(pIdx => tmRefPropagatedSet.add(pIdx));
                    }
                    const allAffectedUnitsSet = new Set([...affectedIdxs, ...tmRefPropagatedSet]);

                    if (allAffectedUnitsSet.size > 0) {
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
                        const affectedUnits = Array.from(allAffectedUnitsSet).map(idx => globalShWvData.body.units[idx]).filter(u => !!u);
                        panel.webview.postMessage({
                            type: 'UNITS_UPDATED',
                            data: { units: affectedUnits, meta: globalShWvData.meta }
                        });
                        vscode.window.showInformationMessage(`Successfully applied ${units.length} changes (Modified ${allAffectedUnitsSet.size} total segments including propagation).`);
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
                if (updatePayload.bobbinApiKey !== undefined) {
                    await workspaceConfig.update('bobbinApiKey', updatePayload.bobbinApiKey, vscode.ConfigurationTarget.Global);
                }
                if (updatePayload.autoReflectLlmToTm !== undefined) {
                    await workspaceConfig.update('autoReflectLlmToTm', updatePayload.autoReflectLlmToTm, vscode.ConfigurationTarget.Global);
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
            case 'toggle-pe-ref':
                try {
                    const { idx, isPeRef } = message.payload;
                    const unit = globalShWvData.body.units.find(u => u.idx === idx);
                    if (unit) {
                        unit.isPeRef = isPeRef ? true : undefined;
                        globalShWvData.save(rootPath);
                    }
                } catch (err) {
                    console.error('Failed to toggle PE Ref:', err);
                }
                break;
            case 'run-llm-request':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const { chunk, prompt, mode } = message.payload;
                    let finalPrompt = prompt;

                    if (mode === 'advanced') {
                        // Parse chunk to find minimum segment index
                        const chunkArray = JSON.parse(chunk);
                        const minIndex = chunkArray.length > 0 ? Math.min(...chunkArray.map((u: any) => u.idx)) : 0;

                        // 1. Fetch preceding 3 translated context segments
                        const precedingExamples: any[] = [];
                        for (let i = minIndex - 1; i >= 0; i--) {
                            const u = globalShWvData.body.units[i];
                            if (u && u.tgt && u.tgt.trim() !== '') {
                                precedingExamples.push({
                                    src: u.src,
                                    pre: u.pre || '',
                                    tgt: u.tgt
                                });
                                if (precedingExamples.length >= 3) break;
                            }
                        }

                        // 2. Fetch global pinned PE references
                        const markedExamples = globalShWvData.body.units
                            .filter(u => u.isPeRef && u.tgt && u.tgt.trim() !== '')
                            .map(u => ({
                                src: u.src,
                                pre: u.pre || '',
                                tgt: u.tgt
                            }));

                        let promptAdditions = '';

                        if (markedExamples.length > 0) {
                            promptAdditions += `\n\n# ユーザー指定の編集ルール（最優先）:\n`;
                            promptAdditions += `以下はユーザーが手動で登録した手直しの修正例です。これらに示される用語の変更や文法的な手直し（PE）のパターンを最優先で適用してください。\n\n`;
                            markedExamples.forEach((ex, idx) => {
                                promptAdditions += `例 ${idx + 1}:\n原文: ${ex.src}\n下訳: ${ex.pre}\n手直し後: ${ex.tgt}\n---\n`;
                            });
                        }

                        if (precedingExamples.length > 0) {
                            promptAdditions += `\n\n# 近傍の編集履歴（参考例）:\n`;
                            promptAdditions += `ユーザーは直前の文で以下のように手直しをしています。今回の翻訳でもこの修正傾向（トーン＆マナーや用語の選択）を考慮してください。\n\n`;
                            precedingExamples.reverse().forEach((ex, idx) => {
                                promptAdditions += `例 ${idx + 1}:\n原文: ${ex.src}\n下訳: ${ex.pre}\n手直し後: ${ex.tgt}\n---\n`;
                            });
                        }

                        finalPrompt = prompt + promptAdditions;
                    }

                    const response = await runLlmRequest(chunk, finalPrompt);
                    panel.webview.postMessage({ type: 'LLM_RESPONSE', data: { response } });
                } catch (err: any) {
                    panel.webview.postMessage({ type: 'LLM_ERROR', data: { error: err.message || err } });
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'run-llm-chat-request':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const { query, includeContext, contextChunk, previousResponse } = message.payload || {};
                    let chatPrompt = `あなたはプロの翻訳者および翻訳チェッカーのアシスタントです。
ユーザーから翻訳作業中のセグメントに関する質問や、口調・表現の追加修正指示が与えられます。
文脈を踏まえ、親切・的確・具体的に回答してください。
訳文の修正案を提示する場合は、該当する行番号(idx)が分かりやすいように示してください。`;

                    let promptAdditions = '';
                    if (includeContext) {
                        if (contextChunk) {
                            promptAdditions += `\n\n# 対象セグメントの原文・情報 (JSONL):\n${contextChunk}`;
                        }
                        if (previousResponse) {
                            promptAdditions += `\n\n# 直前のAI翻訳出力結果:\n${previousResponse}`;
                        }
                    }

                    const finalPrompt = chatPrompt + promptAdditions;
                    const response = await runLlmRequest(query, finalPrompt);
                    panel.webview.postMessage({ type: 'LLM_CHAT_RESPONSE', data: { response } });
                } catch (err: any) {
                    panel.webview.postMessage({ type: 'LLM_CHAT_ERROR', data: { error: err.message || err } });
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'cancel-llm-batch':
                isLlmBatchCancelled = true;
                break;
            case 'run-llm-batch-request':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                isLlmBatchCancelled = false;
                try {
                    // Auto-backup before starting batch translation
                    try {
                        await BackupOps.createBackup(rootPath, globalShWvData, 'LLM');
                        panel.webview.postMessage({
                            type: 'BACKUP_LIST_UPDATED',
                            data: { backups: BackupOps.listBackups(rootPath) }
                        });
                    } catch (backupErr) {
                        console.warn('Auto backup before LLM batch failed:', backupErr);
                    }

                    const { prompt, mode, options } = message.payload;
                    const units = globalShWvData.body.units;
                    if (!units || units.length === 0) {
                        panel.webview.postMessage({ type: 'LLM_BATCH_ERROR', data: { error: 'No units found in document.' } });
                        break;
                    }

                    // Divide document into chunks based on options
                    const chunks: any[][] = [];
                    let currentChunk: any[] = [];
                    let currentLen = 0;
                    const maxChunkChars = (typeof message.payload?.chunkSize === 'number' && message.payload.chunkSize > 0)
                        ? message.payload.chunkSize
                        : 3500;

                    for (const unit of units) {
                        const historyObj = (unit.ref?.tms && options?.history)
                            ? unit.ref.tms.slice().sort((a: any, b: any) => b.ratio - a.ratio).slice(0, 2).map((tm: any) => ({ src: tm.src, tgt: tm.tgt, diff: tm.diff }))
                            : [];
                        const termsObj = (unit.ref?.tb && options?.terms) ? unit.ref.tb : [];
                        const obj: any = { idx: unit.idx };
                        if (options?.src ?? true) obj.src = unit.src;
                        if (options?.tgt ?? true) obj.tgt = unit.tgt || unit.pre || '';
                        if ((options?.note ?? true) && unit.note) obj.note = unit.note;
                        if (historyObj.length > 0) obj.history = historyObj;
                        if (termsObj.length > 0) obj.terms = termsObj;

                        const strObj = JSON.stringify(obj);
                        if (currentLen + strObj.length > maxChunkChars && currentChunk.length > 0) {
                            chunks.push(currentChunk);
                            currentChunk = [];
                            currentLen = 0;
                        }
                        currentChunk.push(obj);
                        currentLen += strObj.length;
                    }
                    if (currentChunk.length > 0) chunks.push(currentChunk);

                    let batchResults = '';
                    let updatedUnitsCount = 0;

                    for (let i = 0; i < chunks.length; i++) {
                        if (isLlmBatchCancelled) {
                            panel.webview.postMessage({ type: 'LLM_BATCH_LOG', data: { log: `Batch cancelled by user at chunk ${i + 1}/${chunks.length}.` } });
                            break;
                        }

                        const chunkArr = chunks[i];
                        const chunkStr = JSON.stringify(chunkArr);

                        panel.webview.postMessage({
                            type: 'LLM_BATCH_PROGRESS',
                            data: { current: i + 1, total: chunks.length, status: `Processing chunk ${i + 1}/${chunks.length}...` }
                        });

                        let finalPrompt = prompt;
                        if (mode === 'advanced') {
                            const minIndex = chunkArr.length > 0 ? Math.min(...chunkArr.map((u: any) => u.idx)) : 0;
                            const precedingExamples: any[] = [];
                            for (let k = minIndex - 1; k >= 0; k--) {
                                const u = globalShWvData.body.units[k];
                                if (u && u.tgt && u.tgt.trim() !== '') {
                                    precedingExamples.push({ src: u.src, pre: u.pre || '', tgt: u.tgt });
                                    if (precedingExamples.length >= 3) break;
                                }
                            }
                            const markedExamples = globalShWvData.body.units
                                .filter(u => u.isPeRef && u.tgt && u.tgt.trim() !== '')
                                .map(u => ({ src: u.src, pre: u.pre || '', tgt: u.tgt }));

                            let promptAdditions = '';
                            if (markedExamples.length > 0) {
                                promptAdditions += `\n\n# ユーザー指定の編集ルール（最優先）:\n`;
                                markedExamples.forEach((ex, idx) => {
                                    promptAdditions += `例 ${idx + 1}:\n原文: ${ex.src}\n下訳: ${ex.pre}\n手直し後: ${ex.tgt}\n---\n`;
                                });
                            }
                            if (precedingExamples.length > 0) {
                                promptAdditions += `\n\n# 近傍の編集履歴（参考例）:\n`;
                                precedingExamples.reverse().forEach((ex, idx) => {
                                    promptAdditions += `例 ${idx + 1}:\n原文: ${ex.src}\n下訳: ${ex.pre}\n手直し後: ${ex.tgt}\n---\n`;
                                });
                            }
                            finalPrompt = prompt + promptAdditions;
                        }

                        const chunkResponse = await runLlmRequest(chunkStr, finalPrompt);
                        batchResults += `=== Chunk ${i + 1}/${chunks.length} ===\n${chunkResponse}\n\n`;
                    }

                    panel.webview.postMessage({ type: 'LLM_BATCH_DONE', data: { result: batchResults } });
                } catch (err: any) {
                    panel.webview.postMessage({ type: 'LLM_BATCH_ERROR', data: { error: err.message || err } });
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'apply-llm-partial-results':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const updates: { idx: number, tgt: string }[] = message.payload?.updates || [];
                    if (updates.length > 0) {
                        const shwvtPath = DirHelper.getShwvtPath(rootPath);
                        const shwvtUri = vscode.Uri.file(shwvtPath);
                        const doc = await vscode.workspace.openTextDocument(shwvtUri);
                        const edit = new vscode.WorkspaceEdit();

                        const affectedIdxs: number[] = [];
                        for (const item of updates) {
                            const unit = globalShWvData.body.units[item.idx];
                            if (unit) {
                                unit.tgt = item.tgt;
                                // Directly update target without confirming (status remains unconfirmed 0) and without TM registration
                                unit.status = 0;
                                affectedIdxs.push(item.idx);

                                if (item.idx < doc.lineCount) {
                                    const lineRange = doc.lineAt(item.idx).range;
                                    edit.replace(shwvtUri, lineRange, item.tgt);
                                }
                            }
                        }

                        await vscode.workspace.applyEdit(edit);
                        await doc.save();
                        globalShWvData.save(rootPath);

                        globalDirector.initializeFromState();
                        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath === shwvtPath) {
                            renderConfirmedDecorations(vscode.window.activeTextEditor);
                        }

                        panel.webview.postMessage({
                            type: 'SHWV_DATA_LOADED',
                            data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo }
                        });
                        vscode.window.showInformationMessage(`Applied LLM translation directly to ${affectedIdxs.length} segments.`);
                    } else {
                        vscode.window.showWarningMessage('No valid segments to apply.');
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to apply partial LLM results: ${err.message || err}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'apply-llm-results':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const resultText = message.payload?.result || '';
                    const config = vscode.workspace.getConfiguration('sheepWeave');
                    const autoReflect = config.get<boolean>('autoReflectLlmToTm') ?? true;
                    const updatedCount = CoreHandler.applyLlmResultText(globalShWvData, resultText, autoReflect);
                    if (updatedCount > 0) {
                        const shwvtPath = DirHelper.getShwvtPath(rootPath);
                        const shwvtUri = vscode.Uri.file(shwvtPath);
                        const doc = await vscode.workspace.openTextDocument(shwvtUri);
                        const edit = new vscode.WorkspaceEdit();

                        for (let idx = 0; idx < globalShWvData.body.units.length; idx++) {
                            const unit = globalShWvData.body.units[idx];
                            if (unit && idx < doc.lineCount) {
                                const text = unit.tgt ? unit.tgt : (unit.pre ? unit.pre : unit.src);
                                if (doc.lineAt(idx).text !== text) {
                                    edit.replace(shwvtUri, doc.lineAt(idx).range, text);
                                }
                            }
                        }
                        await vscode.workspace.applyEdit(edit);
                        await doc.save();
                        globalShWvData.save(rootPath);

                        globalDirector.initializeFromState();
                        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath === shwvtPath) {
                            renderConfirmedDecorations(vscode.window.activeTextEditor);
                        }

                        panel.webview.postMessage({
                            type: 'SHWV_DATA_LOADED',
                            data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo }
                        });
                        vscode.window.showInformationMessage(`Applied LLM results to ${updatedCount} segments in project!`);
                    } else {
                        vscode.window.showWarningMessage('No valid translation segments were parsed from the result.');
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to apply LLM results: ${err.message || err}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'clear-llm-tms':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    let deletedCount = 0;
                    for (const unit of globalShWvData.body.units) {
                        if (unit.ref && unit.ref.tms && unit.ref.tms.length > 0) {
                            const initialLen = unit.ref.tms.length;
                            unit.ref.tms = unit.ref.tms.filter(tm => tm.file !== 'LLM');
                            deletedCount += (initialLen - unit.ref.tms.length);
                        }
                    }
                    if (deletedCount > 0) {
                        globalShWvData.save(rootPath);
                        panel.webview.postMessage({
                            type: 'SHWV_DATA_LOADED',
                            data: { meta: globalShWvData.meta, units: globalShWvData.body.units, phrases: globalDirector.phrases, projectInfo: globalShWvData.projectInfo }
                        });
                        vscode.window.showInformationMessage(`Successfully removed ${deletedCount} LLM translation memory entries from project.`);
                    } else {
                        vscode.window.showInformationMessage('No LLM translation memory entries found in project.');
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to clear LLM TMs: ${err.message || err}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'export-prompt':
                try {
                    const promptText = message.payload?.prompt || '';
                    const promptPath = path.join(rootPath, 'prompt.md');
                    fs.writeFileSync(promptPath, promptText, 'utf-8');
                    vscode.window.showInformationMessage('Successfully exported prompt to prompt.md!');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to export prompt: ${err.message || err}`);
                }
                break;
            case 'import-prompt':
                try {
                    const relativePath = message.payload?.filePath || 'prompt.md';
                    const promptPath = path.join(rootPath, relativePath);
                    if (!fs.existsSync(promptPath)) {
                        vscode.window.showWarningMessage(`指定されたプロンプトファイルが見つかりません: ${relativePath}`);
                        break;
                    }
                    const promptText = fs.readFileSync(promptPath, 'utf-8');
                    panel.webview.postMessage({ type: 'PROMPT_IMPORTED', data: { prompt: promptText, filePath: relativePath } });
                    vscode.window.showInformationMessage(`Successfully imported prompt from ${relativePath}!`);
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to import prompt: ${err.message || err}`);
                }
                break;
            case 'create-backup':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const tag = message.payload?.tag;
                    const folderName = await BackupOps.createBackup(rootPath, globalShWvData, tag);
                    panel.webview.postMessage({
                        type: 'BACKUP_LIST_UPDATED',
                        data: { backups: BackupOps.listBackups(rootPath) }
                    });
                    vscode.window.showInformationMessage(`Created project backup: ${folderName}`);
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to create backup: ${err.message || err}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'list-backups':
                try {
                    panel.webview.postMessage({
                        type: 'BACKUP_LIST_UPDATED',
                        data: { backups: BackupOps.listBackups(rootPath) }
                    });
                } catch (err: any) {
                    console.error('Failed to list backups:', err);
                }
                break;
            case 'restore-backup':
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const folderName = message.payload?.folderName;
                    if (!folderName) {
                        vscode.window.showWarningMessage('No backup selected to restore.');
                        break;
                    }
                    await BackupOps.restoreBackup(rootPath, folderName, globalShWvData, panel);
                    vscode.window.showInformationMessage(`Successfully restored project from backup: ${folderName}`);
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to restore backup: ${err.message || err}`);
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            case 'open-backup-folder':
                try {
                    const backupDir = BackupOps.getBackupDir(rootPath);
                    if (!fs.existsSync(backupDir)) {
                        fs.mkdirSync(backupDir, { recursive: true });
                    }
                    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(backupDir));
                } catch (err: any) {
                    vscode.window.showErrorMessage(`エクスプローラーを開けませんでした: ${err.message || err}`);
                }
                break;
            case 'scan-filter-files': {
                try {
                    const filterFiles: string[] = [];
                    // 1. Check filters/ folder
                    const filtersDir = path.join(rootPath, 'filters');
                    if (fs.existsSync(filtersDir)) {
                        const inFilters = fs.readdirSync(filtersDir)
                            .filter(f => f.toLowerCase().endsWith('.fprm') && fs.statSync(path.join(filtersDir, f)).isFile())
                            .map(f => path.join('filters', f).replace(/\\/g, '/'));
                        filterFiles.push(...inFilters);
                    }
                    // 2. Check root directory
                    const inRoot = fs.readdirSync(rootPath)
                        .filter(f => f.toLowerCase().endsWith('.fprm') && fs.statSync(path.join(rootPath, f)).isFile())
                        .map(f => f);
                    filterFiles.push(...inRoot);

                    panel.webview.postMessage({ type: 'FILTER_FILES_SCANNED', data: filterFiles });
                } catch (err: any) {
                    console.error('[CoreHandler] Error scanning filter files:', err);
                }
                break;
            }
            case 'scan-prompt-files': {
                try {
                    const promptFiles: string[] = [];
                    // 1. Check prompts/ folder
                    const promptsDir = path.join(rootPath, 'prompts');
                    if (fs.existsSync(promptsDir)) {
                        const inPrompts = fs.readdirSync(promptsDir)
                            .filter(f => f.toLowerCase().endsWith('.md') && fs.statSync(path.join(promptsDir, f)).isFile())
                            .map(f => path.join('prompts', f).replace(/\\/g, '/'));
                        promptFiles.push(...inPrompts);
                    }
                    // 2. Check Working/01_REF/ folder
                    const refDir = path.join(rootPath, 'Working', '01_REF');
                    if (fs.existsSync(refDir)) {
                        const inRef = fs.readdirSync(refDir)
                            .filter(f => f.toLowerCase().endsWith('.md') && fs.statSync(path.join(refDir, f)).isFile())
                            .map(f => path.join('Working/01_REF', f).replace(/\\/g, '/'));
                        promptFiles.push(...inRef);
                    }
                    // 3. Check root directory
                    const inRoot = fs.readdirSync(rootPath)
                        .filter(f => f.toLowerCase().endsWith('.md') && fs.statSync(path.join(rootPath, f)).isFile())
                        .map(f => f);
                    promptFiles.push(...inRoot);

                    panel.webview.postMessage({ type: 'PROMPT_FILES_SCANNED', data: promptFiles });
                } catch (err: any) {
                    console.error('[CoreHandler] Error scanning prompt files:', err);
                }
                break;
            }
            case 'update-phrases':
                const phrasesPayload = message.payload || [];
                globalDirector.phrases = phrasesPayload;
                // phrase.jsonl に保存 (1行1JSONオブジェクト)
                const jsonlPhrasePath = path.join(rootPath, DirHelper.rootToPhrasesJsonl);
                const jsonlLines = phrasesPayload.map((p: any) => JSON.stringify(p)).join('\n');
                fs.writeFileSync(jsonlPhrasePath, jsonlLines, 'utf-8');

                // 互換用に既存 phrase.json があれば更新
                const legacyPhrasePath = path.join(rootPath, DirHelper.rootToPhrases);
                if (fs.existsSync(legacyPhrasePath)) {
                    fs.writeFileSync(legacyPhrasePath, JSON.stringify(phrasesPayload, null, 2), 'utf-8');
                }
                vscode.window.showInformationMessage('phrase.jsonl updated successfully.');
                break;
            case 'fetch-sample-resources': {
                panel.webview.postMessage({ type: 'SET_LOADING', data: true });
                try {
                    const filtersUrl = 'https://storage.lambuage.com/bundled_filters.json';
                    const promptsUrl = 'https://storage.lambuage.com/bundled_prompts.json';

                    const fetchJson = async (url: string): Promise<any> => {
                        if (typeof fetch === 'function') {
                            const res = await fetch(url);
                            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                            return await res.json();
                        } else {
                            const https = await import('https');
                            return new Promise((resolve, reject) => {
                                https.get(url, (res) => {
                                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                                        return reject(new Error(`HTTP ${res.statusCode}`));
                                    }
                                    let raw = '';
                                    res.on('data', chunk => raw += chunk);
                                    res.on('end', () => {
                                        try {
                                            resolve(JSON.parse(raw));
                                        } catch (e) {
                                            reject(e);
                                        }
                                    });
                                }).on('error', reject);
                            });
                        }
                    };

                    const [filtersData, promptsData] = await Promise.all([
                        fetchJson(filtersUrl),
                        fetchJson(promptsUrl)
                    ]);

                    const filtersDir = path.join(rootPath, 'filters');
                    const promptsDir = path.join(rootPath, 'prompts');

                    if (!fs.existsSync(filtersDir)) {
                        fs.mkdirSync(filtersDir, { recursive: true });
                    }
                    if (!fs.existsSync(promptsDir)) {
                        fs.mkdirSync(promptsDir, { recursive: true });
                    }

                    let createdFilters = 0;
                    let skippedFilters = 0;
                    if (Array.isArray(filtersData)) {
                        for (const item of filtersData) {
                            const fileName = item.name || item.idx;
                            if (!fileName || !item.data) continue;
                            const filePath = path.join(filtersDir, fileName);
                            if (fs.existsSync(filePath)) {
                                skippedFilters++;
                            } else {
                                fs.writeFileSync(filePath, item.data, 'utf-8');
                                createdFilters++;
                            }
                        }
                    }

                    let createdPrompts = 0;
                    let skippedPrompts = 0;
                    if (Array.isArray(promptsData)) {
                        for (const item of promptsData) {
                            const fileName = item.name || item.idx;
                            if (!fileName || !item.data) continue;
                            const filePath = path.join(promptsDir, fileName);
                            if (fs.existsSync(filePath)) {
                                skippedPrompts++;
                            } else {
                                fs.writeFileSync(filePath, item.data, 'utf-8');
                                createdPrompts++;
                            }
                        }
                    }

                    // Rescan filter and prompt lists for webview
                    try {
                        const filterFiles: string[] = [];
                        if (fs.existsSync(filtersDir)) {
                            const inFilters = fs.readdirSync(filtersDir)
                                .filter(f => f.toLowerCase().endsWith('.fprm') && fs.statSync(path.join(filtersDir, f)).isFile())
                                .map(f => path.join('filters', f).replace(/\\/g, '/'));
                            filterFiles.push(...inFilters);
                        }
                        const inRootFilters = fs.readdirSync(rootPath)
                            .filter(f => f.toLowerCase().endsWith('.fprm') && fs.statSync(path.join(rootPath, f)).isFile())
                            .map(f => f);
                        filterFiles.push(...inRootFilters);
                        panel.webview.postMessage({ type: 'FILTER_FILES_SCANNED', data: filterFiles });

                        const promptFiles: string[] = [];
                        if (fs.existsSync(promptsDir)) {
                            const inPrompts = fs.readdirSync(promptsDir)
                                .filter(f => f.toLowerCase().endsWith('.md') && fs.statSync(path.join(promptsDir, f)).isFile())
                                .map(f => path.join('prompts', f).replace(/\\/g, '/'));
                            promptFiles.push(...inPrompts);
                        }
                        const refDir = path.join(rootPath, 'Working', '01_REF');
                        if (fs.existsSync(refDir)) {
                            const inRef = fs.readdirSync(refDir)
                                .filter(f => f.toLowerCase().endsWith('.md') && fs.statSync(path.join(refDir, f)).isFile())
                                .map(f => path.join('Working/01_REF', f).replace(/\\/g, '/'));
                            promptFiles.push(...inRef);
                        }
                        const inRootPrompts = fs.readdirSync(rootPath)
                            .filter(f => f.toLowerCase().endsWith('.md') && fs.statSync(path.join(rootPath, f)).isFile())
                            .map(f => f);
                        promptFiles.push(...inRootPrompts);
                        panel.webview.postMessage({ type: 'PROMPT_FILES_SCANNED', data: promptFiles });
                    } catch (scanErr) {
                        console.error('Error rescanning files after fetching samples:', scanErr);
                    }

                    const infoMsg = `サンプルデータを取得しました。\n` +
                        `・フィルター (filters/): ${createdFilters}件作成 (${skippedFilters}件スキップ)\n` +
                        `・プロンプト (prompts/): ${createdPrompts}件作成 (${skippedPrompts}件スキップ)`;
                    vscode.window.showInformationMessage(infoMsg);
                    panel.webview.postMessage({
                        type: 'FETCH_SAMPLES_COMPLETED',
                        data: { createdFilters, skippedFilters, createdPrompts, skippedPrompts }
                    });
                } catch (err: any) {
                    vscode.window.showErrorMessage(`サンプルデータの取得に失敗しました: ${err.message || err}`);
                    panel.webview.postMessage({
                        type: 'FETCH_SAMPLES_ERROR',
                        data: { error: err.message || err }
                    });
                } finally {
                    panel.webview.postMessage({ type: 'SET_LOADING', data: false });
                }
                break;
            }
            default:
                break;
        }
    }

    /**
     * Parse LLM result text (Plain line format "0: text", JSON Array, JSONL, or Markdown) and apply to globalShWvData units.
     */
    public static applyLlmResultText(globalShWvData: ShWvData, resultText: string, autoReflectLlmToTm: boolean = true): number {
        let updatedCount = 0;
        const cleaned = resultText.replace(/```(?:jsonl|json|text)?/gi, '').trim();
        let itemsToProcess: any[] = [];

        // 1. Try Line-by-Line Plain Text parsing (e.g., "0: 訳文" or "Line 0: 訳文" or "[0]: 訳文" or "{idx: 0, ...}")
        const lines = cleaned.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Check plain text format: "0: 訳文", "Line 0: 訳文", "[0]: 訳文", "0： 訳文"
            const plainMatch = trimmed.match(/^(?:Line\s*|\[)?(\d+)\]?\s*[:：]\s*(.+)$/i);
            if (plainMatch) {
                itemsToProcess.push({
                    idx: parseInt(plainMatch[1], 10),
                    tgt: plainMatch[2].trim()
                });
                continue;
            }

            // Check JSON format per line
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    itemsToProcess.push(...parsed);
                } else {
                    itemsToProcess.push(parsed);
                }
                continue;
            } catch (_) {
                // Try regex extraction for broken JSON like {idx:0, tgt:"..."} or {idx:0, tgt、「...」}
                const brokenJsonMatch = trimmed.match(/\{\s*"?idx"?\s*[:：]\s*(\d+)\s*,\s*"?tgt"?\s*[:：]["'「]?\s*(.*?)\s*["'」]?\s*\}/i);
                if (brokenJsonMatch) {
                    itemsToProcess.push({
                        idx: parseInt(brokenJsonMatch[1], 10),
                        tgt: brokenJsonMatch[2].trim()
                    });
                }
            }
        }

        // 2. If line-by-line found nothing, try full JSON Array parse
        if (itemsToProcess.length === 0) {
            try {
                const parsedObj = JSON.parse(cleaned);
                if (Array.isArray(parsedObj)) {
                    itemsToProcess = parsedObj;
                } else if (typeof parsedObj === 'object' && parsedObj !== null) {
                    itemsToProcess = [parsedObj];
                }
            } catch (_) {}
        }

        // 3. Apply items to globalShWvData
        for (const item of itemsToProcess) {
            const targetIdx = item.idx ?? item.index;
            let newText = item.tgt ?? item.result ?? item.translation ?? item.target;

            // Fallback: If no explicit tgt/result key, but src is provided and different from original src
            if (targetIdx !== undefined && newText === undefined) {
                const u = globalShWvData.body.units.find(unit => unit.idx === targetIdx);
                if (u && item.src && item.src !== u.src) {
                    newText = item.src;
                }
            }

            if (targetIdx !== undefined && newText !== undefined && newText.trim() !== '') {
                const u = globalShWvData.body.units.find(unit => unit.idx === targetIdx);
                if (u) {
                    if (u.tgt && u.tgt.trim() !== '') {
                        if (autoReflectLlmToTm) {
                            if (!u.ref) u.ref = { tms: [], tb: [], quoted: [], quoted100: [] };
                            if (!u.ref.tms) u.ref.tms = [];
                            
                            const exists = u.ref.tms.some(tm => tm.file === 'LLM' && tm.tgt === newText);
                            if (!exists) {
                                u.ref.tms.unshift({
                                    idx: -1,
                                    src: u.src,
                                    tgt: newText,
                                    ratio: 99,
                                    file: 'LLM'
                                });
                            }
                        }
                    } else {
                        u.pre = newText;
                        if (autoReflectLlmToTm) {
                            if (!u.ref) u.ref = { tms: [], tb: [], quoted: [], quoted100: [] };
                            if (!u.ref.tms) u.ref.tms = [];
                            
                            const exists = u.ref.tms.some(tm => tm.file === 'LLM' && tm.tgt === newText);
                            if (!exists) {
                                u.ref.tms.unshift({
                                    idx: -1,
                                    src: u.src,
                                    tgt: newText,
                                    ratio: 99,
                                    file: 'LLM'
                                });
                            }
                        }
                    }
                    updatedCount++;
                }
            }
        }
        return updatedCount;
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

function getSheepBobbinConfig() {
    const os = require('os');
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Application Support') : path.join(os.homedir(), '.config'));
    const configPath = path.join(appData, 'SheepBobbin Local', 'config.json');
    const config = vscode.workspace.getConfiguration('sheepWeave');
    return {
        API_KEY_SHEEP: config.get<string>('bobbinApiKey') || '71TMRzhzwQSvITAd01PKWVlRfI4zSLa21cdpj_RWu4c'
    };
}

async function runLlmRequest(chunk: string, prompt: string): Promise<string> {
    const config = getSheepBobbinConfig();
    const honoUrl = `http://localhost:8000`;
    const apiKey = config.API_KEY_SHEEP;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
    };

    try {
        const response = await globalThis.fetch(`${honoUrl}/gen/check/user/sync`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ chunk, prompt })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const resData = await response.json() as any;
        if (resData.status === 'success') {
            return resData.result || '';
        } else {
            throw new Error(resData.error || 'Unknown error from Hono API');
        }
    } catch (e: any) {
        throw new Error(`Hono connection failed: ${e.message}`);
    }
}

