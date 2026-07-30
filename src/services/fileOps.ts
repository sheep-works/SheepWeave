import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ShWvData } from './core/ShWvData';
import { DirHelper } from './core/DirHelper';
import { globalShWvData } from '../store';
import { groupFilesByFilter, resolveTikalPath, runTikal } from './tikal';
import { ProjectManager, ProjectFileStatus } from './core/ProjectManager';
import { SheepShuttle } from '../management';

// Helper to ensure directory exists
function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

// Helper to check if file exists
function exists(p: string): boolean { return fs.existsSync(p); }

// Helper to convert date to string for directory name
function getDateString(): string {
    const now = new Date();
    return now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
}

// ----------------------------------------------------------------------------
// initDirs
// ----------------------------------------------------------------------------
export async function initDirs(root: string) {
    createDir(root);
    await archiveWorking(root);
}

function createDir(root: string) {
    const dirs = ['Archive', 'Data', 'Data/Ref', 'Data/Ref/TM', 'Data/Ref/TB', 'Working'];
    dirs.forEach(d => ensureDir(path.join(root, d)));
}

export async function archiveWorking(root: string) {
    const working = path.join(root, 'Working');
    const archive = path.join(root, 'Archive');

    // Check if Working is not empty
    if (!exists(working) || fs.readdirSync(working).length === 0) {
        return;
    }

    const dateStr = getDateString();
    let archiveDirName = dateStr;
    let counter = 1;

    // Check for existing directory and create branch number if needed
    while (exists(path.join(archive, archiveDirName))) {
        archiveDirName = `${dateStr}_${counter}`;
        counter++;
    }

    const targetArchiveDir = path.join(archive, archiveDirName);
    ensureDir(targetArchiveDir);

    // Recursive move
    moveRecursive(working, targetArchiveDir);

    // Also move project.json to archive
    const projectJson = path.join(root, 'project.json');
    if (exists(projectJson)) {
        fs.renameSync(projectJson, path.join(targetArchiveDir, 'project.json'));
    }

    // Ensure Working is empty (moveRecursive should have moved everything)
    // Verify?
}


function moveRecursive(src: string, dest: string) {
    if (!exists(src)) return;
    ensureDir(dest);

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            moveRecursive(srcPath, destPath);
            fs.rmdirSync(srcPath); // remove empty dir after move
        } else {
            fs.renameSync(srcPath, destPath);
        }
    }
}


// ----------------------------------------------------------------------------
// prepareWorking
// ----------------------------------------------------------------------------
export async function prepareWorking(root: string) {
    createWorking(root);
    copyDataToWorking(root);
}

function createWorking(root: string) {
    const working = path.join(root, 'Working');
    const dirs = [
        '01_REF',
        '01_REF/TM',
        '01_REF/TB',
        '02_SOURCE',
        '03_XLF_JSON',
        '04_SHWV',
        '05_COMPLETED',
        '06_PACKAGE'
    ];
    dirs.forEach(d => ensureDir(path.join(working, d)));

    const phrasePath = path.join(working, '01_REF', 'phrase.json');
    if (!exists(phrasePath)) {
        fs.writeFileSync(phrasePath, '[\n  {\n    "input": "@",\n    "phrase": "{@x}"\n  }\n]', 'utf-8');
    }
}

export async function copyDataToWorking(root: string) {
    // 0. Pre-process Data/Ref legacy JSONs to Data/Ref/TM and Data/Ref/TB
    const dataRef = path.join(root, 'Data', 'Ref');
    if (exists(dataRef)) {
        const jsonFiles = fs.readdirSync(dataRef).filter(f => f.toLowerCase().endsWith('.json'));
        for (const file of jsonFiles) {
            const jsonPath = path.join(dataRef, file);
            try {
                const content = fs.readFileSync(jsonPath, 'utf-8');
                const data = JSON.parse(content);
                // Basic structure check for ShWvData
                if (data && data.meta && data.body && Array.isArray(data.body.units)) {
                    const dataRefTm = path.join(dataRef, 'TM');
                    const dataRefTb = path.join(dataRef, 'TB');
                    ensureDir(dataRefTm);
                    ensureDir(dataRefTb);
                    
                    const basename = path.basename(file, '.json');
                    const tbPath = path.join(dataRefTb, `${basename}-tb.json`);
                    
                    SheepShuttle.exportAsTb(data, tbPath);
                    SheepShuttle.exportAsTmSplit(data, dataRefTm, basename);
                    vscode.window.showInformationMessage(`Extracted TM/TB from legacy reference: ${file}`);
                    
                    // Remove the original JSON file to prevent overhead
                    fs.unlinkSync(jsonPath);
                }
            } catch (e) {
                // Not a valid JSON or not ShWvData, just skip
            }
        }
    }

    // 1. Copy Data/Ref/TM -> Working/01_REF/TM
    const dataRefTm = path.join(root, 'Data', 'Ref', 'TM');
    const workingRefTm = path.join(root, 'Working', '01_REF', 'TM');
    if (exists(dataRefTm)) {
        copyRecursive(dataRefTm, workingRefTm);
    }

    // 2. Copy Data/Ref/TB -> Working/01_REF/TB
    const dataRefTb = path.join(root, 'Data', 'Ref', 'TB');
    const workingRefTb = path.join(root, 'Working', '01_REF', 'TB');
    if (exists(dataRefTb)) {
        copyRecursive(dataRefTb, workingRefTb);
    }

    // 3. Copy Data (excluding Ref) -> Working/02_SOURCE
    const data = path.join(root, 'Data');
    const workingSource = path.join(root, 'Working', '02_SOURCE');

    if (exists(data)) {
        ensureDir(workingSource);
        const entries = fs.readdirSync(data, { withFileTypes: true });
        for (const entry of entries) {
            // Explicitly exclude 'Ref' directory
            if (entry.isDirectory() && entry.name.toLowerCase() === 'ref') {
                continue;
            }
            const srcPath = path.join(data, entry.name);
            const destPath = path.join(workingSource, entry.name);

            if (entry.isDirectory()) {
                copyRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

/**
 * Synchronizes reference files from Data/Ref to Working/01_REF.
 * Specifically handles TM and TB subdirectories separately.
 */
export async function syncRefDir(root: string) {
    const dataRefTm = path.join(root, 'Data', 'Ref', 'TM');
    const workingRefTm = path.join(root, 'Working', '01_REF', 'TM');
    if (fs.existsSync(dataRefTm)) {
        ensureDir(workingRefTm);
        copyRecursive(dataRefTm, workingRefTm);
    }

    const dataRefTb = path.join(root, 'Data', 'Ref', 'TB');
    const workingRefTb = path.join(root, 'Working', '01_REF', 'TB');
    if (fs.existsSync(dataRefTb)) {
        ensureDir(workingRefTb);
        copyRecursive(dataRefTb, workingRefTb);
    }
}

function copyRecursive(src: string, dest: string) {
    if (!exists(src)) return;
    ensureDir(dest);

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}


// ----------------------------------------------------------------------------
// preprocessor
// ----------------------------------------------------------------------------
export async function preprocessor(root: string): Promise<ShWvData | undefined> {
    const data = globalShWvData;
    data.clear();
    const xlfFiles = await setXlf(root);
    if (xlfFiles.length > 0) {
        data.meta.bilingualPath = xlfFiles.join(';');
        await data.parse(xlfFiles);
        await data.analyze(root);
        data.save(root); // save to JSON
        await data.writeShwv(root); // save to .shwvs and .shwvt
        return data;
    }
    return undefined;
}

async function setXlf(root: string): Promise<string[]> {
    const projectManager = new ProjectManager(root);
    return projectManager.getExtractedXliffs();
}

function getSegmentationOption(root: string): string {
    const workflowPath = path.join(root, 'workflow.ini');
    if (fs.existsSync(workflowPath)) {
        try {
            const iniContent = fs.readFileSync(workflowPath, 'utf-8');
            for (const line of iniContent.split('\n')) {
                const match = line.match(/^\s*segmentation\s*=\s*(.*)\s*$/);
                if (match) return match[1].trim().toLowerCase();
            }
        } catch (e) {
            // ignore
        }
    }
    return 'line';
}

export async function runTikalExtraction(root: string, sourceLang: string, targetLang: string) {
    const sourceDir = path.join(root, 'Working', '02_SOURCE');
    const xlfDir = path.join(root, 'Working', '03_XLF_JSON');
    ensureDir(xlfDir);

    const projectManager = new ProjectManager(root);

    const groups = groupFilesByFilter(sourceDir);
    let tikalPath: string | undefined;

    for (const [filter, files] of Object.entries(groups)) {
        const fileStatuses = files.map(f => ({ source: f, xliff: null as string | null, status: 'error' as ProjectFileStatus['status'] }));
        projectManager.addGroup(filter, fileStatuses);

        for (const file of files) {
            try {
                const ext = path.extname(file).toLowerCase();
                // Check if the file is already an XLIFF derivative
                // .xlf, .xliff, .mxliff, .mqxliff, .sdlxliff は Tikal を通さず直接処理する
                const isXliff = ['.xlf', '.xliff', '.mxliff', '.mqxliff', '.sdlxliff'].includes(ext);

                if (isXliff) {
                    // Direct copy for standard XLIFF-like files, skipping Okapi extraction
                    const xlfBasename = path.basename(file);
                    const destXlf = path.join(xlfDir, xlfBasename);

                    if (exists(destXlf)) fs.unlinkSync(destXlf);
                    fs.copyFileSync(file, destXlf);

                    const fileStatus = projectManager.data.okapi.find(g => g.filter === filter)?.files.find(f => f.source === file);
                    if (fileStatus) {
                        fileStatus.status = 'extracted';
                        fileStatus.xliff = destXlf;
                    }
                } else {
                    if (!tikalPath) {
                        tikalPath = resolveTikalPath();
                    }
                    const segOption = getSegmentationOption(root);
                    await runTikal(tikalPath, filter, file, 'extract', sourceLang, targetLang, segOption);

                    // Tikal outputs file.ext.xlf in the same directory (02_SOURCE)
                    const generatedXlf = file + '.xlf';

                    if (exists(generatedXlf)) {
                        const xlfBasename = path.basename(generatedXlf);
                        const destXlf = path.join(xlfDir, xlfBasename);
                        if (exists(destXlf)) fs.unlinkSync(destXlf); // Overwrite if exists in 03_XLF_JSON
                        fs.renameSync(generatedXlf, destXlf);

                        const fileStatus = projectManager.data.okapi.find(g => g.filter === filter)?.files.find(f => f.source === file);
                        if (fileStatus) {
                            fileStatus.status = 'extracted';
                            fileStatus.xliff = destXlf;
                        }
                    } else {
                        console.error(`XLF not found after extraction: ${generatedXlf}`);
                    }
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to extract file ${path.basename(file)}: ${error.message || error}`);
                console.error(`Failed to extract file ${file} with filter ${filter}:`, error);
            }
            // Save project.json incrementally after each file to ensure persistence
            projectManager.save();
        }
    }

    projectManager.save();
}

// ----------------------------------------------------------------------------
// postprocessor
// ----------------------------------------------------------------------------
export async function postprocessor(root: string) {
    const data = globalShWvData;
    const storagePath = DirHelper.getStoragePath(root);
    const shwvtPath = DirHelper.getShwvtPath(root);

    if (exists(storagePath)) {
        const content = fs.readFileSync(storagePath, 'utf-8');
        const parsed = JSON.parse(content);
        data.meta = parsed.meta;
        data.body = parsed.body;

        if (exists(shwvtPath)) {
            data.update(shwvtPath);
        }

        const completedDir = path.join(root, 'Working', '05_COMPLETED');
        ensureDir(completedDir);

        // Copy project.json for persistence in Completed
        if (exists(storagePath)) {
            fs.copyFileSync(storagePath, path.join(completedDir, 'project.json'));
        }

        // Copy all JSON ShWvData files for persistence in Completed
        const xlfJsonDir = path.join(root, 'Working', '03_XLF_JSON');
        if (fs.existsSync(xlfJsonDir)) {
            const jsonFiles = fs.readdirSync(xlfJsonDir).filter(f => f.toLowerCase().endsWith('.json'));
            for (const f of jsonFiles) {
                fs.copyFileSync(path.join(xlfJsonDir, f), path.join(completedDir, f));
            }
        }

        for (const fileInfo of data.meta.files) {
            const originalName = fileInfo.name;
            const ext = path.extname(originalName);
            const baseName = path.basename(originalName, ext);

            const originalXlfPath = path.join(root, 'Working', '03_XLF_JSON', originalName);
            const completedXlfPath = path.join(completedDir, baseName + '-done' + ext);

            const slicedUnits = data.body.units.slice(fileInfo.start, fileInfo.end + 1);
            await data.saveXlf(completedXlfPath, originalXlfPath, slicedUnits);
        }
    }
}
// ----------------------------------------------------------------------------
// runPackage (Merge)
// ----------------------------------------------------------------------------
export async function runPackage(root: string) {
    const sourceDir = path.join(root, 'Working', '02_SOURCE');
    const completedDir = path.join(root, 'Working', '05_COMPLETED');
    const packageDir = path.join(root, 'Working', '06_PACKAGE');
    ensureDir(packageDir);

    const projectManager = new ProjectManager(root);
    const sourceLang = projectManager.data.sourceLanguage;
    const targetLang = projectManager.data.targetLanguage;
    let tikalPath: string | undefined;

    for (const group of projectManager.data.okapi) {
        const filesToMerge: string[] = [];
        const xlfFilesToCleanup: string[] = [];

        for (const file of group.files) {
            if (file.status === 'extracted' || file.status === 'translated' || file.status === 'merged') {
                if (file.xliff) {
                    const originalName = path.basename(file.xliff);
                    const ext = path.extname(originalName);
                    const baseName = path.basename(originalName, ext);
                    const completedXlfPath = path.join(completedDir, baseName + '-done' + ext);

                    if (exists(completedXlfPath)) {
                        const originalExt = path.extname(file.source).toLowerCase();
                        const isXliff = ['.xlf', '.xliff', '.mxliff', '.mqxliff', '.sdlxliff'].includes(originalExt);

                        if (isXliff) {
                            // Direct copy for standard XLIFF-like files, skipping Okapi merge
                            const finalDest = path.join(packageDir, path.basename(file.source));
                            if (exists(finalDest)) fs.unlinkSync(finalDest);
                            fs.copyFileSync(completedXlfPath, finalDest);
                            file.status = 'merged';
                        } else {
                            // Determine the expected xlf name in 02_SOURCE (Tikal expects it beside the source)
                            const expectedXlf = file.source + '.xlf';
                            fs.copyFileSync(completedXlfPath, expectedXlf);
                            
                            file.status = 'translated';
                            filesToMerge.push(file.source);
                            xlfFilesToCleanup.push(expectedXlf);
                        }
                    }
                }
            }
        }

        if (filesToMerge.length > 0) {
            try {
                if (filesToMerge.length > 0 && !tikalPath) {
                    tikalPath = resolveTikalPath();
                }
                for (const srcFile of filesToMerge) {
                    // srcFile is the absolute path to the native file in 02_SOURCE
                    // Tikal -m expects the source file path and will look for sourcefile.xlf
                    // @ts-ignore
                    await runTikal(tikalPath, group.filter, srcFile + '.xlf', 'merge', sourceLang, targetLang);
                }

                // Find the merged files and move them to 06_PACKAGE
                for (const srcFile of filesToMerge) {
                    const parsed = path.parse(srcFile);
                    // Tikal -m typically generates filename.targetLang.ext or similar.
                    const expectedOut1 = path.join(parsed.dir, `${parsed.name}.${targetLang}${parsed.ext}`);
                    const expectedOut2 = path.join(parsed.dir, `${parsed.name}.out${parsed.ext}`);
                    
                    let mergedFile = null;
                    if (exists(expectedOut1)) mergedFile = expectedOut1;
                    else if (exists(expectedOut2)) mergedFile = expectedOut2;
                    else {
                        // try to find by extension
                        const dirFiles = fs.readdirSync(parsed.dir);
                        for (const df of dirFiles) {
                            if (df !== parsed.base && df.includes(parsed.name) && df.endsWith(parsed.ext) && df !== parsed.base + '.xlf') {
                                mergedFile = path.join(parsed.dir, df);
                                break;
                            }
                        }
                    }

                    if (mergedFile) {
                        const finalDest = path.join(packageDir, path.basename(mergedFile));
                        if (exists(finalDest)) fs.unlinkSync(finalDest); // prevent renaming error if exists
                        fs.renameSync(mergedFile, finalDest);
                        const fileStatus = projectManager.data.okapi.find((g: any) => g.filter === group.filter)?.files.find((f: any) => f.source === srcFile);
                        if (fileStatus) fileStatus.status = 'merged';
                    }
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to merge files for filter ${group.filter}: ${error.message || error}`);
                console.error(`Failed to merge filter ${group.filter}`, error);
            }
        }
        
        // Cleanup expectedXlf side-by-side file
        for (const f of xlfFilesToCleanup) {
            if (exists(f)) fs.unlinkSync(f);
        }
    }
    projectManager.save();
}

export async function saveAndCloseShwvEditors(root: string): Promise<void> {
    const shwvsPath = DirHelper.getShwvsPath(root);
    const shwvtPath = DirHelper.getShwvtPath(root);

    // Save dirty files
    for (const doc of vscode.workspace.textDocuments) {
        if (doc.isDirty && (doc.uri.fsPath === shwvsPath || doc.uri.fsPath === shwvtPath)) {
            await doc.save();
        }
    }

    // Close corresponding editors
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (tab.input instanceof vscode.TabInputText) {
                const filePath = tab.input.uri.fsPath;
                if (filePath === shwvsPath || filePath === shwvtPath) {
                    await vscode.window.tabGroups.close(tab);
                }
            }
        }
    }
}

export async function incrementalAddSource(root: string): Promise<ShWvData | undefined> {
    const data = globalShWvData;
    // Ensure existing data is loaded
    if (!data.meta || !data.body || data.body.units.length === 0) {
        data.load(root);
    }

    const sourceDir = path.join(root, 'Working', '02_SOURCE');
    const xlfDir = path.join(root, 'Working', '03_XLF_JSON');
    ensureDir(xlfDir);

    const projectManager = new ProjectManager(root);

    // Get all files currently in Working/02_SOURCE
    const groups = groupFilesByFilter(sourceDir);

    // Identify registered files
    const registeredFiles = new Set<string>();
    for (const group of projectManager.data.okapi) {
        for (const f of group.files) {
            registeredFiles.add(f.source);
        }
    }

    // Filter to find new files
    const newFilesGroups: Record<string, string[]> = {};
    let hasNewFiles = false;
    for (const [filter, files] of Object.entries(groups)) {
        const newFiles = files.filter(f => !registeredFiles.has(f));
        if (newFiles.length > 0) {
            newFilesGroups[filter] = newFiles;
            hasNewFiles = true;
        }
    }

    if (!hasNewFiles) {
        vscode.window.showInformationMessage('No new source files found in Working/02_SOURCE.');
        return undefined;
    }

    let tikalPath: string | undefined;
    const newXlfFiles: string[] = [];

    for (const [filter, files] of Object.entries(newFilesGroups)) {
        const fileStatuses = files.map(f => ({ source: f, xliff: null as string | null, status: 'error' as ProjectFileStatus['status'] }));
        projectManager.addGroup(filter, fileStatuses);

        for (const file of files) {
            try {
                const ext = path.extname(file).toLowerCase();
                const isXliff = ['.xlf', '.xliff', '.mxliff', '.mqxliff', '.sdlxliff'].includes(ext);

                if (isXliff) {
                    const xlfBasename = path.basename(file);
                    const destXlf = path.join(xlfDir, xlfBasename);
                    if (exists(destXlf)) fs.unlinkSync(destXlf);
                    fs.copyFileSync(file, destXlf);

                    const fileStatus = projectManager.data.okapi.find(g => g.filter === filter)?.files.find(f => f.source === file);
                    if (fileStatus) {
                        fileStatus.status = 'extracted';
                        fileStatus.xliff = destXlf;
                    }
                    newXlfFiles.push(destXlf);
                } else {
                    if (!tikalPath) {
                        tikalPath = resolveTikalPath();
                    }
                    // @ts-ignore
                    await runTikal(tikalPath, filter, file, 'extract', projectManager.data.sourceLanguage, projectManager.data.targetLanguage);
                    
                    const generatedXlf = file + '.xlf';
                    if (exists(generatedXlf)) {
                        const destXlf = path.join(xlfDir, path.basename(generatedXlf));
                        if (exists(destXlf)) fs.unlinkSync(destXlf);
                        fs.renameSync(generatedXlf, destXlf);
                        
                        const fileStatus = projectManager.data.okapi.find(g => g.filter === filter)?.files.find(f => f.source === file);
                        if (fileStatus) {
                            fileStatus.status = 'extracted';
                            fileStatus.xliff = destXlf;
                        }
                        newXlfFiles.push(destXlf);
                    }
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`Extraction failed for ${path.basename(file)}: ${err.message}`);
            }
        }
    }

    projectManager.save();

    if (newXlfFiles.length > 0) {
        // Update ShWvData projectInfo if present
        data.projectInfo = projectManager.data;
        
        // Append new units/metadata
        await data.parse(newXlfFiles);
        // Analyze project with TM/TB (matches for new units will be populated, old units preserved)
        await data.analyze(root);
        // Save project json
        data.save(root);
        // Write .shwvs and .shwvt
        await data.writeShwv(root);

        vscode.window.showInformationMessage(`Successfully added ${newXlfFiles.length} file(s) to project.`);
        return data;
    }

    return undefined;
}
