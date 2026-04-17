import * as vscode from 'vscode';
import { globalDirector } from '../store';

/**
 * .shwvt ファイルのエディタ上で、用語集（TB）に基づいた入力補完を提供します。
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

        const items: vscode.CompletionItem[] = [];
        const seenLabels = new Set<string>();
        
        // TB (Termbase) のターゲット用語を補完候補として作成
        for (const tb of unit.ref.tb) {
            if (token.isCancellationRequested) return undefined;

            for (const tgt of tb.tgts) {
                // すでに同じ内容がアイテムにないか確認 (Setを使用して O(1) に)
                if (seenLabels.has(tgt)) continue;
                seenLabels.add(tgt);

                const item = new vscode.CompletionItem(tgt, vscode.CompletionItemKind.Reference);
                item.detail = `[TB] ${tb.src} → ${tgt}`;
                
                let docText = `**Source:** ${tb.src}\n\n**Target:** ${tgt}`;
                if (tb.note) {
                    docText += `\n\n---\n\n${tb.note}`;
                }
                if (tb.file) {
                    docText += `\n\n*File: ${tb.file}*`;
                }
                
                item.documentation = new vscode.MarkdownString(docText);
                
                // 優先的に表示されるよう、ソートキーを調整
                item.sortText = `00_${tgt}`;
                
                items.push(item);
            }
        }


        return items;
    }
}

/**
 * phrase.json に定義されたプロジェクト固有のフレーズに基づいた入力補完を提供します。
 */
export class PhraseCompletionProvider implements vscode.CompletionItemProvider {
    private cachedPhrases: any[] | undefined = undefined;
    private cachedItems: vscode.CompletionItem[] | undefined = undefined;

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        
        const phrases = globalDirector.state.phrases;
        if (!phrases || phrases.length === 0) {
            return undefined;
        }

        // キャッシュチェック（phrases 配列の参照が変わっていなければ使い回す）
        if (this.cachedPhrases === phrases && this.cachedItems) {
            return this.cachedItems;
        }

        const items: vscode.CompletionItem[] = [];
        
        for (const p of phrases) {
            if (token.isCancellationRequested) return undefined;

            // labelをフレーズにし、filterTextをショートカット(input)にする
            const item = new vscode.CompletionItem(p.phrase, vscode.CompletionItemKind.Snippet);
            item.insertText = p.phrase;
            item.filterText = p.input;
            item.detail = `[Phrase] ${p.input}`;
            
            // TBの候補（00_）の次に来るように調整
            item.sortText = `01_${p.input}`;
            
            items.push(item);
        }

        this.cachedPhrases = phrases;
        this.cachedItems = items;

        return items;
    }
}
