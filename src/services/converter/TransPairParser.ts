import { parseStringPromise } from 'xml2js';
import * as xlsx from 'xlsx';
import { readFileSync } from 'fs';
import * as path from 'path';
import type { LmLgFileInfo, TranslationPair } from '../../types/datatype';

export async function xlf2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
    const data = await parseStringPromise(content);
    const units: TranslationPair[] = [];
    let currentIdx = startIdx;

    const files = data.xliff?.file || [];
    for (const f of files) {
        const bodyElements = f.body || [];
        for (const body of bodyElements) {
            const transUnits = body["trans-unit"] || [];
            for (const tu of transUnits) {
                let src = '';
                if (tu.source && tu.source.length > 0) {
                    const srcNode = tu.source[0];
                    src = typeof srcNode === 'string' ? srcNode : (srcNode._ || '');
                }

                let tgt = '';
                if (tu.target && tu.target.length > 0) {
                    const targetNode = tu.target[0];
                    tgt = typeof targetNode === 'string' ? targetNode : (targetNode._ || '');
                }

                let note = '';
                const contextGroup = tu["context-group"];
                if (contextGroup && contextGroup.length > 0) {
                    const contexts = contextGroup[0].context;
                    if (contexts && contexts.length > 0) {
                        const ctx = contexts[0];
                        note = typeof ctx === 'string' ? ctx : (ctx._ || '');
                    }
                }

                const srcParts = src.split('\n');
                let tgtParts = tgt.split('\n');

                if (srcParts.length > 1 || tgtParts.length > 1) {
                    if (srcParts.length > tgtParts.length) {
                        const diff = srcParts.length - tgtParts.length;
                        for (let i = 0; i < diff; i++) {
                            tgtParts.push('');
                        }
                    } else if (srcParts.length < tgtParts.length) {
                        const excessTarget = tgtParts.splice(srcParts.length - 1).join('<br/>');
                        tgtParts.push(excessTarget);
                    }

                    for (let i = 0; i < srcParts.length; i++) {
                        const isLastNode = (i === srcParts.length - 1);
                        const unit: TranslationPair = {
                            idx: currentIdx,
                            src: srcParts[i],
                            tgt: tgtParts[i]
                        };

                        if (!isLastNode) unit.isSub = true;
                        if (note && i === 0) unit.note = note;

                        units.push(unit);
                        currentIdx++;
                    }
                } else {
                    const unit: TranslationPair = {
                        idx: currentIdx,
                        src,
                        tgt,
                    };
                    if (note) unit.note = note;

                    units.push(unit);
                    currentIdx++;
                }
            }
        }
    }
    return units;
}

export async function tmx2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
    const data = await parseStringPromise(content);
    const units: TranslationPair[] = [];
    let currentIdx = startIdx;

    const body = data.tmx?.body?.[0];
    if (!body) return units;

    const tus = body.tu || [];
    for (const tu of tus) {
        let src = '';
        let tgt = '';
        let note = tu.note?.[0] || '';

        const tuvs = tu.tuv || [];
        for (const tuv of tuvs) {
            const lang = tuv.$?.['xml:lang'] || tuv.$?.lang || '';
            const textNode = tuv.seg?.[0];
            const text = typeof textNode === 'string' ? textNode : (textNode?._ || '');

            // Heuristic assuming first tuv is source, others target. 
            // Usually we might match against 'en' / 'ja', but keeping generic extraction fallback.
            if (!src) {
                src = text;
            } else if (!tgt) {
                tgt = text;
            } else {
                // If more than one target, fallbacks just append with return
                tgt += '\n' + text;
            }
        }

        if (src) {
            units.push({
                idx: currentIdx++,
                src,
                tgt,
                note: typeof note === 'string' ? note : (note._ || '')
            });
        }
    }

    return units;
}


export async function tbx2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
    const data = await parseStringPromise(content);
    const units: TranslationPair[] = [];
    let currentIdx = startIdx;

    const body = data.martif?.text?.[0]?.body?.[0];
    if (!body) return units;

    const termEntries = body.termEntry || [];
    for (const entry of termEntries) {
        let src = '';
        let tgt = '';

        const langSets = entry.langSet || [];
        for (const ls of langSets) {
            const terms = ls.tig || ls.ntig || [];
            let extracted = '';
            if (terms.length > 0) {
                const termNode = terms[0].term?.[0];
                extracted = typeof termNode === 'string' ? termNode : (termNode?._ || '');
            }

            if (!src) src = extracted;
            else if (!tgt) tgt = extracted;
        }

        if (src) {
            units.push({
                idx: currentIdx++,
                src,
                tgt
            });
        }
    }

    return units;
}

export async function csv2Pairs(buffer: Buffer, startIdx: number): Promise<TranslationPair[]> {
    const units: TranslationPair[] = [];
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to array of arrays
    const rows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    let currentIdx = startIdx;
    for (const row of rows) {
        if (!row || row.length === 0) continue;
        const src = row[0]?.toString() || '';
        const tgt = row[1]?.toString() || '';
        const note = row.slice(2).join(' | ');

        if (src) {
            units.push({
                idx: currentIdx++,
                src,
                tgt,
                note: note || undefined
            });
        }
    }

    return units;
}

export async function xlsx2Pairs(buffer: Buffer, startIdx: number): Promise<TranslationPair[]> {
    // xlsx and csv parsing logic is identical using SheetJS
    return csv2Pairs(buffer, startIdx);
}


export async function parseTranslationFiles(filepaths: string[]): Promise<{ fileinfo: LmLgFileInfo[], units: TranslationPair[] }> {
    const fileinfo: LmLgFileInfo[] = [];
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
