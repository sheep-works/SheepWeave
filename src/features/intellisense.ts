import * as vscode from 'vscode';
import { globalDirector } from '../store';

/**
 * .shwvt ファイルのエディタ上で、用語集（TB）に基づいた入力補完を提供します。
 * 単語境界としてユーザーが半角スペースを入力した場合でも、スペースごと置換して消去する候補を同時注入します。
 */
export class TbCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        
        // 現在の行に対応するユニットを取得
        const lineIdx = position.line;
        const units = globalDirector.state.body.units;

        // 高速化: まず行番号と同じインデックスを試す
        const unit = (units[lineIdx] && units[lineIdx].idx === lineIdx)
            ? units[lineIdx]
            : units.find(u => u.idx === lineIdx);

        if (!unit || !unit.ref || !unit.ref.tb || unit.ref.tb.length === 0) {
            return undefined;
        }

        const lineText = document.lineAt(position.line).text;
        const wordRange = document.getWordRangeAtPosition(position);
        const wordStart = wordRange ? wordRange.start.character : position.character;
        
        // 直前が半角スペースかどうか判定
        const hasPrecedingSpace = wordStart > 0 && lineText.charAt(wordStart - 1) === ' ';
        const spaceRange = hasPrecedingSpace
            ? new vscode.Range(new vscode.Position(position.line, wordStart - 1), position)
            : undefined;

        const items: vscode.CompletionItem[] = [];
        const seenLabels = new Set<string>();
        
        // TB (Termbase) のターゲット用語を補完候補として作成
        for (const tb of unit.ref.tb) {
            if (token.isCancellationRequested) return undefined;

            for (const tgt of tb.tgts) {
                // すでに同じ内容がアイテムにないか確認
                if (seenLabels.has(tgt)) continue;
                seenLabels.add(tgt);

                let docText = `**Source:** ${tb.src}\n\n**Target:** ${tgt}`;
                if (tb.note) {
                    docText += `\n\n---\n\n${tb.note}`;
                }
                if (tb.file) {
                    docText += `\n\n*File: ${tb.file}*`;
                }
                const doc = new vscode.MarkdownString(docText);

                // 1. 直前にスペースがある場合: スペースを自動消去して挿入する候補を最優先表示
                if (hasPrecedingSpace && spaceRange) {
                    const spaceTrimItem = new vscode.CompletionItem(
                        { label: tgt, description: '␣除去' },
                        vscode.CompletionItemKind.Reference
                    );
                    spaceTrimItem.insertText = tgt;
                    spaceTrimItem.range = spaceRange;
                    spaceTrimItem.detail = `[TB ␣除去] ${tb.src} → ${tgt}`;
                    spaceTrimItem.filterText = ` ${tgt}  ${tb.src} ${tgt} ${tb.src} @${tb.src} /${tb.src}`;
                    spaceTrimItem.documentation = doc;
                    spaceTrimItem.sortText = `00_0_${tgt}`;
                    items.push(spaceTrimItem);
                }

                // 2. 通常の補完候補 (スペース保持)
                const normalItem = new vscode.CompletionItem(tgt, vscode.CompletionItemKind.Reference);
                normalItem.detail = `[TB] ${tb.src} → ${tgt}`;
                normalItem.filterText = `${tgt} ${tb.src} @${tb.src} /${tb.src}`;
                normalItem.documentation = doc;
                normalItem.sortText = `00_1_${tgt}`;
                if (wordRange) {
                    normalItem.range = wordRange;
                }
                items.push(normalItem);
            }
        }

        return items;
    }
}

/**
 * phrase.json に定義されたプロジェクト固有のフレーズに基づいた入力補完を提供します。
 * 単語境界の半角スペースを消去する候補もサポートします。
 */
export class PhraseCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        
        const phrases = globalDirector.phrases;
        if (!phrases || phrases.length === 0) {
            return undefined;
        }

        const lineText = document.lineAt(position.line).text;
        const wordRange = document.getWordRangeAtPosition(position);
        const wordStart = wordRange ? wordRange.start.character : position.character;
        
        const hasPrecedingSpace = wordStart > 0 && lineText.charAt(wordStart - 1) === ' ';
        const spaceRange = hasPrecedingSpace
            ? new vscode.Range(new vscode.Position(position.line, wordStart - 1), position)
            : undefined;

        const items: vscode.CompletionItem[] = [];
        
        for (const p of phrases) {
            if (token.isCancellationRequested) return undefined;

            // 1. 直前にスペースがある場合: スペース除去候補
            if (hasPrecedingSpace && spaceRange) {
                const spaceItem = new vscode.CompletionItem(
                    { label: p.phrase, description: '␣除去' },
                    vscode.CompletionItemKind.Snippet
                );
                spaceItem.insertText = p.phrase;
                spaceItem.range = spaceRange;
                spaceItem.filterText = ` ${p.input} ${p.input} ${p.phrase}`;
                spaceItem.detail = `[Phrase ␣除去] ${p.input}`;
                spaceItem.sortText = `01_0_${p.input}`;
                items.push(spaceItem);
            }

            // 2. 通常候補
            const item = new vscode.CompletionItem(p.phrase, vscode.CompletionItemKind.Snippet);
            item.insertText = p.phrase;
            item.filterText = `${p.input} ${p.phrase}`;
            item.detail = `[Phrase] ${p.input}`;
            item.sortText = `01_1_${p.input}`;
            if (wordRange) {
                item.range = wordRange;
            }
            items.push(item);
        }

        return items;
    }
}
