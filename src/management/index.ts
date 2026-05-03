/**
 * SheepShuttle wrapper — provides static file I/O methods using local ShuttleManager adapter.
 * This replaces the old modules/SheepShuttle submodule dependency.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ShuttleManager } from '../services/core/ShuttleAdapter';

// Create a singleton manager instance
const manager = new ShuttleManager();

export class SheepShuttle {
    static exportToJson(data: any, outputPath: string): void {
        const pairs = manager.getPairs(data.body.units);
        fs.writeFileSync(outputPath, JSON.stringify(pairs, null, 2), 'utf-8');
    }

    static exportToCsv(data: any, outputPath: string): void {
        const csv = manager.formatCsv(manager.getPairs(data.body.units));
        fs.writeFileSync(outputPath, csv, 'utf-8');
    }

    static exportAsTmTb(data: any, tmPath: string, tbPath: string): void {
        SheepShuttle.exportAsTm(data, tmPath);
        SheepShuttle.exportAsTb(data, tbPath);
    }

    static exportAsTm(data: any, tmPath: string): void {
        const tm = data.body.units.map((unit: any) => ({
            src: unit.src,
            tgt: unit.tgt || unit.pre || ""
        }));
        fs.writeFileSync(tmPath, JSON.stringify(tm, null, 2), 'utf-8');
    }

    static exportAsTb(data: any, tbPath: string): void {
        const tb = data.body.terms || [];
        fs.writeFileSync(tbPath, JSON.stringify(tb, null, 2), 'utf-8');
    }

    static splitByFile(data: any, outDir: string): void {
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const shwvData = { define: { name: 'SHWV_DATA' as const, version: '1.0' as const }, meta: data.meta, body: data.body };
        const result = manager.splitByFile(shwvData);
        for (const [name, pairs] of result) {
            const outPath = path.join(outDir, name);
            fs.writeFileSync(outPath, JSON.stringify(pairs, null, 2), 'utf-8');
        }
    }

    static splitByLength(data: any, maxLength: number, outDir: string): void {
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const shwvData = { define: { name: 'SHWV_DATA' as const, version: '1.0' as const }, meta: data.meta, body: data.body };
        const result = manager.splitByLength(shwvData, maxLength);
        for (const [chunkIdx, pairs] of result) {
            const outPath = path.join(outDir, `chunk_${String(chunkIdx).padStart(3, '0')}.json`);
            fs.writeFileSync(outPath, JSON.stringify(pairs, null, 2), 'utf-8');
        }
    }

    static exportToJsonl(data: any, outputPath: string): void {
        const content = manager.getJsonlContent(data.body.units);
        fs.writeFileSync(outputPath, content, 'utf-8');
    }

    static chunkJsonl(data: any, maxCharsPerLine: number): string {
        const shwvData = { define: { name: 'SHWV_DATA' as const, version: '1.0' as const }, meta: data.meta, body: data.body };
        return manager.chunkJsonl(shwvData, maxCharsPerLine);
    }

    static updateFromJsonl(data: any, jsonlPath: string): void {
        if (!fs.existsSync(jsonlPath)) return;
        const content = fs.readFileSync(jsonlPath, 'utf-8');
        const shwvData = { define: { name: 'SHWV_DATA' as const, version: '1.0' as const }, meta: data.meta, body: data.body };
        const updatedUnits = manager.updateFromJsonl(shwvData, content);
        // Apply back to the original data
        data.body.units = updatedUnits;
    }
}
