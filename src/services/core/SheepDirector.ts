import { ShWvData } from './ShWvData';

export class SheepDirector {
    public state: ShWvData;
    public lastLine: number = -1;
    public confirmedLines: Set<number> = new Set();
    public proofedLines: Set<number> = new Set();

    constructor() {
        this.state = new ShWvData();
    }

    /**
     * Re-initializes state based on loaded units. Should be called after parsing/loading data.
     */
    public initializeFromState() {
        this.confirmedLines.clear();
        this.proofedLines.clear();
        for (const unit of this.state.body.units) {
            if (unit.status === 1) {
                this.confirmedLines.add(unit.idx);
            } else if (unit.status === 2) {
                this.proofedLines.add(unit.idx);
            }
        }
    }

    /**
     * Updates the target text of a line without confirming it.
     * Use this during typing/cursor movements. Does NOT propagate to quoting segments.
     */
    public updateTargetOnly(lineIdx: number, text: string) {
        const unit = this.state.body.units.find(u => u.idx === lineIdx);
        if (unit) {
            unit.tgt = text;
        }
    }

    /**
     * Explicitly confirms a line.
     * Updates target, sets status to 1, and propagates the translation to referring memory segments.
     */
    public confirmLine(lineIdx: number, text: string) {
        const unit = this.state.body.units.find(u => u.idx === lineIdx);
        if (!unit) return;

        unit.status = 1;
        this.confirmedLines.add(lineIdx);
        
        // This method intrinsically updates the unit and propagates to ref.quoted
        this.state.updateUnitTarget(lineIdx, text);
    }

    /**
     * Unconfirms a line.
     * Usually called when a confirmed line is edited.
     */
    public unconfirmLine(lineIdx: number) {
        const unit = this.state.body.units.find(u => u.idx === lineIdx);
        if (!unit) return;

        unit.status = 0;
        this.confirmedLines.delete(lineIdx);
        // Note: We do NOT rollback `tgt` or update ref.quoted here,
        // it just loses its confirmed status.
    }
}
