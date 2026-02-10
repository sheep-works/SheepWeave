<script setup lang="ts">
import { ref, onMounted } from 'vue';
import FlowTab from './tabs/FlowTab.vue';
import TranslateTab from './tabs/TranslateTab.vue';

const activeTab = ref('flow');

// Acquire the VS Code API
const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;

function setTab(tab: string) {
    activeTab.value = tab;
}

function handlePrepare() {
    if (vscode) {
        vscode.postMessage({ type: 'PREPARE' });
    } else {
        console.log('Mock: PREPARE command sent');
    }
}

onMounted(() => {
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'INIT':
                console.log('Init message received', message.payload);
                break;
        }
    });
});
</script>

<template>
  <div class="tabs">
    <div class="tab" :class="{ active: activeTab === 'flow' }" @click="setTab('flow')">Flow</div>
    <div class="tab" :class="{ active: activeTab === 'translate' }" @click="setTab('translate')">Translate</div>
  </div>
  
  <div class="content">
      <FlowTab v-if="activeTab === 'flow'" @prepare="handlePrepare" />
      <TranslateTab v-if="activeTab === 'translate'" />
  </div>
</template>

<style scoped>
</style>
