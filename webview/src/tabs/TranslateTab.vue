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
                <th>ID</th>
                <th>Source</th>
                <th>Target</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ lmlgStore.crtUnit.idx }}</td>
                <td>{{ lmlgStore.crtUnit.src }}</td>
                <td>{{ lmlgStore.crtUnit.tgt }}</td>
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
</style>
