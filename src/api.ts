import * as vscode from 'vscode';
import type { ShWvUnit } from './types/datatype';
import { globalDirector } from './store';

export interface ActiveUnitChangeEvent {
    /** 0-indexed line/unit number */
    index: number;
    /** Source text */
    source: string;
    /** Current target text */
    target: string;
    /** Note / comment / metadata */
    note?: string;
    /** Status of the unit (0: unconfirmed, >=1: confirmed) */
    status?: number;
    /** Full unit data if available */
    unit?: ShWvUnit;
}

export interface SheepWeavePublicApi {
    /**
     * Fired when the active unit/line in an active SheepWeave editor changes (debounced).
     */
    readonly onDidChangeActiveUnit: vscode.Event<ActiveUnitChangeEvent>;

    /**
     * Gets the currently active unit event data.
     */
    getActiveUnit(): ActiveUnitChangeEvent | null;
}

export const onDidChangeActiveUnitEmitter = new vscode.EventEmitter<ActiveUnitChangeEvent>();
let currentActiveUnitData: ActiveUnitChangeEvent | null = null;

/**
 * Emits active unit change event for external consumers / sub-extensions.
 */
export function emitActiveUnitChange(editor: vscode.TextEditor, lineNumber?: number) {
    if (!editor || !editor.document) return;

    const fileName = editor.document.fileName.toLowerCase();
    const isSource = fileName.endsWith('.shwvs');
    const isTarget = fileName.endsWith('.shwvt');
    if (!isSource && !isTarget) return;

    const line = lineNumber !== undefined ? lineNumber : (editor.selection ? editor.selection.active.line : 0);
    if (line < 0 || line >= editor.document.lineCount) return;

    const unit = globalDirector.state.body.units[line] || globalDirector.state.body.units.find(u => u.idx === line);
    const lineText = editor.document.lineAt(line).text;

    const eventData: ActiveUnitChangeEvent = {
        index: line,
        source: unit ? unit.src : (isSource ? lineText : ''),
        target: isTarget ? lineText : (unit ? unit.tgt : ''),
        note: unit?.note,
        status: unit?.status ?? 0,
        unit: unit
    };

    currentActiveUnitData = eventData;
    onDidChangeActiveUnitEmitter.fire(eventData);
}

export function createPublicApi(): SheepWeavePublicApi {
    return {
        onDidChangeActiveUnit: onDidChangeActiveUnitEmitter.event,
        getActiveUnit: () => currentActiveUnitData
    };
}
