<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useLmLgStore } from './store/lmlg';
import FlowTab from './tabs/FlowTab.vue';
import TranslateTab from './tabs/TranslateTab.vue';

const activeTab = ref('flow');
const lmlgStore = useLmLgStore();

// Acquire the VS Code API
const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;

// function setTab(tab: string) {
//     activeTab.value = tab;
// }

function handleCommand(command: string) {
    if (vscode) {
        vscode.postMessage({ type: command });
    } else {
        console.log(`Mock: ${command} command sent`);
    }
}

onMounted(() => {
    document.body.setAttribute('arco-theme', 'dark')
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'INIT':
                console.log('Init message received', message.payload);
                break;
            case 'LMLG_DATA_LOADED':
                lmlgStore.loadData(message.data);
                break;
            case 'CURSOR_MOVED':
                if (message.data && typeof message.data.newPos === 'number') {
                    lmlgStore.moveCursor(message.data.newPos, message.data.textInOldPos);
                }
                break;
        }
    });

    if (vscode) {
        vscode.postMessage({ type: 'READY' });
    }
});
</script>

<template>
<a-layout>
    <a-tabs>
    <a-tab-pane key="flow" title="Flow">
        <FlowTab 
            @init="handleCommand('init')"
            @prepare="handleCommand('prepare')"
            @start="handleCommand('start')"
            @finish="handleCommand('finish')"
        />
    </a-tab-pane>
    <a-tab-pane key="translate" title="Translate">
        <TranslateTab />
    </a-tab-pane>
    </a-tabs>
</a-layout>
</template>

<style scoped>
</style>
