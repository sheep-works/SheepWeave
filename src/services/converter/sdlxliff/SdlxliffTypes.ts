import type { XlfJsTopMetaSchema, XlfJsFileSchema, XlfJsFileMetaSchema, XlfJsTransUnitSchema } from '../xlf/XlfTypes';

export interface SdlxliffJsTopSchema {
    xliff: {
        $: Partial<XlfJsTopMetaSchema> & {
            "sdl:version": string;
        };
        "doc-info"?: SdlxliffJsDocInfoSchema[];
        file: Partial<SdlxliffJsFileSchema>[];
    }
}

export interface SdlxliffJsDocInfoSchema {
    $: {
        xmlns: string;
    };
    "rep-defs"?: Array<{
        "rep-def": Array<{
            $: { id: string };
            entry: Array<{
                $: { tu: string; seg: string };
            }>;
        }>;
    }>;
}

export interface SdlxliffJsFileSchema extends Omit<XlfJsFileSchema, 'body'> {
    $: Partial<XlfJsFileMetaSchema> & {
        "sdl:ref": string;
        [key: string]: string | undefined;
    };
    body: Array<{
        group: SdlxliffJsGroupSchema[];
        "trans-unit": SdlxliffJsTransUnitSchema[];
    }>;
}

export interface SdlxliffJsGroupSchema {
    $: {
        id: string;
        "sdl:node-id"?: string;
    };
    "trans-unit"?: SdlxliffJsTransUnitSchema[];
    group?: SdlxliffJsGroupSchema[];
}

export interface SdlxliffJsTransUnitSchema extends Omit<XlfJsTransUnitSchema, '$' | 'source' | 'target'> {
    $: {
        id: string;
        "sdl:conf"?: string;
        "sdl:locked"?: string;
        "sdl:origin"?: string;
        [key: string]: any;
    };
    source: any[];
    target: any[];
    "context-group"?: any[];
    "sdl:seg-defs"?: Array<{
        "sdl:seg": Array<{
            $: { id: string; conf?: string; locked?: string };
        }>;
    }>;
}
