/**
 * 拡張機能のエントリーポイント。
 * コマンドの登録、機能の初期化（EditorGuard, Decorators）を行います。
 */
import * as vscode from 'vscode';
import { openSheepWeavePanel } from './commands/openSheepWeavePanel';
import { prepareProjectCommand } from './commands/prepareProject';
import { renameLikeReplaceCommand } from './commands/renameLikeReplace';
import { startAddTermSide, confirmAddTermSide, cancelAddTermSide } from './commands/addTermSide';
import { confirmLineCommand } from './commands/confirmLine';
import { concordanceSearchCommand } from './commands/concordanceSearch';
import { initEditorGuard } from './features/editorGuard';
import { initDecorators, renderConfirmedDecorations } from './features/decorators';
import { initShortcuts } from './features/shortcuts';
import { TbCompletionProvider, PhraseCompletionProvider } from './features/intellisense';
import { globalShWvData, globalDirector } from './store';
import { findProjectRoot } from './util';

// Expose standard events here if needed

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "sheep-weave" is now active!');

    // プロジェクトデータをロード（アクティブなエディタに基づいてルートを特定）
    let lastLoadedRoot: string | undefined = undefined;

    function loadProjectData(editor: vscode.TextEditor | undefined) {
        if (!editor) return;
        const filePath = editor.document.uri.fsPath;
        const root = findProjectRoot(filePath);
        if (root && root !== lastLoadedRoot) {
            globalShWvData.load(root);
            globalDirector.initializeFromState();
            globalDirector.loadRefData(root); // Load TM/TB for concordance search
            lastLoadedRoot = root;
            console.log(`Loaded project data from: ${root}`);
        }
    }

    // 初回ロード
    loadProjectData(vscode.window.activeTextEditor);

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

    context.subscriptions.push(
        vscode.commands.registerCommand('sheepWeave.startAddTermSide', () => startAddTermSide()),
        vscode.commands.registerCommand('sheepWeave.confirmAddTermSide', () => confirmAddTermSide()),
        vscode.commands.registerCommand('sheepWeave.cancelAddTermSide', () => cancelAddTermSide()),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('sheepWeave.concordanceSearchSource', () => {
            concordanceSearchCommand('source');
        }),
        vscode.commands.registerCommand('sheepWeave.concordanceSearchTarget', () => {
            concordanceSearchCommand('target');
        })
    );

    // Render decorations globally whenever an editor is shown
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            // プロジェクトルートが変わっていれば再読み込み
            loadProjectData(editor);
            
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

    // 用語集（TB）の入力補完を登録
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'shwvt', scheme: 'file' },
            new TbCompletionProvider()
        ),
        vscode.languages.registerCompletionItemProvider(
            { language: 'shwvt', scheme: 'file' },
            new PhraseCompletionProvider()
        )
    );
}

export function deactivate() { }
