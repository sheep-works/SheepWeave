import { defineStore } from 'pinia';
import type { ShWvMeta, ShWvUnit, ProjectInfo } from '../../../src/types/datatype';

const DEFAULT_LLM_PROMPT = `あなたはプロの翻訳者および翻訳チェッカーです。
ユーザーからJSONL形式のリスト（各要素に idx, src, tgt, notes, history 等を含む配列）が渡されます。
idx は各行のインデックス（行番号）に対応しています。

# 入力データのスキーマ
- idx: 行番号
- src: 原文({source_lang})
- tgt: 現在の訳文または下訳({target_lang})
- note: 備考

# タスク
各行の原文(src)および文脈を考慮し、自然で正確な訳文({target_lang})を作成または修正してください。

# 出力形式
必ず以下の形式で1行につき1セグメントずつ、全対象行の出力を行ってください。余計な解説やコードブロック記号は含めないでください。

行番号: 訳文

(例)
0: 訳文のテキスト
1: 訳文のテキスト`;

export const useShWvStore = defineStore('shwv', {
    state: () => ({
        meta: null as ShWvMeta | null,
        units: [] as ShWvUnit[],
        projectInfo: null as ProjectInfo | null,
        phrases: [] as { input: string, phrase: string }[],
        concordanceData: null as { query: string, mode: string, tbMatches: any[], tmMatches: any[], currentDocumentMatches: any[] } | null,
        crtPos: 0,
        maxPos: 0,
        llmUnits: [] as any[],
        llmChunkOptions: {
            src: true,
            tgt: true,
            note: true,
            history: false,
            terms: false
        },
        llmResponse: '',
        llmPrompt: DEFAULT_LLM_PROMPT,
        llmRequesting: false,
        llmMode: 'normal' as 'normal' | 'advanced',
        llmBatchRunning: false,
        llmBatchProgress: { current: 0, total: 0, status: '' },
    }),
    actions: {
        setConcordanceData(data: { query: string, mode: string, tbMatches: any[], tmMatches: any[], currentDocumentMatches: any[] }) {
            this.concordanceData = data;
        },
        loadData(data: { meta: ShWvMeta; units: ShWvUnit[]; phrases?: { input: string, phrase: string }[]; projectInfo?: ProjectInfo }) {
            this.meta = data.meta;
            this.units = data.units || [];
            this.phrases = data.phrases || [];
            this.projectInfo = data.projectInfo || null;
            this.maxPos = this.units.length - 1;
            console.log('ShWvData loaded into store:', data);
        },
        updateUnits(updatedUnits: ShWvUnit[]) {
            for (const newUnit of updatedUnits) {
                const index = this.units.findIndex(u => u.idx === newUnit.idx);
                if (index !== -1) {
                    // リアクティビティを確実にするため、新しいオブジェクトとして代入
                    this.units[index] = { ...newUnit };
                }
            }
            // 配列全体の再代入で確実にVueに通知
            this.units = [...this.units];
            console.log(`Incremental update: ${updatedUnits.length} units synchronized to store.`);
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
            }
            this.crtPos = newPos;
        },

        getFilteredUnits(src: string, tgt: string): (ShWvUnit & { ori: string })[] {
            const s = src?.toLowerCase();
            const t = tgt?.toLowerCase();
            return this.units
                .filter(unit => {
                    if (s && !(unit.src || "").toLowerCase().includes(s)) return false;
                    if (t && !(unit.tgt || "").toLowerCase().includes(t)) return false;
                    return true;
                })
                .map(unit => ({ ...unit, ori: unit.tgt }));
        },
        setLlmUnits(units: any[]) {
            this.llmUnits = units;
        },
        setLlmResponse(response: string) {
            this.llmResponse = response;
        },
        setLlmRequesting(requesting: boolean) {
            this.llmRequesting = requesting;
        },
        resetLlmPrompt() {
            this.llmPrompt = DEFAULT_LLM_PROMPT;
        },
        setLlmMode(mode: 'normal' | 'advanced') {
            this.llmMode = mode;
        },
        setLlmBatchRunning(running: boolean) {
            this.llmBatchRunning = running;
        },
        setLlmBatchProgress(progress: { current: number, total: number, status?: string }) {
            this.llmBatchProgress = {
                current: progress.current,
                total: progress.total,
                status: progress.status || ''
            };
        },
        setLlmPrompt(prompt: string) {
            this.llmPrompt = prompt;
        }
    },
    getters: {
        hasData: (state) => !!state.meta,
        totalSegments: (state) => state.units.length,
        sourceLang: (state) => state.meta?.sourceLang || state.projectInfo?.sourceLanguage || '',
        targetLang: (state) => state.meta?.targetLang || state.projectInfo?.targetLanguage || '',
        projectName: (state) => state.meta?.projectName || state.projectInfo?.projectName || '',
        crtUnit: (state) => state.units[state.crtPos] || {
            src: '-- N/A --',
            tgt: '-- N/A --',
        },
        llmChunk(state) {
            if (!state.llmUnits || state.llmUnits.length === 0) return '';
            const chunkArray = state.llmUnits.map((unit: any) => {
                const historyObj = (unit.ref?.tms && state.llmChunkOptions.history)
                    ? unit.ref.tms
                        .slice()
                        .sort((a: any, b: any) => b.ratio - a.ratio)
                        .slice(0, 2)
                        .map((tm: any) => ({ src: tm.src, tgt: tm.tgt, diff: tm.diff }))
                    : [];

                const termsObj = (unit.ref?.tb && state.llmChunkOptions.terms) ? unit.ref.tb : [];

                const obj: any = {
                    idx: unit.idx
                };
                if (state.llmChunkOptions.src) obj.src = unit.src;
                if (state.llmChunkOptions.tgt) obj.tgt = unit.tgt || unit.pre || '';
                if (state.llmChunkOptions.note && unit.note) obj.note = unit.note;
                if (historyObj.length > 0) obj.history = historyObj;
                if (termsObj.length > 0) obj.terms = termsObj;
                return obj;
            });
            return JSON.stringify(chunkArray);
        }
    }
});
