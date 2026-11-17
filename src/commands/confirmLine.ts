import * as vscode from 'vscode';
import { globalDirector } from '../store';
import { renderConfirmedDecorations } from '../features/decorators';

/**
 * 行確定コマンド。
 * 単一行選択時はその行を確定して次行へ移動します。
 * 複数行選択（ドラッグまたはマルチカーソル）時は、選択されている全行を一括確定します。
 */
export function confirmLineCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.shwvt')) {
        return;
    }

    const selections = editor.selections;
    const linesToConfirm = new Set<number>();

    for (const sel of selections) {
        if (sel.isEmpty) {
            linesToConfirm.add(sel.active.line);
        } else {
            const startLine = Math.min(sel.start.line, sel.end.line);
            // 選択が次行の先頭(character 0)で終わっている場合、その行自体は選択範囲に含めない
            const endLine = (sel.end.character === 0 && sel.end.line > sel.start.line)
                ? sel.end.line - 1
                : sel.end.line;
            for (let l = startLine; l <= endLine; l++) {
                linesToConfirm.add(l);
            }
        }
    }

    if (linesToConfirm.size === 0) return;

    if (linesToConfirm.size === 1) {
        // 単一行の場合は従来の挙動（次行へ移動）
        const line = Array.from(linesToConfirm)[0];
        const text = editor.document.lineAt(line).text;
        const idx = globalDirector.getIdxByLine(line);

        globalDirector.confirmLine(idx, text);
        renderConfirmedDecorations(editor);

        const nextLine = line + 1;
        if (nextLine < editor.document.lineCount) {
            const nextPosition = new vscode.Position(nextLine, 0);
            editor.selection = new vscode.Selection(nextPosition, nextPosition);
            editor.revealRange(new vscode.Range(nextPosition, nextPosition));
        }
    } else {
        // 複数行の場合はバッチ一括確定
        const batchItems: { idx: number; text: string }[] = [];
        let maxLine = -1;

        for (const line of linesToConfirm) {
            if (line < 0 || line >= editor.document.lineCount) continue;
            const text = editor.document.lineAt(line).text;
            const idx = globalDirector.getIdxByLine(line);
            batchItems.push({ idx, text });
            if (line > maxLine) maxLine = line;
        }

        globalDirector.confirmLines(batchItems);
        renderConfirmedDecorations(editor);

        // 選択範囲の最後の次の行へカーソルを移動
        const nextLine = maxLine + 1;
        if (nextLine < editor.document.lineCount) {
            const nextPosition = new vscode.Position(nextLine, 0);
            editor.selection = new vscode.Selection(nextPosition, nextPosition);
            editor.revealRange(new vscode.Range(nextPosition, nextPosition));
        }

        vscode.window.setStatusBarMessage(`$(check) SheepWeave: ${batchItems.length} 行を一括確定しました`, 3000);
    }
}
