import { parseStringPromise } from 'xml2js';
import { XlfJsTopSchema } from './xlfSchema';
import type { LmLgFileInfo, TranslationPair } from '../../../types/datatype';

export async function xlf2lmlg(xmlContent: string): Promise<{ fileinfo: LmLgFileInfo[], units: TranslationPair[] }> {
    const data = await parseStringPromise(xmlContent) as XlfJsTopSchema;
    const fileinfo: LmLgFileInfo[] = [];
    const units: TranslationPair[] = [];

    let currentIdx = 0;

    const files = data.xliff?.file || [];
    for (const f of files) {
        const fileInfo: LmLgFileInfo = {
            name: f.$?.original || 'unknown',
            start: currentIdx,
            end: currentIdx
        };

        const bodyElements = f.body || [];
        for (const body of bodyElements) {
            const transUnits = body["trans-unit"] || [];
            for (const tu of transUnits) {
                let src = '';
                if (tu.source && tu.source.length > 0) {
                    const srcNode = tu.source[0];
                    if (typeof srcNode === 'string') {
                        src = srcNode;
                    } else if (srcNode && typeof srcNode === 'object' && (srcNode as any)._) {
                        src = (srcNode as any)._;
                    }
                }

                let tgt = '';
                if (tu.target && tu.target.length > 0) {
                    const targetNode = tu.target[0];
                    if (typeof targetNode === 'string') {
                        tgt = targetNode;
                    } else if (targetNode && typeof targetNode === 'object' && targetNode._) {
                        tgt = targetNode._;
                    }
                }

                let note = '';
                const contextGroup = (tu as any)["context-group"];
                if (contextGroup && contextGroup.length > 0) {
                    const contexts = contextGroup[0].context;
                    if (contexts && contexts.length > 0) {
                        const ctx = contexts[0];
                        if (typeof ctx === 'string') {
                            note = ctx;
                        } else if (ctx && typeof ctx === 'object' && ctx._) {
                            note = ctx._;
                        }
                    }
                }

                // Handle multi-line splitting
                const srcParts = src.split('\n');
                let tgtParts = tgt.split('\n');

                if (srcParts.length > 1 || tgtParts.length > 1) {
                    // Normalize lengths
                    if (srcParts.length > tgtParts.length) {
                        // Pad targets with empty strings
                        const diff = srcParts.length - tgtParts.length;
                        for (let i = 0; i < diff; i++) {
                            tgtParts.push('');
                        }
                    } else if (srcParts.length < tgtParts.length) {
                        // Merge extra targets into the last element with <br/> or \n
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

                        // Set isSub for all but the last split part
                        if (!isLastNode) {
                            unit.isSub = true;
                        }

                        if (note && i === 0) { // Attach note to the first sub-unit
                            unit.note = note;
                        }
                        units.push(unit);
                        currentIdx++;
                    }
                } else {
                    // Normal single-line behavior
                    const unit: TranslationPair = {
                        idx: currentIdx,
                        src,
                        tgt,
                    };
                    if (note) {
                        unit.note = note;
                    }
                    units.push(unit);
                    currentIdx++;
                }
            }
        }

        fileInfo.end = currentIdx;
        fileinfo.push(fileInfo);
    }

    // if (units.length > 0) {
    //     units[units.length - 1].isSub = true;
    // }

    return { fileinfo, units };
}
