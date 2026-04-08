/**
 * プロジェクト準備コマンドの実装。
 * 作業ディレクトリの作成、データのコピー、アーカイブ処理を呼び出します。
 */
import * as vscode from 'vscode';
import { prepareProject } from '../services/projectPrep';

export async function prepareProjectCommand() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('SheepWeave: No workspace folder open.');
        return;
    }

    // 一番上のフォルダパスを取得
    const root = workspaceFolders[0].uri.fsPath; // Single root for MVP

    // 進行状況（プログレスバー）を右下に表示
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "SheepWeave: Preparing Project...",
        cancellable: false
    }, async (progress) => {
        try {
            // 実際のフォルダ作成などの重い処理は services/projectPrep.ts に任せる
            await prepareProject(root);
            vscode.window.showInformationMessage('SheepWeave: Project prepared successfully!');
        } catch (error) {
            // 失敗した場合はエラーを表示
            vscode.window.showErrorMessage(`SheepWeave: Failed to prepare project. ${error}`);
            console.error(error);
        }
    });
}
