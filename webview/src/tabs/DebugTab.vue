<script setup lang="ts">
import Nodata from '../components/Nodata.vue';
import { useShWvStore } from '../store/shwv';

const shwvStore = useShWvStore();
</script>

<template>
  <div v-if="shwvStore.hasData">
    <a-list>
        <a-list-item>
            <a-typography-text>Current Position: {{ shwvStore.crtPos }}</a-typography-text>
        </a-list-item>
        <a-list-item>
            <a-typography-text>Max Position: {{ shwvStore.maxPos }}</a-typography-text>
        </a-list-item>
        <a-list-item>
            <a-typography-text>Meta Information: {{ shwvStore.meta }}</a-typography-text>
        </a-list-item>
        <a-list-item>
            <a-typography-text>Units ({{ shwvStore.units.length }}):</a-typography-text>
            <a-list v-for="unit in shwvStore.units">
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
