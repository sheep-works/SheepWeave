<script setup lang="ts">
import { useShWvStore } from '../store/shwv';
import { IconInfoCircle } from '@arco-design/web-vue/es/icon';

const shwvStore = useShWvStore();
</script>

<template>
    <div id="info-tab">
        <div class="header">
            <a-space>
                <icon-info-circle :style="{ fontSize: '24px', marginRight: '8px' }" />
                <a-typography-title :heading="4" style="margin: 0">Information</a-typography-title>
            </a-space>
        </div>

        <a-divider />

        <div v-if="shwvStore.hasData">
            <a-card title="Project Metadata" :bordered="false">
                <a-descriptions :column="1" bordered>
                    <a-descriptions-item label="Source Language">
                        {{ shwvStore.meta.sourceLang }}
                    </a-descriptions-item>
                    <a-descriptions-item label="Target Language">
                        {{ shwvStore.meta.targetLang }}
                    </a-descriptions-item>
                    <a-descriptions-item label="Bilingual Path">
                        <span class="path-text">{{ shwvStore.meta.bilingualPath }}</span>
                    </a-descriptions-item>
                </a-descriptions>
            </a-card>

            <a-card title="Source Files" :bordered="false" style="margin-top: 1rem;">
                <a-list size="small">
                    <a-list-item v-for="file in shwvStore.meta.files" :key="file.name">
                        <span class="file-name">{{ file.name }}</span>
                        <template #actions>
                            <span class="file-range">Units: {{ file.start }} - {{ file.end }}</span>
                        </template>
                    </a-list-item>
                </a-list>
            </a-card>

            <a-card title="TM Files" :bordered="false" style="margin-top: 1rem;" v-if="shwvStore.meta.tmFiles?.length">
                <a-list size="small">
                    <a-list-item v-for="f in shwvStore.meta.tmFiles" :key="f">
                        {{ f }}
                    </a-list-item>
                </a-list>
            </a-card>

            <a-card title="TB Files" :bordered="false" style="margin-top: 1rem;" v-if="shwvStore.meta.tbFiles?.length">
                <a-list size="small">
                    <a-list-item v-for="f in shwvStore.meta.tbFiles" :key="f">
                        {{ f }}
                    </a-list-item>
                </a-list>
            </a-card>
        </div>
        <div v-else style="text-align: center; color: var(--color-text-3); margin-top: 2rem;">
            No project data loaded.
        </div>
    </div>
</template>

<style scoped>
#info-tab {
    width: 100%;
    height: 100%;
    padding: 1rem;
    overflow-y: auto;
}

.path-text {
    word-break: break-all;
    font-size: 0.9em;
    opacity: 0.8;
}

.file-name {
    font-weight: bold;
}

.file-range {
    font-size: 0.85em;
    color: var(--color-text-3);
}
</style>
