import type { XlfJsTopMetaSchema, XlfJsFileSchema, XlfJsFileMetaSchema, XlfJsTransUnitSchema } from '../xlf/XlfTypes';

export interface MxliffJsTopSchema {
    xliff: {
        $: Partial<XlfJsTopMetaSchema> & {
            "xmlns:m": string;
            "m:version": string;
            "m:level": string;
        };
        file: Partial<MxliffJsFileSchema>[];
    }
}

export interface MxliffJsFileSchema extends Omit<XlfJsFileSchema, 'body'> {
    $: Partial<XlfJsFileMetaSchema> & {
        "m:file-format": string;
        "m:task-id": string;
        "m:job-uid": string;
        [key: string]: string | undefined;
    };
    header: Array<{
        "m:in-ctx-preview-skel"?: Array<{
            _: string; // This will hold the CDATA content
            $: {
                bilingual: string;
            }
        }>;
    }>;
    body: Array<{
        group: MxliffJsGroupSchema[];
    }>;
}

export interface MxliffJsGroupSchema {
    $: {
        id: string;
        "m:para-id": string;
    };
    "context-group"?: any[];
    "trans-unit": MxliffJsTransUnitSchema[];
}

export interface MxliffJsTransUnitSchema extends Omit<XlfJsTransUnitSchema, '$'> {
    $: {
        id: string;
        "xml:space": string;
        "m:score": string;
        "m:confirmed": string;
        "m:locked": string;
        "m:para-id": string;
        [key: string]: string | undefined;
    };
}
