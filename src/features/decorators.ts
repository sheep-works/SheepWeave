/**
 * エディタの装飾機能。
 * .shwvファイル内の数値やプレースホルダーをハイライト表示します。
 */
import * as vscode from 'vscode';

// Decoration types
const numberDecoration = vscode.window.createTextEditorDecorationType({
    color: '#d19a66', // Example color (e.g. orange-ish like in One Dark)
    fontStyle: 'italic'
});

const placeholderDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 215, 0, 0.2)', // Light gold background
    borderRadius: '2px'
});

const termDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline dotted',
    cursor: 'help' // Change cursor on hover
});

export const confirmedDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(100, 255, 100, 0.1)', // Thin green
    isWholeLine: true
});


export function initDecorators(context: vscode.ExtensionContext) {
    let activeEditor = vscode.window.activeTextEditor;

    function updateDecorations() {
        if (!activeEditor) {
            return;
        }

        // Only apply to .shwv
        if (activeEditor.document.languageId !== 'shwv' && !activeEditor.document.fileName.endsWith('.shwv')) {
            return;
        }

        const text = activeEditor.document.getText();

        // Match numbers: \d+(\.\d+)?
        const numbers: vscode.DecorationOptions[] = [];
        const numRegex = /\d+([.,]\d+)?/g;
        let match;
        while ((match = numRegex.exec(text))) {
            const startPos = activeEditor.document.positionAt(match.index);
            const endPos = activeEditor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos) };
            numbers.push(decoration);
        }

        // Match placeholders: {VAR}, %s, {0} etc.
        // Simple regex for { ... } or %s
        const placeholders: vscode.DecorationOptions[] = [];
        const placeholderRegex = /\{[^}]+\}|%[sd]/g;
        while ((match = placeholderRegex.exec(text))) {
            const startPos = activeEditor.document.positionAt(match.index);
            const endPos = activeEditor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos) };
            placeholders.push(decoration);
        }

        activeEditor.setDecorations(numberDecoration, numbers);
        activeEditor.setDecorations(placeholderDecoration, placeholders);
        // Terms would be more complex, needing a dictionary lookup. Skipping for MVP static check.
    }

    if (activeEditor) {
        triggerUpdateDecorations();
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    var timeout: NodeJS.Timeout | undefined = undefined;
    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        timeout = setTimeout(updateDecorations, 500);
    }
}

import { globalDirector } from '../store';

export function renderConfirmedDecorations(editor?: vscode.TextEditor) {
    if (!editor) {
        editor = vscode.window.activeTextEditor;
    }
    if (!editor || !editor.document.fileName.endsWith('.shwvt')) {
        return;
    }

    const confirmedRanges: vscode.Range[] = [];
    for (const line of globalDirector.confirmedLines) {
        // Ensure line is within bounds
        if (line >= 0 && line < editor.document.lineCount) {
            confirmedRanges.push(new vscode.Range(line, 0, line, 0));
        }
    }

    editor.setDecorations(confirmedDecoration, confirmedRanges);
}
