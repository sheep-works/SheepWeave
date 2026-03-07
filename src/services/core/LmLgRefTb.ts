export class LmLgRefTb {
    terms: LmLgRefTbEntry[];

    constructor() {
        this.terms = [];
    }
}

export interface LmLgRefTbEntry {
    src: string;
    tgts: string[];
    note?: string;
}