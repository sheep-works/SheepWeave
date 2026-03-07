export class LmLgRefTm {
    src: string;
    tgt: string;
    ratio: number;
    opcodes: string[][];

    constructor() {
        this.src = "";
        this.tgt = "";
        this.ratio = 0;
        this.opcodes = [];
    }
}