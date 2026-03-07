import { LmLgRefTb } from "./LmLgRefTb";
import { LmLgRefTm } from "./LmLgRefTm";

export class LmLgRef {
    tms: LmLgRefTm[];
    tb: LmLgRefTb[];
    quoted: number[];

    constructor() {
        this.tms = [];
        this.tb = [];
        this.quoted = []
    }
}