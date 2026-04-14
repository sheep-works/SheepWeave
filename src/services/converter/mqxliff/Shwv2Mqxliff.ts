import { parseStringPromise, Builder } from 'xml2js';
import type { ShWvUnit } from '../../../types/datatype';
import type { MqxliffJsTopSchema, MqxliffJsTransUnitSchema } from './MqxliffTypes';

export async function shwv2mqxliff(xmlContent: string, shwvUnits: ShWvUnit[]): Promise<string> {
    const data = await parseStringPromise(xmlContent) as MqxliffJsTopSchema;

    let currentIdx = 0;

    const files = data.xliff?.file || [];
    for (const f of files) {
        const bodyElements = f.body || [];
        for (const body of bodyElements) {
            const transUnits = body["trans-unit"] || [];

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
                        tu.target = [{ _: combinedTgt }];
                    } else {
                        const targetNode = tu.target[0] as any;
                        if (typeof targetNode === 'string') {
                            tu.target[0] = { _: combinedTgt } as any;
                        } else if (targetNode && typeof targetNode === 'object') {
                            targetNode._ = combinedTgt;
                        }
                    }
                    
                    // memoQ Specific: Update mq:status and mq:percent
                    if (tu.$) {
                        tu.$["mq:status"] = "ManuallyConfirmed";
                        tu.$["mq:percent"] = "100";
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
