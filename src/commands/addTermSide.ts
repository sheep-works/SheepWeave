import * as vscode from 'vscode';
import { globalShWvData } from '../store';
import { DirHelper } from '../services/core/DirHelper';
import { notifyWebview } from './openSheepWeavePanel';

/**
 * 登録待ちの訳文と、元のターゲットエディタを保持する
 */
let pendingAddTerm: {
    tgtText: string;
    targetEditor: vscode.TextEditor;
} | null = null;

let statusBarItem: vscode.Disposable | null = null;

// ハイライト用のデコレーション型（薄い黄色）
const activeLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 255, 0, 0.15)',
    isWholeLine: true,
});

/**
 * ステップ1: .shwvt で訳文を選択し、原文をサイドカラムで開く。
 */
export async function startAddTermSide(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isShwvtFile(editor.document)) return;

    const selection = editor.selection;
    let tgtText = editor.document.getText(selection);

    // 選択がない場合はカーソル位置の単語を取得
    if (!tgtText) {
        const wordRange = editor.document.getWordRangeAtPosition(selection.active);
        if (wordRange) {
            tgtText = editor.document.getText(wordRange);
        }
    }

    if (!tgtText) {
        vscode.window.showInformationMessage("SheepWeave: 用語に登録する訳文を選択してください。");
        return;
    }

    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return;

    // Source.shwvs のパスを取得
    const shwvsPath = DirHelper.getShwvsPath(root);
    const shwvsUri = vscode.Uri.file(shwvsPath);
    const targetLine = selection.active.line;

    // 状態を保存
    pendingAddTerm = {
        tgtText,
        targetEditor: editor
    };

    // 原文ファイルを隣のカラムで開く
    const shwvsDoc = await vscode.workspace.openTextDocument(shwvsUri);
    const shwvsEditor = await vscode.window.showTextDocument(shwvsDoc, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false, // フォーカスを shwvs に移す
        selection: new vscode.Range(targetLine, 0, targetLine, 0) // 同じ行へ
    });

    // ハイライトを適用
    shwvsEditor.setDecorations(activeLineDecoration, [new vscode.Range(targetLine, 0, targetLine, 0)]);

    // スクロールを合わせる（中央付近に来るように）
    shwvsEditor.revealRange(new vscode.Range(targetLine, 0, targetLine, 0), vscode.TextEditorRevealType.InCenterIfOutsideViewport);

    // ステータスバーにメッセージを表示
    if (statusBarItem) statusBarItem.dispose();
    statusBarItem = vscode.window.setStatusBarMessage("$(sync~spin) SheepWeave: 原文を選択して Enter で確定 (Esc でキャンセル)");

    // Webview を翻訳タブに切り替える
    notifyWebview({ type: 'SELECT_TAB', data: 'translate' });

    // モード切り替え（キーバインド制御用）
    await vscode.commands.executeCommand('setContext', 'sheepWeave.addTermSideMode', true);
}


/**
 * ステップ2: .shwvs で原文を選択し、登録を確定する。
 */
export async function confirmAddTermSide(): Promise<void> {
    if (!pendingAddTerm) return;

    const editor = vscode.window.activeTextEditor;
    // shwvs ファイルからの確定のみ受け付ける
    if (!editor || !editor.document.fileName.endsWith('.shwvs')) {
        vscode.window.showWarningMessage("SheepWeave: 原文(shwvs)のエディタを選択し、登録したい部分を範囲選択してから確定してください。");
        return;
    }

    const srcText = editor.document.getText(editor.selection);
    if (!srcText) {
        vscode.window.showInformationMessage("SheepWeave: 原文の中から用語部分を範囲選択してください。");
        return;
    }

    const { tgtText, targetEditor } = pendingAddTerm;

    // 用語を登録し、変更されたユニット（TB情報が更新された行）を取得
    const updatedUnits = globalShWvData.addTerm(srcText, tgtText);

    // データを保存
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) {
        globalShWvData.save(root);
    }

    // Webview側へ差分情報を通知
    notifyWebview({ 
        type: 'UNITS_UPDATED', 
        data: { 
            units: updatedUnits,
            meta: globalShWvData.meta 
        } 
    });

    vscode.window.showInformationMessage(`SheepWeave: 用語を登録しました ("${srcText}" → "${tgtText}")。${updatedUnits.length} 箇所を更新しました。`);


    // ターゲットエディタにフォーカスを戻す
    await vscode.window.showTextDocument(targetEditor.document, targetEditor.viewColumn);

    await cleanupAddTermSide();
}

/**
 * キャンセル処理
 */
export async function cancelAddTermSide(): Promise<void> {
    if (!pendingAddTerm) return;
    await cleanupAddTermSide();
    vscode.window.showInformationMessage("SheepWeave: 用語追加をキャンセルしました。");
}

async function cleanupAddTermSide(): Promise<void> {
    pendingAddTerm = null;
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = null;
    }
    // ハイライトを全エディタから消去
    vscode.window.visibleTextEditors.forEach(editor => {
        editor.setDecorations(activeLineDecoration, []);
    });

    await vscode.commands.executeCommand('setContext', 'sheepWeave.addTermSideMode', false);
}


function isShwvtFile(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'shwvt' || doc.fileName.endsWith('.shwvt');
}
