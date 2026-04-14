import * as path from 'path';
import type { ShWvUnit } from '../../types/datatype';
import { shwv2xlf } from './xlf/Shwv2Xliff';
import { shwv2sdlxliff } from './sdlxliff/Shwv2Sdlxliff';
import { shwv2mxliff } from './mxliff/Shwv2Mxliff';
import { shwv2mqxliff } from './mqxliff/Shwv2Mqxliff';

export async function shwv2xlfLike(filepath: string, xmlContent: string, shwvUnits: ShWvUnit[]): Promise<string> {
    const ext = path.extname(filepath).toLowerCase();

    switch (ext) {
        case '.xlf':
        case '.xliff':
            return await shwv2xlf(xmlContent, shwvUnits);
        case '.sdlxliff':
            return await shwv2sdlxliff(xmlContent, shwvUnits);
        case '.mxliff':
            return await shwv2mxliff(xmlContent, shwvUnits);
        case '.mqxliff':
            return await shwv2mqxliff(xmlContent, shwvUnits);
        default:
            return await shwv2xlf(xmlContent, shwvUnits);
    }
}
