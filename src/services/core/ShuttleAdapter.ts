/**
 * SheepComb ShuttleAnalyzer adapter for SheepWeave.
 * Re-implements the analyzer/manager logic locally to avoid pulling in
 * SheepComb's full dependency graph (which includes browser-only code).
 */
import { SequenceMatcher } from 'difflib-ts';
import type { ShWvData, ShWvUnit, ShWvRefTm, ShWvRefTb, TranslationPair, TranslationPairWithFile, ExportPair, ChunkedJsonlItem, ManagedDataType } from '../../types/datatype';

/**
 * Results from WASM analyze_all
 */
export interface WasmAnalyzeResult {
    t: number[]; // TM indices
    i: number[]; // Internal indices
    g: number[]; // Glossary (TB) indices
}

export class ShuttleAnalyzer {
    private static matcher = new SequenceMatcher(null, '', '');

    /**
     * Orchestrates TM and TB analysis for a data object.
     * Utilizes WASM logic under the hood.
     */
    async analyze(
        data: ShWvData,
        memories: TranslationPairWithFile[],
        termbase: TranslationPairWithFile[],
        wasmAnalyzeAll: (tmList: string[], textList: string[], tbList: string[], minRatio: number, counts: number) => WasmAnalyzeResult[],
        legacy: boolean = false
    ): Promise<void> {
        const units = data.body.units;
        const tmList = memories.map(m => m.src);
        const textList = units.map(u => u.src);
        const tbList = termbase.map(t => t.src);

        // Call WASM analytical functions
        const results = wasmAnalyzeAll(tmList, textList, tbList, 0.6, 5);

        // First, clear old analysis data for all units
        for (const unit of units) {
            unit.ref.tms = [];
            unit.ref.tb = [];
            unit.ref.quoted = [];
            unit.ref.quoted100 = [];
        }

        // Process results for each unit
        for (let i = 0; i < units.length; i++) {
            const currentUnit = units[i];
            const currentResult = results[i];
            if (!currentUnit || !currentResult) {
                continue;
            }

            // 1. Process TM Matches (External and Internal)
            const tmSources = currentResult.t
                .map((idx: number) => memories[idx])
                .filter((s: any) => s !== undefined);

            const internalSources = currentResult.i
                .map((idx: number) => {
                    const u = units[idx];
                    if (!u) return undefined;
                    return {
                        idx: u.idx,
                        src: u.src,
                        tgt: u.tgt || u.pre || '',
                        file: 'Internal'
                    };
                })
                .filter((s: any) => s !== undefined);

            const allSources = [...tmSources, ...internalSources];

            // Deduplicate by src + tgt
            const uniqueSources: TranslationPair[] = [];
            const seenTm = new Set<string>();
            for (const s of allSources) {
                if (!s) { continue; }
                const key = s.src + '|||' + s.tgt;
                if (!seenTm.has(key)) {
                    seenTm.add(key);
                    uniqueSources.push(s);
                }
            }

            // Calculate precise ratios and diffs
            const diffedTms = this.computeDiffsForWasm(uniqueSources, currentUnit.src);
            currentUnit.ref.tms = diffedTms.slice(0, 5);

            // 2. Process TB Matches (Glossary)
            if (!legacy) {
                // WASM Aho-Corasick result
                const tbIndices = currentResult.g || [];
                for (const tbIdx of tbIndices) {
                    const tb = termbase[tbIdx];
                    if (!tb) continue;

                    const tbTarget = tb.tgt || '';
                    let existingEntry = currentUnit.ref.tb.find(t => t.src === tb.src);

                    if (existingEntry) {
                        if (!existingEntry.tgts.includes(tbTarget)) {
                            existingEntry.tgts.push(tbTarget);
                        }
                    } else {
                        currentUnit.ref.tb.push({
                            src: tb.src,
                            tgts: [tbTarget],
                            file: (tb.file as string) || '',
                        });
                    }
                }
            } else {
                // Legacy substring-based matching
                for (let j = 0; j < termbase.length; j++) {
                    const tb = termbase[j];
                    if (!tb) continue;
                    if (tb.src && currentUnit.src.includes(tb.src)) {
                        const tbTarget = tb.tgt || '';
                        let existingEntry = currentUnit.ref.tb.find(t => t.src === tb.src);

                        if (existingEntry) {
                            if (!existingEntry.tgts.includes(tbTarget)) {
                                existingEntry.tgts.push(tbTarget);
                            }
                        } else {
                            currentUnit.ref.tb.push({
                                src: tb.src,
                                tgts: [tbTarget],
                                file: (tb.file as string) || '',
                            });
                        }
                    }
                }
            }
        }

        // 3. Synchronization of back-references
        for (let i = units.length - 1; i >= 0; i--) {
            const currentUnit = units[i];
            if (!currentUnit || !currentUnit.ref) continue;

            for (const tm of currentUnit.ref.tms) {
                if (tm.idx !== -1) {
                    const referencedUnit = units.find(u => u.idx === tm.idx);
                    if (referencedUnit) {
                        if (tm.ratio === 100) {
                            referencedUnit.ref.quoted100.push(currentUnit.idx);
                        } else {
                            referencedUnit.ref.quoted.push([currentUnit.idx, tm.ratio]);
                        }
                    }
                }
            }
        }
    }

    /**
     * Refined diff calculation for WASM candidates
     */
    private computeDiffsForWasm(srcs: TranslationPair[], crtSrc: string): ShWvRefTm[] {
        let results: { tm: ShWvRefTm; opcodes: [string, number, number, number, number][] }[] = [];

        ShuttleAnalyzer.matcher.setSeq2(crtSrc);

        for (const s of srcs) {
            ShuttleAnalyzer.matcher.setSeq1(s.src);
            const ratio = ShuttleAnalyzer.matcher.ratio();
            const opcodes = ShuttleAnalyzer.matcher.getOpcodes() as [string, number, number, number, number][];

            const tm: ShWvRefTm = {
                idx: s.idx,
                src: s.src,
                tgt: s.tgt,
                ratio: ratio
            };

            results.push({ tm, opcodes });
        }

        ShuttleAnalyzer.matcher.setSeqs('', '');

        // Sort by ratio to ensure best matches are first
        results.sort((a, b) => b.tm.ratio - a.tm.ratio);

        return results.map(match => {
            if (match.tm.ratio !== 1) {
                match.tm.diff = this.applyOpcodes(match.tm.src, crtSrc, match.opcodes);
            }
            match.tm.ratio = Math.round(match.tm.ratio * 100);
            return match.tm;
        });
    }

    /**
     * Generates diff HTML using opcodes from SequenceMatcher
     */
    private applyOpcodes(src1: string, src2: string, opcodes: [string, number, number, number, number][]): string {
        let result = '';
        for (const [tag, i1, i2, j1, j2] of opcodes) {
            if (tag === 'equal') {
                result += src2.substring(j1, j2);
            } else if (tag === 'replace') {
                result += `[del]${src1.substring(i1, i2)}[/del][ins]${src2.substring(j1, j2)}[/ins]`;
            } else if (tag === 'delete') {
                result += `[del]${src1.substring(i1, i2)}[/del]`;
            } else if (tag === 'insert') {
                result += `[ins]${src2.substring(j1, j2)}[/ins]`;
            }
        }

        // Escape HTML first, then restore tags for del/ins
        result = result.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return result.replace(/\[ins\]/g, '<ins>')
            .replace(/\[\/ins\]/g, '</ins>')
            .replace(/\[del\]/g, '<del>')
            .replace(/\[\/del\]/g, '</del>');
    }
}

/**
 * ShuttleManager — data export/import utilities.
 * Adapted from SheepComb's ShuttleManager for use in Node.js context.
 */
export class ShuttleManager {
    getPairs(units: ShWvUnit[]): ExportPair[] {
        return units.map(unit => ({
            src: unit.src,
            tgt: unit.tgt || unit.pre || '',
        }));
    }

    formatCsv(pairs: ExportPair[]): string {
        const header = 'src,tgt';
        const rows = pairs.map(pair => {
            const src = `"${pair.src.replace(/"/g, '""')}"`;
            const tgt = `"${pair.tgt.replace(/"/g, '""')}"`;
            return `${src},${tgt}`;
        });
        return [header, ...rows].join('\n');
    }

    splitByFile(data: ShWvData): Map<string, ExportPair[]> {
        const result = new Map<string, ExportPair[]>();
        for (const file of data.meta.files) {
            const fileUnits = data.body.units.slice(file.start, file.end + 1);
            const pairs = this.getPairs(fileUnits);
            const name = file.name.replace(/\.[^.]+$/, '') + '.json';
            result.set(name, pairs);
        }
        return result;
    }

    splitByLength(data: ShWvData, maxLength: number): Map<number, ExportPair[]> {
        const result = new Map<number, ExportPair[]>();
        let currentChunk: ExportPair[] = [];
        let currentLen = 0;
        let chunkIdx = 0;

        for (const unit of data.body.units) {
            const tgtText = unit.tgt || unit.pre || '';
            const pair: ExportPair = { src: unit.src, tgt: tgtText };
            const pairStr = JSON.stringify(pair);
            const len = pairStr.length;

            if (currentLen + len > maxLength && currentChunk.length > 0) {
                result.set(chunkIdx, currentChunk);
                chunkIdx++;
                currentChunk = [];
                currentLen = 0;
            }

            currentChunk.push(pair);
            currentLen += len;
        }

        if (currentChunk.length > 0) {
            result.set(chunkIdx, currentChunk);
        }

        return result;
    }

    getJsonlContent(units: ShWvUnit[]): string {
        const lines: string[] = [];
        for (const unit of units) {
            const tgtText = unit.tgt || unit.pre || '';
            const historyObj = unit.ref?.tms
                ? unit.ref.tms.map((tm: ShWvRefTm) => ({ src: tm.src, tgt: tm.tgt }))
                : [];

            const obj = {
                src: unit.src,
                tgt: tgtText,
                history: historyObj,
            };
            lines.push(JSON.stringify(obj));
        }
        return lines.join('\n');
    }

    chunkJsonl(data: ShWvData, maxCharsPerLine: number): string {
        const lines: string[] = [];
        let currentChunk: ChunkedJsonlItem[] = [];
        let currentLen = 0;

        for (const unit of data.body.units) {
            const tgtText = unit.tgt || unit.pre || '';
            const historyObj = unit.ref?.tms
                ? unit.ref.tms.map((tm: ShWvRefTm) => ({ src: tm.src, tgt: tm.tgt }))
                : [];

            const obj: ChunkedJsonlItem = {
                index: unit.idx,
                src: unit.src,
                tgt: tgtText,
                history: historyObj,
            };
            const strObj = JSON.stringify(obj);
            const len = strObj.length;

            if (currentLen + len > maxCharsPerLine && currentChunk.length > 0) {
                lines.push(JSON.stringify(currentChunk));
                currentChunk = [];
                currentLen = 0;
            }

            currentChunk.push(obj);
            currentLen += len;
        }

        if (currentChunk.length > 0) {
            lines.push(JSON.stringify(currentChunk));
        }

        return lines.join('\n');
    }

    updateFromJsonl(data: ShWvData, content: string): ShWvUnit[] {
        const updatedUnits: ShWvUnit[] = JSON.parse(JSON.stringify(data.body.units));
        const lines = content.split('\n');

        for (const line of lines) {
            if (line.trim().length === 0) continue;
            try {
                const chunk = JSON.parse(line);
                const items = Array.isArray(chunk) ? chunk : [chunk];
                for (const item of items) {
                    const unit = updatedUnits.find((u: ShWvUnit) => u.idx === item.index || u.idx === item.idx);
                    if (unit) {
                        if (item.tgt && item.tgt.trim() !== '') {
                            unit.tgt = item.tgt;
                        } else if (item.src) {
                            unit.pre = item.src;
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to parse JSONL line', e);
            }
        }
        return updatedUnits;
    }
}
