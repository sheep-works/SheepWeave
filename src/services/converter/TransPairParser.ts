import { readFileSync } from 'fs';
import * as path from 'path';
import type { ShWvFileInfo, TranslationPair } from '../../types/datatype';

import { xlfLike2Pairs } from './XlifLikeParser';
import { tmx2Pairs } from './TmxParser';
import { tbx2Pairs } from './TbxParser';
import { xlsx2Pairs, csv2Pairs } from './SpreadsheetParser';
import { jsonl2Pairs } from './JsonlParser';
import { jsonArray2Pairs } from './JsonArrayParser';

export async function parseTranslationFiles(filepaths: string[]): Promise<{ fileinfo: ShWvFileInfo[], units: TranslationPair[] }> {
    const fileinfo: ShWvFileInfo[] = [];
    const allUnits: TranslationPair[] = [];
    let globalIdx = 0;

    for (const filepath of filepaths) {
        const ext = path.extname(filepath).toLowerCase();
        const start = globalIdx;
        let units: TranslationPair[] = [];

        try {
            if (ext === '.xlf' || ext === '.xliff' || ext === '.mxliff' || ext === '.sdlxliff' || ext === '.mqxliff') {
                let content = readFileSync(filepath, 'utf-8');

                let globalId = 0;
                const globalPlaceholders: Record<string, Record<number, string>> = {};

                content = content.replace(/(<(source|target)[^>]*>)([\s\S]*?)(<\/\2>)/g, (match, open, tagname, inner, close) => {
                    let placeholders: Record<number, string> = {};
                    let counter = 0;
                    // Match raw <tag> or escaped &lt;tag&gt;
                    const newInner = inner.replace(/(<[^>]+>|&lt;[\s\S]*?&gt;)/g, (tagMatch: string) => {
                        placeholders[counter] = tagMatch;
                        const replaceString = `{@${counter}}`;
                        counter++;
                        return replaceString;
                    });
                    
                    const id = `__SHEEP_${globalId++}__`;
                    globalPlaceholders[id] = placeholders;
                    return `${open}${id}${newInner}${close}`;
                });

                let parsedUnits = await xlfLike2Pairs(filepath, content, globalIdx);

                for (let unit of parsedUnits) {
                    unit.placeholders = {};
                    
                    if (unit.src) {
                        const match = unit.src.match(/^__SHEEP_(\d+)__/);
                        if (match) {
                            unit.src = unit.src.substring(match[0].length);
                            Object.assign(unit.placeholders, globalPlaceholders[match[0]]);
                        }
                    }
                    if (unit.tgt) {
                        const match = unit.tgt.match(/^__SHEEP_(\d+)__/);
                        if (match) {
                            unit.tgt = unit.tgt.substring(match[0].length);
                            Object.assign(unit.placeholders, globalPlaceholders[match[0]]);
                        }
                    }
                }
                units = parsedUnits;
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
            } else if (ext === '.json') {
                const content = readFileSync(filepath, 'utf-8');
                units = await jsonArray2Pairs(content, globalIdx);
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
