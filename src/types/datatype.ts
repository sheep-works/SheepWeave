export declare type ExtractMode = "source" | "target" | "both-horizontal" | "both-vertical";

export { ShWvFileInfo } from '../services/core/ShWvFileInfo';
export { ShWvMeta } from '../services/core/ShWvMeta';
export { ShWvBody } from '../services/core/ShWvBody';
export { ShWvUnit } from '../services/core/ShWvUnit';

export interface TranslationPair {
    idx: number;
    src: string;
    tgt: string;
    note?: string;
    isSub?: boolean;
}
