import * as vscode from 'vscode';

/**
 * ファイル内の同じ単語をすべて一括置換するコマンドです。
 */
export async function renameLikeReplaceCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // 翻訳専用ファイル（shwvt）だけで動作するように制限
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

    // ユーザーに新しいテキストを入力してもらうボックスを表示
    const newText = await vscode.window.showInputBox({
        prompt: "置換後のテキストを入力",
        value: selectedText,
    });

    // ユーザーがキャンセルした場合（入力欄を閉じた場合）は、ここで処理を終了
    if (newText === undefined) return;

    // 置換処理
    const doc = editor.document;
    const fullText = doc.getText();

    // 複数の箇所を一度に書き換えるためのオブジェクトを作成
    const edit = new vscode.WorkspaceEdit();

    // 記号などが含まれていても正しく検索できるように、正規表現用にエスケープ処理をします。
    const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedText, "g");

    let match;
    // ファイル全体から一致する箇所をすべて探し出す
    while ((match = regex.exec(fullText)) !== null) {
        const start = doc.positionAt(match.index);  // 開始位置を座標に変換
        const end = doc.positionAt(match.index + selectedText.length);  // 終了位置

        // 置換の予約
        edit.replace(doc.uri, new vscode.Range(start, end), newText);
    }

    // 予約した置換をまとめて実行
    await vscode.workspace.applyEdit(edit);
}
