<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import { Message } from '@arco-design/web-vue';
import { IconInteraction, IconPlayArrow, IconSync, IconStop, IconCheck, IconDelete, IconRefresh, IconSend, IconCopy, IconDownload, IconPushpin } from '@arco-design/web-vue/es/icon';

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['LlmCommand', 'updateConfig']);

const activeSubTab = ref('partial');
const localApiKey = ref(props.config.bobbinApiKey || '');
const localAutoReflect = ref(props.config.autoReflectLlmToTm !== false);
const applyToPre = ref(true);
const promptFiles = ref<string[]>([]);

const scanPromptFiles = () => {
  emit('LlmCommand', 'scan-prompt-files');
};

const onSelectPromptFile = (file: string) => {
  shwvStore.setLlmSelectedPromptFile(file);
  importPrompt();
};

onMounted(() => {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'PROMPT_FILES_SCANNED') {
      promptFiles.value = message.data || [];
      if (promptFiles.value.length > 0 && !shwvStore.llmSelectedPromptFile) {
        shwvStore.setLlmSelectedPromptFile(promptFiles.value[0]);
      }
      if (shwvStore.llmUseLocalPrompt && shwvStore.llmSelectedPromptFile) {
        importPrompt();
      }
    } else if (message.type === 'PROMPT_IMPORTED') {
      if (message.data && message.data.prompt !== undefined) {
        shwvStore.setLlmPrompt(message.data.prompt);
      }
    } else if (message.type === 'LOAD_LLM_CHUNK') {
      activeSubTab.value = 'partial';
    }
  });
  scanPromptFiles();
});

watch(() => shwvStore.llmUseLocalPrompt, (enabled) => {
  if (enabled) {
    if (!shwvStore.llmSelectedPromptFile && promptFiles.value.length > 0) {
      shwvStore.setLlmSelectedPromptFile(promptFiles.value[0]);
    }
    if (shwvStore.llmSelectedPromptFile) {
      importPrompt();
    }
  }
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
  
  const promptToSend = shwvStore.llmPrompt
    .replace(/{source_lang}/g, shwvStore.sourceLang)
    .replace(/{target_lang}/g, shwvStore.targetLang);

  emit('LlmCommand', 'run-llm-request', {
    chunk: shwvStore.llmChunk,
    prompt: promptToSend,
    mode: shwvStore.llmMode
  });
}

function importPrompt() {
  if (!shwvStore.llmSelectedPromptFile) return;
  emit('LlmCommand', 'import-prompt', { filePath: shwvStore.llmSelectedPromptFile });
}

function exportPrompt() {
  emit('LlmCommand', 'export-prompt', { prompt: shwvStore.llmPrompt });
}

function runBatchRequest() {
  const promptToSend = shwvStore.llmPrompt
    .replace(/{source_lang}/g, shwvStore.sourceLang)
    .replace(/{target_lang}/g, shwvStore.targetLang);

  shwvStore.setLlmBatchRunning(true);
  shwvStore.setLlmBatchResponse('');
  emit('LlmCommand', 'run-llm-batch-request', {
    prompt: promptToSend,
    mode: shwvStore.llmMode,
    options: JSON.parse(JSON.stringify(shwvStore.llmChunkOptions)),
    chunkSize: shwvStore.llmBatchChunkSize || 3500
  });
}

function cancelBatchRequest() {
  emit('LlmCommand', 'cancel-llm-batch');
}

function applyPartialResults() {
  const responseText = shwvStore.llmPartialResponse || shwvStore.llmResponse;
  if (!responseText) return;

  const sentIndices = shwvStore.llmPartialIndices && shwvStore.llmPartialIndices.length > 0
    ? shwvStore.llmPartialIndices
    : (shwvStore.llmUnits ? shwvStore.llmUnits.map((u: any) => u.idx) : []);

  const updates = parsePartialResultLines(responseText, sentIndices);
  if (updates.length === 0) return;

  emit('LlmCommand', 'apply-llm-partial-results', {
    updates,
    applyToPre: applyToPre.value
  });
}

function parsePartialResultLines(text: string, sentIndices: number[]): { idx: number, tgt: string }[] {
  const cleaned = text.replace(/```(?:jsonl|json|text)?/gi, '').trim();
  const updates: { idx: number, tgt: string }[] = [];

  if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const idx = item.idx ?? item.index;
        const tgt = item.tgt ?? item.result ?? item.translation ?? item.target;
        if (typeof idx === 'number' && tgt !== undefined) {
          updates.push({ idx, tgt: String(tgt) });
        }
      }
      if (updates.length > 0) return updates;
    } catch (_) {}
  }

  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const matchedMap = new Map<number, string>();
  const plainLines: string[] = [];

  for (const line of lines) {
    const plainMatch = line.match(/^(?:Line\s*|\[)?(\d+)\]?\s*[:：]\s*(.*)$/i);
    if (plainMatch) {
      matchedMap.set(parseInt(plainMatch[1], 10), plainMatch[2]);
    } else {
      plainLines.push(line);
    }
  }

  if (matchedMap.size > 0) {
    for (const idx of sentIndices) {
      if (matchedMap.has(idx)) {
        updates.push({ idx, tgt: matchedMap.get(idx)! });
      }
    }
  }

  if (updates.length === 0 && plainLines.length > 0) {
    for (let i = 0; i < Math.min(plainLines.length, sentIndices.length); i++) {
      updates.push({ idx: sentIndices[i], tgt: plainLines[i] });
    }
  }

  return updates;
}

function applyBatchResults() {
  const responseText = shwvStore.llmBatchResponse || shwvStore.llmResponse;
  if (!responseText) return;
  emit('LlmCommand', 'apply-llm-results', {
    result: responseText
  });
}

function runChatRequest() {
  if (!shwvStore.llmChatQuery || !shwvStore.llmChatQuery.trim()) return;
  shwvStore.setLlmChatRequesting(true);
  shwvStore.setLlmChatResponse('');

  emit('LlmCommand', 'run-llm-chat-request', {
    query: shwvStore.llmChatQuery,
    includeContext: shwvStore.llmChatIncludeContext,
    contextChunk: shwvStore.llmChunk,
    previousResponse: shwvStore.llmPartialResponse || shwvStore.llmResponse
  });
}

function quoteContext() {
  let quote = '';
  if (shwvStore.llmUnits && shwvStore.llmUnits.length > 0) {
    quote += '【対象行の原文・下訳】:\n';
    for (const u of shwvStore.llmUnits) {
      quote += `${u.idx}: ${u.src} -> ${u.tgt || u.pre || ''}\n`;
    }
  }
  if (shwvStore.llmPartialResponse) {
    quote += `\n【直前のAI翻訳】:\n${shwvStore.llmPartialResponse}\n`;
  }
  if (quote) {
    shwvStore.llmChatQuery = (shwvStore.llmChatQuery ? shwvStore.llmChatQuery + '\n\n' : '') + quote + '\n【質問・指示】:\n';
  }
}

function copyChatResponse() {
  if (!shwvStore.llmChatResponse) return;
  navigator.clipboard.writeText(shwvStore.llmChatResponse).then(() => {
    Message.success(i18nStore.getText('llmTab', 'chatCopiedTip') || 'クリップボードにコピーしました！');
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = shwvStore.llmChatResponse;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    Message.success(i18nStore.getText('llmTab', 'chatCopiedTip') || 'クリップボードにコピーしました！');
  });
}

function onChatKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runChatRequest();
  }
}

const batchPercent = computed(() => {
  if (!shwvStore.llmBatchProgress.total) return 0;
  return Math.round((shwvStore.llmBatchProgress.current / shwvStore.llmBatchProgress.total) * 100);
});

const pinnedUnits = computed(() => {
  return shwvStore.units.filter(u => u.isPeRef);
});

function unpinUnit(idx: number) {
  const unit = shwvStore.units.find(u => u.idx === idx);
  if (unit) {
    unit.isPeRef = false;
    emit('LlmCommand', 'toggle-pe-ref', { idx, isPeRef: false });
  }
}

function jumpToUnitLine(idx: number) {
  emit('LlmCommand', 'goto-line', { line: idx });
}
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

    <a-tabs v-model:active-key="activeSubTab" position="left" class="llm-tabs">
      <a-tab-pane key="partial" :title="i18nStore.getText('llmTab', 'partialTabTitle') || 'Partial Processing'">
        <div class="subtab-content">
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

            <div class="execution-grid">
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
            </div>
          </a-card>

          <a-alert v-if="shwvStore.llmChunk && shwvStore.llmChunk.length > 4000" type="warning" show-icon style="margin-bottom: 12px; border-radius: 8px;">
            {{ i18nStore.getText('llmTab', 'rangeAlert', { len: shwvStore.llmChunk.length }) || `選択範囲が広すぎます。4000文字以下にしてください。（現在のサイズ: ${shwvStore.llmChunk.length}文字）` }}
          </a-alert>

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

          <a-card :title="i18nStore.getText('llmTab', 'responseCard') || 'Response & Results'" :bordered="false" class="premium-card result-card">
            <template #extra>
              <a-space align="center" v-if="shwvStore.llmPartialResponse">
                <a-checkbox v-model="applyToPre" style="font-size: 12px;">
                  {{ i18nStore.getText('llmTab', 'applyToPreLabel') || '下訳 (pre) にも反映' }}
                </a-checkbox>
                <a-button
                  type="primary"
                  status="success"
                  size="small"
                  @click="applyPartialResults"
                  class="apply-btn"
                >
                  <template #icon><icon-check /></template>
                  {{ i18nStore.getText('llmTab', 'applyPartialDirect') || 'Apply to Selection' }}
                </a-button>
              </a-space>
            </template>
            <a-spin :loading="shwvStore.llmRequesting" :tip="i18nStore.getText('llmTab', 'callingLlmTip') || 'Calling LLM via SheepBobbin...'" style="display: block; width: 100%;">
              <div class="result-container">
                <div v-if="shwvStore.llmPartialResponse !== '' || shwvStore.llmRequesting" class="result-content">
                  <a-textarea
                    v-model="shwvStore.llmPartialResponse"
                    placeholder="LLM response will appear here. You can edit this text before applying."
                    :auto-size="{ minRows: 8, maxRows: 16 }"
                    class="result-textarea"
                  />
                  <div class="result-note">
                    {{ i18nStore.getText('llmTab', 'idxZeroNote') || '※ 行番号 (idx) は 0 始まりのため、エディタの行番号より 1 小さい場合があります。' }}
                  </div>
                </div>
                <div v-else class="empty-state">
                  <a-typography-text type="secondary">
                    {{ i18nStore.getText('llmTab', 'noResponseYet') || 'No response yet. Run selected range to view results here.' }}
                  </a-typography-text>
                </div>
              </div>
            </a-spin>
          </a-card>

          <!-- Chat & Refinement Card -->
          <a-card :title="i18nStore.getText('llmTab', 'chatCardTitle') || 'AI Chat & Refinement'" :bordered="false" class="premium-card chat-card">
            <template #extra>
              <a-space size="small">
                <a-checkbox v-model="shwvStore.llmChatIncludeContext" size="small">
                  {{ i18nStore.getText('llmTab', 'includeContextLabel') || '直前の原文・訳文を文脈に含める' }}
                </a-checkbox>
                <a-button type="text" size="small" @click="quoteContext" class="action-btn">
                  <template #icon><icon-copy /></template>
                  {{ i18nStore.getText('llmTab', 'quoteContextBtn') || '直前の結果を引用' }}
                </a-button>
              </a-space>
            </template>

            <div class="chat-input-container">
              <a-textarea
                v-model="shwvStore.llmChatQuery"
                :placeholder="i18nStore.getText('llmTab', 'chatInputPlaceholder') || '質問や追加指示を入力...（例: idx2の訳文の根拠は？ / idx3の口調を丁寧に修正して）'"
                :auto-size="{ minRows: 3, maxRows: 8 }"
                @keydown="onChatKeyDown"
                class="chat-textarea"
              />
              <div class="chat-input-actions">
                <span class="shortcut-tip">Ctrl+Enter で送信</span>
                <a-button
                  type="primary"
                  size="small"
                  :loading="shwvStore.llmChatRequesting"
                  :disabled="!shwvStore.llmChatQuery || !shwvStore.llmChatQuery.trim()"
                  @click="runChatRequest"
                  class="chat-send-btn"
                >
                  <template #icon><icon-send /></template>
                  {{ i18nStore.getText('llmTab', 'sendChatBtn') || '質問を送信' }}
                </a-button>
              </div>
            </div>

            <a-divider style="margin: 12px 0 8px 0;" />

            <div class="chat-response-header">
              <span class="chat-response-title">{{ i18nStore.getText('llmTab', 'chatResponseTitle') || 'AIからの回答・解説' }}</span>
              <a-button
                v-if="shwvStore.llmChatResponse"
                type="text"
                size="mini"
                @click="copyChatResponse"
                class="copy-btn"
              >
                <template #icon><icon-copy /></template>
                {{ i18nStore.getText('llmTab', 'copyChatResponseBtn') || '回答をコピー' }}
              </a-button>
            </div>

            <a-spin :loading="shwvStore.llmChatRequesting" tip="AIが回答を生成中..." style="display: block; width: 100%;">
              <div class="chat-response-container">
                <div v-if="shwvStore.llmChatResponse !== '' || shwvStore.llmChatRequesting" class="chat-response-content">
                  <a-textarea
                    v-model="shwvStore.llmChatResponse"
                    placeholder="AIからの回答がここに表示されます。"
                    :auto-size="{ minRows: 4, maxRows: 14 }"
                    class="chat-response-textarea"
                  />
                </div>
                <div v-else class="empty-state" style="min-height: 50px;">
                  <a-typography-text type="secondary">
                    質問や追加の調整指示を送信すると、ここにAIからの回答・解説が表示されます。
                  </a-typography-text>
                </div>
              </div>
            </a-spin>
          </a-card>
        </div>
      </a-tab-pane>

      <a-tab-pane key="batch" :title="i18nStore.getText('llmTab', 'batchTabTitle') || 'Batch Processing'">
        <div class="subtab-content">
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
              <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px;">{{ i18nStore.getText('llmTab', 'chunkSizeLabel') || 'チャンクサイズ (文字数)' }}:</span>
                <a-tooltip :content="i18nStore.getText('llmTab', 'chunkSizeTooltip') || '一括処理で1回のリクエストに含める最大文字数（デフォルト: 3500）'">
                  <a-input-number
                    v-model="shwvStore.llmBatchChunkSize"
                    :min="500"
                    :max="10000"
                    :step="500"
                    size="small"
                    style="width: 140px;"
                  />
                </a-tooltip>
              </div>
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

          <a-card :title="i18nStore.getText('llmTab', 'batchResponseCard') || 'Batch Results'" :bordered="false" class="premium-card result-card">
            <template #extra>
              <a-button
                v-if="shwvStore.llmBatchResponse"
                type="primary"
                status="success"
                size="small"
                @click="applyBatchResults"
                class="apply-btn"
              >
                <template #icon><icon-check /></template>
                {{ i18nStore.getText('llmTab', 'applyToProject') || 'Apply to Project' }}
              </a-button>
            </template>
            <a-spin :loading="shwvStore.llmBatchRunning" :tip="i18nStore.getText('llmTab', 'callingLlmTip') || 'Calling LLM via SheepBobbin...'" style="display: block; width: 100%;">
              <div class="result-container">
                <div v-if="shwvStore.llmBatchResponse !== '' || shwvStore.llmBatchRunning" class="result-content">
                  <a-textarea
                    v-model="shwvStore.llmBatchResponse"
                    placeholder="LLM batch response will appear here. You can edit this text before applying."
                    :auto-size="{ minRows: 8, maxRows: 16 }"
                    class="result-textarea"
                  />
                  <div class="result-note">
                    {{ i18nStore.getText('llmTab', 'idxZeroNote') || '※ 行番号 (idx) は 0 始まりのため、エディタの行番号より 1 小さい場合があります。' }}
                  </div>
                </div>
                <div v-else class="empty-state">
                  <a-typography-text type="secondary">
                    {{ i18nStore.getText('llmTab', 'noBatchResponseYet') || 'No batch response yet. Run batch process to view results here.' }}
                  </a-typography-text>
                </div>
              </div>
            </a-spin>
          </a-card>

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

      <!-- Pinned PE References Tab -->
      <a-tab-pane key="pinned" :title="i18nStore.getText('llmTab', 'pinnedTabTitle') || 'ピン留め (PE)'">
        <div class="subtab-content">
          <a-card :title="i18nStore.getText('llmTab', 'pinnedCard') || 'Advanced PE 用ピン留め一覧'" :bordered="false" class="premium-card">
            <template #extra>
              <a-tag color="orange" style="font-weight: bold;">
                {{ pinnedUnits.length }} {{ i18nStore.getText('common', 'items') || '件' }}
              </a-tag>
            </template>

            <a-typography-paragraph type="secondary" style="font-size: 13px; margin-bottom: 16px;">
              {{ i18nStore.getText('llmTab', 'pinnedHelp') || 'ここでピン留めされたセグメントは、Advanced PE モード実行時にAIへ最優先の修正手本（PE参照例）として提示されます。' }}
            </a-typography-paragraph>

            <div v-if="pinnedUnits.length > 0" class="pinned-list">
              <a-card
                v-for="unit in pinnedUnits"
                :key="unit.idx"
                size="small"
                class="pinned-item-card"
                style="margin-bottom: 12px; border: 1px solid var(--vscode-sideBar-border); background-color: var(--vscode-editor-background);"
              >
                <template #title>
                  <a-space align="center">
                    <icon-pushpin style="color: #f59e0b;" />
                    <span style="font-weight: bold; font-family: monospace;">Line {{ unit.idx + 1 }}</span>
                    <a-tag v-if="unit.status === 1" color="green" size="small">Confirmed</a-tag>
                    <a-tag v-else-if="unit.status === 2" color="orange" size="small">Proofed</a-tag>
                  </a-space>
                </template>
                <template #extra>
                  <a-space>
                    <a-button type="outline" size="mini" @click="jumpToUnitLine(unit.idx)">
                      {{ i18nStore.getText('llmTab', 'jumpToLine') || 'エディタで移動' }}
                    </a-button>
                    <a-button type="text" status="danger" size="mini" @click="unpinUnit(unit.idx)">
                      <template #icon><icon-delete /></template>
                      {{ i18nStore.getText('llmTab', 'unpinBtn') || 'ピン解除' }}
                    </a-button>
                  </a-space>
                </template>

                <div class="pinned-text-block">
                  <div class="pinned-row"><span class="pinned-label">原文:</span> <span class="pinned-text">{{ unit.src }}</span></div>
                  <div v-if="unit.pre" class="pinned-row"><span class="pinned-label">下訳:</span> <span class="pinned-text muted">{{ unit.pre }}</span></div>
                  <div class="pinned-row"><span class="pinned-label">手直し後:</span> <span class="pinned-text highlight">{{ unit.tgt || '(未入力)' }}</span></div>
                </div>
              </a-card>
            </div>

            <div v-else class="empty-state" style="padding: 24px 0;">
              <a-typography-text type="secondary">
                {{ i18nStore.getText('llmTab', 'noPinnedSegments') || 'ピン留めされたセグメントはありません。翻訳タブやエディタでピンアイコンをクリックして登録できます。' }}
              </a-typography-text>
            </div>
          </a-card>
        </div>
      </a-tab-pane>

      <a-tab-pane key="prompt" :title="i18nStore.getText('llmTab', 'promptTabTitle') || 'Prompt & Schema'">
        <div class="subtab-content">
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

          <a-card :title="i18nStore.getText('llmTab', 'systemPromptCard') || 'System Prompt'" :bordered="false" class="premium-card prompt-card">
            <template #extra>
              <a-space size="mini">
                <a-tooltip :content="i18nStore.getText('llmTab', 'useLocalPromptTooltip') || 'ローカルのマークダウンファイルからプロンプトを読み込みます（部分処理・一括処理の両方に適用）'">
                  <a-checkbox v-model="shwvStore.llmUseLocalPrompt">
                    {{ i18nStore.getText('llmTab', 'useLocalPrompt') || 'Use Local Prompt' }}
                  </a-checkbox>
                </a-tooltip>
                <a-select v-model="shwvStore.llmSelectedPromptFile" :disabled="!shwvStore.llmUseLocalPrompt" @change="onSelectPromptFile" placeholder="Select prompt file" style="width: 200px" allow-search size="small">
                  <a-option v-for="f in promptFiles" :key="f" :value="f">{{ f }}</a-option>
                </a-select>
                <a-button type="text" size="small" :disabled="!shwvStore.llmUseLocalPrompt" @click="scanPromptFiles" title="Refresh prompt list">
                  <template #icon><icon-refresh /></template>
                </a-button>
                <a-button type="text" size="small" @click="exportPrompt" class="action-btn" title="Export prompt to prompt.md">
                  <template #icon><icon-download /></template>
                  {{ i18nStore.getText('llmTab', 'exportPrompt') || 'Export' }}
                </a-button>
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
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-radius: 6px;
  padding: 12px;
  border: 1px solid var(--vscode-sideBar-border, #2d2d2d);
}

.result-note {
  margin-top: 8px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground, #888);
  line-height: 1.4;
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

.chat-card {
  margin-top: 4px;
}

.chat-input-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-textarea,
.chat-response-textarea {
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  background-color: var(--vscode-input-background, #2d2d2d);
  color: var(--vscode-input-foreground, #cccccc);
  border: 1px solid var(--vscode-input-border, #3d3d3d);
}

.chat-input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shortcut-tip {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, #888);
}

.chat-send-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  font-weight: 600;
}

.chat-send-btn:hover {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
}

.chat-response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.chat-response-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground, #ccc);
}

.chat-response-container {
  min-height: 70px;
  max-height: 300px;
  overflow-y: auto;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-radius: 6px;
  padding: 8px;
  border: 1px solid var(--vscode-sideBar-border, #2d2d2d);
}

.copy-btn {
  color: var(--vscode-textLink-foreground, #3b82f6);
}

.pinned-text-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  line-height: 1.5;
}

.pinned-row {
  display: flex;
  gap: 8px;
}

.pinned-label {
  font-weight: 600;
  color: var(--vscode-descriptionForeground, #888);
  min-width: 65px;
  flex-shrink: 0;
}

.pinned-text {
  color: var(--vscode-foreground);
  word-break: break-word;
}

.pinned-text.muted {
  opacity: 0.7;
}

.pinned-text.highlight {
  color: #10b981;
  font-weight: 500;
}
</style>
