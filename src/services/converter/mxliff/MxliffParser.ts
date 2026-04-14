import { parseStringPromise } from 'xml2js';
import type { TranslationPair } from '../../../types/datatype';
import type { MxliffJsTopSchema, MxliffJsTransUnitSchema, MxliffJsGroupSchema } from './MxliffTypes';

export async function mxliff2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
    const data = await parseStringPromise(content) as MxliffJsTopSchema;
    const units: TranslationPair[] = [];
    let currentIdx = startIdx;

    const files = data.xliff?.file || [];
    for (const f of files) {
        const bodyElements = f.body || [];
        for (const body of bodyElements) {
            const transUnits: MxliffJsTransUnitSchema[] = [];

            function extractTransUnitsFromGroups(groups: MxliffJsGroupSchema[]) {
                for (const g of groups) {
                    if (g["trans-unit"]) {
                        const tus = Array.isArray(g["trans-unit"]) ? g["trans-unit"] : [g["trans-unit"]];
                        transUnits.push(...tus);
                    }
                    // Handle nested groups if they exist in MXLIFF (usually flat under body though)
                    if ((g as any).group) {
                        extractTransUnitsFromGroups(Array.isArray((g as any).group) ? (g as any).group : [(g as any).group]);
                    }
                }
            }

            if (body.group) {
                extractTransUnitsFromGroups(Array.isArray(body.group) ? body.group : [body.group]);
            }

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

                // Note extraction for MXLIFF
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
                        const unit: TranslationPair = {
                            idx: currentIdx,
                            src: srcParts[i],
                            tgt: tgtParts[i]
                        };
                        if (i < srcParts.length - 1) unit.isSub = true;
                        if (note && i === 0) unit.note = note;
                        units.push(unit);
                        currentIdx++;
                    }
                } else {
                    const unit: TranslationPair = { idx: currentIdx, src, tgt };
                    if (note) unit.note = note;
                    units.push(unit);
                    currentIdx++;
                }
            }
        }
    }
    return units;
}
