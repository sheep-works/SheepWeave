import { defineStore } from 'pinia';
import type { LmLgMeta, LmLgUnit } from '../../../src/types/datatype';

export const useLmLgStore = defineStore('lmlg', {
    state: () => ({
        meta: null as LmLgMeta | null,
        units: [] as LmLgUnit[],
        crtPos: 0,
        maxPos: 0,
    }),
    actions: {
        loadData(data: { meta: LmLgMeta; units: LmLgUnit[] }) {
            this.meta = data.meta;
            this.units = data.units || [];
            this.maxPos = this.units.length - 1;
            console.log('LmLgData loaded into store:', data);
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
