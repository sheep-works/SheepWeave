import { SequenceMatcher } from 'difflib-ts';
import { ShWvRefTm } from './ShWvRefTm';
import { ShWvUnit } from './ShWvUnit';
import * as fs from 'fs';
import * as path from 'path';

export class ShWvDiffer {
    private static matcher = new SequenceMatcher(null, "", "");

    static applyOpcodes(src1: string, src2: string, opcodes: [string, number, number, number, number][]): string {
        let result = "";
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

        // HTML特殊文字のエスケープを行い、その後でプレースホルダを実際のタグに置換する
        result = result.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return result.replace(/\[ins\]/g, '<ins>')
            .replace(/\[\/ins\]/g, '</ins>')
            .replace(/\[del\]/g, '<del>')
            .replace(/\[\/del\]/g, '</del>');
    }

    /**
     * Orchestrates the analysis of units using WASM candidate search and precise diffing.
     * Updates units in-place with TM and TB matches.
     */
    static async analyze(units: ShWvUnit[], memories: any[], termbase: any[], rootPath?: string, legacy: boolean = false) {
        const tmList = memories.map(m => m.src);
        const textList = units.map(u => u.src);
        const tbList = termbase.map(t => t.src);

        // TB Logging setup
        let logLines: string[] = [];
        const logHeader = `--- TB Matching Log (${new Date().toISOString()}) ---\nMode: ${legacy ? 'Legacy (Iterative)' : 'WASM (Aho-Corasick)'}\n\n`;
        logLines.push(logHeader);

        // Call WASM analytical functions
        const { analyze_all } = require('sheep-spindle');
        const results = analyze_all(tmList, textList, tbList, 0.6, 5);

        // First, clear old analysis data for all units
        for (const unit of units) {
            unit.ref.tms = [];
            unit.ref.tb = [];
            unit.ref.quoted = [];
            unit.ref.quoted100 = [];
        }

        for (let i = 0; i < units.length; i++) {
            const currentUnit = units[i];
            const currentResult = results[i];

            // 1. Process TM Matches (External and Internal)
            const tmSources = currentResult.t.map((idx: number) => memories[idx]);
            const internalSources = currentResult.i.map((idx: number) => ({
                idx: units[idx].idx,
                src: units[idx].src,
                tgt: units[idx].tgt || "",
                file: "Internal"
            }));

            const allSources = [...tmSources, ...internalSources];

            // Deduplicate by src + tgt
            const uniqueSources: typeof allSources = [];
            const seenTm = new Set<string>();
            for (const s of allSources) {
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
                    
                    const tbTarget = tb.tgt || tb.pre || "";
                    let existingEntry = currentUnit.ref.tb.find(t => t.src === tb.src);
                    
                    // logLines.push(`[Unit ${i}] Match (WASM): "${tb.src}" -> "${tbTarget}" (${tb.file})\n`);

                    if (existingEntry) {
                        if (!existingEntry.tgts.includes(tbTarget)) {
                            existingEntry.tgts.push(tbTarget);
                        }
                    } else {
                        currentUnit.ref.tb.push({
                            src: tb.src,
                            tgts: [tbTarget],
                            file: tb.file
                        });
                    }
                }
            } else {
                // Legacy substring-based matching in TS
                for (let j = 0; j < termbase.length; j++) {
                    const tb = termbase[j];
                    if (tb.src && currentUnit.src.includes(tb.src)) {
                        const tbTarget = tb.tgt || tb.pre || "";
                        let existingEntry = currentUnit.ref.tb.find(t => t.src === tb.src);
                        
                        // logLines.push(`[Unit ${i}] Match (Legacy): "${tb.src}" -> "${tbTarget}" (${tb.file})\n`);

                        if (existingEntry) {
                            if (!existingEntry.tgts.includes(tbTarget)) {
                                existingEntry.tgts.push(tbTarget);
                            }
                        } else {
                            currentUnit.ref.tb.push({
                                src: tb.src,
                                tgts: [tbTarget],
                                file: tb.file
                            });
                        }
                    }
                }
            }
        }

        /*
        // Finalize Logging
        if (rootPath) {
            try {
                const logDir = path.join(rootPath, 'Working', '04_SHWV');
                if (fs.existsSync(logDir)) {
                    const logPath = path.join(logDir, 'tb_matching.log');
                    fs.writeFileSync(logPath, logLines.join(''), 'utf-8');
                }
            } catch (e) {
                console.error('Failed to write TB log:', e);
            }
        }
        */

        // 3. Synchronization of back-references (which units are quoted by which)
        for (let i = units.length - 1; i >= 0; i--) {
            const currentUnit = units[i];
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

    static batchCompare(srcs: { idx: number, src: string, tgt: string }[], crtSrc: string, minRatio = 0.6, counts = 5): ShWvRefTm[] {
        let goodMatches: { tm: ShWvRefTm; opcodes: [string, number, number, number, number][] }[] = [];
        let tempMinRatio = minRatio;

        this.matcher.setSeq2(crtSrc);

        for (const s of srcs) {
            this.matcher.setSeq1(s.src);
            const ratio = this.matcher.ratio();

            if (ratio >= tempMinRatio) {
                const opcodes = this.matcher.getOpcodes() as [string, number, number, number, number][];

                const tm = new ShWvRefTm();
                tm.idx = s.idx;
                tm.src = s.src;
                tm.tgt = s.tgt;
                tm.ratio = ratio;

                const matchEntry = { tm, opcodes };

                if (goodMatches.length < counts) {
                    goodMatches.push(matchEntry);
                } else if (ratio > tempMinRatio) {
                    goodMatches[goodMatches.length - 1] = matchEntry;
                }

                goodMatches.sort((a, b) => b.tm.ratio - a.tm.ratio);

                if (goodMatches.length === counts) {
                    tempMinRatio = goodMatches[goodMatches.length - 1].tm.ratio;
                }
            }
        }

        // 次の処理のために空白にしておく
        this.matcher.setSeqs("", "");

        // Apply opcodes to generate diff text for the final collection
        return goodMatches.map(match => {
            if (match.tm.ratio !== 1) {
                match.tm.diff = this.applyOpcodes(match.tm.src, crtSrc, match.opcodes);
            }
            match.tm.ratio = Math.round(match.tm.ratio * 100);
            return match.tm;
        });
    }

    static computeDiffsForWasm(srcs: { idx: number, src: string, tgt: string, file?: string }[], crtSrc: string): ShWvRefTm[] {
        let results: { tm: ShWvRefTm; opcodes: [string, number, number, number, number][] }[] = [];

        this.matcher.setSeq2(crtSrc);

        for (const s of srcs) {
            this.matcher.setSeq1(s.src);
            const ratio = this.matcher.ratio();
            const opcodes = this.matcher.getOpcodes() as [string, number, number, number, number][];

            const tm = new ShWvRefTm();
            tm.idx = s.idx;
            tm.src = s.src;
            tm.tgt = s.tgt;
            tm.ratio = ratio;
            tm.file = s.file;

            results.push({ tm, opcodes });
        }

        this.matcher.setSeqs("", "");

        // Apply opcodes to generate diff text for the final collection
        // WASM already sorted them by its own algorithm, but SequenceMatcher ratio might differ slightly.
        // We'll resync the sorting based on difflib ratio to be consistent with UI expectations.
        results.sort((a, b) => b.tm.ratio - a.tm.ratio);

        return results.map(match => {
            if (match.tm.ratio !== 1) {
                match.tm.diff = this.applyOpcodes(match.tm.src, crtSrc, match.opcodes);
            }
            match.tm.ratio = Math.round(match.tm.ratio * 100);
            return match.tm;
        });
    }
}
