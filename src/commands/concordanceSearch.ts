import * as vscode from 'vscode';
import { globalDirector } from '../store';
import { notifyWebview } from './openSheepWeavePanel';

export function concordanceSearchCommand(mode: 'source' | 'target') {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No active editor.');
        return;
    }

    let searchString = '';
    const selection = editor.selection;

    if (!selection.isEmpty) {
        searchString = editor.document.getText(selection);
    } else {
        // Find word under cursor manually avoiding word ranges because CJK is tricky
        const lineText = editor.document.lineAt(selection.active.line).text;
        // Basic fallback: just ask user or use standard word range if available
        const wordRange = editor.document.getWordRangeAtPosition(selection.active);
        if (wordRange) {
            searchString = editor.document.getText(wordRange);
        } else {
            vscode.window.showInformationMessage('Please select text to search for concordance.');
            return;
        }
    }

    if (!searchString) return;

    // Send the extracted text and search request to Webview
    // We can do real searching on Backend right here!

    doConcordanceSearch(searchString.trim(), mode);
}

export function doConcordanceSearch(query: string, mode: 'source' | 'target') {
    if (!query) return;

    let tbMatches: any[] = [];
    let tmMatches: any[] = [];
    let currentDocumentMatches: any[] = [];

    // 1. TB Matches
    if (globalDirector.tbData) {
        tbMatches = globalDirector.tbData.filter(tb =>
            (mode === 'source' && tb.src.includes(query)) ||
            (mode === 'target' && tb.tgt.includes(query))
        );
    }

    // 2. TM Matches (using FlexSearch)
    if (globalDirector.tmIndex) {
        const results = globalDirector.tmIndex.search(query, {
            index: mode === 'source' ? 'src' : 'tgt',
            limit: 50 // reasonable limit 
        });

        if (results && results.length > 0 && typeof results[0] === 'object' && 'result' in results[0]) {
            // Document based search result might look like [{ field: 'src', result: [id1, id2] }]
            const fieldResult = results.find((r: any) => r.field === (mode === 'source' ? 'src' : 'tgt'));
            if (fieldResult && fieldResult.result) {
                const limit = fieldResult.result.slice(0, 50);
                tmMatches = limit.map((id: any) => globalDirector.tmData.find(d => d.id === id)).filter((v: any) => v);
            }
        } else {
            // direct array response
            const limit = results.slice(0, 50);
            tmMatches = limit.map((id: any) => globalDirector.tmData.find(d => d.id === id)).filter((v: any) => v);
        }
    }

    // 3. Current Document Matches
    if (globalDirector.state && globalDirector.state.body && globalDirector.state.body.units) {
        currentDocumentMatches = globalDirector.state.body.units.filter(u => {
            if (mode === 'source') {
                return u.src.includes(query);
            } else {
                return (u.tgt && u.tgt.includes(query)) || (u.pre && u.pre.includes(query));
            }
        });
    }

    // Push the collected matches down
    notifyWebview({
        type: 'CONCORDANCE_SEARCH_RES',
        data: {
            query,
            mode,
            tbMatches,
            tmMatches,
            currentDocumentMatches
        }
    });
}
