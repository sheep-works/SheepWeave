import * as path from 'path';
import type { TranslationPair } from '../../types/datatype';
import { xlf2Pairs } from './xlf/XlfParser';
import { sdlxliff2Pairs } from './sdlxliff/SdlxliffParser';
import { mxliff2Pairs } from './mxliff/MxliffParser';
import { mqxliff2Pairs } from './mqxliff/MqxliffParser';

export async function xlfLike2Pairs(filepath: string, content: string, startIdx: number): Promise<TranslationPair[]> {
    const ext = path.extname(filepath).toLowerCase();

    switch (ext) {
        case '.xlf':
        case '.xliff':
            return await xlf2Pairs(content, startIdx);
        case '.sdlxliff':
            return await sdlxliff2Pairs(content, startIdx);
        case '.mxliff':
            return await mxliff2Pairs(content, startIdx);
        case '.mqxliff':
            return await mqxliff2Pairs(content, startIdx);
        default:
            return await xlf2Pairs(content, startIdx);
    }
}
