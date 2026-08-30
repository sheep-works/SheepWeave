<script setup lang="ts">
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import { IconInfoCircle, IconSettings } from '@arco-design/web-vue/es/icon';

const emit = defineEmits<{
    (e: 'InfoCommand', command: string, payload?: any): void
}>();

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();
const extensionVersion = (window as any).SHEEP_WEAVE_VERSION || '0.0.0';
const testVer = ref(import.meta.env.VITE_TEST_VER || "")

const maxLength = ref(1000);
const maxTokensJsonl = ref(4000);
const activeTab = ref('info');

function handleCommand(command: string) {
    emit('InfoCommand', command);
}

function handleSplitLength() {
    emit('InfoCommand', 'shuttle-split-length', { maxLength: maxLength.value });
}

function handleChunkJsonl() {
    emit('InfoCommand', 'shuttle-chunk-jsonl', { maxTokens: maxTokensJsonl.value });
}

const copyStore = () => {
    const serialized = JSON.stringify(shwvStore.$state, null, 2);
    navigator.clipboard.writeText(serialized).then(() => {
        Message.success('Store state copied to clipboard');
    }).catch(err => {
        Message.error('Failed to copy: ' + err);
    });
};

const stats = ref<{
    none: { src: number, tgt: number, count: number },
    confirmed: { src: number, tgt: number, count: number },
    proofed: { src: number, tgt: number, count: number },
    total: { src: number, tgt: number, count: number }
} | null>(null);

function calculateStats() {
    const s = {
        none: { src: 0, tgt: 0, count: 0 },
        confirmed: { src: 0, tgt: 0, count: 0 },
        proofed: { src: 0, tgt: 0, count: 0 },
        total: { src: 0, tgt: 0, count: 0 }
    };

    shwvStore.units.forEach(u => {
        const srcLen = (u.src || "").length;
        const tgtLen = (u.tgt || u.pre || "").length;

        s.total.src += srcLen;
        s.total.tgt += tgtLen;
        s.total.count++;

        if (u.status === 1) {
            s.confirmed.src += srcLen;
            s.confirmed.tgt += tgtLen;
            s.confirmed.count++;
        } else if (u.status === 2) {
            s.proofed.src += srcLen;
            s.proofed.tgt += tgtLen;
            s.proofed.count++;
        } else {
            s.none.src += srcLen;
            s.none.tgt += tgtLen;
            s.none.count++;
        }
    });

    stats.value = s;
}
</script>

<template>
    <div id="info-tab">
        <div class="header">
            <a-space align="center">
                <icon-info-circle :style="{ fontSize: '24px', marginRight: '8px' }" />
                <a-typography-title :heading="4" style="margin: 0">{{ i18nStore.getText('infoTab', 'title') || 'Project Info' }}</a-typography-title>
            </a-space>
        </div>

        <a-divider style="margin: 16px 0;" />

        <a-tabs position="left" v-model="activeTab" style="flex: 1; min-height: 0;">
            <!-- Information Tab -->
            <a-tab-pane key="info" :title="i18nStore.getText('infoTab', 'infoSubtab') || 'Information'">
                <div class="pane-content">
                    <div v-if="shwvStore.hasData">
                        <a-card :title="i18nStore.getText('infoTab', 'metaCard') || 'Project Metadata'" :bordered="false">
                            <a-descriptions :column="1" bordered>
                                <a-descriptions-item :label="i18nStore.getText('infoTab', 'projectName') || 'Project Name'" v-if="shwvStore.projectInfo?.projectName">
                                    <span style="font-weight: bold; color: var(--color-text-1);">{{ shwvStore.projectInfo.projectName }}</span>
                                </a-descriptions-item>
                                <a-descriptions-item :label="i18nStore.getText('infoTab', 'sourceLang') || 'Source Language'">
                                    {{ shwvStore.projectInfo?.sourceLanguage || shwvStore.meta?.sourceLang }}
                                </a-descriptions-item>
                                <a-descriptions-item :label="i18nStore.getText('infoTab', 'targetLang') || 'Target Language'">
                                    {{ shwvStore.projectInfo?.targetLanguage || shwvStore.meta?.targetLang }}
                                </a-descriptions-item>
                                <a-descriptions-item :label="i18nStore.getText('infoTab', 'lastPreparedAt') || 'Last Prepared At'" v-if="shwvStore.projectInfo?.lastPreparedAt">
                                    {{ new Date(shwvStore.projectInfo.lastPreparedAt).toLocaleString() }}
                                </a-descriptions-item>
                                <a-descriptions-item :label="i18nStore.getText('infoTab', 'bilingualPath') || 'Bilingual Path'">
                                    <span class="path-text">{{ shwvStore.meta?.bilingualPath }}</span>
                                </a-descriptions-item>
                            </a-descriptions>
                        </a-card>

                        <a-card :title="i18nStore.getText('infoTab', 'sourceFilesCard') || 'Source Files'" :bordered="false" style="margin-top: 1rem;">
                            <a-list size="small">
                                <a-list-item v-for="file in shwvStore.meta?.files" :key="file.name">
                                    <span class="file-name">{{ file.name }}</span>
                                    <template #actions>
                                        <span class="file-range">Units: {{ file.start }} - {{ file.end }}</span>
                                    </template>
                                </a-list-item>
                            </a-list>
                        </a-card>

                        <a-card :title="i18nStore.getText('infoTab', 'tmFilesCard') || 'TM Files'" :bordered="false" style="margin-top: 1rem;" v-if="shwvStore.meta?.tmFiles?.length">
                            <a-list size="small">
                                <a-list-item v-for="f in shwvStore.meta?.tmFiles" :key="f">
                                    {{ f }}
                                </a-list-item>
                            </a-list>
                        </a-card>

                        <a-card :title="i18nStore.getText('infoTab', 'tbFilesCard') || 'TB Files'" :bordered="false" style="margin-top: 1rem;" v-if="shwvStore.meta?.tbFiles?.length">
                            <a-list size="small">
                                <a-list-item v-for="f in shwvStore.meta?.tbFiles" :key="f">
                                    {{ f }}
                                </a-list-item>
                            </a-list>
                        </a-card>
                    </div>
                    <div v-else class="empty-state">
                        {{ i18nStore.getText('infoTab', 'noData') || 'No project data loaded.' }}
                    </div>
                </div>
            </a-tab-pane>

            <!-- Stats Tab -->
            <a-tab-pane key="stats" :title="i18nStore.getText('infoTab', 'statsSubtab') || 'Statistics'">
                <div class="pane-content">
                    <a-card :title="i18nStore.getText('infoTab', 'statsCard') || 'Project Statistics (Character Count)'" :bordered="false">
                        <template #extra>
                            <a-button type="primary" size="mini" @click="calculateStats">{{ i18nStore.getText('infoTab', 'recalculateBtn') || 'Recalculate' }}</a-button>
                        </template>
                        <div v-if="stats">
                            <a-descriptions :column="1" bordered>
                                <a-descriptions-item label="Total">
                                    {{ stats.total.count }} segments (SRC: {{ stats.total.src }} | TGT: {{ stats.total.tgt }})
                                </a-descriptions-item>
                                <a-descriptions-item label="Confirmed">
                                    <a-typography-text type="success">
                                        {{ stats.confirmed.count }} segments (SRC: {{ stats.confirmed.src }} | TGT: {{ stats.confirmed.tgt }})
                                    </a-typography-text>
                                </a-descriptions-item>
                                <a-descriptions-item label="Proofed">
                                    <a-typography-text type="warning">
                                        {{ stats.proofed.count }} segments (SRC: {{ stats.proofed.src }} | TGT: {{ stats.proofed.tgt }})
                                    </a-typography-text>
                                </a-descriptions-item>
                                <a-descriptions-item label="None">
                                    {{ stats.none.count }} segments (SRC: {{ stats.none.src }} | TGT: {{ stats.none.tgt }})
                                </a-descriptions-item>
                            </a-descriptions>
                        </div>
                        <div v-else class="empty-state">
                            {{ i18nStore.getText('infoTab', 'calcHelp') || 'Click Recalculate to see project volume.' }}
                        </div>
                    </a-card>
                </div>
            </a-tab-pane>

            <!-- Export / Manage Tab -->
            <a-tab-pane key="export" :title="i18nStore.getText('infoTab', 'exportSubtab') || 'Export & Backup'">
                <div class="pane-content">
                    <a-card :title="i18nStore.getText('infoTab', 'exportPairsCard') || 'Export (Translation Pairs)'" :bordered="false">
                        <a-space>
                            <a-button type="primary" @click="handleCommand('shuttle-export-json')">{{ i18nStore.getText('infoTab', 'exportJsonBtn') || 'Export JSON' }}</a-button>
                            <a-button type="primary" @click="handleCommand('shuttle-export-csv')">{{ i18nStore.getText('infoTab', 'exportCsvBtn') || 'Export CSV' }}</a-button>
                        </a-space>
                    </a-card>
                </div>
            </a-tab-pane>

            <!-- Shuttle Tools -->
            <a-tab-pane key="shuttle" :title="i18nStore.getText('infoTab', 'shuttleSubtab') || 'Shuttle Tools'">
                <div class="pane-content">
                    <a-card :title="i18nStore.getText('infoTab', 'splitCard') || 'Split / Chunking'" :bordered="false">
                        <a-space direction="vertical">
                            <a-button type="outline" @click="handleCommand('shuttle-split-file')">{{ i18nStore.getText('infoTab', 'splitByFileBtn') || 'Split by File' }}</a-button>
                            <a-space>
                                <a-input-number v-model="maxLength" :min="1" :max="10000" placeholder="Max Length" />
                                <a-button type="outline" @click="handleSplitLength">{{ i18nStore.getText('infoTab', 'splitByLengthBtn') || 'Split by Length (Chunks)' }}</a-button>
                            </a-space>
                        </a-space>
                    </a-card>

                    <a-card :title="i18nStore.getText('infoTab', 'lintCard') || 'Lint Integration (JSONL)'" :bordered="false" style="margin-top: 1rem;">
                        <a-space direction="vertical">
                            <a-button type="secondary" @click="handleCommand('shuttle-export-jsonl')">{{ i18nStore.getText('infoTab', 'exportJsonlRaw') || 'Export JSONL (Raw)' }}</a-button>
                            <a-space>
                                <a-input-number v-model="maxTokensJsonl" :min="1" :max="32000" placeholder="Max Tokens" />
                                <a-button type="secondary" @click="handleChunkJsonl">{{ i18nStore.getText('infoTab', 'exportJsonlChunked') || 'Export JSONL (Chunked)' }}</a-button>
                                <a-button type="outline" @click="handleCommand('shuttle-import-jsonl')">{{ i18nStore.getText('infoTab', 'importJsonl') || 'Import JSONL' }}</a-button>
                            </a-space>
                        </a-space>
                    </a-card>

                    <a-card :title="i18nStore.getText('infoTab', 'autoReplaceCard') || 'Auto Replacement'" :bordered="false" style="margin-top: 1rem;">
                        <a-space direction="vertical">
                            <div style="font-size: 12px; color: var(--color-text-3);">
                                {{ i18nStore.getText('infoTab', 'autoReplaceHelp') || 'Applies the auto_replace_log.jsonl to the current target file sequentially.' }}
                            </div>
                            <a-button type="primary" status="success" @click="handleCommand('shuttle-auto-replace')">{{ i18nStore.getText('infoTab', 'autoReplaceBtn') || 'Apply Auto Replace Log' }}</a-button>
                        </a-space>
                    </a-card>
                </div>
            </a-tab-pane>

            <!-- Debug Tab -->
            <a-tab-pane key="debug" :title="i18nStore.getText('infoTab', 'debugSubtab') || 'Debug'">
                <div class="pane-content">
                    <a-card :title="i18nStore.getText('infoTab', 'debugOptionsCard') || 'Debug Options'" :bordered="false" v-if="shwvStore.hasData">
                        <a-space>
                            <a-button @click="copyStore">{{ i18nStore.getText('infoTab', 'copyStoreBtn') || 'Copy Store' }}</a-button>
                            <a-button type="outline" status="warning" @click="handleCommand('legacy-analyze')">{{ i18nStore.getText('infoTab', 'legacyAnalyzeBtn') || 'Legacy TB Analyze (Verify)' }}</a-button>
                        </a-space>
                        <div style="margin-top: 1rem;">
                            <a-link href="https://sheep-works.github.io/SheepPress/json-viewer.html" target="_blank">{{ i18nStore.getText('infoTab', 'pasteStateLink') || 'Paste Store State Here' }}</a-link>
                        </div>
                    </a-card>
                </div>
            </a-tab-pane>
        </a-tabs>
    </div>
</template>

<style scoped>
#info-tab {
    width: 100%;
    height: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.pane-content {
    height: 100%;
    overflow-y: auto;
    padding-right: 12px;
}

.path-text {
    word-break: break-all;
    font-size: 0.9em;
    opacity: 0.8;
}

.file-name {
    font-weight: bold;
}

.file-range {
    font-size: 0.85em;
    color: var(--color-text-3);
}

.empty-state {
    text-align: center;
    color: var(--color-text-3);
    margin-top: 2rem;
}
</style>
