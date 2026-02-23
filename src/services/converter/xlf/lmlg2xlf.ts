import { parseStringPromise, Builder } from 'xml2js';
import { XlfJsTopSchema, XlfJsTransUnitTargetSchema } from './xlfSchema';
import type { LmLgUnit } from '../../../types/datatype';

export async function lmlg2xlf(xmlContent: string, lmlgUnits: LmLgUnit[]): Promise<string> {
    const data = await parseStringPromise(xmlContent) as XlfJsTopSchema;

    let currentIdx = 0;

    const files = data.xliff?.file || [];
    for (const f of files) {
        const bodyElements = f.body || [];
        for (const body of bodyElements) {
            const transUnits = body["trans-unit"] || [];
            for (const tu of transUnits) {
                if (currentIdx < lmlgUnits.length) {
                    // Peek ahead to aggregate all isSub units that belong to this trans-unit
                    let combinedTgt = '';
                    let isFirst = true;

                    while (currentIdx < lmlgUnits.length) {
                        const unit = lmlgUnits[currentIdx];
                        if (!isFirst) {
                            combinedTgt += '\n';
                        }
                        combinedTgt += unit.tgt;

                        currentIdx++;
                        isFirst = false;

                        // If the current unit evaluated was NOT a sub, or the next one isn't, break
                        // Wait, if it is a sub, we keep going?
                        // Actually, if `isSub` is true, it means it's part of a split group.
                        // We need a way to know when the group ends. 
                        // If we set `isSub: true` for ALL parts of the split, we don't know where the next split begins.
                        // Let's rely on the original structure: ONE `tu` in XML corresponds to one COMBINED string here.
                        // But wait! If we just advance `currentIdx` until `isSub` is false, what if the last part has `isSub: true`?
                        // Let's modify xlf2lmlg to only set `isSub: true` for the FIRST N-1, or just let's check `isSub`.
                        // If `isSub` is true, we aggregate to the next. If false, it's the LAST one of the group (or a standalone item).
                        if (!unit.isSub) {
                            break;
                        }
                    }

                    // Convert any <br/> back to \n if needed, or leave it.
                    combinedTgt = combinedTgt.replace(/<br\/>/g, '\n');

                    if (!tu.target || tu.target.length === 0) {
                        tu.target = [{ _: combinedTgt, $: { state: 'translated' } }];
                    } else {
                        const targetNode = tu.target[0] as any;
                        if (typeof targetNode === 'string') {
                            tu.target[0] = { _: combinedTgt, $: { state: 'translated' } } as unknown as Partial<XlfJsTransUnitTargetSchema>;
                        } else if (targetNode && typeof targetNode === 'object') {
                            targetNode._ = combinedTgt;
                            if (targetNode.$) {
                                targetNode.$.state = 'translated';
                            } else {
                                targetNode.$ = { state: 'translated' };
                            }
                        }
                    }
                } else {
                    currentIdx++;
                }
            }
        }
    }

    const builder = new Builder();
    const xml = builder.buildObject(data);
    return xml;
}
