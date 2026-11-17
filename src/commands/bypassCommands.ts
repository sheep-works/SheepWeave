import * as vscode from 'vscode';
import { openSheepWeavePanel, notifyWebview } from './openSheepWeavePanel';
import { globalDirector } from '../store';

export function openBypassTranslationCommand(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    openSheepWeavePanel(context);

    const line = editor ? editor.selection.active.line : 0;
    const targetIdx = editor ? (globalDirector.getIdxByLine(line) ?? (line + 1)) : 1;
    notifyWebview({ type: 'SELECT_TAB', data: 'bypass' });
    notifyWebview({
        type: 'OPEN_SUB_EDITOR',
        data: {
            mode: 'bypass',
            line: targetIdx
        }
    });
}

export function openFreeEditorCommand(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    openSheepWeavePanel(context);

    const line = editor ? editor.selection.active.line : 0;
    const targetIdx = editor ? (globalDirector.getIdxByLine(line) ?? (line + 1)) : 1;
    notifyWebview({ type: 'SELECT_TAB', data: 'bypass' });
    notifyWebview({
        type: 'OPEN_SUB_EDITOR',
        data: {
            mode: 'free',
            line: targetIdx
        }
    });
}
