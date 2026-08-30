<script setup lang="ts">
import { ref } from 'vue';
// import SegmentRow from '../components/SegmentRow.vue';
import Nodata from '../components/Nodata.vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import { IconTranslate } from '@arco-design/web-vue/es/icon';
import CurrentSegTbody from '../components/CurrentSegTbody.vue';

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();

defineProps({
    fontSize: {
        type: Number,
        default: 14
    }
});

function getTargetUnit(idx: number) {
    if (idx < 0 || !shwvStore.units) return null;
    return shwvStore.units.find(u => u.idx === idx) || shwvStore.units[idx] || null;
}

function getUnitStatus(idx: number): number {
    const u = getTargetUnit(idx);
    return u ? (u.status || 0) : 0;
}

function getUnitTargetText(idx: number, fallback: string): string {
    const u = getTargetUnit(idx);
    if (!u) return fallback;
    if (u.tgt && u.tgt.trim() !== '') return u.tgt;
    if (u.pre && u.pre.trim() !== '') return u.pre;
    return fallback;
}
</script>

<template>
    <div id="translate-tab">
        <div class="header">
            <a-space align="center">
                <icon-translate :style="{ fontSize: '24px', marginRight: '8px' }" />
                <a-typography-title :heading="4" style="margin: 0">{{ i18nStore.getText('translateTab', 'title') || 'Translate' }}</a-typography-title>
            </a-space>
        </div>

        <a-divider style="margin: 16px 0;" />

        <div v-if="shwvStore.hasData">
            <a-typography-text>{{ i18nStore.getText('translateTab', 'titleCurrent') }}: {{ shwvStore.crtPos }} / {{ shwvStore.maxPos }}</a-typography-text>
            <table v-if="shwvStore.crtUnit">
                <colgroup>
                    <col style="width: 8%" />
                    <col style="width: 46%" />
                    <col style="width: 23%" />
                    <col style="width: 23%" />
                </colgroup>
                <thead>
                    <tr>
                        <th>{{ i18nStore.getText('translateTab', 'idRatio') }}</th>
                        <th>{{ i18nStore.getText('translateTab', 'source') }}</th>
                        <th colspan="2">{{ i18nStore.getText('translateTab', 'target') }}</th>
                    </tr>
                </thead>
                <!-- 自身に関するデータ -->
                <CurrentSegTbody />
                <!-- TM -->
                <tbody v-if="shwvStore.crtUnit.ref.tms.length > 0">
                    <tr v-for="(tm, tmIdx) in shwvStore.crtUnit.ref.tms" :key="tmIdx" :class="{ 'is-external': tm.idx === -1 }">
                        <td :title="tm.file">
                            <div class="tm-id-row">
                                <a-tooltip :content="i18nStore.getText('translateTab', 'applyTmTooltip', { num: tmIdx + 1 })">
                                    <span class="shortcut-badge">[{{ tmIdx + 1 }}]</span>
                                </a-tooltip>
                                <span class="seg-id">{{ tm.idx === -1 ? 'TM' : '#' + tm.idx }}</span>
                            </div>
                            <span class="ratio-text">{{ tm.ratio }}%</span>
                            <div v-if="tm.file" class="file-text">{{ tm.file }}</div>
                        </td>
                        <td v-html="tm.diff || tm.src"></td>
                        <td colspan="2">
                            <template v-if="tm.idx === -1">
                                {{ tm.tgt }}
                            </template>
                            <template v-else>
                                <div class="quote-target-cell">
                                    <a-tag v-if="getUnitStatus(tm.idx) === 1" color="green" size="small" class="status-tag">{{ i18nStore.getText('translateTab', 'confirmed') }}</a-tag>
                                    <a-tag v-else-if="getTargetUnit(tm.idx)?.tgt?.trim()" color="orange" size="small" class="status-tag">{{ i18nStore.getText('translateTab', 'draft') }}</a-tag>
                                    <a-tag v-else color="gray" size="small" class="status-tag">{{ i18nStore.getText('translateTab', 'unconfirmed') }}</a-tag>
                                    <span :class="{ 'unconfirmed-text': getUnitStatus(tm.idx) !== 1 }">
                                        {{ getUnitTargetText(tm.idx, tm.tgt) }}
                                    </span>
                                </div>
                            </template>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-else class="empty-state">
            <Nodata />
        </div>
    </div>
</template>

<style scoped>
#translate-tab {
    width: 100%;
    height: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    box-sizing: border-box;
}

.header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

:deep(th),
:deep(td) {
    padding: 0.7em 0.5em;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255, 255, 255, 0.1));
    text-align: left;
    vertical-align: top;
    overflow-wrap: break-word;
}

:deep(td:not(:first-child)) {
    font-size: v-bind('fontSize + "px"');
}

:deep(ins) {
    color: #4daafc;
    /* 青 */
    font-size: 1.1em;
    text-decoration: none;
    font-weight: bold;
}

:deep(del) {
    color: #fc4d4d;
    /* 赤 */
    font-size: 0.9em;
    text-decoration: line-through;
    opacity: 0.7;
}

.segment-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

tr.is-external {
    background: repeating-linear-gradient(45deg,
            rgba(0, 0, 0, 0.1),
            rgba(0, 0, 0, 0.1) 10px,
            rgba(255, 255, 255, 0.05) 10px,
            rgba(255, 255, 255, 0.05) 20px);
}

tr.is-freezed {
    background-color: darkblue;
}

.tm-id-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
}

.shortcut-badge {
    display: inline-block;
    background-color: var(--vscode-badge-background, #0e639c);
    color: var(--vscode-badge-foreground, #ffffff);
    font-size: 11px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
}

.seg-id {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888888);
    font-family: monospace;
}

.ratio-text {
    font-weight: bold;
    color: var(--vscode-charts-blue);
}

.quote-target-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

.status-tag {
    font-size: 10px;
    padding: 0 4px;
    height: 18px;
    line-height: 16px;
}

.unconfirmed-text {
    opacity: 0.75;
    font-style: italic;
}

.file-text {
    font-size: 0.7em;
    opacity: 0.6;
    margin-top: 4px;
    word-break: break-all;
}
</style>
