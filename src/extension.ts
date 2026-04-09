/**
 * 拡張機能のエントリーポイント。
 * コマンドの登録、機能の初期化（EditorGuard, Decorators）を行います。
 */
import * as vscode from 'vscode';
import { openSheepWeavePanel } from './commands/openSheepWeavePanel';
import { prepareProjectCommand } from './commands/prepareProject';
import { renameLikeReplaceCommand } from './commands/renameLikeReplace';
import { confirmLineCommand } from './commands/confirmLine';
import { initEditorGuard } from './features/editorGuard';
import { initDecorators, renderConfirmedDecorations } from './features/decorators';
import { initShortcuts } from './features/shortcuts';
import { globalShWvData, globalDirector } from './store';

// Expose standard events here if needed

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "sheep-weave" is now active!');

    // Eagerly load project data on startup so decorations work immediately
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (rootPath) {
        globalShWvData.load(rootPath);
        globalDirector.initializeFromState();
    }

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

    context.subscriptions.push(
        vscode.commands.registerCommand('sheepWeave.renameLikeReplace', () => {
            renameLikeReplaceCommand();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('sheepWeave.confirmLine', () => {
            confirmLineCommand();
        })
    );

    // Render decorations globally whenever an editor is shown
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            renderConfirmedDecorations(editor);

            // .shwvt ファイルがアクティブになった時、パネルが開いていなければ自動で開く
            if (editor.document.fileName.endsWith('.shwvt')) {
                openSheepWeavePanel(context, true);
            }
        }
    }, null, context.subscriptions);

    // Initial render for already visible editors:
    if (vscode.window.activeTextEditor) {
        renderConfirmedDecorations(vscode.window.activeTextEditor);
        if (vscode.window.activeTextEditor.document.fileName.endsWith('.shwvt')) {
            openSheepWeavePanel(context, true);
        }
    }

    initEditorGuard(context);
    initDecorators(context);
    initShortcuts(context);
}

export function deactivate() { }
