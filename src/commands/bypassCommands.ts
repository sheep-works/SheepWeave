import * as vscode from 'vscode';
import { openSheepWeavePanel, notifyWebview } from './openSheepWeavePanel';

export function openBypassTranslationCommand(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    openSheepWeavePanel(context);

    const line = editor ? editor.selection.active.line : 0;
    notifyWebview({ type: 'SELECT_TAB', data: 'bypass' });
    notifyWebview({
        type: 'OPEN_SUB_EDITOR',
        data: {
            mode: 'bypass',
            line: line
        }
    });
}

export function openFreeEditorCommand(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    openSheepWeavePanel(context);

    const line = editor ? editor.selection.active.line : 0;
    notifyWebview({ type: 'SELECT_TAB', data: 'bypass' });
    notifyWebview({
        type: 'OPEN_SUB_EDITOR',
        data: {
            mode: 'free',
            line: line
        }
    });
}
