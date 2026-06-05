import * as fs from 'fs';
import * as path from 'path';
import type { ProjectInfo, ProjectFileStatus } from '../../types/datatype';

export type { ProjectFileStatus };

export class ProjectManager {
    private readonly projectPath: string;
    public data: ProjectInfo;

    constructor(rootPath: string) {
        this.projectPath = path.join(rootPath, 'project.json');
        this.data = this.loadOrDefault();
    }

    private loadOrDefault(): ProjectInfo {
        if (fs.existsSync(this.projectPath)) {
            try {
                const content = fs.readFileSync(this.projectPath, 'utf-8');
                const parsed = JSON.parse(content);
                // Check if it is a unified ShWvData structure
                if (parsed && parsed.define && parsed.define.name === 'SHWV_DATA') {
                    if (parsed.define.version === '1.1' || parsed.projectInfo) {
                        return parsed.projectInfo || this.getDefaults();
                    }
                }
                // Check if it is the old legacy project.json structure
                if (parsed && parsed.projectName) {
                    return parsed as ProjectInfo;
                }
            } catch (error) {
                console.error("Failed to parse project.json", error);
            }
        }
        
        return this.getDefaults();
    }

    private getDefaults(): ProjectInfo {
        return {
            version: 2,
            projectName: 'SheepWeaveProject',
            sourceLanguage: 'en-US',
            targetLanguage: 'ja-JP',
            sourceFiles: [],
            okapi: []
        };
    }

    public initialize(projectName: string, sourceLang: string, targetLang: string, sourceFiles: string[]) {
        this.data.projectName = projectName;
        this.data.sourceLanguage = sourceLang;
        this.data.targetLanguage = targetLang;
        this.data.sourceFiles = sourceFiles;
        this.data.okapi = [];
    }

    public addGroup(filter: string, files: { source: string, xliff: string | null, status: ProjectFileStatus['status'] }[]) {
        const existingGroup = this.data.okapi.find(g => g.filter === filter);
        if (existingGroup) {
            existingGroup.files.push(...files);
        } else {
            this.data.okapi.push({ filter, files });
        }
    }

    public updateFileStatus(sourceFileBase: string, status: ProjectFileStatus['status'], errorMsg?: string) {
        for (const group of this.data.okapi) {
            const fileStatus = group.files.find(f => path.basename(f.source) === sourceFileBase);
            if (fileStatus) {
                fileStatus.status = status;
                if (errorMsg) {
                    fileStatus.errorMsg = errorMsg;
                }
                return;
            }
        }
    }

    public getExtractedXliffs(): string[] {
        const xliffs: string[] = [];
        for (const group of this.data.okapi) {
            for (const file of group.files) {
                if (file.status === 'extracted' || file.status === 'translated') {
                    if (file.xliff) xliffs.push(file.xliff);
                }
            }
        }
        return xliffs;
    }

    public save() {
        let shwv: any = {
            define: {
                name: 'SHWV_DATA',
                version: '1.1'
            },
            meta: {
                bilingualPath: '',
                files: [],
                sourceLang: this.data.sourceLanguage.split('-')[0].toLowerCase(),
                targetLang: this.data.targetLanguage.split('-')[0].toLowerCase(),
                tmFiles: [],
                tbFiles: []
            },
            body: {
                units: [],
                terms: []
            }
        };

        if (fs.existsSync(this.projectPath)) {
            try {
                const content = fs.readFileSync(this.projectPath, 'utf-8');
                const parsed = JSON.parse(content);
                if (parsed && parsed.define && parsed.define.name === 'SHWV_DATA') {
                    shwv = parsed;
                }
            } catch (e) {
                // ignore
            }
        }

        shwv.projectInfo = this.data;
        fs.writeFileSync(this.projectPath, JSON.stringify(shwv, null, 2), 'utf-8');
    }
}
