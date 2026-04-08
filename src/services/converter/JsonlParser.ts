import type { TranslationPair } from '../../types/datatype';

export async function jsonl2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
    const units: TranslationPair[] = [];
    let currentIdx = startIdx;
    const lines = content.split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const parsed = JSON.parse(line);
            if (parsed.src) {
                units.push({
                    idx: currentIdx++,
                    src: parsed.src,
                    tgt: parsed.tgt || ""
                });
            }
        } catch (e) {
            console.error(`Failed to parse JSONL line: ${line}`, e);
        }
    }
    return units;
}
