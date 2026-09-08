import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShWvData } from '../services/core/ShWvData';
import { SheepShuttle } from '../management';
import { DirHelper } from '../services/core/DirHelper';
import { ReviewHtmlExporter } from '../services/reviewHtmlExporter';
import { globalDirector } from '../store';

export class AdminHandler {
    public static async handle(message: any, globalShWvData: ShWvData, rootPath: string, panel: vscode.WebviewPanel) {
        /**
         * Webviewから送られてきた 'shuttle-' で始まるメッセージを処理する。
         * @param message Webviewからのデータ（typeやpayloadが含まれる）
         * @param data 現在の翻訳データ本体
         * @param rootPath プロジェクトのルートパス
         * @param panel メッセージを返すためのWebviewパネル
         */
        const managePath = DirHelper.getManagePath(rootPath);

        switch (message.type) {
            case 'shuttle-export-review-html':
                try {
                    // 1. 最新の Target.shwvt を読み込み
                    const shwvtPath = DirHelper.getShwvtPath(rootPath);
                    if (fs.existsSync(shwvtPath)) {
                        globalShWvData.update(shwvtPath);
                    }
                    // 2. SSOT (project.json) を最新状態に保存
                    globalDirector.initializeFromState();
                    globalShWvData.save(rootPath);

                    // 3. 用語ハイライト付きHTMLを出力
                    const htmlPath = ReviewHtmlExporter.exportHtml(globalShWvData, rootPath, globalDirector.tbData);

                    // 4. 通知およびブラウザで開くアクション
                    const action = await vscode.window.showInformationMessage(
                        `Review HTML を出力しました: ${path.basename(htmlPath)}`,
                        'ブラウザで開く',
                        'フォルダを開く'
                    );
                    if (action === 'ブラウザで開く') {
                        vscode.env.openExternal(vscode.Uri.file(htmlPath));
                    } else if (action === 'フォルダを開く') {
                        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(htmlPath));
                    }
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to export Review HTML: ${e}`);
                }
                break;
            // メッセージの種類（type）によって処理を分岐させる
            case 'shuttle-export-json':
                // SheepShuttleサービスを使い、外部からプロジェクトデータを取り込む
                try {
                    fs.mkdirSync(managePath, { recursive: true });
                    const jsonPath = path.join(managePath, 'export.json');
                    SheepShuttle.exportToJson(globalShWvData, jsonPath);
                    vscode.window.showInformationMessage(`Exported to ${jsonPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to export JSON: ${e}`);
                }
                break;
            case 'shuttle-export-csv':
                try {
                    fs.mkdirSync(managePath, { recursive: true });
                    const csvPath = path.join(managePath, 'export.csv');
                    SheepShuttle.exportToCsv(globalShWvData, csvPath);
                    vscode.window.showInformationMessage(`Exported to ${csvPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to export CSV: ${e}`);
                }
                break;
            case 'shuttle-split-file':
                try {
                    fs.mkdirSync(managePath, { recursive: true });
                    const outDirFile = path.join(managePath, 'splits_by_file');
                    SheepShuttle.splitByFile(globalShWvData, outDirFile);
                    vscode.window.showInformationMessage(`Files split in ${outDirFile}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to split by file: ${e}`);
                }
                break;
            case 'shuttle-split-length':
                try {
                    fs.mkdirSync(managePath, { recursive: true });
                    const payload = message.payload || {};
                    const maxLength = payload.maxLength || 1000;
                    const outDirLength = path.join(managePath, 'splits_by_length');
                    SheepShuttle.splitByLength(globalShWvData, maxLength, outDirLength);
                    vscode.window.showInformationMessage(`Files split by length in ${outDirLength}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to split by length: ${e}`);
                }
                break;
            case 'shuttle-export-jsonl':
                try {
                    fs.mkdirSync(managePath, { recursive: true });
                    const jsonlPath = path.join(managePath, 'export.jsonl');
                    SheepShuttle.exportToJsonl(globalShWvData, jsonlPath);
                    vscode.window.showInformationMessage(`Exported JSONL to ${jsonlPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to export JSONL: ${e}`);
                }
                break;
            case 'shuttle-chunk-jsonl':
                try {
                    fs.mkdirSync(managePath, { recursive: true });
                    const payload = message.payload || {};
                    const maxChars = payload.maxTokens || 4000;
                    const jsonlContent = SheepShuttle.chunkJsonl(globalShWvData, maxChars);
                    const outputPath = path.join(managePath, 'export_chunked.jsonl');

                    fs.writeFileSync(outputPath, jsonlContent, 'utf-8');
                    vscode.window.showInformationMessage(`Exported chunked JSONL to ${outputPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to chunk JSONL: ${e}`);
                }
                break;
            case 'shuttle-import-jsonl':
                try {
                    const jsonlPath = path.join(managePath, 'export_chunked.jsonl');
                    if (!fs.existsSync(jsonlPath)) {
                        vscode.window.showErrorMessage(`File not found: ${jsonlPath}`);
                        return;
                    }
                    SheepShuttle.updateFromJsonl(globalShWvData, jsonlPath);

                    // Update the physical shwvs and shwvt files based on the imported data
                    await globalShWvData.writeShwv(rootPath);

                    // Notify webview to reload the updated data
                    panel.webview.postMessage({
                        type: 'SHWV_DATA_LOADED',
                        data: { meta: globalShWvData.meta, units: globalShWvData.body.units }
                    });

                    vscode.window.showInformationMessage(`Imported and synchronized files from ${jsonlPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to import JSONL: ${e}`);
                }
                break;
            case 'shuttle-auto-replace':
                try {
                    const logPath = path.join(rootPath, 'Working', '01_REF', 'auto_replace_log.jsonl');
                    if (!fs.existsSync(logPath)) {
                        vscode.window.showErrorMessage(`auto_replace_log.jsonl not found.`);
                        return;
                    }

                    const logContent = fs.readFileSync(logPath, 'utf-8');
                    const lines = logContent.split('\n').filter(l => l.trim() !== '');
                    const replacements: {input: string, phrase: string}[] = [];
                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.input && parsed.phrase !== undefined) {
                                replacements.push(parsed);
                            }
                        } catch(e) {}
                    }

                    if (replacements.length === 0) {
                        vscode.window.showInformationMessage(`No replacements found in log.`);
                        return;
                    }

                    const shwvtPath = DirHelper.getShwvtPath(rootPath);
                    if (!fs.existsSync(shwvtPath)) {
                        vscode.window.showErrorMessage(`Target file not found: ${shwvtPath}`);
                        return;
                    }

                    const uri = vscode.Uri.file(shwvtPath);
                    const document = await vscode.workspace.openTextDocument(uri);
                    const fullText = document.getText();
                    
                    let modifiedText = fullText;
                    for (const {input, phrase} of replacements) {
                        const escapedText = input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const regex = new RegExp(escapedText, "g");
                        modifiedText = modifiedText.replace(regex, phrase);
                    }
                    
                    if (modifiedText !== fullText) {
                        const fullRange = new vscode.Range(
                            document.positionAt(0),
                            document.positionAt(fullText.length)
                        );
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(uri, fullRange, modifiedText);
                        await vscode.workspace.applyEdit(edit);
                        vscode.window.showInformationMessage(`Applied ${replacements.length} rules to Target.shwvt.`);
                        
                        // Show the document to the user so they can save it
                        await vscode.window.showTextDocument(document);
                    } else {
                        vscode.window.showInformationMessage(`No matches found to replace.`);
                    }
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to apply auto replace: ${e}`);
                }
                break;
            default:
                break;
        }
    }
}
