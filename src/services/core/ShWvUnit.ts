import { TranslationPair } from "../../types/datatype";
import { ShWvRef } from "./ShWvRef";

export class ShWvUnit {
    idx: number;
    src: string;
    pre: string;
    tgt: string;
    note?: string;
    isSub?: boolean;
    status: 0 | 1 | 2;
    ref: ShWvRef;
    placeholders?: Record<number, string>;

    constructor(pair: TranslationPair) {
        this.idx = pair.idx;
        this.src = pair.src;
        this.pre = pair.tgt;
        this.tgt = "";
        this.note = pair.note;
        this.isSub = pair.isSub;
        this.status = (pair as any).status || 0;
        this.ref = new ShWvRef();
        this.placeholders = pair.placeholders;
    }
}
