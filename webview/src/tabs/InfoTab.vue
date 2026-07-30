<script setup lang="ts">
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue';
import { useShWvStore } from '../store/shwv';
import { IconInfoCircle, IconSettings } from '@arco-design/web-vue/es/icon';

const emit = defineEmits<{
    (e: 'InfoCommand', command: string, payload?: any): void
}>();

const shwvStore = useShWvStore();
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
                <a-typography-title :heading="4" style="margin: 0">Information & Workspace</a-typography-title>
            </a-space>
        </div>

        <a-divider />

        <a-tabs position="left" v-model="activeTab" style="flex: 1; min-height: 0;">
            <!-- Information Tab -->
            <a-tab-pane key="info" title="Information">
                <div class="pane-content">
                    <a-card title="About SheepWeave" :bordered="false">
                        <a-descriptions :column="1" bordered>
                            <a-descriptions-item label="Version">
                                <a-tag size="small" color="arcoblue" style="font-weight: bold;">v{{ extensionVersion }}</a-tag>
                                <a-tag size="small" color="arcoblue" style="margin-left: 8px; font-weight: bold;" v-if="testVer !== ''">{{ testVer }}</a-tag>
                            </a-descriptions-item>
                            <a-descriptions-item label="Developer">
                                開発：合同会社ランベージ＆ひつじの翻訳室 <br/>
                                <a-link href="https://lambuage.com" target="_blank">https://lambuage.com</a-link>
                            </a-descriptions-item>
                        </a-descriptions>
                    </a-card>

                    <div v-if="shwvStore.hasData" style="margin-top: 1rem;">
                        <a-card title="Project Metadata" :bordered="false">
                            <a-descriptions :column="1" bordered>
                                <a-descriptions-item label="Project Name" v-if="shwvStore.projectInfo?.projectName">
                                    <span style="font-weight: bold; color: var(--color-text-1);">{{ shwvStore.projectInfo.projectName }}</span>
                                </a-descriptions-item>
                                <a-descriptions-item label="Source Language">
                                    {{ shwvStore.projectInfo?.sourceLanguage || shwvStore.meta?.sourceLang }}
                                </a-descriptions-item>
                                <a-descriptions-item label="Target Language">
                                    {{ shwvStore.projectInfo?.targetLanguage || shwvStore.meta?.targetLang }}
                                </a-descriptions-item>
                                <a-descriptions-item label="Last Prepared At" v-if="shwvStore.projectInfo?.lastPreparedAt">
                                    {{ new Date(shwvStore.projectInfo.lastPreparedAt).toLocaleString() }}
                                </a-descriptions-item>
                                <a-descriptions-item label="Bilingual Path">
                                    <span class="path-text">{{ shwvStore.meta?.bilingualPath }}</span>
                                </a-descriptions-item>
                            </a-descriptions>
                        </a-card>

                        <a-card title="Source Files" :bordered="false" style="margin-top: 1rem;">
                            <a-list size="small">
                                <a-list-item v-for="file in shwvStore.meta?.files" :key="file.name">
                                    <span class="file-name">{{ file.name }}</span>
                                    <template #actions>
                                        <span class="file-range">Units: {{ file.start }} - {{ file.end }}</span>
                                    </template>
                                </a-list-item>
                            </a-list>
                        </a-card>

                        <a-card title="TM Files" :bordered="false" style="margin-top: 1rem;" v-if="shwvStore.meta?.tmFiles?.length">
                            <a-list size="small">
                                <a-list-item v-for="f in shwvStore.meta?.tmFiles" :key="f">
                                    {{ f }}
                                </a-list-item>
                            </a-list>
                        </a-card>

                        <a-card title="TB Files" :bordered="false" style="margin-top: 1rem;" v-if="shwvStore.meta?.tbFiles?.length">
                            <a-list size="small">
                                <a-list-item v-for="f in shwvStore.meta?.tbFiles" :key="f">
                                    {{ f }}
                                </a-list-item>
                            </a-list>
                        </a-card>
                    </div>
                    <div v-else class="empty-state">
                        No project data loaded.
                    </div>
                </div>
            </a-tab-pane>

            <!-- Stats Tab -->
            <a-tab-pane key="stats" title="Statistics">
                <div class="pane-content">
                    <a-card title="Project Statistics (Character Count)" :bordered="false">
                        <template #extra>
                            <a-button type="primary" size="mini" @click="calculateStats">Recalculate</a-button>
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
                            Click Recalculate to see project volume.
                        </div>
                    </a-card>
                </div>
            </a-tab-pane>

            <!-- Export / Manage Tab -->
            <a-tab-pane key="export" title="Export & Backup">
                <div class="pane-content">
                    <a-card title="Export (Translation Pairs)" :bordered="false">
                        <a-space>
                            <a-button type="primary" @click="handleCommand('shuttle-export-json')">Export JSON</a-button>
                            <a-button type="primary" @click="handleCommand('shuttle-export-csv')">Export CSV</a-button>
                        </a-space>
                    </a-card>
                </div>
            </a-tab-pane>

            <!-- Shuttle Tools -->
            <a-tab-pane key="shuttle" title="Shuttle Tools">
                <div class="pane-content">
                    <a-card title="Split / Chunking" :bordered="false">
                        <a-space direction="vertical">
                            <a-button type="outline" @click="handleCommand('shuttle-split-file')">Split by File</a-button>
                            <a-space>
                                <a-input-number v-model="maxLength" :min="1" :max="10000" placeholder="Max Length" />
                                <a-button type="outline" @click="handleSplitLength">Split by Length (Chunks)</a-button>
                            </a-space>
                        </a-space>
                    </a-card>

                    <a-card title="Lint Integration (JSONL)" :bordered="false" style="margin-top: 1rem;">
                        <a-space direction="vertical">
                            <a-button type="secondary" @click="handleCommand('shuttle-export-jsonl')">Export JSONL (Raw)</a-button>
                            <a-space>
                                <a-input-number v-model="maxTokensJsonl" :min="1" :max="32000" placeholder="Max Tokens" />
                                <a-button type="secondary" @click="handleChunkJsonl">Export JSONL (Chunked)</a-button>
                                <a-button type="outline" @click="handleCommand('shuttle-import-jsonl')">Import JSONL (from export_chunked.jsonl)</a-button>
                            </a-space>
                        </a-space>
                    </a-card>

                    <a-card title="Auto Replacement" :bordered="false" style="margin-top: 1rem;">
                        <a-space direction="vertical">
                            <div style="font-size: 12px; color: var(--color-text-3);">
                                Applies the auto_replace_log.jsonl to the current target file sequentially.
                            </div>
                            <a-button type="primary" status="success" @click="handleCommand('shuttle-auto-replace')">自動置換 (Apply Auto Replace Log)</a-button>
                        </a-space>
                    </a-card>
                </div>
            </a-tab-pane>

            <!-- Debug Tab -->
            <a-tab-pane key="debug" title="Debug">
                <div class="pane-content">
                    <a-card title="Debug Options" :bordered="false" v-if="shwvStore.hasData">
                        <a-space>
                            <a-button @click="copyStore">Copy Store</a-button>
                            <a-button type="outline" status="warning" @click="handleCommand('legacy-analyze')">Legacy TB Analyze (Verify)</a-button>
                        </a-space>
                        <div style="margin-top: 1rem;">
                            <a-link href="https://sheep-works.github.io/SheepPress/json-viewer.html" target="_blank">Paste Store State Here</a-link>
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
