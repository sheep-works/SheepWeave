<script setup lang="ts">
import { ref } from 'vue';
// import SegmentRow from '../components/SegmentRow.vue';
import Nodata from '../components/Nodata.vue';
import { useShWvStore } from '../store/shwv';

import CurrentSegTbody from '../components/CurrentSegTbody.vue';

const shwvStore = useShWvStore();

const columns = [
    { title: 'ID', dataIndex: 'idx' },
    { title: 'Source', dataIndex: 'src' },
    { title: 'Target', dataIndex: 'tgt' },
];

defineProps({
    fontSize: {
        type: Number,
        default: 14
    }
});
</script>

<template>
  <div v-if="shwvStore.hasData">
    <a-typography-text>Current: {{ shwvStore.crtPos }} / {{ shwvStore.maxPos }}</a-typography-text>
    <table v-if="shwvStore.crtUnit" :style="{ fontSize: fontSize + 'px' }">
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
                <td>{{ tm.idx === -1 ? 'TM' : '# ' + tm.idx }}<br>{{ tm.ratio }}</td>
                <td v-html="tm.diff || tm.src"></td>
                <td colspan="2">{{ tm.tgt }}</td>
            </tr>
        </tbody>
    </table>
  </div>
  <div v-else>
    <Nodata />
  </div>
</template>

<style scoped>
table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

:deep(th), :deep(td) {
    padding: 10px 8px;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255,255,255,0.1));
    text-align: left;
    vertical-align: top;
    overflow-wrap: break-word;
}

:deep(ins) {
    color: #4daafc; /* 青 */
    font-size: 1.1rem;
    text-decoration: none;
    font-weight: bold;
}

:deep(del) {
    color: #fc4d4d; /* 赤 */
    font-size: 0.9rem;
    text-decoration: line-through;
    opacity: 0.7;
}

.segment-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

tr.is-external {
    background: repeating-linear-gradient(
        45deg,
        rgba(0, 0, 0, 0.1),
        rgba(0, 0, 0, 0.1) 10px,
        rgba(255, 255, 255, 0.05) 10px,
        rgba(255, 255, 255, 0.05) 20px
    );
}

tr.is-freezed {
    background-color: darkblue;
}
</style>
