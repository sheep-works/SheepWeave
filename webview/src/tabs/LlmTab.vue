<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import { IconInteraction, IconPlayArrow, IconSync, IconExport, IconImport, IconStop, IconCheck, IconDelete, IconRefresh } from '@arco-design/web-vue/es/icon';

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['LlmCommand', 'updateConfig']);

const localApiKey = ref(props.config.bobbinApiKey || '');
const localAutoReflect = ref(props.config.autoReflectLlmToTm !== false);
const useLocalPrompt = ref(false);
const promptFiles = ref<string[]>([]);
const selectedPromptFile = ref<string>('');

const scanPromptFiles = () => {
  emit('LlmCommand', 'scan-prompt-files');
};

const onUseLocalPromptChange = (val: boolean | (string | number | boolean)[]) => {
  if (val) {
    scanPromptFiles();
  }
};

const onSelectPromptFile = (file: string) => {
  selectedPromptFile.value = file;
  importPrompt();
};

onMounted(() => {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'PROMPT_FILES_SCANNED') {
      promptFiles.value = message.data || [];
      if (promptFiles.value.length > 0 && !selectedPromptFile.value) {
        selectedPromptFile.value = promptFiles.value[0];
      }
    } else if (message.type === 'PROMPT_IMPORTED') {
      if (message.data && message.data.prompt !== undefined) {
        shwvStore.setLlmPrompt(message.data.prompt);
      }
    }
  });
  scanPromptFiles();
});

watch(() => props.config.bobbinApiKey, (newVal) => {
  localApiKey.value = newVal || '';
});

watch(() => props.config.autoReflectLlmToTm, (newVal) => {
  localAutoReflect.value = newVal !== false;
});

function updateApiKey(value: string) {
  emit('updateConfig', { bobbinApiKey: value });
}

function updateAutoReflect(value: boolean) {
  emit('updateConfig', { autoReflectLlmToTm: value });
}

function clearLlmTms() {
  emit('LlmCommand', 'clear-llm-tms');
}

function runRequest() {
  if (!shwvStore.llmChunk || shwvStore.llmChunk.length > 4000) return;
  shwvStore.setLlmRequesting(true);
  
  // Replace language placeholders before sending
  const promptToSend = shwvStore.llmPrompt
    .replace(/{source_lang}/g, shwvStore.sourceLang)
    .replace(/{target_lang}/g, shwvStore.targetLang);

  emit('LlmCommand', 'run-llm-request', {
    chunk: shwvStore.llmChunk,
    prompt: promptToSend,
    mode: shwvStore.llmMode
  });
}

/*
function exportPrompt() {
  emit('LlmCommand', 'export-prompt', {
    prompt: shwvStore.llmPrompt
  });
}
*/

function importPrompt() {
  if (!selectedPromptFile.value) return;
  emit('LlmCommand', 'import-prompt', { filePath: selectedPromptFile.value });
}

function runBatchRequest() {
  const promptToSend = shwvStore.llmPrompt
    .replace(/{source_lang}/g, shwvStore.sourceLang)
    .replace(/{target_lang}/g, shwvStore.targetLang);

  shwvStore.setLlmBatchRunning(true);
  shwvStore.setLlmResponse('');
  emit('LlmCommand', 'run-llm-batch-request', {
    prompt: promptToSend,
    mode: shwvStore.llmMode,
    options: JSON.parse(JSON.stringify(shwvStore.llmChunkOptions))
  });
}

function cancelBatchRequest() {
  emit('LlmCommand', 'cancel-llm-batch');
}

function applyResults() {
  if (!shwvStore.llmResponse) return;
  emit('LlmCommand', 'apply-llm-results', {
    result: shwvStore.llmResponse
  });
}

const batchPercent = computed(() => {
  if (!shwvStore.llmBatchProgress.total) return 0;
  return Math.round((shwvStore.llmBatchProgress.current / shwvStore.llmBatchProgress.total) * 100);
});
</script>

<template>
  <div id="llm-tab">
    <div class="header">
      <a-space align="center">
        <icon-interaction :style="{ fontSize: '24px', marginRight: '8px', color: '#10b981' }" />
        <a-typography-title :heading="4" style="margin: 0">{{ i18nStore.getText('llmTab', 'title') || 'AI / LLM Assistant' }}</a-typography-title>
      </a-space>
    </div>

    <a-divider style="margin: 16px 0;" />

    <a-tabs default-active-key="run" position="left" class="llm-tabs">
      <!-- 1. Run (Execution & Results) -->
      <a-tab-pane key="run" :title="i18nStore.getText('llmTab', 'runTabTitle') || 'Run & Results'">
        <div class="subtab-content">
          <!-- Execution Buttons Card (2 buttons) -->
          <a-card :title="i18nStore.getText('llmTab', 'executionCard') || 'Execution'" :bordered="false" class="premium-card">
            <template #extra>
              <a-radio-group v-model="shwvStore.llmMode" type="button" size="small">
                <a-tooltip content="通常モード: 設定したプロンプトと対象文のみを送信します">
                  <a-radio value="normal">{{ i18nStore.getText('llmTab', 'modeNormal') || 'Normal' }}</a-radio>
                </a-tooltip>
                <a-tooltip content="Advanced PEモード: 人間の編集履歴（直近の修正例やお気に入り例）をAIに自動提示し、修正スタイルを学習させます">
                  <a-radio value="advanced">{{ i18nStore.getText('llmTab', 'modeAdvanced') || 'Advanced (PE)' }}</a-radio>
                </a-tooltip>
              </a-radio-group>
            </template>

            <div v-if="shwvStore.llmBatchRunning" class="batch-status-container">
              <a-progress :percent="batchPercent" :status="batchPercent === 100 ? 'success' : 'normal'" />
              <div class="batch-status-text">
                {{ shwvStore.llmBatchProgress.status || `Processing... (${shwvStore.llmBatchProgress.current}/${shwvStore.llmBatchProgress.total})` }}
              </div>
              <a-button type="outline" status="danger" size="small" @click="cancelBatchRequest" style="margin-top: 8px;">
                <template #icon><icon-stop /></template>
                {{ i18nStore.getText('llmTab', 'cancelBatch') || 'Cancel Batch' }}
              </a-button>
            </div>

            <div v-else class="execution-grid">
              <a-tooltip :content="i18nStore.getText('llmTab', 'loadSelectionTooltip')">
                <a-button
                  type="primary"
                  :loading="shwvStore.llmRequesting"
                  :disabled="!shwvStore.llmChunk || shwvStore.llmChunk.length > 4000"
                  @click="runRequest"
                  class="run-btn"
                >
                  <template #icon><icon-play-arrow /></template>
                  {{ i18nStore.getText('llmTab', 'runSelected') || 'Run Selected Range' }}
                </a-button>
              </a-tooltip>

              <a-tooltip :content="i18nStore.getText('llmTab', 'batchRunTooltip')">
                <a-button
                  type="outline"
                  status="success"
                  :loading="shwvStore.llmBatchRunning"
                  @click="runBatchRequest"
                  class="batch-btn"
                >
                  <template #icon><icon-play-arrow /></template>
                  {{ i18nStore.getText('llmTab', 'batchRun') || 'Run Full Document Batch' }}
                </a-button>
              </a-tooltip>
            </div>
          </a-card>

          <!-- Alert Warning if Chunk exceeds 4000 chars -->
          <a-alert v-if="shwvStore.llmChunk && shwvStore.llmChunk.length > 4000" type="warning" show-icon style="margin-bottom: 12px; border-radius: 8px;">
            {{ i18nStore.getText('llmTab', 'rangeAlert', { len: shwvStore.llmChunk.length }) || `選択範囲が広すぎます。4000文字以下にしてください。（現在のサイズ: ${shwvStore.llmChunk.length}文字）` }}
          </a-alert>

          <!-- Selected Chunk Preview -->
          <a-card :title="i18nStore.getText('llmTab', 'selectedChunkCard') || 'Selected Chunk Preview (JSONL)'" :bordered="false" class="premium-card">
            <div class="chunk-container">
              <pre v-if="shwvStore.llmChunk" class="chunk-pre">{{ shwvStore.llmChunk }}</pre>
              <div v-else class="empty-state">
                <a-typography-text type="secondary">
                  {{ i18nStore.getText('llmTab', 'noRangeSelected') || 'No range selected. Select a range in .shwvt editor and press Ctrl+Q to load.' }}
                </a-typography-text>
              </div>
            </div>
          </a-card>

          <!-- Results Card -->
          <a-card :title="i18nStore.getText('llmTab', 'responseCard') || 'Response & Results'" :bordered="false" class="premium-card result-card">
            <template #extra>
              <a-button
                v-if="shwvStore.llmResponse"
                type="primary"
                status="success"
                size="small"
                @click="applyResults"
                class="apply-btn"
              >
                <template #icon><icon-check /></template>
                {{ i18nStore.getText('llmTab', 'applyToProject') || 'Apply to Project' }}
              </a-button>
            </template>
            <a-spin :loading="shwvStore.llmRequesting || shwvStore.llmBatchRunning" :tip="i18nStore.getText('llmTab', 'callingLlmTip') || 'Calling LLM via SheepBobbin...'" style="display: block; width: 100%;">
              <div class="result-container">
                <div v-if="shwvStore.llmResponse !== '' || shwvStore.llmRequesting || shwvStore.llmBatchRunning" class="result-content">
                  <a-textarea
                    v-model="shwvStore.llmResponse"
                    placeholder="LLM response will appear here. You can edit this text before applying."
                    :auto-size="{ minRows: 8, maxRows: 20 }"
                    class="result-textarea"
                  />
                </div>
                <div v-else class="empty-state">
                  <a-typography-text type="secondary">
                    {{ i18nStore.getText('llmTab', 'noResponseYet') || 'No response yet. Run check or batch process to view results here.' }}
                  </a-typography-text>
                </div>
              </div>
            </a-spin>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- 2. Prompt (Prompt & Output Keys) -->
      <a-tab-pane key="prompt" :title="i18nStore.getText('llmTab', 'promptTabTitle') || 'Prompt & Schema'">
        <div class="subtab-content">
          <!-- Output Keys Selection Card -->
          <a-card :title="i18nStore.getText('llmTab', 'outputKeysCard') || 'Output Keys (JSONL Schema)'" :bordered="false" class="premium-card schema-card">
            <div class="checkbox-row">
              <a-checkbox v-model="shwvStore.llmChunkOptions.src">src</a-checkbox>
              <a-checkbox v-model="shwvStore.llmChunkOptions.tgt">tgt</a-checkbox>
              <a-checkbox v-model="shwvStore.llmChunkOptions.note">note</a-checkbox>
              <a-checkbox v-model="shwvStore.llmChunkOptions.history">history</a-checkbox>
              <a-checkbox v-model="shwvStore.llmChunkOptions.terms">terms</a-checkbox>
            </div>
            <div class="schema-help">
              {{ i18nStore.getText('llmTab', 'schemaIdxNote') || 'Note: idx is always included.' }}
            </div>
          </a-card>

          <!-- System Prompt Card -->
          <a-card :title="i18nStore.getText('llmTab', 'systemPromptCard') || 'System Prompt'" :bordered="false" class="premium-card prompt-card">
            <template #extra>
              <a-space size="mini">
                <a-checkbox v-model="useLocalPrompt">
                  {{ i18nStore.getText('llmTab', 'useLocalPrompt') || 'Use Local Prompt' }}
                </a-checkbox>
                <a-select v-model="selectedPromptFile" :disabled="!useLocalPrompt" @change="onSelectPromptFile" placeholder="Select prompt file" style="width: 200px" allow-search size="small">
                  <a-option v-for="f in promptFiles" :key="f" :value="f">{{ f }}</a-option>
                </a-select>
                <a-button type="text" size="small" :disabled="!useLocalPrompt" @click="scanPromptFiles" title="Refresh prompt list">
                  <template #icon><icon-refresh /></template>
                </a-button>
                <!-- Export function commented out for now
                <a-button type="text" size="small" @click="exportPrompt" class="action-btn">
                  <template #icon><icon-export /></template>
                  {{ i18nStore.getText('llmTab', 'exportPrompt') || 'Export prompt.md' }}
                </a-button>
                -->
                <a-button type="text" size="small" @click="shwvStore.resetLlmPrompt" class="reset-btn">
                  <template #icon><icon-sync /></template>
                  {{ i18nStore.getText('llmTab', 'resetPrompt') || 'Reset' }}
                </a-button>
              </a-space>
            </template>
            <a-textarea
              v-model="shwvStore.llmPrompt"
              :placeholder="i18nStore.getText('llmTab', 'promptPlaceholder') || 'Enter system prompt here...'"
              :auto-size="{ minRows: 12, maxRows: 22 }"
              class="prompt-textarea"
            />
            <div class="prompt-help">
              Supported placeholders: <code>{source_lang}</code>, <code>{target_lang}</code>
            </div>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- 3. Bobbin (Connection & Settings) -->
      <a-tab-pane key="bobbin" :title="i18nStore.getText('llmTab', 'bobbinTabTitle') || 'Bobbin Config'">
        <div class="subtab-content">
          <a-card :title="i18nStore.getText('llmTab', 'bobbinConnectionCard') || 'SheepBobbin Connection'" :bordered="false" class="premium-card schema-card">
            <a-form-item :label="i18nStore.getText('llmTab', 'apiKeyLabel') || 'API Key'">
              <a-input-password 
                v-model="localApiKey" 
                :placeholder="i18nStore.getText('llmTab', 'apiKeyPlaceholder') || 'Enter SheepBobbin API Key'" 
                @change="updateApiKey"
              />
            </a-form-item>
            <a-divider style="margin: 12px 0;" />
            <a-form-item :label="i18nStore.getText('llmTab', 'autoReflectLabel') || 'refs.tm に LLM 結果を自動反映'">
              <a-switch v-model="localAutoReflect" @change="updateAutoReflect" />
            </a-form-item>
            <div class="schema-help" style="margin-top: -8px;">
              {{ i18nStore.getText('llmTab', 'autoReflectHelp') || 'LLM の出力結果を翻訳メモリ候補 (refs.tm) に自動登録します' }}
            </div>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- 4. Reset (LLM Results Reset) -->
      <a-tab-pane key="reset" :title="i18nStore.getText('llmTab', 'resetTabTitle') || 'LLM 結果のリセット'">
        <div class="subtab-content">
          <a-card :title="i18nStore.getText('llmTab', 'resetCardTitle') || 'LLM 翻訳メモリの一括削除'" :bordered="false" class="premium-card schema-card">
            <p style="margin-top: 0; color: var(--color-text-2); font-size: 13px; line-height: 1.6;">
              {{ i18nStore.getText('llmTab', 'resetDescription') || 'プロジェクト内の各文に保持されている LLM 起源の翻訳メモリ候補 (file: \'LLM\') を一括で削除します。' }}
            </p>
            <a-popconfirm
              :content="i18nStore.getText('llmTab', 'resetConfirmTitle') || '本当に LLM 翻訳メモリを一括削除しますか？'"
              type="warning"
              @ok="clearLlmTms"
            >
              <a-button type="primary" status="danger" style="margin-top: 8px;">
                <template #icon><icon-delete /></template>
                {{ i18nStore.getText('llmTab', 'resetBtn') || 'LLM 翻訳メモリを一括削除' }}
              </a-button>
            </a-popconfirm>
          </a-card>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
#llm-tab {
  width: 100%;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.llm-tabs {
  flex: 1;
  height: 100%;
}

.subtab-content {
  padding: 4px 8px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.execution-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.premium-card {
  background-color: var(--vscode-sideBar-background, #1e1e1e);
  border-radius: 8px;
  border: 1px solid var(--vscode-sideBar-border, #2d2d2d);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  margin-bottom: 0px;
  transition: all 0.2s ease;
}

.premium-card:hover {
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2);
}

.schema-card {
  padding-bottom: 8px;
}

.checkbox-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 8px;
}

.schema-help {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, #888);
}

.schema-help code {
  background-color: rgba(255, 255, 255, 0.05);
  padding: 1px 3px;
  border-radius: 3px;
}

.prompt-textarea {
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  background-color: var(--vscode-input-background, #2d2d2d);
  color: var(--vscode-input-foreground, #cccccc);
  border: 1px solid var(--vscode-input-border, #3d3d3d);
}

.prompt-help {
  margin-top: 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground, #888);
}

.prompt-help code {
  background-color: rgba(255, 255, 255, 0.05);
  padding: 1px 3px;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
}

.chunk-container {
  height: 100px;
  overflow-y: auto;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-radius: 6px;
  padding: 10px;
  border: 1px solid var(--vscode-sideBar-border, #2d2d2d);
}

.chunk-pre {
  margin: 0;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--vscode-editor-foreground, #d4d4d4);
}

.result-container {
  min-height: 180px;
  max-height: 380px;
  overflow-y: auto;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-radius: 6px;
  padding: 14px;
  border: 1px solid var(--vscode-sideBar-border, #2d2d2d);
}

.result-pre,
.result-textarea {
  margin: 0;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  background-color: var(--vscode-input-background, #2d2d2d);
  color: var(--vscode-input-foreground, #cccccc);
  border: 1px solid var(--vscode-input-border, #3d3d3d);
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 80px;
  text-align: center;
}

.run-btn {
  width: 100%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  font-weight: 600;
  transition: all 0.2s ease;
}

.run-btn:hover {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.reset-btn {
  color: var(--vscode-button-secondaryForeground, #ccc);
}

.reset-btn:hover {
  color: var(--vscode-button-hoverBackground, #fff);
}

.action-btn {
  color: var(--vscode-textLink-foreground, #3b82f6);
}

.action-btn:hover {
  color: var(--vscode-textLink-activeForeground, #60a5fa);
}

.batch-btn {
  width: 100%;
  border-radius: 6px;
  font-weight: 600;
}

.batch-status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.batch-status-text {
  font-size: 12px;
  color: var(--vscode-descriptionForeground, #888);
}
</style>
