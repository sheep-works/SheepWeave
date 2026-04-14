import { parseStringPromise, Builder } from 'xml2js';
import type { ShWvUnit } from '../../../types/datatype';
import type { SdlxliffJsTopSchema, SdlxliffJsTransUnitSchema } from './SdlxliffTypes';

export async function shwv2sdlxliff(xmlContent: string, shwvUnits: ShWvUnit[]): Promise<string> {
    const data = await parseStringPromise(xmlContent) as SdlxliffJsTopSchema;

    let currentIdx = 0;

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

                    if (!tu.target || tu.target.length === 0) {
                        tu.target = [{ _: combinedTgt, $: { state: 'translated' } }];
                    } else {
                        const targetNode = tu.target[0] as any;
                        if (typeof targetNode === 'string') {
                            tu.target[0] = { _: combinedTgt, $: { state: 'translated', "sdl:conf": "Translated" } } as any;
                        } else if (targetNode && typeof targetNode === 'object') {
                            targetNode._ = combinedTgt;
                            if (targetNode.$) {
                                targetNode.$.state = 'translated';
                                targetNode.$["sdl:conf"] = "Translated";
                            } else {
                                targetNode.$ = { state: 'translated', "sdl:conf": "Translated" };
                            }
                        }
                    }
                    
                    // Update segment status in sdl:seg-defs if present
                    const segDefs = tu["sdl:seg-defs"];
                    if (segDefs && segDefs.length > 0) {
                        const segs = segDefs[0]["sdl:seg"];
                        if (segs && segs.length > 0) {
                            segs.forEach(s => {
                                if (s.$) {
                                    s.$.conf = "Translated";
                                }
                            });
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
