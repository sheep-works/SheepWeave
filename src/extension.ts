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
import { gotoNextUnconfirmedCommand } from './commands/gotoNextUnconfirmed';
import { gotoPrevUnconfirmedCommand } from './commands/gotoPrevUnconfirmed';
import { concordanceSearchCommand } from './commands/concordanceSearch';
import { diffTargetWithTmCommand } from './commands/diffTargetWithTm';
import { initEditorGuard } from './features/editorGuard';
import { initDecorators, renderConfirmedDecorations, renderTermDecorations } from './features/decorators';
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
            globalDirector.loadPhrasesFromRoot(root);
            globalDirector.loadRefData(root); // Load TM/TB for concordance search
            lastLoadedRoot = root;
            console.log(`Loaded project data from: ${root}`);
        }
    }

    // 初回ロード
    try {
        loadProjectData(vscode.window.activeTextEditor);
    } catch (e) {
        console.error('Failed to load project data during activation:', e);
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
        }),
        vscode.commands.registerCommand('sheepWeave.gotoNextUnconfirmed', () => {
            gotoNextUnconfirmedCommand();
        }),
        vscode.commands.registerCommand('sheepWeave.gotoPrevUnconfirmed', () => {
            gotoPrevUnconfirmedCommand();
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
        }),
        vscode.commands.registerCommand('sheepWeave.diffTargetWithTm', () => {
            diffTargetWithTmCommand(context);
        })
    );

    // Render decorations globally whenever an editor is shown
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            // プロジェクトルートが変わっていれば再読み込み
            loadProjectData(editor);
            
            renderConfirmedDecorations(editor);
            renderTermDecorations(editor);

            // .shwvt ファイルがアクティブになった時、パネルが開いていなければ自動で開く
            // if (editor.document.fileName.endsWith('.shwvt')) {
            //     openSheepWeavePanel(context, true);
            // }
        }
    }, null, context.subscriptions);

    // Initial render for already visible editors:
    if (vscode.window.activeTextEditor) {
        renderConfirmedDecorations(vscode.window.activeTextEditor);
        renderTermDecorations(vscode.window.activeTextEditor);
        // if (vscode.window.activeTextEditor.document.fileName.endsWith('.shwvt')) {
        //     openSheepWeavePanel(context, true);
        // }
    }

    initEditorGuard(context);
    initDecorators(context);
    initShortcuts(context);

    // 用語集（TB）およびフレーズの入力補完を登録（トリガー文字 '@', '/', ' ' に対応、全スキーム対応）
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'shwvt',
            new TbCompletionProvider(),
            '@', '/', ' '
        ),
        vscode.languages.registerCompletionItemProvider(
            'shwvt',
            new PhraseCompletionProvider(),
            '@', '/', ' '
        )
    );

    // ステータスバーにボタンを追加
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'sheepWeave.openPanel';
    statusBarItem.text = '$(symbol-misc) SheepWeave';
    statusBarItem.tooltip = 'Open SheepWeave Panel';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() { }
