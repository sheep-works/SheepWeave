<script setup lang="ts">
import { ref } from 'vue';
// import SegmentRow from '../components/SegmentRow.vue';
import Nodata from '../components/Nodata.vue';
import { useShWvStore } from '../store/shwv';
import { IconTranslate } from '@arco-design/web-vue/es/icon';
import CurrentSegTbody from '../components/CurrentSegTbody.vue';

const shwvStore = useShWvStore();

defineProps({
    fontSize: {
        type: Number,
        default: 14
    }
});
</script>

<template>
    <div id="translate-tab">
        <div class="header">
            <a-space>
            <icon-translate :style="{ fontSize: '24px', marginRight: '8px' }" />
            <a-typography-title :heading="4" style="margin: 0">Translate</a-typography-title>
            </a-space>
        </div>

        <a-divider />

        <div v-if="shwvStore.hasData">
            <a-typography-text>Current: {{ shwvStore.crtPos }} / {{ shwvStore.maxPos }}</a-typography-text>
            <table v-if="shwvStore.crtUnit">
                <colgroup>
                    <col style="width: 8%" />
                    <col style="width: 46%" />
                    <col style="width: 23%" />
                    <col style="width: 23%" />
                </colgroup>
                <thead>
                    <tr>
                        <th>ID / Ratio</th>
                        <th>Source</th>
                        <th colspan="2">Target</th>
                    </tr>
                </thead>
                <!-- 自身に関するデータ -->
                <CurrentSegTbody />
                <!-- TM -->
                <tbody v-if="shwvStore.crtUnit.ref.tms.length > 0">
                    <tr v-for="tm in shwvStore.crtUnit.ref.tms" :key="tm.idx" :class="{ 'is-external': tm.idx === -1 }">
                        <td :title="tm.file">
                            {{ tm.idx === -1 ? 'TM' : '# ' + tm.idx }}<br>
                            <span class="ratio-text">{{ tm.ratio }}%</span>
                            <div v-if="tm.file" class="file-text">{{ tm.file }}</div>
                        </td>
                        <td v-html="tm.diff || tm.src"></td>
                        <td colspan="2">{{ tm.idx === -1 ? tm.tgt : (shwvStore.units[tm.idx] && shwvStore.units[tm.idx].idx === tm.idx ? shwvStore.units[tm.idx].tgt : tm.tgt) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-else>
            <Nodata />
        </div>
    </div>
</template>

<style scoped>
#translate-tab {
    width: 100%;
    height: 100%;
    padding: 3px;
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

.ratio-text {
    font-weight: bold;
    color: var(--vscode-charts-blue);
}

.file-text {
    font-size: 0.7em;
    opacity: 0.6;
    margin-top: 4px;
    word-break: break-all;
}
</style>
