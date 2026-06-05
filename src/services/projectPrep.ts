import { archiveWorking, copyDataToWorking } from './fileOps';
import { ProjectManager } from './core/ProjectManager';

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

    // 4. Update project.json using ProjectManager
    const projectManager = new ProjectManager(root);
    projectManager.data.lastPreparedAt = new Date().toISOString();
    projectManager.data.stats = stats;
    projectManager.save();
}
