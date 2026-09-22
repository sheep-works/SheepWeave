<template>
  <div class="unit-editor-card" :class="{ 'is-modified': isModified }">
    <!-- カードヘッダー -->
    <div class="card-header">
      <div class="header-left">
        <a-tag :color="unit.idx === -1 ? 'orange' : 'arcoblue'" size="small">
          {{ unit.idx === -1 ? 'TM' : `#${unit.idx + 1}` }}
        </a-tag>

        <a-tag v-if="unit.status" :color="unit.status === 'confirmed' ? 'green' : 'gray'" size="small">
          {{ unit.status === 'confirmed' ? '確定済み' : '未確定' }}
        </a-tag>

        <a-tag v-if="matchRatio !== undefined" color="cyan" size="small">
          {{ matchRatio }}% 類似
        </a-tag>

        <span class="char-count">
          原文: {{ sourceLength }} 字 / 訳文: {{ targetLength }} 字
        </span>

        <a-tag v-if="isModified" color="gold" size="small">
          変更あり
        </a-tag>
      </div>

      <div class="header-right">
        <a-space size="mini">
          <a-button
            v-if="isModified"
            size="mini"
            type="text"
            status="warning"
            @click="handleReset"
            title="元の訳文に戻す"
          >
            <template #icon><icon-undo /></template>
            元に戻す
          </a-button>

          <a-button
            v-if="isModified"
            size="mini"
            type="primary"
            status="success"
            @click="handleApplySingle"
            title="このセグメントのみ反映"
          >
            <template #icon><icon-check /></template>
            反映
          </a-button>
        </a-space>
      </div>
    </div>

    <!-- 2ペイン表示 (Arco Split) -->
    <div class="card-body">
      <a-split v-model:size="splitRatio" min="0.2" max="0.8" style="height: 100%;">
        <!-- 左ペイン: 原文 (Diff または CodeMirror) -->
        <template #first>
          <div class="pane-wrapper left-pane" :class="{ 'is-bypass': mode === 'bypass' }">
            <div class="pane-label">
              <span class="dot dot-src"></span>
              <span>{{ mode === 'bypass' ? '📄 原文 (Source)' : '✏️ 原文 (Source / 視認用メモ)' }}</span>
              <a-tag v-if="mode === 'bypass'" size="mini" color="cyan">差分ハイライト</a-tag>
              <a-tag v-else size="mini" color="arcoblue">自由改行・整形OK (非反映)</a-tag>
            </div>

            <!-- バイパス翻訳モード: Diff 表示 -->
            <div v-if="mode === 'bypass'" class="diff-container">
              <div class="diff-html" v-html="sourceDiffHtml"></div>
            </div>

            <!-- フリーエディタモード: CodeMirror 表示 (視認性向上のためのローカル編集可能) -->
            <div v-else class="cm-pane-container">
              <SingleCodeMirror
                ref="sourceEditorRef"
                :model-value="sourceValue ?? unit.src ?? ''"
                :read-only="false"
                min-height="70px"
                @update:model-value="emit('update:sourceValue', $event)"
                @navigate-next="emit('navigate-next', unit.idx)"
                @navigate-prev="emit('navigate-prev', unit.idx)"
              />
            </div>
          </div>
        </template>

        <!-- 右ペイン: 訳文 CodeMirror (Editable) -->
        <template #second>
          <div class="pane-wrapper right-pane">
            <div class="pane-label">
              <span class="dot dot-tgt"></span>
              <span>✏️ 訳文 (Target)</span>
              <a-tag size="mini" color="teal">自由改行OK</a-tag>
              <a-tag v-if="hasNewlines" size="mini" color="purple">
                {{ newlineBadgeText }}
              </a-tag>
            </div>

            <div class="cm-pane-container">
              <SingleCodeMirror
                ref="targetEditorRef"
                :model-value="modelValue"
                :read-only="false"
                min-height="70px"
                @update:model-value="emit('update:modelValue', $event)"
                @navigate-next="emit('navigate-next', unit.idx)"
                @navigate-prev="emit('navigate-prev', unit.idx)"
              />
            </div>
          </div>
        </template>
      </a-split>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IconUndo, IconCheck } from '@arco-design/web-vue/es/icon';
import type { ShWvUnit } from '../../../../src/types/datatype';
import { DiffUtils } from '../../utils/diffUtils';
import { smartJoinLines, type NewlineJoinMode } from '../../utils/textUtils';
import SingleCodeMirror from './SingleCodeMirror.vue';

const props = withDefaults(defineProps<{
  unit: ShWvUnit & { ori?: string; matchRatio?: number };
  baseUnit?: ShWvUnit | null;
  mode: 'bypass' | 'free';
  modelValue: string;
  originalText: string;
  sourceValue?: string;
  originalSourceText?: string;
  matchRatio?: number;
  newlineMode?: NewlineJoinMode;
  customDelimiter?: string;
}>(), {
  baseUnit: null,
  sourceValue: undefined,
  originalSourceText: undefined,
  matchRatio: undefined,
  newlineMode: 'auto',
  customDelimiter: ''
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'update:sourceValue', val: string): void;
  (e: 'apply-single', payload: { idx: number; tgt: string }): void;
  (e: 'reset-single', idx: number): void;
  (e: 'navigate-next', idx: number): void;
  (e: 'navigate-prev', idx: number): void;
}>();

const targetEditorRef = ref<InstanceType<typeof SingleCodeMirror> | null>(null);
const sourceEditorRef = ref<InstanceType<typeof SingleCodeMirror> | null>(null);

const focus = (pos: 'start' | 'end' = 'end') => {
  targetEditorRef.value?.focus(pos);
};

defineExpose({
  focus
});

const splitRatio = ref(0.5);

// 変更検知は訳文（Target）のみを対象とする（原文は作業用メモ扱い）
const isModified = computed(() => {
  return props.modelValue !== props.originalText;
});

const hasNewlines = computed(() => {
  return (props.modelValue || '').includes('\n');
});

const hasSourceNewlines = computed(() => {
  const src = props.unit.src || '';
  return src.includes('\\n') || src.includes('\n');
});

const newlineBadgeText = computed(() => {
  if (props.newlineMode === 'escape' || (props.newlineMode === 'auto' && hasSourceNewlines.value)) {
    return '反映時: \\n に変換';
  }
  if (props.newlineMode === 'custom') {
    return `反映時: カスタム区切り ("${props.customDelimiter}")`;
  }
  if (props.newlineMode === 'nospace') {
    return '反映時: 空白なし連結';
  }
  if (props.newlineMode === 'space') {
    return '反映時: 半角スペース連結';
  }
  return '反映時: スマート連結 (CJK自動)';
});

const sourceLength = computed(() => (props.sourceValue ?? props.unit.src ?? '').length);
const targetLength = computed(() => (props.modelValue || '').length);

// バイパス時の原文差分ハイライト生成
const sourceDiffHtml = computed(() => {
  if (props.mode !== 'bypass') return props.sourceValue ?? props.unit.src ?? '';
  
  // 基準ユニットが存在する場合は基準原文との差分
  if (props.baseUnit && props.baseUnit.idx !== props.unit.idx) {
    return DiffUtils.getDiffHtml(props.baseUnit.src || '', props.sourceValue ?? props.unit.src ?? '');
  }
  
  // 基準ユニットがない場合は通常のテキスト表示
  return props.sourceValue ?? props.unit.src ?? '';
});

// 反映用テキスト整形 (スマート連結 / エスケープ / カスタム区切り)
const formattedTarget = computed(() => {
  return smartJoinLines(
    props.modelValue || '',
    props.newlineMode,
    props.customDelimiter,
    hasSourceNewlines.value
  );
});

const handleApplySingle = () => {
  if (props.unit.idx >= 0) {
    emit('apply-single', {
      idx: props.unit.idx,
      tgt: formattedTarget.value
    });
  }
};

const handleReset = () => {
  emit('reset-single', props.unit.idx);
};
</script>

<style scoped>
.unit-editor-card {
  background-color: #161822;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.unit-editor-card.is-modified {
  border-color: rgba(245, 158, 11, 0.4);
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.08);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background-color: #1a1d2e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.char-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: 4px;
}

.header-right {
  display: flex;
  align-items: center;
}

.card-body {
  height: 140px;
  min-height: 100px;
}

.pane-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: #141621;
  overflow: hidden;
  box-sizing: border-box;
}

.left-pane {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.left-pane.is-bypass {
  background-color: #1a1e2f;
}

.left-pane.is-bypass .pane-label {
  background-color: #1e2438;
  border-bottom: 1px solid rgba(34, 211, 238, 0.15);
}

.pane-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: #161822;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
  user-select: none;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot-src {
  background-color: #22d3ee;
}

.dot-tgt {
  background-color: #2dd4bf;
}

.diff-container {
  flex: 1;
  padding: 10px 14px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  word-break: break-word;
  white-space: pre-wrap;
  background-color: #181c2d;
}

.cm-pane-container {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

:deep(del),
:deep(.diff-del) {
  background-color: rgba(239, 68, 68, 0.25);
  color: #f87171;
  text-decoration: line-through;
  padding: 1px 4px;
  border-radius: 3px;
  margin: 0 1px;
}

:deep(ins),
:deep(.diff-ins) {
  background-color: rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  font-weight: 600;
  text-decoration: underline;
  padding: 1px 4px;
  border-radius: 3px;
  margin: 0 1px;
}

:deep(.arco-split-trigger) {
  background-color: rgba(255, 255, 255, 0.06);
}
</style>
