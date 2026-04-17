<script setup lang="ts">
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useShWvStore } from '../store/shwv';
import { IconDashboard } from '@arco-design/web-vue/es/icon';

const emit = defineEmits<{
    (e: 'ManageCommand', command: string, payload?: any): void
}>();

const maxLength = ref(1000);
const maxTokensJsonl = ref(4000);

function handleCommand(command: string) {
    emit('ManageCommand', command);
}

function handleSplitLength() {
    emit('ManageCommand', 'shuttle-split-length', { maxLength: maxLength.value });
}

function handleChunkJsonl() {
    emit('ManageCommand', 'shuttle-chunk-jsonl', { maxTokens: maxTokensJsonl.value });
}

const shwvStore = useShWvStore();

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
    <div id="management-tab">
        <div class="header">
            <a-space>
                <icon-dashboard :style="{ fontSize: '24px', marginRight: '8px' }" />
                <a-typography-title :heading="4" style="margin: 0">Management (SheepShuttle)</a-typography-title>
            </a-space>
        </div>

        <a-divider />

        <a-space direction="vertical" fill>
            <a-card title="1. Export (Translation Pairs)">
                <a-space>
                    <a-button type="primary" @click="handleCommand('shuttle-export-json')">Export JSON</a-button>
                    <a-button type="primary" @click="handleCommand('shuttle-export-csv')">Export CSV</a-button>
                </a-space>
            </a-card>

            <a-card title="2. Split / Chunking">
                <a-space direction="vertical">
                    <a-button type="outline" @click="handleCommand('shuttle-split-file')">Split by File</a-button>

                    <a-space>
                        <a-input-number v-model="maxLength" :min="1" :max="10000" placeholder="Max Length" />
                        <a-button type="outline" @click="handleSplitLength">Split by Length (Chunks)</a-button>
                    </a-space>
                </a-space>
            </a-card>

            <a-card title="3. Lint Integration (JSONL)">
                <a-space direction="vertical">
                    <a-button type="secondary" @click="handleCommand('shuttle-export-jsonl')">Export JSONL
                        (Raw)</a-button>

                    <a-space>
                        <a-input-number v-model="maxTokensJsonl" :min="1" :max="32000" placeholder="Max Tokens" />
                        <a-button type="secondary" @click="handleChunkJsonl">Export JSONL (Chunked)</a-button>
                        <a-button type="outline" @click="handleCommand('shuttle-import-jsonl')">Import JSONL (from
                            export_chunked.jsonl)</a-button>
                    </a-space>
                </a-space>
            </a-card>

            <a-card title="4. Project Statistics (Character Count)">
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
                                {{ stats.confirmed.count }} segments (SRC: {{ stats.confirmed.src }} | TGT: {{
                                    stats.confirmed.tgt }})
                            </a-typography-text>
                        </a-descriptions-item>
                        <a-descriptions-item label="Proofed">
                            <a-typography-text type="warning">
                                {{ stats.proofed.count }} segments (SRC: {{ stats.proofed.src }} | TGT: {{ stats.proofed.tgt
                                }})
                            </a-typography-text>
                        </a-descriptions-item>
                        <a-descriptions-item label="None">
                            {{ stats.none.count }} segments (SRC: {{ stats.none.src }} | TGT: {{ stats.none.tgt }})
                        </a-descriptions-item>
                    </a-descriptions>
                </div>
                <div v-else style="text-align: center; color: var(--color-text-3);">
                    Click Recalculate to see project volume.
                </div>
            </a-card>

            <a-card title="5. Debug" v-if="shwvStore.hasData">
                <a-space>
                    <a-button @click="copyStore">Copy Store</a-button>
                    <a-button type="outline" status="warning" @click="handleCommand('legacy-analyze')">Legacy TB Analyze (Verify)</a-button>
                </a-space>
                <a-link href="https://sheep-works.github.io/SheepPress/json-viewer.html" target="_blank">Paste
                    Here</a-link>
            </a-card>
        </a-space>
    </div>
</template>

<style scoped>
#management-tab {
    width: 100%;
    height: 100%;
    padding: 3px;
}
</style>
