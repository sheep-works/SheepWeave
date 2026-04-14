import { parseStringPromise } from 'xml2js';
import type { TranslationPair } from '../../../types/datatype';
import type { SdlxliffJsTopSchema, SdlxliffJsTransUnitSchema, SdlxliffJsGroupSchema } from './SdlxliffTypes';

export async function sdlxliff2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
    const data = await parseStringPromise(content) as SdlxliffJsTopSchema;
    const units: TranslationPair[] = [];
    let currentIdx = startIdx;

    const files = data.xliff?.file || [];
    for (const f of files) {
        const bodyElements = f.body || [];
        for (const body of bodyElements) {
            const transUnits: SdlxliffJsTransUnitSchema[] = [];

            function extractTransUnits(node: any) {
                if (!node || typeof node !== 'object') return;
                
                // Handle direct trans-unit
                if (node["trans-unit"]) {
                    const tus = Array.isArray(node["trans-unit"]) ? node["trans-unit"] : [node["trans-unit"]];
                    transUnits.push(...tus);
                }

                // Handle group
                if (node.group) {
                    const groups = Array.isArray(node.group) ? node.group : [node.group];
                    groups.forEach((g: any) => extractTransUnits(g));
                }
            }

            extractTransUnits(body);

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

                // Handle segmentation if present (SDLXLIFF specific origin or locking can be handled here)
                // For now, we follow the same newline-splitting logic as standard XLF for consistency
                
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
