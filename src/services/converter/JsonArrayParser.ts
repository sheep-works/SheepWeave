import type { TranslationPair } from '../../types/datatype';

export async function jsonArray2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
    const units: TranslationPair[] = [];
    let currentIdx = startIdx;

    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                if (item.src) {
                    units.push({
                        idx: currentIdx++,
                        src: item.src,
                        tgt: item.tgt || ""
                    });
                }
            }
        }
    } catch (e) {
        console.error(`Failed to parse JSON array:`, e);
    }

    return units;
}
