export declare type ExtractMode = "source" | "target" | "both-horizontal" | "both-vertical";

export { LmLgFileInfo } from '../services/core/LmLgFileInfo';
export { LmLgMeta } from '../services/core/LmLgMeta';
export { LmLgBody } from '../services/core/LmLgBody';
export { LmLgUnit } from '../services/core/LmLgUnit';

export interface TranslationPair {
    idx: number;
    src: string;
    tgt: string;
    note?: string;
    isSub?: boolean;
}
