import { initDirs, prepareWorking, preprocessor, postprocessor, runTikalExtraction, runPackage } from '../services/fileOps';
import { ProjectManager } from '../services/core/ProjectManager';
import * as fs from 'fs';
import * as path from 'path';

// (existing imports)
import * as vscode from 'vscode';
import { getWebviewHtml } from '../webview/panel'; // We will create this next
import { globalShWvData } from '../store';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function openSheepWeavePanel(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    // If we already have a panel, show it.
    if (currentPanel) {
        currentPanel.reveal(column);
        return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
        'sheepWeave',
        'SheepWeave',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'media'),
                vscode.Uri.joinPath(context.extensionUri, 'dist'),
                vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist')
            ]
        }
    );

    currentPanel = panel;
    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

    let lastLineNumber = -1;
    let selectionTimeout: NodeJS.Timeout | null = null;

    const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(event => {
        if (!currentPanel) return;

        // We probably only want to track changes in .shwvt files
        if (!event.textEditor.document.fileName.endsWith('.shwvt')) return;
        if (event.selections.length === 0) return;

        if (selectionTimeout) {
            clearTimeout(selectionTimeout);
        }

        selectionTimeout = setTimeout(() => {
            const currentLineNumber = event.selections[0].active.line;

            if (lastLineNumber !== -1 && currentLineNumber !== lastLineNumber) {
                const oldLineText = event.textEditor.document.lineAt(lastLineNumber).text;

                // 1. 真と正であるExtension側のストア（globalShWvData）を更新
                globalShWvData.updateUnitTarget(lastLineNumber, oldLineText);

                // 2. 補助的にWebview側（表示用Pinia Store）にも変更を通知
                currentPanel!.webview.postMessage({
                    type: 'CURSOR_MOVED',
                    data: {
                        newPos: currentLineNumber,
                        textInOldPos: oldLineText
                    }
                });
            }

            lastLineNumber = currentLineNumber;
        }, 500);
    });

    const saveDocumentListener = vscode.workspace.onDidSaveTextDocument(document => {
        if (!currentPanel) return;
        if (!document.fileName.endsWith('.shwvt')) return;

        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (rootPath) {
            globalShWvData.save(rootPath);
        }
    });

    panel.onDidDispose(
        () => {
            currentPanel = undefined;
            selectionChangeListener.dispose();
            saveDocumentListener.dispose();
        },
        null,
        context.subscriptions
    );



    // ... (existing code)

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async message => {
            console.log(`Webview message received: ${message.type}`, message.payload);
            const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!rootPath) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            try {
                switch (message.type) {
                    case 'open-current':
                        vscode.env.openExternal(vscode.Uri.file(rootPath));
                        break;
                    case 'init':
                        await initDirs(rootPath);
                        vscode.window.showInformationMessage('Project Initialized');
                        break;
                    case 'prepare':
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

                        // Run Tikal Extraction to create XLIFFs and update project.json
                        await runTikalExtraction(rootPath, projectManager.data.sourceLanguage, projectManager.data.targetLanguage);

                        vscode.window.showInformationMessage('Project Prepared, project.json created, and Tikal Extraction completed');
                        break;
                    case 'create':
                        const shwvData = await preprocessor(rootPath);
                        if (shwvData) {
                            panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: shwvData.meta, units: shwvData.body.units } });
                        }
                        vscode.window.showInformationMessage('Preprocessing Started (Data loaded to Webview)');
                        break;

                    case 'load':
                        globalShWvData.load(rootPath);
                        if (globalShWvData.meta && globalShWvData.body?.units?.length > 0) {
                            panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units } });
                            vscode.window.showInformationMessage('Data Loaded and Synchronized');
                        }
                        break;

                    case 'reanalyze':
                        globalShWvData.analyze(rootPath);
                        break;

                    case 'complete':
                        await postprocessor(rootPath);
                        vscode.window.showInformationMessage('Postprocessing Finished');
                        break;
                    case 'package':
                        await runPackage(rootPath);
                        vscode.window.showInformationMessage('Native Files Packaged');
                        break;
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'READY':
                        const config = vscode.workspace.getConfiguration('sheepWeave');
                        panel.webview.postMessage({
                            type: 'CONFIG_LOADED',
                            data: {
                                sourceLang: config.get<string>('sourceLang') || 'en-US',
                                targetLang: config.get<string>('targetLang') || 'ja-JP'
                            }
                        });

                        // When Webview finishes mounting, send existing ShWvData if any exists.
                        if (globalShWvData.meta && globalShWvData.body.units.length > 0) {
                            panel.webview.postMessage({
                                type: 'SHWV_DATA_LOADED',
                                data: { meta: globalShWvData.meta, units: globalShWvData.body.units }
                            });
                        }
                        break;
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error executing ${message.type}: ${error}`);
                console.error(error);
            }
        },
        null,
        context.subscriptions
    );
}
