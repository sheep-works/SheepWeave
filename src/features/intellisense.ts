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
        const unit = units.find(u => u.idx === lineIdx);

        if (!unit || !unit.ref || !unit.ref.tb || unit.ref.tb.length === 0) {
            return undefined;
        }

        const items: vscode.CompletionItem[] = [];
        
        // TB (Termbase) のターゲット用語を補完候補として作成
        for (const tb of unit.ref.tb) {
            for (const tgt of tb.tgts) {
                // すでに同じ内容がアイテムにないか確認
                if (items.some(item => item.label === tgt)) continue;

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

        const items: vscode.CompletionItem[] = [];
        
        for (const p of phrases) {
            // labelをフレーズにし、filterTextをショートカット(input)にする
            // これにより、ショートカットを入力した際にフレーズが候補に表示される
            const item = new vscode.CompletionItem(p.phrase, vscode.CompletionItemKind.Snippet);
            item.insertText = p.phrase;
            item.filterText = p.input;
            item.detail = `[Phrase] ${p.input}`;
            
            // TBの候補（00_）の次に来るように調整
            item.sortText = `01_${p.input}`;
            
            items.push(item);
        }

        return items;
    }
}
