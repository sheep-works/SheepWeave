/**
 * 拡張機能のエントリーポイント。
 * コマンドの登録、機能の初期化（EditorGuard, Decorators）を行います。
 */
import * as vscode from 'vscode';
import { openSheepWeavePanel } from './commands/openSheepWeavePanel';
import { prepareProjectCommand } from './commands/prepareProject';
import { initEditorGuard } from './features/editorGuard';
import { initDecorators } from './features/decorators';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "sheep-weave" is now active!');

    context.subscriptions.push(
        vscode.commands.registerCommand('sheepWeave.openPanel', () => {
            openSheepWeavePanel(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('sheepWeave.prepare', () => {
            prepareProjectCommand();
        })
    );

    initEditorGuard(context);
    initDecorators(context);
}

export function deactivate() { }
