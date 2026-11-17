<script setup lang="ts">
import { computed } from 'vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import { IconPushpin, IconFileImage, IconPlayCircle, IconCode, IconEye, IconEyeInvisible, IconFile } from '@arco-design/web-vue/es/icon';
import { getVsCodeApi } from '../vscode';

const props = withDefaults(defineProps<{
    showSuffolkMeta?: boolean;
}>(), {
    showSuffolkMeta: true
});

const emit = defineEmits<{
    (e: 'toggleShowSuffolkMeta'): void;
}>();

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();

const handlePropagate = () => {
    const unit = shwvStore.crtUnit;
    if (unit && unit.ref.quoted100?.length > 0) {
        const vscode = getVsCodeApi();
        if (vscode) {
            vscode.postMessage({
                type: 'propagate-quoted',
                payload: { idx: unit.idx, tgt: unit.tgt }
            });
        }
    }
};

const togglePeRef = () => {
    const unit = shwvStore.crtUnit;
    if (unit) {
        unit.isPeRef = !unit.isPeRef;
        const vscode = getVsCodeApi();
        if (vscode) {
            vscode.postMessage({
                type: 'toggle-pe-ref',
                payload: { idx: unit.idx, isPeRef: unit.isPeRef }
            });
        }
    }
};

const rowspan = computed(() => {
    return Math.max(1, shwvStore.crtUnit?.ref?.tb?.length || 0);
});

interface ParsedMedia {
    img?: string;
    time?: string;
    [key: string]: any;
}

interface SuffolkMetaItem {
    raw: string;
    label: string;
    value: string;
}

const parsedNote = computed(() => {
    const unit = shwvStore.crtUnit;
    const raw = unit?.note ?? (unit as any)?.notes;
    let rawNote = '';
    if (Array.isArray(raw)) {
        rawNote = raw.filter(Boolean).join('\n');
    } else if (typeof raw === 'string') {
        rawNote = raw;
    } else if (raw) {
        rawNote = String(raw);
    }

    if (!rawNote) {
        return { text: '', suffolkMeta: [] as SuffolkMetaItem[], hasSf: false, media: null as ParsedMedia | null, rawMedia: '' };
    }

    // 1. Suffolk メタデータ (@sf[...]) の抽出
    const sfMatch = rawNote.match(/@sf\[(.*?)\]/);
    const suffolkMeta: SuffolkMetaItem[] = [];
    const hasSf = !!sfMatch;

    if (sfMatch) {
        const sfContent = sfMatch[1];
        // 例: "Sheet: Sheet1 | Cell: A2 | Style: 1"
        const parts = sfContent.split('|').map(p => p.trim()).filter(Boolean);
        for (const part of parts) {
            const sepIdx = part.indexOf(':');
            if (sepIdx !== -1) {
                suffolkMeta.push({
                    raw: part,
                    label: part.substring(0, sepIdx).trim(),
                    value: part.substring(sepIdx + 1).trim()
                });
            } else {
                suffolkMeta.push({
                    raw: part,
                    label: part,
                    value: ''
                });
            }
        }
    }

    // @sf[...] を除去した残りのテキスト
    let textWithoutSf = rawNote.replace(/@sf\[(.*?)\]/g, '').trim();

    // 2. メディアメタデータ (@md[[...]]) の抽出
    const mdMatch = textWithoutSf.match(/@md\[\[(.*?)\]\]/s);
    let media: ParsedMedia | null = null;
    let rawMedia = '';
    if (mdMatch) {
        rawMedia = mdMatch[1];
        try {
            media = JSON.parse(rawMedia);
        } catch { }
        textWithoutSf = textWithoutSf.replace(/@md\[\[(.*?)\]\]/s, '').trim();
    }

    return {
        text: textWithoutSf,
        suffolkMeta,
        hasSf,
        media,
        rawMedia
    };
});

const hasNote = computed(() => {
    const unit = shwvStore.crtUnit;
    const raw = unit?.note ?? (unit as any)?.notes;
    if (Array.isArray(raw)) return raw.length > 0;
    return !!raw;
});

// 表示すべき Note コンテンツがあるかどうか（非表示設定時の空欄化判定）
const shouldRenderNoteRow = computed(() => {
    if (!hasNote.value) return false;
    const p = parsedNote.value;
    if (p.text || p.media) return true;
    if (p.hasSf && props.showSuffolkMeta) return true;
    if (p.hasSf && !props.showSuffolkMeta) return true; // トグルボタンを表示するために行自体は表示
    return false;
});
</script>

<template>
    <tbody v-if="shwvStore.crtUnit" class="current-segment-body">
        <!-- ref.tb がある場合 -->
        <template v-if="shwvStore.crtUnit.ref.tb.length > 0">
            <tr v-for="(tb, tbx) in shwvStore.crtUnit.ref.tb" :key="tbx">
                <td v-if="tbx === 0" :rowspan="rowspan">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <span>{{ shwvStore.crtUnit.idx }}</span>
                        <a-button type="text" size="mini" @click="togglePeRef" :title="shwvStore.crtUnit.isPeRef ? 'Unpin PE Reference' : 'Pin as PE Reference'" style="padding: 0; height: auto;">
                            <template #icon>
                                <icon-pushpin :style="{ color: shwvStore.crtUnit.isPeRef ? '#f59e0b' : 'gray', fontSize: '14px' }" />
                            </template>
                        </a-button>
                        <a-tag v-if="shwvStore.crtUnit.ref.quoted100?.length > 0" color="green" size="small">
                            Q {{ shwvStore.crtUnit.ref.quoted100.length }}
                        </a-tag>
                    </div>
                </td>
                <td v-if="tbx === 0" :rowspan="rowspan">
                    {{ shwvStore.crtUnit.src }}
                </td>
                <td>{{ tb.src }}</td>
                <td>
                    <div v-if="tb.tgts && tb.tgts.length > 0">
                        {{ tb.tgts.join(' / ') }}
                    </div>
                    <!-- 禁止用語 (forbiddens) の表示 -->
                    <div v-if="tb.forbiddens && tb.forbiddens.length > 0" class="forbidden-terms">
                        <a-tag color="red" size="small">
                            禁止: {{ tb.forbiddens.join(', ') }}
                        </a-tag>
                    </div>
                    <div v-if="tb.file" class="file-text">{{ tb.file }}</div>
                </td>
            </tr>
        </template>

        <!-- ref.tb がない場合（1行表示） -->
        <tr v-else>
            <td>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <span>{{ shwvStore.crtUnit.idx }}</span>
                    <a-button type="text" size="mini" @click="togglePeRef" :title="shwvStore.crtUnit.isPeRef ? 'Unpin PE Reference' : 'Pin as PE Reference'" style="padding: 0; height: auto;">
                        <template #icon>
                            <icon-pushpin :style="{ color: shwvStore.crtUnit.isPeRef ? '#f59e0b' : 'gray', fontSize: '14px' }" />
                        </template>
                    </a-button>
                    <a-tag v-if="shwvStore.crtUnit.ref.quoted100?.length > 0" color="green" size="small">
                        Q {{ shwvStore.crtUnit.ref.quoted100.length }}
                    </a-tag>
                </div>
            </td>
            <td>{{ shwvStore.crtUnit.src }}</td>
            <td>-</td>
            <td>-</td>
        </tr>

        <!-- note / notes がある場合 -->
        <template v-if="shouldRenderNoteRow">
            <tr class="note-row">
                <td colspan="4" style="font-size: 0.85em; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; border-top: 1px dashed var(--vscode-widget-border); padding: 5px 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1;">
                            <!-- 通常の注釈テキスト -->
                            <span v-if="parsedNote.text" style="white-space: pre-wrap; word-break: break-word;">
                                <strong style="opacity: 0.7;">Note:</strong> {{ parsedNote.text }}
                            </span>

                            <!-- Suffolk 復元メタ情報 (@sf[...]) のバッジ表示 -->
                            <template v-if="parsedNote.hasSf && showSuffolkMeta">
                                <a-space wrap size="mini">
                                    <a-tag
                                        v-for="(meta, mIdx) in parsedNote.suffolkMeta"
                                        :key="mIdx"
                                        color="green"
                                        size="small"
                                        bordered
                                        style="font-size: 11px;"
                                    >
                                        <template #icon><icon-file /></template>
                                        <strong>{{ meta.label }}</strong><span v-if="meta.value">: {{ meta.value }}</span>
                                    </a-tag>
                                </a-space>
                            </template>

                            <!-- メディアメタデータ (@md[[...]]) のバッジ表示 -->
                            <template v-if="parsedNote.media">
                                <a-tag v-if="parsedNote.media.img" color="purple" size="small" bordered style="font-size: 11px;">
                                    <template #icon><icon-file-image /></template>
                                    {{ parsedNote.media.img }}
                                </a-tag>
                                <a-tag v-if="parsedNote.media.time" color="blue" size="small" bordered style="font-size: 11px;">
                                    <template #icon><icon-play-circle /></template>
                                    {{ parsedNote.media.time }}
                                </a-tag>
                                <a-tag v-if="parsedNote.media.rawMedia && !parsedNote.media.img && !parsedNote.media.time" color="gray" size="small" bordered style="font-size: 11px;">
                                    <template #icon><icon-code /></template>
                                    @md: {{ parsedNote.rawMedia }}
                                </a-tag>
                            </template>
                        </div>

                        <!-- @sf が含まれている場合のトグルボタン -->
                        <div v-if="parsedNote.hasSf" style="margin-left: auto;">
                            <a-tooltip :content="i18nStore.getText('translateTab', 'toggleSuffolkMetaTooltip') || 'Suffolk 復元メタ情報 (@sf) の表示切替'">
                                <a-button
                                    size="mini"
                                    type="text"
                                    :status="showSuffolkMeta ? 'normal' : 'warning'"
                                    @click="emit('toggleShowSuffolkMeta')"
                                    style="padding: 0 4px; height: 22px; font-size: 11px; opacity: 0.85;"
                                >
                                    <template #icon>
                                        <icon-eye v-if="showSuffolkMeta" />
                                        <icon-eye-invisible v-else />
                                    </template>
                                    @sf {{ showSuffolkMeta ? 'ON' : 'OFF' }}
                                </a-button>
                            </a-tooltip>
                        </div>
                    </div>
                </td>
            </tr>
        </template>

        <!-- placeholders がある場合 -->
        <template v-if="shwvStore.crtUnit.placeholders && Object.keys(shwvStore.crtUnit.placeholders).length > 0">
            <tr>
                <td colspan="2" style="text-align: right; font-size: 0.8em; opacity: 0.8; border-top: 1px dashed var(--vscode-widget-border);">
                    Placeholders
                </td>
                <td colspan="2" style="border-top: 1px dashed var(--vscode-widget-border);">
                    <a-space wrap>
                        <a-tag v-for="(val, key) in shwvStore.crtUnit.placeholders" :key="key" color="arcoblue" bordered>
                            {@{{ key }}} = {{ val }}
                        </a-tag>
                    </a-space>
                </td>
            </tr>
        </template>

        <!-- Propagation Button -->
        <tr v-if="shwvStore.crtUnit.ref.quoted100?.length > 0">
            <td colspan="4" style="background: var(--vscode-editor-inactiveSelectionBackground); text-align: center; border-radius: 4px;">
                <a-button type="primary" status="success" size="small" @click="handlePropagate">
                    Auto Propagate to {{ shwvStore.crtUnit.ref.quoted100.length }} identical units
                </a-button>
            </td>
        </tr>

        <!-- TMなど、次セクションとの区切りのための空白行（擬似マージン） -->
        <tr class="tbody-spacer">
            <td colspan="4"></td>
        </tr>
    </tbody>
</template>

<style scoped>
td {
    padding: 0.7em 0.5em;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255,255,255,0.1));
    text-align: left;
    vertical-align: top;
}

.tbody-spacer td {
    height: 1.2em;
    padding: 0;
    border-bottom: none;
    background: transparent;
}

.file-text {
    font-size: 0.7em;
    opacity: 0.6;
    margin-top: 4px;
    word-break: break-all;
}

.forbidden-terms {
    margin-top: 4px;
}
</style>
