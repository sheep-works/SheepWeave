<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { getVsCodeApi } from './vscode';
import { useShWvStore } from './store/shwv';
import { useI18nStore } from './store/i18n';
import FlowTab from './tabs/FlowTab.vue';
import TranslateTab from './tabs/TranslateTab.vue';
import DebugTab from './tabs/DebugTab.vue';
import SettingsTab from './tabs/SettingsTab.vue';
import SearchTab from './tabs/SearchTab.vue';
import InfoTab from './tabs/InfoTab.vue';
import LlmTab from './tabs/LlmTab.vue';
import ToolsTab from './tabs/ToolsTab.vue';
import { storeToRefs } from 'pinia';


const i18nStore = useI18nStore();
const { locale } = storeToRefs(i18nStore);
const activeTab = ref('flow');
const shwvStore = useShWvStore();
const loading = ref(false);

// VS CodeのAPI (バックエンドとの通信用オブジェクト) は vscode.ts にて一元管理しています。
// 各コンポーネントから直接 acquireVsCodeApi() を呼ぶとエラー（複数回呼び出し不可）になるため、
// 常に getVsCodeApi() を利用してください。
const vscode = getVsCodeApi();

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
    fontSize: 14,
    bobbinApiKey: '',
    autoReflectLlmToTm: true,
    versionLogs: ''
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
    if (newConfig.bobbinApiKey !== undefined) {
        config.value.bobbinApiKey = newConfig.bobbinApiKey;
    }
    if (newConfig.autoReflectLlmToTm !== undefined) {
        config.value.autoReflectLlmToTm = newConfig.autoReflectLlmToTm;
    }
    if (vscode) {
        vscode.postMessage({ type: 'update-config', payload: newConfig });
    }
}

onMounted(() => {
    document.body.setAttribute('arco-theme', 'dark')
    
    // パネル側でのタブ切り替えショートカット (Alt+1 ~ 8)
    window.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            switch(e.key) {
                case '1': activeTab.value = 'flow'; break;
                case '2': activeTab.value = 'translate'; break;
                case '3': activeTab.value = 'search'; break;
                case '4': activeTab.value = 'tools'; break;
                case '5': activeTab.value = 'llm'; break;
                case '6': activeTab.value = 'information'; break;
                case '7': activeTab.value = 'settings'; break;
            }
        }

        // Webview上でのコンコーダンス検索ショートカット (Ctrl+K / Cmd+K)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            const selectedText = window.getSelection()?.toString().trim();
            if (selectedText) {
                e.preventDefault();
                // Ctrl+Shift+K を Target 検索とする
                const mode = e.shiftKey ? 'target' : 'source';
                handleCommand('manual-concordance', { query: selectedText, mode });
            }
        }
    });

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
                if (message.data.bobbinApiKey !== undefined) config.value.bobbinApiKey = message.data.bobbinApiKey;
                if (message.data.autoReflectLlmToTm !== undefined) config.value.autoReflectLlmToTm = message.data.autoReflectLlmToTm;
                if (message.data.versionLogs !== undefined) config.value.versionLogs = message.data.versionLogs;
                break;
            case 'SHWV_DATA_LOADED':
                shwvStore.loadData(message.data);
                if (message.data.projectInfo) {
                    if (message.data.projectInfo.projectName) {
                        config.value.projectName = message.data.projectInfo.projectName;
                    }
                    if (message.data.projectInfo.sourceLanguage) {
                        config.value.sourceLang = message.data.projectInfo.sourceLanguage;
                    }
                    if (message.data.projectInfo.targetLanguage) {
                        config.value.targetLang = message.data.projectInfo.targetLanguage;
                    }
                }
                if (message.data.meta) {
                    if (message.data.meta.projectName) config.value.projectName = message.data.meta.projectName;
                    if (message.data.meta.sourceLang) config.value.sourceLang = message.data.meta.sourceLang;
                    if (message.data.meta.targetLang) config.value.targetLang = message.data.meta.targetLang;
                }
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
                activeTab.value = 'search';
                break;
            case 'LOAD_LLM_CHUNK':
                if (message.data) {
                    shwvStore.setLlmUnits(message.data.units);
                    shwvStore.setLlmPartialResponse('');
                    activeTab.value = 'llm';
                }
                break;
            case 'LLM_RESPONSE':
                if (message.data) {
                    shwvStore.setLlmPartialResponse(message.data.response);
                    shwvStore.setLlmRequesting(false);
                }
                break;
            case 'LLM_ERROR':
                if (message.data) {
                    shwvStore.setLlmPartialResponse('Error: ' + message.data.error);
                    shwvStore.setLlmRequesting(false);
                }
                break;
            case 'PROMPT_IMPORTED':
                if (message.data?.prompt) {
                    shwvStore.setLlmPrompt(message.data.prompt);
                }
                break;
            case 'LLM_BATCH_PROGRESS':
                if (message.data) {
                    shwvStore.setLlmBatchRunning(true);
                    shwvStore.setLlmBatchProgress(message.data);
                }
                break;
            case 'LLM_BATCH_DONE':
                shwvStore.setLlmBatchRunning(false);
                if (message.data) {
                    shwvStore.setLlmBatchResponse(message.data.result);
                }
                break;
            case 'LLM_BATCH_ERROR':
                shwvStore.setLlmBatchRunning(false);
                if (message.data) {
                    shwvStore.setLlmBatchResponse('Batch Error: ' + message.data.error);
                }
                break;
            case 'LLM_CHAT_RESPONSE':
                if (message.data) {
                    shwvStore.setLlmChatResponse(message.data.response);
                    shwvStore.setLlmChatRequesting(false);
                }
                break;
            case 'LLM_CHAT_ERROR':
                if (message.data) {
                    shwvStore.setLlmChatResponse('Error: ' + message.data.error);
                    shwvStore.setLlmChatRequesting(false);
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
    <a-spin :loading="loading" :tip="i18nStore.getText('common', 'loading')" style="display: block; width: 100%; min-height: 100vh;">
        <a-layout>
            <a-tabs :active-key="activeTab" @change="(k: any) => activeTab = k as string">
                <a-tab-pane key="flow">
                    <template #title>
                        <a-tooltip content="Shortcut: Alt+1">
                            <span>{{ i18nStore.getText('flowTab', 'title') || 'Flow' }}</span>
                        </a-tooltip>
                    </template>
                    <FlowTab @FlowCommand="handleCommand" :config="config" />
                </a-tab-pane>
                <a-tab-pane key="translate">
                    <template #title>
                        <a-tooltip content="Shortcut: Alt+2">
                            <span>{{ i18nStore.getText('translateTab', 'title') || 'Translate' }}</span>
                        </a-tooltip>
                    </template>
                    <TranslateTab :fontSize="config.fontSize" />
                </a-tab-pane>
                <a-tab-pane key="search">
                    <template #title>
                        <a-tooltip content="Shortcut: Alt+3">
                            <span>{{ i18nStore.getText('searchTab', 'title') || 'Search' }}</span>
                        </a-tooltip>
                    </template>
                    <SearchTab @SearchCommand="handleCommand" />
                </a-tab-pane>
                <a-tab-pane key="tools">
                    <template #title>
                        <a-tooltip content="Shortcut: Alt+4">
                            <span>{{ i18nStore.getText('toolsTab', 'title') || 'Tools' }}</span>
                        </a-tooltip>
                    </template>
                    <ToolsTab />
                </a-tab-pane>
                <a-tab-pane key="llm">
                    <template #title>
                        <a-tooltip content="Shortcut: Alt+5">
                            <span>LLM</span>
                        </a-tooltip>
                    </template>
                    <LlmTab @LlmCommand="handleCommand" :config="config" @updateConfig="updateConfig" />
                </a-tab-pane>
                <a-tab-pane key="information">
                    <template #title>
                        <a-tooltip content="Shortcut: Alt+6">
                            <span>{{ i18nStore.getText('infoTab', 'title') || 'Info' }}</span>
                        </a-tooltip>
                    </template>
                    <InfoTab @InfoCommand="handleCommand" />
                </a-tab-pane>
                <a-tab-pane key="settings">
                    <template #title>
                        <a-tooltip content="Shortcut: Alt+7">
                            <span>{{ i18nStore.getText('settingsTab', 'title') || 'Settings' }}</span>
                        </a-tooltip>
                    </template>
                    <SettingsTab :config="config" @updateConfig="updateConfig" @SettingsCommand="handleCommand" />
                </a-tab-pane>
            </a-tabs>
        </a-layout>
    </a-spin>
</template>

<style scoped></style>
