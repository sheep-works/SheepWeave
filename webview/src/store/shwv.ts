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
            if (this.units[this.crtPos]) {
                this.units[this.crtPos].tgt = textInOldPos;
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
