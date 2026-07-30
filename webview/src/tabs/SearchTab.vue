<script setup lang="ts">
import { ref } from 'vue';
import { IconSearch } from '@arco-design/web-vue/es/icon';
import ConcordanceView from '../components/ConcordanceView.vue';
import FilterView from '../components/FilterView.vue';

const emit = defineEmits(['SearchCommand']);
const mode = ref<'concordance' | 'filter'>('concordance');

const handleCommand = (cmd: string, payload?: any) => {
    emit('SearchCommand', cmd, payload);
};

</script>

<template>
    <div id="search-tab">
        <div class="header">
            <a-space>
                <icon-search :style="{ fontSize: '24px', marginRight: '8px' }" />
                <a-typography-title :heading="4" style="margin: 0">Search</a-typography-title>
                
                <a-radio-group v-model="mode" type="button" style="margin-left: 16px;">
                    <a-radio value="concordance">Search (Concordance)</a-radio>
                    <a-radio value="filter">Filter & Edit</a-radio>
                </a-radio-group>
            </a-space>
        </div>

        <a-divider />

        <div class="content-area">
            <ConcordanceView v-if="mode === 'concordance'" @ConcordanceCommand="handleCommand" />
            <FilterView v-else-if="mode === 'filter'" @FilterCommand="handleCommand" />
        </div>
    </div>
</template>

<style scoped>
#search-tab {
    width: 100%;
    height: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
}

.header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.content-area {
    flex: 1;
    overflow: hidden; /* child components will handle their own scrolling */
}
</style>
