import * as xlsx from 'xlsx';
import type { TranslationPair } from '../../types/datatype';

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
