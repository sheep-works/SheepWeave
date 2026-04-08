import * as vscode from 'vscode';

export async function renameLikeReplaceCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    if (editor.document.languageId !== 'shwvt') {
        return;
    }

    const selection = editor.selection;
    let selectedText = editor.document.getText(selection);

    if (!selectedText) {
        // 選択されていない場合、カーソル位置の単語を取得してみる
        const wordRange = editor.document.getWordRangeAtPosition(selection.start);
        if (wordRange) {
            selectedText = editor.document.getText(wordRange);
        }
    }

    if (!selectedText) {
        vscode.window.showInformationMessage("置換対象のテキストが選択されていません。");
        return;
    }

    const newText = await vscode.window.showInputBox({
        prompt: "置換後のテキストを入力",
        value: selectedText,
    });

    if (newText === undefined) return; // キャンセル時

    // 置換処理
    const doc = editor.document;
    const fullText = doc.getText();

    const edit = new vscode.WorkspaceEdit();
    // 正規表現のエスケープ
    const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedText, "g");

    let match;
    while ((match = regex.exec(fullText)) !== null) {
        const start = doc.positionAt(match.index);
        const end = doc.positionAt(match.index + selectedText.length);
        edit.replace(doc.uri, new vscode.Range(start, end), newText);
    }

    await vscode.workspace.applyEdit(edit);
}
