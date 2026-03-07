import { TranslationPair } from "../../types/datatype";
import { LmLgRef } from "./LmLgRef";

export class LmLgUnit {
    idx: number;
    src: string;
    pre: string;
    tgt: string;
    note?: string;
    isSub?: boolean;
    ref: LmLgRef;

    constructor(pair: TranslationPair) {
        this.idx = pair.idx;
        this.src = pair.src;
        this.pre = pair.tgt;
        this.tgt = "";
        this.note = pair.note;
        this.isSub = pair.isSub;
        this.ref = new LmLgRef();
    }
}
