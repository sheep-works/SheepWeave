<script setup lang="ts">
import { } from 'vue';

const props = defineProps<{
    segment: { id: string, source: string, target: string }
}>();
</script>

<template>
  <div class="segment-row">
    <div class="source">{{ segment.source }}</div>
    <div class="target">
        <textarea v-model="segment.target" placeholder="Translation..."></textarea>
    </div>
  </div>
</template>

<style scoped>
.segment-row {
    display: flex;
    gap: 10px;
    border: 1px solid #555;
    padding: 10px;
}
.source, .target {
    flex: 1;
}
textarea {
    width: 100%;
    min-height: 2em;
    resize: vertical;
}
</style>
