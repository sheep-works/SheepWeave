import { initDirs, prepareWorking, preprocessor, postprocessor, runTikalExtraction, runPackage } from '../services/fileOps';
import { CoreHandler } from '../handlers/CoreHandler';
import { AdminHandler } from '../handlers/AdminHandler';
import { ProjectManager } from '../services/core/ProjectManager';
import * as fs from 'fs';
import * as path from 'path';

// (existing imports)
import * as vscode from 'vscode';
import { getWebviewHtml } from '../webview/panel'; // We will create this next
import { globalShWvData } from '../store';

// 現在表示されているパネルを保持する変数。一度に一つだけ表示するために使います
let currentPanel: vscode.WebviewPanel | undefined = undefined;

// 現在アクティブなエディタがある列（カラム）を取得します
export function openSheepWeavePanel(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    // すでにパネルが開いている場合は、新しく作らずにそのパネルを最前面に表示（reveal）します。
    if (currentPanel) {
        currentPanel.reveal(column);
        return;
    }

    // パネルが開いていない場合は、新しいWebviewパネルを作成します
    const panel = vscode.window.createWebviewPanel(
        'sheepWeave', // 識別子
        'SheepWeave', // パネルのタイトル
        vscode.ViewColumn.Two, // エディタの右側（2列目）に表示
        {
            enableScripts: true, // Webview内でJavaScriptを実行できるようにします
            retainContextWhenHidden: true, // パネルが非表示になっても状態を保持します
            localResourceRoots: [ // Webviewからアクセスできるフォルダを制限してセキュリティを高めます。
                vscode.Uri.joinPath(context.extensionUri, 'media'),
                vscode.Uri.joinPath(context.extensionUri, 'dist'),
                vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist')
            ]
        }
    );

    currentPanel = panel;

    // HTMLの中身をセットします。別ファイルの getWebviewHtml で生成しています。
    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

    let lastLineNumber = -1;
    let selectionTimeout: NodeJS.Timeout | null = null;

    // --- エディタのカーソル位置が変わった時の処理 ---
    const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(event => {
        if (!currentPanel) return;

        // .shwvt ファイルの変更のみを追跡
        if (!event.textEditor.document.fileName.endsWith('.shwvt')) return;
        if (event.selections.length === 0) return;

        // 頻繁に発生するイベントなので、setTimeoutを使って少し待ってから処理（デバウンス）します
        if (selectionTimeout) {
            clearTimeout(selectionTimeout);
        }

        selectionTimeout = setTimeout(() => {
            const currentLineNumber = event.selections[0].active.line;

            // カーソルが別の行に移動した場合のみ処理
            if (lastLineNumber !== -1 && currentLineNumber !== lastLineNumber) {
                const oldLineText = event.textEditor.document.lineAt(lastLineNumber).text;

                // 1. Extension側のストア（globalShWvData）を更新
                globalShWvData.updateUnitTarget(lastLineNumber, oldLineText);

                // 2. Webview側（表示用Pinia Store）に変更を通知
                currentPanel!.webview.postMessage({
                    type: 'CURSOR_MOVED',
                    data: {
                        newPos: currentLineNumber,
                        textInOldPos: oldLineText // TODO 移動では前のテキストを処理しないようにすると思う
                    }
                });
            }

            lastLineNumber = currentLineNumber;
        }, 500);
    });

    // --- ファイルが保存された時の処理 ---
    const saveDocumentListener = vscode.workspace.onDidSaveTextDocument(document => {
        if (!currentPanel) return;
        if (!document.fileName.endsWith('.shwvt')) return;

        // 保存されたタイミングで、全体のデータをファイルに書き出します。
        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (rootPath) {
            globalShWvData.save(rootPath);
        }
    });

    // パネルが閉じられた時の後片付け
    panel.onDidDispose(
        () => {
            currentPanel = undefined;
            selectionChangeListener.dispose();
            saveDocumentListener.dispose();
        },
        null,
        context.subscriptions
    );


    // --- Webviewからメッセージを受け取った時の処理 ---
    panel.webview.onDidReceiveMessage(
        async message => {
            console.log(`Webview message received: ${message.type}`, message.payload);
            const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!rootPath) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            try {
                if (message.type.startsWith('shuttle-')) {
                    await AdminHandler.handle(message, globalShWvData, rootPath, panel);
                } else {
                    await CoreHandler.handle(message, globalShWvData, rootPath, panel);
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
