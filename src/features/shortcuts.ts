/**
 * エディタ上のショートカット機能。
 * TMの置換や用語の置換などを提供します。
 */
import * as vscode from 'vscode';
import { globalShWvData } from '../store';

export function initShortcuts(context: vscode.ExtensionContext) {
    // TM 1-5 の置換コマンド
    for (let i = 1; i <= 5; i++) {
        context.subscriptions.push(
            vscode.commands.registerCommand(`sheepWeave.replaceWithTm${i}`, () => {
                replaceWithTm(i - 1);
            })
        );
    }

    // 用語の置換コマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('sheepWeave.replaceWithTb', () => {
            replaceWithTb();
        }),
        vscode.commands.registerCommand('sheepWeave.replaceAllWithTb', () => {
            replaceAllWithTb();
        }),
        vscode.commands.registerCommand('sheepWeave.copySource', () => {
            copySource();
        })
    );
}

function replaceWithTm(index: number) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isShwvtFile(editor.document)) return;

    const line = editor.selection.active.line;
    const unit = globalShWvData.body.units[line];

    if (unit && unit.ref.tms && unit.ref.tms[index]) {
        const tm = unit.ref.tms[index];
        const tgt = tm.idx !== -1 ? (globalShWvData.body.units[tm.idx]?.tgt || tm.tgt) : tm.tgt;
        const lineItem = editor.document.lineAt(line);

        editor.edit(editBuilder => {
            editBuilder.replace(lineItem.range, tgt);
        });
    }
}

function replaceWithTb() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isShwvtFile(editor.document)) return;

    const selection = editor.selection;
    if (selection.isEmpty) return;

    const selectedText = editor.document.getText(selection);
    const line = selection.active.line;
    const unit = globalShWvData.body.units[line];

    if (unit && unit.ref.tb) {
        // 現在のセグメントに紐付いている用語集から検索
        const tbMatch = unit.ref.tb.find(tb => tb.src === selectedText);
        if (tbMatch) {
            const replacement = tbMatch.tgts.join('/');
            editor.edit(editBuilder => {
                editBuilder.replace(selection, replacement);
            });
        }
    }
}

function replaceAllWithTb() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isShwvtFile(editor.document)) return;

    const selection = editor.selection;
    if (selection.isEmpty) return;

    const selectedText = editor.document.getText(selection);
    const line = selection.active.line;
    const unit = globalShWvData.body.units[line];

    if (unit && unit.ref.tb) {
        const tbMatch = unit.ref.tb.find(tb => tb.src === selectedText);
        if (tbMatch) {
            const replacement = tbMatch.tgts.join('/');
            const text = editor.document.getText();

            editor.edit(editBuilder => {
                let index = text.indexOf(selectedText);
                while (index !== -1) {
                    const start = editor.document.positionAt(index);
                    const end = editor.document.positionAt(index + selectedText.length);
                    editBuilder.replace(new vscode.Range(start, end), replacement);
                    index = text.indexOf(selectedText, index + selectedText.length);
                }
            });
            vscode.window.showInformationMessage(`SheepWeave: Replaced all occurrences of "${selectedText}" with "${replacement}".`);
        }
    }
}

function copySource() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isShwvtFile(editor.document)) return;

    const line = editor.selection.active.line;
    const unit = globalShWvData.body.units[line];

    if (unit) {
        const src = unit.src;
        vscode.env.clipboard.writeText(src);
        vscode.window.setStatusBarMessage(`SheepWeave: Source copied to clipboard.`, 2000);
    }
}

function isShwvtFile(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'shwvt' || doc.fileName.endsWith('.shwvt');
}
