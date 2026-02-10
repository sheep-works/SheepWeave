<script setup lang="ts">
defineEmits(['prepare']);
</script>

<template>
  <div class="flow-tab">
    <h2>Project Flow</h2>
    <div class="actions">
        <button @click="$emit('prepare')">Prepare Project</button>
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
