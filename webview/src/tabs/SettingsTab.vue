<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { IconSettings, IconDelete, IconPlus } from '@arco-design/web-vue/es/icon';
import { useShWvStore } from '../store/shwv';
import { storeToRefs } from 'pinia';

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['updateConfig', 'SettingsCommand']);

const shwvStore = useShWvStore();
const { phrases } = storeToRefs(shwvStore);

const localFontSize = ref(props.config.fontSize);
const localPhrases = ref<any[]>([]);

onMounted(() => {
  localPhrases.value = JSON.parse(JSON.stringify(phrases.value || []));
});

watch(phrases, (newVal) => {
  localPhrases.value = JSON.parse(JSON.stringify(newVal || []));
}, { deep: true });

watch(() => props.config.fontSize, (newVal) => {
  localFontSize.value = newVal;
});

function handleFontSizeChange(value: number) {
  emit('updateConfig', { fontSize: value });
}

function addPhrase() {
  localPhrases.value.push({ input: '', phrase: '' });
}

function removePhrase(index: number) {
  localPhrases.value.splice(index, 1);
}

function savePhrases() {
  // 空の入力をフィルタリング
  const cleanPhrases = localPhrases.value.filter(p => p.input.trim() || p.phrase.trim());
  emit('SettingsCommand', 'update-phrases', cleanPhrases);
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

      <a-card title="IntelliSense Phrases (phrase.json)" :bordered="false" class="settings-card">
        <template #extra>
          <a-button type="primary" size="small" @click="savePhrases">Save to phrase.json</a-button>
        </template>
        
        <div style="margin-bottom: 8px; font-size: 12px; color: var(--vscode-descriptionForeground);">
          Define shortcuts to quickly insert common phrases in the editor.
        </div>

        <a-table :data="localPhrases" :pagination="false" size="small" :bordered="{ cell: true }">
          <template #columns>
            <a-table-column title="Input (Shortcut)" data-index="input">
              <template #cell="{ record, rowIndex }">
                <a-input v-model="localPhrases[rowIndex].input" size="small" placeholder="e.g. @v" />
              </template>
            </a-table-column>
            <a-table-column title="Phrase (Expansion)" data-index="phrase">
              <template #cell="{ record, rowIndex }">
                <a-input v-model="localPhrases[rowIndex].phrase" size="small" placeholder="e.g. {VAR}" />
              </template>
            </a-table-column>
            <a-table-column title="Action" :width="70" align="center">
              <template #cell="{ rowIndex }">
                <a-button type="text" status="danger" size="small" @click="removePhrase(rowIndex)">
                  <template #icon><icon-delete /></template>
                </a-button>
              </template>
            </a-table-column>
          </template>
        </a-table>
        
        <a-button type="outline" long style="margin-top: 12px;" @click="addPhrase">
          <template #icon><icon-plus /></template>
          Add New Phrase
        </a-button>
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
