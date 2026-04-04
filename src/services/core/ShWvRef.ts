import { ShWvRefTb } from "./ShWvRefTb";
import { ShWvRefTm } from "./ShWvRefTm";

export class ShWvRef {
    tms: ShWvRefTm[];
    tb: ShWvRefTb[];
    quoted: number[][];

    constructor() {
        this.tms = [];
        this.tb = [];
        this.quoted = []
    }
}