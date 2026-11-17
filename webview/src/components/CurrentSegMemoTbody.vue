<script setup lang="ts">
import { ref, watch } from 'vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import { IconEdit } from '@arco-design/web-vue/es/icon';
import { getVsCodeApi } from '../vscode';

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();

const localMemo = ref('');

// セグメント移動時に現在のセグメントのメモを同期
watch(() => shwvStore.crtUnit?.idx, () => {
    localMemo.value = shwvStore.crtUnit?.memo || '';
}, { immediate: true });

const handleSaveMemo = () => {
    const unit = shwvStore.crtUnit;
    if (unit) {
        const val = localMemo.value.trim() ? localMemo.value : undefined;
        if (unit.memo !== val) {
            unit.memo = val;
            const vscode = getVsCodeApi();
            if (vscode) {
                vscode.postMessage({
                    type: 'update-unit-memo',
                    payload: { idx: unit.idx, memo: val }
                });
            }
        }
    }
};
</script>

<template>
    <tbody v-if="shwvStore.crtUnit" class="current-segment-memo-body">
        <tr class="tbody-spacer">
            <td colspan="4"></td>
        </tr>
        <tr class="memo-row">
            <td colspan="4">
                <div class="memo-container">
                    <div class="memo-header">
                        <icon-edit style="font-size: 12px; opacity: 0.7;" />
                        <strong class="memo-label">{{ i18nStore.getText('translateTab', 'memo') || 'Memo' }}:</strong>
                    </div>
                    <a-textarea
                        v-model="localMemo"
                        :placeholder="i18nStore.getText('translateTab', 'memoPlaceholder') || 'メモを入力...'"
                        :auto-size="{ minRows: 1, maxRows: 4 }"
                        allow-clear
                        @blur="handleSaveMemo"
                        @change="handleSaveMemo"
                    />
                </div>
            </td>
        </tr>
    </tbody>
</template>

<style scoped>
td {
    padding: 0.7em 0.5em;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255, 255, 255, 0.1));
    text-align: left;
    vertical-align: top;
}

.tbody-spacer td {
    height: 1.2em;
    padding: 0;
    border-bottom: none;
    background: transparent;
}

.memo-row td {
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 4px;
    border-top: 1px dashed var(--vscode-widget-border);
    padding: 6px 8px;
}

.memo-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.memo-header {
    display: flex;
    align-items: center;
    gap: 6px;
}

.memo-label {
    font-size: 0.85em;
    opacity: 0.8;
}
</style>
