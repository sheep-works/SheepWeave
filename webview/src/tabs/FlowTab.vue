<script setup lang="ts">
defineEmits(['init', 'prepare', 'start', 'finish']);
</script>

<template>
  <div class="flow-tab">
    <h2>Project Flow</h2>
    <div class="actions">
      <button @click="$emit('init')">INITIALIZE</button>  
      <button @click="$emit('prepare')">PREPARE</button>
      <button @click="$emit('start')">START</button>
      <button @click="$emit('finish')">FINISH</button>
    </div>
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
