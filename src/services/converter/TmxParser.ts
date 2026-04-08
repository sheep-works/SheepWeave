import { parseStringPromise } from 'xml2js';
import type { TranslationPair } from '../../types/datatype';

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

            if (!src) {
                src = text;
            } else if (!tgt) {
                tgt = text;
            } else {
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
