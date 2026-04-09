import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShWvData } from '../services/core/ShWvData';
import { SheepShuttle } from '../management';

export class AdminHandler {
    public static async handle(message: any, globalShWvData: ShWvData, rootPath: string, panel: vscode.WebviewPanel) {
        /**
         * Webviewから送られてきた 'shuttle-' で始まるメッセージを処理する。
         * @param message Webviewからのデータ（typeやpayloadが含まれる）
         * @param data 現在の翻訳データ本体
         * @param rootPath プロジェクトのルートパス
         * @param panel メッセージを返すためのWebviewパネル
         */
        switch (message.type) {
            // メッセージの種類（type）によって処理を分岐させる
            case 'shuttle-export-json':
                // SheepShuttleサービスを使い、外部からプロジェクトデータを取り込む
                try {
                    const jsonPath = path.join(rootPath, 'export.json');
                    SheepShuttle.exportToJson(globalShWvData, jsonPath);
                    vscode.window.showInformationMessage(`Exported to ${jsonPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to export JSON: ${e}`);
                }
                break;
            case 'shuttle-export-csv':
                try {
                    const csvPath = path.join(rootPath, 'export.csv');
                    SheepShuttle.exportToCsv(globalShWvData, csvPath);
                    vscode.window.showInformationMessage(`Exported to ${csvPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to export CSV: ${e}`);
                }
                break;
            case 'shuttle-split-file':
                try {
                    const outDirFile = path.join(rootPath, 'splits_by_file');
                    SheepShuttle.splitByFile(globalShWvData, outDirFile);
                    vscode.window.showInformationMessage(`Files split in ${outDirFile}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to split by file: ${e}`);
                }
                break;
            case 'shuttle-split-length':
                try {
                    const payload = message.payload || {};
                    const maxLength = payload.maxLength || 1000;
                    const outDirLength = path.join(rootPath, 'splits_by_length');
                    SheepShuttle.splitByLength(globalShWvData, maxLength, outDirLength);
                    vscode.window.showInformationMessage(`Files split by length in ${outDirLength}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to split by length: ${e}`);
                }
                break;
            case 'shuttle-export-jsonl':
                try {
                    const jsonlPath = path.join(rootPath, 'export.jsonl');
                    SheepShuttle.exportToJsonl(globalShWvData, jsonlPath);
                    vscode.window.showInformationMessage(`Exported JSONL to ${jsonlPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to export JSONL: ${e}`);
                }
                break;
            case 'shuttle-chunk-jsonl':
                try {
                    const payload = message.payload || {};
                    const maxChars = payload.maxTokens || 4000;
                    const jsonlContent = SheepShuttle.chunkJsonl(globalShWvData, maxChars);
                    const outputPath = path.join(rootPath, 'export_chunked.jsonl');

                    fs.writeFileSync(outputPath, jsonlContent, 'utf-8');
                    vscode.window.showInformationMessage(`Exported chunked JSONL to ${outputPath}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to chunk JSONL: ${e}`);
                }
                break;
            case 'shuttle-import-jsonl':
                try {
                    const jsonlPath = path.join(rootPath, 'export_chunked.jsonl');
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
            default:
                break;
        }
    }
}
