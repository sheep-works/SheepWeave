<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useShWvStore } from './store/shwv';
import { useI18nStore } from './store/i18n';
import FlowTab from './tabs/FlowTab.vue';
import TranslateTab from './tabs/TranslateTab.vue';
import DebugTab from './tabs/DebugTab.vue';
import ManagementTab from './tabs/ManagementTab.vue';
import InfoTab from './tabs/InfoTab.vue';
import SettingsTab from './tabs/SettingsTab.vue';
import FilterTab from './tabs/FilterTab.vue';
import ConcordanceTab from './tabs/ConcordanceTab.vue';
import { storeToRefs } from 'pinia';


const i18nStore = useI18nStore();
const { locale } = storeToRefs(i18nStore);
const activeTab = ref('flow');
const shwvStore = useShWvStore();
const loading = ref(false);

// Acquire the VS Code API
const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;

// function setTab(tab: string) {
//     activeTab.value = tab;
// }

// vscode.postMessage() で送信されたメッセージは、
// 拡張機能側の src/commands/openSheepWeavePanel.ts 内で定義されている
// \`panel.webview.onDidReceiveMessage(message => { ... })\` メソッドにて受信・処理される。
// 引数の \`command\` は、message.type として送られ、
// 'init', 'prepare', 'start', 'finish' などの文字列を受け取る。
const config = ref({
    projectName: 'SheepWeaveProject',
    sourceLang: 'en-US',
    targetLang: 'ja-JP',
    fontSize: 14
});

function handleCommand(command: string, payload?: any) {
    if (vscode) {
        // DataCloneError回避のためペイロードのProxyを確実に除去
        const rawPayload = payload ? JSON.parse(JSON.stringify(payload)) : undefined;
        vscode.postMessage({ type: command, command, payload: rawPayload });
    } else {
        console.log(`Mock: ${command} command sent:`, payload);
    }
}

function updateConfig(newConfig: any) {
    console.log('[Webview updateConfig]', newConfig);
    if (newConfig.fontSize !== undefined) {
        config.value.fontSize = newConfig.fontSize;
    }
    if (vscode) {
        vscode.postMessage({ type: 'update-config', payload: newConfig });
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
            case 'CONFIG_LOADED':
                if (message.data.sourceLang) config.value.sourceLang = message.data.sourceLang;
                if (message.data.targetLang) config.value.targetLang = message.data.targetLang;
                if (message.data.fontSize) config.value.fontSize = message.data.fontSize;
                break;
            case 'SHWV_DATA_LOADED':
                shwvStore.loadData(message.data);
                break;
            case 'UNITS_UPDATED':
                if (message.data.units) shwvStore.updateUnits(message.data.units);
                if (message.data.meta) shwvStore.meta = message.data.meta;
                break;
            case 'CURSOR_MOVED':
                if (message.data && typeof message.data.newPos === 'number') {
                    shwvStore.moveCursor(message.data.newPos, message.data.textInOldPos, message.data.status);
                }
                break;
            case 'SET_LOADING':
                loading.value = !!message.data;
                break;
            case 'SELECT_TAB':
                if (message.data) activeTab.value = message.data;
                break;
            case 'CONCORDANCE_SEARCH_RES':
                shwvStore.setConcordanceData(message.data);
                activeTab.value = 'concordance';
                break;
        }
    });

    if (vscode) {
        vscode.postMessage({ type: 'READY' });
    }
});
</script>

<template>
    <a-spin :loading="loading" tip="Processing..." style="display: block; width: 100%; min-height: 100vh;">
        <a-layout>
            <a-layout-header>
                <a-space>
                    <a-typography-title> SheepWeave </a-typography-title>
                    <a-select v-model="locale">
                        <a-option :value="'en'">English</a-option>
                        <a-option :value="'ja'">日本語</a-option>
                    </a-select>
                </a-space>
            </a-layout-header>
            <a-tabs :active-key="activeTab" @change="(k: any) => activeTab = k as string">
                <a-tab-pane key="flow" title="Flow">
                    <FlowTab @FlowCommand="handleCommand" :config="config" />
                </a-tab-pane>
                <a-tab-pane key="translate" title="Translate">
                    <TranslateTab :fontSize="config.fontSize" />
                </a-tab-pane>
                <a-tab-pane key="filter" title="Filter">
                    <FilterTab @FilterCommand="handleCommand" />
                </a-tab-pane>
                <a-tab-pane key="management" title="Management">
                    <ManagementTab @ManageCommand="handleCommand" />
                </a-tab-pane>
                <a-tab-pane key="concordance" title="Concordance">
                    <ConcordanceTab @ConcordanceCommand="handleCommand" />
                </a-tab-pane>
                <a-tab-pane key="information" title="Information">
                    <InfoTab />
                </a-tab-pane>
                <a-tab-pane key="settings" title="Settings">
                    <SettingsTab :config="config" @updateConfig="updateConfig" @SettingsCommand="handleCommand" />
                </a-tab-pane>
                <!-- <a-tab-pane key="debug" title="Debug">
                    <DebugTab />
                </a-tab-pane> -->
            </a-tabs>
        </a-layout>
    </a-spin>
</template>

<style scoped></style>
