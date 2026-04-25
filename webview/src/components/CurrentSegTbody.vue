<script setup lang="ts">
import { computed } from 'vue';
import { useShWvStore } from '../store/shwv';

const shwvStore = useShWvStore();

const handlePropagate = () => {
    const unit = shwvStore.crtUnit;
    if (unit && unit.ref.quoted100?.length > 0) {
        // Emit to parent or postMessage directly if handled globally
        // Since handleCommand is in App.vue, we can postMessage here if we had access, 
        // but it's cleaner to let App.vue handle events.
        // For simplicity in this structure, we'll use window.postMessage directly
        // or just let a global handler catch it.
        const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;
        if (vscode) {
            vscode.postMessage({
                type: 'propagate-quoted',
                payload: { idx: unit.idx, tgt: unit.tgt }
            });
        }
    }
};

const rowspan = computed(() => {
    return Math.max(1, shwvStore.crtUnit?.ref?.tb?.length || 0);
});
</script>

<template>
    <tbody v-if="shwvStore.crtUnit" class="current-segment-body">
        <!-- ref.tb がある場合 -->
        <template v-if="shwvStore.crtUnit.ref.tb.length > 0">
            <tr v-for="(tb, tbx) in shwvStore.crtUnit.ref.tb" :key="tbx">
                <td v-if="tbx === 0" :rowspan="rowspan">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <span>{{ shwvStore.crtUnit.idx + 1 }}</span>
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
                    {{ tb.tgts.join(' / ') }}
                    <div v-if="tb.file" class="file-text">{{ tb.file }}</div>
                </td>
            </tr>
        </template>

        <!-- ref.tb がない場合（1行表示） -->
        <tr v-else>
            <td>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <span>{{ shwvStore.crtUnit.idx + 1 }}</span>
                    <a-tag v-if="shwvStore.crtUnit.ref.quoted100?.length > 0" color="green" size="small">
                        Q {{ shwvStore.crtUnit.ref.quoted100.length }}
                    </a-tag>
                </div>
            </td>
            <td>{{ shwvStore.crtUnit.src }}</td>
            <td>-</td>
            <td>-</td>
        </tr>

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
    height: 1.5em; /* マージンの代わり */
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
</style>

