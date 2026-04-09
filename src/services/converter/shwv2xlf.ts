import { parseStringPromise, Builder } from 'xml2js';
import type { ShWvUnit } from '../../types/datatype';

export declare interface XlfJsTopSchema {
    xliff: {
        $: Partial<XlfJsTopMetaSchema>
        file: Partial<XlfJsFileSchema>[]
    }
}

export declare interface XlfJsTopMetaSchema {
    version: string
    xmlns: string
}

export declare interface XlfJsFileSchema {
    $: Partial<XlfJsFileMetaSchema>
    header: Partial<XlfJsFileHeaderSchema>[]
    body: Array<{
        "trans-unit": Partial<XlfJsTransUnitSchema>[]
    }>
}

export declare interface XlfJsFileMetaSchema {
    id: string
    original: string
    "source-language": string
    "target-language": string
    datatype: string
    "project-id": string
    "tool-id": string
}

export declare interface XlfJsFileHeaderSchema {
    tool: Array<{
        $: {
            "tool-id": string
            "tool-name": string
            "tool-version": string
        }
    }>
}

export declare interface XlfJsTransUnitSchema {
    $: Partial<XlfJsTransUnitMetaSchema>
    source: string[]
    target: Partial<XlfJsTransUnitTargetSchema>[]
}

export declare interface XlfJsTransUnitMetaSchema {
    id: string
    resname: string
}

export declare interface XlfJsTransUnitTargetSchema {
    _: string
    $: {
        state: string
    }
}

export declare interface XlfJsTransUnitContextSchema {
    _: string
    $: {
        "context-type": string
    }
}


export async function shwv2xlf(xmlContent: string, shwvUnits: ShWvUnit[]): Promise<string> {
    const data = await parseStringPromise(xmlContent) as XlfJsTopSchema;

    let currentIdx = 0;

    const files = data.xliff?.file || [];
    for (const f of files) {
        const bodyElements = f.body || [];
        for (const body of bodyElements) {
            const transUnits: any[] = [];

            function extractTransUnits(node: any) {
                if (!node || typeof node !== 'object') return;
                if (Array.isArray(node)) {
                    node.forEach(child => extractTransUnits(child));
                    return;
                }
                for (const key in node) {
                    if (key === 'trans-unit') {
                        if (Array.isArray(node[key])) {
                            transUnits.push(...node[key]);
                        } else {
                            transUnits.push(node[key]);
                        }
                    } else if (key !== '$' && key !== '_') {
                        extractTransUnits(node[key]);
                    }
                }
            }

            extractTransUnits(body);

            for (const tu of transUnits) {
                if (currentIdx < shwvUnits.length) {
                    // Peek ahead to aggregate all isSub units that belong to this trans-unit
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

                        // If the current unit evaluated was NOT a sub, or the next one isn't, break
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
