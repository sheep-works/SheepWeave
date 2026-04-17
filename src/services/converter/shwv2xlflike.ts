import * as path from 'path';
import { ShWvUnit } from '../../types/datatype';
import { shwv2xlf } from './xlf/Shwv2Xliff';
import { shwv2sdlxliff } from './sdlxliff/Shwv2Sdlxliff';
import { shwv2mxliff } from './mxliff/Shwv2Mxliff';
import { shwv2mqxliff } from './mqxliff/Shwv2Mqxliff';

export async function shwv2xlfLike(filepath: string, xmlContent: string, shwvUnits: ShWvUnit[]): Promise<string> {
    const ext = path.extname(filepath).toLowerCase();

    // Restore tags from placeholders
    const processedUnits = shwvUnits.map(unit => {
        let processedSrc = unit.src || '';
        let processedTgt = unit.tgt || '';
        let processedPre = unit.pre || '';

        if (unit.placeholders && Object.keys(unit.placeholders).length > 0) {
            const replacer = (match: string, idxStr: string) => {
                const idx = parseInt(idxStr);
                return unit.placeholders![idx] !== undefined ? unit.placeholders![idx] : match;
            };

            processedSrc = processedSrc.replace(/\{@(\d+)\}/g, replacer);
            processedTgt = processedTgt.replace(/\{@(\d+)\}/g, replacer);
            processedPre = processedPre.replace(/\{@(\d+)\}/g, replacer);
        }

        const newUnit = new ShWvUnit(unit as any);
        Object.assign(newUnit, unit);
        newUnit.src = processedSrc;
        newUnit.tgt = processedTgt;
        newUnit.pre = processedPre;
        return newUnit;
    });

    switch (ext) {
        case '.xlf':
        case '.xliff':
            return await shwv2xlf(xmlContent, processedUnits);
        case '.sdlxliff':
            return await shwv2sdlxliff(xmlContent, processedUnits);
        case '.mxliff':
            return await shwv2mxliff(xmlContent, processedUnits);
        case '.mqxliff':
            return await shwv2mqxliff(xmlContent, processedUnits);
        default:
            return await shwv2xlf(xmlContent, processedUnits);
    }
}
