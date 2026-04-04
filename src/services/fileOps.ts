
import * as fs from 'fs';
import * as path from 'path';
import { ShWvData } from './core/ShWvData';
import { DirHelper } from './core/DirHelper';
import { globalShWvData } from '../store';

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
    const xlfFile = await setXlf(root);
    if (xlfFile) {
        data.meta.bilingualPath = xlfFile;
        await data.parse(xlfFile);
        await data.analyze(root);
        data.save(root); // save to JSON
        await data.writeShwv(root); // save to .shwvs and .shwvt
        return data;
    }
    return undefined;
}

async function setXlf(root: string): Promise<string | null> {
    const sourceDir = path.join(root, 'Working', '02_SOURCE');
    const xlfDir = path.join(root, 'Working', '03_XLF_JSON');

    // Check for xlf, xliff, mxliff files in 02_SOURCE
    const extensions = ['.xlf', '.xliff', '.mxliff'];
    let foundFile: string | null = null;

    if (exists(sourceDir)) {
        const files = fs.readdirSync(sourceDir);
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (extensions.includes(ext)) {
                const targetPath = path.join(xlfDir, file);
                fs.copyFileSync(path.join(sourceDir, file), targetPath);
                foundFile = targetPath;
                break; // Just taking the first bilingual file found
            }
        }
    }

    if (!foundFile) {
        await callTikal(root);
        // Tikal would theoretically place a file here, but since it's dummy:
    }

    return foundFile;
}

async function callTikal(root: string) {
    // Dummy implementation as per instruction
    console.log('Tikal called (Dummy implementation)');
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

        const originalName = path.basename(data.meta.bilingualPath);
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        const completedPath = path.join(completedDir, baseName + '-done' + ext);

        await data.saveXlf(completedPath);
    }
}

