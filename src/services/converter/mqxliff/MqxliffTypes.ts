import type { XlfJsTopMetaSchema, XlfJsFileSchema, XlfJsFileMetaSchema, XlfJsTransUnitSchema } from '../xlf/XlfTypes';

export interface MqxliffJsTopSchema {
    xliff: {
        $: Partial<XlfJsTopMetaSchema> & {
            "xmlns:mq": string;
        };
        file: Partial<MqxliffJsFileSchema>[];
    }
}

export interface MqxliffJsFileSchema extends Omit<XlfJsFileSchema, 'body'> {
    $: Partial<XlfJsFileMetaSchema> & {
        "mq:id": string;
        "mq:projectid": string;
    };
    header: Array<{
        "mq:export-path"?: string[];
        "mq:docinformation"?: MqxliffJsDocInfoSchema[];
    }>;
    body: Array<{
        "trans-unit": MqxliffJsTransUnitSchema[];
    }>;
}

export interface MqxliffJsDocInfoSchema {
    $: {
        "mq:docname": string;
        [key: string]: string;
    };
    "mq:versioninfos"?: any[];
    "mq:tagdefinition"?: any[];
}

export interface MqxliffJsTransUnitSchema extends Omit<XlfJsTransUnitSchema, '$'> {
    $: {
        id: string;
        "mq:status"?: string;
        "mq:segmentguid"?: string;
        "mq:percent"?: string;
        [key: string]: any;
    };
    "mq:minorversions"?: any[];
    "mq:commitinfos"?: any[];
}
