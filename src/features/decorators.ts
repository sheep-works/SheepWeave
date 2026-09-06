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

// 用語をハイライト（フォントカラー黄色 / One Dark・ライトテーマ双方で見やすい金色・黄色系）
export let termDecoration = vscode.window.createTextEditorDecorationType({
    color: '#e5c07b', // 黄色系 (ゴールド)
    fontWeight: '500'
});

export function updateTermDecorationStyle() {
    const config = vscode.workspace.getConfiguration('sheepWeave');
    const color = config.get<string>('termDecorationColor', '#e5c07b');
    if (termDecoration) {
        termDecoration.dispose();
    }
    termDecoration = vscode.window.createTextEditorDecorationType({
        color: color,
        fontWeight: '500'
    });
}

// 確定済みの行全体をハイライト
export const confirmedDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(100, 255, 100, 0.1)', // 薄い緑色
    isWholeLine: true
});


export function initDecorators(context: vscode.ExtensionContext) {
    let activeEditor = vscode.window.activeTextEditor;

    updateTermDecorationStyle();

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

        // 3. HTMLタグの検索: <tag>, </tag>, <tag /> など (複数行を跨がない)
        const tags: vscode.DecorationOptions[] = [];
        const tagRegex = /<[^>\r\n]+>/g;
        while ((match = tagRegex.exec(text))) {
            const startPos = activeEditor.document.positionAt(match.index);
            const endPos = activeEditor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos) };
            tags.push(decoration);
        }

        activeEditor.setDecorations(numberDecoration, numbers);
        activeEditor.setDecorations(placeholderDecoration, placeholders);
        activeEditor.setDecorations(tagDecoration, tags);
    }

    if (activeEditor) {
        triggerUpdateDecorations();
        renderTermDecorations(activeEditor);
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            triggerUpdateDecorations();
            renderTermDecorations(editor);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
            triggerUpdateTermDecorations(activeEditor);
        }
    }, null, context.subscriptions);

    let selectionTimeout: NodeJS.Timeout | undefined = undefined;
    vscode.window.onDidChangeTextEditorSelection(event => {
        activeEditor = event.textEditor;
        triggerUpdateTermDecorations(event.textEditor);
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('sheepWeave.termDecorationColor') || event.affectsConfiguration('sheepWeave.termDecorationLineRange')) {
            updateTermDecorationStyle();
            if (activeEditor) {
                renderTermDecorations(activeEditor);
            }
        }
    }, null, context.subscriptions);

    let timeout: NodeJS.Timeout | undefined = undefined;
    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        timeout = setTimeout(updateDecorations, 500);
    }

    function triggerUpdateTermDecorations(editor: vscode.TextEditor) {
        if (selectionTimeout) {
            clearTimeout(selectionTimeout);
            selectionTimeout = undefined;
        }
        selectionTimeout = setTimeout(() => {
            renderTermDecorations(editor);
        }, 200);
    }
}

import { globalDirector, globalShWvData } from '../store';
import { findProjectRoot } from '../util';

/**
 * 現在のアクティブ行（および指定範囲の行）に登録用語のハイライトを適用します。
 * 全行スキャンを避け、カーソル行（± rangeOffset）のみを対象とすることで高速かつ視覚ノイズを抑えます。
 *
 * @param editor 対象のTextEditor（省略時はactiveTextEditor）
 * @param targetLine ターゲット行番号（省略時はカーソル位置の行）
 * @param rangeOffset 対象範囲の拡張オフセット（省略時は設定 sheepWeave.termDecorationLineRange を使用、デフォルト: 2）
 */
export function renderTermDecorations(
    editor?: vscode.TextEditor,
    targetLine?: number,
    rangeOffset?: number
) {
    if (!editor) {
        editor = vscode.window.activeTextEditor;
    }
    if (!editor) {
        return;
    }

    const fileName = editor.document.fileName.toLowerCase();
    const langId = editor.document.languageId;
    const isSource = langId === 'shwvs' || fileName.endsWith('.shwvs');
    const isTarget = langId === 'shwvt' || fileName.endsWith('.shwvt');
    const isBilingual = langId === 'shwv' || fileName.endsWith('.shwv');

    if (!isSource && !isTarget && !isBilingual) {
        return;
    }

    // データが未ロードの場合はプロジェクトルートから読み込み
    if (!globalShWvData.body.units || globalShWvData.body.units.length === 0) {
        const root = findProjectRoot(editor.document.uri.fsPath);
        if (root) {
            globalShWvData.load(root);
            globalDirector.initializeFromState();
            globalDirector.loadPhrasesFromRoot(root);
            globalDirector.loadRefData(root);
        }
    }

    if (targetLine === undefined) {
        if (editor.selections.length > 0) {
            targetLine = editor.selections[0].active.line;
        } else {
            targetLine = 0;
        }
    }

    if (rangeOffset === undefined) {
        const config = vscode.workspace.getConfiguration('sheepWeave');
        rangeOffset = config.get<number>('termDecorationLineRange', 2);
    }

    const startLine = Math.max(0, targetLine - rangeOffset);
    const endLine = Math.min(editor.document.lineCount - 1, targetLine + rangeOffset);

    // 登録用語の収集 (src -> Set of tgts)
    const termMap = new Map<string, Set<string>>();

    // 1. プロジェクト内用語 (globalShWvData.body.terms)
    if (globalShWvData?.body?.terms) {
        for (const t of globalShWvData.body.terms) {
            if (t.src && t.src.trim()) {
                if (!termMap.has(t.src)) termMap.set(t.src, new Set());
                if (t.tgt) termMap.get(t.src)!.add(t.tgt);
            }
        }
    }

    // 2. 参照TB (globalDirector.tbData)
    if (globalDirector?.tbData) {
        for (const t of globalDirector.tbData) {
            if (t.src && t.src.trim()) {
                if (!termMap.has(t.src)) termMap.set(t.src, new Set());
                if (t.tgt) termMap.get(t.src)!.add(t.tgt);
            }
        }
    }

    // 3. 対象行のユニット固有 TB (unit.ref.tb)
    for (let line = startLine; line <= endLine; line++) {
        const unit = globalShWvData?.body?.units?.[line];
        if (unit?.ref?.tb) {
            for (const tb of unit.ref.tb) {
                if (tb.src && tb.src.trim()) {
                    if (!termMap.has(tb.src)) termMap.set(tb.src, new Set());
                    if (tb.tgts) {
                        for (const tgt of tb.tgts) {
                            if (tgt) termMap.get(tb.src)!.add(tgt);
                        }
                    }
                    if ((tb as any).tgt) {
                        termMap.get(tb.src)!.add((tb as any).tgt);
                    }
                }
            }
        }
    }

    // 用語が1件もない場合は装飾をクリア
    if (termMap.size === 0) {
        editor.setDecorations(termDecoration, []);
        return;
    }

    const termDecorations: vscode.DecorationOptions[] = [];
    const seenRanges = new Set<string>();

    // 行内の一致箇所をすべて検索してデコレーションを作成
    function findOccurrences(text: string, search: string, line: number, tooltipContent: string) {
        if (!search) return;
        let pos = 0;
        while ((pos = text.indexOf(search, pos)) !== -1) {
            const key = `${line}:${pos}:${pos + search.length}`;
            if (!seenRanges.has(key)) {
                seenRanges.add(key);
                const startPos = new vscode.Position(line, pos);
                const endPos = new vscode.Position(line, pos + search.length);
                const md = new vscode.MarkdownString(tooltipContent);
                md.isTrusted = true;
                termDecorations.push({
                    range: new vscode.Range(startPos, endPos),
                    hoverMessage: md
                });
            }
            pos += search.length;
        }
    }

    // 長い用語から順にマッチさせるためキーを長さ降順にソート
    const sortedSrcs = Array.from(termMap.keys()).sort((a, b) => b.length - a.length);

    for (let line = startLine; line <= endLine; line++) {
        const lineText = editor.document.lineAt(line).text;
        if (!lineText) continue;

        for (const src of sortedSrcs) {
            const tgtsSet = termMap.get(src)!;
            const tgts = Array.from(tgtsSet);
            const tooltip = `**用語集 (TB)**\n\n- 原文: \`${src}\`\n- 訳文: ${tgts.length > 0 ? tgts.map(t => `\`${t}\``).join(', ') : '*(未指定)*'}`;

            if (isSource) {
                // .shwvs: 原文用語を装飾
                findOccurrences(lineText, src, line, tooltip);
            } else if (isTarget) {
                // .shwvt: 訳文用語を装飾（存在すれば原文用語も装飾）
                for (const tgt of tgts) {
                    if (tgt && tgt.trim()) {
                        findOccurrences(lineText, tgt, line, tooltip);
                    }
                }
                findOccurrences(lineText, src, line, tooltip);
            } else if (isBilingual) {
                // .shwv: 原文・訳文の両方を装飾
                findOccurrences(lineText, src, line, tooltip);
                for (const tgt of tgts) {
                    if (tgt && tgt.trim()) {
                        findOccurrences(lineText, tgt, line, tooltip);
                    }
                }
            }
        }
    }

    // デコレーションを適用（以前の現在行以外の装飾は自動的にクリアされる）
    editor.setDecorations(termDecoration, termDecorations);
}

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
