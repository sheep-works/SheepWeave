<script setup lang="ts">
import { ref } from 'vue';
import SegmentRow from '../components/SegmentRow.vue';

// Mock data for now
const segments = ref([
    { id: '1', source: 'Hello world', target: 'こんにちは世界' },
    { id: '2', source: 'This is a test.', target: '' }
]);
</script>

<template>
  <div class="translate-tab">
    <h2>Translation</h2>
    <div class="segment-list">
        <SegmentRow v-for="seg in segments" :key="seg.id" :segment="seg" />
    </div>
  </div>
</template>

<style scoped>
.segment-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
</style>
