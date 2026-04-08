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
        moveCursor(newPos: number, textInOldPos: string) {
            const oldUnit = this.units[this.crtPos];
            if (oldUnit) {
                oldUnit.tgt = textInOldPos;

                // 同一文を引用している他の行(TM)のtgtも同期する
                if (oldUnit.ref && oldUnit.ref.quoted) {
                    for (const [quotedIdx, ratio] of oldUnit.ref.quoted) {
                        const referencingUnit = this.units.find(u => u.idx === quotedIdx);
                        if (referencingUnit) {
                            const tmRef = referencingUnit.ref.tms.find(tm => tm.idx === oldUnit.idx);
                            if (tmRef) {
                                tmRef.tgt = textInOldPos;
                            }
                        }
                    }
                }
            }
            this.crtPos = newPos;
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
