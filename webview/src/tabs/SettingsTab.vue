<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { IconSettings, IconDelete, IconPlus } from '@arco-design/web-vue/es/icon';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import { storeToRefs } from 'pinia';

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['updateConfig', 'SettingsCommand']);

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();
const { phrases } = storeToRefs(shwvStore);
const { locale } = storeToRefs(i18nStore);

const localFontSize = ref(props.config.fontSize);
const localPhrases = ref<any[]>([]);
const activeTab = ref('editor');

const extensionVersion = (window as any).SHEEP_WEAVE_VERSION || '0.0.0';
const testVer = ref(import.meta.env.VITE_TEST_VER || "");

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
      <a-space align="center">
        <icon-settings :style="{ fontSize: '24px', marginRight: '8px' }" />
        <a-typography-title :heading="4" style="margin: 0">{{ i18nStore.getText('settingsTab', 'title') || 'Settings' }}</a-typography-title>
      </a-space>
    </div>

    <a-divider style="margin: 16px 0;" />

    <a-tabs position="left" v-model="activeTab" style="flex: 1; min-height: 0;">
      <!-- Editor Settings -->
      <a-tab-pane key="editor" :title="i18nStore.getText('settingsTab', 'editorSubtab') || 'Editor Settings'">
        <div class="pane-content">
          <a-typography-text type="secondary" block style="margin-bottom: 16px;">
            {{ i18nStore.getText('settingsTab', 'editorHelp') || 'Customize your experience in SheepWeave. Changes here are saved to your global VS Code settings.' }}
          </a-typography-text>
          
          <a-card :title="i18nStore.getText('settingsTab', 'displayCard') || 'Translation Display'" :bordered="false" class="settings-card">
            <a-form :model="config" layout="vertical">
              <a-form-item :label="i18nStore.getText('settingsTab', 'language') || 'UI Language'">
                <a-tooltip :content="i18nStore.getText('settingsTab', 'languageTooltip')">
                  <a-select v-model="locale" style="width: 150px">
                      <a-option :value="'en'">English</a-option>
                      <a-option :value="'ja'">日本語</a-option>
                      <a-option :value="'zh'">中文</a-option>
                  </a-select>
                </a-tooltip>
              </a-form-item>

              <a-form-item :label="i18nStore.getText('settingsTab', 'fontSize') || 'Table Font Size (px)'">
                <a-tooltip :content="i18nStore.getText('settingsTab', 'fontSizeTooltip')">
                  <a-input-number v-model="localFontSize" :min="8" :max="72" @change="handleFontSizeChange"
                    style="width: 120px" />
                </a-tooltip>
              </a-form-item>
            </a-form>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- Auto-Completion -->
      <a-tab-pane key="autocomplete" :title="i18nStore.getText('settingsTab', 'autocompleteSubtab') || 'Auto-Completion'">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('settingsTab', 'phrasesCard') || 'IntelliSense Phrases (phrase.json)'" :bordered="false" class="settings-card">
            <template #extra>
              <a-button type="primary" size="small" @click="savePhrases">{{ i18nStore.getText('settingsTab', 'savePhrasesBtn') || 'Save to phrase.json' }}</a-button>
            </template>
            
            <div style="margin-bottom: 8px; font-size: 12px; color: var(--vscode-descriptionForeground);">
              {{ i18nStore.getText('settingsTab', 'phrasesHelp') || 'Define shortcuts to quickly insert common phrases in the editor.' }}
            </div>

            <a-table :data="localPhrases" :pagination="false" size="small" :bordered="{ cell: true }">
              <template #columns>
                <a-table-column :title="i18nStore.getText('settingsTab', 'colInput') || 'Input (Shortcut)'" data-index="input">
                  <template #cell="{ record, rowIndex }">
                    <a-input v-model="localPhrases[rowIndex].input" size="small" placeholder="e.g. @v" />
                  </template>
                </a-table-column>
                <a-table-column :title="i18nStore.getText('settingsTab', 'colPhrase') || 'Phrase (Expansion)'" data-index="phrase">
                  <template #cell="{ record, rowIndex }">
                    <a-input v-model="localPhrases[rowIndex].phrase" size="small" placeholder="e.g. {VAR}" />
                  </template>
                </a-table-column>
                <a-table-column :title="i18nStore.getText('settingsTab', 'colAction') || 'Action'" :width="70" align="center">
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
              {{ i18nStore.getText('settingsTab', 'addPhraseBtn') || 'Add New Phrase' }}
            </a-button>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- About Extension -->
      <a-tab-pane key="about" :title="i18nStore.getText('settingsTab', 'aboutSubtab') || 'このソフトについて'">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('infoTab', 'aboutCard') || 'SheepWeave について'" :bordered="false" class="settings-card">
            <a-descriptions :column="1" bordered>
              <a-descriptions-item :label="i18nStore.getText('infoTab', 'version') || 'Version'">
                <a-tag size="small" color="arcoblue" style="font-weight: bold;">v{{ extensionVersion }}</a-tag>
                <a-tag size="small" color="arcoblue" style="margin-left: 8px; font-weight: bold;" v-if="testVer !== ''">{{ testVer }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="i18nStore.getText('infoTab', 'developer') || 'Developer'">
                {{ i18nStore.getText('infoTab', 'developerValue') || '開発：合同会社ランベージ＆ひつじの翻訳室' }} <br/>
                <a-link href="https://lambuage.com" target="_blank">https://lambuage.com</a-link>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card :title="i18nStore.getText('settingsTab', 'versionLogsCard') || 'バージョン履歴 (Version Logs)'" :bordered="false" class="settings-card">
            <div v-if="props.config.versionLogs" class="version-logs-container">
              <pre class="version-logs-pre">{{ props.config.versionLogs }}</pre>
            </div>
            <div v-else class="empty-state" style="padding: 12px 0;">
              <a-typography-text type="secondary">
                {{ i18nStore.getText('settingsTab', 'noVersionLogs') || 'バージョン履歴がありません。' }}
              </a-typography-text>
            </div>
          </a-card>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
#settings-tab {
  width: 100%;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.pane-content {
  height: 100%;
  overflow-y: auto;
  padding-right: 12px;
}

.header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.settings-card {
  background-color: var(--vscode-sideBar-background);
  border-radius: 8px;
  margin-bottom: 16px;
}

.version-logs-pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  color: var(--vscode-foreground);
  background-color: var(--vscode-editor-background);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--vscode-widget-border, transparent);
}

:deep(.arco-card-header) {
  border-bottom: 1px solid var(--vscode-sideBar-border);
}

:deep(.arco-form-item-label) {
  color: var(--vscode-foreground);
  font-weight: 500;
}
</style>
