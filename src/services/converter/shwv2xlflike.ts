import * as path from 'path';
import type { ShWvUnit } from '../../types/datatype';

export async function shwv2xlfLike(filepath: string, xmlContent: string, shwvUnits: ShWvUnit[]): Promise<string> {
    // Strip BOM if present
    xmlContent = xmlContent.replace(/^\uFEFF/, '');

    // Restore tags from placeholders
    const processedUnits = shwvUnits.map(unit => {
        let processedSrc = unit.src || '';
        let processedTgt = unit.tgt || '';
        let processedPre = unit.pre || '';

        if (unit.placeholders && Object.keys(unit.placeholders).length > 0) {
            const replacer = (match: string, idxStr: string) => {
                const idx = parseInt(idxStr);
                let ph = unit.placeholders![idx] !== undefined ? unit.placeholders![idx] : match;
                if (ph.includes('&lt;') && ph.includes('&gt;')) {
                    ph = ph.replace(/&lt;[\s\S]*?&gt;/g, (tagStr) => {
                        return tagStr.replace(/"/g, '&quot;');
                    });
                }
                return ph;
            };

            processedSrc = processedSrc.replace(/\{@(\d+)\}/g, replacer);
            processedTgt = processedTgt.replace(/\{@(\d+)\}/g, replacer);
            processedPre = processedPre.replace(/\{@(\d+)\}/g, replacer);
        }

        return {
            ...unit,
            src: processedSrc,
            tgt: processedTgt,
            pre: processedPre,
        } as ShWvUnit;
    });

    // Provide DOMParser and XMLSerializer shims
    if (!(globalThis as any).DOMParser) {
        (globalThis as any).DOMParser = require('@xmldom/xmldom').DOMParser;
    }
    if (!(globalThis as any).XMLSerializer) {
        (globalThis as any).XMLSerializer = require('@xmldom/xmldom').XMLSerializer;
    }

    const { SheepShuttle } = require('../../../modules/SheepComb/packages/core/src/shuttle/sheepShuttle');
    const shuttle = new SheepShuttle();
    
    // Create dummy data
    shuttle.data = {
        define: { name: 'SHWV_DATA', version: '1.0' },
        meta: { bilingualPath: '', files: [], sourceLang: '', targetLang: '', tmFiles: [], tbFiles: [] },
        body: { units: processedUnits, terms: [] }
    } as any;

    let resultXml = await shuttle.build(xmlContent);

    // Re-escape quotes inside escaped XML tags (&lt;...&gt;) to &quot; for CAT tool / MXLIFF compatibility
    resultXml = resultXml.replace(/&lt;[\s\S]*?&gt;/g, (tagMatch: string) => {
        return tagMatch.replace(/"/g, '&quot;');
    });

    return resultXml;
}
