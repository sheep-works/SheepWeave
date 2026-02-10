/**
 * 拡張機能のエントリーポイント。
 * コマンドの登録、機能の初期化（EditorGuard, Decorators）を行います。
 */
import * as vscode from 'vscode';
import { openLambLingoPanel } from './commands/openLambLingoPanel';
import { prepareProjectCommand } from './commands/prepareProject';
import { initEditorGuard } from './features/editorGuard';
import { initDecorators } from './features/decorators';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "lamb-lingo" is now active!');

    context.subscriptions.push(
        vscode.commands.registerCommand('lambLingo.openPanel', () => {
            openLambLingoPanel(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lambLingo.prepare', () => {
            prepareProjectCommand();
        })
    );

    initEditorGuard(context);
    initDecorators(context);
}

export function deactivate() { }
