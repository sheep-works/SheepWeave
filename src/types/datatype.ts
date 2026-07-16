// Re-export all ShWvData types from SheepComb (single source of truth)
export type {
    TranslationPair,
    TranslationPairWithFile,
    ShWvDefine,
    ShWvFileInfo,
    ShWvMeta,
    ShWvBody,
    ShWvUnit,
    ShWvRef,
    ShWvRefTm,
    ShWvRefTb,
    ShWvData,
    ExportPair,
    ChunkedJsonlItem,
    ManagedDataType,
    ProcessorOptions,
    ProjectFileStatus,
    ProjectGroup,
    ProjectStats,
    ProjectInfo,
} from '../../modules/SheepComb/packages/types/src/index';

export declare type ExtractMode = "source" | "target" | "both-horizontal" | "both-vertical";
