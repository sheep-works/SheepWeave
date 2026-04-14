import { parseStringPromise, Builder } from 'xml2js';
import type { ShWvUnit } from '../../../types/datatype';
import type { MxliffJsTopSchema, MxliffJsTransUnitSchema, MxliffJsGroupSchema } from './MxliffTypes';

export async function shwv2mxliff(xmlContent: string, shwvUnits: ShWvUnit[]): Promise<string> {
    const data = await parseStringPromise(xmlContent) as MxliffJsTopSchema;

    let currentIdx = 0;

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
                    if ((g as any).group) {
                        extractTransUnitsFromGroups(Array.isArray((g as any).group) ? (g as any).group : [(g as any).group]);
                    }
                }
            }

            if (body.group) {
                extractTransUnitsFromGroups(Array.isArray(body.group) ? body.group : [body.group]);
            }

            for (const tu of transUnits) {
                if (currentIdx < shwvUnits.length) {
                    let combinedTgt = '';
                    let isFirst = true;

                    while (currentIdx < shwvUnits.length) {
                        const unit = shwvUnits[currentIdx];
                        if (!isFirst) {
                            combinedTgt += '\n';
                        }
                        combinedTgt += (unit.tgt ? unit.tgt : (unit.pre ? unit.pre : unit.src));

                        currentIdx++;
                        isFirst = false;

                        if (!unit.isSub) {
                            break;
                        }
                    }

                    combinedTgt = combinedTgt.replace(/<br\/>/g, '\n');

                    // MXLIFF Specific: Update target and m:confirmed status
                    if (!tu.target || tu.target.length === 0) {
                        tu.target = [{ _: combinedTgt, $: { state: 'translated' } }];
                    } else {
                        const targetNode = tu.target[0] as any;
                        if (typeof targetNode === 'string') {
                            tu.target[0] = { _: combinedTgt, $: { state: 'translated' } } as any;
                        } else if (targetNode && typeof targetNode === 'object') {
                            targetNode._ = combinedTgt;
                            if (targetNode.$) {
                                targetNode.$.state = 'translated';
                            } else {
                                targetNode.$ = { state: 'translated' };
                            }
                        }
                    }
                    
                    // Set m:confirmed to "1" for Phrase
                    if (tu.$) {
                        tu.$["m:confirmed"] = "1";
                    }

                } else {
                    currentIdx++;
                }
            }
        }
    }

    // To preserve CDATA in m:in-ctx-preview-skel, we need to be careful.
    // xml2js Builder doesn't have a per-element CDATA option.
    // However, if we don't change the header, it SHOULD stay mostly the same, 
    // but the builder will escape the < > characters in the CDATA block if it treats it as a text node.
    
    // TODO: If verification shows CDATA is broken, implement a custom string-level replacement 
    // for the header or use a more advanced XML builder.
    
    const builder = new Builder();
    const xml = builder.buildObject(data);
    return xml;
}
