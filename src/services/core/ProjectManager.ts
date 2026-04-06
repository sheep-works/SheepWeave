import * as fs from 'fs';
import * as path from 'path';

export interface ProjectFileStatus {
    source: string;
    xliff: string | null;
    status: 'extracted' | 'translated' | 'merged' | 'error';
    errorMsg?: string;
}

export interface ProjectGroup {
    filter: string;
    files: ProjectFileStatus[];
}

export interface ProjectData {
    version: number;
    projectName: string;
    sourceLanguage: string;
    targetLanguage: string;
    sourceFiles: string[];
    okapi: ProjectGroup[];
}

export class ProjectManager {
    private readonly projectPath: string;
    public data: ProjectData;

    constructor(rootPath: string) {
        this.projectPath = path.join(rootPath, 'project.json');
        this.data = this.loadOrDefault();
    }

    private loadOrDefault(): ProjectData {
        if (fs.existsSync(this.projectPath)) {
            try {
                const content = fs.readFileSync(this.projectPath, 'utf-8');
                return JSON.parse(content) as ProjectData;
            } catch (error) {
                console.error("Failed to parse project.json", error);
            }
        }
        
        // Defaults if missing or invalid
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
        fs.writeFileSync(this.projectPath, JSON.stringify(this.data, null, 2), 'utf-8');
    }
}
