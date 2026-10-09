import * as vscode from 'vscode';
import { openSheepWeavePanel, notifyWebview } from './openSheepWeavePanel';
import { globalDirector } from '../store';

export function diffTargetWithTmCommand(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    openSheepWeavePanel(context);

    if (editor) {
        const line = editor.selection.active.line;
        const idx = globalDirector.getIdxByLine(line);
        notifyWebview({ type: 'SELECT_TAB', data: 'tools' });
        notifyWebview({ type: 'CURSOR_MOVED', data: { newPos: idx } });
    } else {
        notifyWebview({ type: 'SELECT_TAB', data: 'tools' });
    }
}
