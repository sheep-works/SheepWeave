import * as vscode from 'vscode';
import { globalDirector, globalShWvData } from '../store';

export function gotoPrevUnconfirmedCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.shwvt')) {
        return;
    }

    const currentLine = editor.selection.active.line;
    const units = globalShWvData.body.units;

    if (!units || units.length === 0) {
        return;
    }

    const isConfirmed = (lineIdx: number): boolean => {
        if (globalDirector.confirmedLines.has(lineIdx)) {
            return true;
        }
        const unit = units[lineIdx] && units[lineIdx].idx === lineIdx ? units[lineIdx] : units.find(u => u.idx === lineIdx);
        return unit ? (unit.status !== undefined && unit.status > 0) : false;
    };

    let targetLine: number | -1 = -1;

    // Search upward from current line - 1 down to 0
    for (let i = currentLine - 1; i >= 0; i--) {
        if (!isConfirmed(i)) {
            targetLine = i;
            break;
        }
    }

    // Move cursor and reveal range if found; if not found, do nothing
    if (targetLine !== -1) {
        const targetPos = new vscode.Position(targetLine, 0);
        editor.selection = new vscode.Selection(targetPos, targetPos);
        editor.revealRange(new vscode.Range(targetPos, targetPos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
}
