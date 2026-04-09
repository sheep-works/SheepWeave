import { readFileSync } from 'fs';
import * as path from 'path';
import type { ShWvFileInfo, TranslationPair } from '../../types/datatype';

import { xlf2Pairs } from './XlfParser';
import { tmx2Pairs } from './TmxParser';
import { tbx2Pairs } from './TbxParser';
import { csv2Pairs, xlsx2Pairs } from './SpreadsheetParser';
import { jsonl2Pairs } from './JsonlParser';

export async function parseTranslationFiles(filepaths: string[]): Promise<{ fileinfo: ShWvFileInfo[], units: TranslationPair[] }> {
    const fileinfo: ShWvFileInfo[] = [];
    const allUnits: TranslationPair[] = [];
    let globalIdx = 0;

    for (const filepath of filepaths) {
        const ext = path.extname(filepath).toLowerCase();
        const start = globalIdx;
        let units: TranslationPair[] = [];

        try {
            if (ext === '.xlf' || ext === '.xliff' || ext === '.mxliff') {
                const content = readFileSync(filepath, 'utf-8');
                units = await xlf2Pairs(content, globalIdx);
            } else if (ext === '.tmx') {
                const content = readFileSync(filepath, 'utf-8');
                units = await tmx2Pairs(content, globalIdx);
            } else if (ext === '.tbx') {
                const content = readFileSync(filepath, 'utf-8');
                units = await tbx2Pairs(content, globalIdx);
            } else if (ext === '.csv' || ext === '.xlsx') {
                const buffer = readFileSync(filepath);
                units = ext === '.csv' ? await csv2Pairs(buffer, globalIdx) : await xlsx2Pairs(buffer, globalIdx);
            } else if (ext === '.jsonl') {
                const content = readFileSync(filepath, 'utf-8');
                units = await jsonl2Pairs(content, globalIdx);
            }
        } catch (e) {
            console.error(`Failed to parse ${filepath}:`, e);
        }

        allUnits.push(...units);
        globalIdx += units.length;

        fileinfo.push({
            name: path.basename(filepath),
            start: start,
            end: globalIdx - 1
        });
    }

    return { fileinfo, units: allUnits };
}
