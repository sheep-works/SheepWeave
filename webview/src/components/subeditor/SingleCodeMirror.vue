<template>
  <div class="single-cm-root" ref="container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
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
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

const props = withDefaults(defineProps<{
  modelValue: string;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
}>(), {
  readOnly: false,
  minHeight: '80px',
  maxHeight: '400px'
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'navigate-next'): void;
  (e: 'navigate-prev'): void;
}>();

const container = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;
let isInternalUpdate = false;

const focus = (pos: 'start' | 'end' = 'end') => {
  if (view) {
    view.focus();
    const docLen = view.state.doc.length;
    const offset = pos === 'start' ? 0 : docLen;
    view.dispatch({
      selection: { anchor: offset, head: offset },
      scrollIntoView: true
    });
  }
};

defineExpose({
  focus
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

// CodeMirror テーマ（サブエディタ用ダークトーン）
const singleEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'rgba(255, 255, 245, 0.92)',
    backgroundColor: 'transparent',
    fontSize: '13px',
    lineHeight: '22px',
  },
  '.cm-scroller': {
    overflowX: 'hidden !important',
    overflowY: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: '22px',
  },
  '.cm-content': {
    padding: '4px 10px 4px 4px',
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
  '.cm-gutters': {
    backgroundColor: '#161822',
    color: 'rgba(235, 235, 245, 0.35)',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '4px 0',
    minWidth: '36px',
    userSelect: 'none',
  },
  '.cm-gutterElement': {
    padding: '0 6px 0 2px',
    textAlign: 'right',
    fontSize: '11px',
    lineHeight: '22px',
    boxSizing: 'border-box',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
    color: '#2dd4bf',
    fontWeight: 'bold',
  },
  '.cm-line': {
    padding: '0 4px',
    boxSizing: 'border-box',
    lineHeight: '22px',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
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

onMounted(() => {
  if (!container.value) return;

  const navKeymap = [
    {
      key: 'Ctrl-ArrowDown',
      mac: 'Cmd-ArrowDown',
      run: () => {
        emit('navigate-next');
        return true;
      }
    },
    {
      key: 'Ctrl-ArrowUp',
      mac: 'Cmd-ArrowUp',
      run: () => {
        emit('navigate-prev');
        return true;
      }
    },
  ];

  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    EditorView.lineWrapping,
    markerPlugin,
    singleEditorTheme,
    keymap.of(navKeymap)
  ];

  if (!props.readOnly) {
    extensions.push(
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.editable.of(true),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isInternalUpdate = true;
          const newVal = update.state.doc.toString();
          emit('update:modelValue', newVal);
          setTimeout(() => {
            isInternalUpdate = false;
          }, 0);
        }
      })
    );
  } else {
    extensions.push(
      EditorView.editable.of(false),
      EditorState.readOnly.of(true)
    );
  }

  const state = EditorState.create({
    doc: props.modelValue || '',
    extensions
  });

  view = new EditorView({
    state,
    parent: container.value
  });
});

watch(() => props.modelValue, (newVal) => {
  if (view && !isInternalUpdate) {
    const currentDoc = view.state.doc.toString();
    if (newVal !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: newVal || '' }
      });
    }
  }
});

onBeforeUnmount(() => {
  if (view) {
    view.destroy();
    view = null;
  }
});
</script>

<style scoped>
.single-cm-root {
  width: 100%;
  height: 100%;
  min-height: v-bind(minHeight);
  max-height: v-bind(maxHeight);
  display: flex;
  flex-direction: column;
  background-color: #141621;
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
</style>
