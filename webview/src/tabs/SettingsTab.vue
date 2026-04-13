<script setup lang="ts">
import { ref, watch } from 'vue';
import { IconSettings } from '@arco-design/web-vue/es/icon';

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['updateConfig']);

const localFontSize = ref(props.config.fontSize);

watch(() => props.config.fontSize, (newVal) => {
  localFontSize.value = newVal;
});

function handleFontSizeChange(value: number) {
  emit('updateConfig', { fontSize: value });
}
</script>

<template>
  <div id="settings-tab">
    <div class="header">
      <a-space>
        <icon-settings :style="{ fontSize: '24px', marginRight: '8px' }" />
        <a-typography-title :heading="4" style="margin: 0">Settings</a-typography-title>
      </a-space>
    </div>

    <a-divider />

    <a-form :model="config" layout="vertical" class="settings-form">
      <a-typography-text type="secondary" block style="margin-bottom: 16px;">
        Customize your experience in SheepWeave. Changes here are saved to your global VS Code settings.
      </a-typography-text>

      <a-card title="Translation Display" :bordered="false" class="settings-card">
        <a-form-item label="Table Font Size (px)">
          <a-input-number v-model="localFontSize" :min="8" :max="72" @change="handleFontSizeChange"
            style="width: 120px" />
          <template #extra>
            <div style="margin-top: 4px;">Adjust the font size of the text in the Translate tab for better readability.
            </div>
          </template>
        </a-form-item>
      </a-card>
    </a-form>
  </div>
</template>

<style scoped>
#settings-tab {
  padding: 24px;
  max-width: 600px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.settings-form {
  margin-top: 16px;
}

.settings-card {
  background-color: var(--vscode-sideBar-background);
  border-radius: 8px;
  margin-bottom: 16px;
}

:deep(.arco-card-header) {
  border-bottom: 1px solid var(--vscode-sideBar-border);
}

:deep(.arco-form-item-label) {
  color: var(--vscode-foreground);
  font-weight: 500;
}
</style>
