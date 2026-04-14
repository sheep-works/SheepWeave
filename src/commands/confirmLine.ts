import * as vscode from 'vscode';
import { globalDirector } from '../store';
import { renderConfirmedDecorations } from '../features/decorators';

export function confirmLineCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.shwvt')) {
        return;
    }

    const line = editor.selection.active.line;
    const text = editor.document.lineAt(line).text;

    // Execute confirmation business logic (syncs down to ref.quoted natively)
    globalDirector.confirmLine(line, text);

    // Apply decorations
    renderConfirmedDecorations(editor);

    // 次の行の先頭にカーソルを移動
    const nextLine = line + 1;
    if (nextLine < editor.document.lineCount) {
        const nextPosition = new vscode.Position(nextLine, 0);
        editor.selection = new vscode.Selection(nextPosition, nextPosition);
        editor.revealRange(new vscode.Range(nextPosition, nextPosition));
    }
}
