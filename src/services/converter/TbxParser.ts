import { parseStringPromise } from 'xml2js';
import type { TranslationPair } from '../../types/datatype';

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
