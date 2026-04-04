/**
 * エディタの保護機能。
 * .shwvファイルの行数が変更されるのを防ぎ、誤った編集をUndoします。
 */
import * as vscode from 'vscode';

const lineCountMap = new Map<string, number>();
const undoing = new Set<string>();

export function initEditorGuard(context: vscode.ExtensionContext) {
    // Initialize for already open documents
    vscode.workspace.textDocuments.forEach(doc => {
        if (isShwvFile(doc)) {
            lineCountMap.set(doc.uri.toString(), doc.lineCount);
        }
    });

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (isShwvFile(doc)) {
                lineCountMap.set(doc.uri.toString(), doc.lineCount);
            }
        }),

        vscode.workspace.onDidCloseTextDocument(doc => {
            lineCountMap.delete(doc.uri.toString());
        }),

        vscode.workspace.onDidChangeTextDocument(async (e) => {
            const { document, contentChanges } = e;
            const key = document.uri.toString();

            if (!isShwvFile(document)) return;
            if (undoing.has(key)) return;

            // If we don't have a baseline, set it now (should have happened on open, but just in case)
            if (!lineCountMap.has(key)) {
                lineCountMap.set(key, document.lineCount);
                return; // Assume initial state is correct if we just discovered it
            }

            const original = lineCountMap.get(key)!;
            const after = document.lineCount;

            const lineDelta = after - original;

            // Check for strictly line count changes or newlines in content
            const hasLineChange =
                lineDelta !== 0 ||
                contentChanges.some(c => c.text.includes('\n') || c.range.end.line !== c.range.start.line);

            if (hasLineChange) {
                try {
                    undoing.add(key);
                    await vscode.commands.executeCommand('undo');
                    vscode.window.showWarningMessage('SheepWeave: Line count change is restricted in .shwv files.');
                } finally {
                    undoing.delete(key);
                }
            } else {
                // Safe edit, don't update line count map because line count shouldn't have changed.
                // But if it did change somehow without us catching it (e.g. external?), we might be out of sync.
                // But here we rely on the logic that permitted edits preserve line count.
            }
        })
    );
}

function isShwvFile(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'shwvt' || doc.fileName.endsWith('.shwvt')
        || doc.languageId === 'shwvs' || doc.fileName.endsWith('.shwvs');
}
