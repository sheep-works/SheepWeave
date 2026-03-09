<script setup lang="ts">
import { ref } from 'vue';
// import SegmentRow from '../components/SegmentRow.vue';
import Nodata from '../components/Nodata.vue';
import { useLmLgStore } from '../store/lmlg';

const lmlgStore = useLmLgStore();

const columns = [
    { title: 'ID', dataIndex: 'idx' },
    { title: 'Source', dataIndex: 'src' },
    { title: 'Target', dataIndex: 'tgt' },
];
</script>

<template>
  <div v-if="lmlgStore.hasData">
    <a-typography-text>Current: {{ lmlgStore.crtPos }} / {{ lmlgStore.maxPos }}</a-typography-text>
    <table v-if="lmlgStore.crtUnit">
        <thead>
            <tr>
                <th>ID / Ratio</th>
                <th>Source</th>
                <th>Target</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ lmlgStore.crtUnit.idx + 1 }}</td>
                <td>{{ lmlgStore.crtUnit.src }}</td>
                <td>{{ lmlgStore.crtUnit.tgt }}</td>
            </tr>
        </tbody>
        <tbody v-if="lmlgStore.crtUnit.ref.tms.length > 0">
            <tr v-for="tm in lmlgStore.crtUnit.ref.tms" :key="tm.idx">
                <td>{{ tm.ratio }}</td>
                <td>{{ tm.src }}</td>
                <td>{{ tm.tgt }}</td>
            </tr>
        </tbody>
        <tbody v-if="lmlgStore.crtUnit.ref.tb.length > 0">
            <tr v-for="tb, tbx in lmlgStore.crtUnit.ref.tb" :key="tbx">
                <td>{{ tbx }}</td>
                <td>{{ tb.src }}</td>
                <td>{{ tb.tgts.join(' | ') }}</td>
            </tr>
        </tbody>
    </table>
  </div>
  <div v-else>
    <Nodata />
  </div>
</template>

<style scoped>
.segment-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

tr.is-freezed {
    background-color: darkblue;
}
</style>
