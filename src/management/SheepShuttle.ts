import * as fs from 'fs';
import * as path from 'path';
import { ShWvData } from '../services/core/ShWvData';

export class SheepShuttle {
    /**
     * Generate a JSON file containing only src and tgt from ShWvData.
     * @param data ShWvData instance
     * @param outputPath Path to save the JSON file
     */
    public static exportToJson(data: ShWvData, outputPath: string): void {
        const pairs = data.body.units.map(unit => ({
            src: unit.src,
            tgt: unit.tgt || unit.pre || ""
        }));
        
        fs.writeFileSync(outputPath, JSON.stringify(pairs, null, 2), 'utf-8');
    }

    /**
     * Generate a CSV file containing src and tgt from ShWvData.
     * @param data ShWvData instance
     * @param outputPath Path to save the CSV file
     */
    public static exportToCsv(data: ShWvData, outputPath: string): void {
        const header = "src,tgt\n";
        const rows = data.body.units.map(unit => {
            const src = `"${unit.src.replace(/"/g, '""')}"`;
            const tgtText = unit.tgt || unit.pre || "";
            const tgt = `"${tgtText.replace(/"/g, '""')}"`;
            return `${src},${tgt}`;
        });
        
        fs.writeFileSync(outputPath, header + rows.join('\n'), 'utf-8');
    }

    // ==========================================
    // 2. 分割・合体 (Split / Merge)
    // ==========================================

    /**
     * ShWvData をファイル単位で分割して JSON ファイル群を出力します。
     * @param data ShWvData instance
     * @param outDir 出力先ディレクトリ
     */
    public static splitByFile(data: ShWvData, outDir: string): void {
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        
        for (const file of data.meta.files) {
            const fileUnits = data.body.units.slice(file.start, file.end + 1);
            const pairs = fileUnits.map(unit => ({
                src: unit.src,
                tgt: unit.tgt || unit.pre || ""
            }));
            
            // Generate a safe file name based on original name
            const parsedName = path.parse(file.name);
            const outPath = path.join(outDir, `${parsedName.name}.json`);
            fs.writeFileSync(outPath, JSON.stringify(pairs, null, 2), 'utf-8');
        }
    }

    /**
     * ShWvData を文字数単位で分割して複数チャンクの JSON ファイル群を出力します。
     * @param data ShWvData instance
     * @param maxLength チャンクの最大文字数（JSON文字列化した際の長さで概算）
     * @param outDir 出力先ディレクトリ
     */
    public static splitByLength(data: ShWvData, maxLength: number, outDir: string): void {
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        let chunkIdx = 0;
        let currentLen = 0;
        let currentChunk: any[] = [];
        
        for (const unit of data.body.units) {
            const tgtText = unit.tgt || unit.pre || "";
            const pair = { src: unit.src, tgt: tgtText };
            const pairStr = JSON.stringify(pair);
            const len = pairStr.length;

            if (currentLen + len > maxLength && currentChunk.length > 0) {
                const outPath = path.join(outDir, `chunk_${chunkIdx.toString().padStart(3, '0')}.json`);
                fs.writeFileSync(outPath, JSON.stringify(currentChunk, null, 2), 'utf-8');
                
                chunkIdx++;
                currentChunk = [];
                currentLen = 0;
            }

            currentChunk.push(pair);
            currentLen += len;
        }

        if (currentChunk.length > 0) {
            const outPath = path.join(outDir, `chunk_${chunkIdx.toString().padStart(3, '0')}.json`);
            fs.writeFileSync(outPath, JSON.stringify(currentChunk, null, 2), 'utf-8');
        }
    }

    /**
     * 分割された JSON ファイルをすべて読み込み、1つの配列として結合・出力します。
     * @param inputDir 入力ディレクトリ
     * @param outputFile 出力先ファイルパス
     */
    public static mergeFiles(inputDir: string, outputFile: string): void {
        const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json')).sort();
        const merged: any[] = [];
        
        for (const f of files) {
            const content = fs.readFileSync(path.join(inputDir, f), 'utf-8');
            try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    merged.push(...parsed);
                }
            } catch (e) {
                console.error(`Failed to parse ${f}`);
            }
        }
        
        fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2), 'utf-8');
    }

    // ==========================================
    // 3. SheepLint との連携 (SheepLint Integration)
    // ==========================================

    /**
     * {src, tgt, history: [{src, tgt}, ...]} 形式の JSONL ファイルを出力します。
     * history には TM などの参照情報を埋め込みます。
     * @param data ShWvData instance
     * @param outputPath 出力先ファイルパス
     */
    public static exportToJsonl(data: ShWvData, outputPath: string): void {
        const stream = fs.createWriteStream(outputPath, { encoding: 'utf-8' });
        for (const unit of data.body.units) {
            const tgtText = unit.tgt || unit.pre || "";
            const historyObj = (unit.ref && unit.ref.tms) ? unit.ref.tms.map(tm => ({ src: tm.src, tgt: tm.tgt })) : [];
            
            const obj = {
                src: unit.src,
                tgt: tgtText,
                history: historyObj
            };
            stream.write(JSON.stringify(obj) + '\n');
        }
        stream.end();
    }

    /**
     * SheepLint リクエスト用に、{index, src, tgt, history: ...} の配列をチャンクごとの JSON 配列にまとめ、
     * 1行に1つの配列（チャンク）を出力する変則 JSONL 形式の文字列を返します。
     * @param data ShWvData instance
     * @param maxCharsPerLine 1行あたりの最大文字数（概算）
     * @returns チャンク分割された変則 JSONL 文字列
     */
    public static chunkJsonl(data: ShWvData, maxCharsPerLine: number): string {
        const lines: string[] = [];
        let currentChunk: any[] = [];
        let currentLen = 0;

        for (const unit of data.body.units) {
            const tgtText = unit.tgt || unit.pre || "";
            const historyObj = (unit.ref && unit.ref.tms) ? unit.ref.tms.map(tm => ({ src: tm.src, tgt: tm.tgt })) : [];
            
            const obj = {
                index: unit.idx,
                src: unit.src,
                tgt: tgtText,
                history: historyObj
            };
            const strObj = JSON.stringify(obj);
            const len = strObj.length;

            if (currentLen + len > maxCharsPerLine && currentChunk.length > 0) {
                lines.push(JSON.stringify(currentChunk));
                currentChunk = [];
                currentLen = 0;
            }

            currentChunk.push(obj);
            currentLen += len;
        }

        if (currentChunk.length > 0) {
            lines.push(JSON.stringify(currentChunk));
        }

        return lines.join('\n');
    }

    /**
     * 変則 JSONL ファイルからデータを読み込み、ShWvData を更新します。
     * - tgt が空の場合: 前翻訳 (MT) とみなし、pre に代入します。
     * - tgt がある場合: 校正/修正結果とみなし、tgt を更新します。
     * @param data ShWvData instance
     * @param jsonlPath 入力する JSONL ファイルパス
     */
    public static updateFromJsonl(data: ShWvData, jsonlPath: string): void {
        if (!fs.existsSync(jsonlPath)) return;
        
        const content = fs.readFileSync(jsonlPath, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
            if (line.trim().length === 0) continue;
            
            try {
                const chunk = JSON.parse(line);
                if (Array.isArray(chunk)) {
                    for (const item of chunk) {
                        const unit = data.body.units.find(u => u.idx === item.index);
                        if (unit) {
                            if (item.tgt && item.tgt.trim() !== "") {
                                // tgt が存在する場合：校正結果として tgt を更新
                                unit.tgt = item.tgt;
                            } else {
                                // tgt が空の場合：前翻訳結果として pre を更新
                                unit.pre = item.src;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to parse JSONL line", e);
            }
        }
    }
}
