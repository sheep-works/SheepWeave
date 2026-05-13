
import * as flexsearch from 'flexsearch';
import type { TranslationPair, ShWvData } from '../../types/datatype';

export interface SearchEntry {
    id: number;
    src: string;
    tgt: string;
    file?: string;
    note?: string;
}

/**
 * Component for character-level concordance search using FlexSearch.
 * Optimized for CJK (Chinese, Japanese, Korean) text.
 * Adapted from SheepComb for use in SheepWeave extension.
 */
export class ShuttleSearch {
    private index: any;
    private entries: SearchEntry[] = [];
    private config: any;

    constructor() {
        this.config = {
            document: {
                id: "id",
                index: ["src", "tgt"],
                store: ["src", "tgt", "file", "note"]
            },
            tokenize: "strict",
            // Custom encoder to generate N-grams (Bi-gram + Uni-gram)
            encode: (str: string) => {
                if (!str) return [];
                const s = str.toLowerCase();
                const tokens: string[] = [];
                for (let i = 0; i < s.length; i++) {
                    tokens.push(s[i]!); // Uni-gram
                    if (i < s.length - 1) {
                        tokens.push(s.substring(i, i + 2)); // Bi-gram
                    }
                }
                return tokens;
            }
        };

        try {
            const fs: any = flexsearch;
            const FlexDocument = fs && (fs.Document || fs.default?.Document || fs);
            if (!FlexDocument) {
                throw new Error("FlexSearch Document constructor not found");
            }
            this.index = new FlexDocument(this.config);
        } catch (e) {
            console.error("[ShuttleSearch] Failed to initialize FlexSearch:", e);
            // Initialize a dummy index to avoid crashing the extension activation
            this.index = {
                add: () => {},
                search: () => [],
                clear: () => {},
                import: () => {},
                export: () => {}
            };
        }
    }

    /**
     * Index raw TranslationPair array.
     */
    public indexUnits(units: TranslationPair[]): void {
        const newEntries = units.map((u, i) => ({
            id: i,
            src: u.src,
            tgt: u.tgt || '',
            note: u.note || ''
        }));
        this.entries.push(...newEntries);

        for (const entry of newEntries) {
            this.index.add(entry);
        }
    }

    /**
     * Index structured ShWvData.
     */
    public indexShwvData(data: ShWvData): void {
        const newEntries = data.body.units.map(u => {
            const fileInfo = data.meta.files.find(f => u.idx >= f.start && u.idx <= f.end);
            return {
                id: u.idx,
                src: u.src,
                tgt: u.tgt || u.pre || '',
                file: fileInfo?.name || '',
                note: u.note || ''
            };
        });
        this.entries.push(...newEntries);

        for (const entry of newEntries) {
            this.index.add(entry);
        }
    }

    /**
     * Perform a concordance search.
     * @param query The search string
     * @param mode Search mode: 'source', 'target', or 'both'
     * @param limit Maximum results (default 50)
     */
    public search(query: string, mode: 'source' | 'target' | 'both' = 'both', limit: number = 50) {
        if (!query || query.trim() === '') return [];

        const searchOptions: any = {
            limit: limit * 5,
            enrich: true,
            bool: "and"
        };
        if (mode === 'source') searchOptions.index = "src";
        else if (mode === 'target') searchOptions.index = "tgt";

        const results = this.index.search(query, searchOptions);

        const seenIds = new Set<number>();
        const candidates: SearchEntry[] = [];

        for (const fieldRes of results) {
            // Results can be an array of field results or a direct result array depending on config
            const items = fieldRes.result ? fieldRes.result : (Array.isArray(fieldRes) ? fieldRes : []);
            for (const item of items) {
                const id = typeof item === 'object' ? item.id : item;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    // If stored in index, use it, otherwise find in entries
                    candidates.push(item.doc || this.entries.find(e => e.id === id));
                }
            }
        }

        // Strict post-filtering to ensure match is present (FlexSearch can be fuzzy)
        const q = query.toLowerCase();
        const finalResults = candidates.filter(entry => {
            if (!entry) return false;
            const srcMatch = entry.src && entry.src.toLowerCase().includes(q);
            const tgtMatch = entry.tgt && entry.tgt.toLowerCase().includes(q);
            if (mode === 'source') return srcMatch;
            if (mode === 'target') return tgtMatch;
            return srcMatch || tgtMatch;
        });

        return finalResults.slice(0, limit);
    }

    /**
     * Clear all indexed data and reset the index instance.
     */
    public clear(): void {
        this.entries = [];
        const fs: any = flexsearch;
        const FlexDocument = fs && (fs.Document || fs.default?.Document || fs);
        this.index = new FlexDocument(this.config);
    }
}
