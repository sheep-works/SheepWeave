import { defineStore } from 'pinia';
import type { ShWvMeta, ShWvUnit } from '../../../src/types/datatype';

export const useShWvStore = defineStore('shwv', {
    state: () => ({
        meta: null as ShWvMeta | null,
        units: [] as ShWvUnit[],
        crtPos: 0,
        maxPos: 0,
    }),
    actions: {
        loadData(data: { meta: ShWvMeta; units: ShWvUnit[] }) {
            this.meta = data.meta;
            this.units = data.units || [];
            this.maxPos = this.units.length - 1;
            console.log('ShWvData loaded into store:', data);
        },
        clearData() {
            this.meta = null;
            this.units = [];
        },
        moveCursor(newPos: number, textInOldPos: string, status?: number) {
            const oldUnit = this.units[this.crtPos];
            if (oldUnit) {
                oldUnit.tgt = textInOldPos;
                if (status !== undefined) {
                    oldUnit.status = status as 0 | 1 | 2;
                }
                this.propagateTranslation(this.crtPos, textInOldPos);
            }
            this.crtPos = newPos;
        },
        /**
         * Propagates a translation to all units that have quoted this unit as a TM match.
         */
        propagateTranslation(sourceIdx: number, text: string) {
            const sourceUnit = this.units[sourceIdx];
            if (!sourceUnit || !sourceUnit.ref) return;

            // Synchronize tgt to all the units that quoted this sentence as TM (Fuzzy)
            if (sourceUnit.ref.quoted) {
                for (const [quotedIdx, ratio] of sourceUnit.ref.quoted) {
                    const referencingUnit = this.units.find(u => u.idx === quotedIdx);
                    if (referencingUnit) {
                        const tmRef = referencingUnit.ref.tms.find(tm => tm.idx === sourceUnit.idx);
                        if (tmRef) {
                            tmRef.tgt = text;
                        }
                    }
                }
            }

            // Synchronize tgt to all the units that quoted this sentence as TM (100%)
            if (sourceUnit.ref.quoted100) {
                for (const quotedIdx of sourceUnit.ref.quoted100) {
                    const referencingUnit = this.units.find(u => u.idx === quotedIdx);
                    if (referencingUnit) {
                        const tmRef = referencingUnit.ref.tms.find(tm => tm.idx === sourceUnit.idx);
                        if (tmRef) {
                            tmRef.tgt = text;
                        }
                    }
                }
            }
        }
    },
    getters: {
        hasData: (state) => !!state.meta,
        totalSegments: (state) => state.units.length,
        sourceLang: (state) => state.meta?.sourceLang || '',
        targetLang: (state) => state.meta?.targetLang || '',
        crtUnit: (state) => state.units[state.crtPos] || {
            src: '-- N/A --',
            tgt: '-- N/A --',
        },
    }
});
