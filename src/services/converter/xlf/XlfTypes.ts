export interface XlfJsTopSchema {
    xliff: {
        $: Partial<XlfJsTopMetaSchema>
        file: Partial<XlfJsFileSchema>[]
    }
}

export interface XlfJsTopMetaSchema {
    version: string
    xmlns: string
    [key: string]: string | undefined
}

export interface XlfJsFileSchema {
    $: Partial<XlfJsFileMetaSchema>
    header: (Partial<XlfJsFileHeaderSchema> & Record<string, any>)[]
    body: Array<{
        "trans-unit"?: Partial<XlfJsTransUnitSchema>[]
        group?: any[]
        [key: string]: any
    }>
}

export interface XlfJsFileMetaSchema {
    id: string
    original: string
    "source-language": string
    "target-language": string
    datatype: string
    "project-id"?: string
    "tool-id"?: string
    [key: string]: string | undefined
}

export interface XlfJsFileHeaderSchema {
    tool: Array<{
        $: {
            "tool-id": string
            "tool-name": string
            "tool-version": string
        }
    }>
}

export interface XlfJsTransUnitSchema {
    $: Partial<XlfJsTransUnitMetaSchema> & Record<string, any>
    source: any[]
    target: Partial<XlfJsTransUnitTargetSchema>[]
    "context-group"?: XlfJsContextGroupSchema[]
    [key: string]: any
}

export interface XlfJsTransUnitMetaSchema {
    id: string
    resname?: string
    [key: string]: string | undefined
}

export interface XlfJsTransUnitTargetSchema {
    _: string
    $: {
        state: string
    }
}

export interface XlfJsContextGroupSchema {
    $: {
        "context-type": string
    }
    context: XlfJsContextSchema[]
}

export interface XlfJsContextSchema {
    _: string
    $: {
        "context-type": string
    }
}
