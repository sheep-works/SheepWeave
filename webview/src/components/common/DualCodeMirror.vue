<template>
  <div class="dual-codemirror-root">
    <!-- ステータスバー / 防壁アラート -->
    <div class="header-toolbar">
      <div class="status-left">
        <a-tag :color="isLineCountMatching ? 'green' : 'red'" size="small">
          <template #icon>
            <icon-check-circle v-if="isLineCountMatching" />
            <icon-exclamation-circle v-else />
          </template>
          {{ isLineCountMatching ? '行数一致' : '行数不一致！' }}
        </a-tag>
        <span class="line-badge">
          原文: <b class="src-count">{{ sourceLineCount }}</b> 行 / 
          訳文: <b :class="isLineCountMatching ? 'tgt-count-match' : 'tgt-count-mismatch'">{{ targetLineCount }}</b> 行
        </span>
        <span v-if="!isLineCountMatching && !allowNewline" class="error-msg">
          ⚠️ 訳文の行数が原文と一致していません。1行=1セグメントになるよう調整してください。
        </span>
      </div>

      <div class="status-right">
        <span v-if="pipeCount > 0" class="pipe-counter">
          {|} × {{ pipeCount }}
        </span>
        <a-button
          v-if="pipeCount > 0"
          size="mini"
          type="outline"
          status="warning"
          @click="replacePipeWithNewline"
          title="すべての {|} を改行に置換"
        >
          ↵ {|} を改行に
        </a-button>
      </div>
    </div>

    <!-- 左右分割エディタ (Arco Split) -->
    <div class="split-container">
      <a-split v-model:size="splitRatio" min="0.2" max="0.8" style="height: 100%;">
        <!-- 左ペイン: 原文 (Source) -->
        <template #first>
          <div class="pane-container pane-left">
            <div class="pane-header">
              <div class="pane-header-left">
                <span class="dot-indicator dot-src"></span>
                <span class="pane-title">📄 原文 (Source)</span>
                <a-tag size="mini" color="arcoblue">Read-Only</a-tag>
                <a-tag v-if="sourceHighlight?.trim()" size="mini" color="cyan">
                  検索: "{{ sourceHighlight }}"
                </a-tag>
              </div>
              <span class="pane-line-count">{{ sourceLineCount }} 行</span>
            </div>
            <div ref="sourceContainer" class="cm-wrapper"></div>
          </div>
        </template>

        <!-- 右ペイン: 訳文 (Target) -->
        <template #second>
          <div class="pane-container pane-right">
            <div class="pane-header">
              <div class="pane-header-left">
                <span class="dot-indicator dot-tgt"></span>
                <span class="pane-title">✏️ 訳文 (Target)</span>
                <a-tag v-if="!allowNewline" size="mini" color="orange">行数ガード有効</a-tag>
                <a-tag v-if="targetHighlight?.trim()" size="mini" color="gold">
                  検索: "{{ targetHighlight }}"
                </a-tag>
              </div>
              <span class="pane-line-count">{{ targetLineCount }} 行</span>
            </div>
            <div ref="targetContainer" class="cm-wrapper"></div>
          </div>
        </template>
      </a-split>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { IconCheckCircle, IconExclamationCircle } from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';
import { 
  EditorView, 
  keymap, 
  lineNumbers, 
  highlightActiveLine, 
  highlightActiveLineGutter,
  Decoration,
  MatchDecorator,
  ViewPlugin
} from '@codemirror/view';
import { EditorState, Transaction, Compartment, RangeSetBuilder } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

const props = withDefaults(defineProps<{
  sourceText: string;
  targetText: string;
  sourceHighlight?: string;
  targetHighlight?: string;
  allowNewline?: boolean;
  readOnlyTarget?: boolean;
}>(), {
  sourceHighlight: '',
  targetHighlight: '',
  allowNewline: false,
  readOnlyTarget: false
});

const emit = defineEmits<{
  (e: 'update:targetText', value: string): void;
  (e: 'line-mismatch', matching: boolean): void;
}>();

const splitRatio = ref(0.5);
const sourceContainer = ref<HTMLDivElement | null>(null);
const targetContainer = ref<HTMLDivElement | null>(null);

let sourceView: EditorView | null = null;
let targetView: EditorView | null = null;
let isInternalTargetUpdate = false;
let isInternalSourceUpdate = false;
let isSyncingScroll = false;

// Compartments for dynamic search highlighting
const srcHighlightCompartment = new Compartment();
const tgtHighlightCompartment = new Compartment();

// 行数計算
const sourceLineCount = computed(() => {
  if (!props.sourceText) return 0;
  return props.sourceText.split('\n').length;
});

const targetLineCount = computed(() => {
  if (!props.targetText) return 0;
  return props.targetText.split('\n').length;
});

const isLineCountMatching = computed(() => {
  if (props.allowNewline) return true;
  if (!props.sourceText && !props.targetText) return true;
  return sourceLineCount.value === targetLineCount.value;
});

watch(isLineCountMatching, (val) => {
  emit('line-mismatch', val);
}, { immediate: true });

const pipeCount = computed(() => {
  if (!props.targetText) return 0;
  const matches = props.targetText.match(/\{\|\}/g);
  return matches ? matches.length : 0;
});

// ゼブラストライププラグイン（偶数行の背景色を少し明るく）
const zebraPlugin = ViewPlugin.fromClass(class {
  decorations: any;
  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }
  update(update: any) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }
  buildDecorations(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>();
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        const line = view.state.doc.lineAt(pos);
        if (line.number % 2 === 0) {
          builder.add(line.from, line.from, Decoration.line({ class: 'cm-even-line' }));
        }
        pos = line.to + 1;
      }
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations
});

// タグ・プレースホルダー装飾デコレータ ({|}, {/}, {@...})
const markerDecorator = new MatchDecorator({
  regexp: /\{\|\}|\{\/\}|\{@\d+\}|\{\d+\}|<[^>]+>/g,
  decoration: (match) => {
    const text = match[0];
    if (text === '{|}') {
      return Decoration.mark({ class: 'cm-pipe-badge' });
    } else if (text === '{/}') {
      return Decoration.mark({ class: 'cm-slash-badge' });
    } else {
      return Decoration.mark({ class: 'cm-tag-badge' });
    }
  }
});

const markerPlugin = ViewPlugin.fromClass(class {
  decorations: any;
  constructor(view: EditorView) {
    this.decorations = markerDecorator.createDeco(view);
  }
  update(update: any) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = markerDecorator.updateDeco(update, this.decorations);
    }
  }
}, {
  decorations: v => v.decorations
});

// 検索キーワードハイライト作成ヘルパー
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSearchHighlightPlugin(query: string, className: string) {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return ViewPlugin.fromClass(class {
      decorations = Decoration.none;
    }, { decorations: v => v.decorations });
  }

  const escaped = escapeRegex(trimmed);
  let regex: RegExp;
  try {
    regex = new RegExp(escaped, 'gi');
  } catch {
    return ViewPlugin.fromClass(class {
      decorations = Decoration.none;
    }, { decorations: v => v.decorations });
  }

  const decorator = new MatchDecorator({
    regexp: regex,
    decoration: () => Decoration.mark({ class: className })
  });

  return ViewPlugin.fromClass(class {
    decorations: any;
    constructor(view: EditorView) {
      this.decorations = decorator.createDeco(view);
    }
    update(update: any) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = decorator.updateDeco(update, this.decorations);
      }
    }
  }, {
    decorations: v => v.decorations
  });
}

// CodeMirror テーマ（完全アライメント + 広めGutter + 行境界線 + ゼブラストライプ + 検索ハイライト）
const customEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'rgba(255, 255, 245, 0.92)',
    backgroundColor: 'transparent',
    fontSize: '13px',
    lineHeight: '26px',
  },
  '.cm-scroller': {
    overflowX: 'hidden !important',
    overflowY: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: '26px',
  },
  '.cm-content': {
    padding: '0 14px 0 0',
    caretColor: '#14b8a6',
    boxSizing: 'border-box',
    maxWidth: '100%',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#14b8a6',
    borderLeftWidth: '2px',
  },
  // Gutter 広め設定＆完全垂直アライメント
  '.cm-gutters': {
    backgroundColor: '#161822',
    color: 'rgba(235, 235, 245, 0.4)',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '0',
    minWidth: '46px',
    userSelect: 'none',
  },
  '.cm-gutterElement': {
    padding: '0 8px 0 4px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    textAlign: 'right',
    fontSize: '11px',
    lineHeight: '26px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(20, 184, 166, 0.22)',
    color: '#2dd4bf',
    fontWeight: 'bold',
  },
  // 行ごとの境界線（行間グリッド）＆ 折り返し
  '.cm-line': {
    padding: '0 12px 0 10px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    boxSizing: 'border-box',
    lineHeight: '26px',
    minHeight: '26px',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  },
  // ゼブラストライプ（偶数行）
  '.cm-even-line': {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  // 検索ハイライト（原文：シアン系、訳文：アンバー/ゴールド系）
  '.cm-search-src-highlight': {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    color: '#38bdf8',
    borderBottom: '2px solid #38bdf8',
    borderRadius: '2px',
    fontWeight: '600',
    padding: '1px 2px',
  },
  '.cm-search-tgt-highlight': {
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    color: '#fbbf24',
    borderBottom: '2px solid #fbbf24',
    borderRadius: '2px',
    fontWeight: '600',
    padding: '1px 2px',
  },
  // バッジデコレーション
  '.cm-pipe-badge': {
    backgroundColor: '#f59e0b25',
    color: '#fbbf24',
    border: '1px solid #f59e0b50',
    borderRadius: '3px',
    padding: '1px 3px',
    fontWeight: 'bold',
    fontSize: '11px',
    letterSpacing: '0.5px',
  },
  '.cm-slash-badge': {
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
    color: '#2dd4bf',
    border: '1px solid rgba(20, 184, 166, 0.4)',
    borderRadius: '3px',
    padding: '1px 3px',
    fontWeight: 'bold',
    fontSize: '11px',
  },
  '.cm-tag-badge': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '3px',
    padding: '1px 4px',
    fontSize: '11px',
  }
});

// 行数ガード：行数が変わるトランザクションを即座に破棄（Skip）するフィルター
const lineCountGuardFilter = EditorState.transactionFilter.of((tr: Transaction) => {
  if (props.allowNewline || !tr.docChanged) return tr;
  
  // 変更後の行数と変更前の行数を比較
  if (tr.newDoc.lines !== tr.startState.doc.lines) {
    Message.warning({
      content: '行数が変わる編集（改行や行の削除・結合）は禁止されています。',
      duration: 2000
    });
    return []; // トランザクションを破棄（skip）
  }

  return tr;
});

// スクロール同期（縦スクロールのみ安全に同期）
const setupScrollSync = () => {
  if (!sourceView || !targetView) return;

  const srcScroller = sourceView.scrollDOM;
  const tgtScroller = targetView.scrollDOM;

  const onSourceScroll = () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    tgtScroller.scrollTop = srcScroller.scrollTop;
    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  };

  const onTargetScroll = () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    srcScroller.scrollTop = tgtScroller.scrollTop;
    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  };

  srcScroller.addEventListener('scroll', onSourceScroll);
  tgtScroller.addEventListener('scroll', onTargetScroll);

  return () => {
    srcScroller.removeEventListener('scroll', onSourceScroll);
    tgtScroller.removeEventListener('scroll', onTargetScroll);
  };
};

// {|} を改行に置換
function replacePipeWithNewline() {
  if (!targetView) return;
  const fullText = targetView.state.doc.toString();
  const replaced = fullText.replace(/\{\|\}/g, '\n');
  targetView.dispatch({
    changes: { from: 0, to: fullText.length, insert: replaced },
    userEvent: 'input.replace',
  });
}

defineExpose({
  replacePipeWithNewline,
});

let cleanupScrollSync: (() => void) | undefined;

onMounted(() => {
  // 原文エディタ (Source) の初期化
  if (sourceContainer.value) {
    const srcState = EditorState.create({
      doc: props.sourceText || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        EditorView.lineWrapping, // 自動折り返し
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        zebraPlugin,
        markerPlugin,
        srcHighlightCompartment.of(createSearchHighlightPlugin(props.sourceHighlight || '', 'cm-search-src-highlight')),
        customEditorTheme,
      ]
    });
    sourceView = new EditorView({
      state: srcState,
      parent: sourceContainer.value
    });
  }

  // 訳文エディタ (Target) の初期化
  if (targetContainer.value) {
    const tgtExtensions = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      EditorView.lineWrapping, // 自動折り返し
      zebraPlugin,
      markerPlugin,
      tgtHighlightCompartment.of(createSearchHighlightPlugin(props.targetHighlight || '', 'cm-search-tgt-highlight')),
      customEditorTheme,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.editable.of(!props.readOnlyTarget),
      EditorState.readOnly.of(props.readOnlyTarget),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isInternalTargetUpdate = true;
          const newVal = update.state.doc.toString();
          emit('update:targetText', newVal);
          setTimeout(() => {
            isInternalTargetUpdate = false;
          }, 0);
        }
      })
    ];

    if (!props.allowNewline) {
      tgtExtensions.push(lineCountGuardFilter);
    }

    const tgtState = EditorState.create({
      doc: props.targetText || '',
      extensions: tgtExtensions
    });

    targetView = new EditorView({
      state: tgtState,
      parent: targetContainer.value
    });
  }

  cleanupScrollSync = setupScrollSync();
});

watch(() => props.sourceText, (newVal) => {
  if (sourceView && !isInternalSourceUpdate) {
    const currentDoc = sourceView.state.doc.toString();
    if (newVal !== currentDoc) {
      sourceView.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: newVal || '' }
      });
    }
  }
});

watch(() => props.targetText, (newVal) => {
  if (targetView && !isInternalTargetUpdate) {
    const currentDoc = targetView.state.doc.toString();
    if (newVal !== currentDoc) {
      targetView.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: newVal || '' }
      });
    }
  }
});

// 検索キーワードの動的反映 (Compartment reconfigure)
watch(() => props.sourceHighlight, (newVal) => {
  if (sourceView) {
    sourceView.dispatch({
      effects: srcHighlightCompartment.reconfigure(
        createSearchHighlightPlugin(newVal || '', 'cm-search-src-highlight')
      )
    });
  }
});

watch(() => props.targetHighlight, (newVal) => {
  if (targetView) {
    targetView.dispatch({
      effects: tgtHighlightCompartment.reconfigure(
        createSearchHighlightPlugin(newVal || '', 'cm-search-tgt-highlight')
      )
    });
  }
});

onBeforeUnmount(() => {
  if (cleanupScrollSync) {
    cleanupScrollSync();
  }
  if (sourceView) {
    sourceView.destroy();
    sourceView = null;
  }
  if (targetView) {
    targetView.destroy();
    targetView = null;
  }
});
</script>

<style scoped>
.dual-codemirror-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #141621;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-sizing: border-box;
}

.header-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: #1a1d2e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  box-sizing: border-box;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.line-badge {
  font-size: 12px;
}

.src-count {
  color: #60a5fa;
}

.tgt-count-match {
  color: #2dd4bf;
}

.tgt-count-mismatch {
  color: #f87171;
  font-weight: bold;
}

.error-msg {
  font-size: 12px;
  color: #f87171;
}

.pipe-counter {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.split-container {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.pane-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: #141621;
  box-sizing: border-box;
}

.pane-left {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background-color: #161822;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  user-select: none;
  font-size: 12px;
  height: 32px;
  box-sizing: border-box;
}

.pane-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pane-title {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.pane-line-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
}

.dot-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-src {
  background-color: #22d3ee;
  box-shadow: 0 0 6px rgba(34, 211, 238, 0.4);
}

.dot-tgt {
  background-color: #2dd4bf;
  box-shadow: 0 0 6px rgba(45, 212, 191, 0.4);
}

.cm-wrapper {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

:deep(.cm-editor) {
  height: 100%;
  outline: none !important;
}

:deep(.cm-scroller) {
  height: 100%;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

:deep(.cm-content) {
  max-width: 100% !important;
  box-sizing: border-box !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}

:deep(.cm-line) {
  max-width: 100% !important;
  box-sizing: border-box !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}

:deep(.arco-split-pane) {
  overflow: hidden !important;
}

:deep(.arco-split-trigger) {
  background-color: rgba(255, 255, 255, 0.08);
  transition: background-color 0.2s;
}

:deep(.arco-split-trigger:hover) {
  background-color: #14b8a6;
}
</style>
