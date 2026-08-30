import * as vscode from 'vscode';
import { globalDirector, globalShWvData } from '../store';

export function gotoNextUnconfirmedCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.shwvt')) {
        return;
    }

    const currentLine = editor.selection.active.line;
    const totalLines = editor.document.lineCount;
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

    // 1. Search below current line
    for (let i = currentLine + 1; i < totalLines; i++) {
        if (!isConfirmed(i)) {
            targetLine = i;
            break;
        }
    }

    // 2. If not found below, wrap around to search from line 0
    if (targetLine === -1) {
        for (let i = 0; i <= currentLine; i++) {
            if (!isConfirmed(i)) {
                targetLine = i;
                break;
            }
        }
    }

    // 3. Move cursor and reveal range if found
    if (targetLine !== -1) {
        const targetPos = new vscode.Position(targetLine, 0);
        editor.selection = new vscode.Selection(targetPos, targetPos);
        editor.revealRange(new vscode.Range(targetPos, targetPos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        if (targetLine <= currentLine) {
            vscode.window.setStatusBarMessage(`Wrapped to line ${targetLine + 1} (Unconfirmed)`, 3000);
        }
    } else {
        vscode.window.showInformationMessage('All lines in the project are confirmed!');
    }
}
