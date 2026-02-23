export declare type ExtractMode = "source" | "target" | "both-horizontal" | "both-vertical";

export declare interface LmLgFileInfo {// 実装のデザイン案
    name: string;
    start: number;
    end: number;
}

export declare interface LmLgMeta {
    bilingualPath: string;
    files: LmLgFileInfo[]
    sourceLang: string;
    targetLang: string;
}

export declare interface LmLgBody {
    units: LmLgUnit[];
}

export declare interface LmLgUnit {
    idx: number;
    src: string;
    tgt: string;
    note?: string;
    isSub?: boolean;
}
