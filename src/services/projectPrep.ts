/**
 * プロジェクト準備のビジネスロジック。
 * アーカイブ、コピー、初期統計情報の生成、project.jsonの更新を一連の流れとして実行します。
 */
import { archiveWorking, copyDataToWorking } from './fileOps';
import { writeProjectJson } from './storage';

export async function prepareProject(root: string) {
    // 1. Archive existing working directory
    await archiveWorking(root);

    // 2. Copy fresh data to working directory
    await copyDataToWorking(root);

    // 3. Generate statistics (Mock for now, or simple file counting)
    // In real implementation, we would parse files in `working/`
    const stats = {
        segments: 0,
        untranslated: 0,
        qaWarnings: 0,
        termsMatched: 0
    };

    // 4. Update project.json
    await writeProjectJson(root, {
        lastPreparedAt: new Date().toISOString(),
        stats
    });
}
