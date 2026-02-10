/**
 * LambLingoのメインパネル（WebView）を開くコマンドの実装。
 * パネルの生成、リソース設定、メッセージハンドリングを行います。
 */
import * as vscode from 'vscode';
import { getWebviewHtml } from '../webview/panel'; // We will create this next

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

    panel.onDidDispose(
        () => {
            currentPanel = undefined;
        },
        null,
        context.subscriptions
    );

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.type) {
                case 'PREPARE':
                    vscode.commands.executeCommand('lambLingo.prepare');
                    break;
                case 'alert':
                    vscode.window.showErrorMessage(message.text);
                    return;
            }
        },
        null,
        context.subscriptions
    );
}
