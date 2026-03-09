<script setup lang="ts">
import Nodata from '../components/Nodata.vue';
import { useLmLgStore } from '../store/lmlg';

const lmlgStore = useLmLgStore();
</script>

<template>
  <div v-if="lmlgStore.hasData">
    <a-list>
        <a-list-item>
            <a-typography-text>Current Position: {{ lmlgStore.crtPos }}</a-typography-text>
        </a-list-item>
        <a-list-item>
            <a-typography-text>Max Position: {{ lmlgStore.maxPos }}</a-typography-text>
        </a-list-item>
        <a-list-item>
            <a-typography-text>Meta Information: {{ lmlgStore.meta }}</a-typography-text>
        </a-list-item>
        <a-list-item>
            <a-typography-text>Units ({{ lmlgStore.units.length }}):</a-typography-text>
            <a-list v-for="unit in lmlgStore.units">
                <a-list-item>
                    <a-typography-text>{{ unit }}</a-typography-text>
                </a-list-item>
            </a-list>
        </a-list-item>
    </a-list>
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
