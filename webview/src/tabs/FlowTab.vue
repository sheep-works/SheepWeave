<script setup lang="ts">
defineEmits(['init', 'prepare', 'start', 'finish']);
</script>

<template>
  <div class="flow-tab">
    <h2>Project Flow</h2>
    <a-timeline class="actions">
      <a-timeline-item>
        <a-card title="INITIALIZE">
          <template #extra>
            <a-button @click="$emit('init')">START</a-button>  
          </template>
          <a-typography-text>Initialize Project, set some designated directories</a-typography-text>
        </a-card>
      </a-timeline-item>  
      <a-timeline-item>
        <a-card title="PREPARE">
          <template #extra>
            <a-button @click="$emit('prepare')">START</a-button>  
          </template>
          <a-typography-text>Prepare Project, copy data to working directory</a-typography-text>
        </a-card>
      </a-timeline-item>
      <a-timeline-item>
        <a-card title="START">
          <template #extra>
            <a-button @click="$emit('start')">START</a-button>  
          </template>
          <a-typography-text>Start Translation</a-typography-text>
        </a-card>
      </a-timeline-item>
      <a-timeline-item>
        <a-card title="FINISH">
          <template #extra>
            <a-button @click="$emit('finish')">START</a-button>  
          </template>
          <a-typography-text>Finish Translation</a-typography-text>
        </a-card>
      </a-timeline-item>  
    </a-timeline>
    <div class="stats">
        <h3>Statistics</h3>
        <p>Segments: 0</p>
        <p>Untranslated: 0</p>
    </div>
  </div>
</template>

<style scoped>
.actions {
    margin-bottom: 20px;
}
button {
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
}
</style>
