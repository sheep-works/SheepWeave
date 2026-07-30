<script setup lang="ts">
import { ref, watch } from 'vue';
import { useShWvStore } from '../store/shwv';
import { IconInteraction, IconPlayArrow, IconSync } from '@arco-design/web-vue/es/icon';

const shwvStore = useShWvStore();

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['LlmCommand', 'updateConfig']);

const localApiKey = ref(props.config.bobbinApiKey || '');

watch(() => props.config.bobbinApiKey, (newVal) => {
  localApiKey.value = newVal || '';
});

function updateApiKey(value: string) {
  emit('updateConfig', { bobbinApiKey: value });
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
</script>

<template>
  <div id="llm-tab">
    <div class="header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <a-space>
        <icon-interaction :style="{ fontSize: '24px', marginRight: '8px', color: '#10b981' }" />
        <a-typography-title :heading="4" style="margin: 0">LLM Quality Check & Translation</a-typography-title>
      </a-space>
      <a-radio-group v-model="shwvStore.llmMode" type="button" size="small">
        <a-radio value="normal">Normal</a-radio>
        <a-radio value="advanced">Advanced (PE)</a-radio>
      </a-radio-group>
    </div>

    <a-divider />

    <div class="llm-layout">
      <!-- Left pane: Configuration, Options & Prompt Editor -->
      <div class="llm-pane">
        <!-- API Key Configuration Card -->
        <a-card title="SheepBobbin Connection" :bordered="false" class="premium-card schema-card">
          <a-form-item label="API Key">
            <a-input-password 
              v-model="localApiKey" 
              placeholder="Enter SheepBobbin API Key" 
              @change="updateApiKey"
            />
          </a-form-item>
        </a-card>

        <!-- Output Keys Selection Card -->
        <a-card title="Output Keys (JSONL Schema)" :bordered="false" class="premium-card schema-card">
          <div class="checkbox-row">
            <a-checkbox v-model="shwvStore.llmChunkOptions.src">src</a-checkbox>
            <a-checkbox v-model="shwvStore.llmChunkOptions.tgt">tgt</a-checkbox>
            <a-checkbox v-model="shwvStore.llmChunkOptions.note">note</a-checkbox>
            <a-checkbox v-model="shwvStore.llmChunkOptions.history">history</a-checkbox>
            <a-checkbox v-model="shwvStore.llmChunkOptions.terms">terms</a-checkbox>
          </div>
          <div class="schema-help">
            Note: <code>idx</code> is always included.
          </div>
        </a-card>

        <!-- System Prompt Card -->
        <a-card title="System Prompt" :bordered="false" class="premium-card prompt-card">
          <template #extra>
            <a-button type="text" size="small" @click="shwvStore.resetLlmPrompt" class="reset-btn">
              <template #icon><icon-sync /></template>
              Reset to Default
            </a-button>
          </template>
          <a-textarea
            v-model="shwvStore.llmPrompt"
            placeholder="Enter system prompt here..."
            :auto-size="{ minRows: 10, maxRows: 18 }"
            class="prompt-textarea"
          />
          <div class="prompt-help">
            Supported placeholders: <code>{source_lang}</code>, <code>{target_lang}</code>
          </div>
        </a-card>
      </div>

      <!-- Right pane: Input Chunk & Results -->
      <div class="llm-pane right-pane">
        <!-- Alert Warning if Chunk exceeds 4000 chars -->
        <a-alert v-if="shwvStore.llmChunk && shwvStore.llmChunk.length > 4000" type="warning" show-icon style="margin-bottom: 16px; border-radius: 8px;">
          選択範囲が広すぎます。4000文字以下にしてください。（現在のサイズ: {{ shwvStore.llmChunk.length }}文字）
        </a-alert>

        <a-card title="Loaded Chunk (JSONL)" :bordered="false" class="premium-card">
          <div class="chunk-container">
            <pre v-if="shwvStore.llmChunk" class="chunk-pre">{{ shwvStore.llmChunk }}</pre>
            <div v-else class="empty-state">
              <a-typography-text type="secondary">
                No range selected. Select a range in the .shwvt editor and press Ctrl+Shift+L to load.
              </a-typography-text>
            </div>
          </div>
          <template #actions>
            <a-button
              type="primary"
              :loading="shwvStore.llmRequesting"
              :disabled="!shwvStore.llmChunk || shwvStore.llmChunk.length > 4000"
              @click="runRequest"
              class="run-btn"
            >
              <template #icon><icon-play-arrow /></template>
              Run Check
            </a-button>
          </template>
        </a-card>

        <a-card title="Results" :bordered="false" class="premium-card result-card">
          <a-spin :loading="shwvStore.llmRequesting" tip="Calling LLM via SheepBobbin..." style="display: block; width: 100%;">
            <div class="result-container">
              <div v-if="shwvStore.llmResponse" class="result-content">
                <pre class="result-pre">{{ shwvStore.llmResponse }}</pre>
              </div>
              <div v-else-if="!shwvStore.llmRequesting" class="empty-state">
                <a-typography-text type="secondary">
                  No results yet. Click "Run Check" to send the request.
                </a-typography-text>
              </div>
            </div>
          </a-spin>
        </a-card>
      </div>
    </div>
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
}

.header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.llm-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 8px;
}

.premium-card {
  background-color: var(--vscode-sideBar-background, #1e1e1e);
  border-radius: 8px;
  border: 1px solid var(--vscode-sideBar-border, #2d2d2d);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  margin-bottom: 16px;
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
  height: 120px;
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
  min-height: 200px;
  max-height: 320px;
  overflow-y: auto;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-radius: 6px;
  padding: 16px;
  border: 1px solid var(--vscode-sideBar-border, #2d2d2d);
}

.result-pre {
  margin: 0;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--vscode-editor-foreground, #d4d4d4);
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 100px;
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
</style>
