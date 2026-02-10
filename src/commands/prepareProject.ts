/**
 * プロジェクト準備コマンドの実装。
 * 作業ディレクトリの作成、データのコピー、アーカイブ処理を呼び出します。
 */
import * as vscode from 'vscode';
import { prepareProject } from '../services/projectPrep';

export async function prepareProjectCommand() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('LambLingo: No workspace folder open.');
        return;
    }

    const root = workspaceFolders[0].uri.fsPath; // Single root for MVP

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "LambLingo: Preparing Project...",
        cancellable: false
    }, async (progress) => {
        try {
            await prepareProject(root);
            vscode.window.showInformationMessage('LambLingo: Project prepared successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`LambLingo: Failed to prepare project. ${error}`);
            console.error(error);
        }
    });
}
