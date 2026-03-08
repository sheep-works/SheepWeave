import { initDirs, prepareWorking, preprocessor, postprocessor } from '../services/fileOps';

// (existing imports)
import * as vscode from 'vscode';
import { getWebviewHtml } from '../webview/panel'; // We will create this next
import { globalLmlgData } from '../store';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function openLambLingoPanel(context: vscode.ExtensionContext) {
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
        'lambLingo',
        'LambLingo',
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

    const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(event => {
        if (!currentPanel) return;

        // We probably only want to track changes in .lmlgt files
        if (!event.textEditor.document.fileName.endsWith('.lmlgt')) return;
        if (event.selections.length === 0) return;

        const currentLineNumber = event.selections[0].active.line;

        if (lastLineNumber !== -1 && currentLineNumber !== lastLineNumber) {
            const oldLineText = event.textEditor.document.lineAt(lastLineNumber).text;

            // 1. 真と正であるExtension側のストア（globalLmlgData）を更新
            globalLmlgData.updateUnitTarget(lastLineNumber, oldLineText);

            // 2. 補助的にWebview側（表示用Pinia Store）にも変更を通知
            currentPanel.webview.postMessage({
                type: 'CURSOR_MOVED',
                data: {
                    newPos: currentLineNumber,
                    textInOldPos: oldLineText
                }
            });
        }

        lastLineNumber = currentLineNumber;
    });

    const saveDocumentListener = vscode.workspace.onDidSaveTextDocument(document => {
        if (!currentPanel) return;
        if (!document.fileName.endsWith('.lmlgt')) return;

        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (rootPath) {
            globalLmlgData.save(rootPath);
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
            const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!rootPath) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            try {
                switch (message.type) {
                    case 'init':
                        await initDirs(rootPath);
                        vscode.window.showInformationMessage('Project Initialized');
                        break;
                    case 'prepare':
                        // Use existing command or direct call? Using direct call as per plan
                        await prepareWorking(rootPath);
                        vscode.window.showInformationMessage('Project Prepared');
                        break;
                    case 'start':
                        const lmlgData = await preprocessor(rootPath);
                        if (lmlgData) {
                            panel.webview.postMessage({ type: 'LMLG_DATA_LOADED', data: { meta: lmlgData.meta, units: lmlgData.body.units } });
                        }
                        vscode.window.showInformationMessage('Preprocessing Started (Data loaded to Webview)');
                        break;
                    case 'finish':
                        await postprocessor(rootPath);
                        vscode.window.showInformationMessage('Postprocessing Finished');
                        break;
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'READY':
                        // When Webview finishes mounting, send existing LmLgData if any exists.
                        if (globalLmlgData.meta && globalLmlgData.body.units.length > 0) {
                            panel.webview.postMessage({
                                type: 'LMLG_DATA_LOADED',
                                data: { meta: globalLmlgData.meta, units: globalLmlgData.body.units }
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
