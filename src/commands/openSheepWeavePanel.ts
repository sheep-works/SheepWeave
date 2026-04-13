import { initDirs, prepareWorking, preprocessor, postprocessor, runTikalExtraction, runPackage } from '../services/fileOps';
import { CoreHandler } from '../handlers/CoreHandler';
import { AdminHandler } from '../handlers/AdminHandler';
import { ProjectManager } from '../services/core/ProjectManager';
import * as fs from 'fs';
import * as path from 'path';

// (existing imports)
import * as vscode from 'vscode';
import { getWebviewHtml } from '../webview/panel'; 
import { globalShWvData, globalDirector } from '../store';
import { renderConfirmedDecorations } from '../features/decorators';

// 現在表示されているパネルを保持する変数。一度に一つだけ表示するために使います
let currentPanel: vscode.WebviewPanel | undefined = undefined;

/**
 * Webviewにメッセージを送信するヘルパー関数
 */
export function notifyWebview(message: any) {
    if (currentPanel) {
        currentPanel.webview.postMessage(message);
    }
}

// 現在アクティブなエディタがある列（カラム）を取得します
export function openSheepWeavePanel(context: vscode.ExtensionContext, preserveFocus: boolean = false) {
    // すでにパネルが開いている場合は、新しく作らずにそのパネルを最前面に表示（reveal）します。
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Beside, preserveFocus);
        return;
    }

    // パネルが開いていない場合は、新しいWebviewパネルを作成します
    const panel = vscode.window.createWebviewPanel(
        'sheepWeave', // 識別子
        'SheepWeave', // パネルのタイトル
        vscode.ViewColumn.Beside, // エディタの横（通常は2列目）に表示
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

                // 1. Extension側のストアを更新（確定はせず、入力テキストの保持のみ行う）
                globalDirector.updateTargetOnly(lastLineNumber, oldLineText);

                // 2. 以前の行のステータスを確認
                let status = 0;
                if (globalDirector.confirmedLines.has(lastLineNumber)) {
                    status = 1;
                } else if (globalDirector.proofedLines.has(lastLineNumber)) {
                    status = 2;
                }

                // 3. Webview側（表示用Pinia Store）に変更を通知
                currentPanel!.webview.postMessage({
                    type: 'CURSOR_MOVED',
                    data: {
                        newPos: currentLineNumber,
                        textInOldPos: oldLineText,
                        status: status
                    }
                });
            }

            lastLineNumber = currentLineNumber;
        }, 500);
    });

    // --- テキストが編集された時の処理（確定解除） ---
    let decorationTimeout: NodeJS.Timeout | null = null;
    const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
        if (!currentPanel) return;
        if (!event.document.fileName.endsWith('.shwvt')) return;

        let hasUnconfirmed = false;

        event.contentChanges.forEach(change => {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;

            // 確定行が編集されたら、確定状態を強制解除する
            for (let i = startLine; i <= endLine; i++) {
                if (globalDirector.confirmedLines.has(i)) {
                    globalDirector.unconfirmLine(i);
                    hasUnconfirmed = true;
                }
            }
        });

        if (hasUnconfirmed) {
            // パフォーマンスのため、装飾の更新は少しデバウンスさせる
            if (decorationTimeout) {
                clearTimeout(decorationTimeout);
            }
            decorationTimeout = setTimeout(() => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document === event.document) {
                    renderConfirmedDecorations(editor);
                }
            }, 300);
            
            // Webviewにも通知する
            currentPanel.webview.postMessage({
                type: 'UNCONFIRMED',
                // Webview側に「これらの行が未確定になった」と伝える必要があれば送る
                // data: { lines: ... }
            });
        }
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
            documentChangeListener.dispose();
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

            // メッセージの種類に応じて、処理を Handler クラスに振り分け
            try {
                // message.type または message.command のどちらでも受け取れるようにする
                const cmd = message.type || message.command;
                vscode.window.setStatusBarMessage(`[SheepWeave] Executing: ${cmd}`, 5000);

                if (cmd && cmd.startsWith('shuttle-')) {
                    // プロジェクト管理系（インポート/エクスポートなど）
                    await AdminHandler.handle(message, globalShWvData, rootPath, panel);
                } else if (cmd) {
                    // 翻訳データ操作系
                    await CoreHandler.handle(message, globalShWvData, rootPath, panel);
                } else {
                    console.warn('Unknown message format received from webview', message);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error executing ${message.type || 'command'}: ${error}`);
                console.error(error);
            }
        },
        null,
        context.subscriptions
    );
}
