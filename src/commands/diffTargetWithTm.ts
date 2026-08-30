import * as vscode from 'vscode';
import { openSheepWeavePanel, notifyWebview } from './openSheepWeavePanel';

export function diffTargetWithTmCommand(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    openSheepWeavePanel(context);

    if (editor) {
        const line = editor.selection.active.line;
        notifyWebview({ type: 'SELECT_TAB', data: 'tools' });
        notifyWebview({ type: 'CURSOR_MOVED', data: { newPos: line } });
    } else {
        notifyWebview({ type: 'SELECT_TAB', data: 'tools' });
    }
}
