import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ShWvData } from './core/ShWvData';
import { DirHelper } from './core/DirHelper';
import { globalShWvData } from '../store';
import { groupFilesByFilter, resolveTikalPath, runTikal } from './tikal';
import { ProjectManager, ProjectFileStatus } from './core/ProjectManager';
import { SheepShuttle } from 'sheepshuttle';

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
}

export async function copyDataToWorking(root: string) {
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

    // 4. Special Handle: Check Data/Ref for legacy project JSONs and split them
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
                    const basename = path.basename(file, '.json');
                    const tmPath = path.join(root, 'Working', '01_REF', 'TM', `${basename}-tm.json`);
                    const tbPath = path.join(root, 'Working', '01_REF', 'TB', `${basename}-tb.json`);
                    
                    SheepShuttle.exportAsTmTb(data, tmPath, tbPath);
                    vscode.window.showInformationMessage(`Extracted TM/TB from legacy reference: ${file}`);
                }
            } catch (e) {
                // Not a valid JSON or not ShWvData, just skip
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

export async function runTikalExtraction(root: string, sourceLang: string, targetLang: string) {
    const sourceDir = path.join(root, 'Working', '02_SOURCE');
    const xlfDir = path.join(root, 'Working', '03_XLF_JSON');
    ensureDir(xlfDir);

    const tikalPath = resolveTikalPath();
    const projectManager = new ProjectManager(root);

    const groups = groupFilesByFilter(sourceDir);

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
                    await runTikal(tikalPath, filter, file, 'extract', sourceLang, targetLang);

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

    const tikalPath = resolveTikalPath();
    const projectManager = new ProjectManager(root);
    const sourceLang = projectManager.data.sourceLanguage;
    const targetLang = projectManager.data.targetLanguage;

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
                for (const srcFile of filesToMerge) {
                    // srcFile is the absolute path to the native file in 02_SOURCE
                    // Tikal -m expects the source file path and will look for sourcefile.xlf
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
