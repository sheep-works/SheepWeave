/**
 * エディタの装飾機能。
 * .shwvt (Target), .shwvs (Source), .shwv ファイル内の数値やプレースホルダーをハイライト表示します。
 */
import * as vscode from 'vscode';

// 装飾タイプ（デコレーション）の定義

// 数値をハイライト（例：123, 1.23）
const numberDecoration = vscode.window.createTextEditorDecorationType({
    color: '#d19a66', // オレンジ系（One Dark風）
    fontStyle: 'italic'
});

// プレースホルダーをハイライト（例：{0}, {VAR}, %s）
const placeholderDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 215, 0, 0.2)', // 薄いゴールド背景
    borderRadius: '2px'
});

// HTMLタグをハイライト（例：<b>, </div>）
const tagDecoration = vscode.window.createTextEditorDecorationType({
    color: '#56b6c2', // シアン/テイル系
    fontWeight: 'bold'
});

// 用語（将来用：現在は実装が複雑なため未使用）
const termDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline dotted',
    cursor: 'help'
});

// 確定済みの行全体をハイライト
export const confirmedDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(100, 255, 100, 0.1)', // 薄い緑色
    isWholeLine: true
});


export function initDecorators(context: vscode.ExtensionContext) {
    let activeEditor = vscode.window.activeTextEditor;

    function updateDecorations() {
        if (!activeEditor) {
            return;
        }

        // Apply to .shwvt, .shwvs, and legacy .shwv
        const langId = activeEditor.document.languageId;
        const fileName = activeEditor.document.fileName;
        const isSupported = langId === 'shwvt' || langId === 'shwvs' || langId === 'shwv' ||
                            fileName.endsWith('.shwvt') || fileName.endsWith('.shwvs') || fileName.endsWith('.shwv');

        if (!isSupported) {
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

        // 2. プレースホルダーの検索: {VAR}, %s, {0} など
        const placeholders: vscode.DecorationOptions[] = [];
        const placeholderRegex = /\{[^}]+\}|%[sd]/g;
        while ((match = placeholderRegex.exec(text))) {
            const startPos = activeEditor.document.positionAt(match.index);
            const endPos = activeEditor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos) };
            placeholders.push(decoration);
        }

        // 3. HTMLタグの検索: <tag>, </tag>, <tag /> など
        const tags: vscode.DecorationOptions[] = [];
        const tagRegex = /<[^>]+>/g;
        while ((match = tagRegex.exec(text))) {
            const startPos = activeEditor.document.positionAt(match.index);
            const endPos = activeEditor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos) };
            tags.push(decoration);
        }

        activeEditor.setDecorations(numberDecoration, numbers);
        activeEditor.setDecorations(placeholderDecoration, placeholders);
        activeEditor.setDecorations(tagDecoration, tags);
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
