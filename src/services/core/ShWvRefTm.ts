export class ShWvRefTm {
    idx: number;
    src: string;
    diff?: string;
    tgt: string;
    ratio: number;
    freeze?: boolean;
    file?: string;

    constructor() {
        this.idx = 0;
        this.src = "";
        this.tgt = "";
        this.ratio = 0;
    }
}