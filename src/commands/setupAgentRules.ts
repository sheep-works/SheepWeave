import * as vscode from 'vscode';
import { setupAgentRules } from '../services/agentRules';

/**
 * AIエージェント用のルール設定ファイル（SHEEPWEAVE_RULES.md, .cursorrules等）をプロジェクトルートに配置するコマンド
 */
export async function setupAgentRulesCommand() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('SheepWeave: No workspace folder open.');
        return;
    }

    const root = workspaceFolders[0].uri.fsPath;

    // 上書き確認（既存ファイルがある場合）
    const selection = await vscode.window.showQuickPick(
        [
            { label: '安全に配置（既存ファイルをスキップ）', value: false },
            { label: '強制上書き（最新テンプレートで上書き）', value: true }
        ],
        { placeHolder: 'AIエージェント設定ファイルの配置方法を選択してください' }
    );

    if (!selection) {
        return;
    }

    try {
        const { created, skipped } = setupAgentRules(root, selection.value);
        let msg = `SheepWeave: AIエージェント用設定を配置しました (作成: ${created.length}件`;
        if (skipped.length > 0) {
            msg += `, スキップ: ${skipped.length}件`;
        }
        msg += `)`;
        vscode.window.showInformationMessage(msg);
    } catch (error) {
        vscode.window.showErrorMessage(`SheepWeave: エージェント用設定の配置に失敗しました: ${error}`);
    }
}
