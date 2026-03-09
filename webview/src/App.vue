<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useLmLgStore } from './store/lmlg';
import { useI18nStore } from './store/i18n';
import FlowTab from './tabs/FlowTab.vue';
import TranslateTab from './tabs/TranslateTab.vue';
import DebugTab from './tabs/DebugTab.vue';
import { storeToRefs } from 'pinia';


const i18nStore = useI18nStore();
const { locale } = storeToRefs(i18nStore);
const activeTab = ref('flow');
const lmlgStore = useLmLgStore();

// Acquire the VS Code API
const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;

// function setTab(tab: string) {
//     activeTab.value = tab;
// }

// vscode.postMessage() で送信されたメッセージは、
// 拡張機能側の src/commands/openLambLingoPanel.ts 内で定義されている
// \`panel.webview.onDidReceiveMessage(message => { ... })\` メソッドにて受信・処理される。
// 引数の \`command\` は、message.type として送られ、
// 'init', 'prepare', 'start', 'finish' などの文字列を受け取る。
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
    <a-layout-header>
        <a-space>
            <a-typography-title> Lamblingo </a-typography-title>
            <a-select v-model="locale">
                <a-option :value="'en'">English</a-option>
                <a-option :value="'ja'">日本語</a-option>
            </a-select>
        </a-space>
    </a-layout-header>
    <a-tabs>
    <a-tab-pane key="flow" title="Flow">
        <FlowTab
            @FlowCommand="handleCommand"
        />
    </a-tab-pane>
    <a-tab-pane key="translate" title="Translate">
        <TranslateTab />
    </a-tab-pane>
    <a-tab-pane key="debug" title="Debug">
        <DebugTab />
    </a-tab-pane>
    </a-tabs>
</a-layout>
</template>

<style scoped>
</style>
