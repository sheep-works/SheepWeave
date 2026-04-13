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
            <a-card title="4. Debug" v-if="shwvStore.hasData">
                <a-button @click="copyStore">Copy Store</a-button>
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
